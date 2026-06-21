import json
import os
import time
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
CORS(app)

# ── Prometheus metrics ──────────────────────────────────────────
REQUEST_COUNT = Counter(
    "careerlens_requests_total",
    "Total requests to /analyze",
    ["status"]
)
REQUEST_LATENCY = Histogram(
    "careerlens_request_duration_seconds",
    "Time spent processing /analyze"
)

# ── OpenRouter config ───────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_CANDIDATES = [
    os.getenv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free"),
    "google/gemma-4-26b-a4b-it:free",
]


def build_prompt(cv_text: str, skills: str) -> str:
    return f"""You are a senior tech career advisor. Analyze the CV and skills below and respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.

CV TEXT:
{cv_text}

CURRENT SKILLS:
{skills}

Return this exact JSON structure:
{{
  "career_paths": [
    {{"title": "Role name", "match": 85, "reason": "One sentence why this fits"}},
    {{"title": "Role name", "match": 72, "reason": "One sentence why this fits"}},
    {{"title": "Role name", "match": 60, "reason": "One sentence why this fits"}}
  ],
  "skill_gaps": [
    {{"skill": "Skill name", "priority": "High"}},
    {{"skill": "Skill name", "priority": "Medium"}},
    {{"skill": "Skill name", "priority": "Low"}}
  ],
  "roadmap": [
    {{"week": "Week 1-2", "focus": "Topic to study", "resources": "Recommended resource"}},
    {{"week": "Week 3-4", "focus": "Topic to study", "resources": "Recommended resource"}},
    {{"week": "Week 5-8", "focus": "Topic to study", "resources": "Recommended resource"}},
    {{"week": "Week 9-12", "focus": "Topic to study", "resources": "Recommended resource"}}
  ]
}}"""


def call_openrouter(prompt: str) -> dict:
    last_error = None

    for model in MODEL_CANDIDATES:
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-OpenRouter-Title": "CareerLens"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1000,
                    "temperature": 0.3
                },
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as exc:
            last_error = f"{model}: timed out"
        except requests.exceptions.RequestException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            last_error = f"{model}: {exc}"
            if status_code not in {429, 500, 502, 503, 504, None}:
                break

    raise RuntimeError(last_error or "OpenRouter request failed")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/metrics", methods=["GET"])
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}


@app.route("/analyze", methods=["POST"])
def analyze():
    start = time.time()

    if not OPENROUTER_API_KEY:
        REQUEST_COUNT.labels(status="error").inc()
        return jsonify({"error": "OPENROUTER_API_KEY is not configured"}), 500

    data = request.get_json(silent=True) or {}
    cv_text = (data.get("cv_text") or "").strip()
    skills = (data.get("skills") or "").strip()

    if not cv_text or not skills:
        REQUEST_COUNT.labels(status="error").inc()
        return jsonify({"error": "cv_text and skills are required"}), 400

    prompt = build_prompt(cv_text, skills)

    try:
        raw = call_openrouter(prompt)
    except RuntimeError as exc:
        message = str(exc)
        REQUEST_COUNT.labels(status="error").inc()
        if "timed out" in message:
            return jsonify({"error": "LLM request timed out. Try again."}), 504
        return jsonify({"error": f"OpenRouter error: {message}"}), 502

    try:
        content = raw["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, AttributeError, TypeError):
        REQUEST_COUNT.labels(status="error").inc()
        return jsonify({"error": "Unexpected response from OpenRouter"}), 502

    # Strip markdown fences if model wraps output in ```json ... ```
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        REQUEST_COUNT.labels(status="error").inc()
        return jsonify({"error": "Model returned invalid JSON. Try again."}), 500

    duration = time.time() - start
    REQUEST_LATENCY.observe(duration)
    REQUEST_COUNT.labels(status="success").inc()

    return jsonify(result), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
