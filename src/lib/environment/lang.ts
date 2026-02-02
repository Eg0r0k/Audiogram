export const isRTL = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.dir === "rtl" || document.documentElement.dir === "rtl";
};

export const isLTR = (): boolean => {
  return !isRTL();
};
