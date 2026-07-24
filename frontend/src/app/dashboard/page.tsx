'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function DashboardHome() {
    const [metrics, setMetrics] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<string>("simulation");
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let ws: WebSocket;
        let reconnectTimer: NodeJS.Timeout;

        const connect = () => {
            ws = new WebSocket('ws://localhost:8000/api/metrics/ws');

            ws.onopen = () => {
                setConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setMetrics(data);
                } catch (e) {
                    console.error("Failed to parse websocket data", e);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                // Attempt to reconnect after a short delay
                reconnectTimer = setTimeout(connect, 1000);
            };

            ws.onerror = (err) => {
                setError('WebSocket connection error');
                ws.close();
            };
        };

        connect();

        return () => {
            clearTimeout(reconnectTimer);
            if (ws) ws.close();
        };
    }, []);

    const simulateJob = async (isBatch: boolean) => {
        await fetch(`http://localhost:8000/api/metrics/simulate_job?is_batch=${isBatch}&vram_required=${isBatch ? 128 : 16}`, {
            method: 'POST'
        });
    };
    
    const switchMode = async (newMode: string) => {
        setMode(newMode);
        await fetch(`http://localhost:8000/api/metrics/mode/${newMode}`, {
            method: 'POST'
        });
    };

    return (
        <main className="p-8 text-white min-h-screen bg-slate-950 font-sans">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight flex items-center gap-3">
                        CerebrumOS Console
                        <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}></span>
                    </h1>
                    <p className="text-slate-400 mt-2 font-mono text-sm">Real-time Inference Infrastructure (WebSocket)</p>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <button 
                        onClick={() => switchMode('simulation')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'simulation' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Simulation Mode
                    </button>
                    <button 
                        onClick={() => switchMode('benchmark')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'benchmark' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Benchmark Mode
                    </button>
                </div>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => simulateJob(false)}
                        className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 rounded-lg text-blue-300 font-bold transition-all active:scale-95"
                    >
                        + Chat Job (Latency)
                    </button>
                    <button 
                        onClick={() => simulateJob(true)}
                        className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 rounded-lg text-purple-300 font-bold transition-all active:scale-95"
                    >
                        + Batch Job (Throughput)
                    </button>
                </div>
            </header>

            {error && !connected && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-6">
                    {error}. Reconnecting...
                </div>
            )}

            {metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* CPU & GPU Utilization */}
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl shadow-lg col-span-1">
                        <h3 className="text-slate-400 font-mono text-sm uppercase tracking-wider mb-6">Hardware Utilization</h3>
                        
                        <div className="mb-6">
                            <div className="flex justify-between mb-2 font-mono text-sm">
                                <span className="text-emerald-400">GPU (VRAM)</span>
                                <span>{metrics.hardware.gpu_utilization}%</span>
                            </div>
                            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                                    animate={{ width: `${Math.min(100, metrics.hardware.gpu_utilization)}%` }}
                                    transition={{ ease: "circOut", duration: 0.1 }}
                                />
                            </div>
                            <div className="mt-2 text-xs text-slate-500 font-mono">
                                Used: {metrics.hardware.vram_used_mb} MB / {metrics.memory_stats.total_blocks * 16} MB
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2 font-mono text-sm">
                                <span className="text-blue-400">CPU</span>
                                <span>{metrics.hardware.cpu_utilization}%</span>
                            </div>
                            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-300"
                                    animate={{ width: `${Math.min(100, metrics.hardware.cpu_utilization)}%` }}
                                    transition={{ ease: "circOut", duration: 0.1 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Schedulers & Queues */}
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl shadow-lg col-span-1 lg:col-span-2">
                        <h3 className="text-slate-400 font-mono text-sm uppercase tracking-wider mb-6">Adaptive Scheduler (MLFQ)</h3>
                        
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-blue-400 font-bold mb-4 flex justify-between">
                                    <span>High Priority (Chat)</span>
                                    <span className="bg-blue-900/50 text-blue-300 px-2 rounded-md">{metrics.queue_stats.chat}</span>
                                </h4>
                                <div className="space-y-2 h-40 overflow-hidden relative">
                                    {Array.from({ length: Math.min(6, metrics.queue_stats.chat) }).map((_, i) => (
                                        <motion.div 
                                            key={`chat-${i}`}
                                            initial={{ opacity: 0, x: -20, scale: 0.9 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            className="bg-blue-900/30 border border-blue-800 p-2 rounded text-xs font-mono text-blue-200"
                                        >
                                            job_req_chat_{Math.random().toString(36).substring(7)}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-purple-400 font-bold mb-4 flex justify-between">
                                    <span>Low Priority (Batch)</span>
                                    <span className="bg-purple-900/50 text-purple-300 px-2 rounded-md">{metrics.queue_stats.batch}</span>
                                </h4>
                                <div className="space-y-2 h-40 overflow-hidden relative">
                                    {Array.from({ length: Math.min(6, metrics.queue_stats.batch) }).map((_, i) => (
                                        <motion.div 
                                            key={`batch-${i}`}
                                            initial={{ opacity: 0, x: -20, scale: 0.9 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            className="bg-purple-900/30 border border-purple-800 p-2 rounded text-xs font-mono text-purple-200"
                                        >
                                            job_req_batch_{Math.random().toString(36).substring(7)}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Thread Pool Workers */}
                    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl shadow-lg col-span-1 lg:col-span-3">
                        <h3 className="text-slate-400 font-mono text-sm uppercase tracking-wider mb-6">C++ Worker Pool</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {metrics.workers.map((worker: any, idx: number) => {
                                const isBusy = worker.status === 1; // 1 = BUSY, 2 = IDLE
                                return (
                                    <motion.div 
                                        key={idx}
                                        animate={{ 
                                            borderColor: isBusy ? '#10b981' : '#334155',
                                            backgroundColor: isBusy ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.5)',
                                            scale: isBusy ? 1.05 : 1.0
                                        }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                        className="border p-4 rounded-xl relative overflow-hidden"
                                    >
                                        {isBusy && (
                                            <motion.div 
                                                className="absolute inset-0 bg-emerald-500/10"
                                                animate={{ opacity: [0, 0.5, 0] }}
                                                transition={{ repeat: Infinity, duration: 1 }}
                                            />
                                        )}
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-bold text-slate-300">W{idx}</span>
                                            <span className={`text-[10px] font-black px-1 py-1 rounded ${isBusy ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-700 text-slate-300'}`}>
                                                {isBusy ? 'BUSY' : 'IDLE'}
                                            </span>
                                        </div>
                                        <div className="text-xl font-mono text-slate-400 flex flex-col">
                                            {worker.tasks_completed} <span className="text-[10px]">tasks</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            )}
        </main>
    );
}
