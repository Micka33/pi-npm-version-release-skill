#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const DEFAULTS = {
  npm: {
    cache: 'npm',
    installCommand: 'npm ci',
    versionCommand: 'npm version --no-git-tag-version --allow-same-version',
    ciCommand: 'npm run ci',
    packCommand: 'npm pack --pack-destination release',
  },
  pnpm: {
    cache: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    versionCommand: 'pnpm version --no-git-tag-version --allow-same-version',
    ciCommand: 'pnpm run ci',
    packCommand: 'pnpm pack --pack-destination release',
  },
};

function usage() {
  return `Add a templated GitHub release workflow to a Node package repository.

Usage:
  node scripts/add-release-workflow.mjs --repo <repository> --github-package-scope <@scope> [options]

Required:
  --repo, -r <path>                 Target repository path. May also be passed as a positional argument.
  --github-package-scope <@scope>   GitHub Packages npm scope to write into actions/setup-node.
                                    Alias: --scope

Options:
  --package-manager, -p <npm|pnpm>  Package manager for cache/install/version/pack commands.
                                    Defaults to package.json packageManager when supported, otherwise npm.
  --run-ci                          Add install and CI steps before packing, using the default CI command.
  --ci-command <command>            Add install and CI steps before packing, using this CI command.
  --install-command <command>       Override the install command used with --run-ci or --ci-command.
  --pnpm-version <version>          pnpm version for pnpm/action-setup. Defaults to package.json packageManager or latest.
  --force, -f                       Overwrite .github/workflows/release.yml when it already exists.
  --help, -h                        Show this help.

Examples:
  node scripts/add-release-workflow.mjs --repo ../my-package --github-package-scope @micka33
  node scripts/add-release-workflow.mjs ../my-package --scope @micka33 --package-manager pnpm --run-ci
  node scripts/add-release-workflow.mjs --repo ../my-package --scope @micka33 --ci-command "npm run ci" --force
`;
}

function fail(message) {
  console.error(`Error: ${message}`);
  console.error('');
  console.error(usage());
  process.exit(1);
}

function readOptions() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        repo: { type: 'string', short: 'r' },
        'github-package-scope': { type: 'string' },
        scope: { type: 'string' },
        'package-manager': { type: 'string', short: 'p' },
        'run-ci': { type: 'boolean' },
        'ci-command': { type: 'string' },
        'install-command': { type: 'string' },
        'pnpm-version': { type: 'string' },
        force: { type: 'boolean', short: 'f' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    fail(error.message);
  }
}

function requireOneLine(value, optionName) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${optionName} cannot be empty.`);
  }

  if (/[\r\n]/.test(value)) {
    fail(`${optionName} must be a single-line value.`);
  }

  return value;
}

function normalizeScope(scope) {
  const value = requireOneLine(scope, '--github-package-scope').trim();

  if (!/^@[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    fail(`--github-package-scope must look like @owner or @org. Received: ${value}`);
  }

  return value;
}

function inferPackageManager(packageJson) {
  const packageManager = packageJson.packageManager;

  if (typeof packageManager !== 'string') {
    return 'npm';
  }

  if (packageManager.startsWith('pnpm@')) {
    return 'pnpm';
  }

  if (packageManager.startsWith('npm@')) {
    return 'npm';
  }

  return 'npm';
}

function inferPnpmVersion(packageJson) {
  const packageManager = packageJson.packageManager;

  if (typeof packageManager !== 'string' || !packageManager.startsWith('pnpm@')) {
    return 'latest';
  }

  const version = packageManager.slice('pnpm@'.length).split('+')[0];
  return version || 'latest';
}

function packageManagerSetupStep(packageManager, pnpmVersion) {
  if (packageManager !== 'pnpm') {
    return '';
  }

  return `      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: "${pnpmVersion}"
          run_install: false
`;
}

function installStep(command) {
  if (!command) {
    return '';
  }

  return `      - name: Install dependencies
        run: |
          ${command}
`;
}

function ciStep(command) {
  if (!command) {
    return '';
  }

  return `      - name: Run CI
        run: |
          ${command}
`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { values, positionals } = readOptions();

  if (values.help) {
    console.log(usage());
    return;
  }

  const repoInput = values.repo ?? positionals[0];
  if (!repoInput) {
    fail('Missing target repository path. Pass --repo <path>.');
  }

  const scopeInput = values['github-package-scope'] ?? values.scope;
  if (!scopeInput) {
    fail('Missing GitHub Packages scope. Pass --github-package-scope <@scope>.');
  }

  const repoPath = path.resolve(repoInput);
  const packageJsonPath = path.join(repoPath, 'package.json');

  if (!(await exists(packageJsonPath))) {
    fail(`Target repository must contain a package.json: ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const packageManager = (values['package-manager'] ?? inferPackageManager(packageJson)).toLowerCase();

  if (!Object.hasOwn(DEFAULTS, packageManager)) {
    fail(`Unsupported --package-manager "${packageManager}". Supported values: npm, pnpm.`);
  }

  const defaults = DEFAULTS[packageManager];
  const ciCommand = values['ci-command']
    ? requireOneLine(values['ci-command'], '--ci-command')
    : values['run-ci']
      ? defaults.ciCommand
      : '';

  const installCommand = ciCommand
    ? requireOneLine(values['install-command'] ?? defaults.installCommand, '--install-command')
    : '';

  const pnpmVersion = packageManager === 'pnpm'
    ? requireOneLine(values['pnpm-version'] ?? inferPnpmVersion(packageJson), '--pnpm-version')
    : '';

  const replacements = {
    __PACKAGE_MANAGER_SETUP_STEP__: packageManagerSetupStep(packageManager, pnpmVersion),
    __PACKAGE_MANAGER_CACHE__: defaults.cache,
    __INSTALL_DEPENDENCIES_STEP__: installStep(installCommand),
    __VERSION_COMMAND__: defaults.versionCommand,
    __CI_STEP__: ciStep(ciCommand),
    __PACK_COMMAND__: defaults.packCommand,
    __GITHUB_PACKAGE_SCOPE__: normalizeScope(scopeInput),
  };

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(scriptDir, '..', 'templates', 'release.yml');
  let workflow = await readFile(templatePath, 'utf8');

  for (const [placeholder, value] of Object.entries(replacements)) {
    workflow = workflow.replaceAll(placeholder, value);
  }

  const unresolved = workflow.match(/__[A-Z0-9_]+__/g);
  if (unresolved) {
    fail(`Template still contains unresolved placeholders: ${[...new Set(unresolved)].join(', ')}`);
  }

  const workflowDir = path.join(repoPath, '.github', 'workflows');
  const workflowPath = path.join(workflowDir, 'release.yml');

  if (!values.force && await exists(workflowPath)) {
    fail(`${workflowPath} already exists. Re-run with --force to overwrite it.`);
  }

  await mkdir(workflowDir, { recursive: true });
  await writeFile(workflowPath, workflow, 'utf8');

  console.log(`Wrote ${workflowPath}`);
  console.log(`Package manager: ${packageManager}`);
  console.log(`CI before pack: ${ciCommand ? ciCommand : 'disabled'}`);
  console.log('Next: ensure .node-version exists and add NPM_ACCESS_TOKEN as a GitHub secret before pushing a vX.Y.Z tag.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
