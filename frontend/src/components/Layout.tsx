import { ReactNode } from 'react';
import {
  IconBroadcast,
  IconChartBar,
  IconHistory,
  IconScan,
  IconShield,
  IconCpu,
  IconMenu2,
  IconSettings,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

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
import { MiniNavRail } from './MiniNavRail';

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
    label: 'Live Dashboard',
    description: 'Monitor live betting streams',
    path: '/live',
    hotkey: 'Alt+3',
  },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans transition-colors selection:bg-primary/20">
      <MiniNavRail items={navItems} />

      <div className="flex min-h-screen flex-1 flex-col relative">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-white/10 shadow-lg shadow-primary/5">
                <IconChartBar size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-foreground/90">
                  Stake PF Replay
                </span>
                <span className="text-xs font-medium text-muted-foreground">Provable Fairness Analysis</span>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
               <div className="flex items-center gap-2 mr-4">
                <Badge variant="outline" className="gap-1.5 border-white/5 bg-white/5 py-1 pl-2 pr-2.5 text-xs font-medium text-muted-foreground/80 hover:bg-white/10 transition-colors">
                    <IconShield size={12} className="text-emerald-400" />
                    Local Secure
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-white/5 bg-white/5 py-1 pl-2 pr-2.5 text-xs font-medium text-muted-foreground/80 hover:bg-white/10 transition-colors">
                    <IconCpu size={12} className="text-blue-400" />
                    High Perf
                </Badge>
               </div>
               <div className="h-4 w-px bg-white/10 mx-1" />
              <ThemeToggle />
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation">
                    <IconMenu2 size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-white/10 bg-card/95 backdrop-blur-xl">
                  {navItems.map((item) => {
                    const active =
                      location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        className={cn(
                          'flex items-center gap-2 focus:bg-primary/10 focus:text-primary',
                          active && 'bg-primary/10 text-primary',
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

        <main className="flex-1 relative">
            {/* Subtle background gradient for depth */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background opacity-50 pointer-events-none" />
            
            <div className="mx-auto w-full max-w-[1600px] p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
                {children}
            </div>
        </main>
      </div>
    </div>
  );
}
