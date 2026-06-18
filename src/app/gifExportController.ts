export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export function formatGifExportProgress(frameIndex: number, frameCount: number): string {
  return `Encoding frame ${frameIndex + 1} of ${frameCount}`;
}
