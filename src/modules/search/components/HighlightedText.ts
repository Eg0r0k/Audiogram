import { type FunctionalComponent, h } from "vue";
import { highlightSegments } from "../lib/highlight";
import type { SearchMatch } from "@/services/search/types";

interface Props {
  text: string;
  match?: SearchMatch | null;
}

/**
 * The text with the words a search matched on marked. Functional, so the
 * rows that render it outside a search pay for a bare text node only.
 */
const HighlightedText: FunctionalComponent<Props> = ({ text, match }) => {
  if (!match) return text;
  return highlightSegments(text, match).map(segment =>
    segment.hit ? h("mark", { class: "rounded-xs bg-primary/20 text-inherit" }, segment.text) : segment.text,
  );
};

HighlightedText.props = ["text", "match"];

export default HighlightedText;
