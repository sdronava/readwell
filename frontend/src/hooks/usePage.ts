import { useState, useEffect } from "react";
import { fetchPage } from "../api/gateway";
import type { PageData } from "../types/blocks";

export function usePage(bookId: string, pageNum: number) {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPage(bookId, pageNum)
      .then(setPage)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bookId, pageNum]);

  return { page, loading, error };
}
