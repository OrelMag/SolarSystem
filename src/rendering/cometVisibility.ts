export type CometVisualKind = "body" | "path" | "tail";

export function shouldShowCometVisual(input: {
  readonly kind: CometVisualKind;
  readonly cometsVisible: boolean;
  readonly cometPathsVisible?: boolean;
  readonly cometTailsVisible?: boolean;
  readonly tailActive?: boolean;
}): boolean {
  if (!input.cometsVisible) return false;
  if (input.kind === "path") return input.cometPathsVisible ?? true;
  if (input.kind === "tail") {
    return (input.cometTailsVisible ?? true) && (input.tailActive ?? true);
  }
  return true;
}
