ALTER TABLE "circles" ADD COLUMN "i18n" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "steps" ADD COLUMN "i18n" jsonb DEFAULT '{}'::jsonb NOT NULL;