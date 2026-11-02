CREATE TABLE "seed_marks" (
	"key" text PRIMARY KEY NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "require_cw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "help_resources" ADD COLUMN "circle_id" uuid;--> statement-breakpoint
ALTER TABLE "help_resources" ADD CONSTRAINT "help_resources_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;