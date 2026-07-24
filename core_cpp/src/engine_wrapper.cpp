#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/functional.h>
#include <string>

#include "cerebrum/runtime/runtime_pipeline.hpp"
#include "cerebrum/runtime/event_bus.hpp"

namespace py = pybind11;
using namespace cerebrum;

class CerebrumEngine {
public:
    CerebrumEngine(int requested_workers, size_t total_memory_blocks, size_t cache_capacity, const std::string& mode) 
        : pipeline_(requested_workers, total_memory_blocks, cache_capacity, mode)
    {
    }

    int submit_request(int priority, int vram_required, bool is_batch, const std::string& type) {
        py::gil_scoped_release release;
        return pipeline_.submit_request(priority, vram_required, is_batch, type);
    }
    
    void set_policy(const std::string& policy) {
        pipeline_.set_scheduler_policy(policy);
    }

    void set_cache_policy(const std::string& policy) {
        pipeline_.set_cache_policy(policy);
    }

    void set_mode(const std::string& mode) {
        pipeline_.set_mode(mode);
    }

    py::list fetch_events() {
        py::list event_list;
        auto new_events = runtime::EventBus::get_instance().fetch_new_events();
        
        for (const auto& ev : new_events) {
            py::dict e;
            e["job_id"] = ev.job_id;
            
            std::string stage_str;
            switch(ev.stage) {
                case runtime::EventStage::CREATED: stage_str = "CREATED"; break;
                case runtime::EventStage::QUEUED: stage_str = "QUEUED"; break;
                case runtime::EventStage::SCHEDULED: stage_str = "SCHEDULED"; break;
                case runtime::EventStage::WORKER_ASSIGNED: stage_str = "WORKER_ASSIGNED"; break;
                case runtime::EventStage::MEMORY_ALLOCATED: stage_str = "MEMORY_ALLOCATED"; break;
                case runtime::EventStage::INFERENCE_STARTED: stage_str = "INFERENCE_STARTED"; break;
                case runtime::EventStage::CACHE_UPDATED: stage_str = "CACHE_UPDATED"; break;
                case runtime::EventStage::COMPLETED: stage_str = "COMPLETED"; break;
            }
            e["stage"] = stage_str;
            e["timestamp"] = ev.timestamp;
            e["details"] = ev.details;
            
            event_list.append(e);
        }
        return event_list;
    }

    py::dict get_metrics() {
        py::dict metrics;
        
        // Scheduler & Pipeline Metrics
        auto p_metrics = pipeline_.get_metrics();
        metrics["total_requests"] = p_metrics.total_requests;
        metrics["avg_latency_ms"] = p_metrics.avg_latency_ms;
        metrics["p95_latency_ms"] = p_metrics.p95_latency_ms;
        metrics["p99_latency_ms"] = p_metrics.p99_latency_ms;
        metrics["throughput_req_sec"] = p_metrics.throughput_req_sec;
        metrics["cache_hit_ratio"] = p_metrics.cache_hit_ratio;
        
        metrics["queue_size"] = pipeline_.get_scheduler().get_queue_size();
        metrics["scheduler_explanation"] = pipeline_.get_scheduler().get_last_explanation();
        
        // Memory Metrics
        auto m_stats = pipeline_.get_memory_manager().get_stats();
        py::dict mem;
        mem["total_blocks"] = m_stats.total_blocks;
        mem["free_blocks"] = m_stats.free_blocks;
        mem["peak_blocks_used"] = m_stats.peak_blocks_used;
        mem["total_allocations"] = m_stats.total_allocations;
        mem["total_evictions"] = m_stats.total_evictions;
        mem["internal_fragmentation_ratio"] = m_stats.internal_fragmentation_ratio;
        mem["hottest_block_access_count"] = m_stats.hottest_block_access_count;
        mem["avg_block_access_count"] = m_stats.avg_block_access_count;
        metrics["memory"] = mem;

        metrics["cache_policy"] = pipeline_.get_cache_policy();
        
        // Worker Metrics
        py::list worker_metrics;
        for (const auto& state : pipeline_.get_thread_pool().get_worker_states()) {
            py::dict w;
            w["status"] = state->status.load();
            w["tasks_completed"] = state->tasks_completed.load();
            worker_metrics.append(w);
        }
        metrics["workers"] = worker_metrics;

        return metrics;
    }

private:
    runtime::RuntimePipeline pipeline_;
};

PYBIND11_MODULE(cerebrum_engine, m) {
    m.doc() = "CerebrumOS C++ Engine Pybind11 Native Extension - Phase 4 (APM & Timeline)";
    
    py::class_<CerebrumEngine>(m, "CerebrumEngine")
        .def(py::init<int, size_t, size_t, std::string>(), 
             py::arg("num_workers") = 0, 
             py::arg("total_memory_blocks") = 1024, 
             py::arg("cache_capacity") = 256,
             py::arg("mode") = "simulation")
        .def("submit_request", &CerebrumEngine::submit_request, 
             py::arg("priority") = 1, 
             py::arg("vram_required") = 128, 
             py::arg("is_batch") = false,
             py::arg("type") = "Medium",
             "Submit an inference request to the C++ backend.")
        .def("set_policy", &CerebrumEngine::set_policy, py::arg("policy"))
        .def("set_cache_policy", &CerebrumEngine::set_cache_policy, py::arg("policy"))
        .def("set_mode", &CerebrumEngine::set_mode, py::arg("mode"))
        .def("fetch_events", &CerebrumEngine::fetch_events, "Fetch batched events from the C++ Event Bus.")
        .def("get_metrics", &CerebrumEngine::get_metrics, "Get real-time metrics of the engine.");
}
