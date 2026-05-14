'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { KeyRound } from 'lucide-react';
import { saveApiKeysAction } from '@/lib/actions/settings';

export function ApiKeysCard({
  hasMoondreamKey,
  hasGeminiKey,
  hasOpenRouterKey,
}: {
  hasMoondreamKey: boolean;
  hasGeminiKey: boolean;
  hasOpenRouterKey: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveApiKeysAction, null);

  useEffect(() => {
    if (state && 'success' in state) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="size-4" />
          API Keys
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <KeyField name="moondream_api_key" label="Moondream" hasKey={hasMoondreamKey} />
          <KeyField name="gemini_api_key" label="Google Gemini" hasKey={hasGeminiKey} />
          <KeyField name="openrouter_api_key" label="OpenRouter" hasKey={hasOpenRouterKey} />

          <p className="text-xs text-muted-foreground">
            Leave a field blank to keep the existing key. Keys are also read from server environment variables as a fallback.
          </p>

          {state && 'error' in state && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
          )}
          {state && 'success' in state && (
            <p className="text-sm text-green-600">API keys saved.</p>
          )}

          <SubmitButton label="Save API Keys" pendingLabel="Saving…" />
        </form>
      </CardContent>
    </Card>
  );
}

function KeyField({ name, label, hasKey }: { name: string; label: string; hasKey: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}{' '}
        {hasKey
          ? <span className="text-xs text-green-600 font-normal">● key saved</span>
          : <span className="text-xs text-muted-foreground font-normal">not set</span>
        }
      </Label>
      <Input
        id={name}
        name={name}
        type="password"
        placeholder={hasKey ? '••••••••  (leave blank to keep)' : 'Enter API key…'}
        autoComplete="off"
      />
    </div>
  );
}
