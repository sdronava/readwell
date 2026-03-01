# ──────────────────────────────────────────────────────────────────────────────
# base — Python + system libs + uv + production dependencies
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

WORKDIR /app

# System libraries required by Pillow (WebP, JPEG) and lxml (XML/XSLT)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libwebp-dev \
        libjpeg-dev \
        libxml2 \
        libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

# Install uv from the official distroless image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency manifest and lockfile first so this layer is cached
# as long as deps don't change.
COPY pyproject.toml uv.lock ./

# Install production dependencies into the project virtualenv.
# --frozen   : never update the lockfile
# --no-dev   : skip pytest / coverage
# --no-install-project : deps only; we copy source separately so edits
#              don't bust the dep-install layer
RUN uv sync --frozen --no-dev --no-install-project

# Copy source package
COPY document_converter/ ./document_converter/

# Install the project itself (editable-free, into the already-populated venv)
RUN uv sync --frozen --no-dev

# Put the virtualenv's bin on PATH so plain `python` / `document-converter` work
ENV PATH="/app/.venv/bin:$PATH"

# ──────────────────────────────────────────────────────────────────────────────
# test — adds dev deps + test files; runs pytest
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS test

# Install dev dependencies (pytest, pytest-cov) on top of prod deps
RUN uv sync --frozen

COPY tests/ ./tests/

# Integration tests look for sample ePUBs that won't be present in the image;
# they are skipped automatically via pytest.mark.skipif.
CMD ["pytest", "tests/", "-v", "--tb=short"]

# ──────────────────────────────────────────────────────────────────────────────
# production — minimal worker image
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS production

# Required environment variables (supply via docker-compose or -e flags):
#   DB_URL                 postgresql+psycopg2://user:pass@host/db
#   STORAGE_BACKEND        local | s3
#   BOOKS_OUTPUT_DIR       /books
#   POLL_INTERVAL_SECONDS  5

ENTRYPOINT ["python", "-m", "document_converter.worker"]
