from fastapi import APIRouter, Depends
from pydantic import BaseModel
from services.inference_service import InferenceService

router = APIRouter(prefix="/v1/inference", tags=["Inference Engine"])

class InferenceRequest(BaseModel):
    prompt_tokens: list[int]
    max_tokens: int

# Dependency Injection for Clean Architecture
def get_inference_service():
    return InferenceService()

@router.post("/completions")
async def generate(req: InferenceRequest, service: InferenceService = Depends(get_inference_service)):
    req_id = await service.submit_request(req.prompt_tokens, req.max_tokens)
    return {"request_id": req_id, "status": "QUEUED_MLFQ"}
