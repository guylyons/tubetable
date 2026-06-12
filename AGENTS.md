# Project guide

## Workflow
- Use `jj` instead of `git` for version control.
- Start new work from a feature bookmark/branch.
- Commit as you go with brief, exact JJ commit messages.
- Use TDD for code changes: write or update the failing check first, then implement.
- Use CodeGraph for codebase context before editing and sync it after changes.

## Tooling preferences
- Prefer `rg` for searching.
- Prefer `fd` for finding files.
- When parsing text from shell scripts, prefer `awk` or Perl.

## Stack and UI direction
- The main app is TypeScript + React.
- MUI (https://mui.com/) is a good fit to consider for UI components and interaction polish.
- Before using a UI library in code, verify it is already installed or add the dependency intentionally.
- Match the existing app style and avoid broad visual rewrites unless the task calls for them.
