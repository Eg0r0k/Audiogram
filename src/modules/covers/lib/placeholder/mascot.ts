import type { CoverOwnerType } from "@/db/entities";
import { COVER_GRADIENTS, type CoverGradient } from "./gradients";
import { MASCOT_BASE, MASCOT_PARTS, MASCOT_SLOTS, type MascotPart, type MascotSlot } from "./parts";

export type MascotTraits = { readonly gradient: string } & { readonly [S in MascotSlot]: string };

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

// crc32 over UTF-16LE code units. Takes and returns the running state, so the
// "seed/slot/" prefix is hashed once per pick.
const crcUpdate = (state: number, value: string): number => {
  let crc = state;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    crc = CRC_TABLE[(crc ^ unit) & 0xff] ^ (crc >>> 8);
    crc = CRC_TABLE[(crc ^ (unit >>> 8)) & 0xff] ^ (crc >>> 8);
  }
  return crc;
};

// MurmurHash3 finalizer: crc32 is linear, so raw scores of strings that differ
// only in the variant name are correlated and some variants would win too often.
const fmix32 = (value: number): number => {
  let h = value ^ (value >>> 16);
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

/**
 * Rendezvous hashing: the option scoring highest for `seed` wins. Adding an
 * option moves only the seeds it now wins, about 1/(n+1) of them; removing one
 * moves only the seeds that had it. `options` must be non-empty.
 */
export const rendezvousPick = <T extends { readonly name: string }>(
  seed: string,
  slot: string,
  options: readonly T[],
): T => {
  const prefix = crcUpdate(0xffffffff, `${seed}/${slot}/`);
  let best = options[0];
  let bestScore = -1;
  for (const option of options) {
    const score = fmix32((crcUpdate(prefix, option.name) ^ 0xffffffff) >>> 0);
    if (score > bestScore || (score === bestScore && option.name < best.name)) {
      best = option;
      bestScore = score;
    }
  }
  return best;
};

const liveParts = (slot: MascotSlot) => MASCOT_PARTS[slot].filter(part => !part.draft);

export const coverGradient = (seed: string): CoverGradient => rendezvousPick(seed, "gradient", COVER_GRADIENTS);

export const mascotTraits = (seed: string): MascotTraits => ({
  gradient: coverGradient(seed).name,
  ...Object.fromEntries(MASCOT_SLOTS.map(slot => [slot, rendezvousPick(seed, slot, liveParts(slot)).name])),
}) as MascotTraits;

export const mascotVariantCount = (): number =>
  MASCOT_SLOTS.reduce((count, slot) => count * liveParts(slot).length, COVER_GRADIENTS.length);

// Square art: the corners come from the <img> classes (rounded-md, rounded-full).
const frame = (gradient: CoverGradient, viewBox: string, art: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`
  + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="${gradient.top}"/><stop offset="1" stop-color="${gradient.bottom}"/>`
  + `</linearGradient></defs>`
  + `<rect x="-20" y="-20" width="210" height="210" fill="url(#g)"/>${art}</svg>`;

const partOf = (slot: MascotSlot, name: string) => MASCOT_PARTS[slot].find(part => part.name === name);

// A name with no file is skipped; a draft's name is drawn, so the stand can preview it.
const mascotSvg = (traits: MascotTraits): string => {
  const gradient = COVER_GRADIENTS.find(g => g.name === traits.gradient) ?? COVER_GRADIENTS[0];
  const parts = MASCOT_SLOTS.flatMap(slot => partOf(slot, traits[slot]) ?? []);
  const markup = (include: (part: MascotPart) => boolean) =>
    parts.filter(include).map(part => part.markup).join("");
  const front = (slot: MascotSlot) => markup(part => !part.back && part.slot === slot);
  const art = markup(part => part.back)
    + MASCOT_BASE.head + front("phones") + MASCOT_BASE.body
    + front("eyes") + front("mouth") + front("extra");
  return frame(gradient, "8 8 154 154", art.replace(/currentColor/g, gradient.ink));
};

// From public/img/artist-fallback.svg: [path, stroke width].
const ARTIST_GLYPH: readonly (readonly [string, number])[] = [
  ["M98.4284 61.857C98.4284 69.2734 92.4163 75.2856 84.9999 75.2856C77.5835 75.2856 71.5713 69.2734 71.5713 61.857C71.5713 54.4406 77.5835 48.4285 84.9999 48.4285C92.4163 48.4285 98.4284 54.4406 98.4284 61.857Z", 8.05714],
  ["M71.5716 88.7145L57.4085 98.1566C53.6726 100.647 51.4287 104.84 51.4287 109.33V116.019C51.4287 119.48 54.2344 122.286 57.6954 122.286H85.0001", 8.05714],
  ["M115.213 61.8574V92.0717M115.213 92.0717V107.077C115.213 110.064 113.086 112.67 110.1 112.576C105.163 112.42 98.4277 110.649 98.4277 102.143C98.4277 88.7146 115.213 92.0717 115.213 92.0717Z", 6.71428],
];

const artistSvg = (gradient: CoverGradient): string =>
  frame(gradient, "0 0 170 170", ARTIST_GLYPH.map(([d, width]) =>
    `<path d="${d}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ).join(""));

// Keyed by look, not by id, so it never outgrows the number of variants.
const urlCache = new Map<string, string>();

const cachedSvgUrl = (key: string, build: () => string): string => {
  let url = urlCache.get(key);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(build())}`;
    urlCache.set(key, url);
  }
  return url;
};

export const mascotUrlForTraits = (traits: MascotTraits): string =>
  cachedSvgUrl(`mascot:${traits.gradient}:${MASCOT_SLOTS.map(slot => traits[slot]).join(":")}`, () => mascotSvg(traits));

/** The cover of an album or playlist without artwork; seed it with the id, not the title. */
export const mascotCoverUrl = (seed: string): string => mascotUrlForTraits(mascotTraits(seed));

/** The picture of an artist without a photo, on the same gradient the id gives a mascot. */
export const artistFallbackUrl = (seed: string): string => {
  const gradient = coverGradient(seed);
  return cachedSvgUrl(`artist:${gradient.name}`, () => artistSvg(gradient));
};

/** What an owner without artwork shows; tracks and id-less owners keep the static grey pictures. */
export const placeholderCoverUrl = (ownerType: CoverOwnerType | null, ownerId: string | null): string => {
  if (ownerId && (ownerType === "album" || ownerType === "playlist")) return mascotCoverUrl(ownerId);
  if (ownerType === "artist") return ownerId ? artistFallbackUrl(ownerId) : "/img/artist-fallback.svg";
  return "/img/fallback.svg";
};
