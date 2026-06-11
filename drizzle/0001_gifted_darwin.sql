CREATE TABLE "symptom_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"snapshot_fingerprint" text NOT NULL,
	"snapshot_version" integer NOT NULL,
	"ranking_version" text NOT NULL,
	"city_place_id" text NOT NULL,
	"city_label" text NOT NULL,
	"symptoms" jsonb NOT NULL,
	"pollen_activity" jsonb NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "symptom_checks" ADD CONSTRAINT "symptom_checks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "symptom_checks_owner_completed_at_idx" ON "symptom_checks" USING btree ("owner_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "symptom_checks_owner_request_id_unique" ON "symptom_checks" USING btree ("owner_id","client_request_id");