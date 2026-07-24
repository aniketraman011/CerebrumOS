'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function AITopModule() {
    const [cpu, setCpu] = useState(45);
    const [vram, setVram] = useState(80);
    const [jobs, setJobs] = useState(12);
    const [cache, setCache] = useState(87.4);

    useEffect(() => {
        const interval = setInterval(() => {
            setCpu(prev => Math.max(10, Math.min(100, prev + (Math.random() * 10 - 5))));
            setVram(prev => Math.max(50, Math.min(95, prev + (Math.random() * 6 - 3))));
            setJobs(prev => Math.max(0, Math.floor(prev + (Math.random() * 4 - 2))));
            setCache(prev => Math.max(60, Math.min(99.9, prev + (Math.random() * 2 - 1))));
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="p-10 text-white min-h-screen font-mono">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                AI-Top (CerebrumOS Daemon)
            </h1>
            <p className="text-slate-400 mb-8 tracking-widest uppercase text-xs">Live Inference Systems Telemetry</p>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-emerald-400 font-bold mb-4 flex justify-between">
                        <span>CPU Usage</span>
                        <span className="text-slate-300">{cpu.toFixed(1)}%</span>
                    </h3>
                    <div className="w-full bg-slate-800 h-4 rounded overflow-hidden shadow-inner">
                        <motion.div 
                            animate={{ width: `${cpu}%` }} 
                            transition={{ ease: "linear", duration: 1.5 }} 
                            className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" 
                        />
                    </div>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-blue-400 font-bold mb-4 flex justify-between">
                        <span>GPU VRAM Usage (Paged)</span>
                        <span className="text-slate-300">{vram.toFixed(1)}%</span>
                    </h3>
                    <div className="w-full bg-slate-800 h-4 rounded overflow-hidden shadow-inner">
                        <motion.div 
                            animate={{ width: `${vram}%` }} 
                            transition={{ ease: "linear", duration: 1.5 }} 
                            className="bg-blue-500 h-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                        />
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-purple-400 font-bold mb-4">MLFQ Scheduler</h3>
                    <div className="text-4xl font-black flex items-baseline gap-2">
                        <motion.span 
                            key={jobs} 
                            initial={{ scale: 1.1, color: '#a855f7' }} 
                            animate={{ scale: 1, color: '#ffffff' }} 
                            transition={{ duration: 0.3 }}
                        >
                            {jobs}
                        </motion.span> 
                        <span className="text-sm text-slate-500 font-normal tracking-widest uppercase">Active Jobs</span>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-orange-400 font-bold mb-4">Radix Prefix Cache</h3>
                    <div className="text-4xl font-black flex items-baseline gap-2">
                        {cache.toFixed(1)}%
                        <span className="text-sm text-emerald-500 font-normal tracking-widest uppercase">+{(Math.random() * 2).toFixed(1)}% (High Hit Rate)</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
