import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from content_gateway.config import settings
from content_gateway.routers import books, health

logger = logging.getLogger("content_gateway")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    books_path = Path(settings.books_dir).resolve()
    logger.info("Content Gateway starting")
    logger.info("  LOCAL_MODE       = %s", settings.local_mode)
    logger.info("  BOOKS_DIR        = %s  (resolved: %s)", settings.books_dir, books_path)
    logger.info("  CONTENT_BASE_URL = %s", settings.content_base_url)
    if not books_path.exists():
        logger.warning("  *** BOOKS_DIR does not exist — no books will be served ***")
    else:
        count = sum(1 for d in books_path.iterdir() if d.is_dir() and (d / "metadata.json").exists())
        logger.info("  Books found      = %d", count)
    yield


app = FastAPI(title="Readwell Content Gateway", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(books.router)
