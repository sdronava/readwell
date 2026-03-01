"""
Async background worker — polls the DB for queued conversion jobs and runs them.

Production entry point:
    python -m document_converter.worker
or:
    STORAGE_BACKEND=local BOOKS_OUTPUT_DIR=../../books/ DB_URL=postgresql://... \
        python -m document_converter.worker
"""

import logging
import time

from document_converter.config import config
from document_converter.converter import DocumentConverter
from document_converter.db import claim_next_job, complete_job, fail_job, get_book, db_session
from document_converter.utils.logger import setup_logging

logger = logging.getLogger(__name__)


def run_worker() -> None:
    setup_logging()
    logger.info("Document Conversion Worker starting")
    logger.info("  storage_backend  : %s", config.storage_backend)
    logger.info("  books_output_dir : %s", config.books_output_dir)
    logger.info("  poll_interval    : %ds", config.poll_interval_seconds)

    converter = DocumentConverter()

    while True:
        job_id: int | None = None
        book_id: str | None = None

        try:
            with db_session() as session:
                job = claim_next_job(session)

                if not job:
                    time.sleep(config.poll_interval_seconds)
                    continue

                job_id = job["id"]
                book_id = job["book_id"]
                logger.info("Processing job %s for book %s", job_id, book_id)

                book = get_book(session, str(book_id))
                if not book:
                    raise RuntimeError(f"Book record not found for book_id={book_id}")

                raw_path = book["raw_file_path"]

                result = converter.convert(
                    input_path=raw_path,
                    output_dir=config.books_output_dir,
                    book_id=str(book_id),
                )

                complete_job(session, job_id, str(book_id))
                logger.info(
                    "Job %s done — %d pages generated", job_id, result.get("pages", 0)
                )

        except Exception as exc:
            logger.error("Job %s failed: %s", job_id, exc, exc_info=True)
            if job_id is not None and book_id is not None:
                try:
                    with db_session() as session:
                        fail_job(session, job_id, str(book_id), str(exc))
                except Exception as db_exc:
                    logger.error("Failed to mark job as failed in DB: %s", db_exc)

            time.sleep(config.poll_interval_seconds)


if __name__ == "__main__":
    run_worker()
