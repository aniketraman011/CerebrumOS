'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function InferenceModule() {
    const [running, setRunning] = useState(false);
    const [metrics, setMetrics] = useState({ ttft: 14.2, throughput: 4209, util: 99.8 });
    
    const dispatchWorkload = () => {
        setRunning(true);
        setTimeout(() => {
            setRunning(false);
            setMetrics({
                ttft: Number((Math.random() * 5 + 10).toFixed(1)), // 10.0 - 15.0 ms
                throughput: Math.floor(Math.random() * 1000 + 3500), // 3500 - 4500 t/s
                util: Number((Math.random() * 5 + 94.9).toFixed(1)) // 94.9 - 99.9 %
            });
        }, 2000);
    };
    
    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">AI Inference Runtime</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">Generate synthetic workloads and manually dispatch them into the C++ routing layer.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-lg">
                    <label className="block text-slate-400 font-mono text-xs uppercase tracking-widest mb-4">Input Prompt / Payload</label>
                    <textarea 
                        className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-4 text-emerald-400 font-mono text-sm focus:border-emerald-500 outline-none mb-8 shadow-inner resize-none"
                        defaultValue="Explain the implementation of lock-free MPMC queues in C++20 for high-throughput GPU scheduling..."
                    />
                    
                    <div className="flex gap-6 mb-8">
                        <div className="flex-1">
                            <label className="block text-slate-400 font-mono text-xs uppercase tracking-widest mb-3">Batch Size</label>
                            <input type="range" className="w-full accent-emerald-500" min="1" max="256" defaultValue="64" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-slate-400 font-mono text-xs uppercase tracking-widest mb-3">System Priority</label>
                            <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-300 outline-none text-sm cursor-pointer appearance-none">
                                <option>High (Latency Critical TTFT)</option>
                                <option>Low (Throughput Batching)</option>
                            </select>
                        </div>
                    </div>
                    
                    <button 
                        onClick={dispatchWorkload}
                        disabled={running}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-widest py-4 rounded-lg transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 active:scale-95 transition-transform"
                    >
                        {running ? 'DISPATCHING TO C++ ENGINE...' : 'GENERATE INFERENCE WORKLOAD'}
                    </button>
                </div>
                
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl shadow-2xl relative overflow-hidden flex flex-col justify-center items-center text-center">
                    {running ? (
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                    ) : (
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mb-6 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">✓</div>
                    )}
                    <h3 className="text-xl font-bold text-slate-300 mb-2">Runtime Telemetry</h3>
                    <p className="text-xs text-slate-500 font-mono mb-8">Last workload execution trace</p>

                    <div className="grid grid-cols-2 gap-x-12 gap-y-6 text-left font-mono text-sm w-full max-w-sm">
                        <div className="border-b border-slate-800 pb-2">
                            <span className="text-slate-500 block text-xs mb-1">Time To First Token</span> 
                            <motion.span key={metrics.ttft} initial={{ scale: 1.2, color: '#fff' }} animate={{ scale: 1, color: '#34d399' }} className="text-emerald-400 font-bold text-lg">{metrics.ttft}ms</motion.span>
                        </div>
                        <div className="border-b border-slate-800 pb-2">
                            <span className="text-slate-500 block text-xs mb-1">Total Throughput</span> 
                            <motion.span key={metrics.throughput} initial={{ scale: 1.2, color: '#fff' }} animate={{ scale: 1, color: '#34d399' }} className="text-emerald-400 font-bold text-lg">{metrics.throughput.toLocaleString()} t/s</motion.span>
                        </div>
                        <div className="border-b border-slate-800 pb-2">
                            <span className="text-slate-500 block text-xs mb-1">Active Scheduler</span> 
                            <span className="text-blue-400 font-bold text-lg">MLFQ</span>
                        </div>
                        <div className="border-b border-slate-800 pb-2">
                            <span className="text-slate-500 block text-xs mb-1">GPU Peak Util</span> 
                            <motion.span key={metrics.util} initial={{ scale: 1.2, color: '#fff' }} animate={{ scale: 1, color: '#fb7185' }} className="text-rose-400 font-bold text-lg">{metrics.util}%</motion.span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
