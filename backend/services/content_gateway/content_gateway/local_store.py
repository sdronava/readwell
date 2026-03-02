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
    toc = chapters.get("chapters", [])
    toc = _enrich_toc_with_page_nums(book_dir, toc)
    return {
        **meta,
        "cdnBaseUrl": cdn,
        "coverUrl": f"{cdn}/{meta.get('cover', '')}",
        "tableOfContents": toc,
    }


def _enrich_toc_with_page_nums(book_dir: Path, toc: list[dict]) -> list[dict]:
    """Add pageNum to each TOC entry by matching its href to manifest.json.

    Resolution order:
    1. anchorIndex — maps the href fragment (e.g. ``pgepubid00003``) directly
       to the page number recorded during conversion.  Most accurate; handles
       books where all chapters are in a single spine item.
    2. Spine-level fallback — strips the fragment, matches the spine file href
       to a spine id, then returns the first page whose source equals that id.
    3. Page 1 — when nothing matches.
    """
    manifest_file = book_dir / "manifest.json"
    if not manifest_file.exists():
        return [{**ch, "pageNum": 1} for ch in toc]

    manifest = json.loads(manifest_file.read_text())

    # Fragment id → page number (built at conversion time)
    anchor_index: dict[str, int] = manifest.get("anchorIndex", {})

    # spine href → spine id  (e.g. "ch01.xhtml" → "chapter-1")
    href_to_spine_id: dict[str, str] = {
        item["href"]: item["id"] for item in manifest.get("spine", [])
    }

    # spine id → first page number
    spine_to_first_page: dict[str, int] = {}
    for page_key, page_info in manifest.get("fileIndex", {}).items():
        source = page_info.get("source", "")
        if source and source not in spine_to_first_page:
            spine_to_first_page[source] = int(page_key.replace("page_", ""))

    enriched = []
    for ch in toc:
        href = ch.get("href", "")
        fragment = href.split("#")[1] if "#" in href else ""
        file_part = href.split("#")[0]

        if fragment and fragment in anchor_index:
            # Precise match via anchor recorded during conversion
            page_num = anchor_index[fragment]
        else:
            # Fall back to first page of the spine item
            spine_id = href_to_spine_id.get(file_part)
            page_num = spine_to_first_page.get(spine_id, 1) if spine_id else 1

        enriched.append({**ch, "pageNum": page_num})
    return enriched


def get_page(book_id: str, page_num: int) -> dict | None:
    path = _books_root() / book_id / "pages" / f"page_{page_num:03d}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())
