'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

type MemoryStats = {
    total_blocks: number;
    free_blocks: number;
    used_blocks: number;
    peak_blocks: number;
    total_allocations: number;
    total_evictions: number;
    total_reuses: number;
    fragmentation_ratio: number;
    heatmap: number[];
    allocation_graph: { t: number; used: number; blocks: number; evicted: number; reused: number }[];
};

const HEAT_COLORS = ['bg-slate-800', 'bg-blue-900', 'bg-emerald-600', 'bg-amber-400'];

export default function MemoryVisualizer() {
    const [memory, setMemory] = useState<MemoryStats | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let ws: WebSocket;
        let reconnect: NodeJS.Timeout;
        const connect = () => {
            ws = new WebSocket('ws://localhost:8000/api/metrics/ws');
            ws.onopen = () => setConnected(true);
            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.memory) setMemory(data.memory);
                } catch {}
            };
            ws.onclose = () => {
                setConnected(false);
                reconnect = setTimeout(connect, 1000);
            };
        };
        connect();
        return () => {
            clearTimeout(reconnect);
            ws?.close();
        };
    }, []);

    const graph = memory?.allocation_graph ?? [];
    const maxUsed = useMemo(() => Math.max(1, ...(graph.map(g => g.used)), memory?.peak_blocks ?? 1), [graph, memory]);

    const burst = async () => {
        for (let i = 0; i < 30; i++) {
            const vram = [64, 128, 256, 384][i % 4];
            fetch(`http://localhost:8000/api/metrics/simulate_job?priority=1&vram_required=${vram}&is_batch=${i % 2 === 0}&type=Large`, { method: 'POST' });
        }
    };

    return (
        <main className="p-8 text-white min-h-screen selection:bg-emerald-500/30">
            <header className="mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                        Memory Visualization
                    </h1>
                    <p className="text-slate-400 font-mono text-sm mt-1">
                        Fragmentation · Heat map · Allocation graph · Peak · Reuse
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <button onClick={burst} className="px-4 py-2 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-bold hover:bg-emerald-600/30">
                        Stress allocate (+30)
                    </button>
                    <Link href="/" className="text-xs font-bold text-slate-400 border border-slate-700 px-3 py-1.5 rounded hover:text-white">
                        Playground →
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <Card label="Fragmentation" value={`${((memory?.fragmentation_ratio ?? 0) * 100).toFixed(1)}%`} color="text-purple-400" />
                <Card label="Peak blocks" value={`${memory?.peak_blocks ?? 0}`} color="text-amber-400" />
                <Card label="Used / Total" value={`${memory?.used_blocks ?? 0}/${memory?.total_blocks ?? 1024}`} color="text-blue-400" />
                <Card label="Evictions" value={`${memory?.total_evictions ?? 0}`} color="text-rose-400" />
                <Card label="Memory reuse" value={`${memory?.total_reuses ?? 0}`} color="text-emerald-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Block heat map</h2>
                    <div className="grid grid-cols-8 gap-1.5 mb-4">
                        {(memory?.heatmap ?? Array(64).fill(0)).map((v, i) => (
                            <div
                                key={i}
                                title={`bucket ${i}: level ${v}`}
                                className={`aspect-square rounded-sm ${HEAT_COLORS[v] ?? HEAT_COLORS[0]}`}
                            />
                        ))}
                    </div>
                    <div className="flex gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-800 inline-block" /> Free</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-900 inline-block" /> Light</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> Busy</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Hot</span>
                    </div>
                </section>

                <section className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Allocation graph (used blocks over time)</h2>
                    <div className="h-48 flex items-end gap-0.5 border-b border-slate-800 pb-1">
                        {graph.length === 0 && (
                            <div className="w-full text-center text-slate-600 font-mono text-sm self-center">No allocations yet</div>
                        )}
                        {graph.map((g, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-gradient-to-t from-blue-700 to-emerald-400 rounded-t-sm min-w-[3px] transition-all"
                                style={{ height: `${(g.used / maxUsed) * 100}%` }}
                                title={`used=${g.used} alloc=${g.blocks} evict=${g.evicted} reuse=${g.reused}`}
                            />
                        ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Allocations</div>
                            <div className="font-black text-slate-200">{memory?.total_allocations ?? 0}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Free blocks</div>
                            <div className="font-black text-slate-200">{memory?.free_blocks ?? 0}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Peak pressure</div>
                            <div className="font-black text-amber-400">
                                {memory ? ((memory.peak_blocks / memory.total_blocks) * 100).toFixed(0) : 0}%
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
            <div className={`text-2xl font-black ${color}`}>{value}</div>
        </div>
    );
}
