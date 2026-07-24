'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const PIPELINE_STAGES = [
    'CREATED',
    'QUEUED',
    'SCHEDULED',
    'WORKER_ASSIGNED',
    'MEMORY_ALLOCATED',
    'INFERENCE_STARTED',
    'CACHE_UPDATED',
    'COMPLETED',
] as const;

export default function TimelineExplorer() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [policyFilter, setPolicyFilter] = useState('ALL');
    const [groupBy, setGroupBy] = useState('NONE');
    const [expandedJob, setExpandedJob] = useState<number | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareJobs, setCompareJobs] = useState<number[]>([]);
    const [interviewMode, setInterviewMode] = useState(false);
    const [selectedInterviewEvent, setSelectedInterviewEvent] = useState<any>(null);
    const [replay, setReplay] = useState<{ jobId: number; step: number; pipeline: any[] } | null>(null);
    const [interviewPolicies, setInterviewPolicies] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchHistory();
        fetch('http://localhost:8000/api/metrics/interview/policies')
            .then(r => r.json())
            .then(setInterviewPolicies)
            .catch(() => {});
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/metrics/timeline');
            setJobs(await res.json());
        } catch (e) {
            console.error('Failed to fetch timeline', e);
        }
        setLoading(false);
    };

    const startReplay = async (jobId: number) => {
        try {
            const res = await fetch(`http://localhost:8000/api/metrics/timeline/${jobId}`);
            const data = await res.json();
            setReplay({ jobId, step: 0, pipeline: data.pipeline });
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!replay) return;
        if (replay.step >= PIPELINE_STAGES.length - 1) return;
        const t = setTimeout(() => {
            setReplay(r => r ? { ...r, step: Math.min(r.step + 1, PIPELINE_STAGES.length - 1) } : r);
        }, 700);
        return () => clearTimeout(t);
    }, [replay]);

    const openInterviewContext = useCallback(async (stage: string, details: string, policy?: string) => {
        if (!interviewMode) return;
        try {
            const topic = policy && interviewPolicies[policy] ? policy : stage;
            const res = await fetch(`http://localhost:8000/api/metrics/interview/${encodeURIComponent(topic)}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedInterviewEvent({
                    stage: data.name || stage,
                    concept: data.algorithm || data.concept,
                    complexity: data.complexity,
                    tradeoffs: data.tradeoffs,
                    linux: data.linux_equivalent,
                    prod: data.production_analogy,
                    explanation: details,
                });
                return;
            }
        } catch {}
        setSelectedInterviewEvent({
            stage,
            concept: 'Systems Architecture',
            complexity: 'O(1)',
            tradeoffs: '',
            linux: '',
            prod: 'In production systems this maps to distributed coordination.',
            explanation: details,
        });
    }, [interviewMode, interviewPolicies]);

    const toggleCompare = (id: number) => {
        setCompareJobs(prev => {
            if (prev.includes(id)) return prev.filter(j => j !== id);
            if (prev.length < 2) return [...prev, id];
            return [prev[1], id];
        });
    };

    let filteredJobs = jobs.filter(j => {
        if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
        if (policyFilter !== 'ALL' && j.policy !== policyFilter) return false;
        if (search && !j.id.toString().includes(search) && !j.type?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    let groupedJobs: Record<string, any[]> = { ALL: filteredJobs };
    if (groupBy === 'POLICY') {
        groupedJobs = {};
        filteredJobs.forEach(j => {
            if (!groupedJobs[j.policy]) groupedJobs[j.policy] = [];
            groupedJobs[j.policy].push(j);
        });
    } else if (groupBy === 'STATUS') {
        groupedJobs = {};
        filteredJobs.forEach(j => {
            if (!groupedJobs[j.status]) groupedJobs[j.status] = [];
            groupedJobs[j.status].push(j);
        });
    }

    return (
        <main className="p-8 text-white min-h-screen bg-[#020617] font-sans selection:bg-emerald-500/30">
            <header className="mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tighter mb-2">
                        Timeline Replay
                    </h1>
                    <p className="text-slate-400 font-mono text-sm uppercase tracking-widest">
                        Queued → Scheduled → Worker → Memory → Inference → Cache → Completed
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/" className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded font-bold text-sm border border-slate-700">
                        ← Playground
                    </Link>
                    <button
                        onClick={() => setInterviewMode(!interviewMode)}
                        className={`px-4 py-2 rounded font-bold text-sm border ${interviewMode ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                        {interviewMode ? 'Interview Mode: ON' : 'Interview Mode'}
                    </button>
                    <button onClick={fetchHistory} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-sm">
                        Refresh
                    </button>
                </div>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-8 flex flex-wrap gap-4 items-end">
                <Filter label="Search">
                    <input
                        type="text"
                        placeholder="ID, Type..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-blue-500"
                    />
                </Filter>
                <Filter label="Status">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm">
                        <option value="ALL">All</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="RUNNING">Running</option>
                        <option value="QUEUED">Queued</option>
                    </select>
                </Filter>
                <Filter label="Scheduler">
                    <select value={policyFilter} onChange={e => setPolicyFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm">
                        <option value="ALL">All</option>
                        {['FCFS', 'RR', 'Priority', 'MLFQ', 'Adaptive'].map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </Filter>
                <Filter label="Group By">
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm">
                        <option value="NONE">None</option>
                        <option value="POLICY">Policy</option>
                        <option value="STATUS">Status</option>
                    </select>
                </Filter>
                <div className="flex-1" />
                <button
                    onClick={() => setCompareMode(!compareMode)}
                    className={`px-4 py-1.5 rounded font-bold text-sm border ${compareMode ? 'bg-orange-600/30 border-orange-500 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                    Compare
                </button>
            </div>

            {compareMode && compareJobs.length === 2 && (
                <div className="mb-8 bg-slate-900 border border-orange-900/50 rounded-xl p-6 relative">
                    <button onClick={() => setCompareJobs([])} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                    <h3 className="text-orange-400 font-black mb-6 text-xl">Side-by-Side</h3>
                    <div className="grid grid-cols-2 gap-8">
                        {compareJobs.map(id => {
                            const job = jobs.find(j => j.id === id);
                            if (!job) return null;
                            return (
                                <div key={id} className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                                    <div className="text-3xl font-black mb-2">Job #{job.id}</div>
                                    <div className="text-emerald-400 font-mono mb-4 text-sm">{job.policy} · {job.type}</div>
                                    <div className="text-sm text-slate-400 space-y-1">
                                        {job.events.map((e: any, i: number) => (
                                            <div key={i} className="flex gap-3">
                                                <span className="font-bold text-slate-300 w-40 text-xs">{e.stage}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-slate-500 font-mono animate-pulse">Fetching telemetry...</div>
            ) : filteredJobs.length === 0 ? (
                <div className="text-center py-20 text-slate-600 font-mono">No requests yet. Generate some in the playground.</div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedJobs).map(([groupName, groupJobs]) => (
                        <div key={groupName} className="space-y-3">
                            {groupBy !== 'NONE' && (
                                <h2 className="text-xl font-black text-slate-300 border-b border-slate-800 pb-2 sticky top-0 bg-[#020617] z-10 py-2">
                                    {groupName} <span className="text-sm font-normal text-slate-500 ml-2">({groupJobs.length})</span>
                                </h2>
                            )}
                            {groupJobs.map(job => (
                                <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700">
                                    <div
                                        className="p-4 flex items-center justify-between cursor-pointer"
                                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="font-black text-2xl w-16 text-slate-200">#{job.id}</div>
                                            <Meta label="Policy" value={job.policy} accent="text-emerald-400" />
                                            <Meta label="Type" value={job.type} accent="text-blue-400" />
                                            <Meta label="Status" value={job.status} accent="text-slate-200" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {compareMode && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); toggleCompare(job.id); }}
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${compareJobs.includes(job.id) ? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                                >
                                                    {compareJobs.includes(job.id) ? 'Selected' : 'Compare'}
                                                </button>
                                            )}
                                            <span className="text-slate-500">{expandedJob === job.id ? '▼' : '▶'}</span>
                                        </div>
                                    </div>

                                    {expandedJob === job.id && (
                                        <div className="p-6 bg-slate-950 border-t border-slate-800">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="font-black tracking-widest uppercase text-slate-400 text-xs">Lifecycle Pipeline</h4>
                                                <button
                                                    onClick={() => startReplay(job.id)}
                                                    className="px-3 py-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded text-xs font-bold hover:bg-emerald-800/50"
                                                >
                                                    ▶ Replay request
                                                </button>
                                            </div>

                                            {job.decision && (
                                                <div className="mb-6 bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 text-sm">
                                                    <div className="text-emerald-400 font-bold mb-1">Decision: {job.decision.policy}</div>
                                                    <div className="text-slate-300">{job.decision.reason}</div>
                                                    <div className="text-xs text-emerald-500 mt-2 font-mono">
                                                        Confidence = {job.decision.confidence}% · Expected = {job.decision.expected_latency_ms} ms
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative">
                                                <div className="absolute top-0 bottom-0 left-3 w-0.5 bg-slate-800" />
                                                {job.events.map((ev: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        className={`relative flex gap-6 mb-6 ${interviewMode ? 'cursor-pointer hover:bg-purple-900/20 p-2 rounded -ml-2' : ''}`}
                                                        onClick={() => openInterviewContext(ev.stage, ev.details, job.policy)}
                                                    >
                                                        <div className="relative z-10 w-6 h-6 rounded-full bg-slate-900 border-2 border-emerald-600 flex-shrink-0 flex items-center justify-center mt-1">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="font-bold text-slate-200">{ev.stage}</span>
                                                                <span className="font-mono text-xs text-slate-500">
                                                                    {new Date(parseInt(ev.timestamp)).toISOString().split('T')[1]?.slice(0, -1)}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-slate-400 font-mono bg-slate-900 p-3 rounded border border-slate-800/50 whitespace-pre-wrap">
                                                                {ev.details}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Replay overlay */}
            <AnimatePresence>
                {replay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/85 backdrop-blur z-50 flex items-center justify-center p-6"
                        onClick={() => setReplay(null)}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-slate-900 border border-emerald-700/50 rounded-2xl p-8 max-w-xl w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-black">Replay · Job #{replay.jobId}</h2>
                                <button onClick={() => setReplay(null)} className="text-slate-500 hover:text-white">✕</button>
                            </div>
                            <div className="space-y-0">
                                {PIPELINE_STAGES.map((stage, i) => {
                                    const reached = i <= replay.step;
                                    const current = i === replay.step;
                                    const pipe = replay.pipeline.find(p => p.stage === stage);
                                    return (
                                        <div key={stage} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-4 h-4 rounded-full border-2 ${reached ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-600'} ${current ? 'animate-pulse scale-125' : ''}`} />
                                                {i < PIPELINE_STAGES.length - 1 && (
                                                    <div className={`w-0.5 h-8 ${i < replay.step ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                                                )}
                                            </div>
                                            <div className={`pb-4 ${reached ? 'text-white' : 'text-slate-600'}`}>
                                                <div className="font-bold text-sm">{stage.replace(/_/g, ' ')}</div>
                                                {current && pipe?.details && (
                                                    <div className="text-xs text-slate-400 font-mono mt-1 line-clamp-3">{pipe.details}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-sm"
                                onClick={() => setReplay(r => r ? { ...r, step: 0 } : r)}
                            >
                                Replay again
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {interviewMode && selectedInterviewEvent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-50 p-4" onClick={() => setSelectedInterviewEvent(null)}>
                    <div className="bg-slate-900 border border-purple-500 p-8 rounded-2xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <h2 className="text-3xl font-black mb-2">{selectedInterviewEvent.stage}</h2>
                        <div className="text-purple-400 font-mono mb-6 uppercase tracking-widest text-sm">Interview Mode</div>
                        <div className="space-y-5 text-sm">
                            <Block title="Algorithm / Concept" body={selectedInterviewEvent.concept} />
                            <Block title="Complexity" body={selectedInterviewEvent.complexity} mono />
                            {selectedInterviewEvent.tradeoffs && <Block title="Trade-offs" body={selectedInterviewEvent.tradeoffs} />}
                            {selectedInterviewEvent.linux && <Block title="Linux equivalent" body={selectedInterviewEvent.linux} />}
                            <Block title="Production analogy" body={selectedInterviewEvent.prod} />
                            <div>
                                <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Event data</h3>
                                <pre className="text-xs text-slate-400 font-mono bg-black p-3 rounded border border-slate-800 whitespace-pre-wrap">
                                    {selectedInterviewEvent.explanation}
                                </pre>
                            </div>
                        </div>
                        <button className="mt-8 w-full py-3 bg-purple-600 hover:bg-purple-500 font-bold rounded" onClick={() => setSelectedInterviewEvent(null)}>
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{label}</label>
            {children}
        </div>
    );
}

function Meta({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">{label}</span>
            <span className={`font-bold ${accent}`}>{value}</span>
        </div>
    );
}

function Block({ title, body, mono }: { title: string; body: string; mono?: boolean }) {
    return (
        <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{title}</h3>
            <p className={mono ? 'font-mono text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded inline-block' : 'text-slate-200'}>{body}</p>
        </div>
    );
}
