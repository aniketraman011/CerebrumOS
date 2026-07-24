import { create } from 'zustand';

interface WorkerState {
    id: number;
    status: 'BUSY' | 'IDLE' | 'SPINNING';
    tasksCompleted: number;
}

interface TelemetryState {
    mlfq: {
        q0: number; // Queue depth (Count of tasks waiting)
        q1: number;
        q2: number;
    };
    workers: WorkerState[];
    // 4096 block array representing physical VRAM (0=Free, 1=Allocated)
    vramGrid: Uint8Array; 
    updateState: (newState: Partial<TelemetryState>) => void;
}

/**
 * ZUSTAND TELEMETRY STORE
 * 
 * RATIONALE:
 * If we used React Context for this, every component in the provider tree would 
 * re-render 60 times a second. Zustand allows us to mutate state outside the 
 * React lifecycle. Components use selectors to subscribe to only the exact 
 * bytes of data they care about.
 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
    mlfq: { q0: 0, q1: 0, q2: 0 },
    workers: [],
    vramGrid: new Uint8Array(4096),
    updateState: (newState) => set((state) => ({ ...state, ...newState })),
}));

// WebSocket Bridge (Buffer + requestAnimationFrame)
const packetBuffer: Partial<TelemetryState>[] = [];

// Pseudo-Socket.IO listener
export function onTelemetryMessage(data: Partial<TelemetryState>) {
    packetBuffer.push(data);
}

// 60FPS Drain Loop
function renderLoop() {
    if (packetBuffer.length > 0) {
        // We drop intermediate frames and only take the latest snapshot.
        // This prevents the React reconciler from choking if network jitter 
        // causes a burst of 5 WebSocket messages to arrive in a single tick.
        const latestSnapshot = packetBuffer[packetBuffer.length - 1];
        useTelemetryStore.getState().updateState(latestSnapshot);
        packetBuffer.length = 0; // Clear buffer
    }
    requestAnimationFrame(renderLoop);
}

// Kick off the rAF loop on the client side
if (typeof window !== 'undefined') {
    requestAnimationFrame(renderLoop);
}
