---
name: structured-commits
description: Use when preparing to commit changes to the git branch, grouping files into separate commits, managing WIP commits, or updating the CHANGELOG.md before release.
---

# Structured Commits & Changelog Skill

This skill ensures that git commits are cleanly grouped, properly verified, and that the changelog is updated safely under human supervision.

---

## 1. Commit Grouping & Ordering

When multiple files are modified, do not commit them in a single monolithic commit. Group and order them as follows:

### Step 1: Project & Configuration Files (First)
- Commit metadata, configuration, and documentation changes first (e.g. `README.md`, `.gitignore`, `docs/`, `skills/`, `.json` spec files, or build configurations like `package.json`, `tsconfig.json`, `pyproject.toml`).
- Use the **Conventional Commits** structure:
  - `docs: <summary of changes>` (for readme, design guides, specs)
  - `chore: <summary of changes>` (for dependency updates, config settings, lockfiles)
- **Gating:** Code configuration changes must pass a quick build-compilation check (e.g. `bun run ui:build` or `uv build`) before committing to ensure they do not break build stability. Documentation-only files require only human review.

### Step 2: Source Code Changes (Second)
- Commit actual source code implementation (`.ts`, `.tsx`, `.py`, `.rs`) after the configuration files are checked in.
- Use Conventional Commits formatting:
  - `feat(<scope>): <summary>` (for new features)
  - `fix(<scope>): <summary>` (for bug fixes)
  - `refactor(<scope>): <summary>` (for visual or structural code cleanup)

---

## 2. Verification Gating & WIP Commits

Before checking in source code changes:

- **Full Verification:** Run the relevant automated test suite (e.g. `bun run server:test` or `uv run pytest`). If all tests pass, commit with a clean Conventional Commit message.
- **Work-In-Progress (WIP):** If tests are not fully written/passing, or if a task is incomplete but you need to check in progress, commit using the format:
  ```text
  <type>(<scope>): [WIP] <change-milestone-task-goal>
  ```
  - *Example:* `feat(ui): [WIP] build expandable grid layout`
  - **Constraint:** Keep these `[WIP]` commits in the git history as is. Do **not** squash or rebase them out, as they preserve the developmental progress history.

---

## 3. Changelog Protocol

Update the `CHANGELOG.md` file *only* immediately prior to release or publication.

### Step 1: Trigger Detection
- Ask the user (human) for permission to update the changelog if:
  1. Specifically invoked by the user.
  2. A version bump was committed in the last 5 commits.
- Give the user the choice to:
  - Edit the changelog manually.
  - Approve the agent writing the draft automatically.

### Step 2: Automatic Changelog Formatting
If the user approves automatic drafting, insert the release entry at the top of `CHANGELOG.md` (below the header):
- **Version Heading (h2):** `## [{version}] - {dd-MMM-yyyy}` (e.g., `## [1.3.0] - 18-Jul-2026`), using the current local date.
- **Change Groups (h3):** Use only `### Added`, `### Fixed`, and `### Changed` sections to match the existing format in the repository.
