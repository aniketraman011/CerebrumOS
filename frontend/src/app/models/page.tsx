'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

type Model = {
    name: string;
    status: string;
    memory: number | string; // Numeric GB if running/cached, else string
    gpu: number | string;
    cache: number | string;
};

export default function ModelsModule() {
    const [models, setModels] = useState<Model[]>([
        { name: 'Meta LLaMA-3 70B', status: 'Running', memory: 78.2, gpu: 98, cache: 99.1 },
        { name: 'DeepSeek Coder 33B', status: 'Cached (Idle)', memory: 39.1, gpu: 0, cache: 100 },
        { name: 'Mixtral 8x7B MoE', status: 'Sleeping', memory: '0 GB (Disk)', gpu: '0%', cache: 'Miss (Evicted)' },
        { name: 'Whisper v3 Large', status: 'Failed', memory: 'OOM Error', gpu: '--', cache: '--' },
    ]);

    useEffect(() => {
        const interval = setInterval(() => {
            setModels(prev => prev.map(m => {
                if (m.status === 'Running') {
                    return {
                        ...m,
                        memory: Number((78.2 + (Math.random() * 0.4 - 0.2)).toFixed(1)), // 78.0 - 78.4
                        gpu: Math.floor(95 + Math.random() * 5), // 95 - 99
                        cache: Number((98.5 + Math.random() * 1.4).toFixed(1)) // 98.5 - 99.9
                    };
                }
                if (m.status === 'Cached (Idle)') {
                    // Small chance it handles a background job
                    const active = Math.random() > 0.8;
                    return {
                        ...m,
                        gpu: active ? Math.floor(Math.random() * 20 + 5) : 0, // 0 or 5-25%
                        cache: active ? Number((99.0 + Math.random() * 1.0).toFixed(1)) : 100
                    };
                }
                return m;
            }));
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Model Manager</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">Live state of AI models registered across the distributed VRAM pool.</p>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <table className="w-full text-left font-mono text-sm">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 tracking-widest uppercase text-xs">
                        <tr>
                            <th className="p-6">Model Architecture</th>
                            <th className="p-6">Runtime Status</th>
                            <th className="p-6">VRAM Allocation</th>
                            <th className="p-6">GPU Util</th>
                            <th className="p-6">Prefix Cache</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {models.map((m, i) => (
                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-6 font-bold text-slate-200">{m.name}</td>
                                <td className="p-6">
                                    <span className={`px-3 py-1 rounded text-[10px] tracking-widest uppercase border ${
                                        m.status === 'Running' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                                        m.status.includes('Cached') ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' :
                                        m.status === 'Failed' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' :
                                        'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}>{m.status}</span>
                                </td>
                                <td className={`p-6 ${typeof m.memory === 'string' && m.memory.includes('OOM') ? 'text-rose-400' : 'text-purple-400'}`}>
                                    {typeof m.memory === 'number' ? <motion.span key={m.memory} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>{m.memory} GB</motion.span> : m.memory}
                                </td>
                                <td className="p-6 text-slate-300">
                                    {typeof m.gpu === 'number' ? <motion.span key={m.gpu} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>{m.gpu}%</motion.span> : m.gpu}
                                </td>
                                <td className={`p-6 ${typeof m.cache === 'number' || (typeof m.cache === 'string' && m.cache.includes('Hit')) ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {typeof m.cache === 'number' ? <motion.span key={m.cache} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>Hit ({m.cache}%)</motion.span> : m.cache}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
