# ── Stage 1: Build dependencies ──────────────────────────────────────────────
# Use slim image, install only what's needed, no test deps
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system deps needed to compile Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install production deps only (exclude test packages)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir \
        --prefix=/install \
        $(grep -v "^pytest\|^pytest-asyncio" requirements.txt)


# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Runtime system deps only (pdfplumber needs these)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# HF Spaces runs as user 1000 — set permissions
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER 1000

# HF Spaces exposes port 7860
EXPOSE 7860

# Health check — used by keep-alive cron
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health')"

# Start uvicorn — single worker for free tier RAM constraints
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "7860", \
     "--workers", "1", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--timeout-keep-alive", "30"]
