import * as React from 'react';
import { cn } from '@/lib/utils';

const alertVariants = {
  default: 'border-border bg-card text-foreground',
  info: 'border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]',
  success: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  warning: 'border-amber-400/60 bg-amber-500/15 text-amber-200',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
} satisfies Record<string, string>;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertVariants;
  icon?: React.ReactNode;
  title?: string;
}

export function Alert({ className, variant = 'default', icon, title, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border p-4 shadow-sm', alertVariants[variant], className)}
      {...props}
    >
      {icon && <div className="mt-0.5 text-lg">{icon}</div>}
      <div className="flex flex-col gap-1">
        {title && <h4 className="text-sm font-semibold leading-none">{title}</h4>}
        {children && <div className="text-sm leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
