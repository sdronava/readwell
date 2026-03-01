import type { BookSummary, BookMeta, PageData } from "../types/blocks";

const BASE = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

export const fetchBooks = (): Promise<{ books: BookSummary[] }> =>
  get("/api/v1/books");

export const fetchMetadata = (bookId: string): Promise<BookMeta> =>
  get(`/api/v1/books/${bookId}/metadata`);

export const fetchPage = (bookId: string, pageNum: number): Promise<PageData> =>
  get(`/api/v1/books/${bookId}/pages/${pageNum}`);
