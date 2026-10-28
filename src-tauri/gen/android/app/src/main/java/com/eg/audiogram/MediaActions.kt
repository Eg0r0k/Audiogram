package com.eg.audiogram

object MediaActions {
  /** A pause or stop reaches a page that is playing, hence never frozen; every other action may await a continuation. */
  fun needsWake(action: String): Boolean =
    action != "pause" && action != "stop"
}
