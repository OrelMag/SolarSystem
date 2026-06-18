import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const STABLE_MODULE_DIRS = ["domain", "physics", "data"] as const;
const BANNED_IMPORT_PATTERNS = [
  /^three(?:\/|$)/,
  /(^|\/)(app|rendering|ui)(?:\/|$)/,
  /(^|\/)main$/,
] as const;
const BANNED_DOM_TOKENS = /\b(document|window|HTMLElement|HTML[A-Z]\w*Element|ResizeObserver)\b/;
const IMPORT_PATTERN =
  /import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?["']([^"']+)["']|export\s+[^'"]+\s+from\s+["']([^"']+)["']/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) return [];
    return [path];
  });
}

function normalizeSpecifier(specifier: string): string {
  return specifier.replaceAll("\\", "/").replace(/\.ts$/, "");
}

function importedSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2] ?? "");
}

describe("architecture boundaries", () => {
  it("keeps stable source modules free of presentation and browser dependencies", () => {
    const root = join(process.cwd(), "src");
    const violations: string[] = [];

    for (const moduleDir of STABLE_MODULE_DIRS) {
      for (const file of sourceFiles(join(root, moduleDir))) {
        const source = readFileSync(file, "utf8");
        const displayPath = relative(root, file).split(sep).join("/");
        for (const specifier of importedSpecifiers(source).map(normalizeSpecifier)) {
          if (BANNED_IMPORT_PATTERNS.some((pattern) => pattern.test(specifier))) {
            violations.push(`${displayPath} imports ${specifier}`);
          }
        }
        if (BANNED_DOM_TOKENS.test(source)) {
          violations.push(`${displayPath} references browser DOM globals/types`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
