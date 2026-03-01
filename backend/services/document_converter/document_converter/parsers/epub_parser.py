"""Parse ePUB files — metadata, spine content, images, and TOC."""

import hashlib
import logging
from pathlib import Path
from typing import Optional

import ebooklib
from ebooklib import epub

logger = logging.getLogger(__name__)


class EpubParser:
    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
        if not self.filepath.exists():
            raise FileNotFoundError(f"ePUB file not found: {filepath}")
        self.book = epub.read_epub(str(self.filepath))
        self._sha256_cache: Optional[str] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def sha256(self) -> str:
        if not self._sha256_cache:
            self._sha256_cache = hashlib.sha256(self.filepath.read_bytes()).hexdigest()
        return self._sha256_cache

    def extract_metadata(self) -> dict:
        def first(key: str) -> Optional[str]:
            items = self.book.get_metadata("DC", key)
            return items[0][0] if items else None

        return {
            "title": first("title") or "Unknown",
            "author": first("creator") or "Unknown",
            "publisher": first("publisher"),
            "publicationDate": first("date"),
            "language": first("language") or "en",
            "description": first("description"),
            "isbn": self._extract_isbn(),
            "rights": first("rights"),
            "cover_item_id": self._find_cover_id(),
            "sourceFile": self.filepath.name,
            "sha256": self.sha256(),
        }

    def extract_cover(self) -> Optional[tuple[str, bytes]]:
        """Return (filename, bytes) for the cover image, or None."""
        cover_id = self._find_cover_id()
        if cover_id:
            item = self.book.get_item_with_id(cover_id)
            if item and item.get_type() == ebooklib.ITEM_IMAGE:
                return item.file_name, item.get_content()

        # Fallback: first image in the book
        for item in self.book.get_items_of_type(ebooklib.ITEM_IMAGE):
            return item.file_name, item.get_content()

        return None

    def extract_content_spine(self) -> list[dict]:
        """Return spine items in reading order as [{"id", "file_name", "content"}, ...]."""
        documents = []
        for item_id, _linear in self.book.spine:
            item = self.book.get_item_with_id(item_id)
            if item is None:
                logger.warning("Spine item '%s' not found in manifest — skipping", item_id)
                continue
            try:
                content = item.get_content().decode("utf-8", errors="replace")
                documents.append(
                    {"id": item_id, "file_name": item.file_name, "content": content}
                )
            except Exception as exc:
                logger.warning("Failed to decode spine item '%s': %s", item_id, exc)
        return documents

    def extract_images(self) -> dict[str, dict]:
        """Return all images keyed by their epub item ID."""
        images: dict[str, dict] = {}
        for item in self.book.get_items_of_type(ebooklib.ITEM_IMAGE):
            images[item.get_id()] = {
                "id": item.get_id(),
                "file_name": item.file_name,
                "media_type": item.media_type,
                "data": item.get_content(),
            }
        return images

    def extract_toc(self) -> list[dict]:
        """Return flattened TOC as [{"title", "href", "depth"}, ...]."""
        return self._flatten_toc(self.book.toc)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_cover_id(self) -> Optional[str]:
        # Try OPF <meta name="cover" content="..."> first
        for meta in self.book.get_metadata("OPF", "cover"):
            attrs = meta[1] if len(meta) > 1 else {}
            cover_id = (attrs or {}).get("content")
            if cover_id:
                return cover_id

        # Fallback: item with well-known cover IDs
        for candidate in ("cover", "cover-image", "cover_image"):
            item = self.book.get_item_with_id(candidate)
            if item and item.get_type() == ebooklib.ITEM_IMAGE:
                return candidate

        return None

    def _extract_isbn(self) -> Optional[str]:
        for identifier in self.book.get_metadata("DC", "identifier"):
            value = identifier[0]
            attrs = identifier[1] if len(identifier) > 1 else {}
            scheme = (attrs or {}).get("opf:scheme", "")
            if "isbn" in scheme.lower() or "isbn" in str(value).lower():
                return str(value)
        return None

    def _flatten_toc(self, toc_items, depth: int = 0) -> list[dict]:
        result = []
        for item in toc_items:
            if isinstance(item, epub.Link):
                result.append({"title": item.title, "href": item.href, "depth": depth})
            elif isinstance(item, tuple) and len(item) == 2:
                section, children = item
                if isinstance(section, epub.Section):
                    result.append(
                        {
                            "title": section.title,
                            "href": getattr(section, "href", ""),
                            "depth": depth,
                        }
                    )
                result.extend(self._flatten_toc(children, depth + 1))
        return result
