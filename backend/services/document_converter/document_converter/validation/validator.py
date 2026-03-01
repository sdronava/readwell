"""Validate an output package — structure, JSON integrity, and asset references."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

REQUIRED_FILES = ("metadata.json", "manifest.json", "chapters.json")


class PackageValidator:
    def __init__(self, package_dir: str):
        self.package_dir = Path(package_dir)

    def validate(self) -> dict:
        errors: list[str] = []
        warnings: list[str] = []

        self._check_required_files(errors)
        self._check_pages_dir(errors)
        self._check_assets(warnings)
        self._check_image_refs(warnings)

        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}

    # ------------------------------------------------------------------

    def _check_required_files(self, errors: list) -> None:
        for fname in REQUIRED_FILES:
            path = self.package_dir / fname
            if not path.exists():
                errors.append(f"Missing required file: {fname}")
            else:
                self._assert_valid_json(path, errors)

    def _check_pages_dir(self, errors: list) -> None:
        pages_dir = self.package_dir / "pages"
        if not pages_dir.exists():
            errors.append("Missing pages/ directory")
            return

        page_files = sorted(pages_dir.glob("page_*.json"))
        if not page_files:
            errors.append("No page files found in pages/")
            return

        for pf in page_files:
            try:
                data = json.loads(pf.read_text(encoding="utf-8"))
                if "blocks" not in data:
                    errors.append(f"{pf.name}: missing 'blocks' field")
                elif not isinstance(data["blocks"], list):
                    errors.append(f"{pf.name}: 'blocks' must be an array")
            except json.JSONDecodeError as exc:
                errors.append(f"Invalid JSON in {pf.name}: {exc}")

    def _check_assets(self, warnings: list) -> None:
        assets_dir = self.package_dir / "assets"
        if not assets_dir.exists():
            warnings.append("No assets/ directory — book may have no images")

    def _check_image_refs(self, warnings: list) -> None:
        pages_dir = self.package_dir / "pages"
        if not pages_dir.exists():
            return

        for pf in pages_dir.glob("page_*.json"):
            try:
                data = json.loads(pf.read_text(encoding="utf-8"))
                for block in data.get("blocks", []):
                    if block.get("type") != "image":
                        continue
                    for variant_path in block.get("srcset", {}).values():
                        full = self.package_dir / variant_path
                        if not full.exists():
                            warnings.append(
                                f"{pf.name}: image file not found: {variant_path}"
                            )
            except Exception:
                pass  # JSON errors already caught in _check_pages_dir

    def _assert_valid_json(self, path: Path, errors: list) -> None:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"Invalid JSON in {path.name}: {exc}")
