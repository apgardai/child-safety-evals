FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl nodejs && \
    rm -rf /var/lib/apt/lists/*

# This Dockerfile is built with the repo root as context so server + benchmark
# are both available in the runtime image.
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./
COPY benchmark/ ./benchmark/

RUN find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find . -type f -name "*.pyc" -delete 2>/dev/null || true

ENV FIREBASE_CREDS_PATH=/app/firebase-credentials.json

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
