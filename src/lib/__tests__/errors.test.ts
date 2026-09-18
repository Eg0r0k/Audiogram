import { describe, expect, it } from "vitest";
import { errorMessage } from "../errors";

describe("errorMessage", () => {
  it("takes the message of an Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("keeps the subclass message", () => {
    class CustomError extends Error {}
    expect(errorMessage(new CustomError("nope"), "fallback")).toBe("nope");
  });

  it("passes a bare string rejection through", () => {
    expect(errorMessage("cancelled", "fallback")).toBe("cancelled");
  });

  it("falls back on anything else instead of stringifying it", () => {
    expect(errorMessage({ code: 12 }, "Scan failed")).toBe("Scan failed");
    expect(errorMessage(undefined, "Scan failed")).toBe("Scan failed");
    expect(errorMessage(null, "Scan failed")).toBe("Scan failed");
  });

  it("defaults the fallback", () => {
    expect(errorMessage({})).toBe("Unknown error");
  });

  it("keeps an empty Error message rather than substituting the fallback", () => {
    expect(errorMessage(new Error(""), "fallback")).toBe("");
  });
});
