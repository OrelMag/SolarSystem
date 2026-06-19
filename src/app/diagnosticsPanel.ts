export function formatDriftPartsPerMillion(drift: number): string {
  return `${(drift * 1e6).toFixed(3)} ppm`;
}
