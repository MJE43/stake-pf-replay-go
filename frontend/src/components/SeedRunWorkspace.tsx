import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  IconArrowRight,
  IconChecks,
  IconCirclePlus,
  IconPlayerPlay,
  IconRefresh,
  IconRepeat,
} from '@tabler/icons-react';
import { StartScan, GetGames } from '@wails/go/bindings/App';
import { bindings, store } from '@wails/go/models';
import { scanFormSchema, validateGameParams } from '@/lib/validation';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import type { z } from 'zod';

interface SeedRunWorkspaceProps {
  currentRun: store.Run;
  group: bindings.SeedRunGroup;
  onRunSelected: (runId: string) => void;
  onRunCreated: (runId: string) => void;
  refreshGroup: () => Promise<void>;
  groupLoading: boolean;
}

interface GameInfo {
  id: string;
  name: string;
  metric_label: string;
}

type RerunFormValues = z.input<typeof scanFormSchema>;

const FORM_TIMEOUT_DEFAULT = 300_000;

const TARGET_OPERATORS = [
  { value: 'ge', label: '>=' },
  { value: 'gt', label: '>' },
  { value: 'eq', label: '=' },
  { value: 'le', label: '<=' },
  { value: 'lt', label: '<' },
];

function parseParams(run: store.Run): Record<string, unknown> {
  if (!run.params_json) {
    return {};
  }
  try {
    return JSON.parse(run.params_json);
  } catch (error) {
    console.warn('Failed to parse params JSON for run', run.id, error);
    return {};
  }
}

function buildDefaults(run: store.Run, seeds: bindings.SeedGroupSeeds): RerunFormValues {
  return {
    serverSeed: seeds.server ?? '',
    clientSeed: seeds.client ?? '',
    nonceStart: run.nonce_start ?? 0,
    nonceEnd: run.nonce_end ?? 0,
    game: run.game ?? '',
    params: parseParams(run),
    targetOp: (run.target_op as RerunFormValues['targetOp']) ?? 'ge',
    targetVal: run.target_val ?? 0,
    tolerance: run.tolerance ?? 0,
    limit: run.hit_limit && run.hit_limit > 0 ? run.hit_limit : 1000,
    timeoutMs: FORM_TIMEOUT_DEFAULT,
  };
}

export function SeedRunWorkspace({
  currentRun,
  group,
  onRunCreated,
  onRunSelected,
  refreshGroup,
  groupLoading,
}: SeedRunWorkspaceProps) {
  const [availableGames, setAvailableGames] = useState<GameInfo[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const runs = group.runs ?? [];

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RerunFormValues>({
    resolver: zodResolver(scanFormSchema),
    defaultValues: buildDefaults(currentRun, group.seeds),
  });

  useEffect(() => {
    reset(buildDefaults(currentRun, group.seeds));
  }, [currentRun, group.seeds, reset]);

  useEffect(() => {
    register('serverSeed');
    register('clientSeed');
  }, [register]);

  useEffect(() => {
    const loadGames = async () => {
      setLoadingGames(true);
      setFetchError(null);
      try {
        await waitForWailsBinding(['go', 'bindings', 'App', 'GetGames'], { timeoutMs: 10_000 });
        const gameSpecs = await callWithRetry(() => GetGames(), 4, 250);
        if (!Array.isArray(gameSpecs)) {
          throw new Error('Unexpected GetGames response');
        }
        const mapped: GameInfo[] = gameSpecs.map((spec) => ({
          id: spec.id,
          name: spec.name,
          metric_label: spec.metric_label,
        }));
        setAvailableGames(mapped);
      } catch (error) {
        console.error('Failed to load game list', error);
        setFetchError('Failed to load games');
        toast.error('Unable to load available games');
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
  }, []);

  const watchedGame = watch('game');
  const watchedParams = watch('params');

  useEffect(() => {
    if (!watchedGame) {
      return;
    }
    clearErrors('params');
    switch (watchedGame) {
      case 'dice':
        if (watchedParams?.target === undefined) {
          setValue('params.target', 50, { shouldDirty: false });
        }
        if (watchedParams?.condition === undefined) {
          setValue('params.condition', 'over', { shouldDirty: false });
        }
        break;
      case 'limbo':
        if (watchedParams?.houseEdge === undefined) {
          setValue('params.houseEdge', 0.99, { shouldDirty: false });
        }
        break;
      case 'pump':
        if (watchedParams?.difficulty === undefined) {
          setValue('params.difficulty', 'expert', { shouldDirty: false });
        }
        break;
      case 'plinko':
        if (watchedParams?.risk === undefined) {
          setValue('params.risk', 'medium', { shouldDirty: false });
        }
        if (watchedParams?.rows === undefined) {
          setValue('params.rows', 16, { shouldDirty: false });
        }
        break;
      default:
        break;
    }
  }, [watchedGame, watchedParams, clearErrors, setValue]);

  const runsByGame = useMemo(() => {
    const map = new Map<string, store.Run[]>();
    for (const run of runs) {
      const existing = map.get(run.game) ?? [];
      existing.push(run);
      map.set(run.game, existing);
    }
    return map;
  }, [runs]);

  const matchingRuns = watchedGame ? runsByGame.get(watchedGame) ?? [] : [];

  const onSubmit = async (values: RerunFormValues) => {
    try {
      const parsed = scanFormSchema.parse(values);
      const paramsSchema = validateGameParams(parsed.game, parsed.params);
      const validatedParams = paramsSchema.parse(parsed.params ?? {});

      const scanRequest = {
        Game: parsed.game,
        Seeds: {
          Server: parsed.serverSeed,
          Client: parsed.clientSeed,
        },
        NonceStart: parsed.nonceStart,
        NonceEnd: parsed.nonceEnd,
        Params: validatedParams,
        TargetOp: parsed.targetOp,
        TargetVal: parsed.targetVal,
        Tolerance: parsed.tolerance,
        Limit: parsed.limit,
        TimeoutMs: parsed.timeoutMs,
      };

      const result = await StartScan(bindings.ScanRequest.createFrom(scanRequest));
      toast.success(`Scan started. Run ID: ${result.RunID}`);
      refreshGroup().catch((error) => console.warn('Failed to refresh seed group', error));
      onRunCreated(result.RunID);
    } catch (error: any) {
      console.error('Seed rerun failed', error);
      if (error?.name === 'ZodError' && Array.isArray(error.errors)) {
        error.errors.forEach((issue: { path: (string | number)[]; message: string }) => {
          const joined = issue.path.join('.') as keyof RerunFormValues;
          setError(joined, { message: issue.message });
        });
      } else {
        toast.error(error?.message ?? 'Failed to start scan');
      }
    }
  };

  const nonceStart = watch('nonceStart');
  const nonceEnd = watch('nonceEnd');

  const renderGameParams = () => {
    switch (watchedGame) {
      case 'dice':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="params.target"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Target</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={99.99}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                    className="font-mono"
                  />
                  {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
                </div>
              )}
            />
            <Controller
              name="params.condition"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Condition</label>
                  <Select value={(field.value as string) ?? 'over'} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="over">Over</SelectItem>
                      <SelectItem value="under">Under</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
                </div>
              )}
            />
          </div>
        );
      case 'limbo':
        return (
          <Controller
            name="params.houseEdge"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">House Edge</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={1}
                  value={field.value ?? 0.99}
                  onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                  className="max-w-xs font-mono"
                  placeholder="0.99"
                />
                {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
              </div>
            )}
          />
        );
      case 'pump':
        return (
          <Controller
            name="params.difficulty"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Difficulty</label>
                <Select value={(field.value as string) ?? 'expert'} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy (1 POP token)</SelectItem>
                    <SelectItem value="medium">Medium (3 POP tokens)</SelectItem>
                    <SelectItem value="hard">Hard (5 POP tokens)</SelectItem>
                    <SelectItem value="expert">Expert (10 POP tokens)</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
              </div>
            )}
          />
        );
      case 'plinko':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="params.risk"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Risk</label>
                  <Select value={(field.value as string) ?? 'medium'} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
                </div>
              )}
            />
            <Controller
              name="params.rows"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Rows</label>
                  <Input
                    type="number"
                    min={8}
                    max={16}
                    step={1}
                    value={field.value ?? 16}
                    onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
                    className="max-w-xs font-mono"
                    placeholder="16"
                  />
                  <p className="text-xs text-slate-500">Plinko allows 8 to 16 rows (pins).</p>
                  {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
                </div>
              )}
            />
          </div>
        );
      case 'roulette':
        return <p className="text-sm text-slate-500">Roulette does not require additional parameters.</p>;
      default:
        return null;
    }
  };

  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <IconRepeat size={18} className="text-indigo-500" />
          Seed Workspace
        </CardTitle>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <Badge variant="outline" className="border-slate-300 font-mono text-[11px]">
            Hash: {group.seeds.serverHash?.slice(0, 16) ?? '--'}...
          </Badge>
          {group.seeds.server && (
            <Badge variant="outline" className="border-slate-300 font-mono text-[11px]">
              Server: {group.seeds.server.slice(0, 12)}...
            </Badge>
          )}
          <Badge variant="outline" className="border-slate-300 font-mono text-[11px]">
            Client: {group.seeds.client}
          </Badge>
          <Badge className="bg-indigo-500/10 text-indigo-600">
            {runs.length} run{runs.length === 1 ? '' : 's'}
          </Badge>
          {groupLoading && (
            <Badge variant="outline" className="border-indigo-200 text-indigo-600">
              Refreshing...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <IconChecks size={16} className="text-emerald-500" />
            <span>Existing variations for this seed pair</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {runs.map((run) => (
              <Button
                key={run.id}
                variant={run.id === currentRun.id ? 'default' : 'outline'}
                size="sm"
                className="gap-2 text-xs"
                onClick={() => onRunSelected(run.id)}
              >
                <Badge className="bg-indigo-500/10 text-indigo-600 uppercase">{run.game}</Badge>
                <span>{new Date(run.created_at).toLocaleDateString()}</span>
                {run.id === currentRun.id ? (
                  <IconChecks size={14} />
                ) : (
                  <IconArrowRight size={14} />
                )}
              </Button>
            ))}
            {runs.length === 0 && (
              <Badge className="bg-slate-500/10 text-slate-600">No previous runs yet</Badge>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <IconCirclePlus size={18} className="text-indigo-500" />
              <span>Start another scan with these seeds</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={loadingGames || groupLoading}
              onClick={() => {
                refreshGroup().catch((error) => console.warn('Failed to refresh seed group', error));
              }}
            >
              <IconRefresh size={14} className={groupLoading ? 'animate-spin' : undefined} />
              {groupLoading ? 'Refreshing...' : 'Refresh list'}
            </Button>
          </div>

          {fetchError && (
            <Alert variant="destructive" title="Unable to load games">
              {fetchError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register('serverSeed')} />
            <input type="hidden" {...register('clientSeed')} />

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="game"
                control={control}
                render={({ field, fieldState }) => (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Game</label>
                    <Select value={field.value} onValueChange={field.onChange} disabled={loadingGames}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingGames ? 'Loading games...' : 'Select game'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGames.map((game) => (
                          <SelectItem key={game.id} value={game.id}>
                            {game.name}
                          </SelectItem>
                        ))}
                        {availableGames.length === 0 && !loadingGames && currentRun.game && (
                          <SelectItem value={currentRun.game}>{currentRun.game}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <p className="text-sm text-red-600">{fieldState.error.message}</p>}
                    {matchingRuns.length > 0 && (
                      <Alert variant="default" className="bg-indigo-50 text-indigo-700">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {matchingRuns.length} run{matchingRuns.length === 1 ? '' : 's'} already exist for this game.
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => onRunSelected(matchingRuns[0].id)}
                          >
                            <IconPlayerPlay size={14} /> View latest
                          </Button>
                        </div>
                      </Alert>
                    )}
                  </div>
                )}
              />

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Nonce Range</label>
                <div className="flex items-center gap-3">
                  <Input type="number" className="font-mono" {...register('nonceStart', { valueAsNumber: true })} />
                  <span className="text-xs text-slate-500">to</span>
                  <Input type="number" className="font-mono" {...register('nonceEnd', { valueAsNumber: true })} />
                </div>
                <p className="text-xs text-slate-500">
                  Evaluating {Math.max(0, (nonceEnd ?? 0) - (nonceStart ?? 0)).toLocaleString()} nonces
                </p>
                {errors.nonceStart && <p className="text-sm text-red-600">{errors.nonceStart.message}</p>}
                {errors.nonceEnd && <p className="text-sm text-red-600">{errors.nonceEnd.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Target Operator</label>
                <Controller
                  name="targetOp"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_OPERATORS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Target Value</label>
                <Input type="number" step="0.0001" className="font-mono" {...register('targetVal', { valueAsNumber: true })} />
                {errors.targetVal && <p className="text-sm text-red-600">{errors.targetVal.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tolerance</label>
                <Input type="number" step="0.0001" className="font-mono" {...register('tolerance', { valueAsNumber: true })} />
                {errors.tolerance && <p className="text-sm text-red-600">{errors.tolerance.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Hit Limit</label>
                <Input type="number" className="font-mono" {...register('limit', { valueAsNumber: true })} />
                {errors.limit && <p className="text-sm text-red-600">{errors.limit.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Timeout (ms)</label>
                <Input type="number" className="font-mono" {...register('timeoutMs', { valueAsNumber: true })} />
                {errors.timeoutMs && <p className="text-sm text-red-600">{errors.timeoutMs.message}</p>}
              </div>
            </div>

            {renderGameParams()}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="gap-2" disabled={isSubmitting}>
                <IconRepeat size={16} />
                {isSubmitting ? 'Starting scan...' : 'Start scan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => reset(buildDefaults(currentRun, group.seeds))}
                disabled={isSubmitting}
              >
                <IconRefresh size={14} /> Reset to current run
              </Button>
            </div>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}
