import type * as PgSchema from './schema.pg';

// Load the correct schema at runtime based on which dialect is active.
// Type-asserted as PG schema since both dialects export identically-named
// symbols with compatible column shapes for query building.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = (
  process.env.DATABASE_URL
    ? require('./schema.pg')
    : require('./schema.sqlite')
) as typeof PgSchema;

export const accounts = mod.accounts;
export const vehicles = mod.vehicles;
export const maintenanceTypes = mod.maintenanceTypes;
export const maintenanceLogs = mod.maintenanceLogs;
export const fuelLogs = mod.fuelLogs;
export const accountTypeOverrides = mod.accountTypeOverrides;
export const accountDisabledTypes = mod.accountDisabledTypes;
export const receipts = mod.receipts;
export const fuelReceipts = mod.fuelReceipts;
