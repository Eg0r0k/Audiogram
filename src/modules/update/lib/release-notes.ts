import { Marked, type Token, type Tokens } from "marked";

export type ReleaseSectionKind = "feat" | "impr" | "fix";

export interface RenderedReleaseNotes {
  html: string;
  hasHero: boolean;
  isEmpty: boolean;
}

interface Media {
  src: string;
  alt: string;
  title: string | null;
}

interface TitledItem {
  title: Token[];
  description: Token[];
}

type InlineBlock = Tokens.Paragraph | (Tokens.Text & { tokens: Token[] });

const SECTION_KINDS = new Map<string, ReleaseSectionKind>([
  ["features", "feat"],
  ["new features", "feat"],
  ["new", "feat"],
  ["improvements", "impr"],
  ["improved", "impr"],
  ["fixes", "fix"],
  ["bug fixes", "fix"],
  ["fixed", "fix"],
]);

const HTML_ESCAPES = new Map([["&", "&amp;"], ["<", "&lt;"], [">", "&gt;"], ["\"", "&quot;"], ["'", "&#39;"]]);

const IMG_TAG = /^<img\s[^<]*>$/i;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const TITLE_DASH = /^[-\u2013\u2014:](?=\s|$)/;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => HTML_ESCAPES.get(char) ?? char);

const cleanUrl = (url: string) => {
  try {
    return encodeURI(url).replace(/%25/g, "%");
  }
  catch {
    return null;
  }
};

const isSafeLink = (href: string) => /^(?:https?|mailto):/i.test(href.trim());

const isImage = (token: Token): token is Tokens.Image => token.type === "image";
const isHtml = (token: Token): token is Tokens.HTML | Tokens.Tag => token.type === "html";
const isText = (token: Token): token is Tokens.Text => token.type === "text";
const isStrong = (token: Token): token is Tokens.Strong => token.type === "strong";
const isInlineBlock = (token: Token): token is InlineBlock =>
  (token.type === "paragraph" || token.type === "text") && "tokens" in token && Array.isArray(token.tokens);

const isGap = (token: Token) => token.type === "br" || (isText(token) && token.text.trim() === "");
const isHiddenHtml = (html: string) => html.replace(HTML_COMMENT, "").trim() === "";
const isBlank = (token: Token) =>
  token.type === "space" || token.type === "def" || (isHtml(token) && isHiddenHtml(token.text));

const sectionKindOf = (heading: string) =>
  SECTION_KINDS.get((heading.toLowerCase().match(/[\p{L}']+/gu) ?? []).join(" "));

const webMedia = (src: string, alt: string, title: string | null): Media | null => {
  const url = /^https?:\/\//i.test(src.trim()) ? cleanUrl(src.trim()) : null;
  return url ? { src: url, alt, title } : null;
};

// GitHub's editor uploads images as <img> tags; the DOMParser document is inert and only src/alt/title are kept.
const parseImgTag = (html: string) => {
  const tag = html.trim();
  if (!IMG_TAG.test(tag)) return null;
  const body = new DOMParser().parseFromString(tag, "text/html").body;
  const img = body.firstElementChild;
  if (body.childNodes.length !== 1 || img?.tagName !== "IMG") return null;
  return webMedia(img.getAttribute("src") ?? "", img.getAttribute("alt") ?? "", img.getAttribute("title"));
};

const toMedia = (token: Token) => {
  if (isImage(token)) return webMedia(token.href, token.text, token.title);
  if (isHtml(token)) return parseImgTag(token.text);
  return null;
};

const mediaHtml = (media: Media, tag: "div" | "span", modifier = "") => {
  const className = modifier ? `rn-media ${modifier}` : "rn-media";
  const title = media.title ? ` title="${escapeHtml(media.title)}"` : "";
  const img = `<img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}"${title} loading="lazy" decoding="async">`;
  return `<${tag} class="${className}">${img}</${tag}>`;
};

const trimGaps = (tokens: Token[]) => {
  let start = 0;
  let end = tokens.length;
  while (start < end && isGap(tokens[start])) start += 1;
  while (end > start && isGap(tokens[end - 1])) end -= 1;
  return tokens.slice(start, end);
};

const mediaOnly = (tokens: Token[]) => {
  const media: Media[] = [];
  for (const token of tokens) {
    const found = toMedia(token);
    if (found) media.push(found);
    else if (!isGap(token)) return null;
  }
  return media.length > 0 ? media : null;
};

const takeMedia = (tokens: Token[], into: Media[]) => {
  const kept: Token[] = [];
  for (const token of tokens) {
    const media = toMedia(token);
    if (media) into.push(media);
    else if (token.type !== "br" || kept.length === 0 || kept[kept.length - 1].type !== "br") kept.push(token);
  }
  return trimGaps(kept);
};

const startsWithSeparator = (text: string) => /^\s/.test(text) || TITLE_DASH.test(text);
const stripSeparator = (text: string) => text.trimStart().replace(TITLE_DASH, "").trimStart();

const splitTitle = (block: Token | undefined): TitledItem | null => {
  if (!block || !isInlineBlock(block) || block.tokens.length === 0) return null;
  const [lead, ...rest] = block.tokens;
  if (!isStrong(lead)) return null;
  const next = rest.shift();
  if (!next) return { title: lead.tokens, description: [] };
  if (next.type === "br") return { title: lead.tokens, description: trimGaps(rest) };
  if (!isText(next) || !startsWithSeparator(next.text)) return null;
  const text = stripSeparator(next.text);
  const description = text ? [{ ...next, raw: text, text }, ...rest] : rest;
  return { title: lead.tokens, description: trimGaps(description) };
};

const takeHero = (tokens: Token[]) => {
  const index = tokens.findIndex(token => !isBlank(token));
  if (index < 0) return null;
  const first = tokens[index];
  const blockMedia = isHtml(first) ? parseImgTag(first.text) : null;
  if (blockMedia) {
    tokens.splice(index, 1);
    return blockMedia;
  }
  if (first.type !== "paragraph" || !isInlineBlock(first) || first.tokens.length === 0) return null;
  const [lead, ...rest] = first.tokens;
  const hero = toMedia(lead);
  if (!hero) return null;
  const remaining = trimGaps(rest);
  if (remaining.length > 0) tokens.splice(index, 1, { ...first, tokens: remaining });
  else tokens.splice(index, 1);
  return hero;
};

const notesMarked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    heading({ tokens, depth }) {
      const kind = sectionKindOf(this.parser.parseInline(tokens, this.parser.textRenderer));
      const attribute = kind ? ` data-kind="${kind}"` : "";
      return `<h${depth}${attribute}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    paragraph({ tokens }) {
      const media = mediaOnly(tokens);
      return media ? media.map(item => mediaHtml(item, "div", "rn-shot")).join("") : false;
    },
    listitem(item) {
      const shots: Media[] = [];
      const blocks = item.tokens.flatMap((block): Token[] => {
        const media = toMedia(block);
        if (media) {
          shots.push(media);
          return [];
        }
        if (!isInlineBlock(block)) return [block];
        const inline = takeMedia(block.tokens, shots);
        return inline.length > 0 ? [{ ...block, tokens: inline }] : [];
      });
      const titled = splitTitle(blocks[0]);
      if (!titled && shots.length === 0) return false;
      const shotsHtml = shots.map(shot => mediaHtml(shot, "div", "rn-shot")).join("");
      if (!titled) return `<li>${this.parser.parse(blocks)}${shotsHtml}</li>\n`;
      const title = `<p class="rn-title">${this.parser.parseInline(titled.title)}</p>`;
      const description = titled.description.length > 0
        ? `<p class="rn-desc">${this.parser.parseInline(titled.description)}</p>`
        : "";
      return `<li class="rn-item">${title}${description}${this.parser.parse(blocks.slice(1))}${shotsHtml}</li>\n`;
    },
    html(token) {
      const media = parseImgTag(token.text);
      if (media) return token.block ? mediaHtml(media, "div", "rn-shot") : mediaHtml(media, "span");
      const visible = token.text.replace(HTML_COMMENT, "");
      if (visible.trim() === "") return "";
      return token.block ? `<p>${escapeHtml(visible.trim())}</p>\n` : escapeHtml(visible);
    },
    image(token) {
      const media = toMedia(token);
      return media ? mediaHtml(media, "span") : escapeHtml(token.text);
    },
    link(token) {
      return isSafeLink(token.href) ? false : this.parser.parseInline(token.tokens);
    },
  },
});

export const renderReleaseNotes = (markdown: string): RenderedReleaseNotes => {
  const tokens = notesMarked.lexer(markdown);
  const hero = takeHero(tokens);
  const body = notesMarked.parser(tokens);
  const html = `${hero ? mediaHtml(hero, "div", "rn-hero") : ""}${body}`.trim();
  return { html, hasHero: hero !== null, isEmpty: html === "" };
};

// Older builds stored this text in place of empty notes.
const LEGACY_EMPTY_NOTES = "Release notes have not been published for this version yet.";

export const normalizeReleaseNotes = (markdown: string | null | undefined): string => {
  const trimmed = markdown?.trim() ?? "";
  return trimmed === LEGACY_EMPTY_NOTES ? "" : trimmed;
};
