import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");
const TEST_ID = /\bP\d-M\d-\d{2}\b/g;

/** Test IDs that really exist: in a test file's code, or as a recorded live scenario. */
function knownIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of readdirSync(join(repoRoot, "test")).filter((f) =>
    f.endsWith(".ts"),
  )) {
    for (const id of read(`test/${file}`).match(TEST_ID) ?? []) {
      ids.add(id);
    }
  }
  for (const id of read("docs/scenarios.md").match(TEST_ID) ?? []) {
    ids.add(id);
  }
  return ids;
}

describe("P7-M2 threat model and security docs", () => {
  it("P7-M2-01: every threat cites at least one test, and every cited test exists", () => {
    // Every "## " section is a threat, except the "Who controls what" overview.
    const sections = read("docs/threat-model.md")
      .split(/^## /m)
      .slice(1)
      .filter((section) => !section.startsWith("Who controls what"));
    const known = knownIds();
    expect(sections.length).toBeGreaterThanOrEqual(9);

    for (const section of sections) {
      const title = section.split("\n")[0]!;
      const cited = section.match(TEST_ID) ?? [];
      expect(cited, `"${title}" cites no test`).not.toEqual([]);
      for (const id of cited) {
        expect(
          known.has(id),
          `"${title}" cites ${id}, which no test or scenario has`,
        ).toBe(true);
      }
    }
  });

  it("P7-M2-02: no workflow puts a ${{ }} expression inside a run: command (script injection)", () => {
    const offenders: string[] = [];
    const dir = join(repoRoot, ".github/workflows");
    for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
      const lines = readFileSync(join(dir, file), "utf8").split("\n");
      let runIndent = -1;
      lines.forEach((line, i) => {
        const indent = line.search(/\S/);
        const run = /^(\s*)(- )?run:\s*(.*)$/.exec(line);
        if (run) {
          runIndent = run[1]!.length + (run[2] ? 2 : 0);
          if (run[3]!.includes("${{")) {
            offenders.push(`${file}:${i + 1}`);
          }
          return;
        }
        if (runIndent >= 0 && indent > runIndent && line.trim() !== "") {
          if (line.includes("${{")) {
            offenders.push(`${file}:${i + 1}`);
          }
          return;
        }
        if (line.trim() !== "") {
          runIndent = -1;
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("P7-M2-03: SECURITY.md explains how to report a vulnerability and links the threat model", () => {
    const security = read("SECURITY.md");
    expect(security).toMatch(/report a vulnerability/i);
    expect(security).toContain("docs/threat-model.md");
  });
});
