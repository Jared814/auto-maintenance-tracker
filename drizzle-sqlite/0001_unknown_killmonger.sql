CREATE TABLE `fuel_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`fuel_log_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`r2_url` text NOT NULL,
	`file_name` text,
	`file_type` text,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`fuel_log_id`) REFERENCES `fuel_logs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fuel_receipts_log_id` ON `fuel_receipts` (`fuel_log_id`);