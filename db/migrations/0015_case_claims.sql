CREATE TABLE "case_claims" (
	"target_type" "target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_claims_target_type_target_id_pk" PRIMARY KEY("target_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "case_claims" ADD CONSTRAINT "case_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;