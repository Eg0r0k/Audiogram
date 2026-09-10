/**
 * Display name of an Android `content://` document.
 *
 * tauri-plugin-dialog returns SAF URIs whose last segment is the provider's
 * document id (`msf%3A1002330782`), not the file name — only ContentResolver
 * knows the name. MainActivity exposes that query over an
 * `addJavascriptInterface` bridge (`window.AudiogramContentName`); a
 * String-returning interface method is called synchronously from JS.
 */

declare global {
  interface Window {
    AudiogramContentName?: {
      displayName: (uri: string) => string | null;
    };
  }
}

export const androidContentDisplayName = (uri: string): string | null => {
  const bridge = typeof window !== "undefined" ? window.AudiogramContentName : undefined;
  if (typeof bridge?.displayName !== "function") return null;
  try {
    return bridge.displayName(uri) || null;
  }
  catch {
    return null;
  }
};
