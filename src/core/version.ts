/** Action identity, also written to the report's `action` block (P4-M1). */
export const ACTION_NAME = "ai-provenance-action" as const;

export const DEFAULT_ACTION_VERSION = "0.0.0";

export function actionVersion(envVersion?: string): string {
  return envVersion?.trim() || DEFAULT_ACTION_VERSION;
}

/**
 * The Action's own commit SHA, when the workflow pinned it by SHA
 * (`uses: owner/repo@<sha>`, so GITHUB_ACTION_REF is that SHA). A tag such as
 * `v1` or a branch name is not a commit SHA, so it gives null.
 */
export function actionCommitSha(actionRef?: string): string | null {
  const ref = actionRef?.trim() ?? "";
  return /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(ref) ? ref : null;
}
