CREATE TABLE "fuel_logs" (
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
--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fuel_logs_vehicle_date" ON "fuel_logs" USING btree ("vehicle_id","filled_at");