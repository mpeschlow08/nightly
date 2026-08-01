CREATE TABLE IF NOT EXISTS "venue_tables" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "floor_object_id" integer,
  "table_code" text NOT NULL,
  "name" text NOT NULL,
  "section_name" text,
  "minimum_guests" integer DEFAULT 1 NOT NULL,
  "maximum_guests" integer DEFAULT 12 NOT NULL,
  "minimum_spend_cents" integer DEFAULT 0 NOT NULL,
  "deposit_percent" integer DEFAULT 20 NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "venue_tables_venue_id_table_code_unique" UNIQUE("venue_id", "table_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venue_servers" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "staff_profile_id" integer,
  "display_name" text NOT NULL,
  "email" text,
  "phone" text,
  "is_lead" boolean DEFAULT false NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venue_addons" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'service' NOT NULL,
  "description" text,
  "unit_price_cents" integer DEFAULT 0 NOT NULL,
  "is_per_guest" boolean DEFAULT false NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "table_bookings" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "venue_id" integer NOT NULL,
  "venue_table_id" integer,
  "server_id" integer,
  "booking_category" text DEFAULT 'vip_table' NOT NULL,
  "reservation_name" text,
  "party_size" integer DEFAULT 2 NOT NULL,
  "reservation_start_at" timestamp,
  "reservation_end_at" timestamp,
  "status" text DEFAULT 'pending' NOT NULL,
  "minimum_spend_cents" integer DEFAULT 0 NOT NULL,
  "deposit_amount_cents" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "table_bookings_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "item_type" text NOT NULL,
  "reference_id" integer,
  "label" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price_cents" integer DEFAULT 0 NOT NULL,
  "total_price_cents" integer DEFAULT 0 NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_bottles" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "bottle_package_id" integer,
  "label" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price_cents" integer DEFAULT 0 NOT NULL,
  "mixers_json" text DEFAULT '[]' NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_addons" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "venue_addon_id" integer,
  "label" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price_cents" integer DEFAULT 0 NOT NULL,
  "total_price_cents" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_splits" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "payer_clerk_user_id" text,
  "payer_display_name" text NOT NULL,
  "payer_email" text,
  "payer_phone" text,
  "split_percent" real,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "invite_token" text,
  "invited_at" timestamp,
  "paid_at" timestamp,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_split_payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "bill_split_id" integer NOT NULL,
  "booking_payment_id" integer NOT NULL,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "actor_clerk_user_id" text,
  "actor_role" text,
  "activity_type" text NOT NULL,
  "details" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_tables" ADD CONSTRAINT "venue_tables_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_tables" ADD CONSTRAINT "venue_tables_floor_object_id_venue_floor_plan_objects_id_fk" FOREIGN KEY ("floor_object_id") REFERENCES "public"."venue_floor_plan_objects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_servers" ADD CONSTRAINT "venue_servers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_servers" ADD CONSTRAINT "venue_servers_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_addons" ADD CONSTRAINT "venue_addons_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_bookings" ADD CONSTRAINT "table_bookings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_bookings" ADD CONSTRAINT "table_bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_bookings" ADD CONSTRAINT "table_bookings_venue_table_id_venue_tables_id_fk" FOREIGN KEY ("venue_table_id") REFERENCES "public"."venue_tables"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_bookings" ADD CONSTRAINT "table_bookings_server_id_venue_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."venue_servers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_bottles" ADD CONSTRAINT "booking_bottles_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_bottles" ADD CONSTRAINT "booking_bottles_bottle_package_id_venue_bottle_packages_id_fk" FOREIGN KEY ("bottle_package_id") REFERENCES "public"."venue_bottle_packages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_venue_addon_id_venue_addons_id_fk" FOREIGN KEY ("venue_addon_id") REFERENCES "public"."venue_addons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_splits" ADD CONSTRAINT "bill_splits_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_split_payments" ADD CONSTRAINT "bill_split_payments_bill_split_id_bill_splits_id_fk" FOREIGN KEY ("bill_split_id") REFERENCES "public"."bill_splits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_split_payments" ADD CONSTRAINT "bill_split_payments_booking_payment_id_booking_payments_id_fk" FOREIGN KEY ("booking_payment_id") REFERENCES "public"."booking_payments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_activity" ADD CONSTRAINT "booking_activity_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_tables_venue_id_idx" ON "venue_tables" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_tables_floor_object_id_idx" ON "venue_tables" USING btree ("floor_object_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_tables_is_active_idx" ON "venue_tables" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_servers_venue_id_idx" ON "venue_servers" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_servers_staff_profile_id_idx" ON "venue_servers" USING btree ("staff_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_servers_is_active_idx" ON "venue_servers" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_addons_venue_id_idx" ON "venue_addons" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_addons_category_idx" ON "venue_addons" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_addons_is_active_idx" ON "venue_addons" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_bookings_booking_id_idx" ON "table_bookings" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_bookings_venue_id_idx" ON "table_bookings" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_bookings_venue_table_id_idx" ON "table_bookings" USING btree ("venue_table_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_bookings_server_id_idx" ON "table_bookings" USING btree ("server_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_bookings_status_idx" ON "table_bookings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_items_booking_id_idx" ON "booking_items" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_items_item_type_idx" ON "booking_items" USING btree ("item_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_bottles_booking_id_idx" ON "booking_bottles" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_bottles_bottle_package_id_idx" ON "booking_bottles" USING btree ("bottle_package_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_addons_booking_id_idx" ON "booking_addons" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_addons_venue_addon_id_idx" ON "booking_addons" USING btree ("venue_addon_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_splits_booking_id_idx" ON "bill_splits" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_splits_status_idx" ON "bill_splits" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_splits_invite_token_idx" ON "bill_splits" USING btree ("invite_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_split_payments_bill_split_id_idx" ON "bill_split_payments" USING btree ("bill_split_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_split_payments_booking_payment_id_idx" ON "bill_split_payments" USING btree ("booking_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_activity_booking_id_idx" ON "booking_activity" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_activity_activity_type_idx" ON "booking_activity" USING btree ("activity_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_activity_created_at_idx" ON "booking_activity" USING btree ("created_at");
