'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LogsModule() {
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            const timestamp = new Date().toISOString();
            const events = [
                "[CerebrumOS_Scheduler] Dispatching chat request to GPU worker 1",
                "[CerebrumOS_Memory] PagedAllocator: Allocated 16MB for KV Cache block",
                "[CerebrumOS_Cache] RadixTree: System prompt hit (Freq: 24)",
                "[CerebrumOS_IPC] Zero-copy buffer transmitted via /dev/shm",
                "[FastAPI_Ingress] 200 OK POST /v1/inference/completions"
            ];
            const event = events[Math.floor(Math.random() * events.length)];
            setLogs(prev => [`${timestamp} - ${event}`, ...prev].slice(0, 50));
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="p-10 text-white min-h-screen">
            <h1 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                System Logs
            </h1>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-y-auto h-[70vh] shadow-xl">
                {logs.length === 0 && <p className="text-slate-500">Waiting for runtime logs...</p>}
                {logs.map((log, i) => (
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className="py-1 border-b border-slate-800/50 text-slate-300"
                    >
                        {log}
                    </motion.div>
                ))}
            </div>
        </main>
    );
}
