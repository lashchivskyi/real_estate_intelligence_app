CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"case_id" uuid,
	"action" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"client_id" uuid,
	"property_id" uuid NOT NULL,
	"package_id" text DEFAULT 'digital' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"legal_ordered" boolean DEFAULT false NOT NULL,
	"inspection_ordered" boolean DEFAULT false NOT NULL,
	"manager_id" uuid,
	"inspector_id" uuid,
	"lawyer_id" uuid,
	"brief" jsonb,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"client_note" text,
	"internal_note" text,
	"source" text DEFAULT 'site' NOT NULL,
	"price_uah" integer,
	"paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"batch" text,
	"uploaded_by" uuid,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"kind" text DEFAULT 'client' NOT NULL,
	"ai_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"section_id" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"urgency" text DEFAULT 'within_year' NOT NULL,
	"repair_low" integer,
	"repair_high" integer,
	"repair_currency" text DEFAULT 'UAH' NOT NULL,
	"repair_assumption" text,
	"specialist" text DEFAULT 'inspector' NOT NULL,
	"negotiation" text DEFAULT 'low' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"inspector_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"lang" text DEFAULT 'uk' NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"note" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_items" (
	"case_id" uuid NOT NULL,
	"check_id" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"note" text,
	"extract_date" text,
	"source_id" text DEFAULT 'drrp' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_items_case_id_check_id_pk" PRIMARY KEY("case_id","check_id")
);
--> statement-breakpoint
CREATE TABLE "legal_reviews" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"lawyer_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid,
	"package_id" text,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'created' NOT NULL,
	"amount_minor" integer,
	"currency" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class" text DEFAULT 'residential' NOT NULL,
	"subtype" text DEFAULT 'apartment' NOT NULL,
	"city_id" text NOT NULL,
	"district_id" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"market" text DEFAULT 'secondary' NOT NULL,
	"asking_price" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"area_sqm" double precision NOT NULL,
	"rooms" integer,
	"floor" integer,
	"floors_total" integer,
	"year_built" integer,
	"condition" text,
	"building_type" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text,
	"role" text DEFAULT 'client' NOT NULL,
	"password_hash" text NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"lang" text DEFAULT 'uk' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_lawyer_id_users_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_issues" ADD CONSTRAINT "inspection_issues_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_issues" ADD CONSTRAINT "inspection_issues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_items" ADD CONSTRAINT "legal_items_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_lawyer_id_users_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_case" ON "audit_log" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "cases_client" ON "cases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cases_status" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cases_inspector" ON "cases" USING btree ("inspector_id");--> statement-breakpoint
CREATE INDEX "cases_lawyer" ON "cases" USING btree ("lawyer_id");--> statement-breakpoint
CREATE INDEX "documents_case" ON "documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "documents_batch" ON "documents" USING btree ("batch");--> statement-breakpoint
CREATE INDEX "events_name_time" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "issues_case" ON "inspection_issues" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "payments_case" ON "payments" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role" ON "users" USING btree ("role");