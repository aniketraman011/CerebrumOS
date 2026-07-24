import time
import asyncio
import random
from core.managers import engine_manager


class BenchmarkEngine:
    async def run_scheduler_comparison(self, num_requests: int = 100):
        """
        Runs a burst of synthetic jobs against all scheduler policies and compares them.
        Returns P50/P95/P99, throughput, CPU/memory utilization, and cache hit.
        """
        policies = ["FCFS", "RR", "Priority", "MLFQ", "Adaptive"]
        results = []

        engine_manager.set_mode("benchmark")

        for policy in policies:
            engine_manager.set_policy(policy)
            await asyncio.sleep(0.2)

            start_time = time.time()

            for _ in range(num_requests):
                priority = random.randint(1, 3)
                vram = random.choice([32, 64, 128, 256])
                is_batch = random.choice([True, False])
                job_type = random.choice(["Small", "Medium", "Large", "LLM"])
                engine_manager.submit_job(priority, vram, is_batch, job_type)

            await asyncio.sleep(0.5)
            elapsed = max(0.001, time.time() - start_time)
            metrics = engine_manager.get_metrics()

            results.append({
                "scheduler": policy,
                "avg_latency": metrics.get("avg_latency_ms", 0),
                "p50": metrics.get("p50_latency_ms", metrics.get("avg_latency_ms", 0)),
                "p95": metrics.get("p95_latency_ms", 0),
                "p99": metrics.get("p99_latency_ms", 0),
                "throughput": metrics.get("throughput_req_sec", num_requests / elapsed),
                "cache_hit": metrics.get("cache_hit_ratio", 0) * 100,
                "cpu_utilization": metrics.get("cpu_utilization", 0),
                "memory_utilization": metrics.get("memory_utilization", 0),
                "jobs": num_requests,
                "elapsed_sec": round(elapsed, 3),
            })

        engine_manager.set_mode("simulation")
        return results


benchmark_engine = BenchmarkEngine()
