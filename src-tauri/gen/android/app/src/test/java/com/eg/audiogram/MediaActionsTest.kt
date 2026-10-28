package com.eg.audiogram

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaActionsTest {
  @Test
  fun skipsTheWakeOnlyForPauseAndStop() {
    assertTrue(MediaActions.needsWake("play"))
    assertTrue(MediaActions.needsWake("next"))
    assertTrue(MediaActions.needsWake("previous"))
    assertTrue(MediaActions.needsWake("seekto"))
    assertTrue(MediaActions.needsWake("repeat"))
    assertTrue(MediaActions.needsWake("like"))
    assertFalse(MediaActions.needsWake("pause"))
    assertFalse(MediaActions.needsWake("stop"))
  }
}
