import { useSyncExternalStore } from 'react';

export interface Store<T> {
    getState(): T;
    setState(partial: Partial<T> | ((state: T) => Partial<T>)): void;
    subscribe(listener: () => void): () => void;
}

export function createStore<T>(initialState: T): Store<T> {
    let state = initialState;
    const listeners = new Set<() => void>();

    return {
        getState: () => state,
        setState: (partial) => {
            const patch = typeof partial === 'function' ? (partial as (s: T) => Partial<T>)(state) : partial;
            state = { ...state, ...patch };
            listeners.forEach(l => l());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}

export function useStore<T, U>(store: Store<T>, selector: (state: T) => U): U {
    return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
