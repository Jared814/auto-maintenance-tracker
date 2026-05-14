export type BuiltinModelId = 'moondream' | 'gemini-2.5-flash';

export type ScanModel = {
  id: BuiltinModelId;
  label: string;
  description: string;
};

export const BUILTIN_MODELS: ScanModel[] = [
  {
    id: 'moondream',
    label: 'Moondream',
    description: 'Fast, lightweight — good for simple odometer images',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Strong OCR — handles complex receipt layouts well',
  },
];

export const BUILTIN_MODEL_IDS = new Set<string>(BUILTIN_MODELS.map((m) => m.id));

export const PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'moondream', label: 'Moondream' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)' },
] as const;

export type ProviderId = typeof PROVIDERS[number]['id'];

export const DEFAULT_ODOMETER_MODEL = 'moondream';
export const DEFAULT_RECEIPT_MODEL = 'gemini-2.5-flash';
