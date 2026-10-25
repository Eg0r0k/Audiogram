export const fileNameFromPath = (path: string): string =>
  path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

export const stripExtension = (name: string): string => name.replace(/\.[^.]+$/, "");
