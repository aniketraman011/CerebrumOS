'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Job = { id: string, priority: number, color: string };

const generateRandomJob = (counter: number): Job => {
    const p = Math.floor(Math.random() * 5) + 1; // Priority 1-5
    const colors = ['bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500'];
    return {
        id: `Custom Job ${counter}`,
        priority: p,
        color: colors[Math.floor(Math.random() * colors.length)]
    };
};

const INITIAL_JOBS: Job[] = [
    { id: 'Job A (Low Prio)', priority: 1, color: 'bg-rose-500' },
    { id: 'Job B (High Prio)', priority: 5, color: 'bg-emerald-500' },
    { id: 'Job C (Med Prio)', priority: 3, color: 'bg-blue-500' },
    { id: 'Job D (Low Prio)', priority: 2, color: 'bg-purple-500' }
];

export default function AlgorithmVisualizer() {
    const [queue, setQueue] = useState<Job[]>(INITIAL_JOBS);
    const [cpu, setCpu] = useState<Job | null>(null);
    const [finished, setFinished] = useState<Job[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [jobCounter, setJobCounter] = useState(1);
    
    // Interactive form state
    const [customName, setCustomName] = useState("");
    const [customPrio, setCustomPrio] = useState(3);
    const [customColor, setCustomColor] = useState("bg-indigo-500");

    const addJob = () => {
        const name = customName.trim() === "" ? `Custom Job ${jobCounter}` : customName;
        setQueue([...queue, { id: name, priority: customPrio, color: customColor }]);
        setJobCounter(c => c + 1);
        setCustomName("");
    };

    // Priority Scheduling: Sorts by Priority before execution
    const runPriority = async () => {
        setIsRunning(true);
        let currentQueue = [...queue].sort((a, b) => b.priority - a.priority);
        setQueue(currentQueue);
        await executeQueue(currentQueue);
        setIsRunning(false);
    };

    // Round Robin / FCFS: Executes in exact order of arrival
    const runRoundRobin = async () => {
        setIsRunning(true);
        let currentQueue = [...queue];
        await executeQueue(currentQueue);
        setIsRunning(false);
    };

    const executeQueue = async (jobsToRun: Job[]) => {
        for (const job of jobsToRun) {
            // Move from Queue to CPU
            setQueue((q) => q.filter(j => j.id !== job.id));
            setCpu(job);

            // Hardware Execution Wait
            await new Promise(r => setTimeout(r, 1200));

            // Move from CPU to Finished
            setCpu(null);
            setFinished((f) => [job, ...f]); // Add to top of finished

            // Tiny gap for context switch
            await new Promise(r => setTimeout(r, 200));
        }
    };

    const reset = () => {
        setQueue(INITIAL_JOBS);
        setCpu(null);
        setFinished([]);
        setJobCounter(1);
    };

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Interactive Algorithm Visualizer</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">
                Watch how the C++ <code>IScheduler</code> routes inference requests through physical hardware.
            </p>

            <div className="flex flex-col gap-6 mb-10 bg-slate-900/50 p-6 rounded-xl border border-slate-800 shadow-xl">
                
                {/* Form Row */}
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-slate-400 font-mono text-[10px] uppercase tracking-widest mb-2">Job Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g. LLM Inference"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-emerald-400 font-mono text-sm focus:border-emerald-500 outline-none shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-400 font-mono text-[10px] uppercase tracking-widest mb-2">Priority (1-10)</label>
                        <input 
                            type="number" 
                            min="1" max="10"
                            value={customPrio}
                            onChange={(e) => setCustomPrio(Number(e.target.value))}
                            className="w-24 bg-slate-950 border border-slate-700 rounded p-3 text-emerald-400 font-mono text-sm focus:border-emerald-500 outline-none shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-400 font-mono text-[10px] uppercase tracking-widest mb-2">Color Tag</label>
                        <select 
                            value={customColor}
                            onChange={(e) => setCustomColor(e.target.value)}
                            className="w-32 bg-slate-950 border border-slate-700 rounded p-3 text-slate-300 font-mono text-sm outline-none cursor-pointer appearance-none shadow-inner"
                        >
                            <option value="bg-indigo-500">Indigo</option>
                            <option value="bg-rose-500">Rose</option>
                            <option value="bg-emerald-500">Emerald</option>
                            <option value="bg-blue-500">Blue</option>
                            <option value="bg-purple-500">Purple</option>
                            <option value="bg-orange-500">Orange</option>
                            <option value="bg-teal-500">Teal</option>
                        </select>
                    </div>
                    <button
                        onClick={addJob}
                        disabled={isRunning}
                        className="h-[46px] bg-indigo-500 hover:bg-indigo-400 text-white px-6 rounded font-mono font-bold tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.3)] active:scale-95"
                    >
                        + ADD
                    </button>
                </div>

                <div className="w-full h-px bg-slate-800"></div>

                {/* Actions Row */}
                <div className="flex gap-4">
                    <button
                        onClick={runPriority}
                        disabled={isRunning || queue.length === 0}
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-6 py-3 rounded font-mono font-bold tracking-widest hover:bg-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95"
                    >
                        PRIORITY (SORT)
                    </button>
                    <button
                        onClick={runRoundRobin}
                        disabled={isRunning || queue.length === 0}
                        className="bg-blue-500/20 text-blue-400 border border-blue-500/50 px-6 py-3 rounded font-mono font-bold tracking-widest hover:bg-blue-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95"
                    >
                        ROUND ROBIN (FIFO)
                    </button>
                    <div className="w-px bg-slate-800 mx-2"></div>
                    <button
                        onClick={reset}
                        disabled={isRunning}
                        className="bg-slate-800 text-slate-300 px-6 py-3 rounded font-mono hover:bg-slate-700 transition-colors disabled:opacity-30 active:scale-95"
                    >
                        Reset State
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* MPMC INCOMING QUEUE */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl min-h-[400px] shadow-lg flex flex-col">
                    <h3 className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex justify-between">
                        <span>Incoming Queue</span>
                        <span>[ {queue.length} ]</span>
                    </h3>
                    <div className="space-y-4 flex-1">
                        <AnimatePresence>
                            {queue.map(job => (
                                <motion.div
                                    key={job.id}
                                    layout
                                    initial={{ opacity: 0, x: -50 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 50, scale: 0.95 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`${job.color} p-4 rounded shadow-lg font-mono text-sm font-bold flex justify-between items-center`}
                                >
                                    <span>{job.id}</span>
                                    <span className="bg-black/30 px-2 py-1 rounded text-[10px] tracking-wider uppercase border border-white/10">Prio: {job.priority}</span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* GPU EXECUTION ENGINE */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl min-h-[400px] flex flex-col shadow-lg">
                    <h3 className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                        GPU Worker Pipeline
                    </h3>
                    <div className="flex-1 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center p-6 relative overflow-hidden bg-slate-950/50">
                        {cpu && <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>}
                        <AnimatePresence mode="popLayout">
                            {cpu ? (
                                <motion.div
                                    key={cpu.id}
                                    layout
                                    initial={{ opacity: 0, y: -50, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1.1 }}
                                    exit={{ opacity: 0, y: 50, scale: 0.8 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    className={`${cpu.color} p-6 rounded shadow-[0_0_30px_rgba(0,0,0,0.5)] font-mono text-lg font-bold w-full text-center relative z-10 border border-white/20`}
                                >
                                    EXECUTING: {cpu.id}
                                    <div className="w-full bg-black/30 h-1 mt-4 rounded overflow-hidden">
                                        <motion.div
                                            initial={{ width: "0%" }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 1.2, ease: "linear" }}
                                            className="h-full bg-white/60"
                                        />
                                    </div>
                                </motion.div>
                            ) : (
                                <span className="text-slate-600 font-mono text-sm uppercase tracking-widest">Awaiting Instructions</span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* FINISHED JOBS */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl min-h-[400px] shadow-lg flex flex-col">
                    <h3 className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex justify-between">
                        <span>Completed Tasks</span>
                        <span className="text-emerald-500">✓ {finished.length}</span>
                    </h3>
                    <div className="space-y-4 flex-1">
                        <AnimatePresence>
                            {finished.map(job => (
                                <motion.div
                                    key={job.id}
                                    layout
                                    initial={{ opacity: 0, x: -50 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`${job.color} opacity-40 p-4 rounded font-mono text-sm flex justify-between items-center grayscale-[30%] border border-white/5`}
                                >
                                    <span>{job.id} Completed</span>
                                    <span className="text-[10px] bg-black/20 px-2 py-1 rounded">✓</span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </main>
    );
}
