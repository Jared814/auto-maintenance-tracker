CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "maintenance_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"maintenance_type_id" text NOT NULL,
	"serviced_at" text NOT NULL,
	"mileage_at_service" integer NOT NULL,
	"next_due_mileage" integer,
	"next_due_date" text,
	"price_paid" text,
	"shop" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"default_interval_miles" integer,
	"default_interval_months" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"account_id" text
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"maintenance_log_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text NOT NULL,
	"file_name" text,
	"file_type" text,
	"uploaded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"vin" text,
	"license_plate" text,
	"units" text DEFAULT 'miles' NOT NULL,
	"current_mileage" integer,
	"qr_slug" text NOT NULL,
	"qr_pin_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "vehicles_qr_slug_unique" UNIQUE("qr_slug")
);
--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_maintenance_type_id_maintenance_types_id_fk" FOREIGN KEY ("maintenance_type_id") REFERENCES "public"."maintenance_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_maintenance_log_id_maintenance_logs_id_fk" FOREIGN KEY ("maintenance_log_id") REFERENCES "public"."maintenance_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_logs_vehicle_type" ON "maintenance_logs" USING btree ("vehicle_id","maintenance_type_id");--> statement-breakpoint
CREATE INDEX "idx_logs_vehicle_date" ON "maintenance_logs" USING btree ("vehicle_id","serviced_at");--> statement-breakpoint
CREATE INDEX "idx_maint_types_account_id" ON "maintenance_types" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_log_id" ON "receipts" USING btree ("maintenance_log_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_account_id" ON "vehicles" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_qr_slug" ON "vehicles" USING btree ("qr_slug");