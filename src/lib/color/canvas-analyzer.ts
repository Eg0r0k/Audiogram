const CANVAS_SIZE = 96;
const ANALYSIS_TIMEOUT = 10000;
// Below this alpha a pixel is treated as transparent and does not vote.
const MIN_ALPHA = 128;

/** RGBA canvas bytes → opaque ARGB ints for the Material quantizer. */
export const imageDataToArgb = (data: Uint8ClampedArray): number[] => {
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    pixels.push(((0xff << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0);
  }
  return pixels;
};

const isCrossOrigin = (url: string) => {
  if (/^(?:blob|data):/i.test(url)) return false;
  try {
    return new URL(url, location.href).origin !== location.origin;
  }
  catch {
    return false;
  }
};

/** Loads the image, downsamples it to 96×96 and returns its opaque ARGB pixels. */
export const analyzeWithCanvas = async (imageUrl: string): Promise<number[] | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    if (isCrossOrigin(imageUrl)) img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      console.warn("[ColorExtraction] Canvas analysis timeout");
      resolve(null);
    }, ANALYSIS_TIMEOUT);

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      img.remove();
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      try {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          console.warn("[ColorExtraction] No canvas context");
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const { data } = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        cleanup();
        resolve(imageDataToArgb(data));
      }
      catch (error) {
        console.error("[ColorExtraction] Canvas error:", error);
        cleanup();
        resolve(null);
      }
    };

    img.onerror = (error) => {
      cleanup();
      console.error("[ColorExtraction] Image load error:", error);
      resolve(null);
    };

    img.src = imageUrl;
  });
};
