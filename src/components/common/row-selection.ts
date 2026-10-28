import { cn } from "@/lib/utils";

export interface RowSelection {
  selected: boolean;
  joinTop: boolean;
  joinBottom: boolean;
}

export const SELECTED_ROW_CLASS = "bg-accent/80 hover:bg-accent/90";

export const joinedCornersClass = (joinTop: boolean, joinBottom: boolean): string =>
  cn(joinTop && "rounded-t-none", joinBottom && "rounded-b-none");

export const selectedRowClass = ({ selected, joinTop, joinBottom }: RowSelection): string =>
  selected ? cn(SELECTED_ROW_CLASS, joinedCornersClass(joinTop, joinBottom)) : "";

export const rowSelectionAt = <T>(
  items: readonly T[],
  index: number,
  isSelected: ((item: T) => boolean) | undefined,
): RowSelection => {
  if (!isSelected || index < 0 || index >= items.length || !isSelected(items[index])) {
    return { selected: false, joinTop: false, joinBottom: false };
  }
  return {
    selected: true,
    joinTop: index > 0 && isSelected(items[index - 1]),
    joinBottom: index + 1 < items.length && isSelected(items[index + 1]),
  };
};
