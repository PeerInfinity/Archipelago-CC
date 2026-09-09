#!/usr/bin/env node
/**
 * check-canonical-placements — **NO COMMITTED PRESET NAMES A PLACEMENT ITS OWN
 * WORLD CANNOT MAKE** (APWorld coverage slice P1; W3 §10.7 (2); ⚖ user
 * 2026-09-09: *"We can go ahead and implement placement validation if it's
 * easy."*).
 *
 * ── ⛔ WHY A SCRIPT AND NOT A SCHEMA RULE ─────────────────────────────
 *
 * `canonical_placements[<slot>]` is a flat `location name -> item name` map and
 * the schema declares that slot `additionalProperties: true`. It has to: the
 * keys are the world's own location names, so the only way to state the rule is
 * as a CROSS-REFERENCE against two other blocks of the same document
 * (`regions[<slot>]` and `items[<slot>]`), and a JSON schema cannot assert one.
 * `test_schema_validation.py` therefore passes a document carrying
 * `{"Nowhere": "Nothing"}`, and so does the hub's schema veto. This gate is
 * where that rule lives instead.
 *
 * ── ⛓ WHAT IT ASKS, AND OF WHOSE PREDICATE ───────────────────────────
 *
 * `canonicalPlacementIssuesByPlayer` from
 * `frontend/modules/apworldEditor/rulesDocOps.js` — the SAME function the
 * `set-canonical-placement` op selects its three refusals from and the
 * Placements tab marks its rows from. That module is pure and node-importable
 * (no DOM, no panel, no event bus), which is the whole reason the shared
 * predicate lives there: a corpus gate with its own copy of "is this entry
 * writable" would agree with the editor until the day one of them learned about
 * a new container.
 *
 * ── ⚠ WHY IT IS WORTH RUNNING OVER A CORPUS THAT IS CLEAN TODAY ──────
 *
 * MEASURED at the slice's HEAD: every preset on disk passes. The condition is
 * nonetheless one the tree can now CREATE — the Placements tab lets a person
 * place an item and the Regions tab lets them delete the location afterwards —
 * and MEASURED on a hand-staled copy in a scratchpad, `python -m
 * world_generator ... --canonical-seed 1` accepts a stale entry and copies it
 * verbatim into the generated world's `canonical_placements` ClassVar. The
 * failure only surfaces at SEED generation, inside
 * `_place_original_items`, where `multiworld.get_location(name, player)` is
 * `regions.location_cache[player][name]` and `create_item(name)` is
 * `item_table[name]` — two raw dict lookups, i.e. a `KeyError` a long way from
 * the byte that caused it.
 *
 * ── ⛓ THE POPULATION IS THE GLOB, AND THE GLOB IS PRINTED ────────────
 *
 * Every `_rules.json` under `frontend/presets/<preset>/AP_<seed>/` on disk, and each
 * slot that document's own `canonical_placements` block carries. ⛔ The count is not
 * typed anywhere: a working tree can hold untracked fixture presets that CI's
 * checkout does not, so a pinned number would be a number that is right on one
 * box.
 *
 * Run:
 *   node scripts/procgen/check-canonical-placements.mjs
 *   node scripts/procgen/check-canonical-placements.mjs --json
 *   node scripts/procgen/check-canonical-placements.mjs --tree=<path>
 *
 * Pure node: no dev server, no browser, no `--host`. Exit 1 on any finding.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    canonicalPlacementIssuesByPlayer, describePlacementIssue,
} from '../../frontend/modules/apworldEditor/rulesDocOps.js';
import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.slice(n.length + 3) : null;
};
const JSON_OUT = argv.includes('--json');
/**
 * ⛔⛔ **THE TREE FLAG IS `tree`, AND THE OTHER SPELLING IS RESERVED —
 * MEASURED, and it would have RED-ded CI.** In this directory the r-o-o-t flag
 * means a PAGES-SHAPED URL: `gateRoster.js` reads it off a gate's source and
 * `argvFor(gate, 'local')` then hands that gate an ORIGIN with `/frontend` on
 * the end. This gate reads the FILESYSTEM, so under that spelling CI would have
 * run it against a path that is a URL, failed its very first `readdirSync`, and
 * exited 1 on a corpus that is clean. Measured at this HEAD with
 * `ciGateArms({set:'headless'})`, which printed exactly that argv for this file
 * while the flag was still spelled the reserved way.
 *
 * ⚠ AND THE DETECTOR DOES NOT MASK COMMENTS. `gateRoster.js`'s `readsFlag` is a
 * regex over the raw source, so a docblock QUOTING the reserved parse
 * expression enrols the flag exactly as the code would have — measured here,
 * because the first draft of this very paragraph did it. Named, not spelled.
 */
const ROOT = arg('tree') ?? join(HERE, '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');

/**
 * ⛓ The documents, DERIVED — every `_rules.json` under
 * `frontend/presets/<preset>/AP_<seed>/`.
 * ⛔ Two levels of `readdirSync` rather than a glob library, because the four
 * multiworld presets carry `AP_<id>_P<n>_rules.json` and a pattern keyed on
 * `AP_<id>_rules.json` would silently read three of every four fewer.
 */
function documents() {
    const out = [];
    let presets = [];
    try {
        presets = readdirSync(PRESETS, { withFileTypes: true })
            .filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch (err) {
        console.error(`check-canonical-placements: cannot read ${PRESETS} — ${err.message}`);
        process.exit(1);
    }
    for (const preset of presets) {
        const dir = join(PRESETS, preset);
        for (const seed of readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && e.name.startsWith('AP_'))
            .map((e) => e.name).sort()) {
            const seedDir = join(dir, seed);
            for (const f of readdirSync(seedDir).sort()) {
                if (!f.endsWith('_rules.json')) continue;
                const p = join(seedDir, f);
                if (statSync(p).isFile()) out.push(p);
            }
        }
    }
    return out;
}

const files = documents();
const findings = [];
const unreadable = [];
let slots = 0;

for (const file of files) {
    let doc;
    try {
        doc = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
        unreadable.push({ file: relative(ROOT, file), error: err.message });
        continue;
    }
    const block = doc?.canonical_placements;
    if (block && typeof block === 'object' && !Array.isArray(block)) {
        slots += Object.keys(block).length;
    }
    for (const issue of canonicalPlacementIssuesByPlayer(doc)) {
        findings.push({ file: relative(ROOT, file), ...issue });
    }
}

if (JSON_OUT) {
    console.log(JSON.stringify({ documents: files.length, slots, findings, unreadable }, null, 2));
} else {
    console.log('check-canonical-placements — every placement a preset names, against the '
        + 'regions and items the same slot holds');
    console.log(`  documents read   ${files.length}`);
    console.log(`  placement slots  ${slots}`);
    for (const f of unreadable) console.log(`  UNREADABLE  ${f.file} — ${f.error}`);
    for (const f of findings) {
        console.log(`  FINDING  ${f.file}  slot ${f.player}  ${describePlacementIssue(f)}`);
    }
    const bad = findings.length + unreadable.length;
    console.log(bad === 0
        ? '  ALL PASS'
        : `  ${bad} FINDING${bad === 1 ? '' : 'S'}`);
}

process.exit(findings.length + unreadable.length > 0 ? 1 : 0);
