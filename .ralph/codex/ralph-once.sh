#!/bin/bash
set -e

issue_data=$(../get-next-issue.sh)
if [ -z "$issue_data" ]; then
  echo "All issues have PRs!"
  exit 0
fi

IFS='|' read -r issue_number issue_title blocking_pr <<< "$issue_data"

slug=$(echo "$issue_title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
branch_name="issue-${issue_number}-${slug}"

echo "Working on issue #${issue_number}: ${issue_title}"
echo "Branch: ${branch_name}"

if [ -n "$blocking_pr" ]; then
  echo "Stacking on top of blocking PR: ${blocking_pr}"
  
  if ! jj bookmark list | grep -q "^${branch_name}:"; then
    jj new "${blocking_pr}@origin"
    jj bookmark create "$branch_name" -r @
  fi
else
  if ! jj bookmark list | grep -q "^${branch_name}:"; then
    jj new main@origin
    jj bookmark create "$branch_name" -r @
  fi
fi

jj edit "$branch_name"

prd=$(gh issue view 1 --json body --jq .body)

codex exec \
  --full-auto \
  -m gpt-5.4 \
  -c model_reasoning_effort=medium \
  "PRD: ${prd}

Issue #${issue_number}: ${issue_title}

Read the issue details with: gh issue view ${issue_number}

Implement this issue. Follow the PRD requirements. Run tests and type checks. Commit your changes. ONLY implement this single issue."

if [ -n "$blocking_pr" ]; then
  jj spr diff --all
else
  jj spr diff -r @-
fi
