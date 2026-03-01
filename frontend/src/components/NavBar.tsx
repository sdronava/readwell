interface Props {
  pageNum: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function NavBar({ pageNum, totalPages, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t bg-white sticky bottom-0">
      <button
        onClick={onPrev}
        disabled={pageNum <= 1}
        className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
      >
        ← Prev
      </button>
      <span className="text-sm text-gray-600">
        Page {pageNum} of {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={pageNum >= totalPages}
        className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
      >
        Next →
      </button>
    </div>
  );
}
