"""Semantic-aware pagination — split blocks into pages without breaking mid-block."""

import logging

logger = logging.getLogger(__name__)

WORDS_PER_READING_MINUTE = 200


def count_block_words(block: dict) -> int:
    """Estimate word count for a single block."""
    if block["type"] == "image":
        return 0
    if block["type"] == "list":
        return sum(len(item.split()) for item in block.get("items", []))
    text = block.get("text", "")
    return len(text.split()) if text else 0


def estimate_reading_seconds(blocks: list[dict]) -> int:
    """Estimate reading time for a list of blocks, minimum 30 seconds."""
    total_words = sum(count_block_words(b) for b in blocks)
    return max(30, int(total_words / WORDS_PER_READING_MINUTE * 60))


class ContentSegmenter:
    def __init__(self, page_length: int = 500):
        """
        Args:
            page_length: Target words per page. A top-level heading (h1/h2)
                         always triggers a new page regardless of word count.
                         Blocks are never split — they are always kept whole.
        """
        self.page_length = page_length

    def segment(self, blocks: list[dict]) -> list[list[dict]]:
        """
        Divide blocks into pages.

        Rules (in priority order):
        1. An h1 or h2 heading always starts a new page (if the current page
           already has content). This keeps chapter/section starts clean.
        2. Adding the next block would exceed page_length words → flush current
           page and start a new one.
        3. Blocks are atomic — code, list, and image blocks are never split.
        """
        if not blocks:
            return []

        pages: list[list[dict]] = []
        current: list[dict] = []
        word_count = 0

        for block in blocks:
            btype = block.get("type", "")
            bwords = count_block_words(block)

            # Rule 1: top-level headings start a fresh page
            if btype == "heading" and block.get("level", 3) <= 2 and current:
                pages.append(current)
                current = []
                word_count = 0

            # Rule 2: overflow → flush
            elif word_count + bwords > self.page_length and current:
                pages.append(current)
                current = []
                word_count = 0

            current.append(block)
            word_count += bwords

        if current:
            pages.append(current)

        return pages
