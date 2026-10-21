#!/usr/bin/env node
/**
 * The exporter files the browser fetches to run `exporter.script_api` (Python
 * source <-> the rules.json `helpers` format) under Pyodide. The JSON -> Python
 * half also needs `world_generator/`, which has its own manifest
 * (scripts/build/world-generator-files.mjs).
 *
 * Only a SUBSET of `exporter/` is served: the analyzer and what it imports. It
 * must stay importable with nothing but the standard library —
 * test/test_exporter_script_api.py copies exactly these files and runs the
 * round trip under `python -I -S`. Leaving out `games/official/` and
 * `games/unofficial/` is deliberate: `exporter/games/__init__.py` discovers
 * handlers there at import time (importing worlds), and skips a missing
 * directory.
 *
 * Derived from `git ls-files` and committed as
 * frontend/modules/helperScript/helperScriptFiles.json; the committed copy is a
 * cache, and frontend/modules/helperScript/helperScriptFiles.test.js fails when
 * it is stale.
 *
 *   node scripts/build/helper-script-files.mjs           # check (exit 1 if stale)
 *   node scripts/build/helper-script-files.mjs --write   # regenerate
 *   node scripts/build/helper-script-files.mjs --stage frontend/exporter
 *       # copy exactly the committed manifest's files there (deploy-gh-pages.yml)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PACKAGE_DIR = 'exporter';
export const MANIFEST_PATH = 'frontend/modules/helperScript/helperScriptFiles.json';

/** Paths inside `exporter/`: a file, or a directory (ending `/`) taken whole. */
export const INCLUDE = [
    '__init__.py',
    'constants.py',
    'foreign_rule_builder.py',
    'profiling.py',
    'script_api.py',
    'analyzer/',
    'games/__init__.py',
    'games/base/',
];

const isTestFile = rel => /(^|\/)test_[^/]*\.py$/.test(rel);

/** The tracked files the manifest lists, relative to the package, sorted. */
export function trackedPackageFiles(repoRoot = REPO_ROOT) {
    const out = execFileSync('git', ['ls-files', '-z', '--', PACKAGE_DIR], { cwd: repoRoot });
    return out.toString('utf8').split('\0').filter(Boolean)
        .map(p => p.slice(PACKAGE_DIR.length + 1))
        .filter(rel => rel.endsWith('.py') && !isTestFile(rel))
        .filter(rel => INCLUDE.some(inc => (inc.endsWith('/') ? rel.startsWith(inc) : rel === inc)))
        .sort();
}

export function manifestText(files) {
    return JSON.stringify({
        _generated: 'node scripts/build/helper-script-files.mjs --write — do not edit by hand',
        package: PACKAGE_DIR,
        files,
    }, null, 2) + '\n';
}

/**
 * Copy the files the COMMITTED manifest lists from `exporter/` into `destDir`
 * (repo-relative or absolute). Returns the number copied.
 */
export function stageFiles(destDir, repoRoot = REPO_ROOT) {
    const { files } = JSON.parse(fs.readFileSync(path.join(repoRoot, MANIFEST_PATH), 'utf8'));
    const dest = path.resolve(repoRoot, destDir);
    for (const rel of files) {
        const target = path.join(dest, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(repoRoot, PACKAGE_DIR, rel), target);
    }
    return files.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const stageAt = process.argv.indexOf('--stage');
    if (stageAt !== -1) {
        const destDir = process.argv[stageAt + 1];
        if (!destDir) {
            console.error('--stage needs a destination directory');
            process.exit(2);
        }
        console.log(`staged ${stageFiles(destDir)} files into ${destDir}`);
        process.exit(0);
    }
    const want = manifestText(trackedPackageFiles());
    const target = path.join(REPO_ROOT, MANIFEST_PATH);
    if (process.argv.includes('--write')) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, want);
        console.log(`wrote ${MANIFEST_PATH}`);
    } else {
        const have = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        if (have !== want) {
            console.error(`${MANIFEST_PATH} is stale — run: node scripts/build/helper-script-files.mjs --write`);
            process.exit(1);
        }
        console.log(`${MANIFEST_PATH} is current`);
    }
}
