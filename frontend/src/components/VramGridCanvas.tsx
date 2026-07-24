'use client';

import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';

/**
 * CANVAS VRAM VISUALIZER
 * 
 * RATIONALE:
 * Rendering 4,096 memory blocks in the DOM (`<div className="w-2 h-2" />`) 
 * causes severe layout thrashing and garbage collection spikes. 
 * We bypass the DOM entirely and use the HTML5 `<canvas>` API, resulting 
 * in O(1) DOM updates and a locked 60FPS render target.
 */
export default function VramGridCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Fine-grained subscription: This component ONLY re-renders if the 
    // `vramGrid` array identity changes in the Zustand store.
    const vramGrid = useTelemetryStore((state) => state.vramGrid);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Visual Configuration for a 4096 block arena
        const cols = 64;
        const blockSize = 10;
        const gap = 2;

        // Clear the previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Batch render the physical memory arena
        for (let i = 0; i < vramGrid.length; i++) {
            const x = (i % cols) * (blockSize + gap);
            const y = Math.floor(i / cols) * (blockSize + gap);
            
            // 0 = Free (Slate Gray), 1 = Allocated (Electric Blue)
            ctx.fillStyle = vramGrid[i] === 0 ? '#334155' : '#3b82f6';
            ctx.fillRect(x, y, blockSize, blockSize);
        }
    }, [vramGrid]); // Re-draw triggered by Zustand mutation

    return (
        <div className="bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-700">
            <h3 className="text-slate-200 font-mono text-sm mb-4 tracking-wider uppercase">
                Physical VRAM Arena (Blocks)
            </h3>
            <canvas 
                ref={canvasRef} 
                width={768} 
                height={768} 
                className="w-full h-auto bg-slate-950 rounded border border-slate-800"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
}
