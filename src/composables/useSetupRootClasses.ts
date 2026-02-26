import { IS_OVERLAY_SCROLL_SUPPORTED, USE_CUSTOM_SCROLL, USE_NATIVE_SCROLL } from "@/lib/environment/overlayScrollSupport";
import {
  IS_ANDROID,
  IS_APPLE,
  IS_APPLE_MOBILE,
  IS_FIREFOX,
  IS_MOBILE,
  IS_SAFARI,
  IS_TAURI,
} from "@/lib/environment/userAgent";

export const useSetupRootClasses = () => {
  const add: string[] = [];

  if (USE_NATIVE_SCROLL) {
    add.push("native-scroll");
  }
  else if (IS_OVERLAY_SCROLL_SUPPORTED) {
    add.push("overlay-scroll");
  }
  else if (USE_CUSTOM_SCROLL) {
    add.push("custom-scroll");
  }

  if (IS_TAURI) {
    add.push("is-tauri");
  }
  if (IS_FIREFOX) {
    add.push("is-firefox");
  }
  if (IS_MOBILE) {
    add.push("is-mobile");
  }
  if (IS_APPLE) {
    if (IS_SAFARI) {
      add.push("is-safari");
    }

    if (IS_APPLE_MOBILE) {
      add.push("is-ios");
    }
    else {
      add.push("is-mac");
    }
  }
  else if (IS_ANDROID) {
    add.push("is-android");
  }

  document.documentElement.classList.add(...add);
};
