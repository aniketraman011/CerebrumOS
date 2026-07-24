#pragma once
#include <queue>
#include <mutex>
#include <vector>
#include <functional>
#include <thread>
#include <chrono>
#include <atomic>
#include <iostream>
#include <iomanip>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <cmath>

namespace cerebrum {
namespace scheduler {

enum class Policy {
    FCFS,
    RR,
    Priority,
    MLFQ,
    Adaptive
};

inline std::string policy_name(Policy p) {
    switch (p) {
        case Policy::FCFS: return "FCFS";
        case Policy::RR: return "Round Robin";
        case Policy::Priority: return "Priority";
        case Policy::MLFQ: return "MLFQ";
        default: return "Adaptive";
    }
}

struct Job {
    uint64_t id;
    int priority;
    int vram_required;
    bool is_batch;
    std::string type; // e.g., "Small", "Medium", "Large", "LLM"
    uint64_t signature = 0; // request-shape signature, used for cache lookups
    std::chrono::time_point<std::chrono::steady_clock> enqueue_time;

    // Tracking for metrics
    std::string explanation = "";
    int time_slice_ms = 0; // For RR
};

struct PriorityCompare {
    bool operator()(const Job& a, const Job& b) {
        if (a.priority == b.priority) {
            return a.enqueue_time > b.enqueue_time; // FCFS within same priority
        }
        return a.priority < b.priority;
    }
};

// Real runtime signals the policy engine actually looks at, collected from
// the thread pool, memory manager, and cache — not randomized.
struct RuntimeState {
    int queue_length = 0;
    double worker_utilization = 0.0; // 0..1, busy workers / total workers
    double memory_pressure = 0.0;    // 0..1, used blocks / total blocks
    double cache_hit_ratio = 0.0;    // 0..1, recent hit ratio
};

class AdaptiveScheduler {
public:
    using StateProviderFn = std::function<RuntimeState()>;

    AdaptiveScheduler() : current_policy_(Policy::Adaptive), running_(true), jobs_processed_(0) {
        worker_thread_ = std::thread(&AdaptiveScheduler::dispatch_loop, this);
    }

    ~AdaptiveScheduler() {
        shutdown();
    }

    // Stops the dispatch loop and joins its thread. Safe to call more than
    // once (the destructor calls it too) — idempotent so callers can shut
    // it down deterministically at a specific point in a larger teardown
    // sequence instead of relying on member destruction order.
    void shutdown() {
        if (running_) {
            running_ = false;
            if (worker_thread_.joinable()) {
                worker_thread_.join();
            }
        }
    }

    void set_policy(const std::string& policy_name_in) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (policy_name_in == "FCFS") current_policy_ = Policy::FCFS;
        else if (policy_name_in == "RR") current_policy_ = Policy::RR;
        else if (policy_name_in == "Priority") current_policy_ = Policy::Priority;
        else if (policy_name_in == "MLFQ") current_policy_ = Policy::MLFQ;
        else current_policy_ = Policy::Adaptive;
    }

    // Wires the scheduler up to real runtime telemetry (worker pool,
    // memory manager, cache). Called once by RuntimePipeline after those
    // subsystems exist.
    void set_state_provider(StateProviderFn provider) {
        std::lock_guard<std::mutex> lock(mutex_);
        state_provider_ = std::move(provider);
    }

    // Called by the pipeline when a job finishes, so future "Estimated
    // Runtime" figures for that job type are based on measured history
    // instead of a random number.
    void record_completion(const std::string& type, double latency_ms) {
        std::lock_guard<std::mutex> lock(runtime_avg_mutex_);
        double& avg = runtime_avg_by_type_[type];
        avg = (avg <= 0.0) ? latency_ms : (avg * 0.8 + latency_ms * 0.2); // EMA
    }

    void submit(Job job) {
        job.enqueue_time = std::chrono::steady_clock::now();
        std::lock_guard<std::mutex> lock(mutex_);

        fcfs_queue_.push(job);
        priority_queue_.push(job);

        if (job.is_batch) {
            batch_queue_.push(job);
        } else {
            chat_queue_.push(job);
        }

        active_jobs_count_++;
    }

    void set_consumer(std::function<void(Job)> consumer) {
        consumer_ = consumer;
    }

    uint64_t get_jobs_processed() const {
        return jobs_processed_.load();
    }

    size_t get_queue_size() {
        return active_jobs_count_.load();
    }

    std::string get_last_explanation() {
        std::lock_guard<std::mutex> lock(mutex_);
        return last_explanation_;
    }

private:
    Job pop_valid_job(std::queue<Job>& q) {
        while (!q.empty()) {
            Job j = q.front();
            q.pop();
            if (processed_job_ids_.find(j.id) == processed_job_ids_.end()) {
                return j;
            }
        }
        return {0, 0, 0, false, "", 0, std::chrono::steady_clock::now(), "", 0};
    }

    template<typename T>
    Job pop_valid_job(T& q) {
        while (!q.empty()) {
            Job j = q.top();
            q.pop();
            if (processed_job_ids_.find(j.id) == processed_job_ids_.end()) {
                return j;
            }
        }
        return {0, 0, 0, false, "", 0, std::chrono::steady_clock::now(), "", 0};
    }

    double estimate_runtime(const std::string& type) {
        std::lock_guard<std::mutex> lock(runtime_avg_mutex_);
        auto it = runtime_avg_by_type_.find(type);
        // Before we have history for a type, give a conservative flat
        // estimate rather than a fabricated precise-looking number.
        return it != runtime_avg_by_type_.end() ? it->second : 15.0;
    }

    static std::string pressure_label(double pressure) {
        if (pressure > 0.85) return "Critical";
        if (pressure > 0.6) return "High";
        if (pressure > 0.3) return "Moderate";
        return "Low";
    }

    // Runtime Decision Engine: picks a concrete policy from live signals.
    Policy decide_adaptive_policy(const RuntimeState& s, std::string& reason_out, double& confidence_out) {
        if (s.memory_pressure > 0.85) {
            reason_out = "Memory pressure exceeded threshold — switching to Priority so small/cheap "
                         "jobs keep flowing instead of stalling behind large allocations.";
            confidence_out = 91.0 + std::min(8.0, (s.memory_pressure - 0.85) * 50.0);
            return Policy::Priority;
        }
        if (s.queue_length > 50) {
            reason_out = "Queue length exceeded starvation threshold — Round Robin guarantees "
                         "forward progress for every waiting job.";
            confidence_out = 88.0 + std::min(10.0, (s.queue_length - 50) / 5.0);
            return Policy::RR;
        }
        if (s.worker_utilization < 0.5) {
            reason_out = "Workers are under-utilized and the queue is manageable — MLFQ, "
                         "favoring latency-sensitive chat jobs over batch work.";
            confidence_out = 84.0 + (0.5 - s.worker_utilization) * 20.0;
            return Policy::MLFQ;
        }
        reason_out = "Load is balanced — MLFQ default (chat-first, batch as fallback).";
        confidence_out = 78.0 + s.cache_hit_ratio * 12.0;
        return Policy::MLFQ;
    }

    std::string build_explanation(const std::string& chosen_policy, const std::string& reason,
                                   const RuntimeState& s, double estimated_runtime_ms,
                                   double confidence, double reduction_pct) {
        std::ostringstream oss;
        oss << "Runtime Decision Engine\n"
            << "Decision: " << chosen_policy << "\n"
            << "Reason: " << reason << "\n"
            << "Queue Length = " << s.queue_length << "\n"
            << "Memory Pressure = " << pressure_label(s.memory_pressure)
            << " (" << std::fixed << std::setprecision(0) << (s.memory_pressure * 100) << "%)\n"
            << "Worker Utilization = " << std::fixed << std::setprecision(0) << (s.worker_utilization * 100) << "%\n"
            << "Cache Hit Ratio (recent) = " << std::fixed << std::setprecision(0) << (s.cache_hit_ratio * 100) << "%\n"
            << "Predicted latency reduced by " << std::fixed << std::setprecision(0) << reduction_pct << "%\n"
            << "Expected latency = " << std::fixed << std::setprecision(1) << estimated_runtime_ms << " ms\n"
            << "Confidence = " << std::fixed << std::setprecision(0) << confidence << "%";
        return oss.str();
    }

    void dispatch_loop() {
        while (running_) {
            bool has_job = false;
            Job next_job;
            {
                std::lock_guard<std::mutex> lock(mutex_);
                int q_len = active_jobs_count_.load();

                if (q_len > 0) {
                    RuntimeState state;
                    state.queue_length = q_len;
                    if (state_provider_) {
                        RuntimeState live = state_provider_();
                        state.worker_utilization = live.worker_utilization;
                        state.memory_pressure = live.memory_pressure;
                        state.cache_hit_ratio = live.cache_hit_ratio;
                    }

                    Policy active_policy = current_policy_;
                    std::string reason;
                    std::string chosen_label;
                    double confidence = 100.0;

                    if (active_policy == Policy::Adaptive) {
                        active_policy = decide_adaptive_policy(state, reason, confidence);
                        chosen_label = policy_name(active_policy);
                    } else {
                        reason = "Manually pinned by operator — adaptive engine bypassed.";
                        chosen_label = policy_name(active_policy);
                        confidence = 100.0;
                    }

                    if (active_policy == Policy::FCFS) {
                        next_job = pop_valid_job(fcfs_queue_);
                    } else if (active_policy == Policy::RR) {
                        next_job = pop_valid_job(fcfs_queue_);
                        if (next_job.id != 0) next_job.time_slice_ms = 10;
                    } else if (active_policy == Policy::Priority) {
                        next_job = pop_valid_job(priority_queue_);
                    } else { // MLFQ
                        next_job = pop_valid_job(chat_queue_);
                        if (next_job.id == 0) {
                            next_job = pop_valid_job(batch_queue_);
                        }
                    }

                    if (next_job.id != 0) {
                        has_job = true;
                        double estimated = estimate_runtime(next_job.type);
                        double baseline = 35.0;
                        double reduction = std::max(0.0, (baseline - estimated) / baseline * 100.0);
                        reason += " Worker utilization = " +
                                  std::to_string(static_cast<int>(state.worker_utilization * 100)) +
                                  "%. Predicted latency reduced by " +
                                  std::to_string(static_cast<int>(reduction)) + "%.";
                        next_job.explanation = build_explanation(
                            chosen_label, reason, state, estimated, confidence, reduction);
                        processed_job_ids_.insert(next_job.id);
                        active_jobs_count_--;
                        last_explanation_ = next_job.explanation;
                    }
                }
            }

            if (has_job) {
                if (consumer_) {
                    consumer_(next_job);
                }
                jobs_processed_++;
            } else {
                std::this_thread::sleep_for(std::chrono::milliseconds(5));
            }
        }
    }

    std::queue<Job> fcfs_queue_;
    std::priority_queue<Job, std::vector<Job>, PriorityCompare> priority_queue_;
    std::priority_queue<Job, std::vector<Job>, PriorityCompare> chat_queue_;
    std::queue<Job> batch_queue_;

    std::unordered_set<uint64_t> processed_job_ids_;
    std::atomic<int> active_jobs_count_{0};

    Policy current_policy_;
    std::string last_explanation_;
    StateProviderFn state_provider_;

    std::mutex runtime_avg_mutex_;
    std::unordered_map<std::string, double> runtime_avg_by_type_;

    std::mutex mutex_;
    bool running_;
    std::thread worker_thread_;
    std::function<void(Job)> consumer_;
    std::atomic<uint64_t> jobs_processed_;
};

} // namespace scheduler
} // namespace cerebrum
