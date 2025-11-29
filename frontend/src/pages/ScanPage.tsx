import { IconScan, IconSparkles } from '@tabler/icons-react';
import { ScanForm } from '@/components';

export function ScanPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-white/10 shadow-lg shadow-primary/10">
          <IconScan size={24} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">New Scan</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <IconSparkles size={10} /> Provably Fair
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure seeds, game parameters, and target criteria to replay and analyze game outcomes.
          </p>
        </div>
      </div>
      <ScanForm />
    </div>
  );
}
