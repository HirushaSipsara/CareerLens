from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def index():
    return jsonify({"message": "Hello from CareerLens Backend"})


@app.route("/analyze", methods=["POST"])
def analyze():
    return jsonify({"status": "success", "recommendations": []})


@app.route("/metrics")
def metrics():
    return "careerlens_metrics 1"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
