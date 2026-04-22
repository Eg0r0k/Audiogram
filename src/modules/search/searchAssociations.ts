export interface SearchAssociationGroup {
  name: string;
  terms: readonly string[];
}

export const SEARCH_ASSOCIATION_GROUPS: readonly SearchAssociationGroup[] = [
  {
    name: "featured-artists",
    terms: ["feat", "feat.", "ft", "ft.", "featuring"],
  },
  {
    name: "soundtrack",
    terms: ["ost", "original soundtrack", "саундтрек"],
  },
  {
    name: "disc-jockey",
    terms: ["dj", "диджей"],
  },
];
