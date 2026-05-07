-- migration boundary: 0000_spicy_inertia
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
CREATE TABLE IF NOT EXISTS "maintenance_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"default_interval_miles" integer,
	"default_interval_months" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"account_id" text
);
CREATE TABLE IF NOT EXISTS "vehicles" (
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
CREATE TABLE IF NOT EXISTS "maintenance_logs" (
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
CREATE TABLE IF NOT EXISTS "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"maintenance_log_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text NOT NULL,
	"file_name" text,
	"file_type" text,
	"uploaded_at" text NOT NULL
);
ALTER TABLE "maintenance_logs" ADD CONSTRAINT IF NOT EXISTS "maintenance_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "maintenance_logs" ADD CONSTRAINT IF NOT EXISTS "maintenance_logs_maintenance_type_id_maintenance_types_id_fk" FOREIGN KEY ("maintenance_type_id") REFERENCES "public"."maintenance_types"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "receipts" ADD CONSTRAINT IF NOT EXISTS "receipts_maintenance_log_id_maintenance_logs_id_fk" FOREIGN KEY ("maintenance_log_id") REFERENCES "public"."maintenance_logs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "vehicles" ADD CONSTRAINT IF NOT EXISTS "vehicles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "idx_logs_vehicle_type" ON "maintenance_logs" USING btree ("vehicle_id","maintenance_type_id");
CREATE INDEX IF NOT EXISTS "idx_logs_vehicle_date" ON "maintenance_logs" USING btree ("vehicle_id","serviced_at");
CREATE INDEX IF NOT EXISTS "idx_maint_types_account_id" ON "maintenance_types" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "idx_receipts_log_id" ON "receipts" USING btree ("maintenance_log_id");
CREATE INDEX IF NOT EXISTS "idx_vehicles_account_id" ON "vehicles" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "idx_vehicles_qr_slug" ON "vehicles" USING btree ("qr_slug");

-- migration boundary: 0001_flaky_pride
CREATE TABLE IF NOT EXISTS "fuel_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"filled_at" text NOT NULL,
	"mileage" integer NOT NULL,
	"fuel_quantity" real NOT NULL,
	"fuel_unit" text DEFAULT 'gallons' NOT NULL,
	"price_per_unit" text,
	"notes" text,
	"created_at" text NOT NULL
);
ALTER TABLE "fuel_logs" ADD CONSTRAINT IF NOT EXISTS "fuel_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "idx_fuel_logs_vehicle_date" ON "fuel_logs" USING btree ("vehicle_id","filled_at");

-- migration boundary: 0002_sudden_kylun
CREATE TABLE IF NOT EXISTS "account_disabled_types" (
	"account_id" text NOT NULL,
	"type_id" text NOT NULL,
	CONSTRAINT "account_disabled_types_account_id_type_id_pk" PRIMARY KEY("account_id","type_id")
);
ALTER TABLE "account_disabled_types" ADD CONSTRAINT IF NOT EXISTS "account_disabled_types_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "account_disabled_types" ADD CONSTRAINT IF NOT EXISTS "account_disabled_types_type_id_maintenance_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."maintenance_types"("id") ON DELETE no action ON UPDATE no action;

-- migration boundary: 0003_bitter_ted_forrester
CREATE TABLE IF NOT EXISTS "account_type_overrides" (
	"account_id" text NOT NULL,
	"type_id" text NOT NULL,
	"interval_miles" integer,
	"interval_months" integer,
	CONSTRAINT "account_type_overrides_account_id_type_id_pk" PRIMARY KEY("account_id","type_id")
);
ALTER TABLE "account_type_overrides" ADD CONSTRAINT IF NOT EXISTS "account_type_overrides_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "account_type_overrides" ADD CONSTRAINT IF NOT EXISTS "account_type_overrides_type_id_maintenance_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."maintenance_types"("id") ON DELETE no action ON UPDATE no action;
