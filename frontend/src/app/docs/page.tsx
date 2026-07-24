'use client';
export default function DocsModule() {
    return (
        <main className="p-10 text-white min-h-screen selection:bg-emerald-500/30">
            <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">System Documentation</h1>
            <p className="text-slate-400 font-mono text-sm mb-10 border-b border-slate-800 pb-6">CerebrumOS Technical Architecture and API reference manuals.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors">
                    <h2 className="text-xl font-bold text-emerald-400 mb-4 tracking-tight">FlatBuffers IPC Protocol</h2>
                    <p className="text-slate-300 text-sm leading-relaxed mb-6 font-sans">
                        The Next.js frontend communicates with the C++ inference engine using zero-copy Google FlatBuffers over Unix Domain Sockets (`/dev/shm`). This architecture allows 60FPS telemetry streaming without blocking the C++ worker threads.
                    </p>
                    <code className="block bg-slate-950 p-5 rounded-lg border border-slate-800 text-purple-400 font-mono text-sm shadow-inner">
                        <span className="text-rose-400">table</span> HardwareState {'{'} <br/>
                        &nbsp;&nbsp;cpu_util: <span className="text-blue-400">float</span>; <br/>
                        &nbsp;&nbsp;vram_blocks: [<span className="text-blue-400">ubyte</span>]; <br/>
                        {'}'}
                    </code>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-lg hover:border-slate-700 transition-colors">
                    <h2 className="text-xl font-bold text-blue-400 mb-4 tracking-tight">Radix Tree Prefix Cache</h2>
                    <p className="text-slate-300 text-sm leading-relaxed font-sans mb-6">
                        To absolutely minimize Time To First Token (TTFT), the `PagedAllocator` implements an advanced Radix Tree. It hashes incoming prompts and matches them against existing memory nodes in the VRAM pool, entirely skipping the prefill matrix multiplication phase for shared prefixes (like system prompts).
                    </p>
                    <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 font-mono text-xs text-slate-500 shadow-inner">
                        [ROOT]<br/>
                        ├── "You are a helpful AI..." (Hit: 100%)<br/>
                        │   ├── "Translate this to French: " (Hit: 45%)<br/>
                        │   └── "Summarize this article: " (Hit: 82%)
                    </div>
                </div>
            </div>
        </main>
    );
}
