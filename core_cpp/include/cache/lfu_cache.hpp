#pragma once
#include <unordered_map>
#include <list>
#include <mutex>
#include <optional>

namespace cerebrum {
namespace cache {

template <typename Key, typename Value>
class LFUCache {
    struct Node {
        Key key;
        Value value;
        size_t freq;
    };

public:
    explicit LFUCache(size_t capacity) : capacity_(capacity), min_freq_(0) {}

    void put(const Key& key, const Value& value) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (capacity_ == 0) return;

        auto it = key_table_.find(key);
        if (it != key_table_.end()) {
            auto node_it = it->second;
            node_it->value = value;
            update_freq(node_it);
            return;
        }

        if (key_table_.size() >= capacity_) {
            auto& min_freq_list = freq_table_[min_freq_];
            auto evict_node = min_freq_list.back();
            key_table_.erase(evict_node.key);
            min_freq_list.pop_back();
            if (min_freq_list.empty()) {
                freq_table_.erase(min_freq_);
            }
        }

        freq_table_[1].push_front({key, value, 1});
        key_table_[key] = freq_table_[1].begin();
        min_freq_ = 1;
    }

    std::optional<Value> get(const Key& key) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = key_table_.find(key);
        if (it == key_table_.end()) {
            return std::nullopt;
        }
        auto node_it = it->second;
        Value val = node_it->value;
        update_freq(node_it);
        return val;
    }

private:
    void update_freq(typename std::list<Node>::iterator node_it) {
        size_t freq = node_it->freq;
        Key key = node_it->key;
        Value val = node_it->value;

        freq_table_[freq].erase(node_it);
        if (freq_table_[freq].empty()) {
            freq_table_.erase(freq);
            if (min_freq_ == freq) {
                min_freq_++;
            }
        }

        freq++;
        freq_table_[freq].push_front({key, val, freq});
        key_table_[key] = freq_table_[freq].begin();
    }

    size_t capacity_;
    size_t min_freq_;
    std::unordered_map<Key, typename std::list<Node>::iterator> key_table_;
    std::unordered_map<size_t, std::list<Node>> freq_table_;
    std::mutex mutex_;
};

} // namespace cache
} // namespace cerebrum
