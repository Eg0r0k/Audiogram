import { type VariantProps, cva } from "class-variance-authority";

export { default as ButtonGroup } from "./ButtonGroup.vue";
export { default as ButtonGroupSeparator } from "./ButtonGroupSeparator.vue";
export { default as ButtonGroupText } from "./ButtonGroupText.vue";

export const buttonGroupVariants = cva(
  `
    isolate flex w-fit items-stretch [--button-group-radius:0px]
    *:focus-visible:relative *:focus-visible:z-10
    has-[>[data-slot=button-group]]:gap-2
  `,
  {
    variants: {
      orientation: {
        horizontal: `
          [&>*:not(:first-child)]:rounded-s-(--button-group-radius)
          [&>:is([data-variant=outline],[data-variant=subtle],[data-active-variant=outline],[data-active-variant=subtle],[data-slot=button-group-text],[data-slot=input],[data-slot=input-group],[data-slot=select-trigger])+:is([data-variant=outline],[data-variant=subtle],[data-active-variant=outline],[data-active-variant=subtle],[data-slot=button-group-text],[data-slot=input],[data-slot=input-group],[data-slot=select-trigger])]:-ms-px
          [&>*:not(:last-child)]:rounded-e-(--button-group-radius)
        `,
        vertical: `
          flex-col
          [&>*:not(:first-child)]:rounded-t-(--button-group-radius)
          [&>:is([data-variant=outline],[data-variant=subtle],[data-active-variant=outline],[data-active-variant=subtle],[data-slot=button-group-text],[data-slot=input],[data-slot=input-group],[data-slot=select-trigger])+:is([data-variant=outline],[data-variant=subtle],[data-active-variant=outline],[data-active-variant=subtle],[data-slot=button-group-text],[data-slot=input],[data-slot=input-group],[data-slot=select-trigger])]:-mt-px
          [&>*:not(:last-child)]:rounded-b-(--button-group-radius)
        `,
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;
