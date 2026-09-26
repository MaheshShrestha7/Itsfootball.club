/** Supabase returns at most this many rows per request, whatever .limit() asks for */
export const PAGE_SIZE = 1000;

/**
 * Up to `max` rows of a query, fetched a page at a time. `page(from, to)` fetches rows
 * from..to inclusive (as Supabase's .range() does). Stops at the first short page or error,
 * returning the rows gathered so far alongside the error.
 */
export async function fetchPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  max: number
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];
  while (rows.length < max) {
    const { data, error } = await page(rows.length, Math.min(rows.length + PAGE_SIZE, max) - 1);
    if (error) return { data: rows, error: error.message };
    rows.push(...((data || []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
