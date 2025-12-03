import { IconMoon, IconSun } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <IconSun
        size={16}
        strokeWidth={1.8}
        className="absolute transition-transform duration-200 ease-out dark:-rotate-90 dark:scale-0"
      />
      <IconMoon
        size={16}
        strokeWidth={1.8}
        className="absolute rotate-90 scale-0 transition-transform duration-200 ease-out dark:rotate-0 dark:scale-100"
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
