CREATE TABLE "role_proposals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "role" NOT NULL,
	"proposed_by" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "nudged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "listener_nudged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_proposals" ADD CONSTRAINT "role_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_proposals" ADD CONSTRAINT "role_proposals_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;