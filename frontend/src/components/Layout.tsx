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

import { MiniNavRail } from '@/components/MiniNavRail';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    hotkey: 'Alt+1',
  },
  {
    icon: IconHistory,
    label: 'Scan History',
    description: 'View previous scan results',
    path: '/runs',
    hotkey: 'Alt+2',
  },
  {
    icon: IconBroadcast,
    label: 'Live Streams',
    description: 'Monitor live betting streams',
    path: '/live',
    hotkey: 'Alt+3',
  },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors">
      <MiniNavRail items={navItems} />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/80 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-[0_6px_20px_-12px_rgba(0,0,0,0.6)]">
                <IconChartBar size={20} />
              </div>
              <div className="flex flex-col">
                <span className="tracking-[var(--tracking-normal)] text-lg font-semibold md:text-xl">
                  Stake PF Replay
                </span>
                <span className="text-sm text-muted-foreground/85">Provable Fairness Analysis Tool</span>
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

        <main className="flex-1 pb-10">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
