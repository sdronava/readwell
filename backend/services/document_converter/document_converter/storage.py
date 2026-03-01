"""Storage abstraction — local filesystem or S3."""

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    @abstractmethod
    def read_bytes(self, path: str) -> bytes: ...

    @abstractmethod
    def write_bytes(self, path: str, data: bytes) -> None: ...

    @abstractmethod
    def write_text(self, path: str, text: str) -> None: ...

    @abstractmethod
    def makedirs(self, path: str) -> None: ...

    def write_json(self, path: str, data: dict) -> None:
        self.write_text(path, json.dumps(data, indent=2, ensure_ascii=False))


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: str):
        self.base = Path(base_dir)

    def _full(self, path: str) -> Path:
        return self.base / path

    def read_bytes(self, path: str) -> bytes:
        return self._full(path).read_bytes()

    def write_bytes(self, path: str, data: bytes) -> None:
        p = self._full(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def write_text(self, path: str, text: str) -> None:
        p = self._full(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def makedirs(self, path: str) -> None:
        (self.base / path).mkdir(parents=True, exist_ok=True)


class S3StorageBackend(StorageBackend):
    def __init__(self, bucket: str, prefix: str = ""):
        import boto3

        self.s3 = boto3.client("s3")
        self.bucket = bucket
        self.prefix = prefix.rstrip("/")

    def _key(self, path: str) -> str:
        return f"{self.prefix}/{path}" if self.prefix else path

    def read_bytes(self, path: str) -> bytes:
        response = self.s3.get_object(Bucket=self.bucket, Key=self._key(path))
        return response["Body"].read()

    def write_bytes(self, path: str, data: bytes) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=self._key(path), Body=data)

    def write_text(self, path: str, text: str) -> None:
        self.write_bytes(path, text.encode("utf-8"))

    def makedirs(self, path: str) -> None:
        pass  # S3 has no real directories


def get_storage(
    backend: Optional[str] = None,
    output_dir: Optional[str] = None,
    s3_bucket: Optional[str] = None,
) -> StorageBackend:
    from document_converter.config import config

    backend = backend or config.storage_backend
    if backend == "s3":
        return S3StorageBackend(s3_bucket or config.s3_bucket)
    return LocalStorageBackend(output_dir or config.books_output_dir)
