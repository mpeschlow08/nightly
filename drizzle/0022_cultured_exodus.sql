CREATE TABLE "platform_backup_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"backup_reference" text NOT NULL,
	"status" text NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"verified_by_clerk_user_id" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "platform_beta_cohorts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"audience_type" text NOT NULL,
	"environment" text DEFAULT 'development' NOT NULL,
	"rollout_percentage" integer DEFAULT 0 NOT NULL,
	"invite_code" text,
	"allowlist_json" text DEFAULT '[]' NOT NULL,
	"denylist_json" text DEFAULT '[]' NOT NULL,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"agreement_required" boolean DEFAULT false NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_beta_cohorts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_beta_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"member_type" text NOT NULL,
	"member_key" text NOT NULL,
	"role" text,
	"city" text,
	"venue_id" integer,
	"accepted_agreement_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_beta_members_unique_member" UNIQUE("cohort_id","member_type","member_key")
);
--> statement-breakpoint
CREATE TABLE "platform_data_retention_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_key" text NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"deleted_rows" integer DEFAULT 0 NOT NULL,
	"protected_rows" integer DEFAULT 0 NOT NULL,
	"details_json" text DEFAULT '{}' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_environment_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"status" text NOT NULL,
	"missing_required_json" text DEFAULT '[]' NOT NULL,
	"checks_json" text DEFAULT '{}' NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"checked_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"route" text,
	"app_version" text,
	"environment" text DEFAULT 'development' NOT NULL,
	"user_role" text,
	"device_category" text,
	"summary" text NOT NULL,
	"reproduction_steps" text,
	"screenshot_url" text,
	"consent_to_contact" boolean DEFAULT false NOT NULL,
	"submitted_by_clerk_user_id" text,
	"assigned_to_clerk_user_id" text,
	"internal_note" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_incident_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"actor_clerk_user_id" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_key" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"impact_summary" text NOT NULL,
	"commander_clerk_user_id" text,
	"affected_services_json" text DEFAULT '[]' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"postmortem_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_incidents_incident_key_unique" UNIQUE("incident_key")
);
--> statement-breakpoint
CREATE TABLE "platform_job_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"lock_token" text NOT NULL,
	"correlation_id" text,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"released_at" timestamp,
	"released_by" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	CONSTRAINT "platform_job_locks_lock_token_unique" UNIQUE("lock_token")
);
--> statement-breakpoint
CREATE TABLE "platform_launch_readiness_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"go_no_go" text DEFAULT 'unknown' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"summary_json" text DEFAULT '{}' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_release_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"commit_hash" text NOT NULL,
	"environment" text NOT NULL,
	"migration_status" text NOT NULL,
	"feature_flag_snapshot_json" text DEFAULT '{}' NOT NULL,
	"provider_status_json" text DEFAULT '{}' NOT NULL,
	"known_issues_json" text DEFAULT '[]' NOT NULL,
	"smoke_test_status" text DEFAULT 'unknown' NOT NULL,
	"go_no_go" text DEFAULT 'unknown' NOT NULL,
	"approved_by_clerk_user_id" text,
	"rollback_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"actor_clerk_user_id" text,
	"related_resource_type" text,
	"related_resource_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_smoke_test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"base_url" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"result_json" text DEFAULT '{}' NOT NULL,
	"initiated_by_clerk_user_id" text
);
--> statement-breakpoint
ALTER TABLE "platform_beta_members" ADD CONSTRAINT "platform_beta_members_cohort_id_platform_beta_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."platform_beta_cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_beta_members" ADD CONSTRAINT "platform_beta_members_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_incident_events" ADD CONSTRAINT "platform_incident_events_incident_id_platform_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."platform_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_backup_verifications_environment_idx" ON "platform_backup_verifications" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "platform_backup_verifications_status_idx" ON "platform_backup_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_beta_cohorts_key_idx" ON "platform_beta_cohorts" USING btree ("key");--> statement-breakpoint
CREATE INDEX "platform_beta_cohorts_status_idx" ON "platform_beta_cohorts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_beta_members_cohort_id_idx" ON "platform_beta_members" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "platform_beta_members_member_key_idx" ON "platform_beta_members" USING btree ("member_key");--> statement-breakpoint
CREATE INDEX "platform_data_retention_runs_policy_key_idx" ON "platform_data_retention_runs" USING btree ("policy_key");--> statement-breakpoint
CREATE INDEX "platform_data_retention_runs_status_idx" ON "platform_data_retention_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_environment_checks_environment_idx" ON "platform_environment_checks" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "platform_environment_checks_checked_at_idx" ON "platform_environment_checks" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "platform_feedback_category_idx" ON "platform_feedback" USING btree ("category");--> statement-breakpoint
CREATE INDEX "platform_feedback_severity_idx" ON "platform_feedback" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "platform_feedback_status_idx" ON "platform_feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_feedback_created_at_idx" ON "platform_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_incident_events_incident_id_idx" ON "platform_incident_events" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "platform_incident_events_created_at_idx" ON "platform_incident_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_incidents_severity_idx" ON "platform_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "platform_incidents_status_idx" ON "platform_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_incidents_started_at_idx" ON "platform_incidents" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "platform_job_locks_job_key_idx" ON "platform_job_locks" USING btree ("job_key");--> statement-breakpoint
CREATE INDEX "platform_job_locks_expires_at_idx" ON "platform_job_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "platform_launch_readiness_snapshots_environment_idx" ON "platform_launch_readiness_snapshots" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "platform_launch_readiness_snapshots_generated_at_idx" ON "platform_launch_readiness_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "platform_release_records_environment_idx" ON "platform_release_records" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "platform_release_records_created_at_idx" ON "platform_release_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_security_events_event_type_idx" ON "platform_security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "platform_security_events_severity_idx" ON "platform_security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "platform_security_events_status_idx" ON "platform_security_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_smoke_test_runs_environment_idx" ON "platform_smoke_test_runs" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "platform_smoke_test_runs_status_idx" ON "platform_smoke_test_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_smoke_test_runs_started_at_idx" ON "platform_smoke_test_runs" USING btree ("started_at");