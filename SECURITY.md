# Security policy

## Supported versions

| Version                      | Supported                    |
| ---------------------------- | ---------------------------- |
| `v1.x` (once released)       | Yes, the latest `v1` release |
| Unreleased commits on `main` | Best effort                  |

## How to report a vulnerability

Please do **not** open a public issue for a security problem.

Report a vulnerability privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to reproduce it, and the impact you expect. You can expect a first answer within 7 days.

Examples of what counts as a vulnerability here:

- untrusted text (commit messages, trailer values, file names) that escapes the Markdown escaping and pings people, injects HTML or breaks the PR comment
- a way for a pull request to change the policy that judges it
- a way for the Action to read or write files outside the workspace
- a way to make the Action edit a comment it did not write

## What this Action is designed to protect against

The [threat model](./docs/threat-model.md) lists every known threat, what the Action does about it, the tests that cover it, and what is left for the team that adopts it.

The Action records **declared** AI assistance. It cannot catch AI-assisted changes that were not declared, and that is a documented limitation, not a vulnerability.
