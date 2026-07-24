# Low-Level Design (LLD): CerebrumOS

## 1. Module Boundaries

| Layer | Path | Responsibility |
|-------|------|----------------|
| Ingress | `backend/routes/*` | HTTP/WS contracts |
| Services | `backend/services/*` | Metrics shaping |
| Decision Engine | `backend/core/decision_engine.py` | Policy selection + explainability |
| Engine Manager | `backend/core/managers.py` | pybind / Python mock + EventStore |
| C++ Runtime | `core_cpp/include/cerebrum/runtime/*` | Pipeline, event bus, workers |
| C++ Scheduler | `core_cpp/include/scheduler/adaptive_scheduler.hpp` | FCFS/RR/Priority/MLFQ/Adaptive |
| C++ Memory | `core_cpp/include/cerebrum/memory/*` | Paged VRAM + LRU |
| Visualizer | `frontend/src/app/*` | Playground, replay, decision UI |

## 2. Runtime Decision Engine

### Inputs
- Queue length
- Memory pressure (used/total blocks)
- Cache hit ratio
- Tensor size (MB)
- Worker utilization
- Estimated latency (EMA by job type)

### Outputs
- Policy ∈ {FCFS, RR, MLFQ, Priority}
- Reason (human-readable)
- Confidence (0–100)
- Expected latency (ms)
- Predicted latency reduction (%)

### Decision heuristics (Adaptive)
1. `memory_pressure > 0.85` → **Priority**
2. `queue_length > 50` → **RR**
3. `worker_utilization < 0.5` → **MLFQ**
4. Large tensor + low cache → **FCFS** bias
5. Else → **MLFQ** (chat-first default)

Pinned policies bypass Adaptive and report `confidence = 100%`.

## 3. Event Lifecycle

```
CREATED → QUEUED → SCHEDULED → WORKER_ASSIGNED
       → MEMORY_ALLOCATED → INFERENCE_STARTED
       → CACHE_UPDATED → COMPLETED
```

`SCHEDULED` carries the structured decision payload for explainability and timeline replay.

## 4. Memory Model (Mock + C++)

- Address space split into fixed-size blocks
- First-fit allocation; LRU eviction under pressure
- Metrics: fragmentation ratio, peak used blocks, reuse count, heat map buckets, allocation time series

## 5. API Surface (additions)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/metrics/decisions` | Decision history |
| GET | `/api/metrics/timeline/{id}` | Replay pipeline for one job |
| GET | `/api/metrics/interview/policies` | Scheduler education briefs |
| GET | `/api/metrics/interview/stages` | Lifecycle education briefs |
| GET | `/api/metrics/interview/{topic}` | Single topic brief |

WebSocket `/api/metrics/ws` now forwards the full engine metrics object (including `decision`, `memory`, percentiles, `active_timeline`).
