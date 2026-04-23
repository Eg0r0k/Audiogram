export function getSecureRandomIndex(length: number): number {
  if (length <= 1) return 0;

  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return randomBuffer[0] % length;
}
