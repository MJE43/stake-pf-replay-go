import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import {
  IconAlertCircle,
  IconDice,
  IconDownload,
  IconHash,
  IconKey,
  IconSettings,
  IconTarget,
} from '@tabler/icons-react';
import { scanFormSchema, validateGameParams } from '@/lib/validation';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';
import { GetGames, HashServerSeed, StartScan } from '@wails/go/bindings/App';
import { games, bindings } from '@wails/go/models';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

interface GameInfo {
  id: string;
  name: string;
  metric_label: string;
}

type ScanFormFormValues = z.input<typeof scanFormSchema>;

const DEFAULT_VALUES: ScanFormFormValues = {
  serverSeed: '',
  clientSeed: '',
  nonceStart: 0,
  nonceEnd: 1000,
  game: '',
  params: {},
  targetOp: 'ge',
  targetVal: 1,
  tolerance: 0,
  limit: 1000,
  timeoutMs: 300000,
};

export function ScanForm() {
  const navigate = useNavigate();
  const [availableGames, setAvailableGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hashPreview, setHashPreview] = useState('');
  const [showHashPreview, setShowHashPreview] = useState(false);
  const [hashLoading, setHashLoading] = useState(false);
  const gameLoadAttempts = useRef(0);
  const gameRetryTimer = useRef<number | null>(null);
  const gameErrorShown = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScanFormFormValues>({
    resolver: zodResolver(scanFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const watchedGame = watch('game');
  const watchedServerSeed = watch('serverSeed');

  useEffect(() => {
    const loadGames = async () => {
      try {
        gameLoadAttempts.current += 1;
        await waitForWailsBinding(['go', 'bindings', 'App', 'GetGames'], { timeoutMs: 10_000 });
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
          toast.error('Failed to load available games, retrying...');
          gameErrorShown.current = true;
        }
        if (gameLoadAttempts.current < 6) {
          gameRetryTimer.current = window.setTimeout(loadGames, 1200);
        }
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
      default:
        setValue('params', {}, { shouldDirty: false });
    }
  }, [watchedGame, clearErrors, setValue]);

  const handleHashPreview = async () => {
    if (!watchedServerSeed.trim()) {
      toast.error('Please enter a server seed first');
      return;
    }

    setHashLoading(true);
    try {
      const hash = await HashServerSeed(watchedServerSeed);
      setHashPreview(hash);
      setShowHashPreview(true);
    } catch (error) {
      console.error('Failed to hash server seed:', error);
      toast.error('Failed to generate server seed hash');
    } finally {
      setHashLoading(false);
    }
  };

  const onSubmit = async (values: ScanFormFormValues) => {
    setLoading(true);
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

      const result = await StartScan(bindings.ScanRequest.createFrom(scanRequest));
      toast.success(`Scan started. Run ID: ${result.RunID}`);
      navigate(`/runs/${result.RunID}`);
    } catch (error: any) {
      console.error('Scan failed:', error);
      if (error?.name === 'ZodError' && Array.isArray(error.errors)) {
        error.errors.forEach((err: { path: (string | number)[]; message: string }) => {
          const field = err.path.join('.') as keyof ScanFormFormValues;
          setError(field, { message: err.message });
        });
      } else {
        toast.error(error?.message ?? 'An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const diceParams = (
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

  const limboParams = (
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

  const pumpParams = (
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

  const renderGameParams = () => {
    const selectedGame = availableGames.find((g) => g.id === watchedGame);
    if (!selectedGame) return null;

    switch (watchedGame) {
      case 'dice':
        return diceParams;
      case 'limbo':
        return limboParams;
      case 'pump':
        return pumpParams;
      case 'roulette':
        return (
          <p className="text-sm text-slate-500">
            Roulette does not require additional parameters.
          </p>
        );
      default:
        return (
          <p className="text-sm text-slate-500">
            No additional parameters required for {selectedGame.name}.
          </p>
        );
    }
  };

  const nonceStart = watch('nonceStart');
  const nonceEnd = watch('nonceEnd');
  const targetOp = watch('targetOp');
  const targetVal = watch('targetVal');
  const limit = watch('limit');

  const validationErrors = Object.entries(errors);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card className="border border-slate-200">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconKey size={18} className="text-indigo-500" />
            Seeds Configuration
            <Badge className="bg-indigo-500/10 text-indigo-600">Required</Badge>
          </CardTitle>
          <p className="text-sm text-slate-500">
            Provide the server and client seeds used for the betting session.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700">Server Seed</label>
              <div className="flex items-center gap-2">
                <Input
                  {...register('serverSeed')}
                  placeholder="Enter server seed"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleHashPreview}
                  disabled={hashLoading}
                >
                  {hashLoading ? <IconDownload size={16} className="animate-spin" /> : <IconHash size={16} />}
                </Button>
              </div>
              {errors.serverSeed && (
                <p className="text-sm text-red-600">{errors.serverSeed.message}</p>
              )}
              {showHashPreview && hashPreview && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-mono">
                  {hashPreview}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700">Client Seed</label>
              <Input
                {...register('clientSeed')}
                placeholder="Enter client seed"
              />
              {errors.clientSeed && (
                <p className="text-sm text-red-600">{errors.clientSeed.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Optional Notes</label>
            <Textarea placeholder="Describe the scan purpose or link to a ticket" rows={4} disabled className="opacity-50" />
            <p className="text-xs text-slate-400">Notes are not sent to the backend yet.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconDice size={18} className="text-orange-500" />
            Game Configuration
            <Badge className="bg-orange-500/10 text-orange-600">Game Type</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Game Type</label>
            <Controller
              name="game"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGames.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name} ({game.metric_label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.game && <p className="text-sm text-red-600">{errors.game.message}</p>}
          </div>

          {watchedGame && (
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                <IconSettings size={16} />
                {availableGames.find((g) => g.id === watchedGame)?.name} Parameters
              </div>
              {renderGameParams()}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconTarget size={18} className="text-violet-500" />
            Target Conditions
            <Badge className="bg-violet-500/10 text-violet-600">Filters</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nonce Start</label>
              <Input
                type="number"
                min={0}
                {...register('nonceStart', { valueAsNumber: true })}
                className="font-mono"
              />
              {errors.nonceStart && <p className="text-sm text-red-600">{errors.nonceStart.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nonce End</label>
              <Input
                type="number"
                min={0}
                {...register('nonceEnd', { valueAsNumber: true })}
                className="font-mono"
              />
              {errors.nonceEnd && <p className="text-sm text-red-600">{errors.nonceEnd.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Comparison</label>
              <Controller
                name="targetOp"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ge">Greater or equal (≥)</SelectItem>
                      <SelectItem value="gt">Greater than (&gt;)</SelectItem>
                      <SelectItem value="eq">Equal (=)</SelectItem>
                      <SelectItem value="le">Less or equal (≤)</SelectItem>
                      <SelectItem value="lt">Less than (&lt;)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Target Value</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                {...register('targetVal', { valueAsNumber: true })}
                className="font-mono"
              />
              {errors.targetVal && <p className="text-sm text-red-600">{errors.targetVal.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tolerance</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                {...register('tolerance', { valueAsNumber: true })}
                className="font-mono"
              />
              {errors.tolerance && <p className="text-sm text-red-600">{errors.tolerance.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconSettings size={18} className="text-slate-500" />
            Advanced Settings
            <Badge className="bg-slate-500/10 text-slate-600">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Result Limit</label>
            <Input
              type="number"
              min={1}
              max={100000}
              {...register('limit', { valueAsNumber: true })}
              className="font-mono"
            />
            {errors.limit && <p className="text-sm text-red-600">{errors.limit.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Timeout (ms)</label>
            <Input
              type="number"
              min={1000}
              max={3600000}
              step={1000}
              {...register('timeoutMs', { valueAsNumber: true })}
              className="font-mono"
            />
            {errors.timeoutMs && <p className="text-sm text-red-600">{errors.timeoutMs.message}</p>}
          </div>
        </CardContent>
      </Card>

      {validationErrors.length > 0 && (
        <Alert variant="destructive" icon={<IconAlertCircle size={18} />} title="Please fix the following errors">
          <ul className="list-disc pl-5 text-sm">
            {validationErrors.map(([field, error]) => (
              <li key={field}>
                <span className="font-medium">{field}:</span> {error?.message as string}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {watchedGame && nonceEnd !== undefined && nonceStart !== undefined && validationErrors.length === 0 && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
          <div className="font-semibold text-indigo-700">Scan Summary</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <span className="text-xs text-slate-500">Game</span>
              <div>{availableGames.find((g) => g.id === watchedGame)?.name ?? watchedGame}</div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Nonce Range</span>
              <div>{(nonceEnd - nonceStart).toLocaleString()} nonces</div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Target Condition</span>
              <div>{targetOp} {targetVal}</div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Result Limit</span>
              <div>{limit?.toLocaleString()} hits</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset(DEFAULT_VALUES);
            setHashPreview('');
            setShowHashPreview(false);
          }}
        >
          Reset
        </Button>
        <Button
          type="submit"
          size="lg"
          className="gap-2"
          disabled={loading || isSubmitting}
        >
          {loading || isSubmitting ? 'Starting Scan...' : 'Start Scan'}
        </Button>
      </div>
    </form>
  );
}
