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
 * ⛓ AND THE PAGE BLOCKS (rules-produced-blocks, 2026-10-15). The same pairing
 * holds a package's `_worldgen_flash_panel.json` / `_worldgen_region_atlas.json`
 * against the `flash_panel` / `region_atlas` slot blocks of its game's committed
 * documents (the handler re-injects them by presence, exactly like the sidecars).
 *
 * ⛓ AND EVERY COPY OF THE SEEDLING WIRING. `procgenPipeline/flashPanelWiring.json`
 * is the one source both producers read (`regionAtlasCompiler.js` and the
 * exporter's Seedling handler). Every committed `flash_panel` block, in a preset
 * or in a package file, whose `config` names a wired game's config must EQUAL that
 * game's wiring; so a build bump that misses a copy is red by name. A block whose
 * config no wiring entry names is listed as hand-kept (today only
 * `robotkitty_tilemap`'s: no Robot Wants Kitty world exists here to produce it).
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
export const WIRING_FILE = 'frontend/modules/procgenPipeline/flashPanelWiring.json';
const PRESETS = 'frontend/presets';

/** Each package file the export handler re-injects, and the per-player rules.json key it lands under. */
export const PACKAGE_FILES = Object.freeze([
    Object.freeze({ key: 'preset_sidecars', file: SIDECARS }),
    Object.freeze({ key: 'flash_panel', file: '_worldgen_flash_panel.json' }),
    Object.freeze({ key: 'region_atlas', file: '_worldgen_region_atlas.json' }),
]);

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
 * The pairs to compare for one package file (`key` in the documents, `file` in the
 * package; the sidecars by default): `[{pkg, game, doc, slot, key, file,
 * packageBlock, presetBlock}]`, plus the packages no committed document carries
 * that key for.
 */
export function pairings({ repo = REPO, key = 'preset_sidecars', file = SIDECARS } = {}) {
    const worlds = path.join(repo, 'worlds');
    const packages = new Map();                     // game → {pkg, block}
    for (const pkg of fs.readdirSync(worlds).sort()) {
        const side = path.join(worlds, pkg, file);
        const manifest = path.join(worlds, pkg, 'archipelago.json');
        if (!fs.existsSync(side) || !fs.existsSync(manifest)) continue;
        const game = JSON.parse(fs.readFileSync(manifest, 'utf8')).game;
        packages.set(game, { pkg, block: JSON.parse(fs.readFileSync(side, 'utf8')) });
    }
    const index = JSON.parse(fs.readFileSync(path.join(repo, INDEX), 'utf8'));
    const pairs = [];
    for (const [gameDir, entry] of Object.entries(index)) {
        for (const [folder, meta] of Object.entries(entry?.folders ?? {})) {
            for (const player of meta?.games ?? []) {
                const p = packages.get(player?.game);
                if (!p) continue;
                for (const name of meta.files ?? []) {
                    if (!name.endsWith('_rules.json')) continue;
                    const rel = `frontend/presets/${gameDir}/${folder}/${name}`;
                    if (!fs.existsSync(path.join(repo, rel))) continue;
                    const doc = JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8'));
                    const slot = String(player.player);
                    const presetBlock = doc?.[key]?.[slot];
                    if (presetBlock === undefined) continue;
                    pairs.push({ pkg: p.pkg, game: player.game, doc: rel, slot, key, file,
                        packageBlock: p.block, presetBlock });
                }
            }
        }
    }
    const covered = new Set(pairs.map((x) => x.pkg));
    const uncovered = [...packages.values()].map((p) => p.pkg).filter((pkg) => !covered.has(pkg));
    return { pairs, uncovered };
}

/** Every committed `*_rules.json` under `frontend/presets/`, repo-relative and sorted. */
function presetDocuments(repo) {
    const out = [];
    const walk = (rel) => {
        for (const ent of fs.readdirSync(path.join(repo, rel), { withFileTypes: true })) {
            const child = `${rel}/${ent.name}`;
            if (ent.isDirectory()) walk(child);
            else if (ent.name.endsWith('_rules.json')) out.push(child);
        }
    };
    walk(PRESETS);
    return out.sort();
}

/**
 * Every committed copy of a `flash_panel` block, sorted into the copies of a
 * wired game (`{where, slot, game, block, wiring}`, `slot` null for a package
 * file) and the hand-kept ones no wiring entry names (`{where, slot, block}`).
 * `missing` lists the wired games no copy was found for (a vacuous pass).
 */
export function wiringCopies({ repo = REPO } = {}) {
    const wiring = JSON.parse(fs.readFileSync(path.join(repo, WIRING_FILE), 'utf8'));
    const gameOfConfig = new Map(Object.entries(wiring).map(([game, w]) => [w.config, game]));
    const copies = [];
    const handKept = [];
    const sort = (where, slot, block) => {
        const game = gameOfConfig.get(block?.config);
        if (game === undefined) handKept.push({ where, slot, block });
        else copies.push({ where, slot, game, block, wiring: wiring[game] });
    };
    for (const rel of presetDocuments(repo)) {
        const text = fs.readFileSync(path.join(repo, rel), 'utf8');
        if (!text.includes('"flash_panel"')) continue;
        for (const [slot, block] of Object.entries(JSON.parse(text).flash_panel ?? {})) sort(rel, slot, block);
    }
    const worlds = path.join(repo, 'worlds');
    for (const pkg of fs.readdirSync(worlds).sort()) {
        const rel = `worlds/${pkg}/_worldgen_flash_panel.json`;
        if (fs.existsSync(path.join(repo, rel))) sort(rel, null, JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8')));
    }
    const seen = new Set(copies.map((c) => c.game));
    return { copies, handKept, missing: Object.keys(wiring).filter((g) => !seen.has(g)) };
}

function main() {
    let failures = 0;
    for (const { key, file } of PACKAGE_FILES) {
        console.log(`── ${file} ≡ the committed documents' \`${key}\` slot blocks`);
        const { pairs, uncovered } = pairings({ key, file });
        for (const x of pairs) {
            const d = firstDifference(x.presetBlock, x.packageBlock);
            if (!d) {
                console.log(checkLine(true, `${x.pkg} ≡ ${x.doc} slot ${x.slot}`));
                continue;
            }
            failures++;
            console.log(checkLine(false, `${x.pkg}/${file} ≠ ${x.doc} slot ${x.slot}: ${d}`));
        }
        for (const pkg of uncovered) {
            console.log(`  (not compared: ${pkg} — no committed document carries ${key} for its game)`);
        }
        if (pairs.length === 0) {
            failures++;
            console.log(checkLine(false, `no package/preset pair found for ${file} — the pairing rule no longer matches the tree`));
        }
    }
    console.log(`── every committed flash_panel copy of a wired game ≡ ${WIRING_FILE}`);
    const { copies, handKept, missing } = wiringCopies();
    for (const c of copies) {
        const where = c.slot === null ? c.where : `${c.where} slot ${c.slot}`;
        const d = firstDifference(c.block, c.wiring);
        if (!d) {
            console.log(checkLine(true, `${where} ≡ wiring.${c.game}`));
            continue;
        }
        failures++;
        console.log(checkLine(false, `${where} ≠ wiring.${c.game}: ${d.replace('only in the package', 'only in the wiring')}`));
    }
    for (const game of missing) {
        failures++;
        console.log(checkLine(false, `wiring.${game}: no committed copy found — the copy rule no longer matches the tree`));
    }
    for (const h of handKept) {
        console.log(`  (hand-kept, no producer: ${h.where}${h.slot === null ? '' : ` slot ${h.slot}`} config ${h.block?.config})`);
    }
    console.log(totalLine(failures));
    if (failures) {
        console.log('A differing package pair means a Generate.py re-record would NOT reproduce the committed preset: sync'
            + ' the package file with the preset (or re-record the preset from the package). A differing wiring copy'
            + ` means a copy was not moved with ${WIRING_FILE}: regenerate it through its producer.`);
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
