import sqlite3
import os
from typing import Generator
from contextlib import contextmanager

DB_PATH = os.getenv("DB_PATH", "cerebrum.db")

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metrics_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                cpu_usage REAL,
                gpu_usage REAL,
                vram_usage REAL,
                cache_hit_rate REAL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                vram_limit INTEGER,
                flush_interval TEXT,
                mlfq_starvation BOOLEAN
            )
        """)
        
        # Insert default settings if empty
        cursor.execute("INSERT OR IGNORE INTO settings (id, vram_limit, flush_interval, mlfq_starvation) VALUES (1, 95, '1000ms (Low Overhead)', 1)")
        
        conn.commit()

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()
