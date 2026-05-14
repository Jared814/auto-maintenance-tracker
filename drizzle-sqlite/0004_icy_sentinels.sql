CREATE TABLE `account_settings` (
	`account_id` text PRIMARY KEY NOT NULL,
	`odometer_model` text DEFAULT 'moondream' NOT NULL,
	`receipt_model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
