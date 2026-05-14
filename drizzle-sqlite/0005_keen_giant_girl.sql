CREATE TABLE `scan_engines` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`model_id` text,
	`api_key` text,
	`base_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scan_engines_account_id` ON `scan_engines` (`account_id`);--> statement-breakpoint
ALTER TABLE `account_settings` ADD `moondream_api_key` text;--> statement-breakpoint
ALTER TABLE `account_settings` ADD `gemini_api_key` text;--> statement-breakpoint
ALTER TABLE `account_settings` ADD `openrouter_api_key` text;