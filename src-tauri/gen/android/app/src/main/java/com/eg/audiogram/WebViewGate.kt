package com.eg.audiogram

object WebViewGate {
  // The production CSS is lowered to Chromium 105 (vite.config.ts
  // cssTarget); below it Tailwind's translate/scale properties, :has() and
  // @container still break the layout.
  const val MIN_WEBVIEW_MAJOR = 105

  /** "105.0.5195.136" -> 105; null when the name does not start with a number. */
  fun majorVersion(versionName: String?): Int? =
    versionName?.substringBefore('.')?.trim()?.toIntOrNull()

  /** An unreadable version never blocks. */
  fun isOutdated(versionName: String?): Boolean {
    val major = majorVersion(versionName) ?: return false
    return major < MIN_WEBVIEW_MAJOR
  }
}
