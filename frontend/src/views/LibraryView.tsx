import { useState, useEffect } from "react";
import { fetchBooks } from "../api/gateway";
import type { BookSummary } from "../types/blocks";
import { BookCard } from "../components/BookCard";
import { SkeletonCard } from "../components/SkeletonCard";
import { useTheme } from "../contexts/ThemeContext";

export function LibraryView() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { darkMode, toggleDark } = useTheme();

  useEffect(() => {
    fetchBooks()
      .then((data) => setBooks(data.books))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.author.toLowerCase().includes(query.toLowerCase())
  );

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-surface-dark">
        <p className="text-red-600 dark:text-red-400">Failed to load library: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted dark:bg-surface-dark transition-colors">
      <header className="bg-white dark:bg-surface-muted-dark border-b dark:border-gray-700 px-6 py-4 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Readwell</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your library</p>
        </div>
        <button
          onClick={toggleDark}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <input
            type="search"
            placeholder="Search by title or author…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-muted-dark text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-center mt-16">
            {query ? "No books match your search." : "No books found in the library."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {filtered.map((book) => (
              <BookCard key={book.bookId} book={book} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
