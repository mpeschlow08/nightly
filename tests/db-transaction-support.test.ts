import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { config } from "dotenv";

test(
  "shared Drizzle client commits and rolls back real PostgreSQL transactions",
  { skip: process.env.NIGHTLY_DB_TRANSACTION_TESTS !== "true" },
  async () => {
    config({ path: ".env.local", override: true, quiet: true });

    const [{ db }, { drizzle }, { sql }] = await Promise.all([
      import("../db"),
      import("drizzle-orm/node-postgres"),
      import("drizzle-orm"),
    ]);
    const client = await db.$client.connect();
    const clientDb = drizzle(client);
    const tableName = `nightly_tx_cert_${randomUUID().replaceAll("-", "")}`;
    const quotedTableName = `"${tableName}"`;

    try {
      await client.query(`CREATE TABLE ${quotedTableName} (value text PRIMARY KEY)`);
      await assert.rejects(
        clientDb.transaction(async (tx) => {
          await tx.execute(sql.raw(`INSERT INTO ${quotedTableName} VALUES ('rollback-marker')`));
          throw new Error("expected transaction rollback");
        }),
        /expected transaction rollback/
      );

      const afterRollback = await client.query(`SELECT count(*)::int AS count FROM ${quotedTableName}`);
      assert.equal(afterRollback.rows[0]?.count, 0);

      await clientDb.transaction(async (tx) => {
        await tx.execute(sql.raw(`INSERT INTO ${quotedTableName} VALUES ('committed-marker')`));
      });

      const afterCommit = await client.query(`SELECT value FROM ${quotedTableName}`);
      assert.equal(afterCommit.rows.length, 1);
      assert.equal(afterCommit.rows[0]?.value, "committed-marker");
    } finally {
      await client.query(`DROP TABLE IF EXISTS public.${quotedTableName}`).catch(() => undefined);
      client.release();
    }
  }
);