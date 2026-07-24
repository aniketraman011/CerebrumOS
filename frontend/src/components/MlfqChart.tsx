'use client';
import { useTelemetryStore } from '../store/telemetryStore';

export default function MlfqChart() {
    const history = useTelemetryStore((state) => state.mlfqHistory);
    const maxVal = 150; // Max queue depth for scaling

    return (
        <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-700 h-64 flex flex-col">
            <h3 className="text-slate-200 font-mono text-sm mb-4 tracking-wider uppercase">
                MLFQ Active Depth (Real-Time)
            </h3>
            <div className="flex-1 flex items-end justify-between gap-1 overflow-hidden">
                {history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center w-full">
                        {/* 
                            We use CSS transitions rather than Framer Motion for this 
                            high-frequency bar chart to guarantee 60FPS DOM execution.
                        */}
                        <div 
                            className="w-full bg-rose-500 rounded-t-sm" 
                            style={{ height: `${(h.q0 / maxVal) * 100}%`, transition: 'height 50ms linear' }}
                            title="Q0"
                        />
                        <div 
                            className="w-full bg-orange-400" 
                            style={{ height: `${(h.q1 / maxVal) * 100}%`, transition: 'height 50ms linear' }}
                        />
                        <div 
                            className="w-full bg-emerald-400 rounded-b-sm opacity-80" 
                            style={{ height: `${(h.q2 / maxVal) * 100}%`, transition: 'height 50ms linear' }}
                        />
                    </div>
                ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs font-mono justify-center border-t border-slate-800 pt-3">
                <span className="text-rose-500 flex items-center"><span className="w-2 h-2 inline-block bg-rose-500 mr-2 rounded"></span>Q0 (TTFT Critical)</span>
                <span className="text-orange-400 flex items-center"><span className="w-2 h-2 inline-block bg-orange-400 mr-2 rounded"></span>Q1 (Decode)</span>
                <span className="text-emerald-400 flex items-center"><span className="w-2 h-2 inline-block bg-emerald-400 mr-2 rounded"></span>Q2 (Background)</span>
            </div>
        </div>
    );
}
