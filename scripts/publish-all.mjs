#!/usr/bin/env node
// Publishes the most recent windev-helper-*.vsix to both the
// Visual Studio Marketplace (via vsce) and the Open VSX Registry
// (via ovsx), in that order.
//
// Usage:
//   node scripts/publish-all.mjs                 # stable
//   node scripts/publish-all.mjs --pre-release   # prerelease
//
// Required environment variables:
//   VSCE_PAT  - Marketplace personal access token
//   OVSX_PAT  - Open VSX personal access token
//
// The script intentionally fails fast: if the Marketplace publish
// fails, Open VSX is skipped so the two registries don't drift out
// of sync.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isPrerelease = args.includes('--pre-release');

function findLatestVsix() {
    const candidates = readdirSync(repoRoot)
        .filter(name => name.startsWith('windev-helper-') && name.endsWith('.vsix'))
        .map(name => {
            const full = path.join(repoRoot, name);
            return { full, mtime: statSync(full).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

    if (candidates.length === 0) {
        console.error('No windev-helper-*.vsix found in repo root. Run `npm run package` first.');
        process.exit(1);
    }
    return candidates[0].full;
}

function requireEnv(name) {
    if (!process.env[name]) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
}

function run(label, command, commandArgs) {
    console.log(`\n--- ${label} ---`);
    console.log(`> ${command} ${commandArgs.join(' ')}`);
    const result = spawnSync(command, commandArgs, {
        stdio: 'inherit',
        cwd: repoRoot,
        shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
        console.error(`${label} failed with exit code ${result.status}.`);
        process.exit(result.status ?? 1);
    }
}

requireEnv('VSCE_PAT');
requireEnv('OVSX_PAT');

const vsix = findLatestVsix();
console.log(`Publishing ${path.basename(vsix)}${isPrerelease ? ' (pre-release)' : ''} to both registries.`);

const vsceArgs = ['vsce', 'publish', '--allow-star-activation', '--packagePath', vsix];
const ovsxArgs = ['ovsx', 'publish', vsix];
if (isPrerelease) {
    vsceArgs.splice(2, 0, '--pre-release');
    ovsxArgs.splice(2, 0, '--pre-release');
}

run('Visual Studio Marketplace (vsce)', 'npx', vsceArgs);
run('Open VSX Registry (ovsx)', 'npx', ovsxArgs);

console.log('\nPublished to both registries successfully.');
