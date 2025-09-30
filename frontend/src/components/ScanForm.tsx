import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import {
  IconAlertCircle,
  IconChevronDown,
  IconDice,
  IconGauge,
  IconInfoCircle,
  IconKey,
  IconLoader2,
  IconNumbers,
  IconPlayerPlay,
  IconRefresh,
  IconRepeat,
  IconTarget,
} from '@tabler/icons-react';
import { scanFormSchema, validateGameParams } from '@/lib/validation';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';
import type { games } from '@wails/go/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

interface GameInfo {
  id: string;
  name: string;
  metric_label: string;
}

type ScanFormValues = z.input<typeof scanFormSchema>;

const DEFAULT_VALUES: ScanFormValues = {
  serverSeed: '',
  clientSeed: '',
  nonceStart: 0,
  nonceEnd: 100000,
  game: '',
  params: {},
  targetOp: 'ge',
  targetVal: 1000,
  tolerance: 0,
  limit: 1000,
  timeoutMs: 300_000,
};

const TARGET_OPERATORS = [
  { value: 'ge', label: '>=' },
  { value: 'gt', label: '>' },
  { value: 'eq', label: '=' },
  { value: 'le', label: '<=' },
  { value: 'lt', label: '<' },
] as const;

type NoncePreset = {
  label: string;
  apply: (currentStart: number, currentEnd: number) => { start: number; end: number };
};

const NONCE_PRESETS: NoncePreset[] = [
  {
    label: '0 → 1M',
    apply: () => ({ start: 0, end: 1_000_000 }),
  },
  {
    label: 'Last 100K',
    apply: (_, currentEnd) => {
      const end = Number.isFinite(currentEnd) ? Math.max(0, currentEnd) : 100_000;
      return { start: Math.max(0, end - 100_000), end };
    },
  },
  {
    label: 'Default 0 → 1K',
    apply: () => ({ start: DEFAULT_VALUES.nonceStart, end: DEFAULT_VALUES.nonceEnd }),
  },
];

// Lazy-load Wails bindings to keep the initial bundle smaller.
let appBindingsPromise: Promise<typeof import('@wails/go/bindings/App')> | null = null;
let modelBindingsPromise: Promise<typeof import('@wails/go/models')> | null = null;

const getAppBindings = () => {
  if (!appBindingsPromise) {
    appBindingsPromise = import('@wails/go/bindings/App');
  }
  return appBindingsPromise;
};

const getModelBindings = () => {
  if (!modelBindingsPromise) {
    modelBindingsPromise = import('@wails/go/models');
  }
  return modelBindingsPromise;
};

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground/85">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
        {icon}
      </span>
      <span>{title}</span>
      {description && <span className="text-xs font-normal text-muted-foreground">{description}</span>}
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/15 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">{label}</span>
      <span className="font-mono text-sm text-foreground/90">{value}</span>
    </div>
  );
}

function GameComboboxField({
  field,
  availableGames,
  loading,
}: {
  field: ControllerRenderProps<Record<string, unknown>, 'game'>;
  availableGames: GameInfo[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedGame = availableGames.find((game) => game.id === field.value);

  return (
    <FormItem className="space-y-3">
      <FormLabel>Game</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between text-left"
              disabled={loading}
            >
              {selectedGame ? (
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{selectedGame.name}</span>
                  <span className="text-xs text-muted-foreground">Metric: {selectedGame.metric_label}</span>
                </span>
              ) : loading ? (
                'Loading games…'
              ) : (
                'Select a game'
              )}
              <IconChevronDown size={16} className="text-muted-foreground" aria-hidden />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput placeholder="Search games…" />
            <CommandList>
              {loading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>No games found.</CommandEmpty>
                  <CommandGroup>
                    {availableGames.map((game) => (
                      <CommandItem
                        key={game.id}
                        value={game.name}
                        onSelect={() => {
                          field.onChange(game.id);
                          setOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{game.name}</span>
                          <span className="text-xs text-muted-foreground">{game.metric_label}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}

function useMetricLabel(gameId: string | undefined, games: GameInfo[]) {
  return useMemo(() => {
    if (!gameId) return null;
    return games.find((game) => game.id === gameId)?.metric_label ?? null;
  }, [gameId, games]);
}

function DiceParams({ metricLabel }: { metricLabel: string | null }) {
  const label = metricLabel ?? 'target';
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
      <FormField
        name="params.target"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center justify-between">
              Target
              <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                {label}
              </Badge>
            </FormLabel>
            <FormDescription>Precision up to two decimals.</FormDescription>
            <div className="space-y-3">
              <Slider
                min={0}
                max={99.99}
                step={0.01}
                value={[field.value ?? 50]}
                onValueChange={(value) => field.onChange(value[0])}
              />
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.01}
                  className="font-mono"
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="params.condition"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Condition</FormLabel>
            <FormDescription>Match the Over/Under choice.</FormDescription>
            <ToggleGroup
              type="single"
              value={(field.value as string) ?? 'over'}
              onValueChange={(value) => value && field.onChange(value)}
              className="w-full"
            >
              <ToggleGroupItem value="over" className="flex-1">
                Over
              </ToggleGroupItem>
              <ToggleGroupItem value="under" className="flex-1">
                Under
              </ToggleGroupItem>
            </ToggleGroup>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function LimboParams() {
  return (
    <FormField
      name="params.houseEdge"
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel>House edge</FormLabel>
          <FormDescription>Typical edge is 0.99.</FormDescription>
          <Slider
            min={0.01}
            max={1}
            step={0.01}
            value={[field.value ?? 0.99]}
            onValueChange={(value) => field.onChange(Number(value[0].toFixed(2)))}
          />
          <FormControl>
            <Input
              type="number"
              min={0.01}
              max={1}
              step={0.01}
              className="max-w-[160px] font-mono"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PumpParams() {
  const options = [
    { value: 'easy', label: 'Easy', description: '1 POP token' },
    { value: 'medium', label: 'Medium', description: '3 POP tokens' },
    { value: 'hard', label: 'Hard', description: '5 POP tokens' },
    { value: 'expert', label: 'Expert', description: '10 POP tokens' },
  ];

  return (
    <FormField
      name="params.difficulty"
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel>Difficulty</FormLabel>
          <FormDescription>Select the POP buy-in.</FormDescription>
          <RadioGroup
            value={(field.value as string) ?? 'expert'}
            onValueChange={field.onChange}
            className="grid gap-2 md:grid-cols-2"
          >
            {options.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition hover:border-[hsl(var(--primary))] focus-within:ring-2 focus-within:ring-[hsl(var(--primary))] focus-within:ring-offset-2 ${field.value === option.value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : ''}`}
              >
                <RadioGroupItem value={option.value} className="mt-1" />
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PlinkoParams() {
  const presetRows = [8, 10, 12, 14, 16];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField
        name="params.risk"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Risk</FormLabel>
            <FormDescription>Higher risk increases volatility.</FormDescription>
            <ToggleGroup
              type="single"
              value={(field.value as string) ?? 'medium'}
              onValueChange={(value) => value && field.onChange(value)}
              className="w-full"
            >
              <ToggleGroupItem value="low" className="flex-1">
                Low
              </ToggleGroupItem>
              <ToggleGroupItem value="medium" className="flex-1">
                Medium
              </ToggleGroupItem>
              <ToggleGroupItem value="high" className="flex-1">
                High
              </ToggleGroupItem>
            </ToggleGroup>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="params.rows"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Rows</FormLabel>
            <FormDescription>Choose between 8 and 16 rows.</FormDescription>
            <Slider
              min={8}
              max={16}
              step={1}
              value={[field.value ?? 16]}
              onValueChange={(value) => field.onChange(value[0])}
            />
            <div className="flex flex-wrap gap-2">
              {presetRows.map((rows) => (
                <Button
                  key={rows}
                  type="button"
                  size="sm"
                  variant={field.value === rows ? 'default' : 'outline'}
                  onClick={() => field.onChange(rows)}
                  className="h-8 px-3 text-xs"
                >
                  {rows} rows
                </Button>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function GameParams({ gameId, games }: { gameId?: string; games: GameInfo[] }) {
  const metricLabel = useMetricLabel(gameId, games);

  if (!gameId) {
    return <p className="text-sm text-muted-foreground">Select a game to configure parameters.</p>;
  }

  switch (gameId) {
    case 'dice':
      return <DiceParams metricLabel={metricLabel} />;
    case 'limbo':
      return <LimboParams />;
    case 'pump':
      return <PumpParams />;
    case 'plinko':
      return <PlinkoParams />;
    case 'roulette':
      return <p className="text-sm text-muted-foreground">Roulette does not require extra parameters.</p>;
    default:
      return <p className="text-sm text-muted-foreground">No additional parameters required.</p>;
  }
}

function AdvancedPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/70 bg-muted/20">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <IconGauge size={16} aria-hidden /> Advanced constraints
          </span>
          {open ? <IconChevronDown size={16} className="rotate-180 transition-transform" aria-hidden /> : <IconChevronDown size={16} aria-hidden />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/70 px-4 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            name="limit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hit limit</FormLabel>
                <FormDescription>Stops scanning after N matches. Default 1000.</FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    className="font-mono"
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="timeoutMs"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Timeout (ms)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-muted-foreground">?</span>
                    </TooltipTrigger>
                    <TooltipContent>Controls worker patience. Lower values surface errors faster.</TooltipContent>
                  </Tooltip>
                </FormLabel>
                <FormDescription>Shorter timeouts can interrupt long scans.</FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    className="font-mono"
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Tweaking these values changes performance characteristics.</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StickyActionsBar({
  isSubmitting,
  onReset,
}: {
  isSubmitting: boolean;
  onReset: () => void;
}) {
  return (
    <div className="sticky bottom-0 left-0 right-0 mt-8 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:px-0">
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onReset} disabled={isSubmitting} className="gap-2 px-4 py-2">
          <IconRefresh size={16} aria-hidden />
          Reset
        </Button>
        <Button
          type="submit"
          className="gap-2 px-5 py-2.5 text-base font-semibold"
          aria-busy={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <IconLoader2 size={18} className="animate-spin" aria-hidden />
          ) : (
            <IconPlayerPlay size={18} aria-hidden />
          )}
          {isSubmitting ? 'Starting scan…' : 'Start scan'}
        </Button>
      </div>
    </div>
  );
}

export function ScanForm() {
  const navigate = useNavigate();
  const [availableGames, setAvailableGames] = useState<GameInfo[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const gameLoadAttempts = useRef(0);
  const gameRetryTimer = useRef<number | null>(null);
  const gameErrorShown = useRef(false);

  const form = useForm<ScanFormValues>({
    resolver: zodResolver(scanFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { watch, setValue, clearErrors, setError, reset, handleSubmit, formState } = form;
  const { errors, isSubmitting } = formState;

  const watchedGame = watch('game');
  const nonceStart = watch('nonceStart');
  const nonceEnd = watch('nonceEnd');
  const targetOp = watch('targetOp');
  const targetVal = watch('targetVal');
  const limit = watch('limit');

  useEffect(() => {
    const loadGames = async () => {
      try {
        gameLoadAttempts.current += 1;
        setLoadingGames(true);
        await waitForWailsBinding(['go', 'bindings', 'App', 'GetGames'], { timeoutMs: 10_000 });
        const { GetGames } = await getAppBindings();
        const gameSpecs = await callWithRetry(() => GetGames(), 5, 250);
        if (!Array.isArray(gameSpecs)) {
          throw new Error('Unexpected GetGames response');
        }
        const gameInfos: GameInfo[] = gameSpecs.map((spec: games.GameSpec) => ({
          id: spec.id,
          name: spec.name,
          metric_label: spec.metric_label,
        }));
        setAvailableGames(gameInfos);
        gameErrorShown.current = false;
        if (gameRetryTimer.current !== null) {
          window.clearTimeout(gameRetryTimer.current);
          gameRetryTimer.current = null;
        }
      } catch (error) {
        console.error('Failed to load games:', error);
        if (!gameErrorShown.current) {
          toast.error('Failed to load available games, retrying…');
          gameErrorShown.current = true;
        }
        if (gameLoadAttempts.current < 6) {
          gameRetryTimer.current = window.setTimeout(loadGames, 1200);
        }
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
    return () => {
      if (gameRetryTimer.current !== null) {
        window.clearTimeout(gameRetryTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!watchedGame) return;
    clearErrors('params');
    switch (watchedGame) {
      case 'dice':
        setValue('params.target', 50, { shouldDirty: false });
        setValue('params.condition', 'over', { shouldDirty: false });
        break;
      case 'limbo':
        setValue('params.houseEdge', 0.99, { shouldDirty: false });
        break;
      case 'pump':
        setValue('params.difficulty', 'expert', { shouldDirty: false });
        break;
      case 'plinko':
        setValue('params.risk', 'medium', { shouldDirty: false });
        setValue('params.rows', 16, { shouldDirty: false });
        break;
      default:
        setValue('params', {}, { shouldDirty: false });
    }
  }, [watchedGame, clearErrors, setValue]);

  const nonceSliderValue = useMemo(() => {
    const safeStart = Number.isFinite(nonceStart) ? Number(nonceStart) : 0;
    const safeEnd = Number.isFinite(nonceEnd) ? Number(nonceEnd) : safeStart;
    const startValue = Math.min(safeStart, safeEnd);
    const endValue = Math.max(safeStart, safeEnd);
    return [startValue, endValue] as [number, number];
  }, [nonceStart, nonceEnd]);

  const nonceSliderMax = useMemo(() => {
    const [, end] = nonceSliderValue;
    return Math.max(end + 1, 1_000_000);
  }, [nonceSliderValue]);

  const nonceCount = Math.max(0, nonceSliderValue[1] - nonceSliderValue[0]);

  const handleNonceSliderChange = useCallback(
    (value: number[]) => {
      if (value.length < 2) return;
      const [startValue, endValue] = value as [number, number];
      form.setValue('nonceStart', Math.min(startValue, endValue), { shouldDirty: true });
      form.setValue('nonceEnd', Math.max(startValue, endValue), { shouldDirty: true });
    },
    [form],
  );

  const handleNoncePreset = useCallback(
    (preset: NoncePreset) => {
      const values = preset.apply(nonceStart ?? 0, nonceEnd ?? 0);
      form.setValue('nonceStart', values.start, { shouldDirty: true });
      form.setValue('nonceEnd', values.end, { shouldDirty: true });
    },
    [form, nonceStart, nonceEnd],
  );

  const onSubmit = async (values: ScanFormValues) => {
    try {
      const data = scanFormSchema.parse(values);
      const paramsSchema = validateGameParams(data.game, data.params);
      const validatedParams = paramsSchema.parse(data.params ?? {});

      const scanRequest = {
        Game: data.game,
        Seeds: {
          Server: data.serverSeed,
          Client: data.clientSeed,
        },
        NonceStart: data.nonceStart,
        NonceEnd: data.nonceEnd,
        Params: validatedParams,
        TargetOp: data.targetOp,
        TargetVal: data.targetVal,
        Tolerance: data.tolerance,
        Limit: data.limit,
        TimeoutMs: data.timeoutMs,
      };

      const [{ StartScan }, { bindings }] = await Promise.all([getAppBindings(), getModelBindings()]);
      const result = await StartScan(bindings.ScanRequest.createFrom(scanRequest));
      toast.success(`Scan started. Run ID: ${result.RunID}`);
      navigate(`/runs/${result.RunID}`);
    } catch (error: any) {
      console.error('Scan failed:', error);
      if (error?.name === 'ZodError' && Array.isArray(error.errors)) {
        error.errors.forEach((issue: { path: (string | number)[]; message: string }) => {
          const key = issue.path.join('.') as keyof ScanFormValues;
          setError(key, { message: issue.message });
        });
      } else {
        toast.error(error?.message ?? 'An unexpected error occurred');
      }
    }
  };

  const validationErrors = Object.entries(errors);

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-10">
          <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)]">
            <CardHeader className="space-y-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <IconRepeat size={20} className="text-[hsl(var(--primary))]" aria-hidden />
                  Build a scan
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure seeds, pick a game, and fine-tune the target to replay a provably fair run.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <SummaryChip label="Game" value={availableGames.find((g) => g.id === watchedGame)?.name ?? '—'} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    Currently selected game
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <SummaryChip label="Range" value={`${nonceCount.toLocaleString()} nonces`} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    Total nonces that will be evaluated
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <SummaryChip
                        label="Target"
                        value={`${targetOp ?? '—'} ${
                          typeof targetVal === 'number' && Number.isFinite(targetVal) ? targetVal.toString() : '—'
                        }`}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    Outcome threshold used to flag results
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <SummaryChip
                        label="Limit"
                        value={typeof limit === 'number' && Number.isFinite(limit) ? limit.toLocaleString() : '—'}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    Maximum bets the scan will pull before stopping
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>

            <CardContent className="space-y-12">
              <section className="space-y-5">
                <SectionHeader icon={<IconKey size={16} />} title="Seeds" description="Enter the server and client seeds" />
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    name="serverSeed"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Server seed</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter server seed" value={field.value ?? ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="clientSeed"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Client seed</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter client seed" value={field.value ?? ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="space-y-5">
                <SectionHeader icon={<IconDice size={16} />} title="Game" description="Choose the game and tweak parameters" />
                <FormField
                  name="game"
                  render={({ field }) => (
                    <GameComboboxField field={field} availableGames={availableGames} loading={loadingGames} />
                  )}
                />
                {watchedGame && (
                  <div className="space-y-3 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]">
                      <IconInfoCircle size={16} aria-hidden />
                      {availableGames.find((g) => g.id === watchedGame)?.name ?? 'Selected game'} parameters
                    </div>
                    <GameParams gameId={watchedGame} games={availableGames} />
                  </div>
                )}
              </section>

              <section className="space-y-5">
                <SectionHeader icon={<IconNumbers size={16} />} title="Nonce range" description="Define which bets to evaluate" />
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      name="nonceStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="font-mono"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="nonceEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="font-mono"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    <Slider
                      min={0}
                      max={nonceSliderMax}
                      step={1}
                      value={nonceSliderValue}
                      onValueChange={handleNonceSliderChange}
                    />
                    <div aria-live="polite" className="text-xs text-muted-foreground">
                      Evaluating {nonceCount.toLocaleString()} nonces
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {NONCE_PRESETS.map((preset) => (
                        <Tooltip key={preset.label}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleNoncePreset(preset)}
                            >
                              {preset.label}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Apply preset range {preset.label}.</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5">
                <SectionHeader icon={<IconTarget size={16} />} title="Target" description="Define success criteria" />
                <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                  <FormField
                    name="targetOp"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Operator</FormLabel>
                        <FormDescription>Select the comparison operator.</FormDescription>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(value) => value && field.onChange(value)}
                          className="w-full"
                        >
                          {TARGET_OPERATORS.map((option) => (
                            <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
                              {option.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="targetVal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value</FormLabel>
                        <FormDescription>Provide the metric threshold.</FormDescription>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            className="font-mono"
                            value={field.value ?? ''}
                            onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  name="tolerance"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-[320px]">
                      <FormLabel>Tolerance</FormLabel>
                      <FormDescription>Higher tolerance widens the acceptable band.</FormDescription>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          className="font-mono"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-5">
                <SectionHeader icon={<IconGauge size={16} />} title="Constraints" description="Optional fine-tuning" />
                <AdvancedPanel />
              </section>

              {validationErrors.length > 0 && (
                <Alert variant="destructive" icon={<IconAlertCircle size={18} />} title="Please fix the following errors">
                  <ul className="list-disc pl-5 text-sm">
                    {validationErrors.map(([fieldName, error]) => (
                      <li key={fieldName}>
                        <span className="font-medium">{fieldName}:</span> {error?.message as string}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </CardContent>
          </Card>

          <StickyActionsBar
            isSubmitting={isSubmitting}
            onReset={() => {
              reset(DEFAULT_VALUES);
            }}
          />
        </form>
      </Form>
    </TooltipProvider>
  );
}
