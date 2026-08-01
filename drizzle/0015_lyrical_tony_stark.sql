CREATE TYPE "public"."guest_list_entry_status" AS ENUM('invited', 'requested', 'approved', 'waitlisted', 'denied', 'checked_in', 'partially_checked_in', 'no_show', 'cancelled', 'expired', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."promoter_assignment_status" AS ENUM('active', 'paused', 'revoked', 'completed');--> statement-breakpoint
CREATE TYPE "public"."ticket_order_status" AS ENUM('reserved', 'pending_payment', 'completed', 'cancelled', 'expired', 'refund_pending', 'refunded', 'disputed', 'chargeback');--> statement-breakpoint
CREATE TYPE "public"."ticket_product_type" AS ENUM('free_rsvp', 'general_admission', 'early_bird', 'tiered_admission', 'vip_admission', 'backstage_admission', 'guest_list', 'promoter_guest_list', 'venue_comp', 'staff_comp', 'table_reservation', 'bottle_service', 'private_event_invitation', 'group_bundle', 'timed_entry', 'custom_tier', 'door_sale');--> statement-breakpoint
CREATE TYPE "public"."ticket_refund_status" AS ENUM('requested', 'pending', 'approved', 'rejected', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ticket_sales_visibility" AS ENUM('public', 'private', 'invite_only', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."ticket_scan_decision" AS ENUM('valid', 'duplicate', 'wrong_event', 'wrong_venue', 'invalid', 'blocked', 'refunded', 'voided', 'expired', 'transfer_pending', 'already_checked_in', 'zone_mismatch', 'insufficient_access', 'reentry_blocked');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('reserved', 'pending_payment', 'issued', 'active', 'transferred', 'transfer_pending', 'checked_in', 'partially_checked_in', 'voided', 'cancelled', 'refund_pending', 'refunded', 'expired', 'disputed', 'chargeback', 'blocked', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."ticket_transfer_status" AS ENUM('pending', 'accepted', 'cancelled', 'expired', 'rejected');--> statement-breakpoint
CREATE TABLE "door_staff_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"user_id" integer,
	"clerk_user_id" text NOT NULL,
	"permission_json" text,
	"zone_filter_json" text,
	"device_label" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"status" "promoter_assignment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_list_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_list_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"user_id" integer,
	"clerk_user_id" text,
	"display_name" text NOT NULL,
	"email" text,
	"status" "guest_list_entry_status" DEFAULT 'requested' NOT NULL,
	"plus_ones_requested" integer DEFAULT 0 NOT NULL,
	"plus_ones_approved" integer DEFAULT 0 NOT NULL,
	"checked_in_count" integer DEFAULT 0 NOT NULL,
	"checked_in_at" timestamp,
	"checked_in_by_clerk_user_id" text,
	"arrival_at" timestamp,
	"invited_by_clerk_user_id" text,
	"notes" text,
	"internal_notes" text,
	"source" text DEFAULT 'consumer' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "guest_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"list_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"approval_required" boolean DEFAULT true NOT NULL,
	"waitlist_enabled" boolean DEFAULT true NOT NULL,
	"reentry_policy" text DEFAULT 'no_reentry' NOT NULL,
	"cutoff_at" timestamp,
	"arrival_window_starts_at" timestamp,
	"arrival_window_ends_at" timestamp,
	"plus_one_limit" integer DEFAULT 0 NOT NULL,
	"age_requirement" integer,
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "promoter_event_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"promoter_profile_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"commission_rate_bps" integer DEFAULT 0 NOT NULL,
	"ticket_allocation" integer DEFAULT 0 NOT NULL,
	"guest_list_allocation" integer DEFAULT 0 NOT NULL,
	"status" "promoter_assignment_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoter_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"company_name" text,
	"email" text,
	"phone" text,
	"payout_email" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promoter_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "promoter_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"ticket_id" integer,
	"order_id" integer,
	"actor_clerk_user_id" text NOT NULL,
	"actor_role" text,
	"action" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_inventory_holds" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"order_id" integer,
	"user_id" integer,
	"clerk_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_inventory_holds_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ticket_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"ticket_id" integer,
	"order_id" integer,
	"recipient_clerk_user_id" text,
	"notification_type" text NOT NULL,
	"status" "booking_notification_status" DEFAULT 'queued' NOT NULL,
	"payload_json" text NOT NULL,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"access_zone" text,
	"holder_name_required" boolean DEFAULT false NOT NULL,
	"holder_email_required" boolean DEFAULT false NOT NULL,
	"entry_window_starts_at" timestamp,
	"entry_window_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer,
	"clerk_user_id" text NOT NULL,
	"guest_email" text,
	"status" "ticket_order_status" DEFAULT 'reserved' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"promotion_code" text,
	"payment_provider" text DEFAULT 'none' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_intent_id" text,
	"checkout_session_id" text,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "ticket_orders_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "ticket_orders_event_order_unique" UNIQUE("event_id","order_number")
);
--> statement-breakpoint
CREATE TABLE "ticket_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"product_type" "ticket_product_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"quantity_total" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"quantity_sold" integer DEFAULT 0 NOT NULL,
	"quantity_refunded" integer DEFAULT 0 NOT NULL,
	"sales_start_at" timestamp,
	"sales_end_at" timestamp,
	"minimum_quantity" integer DEFAULT 1 NOT NULL,
	"maximum_quantity" integer DEFAULT 10 NOT NULL,
	"purchase_limit" integer DEFAULT 10 NOT NULL,
	"visibility" "ticket_sales_visibility" DEFAULT 'public' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"access_zone" text,
	"entry_window_starts_at" timestamp,
	"entry_window_ends_at" timestamp,
	"benefits_json" text,
	"refundability" text DEFAULT 'standard' NOT NULL,
	"transferability" text DEFAULT 'allowed' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"sold_out_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "ticket_products_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "ticket_refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"provider_refund_id" text,
	"status" "ticket_refund_status" DEFAULT 'requested' NOT NULL,
	"requested_by_clerk_user_id" text NOT NULL,
	"processed_by_clerk_user_id" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_scan_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"door_staff_user_id" integer,
	"clerk_user_id" text NOT NULL,
	"device_label" text,
	"session_token" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_scan_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "ticket_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"scan_session_id" integer NOT NULL,
	"door_staff_user_id" integer,
	"clerk_user_id" text NOT NULL,
	"scan_token" text NOT NULL,
	"decision" "ticket_scan_decision" NOT NULL,
	"reason" text,
	"zone" text,
	"checked_in_at" timestamp,
	"partial_checkin_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_scans_scan_token_unique" UNIQUE("scan_token"),
	CONSTRAINT "ticket_scans_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ticket_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_user_id" integer,
	"recipient_user_id" integer,
	"recipient_email" text,
	"status" "ticket_transfer_status" DEFAULT 'pending' NOT NULL,
	"transfer_code" text NOT NULL,
	"expires_at" timestamp,
	"accepted_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_transfers_transfer_code_unique" UNIQUE("transfer_code")
);
--> statement-breakpoint
CREATE TABLE "ticket_waitlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"product_id" integer,
	"user_id" integer,
	"clerk_user_id" text,
	"email" text,
	"requested_quantity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"position" integer,
	"offer_expires_at" timestamp,
	"offered_at" timestamp,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"source" text DEFAULT 'consumer' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_code" text NOT NULL,
	"token_id" text NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"holder_user_id" integer,
	"holder_clerk_user_id" text,
	"holder_name" text,
	"holder_email" text,
	"status" "ticket_status" DEFAULT 'reserved' NOT NULL,
	"transfer_status" "ticket_transfer_status" DEFAULT 'pending' NOT NULL,
	"access_zone" text,
	"entry_window_starts_at" timestamp,
	"entry_window_ends_at" timestamp,
	"issued_at" timestamp,
	"activated_at" timestamp,
	"checked_in_at" timestamp,
	"checked_in_by_clerk_user_id" text,
	"partial_checkin_count" integer DEFAULT 0 NOT NULL,
	"transfer_pending_at" timestamp,
	"transfer_accepted_at" timestamp,
	"voided_at" timestamp,
	"cancelled_at" timestamp,
	"refunded_at" timestamp,
	"replaced_at" timestamp,
	"replaced_by_ticket_id" integer,
	"original_ticket_id" integer,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "tickets_ticket_code_unique" UNIQUE("ticket_code"),
	CONSTRAINT "tickets_token_id_unique" UNIQUE("token_id"),
	CONSTRAINT "tickets_code_event_unique" UNIQUE("ticket_code","event_id")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "requires_tickets" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "supports_free_rsvp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_sales_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_sales_end_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_sales_visibility" "ticket_sales_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reserved_capacity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "guest_list_allocation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "promoter_allocation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "staff_comp_allocation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "walkup_allocation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "per_order_quantity_limit" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "per_user_quantity_limit" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "entry_window_minutes" integer DEFAULT 180 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "late_entry_grace_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "minimum_age" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_transfer_policy" text DEFAULT 'allowed' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "refund_policy" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "re_entry_policy" text DEFAULT 'no_reentry' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "waitlist_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "inventory_warning_threshold" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tax_behavior" text DEFAULT 'inclusive' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "fee_display_behavior" text DEFAULT 'transparent' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sales_channel_restrictions_json" text;--> statement-breakpoint
ALTER TABLE "door_staff_assignments" ADD CONSTRAINT "door_staff_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "door_staff_assignments" ADD CONSTRAINT "door_staff_assignments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "door_staff_assignments" ADD CONSTRAINT "door_staff_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_list_entries" ADD CONSTRAINT "guest_list_entries_guest_list_id_guest_lists_id_fk" FOREIGN KEY ("guest_list_id") REFERENCES "public"."guest_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_list_entries" ADD CONSTRAINT "guest_list_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_list_entries" ADD CONSTRAINT "guest_list_entries_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_list_entries" ADD CONSTRAINT "guest_list_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_lists" ADD CONSTRAINT "guest_lists_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_lists" ADD CONSTRAINT "guest_lists_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_event_assignments" ADD CONSTRAINT "promoter_event_assignments_promoter_profile_id_promoter_profiles_id_fk" FOREIGN KEY ("promoter_profile_id") REFERENCES "public"."promoter_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_event_assignments" ADD CONSTRAINT "promoter_event_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_event_assignments" ADD CONSTRAINT "promoter_event_assignments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_profiles" ADD CONSTRAINT "promoter_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_audit_log" ADD CONSTRAINT "ticket_audit_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_audit_log" ADD CONSTRAINT "ticket_audit_log_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_audit_log" ADD CONSTRAINT "ticket_audit_log_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_inventory_holds" ADD CONSTRAINT "ticket_inventory_holds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_inventory_holds" ADD CONSTRAINT "ticket_inventory_holds_product_id_ticket_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ticket_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_inventory_holds" ADD CONSTRAINT "ticket_inventory_holds_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_inventory_holds" ADD CONSTRAINT "ticket_inventory_holds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_notifications" ADD CONSTRAINT "ticket_notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_notifications" ADD CONSTRAINT "ticket_notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_notifications" ADD CONSTRAINT "ticket_notifications_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_order_items" ADD CONSTRAINT "ticket_order_items_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_order_items" ADD CONSTRAINT "ticket_order_items_product_id_ticket_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ticket_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_products" ADD CONSTRAINT "ticket_products_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_products" ADD CONSTRAINT "ticket_products_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_refunds" ADD CONSTRAINT "ticket_refunds_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_refunds" ADD CONSTRAINT "ticket_refunds_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_refunds" ADD CONSTRAINT "ticket_refunds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_sessions" ADD CONSTRAINT "ticket_scan_sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_sessions" ADD CONSTRAINT "ticket_scan_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scan_sessions" ADD CONSTRAINT "ticket_scan_sessions_door_staff_user_id_users_id_fk" FOREIGN KEY ("door_staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scans" ADD CONSTRAINT "ticket_scans_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scans" ADD CONSTRAINT "ticket_scans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scans" ADD CONSTRAINT "ticket_scans_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scans" ADD CONSTRAINT "ticket_scans_scan_session_id_ticket_scan_sessions_id_fk" FOREIGN KEY ("scan_session_id") REFERENCES "public"."ticket_scan_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_scans" ADD CONSTRAINT "ticket_scans_door_staff_user_id_users_id_fk" FOREIGN KEY ("door_staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_waitlists" ADD CONSTRAINT "ticket_waitlists_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_waitlists" ADD CONSTRAINT "ticket_waitlists_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_waitlists" ADD CONSTRAINT "ticket_waitlists_product_id_ticket_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ticket_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_waitlists" ADD CONSTRAINT "ticket_waitlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_item_id_ticket_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."ticket_order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_product_id_ticket_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ticket_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_holder_user_id_users_id_fk" FOREIGN KEY ("holder_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "door_staff_assignments_event_id_idx" ON "door_staff_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "door_staff_assignments_venue_id_idx" ON "door_staff_assignments" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "door_staff_assignments_clerk_user_id_idx" ON "door_staff_assignments" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "door_staff_assignments_status_idx" ON "door_staff_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guest_list_entries_guest_list_id_idx" ON "guest_list_entries" USING btree ("guest_list_id");--> statement-breakpoint
CREATE INDEX "guest_list_entries_event_id_idx" ON "guest_list_entries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "guest_list_entries_venue_id_idx" ON "guest_list_entries" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "guest_list_entries_clerk_user_id_idx" ON "guest_list_entries" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "guest_list_entries_status_idx" ON "guest_list_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guest_lists_event_id_idx" ON "guest_lists" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "guest_lists_venue_id_idx" ON "guest_lists" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "guest_lists_list_type_idx" ON "guest_lists" USING btree ("list_type");--> statement-breakpoint
CREATE INDEX "promoter_event_assignments_promoter_profile_id_idx" ON "promoter_event_assignments" USING btree ("promoter_profile_id");--> statement-breakpoint
CREATE INDEX "promoter_event_assignments_event_id_idx" ON "promoter_event_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "promoter_event_assignments_venue_id_idx" ON "promoter_event_assignments" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "promoter_profiles_clerk_user_id_idx" ON "promoter_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "ticket_audit_log_event_id_idx" ON "ticket_audit_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_audit_log_ticket_id_idx" ON "ticket_audit_log" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_audit_log_order_id_idx" ON "ticket_audit_log" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_audit_log_actor_clerk_user_id_idx" ON "ticket_audit_log" USING btree ("actor_clerk_user_id");--> statement-breakpoint
CREATE INDEX "ticket_audit_log_action_idx" ON "ticket_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ticket_inventory_holds_event_id_idx" ON "ticket_inventory_holds" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_inventory_holds_product_id_idx" ON "ticket_inventory_holds" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ticket_inventory_holds_clerk_user_id_idx" ON "ticket_inventory_holds" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "ticket_inventory_holds_expires_at_idx" ON "ticket_inventory_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ticket_notifications_event_id_idx" ON "ticket_notifications" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_notifications_ticket_id_idx" ON "ticket_notifications" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_notifications_order_id_idx" ON "ticket_notifications" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_notifications_status_idx" ON "ticket_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_order_items_order_id_idx" ON "ticket_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_order_items_product_id_idx" ON "ticket_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ticket_orders_event_id_idx" ON "ticket_orders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_orders_clerk_user_id_idx" ON "ticket_orders" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "ticket_orders_status_idx" ON "ticket_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_orders_expires_at_idx" ON "ticket_orders" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ticket_products_event_id_idx" ON "ticket_products" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_products_venue_id_idx" ON "ticket_products" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "ticket_products_product_type_idx" ON "ticket_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "ticket_products_visibility_idx" ON "ticket_products" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "ticket_products_sort_order_idx" ON "ticket_products" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "ticket_refunds_ticket_id_idx" ON "ticket_refunds" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_refunds_order_id_idx" ON "ticket_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_refunds_event_id_idx" ON "ticket_refunds" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_refunds_status_idx" ON "ticket_refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_scan_sessions_venue_id_idx" ON "ticket_scan_sessions" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_sessions_event_id_idx" ON "ticket_scan_sessions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_scan_sessions_clerk_user_id_idx" ON "ticket_scan_sessions" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "ticket_scans_ticket_id_idx" ON "ticket_scans" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_scans_event_id_idx" ON "ticket_scans" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_scans_venue_id_idx" ON "ticket_scans" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "ticket_scans_scan_session_id_idx" ON "ticket_scans" USING btree ("scan_session_id");--> statement-breakpoint
CREATE INDEX "ticket_scans_decision_idx" ON "ticket_scans" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "ticket_transfers_ticket_id_idx" ON "ticket_transfers" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_transfers_status_idx" ON "ticket_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_transfers_recipient_email_idx" ON "ticket_transfers" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX "ticket_waitlists_event_id_idx" ON "ticket_waitlists" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_waitlists_venue_id_idx" ON "ticket_waitlists" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "ticket_waitlists_product_id_idx" ON "ticket_waitlists" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ticket_waitlists_clerk_user_id_idx" ON "ticket_waitlists" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "ticket_waitlists_status_idx" ON "ticket_waitlists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_ticket_code_idx" ON "tickets" USING btree ("ticket_code");--> statement-breakpoint
CREATE INDEX "tickets_token_id_idx" ON "tickets" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "tickets_event_id_idx" ON "tickets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_order_id_idx" ON "tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "tickets_holder_user_id_idx" ON "tickets" USING btree ("holder_user_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_transfer_status_idx" ON "tickets" USING btree ("transfer_status");