---
name: github-release-workflow
description: Add a GitHub Actions release workflow to a Node/npm or pi package repository. Use when the user wants a semver-tagged release workflow that packs a package, publishes to npm and GitHub Packages, creates a GitHub Release, or updates a latest tag.
---

# GitHub Release Workflow

Use this skill when a user wants to add a GitHub Actions release workflow to a package repository.

## What to collect

Before running the script, identify:

- Target repository path.
- GitHub Packages npm scope, for example `@micka33` (required).
- Package manager: `npm` or `pnpm` (defaults to the target `package.json` `packageManager` when it is `npm`/`pnpm`, otherwise `npm`).
- Whether CI should run before packing/publishing. If yes, use `--run-ci` or pass an exact `--ci-command`.

## Add the workflow

Resolve the script path relative to this `SKILL.md` file, not relative to the user's project. The script copies `../../templates/release.yml` into the target repository as `.github/workflows/release.yml` and interpolates the template.

Basic usage:

```bash
node /path/to/pi-version-release-skill/scripts/add-release-workflow.mjs \
  --repo /path/to/repository \
  --github-package-scope @micka33
```

With pnpm and a CI step:

```bash
node /path/to/pi-version-release-skill/scripts/add-release-workflow.mjs \
  --repo /path/to/repository \
  --github-package-scope @micka33 \
  --package-manager pnpm \
  --run-ci
```

Useful options:

- `--package-manager npm|pnpm` controls setup-node cache plus install/version/pack commands.
- `--run-ci` adds dependency install and default CI steps before packing (`npm run ci` or `pnpm run ci`).
- `--ci-command "<command>"` adds dependency install and runs a custom CI command before packing.
- `--install-command "<command>"` overrides the install command used with CI.
- `--pnpm-version <version>` sets the version for `pnpm/action-setup` when using pnpm.
- `--force` overwrites an existing `.github/workflows/release.yml`, ask the user for confirmation.

## After adding it

Tell the user to review and commit the generated workflow. The workflow expects:

- A `package.json` in the target repository.
- Semver tags named like `v1.2.3`.
- A GitHub secret named `NPM_ACCESS_TOKEN` for npm publishing.
- A `.node-version` file, because the template uses `node-version-file: ".node-version"`.
