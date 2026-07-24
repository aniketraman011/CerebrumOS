#pragma once

#include <string>
#include <thread>
#include <atomic>
#include <vector>
#include <chrono>
#include "../concurrency/worker_state.hpp"

// OS-specific Socket / IPC headers would go here (e.g., sys/un.h for Linux UDS)

namespace cerebrum {
namespace telemetry {

/**
 * @class IPCBridge
 * @brief Zero-overhead telemetry watchdog spanning the C++ and Python boundary.
 * 
 * RATIONALE:
 * Instead of C++ workers pushing JSON directly (which blocks the tensor math path), 
 * this dedicated Watchdog thread periodically polls lock-free atomic counters from 
 * the workers and blasts them over a Unix Domain Socket to Python.
 */
class IPCBridge {
private:
    std::string socket_path_;
    std::atomic<bool> running_{false};
    std::thread watchdog_thread_;
    std::vector<concurrency::WorkerState*> workers_;

    void watchdog_loop() {
        // [Architecture Stub] Bind to Unix Domain Socket
        // int sock = socket(AF_UNIX, SOCK_DGRAM, 0);
        
        while (running_.load(std::memory_order_relaxed)) {
            
            // 1. Snapshot State: Read atomics from the execution hot path.
            // Using relaxed ordering ensures we don't issue memory fence instructions
            // that would stall the SMs or L1 caches of the worker threads.
            for (size_t i = 0; i < workers_.size(); ++i) {
                uint8_t state = workers_[i]->status.load(std::memory_order_relaxed);
                uint64_t tasks = workers_[i]->tasks_completed.load(std::memory_order_relaxed);
                
                // [Architecture Stub] Pack into FlatBuffer
                // flatbuffers::FlatBufferBuilder builder(1024);
                // CreateWorkerMetrics(builder, i, state, tasks);
                
                (void)state; (void)tasks; // Suppress unused warnings
            }

            // 2. Transmit: Fire-and-forget over UDS to the FastAPI async loop.
            // sendto(sock, ...);

            // 3. Cadence: Sleep for 16.6ms to achieve a smooth 60 FPS update rate 
            // for the Next.js frontend without monopolizing a physical core.
            std::this_thread::sleep_for(std::chrono::milliseconds(16));
        }
    }

public:
    IPCBridge(const std::string& uds_path, const std::vector<concurrency::WorkerState*>& monitored_workers)
        : socket_path_(uds_path), workers_(monitored_workers) {}

    ~IPCBridge() {
        stop();
    }

    void start() {
        // Only start if not already running
        if (!running_.exchange(true, std::memory_order_acquire)) {
            // In a production environment, we would use pthread_setaffinity_np 
            // here to pin this Watchdog to an E-core (Efficiency core) if available.
            watchdog_thread_ = std::thread(&IPCBridge::watchdog_loop, this);
        }
    }

    void stop() {
        if (running_.exchange(false, std::memory_order_release)) {
            if (watchdog_thread_.joinable()) {
                watchdog_thread_.join();
            }
        }
    }
};

} // namespace telemetry
} // namespace cerebrum
