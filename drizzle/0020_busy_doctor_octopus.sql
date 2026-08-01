CREATE TYPE "public"."admin_assignment_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."admin_case_category" AS ENUM('support', 'refund', 'dispute', 'fraud', 'moderation', 'venue_claim', 'privacy', 'billing', 'technical', 'safety');--> statement-breakpoint
CREATE TYPE "public"."admin_case_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."admin_case_status" AS ENUM('open', 'pending_user', 'pending_internal', 'escalated', 'resolved', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."admin_export_status" AS ENUM('queued', 'running', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'scheduled', 'published', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."fraud_case_status" AS ENUM('open', 'triaged', 'investigating', 'escalated', 'resolved', 'dismissed', 'monitoring');--> statement-breakpoint
CREATE TYPE "public"."fraud_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."fraud_signal_source" AS ENUM('payments', 'ticketing', 'bookings', 'social', 'venue_claim', 'webhook', 'manual', 'system');--> statement-breakpoint
CREATE TYPE "public"."impersonation_status" AS ENUM('active', 'ended', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."moderation_decision" AS ENUM('no_action', 'warning', 'content_removed', 'content_hidden', 'feature_restricted', 'temporary_suspension', 'permanent_suspension', 'venue_suspension', 'dj_suspension', 'escalation_required');--> statement-breakpoint
CREATE TYPE "public"."moderation_report_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed', 'appealed');--> statement-breakpoint
CREATE TYPE "public"."platform_flag_scope" AS ENUM('global', 'environment', 'role', 'user', 'venue', 'city', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."platform_job_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."platform_job_status" AS ENUM('enabled', 'disabled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_status" AS ENUM('open', 'pending_identity', 'in_review', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_type" AS ENUM('access', 'correction', 'deletion', 'restriction', 'consent');--> statement-breakpoint
CREATE TYPE "public"."provider_health_status" AS ENUM('healthy', 'degraded', 'down', 'not_configured', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_account_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TABLE "admin_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role_id" integer NOT NULL,
	"status" "admin_assignment_status" DEFAULT 'active' NOT NULL,
	"assigned_by_clerk_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by_clerk_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"actor_role" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"scope" text NOT NULL,
	"reason" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"correlation_id" text,
	"related_case_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_case_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"reason" text,
	"before_json" text,
	"after_json" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_number" text NOT NULL,
	"category" "admin_case_category" NOT NULL,
	"priority" "admin_case_priority" DEFAULT 'medium' NOT NULL,
	"status" "admin_case_status" DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"user_id" integer,
	"venue_id" integer,
	"dj_profile_id" integer,
	"event_id" integer,
	"booking_id" integer,
	"order_id" integer,
	"assigned_to_clerk_user_id" text,
	"opened_by_clerk_user_id" text NOT NULL,
	"resolved_by_clerk_user_id" text,
	"sla_due_at" timestamp,
	"resolution" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "admin_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "admin_export_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"export_type" text NOT NULL,
	"scope_json" text DEFAULT '{}' NOT NULL,
	"status" "admin_export_status" DEFAULT 'queued' NOT NULL,
	"requested_by_clerk_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"file_url" text,
	"expires_at" timestamp,
	"row_count" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "admin_impersonation_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_clerk_user_id" text NOT NULL,
	"target_clerk_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "impersonation_status" DEFAULT 'active' NOT NULL,
	"read_only" boolean DEFAULT true NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"ended_by_clerk_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_internal_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"note" text NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"tagged_staff_json" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_role_permissions_role_permission_unique" UNIQUE("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "fraud_case_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"fraud_case_id" integer NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"reason" text,
	"before_json" text,
	"after_json" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_number" text NOT NULL,
	"severity" "fraud_severity" DEFAULT 'medium' NOT NULL,
	"status" "fraud_case_status" DEFAULT 'open' NOT NULL,
	"assigned_reviewer_clerk_user_id" text,
	"summary" text NOT NULL,
	"user_impact" text,
	"venue_impact" text,
	"financial_impact_cents" integer DEFAULT 0 NOT NULL,
	"opened_by_clerk_user_id" text NOT NULL,
	"resolved_by_clerk_user_id" text,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "fraud_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "fraud_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"fraud_case_id" integer,
	"source" "fraud_signal_source" NOT NULL,
	"signal_type" text NOT NULL,
	"severity" "fraud_severity" DEFAULT 'medium' NOT NULL,
	"score" real,
	"evidence_json" text DEFAULT '{}' NOT NULL,
	"user_id" integer,
	"venue_id" integer,
	"event_id" integer,
	"booking_id" integer,
	"order_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"decision" "moderation_decision" NOT NULL,
	"enforcement_scope" text NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_appeals" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"submitted_by_user_id" integer,
	"reason" text NOT NULL,
	"status" "admin_case_status" DEFAULT 'open' NOT NULL,
	"reviewed_by_clerk_user_id" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue" text DEFAULT 'general' NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"reporter_user_id" integer,
	"reason" text NOT NULL,
	"details" text,
	"evidence_json" text DEFAULT '[]' NOT NULL,
	"severity" "admin_case_priority" DEFAULT 'medium' NOT NULL,
	"status" "moderation_report_status" DEFAULT 'open' NOT NULL,
	"assigned_moderator_clerk_user_id" text,
	"is_reporter_identity_restricted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience_scope" text NOT NULL,
	"audience_filter_json" text DEFAULT '{}' NOT NULL,
	"priority" "admin_case_priority" DEFAULT 'medium' NOT NULL,
	"status" "announcement_status" DEFAULT 'draft' NOT NULL,
	"requires_acknowledgment" boolean DEFAULT false NOT NULL,
	"channels_json" text DEFAULT '[]' NOT NULL,
	"scheduled_at" timestamp,
	"published_at" timestamp,
	"expires_at" timestamp,
	"created_by_clerk_user_id" text NOT NULL,
	"approved_by_clerk_user_id" text,
	"withdrawn_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_feature_flag_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"flag_id" integer NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_feature_flag_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"flag_id" integer NOT NULL,
	"scope" "platform_flag_scope" NOT NULL,
	"scope_value" text NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"rollout_percentage" integer DEFAULT 0 NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"scheduled_at" timestamp,
	"expires_at" timestamp,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"updated_by_clerk_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_health_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"component" text NOT NULL,
	"status" "provider_health_status" DEFAULT 'unknown' NOT NULL,
	"latency_ms" integer,
	"message" text,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"status" "platform_job_run_status" DEFAULT 'queued' NOT NULL,
	"trigger" text DEFAULT 'scheduled' NOT NULL,
	"idempotency_key" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"duration_ms" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"schedule_cron" text,
	"status" "platform_job_status" DEFAULT 'enabled' NOT NULL,
	"supports_dry_run" boolean DEFAULT true NOT NULL,
	"adapter_ready" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_jobs_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE TABLE "platform_provider_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_key" text NOT NULL,
	"status" "provider_health_status" DEFAULT 'unknown' NOT NULL,
	"details" text,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_provider_health_provider_key_unique" UNIQUE("provider_key")
);
--> statement-breakpoint
CREATE TABLE "privacy_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" "privacy_request_type" NOT NULL,
	"status" "privacy_request_status" DEFAULT 'open' NOT NULL,
	"user_id" integer,
	"venue_id" integer,
	"request_payload_json" text DEFAULT '{}' NOT NULL,
	"legal_review_required" boolean DEFAULT false NOT NULL,
	"reviewed_by_clerk_user_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "support_case_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"support_case_id" integer NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"reason" text,
	"before_json" text,
	"after_json" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_number" text NOT NULL,
	"category" "admin_case_category" NOT NULL,
	"priority" "admin_case_priority" DEFAULT 'medium' NOT NULL,
	"status" "admin_case_status" DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"user_id" integer,
	"venue_id" integer,
	"dj_profile_id" integer,
	"event_id" integer,
	"booking_id" integer,
	"order_id" integer,
	"ticket_id" integer,
	"assigned_agent_clerk_user_id" text,
	"opened_by_clerk_user_id" text NOT NULL,
	"internal_notes_json" text DEFAULT '[]' NOT NULL,
	"timeline_json" text DEFAULT '[]' NOT NULL,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "support_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "user_account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requires_reverification" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp;--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_related_case_id_admin_cases_id_fk" FOREIGN KEY ("related_case_id") REFERENCES "public"."admin_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_case_events" ADD CONSTRAINT "admin_case_events_case_id_admin_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."admin_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_cases" ADD CONSTRAINT "admin_cases_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_internal_notes" ADD CONSTRAINT "admin_internal_notes_case_id_admin_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."admin_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_case_events" ADD CONSTRAINT "fraud_case_events_fraud_case_id_fraud_cases_id_fk" FOREIGN KEY ("fraud_case_id") REFERENCES "public"."fraud_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_fraud_case_id_fraud_cases_id_fk" FOREIGN KEY ("fraud_case_id") REFERENCES "public"."fraud_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_feature_flag_history" ADD CONSTRAINT "platform_feature_flag_history_flag_id_platform_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."platform_feature_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_feature_flag_overrides" ADD CONSTRAINT "platform_feature_flag_overrides_flag_id_platform_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."platform_feature_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_job_runs" ADD CONSTRAINT "platform_job_runs_job_id_platform_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."platform_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_assignments_clerk_user_id_idx" ON "admin_assignments" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_assignments_role_id_idx" ON "admin_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "admin_assignments_status_idx" ON "admin_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_idx" ON "admin_audit_events" USING btree ("actor_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_action_idx" ON "admin_audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_events_resource_idx" ON "admin_audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_at_idx" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_case_events_case_id_idx" ON "admin_case_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "admin_case_events_event_type_idx" ON "admin_case_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "admin_case_events_created_at_idx" ON "admin_case_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_cases_case_number_idx" ON "admin_cases" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "admin_cases_category_idx" ON "admin_cases" USING btree ("category");--> statement-breakpoint
CREATE INDEX "admin_cases_status_idx" ON "admin_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_cases_assigned_to_clerk_user_id_idx" ON "admin_cases" USING btree ("assigned_to_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_cases_venue_id_idx" ON "admin_cases" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "admin_cases_user_id_idx" ON "admin_cases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_export_jobs_export_type_idx" ON "admin_export_jobs" USING btree ("export_type");--> statement-breakpoint
CREATE INDEX "admin_export_jobs_status_idx" ON "admin_export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_export_jobs_requested_by_idx" ON "admin_export_jobs" USING btree ("requested_by_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_impersonation_sessions_admin_idx" ON "admin_impersonation_sessions" USING btree ("admin_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_impersonation_sessions_target_idx" ON "admin_impersonation_sessions" USING btree ("target_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_impersonation_sessions_status_idx" ON "admin_impersonation_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_internal_notes_case_id_idx" ON "admin_internal_notes" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "admin_internal_notes_resource_idx" ON "admin_internal_notes" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "admin_internal_notes_created_by_idx" ON "admin_internal_notes" USING btree ("created_by_clerk_user_id");--> statement-breakpoint
CREATE INDEX "admin_role_permissions_role_id_idx" ON "admin_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "admin_role_permissions_permission_idx" ON "admin_role_permissions" USING btree ("permission");--> statement-breakpoint
CREATE INDEX "admin_roles_key_idx" ON "admin_roles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "fraud_case_events_fraud_case_id_idx" ON "fraud_case_events" USING btree ("fraud_case_id");--> statement-breakpoint
CREATE INDEX "fraud_case_events_event_type_idx" ON "fraud_case_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "fraud_case_events_created_at_idx" ON "fraud_case_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "fraud_cases_case_number_idx" ON "fraud_cases" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "fraud_cases_severity_idx" ON "fraud_cases" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "fraud_cases_status_idx" ON "fraud_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fraud_cases_assigned_reviewer_idx" ON "fraud_cases" USING btree ("assigned_reviewer_clerk_user_id");--> statement-breakpoint
CREATE INDEX "fraud_signals_fraud_case_id_idx" ON "fraud_signals" USING btree ("fraud_case_id");--> statement-breakpoint
CREATE INDEX "fraud_signals_source_idx" ON "fraud_signals" USING btree ("source");--> statement-breakpoint
CREATE INDEX "fraud_signals_signal_type_idx" ON "fraud_signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "fraud_signals_severity_idx" ON "fraud_signals" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "moderation_actions_report_id_idx" ON "moderation_actions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_decision_idx" ON "moderation_actions" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "moderation_appeals_report_id_idx" ON "moderation_appeals" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "moderation_appeals_status_idx" ON "moderation_appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_reports_queue_idx" ON "moderation_reports" USING btree ("queue");--> statement-breakpoint
CREATE INDEX "moderation_reports_status_idx" ON "moderation_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_reports_resource_idx" ON "moderation_reports" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "moderation_reports_assigned_moderator_idx" ON "moderation_reports" USING btree ("assigned_moderator_clerk_user_id");--> statement-breakpoint
CREATE INDEX "platform_announcements_status_idx" ON "platform_announcements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_announcements_audience_scope_idx" ON "platform_announcements" USING btree ("audience_scope");--> statement-breakpoint
CREATE INDEX "platform_announcements_scheduled_at_idx" ON "platform_announcements" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "platform_feature_flag_history_flag_id_idx" ON "platform_feature_flag_history" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "platform_feature_flag_history_action_idx" ON "platform_feature_flag_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "platform_feature_flag_overrides_flag_id_idx" ON "platform_feature_flag_overrides" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "platform_feature_flag_overrides_scope_idx" ON "platform_feature_flag_overrides" USING btree ("scope","scope_value");--> statement-breakpoint
CREATE INDEX "platform_feature_flags_key_idx" ON "platform_feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "platform_feature_flags_environment_idx" ON "platform_feature_flags" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "platform_health_checks_component_idx" ON "platform_health_checks" USING btree ("component");--> statement-breakpoint
CREATE INDEX "platform_health_checks_status_idx" ON "platform_health_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_health_checks_checked_at_idx" ON "platform_health_checks" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "platform_job_runs_job_id_idx" ON "platform_job_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "platform_job_runs_status_idx" ON "platform_job_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_job_runs_started_at_idx" ON "platform_job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "platform_jobs_job_key_idx" ON "platform_jobs" USING btree ("job_key");--> statement-breakpoint
CREATE INDEX "platform_jobs_status_idx" ON "platform_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_provider_health_status_idx" ON "platform_provider_health" USING btree ("status");--> statement-breakpoint
CREATE INDEX "privacy_requests_request_type_idx" ON "privacy_requests" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "privacy_requests_status_idx" ON "privacy_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "privacy_requests_user_id_idx" ON "privacy_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_case_events_support_case_id_idx" ON "support_case_events" USING btree ("support_case_id");--> statement-breakpoint
CREATE INDEX "support_case_events_event_type_idx" ON "support_case_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "support_cases_case_number_idx" ON "support_cases" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "support_cases_category_idx" ON "support_cases" USING btree ("category");--> statement-breakpoint
CREATE INDEX "support_cases_status_idx" ON "support_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_cases_assigned_agent_idx" ON "support_cases" USING btree ("assigned_agent_clerk_user_id");