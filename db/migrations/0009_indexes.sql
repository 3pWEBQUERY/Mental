CREATE INDEX "bookmarks_post_idx" ON "bookmarks" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "notifications_post_idx" ON "notifications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_media_user_idx" ON "post_media" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "support_user_idx" ON "support" USING btree ("user_id");