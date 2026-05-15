---
name: release-new-version
description: Release a new semver version of an npm/pi package using a GitHub Actions release workflow. Use when the user asks to publish, release, tag, bump, or ship a new package version.
---

# Release New Version

Use this workflow to release a new package version by creating and pushing a semver git tag.

## 0. Check the release workflow first

Before choosing or pushing a tag, make sure the repository has an npm release workflow:

```bash
test -f .github/workflows/release.yml \
  && grep -q 'v\*\.\*\.\*' .github/workflows/release.yml \
  && grep -q 'Publish npm package' .github/workflows/release.yml
```

If the workflow is missing or does not look like the npm release workflow, stop and offer to install it before releasing. Read `../github-release-workflow/SKILL.md` relative to this `SKILL.md` file to understand how.

Do not create or push a release tag until the user confirms the workflow should be installed or confirms they want to proceed with their existing workflow.

## 1. Find the latest released version

Run:

```bash
git fetch --tags --force && git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n 1
```

Use the returned tag as the highest existing `vX.Y.Z` release tag. If there is no tag, say so and propose an initial version such as `v0.0.1`.

## 2. Choose the next semver version

Choose the next version from the user's requested changes:

- Patch (`vX.Y.Z+1`) for fixes, docs, small internal changes, or compatible improvements.
- Minor (`vX.Y+1.0`) for backward-compatible features.
- Major (`vX+1.0.0`) for breaking changes.
- Prerelease (`vX.Y.Z-alpha.1`, `vX.Y.Z-beta.1`, etc.) only when requested or clearly appropriate.

Explain the bump briefly.

## 3. Ask for confirmation

Before tagging, ask the user to confirm the exact next version:

```text
I propose releasing vX.Y.Z because <reason>. Should I create and push this tag?
```

Do not tag or push until the user confirms.

## 4. Create and push the tag

After confirmation, ensure you are on the intended branch and the working tree is clean or intentionally committed:

```bash
git status --short
git branch --show-current
```

Then create and push the matching tag. For the main branch:

```bash
git tag vX.Y.Z && git push origin main vX.Y.Z
```

If the repository uses another release branch, use that branch instead of `main` and state what you are doing.

## 5. Verify the release run succeeds

Use GitHub Actions to verify the release workflow triggered and completed successfully. Prefer the GitHub CLI when available:

```bash
gh run list --workflow release.yml --limit 10
gh run watch <run-id> --exit-status
```

Pick the run created by the pushed `vX.Y.Z` tag. If it fails, inspect the logs, summarize the failure, and fix only issues clearly in scope before retrying. If it succeeds, report the successful run and release version.
