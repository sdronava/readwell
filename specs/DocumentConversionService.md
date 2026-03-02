# Document Conversion Service: Detailed Proposal

## 1. Executive Summary

The Document Conversion Service is a critical component of the Phase 1 MVP, responsible for transforming source documents (ePUB and later PDF) into a standardized, reader-friendly format that the web application can consume. This service runs as an **async background worker** triggered by publisher uploads — not a manual admin CLI. When a publisher uploads an ePUB through the portal, the API stores the file and creates a conversion job; the worker picks up that job, converts the file, and updates the book's status so an admin can review and approve it.

### Core Responsibility
Receive a conversion job (ePUB file in S3/local FS) → Extract structure, text, and media → Generate a structured block-based JSON package → Store in backend repository → Update book status to `review`.

---

## 2. Functional Requirements

### 2.1 Input Specifications

**Supported Formats (Phase 1):**
- **ePUB 3.0 and later** (initially)
- PDF (Phase 2)

**Input Source:**
- Local file system path to a valid ePUB file.
- Validation: file must exist, be readable, and have valid ePUB structure (ZIP-based format with proper manifest and spine).

### 2.2 Extraction & Processing

1. **Metadata Extraction**
   - Title, author, publisher, publication date.
   - Language, ISBN, rights information.
   - Cover image (extract and store separately).
   - Table of contents / chapter structure.

2. **Content Parsing**
   - Extract text from all content documents (OPS/.xhtml files) in spine order.
   - Identify semantic structure: chapters, sections, headings, paragraphs.
   - Preserve formatting hints: emphasis (bold/italic), lists, code blocks.
   - Extract images embedded in chapters with position and captions.

3. **Media Extraction**
   - All images (figures, diagrams, illustrations) with internal reference mapping.
   - Generate thumbnails for cover and chapter-level images.
   - Keep original resolution for detailed figures.
   - Preserve SVG diagrams if present.

4. **Segmentation & Pagination**
   - Divide content into logical pages based on:
     - Chapter boundaries (each chapter = minimum 1 page).
     - Page break hints from original ePUB encoding.
     - Configurable page depth (words per page, lines per page).
   - Generate page numbers and cross-references.

5. **Synchronization Markers (for TTS)**
   - Generate word/sentence boundaries for each page.
   - Estimate reading time per page.
   - Create timing information for future TTS sync (actual timings generated later by TTS Service).

### 2.3 Output Specifications

**Output Format: Structured Block JSON Package**

A single directory structure stored in S3 (or local FS) at `books/{bookId}/`:

```
books/{bookId}/
├── metadata.json          # Book metadata (title, author, license, etc.)
├── manifest.json          # Spine order, chapter structure, file index
├── chapters.json          # Chapter/section list (for TOC)
├── pages/
│   ├── page_001.json      # Page 1 — structured content blocks
│   ├── page_002.json
│   └── ... (one file per page)
└── assets/
    ├── images/
    │   ├── cover.jpg      # Book cover
    │   ├── fig_1_1.png
    │   └── ... (all extracted images)
    ├── thumbnails/
    │   ├── cover_thumb.jpg
    │   └── ... (optional thumbnails)
    └── fonts/
        └── ... (if any custom fonts embedded)
```

**metadata.json Example:**
```json
{
  "bookId": "f47ac10b-58cc-5372-a567-0e02b2c3d479",
  "title": "Technical Book Title",
  "author": "Author Name",
  "publisher": "Publisher Name",
  "publicationDate": "2023-01-15",
  "language": "en",
  "description": "Short description of the book...",
  "cover": "assets/images/cover.jpg",
  "totalPages": 350,
  "isbn": "978-3-16-148410-0",
  "license": "CC-BY-4.0",
  "sourceFormat": "epub",
  "sourceFile": "Technical Book Title.epub",
  "conversionDate": "2026-02-28T10:30:00Z",
  "conversionVersion": "1.0"
}
```

**manifest.json Example:**
```json
{
  "bookId": "book_001",
  "spine": [
    { "id": "ch01", "href": "content/chapter_01.xhtml" },
    { "id": "ch02", "href": "content/chapter_02.xhtml" }
  ],
  "fileIndex": {
    "page_001": { "source": "ch01", "chapterTitle": "Introduction" },
    "page_002": { "source": "ch01", "chapterTitle": "Introduction" },
    "page_003": { "source": "ch02", "chapterTitle": "Chapter 2" }
  },
  "anchorIndex": {
    "intro":    1,
    "section1": 2,
    "ch2":      3
  }
}
```

`anchorIndex` maps each HTML element `id` found in the source to its 1-based page number.  The Content Gateway uses this to resolve TOC fragment hrefs (e.g. `chapter_01.xhtml#intro`) to exact pages.

**pages/page_NNN.json Example:**
```json
{
  "bookId": "book_001",
  "pageNum": 5,
  "chapter": "Chapter 1: Introduction",
  "section": "Getting Started",
  "estimatedReadingTimeSeconds": 180,
  "blocks": [
    {
      "type": "heading",
      "level": 2,
      "text": "Getting Started"
    },
    {
      "type": "paragraph",
      "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit...",
      "emphasis": [
        { "start": 6, "end": 11, "style": "bold" }
      ]
    },
    {
      "type": "image",
      "id": "img_001_5",
      "filename": "assets/images/fig_1_1.png",
      "caption": "Figure 1.1: System Overview",
      "altText": "A diagram showing the system architecture",
      "width": 800,
      "height": 600,
      "srcset": {
        "original": "assets/images/fig_1_1.png",
        "400w": "assets/images/fig_1_1_400w.webp",
        "800w": "assets/images/fig_1_1_800w.webp"
      }
    },
    {
      "type": "code",
      "language": "python",
      "text": "def greet(name):\n    return f'Hello, {name}'"
    },
    {
      "type": "paragraph",
      "text": "The function above illustrates a simple greeting."
    }
  ]
}
```

The `blocks` array replaces the flat `text` field. Each block has a `type` that tells the frontend renderer how to display it:
- `paragraph` — normal prose text, with optional emphasis (bold/italic) ranges
- `heading` — section heading with level (1–4)
- `image` — extracted image with caption and alt text
- `code` — preformatted code block with optional language for syntax highlighting
- `table` — tabular data (Phase 2; ePUB tables deferred)
- `list` — ordered or unordered list items

The frontend TTS handler iterates blocks and skips `code` blocks (does not read code aloud), reading only `paragraph` and `heading` text.

---

## 3. Architecture & Design

### 3.1 Async Worker (Phase 1)

The conversion service runs as a **background worker process** alongside the main API. It polls the `conversion_jobs` database table for queued jobs, processes them one at a time, and updates the job and book status on completion or failure.

**Worker Loop:**
```
while True:
    job = db.query("SELECT * FROM conversion_jobs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED")
    if job:
        process_job(job)
    else:
        sleep(5)  # poll interval
```

**Job Processing:**
```
1. Mark job status = 'running', set started_at.
2. Download ePUB from S3 (or read from local FS) using book.raw_file_path.
3. Run conversion pipeline (see §3.2).
4. Write output package to S3/local FS at books/{bookId}/.
5. Update book: status = 'review', package_path = 'books/{bookId}/'.
6. Mark job status = 'done', set finished_at.
On error:
7. Mark job status = 'failed', store error_message.
8. Update book: status = 'failed'.
```

A lightweight CLI wrapper is also provided for **local developer testing** (converting sample ePUBs without going through the upload portal):

```bash
python -m document_converter.main convert ./pubs/pg57359-images-3.epub --book-id book_001 --output-dir ./books/ --verbose
```

This CLI writes directly to the output directory and does **not** interact with the database — it is for development and testing only, not the production flow.

**Worker Configuration (environment variables):**
- `DB_URL` — PostgreSQL connection string.
- `STORAGE_BACKEND` — `local` or `s3`.
- `S3_BUCKET` — S3 bucket name (if using S3).
- `BOOKS_OUTPUT_DIR` — local output path (if using local storage).
- `POLL_INTERVAL_SECONDS` — job poll interval (default: 5).

**Book ID strategy:**

The `book_id` is assigned by the API at upload time (a standard UUID v4). However, for idempotent re-conversion — where re-processing the same book should not create a duplicate entry — the conversion worker checks whether a book with the same ISBN (if present in ePUB metadata) or the same SHA-256 hash of the raw ePUB file already exists in the database. If a match is found, the worker updates the existing book record rather than creating a new one.

This means:
- Re-uploading the same file → same book record updated, not duplicated.
- Re-uploading a revised edition → different SHA-256 → treated as a new book (publisher can link it to the original via `source_url`).

### 3.2 Core Components

#### Component 1: Document Parser
**Responsibility:** Read and parse ePUB file structure.

**Implementation (Python):**
```python
from ebooklib import epub
from pathlib import Path

class EpubParser:
    def __init__(self, filepath):
        self.filepath = Path(filepath)
        self.book = epub.read_epub(self.filepath)
    
    def extract_metadata(self):
        """Extract title, author, cover, etc."""
        return {
            "title": self.book.get_metadata('DC', 'title')[0][0] if self.book.get_metadata('DC', 'title') else "Unknown",
            "author": self.book.get_metadata('DC', 'creator')[0][0] if self.book.get_metadata('DC', 'creator') else "Unknown",
            # ... more fields
        }
    
    def extract_content_spine(self):
        """Extract text from spine in order."""
        documents = []
        for item in self.book.spine:
            if item[0] != 'ncx':
                chapter = self.book.get_item_with_id(item[0])
                content = chapter.get_content().decode('utf-8')
                documents.append({"id": item[0], "content": content})
        return documents
    
    def extract_images(self):
        """Extract all images and their metadata."""
        images = {}
        for item in self.book.get_items():
            if item.get_type() == 9:  # Image type
                images[item.get_id()] = {
                    "data": item.get_content(),
                    "type": item.get_type()
                }
        return images
```

#### Component 2: Content Segmenter
**Responsibility:** Parse HTML/XML content, identify structure, segment into pages.

**Implementation (Python):**
```python
from html.parser import HTMLParser
from bs4 import BeautifulSoup

class ContentSegmenter:
    def __init__(self, html_content, page_length=500):
        self.html = html_content
        self.page_length = page_length
        self.soup = BeautifulSoup(html_content, 'html.parser')
    
    def extract_text_and_structure(self):
        """Parse HTML and extract semantic elements."""
        elements = []
        for elem in self.soup.find_all(['h1', 'h2', 'h3', 'p', 'pre', 'img', 'figcaption']):
            elements.append({
                "type": elem.name,
                "text": elem.get_text(strip=True),
                "attributes": dict(elem.attrs)
            })
        return elements
    
    def paginate(self, elements):
        """Divide content into pages based on word count."""
        pages = []
        current_page = []
        word_count = 0
        
        for elem in elements:
            elem_words = len(elem["text"].split())
            if word_count + elem_words > self.page_length and current_page:
                pages.append(current_page)
                current_page = []
                word_count = 0
            current_page.append(elem)
            word_count += elem_words
        
        if current_page:
            pages.append(current_page)
        
        return pages
```

#### Component 3: Asset Manager
**Responsibility:** Extract, optimize, and store images — including responsive variants for efficient delivery on different screen sizes.

**Responsive image strategy:**

Technical books often contain large, high-resolution diagrams. Serving a 5 MB figure to a mobile browser is wasteful and slow. The asset manager generates multiple width variants and converts to WebP format (with the original format as fallback for browsers that don't support WebP):

| Variant | Max width | Use |
|---|---|---|
| `cover_thumb` | 200px | Library grid view |
| `400w.webp` | 400px | Mobile portrait |
| `800w.webp` | 800px | Tablet / desktop narrow |
| `1200w.webp` | 1200px | Desktop full-width (default max) |
| `original` | as-is | Fallback + zoom/lightbox view |

The frontend uses `<img srcset="...">` so the browser picks the appropriate size. The `image` block in the page JSON includes a `srcset` field listing all generated variants.

**Implementation (Python):**
```python
from PIL import Image

RESPONSIVE_WIDTHS = [400, 800, 1200]
THUMBNAIL_SIZE = (200, 300)

class AssetManager:
    def __init__(self, output_dir):
        self.output_dir = Path(output_dir)
        self.images_dir = self.output_dir / "assets" / "images"
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def save_image(self, image_data, filename):
        """Save original image and generate responsive variants."""
        filepath = self.images_dir / filename
        with open(filepath, 'wb') as f:
            f.write(image_data)

        img = Image.open(filepath)
        original_width = img.width
        variants = {"original": str(filepath.relative_to(self.output_dir))}

        for width in RESPONSIVE_WIDTHS:
            if original_width > width:
                resized = img.copy()
                ratio = width / original_width
                resized = resized.resize((width, int(img.height * ratio)), Image.LANCZOS)
                webp_path = filepath.with_name(f"{filepath.stem}_{width}w.webp")
                resized.save(webp_path, "WEBP", quality=85)
                variants[f"{width}w"] = str(webp_path.relative_to(self.output_dir))

        self._generate_thumbnail(img, filepath)
        return variants  # returned and stored in the image block's srcset field

    def _generate_thumbnail(self, img, original_filepath):
        thumb = img.copy()
        thumb.thumbnail(THUMBNAIL_SIZE)
        thumb_path = original_filepath.with_name(f"{original_filepath.stem}_thumb.webp")
        thumb.save(thumb_path, "WEBP", quality=80)
```

The returned `variants` dict is embedded in the image block's `srcset` field in `page_NNN.json`, so the frontend can construct the appropriate `<img srcset>` element without any additional API calls.

#### Component 4: Sync Marker Generator — Deferred to Phase 2

**Not implemented in Phase 1.** In Phase 1, TTS is entirely client-side via the browser's Web Speech API, which fires its own `boundary` events for word/sentence highlighting. No server-side sync markers are needed.

**Phase 2 note:** When AWS Polly is introduced, the Polly API returns [Speech Marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html) (SSML) containing precise word timing (in milliseconds) alongside the audio stream. The TTS service will request both the MP3 and its Speech Marks JSON from Polly, storing them together in the TTS cache. These Polly-provided timings replace any server-generated approximations.

**Why the original approach was flawed:** A naive `text.find(word, pos)` implementation breaks on punctuation attached to words (`"word."` won't match `"word"`), duplicate words finding wrong occurrences, and contractions. The correct Phase 2 approach is to use Polly's Speech Marks directly — they are authoritative timing data aligned to the actual synthesized audio.

#### Component 5: Validator
**Responsibility:** Validate output package structure and content.

**Implementation (Python):**
```python
class PackageValidator:
    def __init__(self, package_dir):
        self.package_dir = Path(package_dir)
    
    def validate(self):
        """Run all validation checks."""
        errors = []
        warnings = []
        
        # Check required files
        required_files = ['metadata.json', 'manifest.json', 'chapters.json']
        for f in required_files:
            if not (self.package_dir / f).exists():
                errors.append(f"Missing required file: {f}")
        
        # Check pages directory
        pages_dir = self.package_dir / 'pages'
        if not pages_dir.exists():
            errors.append("Missing pages directory")
        else:
            page_count = len(list(pages_dir.glob('*.json')))
            if page_count == 0:
                errors.append("No pages found in pages directory")
        
        # Check assets
        assets_dir = self.package_dir / 'assets'
        if not assets_dir.exists():
            warnings.append("No assets directory found")
        
        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
```

### 3.3 Conversion Workflow

```
Conversion Job (triggered by publisher upload)
    ↓
[1] Fetch ePUB from S3/local FS
    ↓
[2] Validate Input (file exists, valid ePUB structure)
    ↓
[3] Parse Metadata (title, author, cover, language, etc.)
    ↓
[4] Extract Content Spine (chapters in order)
    ↓
[5] Extract Images & Media
    ↓
[6] Parse HTML/XML Content → Structured Blocks
    │   (paragraph, heading, code, image, list — NOT flat text)
    ↓
[7] Segment into Pages (semantic-aware: never break mid-code-block or mid-table)
    ↓
[8] Create Output Package Structure (books/{bookId}/)
    ↓
[9] Write Metadata Files (metadata.json, manifest.json, chapters.json)
    ↓
[10] Write Page Files (pages/page_NNN.json with blocks[])
    ↓
[11] Copy/Optimize Assets (images → assets/images/, thumbnails → assets/thumbnails/)
    ↓
[12] Validate Output Package
    ↓
[13] Upload package to S3 (if cloud storage)
    ↓
[14] Update book status → 'review', update job status → 'done'
    ↓
Output: Book awaiting admin approval
```

---

## 4. Project Structure (Phase 1)

```
backend/
├── services/
│   └── document_converter/
│       ├── __init__.py
│       ├── worker.py                  # Async worker entry point (polls DB, runs jobs)
│       ├── main.py                    # CLI entry point (dev/testing only)
│       ├── config.py                  # Configuration (DB URL, storage backend, etc.)
│       ├── db.py                      # Database access (update job/book status)
│       ├── storage.py                 # Storage abstraction (local FS or S3)
│       ├── parsers/
│       │   ├── __init__.py
│       │   └── epub_parser.py         # ePUB parsing logic
│       ├── processors/
│       │   ├── __init__.py
│       │   ├── block_builder.py       # HTML → structured content blocks
│       │   ├── content_segmenter.py   # Semantic-aware pagination (never breaks mid-block)
│       │   └── asset_manager.py       # Image extraction, resizing, WebP conversion
│       ├── output/
│       │   ├── __init__.py
│       │   └── package_builder.py     # Assemble final output package
│       ├── validation/
│       │   ├── __init__.py
│       │   └── validator.py           # Output package validation
│       ├── utils/
│       │   ├── __init__.py
│       │   └── logger.py              # Logging utilities
│       ├── tests/
│       │   ├── __init__.py
│       │   ├── fixtures/              # Sample ePUBs for testing
│       │   ├── test_epub_parser.py
│       │   ├── test_block_builder.py
│       │   ├── test_segmenter.py
│       │   └── test_validator.py
│       ├── requirements.txt
│       ├── setup.py
│       └── README.md                  # Service documentation
└── ...
```

---

## 5. Dependencies & Technology Stack

### Python Libraries
- **ebooklib** (>=0.17): Parse ePUB files.
- **BeautifulSoup4** (>=4.9): Parse HTML content.
- **Pillow** (>=8.0): Image processing (resizing, format conversion).
- **lxml** (>=4.6): Fast XML parsing.
- **pydantic** (>=1.8): Data validation.
- **click** (>=8.0): CLI framework (alternative: argparse).
- **tqdm** (>=4.50): Progress bars.
- **pytest** (>=6.0): Unit testing.
- **pytest-cov** (>=2.10): Code coverage.

**Installation:**
```bash
cd backend/services/document_converter
pip install -r requirements.txt
```

**requirements.txt:**
```
ebooklib>=0.17
beautifulsoup4>=4.9
Pillow>=10.0          # 10+ includes built-in WebP save support
lxml>=4.6
pydantic>=2.0
sqlalchemy>=2.0       # For worker DB access
boto3>=1.26           # For S3 storage backend
click>=8.0
tqdm>=4.50
pytest>=7.0
pytest-cov>=4.0
```

Note: WebP encoding via Pillow requires `libwebp` to be installed on the system. The Docker image should be based on `python:3.10-slim` with `apt-get install -y libwebp-dev`.

---

## 6. Detailed API / Interface Specification

### 6.1 Command-Line Interface

**Main Command:**
```bash
python -m document_converter.main convert <input> [options]
```

**Positional Arguments:**
- `input`: Path to input ePUB file.

**Optional Arguments:**
- `--output-dir`, `-o`: Output directory (default: `./books/`).
- `--book-id`, `-b`: Unique book identifier (default: auto-generated from filename).
- `--page-length`, `-p`: Target words per page (default: 500).
- `--format`, `-f`: Output format: `json`, `zip`, or `both` (default: `json`).
- `--extract-images`: Extract images (default: true). Use `--no-extract-images` to skip.
- `--generate-thumbnails`: Generate thumbnails (default: true).
- `--validate`: Validate output (default: true).
- `--verbose`, `-v`: Verbose logging (default: false).
- `--dry-run`: Simulate without writing (default: false).
- `--help`, `-h`: Show help message.

**Output Examples:**

```bash
# Basic conversion
$ python -m document_converter.main convert ./pubs/book.epub
Processing: book.epub
✓ Metadata extracted
✓ Content parsed
✓ 15 images extracted
✓ Paginated into 350 pages
✓ Sync markers generated
✓ Package validated
✓ Output saved to: ./books/book_001/

# With options
$ python -m document_converter.main convert ./pubs/book.epub -o ./output -b my_book -p 300 -f zip --verbose
[INFO] Reading ePUB file: ./pubs/book.epub
[INFO] Extracting metadata...
[INFO] Title: My Technical Book
[INFO] Author: John Doe
[INFO] Parsing spine (5 chapters)...
[INFO] Processing chapter 1... (2500 words, 8 images)
[INFO] Processing chapter 2... (3200 words, 5 images)
...
[INFO] Paginated into 350 pages (avg 300 words/page)
[INFO] Generated 350 page files
[INFO] Validating package...
[INFO] All checks passed
[INFO] Creating zip archive...
✓ Conversion complete! Output: ./output/my_book.zip (45 MB)
```

### 6.2 Python API (for future REST service)

**For Phase 2+, the CLI tool will be wrapped in a REST API:**

```python
from document_converter import DocumentConverter

converter = DocumentConverter()
config = {
    "input_path": "./pubs/book.epub",
    "output_dir": "./books/",
    "book_id": "book_001",
    "page_length": 500,
    "extract_images": True,
    "validate": True
}

result = converter.convert(**config)
print(result)  # {"status": "success", "book_id": "book_001", "pages": 350, ...}
```

---

## 7. Error Handling & Validation

### 7.1 Input Validation

| Error | Handling |
|-------|----------|
| File not found | Exit with code 1, clear error message. |
| Invalid ePUB structure | Exit with code 2, list missing files. |
| Corrupted ZIP | Exit with code 3, suggest file integrity check. |
| Unsupported ePUB version | Exit with code 2, suggest conversion tool. |
| Insufficient disk space | Exit with code 3, show required space. |

### 7.2 Processing Validation

- Check for missing chapters in spine.
- Warn if images cannot be extracted.
- Warn if HTML parsing fails on specific sections.
- Log details of any skipped content.

### 7.3 Output Validation

- Verify all page files are valid JSON.
- Ensure all image references point to existing files.
- Check metadata completeness.
- Validate sync markers don't exceed text boundaries.

---

## 8. Performance Benchmarks

**Target Performance (on MacBook Pro 16-inch, M1 Pro):**

| Metric | Target |
|--------|--------|
| Parsing metadata | <1 second |
| Extracting content (500-page book) | <5 seconds |
| Paginating (500 pages) | <2 seconds |
| Extracting images (50 images, ~2 MB total) | <3 seconds |
| Generating sync markers | <2 seconds |
| Output writing | <3 seconds |
| **Total conversion time** | **~15 seconds** |

**Memory Usage:**
- Small ePUB (50 pages): <100 MB
- Medium ePUB (500 pages): <500 MB
- Large ePUB (1000+ pages): <1 GB

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test Files:**
- `test_epub_parser.py`: Test metadata extraction, spine parsing, image extraction.
- `test_content_segmenter.py`: Test pagination, semantic structure parsing.
- `test_asset_manager.py`: Test image saving, thumbnail generation.
- `test_sync_markers.py`: Test word/sentence boundary generation.
- `test_validator.py`: Test output package validation.

**Example Test:**
```python
import pytest
from document_converter.parsers.epub_parser import EpubParser

def test_extract_metadata():
    parser = EpubParser("./tests/fixtures/sample.epub")
    metadata = parser.extract_metadata()
    assert metadata["title"] == "Sample Book"
    assert metadata["author"] == "Test Author"
    assert "cover" in metadata

def test_invalid_file():
    with pytest.raises(FileNotFoundError):
        EpubParser("./nonexistent.epub")
```

### 9.2 Integration Tests

- Convert sample ePUBs from `/pubs` folder.
- Verify output package structure.
- Check all assets are present.
- Validate JSON schema for all output files.
- Spot-check page content accuracy.

### 9.3 Test Data

**Sample ePUBs for testing:**
- `tests/fixtures/simple.epub` – small, simple structure.
- `tests/fixtures/complex.epub` – chapters, images, nested structure.
- `tests/fixtures/with_code.epub` – code blocks and special formatting.
- Live samples from `/pubs` folder.

**Run Tests:**
```bash
pytest tests/ -v --cov=document_converter
```

---

## 10. Deployment & Usage (Phase 1)

### 10.1 Local Development

```bash
# Clone repo
git clone <repo>
cd backend/services/document_converter

# Install dependencies
pip install -r requirements.txt

# Option A: Test conversion via CLI (dev/testing only, no DB interaction)
python -m document_converter.main convert ../../pubs/pg57359-images-3.epub -o ../../books/ -b book_001 -v

# Option B: Run the async worker (requires DB running via docker-compose)
STORAGE_BACKEND=local BOOKS_OUTPUT_DIR=../../books/ DB_URL=postgresql://... python -m document_converter.worker

# Run tests
pytest tests/ -v
```

### 10.2 Docker Packaging (Optional)

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY backend/services/document_converter /app

RUN pip install -r requirements.txt

ENTRYPOINT ["python", "-m", "document_converter.main"]
```

**Usage:**
```bash
docker build -t converter .
docker run -v /path/to/books:/app/books converter convert /path/to/book.epub -o /app/books
```

### 10.3 Integration with Backend Services

The conversion service integrates with the main backend API via the database. The API creates a `conversion_jobs` record; the worker picks it up:

```python
# Backend API (FastAPI example) — Publisher upload endpoint
@app.post("/api/v1/publisher/books/upload")
async def upload_book(file: UploadFile, metadata: BookMetadata, user=Depends(require_publisher)):
    # Save uploaded ePUB to storage
    raw_path = await storage.save_upload(file, prefix="uploads/")
    # Create book record
    book = await db.create_book(
        title=metadata.title, author=metadata.author,
        license=metadata.license, source_url=metadata.source_url,
        description=metadata.description,
        uploaded_by=user.user_id, raw_file_path=raw_path,
        status="converting"
    )
    # Enqueue conversion job
    await db.create_conversion_job(book_id=book.book_id, status="queued")
    return {"bookId": book.book_id, "status": "converting"}
```

The worker runs independently and does not call the API — it reads and writes the DB directly.

---

## 11. Future Enhancements (Post-MVP)

### Phase 2
- PDF parsing support.
- REST API wrapper for on-demand conversion.
- Batch conversion support.
- Advanced image recognition (captions, tables extraction).
- Formula/MathML extraction and processing.
- Code syntax highlighting detection.
- Preview generation (first page thumbnail).

### Phase 3
- Distributed processing (convert large books in parallel).
- Cloud storage integration (S3 upload direct).
- Webhook callbacks on conversion completion.
- Progress tracking and resume capability.
- Incremental conversion (update existing packages).
- Quality metrics and statistics.

### Phase 4+
- Author/Publisher tools to add metadata and multimedia.
- DRM and rights management support.
- Multi-language processing.
- Machine learning-based structure understanding.
- Interactive asset tagging.

---

## 12. Success Criteria for Phase 1

✅ **Must Have:**
1. Successfully convert sample ePUBs from `/pubs` folder.
2. Generate complete, valid output package structure.
3. Preserve all text content without loss.
4. Extract and store all images correctly.
5. Create valid JSON for all output files.
6. CLI tool works standalone without backend services.
7. Clear error messages and logging.
8. Unit tests with >80% coverage.

✅ **Should Have:**
9. Generate thumbnails for images.
10. Produce detailed validation report.
11. Performance <20 seconds for typical 500-page book.
12. Docker packaging for reproducibility.

✅ **Nice to Have:**
13. Progress bar for long operations.
14. Dry-run mode for testing.
15. Detailed conversion statistics.

---

## 13. Risks & Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Complex ePUB structures | Medium | Test on diverse samples early; use robust parsing libraries. |
| Image extraction failures | Low | Handle corruption gracefully; log errors; allow skip option. |
| Memory for large books | Low | Stream processing; chunked reads where possible. |
| Encoding issues | Medium | Detect and handle UTF-8, Latin-1, etc.; fallback to lossy conversion. |
| Performance degradation | Low | Profile early; optimize bottlenecks; cache parsed results. |

---

## 14. References & Resources

- **ePUB Specification**: https://www.w3.org/publishing/epub32/
- **ebooklib Documentation**: https://docs.kolibri.org/en/latest/librarian/ebooklib.html
- **BeautifulSoup4**: https://www.crummy.com/software/BeautifulSoup/
- **Pillow (PIL)**: https://pillow.readthedocs.io/
- **Click CLI Framework**: https://click.palletsprojects.com/

---

## 15. Getting Started Checklist

- [ ] Create `backend/services/document_converter/` directory structure.
- [ ] Write abstract from this proposal into `DESIGN.md`.
- [ ] Initialize Python project with `setup.py` and `requirements.txt`.
- [ ] Implement `storage.py` (local FS + S3 abstraction).
- [ ] Implement `db.py` (job/book status updates).
- [ ] Implement `epub_parser.py`.
- [ ] Implement `block_builder.py` (HTML → structured blocks).
- [ ] Implement `content_segmenter.py` (semantic-aware: never break mid-code-block or mid-list).
- [ ] Implement `asset_manager.py` (image extraction, thumbnail, responsive WebP variants).
- [ ] Implement `package_builder.py`.
- [ ] Implement `validator.py`.
- [ ] Write `worker.py` (async job polling loop — production entry point).
- [ ] Write `main.py` (CLI entry point — dev/testing only).
- [ ] Write unit tests for each module.
- [ ] Test on sample ePUBs from `/pubs` (via CLI).
- [ ] Test worker end-to-end with DB (via docker-compose).
- [ ] Document usage in `README.md`.
- [ ] Set up GitHub Actions for CI/testing.
- [ ] Create demo/walkthrough for team.

---

*Document Conversion Service Proposal – February 28, 2026*
