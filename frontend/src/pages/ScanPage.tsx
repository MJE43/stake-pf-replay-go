import { IconTerminal2 } from '@tabler/icons-react';
import { ScanForm } from '@/components';

export function ScanPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center border border-primary/30 bg-primary/10 text-primary shadow-glow">
          <IconTerminal2 size={24} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl uppercase tracking-wider text-foreground">
              New Scan
            </h1>
            <span className="badge-terminal">
              Provably Fair
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure seeds, game parameters, and target criteria to replay and analyze outcomes.
          </p>
        </div>
      </div>

      {/* Form */}
      <ScanForm />
    </div>
  );
}
