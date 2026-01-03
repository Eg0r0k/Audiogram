import { Vibrant } from "node-vibrant/browser";
import { ref } from "vue";

export interface ColorResult {
  hex: string;
  rgb: string;
  hsl: string;
  isDark: boolean;
}

export interface UseImageColorOptions {
  lightness?: number;
  saturation?: number;
  colorType?: "Vibrant" | "Muted" | "DarkVibrant" | "DarkMuted" | "LightVibrant" | "LightMuted";
  fallback?: string;
}

const defaultOptions: UseImageColorOptions = {
  lightness: undefined,
  saturation: undefined,
  colorType: "DarkMuted",
  fallback: "#535353",
};

export const getColorFromImage = async (
  source: string | HTMLImageElement,
  options: UseImageColorOptions = {},
): Promise<ColorResult> => {
  const opts = { ...defaultOptions, ...options };

  try {
    const palette = await Vibrant.from(source).getPalette();

    let swatch = opts.colorType ? palette[opts.colorType] : null;

    if (!swatch) {
      swatch
        = palette.DarkMuted
          || palette.Muted
          || palette.DarkVibrant
          || palette.Vibrant
          || palette.LightMuted
          || palette.LightVibrant;
    }

    if (!swatch) {
      throw new Error("No color found");
    }

    let [h, s, l] = swatch.hsl;
    h = Math.round(h * 360);
    s = opts.saturation ?? Math.round(s * 100);
    l = opts.lightness ?? Math.round(l * 100);

    const rgb = swatch.rgb.map(Math.round) as [number, number, number];

    return {
      hex: swatch.hex,
      rgb: `rgb(${rgb.join(", ")})`,
      hsl: `hsl(${h}, ${s}%, ${l}%)`,
      isDark: l < 50,
    };
  }
  catch (error) {
    return {
      hex: opts.fallback!,
      rgb: opts.fallback!,
      hsl: opts.fallback!,
      isDark: true,
    };
  }
};

export const useImageColor = (initialOptions: UseImageColorOptions = {}) => {
  const options = { ...defaultOptions, ...initialOptions };

  const color = ref<ColorResult>({
    hex: options.fallback!,
    rgb: options.fallback!,
    hsl: options.fallback!,
    isDark: true,
  });

  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const extractColor = async (
    source: string | HTMLImageElement,
    overrideOptions?: UseImageColorOptions,
  ) => {
    isLoading.value = true;
    error.value = null;

    try {
      const finalOptions = { ...options, ...overrideOptions };
      color.value = await getColorFromImage(source, finalOptions);
    }
    catch (e) {
      error.value = e as Error;
    }
    finally {
      isLoading.value = false;
    }
  };

  return {
    color,
    isLoading,
    error,
    extractColor,
  };
};
