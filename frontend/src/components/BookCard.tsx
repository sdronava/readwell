import { useNavigate } from "react-router-dom";
import type { BookSummary } from "../types/blocks";

interface Props {
  book: BookSummary;
}

export function BookCard({ book }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      <div className="bg-gray-100 h-56 flex items-center justify-center overflow-hidden">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            className="object-cover h-full w-full"
          />
        ) : (
          <span className="text-gray-400 text-4xl">📖</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-3">{book.title}</h3>
        <p className="text-gray-500 text-xs mt-1">{book.author}</p>
        <p className="text-gray-400 text-xs mt-1">{book.totalPages} pages</p>
        <div className="mt-auto pt-3">
          <button
            onClick={() => navigate(`/books/${book.bookId}`)}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Read
          </button>
        </div>
      </div>
    </div>
  );
}
