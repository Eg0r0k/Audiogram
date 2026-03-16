import { storageService } from "@/db/storage";
import { hasNativeSupport, IFileStorageWithNativeSupport } from "@/db/storage/IFileStorage";

const FINGERPRINT_READ_SIZE = 64 * 1024;

export const computeFileFingerprint = async (absolutePath: string, fileSize: number): Promise<string> => {
  if (!hasNativeSupport(storageService)) {
    return `${fileSize}:${absolutePath}`;
  }

  const nativeStorage = storageService as IFileStorageWithNativeSupport;
  const readResult = await nativeStorage.readBytes(absolutePath, FINGERPRINT_READ_SIZE);

  if (readResult.isErr()) {
    return `${fileSize}:${absolutePath}`;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", readResult.value);

  const hashArray = new Uint8Array(hashBuffer);

  const hashHex = Array.from(hashArray.slice(0, 16))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `${fileSize}:${hashHex}`;
};
