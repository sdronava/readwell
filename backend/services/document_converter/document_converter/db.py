"""Database access — update conversion job and book status."""

import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from document_converter.config import config

logger = logging.getLogger(__name__)


def get_engine():
    return create_engine(config.db_url)


@contextmanager
def db_session() -> Generator[Session, None, None]:
    engine = get_engine()
    with Session(engine) as session:
        yield session


def claim_next_job(session: Session) -> Optional[dict]:
    """
    Atomically claim the oldest queued job using SELECT FOR UPDATE SKIP LOCKED.
    Returns the job row as a dict, or None if no jobs are queued.
    """
    result = session.execute(
        text("""
            SELECT id, book_id, status, created_at
            FROM conversion_jobs
            WHERE status = 'queued'
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        """)
    ).fetchone()

    if result is None:
        return None

    job = dict(result._mapping)
    session.execute(
        text("UPDATE conversion_jobs SET status = 'running', started_at = :now WHERE id = :id"),
        {"now": datetime.now(timezone.utc), "id": job["id"]},
    )
    session.commit()
    return job


def complete_job(session: Session, job_id: int, book_id: str) -> None:
    now = datetime.now(timezone.utc)
    session.execute(
        text("UPDATE conversion_jobs SET status = 'done', finished_at = :now WHERE id = :id"),
        {"now": now, "id": job_id},
    )
    session.execute(
        text("UPDATE books SET status = 'review' WHERE book_id = :book_id"),
        {"book_id": book_id},
    )
    session.commit()
    logger.info("Job %s completed — book %s moved to review", job_id, book_id)


def fail_job(session: Session, job_id: int, book_id: str, error_message: str) -> None:
    now = datetime.now(timezone.utc)
    session.execute(
        text(
            "UPDATE conversion_jobs "
            "SET status = 'failed', finished_at = :now, error_message = :error "
            "WHERE id = :id"
        ),
        {"now": now, "error": error_message[:2000], "id": job_id},
    )
    session.execute(
        text("UPDATE books SET status = 'failed' WHERE book_id = :book_id"),
        {"book_id": book_id},
    )
    session.commit()
    logger.error("Job %s failed — book %s: %s", job_id, book_id, error_message)


def get_book(session: Session, book_id: str) -> Optional[dict]:
    result = session.execute(
        text("SELECT * FROM books WHERE book_id = :book_id"),
        {"book_id": book_id},
    ).fetchone()
    return dict(result._mapping) if result else None
