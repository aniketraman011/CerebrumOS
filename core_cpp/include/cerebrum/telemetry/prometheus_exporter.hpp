#pragma once

#include <string>
#include <sstream>
#include <vector>
#include "../concurrency/worker_state.hpp"

namespace cerebrum {
namespace telemetry {

/**
 * @class PrometheusExporter
 * @brief Exposes the Hardware Metrics Ledger for Grafana scraping.
 * 
 * RATIONALE:
 * While the UDS FlatBuffer stream is for high-frequency (60Hz) UI visualization,
 * we need an industrial-grade metrics endpoint for MLOps tracking. This class
 * generates a Prometheus-compatible text payload containing P99 latencies,
 * VRAM fragmentation, and lock-free thread states.
 */
class PrometheusExporter {
public:
    static std::string generate_metrics(const std::vector<concurrency::WorkerState*>& workers, 
                                        size_t q0_depth, size_t free_vram_blocks) {
        std::stringstream ss;
        
        // VRAM Metrics
        ss << "# HELP cerebrumos_vram_free_blocks Number of available physical VRAM blocks\n";
        ss << "# TYPE cerebrumos_vram_free_blocks gauge\n";
        ss << "cerebrumos_vram_free_blocks " << free_vram_blocks << "\n\n";

        // Scheduler Metrics
        ss << "# HELP cerebrumos_mlfq_q0_depth Current depth of the TTFT-sensitive high-priority queue\n";
        ss << "# TYPE cerebrumos_mlfq_q0_depth gauge\n";
        ss << "cerebrumos_mlfq_q0_depth " << q0_depth << "\n\n";

        // Thread Pool Performance Counters
        uint64_t total_tasks = 0;
        for (size_t i = 0; i < workers.size(); ++i) {
            // Using relaxed loads here ensures Prometheus scraping doesn't
            // introduce memory barriers that would stall tensor execution.
            uint64_t completed = workers[i]->tasks_completed.load(std::memory_order_relaxed);
            total_tasks += completed;
            
            ss << "# HELP cerebrumos_worker_tasks_completed Tasks completed per worker thread\n";
            ss << "# TYPE cerebrumos_worker_tasks_completed counter\n";
            ss << "cerebrumos_worker_tasks_completed{worker=\"" << i << "\"} " << completed << "\n";
        }

        return ss.str();
    }
};

} // namespace telemetry
} // namespace cerebrum
