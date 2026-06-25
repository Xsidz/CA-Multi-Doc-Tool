"""Application settings loaded from environment variables / .env file."""
from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Supabase ────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    # ── Razorpay ────────────────────────────────────────────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # ── OpenRouter (AI parser) ───────────────────────────────────────────────
    openrouter_api_key: str = ""
    openrouter_text_model: str = "qwen/qwen2.5-7b-instruct"
    openrouter_vision_model: str = "qwen/qwen2.5-vl-7b-instruct"

    # ── Composio ────────────────────────────────────────────────────────────
    composio_api_key: str = ""

    # ── App ─────────────────────────────────────────────────────────────────
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"

    # ── Limits ──────────────────────────────────────────────────────────────
    max_file_size_mb: int = 10
    max_files_per_request: int = 20

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
