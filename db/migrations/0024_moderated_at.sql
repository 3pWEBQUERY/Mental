ALTER TABLE "posts" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "replies" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
-- Bestehende Inhalte gelten als geprüft – sonst reihte der Worker beim ersten Lauf alles erneut ein.
UPDATE "posts" SET "moderated_at" = "created_at" WHERE "moderated_at" IS NULL;--> statement-breakpoint
UPDATE "replies" SET "moderated_at" = "created_at" WHERE "moderated_at" IS NULL;
