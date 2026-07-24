import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import inference, settings, metrics
from database.db import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cerebrum_ingress")

app = FastAPI(
    title="CerebrumOS API Gateway", 
    description="Production AI Infrastructure Platform (FastAPI Ingress)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach routes
app.include_router(inference.router)
app.include_router(settings.router)
app.include_router(metrics.router)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing SQLite databases...")
    init_db()
    logger.info("CerebrumOS Ingress ready. Listening for inference requests.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
