'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    const groups = [
        {
            title: 'Centerpiece',
            items: [
                { name: 'Runtime Playground', path: '/' },
                { name: 'Timeline Replay', path: '/timeline' },
                { name: 'Decision Engine', path: '/schedulers' },
            ],
        },
        {
            title: 'OS Primitives',
            items: [
                { name: 'Memory Visualization', path: '/memory' },
                { name: 'Thread Workers', path: '/workers' },
                { name: 'Radix Cache', path: '/cache' },
                { name: 'Dashboard (AI-Top)', path: '/htop' },
            ],
        },
        {
            title: 'Systems Analysis',
            items: [
                { name: 'Benchmark Dashboard', path: '/benchmarks' },
                { name: 'Architecture', path: '/architecture' },
                { name: 'Algorithms', path: '/algorithms' },
                { name: 'Metrics', path: '/metrics' },
            ],
        },
        {
            title: 'Platform',
            items: [
                { name: 'Documentation', path: '/docs' },
                { name: 'Settings', path: '/settings' },
                { name: 'Logs', path: '/logs' },
            ],
        },
    ];

    return (
        <aside className="w-72 bg-slate-950 border-r border-slate-800 min-h-screen flex flex-col overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                <Link href="/">
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tighter">
                        CerebrumOS
                    </h1>
                </Link>
                <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">
                    AI Inference Runtime
                </p>
            </div>

            <nav className="flex-1 p-4 space-y-6">
                {groups.map((group, idx) => (
                    <div key={idx}>
                        <h4 className="text-xs font-mono text-slate-500 mb-3 px-4 uppercase tracking-widest">{group.title}</h4>
                        <div className="space-y-1">
                            {group.items.map(item => {
                                const isActive = pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        className={`block px-4 py-2.5 rounded-lg font-mono text-sm transition-all ${
                                            isActive
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                        }`}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
