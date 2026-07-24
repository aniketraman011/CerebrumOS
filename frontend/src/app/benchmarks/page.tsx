'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

type BenchRow = {
    scheduler: string;
    avg_latency: number;
    p50: number;
    p95: number;
    p99: number;
    throughput: number;
    cache_hit: number;
    cpu_utilization: number;
    memory_utilization: number;
};

const COLORS: Record<string, string> = {
    FCFS: 'bg-slate-500',
    RR: 'bg-blue-500',
    Priority: 'bg-purple-500',
    MLFQ: 'bg-emerald-500',
    Adaptive: 'bg-amber-500',
};

export default function BenchmarksModule() {
    const [rows, setRows] = useState<BenchRow[]>([]);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setRunning(true);
        setError(null);
        try {
            const res = await fetch('http://localhost:8000/api/metrics/benchmark', { method: 'POST' });
            const data = await res.json();
            setRows(data);
        } catch (e) {
            setError('Benchmark failed — is the backend running on :8000?');
        }
        setRunning(false);
    };

    const maxP99 = Math.max(1, ...rows.map(r => r.p99));
    const maxTp = Math.max(1, ...rows.map(r => r.throughput));

    return (
        <main className="p-8 text-white min-h-screen selection:bg-emerald-500/30">
            <header className="mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                        Benchmark Dashboard
                    </h1>
                    <p className="text-slate-400 font-mono text-sm mt-1">
                        P50 · P95 · P99 · Throughput · CPU · Memory · Scheduler comparison
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={run}
                        disabled={running}
                        className="px-5 py-2 bg-white text-black font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50"
                    >
                        {running ? 'Running…' : 'Run comparison'}
                    </button>
                    <Link href="/" className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm font-bold hover:text-white">
                        Playground →
                    </Link>
                </div>
            </header>

            {error && <div className="mb-6 text-rose-400 font-mono text-sm">{error}</div>}

            {rows.length === 0 && !running && (
                <div className="text-center py-24 text-slate-500 font-mono">
                    Run a comparison to measure all five schedulers under an identical burst.
                </div>
            )}

            {rows.length > 0 && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                        <Chart title="P99 Latency (ms)" subtitle="LOWER IS BETTER" rows={rows} valueKey="p99" max={maxP99} />
                        <Chart title="Throughput (req/s)" subtitle="HIGHER IS BETTER" rows={rows} valueKey="throughput" max={maxTp} invert />
                    </div>

                    <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-2xl">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-500 font-mono text-xs uppercase tracking-wider">
                                    <th className="p-4">Scheduler</th>
                                    <th className="p-4 text-right">Avg</th>
                                    <th className="p-4 text-right">P50</th>
                                    <th className="p-4 text-right">P95</th>
                                    <th className="p-4 text-right">P99</th>
                                    <th className="p-4 text-right">Throughput</th>
                                    <th className="p-4 text-right">CPU %</th>
                                    <th className="p-4 text-right">Mem %</th>
                                    <th className="p-4 text-right">Cache</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.scheduler} className="border-b border-slate-800/60 hover:bg-slate-900/50">
                                        <td className="p-4 font-bold flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${COLORS[r.scheduler] ?? 'bg-slate-500'}`} />
                                            {r.scheduler}
                                        </td>
                                        <td className="p-4 text-right font-mono text-amber-400">{r.avg_latency.toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono">{r.p50?.toFixed?.(1) ?? '—'}</td>
                                        <td className="p-4 text-right font-mono text-orange-400">{r.p95.toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-rose-400">{r.p99?.toFixed?.(1) ?? '—'}</td>
                                        <td className="p-4 text-right font-mono text-emerald-400">{r.throughput.toFixed(0)}</td>
                                        <td className="p-4 text-right font-mono">{r.cpu_utilization?.toFixed?.(0) ?? '—'}%</td>
                                        <td className="p-4 text-right font-mono">{r.memory_utilization?.toFixed?.(0) ?? '—'}%</td>
                                        <td className="p-4 text-right font-mono text-blue-400">{r.cache_hit.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </main>
    );
}

function Chart({
    title, subtitle, rows, valueKey, max, invert,
}: {
    title: string;
    subtitle: string;
    rows: BenchRow[];
    valueKey: keyof BenchRow;
    max: number;
    invert?: boolean;
}) {
    return (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8">
            <h3 className="text-slate-300 font-mono text-sm uppercase tracking-widest mb-2 text-center">{title}</h3>
            <p className="text-emerald-400 text-[10px] text-center mb-8">{subtitle}</p>
            <div className="flex items-end justify-around h-56 border-b border-slate-800">
                {rows.map(r => {
                    const v = Number(r[valueKey]) || 0;
                    const h = Math.max(8, (v / max) * 200);
                    return (
                        <div key={r.scheduler} className="flex flex-col items-center w-full group">
                            <span className="text-xs font-mono text-slate-300 mb-2 opacity-0 group-hover:opacity-100">
                                {v.toFixed(1)}
                            </span>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: h }}
                                className={`w-10 md:w-14 rounded-t ${COLORS[r.scheduler] ?? 'bg-slate-500'} ${invert ? 'shadow-[0_0_12px_rgba(16,185,129,0.25)]' : ''}`}
                            />
                            <span className="text-[10px] font-mono text-slate-500 mt-3 uppercase">{r.scheduler}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
