# Build benchmark CLI (TypeScript → JavaScript + workspace deps).
FROM node:25-bookworm-slim AS benchmark-build

WORKDIR /benchmark

COPY benchmark/ ./

# Yarn 4 is vendored in .yarn/releases (corepack is not in node:25-bookworm-slim).
RUN node .yarn/releases/yarn-4.12.0.cjs install --immutable && \
    node .yarn/releases/yarn-4.12.0.cjs run tsbuild

FROM python:3.11-slim

WORKDIR /app

# Node.js runtime for Celery benchmark subprocess (CLI is invoked via `node`).
COPY --from=benchmark-build /usr/local/bin/node /usr/local/bin/node

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl libstdc++6 libatomic1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Dockerfile build context is child-safety-evals/ (server + benchmark).
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ ./

COPY --from=benchmark-build /benchmark ./benchmark/

RUN find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find . -type f -name "*.pyc" -delete 2>/dev/null || true

ENV FIREBASE_CREDS_PATH=/app/firebase-credentials.json

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
