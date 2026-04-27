import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateMaintenanceType, deleteMaintenanceType } from '@/lib/db';
import { CreateMaintenanceTypeSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = CreateMaintenanceTypeSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const type = await updateMaintenanceType(id, session.user.id, parsed.data);
    if (!type) return NextResponse.json({ error: 'Not found or not editable' }, { status: 404 });

    return NextResponse.json(type);
  } catch (error) {
    console.error('[maintenance-types PATCH]', error);
    return NextResponse.json({ error: 'Failed to update type' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteMaintenanceType(id, session.user.id);
  return NextResponse.json({ success: true });
}
