'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const HEAT = ['bg-slate-800', 'bg-blue-900', 'bg-emerald-600', 'bg-amber-400'];

export default function PlaygroundHome() {
    const [metrics, setMetrics] = useState<any>(null);
    const [connected, setConnected] = useState(false);
    const [policy, setPolicy] = useState('Adaptive');
    const [benchmarks, setBenchmarks] = useState<any[]>([]);
    const [isBenchmarking, setIsBenchmarking] = useState(false);
    const [controlBusy, setControlBusy] = useState(false);

    const runtimeRunning = metrics?.running !== false;

    useEffect(() => {
        let ws: WebSocket;
        let reconnectTimer: NodeJS.Timeout;
        const connect = () => {
            ws = new WebSocket('ws://localhost:8000/api/metrics/ws');
            ws.onopen = () => setConnected(true);
            ws.onmessage = (event) => {
                try {
                    setMetrics(JSON.parse(event.data));
                } catch (e) {
                    console.error('WS Parse Error', e);
                }
            };
            ws.onclose = () => {
                setConnected(false);
                reconnectTimer = setTimeout(connect, 1000);
            };
        };
        connect();
        return () => {
            clearTimeout(reconnectTimer);
            ws?.close();
        };
    }, []);

    const handlePolicyChange = async (newPolicy: string) => {
        setPolicy(newPolicy);
        await fetch(`http://localhost:8000/api/metrics/policy/${newPolicy}`, { method: 'POST' });
    };

    const runtimeControl = async (action: 'start' | 'stop' | 'restart') => {
        setControlBusy(true);
        try {
            await fetch(`http://localhost:8000/api/metrics/control/${action}`, { method: 'POST' });
            if (action === 'restart') {
                setBenchmarks([]);
            }
        } catch (e) {
            console.error(`Runtime ${action} failed`, e);
        }
        setControlBusy(false);
    };

    const generateWorkload = async (count: number, kind: 'mixed' | 'chat' | 'batch' = 'mixed') => {
        if (!runtimeRunning) return;
        for (let i = 0; i < count; i++) {
            const isBatch = kind === 'batch' ? true : kind === 'chat' ? false : Math.random() > 0.5;
            const priority = isBatch ? 1 : 2;
            const vram = isBatch ? 128 : 32;
            const type = isBatch ? 'Batch' : 'Chat';
            fetch(
                `http://localhost:8000/api/metrics/simulate_job?priority=${priority}&vram_required=${vram}&is_batch=${isBatch}&type=${type}`,
                { method: 'POST' }
            );
        }
    };

    const runBenchmarks = async () => {
        setIsBenchmarking(true);
        try {
            const res = await fetch('http://localhost:8000/api/metrics/benchmark', { method: 'POST' });
            setBenchmarks(await res.json());
        } catch (e) {
            console.error('Benchmark failed', e);
        }
        setIsBenchmarking(false);
    };

    const decision = metrics?.decision;
    const memory = metrics?.memory;
    const heatmap = memory?.heatmap ?? [];

    return (
        <main className="p-4 md:p-8 text-white min-h-screen bg-[#020617] font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            <header className="mb-10 text-center border-b border-slate-800 pb-8 relative">
                <div className="absolute top-0 right-0 flex flex-wrap items-center justify-end gap-2">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`} />
                    <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">
                        {connected ? 'Runtime Connected' : 'Disconnected'}
                    </span>
                    <Link href="/timeline" className="text-xs text-orange-400 hover:text-orange-300 font-bold border border-orange-900/50 bg-orange-900/20 px-3 py-1 rounded">
                        Timeline Replay →
                    </Link>
                    <Link href="/schedulers" className="text-xs text-emerald-400 font-bold border border-emerald-900/50 bg-emerald-900/20 px-3 py-1 rounded">
                        Decision Engine →
                    </Link>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-300 to-slate-500 tracking-tighter mb-3">
                    CerebrumOS Runtime Playground
                </h1>
                <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">
                    Choose scheduler · Generate load · Watch execution · Inspect cache & memory · Compare benchmarks
                </p>
            </header>

            <div className="max-w-6xl mx-auto space-y-8">
                {/* Runtime controls */}
                <section className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${runtimeRunning ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'}`} />
                        <div>
                            <div className="text-xs font-mono uppercase tracking-widest text-slate-500">Runtime</div>
                            <div className={`font-black text-lg ${runtimeRunning ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {runtimeRunning ? 'RUNNING' : 'STOPPED'}
                            </div>
                        </div>
                        {!runtimeRunning && (
                            <span className="text-xs text-slate-500 font-mono ml-2">Job intake paused</span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => runtimeControl('start')}
                            disabled={controlBusy || runtimeRunning}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            ▶ Start
                        </button>
                        <button
                            onClick={() => runtimeControl('stop')}
                            disabled={controlBusy || !runtimeRunning}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-rose-600/20 border border-rose-500/50 text-rose-300 hover:bg-rose-600/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            ■ Stop
                        </button>
                        <button
                            onClick={() => runtimeControl('restart')}
                            disabled={controlBusy}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-amber-600/20 border border-amber-500/50 text-amber-300 hover:bg-amber-600/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            ↻ Restart
                        </button>
                    </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <h3 className="text-slate-400 font-mono text-sm uppercase tracking-widest mb-4">Scheduler policy</h3>
                        <div className="flex flex-wrap gap-3">
                            {['FCFS', 'RR', 'Priority', 'MLFQ', 'Adaptive'].map(pol => (
                                <button
                                    key={pol}
                                    onClick={() => handlePolicyChange(pol)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                        policy === pol
                                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white scale-105'
                                            : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500'
                                    }`}
                                >
                                    {pol}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                        <h3 className="text-slate-400 font-mono text-sm uppercase tracking-widest mb-4">Generate requests</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => generateWorkload(1)} disabled={!runtimeRunning} className="py-3 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 rounded-xl text-blue-300 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                +1 Job
                            </button>
                            <button onClick={() => generateWorkload(50)} disabled={!runtimeRunning} className="py-3 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 rounded-xl text-purple-300 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                +50 Burst
                            </button>
                            <button onClick={() => generateWorkload(25, 'chat')} disabled={!runtimeRunning} className="py-3 bg-emerald-600/15 border border-emerald-700/50 rounded-xl text-emerald-300 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                Chat wave
                            </button>
                            <button onClick={() => generateWorkload(25, 'batch')} disabled={!runtimeRunning} className="py-3 bg-amber-600/15 border border-amber-700/50 rounded-xl text-amber-300 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                Batch wave
                            </button>
                        </div>
                    </div>
                </section>

                {/* Decision explainability */}
                <section className="bg-slate-900/50 border border-emerald-900/30 p-6 rounded-3xl">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-3">Runtime Decision</h2>
                    {decision ? (
                        <div className="grid md:grid-cols-3 gap-6">
                            <div>
                                <div className="text-4xl font-black mb-2">{decision.policy}</div>
                                <p className="text-slate-300 text-sm leading-relaxed">{decision.reason}</p>
                            </div>
                            <div className="font-mono text-xs text-slate-400 space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-4">
                                <div>Queue length = {decision.inputs?.queue_length}</div>
                                <div>Memory pressure = {Math.round((decision.inputs?.memory_pressure ?? 0) * 100)}%</div>
                                <div>Cache hit = {Math.round((decision.inputs?.cache_hit ?? 0) * 100)}%</div>
                                <div>Tensor size = {decision.inputs?.tensor_size_mb} MB</div>
                                <div>Worker utilization = {Math.round((decision.inputs?.worker_utilization ?? 0) * 100)}%</div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <MetricCard title="Confidence" value={`${Math.round(decision.confidence)}%`} color="text-emerald-400" />
                                <MetricCard title="Expected" value={`${Number(decision.expected_latency_ms).toFixed(1)} ms`} color="text-amber-400" />
                                <MetricCard title="Latency ↓" value={`${Math.round(decision.predicted_latency_reduction_pct)}%`} color="text-blue-400" />
                                <MetricCard title="Mode" value={metrics?.mode || 'sim'} color="text-slate-300" />
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 font-mono text-sm">Awaiting first decision — generate a workload.</p>
                    )}
                </section>

                {/* Pipeline */}
                <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black tracking-tight">Active request pipeline</h2>
                        <Link href="/timeline" className="text-xs text-slate-400 hover:text-white font-mono">Open replay explorer →</Link>
                    </div>
                    <div className="flex flex-col gap-3">
                        <AnimatePresence>
                            {metrics?.active_timeline?.map((job: any) => (
                                <motion.div
                                    key={job.id}
                                    initial={{ opacity: 0, x: -40 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-between gap-4"
                                >
                                    <div className="w-14 font-black text-xl text-slate-300">#{job.id}</div>
                                    <div className="flex-1 flex items-center justify-between px-2 relative">
                                        {['QUEUED', 'RUNNING', 'COMPLETED'].map(stage => {
                                            const isActive =
                                                job.status === stage ||
                                                (stage === 'QUEUED' && job.status !== 'CREATED') ||
                                                (stage === 'RUNNING' && job.status === 'COMPLETED');
                                            const isCurrent = job.status === stage;
                                            return (
                                                <div key={stage} className="flex flex-col items-center gap-2 z-10">
                                                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800'}`}>
                                                        {isCurrent && <div className="w-full h-full bg-white rounded-full animate-ping opacity-75" />}
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}>{stage}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="w-28 text-right">
                                        <div className="text-xs text-slate-500 font-mono uppercase">Policy</div>
                                        <div className="font-bold text-blue-400">{job.policy}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {(!metrics?.active_timeline || metrics.active_timeline.length === 0) && (
                            <div className="text-center py-10 text-slate-500 font-mono">No active jobs. Generate a workload to begin.</div>
                        )}
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                        <h2 className="text-xl font-black border-b border-slate-800 pb-2">Workers & cache</h2>
                        <div className="grid grid-cols-4 gap-2">
                            {metrics?.workers?.slice(0, 8).map((w: any, i: number) => (
                                <div
                                    key={i}
                                    className={`h-10 rounded flex flex-col items-center justify-center text-[10px] font-bold ${
                                        w.status === 1 ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-500'
                                    }`}
                                >
                                    <span>W{i}</span>
                                    <span className="font-mono text-[8px]">{w.status === 1 ? 'BUSY' : 'IDLE'}</span>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <MetricCard title="Cache hit" value={`${((metrics?.cache_hit_ratio ?? 0) * 100).toFixed(1)}%`} color="text-blue-400" />
                            <MetricCard title="Queue depth" value={`${metrics?.queue_size ?? 0}`} color="text-purple-400" />
                        </div>
                        <Link href="/memory" className="block text-center text-xs text-slate-400 hover:text-emerald-400 font-mono pt-2">
                            Inspect memory subsystem →
                        </Link>
                    </section>

                    <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
                        <h2 className="text-xl font-black border-b border-slate-800 pb-2 mb-4">Memory</h2>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <MetricCard title="Fragmentation" value={`${((memory?.fragmentation_ratio ?? 0) * 100).toFixed(1)}%`} color="text-purple-400" />
                            <MetricCard title="Peak" value={`${memory?.peak_blocks ?? 0}`} color="text-amber-400" />
                            <MetricCard title="Reuse" value={`${memory?.total_reuses ?? 0}`} color="text-emerald-400" />
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                            {(heatmap.length ? heatmap : Array(64).fill(0)).slice(0, 64).map((v: number, i: number) => (
                                <div key={i} className={`h-3 rounded-[1px] ${HEAT[v] ?? HEAT[0]}`} />
                            ))}
                        </div>
                    </section>
                </div>

                <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <MetricCard title="Avg" value={`${metrics?.avg_latency_ms?.toFixed(1) || 0} ms`} color="text-amber-400" />
                    <MetricCard title="P50" value={`${metrics?.p50_latency_ms?.toFixed(1) || 0} ms`} color="text-yellow-400" />
                    <MetricCard title="P95" value={`${metrics?.p95_latency_ms?.toFixed(1) || 0} ms`} color="text-orange-400" />
                    <MetricCard title="P99" value={`${metrics?.p99_latency_ms?.toFixed(1) || 0} ms`} color="text-rose-400" />
                    <MetricCard title="Throughput" value={`${metrics?.throughput_req_sec?.toFixed(0) || 0}/s`} color="text-emerald-400" />
                </section>

                <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black">Scheduler comparison</h2>
                        <div className="flex gap-3">
                            <Link href="/benchmarks" className="text-xs text-slate-400 hover:text-white font-mono self-center">
                                Full dashboard →
                            </Link>
                            <button
                                onClick={runBenchmarks}
                                disabled={isBenchmarking}
                                className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50"
                            >
                                {isBenchmarking ? 'Running…' : 'Run benchmark'}
                            </button>
                        </div>
                    </div>
                    {benchmarks.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-700 text-slate-400 font-mono text-xs uppercase">
                                        <th className="py-3">Scheduler</th>
                                        <th className="py-3 text-right">Avg</th>
                                        <th className="py-3 text-right">P50</th>
                                        <th className="py-3 text-right">P95</th>
                                        <th className="py-3 text-right">P99</th>
                                        <th className="py-3 text-right">Throughput</th>
                                        <th className="py-3 text-right">CPU</th>
                                        <th className="py-3 text-right">Mem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {benchmarks.map((b, i) => (
                                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                            <td className="py-3 font-bold">{b.scheduler}</td>
                                            <td className="py-3 text-right font-mono text-amber-400">{b.avg_latency.toFixed(1)}</td>
                                            <td className="py-3 text-right font-mono">{b.p50?.toFixed?.(1) ?? '—'}</td>
                                            <td className="py-3 text-right font-mono text-orange-400">{b.p95.toFixed(1)}</td>
                                            <td className="py-3 text-right font-mono text-rose-400">{b.p99?.toFixed?.(1) ?? '—'}</td>
                                            <td className="py-3 text-right font-mono text-emerald-400">{b.throughput.toFixed(0)}</td>
                                            <td className="py-3 text-right font-mono">{b.cpu_utilization?.toFixed?.(0) ?? '—'}%</td>
                                            <td className="py-3 text-right font-mono">{b.memory_utilization?.toFixed?.(0) ?? '—'}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function MetricCard({ title, value, color }: { title: string; value: string; color: string }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-center">
            <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">{title}</h4>
            <div className={`text-xl font-black ${color}`}>{value}</div>
        </div>
    );
}
