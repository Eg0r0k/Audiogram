import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge, validators } from "tailwind-merge";

const typescale = ["display", "headline", "title", "body", "label"].flatMap(role =>
  ["lg", "md", "sm"].map(size => `${role}-${size}`),
);

const radiusRoles = [
  ...["3xs", "2xs", "xs", "sm", "md", "lg", "xl"].map(step => `control-${step}`),
  ...["xs", "sm", "md", "lg", "xl"].flatMap(step => [`surface-${step}`, `item-${step}`]),
];

const shadowRoles = ["xs", "sm", "md", "lg", "xl", "popover", "dialog"].map(role => `shadow-${role}`);

const radiusCorners = [
  "rounded",
  "rounded-s",
  "rounded-e",
  "rounded-t",
  "rounded-r",
  "rounded-b",
  "rounded-l",
  "rounded-ss",
  "rounded-se",
  "rounded-ee",
  "rounded-es",
  "rounded-tl",
  "rounded-tr",
  "rounded-br",
  "rounded-bl",
] as const;

const twMerge = extendTailwindMerge<"icon-size" | "rounded-inset" | "rounded-outset">({
  extend: {
    theme: { text: typescale, radius: radiusRoles, shadow: shadowRoles },
    classGroups: {
      "icon-size": [{ "icon-size": [validators.isAny] }],
      "rounded-inset": [{ "rounded-inset": [validators.isAny] }],
      "rounded-outset": [{ "rounded-outset": [validators.isAny] }],
    },
    conflictingClassGroups: {
      "rounded": ["rounded-inset", "rounded-outset"],
      "rounded-inset": [...radiusCorners, "rounded-outset"],
      "rounded-outset": [...radiusCorners, "rounded-inset"],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
