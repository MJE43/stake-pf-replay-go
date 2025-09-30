import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import {
  Controller,
  FormProvider,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  useFormContext,
} from 'react-hook-form';
import { cn } from '@/lib/utils';

const Form = FormProvider;

type FormFieldContextValue<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({
  control,
  ...props
}: ControllerProps<TFieldValues, TName>) {
  const formContext = useFormContext<TFieldValues>();
  const resolvedControl = control ?? formContext.control;

  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller control={resolvedControl} {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = fieldContext.name ? getFieldState(fieldContext.name, formState) : undefined;

  const id = itemContext.id;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    error: fieldState?.error,
  };
}

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function FormItem(
  { className, ...props },
  ref,
) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn('space-y-2', className)} {...props} />
    </FormItemContext.Provider>
  );
});

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function FormLabel({ className, ...props }, ref) {
  const { formItemId } = useFormField();

  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});

const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(function FormControl(
  { className, ...props },
  ref,
) {
  const { formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      className={className}
      id={formItemId}
      aria-describedby={`${formDescriptionId} ${formMessageId}`}
      {...props}
    />
  );
});

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(function FormDescription(
  { className, ...props },
  ref,
) {
  const { formDescriptionId } = useFormField();

  return <p ref={ref} id={formDescriptionId} className={cn('text-sm text-muted-foreground', className)} {...props} />;
});

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(function FormMessage(
  { className, children, ...props },
  ref,
) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p ref={ref} id={formMessageId} className={cn('text-sm font-medium text-destructive', className)} {...props}>
      {body}
    </p>
  );
});

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField };
