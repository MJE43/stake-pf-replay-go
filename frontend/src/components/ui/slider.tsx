import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(function Slider({ className, children, ...props }, ref) {
  const thumbs = React.useMemo(() => {
    const value = (props.value ?? props.defaultValue ?? [0]) as number[];
    return value.length > 0 ? value : [0];
  }, [props.value, props.defaultValue]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-[hsl(var(--primary))]" />
      </SliderPrimitive.Track>
      {thumbs.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block h-4 w-4 rounded-full border border-background bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
      {children}
    </SliderPrimitive.Root>
  );
});

export { Slider };
