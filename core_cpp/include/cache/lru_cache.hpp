#pragma once
#include <unordered_map>
#include <list>
#include <mutex>
#include <optional>

namespace cerebrum {
namespace cache {

template <typename Key, typename Value>
class LRUCache {
public:
    explicit LRUCache(size_t capacity) : capacity_(capacity) {}

    void put(const Key& key, const Value& value) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = map_.find(key);
        if (it != map_.end()) {
            list_.erase(it->second);
        }
        list_.push_front({key, value});
        map_[key] = list_.begin();

        if (map_.size() > capacity_) {
            auto last = list_.back();
            map_.erase(last.first);
            list_.pop_back();
        }
    }

    std::optional<Value> get(const Key& key) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = map_.find(key);
        if (it == map_.end()) {
            return std::nullopt;
        }
        // Move accessed element to front
        list_.splice(list_.begin(), list_, it->second);
        return it->second->second;
    }

    // Evicts and returns the least-recently-used entry, if any.
    // Used by callers that need to reclaim capacity on demand (e.g. a
    // memory manager evicting a cached KV sequence under real memory
    // pressure), rather than only evicting implicitly on put().
    std::optional<std::pair<Key, Value>> pop_lru() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (list_.empty()) {
            return std::nullopt;
        }
        auto last = list_.back();
        map_.erase(last.first);
        list_.pop_back();
        return last;
    }

    size_t size() {
        std::lock_guard<std::mutex> lock(mutex_);
        return map_.size();
    }

private:
    size_t capacity_;
    std::list<std::pair<Key, Value>> list_;
    std::unordered_map<Key, typename std::list<std::pair<Key, Value>>::iterator> map_;
    std::mutex mutex_;
};

} // namespace cache
} // namespace cerebrum
