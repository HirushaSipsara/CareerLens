import json
import sys
import os

# Ensure the backend/ root is on the path so `from app import app` works
# regardless of where pytest is invoked from.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, MagicMock
from app import app as flask_app


# ── Fixtures ────────────────────────────────────────────────────

@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as client:
        yield client


# ── Health endpoint ─────────────────────────────────────────────

def test_health(client):
    rv = client.get("/health")
    assert rv.status_code == 200
    data = rv.get_json()
    assert data == {"status": "ok"}


# ── Metrics endpoint ─────────────────────────────────────────────

def test_metrics(client):
    rv = client.get("/metrics")
    assert rv.status_code == 200
    assert b"careerlens_requests_total" in rv.data


# ── /analyze validation ──────────────────────────────────────────

def test_analyze_missing_body(client):
    rv = client.post("/analyze", content_type="application/json", data="{}")
    assert rv.status_code == 400
    assert "required" in rv.get_json()["error"].lower()


def test_analyze_missing_cv_text(client):
    rv = client.post(
        "/analyze",
        content_type="application/json",
        data=json.dumps({"skills": "Python"})
    )
    assert rv.status_code == 400


def test_analyze_missing_skills(client):
    rv = client.post(
        "/analyze",
        content_type="application/json",
        data=json.dumps({"cv_text": "Some CV"})
    )
    assert rv.status_code == 400


# ── /analyze missing API key ─────────────────────────────────────

def test_analyze_no_api_key(client):
    with patch("app.OPENROUTER_API_KEY", None):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Some CV", "skills": "Python"})
        )
    assert rv.status_code == 500
    assert "OPENROUTER_API_KEY" in rv.get_json()["error"]


# ── /analyze success (mocked OpenRouter) ────────────────────────

MOCK_RESULT = {
    "career_paths": [
        {"title": "Backend Engineer", "match": 90, "reason": "Strong Python skills"},
        {"title": "DevOps Engineer", "match": 75, "reason": "Docker experience"},
        {"title": "ML Engineer", "match": 60, "reason": "Data skills"},
    ],
    "skill_gaps": [
        {"skill": "Kubernetes", "priority": "High"},
        {"skill": "Terraform", "priority": "Medium"},
    ],
    "roadmap": [
        {"week": "Week 1-2", "focus": "Kubernetes basics", "resources": "k8s.io docs"},
    ]
}


def test_analyze_success(client):
    mock_response = {
        "choices": [{"message": {"content": json.dumps(MOCK_RESULT)}}]
    }

    with patch("app.call_openrouter", return_value=mock_response):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Python dev 3 years", "skills": "Python, Flask"})
        )

    assert rv.status_code == 200
    result = rv.get_json()
    assert "career_paths" in result
    assert "skill_gaps" in result
    assert "roadmap" in result
    assert len(result["career_paths"]) == 3


def test_analyze_success_strips_markdown_fences(client):
    """Model wraps output in ```json ... ``` fences — should be stripped correctly."""
    fenced_content = f"```json\n{json.dumps(MOCK_RESULT)}\n```"
    mock_response = {
        "choices": [{"message": {"content": fenced_content}}]
    }

    with patch("app.call_openrouter", return_value=mock_response):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Python dev 3 years", "skills": "Python, Flask"})
        )

    assert rv.status_code == 200
    assert "career_paths" in rv.get_json()


# ── /analyze error paths ─────────────────────────────────────────

def test_analyze_openrouter_timeout(client):
    with patch("app.call_openrouter", side_effect=RuntimeError("model: timed out")):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Some CV", "skills": "Python"})
        )
    assert rv.status_code == 504


def test_analyze_openrouter_error(client):
    with patch("app.call_openrouter", side_effect=RuntimeError("model: HTTP 429 — rate limit")):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Some CV", "skills": "Python"})
        )
    assert rv.status_code == 502


def test_analyze_invalid_json_from_model(client):
    mock_response = {
        "choices": [{"message": {"content": "This is not JSON at all"}}]
    }
    with patch("app.call_openrouter", return_value=mock_response):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Some CV", "skills": "Python"})
        )
    assert rv.status_code == 500
    assert "invalid JSON" in rv.get_json()["error"]


def test_analyze_unexpected_openrouter_shape(client):
    """OpenRouter returns a response missing 'choices' key."""
    with patch("app.call_openrouter", return_value={}):
        rv = client.post(
            "/analyze",
            content_type="application/json",
            data=json.dumps({"cv_text": "Some CV", "skills": "Python"})
        )
    assert rv.status_code == 502
