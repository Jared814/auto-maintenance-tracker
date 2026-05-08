import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';

const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

const ReceiptSchema = z.object({
  fuel_quantity: z.number().nullable(),
  fuel_unit: z.enum(['gallons', 'liters']).nullable(),
  price_per_unit: z.string().nullable(),
  total_cost: z.string().nullable(),
});

const OdometerSchema = z.object({
  mileage: z.number().nullable(),
});

const NULL_RECEIPT = { fuel_quantity: null, fuel_unit: null, price_per_unit: null, total_cost: null };
const NULL_ODOMETER = { mileage: null };

const RECEIPT_PROMPT = `Look at this fuel or gas station receipt or fuel pump display. Extract these fields and reply with ONLY a JSON object, no other text:
{"fuel_quantity": <number or null>, "fuel_unit": <"gallons" or "liters" or null>, "price_per_unit": <string like "3.499" or null>, "total_cost": <string like "43.21" or null>}

Rules:
- fuel_quantity: volume purchased as a number (e.g. 12.345)
- fuel_unit: "gallons" if receipt shows GAL/GALLONS, "liters" if L/LITRES
- price_per_unit: price per gallon/liter as a string without currency symbol
- total_cost: total fuel charge as a string without currency symbol
- Use null for any field not visible`;

const ODOMETER_PROMPT = `Look at this vehicle odometer or instrument cluster. Read the mileage and reply with ONLY a JSON object, no other text:
{"mileage": <integer or null>}

Rules:
- mileage: the odometer reading as a whole number (e.g. 65432)
- Use null if the mileage is not clearly visible`;

async function callMoondream(apiKey: string, imageUrl: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.moondream.ai/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Moondream-Auth': apiKey },
      body: JSON.stringify({ image_url: imageUrl, question: prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.answer ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.MOONDREAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Receipt scanning not configured' }, { status: 503 });
  }

  const { imageBase64, mediaType, scanType = 'receipt' } = await request.json();
  const safeMediaType = VALID_MEDIA_TYPES.includes(mediaType) ? mediaType : 'image/jpeg';

  let imageUrl: string = imageBase64;
  if (!imageBase64.startsWith('data:')) {
    imageUrl = `data:${safeMediaType};base64,${imageBase64}`;
  }

  if (scanType === 'odometer') {
    const answer = await callMoondream(apiKey, imageUrl, ODOMETER_PROMPT);
    if (!answer) return NextResponse.json({ error: 'Scan failed' }, { status: 502 });
    const match = answer.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json(NULL_ODOMETER);
    try {
      const validated = OdometerSchema.parse(JSON.parse(match[0]));
      return NextResponse.json(validated);
    } catch {
      return NextResponse.json(NULL_ODOMETER);
    }
  }

  // receipt / fuel pump
  const answer = await callMoondream(apiKey, imageUrl, RECEIPT_PROMPT);
  if (!answer) return NextResponse.json({ error: 'Scan failed' }, { status: 502 });
  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json(NULL_RECEIPT);
  try {
    const validated = ReceiptSchema.parse(JSON.parse(match[0]));
    return NextResponse.json(validated);
  } catch {
    return NextResponse.json(NULL_RECEIPT);
  }
}
