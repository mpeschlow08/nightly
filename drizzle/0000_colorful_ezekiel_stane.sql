CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"created_at" timestamp DEFAULT now()
);
