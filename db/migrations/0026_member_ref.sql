ALTER TABLE "users" ADD COLUMN "member_ref" text;--> statement-breakpoint
CREATE INDEX "users_member_ref_idx" ON "users" USING btree ("member_ref");