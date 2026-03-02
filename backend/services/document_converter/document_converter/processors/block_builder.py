"""Convert raw HTML from an ePUB spine item into structured content blocks."""

import logging
import warnings
from typing import Optional

from bs4 import BeautifulSoup, NavigableString, Tag, XMLParsedAsHTMLWarning

# ePUB spine items are XHTML but parse correctly as HTML; suppress the warning.
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

logger = logging.getLogger(__name__)

HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
# Tags that should be processed as top-level blocks
CONTAINER_TAGS = {"div", "section", "article", "blockquote", "body"}


class BlockBuilder:
    def __init__(self, image_map: Optional[dict] = None):
        # image_map: {epub_href → output_relative_path}
        self.image_map = image_map or {}

    def build(self, html_content: str) -> tuple[list[dict], dict[str, int]]:
        """Parse HTML and return (blocks, anchor_map).

        anchor_map maps each HTML element id found in the content to the index
        of the first block at or after that element's position.  This lets the
        caller resolve TOC fragment hrefs (e.g. ``#pgepubid00003``) to the
        correct page after segmentation.
        """
        soup = BeautifulSoup(html_content, "lxml")
        body = soup.find("body") or soup
        blocks: list[dict] = []
        anchors: dict[str, int] = {}
        self._process_node(body, blocks, anchors)
        return blocks, anchors

    # ------------------------------------------------------------------
    # Node traversal
    # ------------------------------------------------------------------

    def _process_node(self, node: Tag, blocks: list[dict], anchors: dict[str, int]) -> None:
        for child in node.children:
            if isinstance(child, NavigableString):
                continue
            if not isinstance(child, Tag):
                continue

            tag = child.name

            # Record any id attribute at the current block boundary so the
            # caller can map TOC fragment hrefs to page numbers later.
            el_id = child.get("id")
            if el_id:
                anchors[el_id] = len(blocks)

            if tag in HEADING_TAGS:
                block = self._heading(child)
                if block:
                    blocks.append(block)

            elif tag == "p":
                block = self._paragraph(child)
                if block:
                    blocks.append(block)

            elif tag == "pre":
                block = self._code(child)
                if block:
                    blocks.append(block)

            elif tag in ("ul", "ol"):
                block = self._list(child)
                if block:
                    blocks.append(block)

            elif tag == "figure":
                block = self._figure(child)
                if block:
                    blocks.append(block)

            elif tag == "img":
                block = self._image_tag(child)
                if block:
                    blocks.append(block)

            elif tag == "table":
                # Phase 2: full table rendering deferred
                blocks.append({"type": "paragraph", "text": "[Table — rendering not yet supported]"})

            elif tag in CONTAINER_TAGS:
                self._process_node(child, blocks, anchors)

            # Skip nav, aside, header, footer, script, style, etc.

    # ------------------------------------------------------------------
    # Block constructors
    # ------------------------------------------------------------------

    def _heading(self, tag: Tag) -> Optional[dict]:
        text = tag.get_text(separator=" ", strip=True)
        if not text:
            return None
        return {"type": "heading", "level": int(tag.name[1]), "text": text}

    def _paragraph(self, tag: Tag) -> Optional[dict]:
        # If the paragraph is only an image, emit as image block
        imgs = tag.find_all("img")
        if len(imgs) == 1 and not tag.get_text(strip=True):
            return self._image_tag(imgs[0])

        text, emphasis = self._extract_text_with_emphasis(tag)
        text = text.strip()
        if not text:
            return None

        block: dict = {"type": "paragraph", "text": text}
        if emphasis:
            block["emphasis"] = emphasis
        return block

    def _code(self, pre_tag: Tag) -> Optional[dict]:
        code_tag = pre_tag.find("code")
        raw_text = (code_tag or pre_tag).get_text()
        if not raw_text.strip():
            return None

        lang = ""
        if code_tag:
            for cls in code_tag.get("class", []):
                if cls.startswith("language-"):
                    lang = cls[len("language-"):]
                    break

        return {"type": "code", "language": lang, "text": raw_text}

    def _list(self, tag: Tag) -> Optional[dict]:
        ordered = tag.name == "ol"
        items = [
            li.get_text(separator=" ", strip=True)
            for li in tag.find_all("li", recursive=False)
            if li.get_text(strip=True)
        ]
        if not items:
            return None
        return {"type": "list", "ordered": ordered, "items": items}

    def _figure(self, tag: Tag) -> Optional[dict]:
        img = tag.find("img")
        if not img:
            return None
        caption_tag = tag.find("figcaption")
        caption = caption_tag.get_text(strip=True) if caption_tag else ""
        return self._image_tag(img, caption=caption)

    def _image_tag(self, img: Tag, caption: str = "") -> Optional[dict]:
        src = img.get("src", "") or img.get("xlink:href", "")
        if not src:
            return None

        resolved = self.image_map.get(src, src)
        return {
            "type": "image",
            "src": src,
            "filename": resolved,
            "caption": caption or img.get("title", ""),
            "altText": img.get("alt", ""),
            "width": self._int_attr(img, "width"),
            "height": self._int_attr(img, "height"),
            "srcset": {},  # populated later by AssetManager
        }

    # ------------------------------------------------------------------
    # Emphasis extraction
    # ------------------------------------------------------------------

    def _extract_text_with_emphasis(self, tag: Tag) -> tuple[str, list[dict]]:
        """
        Walk the tag tree, collecting plain text while recording bold/italic
        character ranges relative to the start of the flattened string.
        """
        parts: list[str] = []
        emphasis: list[dict] = []

        def walk(node, inherited_style: Optional[str] = None) -> None:
            if isinstance(node, NavigableString):
                parts.append(str(node))
                return
            if not isinstance(node, Tag):
                return

            own_style: Optional[str] = None
            if node.name in ("strong", "b"):
                own_style = "bold"
            elif node.name in ("em", "i"):
                own_style = "italic"

            active_style = own_style or inherited_style

            if own_style:
                start = sum(len(p) for p in parts)
                for child in node.children:
                    walk(child, active_style)
                end = sum(len(p) for p in parts)
                if end > start:
                    emphasis.append({"start": start, "end": end, "style": own_style})
            else:
                for child in node.children:
                    walk(child, active_style)

        walk(tag)
        return "".join(parts), emphasis

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _int_attr(self, tag: Tag, attr: str) -> Optional[int]:
        val = tag.get(attr)
        if val:
            try:
                return int(val)
            except (ValueError, TypeError):
                pass
        return None
