'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Database } from 'lucide-react';

const MAX_BYTES = 50 * 1024 * 1024;

export function DatabaseBackupCard({ available }: { available: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setMessage({ type: 'error', text: 'File too large (max 50 MB).' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/database', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: json.message });
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setMessage({ type: 'error', text: json.error ?? 'Upload failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error during upload.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="size-4" />
          Database Backup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!available ? (
          <p className="text-sm text-muted-foreground">
            Database backup and restore is only available when running in SQLite mode (no{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">DATABASE_URL</code> set).
          </p>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Download a copy of your database for safekeeping or migration.
              </p>
              <a href="/api/admin/database" download="maintenance.db">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="size-4" />
                  Download Backup
                </Button>
              </a>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Restore from a previously downloaded backup. The server must be restarted after upload to use the new data.
              </p>
              <form onSubmit={handleUpload} className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db"
                  className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-medium hover:file:bg-muted cursor-pointer"
                />
                <Button type="submit" variant="outline" size="sm" className="gap-2" disabled={uploading}>
                  <Upload className="size-4" />
                  {uploading ? 'Uploading…' : 'Restore'}
                </Button>
              </form>
              {message && (
                <p className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
                  {message.text}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
