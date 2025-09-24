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
import { ThemeToggle } from '@/components/ThemeToggle';
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
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-sm)]">
              <IconChartBar size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold md:text-lg tracking-[var(--tracking-normal)]">Stake PF Replay</span>
              <span className="text-sm text-muted-foreground">Provable Fairness Analysis Tool</span>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Badge className="gap-1 border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">
              <IconShield size={12} />
              Local Only
            </Badge>
            <Badge className="gap-1 border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
              <IconCpu size={12} />
              High Performance
            </Badge>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation" className="border-border">
                  <IconMenu2 size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border bg-card text-foreground">
                {navItems.map((item) => {
                  const active =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <DropdownMenuItem
                      key={item.path}
                      className={cn(
                        'flex items-center gap-2 focus:bg-[hsl(var(--primary))]/15 focus:text-[hsl(var(--primary))]',
                        active && 'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]',
                      )}
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
        <aside className="hidden w-64 shrink-0 rounded-none border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] p-4 text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-sm)] lg:flex lg:flex-col">
          <span className="mb-4 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/70">
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
                    'flex items-start gap-3 rounded-none border border-transparent px-3 py-2 text-left transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]',
                    active && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] shadow-[var(--shadow-xs)]',
                  )}
                >
                  <item.icon size={18} className="mt-1" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-xs text-[hsl(var(--sidebar-foreground))]/70">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 text-xs text-[hsl(var(--sidebar-foreground))]/70">
            <p className="font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]">
              Desktop Application
            </p>
            <p className="mt-1">Your seeds never leave this device.</p>
          </div>
        </aside>

        <main className="flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
