#pragma once

#include <atomic>
#include <cstdint>

namespace cerebrum {
namespace concurrency {

// Bitmask constants for worker thread states
inline constexpr uint8_t WORKER_BUSY     = 0x1;
inline constexpr uint8_t WORKER_IDLE     = 0x2;
inline constexpr uint8_t WORKER_SPINNING = 0x4;
inline constexpr uint8_t WORKER_SLEEPING = 0x8;

/**
 * @struct WorkerState
 * @brief Core telemetry and state block for a single execution thread.
 * 
 * ALIGNMENT RATIONALE:
 * We force a 64-byte alignment (`alignas(64)`) to match the typical L1 
 * cache line size on modern architectures. If multiple thread states 
 * shared the same cache line, a state update by Thread A would invalidate 
 * the cache line in Thread B's L1, causing a severe latency stall known 
 * as "false sharing".
 */
struct alignas(64) WorkerState {
    // Current execution state (BUSY, IDLE, etc.)
    // Modified by the worker, read asynchronously by the Telemetry Thread.
    std::atomic<uint8_t> status{WORKER_IDLE};
    
    // Performance Counters (Lock-Free)
    // Relaxed memory order is used during updates to prevent memory barriers
    // from stalling the Tensor execution hot-path.
    std::atomic<uint64_t> tasks_completed{0};
    std::atomic<uint64_t> cycles_stalled{0};

    /**
     * @brief Transition worker state safely.
     * @param expected The expected current state.
     * @param desired The new state to transition to.
     * @return true if successful, false if the state was changed by an interrupt.
     */
    inline bool transition_state(uint8_t expected, uint8_t desired) noexcept {
        // We use strong CAS here. State transitions happen on macro-boundaries
        // (e.g., Queue empty -> IDLE). Memory Order Acq/Rel ensures that all
        // tensor output writes are visible to other threads before we mark 
        // ourselves as IDLE or SLEEPING.
        return status.compare_exchange_strong(
            expected, desired,
            std::memory_order_acq_rel, 
            std::memory_order_acquire  
        );
    }
    
    /**
     * @brief Increment completed task count with zero overhead.
     */
    inline void record_task_completion() noexcept {
        tasks_completed.fetch_add(1, std::memory_order_relaxed);
    }
};

} // namespace concurrency
} // namespace cerebrum
