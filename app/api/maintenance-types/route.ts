import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMaintenanceTypes, createMaintenanceType } from '@/lib/db';
import { CreateMaintenanceTypeSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const types = await getMaintenanceTypes(session.user.id);
  return NextResponse.json(types);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = CreateMaintenanceTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const type = await createMaintenanceType({
      ...parsed.data,
      default_interval_miles: parsed.data.default_interval_miles ?? null,
      default_interval_months: parsed.data.default_interval_months ?? null,
      account_id: session.user.id,
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error('[maintenance-types POST]', error);
    return NextResponse.json({ error: 'Failed to create type' }, { status: 500 });
  }
}
