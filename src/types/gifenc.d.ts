declare module "gifenc" {
  export type GifPalette = readonly (readonly [number, number, number] | readonly [number, number, number, number])[];

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        readonly palette?: GifPalette;
        readonly delay?: number;
        readonly repeat?: number;
        readonly transparent?: boolean;
        readonly transparentIndex?: number;
        readonly dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { readonly auto?: boolean; readonly initialCapacity?: number }): GifEncoder;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      readonly format?: "rgb565" | "rgb444" | "rgba4444";
      readonly oneBitAlpha?: boolean | number;
      readonly clearAlpha?: boolean;
      readonly clearAlphaThreshold?: number;
      readonly clearAlphaColor?: number;
    },
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
}
