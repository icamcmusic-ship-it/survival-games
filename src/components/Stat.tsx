import React from 'react';

export function Stat({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
    const pct = Math.max(0, Math.min(100, value * 10));
    return (
        <div className="panel-flush px-2 py-1.5 space-y-1" title={`${label} ${value} of 10`}>
            <div className="flex items-center gap-1.5">
                {icon}
                <span className="text-[var(--color-ink-500)] text-[10px] font-mono font-bold tracking-wider">{label}</span>
                <span className="text-[var(--ink)] font-mono font-bold text-xs ml-auto">{value}</span>
            </div>
            <div className="meter">
                <span style={{ width: `${pct}%`, background: 'var(--red)' }} />
            </div>
        </div>
    );
}
