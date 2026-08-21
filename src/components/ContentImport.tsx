import React, { useId, useState } from 'react';
import {
    CustomContent, clearCustomContent, exampleCustomContent, importCustomContent, readCustomContent,
} from '../utils/customContent';

/**
 * §10.2: "player-authored content hooks — let players add name pools, traits
 * or arenas via JSON import. `HofTransfer` proves the import/export pattern
 * already works."
 *
 * This is that, scoped to the pools where a bad import can only ever produce
 * an odd sentence rather than a broken run: names, quirks and ambient lines.
 * The format documents itself through the example, and the current counts are
 * shown so a player can tell whether their pack actually took.
 */
export function ContentImport() {
    const [content, setContent] = useState<CustomContent>(() => readCustomContent());
    const [open, setOpen] = useState(false);
    const [pasted, setPasted] = useState('');
    const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
    const pasteId = useId();
    const fileId = useId();

    const total = content.names.length + content.quirks.length + content.ambient.length;

    const apply = (text: string) => {
        const result = importCustomContent(text);
        setStatus({ ok: result.ok, message: result.message });
        if (result.ok) {
            setContent(readCustomContent());
            setPasted('');
        }
    };

    return (
        <div className="panel-flush p-4 space-y-2">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
                <span className="eyebrow">Your own content</span>
                <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    aria-expanded={open}
                    onClick={() => setOpen(v => !v)}
                >
                    {open ? 'Close' : total > 0 ? `${total} added` : 'Add your own'}
                </button>
            </div>
            <p className="text-[11px] text-[var(--color-ink-500)]">
                Names, quirks and ambient lines you write yourself, drawn alongside the built-in pools from the
                next Games onward. {total > 0
                    ? `Currently holding ${content.names.length} names, ${content.quirks.length} quirks and ${content.ambient.length} ambient lines.`
                    : 'Nothing added yet.'}
            </p>

            {open && (
                <div className="space-y-2 pt-1">
                    <label htmlFor={pasteId} className="eyebrow block">Paste a pack</label>
                    <textarea
                        id={pasteId}
                        value={pasted}
                        onChange={e => setPasted(e.target.value)}
                        rows={5}
                        spellCheck={false}
                        placeholder={exampleCustomContent()}
                        className="field text-[11px] font-mono w-full"
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            type="button"
                            className="btn btn-sm"
                            disabled={pasted.trim().length === 0}
                            onClick={() => apply(pasted)}
                        >
                            Add these
                        </button>
                        <label htmlFor={fileId} className="btn btn-sm btn-ghost cursor-pointer">
                            Load a file
                            <input
                                id={fileId}
                                type="file"
                                accept="application/json,.json"
                                className="sr-only"
                                onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    apply(await file.text());
                                    // Let the same file be chosen twice in a row.
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        {total > 0 && (
                            <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => {
                                    clearCustomContent();
                                    setContent(readCustomContent());
                                    setStatus({ ok: true, message: 'Your added content has been cleared.' });
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {status && (
                        <p
                            role="status"
                            className="text-[11px]"
                            style={{ color: status.ok ? 'var(--cat-alliance)' : 'var(--red)' }}
                        >
                            {status.message}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
