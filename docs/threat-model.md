# Threat model

What could go wrong with the evidence this Action produces, what the Action does about it, and what is left for the team that adopts it. Every threat links to the tests that cover it (`P{phase}-M{milestone}-{nn}`, used verbatim in the test names; P6-M1 scenarios are live runs recorded in [scenarios.md](./scenarios.md)). A test, P7-M2-01, checks that every threat below cites at least one existing test.

The Action produces **evidence that supports an audit**. It does not certify compliance and does not detect AI-written code.

## Who controls what

| Actor                                    | Controls                                                                                                                                                                             | Trusted by the Action?                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| PR author (including a fork contributor) | Commits and their messages and trailers, file names, every file in the PR branch: code, tests, Stryker config, committed reports, and the workflow file itself (with `pull_request`) | No. All of it is treated as untrusted input.                                   |
| Maintainers of the base branch           | `.github/ai-provenance.yml` on the base branch, branch rulesets, required checks, `CODEOWNERS`                                                                                       | Yes. The policy is read only from the base commit.                             |
| GitHub                                   | The `GITHUB_TOKEN` and its permissions (read-only on fork PRs), PR metadata, reviews                                                                                                 | Yes.                                                                           |
| Earlier jobs in the same workflow run    | The mutation report passed as `mutation-report`                                                                                                                                      | As far as the job that produced it is trusted. See "A forged mutation report". |

## Spoofed or missing trailers

**Threat.** Trailers and labels are self-declared. A contributor can leave out `Co-authored-by: Claude …` to avoid the gates, add one to a human-written commit, or write a trailer-like line in the message body to confuse the parser.

**What the Action does.**

- The report records declarations, never authorship: every report carries the `declarations-only` limitation ("a commit without them is not evidence of human authorship"). Test: P4-M1-04.
- Trailers are parsed exactly like `git interpret-trailers`: only from the last paragraph, so a `Key: value` line in the body is ignored. Tests: P1-M1-03, P1-M1-07.
- A key-only rule does not match a different key that contains it (`Not-Assisted-by`), and a human co-author does not match the AI rule. Tests: P1-M2-03, P1-M2-05.
- A regex is only tested against the trailer value, never against the whole message. Test: P1-M2-10.

**What is left for the team.** Make declaring AI help part of the team's working agreement, and enable commit trailers in the AI tools (several add them by default). Use the `ai-assisted` label for PRs where AI was used without trailers. The Action cannot catch an undeclared change; nothing based on declarations can.

## A pull request weakens its own policy

**Threat.** The author of a pull request edits `.github/ai-provenance.yml` in that same PR, for example by switching `policy.mode` to `warn`, deleting a gate or lowering a mutation threshold, so that their own AI-assisted changes pass.

**What the Action does.**

- The config is read from the PR's **base commit** (`GET /contents/{path}?ref=<base sha>`), never from the head. A PR, including one from a fork, is always judged by the policy that is already on the target branch. Tests: P5-M2-01, P5-M2-03.
- The head version's content is never downloaded. To tell whether the PR changed the file, the Action compares Git blob SHAs from tree metadata (`GET /git/trees/...`), so the PR's version can never be parsed or used by mistake. Test: P5-M2-01.
- The report records `config.changedInPr: true`, and the PR comment says so, so a reviewer sees the attempt. Tests: P5-M2-03, P5-M2-06.
- The report records the SHA-256 of the exact config bytes used, so an auditor can match the policy afterwards. Test: P5-M2-05.
- A broken config on the base branch fails the job with the exact YAML path, instead of falling back to weaker defaults. Test: P5-M2-04.

**What is left for the team.**

- Once the PR is merged, its config change applies to later PRs. Protect the config with a `CODEOWNERS` entry for `.github/` and a required review.
- With the `pull_request` event, the workflow file itself comes from the PR's head, so a PR could remove the provenance job. Make the job a **required status check** in a branch ruleset: if the job does not run, the PR cannot be merged.
- Anyone who can push directly to the base branch can change the policy. Protect the branch with a ruleset that requires pull requests.

## Markdown and mention injection in the comment and summary

**Threat.** Commit subjects, trailer values, file names and logins come from the PR author. Rendered as Markdown, they could break the results table, inject HTML such as `<script>`, ping people with `@mentions`, link unrelated issues with `#123`, or make a comment so long that GitHub rejects it.

**What the Action does.**

- The summary and comment are rendered only from the report, and every piece of untrusted text is escaped: HTML and Markdown characters become entities, and `@` and `#` get an invisible word joiner, because GitHub links mentions after it decodes entities. Tests: P4-M2-02, P4-M2-03.
- Lists are capped at 50 entries, and the comment shrinks until it fits GitHub's 65 536-character limit. Tests: P4-M2-04, P4-M2-06.
- Commit message bodies never reach the report; only the subject, capped at 200 characters. Test: P4-M1-05.

**What is left for the team.** Nothing specific. Report any rendering that escapes the escaping as a vulnerability (see [SECURITY.md](../SECURITY.md)).

## Someone fakes the Action's PR comment

**Threat.** Anyone who can comment on a PR writes a comment that starts with the hidden marker `<!-- ai-provenance-action -->` and a fake ✅ result, hoping the Action will update it (making it look official) or that reviewers will trust it.

**What the Action does.**

- A comment is treated as the Action's own only when it starts with the marker **and** was written by the token's identity: `github-actions[bot]` for the workflow token, or the login from `GET /user` for a personal token. A marked comment by anyone else is never edited, and the Action posts its own. Test: P5-M4-03.
- The comment is only a view. The verdict lives in the check status and the report artifact, which a commenter cannot change. Tests: P5-M4-04, P5-M3-02.

**What is left for the team.** Trust the required status check and the artifact, not a comment's text. A fake comment will not show as written by `github-actions[bot]`.

## Fork pull requests and the read-only token

**Threat.** A workflow that gives fork PRs a write token and secrets (the `pull_request_target` trigger) can leak secrets or let fork code modify the repository.

**What the Action does.** It works with the plain `pull_request` trigger and a read-only token: on a fork PR it still evaluates the policy, writes the job summary and uploads the report. Only the PR comment is skipped, with a notice. Fork PRs are recorded as `pullRequest.isFork` in the report. Tests: P5-M4-04, P5-M4-05, and the live scenario P6-M1-07, where the run log shows `PullRequests: read`.

**What is left for the team.** Do not switch to `pull_request_target`. Grant only the permissions in the README: `contents: read`, plus `pull-requests: write` when `pr-comment` is on.

## Regular-expression denial of service (ReDoS) through the config

**Threat.** Trailer rules in the config can contain a regular expression. A badly written pattern, such as `(a+)+$`, can take a very long time on certain inputs, and trailer values come from the PR author. The result would be a CI job that hangs.

**What the Action does.**

- The patterns come only from the base branch, so a PR author cannot add one. Test: P5-M2-01.
- Patterns longer than 200 characters are rejected, and invalid patterns fail with the rule and the error. Tests: P2-M1-05, P2-M1-06.
- Patterns run only against single trailer values, never against whole commit messages, and parsing a 1 MB message stays under 50 ms. Tests: P1-M2-10, P1-M1-10.

**What is left for the team.** A short pattern can still backtrack badly. Keep trailer patterns simple (a list of names like the default `\b(claude|copilot|cursor|codex|gemini|devin)\b`), and keep the job's default timeout.

## A forged mutation report

**Threat.** The mutation gate reads a Stryker report from a path in the workspace. The PR author controls the branch, so they could commit a fake report with a high score, change the Stryker config to skip the AI-touched files, or edit the job that produces the report.

**What the Action does.**

- It reads the report only from inside the workspace, and refuses `..`, absolute paths and symlinks that point outside. Test: P5-M3-06.
- Only mutants in the AI-touched files count with `scope: ai-files`, and paths are normalised before matching. Tests: P3-M2-02, P3-M2-03.
- A missing report follows `on-missing` (`fail` by default), and a malformed one becomes an error, never a pass. Tests: P3-M2-06, P3-M2-07.

**What is left for the team.** The gate is only as trustworthy as the job that wrote the report. Produce the report in an earlier job of the **same run**, pass it by artifact, and never read one committed to the branch. Put the Stryker config and the workflow files under `CODEOWNERS`. The scenario PRs in this repository commit `e2e/mutation.json` on purpose, as test fixtures; they show exactly the pattern a real policy must not allow.

## Path traversal through action inputs

**Threat.** The `mutation-report` and `report-path` inputs are paths. A crafted value such as `../../etc/passwd`, an absolute path or a symlink could make the Action read or write outside the workspace.

**What the Action does.** Both paths are resolved against `GITHUB_WORKSPACE` with `realpath`, and anything outside it fails the step before any API call. Test: P5-M3-06.

**What is left for the team.** Set these inputs in the workflow file, not from PR-controlled values.

## Script injection in workflows that use the outputs

**Threat.** The `ai_files` output lists file names chosen by the PR author. A workflow that writes `run: echo "${{ steps.audit.outputs.ai_files }}"` hands those names to the shell, where a name like `$(curl …)` runs as a command.

**What the Action does.** Its own outputs are JSON-encoded. This repository's workflows pass PR-controlled values to scripts only through environment variables, and a test fails if any workflow puts a `${{ }}` expression inside a `run:` command. Test: P7-M2-02.

**What is left for the team.** In your own workflows, read the outputs through `env:` (for example `AI_FILES: ${{ steps.audit.outputs.ai_files }}`) and use `"$AI_FILES"` in the script.

## Very large pull requests and truncated data

**Threat.** The GitHub REST API lists at most 250 commits per PR and 3000 files per commit. On a very large PR, AI-tagged commits or files could be missed, and a report that looks complete would be wrong.

**What the Action does.**

- Truncation is detected and recorded, never silently dropped: `truncated-commits` and `truncated-files` limitations in the report, and a warning in the summary. Tests: P5-M1-02, P5-M1-04, P5-M1-09, P4-M1-04, P4-M2-10.
- With `on-truncated: fail` (the default), a truncated PR fails without running the gates, because AI commits may have been missed. Test: P3-M1-07.

**What is left for the team.** Split very large changes into smaller PRs. Set `on-truncated: warn` only if you accept incomplete evidence for those PRs.
