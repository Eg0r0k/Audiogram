import { describe, expect, it } from "vitest";
import { catalogViewRoute, routeLocation } from "../route-locations";

describe("catalogViewRoute", () => {
  it("links a library view of a remote-branded entity to its catalog view", () => {
    expect(catalogViewRoute("album", "ym:album:9", true)).toEqual(routeLocation.album("ym:album:9", { catalog: true }));
    expect(catalogViewRoute("artist", "ym:artist:5", true)).toEqual(routeLocation.artist("ym:artist:5", { catalog: true }));
    expect(catalogViewRoute("playlist", "nd:pl1", true)).toEqual(routeLocation.playlist("nd:pl1", { catalog: true }));
  });

  it("is null for a local id", () => {
    expect(catalogViewRoute("album", "local-uuid", true)).toBeNull();
  });

  it("is null when the page is already the catalog view (not a library entity)", () => {
    expect(catalogViewRoute("artist", "ym:artist:5", false)).toBeNull();
  });
});
