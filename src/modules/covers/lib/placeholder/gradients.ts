// Telegram Web K's avatar gradients without violet, which stays with Favorites.
// `ink` is `bottom` 0.22 darker in OKLCH: the colour of everything drawn with
// `currentColor`; `bottom` itself is too light on the white face for cyan and orange.
// `name` is the rendezvous key: never reuse or rename one.
export interface CoverGradient {
  readonly name: string;
  readonly top: string;
  readonly bottom: string;
  readonly ink: string;
}

export const COVER_GRADIENTS: readonly CoverGradient[] = [
  { name: "red", top: "#FF845E", bottom: "#D45246", ink: "#860003" },
  { name: "orange", top: "#FEBB5B", bottom: "#F68136", ink: "#9E4700" },
  { name: "green", top: "#9AD164", bottom: "#46BA43", ink: "#007204" },
  { name: "cyan", top: "#53EDD6", bottom: "#28C9B7", ink: "#007F72" },
  { name: "blue", top: "#5CAFFA", bottom: "#408ACF", ink: "#004980" },
  { name: "pink", top: "#FF8AAC", bottom: "#D95574", ink: "#8C0037" },
];
