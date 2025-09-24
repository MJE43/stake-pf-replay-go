import * as React from 'react';
import { DialogProps } from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';

const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(
  function Command({ className, ...props }, ref) {
    return (
      <CommandPrimitive
        ref={ref}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground shadow',
          className,
        )}
        {...props}
      />
    );
  },
);

const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(
  function CommandInput({ className, ...props }, ref) {
    return (
      <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
        <CommandPrimitive.Input
          ref={ref}
          className={cn('flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground', className)}
          {...props}
        />
      </div>
    );
  },
);

const CommandList = React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
  function CommandList({ className, ...props }, ref) {
    return (
      <CommandPrimitive.List
        ref={ref}
        className={cn('max-h-60 overflow-y-auto overflow-x-hidden', className)}
        {...props}
      />
    );
  },
);

const CommandEmpty = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Empty>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>(
  function CommandEmpty(props, ref) {
    return <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />;
  },
);

const CommandGroup = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Group>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(
  function CommandGroup({ className, ...props }, ref) {
    return (
      <CommandPrimitive.Group
        ref={ref}
        className={cn('overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground', className)}
        {...props}
      />
    );
  },
);

const CommandItem = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Item>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(
  function CommandItem({ className, ...props }, ref) {
    return (
      <CommandPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-muted',
          className,
        )}
        {...props}
      />
    );
  },
);

const CommandSeparator = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>>(
  function CommandSeparator({ className, ...props }, ref) {
    return (
      <CommandPrimitive.Separator ref={ref} className={cn('mx-1 h-px bg-border', className)} {...props} />
    );
  },
);

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />;
};

export type DialogCommandProps = DialogProps;

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
