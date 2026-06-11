CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_platform_uid" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_identity_platform_uid_unique" UNIQUE("identity_platform_uid"),
	CONSTRAINT "users_normalized_email_unique" UNIQUE("normalized_email")
);
