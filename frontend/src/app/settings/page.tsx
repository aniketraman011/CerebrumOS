'use client';
import { useState, useEffect } from 'react';

export default function SettingsModule() {
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // State for controlled components
    const [vram, setVram] = useState(95);
    const [interval, setIntervalVal] = useState("1000ms (Low Overhead)");
    const [starvation, setStarvation] = useState(true);

    // Load from true SQLite backend on mount
    useEffect(() => {
        fetch('http://localhost:8000/api/settings/')
            .then(res => res.json())
            .then(data => {
                setVram(data.vram_limit);
                setIntervalVal(data.flush_interval);
                setStarvation(data.mlfq_starvation);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch settings from SQLite:", err);
                setLoading(false);
            });
    }, []);
    
    const handleSave = async () => {
        try {
            await fetch('http://localhost:8000/api/settings/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vram_limit: vram,
                    flush_interval: interval,
                    mlfq_starvation: starvation
                })
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Failed to save settings:", err);
            alert("Error: Backend is offline.");
        }
    };

    const handleReset = async () => {
        setVram(95);
        setIntervalVal("1000ms (Low Overhead)");
        setStarvation(true);
        
        try {
            await fetch('http://localhost:8000/api/settings/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vram_limit: 95,
                    flush_interval: "1000ms (Low Overhead)",
                    mlfq_starvation: true
                })
            });
            alert("Defaults restored and synced to SQLite.");
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <main className="p-10 text-white min-h-screen">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
            </main>
        );
    }

    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">Cluster Settings</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">Configure global parameters for the CerebrumOS inference engine hardware.</p>
            
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-xl shadow-2xl space-y-8 max-w-3xl">
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-slate-300 font-mono text-sm uppercase tracking-widest">Max VRAM Allocation Limit</label>
                        <span className="text-emerald-400 font-bold font-mono">{vram}%</span>
                    </div>
                    <input 
                        type="range" 
                        className="w-full accent-emerald-500 cursor-pointer" 
                        min="10" max="100"
                        value={vram} 
                        onChange={(e) => setVram(Number(e.target.value))}
                    />
                    <p className="text-xs text-slate-500 font-mono mt-3 leading-relaxed">Limits the maximum physical GPU memory the PagedAllocator is allowed to reserve. Setting this to 100% may cause OS-level out-of-memory kernel panics.</p>
                </div>
                
                <div className="pt-8 border-t border-slate-800">
                    <label className="block text-slate-300 font-mono text-sm uppercase tracking-widest mb-4">SQLite Metrics Flush Interval</label>
                    <select 
                        value={interval}
                        onChange={(e) => setIntervalVal(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 outline-none font-mono cursor-pointer appearance-none shadow-inner"
                    >
                        <option>100ms (High Frequency Telemetry)</option>
                        <option>500ms (Standard Polling)</option>
                        <option>1000ms (Low Overhead)</option>
                    </select>
                </div>

                <div className="pt-8 border-t border-slate-800">
                    <label className="flex items-center gap-4 text-slate-300 font-mono text-sm cursor-pointer hover:text-emerald-400 transition-colors group">
                        <div className="relative flex items-center justify-center">
                            <input 
                                type="checkbox" 
                                checked={starvation}
                                onChange={(e) => setStarvation(e.target.checked)}
                                className="w-6 h-6 appearance-none border-2 border-slate-600 rounded cursor-pointer checked:bg-emerald-500 checked:border-emerald-500 transition-all" 
                            />
                            <span className={`absolute text-slate-900 font-black pointer-events-none transition-opacity ${starvation ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                        </div>
                        Enable MLFQ Starvation Aging (Beta)
                    </label>
                    <p className="text-xs text-slate-500 mt-4 ml-10 leading-relaxed font-mono">Allows the scheduler to dynamically promote low-priority background batch jobs to the high-priority chat queue if they have been waiting longer than the starvation threshold.</p>
                </div>
                
                <div className="pt-10 flex flex-col gap-4">
                    <div className="flex gap-4">
                        <button 
                            onClick={handleSave}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-lg font-mono font-black tracking-widest transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
                        >
                            SAVE CONFIGURATION
                        </button>
                        <button 
                            onClick={handleReset}
                            className="bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 px-8 py-4 rounded-lg font-mono font-bold tracking-widest transition-colors active:scale-95"
                        >
                            RESET DEFAULTS
                        </button>
                    </div>
                    {saved && (
                        <p className="text-emerald-400 font-mono text-sm animate-pulse">✓ Configuration flushed to true SQLite backend.</p>
                    )}
                </div>
            </div>
        </main>
    );
}
