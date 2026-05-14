import { eq, and, desc, isNull, or, notInArray, inArray, max } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db, rawClient, runMigrations } from './db/index';
import { accounts, vehicles, maintenanceTypes, maintenanceLogs, receipts, fuelLogs, fuelReceipts, mileageLogs, accountDisabledTypes, accountTypeOverrides, accountSettings, scanEngines } from './db/schema';
import { getNow } from './dates';
import { nanoid } from 'nanoid';

// ---- INIT & SEED ----

export async function initDb() {
  console.log('[Database] Running migrations...');
  await runMigrations();
  console.log('[Database] Migrations complete.');

  // Belt-and-suspenders: if the migration was already recorded but never
  // actually executed (e.g. a crashed deploy), add the column directly.
  try { rawClient.exec('ALTER TABLE fuel_logs ADD COLUMN total_cost TEXT'); } catch { /* already exists */ }

  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    await seedMaintenanceTypes();
  }
}

const SEED_TYPES = [
  // ENGINE
  { name: 'Oil & Filter Change', category: 'engine', miles: 5000, months: 6 },
  { name: 'Engine Air Filter', category: 'engine', miles: 30000, months: 24 },
  { name: 'PCV Valve', category: 'engine', miles: 60000, months: 48 },
  { name: 'Spark Plugs', category: 'engine', miles: 60000, months: 48 },
  { name: 'Coolant Flush', category: 'engine', miles: 100000, months: 60 },
  { name: 'Timing Belt Inspection', category: 'engine', miles: 60000, months: 48 },
  // TRANSMISSION
  { name: 'Transmission Fluid', category: 'transmission', miles: 60000, months: 48 },
  { name: 'Transfer Case Fluid', category: 'transmission', miles: 60000, months: 48 },
  { name: 'Differential Fluid', category: 'transmission', miles: 60000, months: 48 },
  // BRAKES
  { name: 'Brake Fluid', category: 'brakes', miles: 45000, months: 36 },
  { name: 'Brake Pads (Front)', category: 'brakes', miles: 40000, months: null },
  { name: 'Brake Pads (Rear)', category: 'brakes', miles: 50000, months: null },
  { name: 'Rotor Inspection', category: 'brakes', miles: 40000, months: null },
  // TIRES
  { name: 'Tire Rotation', category: 'tires', miles: 7500, months: 6 },
  { name: 'Tire Pressure Check', category: 'tires', miles: 3000, months: 3 },
  { name: 'Wheel Alignment', category: 'tires', miles: 30000, months: 24 },
  { name: 'Wheel Balancing', category: 'tires', miles: 15000, months: 12 },
  // FLUIDS
  { name: 'Power Steering Fluid', category: 'fluids', miles: 50000, months: 36 },
  { name: 'Windshield Washer Fluid', category: 'fluids', miles: null, months: null },
  // FILTERS
  { name: 'Cabin Air Filter', category: 'filters', miles: 20000, months: 12 },
  { name: 'Fuel Filter', category: 'filters', miles: 40000, months: 24 },
  // BELTS
  { name: 'Serpentine Belt', category: 'belts', miles: 80000, months: 60 },
  { name: 'Timing Belt Replacement', category: 'belts', miles: 100000, months: 84 },
  // ELECTRICAL
  { name: 'Battery', category: 'electrical', miles: null, months: 48 },
  { name: 'Wiper Blades', category: 'electrical', miles: null, months: 12 },
] as const;

async function seedMaintenanceTypes() {
  const existing = await db.select({ id: maintenanceTypes.id })
    .from(maintenanceTypes)
    .where(eq(maintenanceTypes.is_default, true))
    .limit(1);

  if (existing.length > 0) return;

  console.log('[Database] Seeding maintenance types...');
  await db.insert(maintenanceTypes).values(
    SEED_TYPES.map((t) => ({
      id: nanoid(),
      name: t.name,
      category: t.category,
      default_interval_miles: t.miles ?? null,
      default_interval_months: t.months ?? null,
      is_default: true,
      account_id: null,
    }))
  );
  console.log(`[Database] Seeded ${SEED_TYPES.length} maintenance types.`);
}

// ---- ACCOUNTS ----

export async function createAccount(data: { name: string; email: string; passwordHash: string }) {
  const now = getNow();
  const [account] = await db.insert(accounts).values({
    id: nanoid(),
    name: data.name,
    email: data.email.toLowerCase(),
    password_hash: data.passwordHash,
    created_at: now,
  }).returning();
  return account;
}

export async function getAccountByEmail(email: string) {
  const [account] = await db.select()
    .from(accounts)
    .where(eq(accounts.email, email.toLowerCase()))
    .limit(1);
  return account ?? null;
}

export async function getAccountById(id: string) {
  const [account] = await db.select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  return account ?? null;
}

export async function updateAccount(id: string, data: { name?: string }) {
  const [account] = await db.update(accounts)
    .set(data)
    .where(eq(accounts.id, id))
    .returning();
  return account;
}

// ---- VEHICLES ----

export async function createVehicle(data: {
  account_id: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  license_plate?: string | null;
  units: string;
  current_mileage?: number | null;
  qr_slug: string;
  qr_pin_hash: string;
}) {
  const now = getNow();
  const [vehicle] = await db.insert(vehicles).values({
    id: nanoid(),
    ...data,
    created_at: now,
    updated_at: now,
  }).returning();
  return vehicle;
}

export async function getVehiclesByAccountId(accountId: string) {
  return db.select().from(vehicles).where(eq(vehicles.account_id, accountId));
}

export async function getVehicleById(id: string, accountId: string) {
  const [vehicle] = await db.select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.account_id, accountId)))
    .limit(1);
  return vehicle ?? null;
}

export async function getVehicleByQrSlug(slug: string) {
  const [vehicle] = await db.select()
    .from(vehicles)
    .where(eq(vehicles.qr_slug, slug))
    .limit(1);
  return vehicle ?? null;
}

export async function updateVehicle(id: string, accountId: string, data: Partial<{
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  license_plate: string | null;
  units: string;
  current_mileage: number | null;
  qr_pin_hash: string;
}>) {
  const [vehicle] = await db.update(vehicles)
    .set({ ...data, updated_at: getNow() })
    .where(and(eq(vehicles.id, id), eq(vehicles.account_id, accountId)))
    .returning();
  return vehicle ?? null;
}

export async function deleteVehicle(id: string, accountId: string) {
  await db.delete(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.account_id, accountId)));
}

// ---- MAINTENANCE TYPES ----

function applyOverrides<T extends { id: string; default_interval_miles: number | null; default_interval_months: number | null }>(
  types: T[],
  overrides: { type_id: string; interval_miles: number | null; interval_months: number | null }[]
): T[] {
  const map = new Map(overrides.map((o) => [o.type_id, o]));
  return types.map((t) => {
    const o = map.get(t.id);
    if (!o) return t;
    return {
      ...t,
      default_interval_miles: o.interval_miles ?? t.default_interval_miles,
      default_interval_months: o.interval_months ?? t.default_interval_months,
    };
  });
}

const getCachedDefaultTypes = unstable_cache(
  async () =>
    db.select().from(maintenanceTypes).where(isNull(maintenanceTypes.account_id)),
  ['default-maintenance-types'],
  { revalidate: 300 }
);

export async function getMaintenanceTypes(accountId: string) {
  const [disabled, overrides] = await Promise.all([
    db.select({ type_id: accountDisabledTypes.type_id })
      .from(accountDisabledTypes)
      .where(eq(accountDisabledTypes.account_id, accountId)),
    db.select().from(accountTypeOverrides).where(eq(accountTypeOverrides.account_id, accountId)),
  ]);
  const disabledIds = disabled.map((r) => r.type_id);

  const [defaultTypes, customTypes] = await Promise.all([
    getCachedDefaultTypes(),
    db.select().from(maintenanceTypes).where(eq(maintenanceTypes.account_id, accountId)),
  ]);

  const allTypes = [...defaultTypes, ...customTypes].filter(
    (t) => !disabledIds.includes(t.id)
  );

  return applyOverrides(allTypes, overrides);
}

export async function getMaintenanceTypesAll(accountId: string) {
  const [types, overrides] = await Promise.all([
    db.select().from(maintenanceTypes)
      .where(or(isNull(maintenanceTypes.account_id), eq(maintenanceTypes.account_id, accountId))!),
    db.select().from(accountTypeOverrides).where(eq(accountTypeOverrides.account_id, accountId)),
  ]);
  return applyOverrides(types, overrides);
}

export async function getDisabledTypeIds(accountId: string): Promise<string[]> {
  const rows = await db.select({ type_id: accountDisabledTypes.type_id })
    .from(accountDisabledTypes)
    .where(eq(accountDisabledTypes.account_id, accountId));
  return rows.map((r) => r.type_id);
}

export async function getTypeOverrides(accountId: string) {
  const rows = await db.select().from(accountTypeOverrides).where(eq(accountTypeOverrides.account_id, accountId));
  return new Map(rows.map((r) => [r.type_id, { miles: r.interval_miles, months: r.interval_months }]));
}

export async function upsertTypeOverride(accountId: string, typeId: string, intervalMiles: number | null, intervalMonths: number | null) {
  await db.insert(accountTypeOverrides)
    .values({ account_id: accountId, type_id: typeId, interval_miles: intervalMiles, interval_months: intervalMonths })
    .onConflictDoUpdate({
      target: [accountTypeOverrides.account_id, accountTypeOverrides.type_id],
      set: { interval_miles: intervalMiles, interval_months: intervalMonths },
    });
}

export async function disableMaintenanceType(accountId: string, typeId: string) {
  await db.insert(accountDisabledTypes)
    .values({ account_id: accountId, type_id: typeId })
    .onConflictDoNothing();
}

export async function enableMaintenanceType(accountId: string, typeId: string) {
  await db.delete(accountDisabledTypes)
    .where(and(eq(accountDisabledTypes.account_id, accountId), eq(accountDisabledTypes.type_id, typeId)));
}

export async function createMaintenanceType(data: {
  name: string;
  category: string;
  default_interval_miles?: number | null;
  default_interval_months?: number | null;
  account_id: string;
}) {
  const [type] = await db.insert(maintenanceTypes).values({
    id: nanoid(),
    ...data,
    is_default: false,
  }).returning();
  return type;
}

export async function updateMaintenanceType(id: string, accountId: string, data: Partial<{
  name: string;
  category: string;
  default_interval_miles: number | null;
  default_interval_months: number | null;
}>) {
  const [type] = await db.update(maintenanceTypes)
    .set(data)
    .where(and(eq(maintenanceTypes.id, id), eq(maintenanceTypes.account_id, accountId)))
    .returning();
  return type ?? null;
}

export async function deleteMaintenanceType(id: string, accountId: string) {
  await db.delete(maintenanceTypes)
    .where(and(eq(maintenanceTypes.id, id), eq(maintenanceTypes.account_id, accountId)));
}

// ---- MAINTENANCE LOGS ----

export async function createMaintenanceLog(data: {
  vehicle_id: string;
  maintenance_type_id: string;
  serviced_at: string;
  mileage_at_service: number;
  next_due_mileage?: number | null;
  next_due_date?: string | null;
  price_paid?: string | null;
  shop?: string | null;
  notes?: string | null;
}) {
  const now = getNow();
  const [log] = await db.insert(maintenanceLogs).values({
    id: nanoid(),
    ...data,
    created_at: now,
    updated_at: now,
  }).returning();
  return log;
}

export async function getMaintenanceLogsByVehicleId(vehicleId: string) {
  return db.select()
    .from(maintenanceLogs)
    .where(eq(maintenanceLogs.vehicle_id, vehicleId))
    .orderBy(desc(maintenanceLogs.serviced_at));
}

export async function getMaintenanceLogById(id: string) {
  const [log] = await db.select()
    .from(maintenanceLogs)
    .where(eq(maintenanceLogs.id, id))
    .limit(1);
  return log ?? null;
}

export async function getLatestLogByType(vehicleId: string, maintenanceTypeId: string) {
  const [log] = await db.select()
    .from(maintenanceLogs)
    .where(and(
      eq(maintenanceLogs.vehicle_id, vehicleId),
      eq(maintenanceLogs.maintenance_type_id, maintenanceTypeId)
    ))
    .orderBy(desc(maintenanceLogs.serviced_at))
    .limit(1);
  return log ?? null;
}

export async function updateMaintenanceLog(id: string, data: Partial<{
  serviced_at: string;
  mileage_at_service: number;
  next_due_mileage: number | null;
  next_due_date: string | null;
  price_paid: string | null;
  shop: string | null;
  notes: string | null;
}>) {
  const [log] = await db.update(maintenanceLogs)
    .set({ ...data, updated_at: getNow() })
    .where(eq(maintenanceLogs.id, id))
    .returning();
  return log ?? null;
}

export async function deleteMaintenanceLog(id: string) {
  await db.delete(maintenanceLogs).where(eq(maintenanceLogs.id, id));
}

// ---- RECEIPTS ----

export async function createReceipt(data: {
  maintenance_log_id: string;
  r2_key: string;
  r2_url: string;
  file_name?: string | null;
  file_type?: string | null;
}) {
  const [receipt] = await db.insert(receipts).values({
    id: nanoid(),
    ...data,
    uploaded_at: getNow(),
  }).returning();
  return receipt;
}

export async function getReceiptsByLogId(logId: string) {
  return db.select()
    .from(receipts)
    .where(eq(receipts.maintenance_log_id, logId));
}

export async function getReceiptById(id: string) {
  const [receipt] = await db.select()
    .from(receipts)
    .where(eq(receipts.id, id))
    .limit(1);
  return receipt ?? null;
}

export async function deleteReceipt(id: string) {
  const receipt = await getReceiptById(id);
  await db.delete(receipts).where(eq(receipts.id, id));
  return receipt;
}

// Delete all receipts for a log in one query; returns r2_keys for caller to clean up R2.
export async function deleteReceiptsByLogId(logId: string): Promise<string[]> {
  const rows = await db.select({ r2_key: receipts.r2_key })
    .from(receipts)
    .where(eq(receipts.maintenance_log_id, logId));
  if (rows.length > 0) {
    await db.delete(receipts).where(eq(receipts.maintenance_log_id, logId));
  }
  return rows.map((r) => r.r2_key);
}

// ---- FUEL LOGS ----

export async function createFuelLog(data: {
  vehicle_id: string;
  filled_at: string;
  mileage: number;
  fuel_quantity: number;
  fuel_unit: string;
  price_per_unit?: string | null;
  total_cost?: string | null;
  notes?: string | null;
}) {
  const [log] = await db.insert(fuelLogs).values({
    id: nanoid(),
    ...data,
    created_at: getNow(),
  }).returning();
  return log;
}

export async function getFuelLogsByVehicleId(vehicleId: string) {
  return db.select()
    .from(fuelLogs)
    .where(eq(fuelLogs.vehicle_id, vehicleId))
    .orderBy(desc(fuelLogs.filled_at));
}

export async function getFuelLogById(id: string) {
  const [log] = await db.select()
    .from(fuelLogs)
    .where(eq(fuelLogs.id, id))
    .limit(1);
  return log ?? null;
}

export async function deleteFuelLog(id: string) {
  await db.delete(fuelLogs).where(eq(fuelLogs.id, id));
}

// ---- PUBLIC QR DATA ----

export async function getPublicVehicleData(qrSlug: string) {
  const vehicle = await getVehicleByQrSlug(qrSlug);
  if (!vehicle) return null;

  const types = await getMaintenanceTypes(vehicle.account_id);
  const logs = await getMaintenanceLogsByVehicleId(vehicle.id);

  return { vehicle, maintenanceTypes: types, logs };
}

export async function getMaintenanceLogCountsByVehicleIds(
  vehicleIds: string[]
): Promise<Map<string, Map<string, string>>> {
  if (vehicleIds.length === 0) return new Map();

  const rows = await db
    .select({
      vehicle_id: maintenanceLogs.vehicle_id,
      maintenance_type_id: maintenanceLogs.maintenance_type_id,
      serviced_at: maintenanceLogs.serviced_at,
    })
    .from(maintenanceLogs)
    .where(inArray(maintenanceLogs.vehicle_id, vehicleIds));

  // Build map: vehicleId -> (typeId -> latest serviced_at)
  const result = new Map<string, Map<string, string>>();
  for (const row of rows) {
    let typeMap = result.get(row.vehicle_id);
    if (!typeMap) {
      typeMap = new Map();
      result.set(row.vehicle_id, typeMap);
    }
    const existing = typeMap.get(row.maintenance_type_id);
    if (!existing || row.serviced_at > existing) {
      typeMap.set(row.maintenance_type_id, row.serviced_at);
    }
  }
  return result;
}

export async function getMaxLogMileageByVehicleIds(
  vehicleIds: string[]
): Promise<Map<string, number>> {
  if (vehicleIds.length === 0) return new Map();

  const [serviceMileage, fuelMileage, odMileage] = await Promise.all([
    db
      .select({ vehicle_id: maintenanceLogs.vehicle_id, max_mileage: max(maintenanceLogs.mileage_at_service) })
      .from(maintenanceLogs)
      .where(inArray(maintenanceLogs.vehicle_id, vehicleIds))
      .groupBy(maintenanceLogs.vehicle_id),
    db
      .select({ vehicle_id: fuelLogs.vehicle_id, max_mileage: max(fuelLogs.mileage) })
      .from(fuelLogs)
      .where(inArray(fuelLogs.vehicle_id, vehicleIds))
      .groupBy(fuelLogs.vehicle_id),
    db
      .select({ vehicle_id: mileageLogs.vehicle_id, max_mileage: max(mileageLogs.mileage) })
      .from(mileageLogs)
      .where(inArray(mileageLogs.vehicle_id, vehicleIds))
      .groupBy(mileageLogs.vehicle_id),
  ]);

  const result = new Map<string, number>();
  for (const { vehicle_id, max_mileage } of [...serviceMileage, ...fuelMileage, ...odMileage]) {
    if (max_mileage == null) continue;
    const existing = result.get(vehicle_id) ?? 0;
    if (max_mileage > existing) result.set(vehicle_id, max_mileage);
  }
  return result;
}

// ---- MILEAGE LOGS ----

export async function createMileageLog(data: {
  vehicle_id: string;
  logged_at: string;
  mileage: number;
  notes?: string | null;
}) {
  const [log] = await db.insert(mileageLogs).values({
    id: nanoid(),
    ...data,
    created_at: getNow(),
  }).returning();
  return log;
}

export async function getMileageLogsByVehicleId(vehicleId: string) {
  return db.select()
    .from(mileageLogs)
    .where(eq(mileageLogs.vehicle_id, vehicleId))
    .orderBy(desc(mileageLogs.logged_at));
}

export async function getMileageLogById(id: string) {
  const [log] = await db.select()
    .from(mileageLogs)
    .where(eq(mileageLogs.id, id))
    .limit(1);
  return log ?? null;
}

export async function deleteMileageLog(id: string) {
  await db.delete(mileageLogs).where(eq(mileageLogs.id, id));
}

// ---- FUEL RECEIPTS ----

export async function createFuelReceipt(data: {
  fuel_log_id: string;
  r2_key: string;
  r2_url: string;
  file_name?: string | null;
  file_type?: string | null;
}) {
  const [receipt] = await db.insert(fuelReceipts).values({
    id: nanoid(),
    ...data,
    uploaded_at: getNow(),
  }).returning();
  return receipt;
}

export async function getFuelReceiptsByLogId(logId: string) {
  return db.select().from(fuelReceipts).where(eq(fuelReceipts.fuel_log_id, logId));
}

export async function getFuelReceiptsByVehicleId(vehicleId: string) {
  return db
    .select({ receipt: fuelReceipts, fuelLogId: fuelLogs.id })
    .from(fuelReceipts)
    .innerJoin(fuelLogs, eq(fuelReceipts.fuel_log_id, fuelLogs.id))
    .where(eq(fuelLogs.vehicle_id, vehicleId));
}

export async function deleteFuelReceipt(id: string) {
  const [receipt] = await db.select().from(fuelReceipts).where(eq(fuelReceipts.id, id)).limit(1);
  if (!receipt) return null;
  await db.delete(fuelReceipts).where(eq(fuelReceipts.id, id));
  return receipt;
}

// ---- ACCOUNT SETTINGS ----

export async function getAccountScanSettings(accountId: string) {
  const [row] = await db.select()
    .from(accountSettings)
    .where(eq(accountSettings.account_id, accountId))
    .limit(1);
  return row ?? { odometer_model: 'moondream', receipt_model: 'gemini-2.5-flash', compress_before_scan: false, compress_odometer_before_scan: false, compress_receipt_before_scan: false };
}

export async function upsertAccountScanSettings(accountId: string, data: { odometer_model: string; receipt_model: string; compress_before_scan?: boolean; compress_odometer_before_scan?: boolean; compress_receipt_before_scan?: boolean }) {
  await db.insert(accountSettings)
    .values({ account_id: accountId, ...data })
    .onConflictDoUpdate({ target: accountSettings.account_id, set: data });
}

export async function upsertAccountApiKeys(accountId: string, data: { moondream_api_key?: string; gemini_api_key?: string; openrouter_api_key?: string }) {
  await db.insert(accountSettings)
    .values({ account_id: accountId, odometer_model: 'moondream', receipt_model: 'gemini-2.5-flash', ...data })
    .onConflictDoUpdate({ target: accountSettings.account_id, set: data });
}

// ---- SCAN ENGINES ----

export type ScanEngineRow = typeof scanEngines.$inferSelect;

export async function getScanEngines(accountId: string): Promise<ScanEngineRow[]> {
  return db.select().from(scanEngines).where(eq(scanEngines.account_id, accountId));
}

export async function getScanEngineById(id: string, accountId: string): Promise<ScanEngineRow | null> {
  const [row] = await db.select().from(scanEngines)
    .where(and(eq(scanEngines.id, id), eq(scanEngines.account_id, accountId)))
    .limit(1);
  return row ?? null;
}

export async function createScanEngine(accountId: string, data: {
  name: string; provider: string; model_id?: string | null; api_key?: string | null; base_url?: string | null;
}): Promise<ScanEngineRow> {
  const [row] = await db.insert(scanEngines).values({
    id: nanoid(),
    account_id: accountId,
    name: data.name,
    provider: data.provider,
    model_id: data.model_id ?? null,
    api_key: data.api_key ?? null,
    base_url: data.base_url ?? null,
    created_at: getNow(),
  }).returning();
  return row;
}

export async function updateScanEngine(id: string, accountId: string, data: {
  name: string; provider: string; model_id?: string | null; api_key?: string | null; base_url?: string | null;
}): Promise<ScanEngineRow | null> {
  const [row] = await db.update(scanEngines)
    .set({ name: data.name, provider: data.provider, model_id: data.model_id ?? null, api_key: data.api_key ?? null, base_url: data.base_url ?? null })
    .where(and(eq(scanEngines.id, id), eq(scanEngines.account_id, accountId)))
    .returning();
  return row ?? null;
}

export async function deleteScanEngine(id: string, accountId: string) {
  await db.delete(scanEngines).where(and(eq(scanEngines.id, id), eq(scanEngines.account_id, accountId)));
}
