import * as React from 'react';
import { cn } from '@/lib/utils';

const alertVariants = {
  default: 'border-slate-200 bg-white text-slate-900',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  destructive: 'border-red-200 bg-red-50 text-red-700',
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
