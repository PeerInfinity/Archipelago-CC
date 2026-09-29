#!/usr/bin/env node
/**
 * check-worldgen-package-sidecars — **DOES EVERY WORLDGEN PACKAGE CARRY THE
 * SIDECARS ITS COMMITTED PRESETS CARRY?**
 *
 * A worldgen package (`worlds/<pkg>/`) ships `_worldgen_sidecars.json`, and
 * `Generate.py` copies it into the `preset_sidecars[<slot>]` of every document
 * it writes for that package's game. When the committed presets are edited
 * without the package (the 2026-09-12 exit-tile strip, `3e13eec13c`), a
 * re-record by command silently re-adds what was removed — measured
 * 2026-09-29: +56 exit `x`/`y` values over four presets and three packages
 * (registration-order plan §8.1). This check catches that drift WITHOUT
 * running `Generate.py`: for each package with sidecars (its game read from its
 * `archipelago.json`), every committed rules document that
 * `frontend/presets/preset_files.json` lists for a slot of that game must carry
 * exactly the package's sidecars in that slot. A package no committed document
 * carries sidecars for is NAMED, never silently passed.
 *
 * Run:
 *   node scripts/procgen/check-worldgen-package-sidecars.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { checkLine, totalLine } from './gateTotal.js';

argvHelp(import.meta.url);

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIDECARS = '_worldgen_sidecars.json';
const INDEX = 'frontend/presets/preset_files.json';

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));

/** Structural equality with key order ignored (the exporter and a migration may order keys differently). */
export function sameJson(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]));
}

/** The first differing path between two JSON values (for the failure line), or null. */
export function firstDifference(a, b, at = '') {
    if (sameJson(a, b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
        const keys = Array.isArray(a) ? [...Array(Math.max(a.length, b.length)).keys()]
            : [...new Set([...Object.keys(a), ...Object.keys(b)])];
        for (const k of keys) {
            if (!(k in a)) return `${at}.${k} only in the package`;
            if (!(k in b)) return `${at}.${k} only in the preset`;
            const d = firstDifference(a[k], b[k], `${at}.${k}`);
            if (d) return d;
        }
    }
    return `${at || '(root)'} differs`;
}

/**
 * The pairs to compare: `[{pkg, game, doc, slot, packageSidecars, presetSidecars}]`,
 * plus the packages no committed document carries sidecars for.
 */
export function pairings({ repo = REPO } = {}) {
    const worlds = path.join(repo, 'worlds');
    const packages = new Map();                     // game → {pkg, sidecars}
    for (const pkg of fs.readdirSync(worlds).sort()) {
        const side = path.join(worlds, pkg, SIDECARS);
        const manifest = path.join(worlds, pkg, 'archipelago.json');
        if (!fs.existsSync(side) || !fs.existsSync(manifest)) continue;
        const game = JSON.parse(fs.readFileSync(manifest, 'utf8')).game;
        packages.set(game, { pkg, sidecars: JSON.parse(fs.readFileSync(side, 'utf8')) });
    }
    const index = JSON.parse(fs.readFileSync(path.join(repo, INDEX), 'utf8'));
    const pairs = [];
    for (const [gameDir, entry] of Object.entries(index)) {
        for (const [folder, meta] of Object.entries(entry?.folders ?? {})) {
            for (const player of meta?.games ?? []) {
                const p = packages.get(player?.game);
                if (!p) continue;
                for (const file of meta.files ?? []) {
                    if (!file.endsWith('_rules.json')) continue;
                    const rel = `frontend/presets/${gameDir}/${folder}/${file}`;
                    if (!fs.existsSync(path.join(repo, rel))) continue;
                    const doc = JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8'));
                    const slot = String(player.player);
                    const presetSidecars = doc?.preset_sidecars?.[slot];
                    if (presetSidecars === undefined) continue;
                    pairs.push({ pkg: p.pkg, game: player.game, doc: rel, slot,
                        packageSidecars: p.sidecars, presetSidecars });
                }
            }
        }
    }
    const covered = new Set(pairs.map((x) => x.pkg));
    const uncovered = [...packages.values()].map((p) => p.pkg).filter((pkg) => !covered.has(pkg));
    return { pairs, uncovered };
}

function main() {
    const { pairs, uncovered } = pairings();
    let failures = 0;
    for (const x of pairs) {
        const d = firstDifference(x.presetSidecars, x.packageSidecars);
        if (!d) {
            console.log(checkLine(true, `${x.pkg} ≡ ${x.doc} slot ${x.slot}`));
            continue;
        }
        failures++;
        console.log(checkLine(false, `${x.pkg}/${SIDECARS} ≠ ${x.doc} slot ${x.slot}: ${d}`));
    }
    for (const pkg of uncovered) {
        console.log(`  (not compared: ${pkg} — no committed document carries sidecars for its game)`);
    }
    if (pairs.length === 0) {
        failures++;
        console.log(checkLine(false, 'no package/preset pair found — the pairing rule no longer matches the tree'));
    }
    console.log(totalLine(failures));
    if (failures) {
        console.log('A differing pair means a Generate.py re-record would NOT reproduce the committed preset: sync the'
            + ' package\'s _worldgen_sidecars.json with the preset (or re-record the preset from the package).');
    }
    process.exit(failures ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) {
    try {
        main();
    } catch (err) {
        console.log(checkLine(false, `fatal: ${err.message}`));
        console.log(totalLine(1));
        process.exit(1);
    }
}
