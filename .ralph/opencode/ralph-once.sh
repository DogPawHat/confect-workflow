#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
issue_data=$("$SCRIPT_DIR/../get-next-issue.sh")
if [ -z "$issue_data" ]; then
  echo "All issues have PRs!"
  exit 0
fi

IFS='|' read -r issue_number issue_title blocking_pr <<< "$issue_data"

slug=$(echo "$issue_title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
branch_name="issue-${issue_number}-${slug}"

echo "Working on issue #${issue_number}: ${issue_title}"
echo "Branch: ${branch_name}"

if jj bookmark list | grep -q "^${branch_name}:"; then
  echo "Bookmark exists, continuing work..."
  jj new "$branch_name"
else
  if [ -n "$blocking_pr" ]; then
    echo "Stacking on top of blocking PR: ${blocking_pr}"
    jj new "${blocking_pr}@origin"
  else
    jj new main@origin
  fi
  jj bookmark create "$branch_name" -r @
fi

jj desc -m "Issue #${issue_number}: ${issue_title}" -m "Fixes #${issue_number}"

prd=$(gh issue view 1 --json body --jq .body)

opencode run \
  --model opencode-go/glm-5 \
  --thinking \
  -f PRD.md \
  -f progress.txt \
  "PRD: ${prd}

Issue #${issue_number}: ${issue_title}

Read the issue details with: gh issue view ${issue_number}

Implement this issue. Follow the PRD requirements. Run tests and type checks. Commit your changes. Ensure the PR body includes 'Fixes #${issue_number}'. ONLY implement this single issue."

jj new
jj spr diff
