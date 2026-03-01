import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBook } from "../hooks/useBook";
import { usePage } from "../hooks/usePage";
import { useTTS } from "../hooks/useTTS";
import { BlockRenderer } from "../components/BlockRenderer";
import { NavBar } from "../components/NavBar";
import { TocSidebar } from "../components/TocSidebar";
import { TtsControls } from "../components/TtsControls";

export function ReaderView() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [pageNum, setPageNum] = useState(1);
  const [tocOpen, setTocOpen] = useState(false);

  const { meta, loading: metaLoading, error: metaError } = useBook(bookId!);
  const { page, loading: pageLoading, error: pageError } = usePage(bookId!, pageNum);
  const { speak, stop, speaking } = useTTS(page?.blocks ?? []);

  function goTo(n: number) {
    if (!meta) return;
    const clamped = Math.max(1, Math.min(n, meta.totalPages));
    if (clamped !== pageNum) {
      if (speaking) stop();
      setPageNum(clamped);
    }
  }

  if (metaLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Loading…</p></div>;
  }
  if (metaError || !meta) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-red-600">{metaError ?? "Book not found"}</p></div>;
  }

  // Build a simple manifest for TOC sidebar chapter jumping
  const manifest = meta.tableOfContents.map((ch, i) => ({
    pageNum: i + 1,
    chapterHref: ch.href,
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button
          onClick={() => navigate("/")}
          className="text-gray-500 hover:text-gray-800 text-sm"
        >
          ← Library
        </button>
        <button
          onClick={() => setTocOpen(true)}
          className="text-gray-500 hover:text-gray-800 text-sm ml-1"
        >
          ☰ Contents
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 truncate">{meta.title}</h1>
          {page && <p className="text-xs text-gray-400 truncate">{page.chapter}</p>}
        </div>
        <TtsControls speaking={speaking} onPlay={speak} onStop={stop} />
      </header>

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
        {pageLoading && <p className="text-gray-400 text-center mt-16">Loading page…</p>}
        {pageError && <p className="text-red-500 text-center mt-8">{pageError}</p>}
        {page && !pageLoading && (
          <article aria-live="off">
            {page.blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} cdnBaseUrl={meta.cdnBaseUrl} />
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
      />
    </div>
  );
}
