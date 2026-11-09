import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const markdownFiles = [
  "README.md",
  ...readdirSync(join(repoRoot, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];

/** Markdown links `[x](target)` and HTML `src="target"`, minus code blocks. */
function targets(markdown: string): string[] {
  const text = markdown.replace(/```[\s\S]*?```/g, "");
  return [
    ...[...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!),
    ...[...text.matchAll(/\bsrc="([^"]+)"/g)].map((m) => m[1]!),
  ];
}

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

describe("P7-M1 README and Marketplace metadata", () => {
  it("P7-M1-03: every relative link and image in the README and docs/ points to an existing file", () => {
    const broken: string[] = [];
    for (const file of markdownFiles) {
      for (const target of targets(read(file))) {
        if (/^(https?:|mailto:|#)/.test(target)) {
          continue;
        }
        const path = resolve(repoRoot, dirname(file), target.split("#")[0]!);
        if (!existsSync(path)) {
          broken.push(`${file} -> ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("P7-M1-03: in-page anchors in the README point to real headings", () => {
    const readme = read("README.md");
    const anchors = new Set(
      [...readme.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1]!.replace(/`/g, ""))),
    );
    const missing = targets(readme)
      .filter((t) => t.startsWith("#"))
      .filter((t) => !anchors.has(t.slice(1)));
    expect(missing).toEqual([]);
  });

  it("P7-M1-04: action.yml has a description of at most 125 characters and branding", () => {
    const action = loadYaml(read("action.yml")) as {
      description: string;
      branding?: { icon?: string; color?: string };
    };
    expect(action.description.length).toBeLessThanOrEqual(125);
    expect(action.branding?.icon).toBeTruthy();
    expect(action.branding?.color).toBeTruthy();
  });

  it("P7-M1-05: the README has every section the roadmap asks for", () => {
    const headings = [...read("README.md").matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    for (const wanted of [
      "What it does",
      "What it looks like",
      "Quick start",
      "Configuration",
      "Permissions and fork pull requests",
      "Inputs",
      "Outputs",
      "What this is not",
      "Evidence for audits",
    ]) {
      expect(headings, `missing section "${wanted}"`).toContain(wanted);
    }
  });
});
