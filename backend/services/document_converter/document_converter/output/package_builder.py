"""Assemble the final output package — JSON files written to books/{bookId}/."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from document_converter.processors.content_segmenter import estimate_reading_seconds

logger = logging.getLogger(__name__)

CONVERSION_VERSION = "1.0"


class PackageBuilder:
    def __init__(self, output_dir: str, book_id: str):
        self.output_dir = Path(output_dir)
        self.book_id = book_id
        self.pages_dir = self.output_dir / "pages"
        self.pages_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Top-level package files
    # ------------------------------------------------------------------

    def write_metadata(self, epub_metadata: dict, total_pages: int) -> None:
        data = {
            "bookId": self.book_id,
            "title": epub_metadata.get("title", "Unknown"),
            "author": epub_metadata.get("author", "Unknown"),
            "publisher": epub_metadata.get("publisher"),
            "publicationDate": epub_metadata.get("publicationDate"),
            "language": epub_metadata.get("language", "en"),
            "description": epub_metadata.get("description"),
            "isbn": epub_metadata.get("isbn"),
            "rights": epub_metadata.get("rights"),
            "cover": epub_metadata.get("cover_output_path"),
            "totalPages": total_pages,
            "sourceFormat": "epub",
            "sourceFile": epub_metadata.get("sourceFile"),
            "conversionDate": datetime.now(timezone.utc).isoformat(),
            "conversionVersion": CONVERSION_VERSION,
        }
        self._write_json("metadata.json", data)
        logger.debug("Wrote metadata.json")

    def write_manifest(
        self,
        spine: list[dict],
        page_index: list[dict],
        anchor_to_page: dict | None = None,
    ) -> None:
        data = {
            "bookId": self.book_id,
            "spine": [
                {"id": s["id"], "href": s.get("file_name", "")} for s in spine
            ],
            "fileIndex": {
                f"page_{i + 1:03d}": entry for i, entry in enumerate(page_index)
            },
            # Maps HTML element id (TOC fragment) → 1-based page number
            "anchorIndex": anchor_to_page or {},
        }
        self._write_json("manifest.json", data)
        logger.debug("Wrote manifest.json")

    def write_chapters(self, toc: list[dict]) -> None:
        data = {"bookId": self.book_id, "chapters": toc}
        self._write_json("chapters.json", data)
        logger.debug("Wrote chapters.json")

    # ------------------------------------------------------------------
    # Page files
    # ------------------------------------------------------------------

    def write_page(
        self,
        page_num: int,
        blocks: list[dict],
        chapter_title: str = "",
        section_title: str = "",
    ) -> None:
        page_data = {
            "bookId": self.book_id,
            "pageNum": page_num,
            "chapter": chapter_title,
            "section": section_title,
            "estimatedReadingTimeSeconds": estimate_reading_seconds(blocks),
            "blocks": blocks,
        }
        self._write_json(f"pages/page_{page_num:03d}.json", page_data)

    # ------------------------------------------------------------------

    def _write_json(self, relative_path: str, data: dict) -> None:
        path = self.output_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
