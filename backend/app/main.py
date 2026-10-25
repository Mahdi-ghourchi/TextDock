from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionFactory, get_session
from app.limits import RequestBodyLimit
from app.routes.shares import router as shares_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TextDock API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(RequestBodyLimit, limit_bytes=6_100_000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Revoke-Capability"],
    )
    app.include_router(shares_router)

    @app.get("/health/live", tags=["health"])
    def liveness() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    def readiness() -> dict[str, str]:
        session: Session = SessionFactory()
        try:
            session.execute(text("SELECT 1"))
        except SQLAlchemyError:
            session.rollback()
            raise HTTPException(status_code=503, detail="Database is not ready.") from None
        finally:
            session.close()
        return {"status": "ok"}

    return app


app = create_app()
