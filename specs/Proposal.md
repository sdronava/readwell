# Proposal for Enhanced Immersive Reader Application

## 1. Introduction

The goal of this project is to build an application that provides an enhanced, immersive, and interactive reading experience for technical books, articles, and documents that contain rich media (diagrams, tables, code snippets, formulas, etc.). The application should behave like a modern e-reader while offering advanced assistive features such as synchronized text-to-speech, contextual multimedia explanations, and extensible author/user-driven content.

## 2. High-Level Objectives

1. **Responsive, minimal UI** – a clean, efficient interface for web, mobile (iOS/Android), and tablet platforms.
2. **Rich media handling** – support for embedded images, code, tables, formulas, and external explanations.
3. **Assistive features** – high‑quality TTS with sync highlighting, adjustable speed, and audio controls.
4. **Dynamic explanations** – pre-recorded or on-demand videos, diagrams, or text produced by an agentic system to elaborate on sections of the book.
5. **Conversion pipeline** – backend services to ingest PDFs/ePUBs and produce a structured, app-friendly format.
6. **Extensibility** – microservices may be independently deployed, allowing the system to scale and evolve.
7. **Open content model** – a curated library of freely available books (public domain, Creative Commons, author-donated). Publishers and authors upload their own works; admins approve before publication. No paid or commercial content.

## 2.1 Additional Criteria

The following constraints have been added by the stakeholders and drive technology and design decisions:

- **Cloud services on AWS** – whenever a managed service is needed, prefer AWS offerings (S3, Lambda, ECS/Fargate, RDS, CloudFront, etc.).
- **Leverage Model Context Protocol (MCP)** – design components, especially agentic/explanation services, with MCP in mind and use available tools to integrate models and context.
- **Keep development costs low** – choose open-source libraries, caching, and serverless patterns to minimize ongoing expenses; prototype with free tiers and scale only as usage grows.
- **Local testing feasibility** – ensure every component can be run and tested locally (e.g. using Docker, localstack for AWS, or in-memory DBs) to accelerate development and reduce cloud costs during iteration.

## 3. Functional Requirements

### Reader Features
- Standard e-reader features: font selection, single/dual page layout, bookmarks, notes, comments, resume-last-read.
- TTS engine with speed control, play/pause, and synchronized text highlighting.
- In-app markers/buttons for multimedia explanations, optionally offered by authors or dynamically retrieved.
- Minimalistic UI with focus mode to minimize distractions.
- Cross-platform compatibility: modern web browsers, native mobile apps (React Native/Flutter optionally), and tablets.
- API for user preferences, annotations, and book metadata.

### Publisher / Author Features
- Self-service web portal for publishers and authors to upload freely available books (ePUB/PDF).
- Upload form captures: title, author, license type (public domain, CC-BY, CC-BY-SA, etc.), source URL, and description.
- Uploaded books enter a **pending** state; conversion runs automatically; book becomes **published** after admin approval.
- Publishers/authors can view and manage their uploaded books, update metadata, and unpublish titles.
- No payment processing, DRM, or revenue tracking — all content is freely available.

### Admin Features
- Review queue for newly uploaded books awaiting approval.
- Approve, reject (with reason), or request changes to submitted books.
- Ability to unpublish or remove any book from the catalog.

## 4. Backend Architecture

The backend will be designed as a set of cooperating services, each of which can be implemented in Java or Python depending on team preference and library support.

### 4.1 Conversion Pipeline Service

This service exposes an API endpoint (`POST /convert`) to upload a source document (PDF/ePUB). It performs the following steps:

1. **Parse input** – use libraries like Apache PDFBox / Tika (Java) or `pdfminer`, `ebooklib` (Python) to extract text, images, tables, and layout information.
2. **Segment & annotate** – identify semantic elements (headings, paragraphs, lists, code blocks, figures, tables, formulas). Produce an intermediate representation (e.g., JSON or XML).
3. **Generate media placeholders** – mark locations for TTS sync, video links, and explanation triggers.
4. **Asset extraction** – extract images/diagrams and store them in object storage (S3 or similar). Generate thumbnails if needed.
5. **Output format** – produce a package that the reader app can consume, such as a zipped directory containing:
   - `manifest.json` (structure, metadata, nav)
   - HTML/JSON pages with metadata for TTS sync
   - asset files (images, fonts, videos)
6. **Optionally**: run OCR or math recognition (MathML) for formulas.

The pipeline is triggered via the Publisher Upload API (not a manual admin CLI). The upload endpoint accepts the file and metadata, stores the raw file in S3, enqueues a conversion job, and returns a job ID the publisher can poll for status.

This pipeline might itself be subdivided into microservices:
- *Parsing service* (file handling)
- *Annotation service* (semantic analysis, maybe powered by ML for complex structures)
- *Asset manager* (storage and CDN integration)

### 4.2 Text-to-Speech Service

A standalone service that converts text segments into audio. It should support multiple voices and speed levels. Use cloud TTS APIs (e.g., Amazon Polly, Google Cloud TTS) or open-source alternatives (Mozilla TTS). The service can cache generated audio to reduce cost.

API example: `POST /tts` with text or reference to the JSON segment, returns an audio URL or base64 payload.

### 4.3 Multimedia Explanation Service

This service manages pre-recorded videos authored by content creators and/or AI‑generated explanations. It may:
- Store video/audio files and metadata.
- Provide an API to query explanations by document, page, or element ID.
- Integrate with an LLM or specialized agent to generate on-demand summaries or walkthroughs.

### 4.4 Authentication & User Management

Handles user accounts, preferences, bookmarks, annotations, and role-based access. Can be a small REST API built with Spring Boot (Java) or Django/Flask (Python) and backed by a relational database (PostgreSQL).

**User roles:**

| Role | Capabilities |
|------|-------------|
| **Reader** | Browse catalog, read books, bookmarks, annotations, preferences |
| **Publisher / Author** | All Reader capabilities + upload books, manage their own submissions |
| **Admin** | All Publisher capabilities + approve/reject/remove any book |

A user self-registers as a Reader. Publisher/Author status is granted on request (or self-selectable at registration with a flag for review). Admin is assigned manually.

### 4.5 Serving & Content Delivery

**Two distinct serving tiers:**

1. **Dynamic API** (Content Gateway) — handles anything requiring auth or business logic: book catalog listing, user preferences, bookmarks, reading progress, publisher uploads, admin actions. Served by the backend application.

2. **Static content via CDN** — book page JSON files (`pages/page_NNN.json`) and all assets (images, audio, fonts) are written to S3 at conversion time and served directly by **CloudFront**, not through the API. Since these files never change after conversion, CDN caching is maximally effective. The API returns pre-signed URLs or CDN base URLs; the frontend fetches content blocks directly from CloudFront.

This split is critical for performance and cost: a 500-page book generates 500 JSON files. Serving them through the API on every page turn wastes compute; serving from CDN is fast, cheap, and globally distributed. The API only serves truly dynamic data.

### 4.6 Storage

The backend will rely on AWS managed services to simplify operations and keep costs predictable:

- Persistent storage for converted book packages using **AWS S3** (with lifecycle rules to move cold data to Glacier).
- Relational DB for user data and metadata using **Amazon RDS (PostgreSQL)** or Aurora Serverless for cost savings. Local testing can use SQLite or a containerized Postgres instance.
- Blob store for audio/video assets on S3 with CloudFront CDN for fast delivery.
- **Redis (Phase 2+):** Not required in Phase 1. Introduced in Phase 2 for TTS audio caching (Polly results) and rate limiting on the upload endpoint. In Phase 1, CDN handles all content caching; no session or application-level caching is needed.

Every service should be configurable to use local equivalents (localstack for S3/RDS, Dockerized databases) so developers can run the full stack without incurring AWS charges.

## 5. Frontend Architecture

The reader application needs to run in browsers and mobile platforms. A shared codebase can be achieved via:

- **Web client**: Single-page application built with React or Vue. Use responsive design and adapt to reading paradigms (e.g., horizontal scroll for mobile, page flips for desktop).
- **Mobile clients**: React Native or Flutter to reuse UI components and logic. The core rendering engine may be a webview loading the same HTML/JS from the web client, providing native wrappers for device features (TTS playback, file downloads).

Key UI components:
- Book library view
- Reader view with layout controls
- Annotation panel (notes/comments)
- Audio control bar with sync highlight
- Multimedia popups or overlays for explanations

### Agent Integration

For dynamic explanation requests, client could call the Multimedia Explanation Service which either returns an existing asset or triggers generation. UI could show a modal with video or text.

## 6. Data Models

- **User**: id, email, name, password_hash, role (reader/publisher/admin), created_at.
- **Book**: id, title, author, description, license, source_url, cover image, package location, status (pending/converting/published/rejected), uploaded_by (user_id), rejection_reason, total_pages, created_at.
- **Page/Section**: id, book_id, sequence, structured content blocks (JSON), TTS sync points.
- **Asset**: id, book_id, type (image/video/audio), URL, related element id.
- **UserPreferences**: user_id, font_size, theme, tts_voice, tts_speed.
- **Annotation**: user_id, book_id, location, type (bookmark/note/comment), content.
- **Explanation**: book_id, element_id, type (video/text), URL, authoring info.
- **ConversionJob**: id, book_id, status (queued/running/done/failed), started_at, finished_at, error_message.

The `status` field on **Book** drives the publishing workflow:
- `pending` → uploaded, awaiting conversion
- `converting` → conversion job in progress
- `review` → conversion complete, awaiting admin approval
- `published` → visible in catalog to all readers
- `rejected` → admin rejected, publisher can revise and resubmit

## 7. Technology Choices

| Layer | Options | Recommendation |
|-------|---------|----------------|
| Backend languages | Java (Spring Boot), Python (FastAPI/Django) | Choose based on team expertise; use Python for rapid prototyping of conversion logic, Java for scalable services if required. |
| Frontend | React, Vue, React Native, Flutter | React + React Native for shared JS ecosystem. |
| Storage | PostgreSQL, S3, Redis for caching | Standard choice. |
| TTS | Cloud provider API or Mozilla TTS | Start with cloud for quality; allow plugin of open-source later. |
| Document parsing | Apache Tika/PDFBox, pdfminer, ebooklib | Python libraries easier for ePub, Java for PDF heavy workloads. |
| Agent/LLM | OpenAI APIs, Hugging Face, custom models | Build pluggable interface using MCP conventions; prefer AWS SageMaker or API Gateway patterns for managed endpoints. |
## 8. Development Roadmap

1. **Phase 1 – MVP**
   - Implement conversion pipeline for ePUB input with structured block output (text, images, code, headings).
   - Publisher/Author portal: upload form, conversion status tracking, book management.
   - Admin review queue: approve/reject submitted books.
   - Build simple web reader that loads converted package and displays pages.
   - Add TTS playback with synced text highlighting (browser Web Speech API for MVP).
   - Implement user management (Reader, Publisher, Admin roles) and bookmarking.

2. **Phase 2 – Enhancements**
   - Support PDF parsing, tables, formulas.
   - Upgrade TTS to AWS Polly with server-side pre-generation and caching.
   - Implement Multimedia Explanation Service and UI hooks.
   - Add mobile app using React Native.
   - Integrate agent for on-demand explanations.
   - In-book search.
   - Replace integer page position with ePUB CFI (Canonical Fragment Identifier) for reading positions — survives re-pagination and re-conversion.
   - Annotations with text selection and highlighted ranges.

3. **Phase 3 – Scaling & Refinement**
   - Microservice decomposition (if not already done), containerization using Docker/Kubernetes.
   - Full-text search across catalog.
   - Add offline reading capabilities and sync.
   - Optimize pipeline performance and caching strategies.
   - Publisher analytics: how many readers, reading progress stats (anonymized).

4. **Phase 4 – Community & Extensibility**
   - Authoring tools for creators to attach multimedia annotations to specific book sections.
   - Open API for third-party integrations.
   - Community features: public reading lists, recommendations.

## 9. Deployment and Operations

Deployment will target AWS where possible, leveraging managed and serverless offerings to minimize administrative overhead and cost:

- Use CI/CD pipelines (GitHub Actions) to build and test services, with infrastructure provisioning via Terraform or CloudFormation.
- Containerize services with Docker; orchestrate using **AWS ECS/Fargate** for microservice workloads or Lambda for lightweight serverless functions. Local development can use Docker Compose or Minikube and LocalStack for emulating AWS.
- Use **Amazon CloudFront** for CDN asset delivery and S3 for storage.
- Monitor with **AWS CloudWatch** alongside Prometheus/Grafana; centralized logging via CloudWatch Logs or ELK on AWS.
- Implement MCP-friendly interfaces in services handling context and model interaction. Use AWS SageMaker endpoints or OpenAI via networking from AWS for agentic systems.

Cost-control strategies:
- Employ AWS free-tier resources during early development.
- Cache TTS outputs and frequently accessed book data using **Elasticache (Redis)** or CloudFront caching.
- Automate shutdown of non-production environments to avoid idle spend.

Ensuring local testability is critical; use mocks and local AWS emulators to run the full stack on a developer machine without touching the cloud.
## 10. Security and Accessibility

- Enforce HTTPS and authentication (JWT/OAuth2).
- Comply with accessibility standards (ARIA) for UI.
- Ensure TTS and multimedia controls are keyboard and screen-reader friendly.
- **Screen reader / TTS conflict:** The app's TTS and a user's screen reader cannot both play audio simultaneously without confusing output. The content area must set `aria-live="off"` while TTS is active to suppress screen reader announcements of highlighted words. A visible banner informs users when TTS is suppressing screen reader output. A "Reader mode" toggle lets users choose between app TTS and their system screen reader. Test with VoiceOver and NVDA.
- File upload security: validate MIME type and file signature (not just extension) on ePUB uploads; reject files exceeding a maximum size; scan with a malware/virus check before conversion.

## 11. Conclusion

This proposal outlines a modular, scalable architecture using Java or Python for backend components and modern web/mobile front ends. Breaking the system into focused microservices enables independent scaling and iterative development, while a robust conversion pipeline ensures the reader app can handle the complex content found in technical materials. The phased roadmap allows for progressive delivery of features and fast feedback.

---

*Prepared on February 28, 2026*