import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull(),
});

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  name: text('name').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  vin: text('vin'),
  license_plate: text('license_plate'),
  units: text('units').notNull().default('miles'),
  current_mileage: integer('current_mileage'),
  qr_slug: text('qr_slug').unique().notNull(),
  qr_pin_hash: text('qr_pin_hash').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  info_blob: text('info_blob'),
}, (table) => [
  index('idx_vehicles_account_id').on(table.account_id),
  index('idx_vehicles_qr_slug').on(table.qr_slug),
]);

export const maintenanceTypes = sqliteTable('maintenance_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  default_interval_miles: integer('default_interval_miles'),
  default_interval_months: integer('default_interval_months'),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  account_id: text('account_id'),
}, (table) => [
  index('idx_maint_types_account_id').on(table.account_id),
]);

export const maintenanceLogs = sqliteTable('maintenance_logs', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').references(() => vehicles.id).notNull(),
  maintenance_type_id: text('maintenance_type_id').references(() => maintenanceTypes.id).notNull(),
  serviced_at: text('serviced_at').notNull(),
  mileage_at_service: integer('mileage_at_service').notNull(),
  next_due_mileage: integer('next_due_mileage'),
  next_due_date: text('next_due_date'),
  price_paid: text('price_paid'),
  shop: text('shop'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  index('idx_logs_vehicle_type').on(table.vehicle_id, table.maintenance_type_id),
  index('idx_logs_vehicle_date').on(table.vehicle_id, table.serviced_at),
]);

export const fuelLogs = sqliteTable('fuel_logs', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').references(() => vehicles.id).notNull(),
  filled_at: text('filled_at').notNull(),
  mileage: integer('mileage').notNull(),
  fuel_quantity: real('fuel_quantity').notNull(),
  fuel_unit: text('fuel_unit').notNull().default('gallons'),
  price_per_unit: text('price_per_unit'),
  total_cost: text('total_cost'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
}, (table) => [
  index('idx_fuel_logs_vehicle_date').on(table.vehicle_id, table.filled_at),
]);

export const accountTypeOverrides = sqliteTable('account_type_overrides', {
  account_id: text('account_id').references(() => accounts.id).notNull(),
  type_id: text('type_id').references(() => maintenanceTypes.id).notNull(),
  interval_miles: integer('interval_miles'),
  interval_months: integer('interval_months'),
}, (table) => [
  primaryKey({ columns: [table.account_id, table.type_id] }),
]);

export const accountDisabledTypes = sqliteTable('account_disabled_types', {
  account_id: text('account_id').references(() => accounts.id).notNull(),
  type_id: text('type_id').references(() => maintenanceTypes.id).notNull(),
}, (table) => [
  primaryKey({ columns: [table.account_id, table.type_id] }),
]);

export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  maintenance_log_id: text('maintenance_log_id').references(() => maintenanceLogs.id).notNull(),
  r2_key: text('r2_key').notNull(),
  r2_url: text('r2_url').notNull(),
  file_name: text('file_name'),
  file_type: text('file_type'),
  uploaded_at: text('uploaded_at').notNull(),
}, (table) => [
  index('idx_receipts_log_id').on(table.maintenance_log_id),
]);

export const mileageLogs = sqliteTable('mileage_logs', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').references(() => vehicles.id).notNull(),
  logged_at: text('logged_at').notNull(),
  mileage: integer('mileage').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
}, (table) => [
  index('idx_mileage_logs_vehicle_date').on(table.vehicle_id, table.logged_at),
]);

export const fuelReceipts = sqliteTable('fuel_receipts', {
  id: text('id').primaryKey(),
  fuel_log_id: text('fuel_log_id').references(() => fuelLogs.id).notNull(),
  r2_key: text('r2_key').notNull(),
  r2_url: text('r2_url').notNull(),
  file_name: text('file_name'),
  file_type: text('file_type'),
  uploaded_at: text('uploaded_at').notNull(),
}, (table) => [
  index('idx_fuel_receipts_log_id').on(table.fuel_log_id),
]);

export const accountSettings = sqliteTable('account_settings', {
  account_id: text('account_id').primaryKey().references(() => accounts.id),
  odometer_model: text('odometer_model').notNull().default('moondream'),
  receipt_model: text('receipt_model').notNull().default('gemini-2.5-flash'),
  moondream_api_key: text('moondream_api_key'),
  gemini_api_key: text('gemini_api_key'),
  openrouter_api_key: text('openrouter_api_key'),
  compress_before_scan: integer('compress_before_scan', { mode: 'boolean' }).notNull().default(false),
  compress_odometer_before_scan: integer('compress_odometer_before_scan', { mode: 'boolean' }).notNull().default(false),
  compress_receipt_before_scan: integer('compress_receipt_before_scan', { mode: 'boolean' }).notNull().default(false),
});

export const scanEngines = sqliteTable('scan_engines', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  name: text('name').notNull(),
  provider: text('provider').notNull(), // 'openrouter' | 'gemini' | 'moondream' | 'custom'
  model_id: text('model_id'),
  api_key: text('api_key'),
  base_url: text('base_url'),
  created_at: text('created_at').notNull(),
}, (table) => [
  index('idx_scan_engines_account_id').on(table.account_id),
]);
