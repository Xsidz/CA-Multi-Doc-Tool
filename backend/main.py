from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, parse, export, composio_router, razorpay_router
from app.middleware.logging import LoggingMiddleware

settings = get_settings()

app = FastAPI(
    title="StatutorySync API",
    version="1.0.0",
    description="Statutory dues PDF parsing and export API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

app.include_router(health.router)
app.include_router(parse.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(composio_router.router, prefix="/api/v1")
app.include_router(razorpay_router.router, prefix="/api/v1")
