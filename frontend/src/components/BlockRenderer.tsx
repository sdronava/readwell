import type { Block, Srcset } from "../types/blocks";
import { EmphasisText } from "./EmphasisText";

function buildSrcSet(srcset: Srcset | undefined, cdnBase: string): string {
  if (!srcset) return "";
  return (["400w", "800w", "1200w"] as const)
    .filter((k) => srcset[k])
    .map((k) => `${cdnBase}/${srcset[k]} ${k}`)
    .join(", ");
}

interface Props {
  block: Block;
  cdnBaseUrl: string;
}

export function BlockRenderer({ block, cdnBaseUrl }: Props) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const sizeClass = ["", "text-3xl", "text-2xl", "text-xl", "text-lg", "text-base", "text-sm"][block.level];
      return <Tag className={`font-bold my-4 ${sizeClass}`}>{block.text}</Tag>;
    }

    case "paragraph":
      return (
        <p className="my-3 leading-7 text-gray-800">
          <EmphasisText text={block.text} emphasis={block.emphasis ?? []} />
        </p>
      );

    case "code":
      return (
        <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto my-4 text-sm">
          <code className={block.language ? `language-${block.language}` : ""}>{block.text}</code>
        </pre>
      );

    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag className={`${block.ordered ? "list-decimal" : "list-disc"} pl-6 my-3 text-gray-800`}>
          {block.items.map((item, i) => (
            <li key={i} className="my-1">{item}</li>
          ))}
        </ListTag>
      );
    }

    case "image": {
      const src =
        block.srcset?.["800w"] ??
        block.srcset?.["400w"] ??
        block.srcset?.original ??
        block.filename;
      return (
        <figure className="my-6 text-center">
          <img
            src={`${cdnBaseUrl}/${src}`}
            alt={block.altText ?? ""}
            srcSet={buildSrcSet(block.srcset, cdnBaseUrl)}
            sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
            className="mx-auto max-w-full rounded"
          />
          {block.caption && (
            <figcaption className="text-sm text-gray-500 mt-2">{block.caption}</figcaption>
          )}
        </figure>
      );
    }

    default:
      return null;
  }
}
