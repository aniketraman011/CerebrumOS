#pragma once

#include <memory>
#include <mutex>
#include <vector>
#include <string>
#include <atomic>
#include "paged_allocator.hpp"
#include "../../cache/lru_cache.hpp"

namespace cerebrum {
namespace memory {

struct MemoryStats {
    size_t total_blocks;
    size_t free_blocks;
    size_t peak_blocks_used;
    uint64_t total_allocations;
    uint64_t total_evictions;
    // Internal fragmentation: capacity handed out in the final (partially
    // filled) block of each tensor allocation, as a fraction of total
    // capacity handed out. This is the honest metric for a fixed-size
    // block/paged allocator (there's no external fragmentation by design —
    // that's the point of paging — so we don't pretend to measure it).
    float internal_fragmentation_ratio;
    // Access-count summary across physical blocks, for a heat-map view.
    uint32_t hottest_block_access_count;
    double avg_block_access_count;
};

class MemoryManager {
public:
    MemoryManager(size_t total_blocks, size_t cache_capacity)
        : total_blocks_(total_blocks),
          allocator_(std::make_unique<PagedAllocator>(total_blocks)),
          kv_cache_(std::make_unique<cache::LRUCache<uint64_t, std::vector<Block*>>>(cache_capacity)),
          block_heat_(total_blocks, 0),
          total_allocations_(0),
          total_evictions_(0),
          peak_blocks_used_(0),
          wasted_capacity_mb_(0.0),
          allocated_capacity_mb_(0.0) {}

    Block* allocate_block() {
        Block* b = allocator_->allocate_block();
        if (b) {
            register_allocation(b);
        }
        return b;
    }

    // Allocates the blocks needed for a tensor of the given VRAM size.
    // On real OOM, attempts one real eviction (reclaiming the
    // least-recently-used cached KV sequence) before giving up — this
    // actually frees blocks, it doesn't just increment a counter.
    std::vector<Block*> allocate_tensor(int vram_required) {
        int blocks_needed = (vram_required / kBlockSizeMb) + 1;

        std::vector<Block*> allocated = try_allocate_n_blocks(blocks_needed);
        if (allocated.empty() && evict_one_sequence()) {
            allocated = try_allocate_n_blocks(blocks_needed);
        }

        if (!allocated.empty()) {
            double waste = blocks_needed * static_cast<double>(kBlockSizeMb) - vram_required;
            std::lock_guard<std::mutex> lock(stats_mutex_);
            wasted_capacity_mb_ += waste;
            allocated_capacity_mb_ += blocks_needed * static_cast<double>(kBlockSizeMb);
        }
        return allocated;
    }

    void free_block(Block* block) {
        if (block) allocator_->free_block(block);
    }

    void free_tensor(const std::vector<Block*>& blocks) {
        for (auto* b : blocks) {
            free_block(b);
        }
    }

    MemoryStats get_stats() {
        size_t free = allocator_->free_blocks_count();
        std::lock_guard<std::mutex> lock(stats_mutex_);

        float frag = allocated_capacity_mb_ > 0.0
            ? static_cast<float>(wasted_capacity_mb_ / allocated_capacity_mb_)
            : 0.0f;

        uint32_t hottest = 0;
        double heat_sum = 0.0;
        for (uint32_t h : block_heat_) {
            if (h > hottest) hottest = h;
            heat_sum += h;
        }
        double avg_heat = block_heat_.empty() ? 0.0 : heat_sum / block_heat_.size();

        return {
            total_blocks_,
            free,
            peak_blocks_used_,
            total_allocations_.load(),
            total_evictions_.load(),
            frag,
            hottest,
            avg_heat
        };
    }

    void cache_sequence(uint64_t request_id, const std::vector<Block*>& blocks) {
        kv_cache_->put(request_id, blocks);
    }

    std::optional<std::vector<Block*>> get_cached_sequence(uint64_t request_id) {
        return kv_cache_->get(request_id);
    }

private:
    static constexpr int kBlockSizeMb = 16;

    std::vector<Block*> try_allocate_n_blocks(int n) {
        std::vector<Block*> allocated;
        allocated.reserve(n);
        for (int i = 0; i < n; ++i) {
            Block* b = allocator_->allocate_block();
            if (!b) {
                // Roll back what we grabbed so far — a partial tensor
                // allocation is not usable.
                for (auto* ab : allocated) free_block(ab);
                return {};
            }
            allocated.push_back(b);
            register_allocation(b);
        }
        update_peak(total_blocks_ - allocator_->free_blocks_count());
        return allocated;
    }

    // Reclaims blocks from the least-recently-used cached KV sequence.
    // Returns true if a sequence was actually evicted (real capacity freed).
    bool evict_one_sequence() {
        auto evicted = kv_cache_->pop_lru();
        if (!evicted.has_value()) {
            return false;
        }
        for (auto* b : evicted->second) {
            free_block(b);
        }
        total_evictions_++;
        return true;
    }

    void register_allocation(Block* b) {
        total_allocations_++;
        std::lock_guard<std::mutex> lock(stats_mutex_);
        if (b->physical_block_id < block_heat_.size()) {
            block_heat_[b->physical_block_id]++;
        }
    }

    void update_peak(size_t used) {
        std::lock_guard<std::mutex> lock(stats_mutex_);
        if (used > peak_blocks_used_) peak_blocks_used_ = used;
    }

    size_t total_blocks_;
    std::unique_ptr<PagedAllocator> allocator_;
    std::unique_ptr<cache::LRUCache<uint64_t, std::vector<Block*>>> kv_cache_;

    std::mutex stats_mutex_;
    std::vector<uint32_t> block_heat_;
    std::atomic<uint64_t> total_allocations_;
    std::atomic<uint64_t> total_evictions_;
    size_t peak_blocks_used_;
    double wasted_capacity_mb_;
    double allocated_capacity_mb_;
};

} // namespace memory
} // namespace cerebrum
