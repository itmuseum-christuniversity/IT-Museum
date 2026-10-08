import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
    | { status: 'loading' }
    | { status: 'error'; error: Error }
    /** `refreshing` is true while a `retry()` revalidates data that is already on screen. */
    | { status: 'ready'; data: T; refreshing?: boolean };

function sameDeps(a: unknown[] | null, b: unknown[]): boolean {
    return a !== null && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/**
 * Run an async loader on mount / when deps change, with retry.
 *
 * Stale-while-revalidate: `retry()` on a ready state keeps the previous data
 * (marked `refreshing`) instead of dropping back to `loading`, so the UI does not
 * unmount and lose local state. Changing `deps` (a different resource) and
 * retrying from an error still start from `loading`.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> & { retry: () => void } {
    const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const lastDeps = useRef<unknown[] | null>(null);
    useEffect(() => {
        let alive = true;
        const revalidating = sameDeps(lastDeps.current, deps);
        lastDeps.current = deps;
        setState((s) => (revalidating && s.status === 'ready' ? { ...s, refreshing: true } : { status: 'loading' }));
        loader().then(
            (data) => alive && setState({ status: 'ready', data }),
            (error: unknown) => alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
        );
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, attempt]);
    const retry = useCallback(() => setAttempt((a) => a + 1), []);
    return { ...state, retry };
}
