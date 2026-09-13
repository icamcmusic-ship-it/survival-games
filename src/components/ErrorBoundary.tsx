import React from 'react';

/**
 * The one boundary the tree was missing.
 *
 * A throw anywhere in a screen — or a failed dynamic `import()` of the engine
 * chunk after a deploy changed the hash — was a white page, with a live save
 * sitting in storage that the reader had no way to reach. The boundary does
 * not try to be clever about recovery: the save is on disk, the store
 * rehydrates on load, so a reload *is* the recovery. It just has to say so.
 */
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Surface it for anyone with the console open; there is no server to send it to.
        console.error('Survival Games crashed:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        const chunk = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i
            .test(this.state.error.message);
        return (
            <main role="alert" className="max-w-2xl mx-auto px-4 py-16 space-y-4">
                <span className="eyebrow">Broadcast interrupted</span>
                <h1 className="text-2xl font-black text-[var(--ink)]">
                    {chunk ? 'A newer build is live.' : 'Something in the arena broke.'}
                </h1>
                <p className="text-sm text-[var(--color-ink-500)]">
                    {chunk
                        ? 'The page tried to load a part of the game that no longer exists at that address — usually because the site was updated while this tab was open. Reloading fetches the current build.'
                        : 'Your run is saved up to the last phase you played. Reloading picks it back up from there; nothing in the Hall of Fame or your record book is affected.'}
                </p>
                <pre className="text-[11px] font-mono text-[var(--color-ink-500)] whitespace-pre-wrap panel-flush p-3 max-h-40 overflow-auto">
                    {this.state.error.message}
                </pre>
                <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload and resume</button>
                    <a className="btn btn-ghost" href="#/">Back to setup</a>
                </div>
            </main>
        );
    }
}
