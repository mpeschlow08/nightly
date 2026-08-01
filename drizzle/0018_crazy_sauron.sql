CREATE TYPE "public"."venue_ai_insight_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."venue_ai_insight_type" AS ENUM('attendance_forecast', 'revenue_forecast', 'inventory_forecast', 'staffing_recommendation', 'marketing_recommendation', 'campaign_generation', 'customer_insight', 'event_scoring', 'operational_summary', 'nightly_recap');--> statement-breakpoint
CREATE TYPE "public"."venue_incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."venue_inventory_movement_type" AS ENUM('receive', 'consume', 'adjust', 'count', 'waste', 'damage', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."venue_loyalty_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."venue_marketing_campaign_status" AS ENUM('draft', 'scheduled', 'sent', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."venue_marketing_channel" AS ENUM('push', 'email', 'sms', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."venue_purchase_order_status" AS ENUM('draft', 'submitted', 'approved', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."venue_shift_request_status" AS ENUM('pending', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."venue_shift_request_type" AS ENUM('swap', 'cover', 'drop', 'time_off', 'open_claim');--> statement-breakpoint
CREATE TYPE "public"."venue_shift_status" AS ENUM('scheduled', 'open', 'swap_requested', 'completed', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."venue_staff_department" AS ENUM('management', 'door', 'security', 'bar', 'vip', 'operations', 'marketing', 'inventory', 'finance');--> statement-breakpoint
CREATE TYPE "public"."venue_staff_status" AS ENUM('invited', 'active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."venue_task_status" AS ENUM('pending', 'in_progress', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."venue_vip_reservation_status" AS ENUM('pending', 'confirmed', 'arrived', 'seated', 'closed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TABLE "venue_ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"requested_by_clerk_user_id" text NOT NULL,
	"insight_type" "venue_ai_insight_type" NOT NULL,
	"status" "venue_ai_insight_status" DEFAULT 'pending' NOT NULL,
	"input_json" text DEFAULT '{}' NOT NULL,
	"output_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_bottle_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"package_items_json" text DEFAULT '[]' NOT NULL,
	"mixers_json" text DEFAULT '[]' NOT NULL,
	"add_ons_json" text DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_customer_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_profile_id" integer NOT NULL,
	"author_staff_profile_id" integer,
	"note" text NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_customer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"consumer_user_id" integer,
	"clerk_user_id" text,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"birth_date" date,
	"favorite_genres_json" text DEFAULT '[]' NOT NULL,
	"favorite_events_json" text DEFAULT '[]' NOT NULL,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"vip_visit_count" integer DEFAULT 0 NOT NULL,
	"lifetime_spend_cents" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"loyalty_tier" "venue_loyalty_tier" DEFAULT 'bronze' NOT NULL,
	"marketing_eligible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_floor_plan_objects" (
	"id" serial PRIMARY KEY NOT NULL,
	"floor_plan_id" integer NOT NULL,
	"object_type" text NOT NULL,
	"label" text NOT NULL,
	"section_name" text,
	"capacity" integer DEFAULT 0 NOT NULL,
	"coordinates_json" text DEFAULT '{}' NOT NULL,
	"rotation_degrees" real DEFAULT 0 NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_floor_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"width" integer DEFAULT 1200 NOT NULL,
	"height" integer DEFAULT 800 NOT NULL,
	"background_image_url" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_incident_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"reported_by_staff_profile_id" integer,
	"severity" "venue_incident_severity" DEFAULT 'low' NOT NULL,
	"category" text NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"status" "venue_task_status" DEFAULT 'pending' NOT NULL,
	"occurred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"supplier_id" integer,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit_label" text DEFAULT 'unit' NOT NULL,
	"on_hand_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 0 NOT NULL,
	"par_quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"sell_price_cents" integer DEFAULT 0 NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"movement_type" "venue_inventory_movement_type" NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reference_type" text,
	"reference_id" integer,
	"staff_profile_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_loyalty_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"customer_profile_id" integer NOT NULL,
	"reward_id" integer,
	"created_by_staff_profile_id" integer,
	"entry_type" text NOT NULL,
	"points_delta" integer DEFAULT 0 NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_loyalty_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"points_cost" integer DEFAULT 0 NOT NULL,
	"tier_required" "venue_loyalty_tier" DEFAULT 'bronze' NOT NULL,
	"benefit_json" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"created_by_staff_profile_id" integer,
	"name" text NOT NULL,
	"audience_label" text NOT NULL,
	"channel" "venue_marketing_channel" NOT NULL,
	"status" "venue_marketing_campaign_status" DEFAULT 'draft' NOT NULL,
	"audience_filter_json" text DEFAULT '{}' NOT NULL,
	"content_json" text DEFAULT '{}' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"metrics_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_operation_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"created_by_staff_profile_id" integer,
	"plan_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"scheduled_for" timestamp,
	"status" "venue_task_status" DEFAULT 'pending' NOT NULL,
	"metrics_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_operation_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"assigned_staff_profile_id" integer,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" "venue_task_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp,
	"completed_at" timestamp,
	"checklist_json" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"supplier_id" integer,
	"created_by_staff_profile_id" integer,
	"status" "venue_purchase_order_status" DEFAULT 'draft' NOT NULL,
	"items_json" text DEFAULT '[]' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"expected_at" timestamp,
	"received_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_shift_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"requester_staff_profile_id" integer NOT NULL,
	"target_staff_profile_id" integer,
	"request_type" "venue_shift_request_type" NOT NULL,
	"status" "venue_shift_request_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"manager_notes" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"staff_profile_id" integer,
	"department" "venue_staff_department" DEFAULT 'operations' NOT NULL,
	"shift_title" text NOT NULL,
	"role_label" text NOT NULL,
	"status" "venue_shift_status" DEFAULT 'scheduled' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"recurrence_rule" text,
	"is_open_shift" boolean DEFAULT false NOT NULL,
	"manager_approval_required" boolean DEFAULT false NOT NULL,
	"overtime_warning_minutes" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_staff_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_profile_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text,
	"end_time" text,
	"is_preferred" boolean DEFAULT true NOT NULL,
	"unavailable_dates_json" text DEFAULT '[]' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_staff_certifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_profile_id" integer NOT NULL,
	"certification_name" text NOT NULL,
	"issuer" text,
	"issued_at" timestamp,
	"expires_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_staff_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"invited_by_clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"department" "venue_staff_department" DEFAULT 'operations' NOT NULL,
	"job_title" text NOT NULL,
	"permissions_json" text DEFAULT '[]' NOT NULL,
	"invite_token" text NOT NULL,
	"status" "venue_staff_status" DEFAULT 'invited' NOT NULL,
	"expires_at" timestamp,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venue_staff_invitations_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "venue_staff_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"user_id" integer,
	"clerk_user_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"department" "venue_staff_department" DEFAULT 'operations' NOT NULL,
	"job_title" text NOT NULL,
	"permissions_json" text DEFAULT '[]' NOT NULL,
	"emergency_contact_json" text DEFAULT '{}' NOT NULL,
	"hourly_rate_cents" integer DEFAULT 0 NOT NULL,
	"status" "venue_staff_status" DEFAULT 'invited' NOT NULL,
	"hired_at" timestamp,
	"suspended_at" timestamp,
	"terminated_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"shift_id" integer,
	"staff_profile_id" integer NOT NULL,
	"clock_in_at" timestamp NOT NULL,
	"clock_out_at" timestamp,
	"break_started_at" timestamp,
	"break_ended_at" timestamp,
	"break_minutes_total" integer DEFAULT 0 NOT NULL,
	"attendance_status" text DEFAULT 'clocked_in' NOT NULL,
	"approved_by_staff_profile_id" integer,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_vip_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"customer_profile_id" integer,
	"booked_by_staff_profile_id" integer,
	"server_staff_profile_id" integer,
	"host_staff_profile_id" integer,
	"floor_object_id" integer,
	"reservation_name" text NOT NULL,
	"party_size" integer DEFAULT 2 NOT NULL,
	"minimum_spend_cents" integer DEFAULT 0 NOT NULL,
	"final_spend_cents" integer DEFAULT 0 NOT NULL,
	"status" "venue_vip_reservation_status" DEFAULT 'pending' NOT NULL,
	"package_json" text DEFAULT '{}' NOT NULL,
	"notes" text,
	"arrival_at" timestamp,
	"seated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_ai_insights" ADD CONSTRAINT "venue_ai_insights_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_ai_insights" ADD CONSTRAINT "venue_ai_insights_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_bottle_packages" ADD CONSTRAINT "venue_bottle_packages_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_customer_notes" ADD CONSTRAINT "venue_customer_notes_customer_profile_id_venue_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."venue_customer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_customer_notes" ADD CONSTRAINT "venue_customer_notes_author_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("author_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_customer_profiles" ADD CONSTRAINT "venue_customer_profiles_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_customer_profiles" ADD CONSTRAINT "venue_customer_profiles_consumer_user_id_users_id_fk" FOREIGN KEY ("consumer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_floor_plan_objects" ADD CONSTRAINT "venue_floor_plan_objects_floor_plan_id_venue_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "public"."venue_floor_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_floor_plans" ADD CONSTRAINT "venue_floor_plans_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_incident_reports" ADD CONSTRAINT "venue_incident_reports_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_incident_reports" ADD CONSTRAINT "venue_incident_reports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_incident_reports" ADD CONSTRAINT "venue_incident_reports_reported_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("reported_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_items" ADD CONSTRAINT "venue_inventory_items_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_items" ADD CONSTRAINT "venue_inventory_items_supplier_id_venue_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."venue_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_movements" ADD CONSTRAINT "venue_inventory_movements_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_movements" ADD CONSTRAINT "venue_inventory_movements_item_id_venue_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."venue_inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_movements" ADD CONSTRAINT "venue_inventory_movements_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_loyalty_ledger" ADD CONSTRAINT "venue_loyalty_ledger_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_loyalty_ledger" ADD CONSTRAINT "venue_loyalty_ledger_customer_profile_id_venue_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."venue_customer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_loyalty_ledger" ADD CONSTRAINT "venue_loyalty_ledger_reward_id_venue_loyalty_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."venue_loyalty_rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_loyalty_ledger" ADD CONSTRAINT "venue_loyalty_ledger_created_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_loyalty_rewards" ADD CONSTRAINT "venue_loyalty_rewards_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_marketing_campaigns" ADD CONSTRAINT "venue_marketing_campaigns_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_marketing_campaigns" ADD CONSTRAINT "venue_marketing_campaigns_created_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_operation_plans" ADD CONSTRAINT "venue_operation_plans_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_operation_plans" ADD CONSTRAINT "venue_operation_plans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_operation_plans" ADD CONSTRAINT "venue_operation_plans_created_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_operation_tasks" ADD CONSTRAINT "venue_operation_tasks_plan_id_venue_operation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."venue_operation_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_operation_tasks" ADD CONSTRAINT "venue_operation_tasks_assigned_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("assigned_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_purchase_orders" ADD CONSTRAINT "venue_purchase_orders_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_purchase_orders" ADD CONSTRAINT "venue_purchase_orders_supplier_id_venue_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."venue_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_purchase_orders" ADD CONSTRAINT "venue_purchase_orders_created_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_shift_requests" ADD CONSTRAINT "venue_shift_requests_shift_id_venue_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."venue_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_shift_requests" ADD CONSTRAINT "venue_shift_requests_requester_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("requester_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_shift_requests" ADD CONSTRAINT "venue_shift_requests_target_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("target_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_shifts" ADD CONSTRAINT "venue_shifts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_shifts" ADD CONSTRAINT "venue_shifts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_shifts" ADD CONSTRAINT "venue_shifts_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staff_availability" ADD CONSTRAINT "venue_staff_availability_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staff_certifications" ADD CONSTRAINT "venue_staff_certifications_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staff_invitations" ADD CONSTRAINT "venue_staff_invitations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staff_profiles" ADD CONSTRAINT "venue_staff_profiles_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staff_profiles" ADD CONSTRAINT "venue_staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_suppliers" ADD CONSTRAINT "venue_suppliers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_entries" ADD CONSTRAINT "venue_time_entries_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_entries" ADD CONSTRAINT "venue_time_entries_shift_id_venue_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."venue_shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_entries" ADD CONSTRAINT "venue_time_entries_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_entries" ADD CONSTRAINT "venue_time_entries_approved_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_customer_profile_id_venue_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."venue_customer_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_booked_by_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("booked_by_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_server_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("server_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_host_staff_profile_id_venue_staff_profiles_id_fk" FOREIGN KEY ("host_staff_profile_id") REFERENCES "public"."venue_staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_vip_reservations" ADD CONSTRAINT "venue_vip_reservations_floor_object_id_venue_floor_plan_objects_id_fk" FOREIGN KEY ("floor_object_id") REFERENCES "public"."venue_floor_plan_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_ai_insights_venue_id_idx" ON "venue_ai_insights" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_ai_insights_event_id_idx" ON "venue_ai_insights" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_ai_insights_insight_type_idx" ON "venue_ai_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "venue_ai_insights_status_idx" ON "venue_ai_insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_bottle_packages_venue_id_idx" ON "venue_bottle_packages" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_bottle_packages_is_active_idx" ON "venue_bottle_packages" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "venue_customer_notes_customer_profile_id_idx" ON "venue_customer_notes" USING btree ("customer_profile_id");--> statement-breakpoint
CREATE INDEX "venue_customer_notes_author_staff_profile_id_idx" ON "venue_customer_notes" USING btree ("author_staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_customer_profiles_venue_id_idx" ON "venue_customer_profiles" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_customer_profiles_consumer_user_id_idx" ON "venue_customer_profiles" USING btree ("consumer_user_id");--> statement-breakpoint
CREATE INDEX "venue_customer_profiles_email_idx" ON "venue_customer_profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "venue_customer_profiles_lifetime_spend_cents_idx" ON "venue_customer_profiles" USING btree ("lifetime_spend_cents");--> statement-breakpoint
CREATE INDEX "venue_floor_plan_objects_floor_plan_id_idx" ON "venue_floor_plan_objects" USING btree ("floor_plan_id");--> statement-breakpoint
CREATE INDEX "venue_floor_plan_objects_object_type_idx" ON "venue_floor_plan_objects" USING btree ("object_type");--> statement-breakpoint
CREATE INDEX "venue_floor_plan_objects_section_name_idx" ON "venue_floor_plan_objects" USING btree ("section_name");--> statement-breakpoint
CREATE INDEX "venue_floor_plans_venue_id_idx" ON "venue_floor_plans" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_floor_plans_is_active_idx" ON "venue_floor_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "venue_incident_reports_venue_id_idx" ON "venue_incident_reports" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_incident_reports_event_id_idx" ON "venue_incident_reports" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_incident_reports_severity_idx" ON "venue_incident_reports" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "venue_incident_reports_status_idx" ON "venue_incident_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_inventory_items_venue_id_idx" ON "venue_inventory_items" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_inventory_items_supplier_id_idx" ON "venue_inventory_items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "venue_inventory_items_sku_idx" ON "venue_inventory_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "venue_inventory_items_reorder_threshold_idx" ON "venue_inventory_items" USING btree ("reorder_threshold");--> statement-breakpoint
CREATE INDEX "venue_inventory_movements_venue_id_idx" ON "venue_inventory_movements" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_inventory_movements_item_id_idx" ON "venue_inventory_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "venue_inventory_movements_movement_type_idx" ON "venue_inventory_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "venue_loyalty_ledger_venue_id_idx" ON "venue_loyalty_ledger" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_loyalty_ledger_customer_profile_id_idx" ON "venue_loyalty_ledger" USING btree ("customer_profile_id");--> statement-breakpoint
CREATE INDEX "venue_loyalty_ledger_entry_type_idx" ON "venue_loyalty_ledger" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "venue_loyalty_rewards_venue_id_idx" ON "venue_loyalty_rewards" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_loyalty_rewards_tier_required_idx" ON "venue_loyalty_rewards" USING btree ("tier_required");--> statement-breakpoint
CREATE INDEX "venue_loyalty_rewards_is_active_idx" ON "venue_loyalty_rewards" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "venue_marketing_campaigns_venue_id_idx" ON "venue_marketing_campaigns" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_marketing_campaigns_channel_idx" ON "venue_marketing_campaigns" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "venue_marketing_campaigns_status_idx" ON "venue_marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_marketing_campaigns_scheduled_at_idx" ON "venue_marketing_campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "venue_operation_plans_venue_id_idx" ON "venue_operation_plans" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_operation_plans_event_id_idx" ON "venue_operation_plans" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_operation_plans_plan_type_idx" ON "venue_operation_plans" USING btree ("plan_type");--> statement-breakpoint
CREATE INDEX "venue_operation_plans_status_idx" ON "venue_operation_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_operation_tasks_plan_id_idx" ON "venue_operation_tasks" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "venue_operation_tasks_assigned_staff_profile_id_idx" ON "venue_operation_tasks" USING btree ("assigned_staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_operation_tasks_due_at_idx" ON "venue_operation_tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "venue_operation_tasks_status_idx" ON "venue_operation_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_purchase_orders_venue_id_idx" ON "venue_purchase_orders" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_purchase_orders_supplier_id_idx" ON "venue_purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "venue_purchase_orders_status_idx" ON "venue_purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_shift_requests_shift_id_idx" ON "venue_shift_requests" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "venue_shift_requests_requester_staff_profile_id_idx" ON "venue_shift_requests" USING btree ("requester_staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_shift_requests_status_idx" ON "venue_shift_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_shifts_venue_id_idx" ON "venue_shifts" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_shifts_event_id_idx" ON "venue_shifts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_shifts_staff_profile_id_idx" ON "venue_shifts" USING btree ("staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_shifts_starts_at_idx" ON "venue_shifts" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "venue_shifts_status_idx" ON "venue_shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_staff_availability_staff_profile_id_idx" ON "venue_staff_availability" USING btree ("staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_staff_availability_day_of_week_idx" ON "venue_staff_availability" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "venue_staff_certifications_staff_profile_id_idx" ON "venue_staff_certifications" USING btree ("staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_staff_certifications_expires_at_idx" ON "venue_staff_certifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "venue_staff_invitations_venue_id_idx" ON "venue_staff_invitations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_staff_invitations_email_idx" ON "venue_staff_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "venue_staff_invitations_status_idx" ON "venue_staff_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_staff_profiles_venue_id_idx" ON "venue_staff_profiles" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_staff_profiles_user_id_idx" ON "venue_staff_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "venue_staff_profiles_clerk_user_id_idx" ON "venue_staff_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "venue_staff_profiles_status_idx" ON "venue_staff_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_staff_profiles_department_idx" ON "venue_staff_profiles" USING btree ("department");--> statement-breakpoint
CREATE INDEX "venue_suppliers_venue_id_idx" ON "venue_suppliers" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_suppliers_is_active_idx" ON "venue_suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "venue_time_entries_venue_id_idx" ON "venue_time_entries" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_time_entries_shift_id_idx" ON "venue_time_entries" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "venue_time_entries_staff_profile_id_idx" ON "venue_time_entries" USING btree ("staff_profile_id");--> statement-breakpoint
CREATE INDEX "venue_time_entries_clock_in_at_idx" ON "venue_time_entries" USING btree ("clock_in_at");--> statement-breakpoint
CREATE INDEX "venue_vip_reservations_venue_id_idx" ON "venue_vip_reservations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_vip_reservations_event_id_idx" ON "venue_vip_reservations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_vip_reservations_customer_profile_id_idx" ON "venue_vip_reservations" USING btree ("customer_profile_id");--> statement-breakpoint
CREATE INDEX "venue_vip_reservations_status_idx" ON "venue_vip_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_vip_reservations_arrival_at_idx" ON "venue_vip_reservations" USING btree ("arrival_at");