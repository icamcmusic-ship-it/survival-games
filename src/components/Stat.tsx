import React from 'react';

export function Stat({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
    return (
        <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800/50">
            {icon}
            <span className="text-zinc-500 text-xs font-mono">{label}</span>
            <span className="text-white font-mono ml-auto">{value}/10</span>
        </div>
    );
}
