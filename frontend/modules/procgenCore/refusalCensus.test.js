/**
 * procgenCore/refusalCensus — **EVERY REFUSAL CENSUS KEY COVERS THE SCAN OF
 * ITS OWN SOURCE** (PROCGEN DOCS · P5, work-list items 1 and 2).
 *
 * ⛔⛔ **THIS GATE EXISTS BECAUSE THE GENERATOR CANNOT BE ONE.** The reference
 * page's refusal table (`procgenDocs/generated/refusals.js`) scans these files
 * for refusal names and compares what it finds with what each constant
 * declares — and when the two disagreed it PRINTED A FINDING, because a
 * generator that edited the code it reads would be describing itself. It found
 * `the-tunnel-shortens-the-way-to-the-goal` firing in
 * `procgenSeedlingElements.js` and missing from `SEEDLING_ELEMENT_REFUSALS`,
 * whose own docblock said it named *every* refusal that path can produce. The
 * finding sat on the page for two slices. This file is that finding turned into
 * a GATE, and it lives beside the code so the next hole reds a test rather than
 * growing a table row.
 *
 * ── ⛔ IT IS NOT A FIXED POINT ─────────────────────────────────────────
 *
 * A row that asked the generator whether the generator agreed with itself would
 * pass forever (trap 250). So this file imports the generator's PATTERNS — the
 * regexes, which are data — and runs them itself over the source TEXT, then
 * compares with the constant imported from its home module. Nothing generated
 * is read.
 *
 * ── THE DIRECTION ─────────────────────────────────────────────────────
 *
 * `constant ⊇ scan` — a name the scan finds must be declared. The other
 * direction is deliberately NOT asserted here: three of
 * `SEEDLING_ELEMENT_REFUSALS`' names are raised one module over (its axis is
 * the element PATH, not this file) and the generated table publishes those as
 * `REFUSALS.spans`. What IS asserted for every list is that it declares nothing
 * that no scanned source raises anywhere — a dead name in a census key makes
 * the census wrong in the other direction.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    REFUSAL_LITERAL_RE, REFUSAL_TEMPLATE_RE, REASON_TABLE_RE,
} from '../../../scripts/procgen/reference/refusals.mjs';

import { REASONS } from './areaGraph.js';
import { REQUIRE_DIRECTIVE_REFUSALS } from './elementSpec.js';
import { URL_PARAM_REFUSALS } from './urlParams.js';
import { KILL_GATE_REFUSALS } from './elements/killGate.js';
import { BLOCK_POCKET_REFUSALS } from './elements/blockPocket.js';
import { OPEN_CHAMBER_REFUSALS } from './elements/openChamber.js';
import { ARENA_REFUSALS } from './elements/arena.js';
import { SHORTCUT_REFUSALS } from './elements/shortcut.js';
import { ROOM_DOOR_REFUSALS } from './elements/roomDoor.js';
import { SEEDLING_ELEMENT_REFUSALS } from '../seedlingDemo/procgenSeedlingElements.js';
import { SEEDLING_AREA_REFUSALS } from '../seedlingDemo/procgenSeedling.js';
import { MAZE_REFUSALS, MAZE_REQUIRE_REFUSALS } from '../mazeRoom/procgenMaze.js';

const ROOT = join(import.meta.dirname, '../../..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/** Every name a pattern finds in `text`, with a run-time half elided the way
 *  the generator elides it. */
function scan(text, patterns = [REFUSAL_LITERAL_RE]) {
    const out = new Set();
    for (const re of [...patterns, REFUSAL_TEMPLATE_RE]) {
        const r = new RegExp(re.source, re.flags);
        let m = r.exec(text);
        while (m) { out.add(m[1].replace(/\$\{[^}]*\}/g, '…').trim()); m = r.exec(text); }
    }
    return out;
}

/** The body of a `^…` declaration, to its matching closing line — the same
 *  region shape the generator uses, cut here rather than imported. */
function regionFrom(text, startRe) {
    const lines = text.split('\n');
    const at = lines.findIndex((l) => startRe.test(l));
    expect(at, `region ${startRe} is not in the file`).toBeGreaterThanOrEqual(0);
    let depth = 0;
    const out = [];
    for (let i = at; i < lines.length; i += 1) {
        out.push(lines[i]);
        for (const ch of lines[i]) {
            if (ch === '{' || ch === '(') depth += 1;
            if (ch === '}' || ch === ')') depth -= 1;
        }
        if (i > at && depth <= 0) break;
    }
    return out.join('\n');
}

const SOURCES = {
    killGate: 'frontend/modules/procgenCore/elements/killGate.js',
    blockPocket: 'frontend/modules/procgenCore/elements/blockPocket.js',
    openChamber: 'frontend/modules/procgenCore/elements/openChamber.js',
    arena: 'frontend/modules/procgenCore/elements/arena.js',
    shortcut: 'frontend/modules/procgenCore/elements/shortcut.js',
    roomDoor: 'frontend/modules/procgenCore/elements/roomDoor.js',
    seedlingElements: 'frontend/modules/seedlingDemo/procgenSeedlingElements.js',
    seedling: 'frontend/modules/seedlingDemo/procgenSeedling.js',
    maze: 'frontend/modules/mazeRoom/procgenMaze.js',
    elementSpec: 'frontend/modules/procgenCore/elementSpec.js',
    areaGraph: 'frontend/modules/procgenCore/areaGraph.js',
    urlParams: 'frontend/modules/procgenCore/urlParams.js',
};

/**
 * ⛓ ONE ROW PER CENSUS KEY. `scanned` is what the pattern finds in the source
 * this constant is the key FOR; `declared` is the constant.
 */
const KEYS = [
    {
        constant: 'KILL_GATE_REFUSALS',
        declared: KILL_GATE_REFUSALS,
        text: () => read(SOURCES.killGate),
    },
    {
        constant: 'BLOCK_POCKET_REFUSALS',
        declared: BLOCK_POCKET_REFUSALS,
        text: () => read(SOURCES.blockPocket),
    },
    {
        constant: 'OPEN_CHAMBER_REFUSALS',
        declared: OPEN_CHAMBER_REFUSALS,
        text: () => read(SOURCES.openChamber),
    },
    {
        constant: 'ARENA_REFUSALS',
        declared: ARENA_REFUSALS,
        text: () => read(SOURCES.arena),
    },
    {
        constant: 'SHORTCUT_REFUSALS',
        declared: SHORTCUT_REFUSALS,
        text: () => read(SOURCES.shortcut),
    },
    {
        /** ⛓ arc 5, slice 5 — the shared `pocketFor`'s own two, where they are
         *  RAISED. The elements that ask it declare them too; both lists are
         *  true and neither is a copy (see `ROOM_DOOR_REFUSALS`' docblock). */
        constant: 'ROOM_DOOR_REFUSALS',
        declared: ROOM_DOOR_REFUSALS,
        text: () => read(SOURCES.roomDoor),
    },
    {
        constant: 'SEEDLING_ELEMENT_REFUSALS',
        declared: SEEDLING_ELEMENT_REFUSALS,
        text: () => read(SOURCES.seedlingElements),
    },
    {
        constant: 'SEEDLING_AREA_REFUSALS',
        declared: SEEDLING_AREA_REFUSALS,
        text: () => read(SOURCES.seedling),
    },
    {
        constant: 'MAZE_REFUSALS',
        declared: MAZE_REFUSALS,
        text: () => read(SOURCES.maze),
    },
    {
        constant: 'MAZE_REQUIRE_REFUSALS',
        declared: MAZE_REQUIRE_REFUSALS,
        text: () => regionFrom(read(SOURCES.maze), /^export function requireOutcome\(/),
    },
    {
        constant: 'REQUIRE_DIRECTIVE_REFUSALS',
        declared: REQUIRE_DIRECTIVE_REFUSALS,
        text: () => regionFrom(read(SOURCES.elementSpec),
            /^export function resolveRequireDirective\(/),
    },
    {
        /**
         * ⛔⛔ THE ONE THAT IS NOT A REFUSAL-NAME SCAN. `urlParams.js` refuses
         * through `fail(code, message)`, so its census is scanned by the CODE
         * ARGUMENT — which is why the code is the FIRST argument: the messages
         * are multi-line template concatenations and a trailing argument would
         * be invisible to any single-pass regex.
         */
        constant: 'URL_PARAM_REFUSALS',
        declared: URL_PARAM_REFUSALS,
        patterns: [/\bfail\('([a-z][a-z0-9-]+)'/g],
        text: () => read(SOURCES.urlParams),
    },
    {
        constant: 'areaGraph.REASONS',
        declared: Object.values(REASONS),
        /** ⛓ The frozen thing here is the TABLE, not the array `Object.values`
         *  mints from it — this key is a map from a code-facing key to a
         *  reader-facing name, and both halves matter. */
        frozen: REASONS,
        patterns: [REASON_TABLE_RE],
        text: () => regionFrom(read(SOURCES.areaGraph),
            /^export const REASONS = Object\.freeze\(\{/),
    },
];

describe('the refusal CENSUS KEYS cover the scan of their own source', () => {
    for (const key of KEYS) {
        it(`⛓⛓ \`${key.constant}\` ⊇ every refusal name the scan finds`, () => {
            const found = [...scan(key.text(), key.patterns)].sort();
            /** ⛔ NON-VACUITY FIRST: an empty scan would make the ⊇ claim below
             *  true of any list at all, which is exactly how this gate would rot
             *  silently if a pattern ever stopped matching. */
            expect(found.length, `${key.constant}: the scan found NOTHING`)
                .toBeGreaterThan(0);
            const missing = found.filter((n) => !key.declared.includes(n));
            expect(missing, `${key.constant} does not declare ${missing.join(', ')}`)
                .toEqual([]);
        });
    }

    it('⛓⛓ every list is FROZEN and holds no duplicate — a census key counted '
        + 'twice is a count nobody can read', () => {
        for (const key of KEYS) {
            expect(Object.isFrozen(key.frozen ?? key.declared), key.constant).toBe(true);
            expect(new Set(key.declared).size, key.constant).toBe(key.declared.length);
            for (const n of key.declared) expect(typeof n, key.constant).toBe('string');
        }
    });

    /**
     * ⛔⛔ THE OTHER DIRECTION, ASKED OF THE WHOLE VOCABULARY: a name a census
     * key declares must be raised SOMEWHERE in the tree these keys cover. A
     * dead name is the mirror of a missing one — the census counts a class that
     * cannot happen — and only this row can see it, because each per-key row
     * above deliberately allows a name raised one module over.
     */
    it('⛓⛓⛓ no census key declares a name NO source raises', () => {
        const everywhere = new Set();
        for (const f of Object.values(SOURCES)) {
            for (const n of scan(read(f))) everywhere.add(n);
        }
        for (const n of scan(regionFrom(read(SOURCES.areaGraph),
            /^export const REASONS = Object\.freeze\(\{/), [REASON_TABLE_RE])) {
            everywhere.add(n);
        }
        /* ⛓ …and `urlParams`' names, which only the `fail(` code pattern sees */
        for (const n of scan(read(SOURCES.urlParams), [/\bfail\('([a-z][a-z0-9-]+)'/g])) {
            everywhere.add(n);
        }
        const dead = [];
        for (const key of KEYS) {
            for (const n of key.declared) if (!everywhere.has(n)) dead.push(`${key.constant}/${n}`);
        }
        expect(dead).toEqual([]);
    });
});
