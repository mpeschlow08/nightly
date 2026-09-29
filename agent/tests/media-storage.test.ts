import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RollingMediaBuffer } from "../src/media/buffer";
import { EncryptedMediaStorage, MAX_SEGMENT_BYTES, type MediaStorageOptions } from "../src/media/storage";
import { systemdMediaKeyProvider } from "../src/media/storage";

async function fixture(overrides: Partial<MediaStorageOptions> = {}) {
  const directory = await mkdtemp(join(tmpdir(), "nightly-media-"));
  const key = randomBytes(32);
  const options: MediaStorageOptions = { directory, keyProvider: async () => key, ...overrides };
  return { directory, key, store: new EncryptedMediaStorage(options), reopen: () => new EncryptedMediaStorage(options), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test("encrypts at rest, authenticates reads, rejects bad keys and traversal", async () => {
  const context = await fixture();
  try {
    const plaintext = Buffer.from("sensitive-media-test-".repeat(100));
    const record = await context.store.appendSegment(12, plaintext);
    assert.match(record.id, /^[0-9a-f]{32}$/);
    assert.deepEqual(await context.reopen().read(record.id), plaintext);
    const names = await readdir(context.directory);
    assert.ok(names.includes(`${record.id}.enc`));
    assert.ok(!names.some((name) => name.includes("12") && name !== `${record.id}.enc`));
    for (const name of names) {
      const disk = await readFile(join(context.directory, name), "utf8");
      assert.equal(disk.includes(plaintext.toString()), false);
      assert.equal(disk.includes(context.key.toString("base64")), false);
      assert.equal(disk.includes("credential-key"), false);
    }
    await assert.rejects(context.store.read("../credential-key"), /Invalid media id/);
    await assert.rejects(new EncryptedMediaStorage({ directory: context.directory, keyProvider: async () => randomBytes(32) }).read(record.id), /authentication failed/);
    const path = join(context.directory, `${record.id}.enc`);
    const envelope = JSON.parse(await readFile(path, "utf8"));
    envelope.ciphertext = "AAAA" + envelope.ciphertext.slice(4);
    await writeFile(path, JSON.stringify(envelope));
    await assert.rejects(context.store.read(record.id), /authentication failed/);
  } finally { await context.cleanup(); }
});

test("fails closed without a secure key and caps segment and disk reserve", async () => {
  const context = await fixture();
  try {
    await assert.rejects(new EncryptedMediaStorage({ directory: context.directory, keyProvider: async () => Buffer.alloc(0) }).appendSegment(1, Buffer.from("x")), /key is unavailable/);
    await assert.rejects(context.store.appendSegment(1, Buffer.alloc(MAX_SEGMENT_BYTES + 1)), /Invalid media segment/);
    const reserved = new EncryptedMediaStorage({ directory: context.directory, keyProvider: async () => context.key, diskReserveBytes: Number.MAX_SAFE_INTEGER });
    await assert.rejects(reserved.appendSegment(1, Buffer.from("x")), /disk reserve/);
    await assert.rejects(systemdMediaKeyProvider("")(), /credential key is unavailable/);
    await assert.rejects(context.reopen().read("00000000000000000000000000000000"), /not available/);
  } finally { await context.cleanup(); }
});

test("evicts oldest on count, bytes, per-source and time limits; protects Hot Moments", async () => {
  let now = 100_000;
  const context = await fixture({ now: () => now, maxCount: 2, maxBytes: 8, maxSourceBytes: 4, maxAgeMs: 100, maxHotBytes: 4 });
  try {
    const first = await context.store.appendSegment(1, Buffer.from("1234"));
    now++;
    const second = await context.store.appendSegment(2, Buffer.from("1234"));
    now++;
    const third = await context.store.appendSegment(1, Buffer.from("abcd"));
    assert.deepEqual((await context.store.list("segment")).map((item) => item.id), [second.id, third.id]);
    await assert.rejects(context.store.read(first.id), /not available/);
    const hot = await context.store.createHotMoment(1, Buffer.from("HOT!"), now + 500);
    await assert.rejects(context.store.createHotMoment(1, Buffer.from("MORE"), now + 500), /Hot Moment quota/);
    now += 101;
    assert.deepEqual(await context.store.list("segment"), []);
    assert.equal((await context.store.read(hot.id)).toString(), "HOT!");
    await context.store.deleteHotMoment(hot.id);
    await assert.rejects(context.store.read(hot.id), /not available/);
  } finally { await context.cleanup(); }
});

test("recovers interrupted writes, orphan payloads, missing/corrupt payloads and expired objects", async () => {
  let now = 20_000;
  const context = await fixture({ now: () => now, maxAgeMs: 10 });
  try {
    const missing = await context.store.appendSegment(1, Buffer.from("missing"));
    const corrupt = await context.store.appendSegment(2, Buffer.from("corrupt"));
    const expired = await context.store.appendSegment(3, Buffer.from("expired"));
    const orphan = await context.store.appendSegment(4, Buffer.from("orphan"));
    const hot = await context.store.createHotMoment(1, Buffer.from("hot"), now + 5);
    const index = await readFile(join(context.directory, "index.enc"));
    await rm(join(context.directory, `${missing.id}.enc`));
    await writeFile(join(context.directory, `${corrupt.id}.enc`), "tampered");
    await writeFile(join(context.directory, "00000000-0000-0000-0000-000000000000.tmp"), "partial");
    await rm(join(context.directory, "index.enc"));
    const recoveredOrphan = await context.store.appendSegment(5, Buffer.from("new"));
    await writeFile(join(context.directory, "index.enc"), index);
    now += 6;
    const report = await context.reopen().recover();
    assert.equal(report.orphanTemps, 1);
    assert.equal(report.missing, 2);
    assert.equal(report.corrupt, 1);
    assert.equal(report.orphans, 1);
    assert.equal(report.expired, 1);
    assert.deepEqual((await context.store.list()).map((item) => item.id).sort(), [expired.id, orphan.id].sort());
    assert.equal((await readdir(context.directory)).includes(`${recoveredOrphan.id}.enc`), false);
    assert.equal((await context.store.read(orphan.id)).toString(), "orphan");
    await assert.rejects(context.store.read(hot.id), /not available/);
  } finally { await context.cleanup(); }
});

test("rolling buffer emits bounded encrypted segments", async () => {
  const context = await fixture();
  try {
    const buffer = new RollingMediaBuffer(context.store, 4);
    const records = await buffer.push(1, Buffer.from("abcdefghij"));
    assert.deepEqual(await Promise.all(records.map((record) => context.store.read(record.id))), [Buffer.from("abcd"), Buffer.from("efgh")]);
    const last = await buffer.flush(1);
    assert.equal((await context.store.read(last!.id)).toString(), "ij");
  } finally { await context.cleanup(); }
});

test("recovery with lost index and unmatched key leaves encrypted payload untouched", async () => {
  const context = await fixture();
  try {
    const record = await context.store.appendSegment(1, Buffer.from("irrecoverable-without-key"));
    const payloadPath = join(context.directory, `${record.id}.enc`);
    const original = await readFile(payloadPath);
    await rm(join(context.directory, "index.enc"));
    await assert.rejects(new EncryptedMediaStorage({ directory: context.directory, keyProvider: async () => randomBytes(32) }).recover(), /authenticated index/);
    assert.deepEqual(await readFile(payloadPath), original);
    await assert.rejects(context.reopen().recover(), /authenticated index/);
    assert.deepEqual(await readFile(payloadPath), original);
  } finally { await context.cleanup(); }
});

test("rolling buffer retries a full segment after a failed write", async () => {
  const context = await fixture();
  try {
    let fail = true;
    const storage = { appendSegment: async (sourceId: number, data: Buffer) => {
      if (fail) throw new Error("disk temporarily unavailable");
      return context.store.appendSegment(sourceId, data);
    } } as EncryptedMediaStorage;
    const buffer = new RollingMediaBuffer(storage, 4);
    await assert.rejects(buffer.push(1, Buffer.from("abcd")), /disk temporarily unavailable/);
    fail = false;
    const records = await buffer.push(1, Buffer.from("efgh"));
    assert.deepEqual(await Promise.all(records.map((record) => context.store.read(record.id))), [Buffer.from("abcd"), Buffer.from("efgh")]);
  } finally { await context.cleanup(); }
});

test("systemd provider loads the existing credential-key material without persisting it in media metadata", async () => {
  const context = await fixture();
  try {
    const credentialPath = join(context.directory, "credential-key");
    await writeFile(credentialPath, context.key.toString("base64"), { mode: 0o600 });
    const media = new EncryptedMediaStorage({ directory: join(context.directory, "media"), keyProvider: systemdMediaKeyProvider(context.directory), keyVersion: 2 });
    const record = await media.appendSegment(1, Buffer.from("private"));
    assert.equal((await media.read(record.id)).toString(), "private");
    const indexText = await readFile(join(context.directory, "media", "index.enc"), "utf8");
    assert.equal(indexText.includes(context.key.toString("base64")), false);
    await assert.rejects(new EncryptedMediaStorage({ directory: join(context.directory, "media"), keyProvider: systemdMediaKeyProvider(context.directory), keyVersion: 1 }).read(record.id), /key version unavailable/);
  } finally { await context.cleanup(); }
});

test("deleting a hot object tolerates missing bytes and remains idempotent", async () => {
  const context = await fixture();
  try {
    const hot = await context.store.createHotMoment(1, Buffer.from("hot"), Date.now() + 1000);
    await rm(join(context.directory, `${hot.id}.enc`));
    await context.store.deleteHotMoment(hot.id);
    await context.reopen().deleteHotMoment(hot.id);
    assert.deepEqual(await context.store.list("hot"), []);
  } finally { await context.cleanup(); }
});

test("rejects oversized authenticated index and out-of-bounds metadata", async () => {
  const context = await fixture();
  try {
    await assert.rejects(context.store.appendSegment(1, Buffer.from("old"), Date.now() - 6 * 60_000), /Invalid media segment/);
    await assert.rejects(context.store.createHotMoment(1, Buffer.from("hot"), Date.now() + 61 * 60_000), /Invalid media segment/);
    const hot = await context.store.createHotMoment(1, Buffer.from("valid"), Date.now() + 1000);
    await writeFile(join(context.directory, "index.enc"), Buffer.alloc(256 * 1024 + 1));
    await assert.rejects(context.reopen().recover(), /Invalid media index/);
    assert.ok((await readdir(context.directory)).includes(`${hot.id}.enc`));
  } finally { await context.cleanup(); }
});

test("rolling eviction and recovery never remove an unexpired indexed hot object", async () => {
  let now = 10_000;
  const context = await fixture({ now: () => now, maxCount: 1, maxBytes: 4, maxSourceBytes: 4 });
  try {
    const hot = await context.store.createHotMoment(1, Buffer.from("protected"), now + 1000);
    for (let index = 0; index < 4; index++) {
      await context.store.appendSegment(1, Buffer.from("roll"));
      now++;
    }
    await context.reopen().recover();
    await context.reopen().recover();
    assert.equal((await context.store.read(hot.id)).toString(), "protected");
    assert.deepEqual((await context.store.list("hot")).map((record) => record.id), [hot.id]);
  } finally { await context.cleanup(); }
});

test("rolling replacement commits new encrypted bytes before removing the old payload", async () => {
  const context = await fixture({ maxCount: 1 });
  try {
    const first = await context.store.appendSegment(1, Buffer.from("old-private"));
    const second = await context.store.appendSegment(1, Buffer.from("new-private"));
    assert.deepEqual((await context.reopen().list("segment")).map((entry) => entry.id), [second.id]);
    assert.equal((await context.reopen().read(second.id)).toString(), "new-private");
    assert.equal((await readdir(context.directory)).includes(`${first.id}.enc`), false);
    for (const name of await readdir(context.directory)) {
      assert.equal((await readFile(join(context.directory, name), "utf8")).includes("new-private"), false);
    }
  } finally { await context.cleanup(); }
});

for (const failure of ["open", "write", "sync", "payload rename", "index rename"] as const) {
  test(`failed rolling replacement at ${failure} preserves old files and index`, async () => {
    let fail: string | undefined;
    const context = await fixture({ maxCount: 1, filesystem: {
      open: async (path, flags, mode) => {
        const handle = await open(path, flags, mode);
        if (fail === "open") {
          await handle.close();
          throw new Error("injected open failure after creating temp");
        }
        if (fail === "write") handle.writeFile = async () => { throw new Error("injected write failure"); };
        if (fail === "sync") handle.sync = async () => { throw new Error("injected sync failure"); };
        return handle;
      },
      rename: async (source, destination) => {
        if (fail === "payload rename" && String(destination).endsWith(".enc") && !String(destination).endsWith("index.enc") ||
            fail === "index rename" && String(destination).endsWith("index.enc")) throw new Error("injected rename failure");
        await rename(source, destination);
      },
    } });
    try {
      const first = await context.store.appendSegment(1, Buffer.from("old-private"));
      const priorIndex = await readFile(join(context.directory, "index.enc"));
      const priorPayload = await readFile(join(context.directory, `${first.id}.enc`));
      fail = failure;
      await assert.rejects(context.store.appendSegment(1, Buffer.from("new-private")), /injected/);
      assert.deepEqual(await readFile(join(context.directory, "index.enc")), priorIndex);
      assert.deepEqual(await readFile(join(context.directory, `${first.id}.enc`)), priorPayload);
      assert.deepEqual(await readdir(context.directory), [`${first.id}.enc`, "index.enc"]);
      assert.equal((await context.reopen().read(first.id)).toString(), "old-private");
    } finally { await context.cleanup(); }
  });
}

test("failed replacement preserves even expired prior files until commit", async () => {
  let now = 100;
  let fail = false;
  const context = await fixture({ now: () => now, maxAgeMs: 10, maxCount: 1, filesystem: {
    rename: async (source, destination) => {
      if (fail && String(destination).endsWith("index.enc")) throw new Error("injected index failure");
      await rename(source, destination);
    },
  } });
  try {
    const first = await context.store.appendSegment(1, Buffer.from("old"));
    const priorIndex = await readFile(join(context.directory, "index.enc"));
    const priorPayload = await readFile(join(context.directory, `${first.id}.enc`));
    now = 111;
    fail = true;
    await assert.rejects(context.store.appendSegment(1, Buffer.from("new")), /injected index failure/);
    assert.deepEqual(await readFile(join(context.directory, "index.enc")), priorIndex);
    assert.deepEqual(await readFile(join(context.directory, `${first.id}.enc`)), priorPayload);
    fail = false;
    const second = await context.store.appendSegment(1, Buffer.from("new"));
    assert.deepEqual(await readdir(context.directory), [`${second.id}.enc`, "index.enc"]);
  } finally { await context.cleanup(); }
});

test("index rename followed by an error is recognized as committed", async () => {
  let fail = false;
  const context = await fixture({ maxCount: 1, filesystem: {
    rename: async (source, destination) => {
      await rename(source, destination);
      if (fail && String(destination).endsWith("index.enc")) throw new Error("sync after rename failed");
    },
  } });
  try {
    const first = await context.store.appendSegment(1, Buffer.from("old"));
    fail = true;
    const second = await context.store.appendSegment(1, Buffer.from("new"));
    assert.equal((await context.reopen().read(second.id)).toString(), "new");
    assert.deepEqual((await context.reopen().list()).map((entry) => entry.id), [second.id]);
    assert.equal((await readdir(context.directory)).includes(`${first.id}.enc`), false);
  } finally { await context.cleanup(); }
});

test("failed postcommit eviction deletion leaves an orphan for recovery without touching unrelated files", async () => {
  let blocked: string | undefined;
  const context = await fixture({ maxCount: 1, filesystem: {
    rm: async (path, options) => {
      if (String(path).endsWith(`${blocked}.enc`)) throw new Error("injected eviction deletion failure");
      await rm(path, options);
    },
  } });
  try {
    const first = await context.store.appendSegment(1, Buffer.from("old"));
    blocked = first.id;
    const second = await context.store.appendSegment(1, Buffer.from("new"));
    assert.equal((await context.reopen().read(second.id)).toString(), "new");
    assert.ok((await readdir(context.directory)).includes(`${first.id}.enc`));
    const abandonedTemp = "00000000-0000-0000-0000-000000000000.tmp";
    await writeFile(join(context.directory, abandonedTemp), "encrypted partial write");
    await writeFile(join(context.directory, "notes.txt"), "unrelated");
    await writeFile(join(context.directory, "unrelated.tmp"), "unrelated");
    const report = await context.reopen().recover();
    assert.equal(report.orphans, 1);
    assert.equal(report.orphanTemps, 1);
    assert.deepEqual((await readdir(context.directory)).sort(), [`${second.id}.enc`, "index.enc", "notes.txt", "unrelated.tmp"].sort());
    assert.equal((await context.reopen().read(second.id)).toString(), "new");
  } finally { await context.cleanup(); }
});