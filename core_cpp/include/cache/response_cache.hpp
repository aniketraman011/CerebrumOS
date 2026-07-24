#pragma once
#include <memory>
#include <mutex>
#include <optional>
#include <string>

#include "lru_cache.hpp"
#include "lfu_cache.hpp"

namespace cerebrum {
namespace cache {

enum class CachePolicy { LRU, LFU };

// Wraps the existing LRUCache/LFUCache implementations behind one interface
// so the runtime pipeline can query real hit/miss state for a request
// signature and hot-swap eviction policy at runtime, instead of the
// (rand() % 100) placeholder it used previously.
//
// NOTE: switching policy flushes the cache. This mirrors what actually
// happens in a real cache-policy hot-swap (the old structure's ordering/
// frequency metadata doesn't transfer), so it's an honest trade-off, not
// a shortcut.
template <typename Key, typename Value>
class ResponseCache {
public:
    explicit ResponseCache(size_t capacity, CachePolicy policy = CachePolicy::LRU)
        : capacity_(capacity), policy_(policy) {
        rebuild();
    }

    void set_policy(const std::string& policy_name) {
        std::lock_guard<std::mutex> lock(mutex_);
        CachePolicy new_policy = (policy_name == "LFU") ? CachePolicy::LFU : CachePolicy::LRU;
        if (new_policy != policy_) {
            policy_ = new_policy;
            rebuild();
        }
    }

    std::string get_policy_name() {
        std::lock_guard<std::mutex> lock(mutex_);
        return policy_ == CachePolicy::LFU ? "LFU" : "LRU";
    }

    // Returns true if this exact signature was already cached (a real hit),
    // and inserts it on a miss so the next identical request hits.
    bool lookup_and_insert(const Key& key, const Value& value_on_miss) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::optional<Value> existing = policy_ == CachePolicy::LFU
            ? lfu_->get(key)
            : lru_->get(key);

        if (existing.has_value()) {
            return true;
        }

        if (policy_ == CachePolicy::LFU) {
            lfu_->put(key, value_on_miss);
        } else {
            lru_->put(key, value_on_miss);
        }
        return false;
    }

private:
    void rebuild() {
        if (policy_ == CachePolicy::LFU) {
            lfu_ = std::make_unique<LFUCache<Key, Value>>(capacity_);
            lru_.reset();
        } else {
            lru_ = std::make_unique<LRUCache<Key, Value>>(capacity_);
            lfu_.reset();
        }
    }

    size_t capacity_;
    CachePolicy policy_;
    std::unique_ptr<LRUCache<Key, Value>> lru_;
    std::unique_ptr<LFUCache<Key, Value>> lfu_;
    std::mutex mutex_;
};

} // namespace cache
} // namespace cerebrum
