export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const cap = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const errors: unknown[] = [];

  async function runOne() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      try {
        results[current] = await worker(items[current], current);
      } catch (err) {
        errors[current] = err;
      }
    }
  }

  const workers = Array.from({ length: cap }, () => runOne());
  await Promise.all(workers);

  if (errors.length > 0) {
    const first = errors.find((e) => e !== undefined);
    if (first !== undefined) throw first;
  }
  return results;
}
