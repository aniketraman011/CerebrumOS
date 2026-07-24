'use client';
import { useTelemetryStore } from '../store/telemetryStore';

export default function WorkerPool() {
    const workers = useTelemetryStore((state) => state.workers);

    return (
        <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-700">
            <h3 className="text-slate-200 font-mono text-sm mb-4 tracking-wider uppercase">
                Hardware Core Alignment (Pinned Workers)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {workers.map((w) => (
                    <div 
                        key={w.id} 
                        className={`border rounded p-4 text-center transition-colors duration-100 ${
                            w.status === 'BUSY' ? 'bg-rose-950/30 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]' :
                            w.status === 'SPINNING' ? 'bg-orange-950/30 border-orange-500/50' :
                            'bg-emerald-950/30 border-emerald-500/30'
                        }`}
                    >
                        <div className="text-slate-400 text-xs font-mono mb-3 uppercase tracking-widest">
                            NUMA 0 / Core {w.id}
                        </div>
                        
                        <div className={`text-xs font-bold px-3 py-1.5 rounded inline-block tracking-widest ${
                            w.status === 'BUSY' ? 'bg-rose-500 text-white' :
                            w.status === 'SPINNING' ? 'bg-orange-500 text-white' :
                            'bg-emerald-500/20 text-emerald-400'
                        }`}>
                            {w.status}
                        </div>
                        
                        <div className="text-[10px] text-slate-500 mt-3 font-mono opacity-60">
                            TASKS: {w.tasksCompleted.toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
