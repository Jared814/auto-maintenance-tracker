import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getMaintenanceTypes } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import { MaintenanceTypesClient } from './types-client';

export const dynamic = 'force-dynamic';

export default async function MaintenanceTypesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const types = await getMaintenanceTypes(session.user.id);

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Maintenance Types</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Default types apply to all accounts. You can add custom types for your account.
        </p>

        <MaintenanceTypesClient types={types} />
      </div>
    </AppShell>
  );
}
