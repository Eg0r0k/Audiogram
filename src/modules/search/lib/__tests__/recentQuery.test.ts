import { describe, expect, it } from "vitest";
import { cleanQueryUrl, recentQueryUrl } from "../recentQuery";

describe("recentQueryUrl", () => {
  it("reads a pasted link with a scheme", () => {
    expect(recentQueryUrl("https://music.yandex.ru/album/1/track/2")?.hostname).toBe("music.yandex.ru");
  });

  it("reads a link pasted without a scheme", () => {
    expect(recentQueryUrl("youtu.be/vzhH2312345")?.hostname).toBe("youtu.be");
  });

  it("leaves plain text alone, dots included", () => {
    expect(recentQueryUrl("daft punk")).toBeNull();
    expect(recentQueryUrl("mr. oizo")).toBeNull();
    expect(recentQueryUrl("2.0")).toBeNull();
  });
});

describe("cleanQueryUrl", () => {
  it("drops the scheme, www, the query and a trailing slash", () => {
    expect(cleanQueryUrl(new URL("https://www.example.com/a/b/?utm_source=x"))).toBe("example.com/a/b");
  });

  it("keeps a bare host readable", () => {
    expect(cleanQueryUrl(new URL("https://m.example.com/"))).toBe("example.com");
  });
});
