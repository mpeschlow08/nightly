DO $$ BEGIN
  CREATE TYPE "concierge_thread_status" AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "concierge_message_role" AS ENUM ('user', 'assistant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "concierge_threads" (
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

CREATE INDEX IF NOT EXISTS "concierge_threads_clerk_user_id_idx" ON "concierge_threads" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "concierge_threads_last_message_at_idx" ON "concierge_threads" ("last_message_at");

CREATE TABLE IF NOT EXISTS "concierge_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "thread_id" integer NOT NULL,
  "role" "concierge_message_role" NOT NULL,
  "content" text NOT NULL,
  "intent" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "concierge_messages" ADD CONSTRAINT "concierge_messages_thread_id_concierge_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."concierge_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "concierge_messages_thread_id_idx" ON "concierge_messages" ("thread_id");
CREATE INDEX IF NOT EXISTS "concierge_messages_created_at_idx" ON "concierge_messages" ("created_at");