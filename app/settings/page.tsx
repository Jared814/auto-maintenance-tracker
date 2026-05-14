import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getAccountById, getAccountScanSettings, getScanEngines } from '@/lib/db';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, ChevronRight } from 'lucide-react';
import { DatabaseBackupCard } from './database-backup-card';
import { ApiKeysCard } from './api-keys-card';
import { ScanEnginesCard } from './scan-engines-card';
import { ScanSettingsCard } from './scan-settings-card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [account, scanSettings, engines] = await Promise.all([
    getAccountById(session.user.id),
    getAccountScanSettings(session.user.id),
    getScanEngines(session.user.id),
  ]);

  // Determine key presence: DB key takes priority, env var is fallback
  const s = scanSettings as typeof scanSettings & {
    moondream_api_key?: string | null;
    gemini_api_key?: string | null;
    openrouter_api_key?: string | null;
  };
  const hasMoondreamKey = !!(s.moondream_api_key || process.env.MOONDREAM_API_KEY);
  const hasGeminiKey = !!(s.gemini_api_key || process.env.GOOGLE_AI_API_KEY);
  const hasOpenRouterKey = !!(s.openrouter_api_key || process.env.OPENROUTER_API_KEY);

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{account?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{account?.email}</span>
            </div>
          </CardContent>
        </Card>

        <ApiKeysCard
          hasMoondreamKey={hasMoondreamKey}
          hasGeminiKey={hasGeminiKey}
          hasOpenRouterKey={hasOpenRouterKey}
        />

        <ScanEnginesCard initialEngines={engines} />

        <ScanSettingsCard
          odometerModel={scanSettings.odometer_model}
          receiptModel={scanSettings.receipt_model}
          engines={engines}
        />

        <Card>
          <CardContent className="p-0">
            <Link
              href="/settings/maintenance-types"
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <Wrench className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Maintenance Types</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <DatabaseBackupCard />
      </div>
    </AppShell>
  );
}
