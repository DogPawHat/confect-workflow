# Ralph Loops

Autonomous AI coding loops that work through GitHub issues, creating amend-friendly PRs with stacked workflows.

## Structure

```
.ralph/
├── get-next-issue.sh      # Shared: finds next issue without PR
├── codex/                  # OpenAI Codex (GPT-5.4)
│   ├── ralph-once.sh       # Single iteration
│   └── afk-ralph.sh        # Loop N iterations
└── opencode/               # OpenCode (GLM-5)
    ├── ralph-once.sh       # Single iteration
    └── afk-ralph.sh        # Loop N iterations
```

## Usage

### Codex (GPT-5.4, medium reasoning)

```bash
.ralph/codex/ralph-once.sh          # Work on next issue
.ralph/codex/afk-ralph.sh 10        # Process 10 issues
```

### OpenCode (GLM-5)

```bash
.ralph/opencode/ralph-once.sh       # Work on next issue
.ralph/opencode/afk-ralph.sh 10     # Process 10 issues
```

## How It Works

1. **Fetches PRD** from GitHub issue #1
2. **Gets next issue** without existing PR
3. **Detects blocking issues** and stacks PRs appropriately
4. **Creates jj workspace** with bookmark: `issue-{number}-{slug}`
5. **Implements issue** with AI agent
6. **Creates amend-friendly PR** with `jj spr diff`
7. **Stacks dependent PRs** on top of blocking PRs

## Features

- **GitHub Issues Integration**: PRD from issue #1, tasks from other issues
- **Stacked PRs**: Detects "Blocked by #X" and stacks on top of open PRs
- **JJ Workspaces**: Each issue gets its own bookmark/workspace
- **Amend-Friendly**: Use `jj squash` to update PRs with feedback

## Requirements

- `jj` (Jujutsu) installed and configured
- `jj-spr` alias configured
- GitHub CLI (`gh`) authenticated
- Codex CLI or OpenCode CLI installed

## Customization

Edit the scripts to change:
- Model selection (`-m gpt-5.4` or `--model opencode-go/glm-5`)
- Reasoning effort (`-c model_reasoning_effort=medium` or `--variant`)
- Test commands
- Commit message format
