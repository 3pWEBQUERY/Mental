CREATE TABLE "apns_devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"token" text NOT NULL,
	"sandbox" boolean DEFAULT false NOT NULL,
	"quiet_from" smallint DEFAULT 22 NOT NULL,
	"quiet_to" smallint DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apns_devices_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "apns_devices" ADD CONSTRAINT "apns_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apns_devices" ADD CONSTRAINT "apns_devices_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apns_user_idx" ON "apns_devices" USING btree ("user_id");