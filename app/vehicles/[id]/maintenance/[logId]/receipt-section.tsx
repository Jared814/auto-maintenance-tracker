'use client';

import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Image } from 'lucide-react';
import { deleteReceiptAction, generateUploadUrlAction, saveReceiptAction } from '@/lib/actions/receipts';

interface Receipt {
  id: string;
  r2_url: string;
  file_name?: string | null;
}

interface Props {
  logId: string;
  initialReceipts: Receipt[];
}

export function ReceiptSection({ logId, initialReceipts }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: false,
      });

      // Get presigned URL
      const { uploadUrl, publicUrl, r2Key } = await generateUploadUrlAction(
        file.name,
        compressed.type || 'image/jpeg',
        logId
      );

      // Upload to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: compressed,
        headers: { 'Content-Type': compressed.type || 'image/jpeg' },
      });
      if (!putRes.ok) throw new Error('Failed to upload file');

      // Save receipt record
      const receipt = await saveReceiptAction({
        maintenance_log_id: logId,
        r2_key: r2Key,
        r2_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
      });
      
      setReceipts((prev) => [...prev, receipt as Receipt]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(receiptId: string) {
    if (!confirm('Delete this receipt?')) return;
    try {
      await deleteReceiptAction(receiptId);
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete receipt');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Photos</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="size-4" />
          {uploading ? 'Uploading…' : 'Add Photos'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {receipts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No receipts attached.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="relative group rounded-lg overflow-hidden border border-border">
              <a href={receipt.r2_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={receipt.r2_url}
                  alt={receipt.file_name ?? 'Receipt'}
                  className="w-full h-32 object-cover"
                />
              </a>
              <button
                onClick={() => handleDelete(receipt.id)}
                className="absolute top-1 right-1 size-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
