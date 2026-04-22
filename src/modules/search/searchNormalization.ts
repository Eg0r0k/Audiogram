import { SEARCH_ASSOCIATION_GROUPS } from "./searchAssociations";

const NON_ALPHANUMERIC_REGEX = /[^\p{L}\p{N}]+/gu;

const SEARCH_ASSOCIATIONS = createSearchAssociations();

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/gu, "е")
    .replace(NON_ALPHANUMERIC_REGEX, " ")
    .trim();
}

export function unicodeTokenizer(text: string): string[] {
  const normalized = normalizeSearchText(text);

  return normalized ? normalized.split(/\s+/u) : [];
}

export function termProcessor(term: string): string | null {
  const normalized = normalizeSearchText(term);
  return normalized.length > 0 ? normalized : null;
}

export function buildSearchAliases(...values: Array<string | undefined>): string {
  const aliases = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    for (const token of unicodeTokenizer(value)) {
      const related = SEARCH_ASSOCIATIONS.get(token);

      if (!related) continue;

      for (const alias of related) {
        if (alias !== token) {
          aliases.add(alias);
        }
      }
    }
  }

  return Array.from(aliases).join(" ");
}

function createSearchAssociations(): Map<string, readonly string[]> {
  const associations = new Map<string, Set<string>>();

  for (const group of SEARCH_ASSOCIATION_GROUPS) {
    const normalizedTerms = Array.from(new Set(group.terms.flatMap(term => unicodeTokenizer(term))));

    for (const term of normalizedTerms) {
      const related = associations.get(term) ?? new Set<string>();

      for (const candidate of normalizedTerms) {
        related.add(candidate);
      }

      associations.set(term, related);
    }
  }

  return new Map(Array.from(associations.entries(), ([term, related]) => [term, Array.from(related)]));
}
