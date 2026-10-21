import { normalizeSearchText, relatedSearchTerms } from "../searchNormalization";
import type { SearchMatch, SearchResultItem } from "../types";

export interface HighlightSegment {
  text: string;
  hit: boolean;
}

// The tokenizer's notion of a word, kept on the original text: marks stay
// attached so an accented letter is cut out whole.
const WORD_REGEX = /[\p{L}\p{N}\p{M}]+/gu;

// How many leading characters of `word` normalize to at least `length`
// characters, so a prefix hit covers the original letters, case and accents included.
const originalPrefixLength = (word: string, length: number): number => {
  for (let end = 1; end < word.length; end++) {
    if (normalizeSearchText(word.slice(0, end)).length >= length) return end;
  }
  return word.length;
};

// The marked length at the start of `word`: the typed prefix of a word still
// being typed, the whole word for an exact, fuzzy or alias hit, 0 for none.
const hitLength = (word: string, match: SearchMatch, terms: ReadonlySet<string>): number => {
  const normalized = normalizeSearchText(word);
  if (!normalized) return 0;
  if (terms.has(normalized)) {
    if (match.queryTerms.includes(normalized)) return word.length;
    const prefix = match.queryTerms.find(query => normalized.startsWith(query));
    return prefix ? originalPrefixLength(word, prefix.length) : word.length;
  }
  return relatedSearchTerms(normalized).some(alias => terms.has(alias)) ? word.length : 0;
};

/** Splits `text` into runs, marking the words the search matched on. */
export const highlightSegments = (text: string, match: SearchMatch): HighlightSegment[] => {
  const terms = new Set(match.terms);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const found of text.matchAll(WORD_REGEX)) {
    const length = hitLength(found[0], match, terms);
    if (length === 0) continue;
    if (found.index > cursor) segments.push({ text: text.slice(cursor, found.index), hit: false });
    segments.push({ text: text.slice(found.index, found.index + length), hit: true });
    cursor = found.index + length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
};

/** Each hit's match keyed by entity id, for rows rendered from hydrated entities. */
export const matchesByEntity = (results: readonly SearchResultItem[]): Record<string, SearchMatch> => {
  const matches: Record<string, SearchMatch> = {};
  for (const item of results) {
    if (item.matched) matches[item.entityId] = item.matched;
  }
  return matches;
};
