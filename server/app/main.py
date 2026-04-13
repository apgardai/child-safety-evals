from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.internal import router as internal_router
from app.services.database import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Child Safety Evals API", lifespan=lifespan)

# Intended for server-to-server calls from the Next.js app only (not exposed to browsers).

app.include_router(internal_router, prefix="/internal", tags=["internal"])


@app.get("/")
def root():
    return {"service": "child-safety-evals-api", "docs": "/docs"}
