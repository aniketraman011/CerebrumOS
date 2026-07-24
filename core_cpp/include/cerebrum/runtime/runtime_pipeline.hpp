#pragma once

#include <memory>
#include <string>
#include <vector>
#include <chrono>
#include <functional>

#include "../../scheduler/adaptive_scheduler.hpp"
#include "../memory/memory_manager.hpp"
#include "../concurrency/thread_pool.hpp"
#include "../math/tensor_math.hpp"
#include "../../cache/response_cache.hpp"
#include "event_bus.hpp"

namespace cerebrum {
namespace runtime {

struct PipelineMetrics {
    uint64_t total_requests;
    double avg_latency_ms;
    double p95_latency_ms;
    double p99_latency_ms;
    double throughput_req_sec;
    double cache_hit_ratio;
};

class RuntimePipeline {
public:
    RuntimePipeline(int requested_workers, size_t total_memory_blocks, size_t cache_capacity, const std::string& mode)
        : mode_(mode),
          response_cache_(cache_capacity),
          total_requests_(0),
          cache_hits_(0)
    {
        size_t actual_workers = requested_workers;
        if (requested_workers <= 0) {
            unsigned int hw_concurrency = std::thread::hardware_concurrency();
            actual_workers = std::max(2u, hw_concurrency > 1 ? hw_concurrency - 1 : 1);
        }

        thread_pool_ = std::make_unique<concurrency::ThreadPool>(actual_workers);
        memory_manager_ = std::make_unique<memory::MemoryManager>(total_memory_blocks, cache_capacity);

        // Give the scheduler real telemetry to make decisions from, instead
        // of the fixed "queue_length > 50" placeholder it had before.
        scheduler_.set_state_provider([this]() {
            scheduler::RuntimeState state;
            state.queue_length = static_cast<int>(scheduler_.get_queue_size());

            size_t busy = 0;
            const auto& workers = thread_pool_->get_worker_states();
            for (const auto& w : workers) {
                if (w->status.load(std::memory_order_relaxed) == concurrency::WORKER_BUSY) {
                    busy++;
                }
            }
            state.worker_utilization = workers.empty() ? 0.0
                : static_cast<double>(busy) / workers.size();

            auto mem_stats = memory_manager_->get_stats();
            state.memory_pressure = mem_stats.total_blocks == 0 ? 0.0
                : static_cast<double>(mem_stats.total_blocks - mem_stats.free_blocks) / mem_stats.total_blocks;

            uint64_t total = total_requests_.load(std::memory_order_relaxed);
            uint64_t hits = cache_hits_.load(std::memory_order_relaxed);
            state.cache_hit_ratio = total == 0 ? 0.0 : static_cast<double>(hits) / total;

            return state;
        });

        // Connect scheduler to thread pool
        scheduler_.set_consumer([this](scheduler::Job job) {
            auto start_time = std::chrono::steady_clock::now();

            EventBus::get_instance().emit(job.id, EventStage::SCHEDULED, job.explanation);

            this->thread_pool_->enqueue([this, job, start_time]() {

                // 0. Worker Assigned
                EventBus::get_instance().emit(job.id, EventStage::WORKER_ASSIGNED, "Worker allocated");

                // 1. Memory Allocation Phase
                auto blocks = this->memory_manager_->allocate_tensor(job.vram_required);
                EventBus::get_instance().emit(job.id, EventStage::MEMORY_ALLOCATED, "Allocated " + std::to_string(job.vram_required) + " MB");

                // 2. Cache Check Phase — a real lookup keyed on the request's
                // shape (type + VRAM bucket), not a coin flip. Repeating an
                // identical request now actually hits.
                bool cache_hit = this->response_cache_.lookup_and_insert(job.signature, job.vram_required);
                if (cache_hit) {
                    this->cache_hits_++;
                }

                // 3. Execution Phase
                EventBus::get_instance().emit(job.id, EventStage::INFERENCE_STARTED, "Mode: " + this->mode_);

                if (this->mode_ == "simulation" || this->mode_ == "benchmark") {
                    int matrix_size = (job.vram_required > 100) ? 512 : 256;
                    math::TensorMath::simulate_matrix_multiplication(matrix_size / (cache_hit ? 2 : 1));
                } else {
                    std::this_thread::sleep_for(std::chrono::milliseconds(20 + (cache_hit ? 0 : 50)));
                }

                // 4. Cache Update Phase
                EventBus::get_instance().emit(job.id, EventStage::CACHE_UPDATED, cache_hit ? "Cache Hit" : "Cache Miss");

                // 5. Memory Cleanup Phase
                if (!blocks.empty()) {
                    this->memory_manager_->free_tensor(blocks);
                }

                // 6. Metrics Phase
                auto end_time = std::chrono::steady_clock::now();
                double latency = std::chrono::duration<double, std::milli>(end_time - start_time).count();

                // Feed this real latency back into the scheduler's per-type
                // history, so future "Estimated Runtime" figures for this
                // job type are measured, not guessed.
                this->scheduler_.record_completion(job.type, latency);

                EventBus::get_instance().emit(job.id, EventStage::COMPLETED, "Latency: " + std::to_string(latency) + " ms");

                std::lock_guard<std::mutex> lock(metrics_mutex_);
                latencies_.push_back(latency);
                if (latencies_.size() > 1000) latencies_.erase(latencies_.begin()); // keep last 1000
                total_requests_++;
            });
        });
    }

    // Explicit, ordered teardown: stop the scheduler from dispatching new
    // jobs first, THEN drain/join the thread pool (whose in-flight tasks
    // touch memory_manager_, response_cache_, scheduler_, and the metrics
    // members below). Relying on implicit reverse-declaration-order
    // destruction here was a real use-after-free — ASan caught background
    // worker threads still writing to `latencies_` after it had already
    // been destroyed.
    ~RuntimePipeline() {
        scheduler_.shutdown();
        thread_pool_.reset();
    }

    uint64_t submit_request(int priority, int vram_required, bool is_batch, const std::string& type) {
        static uint64_t job_id_counter = 0;
        scheduler::Job job;
        job.id = ++job_id_counter;
        job.priority = priority;
        job.vram_required = vram_required;
        job.is_batch = is_batch;
        job.type = type;
        job.signature = compute_signature(type, vram_required);

        EventBus::get_instance().emit(job.id, EventStage::CREATED, "Request type: " + type);
        EventBus::get_instance().emit(job.id, EventStage::QUEUED, "Added to queue");

        scheduler_.submit(job);

        return job.id;
    }

    void set_scheduler_policy(const std::string& policy) {
        scheduler_.set_policy(policy);
    }

    void set_cache_policy(const std::string& policy) {
        response_cache_.set_policy(policy);
    }

    std::string get_cache_policy() {
        return response_cache_.get_policy_name();
    }

    void set_mode(const std::string& mode) {
        mode_ = mode;
    }

    scheduler::AdaptiveScheduler& get_scheduler() { return scheduler_; }
    memory::MemoryManager& get_memory_manager() { return *memory_manager_; }
    concurrency::ThreadPool& get_thread_pool() { return *thread_pool_; }

    PipelineMetrics get_metrics() {
        std::lock_guard<std::mutex> lock(metrics_mutex_);

        double avg = 0.0, p95 = 0.0, p99 = 0.0;
        if (!latencies_.empty()) {
            std::vector<double> sorted = latencies_;
            std::sort(sorted.begin(), sorted.end());

            double sum = 0;
            for (double l : sorted) sum += l;
            avg = sum / sorted.size();

            p95 = sorted[std::max(0, (int)(sorted.size() * 0.95) - 1)];
            p99 = sorted[std::max(0, (int)(sorted.size() * 0.99) - 1)];
        }

        double hit_ratio = total_requests_ > 0 ? (double)cache_hits_ / total_requests_ : 0.0;

        return {
            total_requests_,
            avg,
            p95,
            p99,
            // Throughput derived from measured average latency across workers.
            (avg > 0) ? (1000.0 / avg) * thread_pool_->get_worker_states().size() : 0.0,
            hit_ratio
        };
    }

private:
    // Groups requests of the same "shape" (type + VRAM bucket) so that
    // repeated identical requests produce a real cache hit — this is the
    // request-signature concept a response/prefix cache actually keys on.
    static uint64_t compute_signature(const std::string& type, int vram_required) {
        std::hash<std::string> hasher;
        uint64_t h = hasher(type);
        int bucket = (vram_required / 32) * 32; // 32MB buckets
        h ^= (static_cast<uint64_t>(bucket) * 0x9E3779B97F4A7C15ULL);
        return h;
    }

    std::string mode_;

    scheduler::AdaptiveScheduler scheduler_;
    std::unique_ptr<memory::MemoryManager> memory_manager_;
    std::unique_ptr<concurrency::ThreadPool> thread_pool_;
    cache::ResponseCache<uint64_t, int> response_cache_;

    std::mutex metrics_mutex_;
    std::vector<double> latencies_;
    std::atomic<uint64_t> total_requests_;
    std::atomic<uint64_t> cache_hits_;
};

} // namespace runtime
} // namespace cerebrum
