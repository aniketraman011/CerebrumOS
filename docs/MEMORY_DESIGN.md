# Memory Manager Design

## Goals
- Virtualize a fixed VRAM budget as pages/blocks
- Survive allocation bursts without contiguous-fit failure
- Evict cold blocks (LRU) when pressure rises
- Expose educational telemetry: fragmentation, heat map, peak, reuse

## Block Allocator

1. Split total capacity into `N` equal blocks (default 1024).
2. First-fit scan for free blocks for the request size (`vram_mb / 16`).
3. If insufficient free space, evict oldest occupied blocks until the request fits.
4. Soft-release on completion (keep a fraction warm) to demonstrate **memory reuse**.

## Metrics

| Metric | Meaning |
|--------|---------|
| `fragmentation_ratio` | Share of free blocks trapped in short runs (< 4) |
| `peak_blocks` | High-water mark of used blocks |
| `total_reuses` | Allocations that reused a previously used block |
| `total_evictions` | LRU evictions under pressure |
| `heatmap` | 64-bucket downsampling of occupancy (0–3 intensity) |
| `allocation_graph` | Time series of used blocks per allocation |

## Production Analogy
Maps to **vLLM PagedAttention**: KV cache stored in non-contiguous blocks so sequences grow without requiring a single contiguous VRAM slab.
