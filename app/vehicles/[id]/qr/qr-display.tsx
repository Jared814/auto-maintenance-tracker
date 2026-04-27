'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface Vehicle {
  name: string;
  qr_slug: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
}

export function QrCodeDisplay({ vehicle }: { vehicle: Vehicle }) {
  const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${vehicle.qr_slug}`;

  return (
    <div className="space-y-6">
      {/* Print-optimized card */}
      <div className="border border-border rounded-xl p-6 text-center space-y-4 bg-white">
        <h2 className="text-xl font-bold">{vehicle.name}</h2>
        {(vehicle.make || vehicle.year) && (
          <p className="text-sm text-muted-foreground">
            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
          </p>
        )}
        <div className="flex justify-center">
          <QRCodeSVG
            value={qrUrl}
            size={200}
            level="M"
            includeMargin
          />
        </div>
        <p className="text-xs text-muted-foreground break-all">{qrUrl}</p>
        <p className="text-xs text-muted-foreground">Scan to view maintenance history</p>
      </div>

      <div className="no-print flex gap-3">
        <Button onClick={() => window.print()} className="flex-1">
          <Printer className="size-4" />
          Print QR Code
        </Button>
      </div>
    </div>
  );
}
