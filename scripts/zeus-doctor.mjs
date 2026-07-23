#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const cwd = process.cwd();
const cmd = (c, a = []) => {
  const r = spawnSync(c, a, { cwd, encoding: 'utf8' });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
};
const git = cmd('git', ['rev-parse', '--show-toplevel']);
const root = git.ok ? git.stdout : cwd;
const g = (...a) => cmd('git', ['-C', root, ...a]);
let pkg = {};
if (existsSync(join(root, 'package.json')))
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {}
const packageManager = existsSync(join(root, 'pnpm-lock.yaml'))
  ? 'pnpm'
  : existsSync(join(root, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(root, 'package-lock.json'))
      ? 'npm'
      : (pkg.packageManager ?? 'unknown');
const workflowDir = join(root, '.github', 'workflows');
const workflows = existsSync(workflowDir)
  ? readdirSync(workflowDir).filter((x) => /\.ya?ml$/i.test(x))
  : [];
const deployFiles = [
  'vercel.json',
  'netlify.toml',
  'fly.toml',
  'render.yaml',
  'render.yml',
  'Dockerfile',
  'docker-compose.yml',
  'kustomization.yaml',
].filter((x) => existsSync(join(root, x)));
const remoteRaw = g('remote', 'get-url', 'origin').stdout || null;
const remote = remoteRaw ? remoteRaw.replace(/(https?:\/\/)[^@\s]+@/, '$1***@') : null;
const report = {
  root,
  isGit: git.ok,
  branch: g('branch', '--show-current').stdout || null,
  head: g('rev-parse', 'HEAD').stdout || null,
  dirty: g('status', '--porcelain').stdout.split('\n').filter(Boolean),
  remote,
  node: process.version,
  packageManager,
  scripts: pkg.scripts ?? {},
  workflows,
  deployFiles,
  ghAvailable: cmd('gh', ['--version']).ok,
};
console.log(JSON.stringify(report, null, 2));
