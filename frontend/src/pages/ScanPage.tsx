import { IconScan } from '@tabler/icons-react';
import { ScanForm } from '@/components';

export function ScanPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div className="flex items-start gap-3 text-indigo-600">
        <IconScan size={24} />
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-slate-900">New Scan</h1>
          <p className="text-sm text-slate-500">
            Configure your provable fairness scan parameters to analyze game outcomes.
          </p>
        </div>
      </div>
      <ScanForm />
    </div>
  );
}
