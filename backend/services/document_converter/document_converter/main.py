"""
CLI entry point — for local development and testing only.
Does NOT interact with the database.

Usage:
    python -m document_converter.main convert ./pubs/book.epub --book-id book_001 -v
or after `uv run`:
    document-converter convert ./pubs/book.epub -o ./books/ -p 300
"""

import logging
import shutil
import sys
import uuid
from pathlib import Path
from typing import Optional

import click

from document_converter.converter import DocumentConverter
from document_converter.utils.logger import setup_logging

logger = logging.getLogger(__name__)


@click.group()
def cli() -> None:
    """Readwell Document Conversion Service."""


@cli.command()
@click.argument("input_path", type=click.Path(exists=True, dir_okay=False, readable=True))
@click.option("--output-dir", "-o", default="./books/", show_default=True,
              help="Directory to write the output package into.")
@click.option("--book-id", "-b", default=None,
              help="Book identifier (UUID recommended). Auto-generated if omitted.")
@click.option("--page-length", "-p", default=500, show_default=True, type=int,
              help="Target words per page.")
@click.option("--format", "-f", "output_format",
              type=click.Choice(["json", "zip", "both"]), default="json", show_default=True,
              help="Output format.")
@click.option("--extract-images/--no-extract-images", default=True, show_default=True,
              help="Extract and process images.")
@click.option("--generate-thumbnails/--no-generate-thumbnails", default=True, show_default=True,
              help="Generate WebP thumbnails for images.")
@click.option("--validate/--no-validate", default=True, show_default=True,
              help="Validate the output package after conversion.")
@click.option("--verbose", "-v", is_flag=True,
              help="Enable verbose (DEBUG) logging.")
@click.option("--dry-run", is_flag=True,
              help="Parse the ePUB but do not write any output files.")
def convert(
    input_path: str,
    output_dir: str,
    book_id: Optional[str],
    page_length: int,
    output_format: str,
    extract_images: bool,
    generate_thumbnails: bool,
    validate: bool,
    verbose: bool,
    dry_run: bool,
) -> None:
    """Convert an ePUB file to a structured JSON package."""
    setup_logging(verbose)

    if not book_id:
        book_id = str(uuid.uuid4())
        if verbose:
            click.echo(f"Auto-generated book ID: {book_id}")

    click.echo(f"Processing: {Path(input_path).name}")

    converter = DocumentConverter()
    try:
        result = converter.convert(
            input_path=input_path,
            output_dir=output_dir,
            book_id=book_id,
            page_length=page_length,
            extract_images=extract_images,
            generate_thumbnails=generate_thumbnails,
            validate=validate,
            dry_run=dry_run,
        )
    except FileNotFoundError as exc:
        click.echo(f"Error: {exc}", err=True)
        sys.exit(1)
    except Exception as exc:
        click.echo(f"Conversion failed: {exc}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

    if dry_run:
        click.echo(
            f"Dry run complete — {result['spine_items']} spine items, "
            f"{result['images']} images (nothing written)."
        )
        return

    # ------------------------------------------------------------------
    # Handle zip output
    # ------------------------------------------------------------------
    if output_format in ("zip", "both"):
        zip_path = _create_zip(result["output_dir"], book_id, output_dir)
        if output_format == "zip":
            shutil.rmtree(result["output_dir"], ignore_errors=True)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    validation = result.get("validation") or {}
    if validation.get("errors"):
        click.echo("Validation errors:")
        for err in validation["errors"]:
            click.echo(f"  ✗ {err}")
    if validation.get("warnings"):
        click.echo("Validation warnings:")
        for warn in validation["warnings"]:
            click.echo(f"  ! {warn}")

    click.echo("✓ Metadata extracted")
    click.echo(f"✓ Content parsed ({result.get('images', 0)} images extracted)")
    click.echo(f"✓ Paginated into {result.get('pages', 0)} pages")
    if validate:
        if validation.get("valid", True):
            click.echo("✓ Package validated")
        else:
            click.echo("✗ Validation failed — see errors above")
    click.echo(f"✓ Output saved to: {result['output_dir']}")


def _create_zip(source_dir: str, book_id: str, output_dir: str) -> str:
    zip_base = str(Path(output_dir) / book_id)
    shutil.make_archive(zip_base, "zip", source_dir)
    zip_path = f"{zip_base}.zip"
    click.echo(f"✓ Created archive: {zip_path}")
    return zip_path


if __name__ == "__main__":
    cli()
