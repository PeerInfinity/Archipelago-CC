#!/usr/bin/env node
/**
 * The file list the browser fetches to run `world_generator` under Pyodide
 * (frontend/modules/apworldBuild/apworldBuild.js).
 *
 * A static site cannot list a directory, so the page needs the list handed to
 * it. It is DERIVED here from `git ls-files world_generator` and committed as
 * frontend/modules/apworldBuild/worldGeneratorFiles.json; the committed copy
 * is a cache, and `worldGeneratorFiles.test.js` fails when it no longer
 * matches the tracked tree.
 *
 *   node scripts/build/world-generator-files.mjs           # check (exit 1 if stale)
 *   node scripts/build/world-generator-files.mjs --write   # regenerate
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PACKAGE_DIR = 'world_generator';
export const MANIFEST_PATH = 'frontend/modules/apworldBuild/worldGeneratorFiles.json';

/** Tracked files of the package, relative to it, sorted. */
export function trackedPackageFiles(repoRoot = REPO_ROOT) {
    const out = execFileSync('git', ['ls-files', '-z', '--', PACKAGE_DIR], { cwd: repoRoot });
    return out.toString('utf8').split('\0').filter(Boolean)
        .map(p => p.slice(PACKAGE_DIR.length + 1))
        .sort();
}

export function manifestText(files) {
    return JSON.stringify({
        _generated: 'node scripts/build/world-generator-files.mjs --write — do not edit by hand',
        package: PACKAGE_DIR,
        files,
    }, null, 2) + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const want = manifestText(trackedPackageFiles());
    const target = path.join(REPO_ROOT, MANIFEST_PATH);
    if (process.argv.includes('--write')) {
        fs.writeFileSync(target, want);
        console.log(`wrote ${MANIFEST_PATH}`);
    } else {
        const have = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        if (have !== want) {
            console.error(`${MANIFEST_PATH} is stale — run: node scripts/build/world-generator-files.mjs --write`);
            process.exit(1);
        }
        console.log(`${MANIFEST_PATH} is current`);
    }
}
