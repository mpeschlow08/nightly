import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { db } from "../db";
import { nightlyDevices, nightlyDeviceSources } from "../db/schema";
import { getBoundCameraDeviceIds, rotateCameraMediaRevision } from "../lib/nightly-device/media-revision";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Device = { id: number; venueId: number; desiredConfigRevision: string };
type Source = { deviceId: number; venueId: number; venueCameraId: number };

function fixture(devices: Device[], sources: Source[]) {
  const dialect = new PgDialect();
  let updates = 0;
  const tx = {
    select() {
      return {
        from(table: unknown) {
          assert.equal(table, nightlyDeviceSources);
          return {
            where(condition: SQL) {
              const query = dialect.sqlToQuery(condition);
              assert.match(query.sql, /"nightly_device_sources"\."venue_id"/);
              assert.match(query.sql, /"nightly_device_sources"\."venue_camera_id"/);
              const [venueId, cameraId] = query.params;
              return Promise.resolve(sources.filter((source) => source.venueId === venueId && source.venueCameraId === cameraId)
                .map((source) => ({ deviceId: source.deviceId })));
            },
          };
        },
      };
    },
    update(table: unknown) {
      assert.equal(table, nightlyDevices);
      return {
        set(values: { desiredConfigRevision: string; updatedAt: Date }) {
          return {
            where(condition: SQL) {
              const query = dialect.sqlToQuery(condition);
              assert.match(query.sql, /"nightly_devices"\."venue_id"/);
              assert.match(query.sql, /"nightly_devices"\."id" in/);
              const [venueId, ...deviceIds] = query.params;
              assert.match(values.desiredConfigRevision, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
              assert.ok(values.updatedAt instanceof Date);
              updates += 1;
              for (const device of devices) {
                if (device.venueId === venueId && deviceIds.includes(device.id)) {
                  device.desiredConfigRevision = values.desiredConfigRevision;
                }
              }
              return Promise.resolve();
            },
          };
        },
      };
    },
  } as unknown as Transaction;
  return { tx, get updates() { return updates; } };
}

test("camera source and status rotation affects only its bound device in the venue", async () => {
  const devices = [
    { id: 1, venueId: 5, desiredConfigRevision: "old" },
    { id: 2, venueId: 5, desiredConfigRevision: "other" },
    { id: 3, venueId: 6, desiredConfigRevision: "foreign" },
  ];
  const sources = [
    { deviceId: 1, venueId: 5, venueCameraId: 10 },
    { deviceId: 2, venueId: 5, venueCameraId: 11 },
    { deviceId: 3, venueId: 6, venueCameraId: 10 },
  ];
  const { tx } = fixture(devices, sources);
  await rotateCameraMediaRevision(tx, 5, 10);
  assert.notEqual(devices[0].desiredConfigRevision, "old");
  assert.equal(devices[1].desiredConfigRevision, "other");
  assert.equal(devices[2].desiredConfigRevision, "foreign");
  assert.doesNotMatch(devices[0].desiredConfigRevision, /rtsp|password|secret/i);
  const previous = devices[0].desiredConfigRevision;
  await rotateCameraMediaRevision(tx, 5, 10);
  assert.notEqual(devices[0].desiredConfigRevision, previous);
});

test("unbound camera does not rotate any device", async () => {
  const devices = [{ id: 1, venueId: 5, desiredConfigRevision: "old" }];
  const fixtureState = fixture(devices, [{ deviceId: 1, venueId: 5, venueCameraId: 11 }]);
  await rotateCameraMediaRevision(fixtureState.tx, 5, 10);
  assert.equal(fixtureState.updates, 0);
  assert.equal(devices[0].desiredConfigRevision, "old");
});

test("delete can rotate captured device IDs after source cascade", async () => {
  const devices = [{ id: 1, venueId: 5, desiredConfigRevision: "old" }, { id: 2, venueId: 6, desiredConfigRevision: "foreign" }];
  const sources = [{ deviceId: 1, venueId: 5, venueCameraId: 10 }];
  const { tx } = fixture(devices, sources);
  const deviceIds = await getBoundCameraDeviceIds(tx, 5, 10);
  sources.length = 0;
  await rotateCameraMediaRevision(tx, 5, 10, deviceIds);
  assert.notEqual(devices[0].desiredConfigRevision, "old");
  assert.equal(devices[1].desiredConfigRevision, "foreign");
});

test("owner camera mutations rotate inside the camera transaction and delete captures before cascade", () => {
  const actions = readFileSync(join(process.cwd(), "app/owner/actions.ts"), "utf8");
  for (const [name, nextName] of [
    ["updateOwnerCameraSourceAction", "setPrimaryOwnerCameraAction"],
    ["toggleOwnerCameraStatusAction", "toggleOwnerCameraPublicPlaybackAction"],
    ["deleteOwnerCameraAction", null],
  ] as const) {
    const start = actions.indexOf(`export async function ${name}(`);
    assert.ok(start >= 0);
    const end = nextName ? actions.indexOf(`export async function ${nextName}(`, start) : actions.length;
    const body = actions.slice(start, end);
    assert.match(body, /await db\.transaction\(async \(tx\) => \{/);
    assert.match(body, /await rotateCameraMediaRevision\(tx, camera\.venueId, cameraId/);
    assert.ok(body.indexOf("await rotateCameraMediaRevision(") < body.indexOf("revalidateOwnerAndVenue("));
  }
  const deletion = actions.slice(actions.indexOf("export async function deleteOwnerCameraAction("));
  assert.ok(deletion.indexOf('.for("update")') < deletion.indexOf("await getBoundCameraDeviceIds("));
  assert.ok(deletion.indexOf("await getBoundCameraDeviceIds(") < deletion.indexOf("await tx.delete(venueCameras)"));
  assert.ok(deletion.indexOf("await tx.delete(venueCameras)") < deletion.indexOf("await rotateCameraMediaRevision("));
});