# Readwell

An enhanced, immersive e-reader for technical books and documents. Readwell goes beyond a standard e-reader by adding synchronized text-to-speech with word highlighting, support for rich content (code blocks, diagrams, tables, formulas), and a future roadmap for AI-generated multimedia explanations.

The platform operates as an **open, curated library** — only freely available works (public domain, Creative Commons, or author-donated titles) are hosted. Authors and publishers upload books for admin review; once approved, they appear in the shared catalog available to all readers.

---

## Repository layout

```
readwell/
├── backend/
│   └── services/
│       ├── document_converter/   # ePUB → JSON package (async worker + CLI)
│       └── content_gateway/      # REST API serving the book catalog and pages
├── frontend/                     # React 18 reader app
├── specs/                        # Design documents and implementation plans
│   ├── Project.md                # Goals and major features
│   ├── Proposal.md               # Architecture proposal (microservices, 4-phase roadmap)
│   ├── Phase1-MVP.md             # Phase 1 detailed plan (API spec, DB schema, sprints)
│   ├── DocumentConversionService.md
│   └── ReadBook.md               # Local testing plan for Scenario 4 (Reader Opens Book)
├── books/                        # Converted book packages (gitignored)
└── pubs/                         # Source ePUB files (gitignored)
```

---

## Architecture

Readwell is built as a set of loosely coupled microservices that can be developed and deployed independently.

```
                     ┌────────────────────┐
  Upload ePUB        │ Document Converter  │  ePUB → structured JSON package
  ─────────────────► │ (async worker)      │  (pages, blocks, images)
                     └────────┬───────────┘
                              │ writes books/{bookId}/
                              ▼
                     ┌────────────────────┐
                     │  S3 / CDN          │  serves page JSON + image assets
                     └────────┬───────────┘
                              │ cdnBaseUrl
                     ┌────────▼───────────┐
  Browser ◄──────── │ Content Gateway API │  catalog, metadata, progress, auth
                     └────────────────────┘
```

**Local development** replaces S3/CDN with `python -m http.server` and the gateway runs in `LOCAL_MODE` reading directly from the filesystem — no database required.

### Services

| Service | Language / Framework | Status |
|---|---|---|
| Document Conversion Service | Python / uv, ebooklib, Pillow | ✅ Implemented |
| Content Gateway API | Python / FastAPI, pydantic-settings | ✅ Implemented |
| React Frontend | TypeScript / React 18, Vite, Tailwind CSS | ✅ Implemented |
| User Management Service | — | Phase 2 |
| TTS Service (backend) | — | Phase 2 (Phase 1 uses browser Web Speech API) |
| Multimedia Explanation Service | — | Phase 2 |

---

## Document Conversion Service

**Path:** `backend/services/document_converter/`

Converts ePUB files into a structured, reader-friendly JSON package. Runs as an async background worker in production (polling a PostgreSQL `conversion_jobs` table) and as a CLI for local development.

### Pipeline

```
ePUB → EpubParser → BlockBuilder → ContentSegmenter → AssetManager → PackageBuilder → PackageValidator
```

### Output format

```
books/{bookId}/
├── metadata.json          # title, author, language, cover, page count
├── manifest.json          # spine order + page index
├── chapters.json          # table of contents
├── pages/
│   ├── page_001.json      # blocks[] array for each page
│   └── …
└── assets/images/
    ├── cover.png
    ├── fig_1_1.png
    ├── fig_1_1_400w.webp   # responsive WebP variants
    └── …
```

Each `page_NNN.json` contains a `blocks` array of typed content elements: `heading`, `paragraph` (with character-range emphasis), `code`, `list`, and `image` (with `srcset`).

### Quickstart

```bash
cd backend/services/document_converter
uv sync --group dev
uv run document-converter convert /path/to/book.epub --verbose
```

### Tests

```bash
uv run pytest tests/ -v          # 70 unit tests
docker build --target test -t document-converter:test .
docker run --rm document-converter:test
```

See [backend/services/document_converter/README.md](backend/services/document_converter/README.md) for the full CLI reference, Docker instructions, and environment variables.

---

## Content Gateway API

**Path:** `backend/services/content_gateway/`

FastAPI service that serves the book catalog and page data to the frontend. In `LOCAL_MODE` it reads directly from the `books/` directory with no database; in production it queries PostgreSQL.

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/v1/books` | List all books in the catalog |
| GET | `/api/v1/books/{id}/metadata` | Book metadata + `cdnBaseUrl` + TOC |
| GET | `/api/v1/books/{id}/chapters` | Table of contents |
| GET | `/api/v1/books/{id}/pages/{n}` | Page content (blocks array) |

The gateway returns a `cdnBaseUrl` with every metadata response. The frontend constructs all asset URLs as `${cdnBaseUrl}/${srcset_path}`, which works identically in local development (static file server) and production (CloudFront).

### Quickstart

All paths are relative to the **project root** (`readwell/`):

```bash
# Install deps (once)
cd backend/services/content_gateway && uv sync --group dev && cd -

# Launch (from project root)
LOCAL_MODE=true BOOKS_DIR=./books CONTENT_BASE_URL=http://localhost:9000 \
  uv run --project backend/services/content_gateway \
  uvicorn content_gateway.main:app --port 8000 --reload
```

### Tests

```bash
uv run pytest tests/ -v          # 10 unit tests
```

---

## React Frontend

**Path:** `frontend/`

React 18 + TypeScript reader app built with Vite and Tailwind CSS.

### Views

| View | Route | Description |
|---|---|---|
| `LibraryView` | `/` | Responsive book grid — cover, title, author, "Read" button |
| `ReaderView` | `/books/:bookId` | Page reader with navigation, TOC sidebar, TTS |

### Block rendering

`BlockRenderer` handles all five content block types produced by the conversion pipeline:

- **heading** — `h1`–`h6` with appropriate Tailwind sizing
- **paragraph** — plain text with character-range bold/italic via `EmphasisText`
- **code** — monospace block with language class for syntax highlighting
- **list** — ordered or unordered
- **image** — responsive `<img srcSet>` loading WebP variants from the CDN/static server

### TTS

The `useTTS` hook uses `window.speechSynthesis` with `boundary` events to track the current word position. The reader view sets `aria-live="off"` on the content area while TTS is active to prevent screen-reader conflicts.

### Quickstart

```bash
cd frontend
npm install
npm run dev        # starts at http://localhost:5173
```

The `.env.local` file (gitignored) configures the gateway URL:

```
VITE_GATEWAY_URL=http://localhost:8000
```

---

## Running the full local stack

Open three terminals, all starting from the **project root** (`readwell/`):

```bash
# Terminal 1 — Static file server (CDN simulation)
python -m http.server 9000 --directory books

# Terminal 2 — Content Gateway API
LOCAL_MODE=true BOOKS_DIR=./books CONTENT_BASE_URL=http://localhost:9000 \
  uv run --project backend/services/content_gateway \
  uvicorn content_gateway.main:app --port 8000 --reload

# Terminal 3 — React frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The library will list any book package present in the `books/` directory.

The gateway prints its resolved `BOOKS_DIR` and book count at startup — check Terminal 2 to confirm it found your books.

### Convert a book for local testing

```bash
# From project root
LOCAL_MODE=true uv run --project backend/services/document_converter \
  document-converter convert /path/to/book.epub \
  --output-dir ./books/ \
  --verbose
```

---

## Prerequisites

- [uv](https://docs.astral.sh/uv/) — Python package manager (`brew install uv`)
- Python 3.10+
- Node.js 18+ and npm

---

## Specs

| Document | Description |
|---|---|
| [specs/Project.md](specs/Project.md) | High-level goals and major features |
| [specs/Proposal.md](specs/Proposal.md) | Full architecture proposal (microservices, tech stack, 4-phase roadmap) |
| [specs/Phase1-MVP.md](specs/Phase1-MVP.md) | Phase 1 detailed plan (sprints, API spec, DB schema) |
| [specs/DocumentConversionService.md](specs/DocumentConversionService.md) | Document Conversion Service design |
| [specs/ReadBook.md](specs/ReadBook.md) | Local testing plan for Scenario 4 (Reader Opens Book) |
