import { platformCaps } from "@/lib/environment/platformCaps";
import { ytImageUrl } from "@/lib/stream-url";
import { THUMB_SIZE_FULL } from "@/lib/media/cover-sizes";

/**
 * googleusercontent/ggpht covers are served at the size encoded in the URL,
 * and YT Music search/browse payloads only carry tiny renditions (w60–w120)
 * that look crushed once rendered on a hidpi screen. The CDN serves any
 * requested size, so rewrite the size params to a sharp rendition.
 */
function upscaledThumbnail(url: string, size: number): string {
  if (!/\.(?:googleusercontent|ggpht)\.com\//.test(url)) return url;
  return url
    .replace(/=w\d+-h\d+/, `=w${size}-h${size}`)
    .replace(/=s\d+/, `=s${size}`);
}

/**
 * Routes a YouTube thumbnail URL through the media server's `ytimg` route so
 * the Rust side fetches it honoring the configured proxy. `<img>` loads in
 * the webview go straight to the network and bypass the app proxy otherwise.
 * No-op on the web build, which has no media server.
 *
 * `size` picks the CDN rendition — request only what the layout needs so long
 * lists don't decode hero-sized covers per row.
 */
export function proxiedThumbnail(url: string, size: number = THUMB_SIZE_FULL): string {
  const sharp = upscaledThumbnail(url, size);
  if (!platformCaps.hasYoutube) return sharp;
  return ytImageUrl(sharp);
}
