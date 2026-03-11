# JJ SPR Commands And Config

Use this reference when you need exact setup steps, workflow commands, or configuration details.

## Requirements

- Write access to the target GitHub repository
- A colocated Jujutsu repository (`jj git init --colocate` for new repos)
- A GitHub personal access token with `repo` scope
- `git` available in `PATH`

If the user only has fork-based access, do not force `jj-spr`. Fall back to the normal fork plus GitHub web PR flow.

## Install And Enable

Install the binary from source:

```bash
git clone https://github.com/LucioFranco/jj-spr.git
cd jj-spr
cargo install --path spr
```

Register `jj spr` as a Jujutsu alias:

```bash
jj config set --user aliases.spr '["util", "exec", "--", "jj-spr"]'
```

Equivalent config file entry:

```toml
[aliases]
spr = ["util", "exec", "--", "jj-spr"]
```

Initialize a repository:

```bash
jj spr init
```

Prefer `jj spr init` over manual config. It writes repo settings into `.git/config` and prompts for the GitHub token.

## Mental Model

- `@` is the current working-copy commit where new edits happen.
- `@-` is the parent of the working copy and is the usual "review this change" target.
- `jj spr diff` defaults to `@-`.
- `jj spr land` defaults to `@`.
- Local history can be amended freely; `jj-spr` keeps GitHub review history append-only.

Because `land` defaults differently from `diff`, pass `-r` explicitly unless the target is obvious.

## Single PR Workflow

Use this workflow for one amend-friendly PR:

```bash
jj new main@origin
jj desc -m "Add new feature"

# edit files in @

jj new
jj spr diff

# address review feedback in @

jj squash
jj spr diff

jj spr land -r @-
jj git fetch
jj rebase -r @ -d main@origin
```

Notes:

- Keep `@` empty when possible. That makes `@-` the reviewable change.
- After feedback, amend locally with normal Jujutsu commands, then run `jj spr diff` again.
- After landing, fetch and rebase manually so local history matches the remote main branch.

## Stacked PR Workflows

### Independent Changes

Prefer this when changes do not strictly depend on each other.

```bash
jj spr diff --cherry-pick -r <change-id>
jj spr land --cherry-pick -r <change-id>
```

Use this mode when the user wants flexible landing order.

### Dependent Stack

Use this when child changes must stay based on parent changes.

```bash
jj spr diff --all
```

Or target an explicit range:

```bash
jj spr diff -r main..@
```

Land the stack from the bottom upward:

```bash
jj spr land -r <bottom-change-id>
```

## Core Commands

- `jj spr init`: initialize repo-specific configuration
- `jj spr diff`: create or update pull requests for a change, range, or full stack
- `jj spr land`: squash-merge an approved pull request
- `jj spr list`: list open pull requests and status
- `jj spr close`: close a pull request
- `jj spr amend`: sync local commit message from GitHub PR metadata

Use `jj spr list` before destructive or state-changing operations if the task is ambiguous.

## Configuration

Preferred setup path:

```bash
jj spr init
```

Config precedence, highest to lowest:

1. Command-line flags such as `--github-repository`
2. Jujutsu user config: `~/.jjconfig.toml`
3. Jujutsu repo config: `.jj/repo/config.toml`
4. Git repo config: `.git/config`
5. Environment variables
6. Built-in defaults

Important keys in the `spr` section:

- `spr.githubAuthToken`: GitHub PAT
- `spr.githubRemoteName`: Git remote name, default `origin`
- `spr.githubRepository`: GitHub repo in `owner/repo` form
- `spr.githubMasterBranch`: shared base branch, usually `main`
- `spr.branchPrefix`: prefix for generated PR branches
- `spr.requireApproval`: block `land` unless approved

`jj spr init` writes to Git config, but runtime reads Jujutsu config first and then falls back to Git config.

Manual Git config examples:

```bash
git config spr.githubRepository "owner/repo"
git config spr.branchPrefix "jj-spr/username/"
git config spr.requireApproval true
```

Jujutsu-native overrides:

```bash
jj config set --repo spr.githubAuthToken "ghp_..."
jj config set --user spr.branchPrefix "jj-spr/username/"
```

Environment variables:

- `GITHUB_TOKEN`
- `JJ_SPR_BRANCH_PREFIX`

Avoid passing tokens on the command line unless necessary. That can leak secrets into shell history.
