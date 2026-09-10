package com.eg.audiogram

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface

/**
 * Resolves the display name of a `content://` document for the web side.
 *
 * The file picker hands the web app SAF URIs whose last segment is the
 * provider's document id, not the file name; only the ContentResolver knows
 * the name. A String-returning interface method is invoked synchronously
 * from JS, on the WebView's JavaBridge thread, where a resolver query is fine.
 *
 * Protocol: `window.AudiogramContentName.displayName(uri)` → name or null
 * (unknown provider, revoked permission, no DISPLAY_NAME column).
 */
class ContentNameBridge(private val contentResolver: ContentResolver) {
  @JavascriptInterface
  fun displayName(uri: String): String? = try {
    contentResolver.query(
      Uri.parse(uri),
      arrayOf(OpenableColumns.DISPLAY_NAME),
      null,
      null,
      null,
    )?.use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
    }
  } catch (_: Exception) {
    null
  }
}
