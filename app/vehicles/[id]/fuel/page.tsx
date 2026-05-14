import { auth } from '@/auth';
import { getVehicleById, getFuelLogsByVehicleId, getFuelReceiptsByVehicleId, getMaxLogMileageByVehicleIds, getAccountScanSettings } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { FuelClient } from './fuel-client';

export const dynamic = 'force-dynamic';

export default async function FuelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const [vehicle, fuelLogs, allReceipts, maxLogMileage, scanSettings] = await Promise.all([
    getVehicleById(id, session.user.id),
    getFuelLogsByVehicleId(id),
    getFuelReceiptsByVehicleId(id),
    getMaxLogMileageByVehicleIds([id]),
    getAccountScanSettings(session.user.id),
  ]);

  if (!vehicle) notFound();

  // Group receipts by fuel log ID
  const receiptsByLogId: Record<string, { id: string; r2_url: string; file_name: string | null }[]> = {};
  for (const row of allReceipts) {
    if (!receiptsByLogId[row.fuelLogId]) receiptsByLogId[row.fuelLogId] = [];
    receiptsByLogId[row.fuelLogId].push({
      id: row.receipt.id,
      r2_url: row.receipt.r2_url,
      file_name: row.receipt.file_name,
    });
  }

  const effectiveMileage = Math.max(vehicle.current_mileage ?? 0, maxLogMileage.get(id) ?? 0) || null;

  const r2Configured = !!(process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_BUCKET_NAME);

  const s = scanSettings as { compress_odometer_before_scan?: boolean; compress_receipt_before_scan?: boolean };

  return <FuelClient vehicle={vehicle} initialLogs={fuelLogs} receiptsByLogId={receiptsByLogId} r2Configured={r2Configured} effectiveMileage={effectiveMileage} compressOdometerBeforeScan={!!s.compress_odometer_before_scan} compressReceiptBeforeScan={!!s.compress_receipt_before_scan} />;
}
