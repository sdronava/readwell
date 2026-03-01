"""DocumentConverter — orchestrates the full ePUB → JSON package pipeline."""

import logging
import re
from pathlib import Path
from typing import Optional

from document_converter.parsers.epub_parser import EpubParser
from document_converter.processors.asset_manager import AssetManager
from document_converter.processors.block_builder import BlockBuilder
from document_converter.processors.content_segmenter import ContentSegmenter
from document_converter.output.package_builder import PackageBuilder
from document_converter.validation.validator import PackageValidator

logger = logging.getLogger(__name__)


class DocumentConverter:
    """
    Convert a single ePUB file into a structured JSON package.

    Usage::

        from document_converter import DocumentConverter
        result = DocumentConverter().convert("./book.epub", "./books/", book_id="book_001")
    """

    def convert(
        self,
        input_path: str,
        output_dir: str,
        book_id: Optional[str] = None,
        page_length: int = 500,
        extract_images: bool = True,
        generate_thumbnails: bool = True,
        validate: bool = True,
        dry_run: bool = False,
    ) -> dict:
        """
        Run the conversion pipeline.

        Returns a result dict with keys:
          status, book_id, pages, images, output_dir, validation
        """
        input_path = Path(input_path)
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if not book_id:
            book_id = self._slug(input_path)

        book_output_dir = Path(output_dir) / book_id
        logger.info("Converting '%s' → %s", input_path.name, book_output_dir)

        # ── 1. Parse ePUB ──────────────────────────────────────────────
        parser = EpubParser(str(input_path))
        metadata = parser.extract_metadata()
        spine = parser.extract_content_spine()
        toc = parser.extract_toc()
        images = parser.extract_images() if extract_images else {}

        logger.info(
            "Parsed: '%s' by %s  |  %d spine items, %d images",
            metadata["title"], metadata["author"], len(spine), len(images),
        )

        if dry_run:
            return {
                "status": "dry_run",
                "book_id": book_id,
                "spine_items": len(spine),
                "images": len(images),
            }

        # ── 2. Set up output ───────────────────────────────────────────
        book_output_dir.mkdir(parents=True, exist_ok=True)
        asset_mgr = AssetManager(str(book_output_dir))
        builder = PackageBuilder(str(book_output_dir), book_id)
        segmenter = ContentSegmenter(page_length=page_length)

        # ── 3. Cover image ─────────────────────────────────────────────
        cover_result = parser.extract_cover()
        if cover_result:
            cover_filename, cover_data = cover_result
            cover_variants = asset_mgr.save_cover(cover_data, cover_filename)
            metadata["cover_output_path"] = cover_variants.get("original", "")
            logger.info("Cover saved → %s", metadata["cover_output_path"])

        # ── 4. Extract and save all images ─────────────────────────────
        # Build two lookup dicts keyed by epub href:
        #   image_map      → primary output path (for block filename field)
        #   image_srcsets  → full srcset dict (for block srcset field)
        image_map: dict[str, str] = {}
        image_srcsets: dict[str, dict] = {}

        if extract_images and images:
            logger.info("Extracting %d images...", len(images))
            for img_info in images.values():
                fname = Path(img_info["file_name"]).name
                variants = asset_mgr.save_image(img_info["data"], fname)

                # Index by full epub href AND by basename
                for key in (img_info["file_name"], fname):
                    image_map[key] = variants.get("original", "")
                    image_srcsets[key] = variants

        # ── 5. Build blocks from each spine item ───────────────────────
        all_pages: list[list[dict]] = []
        page_index: list[dict] = []   # one entry per page (for manifest)
        page_chapters: list[str] = []  # chapter title per page

        block_builder = BlockBuilder(image_map=image_map)
        current_chapter = ""

        for spine_item in spine:
            raw_blocks = block_builder.build(spine_item["content"])
            if not raw_blocks:
                continue

            # Infer chapter title from first h1/h2 in this spine item
            chapter_title = current_chapter
            for b in raw_blocks:
                if b["type"] == "heading" and b.get("level", 3) <= 2:
                    chapter_title = b["text"]
                    break

            # Fill in srcsets for image blocks
            if extract_images:
                for block in raw_blocks:
                    if block["type"] == "image":
                        src = block.get("src", "")
                        block["srcset"] = image_srcsets.get(
                            src, image_srcsets.get(Path(src).name, {})
                        )

            # Segment into pages
            chapter_pages = segmenter.segment(raw_blocks)
            for page_blocks in chapter_pages:
                section_title = next(
                    (b["text"] for b in page_blocks if b["type"] == "heading"), ""
                )
                all_pages.append(page_blocks)
                page_chapters.append(chapter_title)
                page_index.append(
                    {"source": spine_item["id"], "chapterTitle": chapter_title}
                )

            current_chapter = chapter_title
            logger.debug(
                "Spine item '%s' → %d page(s)", spine_item["id"], len(chapter_pages)
            )

        total_pages = len(all_pages)
        logger.info("Segmented into %d pages", total_pages)

        # ── 6. Write output package ────────────────────────────────────
        builder.write_chapters(toc)
        builder.write_manifest(spine, page_index)
        builder.write_metadata(metadata, total_pages)

        for page_num, (page_blocks, chapter_title) in enumerate(
            zip(all_pages, page_chapters), start=1
        ):
            section_title = next(
                (b["text"] for b in page_blocks if b["type"] == "heading"), ""
            )
            builder.write_page(page_num, page_blocks, chapter_title, section_title)

        logger.info("Wrote %d page files", total_pages)

        # ── 7. Validate ────────────────────────────────────────────────
        validation_result: Optional[dict] = None
        if validate:
            validator = PackageValidator(str(book_output_dir))
            validation_result = validator.validate()
            status_word = "PASSED" if validation_result["valid"] else "FAILED"
            logger.info("Validation: %s", status_word)
            for err in validation_result.get("errors", []):
                logger.error("  ✗ %s", err)
            for warn in validation_result.get("warnings", []):
                logger.warning("  ! %s", warn)

        ok = not validation_result or validation_result["valid"]
        return {
            "status": "success" if ok else "warning",
            "book_id": book_id,
            "pages": total_pages,
            "images": len(images),
            "output_dir": str(book_output_dir),
            "validation": validation_result,
        }

    # ------------------------------------------------------------------

    @staticmethod
    def _slug(path: Path) -> str:
        """Derive a safe book ID from the filename stem."""
        slug = re.sub(r"[^a-z0-9_-]", "_", path.stem.lower())
        return slug[:60].strip("_") or "book"
