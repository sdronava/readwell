# Document Conversion Service

Converts ePUB files into a structured, reader-friendly JSON package consumed by the Readwell frontend. Runs as an **async background worker** in production (polling the database for conversion jobs) and as a **standalone CLI** for local development and testing.

---

## Table of Contents

1. [How it works](#how-it-works)
2. [Output package format](#output-package-format)
3. [Project structure](#project-structure)
4. [Local development](#local-development)
5. [CLI reference](#cli-reference)
6. [Running tests](#running-tests)
7. [Docker](#docker)
8. [Environment variables](#environment-variables)

---

## How it works

```
ePUB file
  │
  ├─ [EpubParser]         Extract metadata, spine, images, TOC
  │
  ├─ [BlockBuilder]       Parse each spine item's HTML → typed blocks
  │                       (paragraph / heading / code / list / image)
  │
  ├─ [ContentSegmenter]   Split blocks into pages
  │                       • h1/h2 headings always start a new page
  │                       • blocks are never split mid-element
  │
  ├─ [AssetManager]       Save images + generate responsive WebP variants
  │                       (400w / 800w / 1200w) and thumbnails
  │
  ├─ [PackageBuilder]     Write output package to books/{bookId}/
  │
  └─ [PackageValidator]   Verify structure, JSON integrity, and image refs
```

In **production**, the worker polls `conversion_jobs` for `status='queued'` rows (using `SELECT FOR UPDATE SKIP LOCKED`), runs the pipeline above, then updates the job and book status in the database.

In **development**, the CLI runs the same pipeline directly against a local file with no database interaction.

---

## Output package format

```
books/{bookId}/
├── metadata.json          # Title, author, language, cover path, page count, …
├── manifest.json          # Spine order + page index (source chapter per page)
├── chapters.json          # Table of contents
├── pages/
│   ├── page_001.json      # Structured blocks for page 1
│   ├── page_002.json
│   └── …
└── assets/
    └── images/
        ├── cover.jpg
        ├── cover_thumb.webp
        ├── fig_1_1.png
        ├── fig_1_1_400w.webp
        ├── fig_1_1_800w.webp
        └── …
```

Each `page_NNN.json` contains a `blocks` array:

```json
{
  "bookId": "…",
  "pageNum": 5,
  "chapter": "Chapter 1: Introduction",
  "section": "Getting Started",
  "estimatedReadingTimeSeconds": 180,
  "blocks": [
    { "type": "heading", "level": 2, "text": "Getting Started" },
    { "type": "paragraph", "text": "Lorem ipsum…",
      "emphasis": [{ "start": 6, "end": 11, "style": "bold" }] },
    { "type": "image", "filename": "assets/images/fig_1_1.png",
      "caption": "Figure 1.1", "altText": "…",
      "srcset": { "original": "…", "400w": "…", "800w": "…" } },
    { "type": "code", "language": "python", "text": "def greet(name): …" },
    { "type": "list", "ordered": false, "items": ["Item A", "Item B"] }
  ]
}
```

---

## Project structure

```
document_converter/          # Python package (importable module)
│
├── config.py                # Environment variable config
├── db.py                    # Job/book status updates (SQLAlchemy)
├── storage.py               # Local FS / S3 abstraction
├── converter.py             # DocumentConverter — pipeline orchestrator
├── worker.py                # Async DB-polling worker (production entry point)
├── main.py                  # Click CLI (dev/testing — no DB interaction)
│
├── parsers/
│   └── epub_parser.py       # Metadata, spine, images, TOC via ebooklib
│
├── processors/
│   ├── block_builder.py     # HTML → structured content blocks
│   ├── content_segmenter.py # Semantic-aware pagination
│   └── asset_manager.py     # Image resizing, WebP conversion, thumbnails
│
├── output/
│   └── package_builder.py   # Writes all JSON output files
│
├── validation/
│   └── validator.py         # Package structure + image-ref validation
│
└── utils/
    └── logger.py            # Logging setup

tests/
├── fixtures/                # Place sample ePUBs here for integration tests
├── test_block_builder.py
├── test_epub_parser.py
├── test_segmenter.py
└── test_validator.py

Dockerfile
docker-compose.yml
pyproject.toml               # uv project — replaces requirements.txt + setup.py
uv.lock
```

---

## Local development

### Prerequisites

- [uv](https://docs.astral.sh/uv/) — Python package manager
- Python 3.10+

### Install dependencies

```bash
cd backend/services/document_converter
uv sync --group dev
```

This creates a `.venv` and installs all production and dev dependencies from `uv.lock`.

### Convert an ePUB (CLI)

```bash
# Basic — writes to ./books/<book-id>/
uv run document-converter convert path/to/book.epub

# With explicit book ID and output directory
uv run document-converter convert path/to/book.epub \
    --book-id my-book \
    --output-dir ./books/ \
    --verbose

# Dry run — parses only, writes nothing
uv run document-converter convert path/to/book.epub --dry-run

# Produce a zip archive instead of a directory
uv run document-converter convert path/to/book.epub --format zip
```

### Python API

```python
from document_converter import DocumentConverter

result = DocumentConverter().convert(
    input_path="./book.epub",
    output_dir="./books/",
    book_id="book_001",
    page_length=500,
)
# result = {"status": "success", "book_id": "book_001", "pages": 350, …}
```

---

## CLI reference

```
document-converter convert [OPTIONS] INPUT_PATH

Arguments:
  INPUT_PATH          Path to the input ePUB file.

Options:
  -o, --output-dir    Output directory.              [default: ./books/]
  -b, --book-id       Book identifier (UUID).        [default: auto-generated]
  -p, --page-length   Target words per page.         [default: 500]
  -f, --format        json | zip | both.             [default: json]
  --extract-images / --no-extract-images             [default: on]
  --generate-thumbnails / --no-generate-thumbnails   [default: on]
  --validate / --no-validate                         [default: on]
  -v, --verbose       Enable DEBUG logging.
  --dry-run           Parse only; write nothing.
  --help
```

---

## Running tests

### Locally

```bash
cd backend/services/document_converter
uv run pytest tests/ -v
```

Unit tests run without any external dependencies. Integration tests in
`test_epub_parser.py` require a sample ePUB at
`tests/fixtures/simple.epub` — they are automatically **skipped** when
no fixture files are present.

To enable integration tests, copy a sample ePUB into `tests/fixtures/`:

```bash
cp /path/to/book.epub tests/fixtures/simple.epub
```

### With coverage

```bash
uv run pytest tests/ --cov=document_converter --cov-report=term-missing
```

---

## Docker

### Build images

```bash
cd backend/services/document_converter

# Test image (runs pytest as default CMD)
docker build --target test -t document-converter:test .

# Production image (runs the async worker)
docker build --target production -t document-converter:prod .
```

### Run tests in Docker

```bash
docker run --rm document-converter:test
```

Expected output: all unit tests pass; integration tests are skipped
(no ePUB fixture files in the image).

To run integration tests, mount your fixtures directory:

```bash
docker run --rm \
  -v /path/to/pubs:/app/tests/fixtures:ro \
  document-converter:test
```

### Run the CLI in Docker

```bash
docker run --rm \
  -v /path/to/epubs:/epubs:ro \
  -v /path/to/output:/books \
  document-converter:prod \
  python -m document_converter.main convert /epubs/book.epub -o /books/ -v
```

### Dev stack (worker + PostgreSQL)

```bash
docker compose up
```

This starts:
- `db` — PostgreSQL 16 on port `5432` (credentials: `readwell` / `readwell_dev`)
- `worker` — conversion worker connected to the database

The worker polls for queued jobs every 5 seconds. Use the main API service
to create books and enqueue conversion jobs.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DB_URL` | *(required for worker)* | PostgreSQL connection string, e.g. `postgresql+psycopg2://user:pass@host/db` |
| `STORAGE_BACKEND` | `local` | `local` or `s3` |
| `BOOKS_OUTPUT_DIR` | `./books/` | Root directory for output packages (local storage) |
| `S3_BUCKET` | — | S3 bucket name (when `STORAGE_BACKEND=s3`) |
| `POLL_INTERVAL_SECONDS` | `5` | How often the worker polls for new jobs |
| `CONTENT_BASE_URL` | — | Base URL for CDN / static file server (returned to frontend) |

### Example worker invocation

```bash
DB_URL="postgresql+psycopg2://readwell:readwell_dev@localhost:5432/readwell" \
STORAGE_BACKEND=local \
BOOKS_OUTPUT_DIR=./books/ \
uv run python -m document_converter.worker
```
