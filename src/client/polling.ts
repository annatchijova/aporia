/** Keep at most one refresh request in flight for each mounted view. */
export function pollAfterCompletion(intervalMs: number, refresh: (isActive: () => boolean) => Promise<void>): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    try {
      await refresh(() => active);
    } finally {
      if (active) timer = setTimeout(() => void run(), intervalMs);
    }
  };

  void run();
  return () => {
    active = false;
    if (timer !== undefined) clearTimeout(timer);
  };
}
