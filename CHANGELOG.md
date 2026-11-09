# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/). The report format has its own version (`schemaVersion`), described in [docs/report-format.md](./docs/report-format.md).

## [Unreleased]

## [1.0.0] - 2026-11-09

First release.

### Added

- **Detection:** commits declared as AI-assisted through trailers (for example `Co-authored-by: Claude …` or `Co-authored-by: GitHub Copilot …`) or a PR label, mapped to the files and lines they added.
- **Policy gates:** a mutation score from a Stryker report on the AI-touched files, a required label, and approvals from someone other than the author, each in `enforce` or `warn` mode.
- **Policy from the base branch:** `.github/ai-provenance.yml` is always read from the PR's base commit, with built-in defaults when it is missing.
- **Audit report:** a versioned JSON report (`schemaVersion` 1.0.0) uploaded as the artifact `ai-provenance-<pr>-<run_attempt>`, a job summary, and an optional sticky PR comment that updates itself.
- **Outputs:** `ai_tagged`, `ai_files`, `report_path` and `verdict`.
- **Fork PRs:** the check works with the read-only token; only the PR comment is skipped, with a notice.
- **Documentation:** configuration and report reference, a threat model with every threat tied to its tests, and end-to-end scenarios recorded on real pull requests.
