---
name: jj-spr
description: Create, update, list, amend, close, and land GitHub pull requests from a colocated Jujutsu repository with `jj spr`. Use when Codex needs amend-friendly PR workflows or stacked PR workflows in a `.jj/` repo, especially for tasks mentioning `jj spr diff`, `jj spr land`, `jj spr init`, stacked PRs, or `--cherry-pick`.
---

# JJ SPR

Use this skill for `jj-spr` workflows in Jujutsu repositories.

Load the `jujutsu` skill first whenever the task touches repository state. This skill assumes the repo is already safe to operate on with `jj`.

## Preconditions

Confirm these before running `jj spr`:

- The repository is a colocated Jujutsu repo (`.jj/` exists and Git backing storage is available).
- The user has write access to the target GitHub repository. `jj-spr` cannot create PRs from forks without write access.
- `jj spr` is installed and configured. If not, use the setup steps in [references/commands-and-config.md](references/commands-and-config.md).
- A GitHub token is available through `jj spr init`, repo config, Jujutsu config, or `GITHUB_TOKEN`.

## Workflow Choice

Choose the smallest workflow that matches the task:

- Single amend-friendly PR: keep the working copy empty at `@`, keep the reviewable change at `@-`, run `jj spr diff`, amend locally, then run `jj spr diff` again.
- Independent stacked PRs: use `jj spr diff --cherry-pick` and `jj spr land --cherry-pick` when changes can land in any order.
- Dependent stacks: use `jj spr diff --all` or an explicit range when child changes truly depend on parent changes, and land them bottom-up.

## Operating Rules

Follow these rules to avoid common mistakes:

- Prefer explicit `-r <change-id>` when creating, updating, landing, or closing a specific PR.
- Remember the defaults: `jj spr diff` targets `@-`, while `jj spr land` targets `@`.
- Use change IDs, not commit hashes, when selecting revisions.
- Re-run `jj spr diff` after `jj squash`, `jj desc -m`, or any other local rewrite that should update the GitHub PR.
- After `jj spr land`, fetch and rebase manually. Landing does not move your local working copy for you.
- Use `jj spr amend` when GitHub PR metadata should be pulled back into the local commit message.

## Reference Loading

Read [references/commands-and-config.md](references/commands-and-config.md) when you need:

- install or alias setup
- one-time repository initialization
- command examples for single or stacked PRs
- config keys, precedence, or environment variables
