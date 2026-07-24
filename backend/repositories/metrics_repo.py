from database.db import get_db

class MetricsRepository:
    def save_metric(self, cpu: float, gpu: float, vram: float, cache_hit: float):
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute(
                "INSERT INTO metrics_history (cpu_usage, gpu_usage, vram_usage, cache_hit_rate) VALUES (?, ?, ?, ?)",
                (cpu, gpu, vram, cache_hit)
            )
            db.commit()

    def get_recent_metrics(self, limit: int = 100):
        with get_db() as db:
            cursor = db.cursor()
            cursor.execute(
                "SELECT timestamp, cpu_usage, gpu_usage, vram_usage, cache_hit_rate FROM metrics_history ORDER BY id DESC LIMIT ?",
                (limit,)
            )
            return cursor.fetchall()
