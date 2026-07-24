"""
Runtime Decision Engine
=======================
Chooses FCFS / RR / MLFQ / Priority from live runtime signals and returns a
structured, explainable decision (policy, reason, confidence, expected latency).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional
import time


@dataclass
class RuntimeSignals:
    queue_length: int = 0
    memory_pressure: float = 0.0      # 0..1
    cache_hit: float = 0.0            # 0..1
    tensor_size_mb: int = 0
    worker_utilization: float = 0.0   # 0..1
    estimated_latency_ms: float = 0.0


@dataclass
class SchedulingDecision:
    policy: str
    reason: str
    confidence: float                 # 0..100
    expected_latency_ms: float
    predicted_latency_reduction_pct: float
    inputs: Dict[str, Any] = field(default_factory=dict)
    timestamp_ms: int = 0
    job_id: Optional[int] = None
    pinned: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_explanation_text(self) -> str:
        lines = [
            "Runtime Decision Engine",
            f"Decision: {self.policy}",
            f"Reason: {self.reason}",
            f"Queue length = {self.inputs.get('queue_length', 0)}",
            f"Memory pressure = {int(self.inputs.get('memory_pressure', 0) * 100)}%",
            f"Cache hit = {int(self.inputs.get('cache_hit', 0) * 100)}%",
            f"Tensor size = {self.inputs.get('tensor_size_mb', 0)} MB",
            f"Worker utilization = {int(self.inputs.get('worker_utilization', 0) * 100)}%",
            f"Predicted latency reduced by {self.predicted_latency_reduction_pct:.0f}%",
            f"Expected latency = {self.expected_latency_ms:.1f} ms",
            f"Confidence = {self.confidence:.0f}%",
        ]
        return "\n".join(lines)


# Interview / education metadata for each policy
POLICY_INTERVIEW: Dict[str, Dict[str, str]] = {
    "FCFS": {
        "algorithm": "First-Come First-Served — jobs leave the ready queue in arrival order.",
        "complexity": "O(1) enqueue / dequeue with a FIFO queue",
        "tradeoffs": "Fair and simple, but a large job at the head blocks everyone (convoy effect).",
        "linux_equivalent": "Linux historical FIFO / SCHED_FIFO (realtime) without timeslices.",
        "production_analogy": "HTTP request queues that serve connections strictly in arrival order.",
    },
    "RR": {
        "algorithm": "Round Robin — each job gets a fixed time slice, then rotates to the back.",
        "complexity": "O(1) with a circular queue",
        "tradeoffs": "Bounds wait time and prevents starvation; too-small slices raise context-switch cost.",
        "linux_equivalent": "Classic round-robin / SCHED_RR realtime policy.",
        "production_analogy": "Fair queuing in nginx / Envoy where connections share equal service quanta.",
    },
    "Priority": {
        "algorithm": "Priority scheduling — highest priority job runs next (heap / multilevel queue).",
        "complexity": "O(log N) with a binary heap",
        "tradeoffs": "Protects latency-critical work; low-priority jobs can starve without aging.",
        "linux_equivalent": "nice / renice priorities; realtime SCHED_FIFO with priority levels.",
        "production_analogy": "Kubernetes PriorityClass / QoS classes for pods under pressure.",
    },
    "MLFQ": {
        "algorithm": "Multi-Level Feedback Queue — interactive jobs stay in high queues; batch demotes.",
        "complexity": "O(1) per dispatch across fixed queue levels",
        "tradeoffs": "Excellent interactive latency; needs tuning to avoid gaming / starvation.",
        "linux_equivalent": "Closest conceptual cousin to CFS interactivity heuristics (not identical).",
        "production_analogy": "vLLM / inference gateways separating chat (low TTFT) from batch jobs.",
    },
    "Adaptive": {
        "algorithm": "Runtime Decision Engine — selects FCFS/RR/Priority/MLFQ from live signals.",
        "complexity": "O(1) decision + cost of the chosen underlying policy",
        "tradeoffs": "Adapts to load and memory; harder to reason about without explainability logs.",
        "linux_equivalent": "Autogroup / CFS load balancing that changes behavior under pressure.",
        "production_analogy": "Autoscaling + QoS routers that switch strategies when queues or memory spike.",
    },
}

STAGE_INTERVIEW: Dict[str, Dict[str, str]] = {
    "CREATED": {
        "concept": "Request admission / process creation",
        "complexity": "O(1)",
        "tradeoffs": "Early validation avoids wasting scheduler cycles on invalid work.",
        "linux_equivalent": "fork/clone entry into the kernel",
        "production_analogy": "API gateway accepting a request and assigning a request ID.",
    },
    "QUEUED": {
        "concept": "Ready queue placement",
        "complexity": "O(1) or O(log N) depending on queue type",
        "tradeoffs": "Queue choice (FIFO vs priority) dominates fairness vs latency.",
        "linux_equivalent": "Task enters the runqueue",
        "production_analogy": "Message lands in Kafka / Redis / Celery before a worker claims it.",
    },
    "SCHEDULED": {
        "concept": "OS scheduling decision",
        "complexity": "O(1)–O(log N)",
        "tradeoffs": "Policy choice trades fairness, latency, and throughput.",
        "linux_equivalent": "pick_next_task in the Linux scheduler",
        "production_analogy": "Cluster scheduler (Kubernetes kube-scheduler) binding work to a node.",
    },
    "WORKER_ASSIGNED": {
        "concept": "Thread / worker pool dispatch",
        "complexity": "O(1)",
        "tradeoffs": "Oversubscription increases context switches; undersubscription wastes cores.",
        "linux_equivalent": "wake_up_process / CPU affinity assignment",
        "production_analogy": "Ray / ThreadPoolExecutor claiming a worker for a task.",
    },
    "MEMORY_ALLOCATED": {
        "concept": "Paged memory allocation",
        "complexity": "O(k) for k blocks; buddy systems O(log N)",
        "tradeoffs": "Contiguous allocation is fast but fragments; paging trades locality.",
        "linux_equivalent": "buddy allocator / page fault handler",
        "production_analogy": "vLLM PagedAttention KV-cache block allocation.",
    },
    "INFERENCE_STARTED": {
        "concept": "CPU/GPU compute phase",
        "complexity": "Model-dependent (matrix multiply dominated)",
        "tradeoffs": "Batching raises throughput but can hurt TTFT.",
        "linux_equivalent": "Process in TASK_RUNNING on CPU",
        "production_analogy": "CUDA kernel launch / ONNX Runtime session run.",
    },
    "CACHE_UPDATED": {
        "concept": "Cache hit/miss + eviction policy (LRU)",
        "complexity": "O(1) with hash map + doubly linked list",
        "tradeoffs": "Larger caches raise hit rate and memory pressure.",
        "linux_equivalent": "page cache / reclaim (LRU lists)",
        "production_analogy": "Redis LRU / LLM prefix (radix) cache for shared prompts.",
    },
    "COMPLETED": {
        "concept": "Job termination & metric accounting",
        "complexity": "O(1)",
        "tradeoffs": "Must free memory and update latency histograms atomically.",
        "linux_equivalent": "exit / wait accounting",
        "production_analogy": "Response returned; Prometheus histogram updated.",
    },
}


class RuntimeDecisionEngine:
    """Signal-driven policy selector with confidence and latency estimates."""

    def __init__(self) -> None:
        self._history: List[SchedulingDecision] = []
        self._avg_by_type: Dict[str, float] = {}
        self._baseline_latency_ms = 35.0

    def estimate_latency(self, job_type: str, tensor_size_mb: int, cache_hit: float) -> float:
        base = self._avg_by_type.get(job_type, self._baseline_latency_ms)
        size_factor = 1.0 + max(0, tensor_size_mb - 32) / 256.0
        cache_factor = 1.0 - (0.35 * cache_hit)
        return max(4.0, base * size_factor * cache_factor)

    def record_completion(self, job_type: str, latency_ms: float) -> None:
        prev = self._avg_by_type.get(job_type, latency_ms)
        self._avg_by_type[job_type] = prev * 0.8 + latency_ms * 0.2

    def decide(
        self,
        signals: RuntimeSignals,
        pinned_policy: Optional[str] = None,
        job_id: Optional[int] = None,
        job_type: str = "Medium",
    ) -> SchedulingDecision:
        inputs = {
            "queue_length": signals.queue_length,
            "memory_pressure": round(signals.memory_pressure, 3),
            "cache_hit": round(signals.cache_hit, 3),
            "tensor_size_mb": signals.tensor_size_mb,
            "worker_utilization": round(signals.worker_utilization, 3),
            "estimated_latency_ms": round(signals.estimated_latency_ms, 2),
            "job_type": job_type,
        }

        if pinned_policy and pinned_policy != "Adaptive":
            decision = self._pinned(pinned_policy, signals, inputs, job_id)
        else:
            decision = self._adaptive(signals, inputs, job_id, job_type)

        self._history.append(decision)
        if len(self._history) > 200:
            self._history = self._history[-200:]
        return decision

    def _pinned(
        self,
        policy: str,
        signals: RuntimeSignals,
        inputs: Dict[str, Any],
        job_id: Optional[int],
    ) -> SchedulingDecision:
        expected = self._expected_for_policy(policy, signals)
        reduction = max(0.0, (self._baseline_latency_ms - expected) / self._baseline_latency_ms * 100)
        return SchedulingDecision(
            policy=policy,
            reason="Manually pinned by operator — adaptive engine bypassed.",
            confidence=100.0,
            expected_latency_ms=expected,
            predicted_latency_reduction_pct=reduction,
            inputs=inputs,
            timestamp_ms=int(time.time() * 1000),
            job_id=job_id,
            pinned=True,
        )

    def _adaptive(
        self,
        signals: RuntimeSignals,
        inputs: Dict[str, Any],
        job_id: Optional[int],
        job_type: str,
    ) -> SchedulingDecision:
        # Score each policy; pick the best with an explainable primary reason.
        candidates: List[tuple] = []

        # Memory-critical → Priority (small/cheap jobs first)
        # Only dominate when pressure is clearly critical; otherwise other
        # signals (queue / idle workers) can win so Adaptive visibly changes.
        if signals.memory_pressure > 0.85:
            candidates.append((
                "Priority",
                1.15 + (signals.memory_pressure - 0.85),
                "Memory pressure exceeded threshold — prefer Priority so small/cheap "
                "jobs keep flowing instead of stalling behind large allocations.",
            ))
        else:
            candidates.append((
                "Priority",
                signals.memory_pressure * 0.35,
                "Moderate memory pressure — Priority is a candidate but not required.",
            ))

        # Deep queue → RR (avoid starvation)
        if signals.queue_length > 50:
            candidates.append((
                "RR",
                1.2 + min(0.3, (signals.queue_length - 50) / 100.0),
                "Queue length exceeded starvation threshold — Round Robin guarantees "
                "forward progress for every waiting job.",
            ))
        else:
            candidates.append((
                "RR",
                min(0.55, signals.queue_length / 100.0),
                "Queue is manageable — Round Robin is available but not preferred.",
            ))

        # Idle / light workers → MLFQ (fill with interactive work)
        if signals.worker_utilization < 0.5 and signals.memory_pressure <= 0.85:
            candidates.append((
                "MLFQ",
                0.95 + (0.5 - signals.worker_utilization) * 0.5,
                "Workers under-utilized with a manageable queue — MLFQ favors "
                "latency-sensitive chat over batch work.",
            ))
        else:
            candidates.append((
                "MLFQ",
                0.7 if signals.memory_pressure <= 0.85 else 0.25,
                "MLFQ remains the interactive default when memory is not critical.",
            ))

        # Large tensors + low cache → FCFS (avoid thrashing reordering)
        large = min(1.0, signals.tensor_size_mb / 256.0)
        fcfs_score = large * (1.0 - signals.cache_hit) * 0.85
        if signals.tensor_size_mb >= 128 and signals.cache_hit < 0.4:
            fcfs_score = max(fcfs_score, 0.8)
        candidates.append((
            "FCFS",
            fcfs_score,
            "Large tensor with low cache hit — FCFS avoids reordering thrash "
            "and keeps allocation order predictable.",
        ))

        # Default balanced MLFQ boost
        if signals.memory_pressure <= 0.7 and signals.queue_length <= 40:
            candidates.append((
                "MLFQ",
                0.92,
                "Load is balanced — MLFQ default (chat-first, batch as fallback).",
            ))

        candidates.sort(key=lambda c: c[1], reverse=True)
        policy, score, reason = candidates[0]
        second = candidates[1][1] if len(candidates) > 1 else 0.0
        confidence = min(99.0, 55.0 + (score - second) * 40.0 + score * 25.0)

        expected = self._expected_for_policy(policy, signals)
        if signals.estimated_latency_ms > 0:
            expected = 0.6 * expected + 0.4 * signals.estimated_latency_ms

        reduction = max(0.0, (self._baseline_latency_ms - expected) / self._baseline_latency_ms * 100)

        # Refine reason with live numbers for explainability UI
        reason = (
            f"{reason} Worker utilization = {int(signals.worker_utilization * 100)}%. "
            f"Predicted latency reduced by {reduction:.0f}%."
        )

        return SchedulingDecision(
            policy=policy,
            reason=reason,
            confidence=round(confidence, 1),
            expected_latency_ms=round(expected, 1),
            predicted_latency_reduction_pct=round(reduction, 1),
            inputs=inputs,
            timestamp_ms=int(time.time() * 1000),
            job_id=job_id,
            pinned=False,
        )

    def _expected_for_policy(self, policy: str, signals: RuntimeSignals) -> float:
        base = signals.estimated_latency_ms or self._baseline_latency_ms
        # Heuristic multipliers: how each policy tends to affect latency under load
        wait_penalty = signals.queue_length * 0.15
        mem_penalty = signals.memory_pressure * 12.0
        util_boost = signals.worker_utilization * 4.0

        multipliers = {
            "FCFS": 1.15 + wait_penalty * 0.02,
            "RR": 1.05 + wait_penalty * 0.01,
            "Priority": 0.85 + mem_penalty * 0.02,
            "MLFQ": 0.80 + (0 if signals.worker_utilization < 0.7 else 0.1),
        }
        m = multipliers.get(policy, 1.0)
        return max(4.0, base * m + wait_penalty * 0.05 - util_boost * 0.1)

    def last(self) -> Optional[SchedulingDecision]:
        return self._history[-1] if self._history else None

    def history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [d.to_dict() for d in self._history[-limit:]][::-1]

    def reset(self) -> None:
        self._history.clear()
        self._avg_by_type.clear()


decision_engine = RuntimeDecisionEngine()
