package com.eg.audiogram

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WebViewGateTest {
  @Test
  fun readsTheMajorVersion() {
    assertEquals(105, WebViewGate.majorVersion("105.0.5195.136"))
    assertNull(WebViewGate.majorVersion("dev-build"))
    assertNull(WebViewGate.majorVersion(null))
  }

  @Test
  fun flagsOnlyVersionsBelowTheFloor() {
    assertTrue(WebViewGate.isOutdated("104.0.5112.97"))
    assertFalse(WebViewGate.isOutdated("105.0.5195.136"))
    assertFalse(WebViewGate.isOutdated("141.0.7390.122"))
  }

  @Test
  fun neverBlocksAnUnknownVersion() {
    assertFalse(WebViewGate.isOutdated(null))
    assertFalse(WebViewGate.isOutdated("dev-build"))
  }
}
