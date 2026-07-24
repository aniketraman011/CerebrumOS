# Benchmark Methodology

## Goal
Compare FCFS, RR, Priority, MLFQ, and Adaptive under an identical synthetic burst.

## Procedure
1. Switch engine mode to `benchmark` (reduced sleep / faster mock path).
2. For each policy:
   - Pin policy via `/api/metrics/policy/{name}`
   - Submit `N` jobs (default 100) with randomized priority, VRAM, batch flag, and type
   - Collect metrics after a short drain window
3. Restore `simulation` mode.

## Reported Metrics
- Average latency
- **P50 / P95 / P99** latency
- Throughput (req/s)
- Cache hit %
- CPU utilization (derived from worker load + queue)
- Memory utilization (% of blocks used)

## Interpretation Notes
- Absolute numbers in Python mock mode are **relative**, not hardware-bound.
- Prefer ranking policies against each other on the same machine/run.
- Adaptive should win or match the best specialist policy when signals vary; pinned specialists can win on a workload tailored to them.

## UI
- Playground: inline comparison table
- `/benchmarks`: charts + full percentile table
