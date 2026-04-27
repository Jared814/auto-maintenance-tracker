export const LITERS_PER_GALLON = 3.78541;

export type EconomyPoint = { date: string; value: number };

function toGallons(qty: number, unit: string): number {
  return unit === 'liters' ? qty / LITERS_PER_GALLON : qty;
}

function toLiters(qty: number, unit: string): number {
  return unit === 'gallons' ? qty * LITERS_PER_GALLON : qty;
}

/**
 * Given fillup logs, compute fuel economy for each fillup (starting from the 2nd).
 * vehicleUnits: 'miles' → MPG, 'km' → L/100km
 */
export function computeEconomy(
  logs: Array<{ filled_at: string; mileage: number; fuel_quantity: number; fuel_unit: string }>,
  vehicleUnits: string,
): EconomyPoint[] {
  const sorted = [...logs].sort((a, b) => a.filled_at.localeCompare(b.filled_at));
  const points: EconomyPoint[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const distance = curr.mileage - prev.mileage;
    if (distance <= 0) continue;

    if (vehicleUnits === 'miles') {
      const gallons = toGallons(curr.fuel_quantity, curr.fuel_unit);
      if (gallons <= 0) continue;
      points.push({ date: curr.filled_at, value: distance / gallons });
    } else {
      const liters = toLiters(curr.fuel_quantity, curr.fuel_unit);
      if (liters <= 0) continue;
      points.push({ date: curr.filled_at, value: (liters / distance) * 100 });
    }
  }

  return points;
}

export function avgEconomy(points: EconomyPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + p.value, 0) / points.length;
}
