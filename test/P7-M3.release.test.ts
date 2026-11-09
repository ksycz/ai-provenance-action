import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { describe, expect, it } from "vitest";
import { changelogSection, checkVersion, releasePlan } from "../scripts/release.js";
import { actionCommitSha } from "../src/core/version.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const CHANGELOG = `# Changelog

## [Unreleased]

- Something not released yet.

## [1.1.0] - 2026-12-01

### Added

- A new gate.

## [1.0.0] - 2026-11-09

- First release.
`;

describe("P7-M3 release automation", () => {
  it("P7-M3-03: a pre-release tag does not move the major tag; a release tag does", () => {
    expect(releasePlan("v1.0.0")).toEqual({
      tag: "v1.0.0",
      version: "1.0.0",
      prerelease: false,
      majorTag: "v1",
    });
    expect(releasePlan("v2.3.4").majorTag).toBe("v2");
    expect(releasePlan("v1.1.0-rc.1")).toEqual({
      tag: "v1.1.0-rc.1",
      version: "1.1.0-rc.1",
      prerelease: true,
      majorTag: null,
    });
    for (const bad of ["1.0.0", "v1.0", "v1.0.0.0", "v01.0.0", "release-1"]) {
      expect(() => releasePlan(bad), bad).toThrow(/not a release tag/);
    }
  });

  it("P7-M3-06: the report records the Action's commit SHA only when it was pinned by SHA", () => {
    expect(actionCommitSha("a".repeat(40))).toBe("a".repeat(40));
    expect(actionCommitSha("v1")).toBeNull();
    expect(actionCommitSha("main")).toBeNull();
    expect(actionCommitSha(undefined)).toBeNull();
  });

  it("P7-M3-07: release notes are the CHANGELOG section of that version", () => {
    expect(changelogSection(CHANGELOG, "1.1.0")).toBe("### Added\n\n- A new gate.");
    expect(changelogSection(CHANGELOG, "1.0.0")).toBe("- First release.");
    expect(() => changelogSection(CHANGELOG, "9.9.9")).toThrow(
      /no section for 9\.9\.9/,
    );
  });

  it("P7-M3-08: the tag must match package.json, and package.json has CHANGELOG notes", () => {
    expect(() => checkVersion("v1.0.0", "1.0.0")).not.toThrow();
    expect(() => checkVersion("v1.0.1", "1.0.0")).toThrow(
      /tag v1\.0\.1 does not match package\.json version 1\.0\.0/,
    );
    const version = (JSON.parse(read("package.json")) as { version: string }).version;
    expect(changelogSection(read("CHANGELOG.md"), version).length).toBeGreaterThan(0);
  });

  it("P7-M3-02: release.yml checks tests, dist/ and the version before it creates the release", () => {
    const workflow = loadYaml(read(".github/workflows/release.yml")) as {
      on: { push: { tags: string[] } };
      jobs: Record<string, { steps: { run?: string }[] }>;
    };
    expect(workflow.on.push.tags).toEqual(["v*.*.*"]);
    const runs = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .map((step) => step.run ?? "");
    const at = (needle: string) => runs.findIndex((run) => run.includes(needle));
    const release = at("gh release create");
    expect(release).toBeGreaterThan(-1);
    for (const before of [
      "npm test",
      "npm run build",
      "git diff --exit-code dist/",
      "release.ts check-version",
    ]) {
      expect(at(before), `"${before}" must run before the release`).toBeGreaterThan(-1);
      expect(at(before), `"${before}" must run before the release`).toBeLessThan(
        release,
      );
    }
    expect(at("git push --force origin")).toBeGreaterThan(release);
  });
});
