ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_idempotency_key_unique" ON "bookings" USING btree ("idempotency_key");
