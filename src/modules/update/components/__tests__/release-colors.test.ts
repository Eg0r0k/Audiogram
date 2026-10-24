import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Vitest serves .css?raw as an empty string here.
const tokens = readFileSync(path.resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

const KINDS = ["--release-feat", "--release-impr", "--release-fix"] as const;

const themeBlock = (pattern: RegExp) => {
  const body = pattern.exec(tokens)?.[1];
  if (!body) throw new Error(`No block for ${pattern}`);
  return body;
};

const LIGHT = themeBlock(/:root,\s*\.light\s*\{([^}]*)\}/);
const DARK = themeBlock(/(?:^|\n)\.dark\s*\{([^}]*)\}/);

const tokenIn = (block: string, name: string) => {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const channelToLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const hexLuminance = (hex: string) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`${hex} is not a #rrggbb colour`);
  const [r, g, b] = match.slice(1).map(part => channelToLinear(Number.parseInt(part, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// A grey in OKLab has r = g = b = L^3 in linear sRGB.
const greyLuminance = (oklch: string) => {
  const match = /^oklch\(\s*([\d.]+)\s+0\s+0\s*\)$/.exec(oklch);
  if (!match) throw new Error(`${oklch} is not an achromatic oklch() colour`);
  return Number(match[1]) ** 3;
};

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("release section colours", () => {
  it("keeps release section colours at 4.5:1 in both themes", () => {
    const themes = [
      { name: "light", block: LIGHT, surface: greyLuminance(tokenIn(LIGHT, "--card")) },
      { name: "dark", block: DARK, surface: greyLuminance(tokenIn(DARK, "--card")) },
    ];

    const ratios = themes.flatMap(theme => KINDS.map(kind => ({
      theme: theme.name,
      kind,
      ratio: contrast(hexLuminance(tokenIn(theme.block, kind)), theme.surface),
    })));

    expect(ratios).toHaveLength(6);
    for (const { theme, kind, ratio } of ratios) {
      expect(ratio, `${kind} in ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
