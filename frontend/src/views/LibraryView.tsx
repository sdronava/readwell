import { useState, useEffect } from "react";
import { fetchBooks } from "../api/gateway";
import type { BookSummary } from "../types/blocks";
import { BookCard } from "../components/BookCard";

export function LibraryView() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBooks()
      .then((data) => setBooks(data.books))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading library…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Failed to load library: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Readwell</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your library</p>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {books.length === 0 ? (
          <p className="text-gray-400 text-center mt-16">No books found in the library.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {books.map((book) => (
              <BookCard key={book.bookId} book={book} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
