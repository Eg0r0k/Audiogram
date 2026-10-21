import { describe, expect, it } from "vitest";
import type { ComposerTranslation } from "vue-i18n";
import { youtubeErrorMessage } from "../lib/errors";

const t = ((key: string) => key) as unknown as ComposerTranslation;

describe("youtubeErrorMessage", () => {
  it("explains YouTube's bot check", () => {
    expect(youtubeErrorMessage({ message: "Sign in to confirm you're not a bot" }, t)).toBe("youtube.botError");
  });

  it("does not show the raw error to the user", () => {
    expect(youtubeErrorMessage({ message: "HTTP 500: upstream innertube error" }, t)).toBe("youtube.failed");
  });
});
