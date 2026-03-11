#!/bin/bash

set -e

get_blocking_pr() {
  local issue_body="$1"
  local blocked_by
  
  blocked_by=$(echo "$issue_body" | grep -i "blocked by" | grep -oE '#[0-9]+' | grep -oE '[0-9]+' || true)
  
  if [ -n "$blocked_by" ]; then
    local blocking_branch
    blocking_branch=$(gh pr list --state open --json headRefName --jq -r ".[] | select(.headRefName | startswith(\"issue-${blocked_by}-\")) | .headRefName" 2>/dev/null | head -1 || true)
    
    if [ -n "$blocking_branch" ]; then
      echo "$blocking_branch"
      return 0
    fi
  fi
  
  return 1
}

get_next_issue() {
  local issues
  issues=$(gh issue list --state open --json number,title,body --jq '.[] | select(.number != 1)')
  
  while IFS= read -r issue; do
    local number title body
    number=$(echo "$issue" | jq -r .number)
    title=$(echo "$issue" | jq -r .title)
    body=$(echo "$issue" | jq -r .body)
    
    local branch_prefix="issue-${number}-"
    local has_pr
    has_pr=$(gh pr list --state all --json headRefName --jq ". | map(select(.headRefName | startswith(\"$branch_prefix\"))) | length")
    
    if [ "$has_pr" -eq 0 ]; then
      local blocking_pr
      blocking_pr=$(get_blocking_pr "$body" || true)
      
      if [ -n "$blocking_pr" ]; then
        echo "${number}|${title}|${blocking_pr}"
      else
        echo "${number}|${title}|"
      fi
      return 0
    fi
  done <<< "$(echo "$issues" | jq -c .)"
  
  return 1
}

get_next_issue
