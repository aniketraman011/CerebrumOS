#include <gtest/gtest.h>
#include "../../core_cpp/include/cache/lru_cache.hpp"
#include "../../core_cpp/include/cache/lfu_cache.hpp"

using namespace cerebrum::cache;

TEST(LRUCacheTest, BasicEviction) {
    LRUCache<int, int> cache(2);
    cache.put(1, 100);
    cache.put(2, 200);
    
    EXPECT_EQ(cache.get(1).value_or(-1), 100); // 1 is now most recently used
    
    cache.put(3, 300); // Should evict 2
    
    EXPECT_EQ(cache.get(2).has_value(), false);
    EXPECT_EQ(cache.get(3).value_or(-1), 300);
    EXPECT_EQ(cache.get(1).value_or(-1), 100);
}

TEST(LFUCacheTest, FrequencyEviction) {
    LFUCache<int, int> cache(2);
    cache.put(1, 100);
    cache.put(2, 200);
    
    cache.get(1); // 1 has freq 2
    
    cache.put(3, 300); // Should evict 2 (freq 1)
    
    EXPECT_EQ(cache.get(2).has_value(), false);
    EXPECT_EQ(cache.get(1).value_or(-1), 100);
    EXPECT_EQ(cache.get(3).value_or(-1), 300);
}
