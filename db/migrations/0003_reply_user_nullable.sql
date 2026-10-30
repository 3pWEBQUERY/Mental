ALTER TABLE "replies" DROP CONSTRAINT "replies_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "replies" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;