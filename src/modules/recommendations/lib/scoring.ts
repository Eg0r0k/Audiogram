export const COMPONENT_KEYS = ["audio", "trackTransition", "artistTransition", "affinity", "explore"] as const;
export type ComponentKey = typeof COMPONENT_KEYS[number];
export type ComponentWeights = Record<ComponentKey, number>;
