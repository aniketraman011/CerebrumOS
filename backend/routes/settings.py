from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database.db import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsPayload(BaseModel):
    vram_limit: int
    flush_interval: str
    mlfq_starvation: bool

@router.get("/")
async def get_settings():
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("SELECT vram_limit, flush_interval, mlfq_starvation FROM settings WHERE id = 1")
        row = cursor.fetchone()
        if not row:
            return {"vram_limit": 95, "flush_interval": "1000ms (Low Overhead)", "mlfq_starvation": True}
        return {
            "vram_limit": row[0],
            "flush_interval": row[1],
            "mlfq_starvation": bool(row[2])
        }

@router.post("/")
async def update_settings(payload: SettingsPayload):
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute(
            "UPDATE settings SET vram_limit = ?, flush_interval = ?, mlfq_starvation = ? WHERE id = 1",
            (payload.vram_limit, payload.flush_interval, int(payload.mlfq_starvation))
        )
        db.commit()
    return {"status": "success", "message": "Settings updated in SQLite"}
