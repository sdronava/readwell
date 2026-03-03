import { useEffect, useState } from "react";

interface Props {
  pageNum: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (page: number) => void;
}

export function NavBar({ pageNum, totalPages, onPrev, onNext, onGoTo }: Props) {
  const [inputVal, setInputVal] = useState(String(pageNum));
  const [showVoiceHint, setShowVoiceHint] = useState(false);

  // Keep input in sync when page changes externally (e.g. TOC jump)
  useEffect(() => {
    setInputVal(String(pageNum));
  }, [pageNum]);

  // Keyboard arrow navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onPrev, onNext]);

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(inputVal, 10);
    if (!isNaN(n)) {
      const clamped = Math.max(1, Math.min(n, totalPages));
      setInputVal(String(clamped));
      onGoTo(clamped);
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t dark:border-gray-700 bg-white dark:bg-surface-muted-dark sticky bottom-0">
      <button
        onClick={onPrev}
        disabled={pageNum <= 1}
        aria-label="Previous page"
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
      >
        ← Prev
      </button>

      <form onSubmit={handleJump} className="flex items-center gap-1.5">
        <label htmlFor="page-input" className="sr-only">Go to page</label>
        <input
          id="page-input"
          type="number"
          min={1}
          max={totalPages}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="w-14 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">/ {totalPages}</span>
      </form>

      {/* Voice commands info */}
      <div className="relative">
        <button
          onClick={() => setShowVoiceHint(!showVoiceHint)}
          title="Voice commands help"
          aria-label="Voice commands help"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors px-2 py-1"
        >
          🎤
        </button>
        {showVoiceHint && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 dark:bg-gray-950 text-white text-xs rounded-lg p-3 whitespace-nowrap shadow-lg border border-gray-700 z-50">
            <p className="font-semibold mb-2">Voice Commands</p>
            <p className="text-gray-300">Hold <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">spacebar</kbd> to speak</p>
            <p className="text-gray-400 text-xs mt-1">e.g., "next page", "faster", "page 5"</p>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={pageNum >= totalPages}
        aria-label="Next page"
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
