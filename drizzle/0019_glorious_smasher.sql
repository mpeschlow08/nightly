CREATE TYPE "public"."venue_intelligence_action_status" AS ENUM('proposed', 'reviewed', 'approved', 'applied', 'dismissed', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_conversation_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_recommendation_type" AS ENUM('marketing', 'staffing', 'inventory', 'pricing', 'promoter', 'operations', 'campaign_draft');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_run_status" AS ENUM('started', 'completed', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_snapshot_type" AS ENUM('daily', 'weekly', 'monthly', 'event_pre', 'event_post');--> statement-breakpoint
CREATE TYPE "public"."venue_intelligence_status" AS ENUM('available', 'estimated', 'insufficient_data', 'stale', 'unavailable', 'configuration_required', 'error');--> statement-breakpoint
CREATE TABLE "venue_ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"started_by_clerk_user_id" text NOT NULL,
	"title" text DEFAULT 'Ask Nightly for Business' NOT NULL,
	"status" "venue_intelligence_conversation_status" DEFAULT 'active' NOT NULL,
	"context_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" "venue_intelligence_message_role" NOT NULL,
	"content" text NOT NULL,
	"structured_payload_json" text DEFAULT '{}' NOT NULL,
	"provenance_json" text DEFAULT '{}' NOT NULL,
	"provider_used" text DEFAULT 'deterministic' NOT NULL,
	"model_version" text DEFAULT 'deterministic-v1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_anomalies" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"metric_key" text NOT NULL,
	"severity" "venue_incident_severity" DEFAULT 'low' NOT NULL,
	"expected_low" real,
	"expected_high" real,
	"actual_value" real,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'low' NOT NULL,
	"explanation" text,
	"recommendation" text,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"resolved_at" timestamp,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_benchmark_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"cohort_key" text NOT NULL,
	"cohort_size" integer DEFAULT 0 NOT NULL,
	"metric_key" text NOT NULL,
	"venue_value" real,
	"cohort_median" real,
	"cohort_p75" real,
	"status" "venue_intelligence_status" DEFAULT 'insufficient_data' NOT NULL,
	"methodology" text DEFAULT 'anonymized_internal_aggregate' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_campaign_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"recommendation_id" integer,
	"channel" text NOT NULL,
	"title" text NOT NULL,
	"subject" text,
	"short_copy" text NOT NULL,
	"long_copy" text NOT NULL,
	"cta" text NOT NULL,
	"audience_label" text NOT NULL,
	"schedule_suggestion" text,
	"compliance_notes" text,
	"status" "venue_intelligence_action_status" DEFAULT 'proposed' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"approved_by_clerk_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_customer_segment_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"run_id" integer,
	"segment_key" text NOT NULL,
	"segment_label" text NOT NULL,
	"audience_size" integer DEFAULT 0 NOT NULL,
	"required_permissions_json" text DEFAULT '[]' NOT NULL,
	"exclusions_json" text DEFAULT '[]' NOT NULL,
	"objective" text NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"is_privacy_restricted" boolean DEFAULT false NOT NULL,
	"data_freshness_minutes" integer,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_event_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"run_id" integer,
	"expected_attendance" integer,
	"low_attendance" integer,
	"high_attendance" integer,
	"expected_capacity_utilization" real,
	"status" "venue_intelligence_status" DEFAULT 'estimated' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"confidence_score" real,
	"key_signals_json" text DEFAULT '[]' NOT NULL,
	"assumptions_json" text DEFAULT '[]' NOT NULL,
	"limitations_json" text DEFAULT '[]' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"source_window_start" timestamp,
	"source_window_end" timestamp
);
--> statement-breakpoint
CREATE TABLE "venue_insight_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"recommendation_id" integer,
	"submitted_by_clerk_user_id" text NOT NULL,
	"feedback_type" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_insight_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"recommendation_type" "venue_intelligence_recommendation_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"payload_json" text DEFAULT '{}' NOT NULL,
	"action_status" "venue_intelligence_action_status" DEFAULT 'proposed' NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"confidence_score" real,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_intelligence_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"recommendation_id" integer,
	"action_type" text NOT NULL,
	"status" "venue_intelligence_action_status" DEFAULT 'proposed' NOT NULL,
	"opened_by_clerk_user_id" text NOT NULL,
	"confirmed_by_clerk_user_id" text,
	"payload_json" text DEFAULT '{}' NOT NULL,
	"result_json" text,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_intelligence_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"triggered_by_clerk_user_id" text NOT NULL,
	"run_type" text NOT NULL,
	"status" "venue_intelligence_run_status" DEFAULT 'started' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"algorithm_version" text DEFAULT 'v1' NOT NULL,
	"provider_used" text DEFAULT 'deterministic' NOT NULL,
	"metrics_json" text DEFAULT '{}' NOT NULL,
	"limitations_json" text DEFAULT '[]' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_intelligence_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"snapshot_type" "venue_intelligence_snapshot_type" NOT NULL,
	"summary" text NOT NULL,
	"payload_json" text DEFAULT '{}' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"source_window_start" timestamp,
	"source_window_end" timestamp,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"confidence_score" real,
	"algorithm_version" text DEFAULT 'v1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_intelligence_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_table" text NOT NULL,
	"source_window_start" timestamp,
	"source_window_end" timestamp,
	"last_data_at" timestamp,
	"sample_size" integer,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_inventory_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"item_id" integer,
	"expected_consumption" integer DEFAULT 0 NOT NULL,
	"recommended_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_quantity" integer DEFAULT 0 NOT NULL,
	"shortage_risk" real DEFAULT 0 NOT NULL,
	"overstock_risk" real DEFAULT 0 NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'estimated' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"assumptions_json" text DEFAULT '[]' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_marketing_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"recommendation_type" "venue_intelligence_recommendation_type" DEFAULT 'marketing' NOT NULL,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"audience_label" text NOT NULL,
	"channel" text NOT NULL,
	"timing_label" text NOT NULL,
	"message_angle" text NOT NULL,
	"reason" text NOT NULL,
	"restrictions_json" text DEFAULT '[]' NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"confidence_score" real,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_metric_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"metric_key" text NOT NULL,
	"metric_label" text NOT NULL,
	"metric_value" real,
	"metric_unit" text,
	"baseline_value" real,
	"delta_value" real,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"is_estimated" boolean DEFAULT false NOT NULL,
	"is_partial" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"source_window_start" timestamp,
	"source_window_end" timestamp,
	"source_tables_json" text DEFAULT '[]' NOT NULL,
	"limitations_json" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_pricing_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"product_type" text NOT NULL,
	"product_ref_id" integer,
	"current_price_cents" integer,
	"suggested_low_cents" integer,
	"suggested_high_cents" integer,
	"rationale" text NOT NULL,
	"risk_label" text DEFAULT 'medium' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"effective_window_start" timestamp,
	"effective_window_end" timestamp,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_promoter_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"promoter_profile_id" integer,
	"run_id" integer,
	"metrics_json" text DEFAULT '{}' NOT NULL,
	"recommendation" text,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_revenue_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"confirmed_gross_cents" integer DEFAULT 0 NOT NULL,
	"confirmed_net_cents" integer DEFAULT 0 NOT NULL,
	"estimated_gross_cents" integer DEFAULT 0 NOT NULL,
	"estimated_net_cents" integer DEFAULT 0 NOT NULL,
	"pending_revenue_cents" integer DEFAULT 0 NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"low_net_cents" integer DEFAULT 0 NOT NULL,
	"high_net_cents" integer DEFAULT 0 NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'estimated' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"confidence_score" real,
	"assumptions_json" text DEFAULT '[]' NOT NULL,
	"exclusions_json" text DEFAULT '[]' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_staffing_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"run_id" integer,
	"recommendation_json" text DEFAULT '{}' NOT NULL,
	"rationale_json" text DEFAULT '[]' NOT NULL,
	"status" "venue_intelligence_status" DEFAULT 'available' NOT NULL,
	"confidence_level" "venue_intelligence_confidence" DEFAULT 'medium' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_ai_conversations" ADD CONSTRAINT "venue_ai_conversations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_ai_messages" ADD CONSTRAINT "venue_ai_messages_conversation_id_venue_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."venue_ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_anomalies" ADD CONSTRAINT "venue_anomalies_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_anomalies" ADD CONSTRAINT "venue_anomalies_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_anomalies" ADD CONSTRAINT "venue_anomalies_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_benchmark_snapshots" ADD CONSTRAINT "venue_benchmark_snapshots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_campaign_drafts" ADD CONSTRAINT "venue_campaign_drafts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_campaign_drafts" ADD CONSTRAINT "venue_campaign_drafts_recommendation_id_venue_insight_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."venue_insight_recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_customer_segment_snapshots" ADD CONSTRAINT "venue_customer_segment_snapshots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_customer_segment_snapshots" ADD CONSTRAINT "venue_customer_segment_snapshots_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_event_forecasts" ADD CONSTRAINT "venue_event_forecasts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_event_forecasts" ADD CONSTRAINT "venue_event_forecasts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_event_forecasts" ADD CONSTRAINT "venue_event_forecasts_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_insight_feedback" ADD CONSTRAINT "venue_insight_feedback_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_insight_feedback" ADD CONSTRAINT "venue_insight_feedback_recommendation_id_venue_insight_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."venue_insight_recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_insight_recommendations" ADD CONSTRAINT "venue_insight_recommendations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_insight_recommendations" ADD CONSTRAINT "venue_insight_recommendations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_insight_recommendations" ADD CONSTRAINT "venue_insight_recommendations_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_actions" ADD CONSTRAINT "venue_intelligence_actions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_actions" ADD CONSTRAINT "venue_intelligence_actions_recommendation_id_venue_insight_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."venue_insight_recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_runs" ADD CONSTRAINT "venue_intelligence_runs_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_runs" ADD CONSTRAINT "venue_intelligence_runs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_snapshots" ADD CONSTRAINT "venue_intelligence_snapshots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_snapshots" ADD CONSTRAINT "venue_intelligence_snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_snapshots" ADD CONSTRAINT "venue_intelligence_snapshots_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_intelligence_sources" ADD CONSTRAINT "venue_intelligence_sources_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_forecasts" ADD CONSTRAINT "venue_inventory_forecasts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_forecasts" ADD CONSTRAINT "venue_inventory_forecasts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_forecasts" ADD CONSTRAINT "venue_inventory_forecasts_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_inventory_forecasts" ADD CONSTRAINT "venue_inventory_forecasts_item_id_venue_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."venue_inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_marketing_recommendations" ADD CONSTRAINT "venue_marketing_recommendations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_marketing_recommendations" ADD CONSTRAINT "venue_marketing_recommendations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_marketing_recommendations" ADD CONSTRAINT "venue_marketing_recommendations_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_metric_snapshots" ADD CONSTRAINT "venue_metric_snapshots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_metric_snapshots" ADD CONSTRAINT "venue_metric_snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_metric_snapshots" ADD CONSTRAINT "venue_metric_snapshots_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_pricing_recommendations" ADD CONSTRAINT "venue_pricing_recommendations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_pricing_recommendations" ADD CONSTRAINT "venue_pricing_recommendations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_pricing_recommendations" ADD CONSTRAINT "venue_pricing_recommendations_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promoter_insights" ADD CONSTRAINT "venue_promoter_insights_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promoter_insights" ADD CONSTRAINT "venue_promoter_insights_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promoter_insights" ADD CONSTRAINT "venue_promoter_insights_promoter_profile_id_promoter_profiles_id_fk" FOREIGN KEY ("promoter_profile_id") REFERENCES "public"."promoter_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promoter_insights" ADD CONSTRAINT "venue_promoter_insights_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_revenue_forecasts" ADD CONSTRAINT "venue_revenue_forecasts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_revenue_forecasts" ADD CONSTRAINT "venue_revenue_forecasts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_revenue_forecasts" ADD CONSTRAINT "venue_revenue_forecasts_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staffing_recommendations" ADD CONSTRAINT "venue_staffing_recommendations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staffing_recommendations" ADD CONSTRAINT "venue_staffing_recommendations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_staffing_recommendations" ADD CONSTRAINT "venue_staffing_recommendations_run_id_venue_intelligence_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."venue_intelligence_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_ai_conversations_venue_id_idx" ON "venue_ai_conversations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_ai_conversations_started_by_clerk_user_id_idx" ON "venue_ai_conversations" USING btree ("started_by_clerk_user_id");--> statement-breakpoint
CREATE INDEX "venue_ai_conversations_status_idx" ON "venue_ai_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_ai_messages_conversation_id_idx" ON "venue_ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "venue_ai_messages_role_idx" ON "venue_ai_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "venue_ai_messages_created_at_idx" ON "venue_ai_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "venue_anomalies_venue_id_idx" ON "venue_anomalies" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_anomalies_metric_key_idx" ON "venue_anomalies" USING btree ("metric_key");--> statement-breakpoint
CREATE INDEX "venue_anomalies_severity_idx" ON "venue_anomalies" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "venue_anomalies_generated_at_idx" ON "venue_anomalies" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_benchmark_snapshots_venue_id_idx" ON "venue_benchmark_snapshots" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_benchmark_snapshots_cohort_key_idx" ON "venue_benchmark_snapshots" USING btree ("cohort_key");--> statement-breakpoint
CREATE INDEX "venue_benchmark_snapshots_metric_key_idx" ON "venue_benchmark_snapshots" USING btree ("metric_key");--> statement-breakpoint
CREATE INDEX "venue_campaign_drafts_venue_id_idx" ON "venue_campaign_drafts" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_campaign_drafts_recommendation_id_idx" ON "venue_campaign_drafts" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "venue_campaign_drafts_status_idx" ON "venue_campaign_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_customer_segment_snapshots_venue_id_idx" ON "venue_customer_segment_snapshots" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_customer_segment_snapshots_segment_key_idx" ON "venue_customer_segment_snapshots" USING btree ("segment_key");--> statement-breakpoint
CREATE INDEX "venue_customer_segment_snapshots_generated_at_idx" ON "venue_customer_segment_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_event_forecasts_venue_id_idx" ON "venue_event_forecasts" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_event_forecasts_event_id_idx" ON "venue_event_forecasts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_event_forecasts_generated_at_idx" ON "venue_event_forecasts" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_insight_feedback_venue_id_idx" ON "venue_insight_feedback" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_insight_feedback_recommendation_id_idx" ON "venue_insight_feedback" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "venue_insight_feedback_feedback_type_idx" ON "venue_insight_feedback" USING btree ("feedback_type");--> statement-breakpoint
CREATE INDEX "venue_insight_recommendations_venue_id_idx" ON "venue_insight_recommendations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_insight_recommendations_event_id_idx" ON "venue_insight_recommendations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_insight_recommendations_action_status_idx" ON "venue_insight_recommendations" USING btree ("action_status");--> statement-breakpoint
CREATE INDEX "venue_insight_recommendations_type_idx" ON "venue_insight_recommendations" USING btree ("recommendation_type");--> statement-breakpoint
CREATE INDEX "venue_intelligence_actions_venue_id_idx" ON "venue_intelligence_actions" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_actions_recommendation_id_idx" ON "venue_intelligence_actions" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_actions_status_idx" ON "venue_intelligence_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_intelligence_actions_action_type_idx" ON "venue_intelligence_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "venue_intelligence_runs_venue_id_idx" ON "venue_intelligence_runs" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_runs_event_id_idx" ON "venue_intelligence_runs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_runs_status_idx" ON "venue_intelligence_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_intelligence_runs_started_at_idx" ON "venue_intelligence_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "venue_intelligence_snapshots_venue_id_idx" ON "venue_intelligence_snapshots" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_snapshots_event_id_idx" ON "venue_intelligence_snapshots" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_snapshots_type_idx" ON "venue_intelligence_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "venue_intelligence_snapshots_generated_at_idx" ON "venue_intelligence_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_intelligence_sources_run_id_idx" ON "venue_intelligence_sources" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "venue_intelligence_sources_source_table_idx" ON "venue_intelligence_sources" USING btree ("source_table");--> statement-breakpoint
CREATE INDEX "venue_intelligence_sources_status_idx" ON "venue_intelligence_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_inventory_forecasts_venue_id_idx" ON "venue_inventory_forecasts" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_inventory_forecasts_item_id_idx" ON "venue_inventory_forecasts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "venue_inventory_forecasts_generated_at_idx" ON "venue_inventory_forecasts" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_marketing_recommendations_venue_id_idx" ON "venue_marketing_recommendations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_marketing_recommendations_event_id_idx" ON "venue_marketing_recommendations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_marketing_recommendations_type_idx" ON "venue_marketing_recommendations" USING btree ("recommendation_type");--> statement-breakpoint
CREATE INDEX "venue_metric_snapshots_venue_id_idx" ON "venue_metric_snapshots" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_metric_snapshots_metric_key_idx" ON "venue_metric_snapshots" USING btree ("metric_key");--> statement-breakpoint
CREATE INDEX "venue_metric_snapshots_generated_at_idx" ON "venue_metric_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_pricing_recommendations_venue_id_idx" ON "venue_pricing_recommendations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_pricing_recommendations_event_id_idx" ON "venue_pricing_recommendations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_pricing_recommendations_product_type_idx" ON "venue_pricing_recommendations" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "venue_pricing_recommendations_generated_at_idx" ON "venue_pricing_recommendations" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_promoter_insights_venue_id_idx" ON "venue_promoter_insights" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_promoter_insights_event_id_idx" ON "venue_promoter_insights" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_promoter_insights_promoter_profile_id_idx" ON "venue_promoter_insights" USING btree ("promoter_profile_id");--> statement-breakpoint
CREATE INDEX "venue_revenue_forecasts_venue_id_idx" ON "venue_revenue_forecasts" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_revenue_forecasts_event_id_idx" ON "venue_revenue_forecasts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_revenue_forecasts_generated_at_idx" ON "venue_revenue_forecasts" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "venue_staffing_recommendations_venue_id_idx" ON "venue_staffing_recommendations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_staffing_recommendations_event_id_idx" ON "venue_staffing_recommendations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "venue_staffing_recommendations_generated_at_idx" ON "venue_staffing_recommendations" USING btree ("generated_at");