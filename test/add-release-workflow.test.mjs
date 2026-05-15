import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repoRoot, 'scripts', 'add-release-workflow.mjs');
const exampleDir = path.join(repoRoot, 'test', 'example');

async function generateWorkflow({ packageJson, args = [] }) {
  const repoPath = await mkdtemp(path.join(tmpdir(), 'pi-release-workflow-test-'));

  try {
    await writeFile(
      path.join(repoPath, 'package.json'),
      `${JSON.stringify(packageJson, null, 2)}\n`,
      'utf8',
    );

    await execFileAsync(process.execPath, [scriptPath, '--repo', repoPath, ...args]);

    return await readFile(path.join(repoPath, '.github', 'workflows', 'release.yml'), 'utf8');
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

async function readExample(name) {
  return await readFile(path.join(exampleDir, name), 'utf8');
}

test('generates the default npm release workflow', async () => {
  const actual = await generateWorkflow({
    packageJson: {
      name: '@micka33/demo-package',
      version: '0.0.0',
    },
    args: ['--github-package-scope', '@micka33'],
  });

  assert.equal(actual, await readExample('release-npm.yml'));
});

test('generates a pnpm release workflow with CI enabled', async () => {
  const actual = await generateWorkflow({
    packageJson: {
      name: '@micka33/demo-package',
      version: '0.0.0',
      packageManager: 'pnpm@10.10.0',
    },
    args: ['--github-package-scope', '@micka33', '--run-ci'],
  });

  assert.equal(actual, await readExample('release-pnpm-ci.yml'));
});

test('generates a workflow with custom install and CI commands', async () => {
  const actual = await generateWorkflow({
    packageJson: {
      name: '@example/custom-package',
      version: '0.0.0',
    },
    args: [
      '--github-package-scope',
      '@example',
      '--ci-command',
      'npm run typecheck && npm test',
      '--install-command',
      'npm install --ignore-scripts',
    ],
  });

  assert.equal(actual, await readExample('release-npm-custom-ci-install.yml'));
});
