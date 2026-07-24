'use client';

import { useEffect, useState } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';

export default function Simulator() {
    const [running, setRunning] = useState(false);
    const [ipcRate, setIpcRate] = useState(50); // ms per update
    const [memoryPressure, setMemoryPressure] = useState(50); // % allocation
    
    const updateState = useTelemetryStore((state) => state.updateState);

    useEffect(() => {
        if (!running) return;

        const interval = setInterval(() => {
            // 1. Simulate VRAM Fragmentations 
            const newVram = new Uint8Array(4096);
            let isAllocating = false;
            let blockLength = 0;
            for (let i = 0; i < 4096; i++) {
                if (blockLength === 0) {
                    isAllocating = Math.random() < (memoryPressure / 100);
                    blockLength = Math.floor(Math.random() * (memoryPressure / 2)); 
                }
                newVram[i] = isAllocating ? 1 : 0;
                blockLength--;
            }

            // 2. Simulate MLFQ Depths
            const q0 = Math.floor(Math.random() * (memoryPressure * 1.5));
            const q1 = Math.floor(Math.random() * memoryPressure);
            const q2 = Math.floor(Math.random() * (memoryPressure * 0.5));

            // 3. Simulate Pinned C++ Worker States
            const workers = Array(8).fill(null).map((_, i) => {
                const rand = Math.random();
                let status: 'BUSY' | 'IDLE' | 'SPINNING' = 'IDLE';
                if (rand < (memoryPressure / 100)) status = 'BUSY';
                else if (rand < (memoryPressure / 100) + 0.1) status = 'SPINNING';

                return {
                    id: i,
                    status,
                    tasksCompleted: Math.floor(Math.random() * 10000)
                };
            });

            // 4. Simulate Performance Benchmarks & Model Execution
            const tps = Math.floor(Math.random() * 2000) + (memoryPressure * 20); // Tokens/sec
            const ttft = Math.floor(Math.random() * 30) + 10 + (q0 * 0.5); // TTFT jumps under pressure
            const cacheHit = Math.min(100, Math.floor(Math.random() * 60) + 40); // 40-100% cache hit rate
            const activeReqs = Math.floor(Math.random() * (memoryPressure / 2)) + 1; // Dynamic Batching count

            // Dispatch to Zustand
            updateState({ 
                vramGrid: newVram, 
                mlfq: { q0, q1, q2 }, 
                workers,
                metrics: {
                    tokensPerSecond: tps,
                    ttftMs: ttft,
                    cacheHitRate: cacheHit,
                    activeRequests: activeReqs
                }
            });
            
        }, ipcRate); 

        return () => clearInterval(interval);
    }, [running, updateState, ipcRate, memoryPressure]);

    return (
        <div className="w-full bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-700 mt-4">
            <h4 className="text-slate-200 font-mono text-sm mb-4 uppercase tracking-wider">Chaos Control Panel</h4>
            
            <div className="space-y-6 text-left">
                <div>
                    <label className="text-xs font-mono text-slate-400 block mb-2 flex justify-between">
                        <span>Memory Pressure (Batch Size)</span>
                        <span className="text-emerald-400">{memoryPressure}%</span>
                    </label>
                    <input 
                        type="range" min="5" max="95" value={memoryPressure} 
                        onChange={(e) => setMemoryPressure(Number(e.target.value))}
                        className="w-full accent-blue-500"
                    />
                </div>
                
                <div>
                    <label className="text-xs font-mono text-slate-400 block mb-2 flex justify-between">
                        <span>Telemetry IPC Rate</span>
                        <span className="text-purple-400">{ipcRate}ms</span>
                    </label>
                    <input 
                        type="range" min="16" max="250" value={ipcRate} 
                        onChange={(e) => setIpcRate(Number(e.target.value))}
                        className="w-full accent-purple-500"
                    />
                </div>
            </div>

            <button 
                onClick={() => setRunning(!running)}
                className={`mt-8 w-full px-6 py-3 rounded font-mono text-sm font-bold tracking-wide transition-all ${
                    running 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                }`}
            >
                {running ? 'HALT EXECUTION' : 'INITIATE INFERENCE STRESS TEST'}
            </button>
        </div>
    );
}
