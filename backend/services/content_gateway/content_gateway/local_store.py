import json
from pathlib import Path

from content_gateway.config import settings


def _books_root() -> Path:
    """Return the absolute path to the books directory."""
    return Path(settings.books_dir).resolve()


def _cdn(book_id: str) -> str:
    return f"{settings.content_base_url.rstrip('/')}/{book_id}"


def _to_catalog_entry(book_id: str, meta: dict) -> dict:
    cdn = _cdn(book_id)
    return {
        "bookId": book_id,
        "title": meta.get("title", "Unknown"),
        "author": meta.get("author", "Unknown"),
        "coverUrl": f"{cdn}/{meta.get('cover', '')}",
        "totalPages": meta.get("totalPages", 0),
        "description": meta.get("description"),
        "language": meta.get("language", "en"),
    }


def list_books() -> list[dict]:
    root = _books_root()
    if not root.exists():
        return []
    books = []
    for book_dir in sorted(root.iterdir()):
        meta_file = book_dir / "metadata.json"
        if book_dir.is_dir() and meta_file.exists():
            meta = json.loads(meta_file.read_text())
            books.append(_to_catalog_entry(book_dir.name, meta))
    return books


def get_metadata(book_id: str) -> dict | None:
    book_dir = _books_root() / book_id
    meta_file = book_dir / "metadata.json"
    if not meta_file.exists():
        return None
    meta = json.loads(meta_file.read_text())
    chapters_file = book_dir / "chapters.json"
    chapters = json.loads(chapters_file.read_text()) if chapters_file.exists() else {}
    cdn = _cdn(book_id)
    return {
        **meta,
        "cdnBaseUrl": cdn,
        "coverUrl": f"{cdn}/{meta.get('cover', '')}",
        "tableOfContents": chapters.get("chapters", []),
    }


def get_page(book_id: str, page_num: int) -> dict | None:
    path = _books_root() / book_id / "pages" / f"page_{page_num:03d}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())
