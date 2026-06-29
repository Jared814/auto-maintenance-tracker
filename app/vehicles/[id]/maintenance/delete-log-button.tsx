'use client';

import { useState, useTransition } from 'react';
import { Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteMaintenanceLogFromListAction } from '@/lib/actions/maintenance';

export function DeleteLogButton({ logId }: { logId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await deleteMaintenanceLogFromListAction(logId);
      setConfirming(false);
    });
  }

  function handleConfirmClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <Button
          variant="destructive"
          size="icon-sm"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Confirm delete"
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={handleCancel}
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-destructive shrink-0"
      onClick={handleConfirmClick}
      aria-label="Delete service record"
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
