from core.managers import engine_manager


class MetricsService:
    def __init__(self):
        self.history = []

    def get_realtime_metrics(self):
        """Merge engine metrics (playground schema) with dashboard hardware fields."""
        engine_stats = engine_manager.get_metrics()
        memory = engine_stats.get("memory") or {}
        free_blocks = memory.get("free_blocks", engine_stats.get("free_memory_blocks", 1024))
        total_blocks = memory.get("total_blocks", 1024)

        # Pass through the full engine payload so the playground / decision UI work,
        # then layer dashboard-oriented aliases on top.
        metrics = {
            **engine_stats,
            "queue_stats": {
                "chat": engine_stats.get("chat_queue_size", 0),
                "batch": engine_stats.get("batch_queue_size", 0),
                "processed": engine_stats.get("jobs_processed", engine_stats.get("total_requests", 0)),
            },
            "memory_stats": {
                "free_blocks": free_blocks,
                "total_blocks": total_blocks,
            },
            "workers": engine_stats.get("workers", []),
            "hardware": {
                "cpu_utilization": engine_stats.get(
                    "cpu_utilization",
                    45 + (engine_stats.get("chat_queue_size", 0) * 2),
                ),
                "gpu_utilization": engine_stats.get(
                    "memory_utilization",
                    60 + (engine_stats.get("batch_queue_size", 0) * 5),
                ),
                "vram_used_mb": (total_blocks - free_blocks) * 16,
            },
        }
        return metrics


metrics_service = MetricsService()
