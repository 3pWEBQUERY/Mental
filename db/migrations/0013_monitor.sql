ALTER TYPE "public"."notification_kind" ADD VALUE 'system';--> statement-breakpoint
CREATE TABLE "monitor_incidents" (
	"key" text PRIMARY KEY NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL
);
