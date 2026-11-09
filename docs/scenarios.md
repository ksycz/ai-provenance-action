# End-to-end scenarios

The `e2e` workflow (`.github/workflows/e2e.yml`) runs the bundled Action (`uses: ./`) on every pull request to `main`. It uses this repository's own policy (`.github/ai-provenance.yml`): a mutation gate at 80 % on AI-touched files, skipped when there is no mutation report.

Each scenario below is a long-lived draft pull request that shows one outcome on real GitHub. It is never merged. All results were checked on 2026-11-09.

| ID       | Scenario                             | Pull request and run                                                                                                                        | Result                                                                                                            |
| -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| P6-M1-01 | No AI trailers                       | [#21](https://github.com/ksycz/ai-provenance-action/pull/21), [run](https://github.com/ksycz/ai-provenance-action/actions/runs/42583770685) | `provenance` ✅ `pass`, one-line summary; `ai-only` skipped; no PR comment                                        |
| P6-M1-02 | Claude trailer, mutation score 80 %  | [#22](https://github.com/ksycz/ai-provenance-action/pull/22), [run](https://github.com/ksycz/ai-provenance-action/actions/runs/42583772858) | `provenance` ✅ `pass`; comment shows "mutation score 80.00 >= 80"                                                |
| P6-M1-03 | Copilot trailer, mutation score 25 % | [#23](https://github.com/ksycz/ai-provenance-action/pull/23), [run](https://github.com/ksycz/ai-provenance-action/actions/runs/42583775663) | `provenance` ❌ `fail` (on purpose); comment shows "mutation score 25.00 < 80"                                    |
| P6-M1-04 | Same PR, warn-mode policy            | [#23](https://github.com/ksycz/ai-provenance-action/pull/23), same run                                                                      | `provenance-warn` ✅ green with the warning "AI provenance verdict: warn"                                         |
| P6-M1-05 | Downstream job on `ai_tagged`        | #20, #22 and #23 versus #21                                                                                                                 | `ai-only` runs on the AI-tagged PRs and is skipped on #21                                                         |
| P6-M1-06 | Squash merge of a tagged PR          | the PR that adds this page, if squash-merged                                                                                                | the PR run's artifact keeps the original commit trailers                                                          |
| P6-M1-07 | PR from a fork (`ksycz-lab`)         | [#20](https://github.com/ksycz/ai-provenance-action/pull/20), [run](https://github.com/ksycz/ai-provenance-action/actions/runs/42582621458) | `provenance` ✅; notice "Skipped the PR comment…"; token `PullRequests: read`; no comment; report `isFork: true`  |
| P6-M1-08 | Artifact validation                  | every PR above                                                                                                                              | `validate-report` ✅ downloads the artifact and checks it against `schema/report.v1.schema.json`                  |
| P6-M1-09 | The bundle starts on a runner        | every PR above                                                                                                                              | the Action starts from `dist/index.cjs`; the first real run, before the fix, failed with `require is not defined` |

## Screenshots

_To be added: the job summary and the PR comment for #21, #22 and #23, and the notice for #20._

## How the scenario PRs are built

- **Fork PR.** #20 comes from a fork in the organization `ksycz-lab`, so GitHub gives its workflow a read-only token. No second account is needed.
- **Mutation reports.** The scenario PRs carry a small Stryker-format report at `e2e/mutation.json`. It stands in for a mutation-testing job, and covers only the file the AI-tagged commit adds. Ordinary PRs have no such file, so the mutation gate is skipped there (`on-missing: skip`).
- **Trailers.** The commits in #21 and #23 deliberately do not carry the usual `Co-Authored-By: Claude` line: #21 must have no AI trailer, and #23 shows a Copilot trailer on its own.
