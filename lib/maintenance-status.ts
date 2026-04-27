import { addMonths } from './dates';

export type MaintenanceStatus = 'OK' | 'DUE_SOON' | 'OVERDUE' | 'NEVER_SERVICED' | 'UNKNOWN';

export interface MaintenanceStatusResult {
  status: MaintenanceStatus;
  lastServiceDate?: string;
  lastServiceMileage?: number;
  nextDueMileage?: number;
  nextDueDate?: string;
}

const DUE_SOON_MILES = 500;
const DUE_SOON_DAYS = 30;

export function calculateMaintenanceStatus(
  log: {
    serviced_at: string;
    mileage_at_service: number;
    next_due_mileage?: number | null;
    next_due_date?: string | null;
  } | null,
  maintenanceType: {
    default_interval_miles?: number | null;
    default_interval_months?: number | null;
  },
  currentMileage?: number | null
): MaintenanceStatusResult {
  if (!log) return { status: 'NEVER_SERVICED' };

  const nextDueMileage =
    log.next_due_mileage ??
    (maintenanceType.default_interval_miles
      ? log.mileage_at_service + maintenanceType.default_interval_miles
      : null);

  const nextDueDate =
    log.next_due_date ??
    (maintenanceType.default_interval_months
      ? addMonths(log.serviced_at, maintenanceType.default_interval_months)
      : null);

  if (!nextDueMileage && !nextDueDate) {
    return {
      status: 'UNKNOWN',
      lastServiceDate: log.serviced_at,
      lastServiceMileage: log.mileage_at_service,
    };
  }

  const today = new Date();
  let isOverdue = false;
  let isDueSoon = false;

  if (nextDueMileage != null && currentMileage != null) {
    if (currentMileage >= nextDueMileage) isOverdue = true;
    else if (nextDueMileage - currentMileage <= DUE_SOON_MILES) isDueSoon = true;
  }

  if (nextDueDate) {
    const dueDate = new Date(nextDueDate);
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue < 0) isOverdue = true;
    else if (daysUntilDue <= DUE_SOON_DAYS) isDueSoon = true;
  }

  return {
    status: isOverdue ? 'OVERDUE' : isDueSoon ? 'DUE_SOON' : 'OK',
    lastServiceDate: log.serviced_at,
    lastServiceMileage: log.mileage_at_service,
    nextDueMileage: nextDueMileage ?? undefined,
    nextDueDate: nextDueDate ?? undefined,
  };
}

export function statusBadgeClass(status: MaintenanceStatus): string {
  switch (status) {
    case 'OVERDUE':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'DUE_SOON':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'OK':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'NEVER_SERVICED':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'UNKNOWN':
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function statusLabel(status: MaintenanceStatus): string {
  switch (status) {
    case 'OVERDUE':    return 'OVERDUE';
    case 'DUE_SOON':   return 'DUE SOON';
    case 'OK':         return 'OK';
    case 'NEVER_SERVICED': return 'NEVER SERVICED';
    case 'UNKNOWN':    return 'UNKNOWN';
  }
}
