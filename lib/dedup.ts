// Fuzzy near-duplicate detection for wheel items (advisory only — drives a soft
// "add anyway" warning, not a hard block). The exact, case-insensitive block lives
// server-side; this catches rephrasings like "Apple" / "Apples" / "I like Apples".

const STOPWORDS = new Set([
  "a", "an", "the", "i", "me", "my", "we", "us", "you", "your", "it", "its",
  "that", "this", "these", "those", "is", "are", "am", "be", "was", "were",
  "to", "of", "and", "or", "for", "in", "on", "at", "with", "as", "by",
  "like", "really", "very", "so", "just", "please", "can", "would", "want",
  "im", "ive", "id", "ill", "lets", "let",
]);

// Crude singularizer — only needs to be consistent (map "apple" and "apples" to the
// same token), not linguistically correct.
function singularize(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y"; // berries -> berry
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1); // apples -> apple
  return w;
}

export function significantTokens(label: string): Set<string> {
  return new Set(
    label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !STOPWORDS.has(w))
      .map(singularize)
      .filter((w) => w.length > 1),
  );
}

// Returns an existing label whose significant words are a subset of the new label's
// (or vice versa) — a likely rephrasing of the same idea — or null. Subset (not just
// "shares a word") keeps "Apple pie" vs "Apple juice" from matching.
export function findSimilarLabel(label: string, existing: string[]): string | null {
  const a = significantTokens(label);
  if (a.size === 0) return null;
  for (const ex of existing) {
    const b = significantTokens(ex);
    if (b.size === 0) continue;
    const aSubsetB = [...a].every((t) => b.has(t));
    const bSubsetA = [...b].every((t) => a.has(t));
    if (aSubsetB || bSubsetA) return ex;
  }
  return null;
}
