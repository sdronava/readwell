# Phase 1: MVP Development Plan

## 1. Overview

Phase 1 focuses on delivering a minimal but functional end-to-end system that demonstrates the core value proposition: converting ePUB files into a readable, interactive format with synchronized text-to-speech. This phase establishes the foundational architecture and proves key technical integrations before expanding to PDFs, advanced features, and mobile platforms in later phases.

### Timeline Estimate
**8–12 weeks** for a small team (2–3 full-stack developers plus 1 infrastructure/DevOps engineer).

### Content Model
This application is an **open, curated library**. All content is freely available (public domain, Creative Commons, or author-donated). Publishers and authors upload books via a self-service portal. Admins approve books before they appear in the reader catalog. There is no paid content, DRM, or commercial transaction of any kind.

### Success Criteria
- Successfully convert sample ePUB files (e.g., the examples in `/pubs`) into a structured format.
- Display converted content in a web reader with pagination and basic navigation.
- Generate synchronized audio cues for TTS with in-browser playback and text highlighting.
- Support user bookmarks, reading progress, and simple annotations.
- Publisher/Author can upload an ePUB, track conversion status, and see the approved book in the catalog.
- Admin can approve or reject a submitted book.
- Full stack deployable locally and to AWS without manual intervention.
- Clear API contracts and documentation for integration with Phase 2 services.

---

## 2. MVP Feature Set

### 2.1 Core Reader Features (Desktop/Responsive Web)

1. **Book Library View**
   - Display list of available books with cover images, titles, authors.
   - Search books by title or author (simple substring matching, no full-text search yet).
   - Show reading progress (% complete, last read time).
   - Ability to start reading or resume from last position.

2. **Reader Display**
   - Single-page view (dual-page added in Phase 2).
   - Responsive layout: adapts to desktop, tablet, and mobile viewports.
   - Font size adjustment (3–5 preset sizes).
   - Configurable theme: light/dark mode.
   - Page navigation: next/previous buttons, page input field (jump to page N).
   - Progress indicator (current page / total pages).

3. **Text-to-Speech Integration**
   - Button to start/stop audio playback.
   - Speed control: 0.75x, 1x, 1.5x, 2x.
   - synchronized text highlighting: as audio plays, corresponding sentence/paragraph is highlighted.
   - Pause-only support: no seek/rewind during playback (initial MVP).
   - Display current audio position and duration.

4. **Bookmarks & Reading Progress**
   - Bookmark current page with optional note/title.
   - View list of bookmarked pages.
   - Delete bookmarks.
   - Automatic save of last read position on page change.
   - Resume from last position on app reload.

5. **Accessibility (MVP baseline)**
   - Semantic HTML and ARIA labels for all interactive elements.
   - Keyboard navigation: arrow keys for next/prev page, Tab for focus navigation.
   - High contrast mode toggle.
   - TTS controls fully keyboard accessible.
   - **Screen reader / TTS conflict handling:** When the app's TTS is playing, the word-highlight update would normally trigger a screen reader to re-announce the highlighted text — creating two overlapping audio streams. Mitigate this by:
     - Setting `aria-live="off"` on the content area while TTS is active; restoring it on pause/stop.
     - Showing a visible banner ("TTS playing — screen reader suppressed") so assistive technology users are aware.
     - Providing a dedicated "Reader mode" toggle that disables the app's TTS in favour of the system screen reader, and vice versa.
   - Test with VoiceOver (macOS/iOS) and NVDA (Windows) during Sprint 3 accessibility audit.

### 2.2 Publisher / Author Portal (MVP Scope)

1. **Book Upload**
   - Upload form: ePUB file, title, author name, license type (public domain / CC-BY / CC-BY-SA / CC-BY-NC / other), source URL, description.
   - On submission: file stored in S3, conversion job enqueued, book record created with status `converting`.
   - Publisher sees a status page: `converting` → `review` → `published` / `rejected`.

2. **Publisher Book Management**
   - List of books uploaded by the logged-in publisher with their current status.
   - View rejection reason if rejected; ability to edit metadata and resubmit.
   - Unpublish a book (sets status back to `pending` for re-review).

3. **Admin Review Queue**
   - List of books in `review` status.
   - View book metadata and a preview of the converted content.
   - Approve (sets status to `published`) or reject (sets status to `rejected`, requires a reason).

### 2.3 Backend Services (MVP Scope)

1. **Document Conversion Service**
   - Triggered by publisher upload (not admin CLI).
   - REST API endpoint: `POST /api/v1/publisher/books/upload` to upload an ePUB file with metadata.
   - Conversion runs asynchronously; status polled via `GET /api/v1/publisher/books/{bookId}/status`.
   - Parse ePUB and generate a structured block-based JSON package:
     - `metadata.json` (title, author, license, cover, spine order)
     - `chapters.json` (chapter list with section structure)
     - `pages/` directory — one JSON file per page with **structured content blocks** (paragraph, heading, code, image, table) rather than flat text
     - `assets/` directory with images

2. **User Management Service**
   - REST API for user registration, login, logout.
   - JWT token-based authentication.
   - Roles: Reader, Publisher/Author, Admin.
   - Publisher/Author role selectable at registration (flagged for admin awareness; no manual approval needed for MVP).
   - Endpoints to store/retrieve user preferences (font size, theme, TTS voice/speed).
   - Endpoints to manage bookmarks and reading progress.

3. **Text-to-Speech Service**
   - For MVP, use the **browser's built-in Web Speech API** (`SpeechSynthesis`) — zero backend cost, no AWS Polly required.
   - The TTS service in Phase 1 is entirely client-side; the backend provides text content blocks that the frontend feeds to `SpeechSynthesis`.
   - `boundary` events from the Web Speech API drive word/sentence highlighting with no server round-trip.
   - AWS Polly with server-side pre-generation is a Phase 2 upgrade.

4. **Content Gateway API** (Dynamic Data Only)
   - Handles only **dynamic** data: book catalog metadata, user state, publisher/admin actions.
   - **Does NOT serve page content or assets directly.** Page JSON files (`pages/page_NNN.json`) and image assets are stored in S3 and served via **CloudFront CDN**. The book metadata endpoint returns the CDN base URL; the frontend constructs asset URLs client-side.
   - Only `published` books are visible to Reader role.
   - Endpoints:
     - `GET /api/v1/books` – list published books (catalog metadata only).
     - `GET /api/v1/books/{bookId}/metadata` – book details including `cdnBaseUrl` for content.
     - `GET /api/v1/books/{bookId}/chapters` – chapter/TOC structure.
     - `GET /api/v1/users/{userId}/books` – books the user is currently reading.
     - `POST/GET /api/v1/users/{userId}/bookmarks` – user bookmarks.
     - `POST/GET /api/v1/users/{userId}/progress` – reading progress.
     - `POST /api/v1/publisher/books/upload` – upload a new book (Publisher role).
     - `GET /api/v1/publisher/books` – list publisher's own books with statuses.
     - `GET /api/v1/publisher/books/{bookId}/status` – conversion/review status.
     - `GET /api/v1/admin/books/review` – books awaiting admin approval (Admin role).
     - `POST /api/v1/admin/books/{bookId}/approve` – approve a book.
     - `POST /api/v1/admin/books/{bookId}/reject` – reject with reason.
   - **Local dev fallback:** In local development, a static file server (e.g., Vite's dev proxy or a simple Express static server) serves book package files from the local filesystem, mimicking the CDN behaviour. The `cdnBaseUrl` environment variable switches between local and production.

### 2.4 Out of Scope for MVP

- PDF support (Phase 2).
- Multimedia explanation service (Phase 2).
- Agentic/LLM on-demand explanations (Phase 2).
- Mobile native apps (Phase 2); web app remains responsive only.
- Offline reading (Phase 3).
- Full-text search across catalog (Phase 3); in-book search (Phase 2).
- Annotations of any kind (Phase 2) — bookmarks are sufficient for Phase 1.
- AWS Polly TTS with server-side pre-generation (Phase 2).
- ePUB CFI (Canonical Fragment Identifier) for reading positions (Phase 2) — Phase 1 uses integer page number + chapter_id + progress_percent as a stable-enough approximation.
- Publisher analytics (Phase 3).
- Author tools for adding pre-recorded multimedia (Phase 2).

---

## 3. Architecture for MVP

### 3.1 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Web Frontend (React SPA)                                         │
│  - Reader UI, TTS controls (Web Speech API, client-side)          │
│  - Publisher portal: upload form, status, book management         │
│  - Admin review queue                                             │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTP/REST
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼───────┐ ┌─────▼──────┐ ┌─────▼──────────────┐
│  Content      │ │  User      │ │  Publisher / Admin  │
│  Gateway API  │ │  Service   │ │  API                │
│  (Reader)     │ │  (Auth,    │ │  (upload, review,   │
│               │ │  prefs,    │ │   approve, reject)  │
│               │ │  bookmarks)│ │                     │
└──┬────────────┘ └─────┬──────┘ └──────────┬──────────┘
   │                    │                   │
   │             ┌──────▼────────┐          │
   │             │  Auth / JWT   │          │
   │             │  Middleware   │          │
   │             └───────────────┘          │
   │                                        │
┌──▼────────────────────────────────────────▼──┐
│  Storage Layer                                │
│  - Local FS or S3 (book packages, assets)     │
│  - PostgreSQL (users, books, progress, jobs)  │
└───────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Document Conversion Service (Async Worker)  │
│  - ePUB → structured block JSON package      │
│  - Triggered by publisher upload             │
│  - Updates book status: converting → review  │
└──────────────────────────────────────────────┘
```

### 3.2 Service Responsibilities

#### Content Gateway API
- Orchestrates requests from the frontend.
- Calls User Service for authentication.
- Serves book metadata and page content from storage.
- Calls TTS Service for audio synthesis.
- Route requests to User Service for bookmarks/progress.
- Language: Python (FastAPI) or Java (Spring Boot).
- Port: 5000 (local) or 3000 (alternative).

#### User Management Service
- Authentication: register, login, logout.
- CRUD operations for user profiles.
- Store user preferences (font size, theme, TTS voice/speed).
- Track reading progress per book.
- Manage bookmarks and annotations.
- Language: Python (FastAPI/Flask) or Java (Spring Boot).
- Database: PostgreSQL (or SQLite for local dev).

#### TTS Service
- Accepts text + metadata, calls AWS Polly or open-source alternative.
- Returns audio URL and sync markers (word timings, sentence boundaries).
- Caches results locally or in S3 to minimize API calls.
- Language: Python (FastAPI) or Java (Spring Boot).
- External dependency: AWS Polly account or free TTS API.

#### Document Conversion Service
- Async worker triggered by publisher upload (not admin CLI).
- Picks up jobs from a queue (simple database-backed queue for MVP; SQS in production).
- Input: ePUB file path in S3 (or local FS).
- Output: structured block JSON book package (paragraph, heading, code, image, table blocks).
- Updates `books.status`: `converting` → `review` on success; `failed` on error.
- Language: Python (using `ebooklib`, `Pillow`, `BeautifulSoup4`).
- Runs as a background worker process alongside the API in docker-compose.

### 3.3 Data Flow for Key Scenarios

#### Scenario 1: Publisher Uploads a Book
```
1. Publisher logs in and navigates to "Upload Book".
2. Fills form: ePUB file, title, author, license (e.g. CC-BY), source URL, description.
3. Frontend: POST /api/v1/publisher/books/upload (multipart form)
4. API validates file type and required fields.
5. API stores raw ePUB in S3 (or local FS): uploads/{bookId}.epub
6. API creates book record in DB: status = "converting"
7. API enqueues conversion job (DB job table for MVP).
8. API returns {bookId, status: "converting"}.
9. Conversion worker picks up job, runs ePUB → JSON package.
10. Worker stores package in S3: books/{bookId}/
11. Worker updates book: status = "review"
12. Publisher polls GET /api/v1/publisher/books/{bookId}/status → sees "review"
```

#### Scenario 2: Admin Reviews and Approves a Book
```
1. Admin logs in and navigates to "Review Queue".
2. Frontend: GET /api/v1/admin/books/review → list of books with status "review"
3. Admin opens a book, previews metadata and first pages.
4. Admin clicks "Approve".
5. Frontend: POST /api/v1/admin/books/{bookId}/approve
6. API sets book status = "published"
7. Book now appears in GET /api/v1/books (reader catalog).
```

#### Scenario 3: Admin Rejects a Book
```
1. Admin reviews a submitted book.
2. Admin clicks "Reject", enters reason: "License unclear — please provide source URL."
3. Frontend: POST /api/v1/admin/books/{bookId}/reject { "reason": "..." }
4. API sets book status = "rejected", stores reason.
5. Publisher sees status "rejected" with reason; can update metadata and resubmit.
```

#### Scenario 4: Reader Opens Book
```
1. Frontend: GET /api/v1/books
   → Gateway queries DB for published books, returns list.
2. User clicks "Read" on a book.
3. Frontend: GET /api/v1/books/{bookId}/metadata
   → Returns title, author, license, cover, total pages.
4. Frontend: GET /api/v1/books/{bookId}/pages/1
   → Returns page 1 structured content blocks (paragraphs, headings, code, images).
5. Frontend renders page from content blocks.
```

#### Scenario 5: User Plays Text-to-Speech
```
1. User clicks "Play Audio" on current page.
2. Frontend extracts plain text from the page's content blocks (skipping code blocks by default).
3. Frontend calls browser Web Speech API: window.speechSynthesis.speak(utterance)
4. Utterance fires "boundary" events for each word/sentence.
5. Frontend highlights the corresponding word/sentence in the rendered page.
6. No backend call required for MVP TTS.
```

#### Scenario 6: User Bookmarks Page
```
1. User clicks bookmark icon on page 42.
2. Frontend POST /api/v1/users/{userId}/bookmarks
   {bookId: "book_001", page: 42, note: "Important section"}
3. User Service stores in database.
4. Frontend displays confirmation; adds to sidebar list.
```

#### Scenario 7: User Resumes Reading
```
1. User closes browser or navigates away.
2. Frontend stores last page in localStorage or POST to backend.
3. User reopens app.
4. Frontend: GET /api/v1/users/{userId}/progress?bookId={bookId}
5. Returns {currentPage: 42, lastRead: "2026-02-28T10:30:00Z"}
6. Frontend automatically loads page 42.
```

---

## 4. API Specification (MVP)

All APIs use JSON payloads and return HTTP status codes 200, 400, 401, 403, 404, 500 as appropriate. Role enforcement:
- **Reader** endpoints: any authenticated user.
- **Publisher** endpoints: users with role `publisher` or `admin`.
- **Admin** endpoints: users with role `admin` only.

### 4.1 Authentication

#### POST /api/v1/auth/register
```
Request:
{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe",
  "role": "reader"          // "reader" or "publisher" — admin is assigned manually
}

Response: 201 Created
{
  "userId": "user_uuid",
  "email": "user@example.com",
  "role": "reader",
  "token": "eyJhbGc..."
}
```

#### POST /api/v1/auth/login
```
Request:
{
  "email": "user@example.com",
  "password": "secure_password"
}

Response: 200 OK
{
  "userId": "user_uuid",
  "token": "eyJhbGc..."
}
```

#### POST /api/v1/auth/logout
```
Request: (auth header required)

Response: 200 OK
{ "message": "Logged out successfully" }
```

### 4.2 Books & Content

#### GET /api/v1/books
```
Response: 200 OK
{
  "books": [
    {
      "bookId": "book_001",
      "title": "Technical Book Title",
      "author": "Author Name",
      "coverUrl": "/assets/covers/book_001.jpg",
      "totalPages": 350,
      "description": "Short description..."
    },
    ...
  ]
}
```

#### GET /api/v1/books/{bookId}/metadata
```
Response: 200 OK
{
  "bookId": "book_001",
  "title": "Technical Book Title",
  "author": "Author Name",
  "coverUrl": "/assets/covers/book_001.jpg",
  "totalPages": 350,
  "description": "...",
  "tableOfContents": [
    {
      "chapter": 1,
      "title": "Introduction",
      "startPage": 1,
      "endPage": 25
    },
    ...
  ]
}
```

#### GET /api/v1/books/{bookId}/pages/{pageNum}
```
Response: 200 OK
{
  "bookId": "book_001",
  "pageNum": 5,
  "text": "Chapter 1: Introduction\n\nThis chapter covers the basics...",
  "imageRefs": [
    {
      "id": "img_001",
      "url": "/assets/images/book_001/figure_1_1.png",
      "caption": "Figure 1.1: System Overview",
      "position": "middle"
    }
  ],
  "ttsMarkers": [
    {
      "word": "Chapter",
      "start": 0,
      "end": 0.5
    },
    {
      "word": "Introduction",
      "start": 0.6,
      "end": 1.2
    }
    // ... more markers for each word/sentence
  ]
}
```

#### GET /api/v1/books/{bookId}/assets/{assetId}
```
Response: 200 OK (binary image content with appropriate Content-Type)
```

### 4.3 Text-to-Speech (Phase 1: Client-Side Only)

TTS in Phase 1 is handled entirely in the browser using the Web Speech API. No backend TTS endpoints are required for MVP. The frontend extracts plain text from page content blocks and feeds it to `window.speechSynthesis`. Backend TTS endpoints (AWS Polly) are a Phase 2 addition.

### 4.4 Publisher API (Publisher / Admin role required)

#### POST /api/v1/publisher/books/upload
```
Request: multipart/form-data
  file:        <epub file>
  title:       "My Technical Book"
  author:      "Jane Doe"
  license:     "CC-BY-4.0"        // public-domain, CC-BY-4.0, CC-BY-SA-4.0, CC-BY-NC-4.0, other
  sourceUrl:   "https://example.com/book"
  description: "A concise intro to..."

Response: 202 Accepted
{
  "bookId": "book_uuid",
  "status": "converting",
  "statusUrl": "/api/v1/publisher/books/book_uuid/status"
}
```

#### GET /api/v1/publisher/books
```
Response: 200 OK
{
  "books": [
    {
      "bookId": "book_uuid",
      "title": "My Technical Book",
      "status": "published",       // converting | review | published | rejected | failed
      "uploadedAt": "2026-02-28T10:00:00Z"
    },
    ...
  ]
}
```

#### GET /api/v1/publisher/books/{bookId}/status
```
Response: 200 OK
{
  "bookId": "book_uuid",
  "status": "review",
  "rejectionReason": null,
  "uploadedAt": "2026-02-28T10:00:00Z",
  "convertedAt": "2026-02-28T10:05:00Z"
}
```

#### PUT /api/v1/publisher/books/{bookId}
```
// Update metadata (only allowed if status is rejected or review)
Request:
{
  "title": "Updated Title",
  "description": "Updated description...",
  "license": "CC-BY-4.0",
  "sourceUrl": "https://example.com/book-v2"
}

Response: 200 OK
{ "message": "Metadata updated. Book re-queued for review." }
```

#### DELETE /api/v1/publisher/books/{bookId}
```
// Unpublish / withdraw a book (sets status to withdrawn)
Response: 204 No Content
```

### 4.5 Admin API (Admin role required)

#### GET /api/v1/admin/books/review
```
Response: 200 OK
{
  "books": [
    {
      "bookId": "book_uuid",
      "title": "My Technical Book",
      "author": "Jane Doe",
      "license": "CC-BY-4.0",
      "sourceUrl": "https://example.com/book",
      "uploadedBy": { "userId": "user_uuid", "name": "Jane Doe", "email": "jane@example.com" },
      "convertedAt": "2026-02-28T10:05:00Z"
    },
    ...
  ]
}
```

#### POST /api/v1/admin/books/{bookId}/approve
```
Response: 200 OK
{ "message": "Book published successfully." }
```

#### POST /api/v1/admin/books/{bookId}/reject
```
Request:
{ "reason": "License is not freely distributable. Please verify and resubmit." }

Response: 200 OK
{ "message": "Book rejected. Publisher has been notified." }
```

### 4.6 User Preferences

#### GET /api/v1/users/{userId}/preferences
```
Response: 200 OK
{
  "userId": "user_uuid",
  "fontSize": "medium",
  "theme": "dark",
  "ttsVoice": "Joanna",
  "ttsSpeed": 1.0
}
```

#### PUT /api/v1/users/{userId}/preferences
```
Request:
{
  "fontSize": "large",
  "theme": "light",
  "ttsVoice": "Matthew",
  "ttsSpeed": 1.5
}

Response: 200 OK
{ "message": "Preferences updated" }
```

### 4.7 Bookmarks & Progress

#### GET /api/v1/users/{userId}/bookmarks
```
Response: 200 OK
{
  "bookmarks": [
    {
      "bookId": "book_001",
      "page": 42,
      "note": "Important section on authentication",
      "createdAt": "2026-02-28T10:30:00Z"
    },
    ...
  ]
}
```

#### POST /api/v1/users/{userId}/bookmarks
```
Request:
{
  "bookId": "book_001",
  "page": 42,
  "note": "Important section"
}

Response: 201 Created
{
  "bookmarkId": "bookmark_uuid",
  "bookId": "book_001",
  "page": 42,
  "note": "Important section",
  "createdAt": "2026-02-28T10:30:00Z"
}
```

#### DELETE /api/v1/users/{userId}/bookmarks/{bookmarkId}
```
Response: 204 No Content
```

#### GET /api/v1/users/{userId}/progress?bookId={bookId}
```
Response: 200 OK
{
  "userId": "user_uuid",
  "bookId": "book_001",
  "currentPage": 42,
  "lastRead": "2026-02-28T10:30:00Z"
}
```

#### POST /api/v1/users/{userId}/progress
```
Request:
{
  "bookId": "book_001",
  "currentPage": 45
}

Response: 200 OK
{ "message": "Progress saved" }
```

### 4.8 Annotations

Annotations (page-level or text-selection notes) are **deferred to Phase 2**. Bookmarks with an optional note field cover the essential use case for Phase 1. Phase 2 will add full text-selection annotations with highlighted ranges and a richer sidebar experience.

---

## 5. Frontend Design

### 5.1 UI Wireframe Sketch

```
┌─────────────────────────────────────────────────┐
│  Header: Logo | Books | Settings | Logout       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Main Content Area:                             │
│                                                 │
│  ┌──────────────────────────────────────┐       │
│  │ [Image]  Chapter 1: Introduction      │       │
│  │                                       │       │
│  │ Lorem ipsum dolor sit amet...         │       │
│  │ consectetur adipiscing elit...        │       │
│  │                                       │       │
│  │ [Image caption] Figure 1.1: System    │       │
│  │ Overview...                           │       │
│  │                                       │       │
│  │ Sed do eiusmod tempor...              │       │
│  └──────────────────────────────────────┘       │
│                                                 │
├─────────────────────────────────────────────────┤
│ [❮ Prev] [5 / 350] [Next ❯]  🔖 ♡ ⋮ Controls │
│                                                 │
│ Audio: [▶ Play] [⏸ Pause] Speed: [x1.0 ▼]     │
│        ──────●──────────── (progress bar)      │
├─────────────────────────────────────────────────┤
│ Sidebar (Bookmarks, TOC):                        │
│ [Bookmarks]  [TOC]                              │
│ • Page 42: Important section                    │
│ • Page 105: Code example                        │
└─────────────────────────────────────────────────┘
```

### 5.2 Key Pages/Views

#### Book Library View (Reader)
- Grid or list of published books with covers, license badge.
- Search/filter by title/author.
- Progress indicator (% read) overlay on each book cover.
- "Resume" button if user has been reading.

#### Reader View
- Full-page display of book content blocks (paragraphs, headings, code, images).
- Page navigation (prev/next buttons, manual input, TOC).
- Sidebar toggle for bookmarks, annotations, TOC.
- TTS control bar at bottom (Play/Pause, speed, voice, word highlighting).

#### Settings/Preferences View
- Font size presets.
- Theme toggle (light/dark).
- TTS voice selector (populated from browser voices).
- TTS speed adjustment.

#### Publisher Upload Portal
- Upload form: file, title, author, license, source URL, description.
- My Books list with status badges (Converting / Under Review / Published / Rejected).
- Status detail page: rejection reason, edit metadata, resubmit button.

#### Admin Review Panel
- Queue of books awaiting review.
- Book detail: metadata, license, source URL, first-page preview.
- Approve / Reject (with reason) actions.

#### Bookmarks Sidebar
- List of all bookmarks with page number and optional note.
- Click to jump to that page.
- Delete bookmark button.
- (Annotations deferred to Phase 2.)

### 5.3 Technology Stack for Frontend

- **Framework**: React 18+ with TypeScript.
- **State Management**: Redux Toolkit or Zustand (lighter alternative).
- **HTTP Client**: Axios or Fetch API.
- **Styling**: Tailwind CSS or Material-UI.
- **Audio Playback**: HTML5 Audio API with custom controls wrapper.
- **Responsive Design**: CSS Grid and Flexbox; tested on Chrome, Safari, Firefox.
- **Build Tool**: Vite or Create React App.

---

## 6. Database Schema (MVP)

The following tables are sufficient for Phase 1:

### 6.1 PostgreSQL Schema

```sql
-- Users (Reader, Publisher, Admin)
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'reader',  -- 'reader' | 'publisher' | 'admin'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences
CREATE TABLE user_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  font_size VARCHAR(50) DEFAULT 'medium',
  theme VARCHAR(50) DEFAULT 'light',
  tts_voice VARCHAR(100) DEFAULT 'default',   -- browser voice name for Web Speech API
  tts_speed FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Books (shared catalog — all published books visible to all readers)
CREATE TABLE books (
  book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  author VARCHAR(500),
  description TEXT,
  license VARCHAR(100) NOT NULL,              -- 'public-domain' | 'CC-BY-4.0' | etc.
  source_url VARCHAR(1000),                   -- link to original freely available source
  cover_url VARCHAR(1000),
  total_pages INT,
  language VARCHAR(50) DEFAULT 'en',
  status VARCHAR(50) NOT NULL DEFAULT 'converting',
    -- 'converting' | 'review' | 'published' | 'rejected' | 'failed' | 'withdrawn'
  uploaded_by UUID NOT NULL REFERENCES users(user_id),
  rejection_reason TEXT,
  package_path VARCHAR(1000),                 -- S3 key prefix for book package (e.g. books/{bookId}/)
  cdn_base_url VARCHAR(1000),                 -- CloudFront URL served to frontend (e.g. https://cdn.example.com/books/{bookId}/)
  raw_file_path VARCHAR(1000),                -- S3 key for original uploaded ePUB (private, not CDN)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

-- Conversion Jobs
CREATE TABLE conversion_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'done' | 'failed'
  error_message TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reading Progress
-- Note: current_page (integer) is a Phase 1 simplification.
-- It is fragile: if pagination changes (e.g. different words-per-page setting),
-- the stored page number no longer maps to the same content.
-- Phase 2 will replace this with ePUB CFI (Canonical Fragment Identifier),
-- the standard W3C/IDPF format for position references within ePUB documents,
-- which survives re-pagination and re-conversion.
-- For Phase 1, we also store chapter_id + progress_percent as stable anchors
-- that can survive page-count changes.
CREATE TABLE reading_progress (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  current_page INT DEFAULT 1,           -- integer page number (fragile, Phase 1 only)
  chapter_id VARCHAR(255),              -- chapter/spine ID (stable across re-pagination)
  progress_percent FLOAT DEFAULT 0.0,   -- 0.0–100.0 through the whole book (stable anchor)
  last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, book_id)
);

-- Bookmarks
CREATE TABLE bookmarks (
  bookmark_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  page_num INT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

Note: The `annotations` table is deferred to Phase 2. The `tts_cache` table is also deferred — TTS is client-side only in Phase 1.

### 6.2 Storage Structure (S3 in production / Local FS in dev)

All book content is **static after conversion** and served directly from S3 via CloudFront — never through the API. The API stores only the `cdnBaseUrl` (e.g., `https://cdn.example.com/books/book_uuid/`) in the `books` table; the frontend constructs all content URLs from this base.

```
S3 bucket: reader-books/
├── uploads/                       # Raw uploaded ePUB files (private, not CDN-served)
│   ├── {bookId}.epub
│   └── ...
└── books/                         # Converted packages (CDN-served via CloudFront)
    ├── {bookId}/
    │   ├── metadata.json
    │   ├── chapters.json
    │   ├── pages/
    │   │   ├── page_001.json      # Fetched by frontend directly from CDN
    │   │   ├── page_002.json
    │   │   └── ...
    │   └── assets/
    │       ├── images/
    │       │   ├── cover.jpg
    │       │   ├── cover_thumb.jpg
    │       │   ├── fig_1_1.png
    │       │   ├── fig_1_1_800w.webp   # Responsive image variants
    │       │   ├── fig_1_1_400w.webp
    │       │   └── ...
    │       └── fonts/
    │           └── (if custom fonts embedded)
    └── {bookId2}/
        └── ...
```

**Local development:** A local static file server (configured in docker-compose) serves the `books/` directory on a fixed port. The `CONTENT_BASE_URL` env var points to this local server. The frontend fetches content from the same URL shape regardless of environment.

---

## 7. Development Tasks & Sprint Breakdown

Estimated as **3 sprints of 2 weeks each = 6 weeks of active development**, plus buffer and integration testing.

### Sprint 1: Foundation, Auth & Roles (Weeks 1–2)

#### Backend
1. **Setup project structure**
   - Initialize Git repo, GitHub project board.
   - Set up project templates (Python FastAPI or Java Spring Boot).
   - Configure Docker and docker-compose for local development.
   - Write README with setup instructions.

2. **User Management Service**
   - Implement user registration with `role` field (reader/publisher) (POST /auth/register).
   - Implement login with JWT token generation (POST /auth/login).
   - Implement logout (POST /auth/logout).
   - Add password hashing (bcrypt).
   - Add role-aware authentication middleware (enforce reader/publisher/admin on routes).

3. **Database Setup**
   - Create PostgreSQL schema: `users`, `user_preferences`, `books`, `conversion_jobs`.
   - Write migrations (Alembic/Flyway).
   - Confirm local PostgreSQL instance works via Docker.

4. **User Preferences Service**
   - Implement GET/PUT endpoints for preferences.

#### Frontend
1. **Project Setup**
   - Initialize React + TypeScript, Vite, Tailwind CSS.
   - Create basic page layout (header, main, footer).

2. **Authentication UI**
   - Login and registration pages.
   - Registration includes role selector: "I want to read books" / "I am a publisher or author".
   - Session storage and logout button.

3. **Navigation**
   - Basic client-side routing.
   - Role-aware protected routes (reader → library, publisher → portal, admin → admin panel).

#### Testing
1. Unit tests for auth endpoints.
2. Integration test: register as reader → login → register as publisher → login → verify role-gated routes.

### Sprint 2: Publisher Portal & Conversion Pipeline (Weeks 3–4)

#### Backend
1. **Document Conversion Worker**
   - Write Python async worker to parse ePUB using `ebooklib`, `BeautifulSoup4`.
   - Extract structured content blocks (paragraph, heading, code, image, table).
   - Generate `metadata.json`, `chapters.json`, `pages/page_NNN.json`, `assets/`.
   - Worker polls `conversion_jobs` table for queued jobs.
   - On completion: update book status to `review`; on failure: status `failed`.
   - Test on sample ePUB files from `/pubs`.

2. **Publisher Upload API**
   - Implement POST /api/v1/publisher/books/upload (multipart, Publisher role).
   - Store raw ePUB in S3/local FS, create book record, enqueue conversion job.
   - Implement GET /api/v1/publisher/books (list publisher's books).
   - Implement GET /api/v1/publisher/books/{bookId}/status.
   - Implement PUT /api/v1/publisher/books/{bookId} (update metadata).
   - Implement DELETE /api/v1/publisher/books/{bookId} (withdraw).

3. **Admin Review API**
   - Implement GET /api/v1/admin/books/review.
   - Implement POST /api/v1/admin/books/{bookId}/approve.
   - Implement POST /api/v1/admin/books/{bookId}/reject.

4. **Content Gateway API (Reader)**
   - Implement GET /api/v1/books (published books only).
   - Implement GET /api/v1/books/{bookId}/metadata.
   - Implement GET /api/v1/books/{bookId}/chapters.
   - Implement GET /api/v1/books/{bookId}/pages/{pageNum}.
   - Implement GET /api/v1/books/{bookId}/assets/{assetId}.

5. **Reading Progress**
   - Implement GET/POST /api/v1/users/{userId}/progress.

#### Frontend
1. **Publisher Portal**
   - Upload form: file picker, title, author, license dropdown, source URL, description.
   - Status page: shows conversion status, rejection reason if applicable.
   - Book list: publisher's books with current status badges.
   - Edit metadata and resubmit on rejection.

2. **Admin Review Panel**
   - Review queue: list of books awaiting approval.
   - Book preview: metadata, license, source URL, and first page content.
   - Approve / Reject (with reason) buttons.

3. **Book Library View (Reader)**
   - Fetch and display published books only.
   - Show cover, title, author, license badge.
   - Click to open reader.

4. **Basic Reader Layout**
   - Render page content blocks (paragraphs, headings, code with monospace, images).
   - Next/previous page navigation.
   - Page counter.

#### Testing
1. Full upload → convert → review → approve → catalog flow.
2. Reject flow: publisher sees rejection reason, resubmits, re-enters review.
3. Content API endpoint tests.
4. Manual test: library → open book → navigate pages.

### Sprint 3: TTS, Bookmarks & Reader Polish (Weeks 5–6)

#### Backend
1. **Bookmarks**
   - Implement CRUD endpoints for bookmarks.
   - Add database migrations.

2. **Integration Testing**
   - Full end-to-end flow: upload → convert → approve → read → TTS → bookmark.

#### Frontend
1. **TTS Controls (Web Speech API)**
   - Play/pause/stop buttons.
   - Speed control (0.75x, 1x, 1.5x, 2x) via `SpeechSynthesisUtterance.rate`.
   - Voice selector from `window.speechSynthesis.getVoices()`.
   - Word/sentence highlighting on `boundary` events.
   - Auto-skip code blocks during TTS (don't read code aloud).

2. **Bookmarks UI**
   - Bookmark button on each page (with optional note).
   - Bookmark sidebar with list of all bookmarks.
   - Click bookmark to jump to that page.

3. **Settings / Preferences**
   - Font size, theme, TTS voice, TTS speed.
   - Persist to backend.

4. **Reader UX Polish**
   - Chapter TOC sidebar with jump-to navigation.
   - Progress indicator (page N of M, % complete).
   - Light/dark mode toggle.
   - Keyboard shortcuts (arrow keys for page navigation).
   - Accessibility audit: ARIA labels, keyboard nav, high contrast.

#### Testing
1. TTS playback and word highlighting tests.
2. Bookmark CRUD tests.
3. Manual test: read with TTS, bookmark a page, verify bookmark persists across sessions.

### Sprint 4: Polish & Deployment (Weeks 7–8)

#### Backend
1. Error handling and validation for all endpoints.
2. Rate limiting on upload endpoint (prevent abuse).
3. Logging and monitoring setup.
4. Dockerfile for each service.
5. docker-compose for full local stack (API + worker + PostgreSQL).

#### Frontend
1. Responsive design testing (mobile, tablet, desktop).
2. Performance optimization (lazy loading images, code splitting).
3. Error handling and user-facing feedback (upload failed, conversion failed, etc.).

#### Deployment
1. Set up AWS RDS, S3, CloudFront.
2. Deploy backend API + worker to AWS ECS/Fargate.
3. Deploy frontend to S3 + CloudFront.
4. Set up CI/CD with GitHub Actions.
5. Document setup and deployment steps.

#### Integration & End-to-End Tests
1. Test entire flow on staging: upload → approve → read → TTS → bookmark.
2. Security review (SQL injection, CSRF, XSS, file upload validation).

---

## 8. Technology Stack & Tools

### Backend
- **Language**: Python 3.10+ or Java 17+.
  - Python: FastAPI (async web framework), Pydantic (validation), SQLAlchemy (ORM), boto3 (AWS SDK).
  - Java: Spring Boot 3.x, Spring Data JPA, AWS SDK for Java.
- **Database**: PostgreSQL (production), SQLite (local dev).
- **Caching**: None in Phase 1. Static book content is cached by CloudFront (CDN); TTS is client-side. Redis deferred to Phase 2 (needed for Polly TTS caching and rate limiting).
- **API Documentation**: OpenAPI / Swagger (auto-generated from FastAPI/Spring Boot).
- **Testing**: pytest (Python) or JUnit 5 (Java), with Testcontainers for DB testing.
- **Environment**: Docker, docker-compose.

### Frontend
- **Framework**: React 18 with TypeScript.
- **Build**: Vite.
- **HTTP**: Axios.
- **State**: Redux Toolkit or Zustand.
- **Styling**: Tailwind CSS + Headless UI components.
- **Audio**: HTML5 Audio API + custom wrapper.
- **Testing**: Jest + React Testing Library.
- **Environment**: Node.js 18+.

### DevOps & Infrastructure
- **Containerization**: Docker, docker-compose.
- **Cloud**: AWS (S3, RDS, CloudFront, ECS/Fargate, Lambda optional).
- **IaC**: Terraform or CloudFormation (optional for MVP, can be manual initially).
- **CI/CD**: GitHub Actions.
- **Monitoring**: CloudWatch (AWS) + optional Prometheus/Grafana.
- **Logging**: CloudWatch Logs (AWS) or ELK.

### External Services
- **TTS**: AWS Polly (production) or free alternative (festival, eSpeak, or Mozilla TTS for local dev).
- **Secret Management**: AWS Secrets Manager or environment variables.

---

## 9. Local Development Setup

### Prerequisites
- Docker and docker-compose installed.
- Git.
- Python 3.10+ or Java 17+ (depending on language choice).
- Node.js 18+ (for frontend).
- VS Code or preferred IDE.

### Quick Start (Using docker-compose)

```bash
# Clone repo
git clone https://github.com/yourorg/reader.git
cd reader

# Start backend services, database, cache
docker-compose -f docker-compose.local.yml up

# In another terminal, start frontend dev server
cd frontend
npm install
npm run dev
```

The full stack (backend API, conversion worker, PostgreSQL, local static file server, React dev server) should be running on localhost. No Redis required in Phase 1.

- Frontend: http://localhost:5173 (Vite default)
- Backend API: http://localhost:5000 (Python) or 8080 (Java)
- Conversion worker: background process (started by docker-compose)
- PostgreSQL: localhost:5432
- Static content server (book packages): http://localhost:9000 (mirrors S3/CDN in dev)

### Document Conversion

```bash
# Python example
python scripts/convert_epub.py path/to/book.epub --output-dir ./books/

# Then populate database
python scripts/ingest_book.py ./books/book_001
```

### Testing Locally

```bash
# Backend unit tests
python -m pytest tests/ -v

# Frontend tests
cd frontend && npm test

# End-to-end: start local stack, run postman collection or playwright tests
npm run test:e2e
```

---

## 10. Success Metrics & Acceptance Criteria

### Functional Acceptance Criteria

1. **ePUB Conversion (Publisher-triggered)**
   - Publisher uploads an ePUB via the portal; conversion runs automatically.
   - Structured content blocks preserved (paragraphs, headings, code, images).
   - Book enters `review` status on success; `failed` on error with visible message.
   - Successfully converts sample ePUBs from `/pubs`.

2. **Web Reader Display**
   - Display any converted ePUB page correctly.
   - Navigate between pages without errors.
   - Text is readable and responsive on desktop, tablet, mobile.
   - Images scale appropriately.

3. **Text-to-Speech**
   - Generate audio for any page within 5 seconds (with caching).
   - Audio syncs with text highlighting (accurate to word/sentence level).
   - Speed control (0.75x – 2x) works correctly.
   - Play/pause/stop controls functional.

4. **Bookmarks**
   - Create, read, delete bookmarks (with optional note).
   - Data persists across sessions.
   - User can jump to bookmarked page.

5. **User Management & Roles**
   - Register as Reader or Publisher/Author.
   - Login and logout.
   - Role-gated routes work correctly (readers can't access publisher portal; non-admins can't access admin panel).
   - User preferences save and apply.
   - Reading progress saves and resumes correctly.

6. **Publisher & Admin Workflow**
   - Publisher uploads book → sees "Converting" status.
   - Publisher sees "Under Review" after conversion.
   - Admin sees book in review queue, can approve or reject with reason.
   - On approval, book appears in reader catalog.
   - On rejection, publisher sees reason and can resubmit.

7. **API Quality**
   - All endpoints documented in Swagger/OpenAPI.
   - Response times < 500ms for typical requests.
   - Proper error handling and status codes.

### Non-Functional Acceptance Criteria

1. **Performance**
   - Page load: < 1s (with caching).
   - TTS synthesis (new request): < 5s.
   - Responsive UI (no freezing during audio playback).

2. **Accessibility**
   - Keyboard navigation functional (Tab, Arrow keys).
   - ARIA labels on buttons and inputs.
   - High contrast mode.
   - Screen reader friendly.

3. **Security**
   - Passwords hashed (bcrypt).
   - JWT tokens with expiry.
   - HTTPS in production.
   - No SQL injection vulnerabilities.
   - CORS configured correctly.

4. **Reliability**
   - Services recoverable from crashes (via docker-compose restart).
   - Database queries include error handling.
   - Graceful handling of missing assets/books.

5. **Deployability**
   - Full stack runs locally via docker-compose.
   - Single click deployment to AWS (via GitHub Actions).
   - Clear setup documentation.

---

## 11. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| ePUB parsing complexity | Medium | High | Prototype with sample ePUBs early; use well-tested libraries (ebooklib). |
| TTS API cost | Medium | Medium | Implement caching from day one; use free tier during dev. |
| Database scaling issues | Low | Medium | Use indexed queries; monitor in CloudWatch. Phase 2 can introduce sharding. |
| Frontend performance | Low | Medium | Profile with browser dev tools; implement virtualization if needed. |
| Authentication/security bugs | Low | High | Security review by external team before Phase 2; use established JWT libraries. |
| Scope creep | High | High | Strictly limit MVP scope; defer Phase 2 features to separate PR/issue. Use GitHub Projects to track. |

---

## 12. Success Definition & Metrics

**MVP is "Done" when:**

1. ✅ Two sample ePUBs from `/pubs` are uploaded via the publisher portal, approved by admin, and readable in the reader.
2. ✅ All acceptance criteria above are met.
3. ✅ Role-based access works correctly for Reader, Publisher, and Admin.
4. ✅ Full stack can be started locally with one command.
5. ✅ Deployed to AWS (staging) with CI/CD pipeline.
6. ✅ Documentation complete (API docs, setup guide, architecture).
7. ✅ Code reviewed and tested (minimum 80% test coverage for core services).
8. ✅ Performance benchmarks recorded (response times, conversion time).
9. ✅ Security review passed (no critical vulnerabilities, file upload validation).

**User Testing (optional for MVP):**
- Small focus group (2–3 users) reads a sample book end-to-end.
- Gather feedback on UI, TTS sync, and feature completeness.
- Issues logged for Phase 2 backlog.

---

## 13. Handoff to Phase 2

Upon completion of Phase 1 MVP, the following should be ready for Phase 2:

1. **Codebase**: Well-structured, documented, tested, and deployed on AWS.
2. **API Contracts**: Finalized OpenAPI specs for all Phase 1 services.
3. **Documentation**: Architecture diagrams, setup guides, API docs, design decisions.
4. **Backlog**: Prioritized list of Phase 2 features and improvements.
5. **Metrics**: Baseline performance, accessibility, and security metrics.
6. **Team Knowledge**: All team members familiar with stack, deployment process, and codebase.

Phase 2 can then proceed with confidence, adding PDF support, advanced TTS, multimedia explanations, mobile apps, and agentic features without refactoring the MVP foundation.

---

## 14. References & Resources

### ePUB & Document Parsing
- **ebooklib** (Python): https://github.com/aerkalov/ebooklib
- **Apache Tika** (Java): https://tika.apache.org/
- **Apache PDFBox** (Java): https://pdfbox.apache.org/

### Web Frontend
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

### Backend Frameworks
- **FastAPI**: https://fastapi.tiangolo.com/
- **Spring Boot**: https://spring.io/projects/spring-boot

### AWS Services
- **AWS Polly**: https://aws.amazon.com/polly/
- **Amazon S3**: https://aws.amazon.com/s3/
- **Amazon RDS**: https://aws.amazon.com/rds/
- **AWS ECS/Fargate**: https://aws.amazon.com/ecs/

### Testing & Quality
- **pytest**: https://docs.pytest.org/
- **Jest**: https://jestjs.io/
- **Testcontainers**: https://www.testcontainers.org/

### Deployment
- **GitHub Actions**: https://github.com/features/actions
- **Docker**: https://www.docker.com/
- **Terraform**: https://www.terraform.io/

---

*Phase 1 MVP Plan – Updated February 28, 2026*
