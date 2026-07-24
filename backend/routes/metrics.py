import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from services.metrics_service import metrics_service
from core.benchmark_engine import benchmark_engine
from core.managers import engine_manager
from core.websocket_manager import websocket_manager
from core.decision_engine import decision_engine, POLICY_INTERVIEW, STAGE_INTERVIEW

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/")
async def get_metrics():
    """Returns real-time telemetry metrics from the C++ Engine / mock."""
    return metrics_service.get_realtime_metrics()


@router.get("/timeline")
async def get_timeline_history():
    """Returns the full historical dataset of all processed jobs."""
    return engine_manager.event_store.get_all_jobs()


@router.get("/timeline/{job_id}")
async def get_job_replay(job_id: int):
    """Replay payload for a single request lifecycle."""
    job = engine_manager.event_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    stages = [
        "CREATED",
        "QUEUED",
        "SCHEDULED",
        "WORKER_ASSIGNED",
        "MEMORY_ALLOCATED",
        "INFERENCE_STARTED",
        "CACHE_UPDATED",
        "COMPLETED",
    ]
    by_stage = {e["stage"]: e for e in job.get("events", [])}
    pipeline = []
    for s in stages:
        ev = by_stage.get(s)
        pipeline.append({
            "stage": s,
            "present": ev is not None,
            "timestamp": ev["timestamp"] if ev else None,
            "details": ev["details"] if ev else None,
            "interview": STAGE_INTERVIEW.get(s),
        })
    return {
        "job": job,
        "pipeline": pipeline,
        "decision": job.get("decision"),
    }


@router.get("/decisions")
async def get_decisions(limit: int = 50):
    """Runtime Decision Engine history with structured explainability."""
    return {
        "latest": decision_engine.last().to_dict() if decision_engine.last() else None,
        "history": decision_engine.history(limit),
    }


@router.get("/interview/policies")
async def interview_policies():
    return POLICY_INTERVIEW


@router.get("/interview/stages")
async def interview_stages():
    return STAGE_INTERVIEW


@router.get("/interview/{topic}")
async def interview_topic(topic: str):
    key = topic.upper() if topic.upper() in STAGE_INTERVIEW else topic
    if key in POLICY_INTERVIEW:
        return {"kind": "policy", "name": key, **POLICY_INTERVIEW[key]}
    if key in STAGE_INTERVIEW:
        return {"kind": "stage", "name": key, **STAGE_INTERVIEW[key]}
    # case-insensitive policy match
    for name, data in POLICY_INTERVIEW.items():
        if name.lower() == topic.lower():
            return {"kind": "policy", "name": name, **data}
    raise HTTPException(status_code=404, detail="Unknown interview topic")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            metrics = metrics_service.get_realtime_metrics()
            await websocket.send_json(metrics)
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    except Exception:
        websocket_manager.disconnect(websocket)


@router.post("/benchmark")
async def run_benchmark():
    return await benchmark_engine.run_scheduler_comparison(100)


@router.post("/simulate_job")
async def simulate_job(priority: int = 1, vram_required: int = 32, is_batch: bool = False, type: str = "Medium"):
    try:
        job_id = engine_manager.submit_job(priority, vram_required, is_batch, type)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"job_id": job_id, "status": "QUEUED"}


@router.post("/control/{action}")
async def runtime_control(action: str):
    """Start, stop, or restart the inference runtime."""
    action = action.lower()
    if action == "start":
        return engine_manager.start()
    if action == "stop":
        return engine_manager.stop()
    if action == "restart":
        return engine_manager.restart()
    raise HTTPException(status_code=400, detail="action must be start, stop, or restart")


@router.post("/mode/{mode}")
async def set_mode(mode: str):
    engine_manager.set_mode(mode)
    return {"status": f"Switched to {mode} mode"}


@router.post("/policy/{policy}")
async def set_policy(policy: str):
    engine_manager.set_policy(policy)
    return {"status": f"Switched scheduler policy to {policy}"}
