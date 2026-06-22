import Fuse from 'fuse.js';

export type Category = {
  id: number;
  name: string;
  parent: string | null;
};

const FUSE_THRESHOLD = 0.4;

export function matchCategory(spoken: string, categories: Category[]): Category | null {
  if (!spoken || categories.length === 0) return null;

  const normalizedSpoken = spoken.trim().toLowerCase();

  // Step 1: exact match (case-insensitive)
  const exact = categories.find((c) => c.name.toLowerCase() === normalizedSpoken);
  if (exact) return exact;

  // Step 2: fuzzy match via Fuse.js
  const fuse = new Fuse(categories, {
    keys: ['name'],
    threshold: FUSE_THRESHOLD,
    includeScore: true,
  });

  const results = fuse.search(normalizedSpoken);
  if (results.length > 0) return results[0].item;

  // Step 3: no match
  return null;
}
