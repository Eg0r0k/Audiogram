// Adapted from Quasar Framework (https://github.com/quasarframework/quasar), modified for kappa-ui.
// Copyright (c) 2015-present Razvan Stoenescu. MIT License: https://github.com/quasarframework/quasar/blob/dev/LICENSE

export type MenuVertical = "top" | "center" | "bottom";
export type MenuHorizontal = "left" | "middle" | "right";
export type MenuPosition = `${MenuVertical} ${MenuHorizontal | "start" | "end"}`;

export interface MenuOrigin {
  vertical: MenuVertical;
  horizontal: MenuHorizontal;
}

export interface MenuRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MenuPlacement {
  top: number;
  left: number;
  maxHeight: number | null;
  maxWidth: number | null;
  self: MenuOrigin;
}

export const parsePosition = (position: MenuPosition, rtl: boolean): MenuOrigin => {
  const [vertical, horizontal] = position.split(" ") as [MenuVertical, MenuHorizontal | "start" | "end"];
  const physical = { start: rtl ? "right" : "left", end: rtl ? "left" : "right" } as const;
  return {
    vertical,
    horizontal: horizontal === "start" || horizontal === "end" ? physical[horizontal] : horizontal,
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export const placeMenu = ({
  rect,
  width,
  height,
  anchor,
  self,
  offset,
  viewport,
}: {
  rect: MenuRect;
  width: number;
  height: number;
  anchor: MenuOrigin;
  self: MenuOrigin;
  offset: [number, number];
  viewport: { width: number; height: number };
}): MenuPlacement => {
  const [ox, oy] = offset;
  const edges = {
    top: rect.top - oy,
    bottom: rect.bottom + oy,
    center: (rect.top + rect.bottom) / 2,
    left: rect.left - ox,
    right: rect.right + ox,
    middle: (rect.left + rect.right) / 2,
  };

  let { vertical: av, horizontal: ah } = anchor;
  let { vertical: sv, horizontal: sh } = self;
  let maxHeight: number | null = null;
  let maxWidth: number | null = null;

  if (sv !== "center") {
    const top = edges[av] - (sv === "bottom" ? height : 0);
    if (top < 0 || top + height > viewport.height) {
      const [below, above]: [MenuVertical, MenuVertical]
        = av === "center" ? ["center", "center"] : av === sv ? ["top", "bottom"] : ["bottom", "top"];
      const spaceBelow = viewport.height - Math.max(0, edges[below]);
      const spaceAbove = Math.min(viewport.height, edges[above]);
      if (sv === "top" ? spaceBelow >= spaceAbove : spaceBelow > spaceAbove) {
        av = below;
        sv = "top";
        maxHeight = spaceBelow;
      }
      else {
        av = above;
        sv = "bottom";
        maxHeight = spaceAbove;
      }
    }
  }

  if (sh !== "middle") {
    const left = edges[ah] - (sh === "right" ? width : 0);
    if (left < 0 || left + width > viewport.width) {
      const [toRight, toLeft]: [MenuHorizontal, MenuHorizontal]
        = ah === "middle" ? ["middle", "middle"] : ah === sh ? ["left", "right"] : ["right", "left"];
      const spaceRight = viewport.width - Math.max(0, edges[toRight]);
      const spaceLeft = Math.min(viewport.width, edges[toLeft]);
      if (sh === "left" ? spaceRight >= spaceLeft : spaceRight > spaceLeft) {
        ah = toRight;
        sh = "left";
        maxWidth = spaceRight;
      }
      else {
        ah = toLeft;
        sh = "right";
        maxWidth = spaceLeft;
      }
    }
  }

  const renderedHeight = Math.min(height, maxHeight ?? height);
  const renderedWidth = Math.min(width, maxWidth ?? width);

  const top
    = sv === "top"
      ? edges[av]
      : sv === "bottom"
        ? edges[av] - renderedHeight
        : clamp(edges[av] - renderedHeight / 2, 0, Math.max(0, viewport.height - renderedHeight));
  const left
    = sh === "left"
      ? edges[ah]
      : sh === "right"
        ? edges[ah] - renderedWidth
        : clamp(edges[ah] - renderedWidth / 2, 0, Math.max(0, viewport.width - renderedWidth));

  return { top, left, maxHeight, maxWidth, self: { vertical: sv, horizontal: sh } };
};
