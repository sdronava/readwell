"""Tests for ContentSegmenter and helper functions."""

import pytest
from document_converter.processors.content_segmenter import (
    ContentSegmenter,
    count_block_words,
    estimate_reading_seconds,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def para(text: str) -> dict:
    return {"type": "paragraph", "text": text}


def heading(text: str, level: int = 1) -> dict:
    return {"type": "heading", "level": level, "text": text}


def code(text: str) -> dict:
    return {"type": "code", "language": "python", "text": text}


def image() -> dict:
    return {"type": "image", "src": "fig.png", "srcset": {}}


def lst(items: list) -> dict:
    return {"type": "list", "ordered": False, "items": items}


# ---------------------------------------------------------------------------
# count_block_words
# ---------------------------------------------------------------------------

class TestCountBlockWords:
    def test_paragraph(self):
        assert count_block_words(para("hello world foo")) == 3

    def test_empty_paragraph(self):
        assert count_block_words(para("")) == 0

    def test_image_is_zero(self):
        assert count_block_words(image()) == 0

    def test_list_sums_items(self):
        assert count_block_words(lst(["hello world", "foo bar baz"])) == 5

    def test_code_counts_words(self):
        # code word count is based on whitespace-split text
        c = code("def foo():\n    return 1")
        assert count_block_words(c) > 0

    def test_heading_counts_words(self):
        assert count_block_words(heading("Chapter One Introduction")) == 3


# ---------------------------------------------------------------------------
# estimate_reading_seconds
# ---------------------------------------------------------------------------

class TestEstimateReadingSeconds:
    def test_minimum_30_seconds(self):
        assert estimate_reading_seconds([]) >= 30
        assert estimate_reading_seconds([para("hi")]) >= 30

    def test_longer_content_takes_more_time(self):
        short = estimate_reading_seconds([para("hi")])
        long_ = estimate_reading_seconds([para("word " * 500)])
        assert long_ > short


# ---------------------------------------------------------------------------
# ContentSegmenter.segment
# ---------------------------------------------------------------------------

class TestSegmenter:
    def test_empty_returns_empty(self):
        assert ContentSegmenter().segment([]) == []

    def test_single_block_is_one_page(self):
        pages = ContentSegmenter(page_length=500).segment([para("hello")])
        assert len(pages) == 1
        assert pages[0][0]["text"] == "hello"

    def test_overflow_splits_into_two_pages(self):
        seg = ContentSegmenter(page_length=10)
        blocks = [para("word " * 6), para("word " * 6)]
        pages = seg.segment(blocks)
        assert len(pages) == 2

    def test_single_huge_block_stays_on_one_page(self):
        # A block that alone exceeds page_length should not be split
        seg = ContentSegmenter(page_length=5)
        blocks = [para("word " * 100)]
        pages = seg.segment(blocks)
        assert len(pages) == 1

    def test_h1_forces_new_page(self):
        seg = ContentSegmenter(page_length=500)
        blocks = [para("intro " * 5), heading("Chapter 2", level=1), para("content " * 5)]
        pages = seg.segment(blocks)
        assert len(pages) == 2
        assert pages[1][0]["type"] == "heading"
        assert pages[1][0]["text"] == "Chapter 2"

    def test_h2_forces_new_page(self):
        seg = ContentSegmenter(page_length=500)
        blocks = [para("intro"), heading("Section", level=2), para("body")]
        pages = seg.segment(blocks)
        assert len(pages) == 2

    def test_h3_does_not_force_new_page(self):
        seg = ContentSegmenter(page_length=500)
        blocks = [para("intro"), heading("Sub", level=3), para("body")]
        pages = seg.segment(blocks)
        assert len(pages) == 1

    def test_first_block_is_heading_no_extra_page(self):
        seg = ContentSegmenter(page_length=500)
        blocks = [heading("Preface", level=1), para("text")]
        # No prior content → heading should NOT create a spurious empty page
        pages = seg.segment(blocks)
        assert len(pages) == 1
        assert pages[0][0]["type"] == "heading"

    def test_code_block_atomic(self):
        seg = ContentSegmenter(page_length=5)
        blocks = [code("x = 1\n" * 200)]
        pages = seg.segment(blocks)
        assert len(pages) == 1

    def test_image_block_zero_words(self):
        seg = ContentSegmenter(page_length=5)
        blocks = [para("word " * 6), image(), para("word " * 6)]
        # First para (6 words) fills page 1; image triggers overflow flush → page 2;
        # second para triggers another overflow flush → page 3.
        pages = seg.segment(blocks)
        assert len(pages) == 3

    def test_multiple_chapters(self):
        seg = ContentSegmenter(page_length=50)
        blocks = (
            [heading("Ch 1", level=1), para("a " * 20)]
            + [heading("Ch 2", level=1), para("b " * 20)]
            + [heading("Ch 3", level=1), para("c " * 20)]
        )
        pages = seg.segment(blocks)
        # Each h1 starts a new page; 3 chapters → at least 3 pages
        assert len(pages) >= 3

    def test_all_blocks_preserved(self):
        seg = ContentSegmenter(page_length=10)
        blocks = [para(f"word {i}") for i in range(20)]
        pages = seg.segment(blocks)
        all_blocks = [b for page in pages for b in page]
        assert len(all_blocks) == 20
