import { describe, expect, it } from "vitest";
import {
  artistFallbackUrl,
  COVER_GRADIENTS,
  MASCOT_PARTS,
  MASCOT_SLOTS,
  mascotCoverUrl,
  mascotTraits,
  mascotVariantCount,
  placeholderCoverUrl,
  rendezvousPick,
} from "..";

// A change here gives existing albums and playlists a different picture: fine
// when a variant was added or removed on purpose (update these in the same
// commit), a bug otherwise.
const FIXTURES = [
  { seed: "Новый плейлист", gradient: "orange", phones: "colored", eyes: "regular", mouth: "laugh", extra: "none" },
  { seed: "Зал", gradient: "red", phones: "white", eyes: "sleepy", mouth: "fang", extra: "sparkles" },
  { seed: "0b1e7c2a-5f43-4d0e-9a61-2c8f0f0d9b11", gradient: "blue", phones: "white", eyes: "glasses", mouth: "o", extra: "none" },
  { seed: "6f9619ff-8b86-d011-b42d-00c04fc964ff", gradient: "red", phones: "white", eyes: "happy", mouth: "laugh", extra: "sparkles" },
  { seed: "navidrome:al-2f9c", gradient: "cyan", phones: "cat-ears", eyes: "happy", mouth: "fang", extra: "none" },
] as const;

const liveNames = (slot: (typeof MASCOT_SLOTS)[number]) =>
  MASCOT_PARTS[slot].filter(part => !part.draft).map(part => part.name);

describe("mascotTraits", () => {
  // Adding, shelving or deleting a part moves existing covers; this list makes
  // that a deliberate change instead of a silent one.
  it("draws from the expected live variants", () => {
    expect(Object.fromEntries(MASCOT_SLOTS.map(slot => [slot, liveNames(slot)]))).toEqual({
      phones: ["cat-ears", "colored", "white"],
      eyes: ["dots", "glasses", "happy", "regular", "sleepy", "stars", "wink"],
      mouth: ["cat", "fang", "laugh", "o", "smile", "smirk"],
      extra: ["bow", "none", "note", "sparkles"],
    });
  });

  it.each(FIXTURES)("is stable for $seed", ({ seed, ...expected }) => {
    expect(mascotTraits(seed)).toEqual(expected);
  });

  it("never picks a draft (_name.svg)", () => {
    const drafts = new Set(MASCOT_SLOTS.flatMap(slot =>
      MASCOT_PARTS[slot].filter(part => part.draft).map(part => `${slot}/${part.name}`)));
    for (let i = 0; i < 3000; i++) {
      const traits = mascotTraits(`draft-check-${i}`);
      for (const slot of MASCOT_SLOTS) expect(drafts.has(`${slot}/${traits[slot]}`)).toBe(false);
    }
  });

  it("spreads ids evenly over every variant", () => {
    const n = 12000;
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      for (const [trait, value] of Object.entries(mascotTraits(`spread-${i}`))) {
        counts.set(`${trait}/${value}`, (counts.get(`${trait}/${value}`) ?? 0) + 1);
      }
    }
    const options: Record<string, number> = {
      gradient: COVER_GRADIENTS.length,
      ...Object.fromEntries(MASCOT_SLOTS.map(slot => [slot, liveNames(slot).length])),
    };
    for (const [key, count] of counts) {
      const expected = n / options[key.split("/")[0]];
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.12);
    }
    expect(counts.size).toBe(Object.values(options).reduce((a, b) => a + b, 0));
  });
});

describe("rendezvousPick", () => {
  it("moves only ~1/(n+1) of ids, all of them to the new variant, when one is added", () => {
    const before = [..."abcdefg"].map(name => ({ name }));
    const after = [...before, { name: "h" }];
    let moved = 0;
    for (let i = 0; i < 8000; i++) {
      const a = rendezvousPick(`id-${i}`, "eyes", before).name;
      const b = rendezvousPick(`id-${i}`, "eyes", after).name;
      if (a !== b) {
        moved++;
        expect(b).toBe("h");
      }
    }
    expect(moved / 8000).toBeGreaterThan(0.09);
    expect(moved / 8000).toBeLessThan(0.16);
  });
});

describe("placeholderCoverUrl", () => {
  it("gives albums and playlists the mascot of their id", () => {
    expect(placeholderCoverUrl("album", "a1")).toBe(mascotCoverUrl("a1"));
    expect(placeholderCoverUrl("playlist", "p1")).toBe(mascotCoverUrl("p1"));
  });

  it("gives artists the glyph on the gradient of their id", () => {
    expect(placeholderCoverUrl("artist", "r1")).toBe(artistFallbackUrl("r1"));
  });

  it("keeps the static pictures for tracks and owners without an id", () => {
    expect(placeholderCoverUrl("track", "t1")).toBe("/img/fallback.svg");
    expect(placeholderCoverUrl("album", null)).toBe("/img/fallback.svg");
    expect(placeholderCoverUrl(null, null)).toBe("/img/fallback.svg");
    expect(placeholderCoverUrl("artist", null)).toBe("/img/artist-fallback.svg");
  });
});

describe("urls", () => {
  it("counts variants from the live files", () => {
    expect(mascotVariantCount()).toBeGreaterThan(1);
  });

  it("leaves no currentColor in the output", () => {
    expect(decodeURIComponent(mascotCoverUrl("abc"))).not.toContain("currentColor");
  });

  it("gives svg data urls", () => {
    expect(mascotCoverUrl("abc")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(artistFallbackUrl("abc")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
