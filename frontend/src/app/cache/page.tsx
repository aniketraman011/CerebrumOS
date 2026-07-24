'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function CacheModule() {
    const [hitRate, setHitRate] = useState(85.4);
    const [kvUsage, setKvUsage] = useState(42.1);
    
    // Simulate real-time cache fluctuations
    useEffect(() => {
        const interval = setInterval(() => {
            setHitRate(prev => Math.min(99.9, Math.max(50, prev + (Math.random() * 4 - 2))));
            setKvUsage(prev => Math.min(100, Math.max(10, prev + (Math.random() * 6 - 3))));
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Radix Cache Dashboard</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">Real-time cache hit rates across Model Weights, Embeddings, and dynamic KV Cache blocks.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <CacheCard title="Model Weight Cache" type="LFU Policy" hitRate={99.9} usage={100} color="bg-blue-500" />
                <CacheCard title="Embedding Cache" type="Redis Distributed" hitRate={92.4} usage={64} color="bg-purple-500" />
                <CacheCard title="Prefix KV Cache" type="Radix Tree LRU" hitRate={hitRate} usage={kvUsage} color="bg-emerald-500" />
            </div>

            {/* Visualizer */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl">
                <h3 className="text-slate-300 font-mono text-sm uppercase tracking-widest mb-8 flex justify-between">
                    <span>Live KV Cache Hit Rate</span>
                    <span className="text-emerald-400">Target: &gt;80%</span>
                </h3>
                
                <div className="w-full bg-slate-950 h-16 rounded overflow-hidden flex border border-slate-700 relative shadow-inner">
                    <motion.div 
                        className="h-full bg-emerald-500/80 flex items-center justify-center font-black font-mono text-xl shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                        animate={{ width: `${hitRate}%` }}
                        transition={{ ease: "linear", duration: 1.5 }}
                    >
                        {hitRate.toFixed(1)}% HIT
                    </motion.div>
                    <motion.div 
                        className="h-full bg-rose-500/30 border-l border-rose-500/50 flex items-center justify-center font-bold font-mono absolute right-0 text-rose-400"
                        animate={{ width: `${100 - hitRate}%` }}
                        transition={{ ease: "linear", duration: 1.5 }}
                    >
                        {(100 - hitRate).toFixed(1)}% MISS
                    </motion.div>
                </div>
                
                <div className="mt-6 flex justify-between text-xs font-mono text-slate-500">
                    <span>0% (Thrashing)</span>
                    <span>100% (Perfect Recall)</span>
                </div>
            </div>
        </main>
    );
}

function CacheCard({title, type, hitRate, usage, color}: any) {
    return (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors">
            <h3 className="text-slate-200 font-bold text-lg mb-2">{title}</h3>
            <p className="text-slate-500 font-mono text-xs mb-8 uppercase tracking-widest">{type}</p>
            
            <div className="flex justify-between items-end mb-3">
                <span className="text-5xl font-black">{hitRate.toFixed(1)}<span className="text-2xl text-slate-400">%</span></span>
                <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">Hit Rate</span>
            </div>
            
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 mb-2">
                <motion.div className={`h-full ${color}`} initial={{width:0}} animate={{width: `${usage}%`}} transition={{duration: 1}} />
            </div>
            <p className="text-right text-[10px] text-slate-500 font-mono">{usage.toFixed(1)}% Capacity Utilized</p>
        </div>
    )
}
