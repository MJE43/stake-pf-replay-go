const DEFAULT_TIMEOUT = 5000;
const POLL_INTERVAL = 50;

type BindingPath = string[];

type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

function hasBinding(path: BindingPath): boolean {
  let current: any = window as any;
  for (const segment of path) {
    if (current && segment in current) {
      current = current[segment];
    } else {
      return false;
    }
  }
  return typeof current !== 'undefined';
}

export async function waitForWailsBinding<T = unknown>(
  path: BindingPath,
  options: WaitOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const intervalMs = options.intervalMs ?? POLL_INTERVAL;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (hasBinding(path)) {
      let current: any = window as any;
      for (const segment of path) {
        current = current[segment];
      }
      return current as T;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Wails binding not ready: ${path.join('.')}`);
}

export async function callWhenReady<T>(
  path: BindingPath,
  action: () => Promise<T>,
  options?: WaitOptions,
): Promise<T> {
  await waitForWailsBinding(path, options);
  return action();
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  backoffMs = 200,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        const delay = backoffMs * (i + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error('callWithRetry exhausted attempts');
}
