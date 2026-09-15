import { parseTrackRef, type SourceKind } from "@/types/track-ref";
import type { TrackId } from "@/types/ids";
import type { SourceProvider } from "./types";
import { ndSourceProvider } from "./providers/nd.provider";

// ND is part of this module; feature-owned providers (YouTube) register at
// bootstrap (src/main.ts). "local" is deliberately not a provider: the
// registry only special-cases it below.
const providers: Partial<Record<SourceKind, SourceProvider>> = {
  nd: ndSourceProvider,
};

export const sources = {
  register(provider: SourceProvider): void {
    providers[provider.id] = provider;
  },

  get(kind: SourceKind): SourceProvider {
    const provider = providers[kind];
    if (!provider) {
      throw new Error(`No source provider registered for "${kind}"`);
    }
    return provider;
  },

  forTrack(id: TrackId): SourceProvider {
    return sources.get(parseTrackRef(id).kind);
  },

  /** The provider for a kind, or undefined when none is registered ("local" never is). */
  find(kind: SourceKind): SourceProvider | undefined {
    return providers[kind];
  },

  /**
   * Every source compiled into this build, configured or not — settings has
   * to offer the one that is currently switched off, which is exactly the
   * one `available()` leaves out.
   */
  all(): SourceProvider[] {
    return Object.values(providers);
  },

  available(): SourceProvider[] {
    return Object.values(providers).filter(provider => provider.isAvailable);
  },

  /**
   * Whether anything can answer for this kind right now. "local" always can;
   * an unregistered kind never can — so callers may ask about any id's kind
   * without first knowing which providers are wired up.
   */
  isAvailable(kind: SourceKind): boolean {
    return kind === "local" || (providers[kind]?.isAvailable ?? false);
  },

  /**
   * Kinds the library pages can browse — a source qualifies once it can
   * enumerate at least one collection. "local" leads and is unconditional:
   * it is Dexie, not a provider, until its thin wrapper registers above.
   */
  browsable(): SourceKind[] {
    return ["local", ...sources.available()
      .filter(({ capabilities: caps }) => caps.artists.list || caps.albums.list || caps.playlists.list)
      .map(provider => provider.id)];
  },

  /** Kinds that can answer a search query, "local" (the library index) first. */
  searchable(): SourceKind[] {
    return ["local", ...sources.available()
      .filter(provider => provider.capabilities.search)
      .map(provider => provider.id)];
  },
};
