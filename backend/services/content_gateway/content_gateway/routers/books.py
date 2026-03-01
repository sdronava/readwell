from fastapi import APIRouter, HTTPException

from content_gateway.config import settings
from content_gateway import local_store

router = APIRouter(prefix="/api/v1")


def _store():
    return local_store


@router.get("/books")
def list_books():
    return {"books": _store().list_books()}


@router.get("/books/{book_id}/metadata")
def book_metadata(book_id: str):
    data = _store().get_metadata(book_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Book not found: {book_id}")
    return data


@router.get("/books/{book_id}/chapters")
def book_chapters(book_id: str):
    data = _store().get_metadata(book_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Book not found: {book_id}")
    return {"bookId": book_id, "chapters": data.get("tableOfContents", [])}


@router.get("/books/{book_id}/pages/{page_num}")
def book_page(book_id: str, page_num: int):
    page = _store().get_page(book_id, page_num)
    if page is None:
        raise HTTPException(status_code=404, detail=f"Page {page_num} not found in book {book_id}")
    return page
