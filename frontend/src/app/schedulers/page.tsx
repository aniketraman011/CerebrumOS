'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

type Decision = {
    policy: string;
    reason: string;
    confidence: number;
    expected_latency_ms: number;
    predicted_latency_reduction_pct: number;
    inputs: {
        queue_length?: number;
        memory_pressure?: number;
        cache_hit?: number;
        tensor_size_mb?: number;
        worker_utilization?: number;
    };
    timestamp_ms?: number;
    job_id?: number;
    pinned?: boolean;
};

type Interview = {
    algorithm: string;
    complexity: string;
    tradeoffs: string;
    linux_equivalent: string;
    production_analogy: string;
};

const POLICIES = ['FCFS', 'RR', 'Priority', 'MLFQ', 'Adaptive'] as const;

export default function RuntimeDecisionPage() {
    const [history, setHistory] = useState<Decision[]>([]);
    const [latest, setLatest] = useState<Decision | null>(null);
    const [interview, setInterview] = useState<Record<string, Interview>>({});
    const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        fetch('http://localhost:8000/api/metrics/interview/policies')
            .then(r => r.json())
            .then(setInterview)
            .catch(() => {});

        let ws: WebSocket;
        let reconnect: NodeJS.Timeout;
        const connect = () => {
            ws = new WebSocket('ws://localhost:8000/api/metrics/ws');
            ws.onopen = () => setConnected(true);
            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.decision) setLatest(data.decision);
                    if (data.decision_history) setHistory(data.decision_history);
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

    const d = latest;

    return (
        <main className="p-8 text-white min-h-screen selection:bg-emerald-500/30">
            <header className="mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                        Runtime Decision Engine
                    </h1>
                    <p className="text-slate-400 font-mono text-sm mt-1">
                        Signal-driven policy selection with structured explainability
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded">
                        Playground →
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <section className="bg-slate-950 border border-emerald-900/40 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-4">Live Decision</h2>
                    {d ? (
                        <div className="space-y-4">
                            <div className="text-4xl font-black text-white">{d.policy}</div>
                            <p className="text-slate-300 leading-relaxed">{d.reason}</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <Stat label="Confidence" value={`${d.confidence?.toFixed?.(0) ?? d.confidence}%`} accent="text-emerald-400" />
                                <Stat label="Expected latency" value={`${d.expected_latency_ms?.toFixed?.(1)} ms`} accent="text-amber-400" />
                                <Stat label="Latency reduction" value={`${d.predicted_latency_reduction_pct?.toFixed?.(0)}%`} accent="text-blue-400" />
                                <Stat label="Job" value={d.job_id != null ? `#${d.job_id}` : '—'} accent="text-slate-300" />
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-1 text-slate-400">
                                <div>Queue length = {d.inputs?.queue_length ?? 0}</div>
                                <div>Memory pressure = {Math.round((d.inputs?.memory_pressure ?? 0) * 100)}%</div>
                                <div>Cache hit = {Math.round((d.inputs?.cache_hit ?? 0) * 100)}%</div>
                                <div>Tensor size = {d.inputs?.tensor_size_mb ?? 0} MB</div>
                                <div>Worker utilization = {Math.round((d.inputs?.worker_utilization ?? 0) * 100)}%</div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 font-mono text-sm py-10 text-center">
                            Generate jobs in the Playground to see decisions.
                        </p>
                    )}
                </section>

                <section className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Interview Mode — Click a policy</h2>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {POLICIES.map(p => (
                            <button
                                key={p}
                                onClick={() => setSelectedPolicy(p)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                                    selectedPolicy === p
                                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    {selectedPolicy && interview[selectedPolicy] ? (
                        <div className="space-y-4 text-sm">
                            <InterviewBlock title="Algorithm" body={interview[selectedPolicy].algorithm} />
                            <InterviewBlock title="Complexity" body={interview[selectedPolicy].complexity} mono />
                            <InterviewBlock title="Trade-offs" body={interview[selectedPolicy].tradeoffs} />
                            <InterviewBlock title="Linux equivalent" body={interview[selectedPolicy].linux_equivalent} />
                            <InterviewBlock title="Production analogy" body={interview[selectedPolicy].production_analogy} />
                        </div>
                    ) : (
                        <p className="text-slate-600 text-sm">Select a scheduler to open the educational brief.</p>
                    )}
                </section>
            </div>

            <section className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-slate-900 border-b border-slate-800 p-4 flex gap-2 items-center">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-orange-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-500 font-mono text-xs ml-4">decision_engine.log</span>
                </div>
                <div className="p-6 font-mono text-sm space-y-5 max-h-[480px] overflow-y-auto">
                    <AnimatePresence>
                        {history.map((item, idx) => (
                            <motion.div
                                key={`${item.timestamp_ms}-${item.job_id}-${idx}`}
                                initial={{ opacity: 0, y: -12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="border-l-2 border-emerald-500 pl-4"
                            >
                                <div className="text-slate-500 text-xs mb-1">
                                    [{item.timestamp_ms ? new Date(item.timestamp_ms).toISOString().split('T')[1]?.slice(0, 12) : '—'}]
                                    {item.job_id != null ? ` job #${item.job_id}` : ''}
                                    {item.pinned ? ' [PINNED]' : ''}
                                </div>
                                <div className="text-blue-400 font-bold text-lg mb-1">Decision: {item.policy}</div>
                                <div className="text-slate-300 mb-2">{item.reason}</div>
                                <div className="text-xs text-emerald-400">
                                    Confidence = {item.confidence}% · Expected = {item.expected_latency_ms?.toFixed?.(1)} ms ·
                                    Reduction = {item.predicted_latency_reduction_pct}%
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {history.length === 0 && (
                        <div className="text-slate-600 animate-pulse">Awaiting first routing decision...</div>
                    )}
                </div>
            </section>
        </main>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
            <div className={`font-black text-lg ${accent}`}>{value}</div>
        </div>
    );
}

function InterviewBlock({ title, body, mono }: { title: string; body: string; mono?: boolean }) {
    return (
        <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{title}</h3>
            <p className={`text-slate-200 ${mono ? 'font-mono text-emerald-400 bg-emerald-950/20 px-2 py-1 rounded inline-block' : ''}`}>
                {body}
            </p>
        </div>
    );
}
