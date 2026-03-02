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
| React Frontend | TypeScript / React 19, Vite, Tailwind CSS | ✅ Implemented |
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
uv run pytest tests/ -v          # 74 unit tests
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

```bash
# Install deps (once)
cd backend/services/content_gateway && uv sync --group dev

# Launch — reads config from .env in the same directory
uv run uvicorn content_gateway.main:app --port 8000 --reload
```

Configuration lives in `backend/services/content_gateway/.env`:

```
BOOKS_DIR=../../../books
CONTENT_BASE_URL=http://localhost:9000
```

### Tests

```bash
uv run pytest tests/ -v          # 10 unit tests
```

---

## React Frontend

**Path:** `frontend/`

React 19 + TypeScript reader app built with Vite 7 and Tailwind CSS 3. Self-hosted Inter (UI) and Lora (reading) fonts via `@fontsource` — no external CDN requests.

### Views

| View | Route | Description |
|---|---|---|
| `LibraryView` | `/` | Responsive book grid with search, skeleton loading, dark mode toggle |
| `ReaderView` | `/books/:bookId` | Full reader — navigation, TOC sidebar, font/size controls, TTS |

### Design system

- **Dark mode** — `darkMode: 'class'` strategy; preference persisted to `localStorage`
- **Typography** — Inter for UI, Lora for reading content (user-switchable); 4 font-size presets (S / M / L / XL)
- **Design tokens** — `brand` and `surface` color palettes defined in `tailwind.config.js`
- **Loading skeletons** — animated `SkeletonCard` and `SkeletonPage` replace bare "Loading…" text
- **Focus states** — global `focus-visible` ring using `brand-500`

See [specs/UIDesign.md](specs/UIDesign.md) for the full design system reference.

### Block rendering

`BlockRenderer` handles all five content block types produced by the conversion pipeline:

- **heading** — `h1`–`h6` with appropriate sizing; TTS word cursor support
- **paragraph** — bold/italic emphasis plus moving TTS word highlight via `EmphasisText`
- **code** — monospace, scrollable, dark-mode aware
- **list** — ordered or unordered
- **image** — responsive `<img srcSet>` loading WebP variants from the CDN/static server

### TTS

The `useTTS` hook drives the browser Web Speech API (`window.speechSynthesis`) — zero backend cost, works on desktop and mobile browsers. Features:

- **Speed control** — 0.75×, 1×, 1.5×, 2× picker; default 1×
- **Karaoke-style word cursor** — `boundary` events resolve each word's character range; `EmphasisText` renders a moving yellow highlight exactly on the current word, compatible with bold/italic runs
- **Click-to-read** — click any paragraph or heading to start TTS from that point
- **Auto-page-turn** — when TTS finishes the last paragraph it advances to the next page and resumes automatically; toggle in the TTS controls
- **Auto-scroll** — the viewport keeps the active paragraph centered; smooth animation at ≤1× speed, instant snap at faster speeds to avoid lag
- **Accessibility** — `aria-live="off"` on the content area while TTS is active; a visible status banner informs screen-reader users

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

# Terminal 2 — Content Gateway API  (reads config from backend/services/content_gateway/.env)
cd backend/services/content_gateway && \
  uv run uvicorn content_gateway.main:app --port 8000 --reload

# Terminal 3 — React frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The library will list any book package present in the `books/` directory.

The gateway prints its resolved `BOOKS_DIR` and book count at startup — check Terminal 2 to confirm it found your books.

### Convert a book for local testing

```bash
cd backend/services/document_converter
uv run document-converter convert /path/to/book.epub \
  --output-dir ../../../books/ \
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
| [specs/UIDesign.md](specs/UIDesign.md) | Frontend design system (tokens, dark mode, typography, components) |
| [specs/ReadBook.md](specs/ReadBook.md) | Local testing plan for Scenario 4 (Reader Opens Book) |
