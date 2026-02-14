/**
 * SettingsPage
 *
 * Session token management for the Stake API.
 * Users can connect their account by pasting their x-access-token.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  IconPlug,
  IconPlugOff,
  IconShieldCheck,
  IconAlertTriangle,
  IconCurrencyBitcoin,
  IconLoader2,
  IconLock,
  IconExternalLink,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface SessionStatus {
  connected: boolean;
  domain: string;
  currency: string;
  hasToken: boolean;
  error?: string;
  balances?: { currency: string; available: number; vault: number }[];
}

// Lazy-load Wails bindings
let sessionBindingsPromise: Promise<typeof import('@wails/go/bindings/SessionModule')> | null = null;
const getSessionBindings = () => {
  if (!sessionBindingsPromise) sessionBindingsPromise = import('@wails/go/bindings/SessionModule');
  return sessionBindingsPromise;
};

const DOMAIN_OPTIONS = [
  { value: 'stake.com', label: 'stake.com' },
  { value: 'stake.us', label: 'stake.us' },
];

const CURRENCY_OPTIONS = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'ltc', label: 'LTC' },
  { value: 'trx', label: 'TRX' },
  { value: 'usdc', label: 'USDC' },
  { value: 'doge', label: 'DOGE' },
  { value: 'xrp', label: 'XRP' },
];

export function SettingsPage() {
  const [token, setToken] = useState('');
  const [domain, setDomain] = useState('stake.com');
  const [currency, setCurrency] = useState('btc');
  const [status, setStatus] = useState<SessionStatus>({
    connected: false,
    domain: 'stake.com',
    currency: 'btc',
    hasToken: false,
  });
  const [connecting, setConnecting] = useState(false);

  // Fetch session status on mount
  useEffect(() => {
    (async () => {
      try {
        const { GetSessionStatus } = await getSessionBindings();
        const s = await GetSessionStatus();
        setStatus(s as unknown as SessionStatus);
        if (s.domain) setDomain(s.domain);
        if (s.currency) setCurrency(s.currency);
      } catch {
        // Bindings not ready
      }
    })();
  }, []);

  const handleConnect = useCallback(async () => {
    if (!token.trim()) {
      toast.error('Please enter your session token');
      return;
    }
    setConnecting(true);
    try {
      const { SetSessionToken } = await getSessionBindings();
      const result = await SetSessionToken(token, domain, currency);
      setStatus(result as unknown as SessionStatus);
      if ((result as any).connected) {
        toast.success('Connected to Stake API');
        setToken(''); // Clear token from UI for security
      } else {
        toast.error(`Connection failed: ${(result as any).error || 'unknown error'}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [token, domain, currency]);

  const handleDisconnect = useCallback(async () => {
    try {
      const { Disconnect } = await getSessionBindings();
      await Disconnect();
      setStatus({ connected: false, domain, currency, hasToken: false });
      toast.success('Disconnected');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to disconnect');
    }
  }, [domain, currency]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/5 text-primary">
          <IconLock size={20} />
        </div>
        <div>
          <h1 className="font-display text-sm uppercase tracking-wider text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your Stake API session</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={cn(
        'border p-4 space-y-3',
        status.connected
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-border bg-muted/20',
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.connected ? (
              <IconShieldCheck size={16} className="text-emerald-400" />
            ) : (
              <IconPlugOff size={16} className="text-muted-foreground" />
            )}
            <span className="font-mono text-xs uppercase tracking-wider">
              {status.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          {status.connected && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {status.domain}
            </span>
          )}
        </div>

        {/* Balance display when connected */}
        {status.connected && status.balances && status.balances.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 pt-2 border-t border-border/50">
            {status.balances
              .filter(b => b.available > 0 || b.vault > 0)
              .slice(0, 6)
              .map(b => (
                <div key={b.currency} className="flex items-center gap-2 bg-background/50 p-2">
                  <IconCurrencyBitcoin size={12} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {b.currency}
                    </div>
                    <div className="font-mono text-xs text-foreground truncate">
                      {b.available.toFixed(8)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {status.error && (
          <div className="flex items-start gap-2 pt-2 border-t border-red-500/20">
            <IconAlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <span className="font-mono text-xs text-red-400">{status.error}</span>
          </div>
        )}
      </div>

      {/* Connection form */}
      {!status.connected && (
        <div className="border border-border space-y-4 p-4">
          <div className="flex items-center gap-2 mb-2">
            <IconPlug size={14} className="text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Connect to Stake
            </span>
          </div>

          {/* Security notice */}
          <div className="border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <IconAlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-300/80 space-y-1">
                <p className="font-semibold text-amber-300">Security Notice</p>
                <p>Your session token is stored in memory only and is never written to disk. 
                  It will be cleared when the application closes.</p>
                <p>Extract your token from the <code className="text-amber-200 bg-amber-500/10 px-1">session</code> cookie 
                  in your browser's developer tools while logged into Stake.</p>
              </div>
            </div>
          </div>

          {/* Domain selector */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Domain
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full h-9 border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              {DOMAIN_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Currency selector */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Default Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              {CURRENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Token input */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Session Token (x-access-token)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your session token here..."
              className={cn(
                'w-full h-9 border border-border bg-background px-3',
                'font-mono text-sm text-foreground placeholder:text-muted-foreground/40',
                'focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20',
              )}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              Find this in your browser's cookies or DevTools (Application &gt; Cookies &gt; session)
            </p>
          </div>

          {/* Connect button */}
          <Button
            className="w-full btn-terminal gap-2"
            onClick={handleConnect}
            disabled={connecting || !token.trim()}
          >
            {connecting ? (
              <>
                <IconLoader2 size={14} className="animate-spin" />
                Testing connection...
              </>
            ) : (
              <>
                <IconPlug size={14} />
                Connect
              </>
            )}
          </Button>
        </div>
      )}

      {/* Disconnect button when connected */}
      {status.connected && (
        <Button
          variant="outline"
          className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={handleDisconnect}
        >
          <IconPlugOff size={14} />
          Disconnect Session
        </Button>
      )}

      {/* About section */}
      <div className="border border-border p-4 space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          About
        </span>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">WEN?</strong> is a privacy-focused desktop application
            for provable fairness analysis. All data is processed locally.
          </p>
          <p>
            Server seeds are never transmitted over the network.
            Session tokens are stored in memory only.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-primary/80 hover:text-primary transition-colors"
            onClick={(e) => { e.preventDefault(); }}
          >
            <IconExternalLink size={12} />
            Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
