# Plan: Automated GitHub Release Notes

## Phase 1: Analysis & Configuration
- [ ] Task: Analyze `node/scripts/release.ts` and `prepare-release.yml` to confirm the exact git tag format (e.g., `v1.0.0` or `1.0.0`).
- [ ] Task: Define the `create-github-release.yml` workflow structure, ensuring it handles both stable and pre-releases correctly based on the tag pattern.
- [ ] Task: Conductor - User Manual Verification 'Analysis & Configuration' (Protocol in workflow.md)

## Phase 2: Implementation
- [ ] Task: Create `.github/workflows/create-github-release.yml` with the defined configuration.
- [ ] Task: Conductor - User Manual Verification 'Implementation' (Protocol in workflow.md)

## Phase 3: Verification & Clean Up
- [ ] Task: Verify the workflow syntax using a linter or manual review.
- [ ] Task: (Optional) Test the workflow by pushing a dummy tag (requires user coordination) or reviewing against similar working setups.
- [ ] Task: Conductor - User Manual Verification 'Verification & Clean Up' (Protocol in workflow.md)
