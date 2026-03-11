export const formatFreq = (hz: number): string => {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
};
