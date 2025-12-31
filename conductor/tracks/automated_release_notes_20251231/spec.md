# Specification: Automated GitHub Release Notes

## Context
The project currently has automated workflows for:
1.  **Preparing Releases (`prepare-release.yml`):** Bumps versions in `package.json`/`pyproject.toml` and pushes git tags.
2.  **Publishing Packages (`publish-dual.yml`):** Publishes artifacts to NPM and PyPI.

However, it lacks a dedicated "GitHub Release" entry that aggregates the changelog/release notes for these tags.

## Goals
-   Automatically create a GitHub Release object when a new tag is pushed.
-   Auto-generate release notes (changelog) using GitHub's built-in "Generate Release Notes" capability.
-   Ensure this runs independently or as a subsequent step to the `prepare-release` workflow.

## Proposed Solution
-   Create a new GitHub Action workflow (`.github/workflows/create-github-release.yml`).
-   Trigger: `on: push: tags: ['v*']` (Subject to tag format verification).
-   Job:
    -   Checkout code.
    -   Use `softprops/action-gh-release` or the `gh` CLI.
    -   Enable `generate_release_notes: true`.
    -   Handle prereleases (if the tag indicates a prerelease) automatically if possible, or mark as draft.

## Technical Details
-   **Workflow File:** `.github/workflows/create-github-release.yml`
-   **Permissions:** `contents: write` (to create the release).
