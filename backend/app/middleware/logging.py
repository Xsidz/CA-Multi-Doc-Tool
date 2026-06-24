from __future__ import annotations

import json
import logging
import time
from typing import Callable, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("statutorysync")

if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger.setLevel(logging.INFO)


def _token_prefix(authorization: Optional[str]) -> Optional[str]:
    """Return first 8 chars of token for tracing — never the full value."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    return token[:8] + "..." if len(token) > 8 else None


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.monotonic()
        auth = request.headers.get("Authorization")
        has_token = _token_prefix(auth) is not None
        response = await call_next(request)
        logger.info(json.dumps({
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round((time.monotonic() - start) * 1000, 2),
            "has_token": has_token,
        }))
        return response


StructuredLoggingMiddleware = LoggingMiddleware
