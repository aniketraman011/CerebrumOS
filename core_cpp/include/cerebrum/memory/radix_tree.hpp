#pragma once

#include <unordered_map>
#include <vector>
#include <memory>
#include <shared_mutex>
#include "paged_allocator.hpp"

namespace cerebrum {
namespace memory {

/**
 * @struct RadixNode
 * @brief A node in the Radix Tree representing a sub-sequence of tokens.
 */
struct RadixNode {
    std::vector<int32_t> tokens; // The prefix chunk
    Block* physical_block{nullptr}; // The KV cache block for this chunk
    
    // Edges to child nodes (continuations of the prompt)
    std::unordered_map<int32_t, std::shared_ptr<RadixNode>> children;
    
    // LRU Timestamp for VRAM eviction policy
    uint64_t last_accessed_timestamp{0};
};

/**
 * @class PrefixCacheTree
 * @brief Radix tree for zero-compute prefill sharing.
 */
class PrefixCacheTree {
private:
    std::shared_ptr<RadixNode> root_;
    
    // Using std::shared_mutex for multiple concurrent readers (inference execution) 
    // and single writer (node eviction / insertion).
    std::shared_mutex rw_lock_;
    PagedAllocator& allocator_;

public:
    PrefixCacheTree(PagedAllocator& allocator) : allocator_(allocator) {
        root_ = std::make_shared<RadixNode>();
    }

    /**
     * @brief Matches a prompt against the tree, returning shared VRAM blocks.
     */
    std::vector<Block*> match_prefix(const std::vector<int32_t>& prompt, uint64_t current_time) {
        std::shared_lock<std::shared_mutex> lock(rw_lock_);
        std::vector<Block*> shared_blocks;
        
        std::shared_ptr<RadixNode> curr = root_;
        size_t prompt_idx = 0;
        
        while (prompt_idx < prompt.size()) {
            auto it = curr->children.find(prompt[prompt_idx]);
            if (it == curr->children.end()) break;
            
            curr = it->second;
            
            // In a production radix tree, we match the full `curr->tokens` array.
            // If the node has an allocated physical KV block, we claim it.
            if (curr->physical_block) {
                // Increment atomic ref count for lock-free VRAM sharing across requests
                curr->physical_block->ref_count.fetch_add(1, std::memory_order_relaxed);
                shared_blocks.push_back(curr->physical_block);
                
                curr->last_accessed_timestamp = current_time;
                prompt_idx += curr->tokens.size();
            } else {
                break;
            }
        }
        
        return shared_blocks;
    }
};

} // namespace memory
} // namespace cerebrum
