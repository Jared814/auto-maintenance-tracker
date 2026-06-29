import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getMaintenanceTypesAll, getDisabledTypeIds, getTypeOverrides } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { MaintenanceTypesClient } from './types-client';

export const dynamic = 'force-dynamic';

export default async function MaintenanceTypesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [rawTypes, disabledIds, overridesMap] = await Promise.all([
    getMaintenanceTypesAll(session.user.id),
    getDisabledTypeIds(session.user.id),
    getTypeOverrides(session.user.id),
  ]);
  // Built-in "Other" is now handled implicitly when no service type is selected
  const allTypes = rawTypes.filter((t) => !(t.account_id === null && t.name === 'Other'));
  const overrides = Object.fromEntries(overridesMap);

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
          Toggle types on or off to control what the app tracks. Add custom types for your account.
        </p>

        <MaintenanceTypesClient types={allTypes} disabledIds={disabledIds} overrides={overrides} />
      </div>
    </AppShell>
  );
}
