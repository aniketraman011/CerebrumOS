'use client';
import { useTelemetryStore } from '../store/telemetryStore';

export default function MetricsPanel() {
    const metrics = useTelemetryStore((state) => state.metrics);
    
    // To prevent hydration mismatch, we ensure metrics exists, though Zustand handles initial state
    if (!metrics) return null;

    return (
        <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-700">
            <h3 className="text-slate-200 font-mono text-sm mb-4 tracking-wider uppercase flex items-center justify-between">
                <span>AI Execution & Benchmarks</span>
                <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">LIVE</span>
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                    title="Token Throughput" 
                    value={`${metrics.tokensPerSecond.toLocaleString()}`} 
                    unit="tok/s"
                    color="text-blue-400" 
                />
                <MetricCard 
                    title="P99 TTFT (Latency)" 
                    value={`${metrics.ttftMs.toFixed(1)}`} 
                    unit="ms"
                    color={metrics.ttftMs > 50 ? "text-rose-400" : "text-emerald-400"} 
                />
                <MetricCard 
                    title="Radix Cache Hits" 
                    value={`${metrics.cacheHitRate}`} 
                    unit="%"
                    color="text-purple-400" 
                />
                <MetricCard 
                    title="Dynamic Batch Size" 
                    value={`${metrics.activeRequests}`} 
                    unit="Reqs"
                    color="text-orange-400" 
                />
            </div>
        </div>
    );
}

function MetricCard({ title, value, unit, color }: { title: string, value: string, unit: string, color: string }) {
    return (
        <div className="bg-slate-950 border border-slate-800 rounded p-4 text-center flex flex-col justify-center">
            <div className="text-slate-500 text-[10px] font-mono mb-2 uppercase tracking-widest">{title}</div>
            <div className="flex items-baseline justify-center gap-1">
                <span className={`text-2xl font-bold font-mono ${color}`}>{value}</span>
                <span className="text-slate-500 text-xs font-mono">{unit}</span>
            </div>
        </div>
    );
}
