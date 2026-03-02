import type { TocEntry } from "../types/blocks";

interface Props {
  chapters: TocEntry[];
  onClose: () => void;
  onJump: (page: number) => void;
}

export function TocSidebar({ chapters, onClose, onJump }: Props) {
  return (
    <aside className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-surface-muted-dark shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">Table of Contents</h2>
        <button
          onClick={onClose}
          aria-label="Close table of contents"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {chapters.map((ch, i) => (
          <button
            key={i}
            onClick={() => onJump(ch.pageNum ?? 1)}
            style={{ paddingLeft: `${Math.min(ch.depth * 16 + 12, 48)}px` }}
            className="w-full text-left py-2 pr-3 rounded hover:bg-brand-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors"
          >
            {ch.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
