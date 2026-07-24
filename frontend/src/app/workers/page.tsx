'use client';
import { useEffect } from 'react';
import WorkerPool from '../../components/WorkerPool';
import { useTelemetryStore } from '../../store/telemetryStore';

export default function WorkersModule() {
    
    useEffect(() => {
        // Simulates the C++ thread pool telemetry stream
        const interval = setInterval(() => {
            const currentWorkers = useTelemetryStore.getState().workers;
            const updatedWorkers = currentWorkers.map(w => {
                const rand = Math.random();
                let status: 'IDLE' | 'SPINNING' | 'BUSY' = 'IDLE';
                let tasksCompleted = w.tasksCompleted;

                if (rand > 0.7) {
                    status = 'BUSY';
                    tasksCompleted += Math.floor(Math.random() * 12 + 1);
                } else if (rand > 0.5) {
                    status = 'SPINNING';
                }

                return { ...w, status, tasksCompleted };
            });

            useTelemetryStore.getState().updateState({ workers: updatedWorkers });
        }, 400); // Fast 400ms interval for thread pool visualization

        return () => clearInterval(interval);
    }, []);

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Thread Pool Dashboard</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">Live tracking of the atomic C++ `WorkerState` structs across all physical NUMA cores.</p>
            
            <div className="max-w-5xl">
                <WorkerPool />
                
                <div className="mt-8 bg-slate-900 border border-slate-800 p-6 rounded-xl font-mono text-sm text-slate-400 leading-relaxed shadow-xl">
                    <span className="text-rose-400 font-bold uppercase tracking-widest border-b border-slate-800 pb-2 block mb-4">State Transitions</span>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-4">
                            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-[10px] font-bold tracking-widest mt-0.5">IDLE</span>
                            <span>The thread is resting.</span>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded text-[10px] font-bold tracking-widest mt-0.5">SPINNING</span>
                            <span>The thread is waiting on a lock-free TTAS Spinlock (<code className="bg-slate-950 px-1 py-0.5 rounded text-orange-300">_mm_pause</code>). This state lasts for microseconds.</span>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded text-[10px] font-bold tracking-widest mt-0.5">BUSY</span>
                            <span>The thread is actively crunching CUDA matrix multiplications.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
