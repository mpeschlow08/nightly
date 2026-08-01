CREATE TABLE IF NOT EXISTS "reservation_status_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "table_booking_id" integer,
  "from_status" text,
  "to_status" text NOT NULL,
  "actor_clerk_user_id" text,
  "actor_role" text,
  "note" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "table_status_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "venue_table_id" integer NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "actor_clerk_user_id" text,
  "actor_role" text,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "table_booking_id" integer,
  "venue_id" integer NOT NULL,
  "server_id" integer NOT NULL,
  "assigned_by_clerk_user_id" text,
  "assignment_status" text DEFAULT 'assigned' NOT NULL,
  "notes" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arrival_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "table_booking_id" integer,
  "venue_id" integer NOT NULL,
  "expected_at" timestamp,
  "arrived_at" timestamp,
  "seated_at" timestamp,
  "no_show_at" timestamp,
  "delay_minutes" integer DEFAULT 0 NOT NULL,
  "party_size_at_arrival" integer,
  "recorded_by_clerk_user_id" text,
  "note" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "check_in_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "venue_id" integer NOT NULL,
  "table_booking_id" integer,
  "check_in_token" text NOT NULL,
  "scan_nonce" text NOT NULL,
  "scanned_by_clerk_user_id" text,
  "scanned_by_role" text,
  "scan_method" text DEFAULT 'qr' NOT NULL,
  "decision" text DEFAULT 'accepted' NOT NULL,
  "reason" text,
  "scanned_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "check_in_log_scan_nonce_unique" UNIQUE("scan_nonce")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reservation_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "venue_id" integer,
  "recipient_clerk_user_id" text,
  "notification_type" text NOT NULL,
  "channel" text DEFAULT 'in_app' NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "payload_json" text DEFAULT '{}' NOT NULL,
  "scheduled_at" timestamp DEFAULT now() NOT NULL,
  "sent_at" timestamp,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_id" integer NOT NULL,
  "booking_id" integer,
  "clerk_user_id" text,
  "full_name" text NOT NULL,
  "phone" text,
  "party_size" integer DEFAULT 2 NOT NULL,
  "preferred_section" text,
  "preferred_time_at" timestamp,
  "status" text DEFAULT 'waiting' NOT NULL,
  "notified_at" timestamp,
  "expires_at" timestamp,
  "accepted_at" timestamp,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reservation_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "venue_id" integer,
  "consumer_clerk_user_id" text,
  "summary_type" text DEFAULT 'completed_reservation' NOT NULL,
  "summary_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservation_status_log" ADD CONSTRAINT "reservation_status_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservation_status_log" ADD CONSTRAINT "reservation_status_log_table_booking_id_table_bookings_id_fk" FOREIGN KEY ("table_booking_id") REFERENCES "public"."table_bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_status_log" ADD CONSTRAINT "table_status_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_status_log" ADD CONSTRAINT "table_status_log_venue_table_id_venue_tables_id_fk" FOREIGN KEY ("venue_table_id") REFERENCES "public"."venue_tables"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_assignments" ADD CONSTRAINT "server_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_assignments" ADD CONSTRAINT "server_assignments_table_booking_id_table_bookings_id_fk" FOREIGN KEY ("table_booking_id") REFERENCES "public"."table_bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_assignments" ADD CONSTRAINT "server_assignments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_assignments" ADD CONSTRAINT "server_assignments_server_id_venue_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."venue_servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arrival_log" ADD CONSTRAINT "arrival_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arrival_log" ADD CONSTRAINT "arrival_log_table_booking_id_table_bookings_id_fk" FOREIGN KEY ("table_booking_id") REFERENCES "public"."table_bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arrival_log" ADD CONSTRAINT "arrival_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_in_log" ADD CONSTRAINT "check_in_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_in_log" ADD CONSTRAINT "check_in_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_in_log" ADD CONSTRAINT "check_in_log_table_booking_id_table_bookings_id_fk" FOREIGN KEY ("table_booking_id") REFERENCES "public"."table_bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservation_notifications" ADD CONSTRAINT "reservation_notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservation_notifications" ADD CONSTRAINT "reservation_notifications_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservation_history" ADD CONSTRAINT "reservation_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservation_history" ADD CONSTRAINT "reservation_history_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_status_log_booking_id_idx" ON "reservation_status_log" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_status_log_table_booking_id_idx" ON "reservation_status_log" USING btree ("table_booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_status_log_to_status_idx" ON "reservation_status_log" USING btree ("to_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_status_log_created_at_idx" ON "reservation_status_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_status_log_venue_id_idx" ON "table_status_log" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_status_log_venue_table_id_idx" ON "table_status_log" USING btree ("venue_table_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_status_log_to_status_idx" ON "table_status_log" USING btree ("to_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_status_log_created_at_idx" ON "table_status_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_assignments_booking_id_idx" ON "server_assignments" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_assignments_table_booking_id_idx" ON "server_assignments" USING btree ("table_booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_assignments_venue_id_idx" ON "server_assignments" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_assignments_server_id_idx" ON "server_assignments" USING btree ("server_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_assignments_assignment_status_idx" ON "server_assignments" USING btree ("assignment_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arrival_log_booking_id_idx" ON "arrival_log" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arrival_log_table_booking_id_idx" ON "arrival_log" USING btree ("table_booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arrival_log_venue_id_idx" ON "arrival_log" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arrival_log_expected_at_idx" ON "arrival_log" USING btree ("expected_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "check_in_log_booking_id_idx" ON "check_in_log" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "check_in_log_venue_id_idx" ON "check_in_log" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "check_in_log_table_booking_id_idx" ON "check_in_log" USING btree ("table_booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "check_in_log_scanned_at_idx" ON "check_in_log" USING btree ("scanned_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_notifications_booking_id_idx" ON "reservation_notifications" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_notifications_venue_id_idx" ON "reservation_notifications" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_notifications_type_idx" ON "reservation_notifications" USING btree ("notification_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_notifications_status_idx" ON "reservation_notifications" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_entries_venue_id_idx" ON "waitlist_entries" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_entries_booking_id_idx" ON "waitlist_entries" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_entries_status_idx" ON "waitlist_entries" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_entries_preferred_time_at_idx" ON "waitlist_entries" USING btree ("preferred_time_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_history_booking_id_idx" ON "reservation_history" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_history_venue_id_idx" ON "reservation_history" USING btree ("venue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_history_consumer_clerk_user_id_idx" ON "reservation_history" USING btree ("consumer_clerk_user_id");
