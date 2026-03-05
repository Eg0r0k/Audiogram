export const generateCoverFileName = (albumId: string, mimeType: string) => {
  const extension = mimeType.split("/")[1] || "jpg";
  const timestamp = Date.now();
  return `covers/${albumId}_${timestamp}.${extension}`;
};
