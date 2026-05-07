CREATE TABLE `account_disabled_types` (
	`account_id` text NOT NULL,
	`type_id` text NOT NULL,
	PRIMARY KEY(`account_id`, `type_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`type_id`) REFERENCES `maintenance_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account_type_overrides` (
	`account_id` text NOT NULL,
	`type_id` text NOT NULL,
	`interval_miles` integer,
	`interval_months` integer,
	PRIMARY KEY(`account_id`, `type_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`type_id`) REFERENCES `maintenance_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `fuel_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`filled_at` text NOT NULL,
	`mileage` integer NOT NULL,
	`fuel_quantity` real NOT NULL,
	`fuel_unit` text DEFAULT 'gallons' NOT NULL,
	`price_per_unit` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fuel_logs_vehicle_date` ON `fuel_logs` (`vehicle_id`,`filled_at`);--> statement-breakpoint
CREATE TABLE `maintenance_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`maintenance_type_id` text NOT NULL,
	`serviced_at` text NOT NULL,
	`mileage_at_service` integer NOT NULL,
	`next_due_mileage` integer,
	`next_due_date` text,
	`price_paid` text,
	`shop` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`maintenance_type_id`) REFERENCES `maintenance_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_logs_vehicle_type` ON `maintenance_logs` (`vehicle_id`,`maintenance_type_id`);--> statement-breakpoint
CREATE INDEX `idx_logs_vehicle_date` ON `maintenance_logs` (`vehicle_id`,`serviced_at`);--> statement-breakpoint
CREATE TABLE `maintenance_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`default_interval_miles` integer,
	`default_interval_months` integer,
	`is_default` integer DEFAULT false NOT NULL,
	`account_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_maint_types_account_id` ON `maintenance_types` (`account_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`maintenance_log_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`r2_url` text NOT NULL,
	`file_name` text,
	`file_type` text,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`maintenance_log_id`) REFERENCES `maintenance_logs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_receipts_log_id` ON `receipts` (`maintenance_log_id`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`make` text,
	`model` text,
	`year` integer,
	`vin` text,
	`license_plate` text,
	`units` text DEFAULT 'miles' NOT NULL,
	`current_mileage` integer,
	`qr_slug` text NOT NULL,
	`qr_pin_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_qr_slug_unique` ON `vehicles` (`qr_slug`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_account_id` ON `vehicles` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_qr_slug` ON `vehicles` (`qr_slug`);