import { IconMoon, IconSun } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative h-9 w-9 border-border text-foreground"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <IconSun
        size={18}
        className="absolute transition-transform duration-200 ease-out text-[hsl(var(--accent))] dark:-rotate-90 dark:scale-0"
      />
      <IconMoon
        size={18}
        className="absolute rotate-90 scale-0 transition-transform duration-200 ease-out text-[hsl(var(--primary))] dark:rotate-0 dark:scale-100"
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
