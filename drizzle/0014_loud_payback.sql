CREATE TYPE "public"."booking_attachment_kind" AS ENUM('image', 'document', 'inspiration', 'contract', 'receipt');--> statement-breakpoint
CREATE TYPE "public"."booking_checkin_status" AS ENUM('pending', 'checked_in', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."booking_contract_status" AS ENUM('draft', 'sent', 'accepted', 'superseded', 'voided');--> statement-breakpoint
CREATE TYPE "public"."booking_discount_kind" AS ENUM('coupon', 'manual', 'promotion');--> statement-breakpoint
CREATE TYPE "public"."booking_dispute_status" AS ENUM('open', 'under_review', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."booking_lifecycle_status" AS ENUM('draft', 'requested', 'pending_review', 'counter_offered', 'accepted', 'deposit_required', 'deposit_paid', 'confirmed', 'checked_in', 'completed', 'cancelled_by_consumer', 'cancelled_by_venue', 'cancelled_by_dj', 'expired', 'refund_pending', 'refunded', 'disputed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."booking_notification_status" AS ENUM('queued', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."booking_participant_role" AS ENUM('consumer', 'dj', 'venue', 'owner', 'manager', 'admin', 'promoter', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_payment_status" AS ENUM('pending', 'due', 'authorized', 'captured', 'partially_refunded', 'refunded', 'failed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."booking_pricing_kind" AS ENUM('quote', 'counter_offer', 'final', 'refund');--> statement-breakpoint
CREATE TYPE "public"."booking_review_subject" AS ENUM('dj', 'venue', 'consumer');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected', 'claimed');--> statement-breakpoint
CREATE TYPE "public"."concierge_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."concierge_thread_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_lifecycle_status" AS ENUM('draft', 'scheduled', 'published', 'live', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('event', 'special', 'guest_list', 'reservation');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"actor_role" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"previous_values_json" text,
	"next_values_json" text,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"message_id" integer,
	"attachment_kind" "booking_attachment_kind" NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"uploaded_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"actor_role" text,
	"action" text NOT NULL,
	"previous_values_json" text,
	"next_values_json" text,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"status" "booking_checkin_status" DEFAULT 'pending' NOT NULL,
	"checked_in_at" timestamp,
	"checked_in_by_clerk_user_id" text,
	"method" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_checkins_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "booking_contract_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_contract_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"content_json" text NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_contract_versions_contract_version_unique" UNIQUE("booking_contract_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "booking_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"status" "booking_contract_status" DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT 'Booking Contract' NOT NULL,
	"terms_json" text NOT NULL,
	"acceptance_json" text,
	"signature_hash" text,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"accepted_at" timestamp,
	"signed_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_contracts_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "booking_coupon_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"discount_id" integer,
	"coupon_code" text NOT NULL,
	"discount_kind" "booking_discount_kind" DEFAULT 'coupon' NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_discounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"discount_code" text NOT NULL,
	"discount_kind" "booking_discount_kind" DEFAULT 'coupon' NOT NULL,
	"percent_off" real,
	"amount_off_cents" integer,
	"description" text,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"opened_by_clerk_user_id" text NOT NULL,
	"subject" text NOT NULL,
	"reason" text NOT NULL,
	"status" "booking_dispute_status" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_by_clerk_user_id" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"sender_role" "booking_participant_role" NOT NULL,
	"sender_clerk_user_id" text NOT NULL,
	"message_type" text DEFAULT 'message' NOT NULL,
	"body" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"recipient_clerk_user_id" text,
	"notification_type" text NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
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
CREATE TABLE "booking_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"participant_role" "booking_participant_role" NOT NULL,
	"clerk_user_id" text NOT NULL,
	"dj_profile_id" integer,
	"venue_id" integer,
	"display_name" text NOT NULL,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"response_status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_participants_booking_role_clerk_unique" UNIQUE("booking_id","participant_role","clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "booking_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_payment_intent_id" text,
	"provider_charge_id" text,
	"provider_invoice_id" text,
	"provider_receipt_url" text,
	"status" "booking_payment_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"payout_cents" integer DEFAULT 0 NOT NULL,
	"payment_method" text,
	"due_at" timestamp,
	"paid_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"pricing_kind" "booking_pricing_kind" DEFAULT 'quote' NOT NULL,
	"quote_version" integer DEFAULT 1 NOT NULL,
	"base_amount_cents" integer DEFAULT 0 NOT NULL,
	"deposit_amount_cents" integer DEFAULT 0 NOT NULL,
	"service_fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"travel_fee_cents" integer DEFAULT 0 NOT NULL,
	"surge_fee_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"quote_expires_at" timestamp,
	"quote_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_pricing_booking_quote_version_unique" UNIQUE("booking_id","quote_version")
);
--> statement-breakpoint
CREATE TABLE "booking_refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_payment_id" integer NOT NULL,
	"booking_id" integer NOT NULL,
	"provider_refund_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"requested_by_clerk_user_id" text NOT NULL,
	"processed_by_clerk_user_id" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"requirement_type" text NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_met" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"reviewer_clerk_user_id" text NOT NULL,
	"subject_type" "booking_review_subject" NOT NULL,
	"venue_id" integer,
	"dj_profile_id" integer,
	"target_clerk_user_id" text,
	"rating" integer NOT NULL,
	"title" text,
	"body" text,
	"private_admin_notes" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reviews_unique_subject_review" UNIQUE("booking_id","reviewer_clerk_user_id","subject_type")
);
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"from_status" "booking_lifecycle_status",
	"to_status" "booking_lifecycle_status" NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"actor_role" text,
	"note" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_number" text NOT NULL,
	"booking_type" text NOT NULL,
	"lifecycle_status" "booking_lifecycle_status" DEFAULT 'draft' NOT NULL,
	"requester_clerk_user_id" text NOT NULL,
	"consumer_clerk_user_id" text NOT NULL,
	"dj_profile_id" integer,
	"venue_id" integer,
	"city" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"requested_for_at" timestamp,
	"requested_start_at" timestamp,
	"requested_end_at" timestamp,
	"duration_minutes" integer,
	"guest_count" integer DEFAULT 0 NOT NULL,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"inspiration_text" text,
	"special_requests" text,
	"source" text DEFAULT 'consumer_portal' NOT NULL,
	"deposit_required_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"payout_cents" integer DEFAULT 0 NOT NULL,
	"counter_offer_amount_cents" integer,
	"counter_offer_start_at" timestamp,
	"counter_offer_end_at" timestamp,
	"counter_offer_duration_minutes" integer,
	"counter_offer_package" text,
	"counter_offer_deposit_cents" integer,
	"counter_offer_requirements_json" text,
	"counter_offer_expires_at" timestamp,
	"draft_at" timestamp,
	"requested_at" timestamp,
	"pending_review_at" timestamp,
	"counter_offered_at" timestamp,
	"accepted_at" timestamp,
	"deposit_required_at" timestamp,
	"deposit_paid_at" timestamp,
	"confirmed_at" timestamp,
	"checked_in_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"expired_at" timestamp,
	"refund_pending_at" timestamp,
	"refunded_at" timestamp,
	"disputed_at" timestamp,
	"closed_at" timestamp,
	"cancellation_reason" text,
	"refund_reason" text,
	"dispute_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_number_unique" UNIQUE("booking_number")
);
--> statement-breakpoint
CREATE TABLE "concierge_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"role" "concierge_message_role" NOT NULL,
	"content" text NOT NULL,
	"intent" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"session_key" text NOT NULL,
	"title" text DEFAULT 'Nightly Concierge' NOT NULL,
	"status" "concierge_thread_status" DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "concierge_threads_session_key_unique" UNIQUE("session_key")
);
--> statement-breakpoint
CREATE TABLE "dj_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"dj_profile_id" integer NOT NULL,
	"availability_date" date,
	"start_time" text,
	"end_time" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"blocked_dates_json" text,
	"travel_radius_miles" real,
	"travel_fee_cents" integer DEFAULT 0 NOT NULL,
	"minimum_booking_amount_cents" integer DEFAULT 0 NOT NULL,
	"genres_json" text,
	"equipment_requirements_json" text,
	"hourly_pricing_cents" integer DEFAULT 0 NOT NULL,
	"nightly_pricing_cents" integer DEFAULT 0 NOT NULL,
	"holiday_pricing_multiplier" real DEFAULT 1 NOT NULL,
	"rush_booking_pricing_multiplier" real DEFAULT 1 NOT NULL,
	"cancellation_policy_json" text,
	"auto_decline_rules_json" text,
	"vacation_mode" boolean DEFAULT false NOT NULL,
	"vacation_start_at" timestamp,
	"vacation_end_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_analytics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"metric_date" timestamp NOT NULL,
	"traffic_source" text DEFAULT 'direct' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"guest_list_requests" integer DEFAULT 0 NOT NULL,
	"reservation_requests" integer DEFAULT 0 NOT NULL,
	"ticket_clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_analytics_daily_event_source_date_unique" UNIQUE("event_id","traffic_source","metric_date")
);
--> statement-breakpoint
CREATE TABLE "event_lineup" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"dj_profile_id" integer,
	"guest_dj_name" text,
	"performance_starts_at" timestamp,
	"performance_ends_at" timestamp,
	"is_featured_dj" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_moderation_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"flagged_by_clerk_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_notification_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"notification_type" text NOT NULL,
	"payload_json" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_recurrence_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_event_id" integer NOT NULL,
	"instance_event_id" integer NOT NULL,
	"occurrence_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_recurrence_instances_source_occurrence_unique" UNIQUE("source_event_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "event_revision_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"requested_by_clerk_user_id" text NOT NULL,
	"notes" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"availability_date" date,
	"start_time" text,
	"end_time" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"private_event_available" boolean DEFAULT true NOT NULL,
	"table_inventory_json" text,
	"bottle_inventory_json" text,
	"vip_capacity" integer DEFAULT 0 NOT NULL,
	"reservation_window_minutes" integer DEFAULT 0 NOT NULL,
	"holiday_overrides_json" text,
	"special_event_blackout_dates_json" text,
	"approval_required" boolean DEFAULT true NOT NULL,
	"venue_specific_rules_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_claim_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer,
	"claimant_clerk_user_id" text NOT NULL,
	"claimant_role" text DEFAULT 'owner' NOT NULL,
	"business_email" text NOT NULL,
	"business_phone" text NOT NULL,
	"website_url" text,
	"notes" text,
	"venue_name" text NOT NULL,
	"venue_address" text NOT NULL,
	"venue_category" text,
	"google_place_id" text,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by_clerk_user_id" text,
	"reviewed_at" timestamp,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_profile_change_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"submitted_by_clerk_user_id" text NOT NULL,
	"previous_values_json" text NOT NULL,
	"proposed_values_json" text NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by_clerk_user_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_publish_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"action" text NOT NULL,
	"previous_status" text,
	"next_status" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "timezone" text DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "gallery_images_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "flyer_image_urls_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "promo_video_urls_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "imported_venue_image_urls_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "owner_uploaded_image_urls_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "guest_list_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reservation_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "table_reservation_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "vip_reservation_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "bottle_service_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rsvp_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type" "event_type" DEFAULT 'event' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_rule" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_type" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_interval" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_weekdays_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_day_of_month" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_exception_dates_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_holiday_overrides_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "special_details" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_status" text DEFAULT 'on_sale';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "genres_json" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "doors_open_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "featured_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lifecycle_status" "event_lifecycle_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "scheduled_for" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "publication_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "approval_status" "moderation_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_canceled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "thumbnail_image_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "image_source" text DEFAULT 'nightly_fallback';--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "gallery_image_urls_json" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_photo_references_json" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_cover_photo_reference" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "google_logo_image_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "official_website_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "official_website_image_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "official_website_icon_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "official_website_canonical_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "official_website_title" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "images_last_refreshed_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "image_refresh_error" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "timezone" text DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "venue_categories_json" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "amenities_json" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "parking_information" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "valet_available" boolean;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "cover_charge_information" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "vip_available" boolean;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "bottle_service_available" boolean;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "social_links_json" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "average_rating" real;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "review_count" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "publication_status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_attachments" ADD CONSTRAINT "booking_attachments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attachments" ADD CONSTRAINT "booking_attachments_message_id_booking_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."booking_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_audit_log" ADD CONSTRAINT "booking_audit_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_checkins" ADD CONSTRAINT "booking_checkins_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contract_versions" ADD CONSTRAINT "booking_contract_versions_booking_contract_id_booking_contracts_id_fk" FOREIGN KEY ("booking_contract_id") REFERENCES "public"."booking_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contracts" ADD CONSTRAINT "booking_contracts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_coupon_usage" ADD CONSTRAINT "booking_coupon_usage_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_coupon_usage" ADD CONSTRAINT "booking_coupon_usage_discount_id_booking_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."booking_discounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_discounts" ADD CONSTRAINT "booking_discounts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_disputes" ADD CONSTRAINT "booking_disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_notifications" ADD CONSTRAINT "booking_notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_pricing" ADD CONSTRAINT "booking_pricing_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_booking_payment_id_booking_payments_id_fk" FOREIGN KEY ("booking_payment_id") REFERENCES "public"."booking_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requirements" ADD CONSTRAINT "booking_requirements_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reviews" ADD CONSTRAINT "booking_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reviews" ADD CONSTRAINT "booking_reviews_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reviews" ADD CONSTRAINT "booking_reviews_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_messages" ADD CONSTRAINT "concierge_messages_thread_id_concierge_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."concierge_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dj_availability" ADD CONSTRAINT "dj_availability_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_analytics_daily" ADD CONSTRAINT "event_analytics_daily_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_dj_profile_id_dj_profiles_id_fk" FOREIGN KEY ("dj_profile_id") REFERENCES "public"."dj_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_moderation_flags" ADD CONSTRAINT "event_moderation_flags_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_notification_outbox" ADD CONSTRAINT "event_notification_outbox_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence_instances" ADD CONSTRAINT "event_recurrence_instances_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence_instances" ADD CONSTRAINT "event_recurrence_instances_instance_event_id_events_id_fk" FOREIGN KEY ("instance_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_revision_requests" ADD CONSTRAINT "event_revision_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_availability" ADD CONSTRAINT "venue_availability_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_claim_requests" ADD CONSTRAINT "venue_claim_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_profile_change_requests" ADD CONSTRAINT "venue_profile_change_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_publish_history" ADD CONSTRAINT "venue_publish_history_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_clerk_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "booking_attachments_booking_id_idx" ON "booking_attachments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_attachments_message_id_idx" ON "booking_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "booking_audit_log_booking_id_idx" ON "booking_audit_log" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_audit_log_actor_clerk_user_id_idx" ON "booking_audit_log" USING btree ("actor_clerk_user_id");--> statement-breakpoint
CREATE INDEX "booking_audit_log_action_idx" ON "booking_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "booking_checkins_booking_id_idx" ON "booking_checkins" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_checkins_status_idx" ON "booking_checkins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_contract_versions_booking_contract_id_idx" ON "booking_contract_versions" USING btree ("booking_contract_id");--> statement-breakpoint
CREATE INDEX "booking_contracts_booking_id_idx" ON "booking_contracts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_contracts_status_idx" ON "booking_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_coupon_usage_booking_id_idx" ON "booking_coupon_usage" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_coupon_usage_coupon_code_idx" ON "booking_coupon_usage" USING btree ("coupon_code");--> statement-breakpoint
CREATE INDEX "booking_discounts_booking_id_idx" ON "booking_discounts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_discounts_discount_code_idx" ON "booking_discounts" USING btree ("discount_code");--> statement-breakpoint
CREATE INDEX "booking_disputes_booking_id_idx" ON "booking_disputes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_disputes_status_idx" ON "booking_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_disputes_opened_by_clerk_user_id_idx" ON "booking_disputes" USING btree ("opened_by_clerk_user_id");--> statement-breakpoint
CREATE INDEX "booking_messages_booking_id_idx" ON "booking_messages" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_messages_sender_clerk_user_id_idx" ON "booking_messages" USING btree ("sender_clerk_user_id");--> statement-breakpoint
CREATE INDEX "booking_messages_created_at_idx" ON "booking_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "booking_notifications_booking_id_idx" ON "booking_notifications" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_notifications_status_idx" ON "booking_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_notifications_notification_type_idx" ON "booking_notifications" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "booking_participants_booking_id_idx" ON "booking_participants" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_participants_clerk_user_id_idx" ON "booking_participants" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "booking_participants_participant_role_idx" ON "booking_participants" USING btree ("participant_role");--> statement-breakpoint
CREATE INDEX "booking_payments_booking_id_idx" ON "booking_payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_payments_status_idx" ON "booking_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_payments_provider_payment_intent_id_idx" ON "booking_payments" USING btree ("provider_payment_intent_id");--> statement-breakpoint
CREATE INDEX "booking_pricing_booking_id_idx" ON "booking_pricing" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_pricing_pricing_kind_idx" ON "booking_pricing" USING btree ("pricing_kind");--> statement-breakpoint
CREATE INDEX "booking_refunds_booking_id_idx" ON "booking_refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_refunds_booking_payment_id_idx" ON "booking_refunds" USING btree ("booking_payment_id");--> statement-breakpoint
CREATE INDEX "booking_refunds_status_idx" ON "booking_refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_requirements_booking_id_idx" ON "booking_requirements" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_requirements_status_idx" ON "booking_requirements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_reviews_booking_id_idx" ON "booking_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_reviews_reviewer_clerk_user_id_idx" ON "booking_reviews" USING btree ("reviewer_clerk_user_id");--> statement-breakpoint
CREATE INDEX "booking_reviews_subject_type_idx" ON "booking_reviews" USING btree ("subject_type");--> statement-breakpoint
CREATE INDEX "booking_status_history_booking_id_idx" ON "booking_status_history" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_status_history_to_status_idx" ON "booking_status_history" USING btree ("to_status");--> statement-breakpoint
CREATE INDEX "booking_status_history_created_at_idx" ON "booking_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookings_booking_number_idx" ON "bookings" USING btree ("booking_number");--> statement-breakpoint
CREATE INDEX "bookings_lifecycle_status_idx" ON "bookings" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX "bookings_requester_clerk_user_id_idx" ON "bookings" USING btree ("requester_clerk_user_id");--> statement-breakpoint
CREATE INDEX "bookings_consumer_clerk_user_id_idx" ON "bookings" USING btree ("consumer_clerk_user_id");--> statement-breakpoint
CREATE INDEX "bookings_dj_profile_id_idx" ON "bookings" USING btree ("dj_profile_id");--> statement-breakpoint
CREATE INDEX "bookings_venue_id_idx" ON "bookings" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "bookings_requested_for_at_idx" ON "bookings" USING btree ("requested_for_at");--> statement-breakpoint
CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "concierge_messages_thread_id_idx" ON "concierge_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "concierge_messages_created_at_idx" ON "concierge_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "concierge_threads_clerk_user_id_idx" ON "concierge_threads" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "concierge_threads_last_message_at_idx" ON "concierge_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "dj_availability_dj_profile_id_idx" ON "dj_availability" USING btree ("dj_profile_id");--> statement-breakpoint
CREATE INDEX "dj_availability_availability_date_idx" ON "dj_availability" USING btree ("availability_date");--> statement-breakpoint
CREATE INDEX "event_analytics_daily_event_date_idx" ON "event_analytics_daily" USING btree ("event_id","metric_date");--> statement-breakpoint
CREATE INDEX "event_analytics_daily_source_idx" ON "event_analytics_daily" USING btree ("traffic_source");--> statement-breakpoint
CREATE INDEX "event_lineup_event_id_idx" ON "event_lineup" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_lineup_dj_profile_id_idx" ON "event_lineup" USING btree ("dj_profile_id");--> statement-breakpoint
CREATE INDEX "event_moderation_flags_event_id_idx" ON "event_moderation_flags" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_moderation_flags_status_idx" ON "event_moderation_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_notification_outbox_event_id_idx" ON "event_notification_outbox" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_notification_outbox_status_idx" ON "event_notification_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_recurrence_instances_source_event_id_idx" ON "event_recurrence_instances" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "event_recurrence_instances_instance_event_id_idx" ON "event_recurrence_instances" USING btree ("instance_event_id");--> statement-breakpoint
CREATE INDEX "event_revision_requests_event_id_idx" ON "event_revision_requests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_revision_requests_status_idx" ON "event_revision_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_availability_venue_id_idx" ON "venue_availability" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_availability_availability_date_idx" ON "venue_availability" USING btree ("availability_date");--> statement-breakpoint
CREATE INDEX "venue_claim_requests_venue_id_idx" ON "venue_claim_requests" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_claim_requests_claimant_idx" ON "venue_claim_requests" USING btree ("claimant_clerk_user_id");--> statement-breakpoint
CREATE INDEX "venue_claim_requests_status_idx" ON "venue_claim_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_claim_requests_google_place_id_idx" ON "venue_claim_requests" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "venue_profile_change_requests_venue_id_idx" ON "venue_profile_change_requests" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_profile_change_requests_status_idx" ON "venue_profile_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_profile_change_requests_submitted_by_idx" ON "venue_profile_change_requests" USING btree ("submitted_by_clerk_user_id");--> statement-breakpoint
CREATE INDEX "venue_publish_history_venue_id_idx" ON "venue_publish_history" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_publish_history_action_idx" ON "venue_publish_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_venue_id_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "events_publication_status_idx" ON "events" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "events_lifecycle_status_idx" ON "events" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX "venues_slug_idx" ON "venues" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "venues_google_place_id_idx" ON "venues" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "venues_publication_status_idx" ON "venues" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "venues_name_idx" ON "venues" USING btree ("name");--> statement-breakpoint
CREATE INDEX "venues_neighborhood_idx" ON "venues" USING btree ("neighborhood");