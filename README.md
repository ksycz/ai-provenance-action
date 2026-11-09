# AI Provenance Audit (`ai-provenance-action`)

[![ci](https://github.com/ksycz/ai-provenance-action/actions/workflows/ci.yml/badge.svg)](https://github.com/ksycz/ai-provenance-action/actions/workflows/ci.yml)
[![check-dist](https://github.com/ksycz/ai-provenance-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/ksycz/ai-provenance-action/actions/workflows/check-dist.yml)
[![e2e](https://github.com/ksycz/ai-provenance-action/actions/workflows/e2e.yml/badge.svg)](https://github.com/ksycz/ai-provenance-action/actions/workflows/e2e.yml)
[![core coverage](https://img.shields.io/badge/core%20coverage-%E2%89%A595%25%20enforced%20in%20CI-brightgreen)](./vitest.config.ts)
[![release](https://img.shields.io/github/v/release/ksycz/ai-provenance-action?include_prereleases&label=release)](https://github.com/ksycz/ai-provenance-action/releases)

A GitHub Action that makes AI-assisted changes in a pull request visible, checks them against your policy, and keeps a record. It produces **evidence that supports an audit**; see [what this is not](#what-this-is-not) and [evidence for audits](#evidence-for-audits).

## What it does

- **Finds what was declared as AI-assisted.** It reads commit trailers such as `Co-authored-by: Claude …` or `Co-authored-by: GitHub Copilot …`, or an `ai-assisted` label on the PR, and maps them to the files and lines those commits added.
- **Checks your policy on those changes.** Gates read evidence from other jobs: a minimum mutation score from a Stryker report on the AI-touched files, a required label such as `ai-reviewed`, or an approval from someone other than the author. Each gate can enforce or only warn.
- **Keeps a record.** A versioned JSON report is uploaded as a workflow artifact. The result also appears as a job summary and, optionally, as one PR comment that updates itself.

## What it looks like

On a pull request with AI-assisted commits, the Action keeps one comment up to date. Here the mutation gate fails, because the AI-touched code has a mutation score of 25 % against a threshold of 80 % ([scenario PR #23](https://github.com/ksycz/ai-provenance-action/pull/23)):

<img src="docs/images/comment-fail.png" alt="PR comment from github-actions: AI provenance Fail, mutation gate 25.00 below 80, with the AI-tagged commit and the files it touched" width="720">

The same policy can run in warn mode. The enforce job fails the check, while the warn job stays green with a warning annotation:

<img src="docs/images/run-fail-warn.png" alt="Workflow run: provenance job failed, provenance-warn job green, annotations show verdict fail and verdict warn" width="720">

More scenarios, including a passing PR and a PR from a fork, are in [docs/scenarios.md](./docs/scenarios.md).

## Quick start

Add a workflow that runs on pull requests:

```yaml
name: ai-provenance
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
  pull_request_review:
    types: [submitted, dismissed]

permissions:
  contents: read
  pull-requests: write # only needed for pr-comment: true

jobs:
  provenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: ksycz/ai-provenance-action@v1
        with:
          pr-comment: "true"
```

`labeled` and `pull_request_review` re-run the check when someone adds the `ai-reviewed` label or approves, because gates are evaluated when the workflow runs.

## Configuration

Without a config file, the Action uses built-in defaults: the common AI trailers, the `ai-assisted` label, and **no gates** (report only). To add gates, commit `.github/ai-provenance.yml` to your default branch. The Action always reads it from the PR's **base** branch, so a pull request cannot weaken the policy that judges it.

```yaml
version: 1
policy:
  mode: enforce # or warn: failing gates only add a warning
  gates:
    - id: mutation
      type: mutation-score
      threshold: 80 # percent, measured on AI-touched files
      scope: ai-files
      on-missing: fail # fail | warn | skip when no report is given
    - id: reviewed
      type: required-label
      label: ai-reviewed
      mode: warn
    - id: human-approval
      type: approvals
      min: 1
```

Every field is described in [docs/configuration.md](./docs/configuration.md), and the report format in [docs/report-format.md](./docs/report-format.md). The mutation gate reads a Stryker `mutation.json` that an earlier job produced; pass its path with the `mutation-report` input.

## Permissions and fork pull requests

| Permission             | When                                    | Why                                                        |
| ---------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `contents: read`       | always                                  | Read the config from the base branch and the commit diffs. |
| `pull-requests: read`  | always (part of `pull-requests: write`) | Read the PR, its commits and reviews.                      |
| `pull-requests: write` | only with `pr-comment: true`            | Create or update the sticky PR comment.                    |

**Pull requests from forks** get a read-only `GITHUB_TOKEN`. The check still runs and still sets the verdict, writes the job summary and uploads the report artifact. Only the PR comment is skipped, with a notice explaining why.

**Do not use `pull_request_target` for this Action.** It runs with a write token and secrets in the context of the base repository. Workflows that check out and run code from the fork under that trigger are a well-known way to leak secrets or tamper with the repository. This Action needs neither secrets nor write access to produce its evidence. The policy is already protected because it is read from the base branch, so plain `pull_request` is the safe choice. The price is the skipped comment on fork PRs.

## Inputs

| Input             | Default                     | Purpose                                                                                                  |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `github-token`    | `${{ github.token }}`       | Token for the GitHub REST API. Needs `contents: read` and `pull-requests: read`.                         |
| `config-path`     | `.github/ai-provenance.yml` | Where the policy file lives. It is always read from the PR's base branch.                                |
| `mutation-report` | _(empty)_                   | Path to a Stryker `mutation.json` written by an earlier step. Must be inside the workspace.              |
| `report-path`     | `ai-provenance-report.json` | Where to write the JSON report, inside the workspace.                                                    |
| `upload-artifact` | `true`                      | Upload the report as the artifact `ai-provenance-<pr>-<run_attempt>`.                                    |
| `pr-comment`      | `false`                     | Create or update one sticky PR comment. Needs `pull-requests: write`; skipped with a notice on fork PRs. |

## Outputs

| Output        | Example                     | Purpose                                                                        |
| ------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `ai_tagged`   | `true`                      | Whether any commit or PR label was declared AI-assisted.                       |
| `ai_files`    | `["src/a.ts"]`              | JSON array of files touched by AI-tagged commits.                              |
| `report_path` | `ai-provenance-report.json` | Path of the written JSON report.                                               |
| `verdict`     | `pass`                      | Overall policy result: `pass`, `warn` or `fail`. A `fail` also fails the step. |

## What this is not

- **Not AI detection.** The Action does not guess whether code was written by AI. It records what contributors **declared**, through trailers and labels. A commit without a trailer is not evidence of human authorship, and every report says so.
- **Not proof.** Trailers and labels can be added or left out by anyone who writes the commit. The value is a consistent record, and rules that run automatically on what was declared.
- **Not certification.** The Action does not make anyone compliant with a standard. It produces evidence that an auditor can use.

The [threat model](./docs/threat-model.md) lists what the Action protects against and what is left to your team. To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Evidence for audits

The report can serve as evidence that **supports** controls in these standards. Whether a control is met is decided by your organization and its auditor, not by this Action.

| Standard           | Control                                                     | What the Action contributes                                                                                   |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ISO/IEC 42001:2023 | A.9 Use of AI systems (A.9.2 processes for responsible use) | A documented, automated check that AI-assisted changes go through the review and testing your policy requires |
| ISO/IEC 42001:2023 | A.10 Third-party and customer relationships                 | A record of which external AI tools (Claude, Copilot, …) contributed to which changes                         |
| ISO/IEC 27001:2022 | 8.32 Change management                                      | Each PR's AI-assisted changes, the gates applied and the verdict, tied to the PR and commit SHAs              |
| ISO/IEC 27001:2022 | 8.29 Security testing in development and acceptance         | Mutation-score evidence for AI-touched code, read from your test jobs                                         |
| ISO/IEC 27001:2022 | 8.15 Logging and 5.33 Protection of records                 | A versioned JSON report per run, with the SHA-256 of the policy that was applied, kept as a workflow artifact |

## Project status

`v1.0.0` is [released](https://github.com/ksycz/ai-provenance-action/releases/tag/v1.0.0): use `ksycz/ai-provenance-action@v1` to get every `v1.x` update, or pin a commit SHA for full control. Phases 0–7 of the [roadmap](./docs/ROADMAP.md) are complete, and the Action is tested on this repository's own pull requests ([docs/scenarios.md](./docs/scenarios.md)). Changes are listed in the [CHANGELOG](./CHANGELOG.md).

## Development

```bash
nvm use
npm ci
npm run ci
```

## Tooling choices

Short rationale for libraries named in the roadmap—helpful when skimming the repo.

**nock** — HTTP mocking for Node test runs. Phase 5 adapter tests call the GitHub REST API through `@actions/github`; nock intercepts those requests in-process and returns fixtures, so CI never needs network access and cases like pagination or rate limits stay deterministic. [MSW](https://mswjs.io/) is the usual alternative if you want the same pattern in browser and Node tests; stubbing Octokit by hand is lighter but less faithful to real URLs and headers.

**Rollup** — Bundles `src/main.ts` into a single committed `dist/index.cjs` that the Action executes on the runner (`.cjs`, because `package.json` sets `"type": "module"` and the bundle is CommonJS). GitHub Actions expect a self-contained entry file; Rollup tree-shakes and keeps the bundle explicit. Many Actions use `@vercel/ncc` or **esbuild** (often via **tsup**) instead for speed; Rollup was chosen here for a clear build graph and a committed artifact checked by the `check-dist` workflow.

**Ajv** — Validates YAML-backed config and the JSON audit report against checked-in JSON Schema files (`schema/*.schema.json`). Phase 2 can surface errors at the YAML path (e.g. `policy.gates[0].threshold`) for adopters. **Zod** or **Valibot** are strong when TypeScript types are the source of truth; Ajv fits when the schema files are the contract (editor completion, report versioning docs).

**ESLint and Prettier** — ESLint (with **typescript-eslint**) enforces style and rules such as “`src/core/` must not import `@actions/*` or adapters”; **dependency-cruiser** enforces the same boundary in CI. **Biome** can replace ESLint + Prettier in one fast tool; **Oxlint** is often added for speed, not as a full replacement. This repo keeps the widespread ESLint + Prettier split so custom architectural rules stay straightforward in a portfolio and on the Marketplace.
