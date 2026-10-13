import { afterEach, describe, expect, it, vi } from 'vitest';
import { pollAfterCompletion } from './polling';

describe('pollAfterCompletion', () => {
  afterEach(() => vi.useRealTimers());

  it('waits for a refresh to finish before starting the next one', async () => {
    vi.useFakeTimers();
    let finishRefresh: (() => void) | undefined;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finishRefresh = resolve; }));
    const stop = pollAfterCompletion(2_000, refresh);

    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    finishRefresh?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
    finishRefresh?.();
  });

  it('does not schedule another refresh after the view unmounts', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const stop = pollAfterCompletion(2_000, refresh);
    await Promise.resolve();

    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('marks an in-flight response inactive after cleanup', async () => {
    vi.useFakeTimers();
    let finishRefresh: (() => void) | undefined;
    let responseIsActive: (() => boolean) | undefined;
    const refresh = vi.fn((isActive: () => boolean) => new Promise<void>((resolve) => {
      responseIsActive = isActive;
      finishRefresh = resolve;
    }));
    const stop = pollAfterCompletion(2_000, refresh);

    stop();
    expect(responseIsActive?.()).toBe(false);
    finishRefresh?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
