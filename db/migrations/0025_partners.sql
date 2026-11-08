CREATE TABLE "partner_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content_type" text DEFAULT 'image/webp' NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"media_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_media_id_partner_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."partner_media"("id") ON DELETE set null ON UPDATE no action;