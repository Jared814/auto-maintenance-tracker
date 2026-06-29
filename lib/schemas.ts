import { z } from 'zod';

// Shared Zod schemas — safe to import in client components (no Node.js deps)

export const CreateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const CreateVehicleSchema = z.object({
  name: z.string().min(1, 'Vehicle name is required'),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().int().min(1886).max(2100).optional().nullable(),
  vin: z.string().optional().nullable(),
  license_plate: z.string().optional().nullable(),
  units: z.enum(['miles', 'km']).default('miles'),
  current_mileage: z.number().int().min(0).optional().nullable(),
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(8).regex(/^\d+$/, 'PIN must be digits only'),
});

export const UpdateVehicleSchema = z.object({
  name: z.string().min(1).optional(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().int().min(1886).max(2100).optional().nullable(),
  vin: z.string().optional().nullable(),
  license_plate: z.string().optional().nullable(),
  units: z.enum(['miles', 'km']).optional(),
  current_mileage: z.number().int().min(0).optional().nullable(),
  pin: z.string().min(4).max(8).regex(/^\d+$/).optional(),
});

export const CreateMaintenanceLogSchema = z.object({
  vehicle_id: z.string().min(1),
  maintenance_type_id: z.string().min(1),
  serviced_at: z.string().min(1, 'Service date is required'),
  mileage_at_service: z.number().int().min(0),
  next_due_mileage: z.number().int().min(0).optional().nullable(),
  next_due_date: z.string().optional().nullable(),
  price_paid: z.string().optional().nullable(),
  shop: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateMaintenanceLogSchema = z.object({
  maintenance_type_id: z.string().min(1).optional(),
  serviced_at: z.string().min(1).optional(),
  mileage_at_service: z.number().int().min(0).optional(),
  next_due_mileage: z.number().int().min(0).optional().nullable(),
  next_due_date: z.string().optional().nullable(),
  price_paid: z.string().optional().nullable(),
  shop: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const CreateMaintenanceTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['engine', 'transmission', 'brakes', 'tires', 'fluids', 'filters', 'belts', 'electrical', 'other']),
  default_interval_miles: z.number().int().min(0).optional().nullable(),
  default_interval_months: z.number().int().min(0).optional().nullable(),
});

export const CreateFuelLogSchema = z.object({
  vehicle_id: z.string().min(1),
  filled_at: z.string().min(1, 'Date is required'),
  mileage: z.number().int().min(0, 'Mileage is required'),
  fuel_quantity: z.number().positive('Fuel quantity must be positive'),
  fuel_unit: z.enum(['gallons', 'liters']).default('gallons'),
  price_per_unit: z.string().optional().nullable(),
  total_cost: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const CreateMileageLogSchema = z.object({
  vehicle_id: z.string().min(1),
  logged_at: z.string().min(1, 'Date is required'),
  mileage: z.number().int().min(0, 'Mileage is required'),
  notes: z.string().optional().nullable(),
});

export const CreateReceiptSchema = z.object({
  maintenance_log_id: z.string().min(1),
  r2_key: z.string().min(1),
  r2_url: z.string().url(),
  file_name: z.string().optional().nullable(),
  file_type: z.string().optional().nullable(),
});

export type CreateAccount = z.infer<typeof CreateAccountSchema>;
export type CreateVehicle = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicle = z.infer<typeof UpdateVehicleSchema>;
export type CreateMaintenanceLog = z.infer<typeof CreateMaintenanceLogSchema>;
export type UpdateMaintenanceLog = z.infer<typeof UpdateMaintenanceLogSchema>;
export type CreateMaintenanceType = z.infer<typeof CreateMaintenanceTypeSchema>;
export type CreateFuelLog = z.infer<typeof CreateFuelLogSchema>;
export type CreateMileageLog = z.infer<typeof CreateMileageLogSchema>;
export type CreateReceipt = z.infer<typeof CreateReceiptSchema>;
