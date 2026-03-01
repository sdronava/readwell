import type { Emphasis } from "../types/blocks";

interface Props {
  text: string;
  emphasis: Emphasis[];
  highlight?: { start: number; length: number };
}

export function EmphasisText({ text, emphasis, highlight }: Props) {
  // Fast path: nothing to render except plain text
  if (!highlight && (!emphasis || emphasis.length === 0)) return <>{text}</>;

  // Collect every character position where a style starts or ends
  const breakpoints = new Set<number>([0, text.length]);
  for (const em of emphasis) {
    if (em.start < text.length) breakpoints.add(em.start);
    if (em.end <= text.length) breakpoints.add(em.end);
  }
  if (highlight) {
    const hEnd = highlight.start + highlight.length;
    if (highlight.start < text.length) breakpoints.add(highlight.start);
    if (hEnd <= text.length) breakpoints.add(hEnd);
  }

  const sorted = [...breakpoints].sort((a, b) => a - b);
  const parts: React.ReactNode[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;

    const segment = text.slice(start, end);
    const isBold = emphasis.some(
      (em) => em.style === "bold" && start >= em.start && end <= em.end
    );
    const isItalic = emphasis.some(
      (em) => em.style === "italic" && start >= em.start && end <= em.end
    );
    const isHighlighted =
      highlight != null &&
      start >= highlight.start &&
      end <= highlight.start + highlight.length;

    if (!isBold && !isItalic && !isHighlighted) {
      parts.push(segment);
    } else {
      const cn = [
        isBold ? "font-bold" : "",
        isItalic ? "italic" : "",
        isHighlighted
          ? "bg-yellow-300 dark:bg-yellow-500/60 rounded-sm text-gray-900 dark:text-gray-50"
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      parts.push(
        <span key={start} className={cn}>
          {segment}
        </span>
      );
    }
  }

  return <>{parts}</>;
}
