import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBook } from "../hooks/useBook";
import { usePage } from "../hooks/usePage";
import { useTTS } from "../hooks/useTTS";
import { BlockRenderer } from "../components/BlockRenderer";
import { NavBar } from "../components/NavBar";
import { TocSidebar } from "../components/TocSidebar";
import { TtsControls } from "../components/TtsControls";
import { SkeletonPage } from "../components/SkeletonPage";
import { useTheme } from "../contexts/ThemeContext";
import { useReaderSettings } from "../contexts/ReaderSettingsContext";

const FONT_SIZES = ["sm", "base", "lg", "xl"] as const;

export function ReaderView() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [pageNum, setPageNum] = useState(1);
  const [tocOpen, setTocOpen] = useState(false);
  const { darkMode, toggleDark } = useTheme();
  const { fontSize, setFontSize, fontFamily, setFontFamily, ttsRate, voiceURI, autoPageTurn } = useReaderSettings();

  const { meta, loading: metaLoading, error: metaError } = useBook(bookId!);
  const { page, loading: pageLoading, error: pageError } = usePage(bookId!, pageNum);

  // Flag set when auto-page-turn triggers a navigation; cleared after TTS auto-starts on the new page
  const autoPlayRef = useRef(false);

  // Called by useTTS only when speech ends naturally (not when stop() is invoked)
  const handleNaturalEnd = useCallback(() => {
    if (!autoPageTurn || !meta) return;
    const nextPage = pageNum + 1;
    if (nextPage > meta.totalPages) return; // last page — just stop
    autoPlayRef.current = true;
    setPageNum(nextPage);
  }, [autoPageTurn, meta, pageNum]);

  const { speak, stop, speaking, highlightRange } = useTTS(page?.blocks ?? [], ttsRate, voiceURI, handleNaturalEnd);

  // Refs for each rendered block element, used for auto-scroll
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  function goTo(n: number) {
    if (!meta) return;
    const clamped = Math.max(1, Math.min(n, meta.totalPages));
    if (clamped !== pageNum) {
      if (speaking) stop();
      setPageNum(clamped);
    }
  }

  // Compute which block is being read and the word's local offset within that block
  const { activeBlockIndex, localHighlightStart } = useMemo(() => {
    if (!highlightRange || !page) return { activeBlockIndex: -1, localHighlightStart: -1 };
    let offset = 0;
    for (let i = 0; i < page.blocks.length; i++) {
      const block = page.blocks[i];
      if (block.type !== "paragraph" && block.type !== "heading") continue;
      const len = block.text.length;
      if (highlightRange.start >= offset && highlightRange.start < offset + len) {
        return { activeBlockIndex: i, localHighlightStart: highlightRange.start - offset };
      }
      offset += len + 1; // +1 for the space separator in TTS text
    }
    return { activeBlockIndex: -1, localHighlightStart: -1 };
  }, [highlightRange, page]);

  // After auto-page-turn: start TTS as soon as the new page finishes loading
  useEffect(() => {
    if (!page || pageLoading || !autoPlayRef.current) return;
    autoPlayRef.current = false;
    speak();
  }, [page, pageLoading, speak]);

  // Auto-scroll: keep the active block centered in the viewport while TTS reads.
  // Use smooth scroll at normal/slow speeds; snap instantly at fast speeds to avoid lag.
  useEffect(() => {
    if (activeBlockIndex < 0) return;
    const el = blockRefs.current[activeBlockIndex];
    if (!el) return;
    el.scrollIntoView({
      behavior: ttsRate > 1 ? "auto" : "smooth",
      block: "center",
    });
  }, [activeBlockIndex, ttsRate]);

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-surface-dark">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }
  if (metaError || !meta) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-surface-dark">
        <p className="text-red-600 dark:text-red-400">{metaError ?? "Book not found"}</p>
      </div>
    );
  }

  const manifest = meta.tableOfContents.map((ch, i) => ({
    pageNum: i + 1,
    chapterHref: ch.href,
  }));

  const fontSizeIdx = FONT_SIZES.indexOf(fontSize);

  return (
    <div className="min-h-screen bg-surface-muted dark:bg-surface-dark flex flex-col transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-surface-muted-dark border-b dark:border-gray-700 px-4 py-2 flex items-center gap-2 sticky top-0 z-40">
        <button
          onClick={() => navigate("/")}
          aria-label="Back to library"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-sm transition-colors"
        >
          ← Library
        </button>
        <button
          onClick={() => setTocOpen(true)}
          aria-label="Open table of contents"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-sm ml-1 transition-colors"
        >
          ☰ Contents
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{meta.title}</h1>
          {page && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{page.chapter}</p>}
        </div>

        {/* Reader controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Font family toggle */}
          <button
            onClick={() => setFontFamily(fontFamily === "sans" ? "reading" : "sans")}
            aria-label={`Switch to ${fontFamily === "sans" ? "serif" : "sans-serif"} font`}
            title={`Font: ${fontFamily === "sans" ? "Sans-serif" : "Serif"}`}
            className="hidden sm:block text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {fontFamily === "sans" ? "Aa" : "Serif"}
          </button>

          {/* Font size controls */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              onClick={() => setFontSize(FONT_SIZES[Math.max(0, fontSizeIdx - 1)])}
              disabled={fontSizeIdx === 0}
              aria-label="Decrease font size"
              className="px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              A−
            </button>
            <button
              onClick={() => setFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, fontSizeIdx + 1)])}
              disabled={fontSizeIdx === FONT_SIZES.length - 1}
              aria-label="Increase font size"
              className="px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              A+
            </button>
          </div>

          <TtsControls speaking={speaking} onPlay={speak} onStop={stop} />

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* TTS active banner for screen reader users */}
      {speaking && (
        <div role="status" className="bg-brand-100 dark:bg-brand-700/20 text-brand-700 dark:text-brand-200 text-xs text-center py-1 px-4">
          TTS playing — screen reader announcements suppressed
        </div>
      )}

      {/* TOC Sidebar */}
      {tocOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setTocOpen(false)}
          />
          <TocSidebar
            chapters={meta.tableOfContents}
            manifest={manifest}
            onClose={() => setTocOpen(false)}
            onJump={(p) => { goTo(p); setTocOpen(false); }}
          />
        </>
      )}

      {/* Page content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {pageLoading && <SkeletonPage />}
        {pageError && <p className="text-red-500 dark:text-red-400 text-center mt-8">{pageError}</p>}
        {page && !pageLoading && (
          <article aria-live={speaking ? "off" : "polite"}>
            {page.blocks.map((block, i) => (
              <div key={i} ref={(el) => { blockRefs.current[i] = el; }}>
                <BlockRenderer
                  block={block}
                  cdnBaseUrl={meta.cdnBaseUrl}
                  localHighlightRange={
                    i === activeBlockIndex && localHighlightStart >= 0 && highlightRange
                      ? { start: localHighlightStart, length: highlightRange.length }
                      : undefined
                  }
                />
              </div>
            ))}
          </article>
        )}
      </main>

      {/* Navigation */}
      <NavBar
        pageNum={pageNum}
        totalPages={meta.totalPages}
        onPrev={() => goTo(pageNum - 1)}
        onNext={() => goTo(pageNum + 1)}
        onGoTo={goTo}
      />
    </div>
  );
}
