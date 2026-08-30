// frontend/modules/procgenCore/apIdNamespaces.test.js
//
// EDITOR v3 slice D0a, §15 D11 / gap 10.
//
// ⛓⛓ THE CENSUS ROW IS THE POINT OF THIS FILE. The table is only worth having
// if a FOURTH namespace cannot arrive beside it in silence, so the roster is
// SWEPT OFF THE TREE, not typed: every id-base literal under
// `frontend/modules` must be a value the table declares, and the failure
// message names the file, the line and the value.
//
// ⚠ AND THE SWEEP COVERS THE DATA, NOT ONLY THE CODE. Two of the six AP bases
// in this repo are not JS literals at all — they are `ap_id_offset` fields in
// `flashPanel/games/*.json`. A grep over `.js` would have reported "every base
// is accounted for" while seeing neither of them
// ([[feedback_code_sweep_misses_the_data]]).

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    AP_ID_NAMESPACES,
    DECLARED_ID_BASES,
    allocateIdsBySortedName,
    namespaceNamed,
} from './apIdNamespaces.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '..');

/**
 * The git SUBMODULES under frontend/modules. Their contents are another
 * repository's; the table records them as `reference` rows and the sweep must
 * not demand this repo account for their literals.
 */
const SUBMODULES = new Set([
    'cavernous-ii', 'journey-to-ascension', 'omsi-loops', 'shared', 'textAdventureEngine',
]);

function* walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        const rel = relative(MODULES, full);
        if (entry.isDirectory()) {
            if (SUBMODULES.has(rel)) continue;
            if (rel === 'flashPanel/wasm' || entry.name === 'node_modules') continue;
            yield* walk(full);
        } else if (entry.isFile()) {
            yield { full, rel };
        }
    }
}

const ALL_FILES = [...walk(MODULES)];

/** Non-test JS, outside every submodule — where an id base may be DECLARED. */
const CODE = ALL_FILES.filter(({ rel }) => rel.endsWith('.js')
    && !rel.endsWith('.test.js')
    && !rel.startsWith('tests/'));

/** The per-game engine-binding configs — where the OTHER two bases live. */
const GAME_CONFIGS = ALL_FILES.filter(({ rel }) => /^flashPanel\/games\/.+\.json$/.test(rel));

describe('⛓ apIdNamespaces — the census: no id base exists that the table does not declare', () => {
    it('the sweep actually found files to sweep (a zero-hit census proves nothing)', () => {
        expect(CODE.length).toBeGreaterThan(100);
        expect(GAME_CONFIGS.length).toBeGreaterThan(0);
    });

    it('every `*_ID_BASE = <number>` literal in CODE is a declared base', () => {
        const strays = [];
        for (const { full, rel } of CODE) {
            const text = readFileSync(full, 'utf8');
            text.split('\n').forEach((line, i) => {
                const m = /\b\w*_ID_BASE\s*=\s*([0-9_]+)/.exec(line);
                if (!m) return;
                const value = Number(m[1].replace(/_/g, ''));
                if (!DECLARED_ID_BASES.has(value)) strays.push(`${rel}:${i + 1} = ${value}`);
            });
        }
        expect(strays, `id bases not in AP_ID_NAMESPACES:\n${strays.join('\n')}`).toEqual([]);
    });

    it('every `ap_id_offset` in the game CONFIGS is a declared base', () => {
        const strays = [];
        const seen = [];
        for (const { full, rel } of GAME_CONFIGS) {
            const config = JSON.parse(readFileSync(full, 'utf8'));
            if (!('ap_id_offset' in config)) continue;
            seen.push(`${rel} = ${config.ap_id_offset}`);
            if (!DECLARED_ID_BASES.has(config.ap_id_offset)) {
                strays.push(`${rel} = ${config.ap_id_offset}`);
            }
        }
        expect(seen.length, 'no game config declares ap_id_offset — the sweep lost its subject').toBeGreaterThan(0);
        expect(strays, `ap_id_offset values not in AP_ID_NAMESPACES:\n${strays.join('\n')}`).toEqual([]);
    });

    it('the table names every base it declares, with provenance and a pin', () => {
        for (const row of AP_ID_NAMESPACES) {
            expect(row.declaredAt, `${row.name} has no declaredAt`).toMatch(/\S+:\d/);
            expect(row.pinnedBy, `${row.name} has no pinnedBy`).toBeTruthy();
            expect(row.owner, `${row.name} has no owner`).toBeTruthy();
        }
        // Names are unique — the table is addressable by name.
        expect(new Set(AP_ID_NAMESPACES.map((r) => r.name)).size).toBe(AP_ID_NAMESPACES.length);
    });

    it('the two SEEDLING location namespaces do not overlap', () => {
        // The gap regionAtlasCompiler.test.js:156 asserts, stated here as a
        // property of the register rather than of one compile.
        const world = namespaceNamed('flashpanel-seedling');
        const atlas = namespaceNamed('region-atlas');
        expect(Math.abs(atlas.locationBase - world.locationBase)).toBeGreaterThan(1_000_000);
    });

    it('the table is FROZEN, rows included', () => {
        expect(Object.isFrozen(AP_ID_NAMESPACES)).toBe(true);
        for (const row of AP_ID_NAMESPACES) expect(Object.isFrozen(row)).toBe(true);
    });
});

describe('apIdNamespaces — allocateIdsBySortedName is the compiler\'s scheme', () => {
    it('base + index in SORTED order, independent of input order', () => {
        expect([...allocateIdsBySortedName(['c', 'a', 'b'], 100)])
            .toEqual([['a', 100], ['b', 101], ['c', 102]]);
        expect([...allocateIdsBySortedName(['b', 'c', 'a'], 100)])
            .toEqual([...allocateIdsBySortedName(['a', 'b', 'c'], 100)]);
    });

    it('duplicates collapse to ONE id and do not advance the index', () => {
        expect([...allocateIdsBySortedName(['a', 'a', 'b'], 0)]).toEqual([['a', 0], ['b', 1]]);
    });

    it('the empty set allocates nothing', () => {
        expect([...allocateIdsBySortedName([], 30000000)]).toEqual([]);
    });

    it('reproduces the region-atlas base the compiler exports', () => {
        const ids = allocateIdsBySortedName(['Zed', 'Alpha'], namespaceNamed('region-atlas').locationBase);
        expect(ids.get('Alpha')).toBe(30000000);
        expect(ids.get('Zed')).toBe(30000001);
    });
});
