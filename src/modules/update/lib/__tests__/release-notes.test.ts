import { describe, expect, it } from "vitest";
import { renderReleaseNotes } from "../release-notes";

const render = (markdown: string) => {
  const notes = renderReleaseNotes(markdown);
  const root = new DOMParser().parseFromString(notes.html, "text/html").body;
  return { notes, root };
};

const items = (root: HTMLElement) => Array.from(root.querySelectorAll("li"));

describe("renderReleaseNotes", () => {
  it("takes an image before the first heading as the hero", () => {
    const { notes, root } = render([
      "![Mini player in the cover colour](https://example.com/hero.png)",
      "",
      "### New Features",
      "",
      "- **Mini player progress** - The played part fills the card.",
    ].join("\n"));

    expect(notes.hasHero).toBe(true);
    const hero = root.firstElementChild;
    expect(hero?.matches(".rn-media.rn-hero")).toBe(true);
    const img = hero?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/hero.png");
    expect(img?.getAttribute("alt")).toBe("Mini player in the cover colour");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");
    expect(root.querySelectorAll("img")).toHaveLength(1);
    expect(hero?.nextElementSibling?.tagName).toBe("H3");

    const withIntro = render("![Hero](https://example.com/hero.png)\nThe biggest release yet.\n\n## Fixes\n\n- One");
    expect(withIntro.notes.hasHero).toBe(true);
    expect(withIntro.root.firstElementChild?.matches(".rn-hero")).toBe(true);
    expect(withIntro.root.querySelector(".rn-hero + p")?.textContent?.trim()).toBe("The biggest release yet.");
    expect(withIntro.root.querySelectorAll("img")).toHaveLength(1);

    const uploaded = render(
      "<img width=\"619\" height=\"611\" alt=\"Screenshot\" src=\"https://github.com/user-attachments/assets/74f8beb3\" />\r\n\r\n### Fixes\r\n\r\n- One",
    );
    expect(uploaded.notes.hasHero).toBe(true);
    const uploadedImg = uploaded.root.querySelector(".rn-hero > img");
    expect(uploadedImg?.getAttribute("src")).toBe("https://github.com/user-attachments/assets/74f8beb3");
    expect(uploadedImg?.getAttribute("alt")).toBe("Screenshot");
    expect(uploadedImg?.hasAttribute("width")).toBe(false);
  });

  it("has no hero when the notes start with text or a heading", () => {
    const textFirst = render("Thanks for updating.\n\n![Shot](https://example.com/a.png)\n\n## Fixes\n\n- One");
    expect(textFirst.notes.hasHero).toBe(false);
    expect(textFirst.root.querySelector(".rn-hero")).toBeNull();
    expect(textFirst.root.firstElementChild?.tagName).toBe("P");
    expect(textFirst.root.querySelector(".rn-media > img")?.getAttribute("src")).toBe("https://example.com/a.png");

    const headingFirst = render("## Fixes\n\n![Shot](https://example.com/a.png)\n\n- One");
    expect(headingFirst.notes.hasHero).toBe(false);
    expect(headingFirst.root.querySelector(".rn-hero")).toBeNull();
    expect(headingFirst.root.firstElementChild?.tagName).toBe("H2");
    expect(headingFirst.root.querySelectorAll(".rn-media > img")).toHaveLength(1);
  });

  it("colours features, improvements and fixes sections", () => {
    const { root } = render([
      "## New features",
      "## Features",
      "### Improvements",
      "## fixes",
      "### Bug Fixes",
      "## \u{1F41B} Bug fixes:",
    ].join("\n\n"));

    const headings = Array.from(root.querySelectorAll("h2, h3"));
    expect(headings.map(heading => heading.getAttribute("data-kind")))
      .toEqual(["feat", "feat", "impr", "fix", "fix", "fix"]);
    expect(headings[2]?.tagName).toBe("H3");
    expect(headings[0]?.textContent).toBe("New features");
  });

  it("leaves an unknown heading uncoloured", () => {
    const { root } = render("## What's New\n\n### Refactoring\n\n## Constructor");

    const headings = Array.from(root.querySelectorAll("h2, h3"));
    expect(headings).toHaveLength(3);
    for (const heading of headings) expect(heading.hasAttribute("data-kind")).toBe(false);
    expect(headings[0]?.textContent).toBe("What's New");
  });

  it("splits a bold title from its description and drops the dash", () => {
    const { root } = render([
      "### New Features",
      "",
      "- **New mobile navigation** - The bottom bar is now four tabs.",
      "- **En dash** \u2013 second",
      "- **Em dash** \u2014 third",
      "- **No dash** fourth with `code`",
      "- **Title only**",
    ].join("\r\n"));

    const list = items(root);
    expect(list).toHaveLength(5);
    for (const item of list) expect(item.classList.contains("rn-item")).toBe(true);
    expect(list.map(item => item.querySelector(".rn-title")?.textContent))
      .toEqual(["New mobile navigation", "En dash", "Em dash", "No dash", "Title only"]);
    expect(list.map(item => item.querySelector(".rn-desc")?.textContent ?? null))
      .toEqual(["The bottom bar is now four tabs.", "second", "third", "fourth with code", null]);
    expect(list[3]?.querySelector(".rn-desc code")?.textContent).toBe("code");
    expect(list[0]?.firstElementChild?.matches(".rn-title")).toBe(true);
    expect(list[0]?.querySelector(".rn-title + .rn-desc")).not.toBeNull();
  });

  it("keeps an item without a bold title as plain text", () => {
    const { root } = render([
      "- Font picker in appearance settings",
      "- Uses **bold** in the middle",
      "- **Bold**, as part of the sentence",
    ].join("\n"));

    const list = items(root);
    expect(list).toHaveLength(3);
    for (const item of list) {
      expect(item.classList.contains("rn-item")).toBe(false);
      expect(item.querySelector(".rn-title, .rn-desc")).toBeNull();
    }
    expect(list.map(item => item.textContent?.trim())).toEqual([
      "Font picker in appearance settings",
      "Uses bold in the middle",
      "Bold, as part of the sentence",
    ]);
    expect(list[2]?.querySelector("strong")?.textContent).toBe("Bold");
  });

  it("puts an image inside an item under its description", () => {
    const { notes, root } = render([
      "- **Mini player progress** - The played part fills the card.",
      "  ![Mini player](https://example.com/mini.png)",
      "- **Loose** - With a gap.",
      "",
      "  <img alt=\"Uploaded\" src=\"https://github.com/user-attachments/assets/1\" />",
    ].join("\n"));

    expect(notes.hasHero).toBe(false);
    const [first, second] = items(root);
    expect(Array.from(first?.children ?? []).map(child => child.className))
      .toEqual(["rn-title", "rn-desc", "rn-media rn-shot"]);
    expect(first?.querySelector(".rn-desc")?.textContent).toBe("The played part fills the card.");
    expect(first?.querySelector(".rn-desc img, .rn-desc br")).toBeNull();
    const img = first?.querySelector(".rn-shot > img");
    expect(img?.getAttribute("src")).toBe("https://example.com/mini.png");
    expect(img?.getAttribute("alt")).toBe("Mini player");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");

    expect(second?.lastElementChild?.matches(".rn-media.rn-shot")).toBe(true);
    expect(second?.querySelector(".rn-shot > img")?.getAttribute("alt")).toBe("Uploaded");
    expect(second?.querySelector(".rn-desc")?.textContent).toBe("With a gap.");
  });

  it("renders notes in a free format without breaking", () => {
    const { notes, root } = render([
      "Intro with a [link](https://github.com/Eg0r0k/Audiogram) and `code`.",
      "",
      "1. First",
      "2. Second",
      "",
      "- Parent",
      "  - Child",
      "",
      "> Quoted **note**",
      "",
      "```ts",
      "const ok = 1 < 2;",
      "```",
      "",
      "| Format | Seek |",
      "| --- | --- |",
      "| FLAC | yes |",
      "",
      "Line one",
      "line two",
    ].join("\n"));

    expect(notes.isEmpty).toBe(false);
    expect(notes.hasHero).toBe(false);
    expect(root.querySelector("p > a")?.getAttribute("href")).toBe("https://github.com/Eg0r0k/Audiogram");
    expect(root.querySelectorAll("ol > li")).toHaveLength(2);
    expect(root.querySelector("ul > li > ul > li")?.textContent?.trim()).toBe("Child");
    expect(root.querySelector("blockquote strong")?.textContent).toBe("note");
    expect(root.querySelector("pre > code")?.textContent).toBe("const ok = 1 < 2;\n");
    expect(Array.from(root.querySelectorAll("th, td")).map(cell => cell.textContent))
      .toEqual(["Format", "Seek", "FLAC", "yes"]);
    expect(root.lastElementChild?.querySelector("br")).not.toBeNull();
    expect(root.querySelector(".rn-item, .rn-media, [data-kind]")).toBeNull();
  });

  it("shows raw HTML as text", () => {
    const { root } = render([
      "<script>alert(1)</script>",
      "",
      "Text with <b onclick=\"steal()\">inline</b> tags and <img src=\"x\" onerror=\"steal()\">.",
      "",
      "<details><summary>More</summary>Hidden</details>",
      "",
      "<img src=\"https://example.com/a.png\" onerror=\"steal()\" alt=\"Shot\">",
      "",
      "[Run](javascript:steal()) and [site](https://example.com)",
    ].join("\n"));

    expect(root.querySelector("script, b, details, summary, [onclick], [onerror]")).toBeNull();
    expect(root.textContent).toContain("<script>alert(1)</script>");
    expect(root.textContent).toContain("<b onclick=\"steal()\">inline</b>");
    expect(root.textContent).toContain("<img src=\"x\" onerror=\"steal()\">");
    expect(root.textContent).toContain("<details><summary>More</summary>Hidden</details>");
    expect(Array.from(root.querySelectorAll("img")).map(img => img.getAttribute("src")))
      .toEqual(["https://example.com/a.png"]);
    expect(Array.from(root.querySelectorAll("a")).map(link => link.getAttribute("href")))
      .toEqual(["https://example.com"]);
    expect(root.textContent).toContain("Run and site");
  });

  it("reports empty notes as empty", () => {
    for (const markdown of ["", "  \r\n\n ", "<!-- Write the notes here -->"]) {
      const notes = renderReleaseNotes(markdown);
      expect(notes).toEqual({ html: "", hasHero: false, isEmpty: true });
    }

    const notes = renderReleaseNotes("<!-- template -->\n\nSmall fixes.");
    expect(notes.isEmpty).toBe(false);
    expect(notes.html).not.toContain("template");
  });
});
