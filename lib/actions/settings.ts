'use server';

import { auth } from '@/auth';
import { upsertAccountScanSettings, upsertAccountApiKeys, createScanEngine, updateScanEngine, deleteScanEngine, getScanEngineById } from '@/lib/db';
import { BUILTIN_MODEL_IDS, DEFAULT_ODOMETER_MODEL, DEFAULT_RECEIPT_MODEL } from '@/lib/scan-models';

export async function saveScanSettingsAction(_prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const odometer = formData.get('odometer_model') as string;
  const receipt = formData.get('receipt_model') as string;

  await upsertAccountScanSettings(session.user.id, {
    odometer_model: odometer || DEFAULT_ODOMETER_MODEL,
    receipt_model: receipt || DEFAULT_RECEIPT_MODEL,
  });

  return { success: true };
}

export async function saveApiKeysAction(_prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const moondream = (formData.get('moondream_api_key') as string).trim();
  const gemini = (formData.get('gemini_api_key') as string).trim();
  const openrouter = (formData.get('openrouter_api_key') as string).trim();

  await upsertAccountApiKeys(session.user.id, {
    moondream_api_key: moondream || null,
    gemini_api_key: gemini || null,
    openrouter_api_key: openrouter || null,
  } as Record<string, string | null>);

  return { success: true };
}

const VALID_PROVIDERS = new Set(['openrouter', 'gemini', 'moondream', 'custom']);

export async function createScanEngineAction(_prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const name = (formData.get('name') as string).trim();
  const provider = (formData.get('provider') as string).trim();
  const model_id = (formData.get('model_id') as string | null)?.trim() || null;
  const api_key = (formData.get('api_key') as string | null)?.trim() || null;
  const base_url = (formData.get('base_url') as string | null)?.trim() || null;

  if (!name) return { error: 'Name is required' };
  if (!VALID_PROVIDERS.has(provider)) return { error: 'Invalid provider' };
  if (provider !== 'moondream' && !model_id) return { error: 'Model ID is required' };
  if (provider === 'custom' && !base_url) return { error: 'Base URL is required for custom provider' };

  await createScanEngine(session.user.id, { name, provider, model_id, api_key, base_url });
  return { success: true };
}

export async function updateScanEngineAction(_prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const id = (formData.get('id') as string).trim();
  const name = (formData.get('name') as string).trim();
  const provider = (formData.get('provider') as string).trim();
  const model_id = (formData.get('model_id') as string | null)?.trim() || null;
  const api_key = (formData.get('api_key') as string | null)?.trim() || null;
  const base_url = (formData.get('base_url') as string | null)?.trim() || null;

  if (!id) return { error: 'Missing engine ID' };
  if (!name) return { error: 'Name is required' };
  if (!VALID_PROVIDERS.has(provider)) return { error: 'Invalid provider' };
  if (provider !== 'moondream' && !model_id) return { error: 'Model ID is required' };
  if (provider === 'custom' && !base_url) return { error: 'Base URL is required for custom provider' };

  const existing = await getScanEngineById(id, session.user.id);
  if (!existing) return { error: 'Engine not found' };

  await updateScanEngine(id, session.user.id, { name, provider, model_id, api_key, base_url });
  return { success: true };
}

export async function deleteScanEngineAction(engineId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };
  await deleteScanEngine(engineId, session.user.id);
  return { success: true };
}
