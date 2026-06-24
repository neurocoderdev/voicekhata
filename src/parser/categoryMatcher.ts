import Fuse from 'fuse.js';
import { CATEGORY_SYNONYMS } from '../utils/constants';

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

  // Step 2: synonym / known-misrecognition map ("petrol"→Fuel, "jim"→Gym). This
  // bridges gaps fuzzy matching can't (phonetically distant words) and real
  // synonyms. Only resolves if the target category actually exists in the list.
  const synonymTarget = CATEGORY_SYNONYMS[normalizedSpoken];
  if (synonymTarget) {
    const bySynonym = categories.find((c) => c.name.toLowerCase() === synonymTarget.toLowerCase());
    if (bySynonym) return bySynonym;
  }

  // Step 3: fuzzy match via Fuse.js
  const fuse = new Fuse(categories, {
    keys: ['name'],
    threshold: FUSE_THRESHOLD,
    includeScore: true,
  });

  const results = fuse.search(normalizedSpoken);
  if (results.length > 0) return results[0].item;

  // Step 4: no match
  return null;
}
