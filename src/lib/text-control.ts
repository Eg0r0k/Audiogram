export const textControlBase = `
  w-full min-w-0 bg-transparent text-body-lg text-foreground outline-none
  transition-[color,background-color,border-color,box-shadow] duration-short-3 ease-standard
  selection:bg-primary selection:text-primary-foreground
  placeholder:font-medium placeholder:text-muted-foreground
  disabled:cursor-not-allowed disabled:text-foreground/(--disabled-opacity)
  disabled:placeholder:text-foreground/(--disabled-opacity)
  md:text-body-md
`;

const focusRing = `
  focus-visible:border-primary focus-visible:inset-ring focus-visible:inset-ring-primary
  data-[state=open]:border-primary data-[state=open]:inset-ring data-[state=open]:inset-ring-primary
  aria-invalid:border-destructive
  aria-invalid:focus-visible:inset-ring-destructive
  user-invalid:border-destructive
  user-invalid:focus-visible:border-destructive user-invalid:focus-visible:inset-ring-destructive
`;

export const textControlVariant = {
  outline: `rounded-(--frame-radius) border border-input ${focusRing} disabled:border-foreground/(--disabled-container-opacity)`,
  soft: `rounded-(--frame-radius) border border-transparent bg-muted ${focusRing}`,
  filled:
    "rounded-t-(--frame-radius) border-b border-input bg-muted focus-visible:border-primary focus-visible:shadow-[inset_0_-1px_0_--theme(--color-primary)] data-[state=open]:border-primary data-[state=open]:shadow-[inset_0_-1px_0_--theme(--color-primary)] disabled:border-foreground/(--disabled-container-opacity) aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[inset_0_-1px_0_--theme(--color-destructive)] user-invalid:border-destructive user-invalid:focus-visible:border-destructive user-invalid:focus-visible:shadow-[inset_0_-1px_0_--theme(--color-destructive)]",
  ghost: `rounded-(--frame-radius) border border-transparent hover:bg-muted focus-visible:bg-muted data-[state=open]:bg-muted ${focusRing} disabled:bg-transparent`,
  subtle: `rounded-(--frame-radius) border border-input bg-muted ${focusRing} disabled:border-foreground/(--disabled-container-opacity)`,
};

const frameFocusRing = `
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):focus-visible]:border-primary
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):focus-visible]:inset-ring
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):focus-visible]:inset-ring-primary
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*)[aria-invalid=true]]:border-destructive
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*)[aria-invalid=true]:focus-visible]:inset-ring-destructive
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):user-invalid]:border-destructive
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):user-invalid:focus-visible]:inset-ring-destructive
`;

const frameOpenRing = `
  has-[>[data-slot=input-group-control][data-state=open]]:border-primary
  has-[>[data-slot=input-group-control][data-state=open]]:inset-ring
  has-[>[data-slot=input-group-control][data-state=open]]:inset-ring-primary
`;

const frameDisabledBorder = `
  has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):disabled]:border-foreground/(--disabled-container-opacity)
`;

export const textControlFrameVariant = {
  outline: `rounded-(--frame-radius) border border-input ${frameFocusRing} ${frameOpenRing} ${frameDisabledBorder}`,
  soft: `rounded-(--frame-radius) border border-transparent bg-muted ${frameFocusRing} ${frameOpenRing}`,
  filled:
    "rounded-t-(--frame-radius) border-b border-input bg-muted has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):focus-visible]:border-primary has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):focus-visible]:shadow-[inset_0_-1px_0_--theme(--color-primary)] has-[>[data-slot=input-group-control][data-state=open]]:border-primary has-[>[data-slot=input-group-control][data-state=open]]:shadow-[inset_0_-1px_0_--theme(--color-primary)] has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*)[aria-invalid=true]]:border-destructive has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*)[aria-invalid=true]:focus-visible]:shadow-[inset_0_-1px_0_--theme(--color-destructive)] has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):user-invalid]:border-destructive has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):user-invalid:focus-visible]:shadow-[inset_0_-1px_0_--theme(--color-destructive)] has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):disabled]:border-foreground/(--disabled-container-opacity)",
  ghost: `rounded-(--frame-radius) border border-transparent hover:bg-muted has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):focus-visible]:bg-muted has-[>[data-slot=input-group-control][data-state=open]]:bg-muted ${frameFocusRing} ${frameOpenRing} has-[:where(input,textarea,[role=spinbutton]):not([data-slot=input-group-addon]_*):disabled]:bg-transparent`,
  subtle: `rounded-(--frame-radius) border border-input bg-muted ${frameFocusRing} ${frameOpenRing} ${frameDisabledBorder}`,
};

export const textControlSize = {
  xs: "px-(--control-padding-xs) md:text-body-sm",
  sm: "px-(--control-padding-sm)",
  md: "px-(--control-padding-md)",
  lg: "px-(--control-padding-lg)",
  xl: "px-(--control-padding-xl) md:text-body-lg",
};

export const textControlRadius = {
  xs: "[--frame-radius:--theme(--radius-control-xs)]",
  sm: "[--frame-radius:--theme(--radius-control-sm)]",
  md: "[--frame-radius:--theme(--radius-control-md)]",
  lg: "[--frame-radius:--theme(--radius-control-lg)]",
  xl: "[--frame-radius:--theme(--radius-control-xl)]",
};

export const textControlText = {
  xs: "[--control-text:var(--typescale-body-sm-size)] [--control-text-leading:var(--typescale-body-sm-line-height)]",
  sm: "[--control-text:var(--typescale-body-md-size)] [--control-text-leading:var(--typescale-body-md-line-height)]",
  md: "[--control-text:var(--typescale-body-md-size)] [--control-text-leading:var(--typescale-body-md-line-height)]",
  lg: "[--control-text:var(--typescale-body-md-size)] [--control-text-leading:var(--typescale-body-md-line-height)]",
  xl: "[--control-text:var(--typescale-body-lg-size)] [--control-text-leading:var(--typescale-body-lg-line-height)]",
};

export const textControlInnerText = "md:text-(length:--control-text)/(--control-text-leading)";

export type TextControlVariant = keyof typeof textControlVariant;
export type TextControlSize = keyof typeof textControlSize;
