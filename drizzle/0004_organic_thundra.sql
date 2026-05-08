CREATE TABLE "fuel_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"fuel_log_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text NOT NULL,
	"file_name" text,
	"file_type" text,
	"uploaded_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fuel_receipts" ADD CONSTRAINT "fuel_receipts_fuel_log_id_fuel_logs_id_fk" FOREIGN KEY ("fuel_log_id") REFERENCES "public"."fuel_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fuel_receipts_log_id" ON "fuel_receipts" USING btree ("fuel_log_id");