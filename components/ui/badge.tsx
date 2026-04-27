import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        {
          'bg-primary/10 text-primary border-primary/20': variant === 'default',
          'bg-green-100 text-green-800 border-green-200': variant === 'success',
          'bg-yellow-100 text-yellow-800 border-yellow-200': variant === 'warning',
          'bg-red-100 text-red-800 border-red-200': variant === 'danger',
          'bg-gray-100 text-gray-600 border-gray-200': variant === 'muted',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
