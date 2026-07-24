'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NODES = [
    { id: 'api', name: 'FastAPI Ingress', type: 'Python / Backend', complexity: 'O(1)', desc: 'Handles HTTP/REST requests, API keys, and model routing. Bypasses the GIL instantly by passing requests to C++ via Unix Domain Sockets.' },
    { id: 'bridge', name: 'IPCBridge (Watchdog)', type: 'C++ Thread', complexity: 'O(1)', desc: 'A dedicated low-latency thread utilizing FlatBuffers to stream atomic memory states to the Next.js frontend at 60FPS without blocking execution.' },
    { id: 'scheduler', name: 'IScheduler (MLFQ)', type: 'C++ Core', complexity: 'O(1)', desc: 'The heart of CerebrumOS. Uses lock-free MPMC (Multi-Producer Multi-Consumer) queues to route inference jobs to physical cores.' },
    { id: 'memory', name: 'PagedAllocator', type: 'CUDA / C++', complexity: 'O(log N)', desc: 'Virtualizes physical VRAM into fixed-size blocks. Implements a Radix Tree for zero-compute Prefix Caching and KV sharing.' },
    { id: 'worker', name: 'Hardware WorkerPool', type: 'C++ Core', complexity: 'O(1)', desc: '8 pinned std::thread objects mapped exactly to NUMA nodes. Uses TTAS Spinlocks with _mm_pause() to completely eliminate OS Context Switches.' }
];

export default function Architecture() {
    const [activeNode, setActiveNode] = useState(NODES[2]);

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Interactive System Architecture</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">Click on a system node in the flowchart to view its internal C++ implementation details and algorithmic complexity.</p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Node Graph Map (Flowchart) */}
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-lg flex flex-col items-center gap-2">
                    {NODES.map((node, i) => (
                        <div key={node.id} className="flex flex-col items-center w-full">
                            <button 
                                onClick={() => setActiveNode(node)}
                                className={`w-full p-5 rounded-lg font-mono font-bold tracking-widest transition-all border-2 ${
                                    activeNode.id === node.id 
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] scale-[1.02]' 
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                                }`}
                            >
                                {node.name}
                            </button>
                            {i < NODES.length - 1 && (
                                <div className="h-6 border-l-2 border-dashed border-slate-700 my-1"></div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Info Panel */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 p-10 rounded-xl shadow-2xl relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 bg-emerald-500/10 px-4 py-2 text-[10px] font-mono text-emerald-400 border-b border-l border-emerald-500/30 rounded-bl-lg tracking-widest uppercase">
                        {activeNode.type} MODULE
                    </div>
                    
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeNode.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">{activeNode.name}</h2>
                            <div className="text-sm font-mono text-rose-400 mb-8 tracking-widest uppercase">
                                Algorithmic Complexity: {activeNode.complexity}
                            </div>
                            
                            <p className="text-slate-300 mb-10 leading-relaxed text-lg">{activeNode.desc}</p>
                            
                            <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 font-mono text-sm text-slate-400 shadow-inner">
                                <span className="text-purple-400">class</span> <span className="text-blue-400">{activeNode.name.replace(/ \(.*/, '')}</span> {'{'}
                                <br/>
                                <span className="text-emerald-400 ml-4">public:</span><br/>
                                <span className="text-slate-500 ml-8">// Executes strictly in userspace</span><br/>
                                <span className="text-slate-500 ml-8">// Bypasses OS CFS completely</span><br/>
                                <span className="text-slate-300 ml-8">void execute() noexcept;</span><br/>
                                {'}'}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </main>
    );
}
