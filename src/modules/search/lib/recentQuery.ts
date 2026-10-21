// A pasted link is a query too. Whitespace, or no dotted host followed by a
// path, means text: "mr. oizo" and "2.0" stay searches.
const SCHEME_RE = /^https?:\/\//i;
const BARE_LINK_RE = /^[\w-]+(\.[\w-]+)+\/\S*$/;

export const recentQueryUrl = (query: string): URL | null => {
  const raw = query.trim();
  if (!raw || /\s/.test(raw)) return null;
  const hasScheme = SCHEME_RE.test(raw);
  if (!hasScheme && !BARE_LINK_RE.test(raw)) return null;
  try {
    return new URL(hasScheme ? raw : `https://${raw}`);
  }
  catch {
    return null;
  }
};

/** The link without the parts nobody reads: scheme, www/m, query, trailing slash. */
export const cleanQueryUrl = (url: URL): string => {
  const host = url.hostname.replace(/^(www|m)\./i, "");
  let path = url.pathname;
  while (path.endsWith("/")) path = path.slice(0, -1);
  return `${host}${path}`;
};
