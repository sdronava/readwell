export interface Emphasis {
  start: number;
  end: number;
  style: "bold" | "italic";
}

export interface HeadingBlock {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
  emphasis?: Emphasis[];
}

export interface CodeBlock {
  type: "code";
  text: string;
  language?: string;
}

export interface ListBlock {
  type: "list";
  ordered: boolean;
  items: string[];
}

export interface Srcset {
  original?: string;
  "400w"?: string;
  "800w"?: string;
  "1200w"?: string;
}

export interface ImageBlock {
  type: "image";
  filename: string;
  altText?: string;
  caption?: string;
  srcset?: Srcset;
}

export type Block = HeadingBlock | ParagraphBlock | CodeBlock | ListBlock | ImageBlock;

export interface TocEntry {
  title: string;
  href: string;
  depth: number;
  /** First page of the chapter, resolved server-side from manifest.json */
  pageNum?: number;
}

export interface BookSummary {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  totalPages: number;
  description?: string;
  language: string;
}

export interface BookMeta extends BookSummary {
  cdnBaseUrl: string;
  tableOfContents: TocEntry[];
}

export interface PageData {
  bookId: string;
  pageNum: number;
  chapter: string;
  section: string;
  estimatedReadingTimeSeconds: number;
  blocks: Block[];
}
