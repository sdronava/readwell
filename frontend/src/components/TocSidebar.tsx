import type { TocEntry } from "../types/blocks";

interface Props {
  chapters: TocEntry[];
  onClose: () => void;
  onJump: (page: number) => void;
  manifest: Array<{ pageNum: number; chapterHref: string }>;
}

export function TocSidebar({ chapters, onClose, onJump, manifest }: Props) {
  function pageForChapter(href: string): number {
    const entry = manifest.find((m) => m.chapterHref === href || href.startsWith(m.chapterHref));
    return entry?.pageNum ?? 1;
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-gray-800">Table of Contents</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl leading-none">×</button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {chapters.map((ch, i) => (
          <button
            key={i}
            onClick={() => onJump(pageForChapter(ch.href))}
            className={`w-full text-left px-3 py-2 rounded hover:bg-blue-50 text-sm text-gray-700 ${ch.depth > 0 ? `pl-${Math.min(ch.depth * 4 + 3, 12)}` : ""}`}
          >
            {ch.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
