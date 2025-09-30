import { type ComponentType, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconCpu, IconShield, type IconProps } from '@tabler/icons-react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface MiniNavItem {
  icon: ComponentType<IconProps>;
  label: string;
  path: string;
  description?: string;
  badge?: string | number;
  hotkey?: string;
}

interface MiniNavRailProps {
  items: MiniNavItem[];
}

export function MiniNavRail({ items }: MiniNavRailProps) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!event.altKey || event.shiftKey || event.metaKey || event.ctrlKey) {
        return;
      }

      const digit = Number.parseInt(event.key, 10);
      if (Number.isNaN(digit)) {
        return;
      }

      const item = items[digit - 1];
      if (!item) {
        return;
      }

      event.preventDefault();
      navigate(item.path);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [items, navigate]);

  return (
    <TooltipProvider>
      <aside className="sticky top-0 z-40 hidden h-[100dvh] w-[var(--rail-width,60px)] shrink-0 border-r border-border/50 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-[inset_-1px_0_0_rgba(0,0,0,0.25)] md:flex md:flex-col md:items-center md:justify-between">
        <nav className="flex flex-col items-center gap-3 py-5">
          {items.map((item, index) => {
            const active =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const shortcut = item.hotkey ?? `Alt+${index + 1}`;

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={item.label}
                    className={cn(
                      'group relative flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-[hsl(var(--sidebar-foreground))]/70 transition-all hover:border-[hsl(var(--primary))]/35 hover:bg-[hsl(var(--primary))]/7 hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar))]',
                      active &&
                        'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))_/20] saturate-150',
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <span
                      className={cn(
                        'pointer-events-none absolute inset-y-2 left-1 w-[3px] rounded-full bg-[hsl(var(--primary))] opacity-0 transition-opacity',
                        active && 'opacity-100',
                        !active && 'group-hover:opacity-60',
                      )}
                    />
                    <item.icon size={18} strokeWidth={1.9} />
                    {item.badge ? (
                      <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1 text-[10px] font-semibold text-[hsl(var(--accent-foreground))]">
                        {item.badge}
                      </span>
                    ) : null}
                    <span className="sr-only">Shortcut {shortcut}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.description ? (
                      <span className="max-w-[18rem] text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                      {shortcut}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-3 pb-4">
          <div className="h-px w-8 bg-border/40" />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-transparent bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]/70 transition-colors hover:border-[hsl(var(--accent))]/40 hover:text-[hsl(var(--accent))]">
                <IconShield size={16} strokeWidth={1.8} />
                <span className="sr-only">Local only runtime</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Local only – your seeds stay on this device.</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-transparent bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]/70 transition-colors hover:border-[hsl(var(--primary))]/40 hover:text-[hsl(var(--primary))]">
                <IconCpu size={16} strokeWidth={1.8} />
                <span className="sr-only">High performance mode</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">High performance mode is enabled.</TooltipContent>
          </Tooltip>

          <ThemeToggle />
        </div>
      </aside>
    </TooltipProvider>
  );
}
