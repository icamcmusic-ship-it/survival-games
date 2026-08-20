import React, { useId, useMemo, useState } from 'react';
import { HallOfFameEntry } from '../models/types';
import { importHallOfFame, serializeHallOfFame } from '../utils/hofStorage';
import { Download, Upload, Copy, Check } from 'lucide-react';

interface Props {
    entries: HallOfFameEntry[];
    onImported: (entries: HallOfFameEntry[]) => void;
}

/**
 * Backup and restore for the archive.
 *
 * The download is offered but never relied on: this app is frequently viewed inside
 * sandboxed iframes where script-initiated downloads and `<a download>` are silently
 * dropped, so the raw JSON is always on screen in a readonly textarea with a copy
 * button. A player can get their records out even when the browser refuses the file.
 */
export function HofTransfer({ entries, onImported }: Props) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [pasted, setPasted] = useState('');
    const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
    const exportId = useId();
    const importId = useId();
    const fileId = useId();

    const json = useMemo(() => serializeHallOfFame(entries), [entries]);

    const download = () => {
        try {
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `hall-of-fame-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 0);
            setStatus({ ok: true, message: 'Download requested. If nothing saved, your browser blocked it — copy the JSON below instead.' });
        } catch {
            setStatus({ ok: false, message: 'This browser blocked the download. Copy the JSON below instead.' });
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard?.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setStatus({ ok: false, message: 'Clipboard unavailable. Select the JSON below and copy it manually.' });
        }
    };

    const runImport = (raw: string) => {
        const result = importHallOfFame(raw, entries);
        setStatus({ ok: result.ok, message: result.message });
        if (result.ok) {
            onImported(result.entries);
            setPasted('');
        }
    };

    const readFile = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => runImport(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => setStatus({ ok: false, message: 'Could not read that file.' });
        reader.readAsText(file);
    };

    return (
        <section className="panel p-5 space-y-4" aria-labelledby={`${exportId}-title`}>
            <div className="flex items-center justify-between gap-3">
                <h3 id={`${exportId}-title`} className="panel-title">Backup &amp; restore</h3>
                <button
                    onClick={() => setOpen(o => !o)}
                    className="btn btn-sm"
                    aria-expanded={open}
                    aria-controls={`${exportId}-body`}
                >
                    {open ? 'Hide' : 'Open'}
                </button>
            </div>

            {open && (
                <div id={`${exportId}-body`} className="space-y-5 animate-fadeIn">
                    <p className="text-sm text-[var(--color-ink-400)]">
                        The archive keeps only the 50 most recent victors. Export before a favourite is evicted.
                    </p>

                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <button onClick={download} className="btn btn-sm btn-primary" disabled={entries.length === 0}>
                                <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download .json
                            </button>
                            <button onClick={copy} className="btn btn-sm" disabled={entries.length === 0}>
                                {copied
                                    ? <><Check className="w-3.5 h-3.5" aria-hidden="true" /> Copied</>
                                    : <><Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy JSON</>}
                            </button>
                        </div>
                        <label htmlFor={`${exportId}-text`} className="eyebrow block">Export data (read only)</label>
                        <textarea
                            id={`${exportId}-text`}
                            readOnly
                            value={json}
                            rows={6}
                            spellCheck={false}
                            onFocus={e => e.currentTarget.select()}
                            className="field custom-scrollbar text-xs"
                        />
                    </div>

                    <div className="space-y-2 pt-4 border-t border-[var(--color-ink-800)]">
                        <label htmlFor={importId} className="eyebrow block">Import — paste exported JSON</label>
                        <textarea
                            id={importId}
                            value={pasted}
                            onChange={e => setPasted(e.target.value)}
                            rows={4}
                            spellCheck={false}
                            placeholder='[{ "id": "…", "winnerName": "…" }]'
                            className="field custom-scrollbar text-xs"
                        />
                        <div className="flex flex-wrap gap-2 items-center">
                            <button onClick={() => runImport(pasted)} className="btn btn-sm btn-primary" disabled={pasted.trim() === ''}>
                                <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Import pasted JSON
                            </button>
                            <label htmlFor={fileId} className="btn btn-sm cursor-pointer">
                                <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Choose file…
                            </label>
                            <input
                                id={fileId}
                                type="file"
                                accept="application/json,.json"
                                className="sr-only"
                                onChange={e => {
                                    readFile(e.target.files?.[0]);
                                    // Reset so re-picking the same file fires change again.
                                    e.target.value = '';
                                }}
                            />
                        </div>
                    </div>

                    {/* role=status so the outcome is announced; the ✓/✗ prefix carries the
                        meaning for anyone who cannot distinguish the two text colours. */}
                    <p
                        role="status"
                        aria-live="polite"
                        className={`text-sm font-mono ${status?.ok === false ? 'text-[var(--red)]' : 'text-[var(--color-ink-400)]'}`}
                    >
                        {status ? `${status.ok ? '✓' : '✗'} ${status.message}` : ''}
                    </p>
                </div>
            )}
        </section>
    );
}
