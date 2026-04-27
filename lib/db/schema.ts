import { pgTable, text, boolean, integer, real, index, primaryKey } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull(),
});

export const vehicles = pgTable('vehicles', {
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
}, (table) => [
  index('idx_vehicles_account_id').on(table.account_id),
  index('idx_vehicles_qr_slug').on(table.qr_slug),
]);

export const maintenanceTypes = pgTable('maintenance_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  default_interval_miles: integer('default_interval_miles'),
  default_interval_months: integer('default_interval_months'),
  is_default: boolean('is_default').notNull().default(false),
  account_id: text('account_id'),
}, (table) => [
  index('idx_maint_types_account_id').on(table.account_id),
]);

export const maintenanceLogs = pgTable('maintenance_logs', {
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

export const fuelLogs = pgTable('fuel_logs', {
  id: text('id').primaryKey(),
  vehicle_id: text('vehicle_id').references(() => vehicles.id).notNull(),
  filled_at: text('filled_at').notNull(),
  mileage: integer('mileage').notNull(),
  fuel_quantity: real('fuel_quantity').notNull(),
  fuel_unit: text('fuel_unit').notNull().default('gallons'),
  price_per_unit: text('price_per_unit'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
}, (table) => [
  index('idx_fuel_logs_vehicle_date').on(table.vehicle_id, table.filled_at),
]);

export const accountDisabledTypes = pgTable('account_disabled_types', {
  account_id: text('account_id').references(() => accounts.id).notNull(),
  type_id: text('type_id').references(() => maintenanceTypes.id).notNull(),
}, (table) => [
  primaryKey({ columns: [table.account_id, table.type_id] }),
]);

export const receipts = pgTable('receipts', {
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
