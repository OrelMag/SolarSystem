export interface MoonVisibilityInput {
  readonly enabled: boolean;
  readonly cameraZoom: number;
  readonly thresholdZoom: number;
  readonly moonId: string;
  readonly parentId: string;
  readonly selectedBodyId: string;
  readonly selectedParentId?: string;
}

export function shouldShowMoon(input: MoonVisibilityInput): boolean {
  if (!input.enabled) return false;
  return (
    input.cameraZoom >= input.thresholdZoom ||
    input.selectedBodyId === input.moonId ||
    input.selectedBodyId === input.parentId ||
    input.selectedParentId === input.parentId
  );
}
