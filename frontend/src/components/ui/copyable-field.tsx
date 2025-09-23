import { useState } from 'react';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyableFieldProps {
  value: string;
  displayValue?: string;
  label?: string;
  className?: string;
}

export function CopyableField({ value, displayValue, label, className }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && <span className="font-medium text-slate-600">{label}:</span>}
      <div className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
        <code className="font-mono text-xs text-slate-800">
          {displayValue || value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-5 w-5 p-0 hover:bg-slate-200"
          title={`Copy ${label || 'value'}`}
        >
          {copied ? (
            <IconCheck size={12} className="text-green-600" />
          ) : (
            <IconCopy size={12} className="text-slate-500" />
          )}
        </Button>
      </div>
    </div>
  );
}