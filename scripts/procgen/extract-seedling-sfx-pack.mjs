#!/usr/bin/env node
// Seedling sfx-pack extractor — copies the sound effects `src/Music.as` names
// out of a Seedling source checkout into the committed seedling CONTENT PACK's
// `sfx` layer (`frontend/packs/seedling/sfx/`), and writes its manifest.
//
// Seedling JS sound effects (⚖ the user 2026-10-26). The layer is BUILT by
// `seedlingSfxLayer.mjs` (which says what went where, and why); this is its
// CLI. The pack's `pack.json` is owned by `extract-seedling-art-packs.mjs`,
// which builds the same layer from the same module, so the two scripts write
// the same bytes and `--check` here is the sfx slice of the art script's.
//
// Usage:
//   node scripts/procgen/extract-seedling-sfx-pack.mjs
//   node scripts/procgen/extract-seedling-sfx-pack.mjs --check
//   node scripts/procgen/extract-seedling-sfx-pack.mjs --source <seedling-checkout> [--check]
//
// The source is the `vendor/seedling` submodule unless `--source` names another
// checkout; an uninitialised submodule is a refusal by name (`seedlingSource.js`).
//
// --check re-extracts IN MEMORY and compares the seedling pack's `pack.json`,
// the sfx manifest, every clip's bytes and every file under `sfx/` WITHOUT
// writing; exit 1 names each drifted, missing or stray file.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { argvHelp } from './argvHelp.js';
import { seedlingSourceOrExit } from './seedlingSource.js';
import { PACKS_DIR, buildPacks, packDrift } from './extract-seedling-art-packs.mjs';

argvHelp(import.meta.url);

/** The pack the layer lives in. */
export const SFX_PACK = 'seedling';

/** The seedling pack's files that are this layer's business: `pack.json` and everything under `sfx/`. */
export const isSfxFile = (rel) => rel === 'pack.json' || rel.startsWith('sfx/');

/** The sfx slice of the art script's drift: named lines, [] = identical. */
export function sfxDrift(built, packsDir = PACKS_DIR) {
    const only = { [SFX_PACK]: new Map([...built[SFX_PACK]].filter(([rel]) => isSfxFile(rel))) };
    return packDrift(only, packsDir).filter((line) => {
        const rel = line.slice(`${SFX_PACK}/`.length).replace(/: (MISSING|DIFFERS|STRAY).*$/, '');
        return line.startsWith('frontend/packs/packs.json') || isSfxFile(rel);
    });
}

function main() {
    const argv = process.argv.slice(2);
    const arg = (name, fallback) => {
        const i = argv.indexOf(name);
        return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
    };
    const source = seedlingSourceOrExit(arg('--source'), { tool: 'extract-seedling-sfx-pack.mjs' });
    const built = buildPacks(source);
    const files = [...built[SFX_PACK]].filter(([rel]) => isSfxFile(rel));
    const manifest = JSON.parse(built[SFX_PACK].get('sfx/manifest.json'));
    const counts = `${Object.keys(manifest.sounds).length} sounds, ${Object.keys(manifest.clips).length} clips, ${manifest.bytes} bytes`;
    if (argv.includes('--check')) {
        const problems = sfxDrift(built);
        if (problems.length) {
            console.error(`--check FAILED: ${problems.length} file(s) drifted from a fresh extract of ${source}:`);
            for (const p of problems) console.error(`  ${p}`);
            console.error('Regenerate with: node scripts/procgen/extract-seedling-sfx-pack.mjs');
            process.exit(1);
        }
        console.log(`--check OK: ${SFX_PACK}/sfx: ${counts} — byte-identical, no stray files`);
        return;
    }
    const root = join(PACKS_DIR, SFX_PACK);
    rmSync(join(root, 'sfx'), { recursive: true, force: true });
    for (const [rel, data] of files) {
        const path = join(root, rel);
        mkdirSync(join(path, '..'), { recursive: true });
        writeFileSync(path, data);
    }
    console.log(`wrote ${relative(process.cwd(), root)}: ${counts}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
