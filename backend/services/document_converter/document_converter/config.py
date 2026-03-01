"""Configuration loaded from environment variables."""

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    db_url: str = field(default_factory=lambda: os.environ.get("DB_URL", ""))
    storage_backend: str = field(default_factory=lambda: os.environ.get("STORAGE_BACKEND", "local"))
    s3_bucket: str = field(default_factory=lambda: os.environ.get("S3_BUCKET", ""))
    books_output_dir: str = field(default_factory=lambda: os.environ.get("BOOKS_OUTPUT_DIR", "./books/"))
    poll_interval_seconds: int = field(
        default_factory=lambda: int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
    )
    content_base_url: str = field(default_factory=lambda: os.environ.get("CONTENT_BASE_URL", ""))


config = Config()
