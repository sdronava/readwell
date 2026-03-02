# ReadWell Project Status

**Last Updated:** March 2, 2026
**Current Branch:** `feat/ui-improvements`
**Main Development Branch:** `feat/document-conversion-service`

## Project Overview

ReadWell is a sophisticated reading application designed to convert PDF and document formats into an accessible, interactive reading experience. The project includes a backend content gateway, document conversion microservice, and a modern React-based frontend with advanced reading features.

## Current Status: Phase 1 UI Improvements - In Progress

The `feat/ui-improvements` branch is actively being developed with a comprehensive overhaul of the user interface and reading experience.

### Completed Work

#### Frontend Application (React + Vite + TypeScript)
- **Core Architecture**: Full React application with TypeScript, TailwindCSS, and Vite bundler
- **Views Implemented**:
  - LibraryView: Book listing with cards, search, and navigation
  - ReaderView: Full-featured book reading interface

#### Reading Experience Features
- ✅ **Text-to-Speech (TTS)**:
  - Web Speech API integration with voice selection
  - Karaoke-style word-level cursor highlighting
  - Auto-page-turn when TTS finishes reading
  - Synchronized auto-scroll with TTS playback
  - User-configurable voice selector

- ✅ **Navigation**:
  - Table of Contents (TOC) sidebar navigation
  - Anchor-based page navigation via TOC
  - Correct page number resolution for TOC links

- ✅ **UI/UX**:
  - Dark mode / Light mode theme support
  - Theme context for state management
  - Customizable fonts and text sizing
  - Skeleton loading states for better UX
  - Reader settings context (persistent user preferences)

#### Backend Services
- **Content Gateway** (Python FastAPI):
  - Book serving via REST API
  - Local file store implementation
  - Health checks and API routing
  - Dependency management via uv/pip

- **Document Converter**:
  - Block-based document structure
  - Enhanced block builder with styling support
  - Test coverage for conversion processes

#### Documentation
- Comprehensive README with project overview and setup instructions
- UIDesign.md: Detailed UI/UX specifications
- ReadBook.md: Functional specifications for reading features
- DocumentConversionService.md: Backend service specifications

### Current Development Focus

#### In Progress
1. **PR Updates**: Preparing `feat/ui-improvements` branch for merge into main development branch
   - Code review and quality checks in progress
   - Documentation being finalized

2. **Known Issues & TODOs**
   - TOC page navigation anchor indexing resolved (commit af8494b)
   - Page number resolution for TOC navigation fixed (commit 019d066)
   - Reader header organization: title centered, chapter info in dropdown

### Architecture

```
ReadWell/
├── frontend/                    # React/Vite application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── views/              # Full-page views (Library, Reader)
│   │   ├── contexts/           # React Context (Theme, Reader Settings)
│   │   ├── hooks/              # Custom hooks (useBook, usePage, useTTS, useVoices)
│   │   ├── api/                # API integration (Content Gateway)
│   │   └── types/              # TypeScript type definitions
│   └── index.html              # Entry point
├── backend/
│   ├── services/
│   │   ├── content_gateway/    # Book serving API
│   │   └── document_converter/ # PDF to readable format conversion
│   └── [tests]
├── specs/                       # Technical specifications
├── books/                       # Local book database
└── pubs/                        # Published materials
```

### Tech Stack

**Frontend:**
- React 18+ with TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Web Speech API (TTS)
- React Context (state management)

**Backend:**
- Python 3.x
- FastAPI (web framework)
- uv (package manager)

## Next Steps

1. **Finalize PR**: Complete review and merge `feat/ui-improvements` → `feat/document-conversion-service`
2. **Testing**: Run full test suite for both frontend and backend
3. **Integration Testing**: Verify end-to-end flow from document upload through reading
4. **Performance**: Profile TTS performance, rendering optimization
5. **Phase 2**: Plan next features and improvements based on user feedback

## Local Development Setup

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend Content Gateway
cd backend/services/content_gateway
pip install -r pyproject.toml
python -m content_gateway.main
```

## Recent Commits (Last 5)

- `af8494b`: fix: resolve TOC page navigation using anchor index
- `019d066`: fix: resolve correct page numbers for TOC navigation
- `ff68694`: feat: click-to-read-from-paragraph and speakingFromIndex tracking
- `7003a97`: fix: ensure book title truncates correctly in header
- `3bed65a`: refactor: clean up reader header — title only in center, chapter info in dropdown

## Notes

- All changes are committed and branches are up to date with remote
- `.claude/` directory contains session metadata (not committed)
- Project uses monorepo structure with frontend and backend services
- Test coverage includes document conversion and content gateway components

---

**Status Summary**: ReadWell is in active development with Phase 1 UI improvements nearing completion. Core reading features are implemented and functional. Ready for integration testing and Phase 2 planning.
