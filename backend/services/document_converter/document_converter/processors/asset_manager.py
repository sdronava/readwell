"""Image extraction, resizing, WebP conversion, and thumbnail generation."""

import logging
from io import BytesIO
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

RESPONSIVE_WIDTHS = [400, 800, 1200]
THUMBNAIL_SIZE = (200, 300)


class AssetManager:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.images_dir = self.output_dir / "assets" / "images"
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def save_image(self, image_data: bytes, filename: str) -> dict:
        """
        Save an image and generate responsive WebP variants.

        Returns a srcset dict:
          {"original": "assets/images/fig.png",
           "400w": "assets/images/fig_400w.webp", ...}
        """
        from PIL import Image, UnidentifiedImageError

        filepath = self.images_dir / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_bytes(image_data)

        original_rel = str(filepath.relative_to(self.output_dir))
        variants = {"original": original_rel}

        try:
            img = Image.open(BytesIO(image_data))
            img.load()
        except UnidentifiedImageError:
            logger.warning("Cannot open image '%s' — unsupported format, skipping variants", filename)
            return variants
        except Exception as exc:
            logger.warning("Failed to process image '%s': %s", filename, exc)
            return variants

        original_width = img.width

        for width in RESPONSIVE_WIDTHS:
            if original_width <= width:
                continue
            ratio = width / original_width
            resized = img.copy().resize(
                (width, int(img.height * ratio)), Image.LANCZOS
            )
            webp_path = filepath.with_name(f"{filepath.stem}_{width}w.webp")
            try:
                resized.save(webp_path, "WEBP", quality=85)
                variants[f"{width}w"] = str(webp_path.relative_to(self.output_dir))
            except Exception as exc:
                logger.warning("Failed to save %dpx WebP for '%s': %s", width, filename, exc)

        self._save_thumbnail(img, filepath)
        return variants

    def save_cover(self, image_data: bytes, original_filename: str) -> dict:
        """Save cover image with a normalised filename."""
        ext = Path(original_filename).suffix or ".jpg"
        return self.save_image(image_data, f"cover{ext}")

    # ------------------------------------------------------------------

    def _save_thumbnail(self, img, original_filepath: Path) -> Optional[str]:
        from PIL import Image

        try:
            thumb = img.copy()
            thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            thumb_path = original_filepath.with_name(f"{original_filepath.stem}_thumb.webp")
            thumb.save(thumb_path, "WEBP", quality=80)
            return str(thumb_path.relative_to(self.output_dir))
        except Exception as exc:
            logger.warning("Failed to generate thumbnail for '%s': %s", original_filepath.name, exc)
            return None
