#pragma once

#include <vector>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <future>
#include <functional>
#include <stdexcept>
#include <memory>
#include "worker_state.hpp"

namespace cerebrum {
namespace concurrency {

class ThreadPool {
public:
    ThreadPool(size_t threads);
    ~ThreadPool();

    template<class F, class... Args>
    auto enqueue(F&& f, Args&&... args) 
        -> std::future<typename std::invoke_result<F, Args...>::type>;

    // Retrieve the telemetry states for all workers
    const std::vector<std::unique_ptr<WorkerState>>& get_worker_states() const {
        return worker_states_;
    }

private:
    std::vector<std::thread> workers_;
    std::vector<std::unique_ptr<WorkerState>> worker_states_;
    std::queue<std::function<void()>> tasks_;
    
    std::mutex queue_mutex_;
    std::condition_variable condition_;
    bool stop_;
};
 
inline ThreadPool::ThreadPool(size_t threads) : stop_(false) {
    for(size_t i = 0; i < threads; ++i) {
        worker_states_.push_back(std::make_unique<WorkerState>());
        WorkerState* state_ptr = worker_states_.back().get();
        
        workers_.emplace_back([this, state_ptr] {
            for(;;) {
                std::function<void()> task;

                {
                    std::unique_lock<std::mutex> lock(this->queue_mutex_);
                    this->condition_.wait(lock, [this]{ return this->stop_ || !this->tasks_.empty(); });
                    
                    if(this->stop_ && this->tasks_.empty()) {
                        state_ptr->transition_state(state_ptr->status.load(), WORKER_SLEEPING);
                        return;
                    }
                    
                    task = std::move(this->tasks_.front());
                    this->tasks_.pop();
                }

                // Transition to BUSY when executing a task
                uint8_t old_state = state_ptr->status.load();
                state_ptr->transition_state(old_state, WORKER_BUSY);
                
                task();
                
                state_ptr->record_task_completion();
                
                // Transition to IDLE once done
                state_ptr->transition_state(WORKER_BUSY, WORKER_IDLE);
            }
        });
    }
}

template<class F, class... Args>
auto ThreadPool::enqueue(F&& f, Args&&... args) 
    -> std::future<typename std::invoke_result<F, Args...>::type> {
    
    using return_type = typename std::invoke_result<F, Args...>::type;

    auto task = std::make_shared<std::packaged_task<return_type()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...)
        );
        
    std::future<return_type> res = task->get_future();
    {
        std::unique_lock<std::mutex> lock(queue_mutex_);

        if(stop_)
            throw std::runtime_error("enqueue on stopped ThreadPool");

        tasks_.emplace([task](){ (*task)(); });
    }
    condition_.notify_one();
    return res;
}

inline ThreadPool::~ThreadPool() {
    {
        std::unique_lock<std::mutex> lock(queue_mutex_);
        stop_ = true;
    }
    condition_.notify_all();
    for(std::thread &worker: workers_) {
        worker.join();
    }
}

} // namespace concurrency
} // namespace cerebrum
