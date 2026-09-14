import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A piece of state that returns to a resting value after a moment — a "Copied"
 * label, a "Saved" tick, a flash of "Copy failed".
 *
 * Every one of these was written inline as `setState(x); setTimeout(() =>
 * setState(idle), n)` in a click handler, with no cleanup: the timer outlived
 * the component whenever the reader closed the dialog, navigated away or ended
 * the run inside the window, and fired a state update into an unmounted tree.
 * Holding the handle in a ref means a second click restarts the clock instead
 * of leaving two timers racing, and unmounting cancels it.
 */
export function useTransientFlag<T>(resting: T, ms: number): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(resting);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const flash = useCallback((next: T) => {
        window.clearTimeout(timer.current);
        setValue(next);
        timer.current = window.setTimeout(() => setValue(resting), ms);
    }, [resting, ms]);

    return [value, flash];
}
