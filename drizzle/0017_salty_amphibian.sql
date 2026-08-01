CREATE TYPE "public"."social_group_invite_status" AS ENUM('active', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."social_group_join_request_status" AS ENUM('pending', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."social_media_asset_kind" AS ENUM('image', 'video', 'voice', 'story', 'thumbnail');--> statement-breakpoint
CREATE TYPE "public"."social_media_moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."social_message_receipt_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TYPE "public"."social_story_post_status" AS ENUM('active', 'expired', 'archived');--> statement-breakpoint
ALTER TYPE "public"."social_group_message_type" ADD VALUE 'video';--> statement-breakpoint
ALTER TYPE "public"."social_group_message_type" ADD VALUE 'voice';--> statement-breakpoint
ALTER TYPE "public"."social_group_message_type" ADD VALUE 'thread_reply';--> statement-breakpoint
ALTER TYPE "public"."presence_status" ADD VALUE 'idle' BEFORE 'heading_out';--> statement-breakpoint
CREATE TABLE "direct_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_one_id" integer NOT NULL,
	"user_two_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"last_message_id" integer,
	"last_message_at" timestamp,
	"archived_by_user_one" boolean DEFAULT false NOT NULL,
	"archived_by_user_two" boolean DEFAULT false NOT NULL,
	"deleted_by_user_one_at" timestamp,
	"deleted_by_user_two_at" timestamp,
	"muted_by_user_one_until" timestamp,
	"muted_by_user_two_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "direct_conversations_user_pair_unique" UNIQUE("user_one_id","user_two_id")
);
--> statement-breakpoint
CREATE TABLE "direct_message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "direct_message_reactions_unique" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_user_id" integer NOT NULL,
	"sender_clerk_user_id" text NOT NULL,
	"message_type" "social_group_message_type" DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"media_url" text,
	"reply_to_message_id" integer,
	"mentions_json" text DEFAULT '[]' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"reactions_count" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"deleted_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"inviter_user_id" integer NOT NULL,
	"invitee_user_id" integer,
	"invite_code" text NOT NULL,
	"status" "social_group_invite_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"accepted_at" timestamp,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_invites_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "group_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"requester_user_id" integer NOT NULL,
	"reviewer_user_id" integer,
	"status" "social_group_join_request_status" DEFAULT 'pending' NOT NULL,
	"request_message" text,
	"response_message" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_join_requests_group_user_unique" UNIQUE("group_id","requester_user_id")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" integer NOT NULL,
	"uploader_user_id" integer NOT NULL,
	"group_id" integer,
	"direct_conversation_id" integer,
	"kind" "social_media_asset_kind" NOT NULL,
	"moderation_status" "social_media_moderation_status" DEFAULT 'pending' NOT NULL,
	"blob_url" text NOT NULL,
	"thumbnail_url" text,
	"mime_type" text,
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "night_out_plan_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "social_group_member_role" DEFAULT 'member' NOT NULL,
	"rsvp_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "night_out_plan_members_plan_user_unique" UNIQUE("plan_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "night_out_plan_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"venue_id" integer,
	"event_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"eta_minutes" integer,
	"arrival_window" text,
	"budget_label" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "night_out_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer,
	"creator_user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"budget_label" text,
	"transportation_plan" text,
	"ticket_coordination_json" text DEFAULT '{}' NOT NULL,
	"guest_list_coordination_json" text DEFAULT '{}' NOT NULL,
	"bottle_reservation_coordination_json" text DEFAULT '{}' NOT NULL,
	"ai_summary" text,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"presence_id" integer,
	"status" "presence_status" NOT NULL,
	"visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"venue_id" integer,
	"approximate_location_label" text,
	"custom_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_message_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_message_id" integer,
	"direct_message_id" integer,
	"media_asset_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_message_mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_message_id" integer,
	"direct_message_id" integer,
	"mentioned_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_message_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_message_id" integer,
	"direct_message_id" integer,
	"recipient_user_id" integer NOT NULL,
	"status" "social_message_receipt_status" DEFAULT 'sent' NOT NULL,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_asset_id" integer NOT NULL,
	"status" "social_story_post_status" DEFAULT 'active' NOT NULL,
	"caption" text,
	"visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_post_id" integer NOT NULL,
	"viewer_user_id" integer NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "story_views_story_viewer_unique" UNIQUE("story_post_id","viewer_user_id")
);
--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "permission_overrides_json" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "thread_root_message_id" integer;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "metadata_json" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "delivered_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "read_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "deleted_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "group_polls" ADD COLUMN "options_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "presence" ADD COLUMN "custom_status" text;--> statement-breakpoint
ALTER TABLE "social_groups" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_user_one_id_users_id_fk" FOREIGN KEY ("user_one_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_user_two_id_users_id_fk" FOREIGN KEY ("user_two_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_reactions" ADD CONSTRAINT "direct_message_reactions_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_reactions" ADD CONSTRAINT "direct_message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_direct_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."direct_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_direct_conversation_id_direct_conversations_id_fk" FOREIGN KEY ("direct_conversation_id") REFERENCES "public"."direct_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plan_members" ADD CONSTRAINT "night_out_plan_members_plan_id_night_out_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."night_out_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plan_members" ADD CONSTRAINT "night_out_plan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plan_stops" ADD CONSTRAINT "night_out_plan_stops_plan_id_night_out_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."night_out_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plan_stops" ADD CONSTRAINT "night_out_plan_stops_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plan_stops" ADD CONSTRAINT "night_out_plan_stops_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plans" ADD CONSTRAINT "night_out_plans_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_plans" ADD CONSTRAINT "night_out_plans_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_history" ADD CONSTRAINT "presence_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_history" ADD CONSTRAINT "presence_history_presence_id_presence_id_fk" FOREIGN KEY ("presence_id") REFERENCES "public"."presence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_history" ADD CONSTRAINT "presence_history_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_media" ADD CONSTRAINT "social_message_media_group_message_id_group_messages_id_fk" FOREIGN KEY ("group_message_id") REFERENCES "public"."group_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_media" ADD CONSTRAINT "social_message_media_direct_message_id_direct_messages_id_fk" FOREIGN KEY ("direct_message_id") REFERENCES "public"."direct_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_media" ADD CONSTRAINT "social_message_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_mentions" ADD CONSTRAINT "social_message_mentions_group_message_id_group_messages_id_fk" FOREIGN KEY ("group_message_id") REFERENCES "public"."group_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_mentions" ADD CONSTRAINT "social_message_mentions_direct_message_id_direct_messages_id_fk" FOREIGN KEY ("direct_message_id") REFERENCES "public"."direct_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_mentions" ADD CONSTRAINT "social_message_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_receipts" ADD CONSTRAINT "social_message_receipts_group_message_id_group_messages_id_fk" FOREIGN KEY ("group_message_id") REFERENCES "public"."group_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_receipts" ADD CONSTRAINT "social_message_receipts_direct_message_id_direct_messages_id_fk" FOREIGN KEY ("direct_message_id") REFERENCES "public"."direct_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_message_receipts" ADD CONSTRAINT "social_message_receipts_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_posts" ADD CONSTRAINT "story_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_posts" ADD CONSTRAINT "story_posts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_post_id_story_posts_id_fk" FOREIGN KEY ("story_post_id") REFERENCES "public"."story_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_conversations_user_one_id_idx" ON "direct_conversations" USING btree ("user_one_id");--> statement-breakpoint
CREATE INDEX "direct_conversations_user_two_id_idx" ON "direct_conversations" USING btree ("user_two_id");--> statement-breakpoint
CREATE INDEX "direct_conversations_last_message_at_idx" ON "direct_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "direct_message_reactions_message_id_idx" ON "direct_message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "direct_message_reactions_user_id_idx" ON "direct_message_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "direct_messages_conversation_id_idx" ON "direct_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "direct_messages_sender_user_id_idx" ON "direct_messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "direct_messages_created_at_idx" ON "direct_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "group_invites_group_id_idx" ON "group_invites" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_invites_inviter_user_id_idx" ON "group_invites" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "group_invites_invitee_user_id_idx" ON "group_invites" USING btree ("invitee_user_id");--> statement-breakpoint
CREATE INDEX "group_invites_status_idx" ON "group_invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_join_requests_group_id_idx" ON "group_join_requests" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_join_requests_requester_user_id_idx" ON "group_join_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "group_join_requests_status_idx" ON "group_join_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_assets_owner_user_id_idx" ON "media_assets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "media_assets_uploader_user_id_idx" ON "media_assets" USING btree ("uploader_user_id");--> statement-breakpoint
CREATE INDEX "media_assets_group_id_idx" ON "media_assets" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "media_assets_direct_conversation_id_idx" ON "media_assets" USING btree ("direct_conversation_id");--> statement-breakpoint
CREATE INDEX "media_assets_kind_idx" ON "media_assets" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "night_out_plan_members_plan_id_idx" ON "night_out_plan_members" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "night_out_plan_members_user_id_idx" ON "night_out_plan_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "night_out_plan_stops_plan_id_idx" ON "night_out_plan_stops" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "night_out_plan_stops_sort_order_idx" ON "night_out_plan_stops" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "night_out_plans_group_id_idx" ON "night_out_plans" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "night_out_plans_creator_user_id_idx" ON "night_out_plans" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX "night_out_plans_created_at_idx" ON "night_out_plans" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "presence_history_user_id_idx" ON "presence_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presence_history_status_idx" ON "presence_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "presence_history_created_at_idx" ON "presence_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "social_message_media_group_message_id_idx" ON "social_message_media" USING btree ("group_message_id");--> statement-breakpoint
CREATE INDEX "social_message_media_direct_message_id_idx" ON "social_message_media" USING btree ("direct_message_id");--> statement-breakpoint
CREATE INDEX "social_message_media_media_asset_id_idx" ON "social_message_media" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "social_message_mentions_group_message_id_idx" ON "social_message_mentions" USING btree ("group_message_id");--> statement-breakpoint
CREATE INDEX "social_message_mentions_direct_message_id_idx" ON "social_message_mentions" USING btree ("direct_message_id");--> statement-breakpoint
CREATE INDEX "social_message_mentions_user_id_idx" ON "social_message_mentions" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE INDEX "social_message_receipts_group_message_id_idx" ON "social_message_receipts" USING btree ("group_message_id");--> statement-breakpoint
CREATE INDEX "social_message_receipts_direct_message_id_idx" ON "social_message_receipts" USING btree ("direct_message_id");--> statement-breakpoint
CREATE INDEX "social_message_receipts_recipient_user_id_idx" ON "social_message_receipts" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "story_posts_user_id_idx" ON "story_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "story_posts_status_idx" ON "story_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "story_posts_expires_at_idx" ON "story_posts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "story_views_story_post_id_idx" ON "story_views" USING btree ("story_post_id");--> statement-breakpoint
CREATE INDEX "story_views_viewer_user_id_idx" ON "story_views" USING btree ("viewer_user_id");--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;