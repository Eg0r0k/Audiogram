// One SVG per variant in src/assets/mascot/<slot>/<name>.svg; see the README there.
export const MASCOT_SLOTS = ["phones", "eyes", "mouth", "extra"] as const;
export type MascotSlot = (typeof MASCOT_SLOTS)[number];

export interface MascotPart {
  readonly slot: MascotSlot;
  /** File name without `_`, `.back` and `.svg`: the variant's key, renaming it moves covers. */
  readonly name: string;
  /** `_name.svg`: shown on the dev stand, never picked for a cover. */
  readonly draft: boolean;
  /** `name.back.svg`: drawn behind the head. */
  readonly back: boolean;
  /** Inner markup of the file's <svg>. */
  readonly markup: string;
}

const files = import.meta.glob<string>("@/assets/mascot/*/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

const innerMarkup = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

const isSlot = (dir: string): dir is MascotSlot => (MASCOT_SLOTS as readonly string[]).includes(dir);

const svgFiles = Object.entries(files).flatMap(([path, svg]) => {
  const match = /\/([^/]+)\/([^/]+)\.svg$/.exec(path);
  return match ? [{ dir: match[1], file: match[2], markup: innerMarkup(svg) }] : [];
});

const baseMarkup = (file: string) =>
  svgFiles.find(entry => entry.dir === "base" && entry.file === file)?.markup ?? "";

export const MASCOT_BASE = { head: baseMarkup("head"), body: baseMarkup("body") };

const parts: MascotPart[] = svgFiles.flatMap(({ dir, file, markup }) =>
  isSlot(dir)
    ? [{
        slot: dir,
        name: file.replace(/^_/, "").replace(/\.back$/, ""),
        draft: file.startsWith("_"),
        back: file.endsWith(".back"),
        markup,
      }]
    : [],
);

const partsOf = (slot: MascotSlot) =>
  parts.filter(part => part.slot === slot).sort((a, b) => a.name.localeCompare(b.name));

/** Every part by slot, drafts included, sorted by name. */
export const MASCOT_PARTS: Readonly<Record<MascotSlot, readonly MascotPart[]>> = {
  phones: partsOf("phones"),
  eyes: partsOf("eyes"),
  mouth: partsOf("mouth"),
  extra: partsOf("extra"),
};
