#pragma once

#include <vector>
#include <atomic>
#include <cstdint>
#include "../concurrency/spinlock.hpp"

namespace cerebrum {
namespace memory {

/**
 * @struct Block
 * @brief Represents a fixed-size physical block of VRAM for the KV Cache.
 */
struct Block {
    uint32_t physical_block_id;
    // Atomic reference count for lock-free prefix sharing across concurrent requests.
    std::atomic<int32_t> ref_count{0};
    
    // Pointer to actual device memory (e.g., cudaMalloc'd pointer)
    void* device_ptr{nullptr};
};

/**
 * @struct Sequence
 * @brief Represents a single inference request's virtualized KV Cache.
 */
struct Sequence {
    uint64_t request_id;
    // Logical to Physical block mapping.
    // This is the BlockTable passed to the custom PagedAttention kernel
    // to dynamically resolve physical memory addresses on the fly.
    std::vector<Block*> block_table;
    
    // Number of tokens currently generated/prefilled.
    size_t sequence_length{0};
};

/**
 * @class PagedAllocator
 * @brief Manages the global pool of physical VRAM blocks.
 */
class PagedAllocator {
private:
    std::vector<Block> physical_blocks_;
    std::vector<Block*> free_pool_;
    
    // We use our custom TTAS spinlock instead of std::mutex to prevent 
    // context-switching if two threads try to allocate simultaneously.
    concurrency::Spinlock allocator_lock_;

public:
    PagedAllocator(size_t total_blocks) : physical_blocks_(total_blocks) {
        free_pool_.reserve(total_blocks);
        for (size_t i = 0; i < total_blocks; ++i) {
            physical_blocks_[i].physical_block_id = static_cast<uint32_t>(i);
            free_pool_.push_back(&physical_blocks_[i]);
        }
    }

    /**
     * @brief Allocates a new physical block from the free pool.
     * @return Block pointer, or nullptr if VRAM is exhausted.
     */
    Block* allocate_block() {
        allocator_lock_.lock();
        if (free_pool_.empty()) {
            allocator_lock_.unlock();
            return nullptr; // OOM condition -> triggers Request PREEMPTION
        }
        Block* block = free_pool_.back();
        free_pool_.pop_back();
        allocator_lock_.unlock();
        
        // Initialize for single ownership
        block->ref_count.store(1, std::memory_order_relaxed);
        return block;
    }

    /**
     * @brief Releases a block back to the pool, decrementing its ref count.
     */
    void free_block(Block* block) {
        // We use acq_rel to ensure all device memory writes are finished 
        // before the block can be seen as free by another thread.
        if (block->ref_count.fetch_sub(1, std::memory_order_acq_rel) == 1) {
            allocator_lock_.lock();
            free_pool_.push_back(block);
            allocator_lock_.unlock();
        }
    }
    
    size_t free_blocks_count() {
        allocator_lock_.lock();
        size_t count = free_pool_.size();
        allocator_lock_.unlock();
        return count;
    }
};

} // namespace memory
} // namespace cerebrum
