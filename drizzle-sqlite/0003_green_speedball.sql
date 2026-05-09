CREATE TABLE `mileage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`logged_at` text NOT NULL,
	`mileage` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mileage_logs_vehicle_date` ON `mileage_logs` (`vehicle_id`,`logged_at`);