CREATE TABLE "account_disabled_types" (
	"account_id" text NOT NULL,
	"type_id" text NOT NULL,
	CONSTRAINT "account_disabled_types_account_id_type_id_pk" PRIMARY KEY("account_id","type_id")
);
--> statement-breakpoint
ALTER TABLE "account_disabled_types" ADD CONSTRAINT "account_disabled_types_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_disabled_types" ADD CONSTRAINT "account_disabled_types_type_id_maintenance_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."maintenance_types"("id") ON DELETE no action ON UPDATE no action;