// Release helpers for .github/workflows/release.yml. Run with Node 24 (type stripping):
//   node scripts/release.ts plan v1.2.3          -> key=value lines for $GITHUB_OUTPUT
//   node scripts/release.ts check-version v1.2.3 -> fails unless package.json says 1.2.3
//   node scripts/release.ts notes 1.2.3          -> the CHANGELOG section for 1.2.3
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type ReleasePlan = {
  tag: string;
  version: string;
  prerelease: boolean;
  /** The moving major tag (v1) for a full release; null for a pre-release. */
  majorTag: string | null;
};

const RELEASE_TAG =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** What a pushed tag means: its version, whether it is a pre-release, and which major tag moves. */
export function releasePlan(tag: string): ReleasePlan {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) {
    throw new Error(
      `${tag} is not a release tag (expected vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-pre)`,
    );
  }
  const prerelease = match[4] !== undefined;
  return {
    tag,
    version: tag.slice(1),
    prerelease,
    majorTag: prerelease ? null : `v${match[1]}`,
  };
}

/** The tag and package.json must agree, so the report's action.version is the released one. */
export function checkVersion(tag: string, packageVersion: string): void {
  const { version } = releasePlan(tag);
  if (version !== packageVersion) {
    throw new Error(`tag ${tag} does not match package.json version ${packageVersion}`);
  }
}

/** The body of the "## [x.y.z]" section in a Keep a Changelog file, without its heading. */
export function changelogSection(changelog: string, version: string): string {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section for ${version}`);
  }
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}

function main(argv: string[]): void {
  const [command, value] = argv;
  if (command === "plan" && value) {
    const plan = releasePlan(value);
    process.stdout.write(
      `version=${plan.version}\nprerelease=${plan.prerelease}\nmajor_tag=${plan.majorTag ?? ""}\n`,
    );
  } else if (command === "check-version" && value) {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    checkVersion(value, pkg.version);
    process.stdout.write(`${value} matches package.json\n`);
  } else if (command === "notes" && value) {
    process.stdout.write(
      `${changelogSection(readFileSync("CHANGELOG.md", "utf8"), value)}\n`,
    );
  } else {
    throw new Error(
      "usage: node scripts/release.ts <plan|check-version|notes> <tag-or-version>",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}
