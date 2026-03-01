import { useState, useEffect } from "react";
import { fetchMetadata } from "../api/gateway";
import type { BookMeta } from "../types/blocks";

export function useBook(bookId: string) {
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMetadata(bookId)
      .then(setMeta)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bookId]);

  return { meta, loading, error };
}
