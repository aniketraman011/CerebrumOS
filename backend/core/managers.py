import logging
import os
import time
import random
from threading import Lock
from typing import Any, Dict, List, Optional

from core.decision_engine import RuntimeSignals, decision_engine

logger = logging.getLogger(__name__)

# Try to import the C++ extension, provide a mock fallback if it fails
try:
    import cerebrum_engine
    ENGINE_AVAILABLE = True
except ImportError:
    logger.warning("cerebrum_engine pybind11 module not found. Running in Python mock mode.")
    ENGINE_AVAILABLE = False

    class CerebrumEngineMock:
        """
        Full-fidelity Python mock of the C++ engine.
        Uses RuntimeDecisionEngine for scheduling and a paged memory map
        for fragmentation / reuse / peak tracking.
        """

        def __init__(self, num_workers=0, total_memory_blocks=1024, cache_capacity=256, mode="simulation"):
            self.total_requests = 0
            self.mode = mode
            self.policy = "Adaptive"
            self.num_workers = num_workers if num_workers > 0 else max(2, (os.cpu_count() or 4) - 1)
            self.latencies: List[float] = []
            self.event_buffer: List[Dict[str, Any]] = []
            self.cache_hits = 0
            self.cache_lookups = 0
            self.queue_depth = 0
            self.busy_workers = 0
            self._lock = Lock()
            # Rolling activity windows so Adaptive sees varying load across bursts
            self._submit_times: List[float] = []
            self._inflight = 0

            # Paged memory simulation
            self.total_blocks = total_memory_blocks
            self.block_owner: List[Optional[int]] = [None] * total_memory_blocks  # job_id or None
            self.block_age: List[int] = [0] * total_memory_blocks
            self.alloc_tick = 0
            self.total_allocations = 0
            self.total_evictions = 0
            self.total_reuses = 0
            self.peak_used_blocks = 0
            self.allocation_history: List[Dict[str, Any]] = []
            # Warm resident set (prefix/cache) — drifts, does not pin pressure at 100%
            self._warm_target = 0.25

            self._decision_engine = decision_engine
            self._last_decision: Optional[Dict[str, Any]] = None
            self._worker_tasks: List[int] = [0] * self.num_workers
            self.cache_capacity = cache_capacity
            self.cache_policy = "LRU"
            self.vram_limit_pct = 100

        def _free_blocks(self) -> int:
            return sum(1 for o in self.block_owner if o is None)

        def _used_blocks(self) -> int:
            return self.total_blocks - self._free_blocks()

        def _fragmentation_ratio(self) -> float:
            """External fragmentation: free blocks that are isolated (not in runs of 4+)."""
            free = 0
            isolated = 0
            run = 0
            for owner in self.block_owner:
                if owner is None:
                    free += 1
                    run += 1
                else:
                    if 0 < run < 4:
                        isolated += run
                    run = 0
            if 0 < run < 4:
                isolated += run
            return (isolated / free) if free else 0.0

        def _memory_heatmap(self, buckets: int = 64) -> List[int]:
            """Downsample block map into heat buckets (0=free, 1=reused-ish, 2=fresh, 3=hot)."""
            step = max(1, self.total_blocks // buckets)
            heat = []
            for i in range(0, self.total_blocks, step):
                chunk = self.block_owner[i:i + step]
                used = sum(1 for o in chunk if o is not None)
                ratio = used / len(chunk)
                if ratio == 0:
                    heat.append(0)
                elif ratio < 0.4:
                    heat.append(1)
                elif ratio < 0.8:
                    heat.append(2)
                else:
                    heat.append(3)
                if len(heat) >= buckets:
                    break
            while len(heat) < buckets:
                heat.append(0)
            return heat

        def _allocate(self, job_id: int, blocks_needed: int) -> tuple:
            """First-fit allocation with LRU eviction if needed. Returns (allocated, evicted, reused)."""
            self.alloc_tick += 1
            free_idxs = [i for i, o in enumerate(self.block_owner) if o is None]
            reused = 0
            evicted = 0

            if len(free_idxs) < blocks_needed:
                # Evict oldest occupied blocks (LRU by age)
                occupied = sorted(
                    [(self.block_age[i], i) for i, o in enumerate(self.block_owner) if o is not None]
                )
                need = blocks_needed - len(free_idxs)
                for _, idx in occupied[:need]:
                    self.block_owner[idx] = None
                    free_idxs.append(idx)
                    evicted += 1
                    self.total_evictions += 1

            allocated = free_idxs[:blocks_needed]
            for idx in allocated:
                # Count reuse if this block was previously allocated in session
                if self.block_age[idx] > 0:
                    reused += 1
                    self.total_reuses += 1
                self.block_owner[idx] = job_id
                self.block_age[idx] = self.alloc_tick

            self.total_allocations += 1
            used = self._used_blocks()
            self.peak_used_blocks = max(self.peak_used_blocks, used)
            self.allocation_history.append({
                "t": int(time.time() * 1000),
                "job_id": job_id,
                "blocks": blocks_needed,
                "used": used,
                "evicted": evicted,
                "reused": reused,
            })
            if len(self.allocation_history) > 120:
                self.allocation_history = self.allocation_history[-120:]
            return allocated, evicted, reused

        def _release(self, job_id: int) -> None:
            for i, o in enumerate(self.block_owner):
                if o == job_id:
                    self.block_owner[i] = None

        def _cache_hit_ratio(self) -> float:
            if self.cache_lookups == 0:
                return 0.45
            return self.cache_hits / self.cache_lookups

        def _worker_utilization(self) -> float:
            return min(1.0, self.busy_workers / max(1, self.num_workers))

        def _prune_submit_times(self, now: float, window: float = 1.0) -> None:
            self._submit_times = [t for t in self._submit_times if now - t <= window]

        def _activity_signals(self, vram_required: int) -> tuple:
            """
            Derive queue / util / memory pressure from recent burst activity.
            Jobs complete under one lock, so raw queue_depth was always ~1 —
            that made Adaptive stick on one policy.
            """
            now = time.time()
            self._prune_submit_times(now, 1.0)
            recent = len(self._submit_times)
            # Effective queue: in-flight + recent arrivals in the last second
            queue_length = max(1, self._inflight + recent)
            # Workers look busy when a burst is in flight
            worker_util = min(1.0, (self._inflight + recent * 0.35) / max(1, self.num_workers))

            # Drift warm resident set with workload shape (batch fills VRAM more)
            if vram_required >= 128:
                self._warm_target = min(0.82, self._warm_target + 0.04)
            else:
                self._warm_target = max(0.12, self._warm_target - 0.03)
            # Add mild noise so pressure is not a flat line
            warm = max(0.05, min(0.9, self._warm_target + random.uniform(-0.05, 0.05)))
            # Live pages + warm cache + this tensor's footprint
            live = self._used_blocks() / self.total_blocks
            this_job = max(1, vram_required // 16) / self.total_blocks
            mem_pressure = min(0.98, max(live, warm) + this_job * 0.5)
            return queue_length, worker_util, mem_pressure

        def _reconcile_warm_set(self) -> None:
            """Keep a drifting warm cache without locking pressure at 100% forever."""
            target = int(self.total_blocks * self._warm_target)
            used = self._used_blocks()
            if used > target:
                # Free oldest warm blocks down toward target
                occupied = sorted(
                    [(self.block_age[i], i) for i, o in enumerate(self.block_owner) if o is not None]
                )
                for _, idx in occupied[: used - target]:
                    self.block_owner[idx] = None
            elif used < target:
                free = [i for i, o in enumerate(self.block_owner) if o is None]
                for idx in free[: target - used]:
                    self.block_owner[idx] = -1  # warm/cache sentinel
                    self.block_age[idx] = max(1, self.alloc_tick)

        def submit_request(self, priority=1, vram_required=128, is_batch=False, type="Medium"):
            if self.mode == "simulation":
                time.sleep(0.008)

            with self._lock:
                now = time.time()
                self.total_requests += 1
                job_id = self.total_requests
                self._submit_times.append(now)
                self._inflight += 1
                self.queue_depth = self._inflight

                queue_length, worker_util, mem_pressure = self._activity_signals(vram_required)
                self.busy_workers = max(1, int(round(worker_util * self.num_workers)))
                cache_hit = self._cache_hit_ratio()
                blocks_needed = max(1, vram_required // 16)

                signals = RuntimeSignals(
                    queue_length=queue_length,
                    memory_pressure=mem_pressure,
                    cache_hit=cache_hit,
                    tensor_size_mb=vram_required,
                    worker_utilization=worker_util,
                    estimated_latency_ms=self._decision_engine.estimate_latency(type, vram_required, cache_hit),
                )

                decision = self._decision_engine.decide(
                    signals,
                    pinned_policy=self.policy,
                    job_id=job_id,
                    job_type=type,
                )
                self._last_decision = decision.to_dict()

                # Simulate cache lookup
                self.cache_lookups += 1
                is_hit = random.random() < max(0.25, cache_hit)
                if is_hit:
                    self.cache_hits += 1

                # Allocate memory for this job
                _, evicted, reused = self._allocate(job_id, blocks_needed)
                worker_id = random.randint(0, self.num_workers - 1)
                if not hasattr(self, "_worker_tasks") or len(self._worker_tasks) < self.num_workers:
                    self._worker_tasks = [0] * self.num_workers
                self._worker_tasks[worker_id] += 1

                # Latency shaped by decision + hit/miss
                latency = decision.expected_latency_ms * (0.7 if is_hit else 1.15)
                latency += random.uniform(-3, 5)
                latency = max(4.0, round(latency, 2))

                base_ts = int(time.time() * 1000)
                stages = [
                    ("CREATED", 0, f"Request type: {type}"),
                    ("QUEUED", 2, f"Added to queue (depth={queue_length})"),
                    ("SCHEDULED", 12, decision.to_explanation_text()),
                    ("WORKER_ASSIGNED", 14, f"Worker {worker_id} allocated"),
                    ("MEMORY_ALLOCATED", 18, f"Allocated {vram_required} MB ({blocks_needed} blocks); evicted={evicted}, reused={reused}"),
                    ("INFERENCE_STARTED", 22, f"Mode: {self.mode}; policy={decision.policy}"),
                    ("CACHE_UPDATED", 40, "Cache Hit" if is_hit else "Cache Miss"),
                    ("COMPLETED", 50 + int(latency), f"Latency: {latency:.1f} ms"),
                ]
                for stage, offset, details in stages:
                    self.event_buffer.append({
                        "job_id": job_id,
                        "stage": stage,
                        "timestamp": str(base_ts + offset),
                        "details": details,
                        "decision": self._last_decision if stage == "SCHEDULED" else None,
                    })

                self.latencies.append(latency)
                if len(self.latencies) > 500:
                    self.latencies = self.latencies[-500:]

                self._decision_engine.record_completion(type, latency)
                # Always free this job's pages, then reconcile a drifting warm set
                self._release(job_id)
                self._reconcile_warm_set()
                self._inflight = max(0, self._inflight - 1)
                self.queue_depth = self._inflight
                self.busy_workers = max(0, int(round(
                    min(1.0, (self._inflight + len(self._submit_times) * 0.2) / max(1, self.num_workers))
                    * self.num_workers
                )))

                return job_id

        def fetch_events(self):
            with self._lock:
                evts = self.event_buffer.copy()
                self.event_buffer.clear()
                return evts

        def get_metrics(self):
            with self._lock:
                avg = sum(self.latencies) / len(self.latencies) if self.latencies else 0
                sorted_lat = sorted(self.latencies)
                n = len(sorted_lat)

                def pct(p):
                    if not sorted_lat:
                        return 0
                    return sorted_lat[min(n - 1, int(n * p))]

                p50 = pct(0.50)
                p95 = pct(0.95)
                p99 = pct(0.99)
                throughput = (1000.0 / avg * self.num_workers) if avg > 0 else 0
                free = self._free_blocks()
                used = self._used_blocks()
                decision = self._last_decision
                if decision:
                    explanation_text = (
                        f"Runtime Decision Engine\n"
                        f"Decision: {decision['policy']}\n"
                        f"Reason: {decision['reason']}\n"
                        f"Worker utilization = {int(decision['inputs'].get('worker_utilization', 0) * 100)}%\n"
                        f"Predicted latency reduced by {decision['predicted_latency_reduction_pct']:.0f}%\n"
                        f"Expected latency = {decision['expected_latency_ms']:.1f} ms\n"
                        f"Confidence = {decision['confidence']:.0f}%"
                    )
                else:
                    explanation_text = f"{self.policy}: awaiting first decision"

                return {
                    "total_requests": self.total_requests,
                    "avg_latency_ms": avg,
                    "p50_latency_ms": p50,
                    "p95_latency_ms": p95,
                    "p99_latency_ms": p99,
                    "throughput_req_sec": throughput,
                    "cache_hit_ratio": self._cache_hit_ratio(),
                    "queue_size": self.queue_depth,
                    "chat_queue_size": max(0, self.queue_depth // 2),
                    "batch_queue_size": max(0, self.queue_depth - self.queue_depth // 2),
                    "jobs_processed": self.total_requests,
                    "scheduler_explanation": explanation_text,
                    "decision": decision,
                    "cpu_utilization": min(100.0, 20 + self._worker_utilization() * 70 + self.queue_depth * 0.5),
                    "memory_utilization": (used / max(1, self.total_blocks)) * 100,
                    "num_workers": self.num_workers,
                    "vram_limit_pct": getattr(self, "vram_limit_pct", 100),
                    "cache": {
                        "policy": getattr(self, "cache_policy", "LRU"),
                        "hit_ratio": self._cache_hit_ratio(),
                        "hits": self.cache_hits,
                        "misses": max(0, self.cache_lookups - self.cache_hits),
                        "lookups": self.cache_lookups,
                        "capacity": getattr(self, "cache_capacity", 256),
                        "usage_pct": min(
                            100.0,
                            (used / max(1, self.total_blocks)) * 100 * 0.6
                            + self._cache_hit_ratio() * 40,
                        ),
                    },
                    "memory": {
                        "total_blocks": self.total_blocks,
                        "free_blocks": free,
                        "used_blocks": used,
                        "peak_blocks": self.peak_used_blocks,
                        "total_allocations": self.total_allocations,
                        "total_evictions": self.total_evictions,
                        "total_reuses": self.total_reuses,
                        "fragmentation_ratio": round(self._fragmentation_ratio(), 3),
                        "heatmap": self._memory_heatmap(64),
                        "allocation_graph": self.allocation_history[-40:],
                        "vram_limit_pct": getattr(self, "vram_limit_pct", 100),
                    },
                    "workers": self._worker_snapshot(),
                }

        def _worker_snapshot(self):
            workers = []
            for i in range(self.num_workers):
                if i < self.busy_workers:
                    status = "BUSY"
                    status_code = 1
                elif self.busy_workers > 0 and i < self.busy_workers + max(1, self.num_workers // 4):
                    status = "SPINNING"
                    status_code = 3
                else:
                    status = "IDLE"
                    status_code = 2
                tasks = getattr(self, "_worker_tasks", [0] * self.num_workers)
                if len(tasks) < self.num_workers:
                    tasks = tasks + [0] * (self.num_workers - len(tasks))
                    self._worker_tasks = tasks
                workers.append({
                    "id": i,
                    "status": status_code,
                    "status_label": status,
                    "tasks_completed": tasks[i],
                })
            return workers

        def configure(self, num_workers: int = None, vram_limit_pct: int = None, cache_policy: str = None):
            with self._lock:
                if num_workers is not None:
                    n = max(1, min(64, int(num_workers)))
                    old = getattr(self, "_worker_tasks", [0] * self.num_workers)
                    self.num_workers = n
                    self._worker_tasks = (old + [0] * n)[:n]
                    self.busy_workers = min(self.busy_workers, n)
                if vram_limit_pct is not None:
                    self.vram_limit_pct = max(10, min(100, int(vram_limit_pct)))
                    self._warm_target = min(self._warm_target, self.vram_limit_pct / 100.0 * 0.9)
                if cache_policy is not None:
                    self.cache_policy = "LFU" if str(cache_policy).upper() == "LFU" else "LRU"

        def set_policy(self, policy: str):
            self.policy = policy

        def set_mode(self, mode: str):
            self.mode = mode

        def reset(self):
            """Clear runtime counters, memory map, and event buffer."""
            with self._lock:
                self.total_requests = 0
                self.latencies.clear()
                self.event_buffer.clear()
                self.cache_hits = 0
                self.cache_lookups = 0
                self.queue_depth = 0
                self.busy_workers = 0
                self._submit_times.clear()
                self._inflight = 0
                self.block_owner = [None] * self.total_blocks
                self.block_age = [0] * self.total_blocks
                self.alloc_tick = 0
                self.total_allocations = 0
                self.total_evictions = 0
                self.total_reuses = 0
                self.peak_used_blocks = 0
                self.allocation_history.clear()
                self._warm_target = 0.25
                self._last_decision = None
                self._worker_tasks = [0] * self.num_workers

    cerebrum_engine = type("cerebrum_engine", (), {"CerebrumEngine": CerebrumEngineMock})


class EventStore:
    def __init__(self):
        self.lock = Lock()
        self.jobs = {}
        self.active_jobs = set()

    def process_events(self, events):
        with self.lock:
            for ev in events:
                jid = ev["job_id"]
                if jid not in self.jobs:
                    self.jobs[jid] = {
                        "id": jid,
                        "events": [],
                        "status": "QUEUED",
                        "policy": "Adaptive",
                        "type": "Medium",
                        "mode": engine_manager.current_mode,
                        "start_time": ev["timestamp"],
                        "end_time": None,
                        "decision": None,
                    }
                    self.active_jobs.add(jid)

                self.jobs[jid]["events"].append(ev)

                stage = ev["stage"]
                if stage == "COMPLETED":
                    self.jobs[jid]["status"] = "COMPLETED"
                    self.jobs[jid]["end_time"] = ev["timestamp"]
                    self.active_jobs.discard(jid)
                elif stage == "SCHEDULED":
                    self.jobs[jid]["status"] = "RUNNING"
                    details = ev.get("details") or ""
                    if ev.get("decision"):
                        self.jobs[jid]["decision"] = ev["decision"]
                        self.jobs[jid]["policy"] = ev["decision"].get("policy", "Adaptive")
                    elif "Decision:" in details:
                        for line in details.split("\n"):
                            if line.startswith("Decision:"):
                                self.jobs[jid]["policy"] = line.split(":", 1)[1].strip()
                    elif "Selected by:" in details:
                        policy_line = [l for l in details.split("\n") if "Selected by:" in l][0]
                        self.jobs[jid]["policy"] = policy_line.split(":")[1].strip()
                elif stage == "CREATED":
                    details = ev.get("details") or ""
                    if "Request type:" in details:
                        self.jobs[jid]["type"] = details.split(":")[1].strip()

    def get_last_10_active(self):
        with self.lock:
            active = [self.jobs[jid] for jid in self.active_jobs]
            if len(active) < 10:
                completed = [j for j in self.jobs.values() if j["status"] == "COMPLETED"]
                completed.sort(key=lambda x: int(x["end_time"] or 0), reverse=True)
                active.extend(completed[: 10 - len(active)])
            return active[:10]

    def get_all_jobs(self):
        with self.lock:
            return list(self.jobs.values())

    def get_job(self, job_id: int):
        with self.lock:
            return self.jobs.get(job_id)

    def clear(self):
        with self.lock:
            self.jobs.clear()
            self.active_jobs.clear()


class EngineManager:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.engine = cerebrum_engine.CerebrumEngine(
            num_workers=0,
            total_memory_blocks=1024,
            cache_capacity=256,
            mode="simulation",
        )
        self.current_mode = "simulation"
        self.current_policy = "Adaptive"
        self.running = True
        self.event_store = EventStore()
        self.worker_count = getattr(self.engine, "num_workers", 4)
        self.vram_limit_pct = 95
        logger.info("EngineManager initialized in simulation mode with APM Event Store.")

    def configure(self, num_workers: int = None, vram_limit_pct: int = None, cache_policy: str = None):
        if hasattr(self.engine, "configure"):
            self.engine.configure(num_workers=num_workers, vram_limit_pct=vram_limit_pct, cache_policy=cache_policy)
        if num_workers is not None:
            self.worker_count = max(1, min(64, int(num_workers)))
        if vram_limit_pct is not None:
            self.vram_limit_pct = max(10, min(100, int(vram_limit_pct)))
        return {
            "status": "configured",
            "num_workers": self.worker_count,
            "vram_limit_pct": self.vram_limit_pct,
            "cache_policy": cache_policy,
        }

    def start(self):
        self.running = True
        logger.info("EngineManager runtime STARTED")
        return {"status": "started", "running": True}

    def stop(self):
        self.running = False
        logger.info("EngineManager runtime STOPPED")
        return {"status": "stopped", "running": False}

    def restart(self):
        """Hard reset: clear jobs, memory, decisions, then start."""
        self.running = False
        if hasattr(self.engine, "reset"):
            self.engine.reset()
        else:
            # C++ path: recreate engine instance
            self.engine = cerebrum_engine.CerebrumEngine(
                num_workers=0,
                total_memory_blocks=1024,
                cache_capacity=256,
                mode=self.current_mode,
            )
            if hasattr(self.engine, "set_policy"):
                self.engine.set_policy(self.current_policy)
        self.event_store.clear()
        decision_engine.reset()
        self.running = True
        logger.info("EngineManager runtime RESTARTED")
        return {"status": "restarted", "running": True}

    def set_mode(self, mode: str):
        self.current_mode = mode
        self.engine.set_mode(mode)
        logger.info(f"EngineManager mode switched to: {mode}")

    def set_policy(self, policy: str):
        self.current_policy = policy
        self.engine.set_policy(policy)
        logger.info(f"EngineManager scheduling policy switched to: {policy}")

    def submit_job(self, priority: int, vram_required: int, is_batch: bool, job_type: str = "Medium") -> int:
        if not self.running:
            raise RuntimeError("Runtime is stopped. Press Start to accept jobs.")
        return self.engine.submit_request(priority, vram_required, is_batch, job_type)

    def get_metrics(self) -> dict:
        events = self.engine.fetch_events()
        self.event_store.process_events(events)

        metrics = self.engine.get_metrics()
        metrics["active_timeline"] = self.event_store.get_last_10_active()
        metrics["policy"] = self.current_policy
        metrics["mode"] = self.current_mode
        metrics["running"] = self.running
        metrics["runtime_status"] = "running" if self.running else "stopped"

        # Always surface decision engine history (works for mock; C++ falls back)
        last = decision_engine.last()
        if last and not metrics.get("decision"):
            metrics["decision"] = last.to_dict()
            metrics["scheduler_explanation"] = last.to_explanation_text()
        metrics["decision_history"] = decision_engine.history(20)
        return metrics


engine_manager = EngineManager.get_instance()
