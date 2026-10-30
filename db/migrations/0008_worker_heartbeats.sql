CREATE TABLE "worker_heartbeats" (
	"instance" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
