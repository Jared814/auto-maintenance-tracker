import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getVehicleByQrSlug } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { pin } = await request.json();
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });

    const vehicle = await getVehicleByQrSlug(slug);
    if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const valid = await bcrypt.compare(String(pin), vehicle.qr_pin_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    const response = NextResponse.json({ success: true });
    response.cookies.set(`pin_${slug}`, 'verified', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: `/v/${slug}`,
    });

    return response;
  } catch (error) {
    console.error('[set-cookie]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
