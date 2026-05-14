'use server';

import { auth } from '@/auth';
import { upsertAccountScanSettings } from '@/lib/db';
import { SCAN_MODELS, DEFAULT_ODOMETER_MODEL, DEFAULT_RECEIPT_MODEL } from '@/lib/scan-models';
import type { ScanModelId } from '@/lib/scan-models';

const VALID_MODEL_IDS = new Set<string>(SCAN_MODELS.map((m) => m.id));

export async function saveScanSettingsAction(_prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const odometer = formData.get('odometer_model') as string;
  const receipt = formData.get('receipt_model') as string;

  if (!VALID_MODEL_IDS.has(odometer) || !VALID_MODEL_IDS.has(receipt)) {
    return { error: 'Invalid model selection' };
  }

  await upsertAccountScanSettings(session.user.id, {
    odometer_model: (VALID_MODEL_IDS.has(odometer) ? odometer : DEFAULT_ODOMETER_MODEL) as ScanModelId,
    receipt_model: (VALID_MODEL_IDS.has(receipt) ? receipt : DEFAULT_RECEIPT_MODEL) as ScanModelId,
  });

  return { success: true };
}
