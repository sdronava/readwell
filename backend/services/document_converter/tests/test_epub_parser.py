"""Tests for EpubParser."""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from document_converter.parsers.epub_parser import EpubParser


class TestEpubParserInit:
    def test_raises_on_missing_file(self):
        with pytest.raises(FileNotFoundError):
            EpubParser("./nonexistent_file.epub")

    def test_raises_with_helpful_message(self):
        with pytest.raises(FileNotFoundError, match="nonexistent"):
            EpubParser("./nonexistent_file.epub")


# ---------------------------------------------------------------------------
# Integration tests — skipped unless fixture EPUBs are present
# ---------------------------------------------------------------------------

SAMPLE_EPUB = Path(__file__).parent.parent.parent.parent.parent / "pubs" / "pg57359-images-3.epub"


@pytest.mark.skipif(not SAMPLE_EPUB.exists(), reason="Sample ePUB not available")
class TestEpubParserIntegration:
    @pytest.fixture(scope="class")
    def parser(self):
        return EpubParser(str(SAMPLE_EPUB))

    def test_metadata_has_required_keys(self, parser):
        meta = parser.extract_metadata()
        for key in ("title", "author", "language", "sourceFile", "sha256"):
            assert key in meta, f"Missing key: {key}"

    def test_metadata_title_not_empty(self, parser):
        assert parser.extract_metadata()["title"] != ""

    def test_sha256_is_hex_string(self, parser):
        sha = parser.sha256()
        assert len(sha) == 64
        assert all(c in "0123456789abcdef" for c in sha)

    def test_sha256_is_stable(self, parser):
        assert parser.sha256() == parser.sha256()

    def test_spine_not_empty(self, parser):
        spine = parser.extract_content_spine()
        assert len(spine) > 0

    def test_spine_items_have_content(self, parser):
        for item in parser.extract_content_spine():
            assert "id" in item
            assert "content" in item
            assert len(item["content"]) > 0

    def test_images_extracted(self, parser):
        images = parser.extract_images()
        # SAMPLE_EPUB has images in the name
        assert len(images) > 0

    def test_image_items_have_data(self, parser):
        for img in parser.extract_images().values():
            assert img["data"]
            assert img["file_name"]

    def test_toc_is_list(self, parser):
        toc = parser.extract_toc()
        assert isinstance(toc, list)
