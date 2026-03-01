import type { Emphasis } from "../types/blocks";

interface Props {
  text: string;
  emphasis: Emphasis[];
}

export function EmphasisText({ text, emphasis }: Props) {
  if (!emphasis || emphasis.length === 0) return <>{text}</>;

  const sorted = [...emphasis].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const em of sorted) {
    if (em.start > cursor) {
      parts.push(text.slice(cursor, em.start));
    }
    const slice = text.slice(em.start, em.end);
    if (em.style === "bold") {
      parts.push(<strong key={em.start}>{slice}</strong>);
    } else {
      parts.push(<em key={em.start}>{slice}</em>);
    }
    cursor = em.end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}
