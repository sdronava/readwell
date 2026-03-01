import json
import pytest
from pathlib import Path
from unittest.mock import patch


def make_book(tmp_path: Path, book_id: str, total_pages: int = 10) -> Path:
    book_dir = tmp_path / book_id
    (book_dir / "pages").mkdir(parents=True)
    (book_dir / "metadata.json").write_text(json.dumps({
        "bookId": book_id,
        "title": "Test Book",
        "author": "Test Author",
        "cover": "assets/images/cover.png",
        "totalPages": total_pages,
        "language": "en",
    }))
    (book_dir / "chapters.json").write_text(json.dumps({
        "chapters": [
            {"title": "Chapter 1", "href": "ch1.xhtml", "depth": 0},
            {"title": "Section 1.1", "href": "ch1.xhtml#s1", "depth": 1},
        ]
    }))
    for i in range(1, total_pages + 1):
        page = {
            "bookId": book_id,
            "pageNum": i,
            "chapter": "Chapter 1",
            "section": "",
            "estimatedReadingTimeSeconds": 60,
            "blocks": [
                {"type": "heading", "level": 1, "text": f"Page {i}"},
                {"type": "paragraph", "text": "Hello world.", "emphasis": []},
            ],
        }
        (book_dir / "pages" / f"page_{i:03d}.json").write_text(json.dumps(page))
    return book_dir


@pytest.fixture(autouse=True)
def patch_settings(tmp_path):
    with patch("content_gateway.local_store.settings") as mock:
        mock.books_dir = str(tmp_path)
        mock.content_base_url = "http://localhost:9000"
        yield mock


def test_list_books_empty(tmp_path):
    from content_gateway import local_store
    assert local_store.list_books() == []


def test_list_books_finds_book(tmp_path):
    from content_gateway import local_store
    make_book(tmp_path, "book_001")
    books = local_store.list_books()
    assert len(books) == 1
    assert books[0]["bookId"] == "book_001"
    assert books[0]["title"] == "Test Book"
    assert books[0]["author"] == "Test Author"
    assert books[0]["totalPages"] == 10
    assert books[0]["coverUrl"] == "http://localhost:9000/book_001/assets/images/cover.png"


def test_list_books_multiple(tmp_path):
    from content_gateway import local_store
    make_book(tmp_path, "book_001")
    make_book(tmp_path, "book_002")
    books = local_store.list_books()
    assert len(books) == 2
    assert {b["bookId"] for b in books} == {"book_001", "book_002"}


def test_list_books_skips_non_book_dirs(tmp_path):
    from content_gateway import local_store
    make_book(tmp_path, "book_001")
    # Directory without metadata.json is ignored
    (tmp_path / "not_a_book").mkdir()
    books = local_store.list_books()
    assert len(books) == 1


def test_get_metadata_found(tmp_path):
    from content_gateway import local_store
    make_book(tmp_path, "book_001")
    meta = local_store.get_metadata("book_001")
    assert meta is not None
    assert meta["bookId"] == "book_001"
    assert meta["cdnBaseUrl"] == "http://localhost:9000/book_001"
    assert meta["coverUrl"] == "http://localhost:9000/book_001/assets/images/cover.png"
    assert len(meta["tableOfContents"]) == 2
    assert meta["tableOfContents"][0]["title"] == "Chapter 1"


def test_get_metadata_not_found(tmp_path):
    from content_gateway import local_store
    assert local_store.get_metadata("nonexistent") is None


def test_get_page_found(tmp_path):
    from content_gateway import local_store
    make_book(tmp_path, "book_001", total_pages=5)
    page = local_store.get_page("book_001", 3)
    assert page is not None
    assert page["pageNum"] == 3
    assert page["bookId"] == "book_001"
    assert len(page["blocks"]) == 2


def test_get_page_not_found(tmp_path):
    from content_gateway import local_store
    make_book(tmp_path, "book_001", total_pages=5)
    assert local_store.get_page("book_001", 999) is None


def test_get_page_wrong_book(tmp_path):
    from content_gateway import local_store
    assert local_store.get_page("nonexistent", 1) is None


def test_get_metadata_no_chapters_file(tmp_path):
    from content_gateway import local_store
    book_dir = tmp_path / "book_nochapters"
    book_dir.mkdir()
    (book_dir / "metadata.json").write_text(json.dumps({
        "bookId": "book_nochapters",
        "title": "No Chapters",
        "author": "Test",
        "totalPages": 1,
    }))
    meta = local_store.get_metadata("book_nochapters")
    assert meta["tableOfContents"] == []
