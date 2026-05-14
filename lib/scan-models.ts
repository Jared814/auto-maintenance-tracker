export type ScanModelId =
  | 'moondream'
  | 'gemini-2.5-flash'
  | 'openrouter/baidu/qianfan-ocr-fast';

export type ScanModel = {
  id: ScanModelId;
  label: string;
  description: string;
  envKey: string;
};

export const SCAN_MODELS: ScanModel[] = [
  {
    id: 'moondream',
    label: 'Moondream',
    description: 'Fast, lightweight — good for simple odometer images',
    envKey: 'MOONDREAM_API_KEY',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Strong OCR — handles complex receipt layouts well',
    envKey: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'openrouter/baidu/qianfan-ocr-fast',
    label: 'Qianfan OCR Fast (Baidu via OpenRouter)',
    description: 'Specialized OCR model via OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
  },
];

export const DEFAULT_ODOMETER_MODEL: ScanModelId = 'moondream';
export const DEFAULT_RECEIPT_MODEL: ScanModelId = 'gemini-2.5-flash';
