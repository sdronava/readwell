"""Tests for BlockBuilder — HTML → structured content blocks."""

import pytest
from document_converter.processors.block_builder import BlockBuilder


@pytest.fixture
def builder():
    return BlockBuilder()


def html(body: str) -> str:
    return f"<html><body>{body}</body></html>"


class TestHeadings:
    def test_h1(self, builder):
        blocks, _ = builder.build(html("<h1>Introduction</h1>"))
        assert len(blocks) == 1
        assert blocks[0] == {"type": "heading", "level": 1, "text": "Introduction"}

    def test_h2(self, builder):
        blocks, _ = builder.build(html("<h2>Background</h2>"))
        assert blocks[0]["level"] == 2

    def test_h3(self, builder):
        blocks, _ = builder.build(html("<h3>Details</h3>"))
        assert blocks[0]["level"] == 3

    def test_empty_heading_skipped(self, builder):
        blocks, _ = builder.build(html("<h1>   </h1>"))
        assert blocks == []


class TestParagraphs:
    def test_basic_paragraph(self, builder):
        blocks, _ = builder.build(html("<p>Hello world</p>"))
        assert blocks[0] == {"type": "paragraph", "text": "Hello world"}

    def test_empty_paragraph_skipped(self, builder):
        blocks, _ = builder.build(html("<p>   </p>"))
        assert blocks == []

    def test_bold_emphasis(self, builder):
        blocks, _ = builder.build(html("<p>Hello <strong>world</strong></p>"))
        b = blocks[0]
        assert b["type"] == "paragraph"
        assert "emphasis" in b
        assert b["emphasis"][0]["style"] == "bold"
        assert b["emphasis"][0]["start"] == 6  # "Hello " is 6 chars
        assert b["emphasis"][0]["end"] == 11

    def test_italic_emphasis(self, builder):
        blocks, _ = builder.build(html("<p><em>italics</em></p>"))
        assert blocks[0]["emphasis"][0]["style"] == "italic"

    def test_no_emphasis_field_when_plain(self, builder):
        blocks, _ = builder.build(html("<p>Plain text</p>"))
        assert "emphasis" not in blocks[0]

    def test_whitespace_normalised(self, builder):
        blocks, _ = builder.build(html("<p>  text  </p>"))
        assert blocks[0]["text"] == "text"


class TestCodeBlocks:
    def test_pre_tag(self, builder):
        blocks, _ = builder.build(html("<pre>x = 1</pre>"))
        assert blocks[0]["type"] == "code"
        assert "x = 1" in blocks[0]["text"]

    def test_language_extracted(self, builder):
        blocks, _ = builder.build(html('<pre><code class="language-python">x = 1</code></pre>'))
        assert blocks[0]["language"] == "python"

    def test_no_language_defaults_to_empty(self, builder):
        blocks, _ = builder.build(html("<pre><code>x = 1</code></pre>"))
        assert blocks[0]["language"] == ""

    def test_empty_code_skipped(self, builder):
        blocks, _ = builder.build(html("<pre>   </pre>"))
        assert blocks == []


class TestLists:
    def test_unordered_list(self, builder):
        blocks, _ = builder.build(html("<ul><li>Item 1</li><li>Item 2</li></ul>"))
        b = blocks[0]
        assert b["type"] == "list"
        assert b["ordered"] is False
        assert b["items"] == ["Item 1", "Item 2"]

    def test_ordered_list(self, builder):
        blocks, _ = builder.build(html("<ol><li>First</li><li>Second</li></ol>"))
        assert blocks[0]["ordered"] is True

    def test_empty_list_skipped(self, builder):
        blocks, _ = builder.build(html("<ul></ul>"))
        assert blocks == []

    def test_empty_li_skipped(self, builder):
        blocks, _ = builder.build(html("<ul><li>  </li><li>Valid</li></ul>"))
        assert blocks[0]["items"] == ["Valid"]


class TestImages:
    def test_img_in_paragraph(self, builder):
        blocks, _ = builder.build(html('<p><img src="fig.png" alt="desc"/></p>'))
        assert blocks[0]["type"] == "image"
        assert blocks[0]["src"] == "fig.png"
        assert blocks[0]["altText"] == "desc"

    def test_figure_with_caption(self, builder):
        blocks, _ = builder.build(html(
            "<figure><img src='fig.png'/><figcaption>Figure 1</figcaption></figure>"
        ))
        b = blocks[0]
        assert b["type"] == "image"
        assert b["caption"] == "Figure 1"

    def test_image_srcset_initially_empty(self, builder):
        blocks, _ = builder.build(html('<img src="x.png"/>'))
        assert blocks[0]["srcset"] == {}

    def test_image_map_resolves_path(self):
        b = BlockBuilder(image_map={"fig.png": "assets/images/fig.png"})
        blocks, _ = b.build(html('<img src="fig.png"/>'))
        assert blocks[0]["filename"] == "assets/images/fig.png"

    def test_img_without_src_skipped(self, builder):
        blocks, _ = builder.build(html("<img alt='no src'/>"))
        assert blocks == []


class TestContainers:
    def test_div_recursed(self, builder):
        blocks, _ = builder.build(html("<div><p>Inside div</p></div>"))
        assert len(blocks) == 1
        assert blocks[0]["type"] == "paragraph"

    def test_section_recursed(self, builder):
        blocks, _ = builder.build(html("<section><h2>Title</h2><p>Text</p></section>"))
        assert len(blocks) == 2

    def test_table_placeholder(self, builder):
        blocks, _ = builder.build(html("<table><tr><td>cell</td></tr></table>"))
        assert blocks[0]["type"] == "paragraph"
        assert "Table" in blocks[0]["text"]

    def test_mixed_content(self, builder):
        blocks, _ = builder.build(html(
            "<h1>Title</h1><p>Para</p><pre>code</pre><ul><li>item</li></ul>"
        ))
        types = [b["type"] for b in blocks]
        assert types == ["heading", "paragraph", "code", "list"]


class TestAnchorMap:
    def test_id_on_heading_captured(self, builder):
        _, anchors = builder.build(html('<h1 id="ch1">Chapter One</h1><p>Text</p>'))
        assert anchors == {"ch1": 0}

    def test_id_on_container_captured(self, builder):
        _, anchors = builder.build(html('<div id="sec1"><p>Text</p></div>'))
        assert anchors == {"sec1": 0}

    def test_multiple_ids(self, builder):
        _, anchors = builder.build(html(
            '<h1 id="part1">Part 1</h1><p>text</p><h2 id="ch1">Chapter 1</h2>'
        ))
        assert anchors["part1"] == 0
        assert anchors["ch1"] == 2  # after heading + paragraph

    def test_no_ids_returns_empty(self, builder):
        _, anchors = builder.build(html("<h1>No id</h1><p>text</p>"))
        assert anchors == {}
