/**
 * ScriptPage
 *
 * Minimal scripting interface for the bot2love-compatible scripting engine.
 * Provides a code editor, start/stop controls, live stats, and a log panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconTerminal2,
  IconCode,
  IconChartLine,
  IconActivity,
  IconClock,
  IconTrophy,
  IconMoodSad,
  IconArrowUpRight,
  IconArrowDownRight,
  IconFlame,
  IconTrash,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Types matching Go ScriptState
interface ScriptState {
  state: 'idle' | 'running' | 'stopped' | 'error';
  error?: string;
  bets: number;
  wins: number;
  losses: number;
  profit: number;
  balance: number;
  wagered: number;
  winStreak: number;
  loseStreak: number;
  currentGame: string;
  betsPerSecond: number;
  chart?: { x: number; y: number; win: boolean }[];
}

interface LogEntry {
  time: string;
  message: string;
}

const DEFAULT_SCRIPT = `// Martingale strategy - Dice
game = "dice"
chance = 49.5
bethigh = true
basebet = 0.00000001
nextbet = basebet
currency = "trx"

dobet = function() {
  if (win) {
    nextbet = basebet
  } else {
    nextbet = previousbet * 2
  }
}
`;

// Lazy-load Wails bindings
let scriptBindingsPromise: Promise<typeof import('@wails/go/bindings/ScriptModule')> | null = null;
const getScriptBindings = () => {
  if (!scriptBindingsPromise) scriptBindingsPromise = import('@wails/go/bindings/ScriptModule');
  return scriptBindingsPromise;
};

export function ScriptPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [selectedGame, setSelectedGame] = useState('dice');
  const [selectedCurrency, setSelectedCurrency] = useState('trx');
  const [startBalance, setStartBalance] = useState(1.0);
  const [state, setState] = useState<ScriptState>({
    state: 'idle',
    bets: 0, wins: 0, losses: 0, profit: 0, balance: 0,
    wagered: 0, winStreak: 0, loseStreak: 0,
    currentGame: '', betsPerSecond: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Poll script state while running
  const pollState = useCallback(async () => {
    try {
      const { GetScriptState, GetScriptLog } = await getScriptBindings();
      const [newState, newLogs] = await Promise.all([
        GetScriptState(),
        GetScriptLog(),
      ]);
      setState(newState as unknown as ScriptState);
      if (newLogs && Array.isArray(newLogs)) {
        setLogs(newLogs as LogEntry[]);
      }
    } catch {
      // Bindings not ready yet
    }
  }, []);

  useEffect(() => {
    if (state.state === 'running') {
      pollRef.current = window.setInterval(pollState, 500);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.state, pollState]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      const { StartScript } = await getScriptBindings();
      await StartScript(script, selectedGame, selectedCurrency, startBalance);
      setState(prev => ({ ...prev, state: 'running' }));
      toast.success('Script started');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start script');
    } finally {
      setStarting(false);
    }
  }, [script, selectedGame, selectedCurrency, startBalance]);

  const handleStop = useCallback(async () => {
    try {
      const { StopScript } = await getScriptBindings();
      await StopScript();
      // Do a final poll to get final state
      await pollState();
      toast.success('Script stopped');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to stop script');
    }
  }, [pollState]);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const isRunning = state.state === 'running';
  const winRate = state.bets > 0 ? ((state.wins / state.bets) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/5 text-primary">
            <IconCode size={20} />
          </div>
          <div>
            <h1 className="font-display text-sm uppercase tracking-wider text-foreground">Script Engine</h1>
            <p className="text-xs text-muted-foreground">bot2love-compatible betting automation</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={cn(
          'flex items-center gap-2 border px-3 py-1.5 font-mono text-xs uppercase tracking-wider',
          state.state === 'running' && 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
          state.state === 'idle' && 'border-border bg-muted/30 text-muted-foreground',
          state.state === 'stopped' && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
          state.state === 'error' && 'border-red-500/30 bg-red-500/10 text-red-400',
        )}>
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            state.state === 'running' && 'bg-cyan-400 animate-pulse',
            state.state === 'idle' && 'bg-muted-foreground',
            state.state === 'stopped' && 'bg-amber-400',
            state.state === 'error' && 'bg-red-400',
          )} />
          {state.state}
        </div>
      </div>

      {/* Error display */}
      {state.error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-400">
          {state.error}
        </div>
      )}

      {/* Main grid: Editor + Stats */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Editor panel */}
        <div className="flex flex-col gap-3">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between border border-border bg-muted/30 px-4 py-2">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <IconTerminal2 size={12} />
              Script Editor
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                disabled={isRunning}
                className="h-7 border border-border bg-background px-2 font-mono text-[11px] uppercase tracking-wider text-foreground"
              >
                <option value="dice">Dice</option>
                <option value="limbo">Limbo</option>
                <option value="wheel">Wheel</option>
                <option value="keno">Keno</option>
                <option value="mines">Mines</option>
                <option value="plinko">Plinko</option>
                <option value="hilo">HiLo</option>
                <option value="blackjack">Blackjack</option>
                <option value="baccarat">Baccarat</option>
              </select>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                disabled={isRunning}
                className="h-7 border border-border bg-background px-2 font-mono text-[11px] uppercase tracking-wider text-foreground"
              >
                <option value="trx">TRX</option>
                <option value="usdc">USDC</option>
                <option value="btc">BTC</option>
                <option value="eth">ETH</option>
              </select>
              <input
                type="number"
                min={0.00000001}
                step={0.00000001}
                value={startBalance}
                onChange={(e) => setStartBalance(Number(e.target.value))}
                disabled={isRunning}
                className="h-7 w-24 border border-border bg-background px-2 font-mono text-[11px] text-foreground"
                title="Starting balance"
              />
              {!isRunning ? (
                <Button
                  size="sm"
                  className="btn-terminal gap-2 h-7 text-xs"
                  onClick={handleStart}
                  disabled={starting || !script.trim()}
                >
                  {starting ? (
                    <IconActivity size={12} className="animate-spin" />
                  ) : (
                    <IconPlayerPlay size={12} />
                  )}
                  {starting ? 'Starting...' : 'Run'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2 h-7 text-xs"
                  onClick={handleStop}
                >
                  <IconPlayerStop size={12} />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Code editor (textarea for now; Monaco later) */}
          <textarea
            ref={textareaRef}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            disabled={isRunning}
            spellCheck={false}
            className={cn(
              'min-h-[400px] w-full resize-y border border-border bg-[hsl(var(--card))] p-4',
              'font-mono text-sm leading-relaxed text-foreground',
              'placeholder:text-muted-foreground/50',
              'focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20',
              'scrollbar-thin',
              isRunning && 'opacity-60 cursor-not-allowed',
            )}
            placeholder="// Write your betting script here..."
          />

          {/* Log panel */}
          <div className="flex flex-col border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <IconTerminal2 size={12} />
                Log Output
                {logs.length > 0 && (
                  <span className="text-primary">{logs.length}</span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleClearLogs}
              >
                <IconTrash size={12} />
              </Button>
            </div>
            <div className="h-[180px] overflow-y-auto bg-[hsl(var(--card))] p-3 scrollbar-thin">
              {logs.length === 0 ? (
                <span className="font-mono text-xs text-muted-foreground/50">
                  Script output will appear here...
                </span>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="font-mono text-xs leading-relaxed">
                    <span className="text-muted-foreground/60">
                      [{new Date(entry.time).toLocaleTimeString()}]
                    </span>{' '}
                    <span className="text-foreground">{entry.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Stats panel */}
        <div className="flex flex-col gap-3">
          {/* Session stats */}
          <div className="border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Session Stats
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              <StatCell
                icon={IconActivity}
                label="Bets"
                value={state.bets.toLocaleString()}
              />
              <StatCell
                icon={IconFlame}
                label="Speed"
                value={`${state.betsPerSecond.toFixed(1)}/s`}
              />
              <StatCell
                icon={IconTrophy}
                label="Wins"
                value={state.wins.toLocaleString()}
                accent="cyan"
              />
              <StatCell
                icon={IconMoodSad}
                label="Losses"
                value={state.losses.toLocaleString()}
                accent="red"
              />
              <StatCell
                icon={IconArrowUpRight}
                label="Win Rate"
                value={`${winRate}%`}
                accent="cyan"
              />
              <StatCell
                icon={IconClock}
                label="Game"
                value={state.currentGame || '—'}
              />
            </div>
          </div>

          {/* Financial stats */}
          <div className="border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Financials
              </span>
            </div>
            <div className="space-y-0 divide-y divide-border">
              <FinancialRow
                label="Profit"
                value={state.profit}
                format="signed"
              />
              <FinancialRow
                label="Balance"
                value={state.balance}
                format="plain"
              />
              <FinancialRow
                label="Wagered"
                value={state.wagered}
                format="plain"
              />
            </div>
          </div>

          {/* Streak stats */}
          <div className="border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Streaks
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              <StatCell
                icon={IconArrowUpRight}
                label="Win Streak"
                value={state.winStreak.toString()}
                accent="cyan"
              />
              <StatCell
                icon={IconArrowDownRight}
                label="Lose Streak"
                value={state.loseStreak.toString()}
                accent="red"
              />
            </div>
          </div>

          {/* Mini chart placeholder */}
          <div className="border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <IconChartLine size={12} />
                Profit Chart
              </span>
            </div>
            <div className="h-[120px] p-3">
              {state.chart && state.chart.length > 1 ? (
                <MiniChart data={state.chart} />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground/50">
                  Chart data will appear after bets...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: 'cyan' | 'red' | 'amber';
}) {
  const accentClass = {
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  };

  return (
    <div className="bg-background p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={10} className="text-muted-foreground" />
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <span className={cn(
        'font-mono text-sm font-semibold',
        accent ? accentClass[accent] : 'text-foreground'
      )}>
        {value}
      </span>
    </div>
  );
}

function FinancialRow({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: 'signed' | 'plain';
}) {
  const formatted = format === 'signed'
    ? (value >= 0 ? '+' : '') + value.toFixed(8)
    : value.toFixed(8);

  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn(
        'font-mono text-xs font-semibold',
        format === 'signed' && value > 0 && 'text-cyan-400',
        format === 'signed' && value < 0 && 'text-red-400',
        format === 'signed' && value === 0 && 'text-muted-foreground',
        format === 'plain' && 'text-foreground',
      )}>
        {formatted}
      </span>
    </div>
  );
}

function MiniChart({ data }: { data: { x: number; y: number; win: boolean }[] }) {
  if (data.length < 2) return null;

  const width = 280;
  const height = 100;
  const padding = 4;

  const minY = Math.min(...data.map(d => d.y));
  const maxY = Math.max(...data.map(d => d.y));
  const rangeY = maxY - minY || 1;

  const points = data.map((d, i) => {
    const x = padding + ((width - padding * 2) * i) / (data.length - 1);
    const y = height - padding - ((d.y - minY) / rangeY) * (height - padding * 2);
    return `${x},${y}`;
  });

  // Find zero line
  const zeroY = height - padding - ((0 - minY) / rangeY) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      {/* Zero line */}
      {minY < 0 && maxY > 0 && (
        <line
          x1={padding}
          y1={zeroY}
          x2={width - padding}
          y2={zeroY}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeDasharray="2,2"
        />
      )}
      {/* Profit line */}
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
    </svg>
  );
}

export default ScriptPage;
