'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function Deploy() {
    const router = useRouter();
    const [isDeploying, setIsDeploying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState("");

    const handleDeploy = async () => {
        setIsDeploying(true);
        
        setLog("Initializing Pybind11 Interface & WorkerPool...");
        setProgress(15);
        await new Promise(r => setTimeout(r, 1000));
        
        setLog("Allocating 80GB VRAM via PagedAllocator...");
        setProgress(30);
        await new Promise(r => setTimeout(r, 1200));

        setLog("Streaming LLaMA-3 weights into Radix Tree Cache...");
        for (let i = 30; i <= 85; i += 5) {
            setProgress(i);
            await new Promise(r => setTimeout(r, 200));
        }

        setLog("Instantiating IScheduler Strategy (C++)...");
        setProgress(95);
        await new Promise(r => setTimeout(r, 1000));

        setProgress(100);
        setLog("Deployment Successful. Redirecting to Live Telemetry...");
        await new Promise(r => setTimeout(r, 1000));
        
        router.push('/metrics');
    };

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Deploy Inference Model</h1>
            
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-xl max-w-2xl space-y-8 shadow-2xl relative overflow-hidden">
                
                {/* Deployment Overlay */}
                <AnimatePresence>
                    {isDeploying && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center"
                        >
                            <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                            <h2 className="text-xl font-bold text-emerald-400 mb-2">DEPLOYING TO GPU NODE</h2>
                            <p className="text-slate-400 font-mono text-sm mb-8 h-6">{log}</p>
                            
                            <div className="w-full max-w-md bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                                <motion.div 
                                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                    animate={{ width: `${progress}%` }}
                                    transition={{ ease: "linear", duration: 0.2 }}
                                />
                            </div>
                            <p className="text-emerald-500 font-mono mt-2 text-xs">{progress}%</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div>
                    <label className="block text-slate-400 font-mono text-sm mb-3 uppercase tracking-wider">1. Select Registered Model</label>
                    <select className="w-full bg-slate-950 border border-slate-700 p-4 rounded-lg text-slate-200 outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none">
                        <option value="llama3-70b">Meta LLaMA-3 70B (80GB VRAM Required)</option>
                        <option value="deepseek">DeepSeek Coder 33B (40GB VRAM Required)</option>
                        <option value="mixtral">Mixtral 8x7B MoE (48GB VRAM Required)</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-slate-400 font-mono text-sm mb-3 uppercase tracking-wider">2. C++ Scheduler Algorithm Strategy</label>
                    <div className="relative">
                        <select className="w-full bg-slate-950 border border-slate-700 p-4 rounded-lg text-slate-200 outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none">
                            <option value="mlfq">Multi-Level Feedback Queue (MLFQ) - Optimal TTFT</option>
                            <option value="fcfs">First-Come First-Serve (FCFS)</option>
                            <option value="rr">Round Robin (RR)</option>
                            <option value="priority">Strict Priority Execution</option>
                            <option value="ai">Neural Heuristic Routing (AI Beta)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            ▼
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 font-mono">This configures the C++ `IScheduler` interface instantiated by Pybind11 upon deployment.</p>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={handleDeploy}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-widest py-4 rounded-lg transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                        INITIATE GPU DEPLOYMENT
                    </button>
                </div>
            </div>
        </main>
    );
}
