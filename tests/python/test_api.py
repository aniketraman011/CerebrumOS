import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to sys.path for absolute imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))
from main import app

client = TestClient(app)

def test_inference_endpoint():
    response = client.post(
        "/v1/inference/completions",
        json={"prompt_tokens": [101, 2034, 401], "max_tokens": 50}
    )
    assert response.status_code == 200
    data = response.json()
    assert "request_id" in data
    assert data["status"] == "QUEUED_MLFQ"

def test_inference_invalid_payload():
    response = client.post(
        "/v1/inference/completions",
        json={"wrong_key": [101, 2034, 401]}
    )
    assert response.status_code == 422  # Validation Error
