declare module "node-vibrant/browser" {
  export interface Swatch {
    hex: string;
    rgb: [number, number, number];
    population: number;
  }

  export interface Palette {
    Vibrant: Swatch | null;
    LightVibrant: Swatch | null;
    DarkVibrant: Swatch | null;
    Muted: Swatch | null;
    LightMuted: Swatch | null;
    DarkMuted: Swatch | null;
  }

  export class Vibrant {
    static from(src: string): Vibrant;
    quality(quality: number): Vibrant;
    getPalette(): Promise<Palette>;
  }
}
