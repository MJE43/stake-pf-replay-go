import { type ComponentType, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type IconProps } from '@tabler/icons-react';

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
      <aside className="sticky top-0 z-40 hidden h-[100dvh] w-16 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        {/* Logo area */}
        <div className="flex h-16 items-center justify-center border-b border-border">
          <div className="relative flex h-9 w-9 items-center justify-center">
            {/* Terminal bracket logo */}
            <span className="font-mono text-lg font-bold text-primary glow-sm">[</span>
            <span className="font-mono text-lg font-bold text-foreground">P</span>
            <span className="font-mono text-lg font-bold text-primary glow-sm">]</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1 py-4">
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
                      'group relative flex h-11 w-11 items-center justify-center transition-all duration-200',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    {/* Active indicator */}
                    {active && (
                      <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-primary shadow-glow" />
                    )}

                    {/* Icon container */}
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center border transition-all duration-200',
                        active
                          ? 'border-primary/50 bg-primary/10 shadow-glow'
                          : 'border-transparent bg-transparent group-hover:border-border group-hover:bg-muted/50'
                      )}
                      style={{ borderRadius: 'var(--radius)' }}
                    >
                      <item.icon size={18} strokeWidth={1.8} />
                    </span>

                    {/* Badge */}
                    {item.badge ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-hit px-1 text-[9px] font-bold text-background">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1">
                  <span className="font-display text-xs uppercase tracking-wider">{item.label}</span>
                  {item.description && (
                    <span className="max-w-[200px] text-xs text-muted-foreground">{item.description}</span>
                  )}
                  <span className="mt-1 font-mono text-[10px] text-muted-foreground">{shortcut}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer status */}
        <div className="flex flex-col items-center gap-3 border-t border-border py-4">
          {/* Status indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center">
                <span className="status-dot online" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="text-xs">System operational</span>
            </TooltipContent>
          </Tooltip>

          {/* Version indicator */}
          <div className="flex flex-col items-center">
            <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">VER</span>
            <span className="font-mono text-[10px] text-primary">1.0</span>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
