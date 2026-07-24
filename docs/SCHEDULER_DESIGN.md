# Scheduler Design

## Policies

| Policy | Structure | When CerebrumOS uses it |
|--------|-----------|-------------------------|
| FCFS | FIFO queue | Large tensors, low cache hit (avoid reordering thrash) |
| Round Robin | FIFO + time slice | Deep queues (anti-starvation) |
| Priority | Binary heap | Critical memory pressure |
| MLFQ | Chat priority queue + batch FIFO | Default interactive path |
| Adaptive | Runtime Decision Engine | Selects among the above from live signals |

## Complexity

| Policy | Enqueue | Dispatch |
|--------|---------|----------|
| FCFS / RR | O(1) | O(1) |
| Priority | O(log N) | O(log N) |
| MLFQ | O(log N) chat / O(1) batch | O(1)–O(log N) |
| Adaptive | cost of underlying + O(1) decide | same |

## Linux / Production Analogies

- **FCFS** ≈ historical FIFO / arrival-order HTTP queues
- **RR** ≈ `SCHED_RR`, fair connection quanta
- **Priority** ≈ `nice` / Kubernetes PriorityClass
- **MLFQ** ≈ interactive heuristics; chat vs batch in inference gateways
- **Adaptive** ≈ load-aware routing that changes strategy under pressure

## Explainability Contract

Every Adaptive (and pinned) dispatch emits:

```
Decision: <POLICY>
Reason: <why>
Queue length / Memory pressure / Cache hit / Tensor size / Worker utilization
Predicted latency reduced by X%
Expected latency = Y ms
Confidence = Z%
```

UI surfaces this on the Playground and Decision Engine pages; timeline stores it on the `SCHEDULED` event.
