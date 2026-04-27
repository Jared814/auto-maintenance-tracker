import { eq, and, desc, isNull, or } from 'drizzle-orm';
import { db, runMigrations } from './db/index';
import { accounts, vehicles, maintenanceTypes, maintenanceLogs, receipts } from './db/schema';
import { getNow } from './dates';
import { nanoid } from 'nanoid';

// ---- INIT & SEED ----

export async function initDb() {
  console.log('[Database] Running migrations...');
  await runMigrations();
  console.log('[Database] Migrations complete.');

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

export async function getMaintenanceTypes(accountId: string) {
  return db.select()
    .from(maintenanceTypes)
    .where(or(isNull(maintenanceTypes.account_id), eq(maintenanceTypes.account_id, accountId)));
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

// ---- PUBLIC QR DATA ----

export async function getPublicVehicleData(qrSlug: string) {
  const vehicle = await getVehicleByQrSlug(qrSlug);
  if (!vehicle) return null;

  const types = await getMaintenanceTypes(vehicle.account_id);
  const logs = await getMaintenanceLogsByVehicleId(vehicle.id);

  return { vehicle, maintenanceTypes: types, logs };
}
