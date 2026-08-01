CREATE TYPE "public"."friend_relationship_status" AS ENUM('active', 'removed', 'muted');--> statement-breakpoint
CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'blocked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."social_group_member_role" AS ENUM('host', 'cohost', 'member');--> statement-breakpoint
CREATE TYPE "public"."social_group_member_status" AS ENUM('invited', 'active', 'left', 'kicked');--> statement-breakpoint
CREATE TYPE "public"."social_group_message_type" AS ENUM('text', 'image', 'gif', 'system', 'reply');--> statement-breakpoint
CREATE TYPE "public"."social_group_poll_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."social_group_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."meet_request_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meet_request_type" AS ENUM('meet_here', 'im_lost', 'find_my_friends', 'group_eta', 'pinned_meeting_spot', 'walking_handoff', 'emergency_regroup', 'venue_pin');--> statement-breakpoint
CREATE TYPE "public"."night_out_location_mode" AS ENUM('venue_only', 'approximate', 'exact', 'invisible');--> statement-breakpoint
CREATE TYPE "public"."night_out_status" AS ENUM('active', 'ended', 'expired');--> statement-breakpoint
CREATE TYPE "public"."presence_status" AS ENUM('offline', 'online', 'heading_out', 'at_venue', 'changing_venue', 'leaving', 'night_over', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."social_notification_status" AS ENUM('queued', 'processing', 'sent', 'read', 'failed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."social_report_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."social_visibility" AS ENUM('public', 'friends', 'close_friends', 'private');--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"activity_type" text NOT NULL,
	"visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"payload_json" text NOT NULL,
	"venue_id" integer,
	"event_id" integer,
	"group_id" integer,
	"ticket_id" integer,
	"booking_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_user_id" integer NOT NULL,
	"blocked_user_id" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friend_blocks_user_pair_unique" UNIQUE("blocker_user_id","blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "friend_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"friend_user_id" integer NOT NULL,
	"is_close_friend" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friend_favorites_user_pair_unique" UNIQUE("user_id","friend_user_id")
);
--> statement-breakpoint
CREATE TABLE "friend_mutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"friend_user_id" integer NOT NULL,
	"muted_until" timestamp,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friend_mutes_user_pair_unique" UNIQUE("user_id","friend_user_id")
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_user_id" integer NOT NULL,
	"requester_clerk_user_id" text NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"recipient_clerk_user_id" text NOT NULL,
	"message" text,
	"invite_code" text,
	"source" text DEFAULT 'friend_code' NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp,
	"declined_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friend_requests_user_pair_unique" UNIQUE("requester_user_id","recipient_user_id")
);
--> statement-breakpoint
CREATE TABLE "friends" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"friend_user_id" integer NOT NULL,
	"status" "friend_relationship_status" DEFAULT 'active' NOT NULL,
	"source_request_id" integer,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_interaction_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friends_user_friend_unique" UNIQUE("user_id","friend_user_id")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" "social_group_member_role" DEFAULT 'member' NOT NULL,
	"status" "social_group_member_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" integer,
	"joined_at" timestamp,
	"left_at" timestamp,
	"is_muted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_user_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "group_message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_message_reactions_unique" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "group_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"sender_user_id" integer NOT NULL,
	"sender_clerk_user_id" text NOT NULL,
	"message_type" "social_group_message_type" DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"media_url" text,
	"reply_to_message_id" integer,
	"mentions_json" text DEFAULT '[]' NOT NULL,
	"reactions_count" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"creator_user_id" integer NOT NULL,
	"question" text NOT NULL,
	"status" "social_group_poll_status" DEFAULT 'open' NOT NULL,
	"allow_multiple_votes" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"option_label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_votes_unique" UNIQUE("poll_id","user_id","option_label")
);
--> statement-breakpoint
CREATE TABLE "meet_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_user_id" integer NOT NULL,
	"requester_clerk_user_id" text NOT NULL,
	"recipient_user_id" integer,
	"recipient_clerk_user_id" text,
	"group_id" integer,
	"night_out_session_id" integer,
	"venue_id" integer,
	"request_type" "meet_request_type" NOT NULL,
	"status" "meet_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"eta_minutes" integer,
	"venue_label" text,
	"location_json" text,
	"expires_at" timestamp,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "night_out_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"group_id" integer,
	"venue_id" integer,
	"status" "night_out_status" DEFAULT 'active' NOT NULL,
	"location_mode" "night_out_location_mode" DEFAULT 'approximate' NOT NULL,
	"venue_only_share" boolean DEFAULT false NOT NULL,
	"time_limited_share" boolean DEFAULT true NOT NULL,
	"approximate_location_label" text,
	"exact_location_json" text,
	"current_stop_label" text,
	"next_stop_label" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp,
	"expires_at" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"night_out_session_id" integer,
	"status" "presence_status" DEFAULT 'offline' NOT NULL,
	"visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"venue_id" integer,
	"approximate_location_label" text,
	"exact_location_json" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "presence_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"presence_visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"activity_visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"location_visibility" "social_visibility" DEFAULT 'close_friends' NOT NULL,
	"allow_mutual_friends" boolean DEFAULT true NOT NULL,
	"allow_search_indexing" boolean DEFAULT true NOT NULL,
	"allow_friend_requests" boolean DEFAULT true NOT NULL,
	"show_shared_friends" boolean DEFAULT true NOT NULL,
	"show_social_badges" boolean DEFAULT true NOT NULL,
	"exact_location_share_allowed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "social_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"host_user_id" integer NOT NULL,
	"host_clerk_user_id" text NOT NULL,
	"capacity" integer DEFAULT 8 NOT NULL,
	"visibility" "social_group_visibility" DEFAULT 'private' NOT NULL,
	"is_temporary" boolean DEFAULT true NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"invite_code" text NOT NULL,
	"venue_id" integer,
	"event_id" integer,
	"timezone" text,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_groups_slug_unique" UNIQUE("slug"),
	CONSTRAINT "social_groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "social_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"recipient_clerk_user_id" text NOT NULL,
	"notification_type" text NOT NULL,
	"status" "social_notification_status" DEFAULT 'queued' NOT NULL,
	"payload_json" text NOT NULL,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"read_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"allow_friend_requests" boolean DEFAULT true NOT NULL,
	"allow_group_invites" boolean DEFAULT true NOT NULL,
	"allow_meet_requests" boolean DEFAULT true NOT NULL,
	"show_activity_feed" boolean DEFAULT true NOT NULL,
	"show_presence" boolean DEFAULT true NOT NULL,
	"share_approximate_location" boolean DEFAULT true NOT NULL,
	"share_exact_location" boolean DEFAULT false NOT NULL,
	"auto_expire_night_out" boolean DEFAULT true NOT NULL,
	"location_time_limit_minutes" integer DEFAULT 120 NOT NULL,
	"favorite_nightlife_days_json" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "social_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"handle" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"interests_json" text DEFAULT '[]' NOT NULL,
	"favorite_genres_json" text DEFAULT '[]' NOT NULL,
	"favorite_venues_json" text DEFAULT '[]' NOT NULL,
	"favorite_djs_json" text DEFAULT '[]' NOT NULL,
	"favorite_neighborhoods_json" text DEFAULT '[]' NOT NULL,
	"nightlife_personality" text,
	"visibility" "social_visibility" DEFAULT 'friends' NOT NULL,
	"social_badges_json" text DEFAULT '[]' NOT NULL,
	"activity_stats_json" text DEFAULT '{}' NOT NULL,
	"shared_friends_count" integer DEFAULT 0 NOT NULL,
	"friend_code" text NOT NULL,
	"friend_qr_token" text NOT NULL,
	"is_discoverable" boolean DEFAULT true NOT NULL,
	"is_night_out_visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "social_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "social_profiles_handle_unique" UNIQUE("handle"),
	CONSTRAINT "social_profiles_friend_code_unique" UNIQUE("friend_code"),
	CONSTRAINT "social_profiles_friend_qr_token_unique" UNIQUE("friend_qr_token")
);
--> statement-breakpoint
CREATE TABLE "social_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_user_id" integer NOT NULL,
	"reporter_clerk_user_id" text NOT NULL,
	"reported_user_id" integer,
	"reported_group_id" integer,
	"reported_message_id" integer,
	"report_type" text NOT NULL,
	"reason" text NOT NULL,
	"status" "social_report_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"reviewed_by_clerk_user_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_blocks" ADD CONSTRAINT "friend_blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_blocks" ADD CONSTRAINT "friend_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_favorites" ADD CONSTRAINT "friend_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_favorites" ADD CONSTRAINT "friend_favorites_friend_user_id_users_id_fk" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_mutes" ADD CONSTRAINT "friend_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_mutes" ADD CONSTRAINT "friend_mutes_friend_user_id_users_id_fk" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friends" ADD CONSTRAINT "friends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friends" ADD CONSTRAINT "friends_friend_user_id_users_id_fk" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message_reactions" ADD CONSTRAINT "group_message_reactions_message_id_group_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."group_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message_reactions" ADD CONSTRAINT "group_message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_polls" ADD CONSTRAINT "group_polls_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_polls" ADD CONSTRAINT "group_polls_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_votes" ADD CONSTRAINT "group_votes_poll_id_group_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."group_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_votes" ADD CONSTRAINT "group_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meet_requests" ADD CONSTRAINT "meet_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meet_requests" ADD CONSTRAINT "meet_requests_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meet_requests" ADD CONSTRAINT "meet_requests_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meet_requests" ADD CONSTRAINT "meet_requests_night_out_session_id_night_out_sessions_id_fk" FOREIGN KEY ("night_out_session_id") REFERENCES "public"."night_out_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meet_requests" ADD CONSTRAINT "meet_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_sessions" ADD CONSTRAINT "night_out_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_sessions" ADD CONSTRAINT "night_out_sessions_group_id_social_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."social_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_out_sessions" ADD CONSTRAINT "night_out_sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_night_out_session_id_night_out_sessions_id_fk" FOREIGN KEY ("night_out_session_id") REFERENCES "public"."night_out_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_groups" ADD CONSTRAINT "social_groups_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_groups" ADD CONSTRAINT "social_groups_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_groups" ADD CONSTRAINT "social_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_notifications" ADD CONSTRAINT "social_notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_preferences" ADD CONSTRAINT "social_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reports" ADD CONSTRAINT "social_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reports" ADD CONSTRAINT "social_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reports" ADD CONSTRAINT "social_reports_reported_group_id_social_groups_id_fk" FOREIGN KEY ("reported_group_id") REFERENCES "public"."social_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reports" ADD CONSTRAINT "social_reports_reported_message_id_group_messages_id_fk" FOREIGN KEY ("reported_message_id") REFERENCES "public"."group_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_feed_actor_user_id_idx" ON "activity_feed" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "activity_feed_activity_type_idx" ON "activity_feed" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "activity_feed_created_at_idx" ON "activity_feed" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_feed_visibility_idx" ON "activity_feed" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "friend_blocks_blocker_user_id_idx" ON "friend_blocks" USING btree ("blocker_user_id");--> statement-breakpoint
CREATE INDEX "friend_blocks_blocked_user_id_idx" ON "friend_blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "friend_favorites_user_id_idx" ON "friend_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_favorites_friend_user_id_idx" ON "friend_favorites" USING btree ("friend_user_id");--> statement-breakpoint
CREATE INDEX "friend_mutes_user_id_idx" ON "friend_mutes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_mutes_friend_user_id_idx" ON "friend_mutes" USING btree ("friend_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_requester_user_id_idx" ON "friend_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_recipient_user_id_idx" ON "friend_requests" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_status_idx" ON "friend_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "friends_user_id_idx" ON "friends" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friends_friend_user_id_idx" ON "friends" USING btree ("friend_user_id");--> statement-breakpoint
CREATE INDEX "friends_status_idx" ON "friends" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_members_group_id_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_user_id_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_members_status_idx" ON "group_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_message_reactions_message_id_idx" ON "group_message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "group_message_reactions_user_id_idx" ON "group_message_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_messages_group_id_idx" ON "group_messages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_messages_sender_user_id_idx" ON "group_messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "group_messages_created_at_idx" ON "group_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "group_polls_group_id_idx" ON "group_polls" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_polls_status_idx" ON "group_polls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_votes_poll_id_idx" ON "group_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "group_votes_user_id_idx" ON "group_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meet_requests_requester_user_id_idx" ON "meet_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "meet_requests_recipient_user_id_idx" ON "meet_requests" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "meet_requests_group_id_idx" ON "meet_requests" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "meet_requests_status_idx" ON "meet_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "night_out_sessions_user_id_idx" ON "night_out_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "night_out_sessions_group_id_idx" ON "night_out_sessions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "night_out_sessions_status_idx" ON "night_out_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "presence_user_id_idx" ON "presence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presence_status_idx" ON "presence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "presence_visibility_idx" ON "presence" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "privacy_settings_user_id_idx" ON "privacy_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "privacy_settings_profile_visibility_idx" ON "privacy_settings" USING btree ("profile_visibility");--> statement-breakpoint
CREATE INDEX "social_groups_host_user_id_idx" ON "social_groups" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "social_groups_venue_id_idx" ON "social_groups" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "social_groups_event_id_idx" ON "social_groups" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "social_groups_visibility_idx" ON "social_groups" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "social_notifications_recipient_user_id_idx" ON "social_notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "social_notifications_status_idx" ON "social_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "social_notifications_notification_type_idx" ON "social_notifications" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "social_preferences_user_id_idx" ON "social_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "social_profiles_clerk_user_id_idx" ON "social_profiles" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "social_profiles_handle_idx" ON "social_profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "social_profiles_visibility_idx" ON "social_profiles" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "social_reports_reporter_user_id_idx" ON "social_reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "social_reports_reported_user_id_idx" ON "social_reports" USING btree ("reported_user_id");--> statement-breakpoint
CREATE INDEX "social_reports_status_idx" ON "social_reports" USING btree ("status");