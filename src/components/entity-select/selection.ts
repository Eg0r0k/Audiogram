import { cn } from "@/lib/utils";

export interface RowSelection {
  selected: boolean;
  joinTop: boolean;
  joinBottom: boolean;
}

export const selectedRowClass = ({ selected, joinTop, joinBottom }: RowSelection): string =>
  selected ? cn("bg-accent/80 hover:bg-accent/90", joinTop && "rounded-t-none", joinBottom && "rounded-b-none") : "";
