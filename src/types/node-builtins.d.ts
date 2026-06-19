declare const process: {
  cwd(): string;
};

declare module "node:fs" {
  export interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
  }

  export function readdirSync(
    path: string,
    options: { readonly withFileTypes: true },
  ): Dirent[];
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export const sep: string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}
