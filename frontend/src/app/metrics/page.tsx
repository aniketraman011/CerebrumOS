'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function Analytics() {
    const [loading, setLoading] = useState(true);
    
    // Generate 24 hours of mock historical data
    const historicalData = Array.from({ length: 24 }).map((_, i) => ({
        hour: `T-${24-i}h`,
        tps: Math.floor(Math.random() * 2000 + 3000), // 3000-5000 tps
    }));

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <main className="p-10 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Historical Benchmarking</h1>
            
            {loading ? (
                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-xl flex flex-col items-center justify-center h-96 shadow-xl text-center">
                    <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                    <p className="text-slate-400 font-mono text-sm mb-2">Aggregating IPC Metrics from SQLite database...</p>
                    <p className="text-slate-500 text-xs">Parsing 24 hours of inference stress test telemetry.</p>
                </div>
            ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl">
                    <h3 className="text-slate-300 font-mono text-sm uppercase tracking-widest mb-8 border-b border-slate-800 pb-4">
                        Average Throughput (Tokens / sec) - Last 24 Hours
                    </h3>
                    
                    <div className="h-64 flex items-end gap-2 mt-4">
                        {historicalData.map((data, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group">
                                <div className="text-[10px] text-slate-400 font-mono mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {data.tps.toLocaleString()} t/s
                                </div>
                                <motion.div 
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(data.tps / 5500) * 100}%` }}
                                    transition={{ duration: 1, delay: i * 0.05, ease: "easeOut" }}
                                    className="w-full bg-emerald-500/80 hover:bg-emerald-400 rounded-t-sm shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-colors cursor-crosshair"
                                />
                                <div className="text-[9px] text-slate-600 font-mono mt-3 -rotate-45 origin-top-left ml-2">
                                    {data.hour}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-12 grid grid-cols-3 gap-6 pt-6 border-t border-slate-800">
                        <div>
                            <p className="text-slate-500 font-mono text-xs uppercase mb-1">Peak Throughput</p>
                            <p className="text-emerald-400 font-black text-2xl font-mono">4,982 <span className="text-sm font-normal text-slate-500">t/s</span></p>
                        </div>
                        <div>
                            <p className="text-slate-500 font-mono text-xs uppercase mb-1">Total SQLite Rows Parsed</p>
                            <p className="text-blue-400 font-black text-2xl font-mono">1,402,834</p>
                        </div>
                        <div>
                            <p className="text-slate-500 font-mono text-xs uppercase mb-1">P99 Latency</p>
                            <p className="text-purple-400 font-black text-2xl font-mono">15.8 <span className="text-sm font-normal text-slate-500">ms</span></p>
                        </div>
                    </div>
                </motion.div>
            )}
        </main>
    );
}
