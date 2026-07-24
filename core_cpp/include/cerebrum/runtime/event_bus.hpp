#pragma once

#include <vector>
#include <string>
#include <mutex>
#include <unordered_map>
#include <chrono>

namespace cerebrum {
namespace runtime {

enum class EventStage {
    CREATED,
    QUEUED,
    SCHEDULED,
    WORKER_ASSIGNED,
    MEMORY_ALLOCATED,
    INFERENCE_STARTED,
    CACHE_UPDATED,
    COMPLETED
};

struct JobEvent {
    uint64_t job_id;
    EventStage stage;
    std::string timestamp; // ISO format or ms since epoch
    std::string details;   // JSON-like or structured string with context
};

class EventBus {
public:
    static EventBus& get_instance() {
        static EventBus instance;
        return instance;
    }

    void emit(uint64_t job_id, EventStage stage, const std::string& details) {
        auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();
        
        JobEvent event{job_id, stage, std::to_string(now), details};
        
        std::lock_guard<std::mutex> lock(mutex_);
        events_.push_back(event);
    }
    
    std::vector<JobEvent> fetch_new_events() {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<JobEvent> new_events = std::move(events_);
        events_.clear(); // We move them to python, clearing the C++ buffer
        return new_events;
    }

private:
    EventBus() = default;
    std::mutex mutex_;
    std::vector<JobEvent> events_;
};

} // namespace runtime
} // namespace cerebrum
