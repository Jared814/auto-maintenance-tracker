'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wrench } from 'lucide-react';

interface Props {
  qrSlug: string;
  vehicleName: string;
}

export function PinGate({ qrSlug, vehicleName }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/public/vehicle/${qrSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        setError('Incorrect PIN. Please try again.');
        setLoading(false);
        return;
      }

      // Set cookie via API and refresh
      await fetch(`/api/public/vehicle/${qrSlug}/set-cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="size-12 rounded-xl bg-primary flex items-center justify-center">
            <Wrench className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-center">{vehicleName}</h1>
          <p className="text-muted-foreground text-sm text-center">Enter the PIN to view maintenance history</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={8}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center text-lg tracking-widest"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !pin}>
            {loading ? 'Verifying…' : 'View Maintenance History'}
          </Button>
        </form>
      </div>
    </div>
  );
}
