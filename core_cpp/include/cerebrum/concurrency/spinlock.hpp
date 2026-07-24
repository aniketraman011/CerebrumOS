#pragma once

#include <atomic>

// Architecture-specific intrinsics for CPU pause instructions
#if defined(_WIN32)
    #include <windows.h>
#elif defined(__x86_64__) || defined(_M_X64) || defined(__i386__) || defined(_M_IX86)
    #include <immintrin.h>
#elif defined(__aarch64__)
    // ARM64 yield instruction
    static inline void _mm_pause() { asm volatile("yield" ::: "memory"); }
#endif

namespace cerebrum {
namespace concurrency {

/**
 * @class Spinlock
 * @brief An exponential backoff spinlock designed for microsecond critical sections.
 *
 * RATIONALE vs std::mutex:
 * When a `std::mutex` is contended, the OS puts the thread to sleep via a syscall 
 * (futex on Linux, wait on Windows). Waking the thread up takes 2-5 microseconds, 
 * which is an eternity if the critical section (e.g., popping an item from a queue) 
 * only takes 10 nanoseconds.
 * 
 * This lock uses a TTAS (Test-and-Test-and-Set) pattern with exponential backoff 
 * and hardware pause instructions to minimize memory bus traffic and avoid pipeline flushes.
 */
class Spinlock {
private:
    // Aligning to 64 bytes prevents false sharing if multiple spinlocks are in an array
    alignas(64) std::atomic<bool> locked_{false};

public:
    inline void lock() noexcept {
        int backoff = 1;
        
        while (true) {
            // Attempt to take the lock (Test-and-Set)
            if (!locked_.exchange(true, std::memory_order_acquire)) {
                return; // Lock acquired successfully
            }
            
            // Lock is held. We spin using a relaxed load (Test) to avoid 
            // constantly writing to the cache line (which would spam the memory bus).
            while (locked_.load(std::memory_order_relaxed)) {
                for (int i = 0; i < backoff; ++i) {
#if defined(_WIN32)
                    YieldProcessor();
#elif defined(__x86_64__) || defined(_M_X64) || defined(__i386__) || defined(_M_IX86)
                    _mm_pause(); // Pause instruction reduces power and helps Hyper-Threading
#elif defined(__aarch64__)
                    _mm_pause(); // ARM yield
#endif
                }
                
                // Exponential backoff, capped at 64 iterations to prevent excessive spinning
                if (backoff < 64) backoff *= 2;
            }
        }
    }

    inline void unlock() noexcept {
        // Release semantics ensure that all memory writes inside the critical section
        // become visible to other threads before the lock is released.
        locked_.store(false, std::memory_order_release);
    }
};

} // namespace concurrency
} // namespace cerebrum
