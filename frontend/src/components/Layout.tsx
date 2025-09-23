import { ReactNode } from 'react';
import {
  IconBroadcast,
  IconChartBar,
  IconHistory,
  IconScan,
  IconShield,
  IconCpu,
  IconMenu2,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    icon: IconScan,
    label: 'New Scan',
    description: 'Configure and start a new scan',
    path: '/',
  },
  {
    icon: IconHistory,
    label: 'Scan History',
    description: 'View previous scan results',
    path: '/runs',
  },
  {
    icon: IconBroadcast,
    label: 'Live Streams',
    description: 'Monitor live betting streams',
    path: '/live',
  },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow">
              <IconChartBar size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold md:text-lg">Stake PF Replay</span>
              <span className="text-sm text-slate-500">Provable Fairness Analysis Tool</span>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-600">
              <IconShield size={12} />
              Local Only
            </Badge>
            <Badge className="gap-1 bg-indigo-500/15 text-indigo-600">
              <IconCpu size={12} />
              High Performance
            </Badge>
          </div>

          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation">
                  <IconMenu2 size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {navItems.map((item) => {
                  const active =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <DropdownMenuItem
                      key={item.path}
                      className={cn('flex items-center gap-2', active && 'bg-indigo-500/10 text-indigo-600')}
                      onSelect={() => navigate(item.path)}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-64 shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex lg:flex-col">
          <span className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Navigation
          </span>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-start gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-600',
                    active && 'border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm',
                  )}
                >
                  <item.icon size={18} className="mt-1" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-xs text-slate-500">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 text-xs text-slate-500">
            <p className="font-semibold uppercase tracking-wide">Desktop Application</p>
            <p className="mt-1 text-slate-500/80">Your seeds never leave this device.</p>
          </div>
        </aside>

        <main className="flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
