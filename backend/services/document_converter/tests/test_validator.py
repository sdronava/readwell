"""Tests for PackageValidator."""

import json
import pytest
from pathlib import Path

from document_converter.validation.validator import PackageValidator


# ---------------------------------------------------------------------------
# Fixture: minimal valid package
# ---------------------------------------------------------------------------

@pytest.fixture
def valid_package(tmp_path: Path) -> Path:
    (tmp_path / "pages").mkdir()

    (tmp_path / "metadata.json").write_text(
        json.dumps({"bookId": "test", "title": "Test Book", "totalPages": 1})
    )
    (tmp_path / "manifest.json").write_text(
        json.dumps({"bookId": "test", "spine": [], "fileIndex": {}})
    )
    (tmp_path / "chapters.json").write_text(
        json.dumps({"bookId": "test", "chapters": []})
    )
    (tmp_path / "pages" / "page_001.json").write_text(
        json.dumps({
            "bookId": "test",
            "pageNum": 1,
            "blocks": [{"type": "paragraph", "text": "Hello world"}],
        })
    )
    return tmp_path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestValidPackage:
    def test_valid_package_passes(self, valid_package):
        result = PackageValidator(str(valid_package)).validate()
        assert result["valid"] is True
        assert result["errors"] == []

    def test_no_assets_dir_is_warning_not_error(self, valid_package):
        result = PackageValidator(str(valid_package)).validate()
        assert result["valid"] is True
        assert any("asset" in w.lower() or "image" in w.lower() for w in result["warnings"])


class TestMissingRequiredFiles:
    @pytest.mark.parametrize("fname", ["metadata.json", "manifest.json", "chapters.json"])
    def test_missing_required_file(self, valid_package, fname):
        (valid_package / fname).unlink()
        result = PackageValidator(str(valid_package)).validate()
        assert not result["valid"]
        assert any(fname in e for e in result["errors"])


class TestPagesDirectory:
    def test_missing_pages_dir(self, tmp_path):
        (tmp_path / "metadata.json").write_text("{}")
        (tmp_path / "manifest.json").write_text("{}")
        (tmp_path / "chapters.json").write_text("{}")
        result = PackageValidator(str(tmp_path)).validate()
        assert not result["valid"]
        assert any("pages" in e.lower() for e in result["errors"])

    def test_empty_pages_dir(self, valid_package):
        for f in (valid_package / "pages").glob("*.json"):
            f.unlink()
        result = PackageValidator(str(valid_package)).validate()
        assert not result["valid"]
        assert any("page" in e.lower() for e in result["errors"])

    def test_invalid_json_page(self, valid_package):
        (valid_package / "pages" / "page_001.json").write_text("not valid json {{{")
        result = PackageValidator(str(valid_package)).validate()
        assert not result["valid"]

    def test_page_missing_blocks_field(self, valid_package):
        (valid_package / "pages" / "page_001.json").write_text(
            json.dumps({"bookId": "test", "pageNum": 1})
        )
        result = PackageValidator(str(valid_package)).validate()
        assert not result["valid"]
        assert any("blocks" in e for e in result["errors"])

    def test_blocks_must_be_array(self, valid_package):
        (valid_package / "pages" / "page_001.json").write_text(
            json.dumps({"bookId": "test", "pageNum": 1, "blocks": "not a list"})
        )
        result = PackageValidator(str(valid_package)).validate()
        assert not result["valid"]


class TestImageRefs:
    def test_missing_image_file_is_warning(self, valid_package):
        (valid_package / "pages" / "page_001.json").write_text(
            json.dumps({
                "bookId": "test",
                "pageNum": 1,
                "blocks": [{
                    "type": "image",
                    "src": "fig.png",
                    "srcset": {"original": "assets/images/fig.png"},
                }],
            })
        )
        result = PackageValidator(str(valid_package)).validate()
        # Valid but should warn about missing file
        assert result["valid"] is True
        assert any("fig.png" in w for w in result["warnings"])

    def test_present_image_file_no_warning(self, valid_package, tmp_path):
        img_dir = valid_package / "assets" / "images"
        img_dir.mkdir(parents=True)
        (img_dir / "fig.png").write_bytes(b"\x89PNG\r\n")

        (valid_package / "pages" / "page_001.json").write_text(
            json.dumps({
                "bookId": "test",
                "pageNum": 1,
                "blocks": [{
                    "type": "image",
                    "src": "fig.png",
                    "srcset": {"original": "assets/images/fig.png"},
                }],
            })
        )
        result = PackageValidator(str(valid_package)).validate()
        assert not any("fig.png" in w for w in result["warnings"])
