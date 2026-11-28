/**
 * ⛓⛓ CONTENT SETS PL-2 — **THE WORDS STACK: THE `exists` PACKS' OWN WORDS UNDER THE NAMED THEMES** (Z.5's default
 * row), and ⛔ **EVERY WORLD ON MAIN RESOLVES ITS WORDS EXACTLY AS BEFORE**.
 *
 * The pin runs over C0's byte-equality surface (every committed preset with a maze or text-adventure region) plus
 * every preset with a JtA region: for each player of each, the stack the new rule builds from what the document
 * records equals the C3 rule's (the mix's default packs in registry order, then `content`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { SUBSTRATE_LIBRARIES } from '../procgenCore/substrateLibraries.js';
import { CONCEPT_TRIAL_STATE } from './presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    DEFAULT_CONTENT_PACK_FIELD, RECORDED_CONTENT_KEY, RECORDED_EXISTS_KEY, assertContentLoaded, defaultExistsOf,
    effectiveContentStack,
} from './worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MODULES = join(ROOT, 'frontend', 'modules');
const IMPORTED = ['mazeRoom/mazeRoomLibrary.js', 'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js',
    'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js'];
/** The substrates whose presets the pin walks. */
const PINNED = ['maze', 'text_adventure', 'jta'];

/** The C3 rule, as it stood before PL-2: the mix's default packs (registry order, once each), then `content`. */
function c3Stack(substrateIds, content) {
    const out = defaultExistsOf({ substrateIds });
    for (const id of content) if (!out.includes(id)) out.push(id);
    return out;
}

/** Every committed rules.json the preset index lists (`<game>/<folder>/<file>`): `{ path, doc }`. */
function committedPresets() {
    const index = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/preset_files.json'), 'utf8'));
    const out = [];
    for (const [game, row] of Object.entries(index)) {
        for (const [folder, f] of Object.entries(row?.folders ?? {})) {
            for (const file of f?.files ?? []) {
                if (!file.endsWith('_rules.json')) continue;
                const path = `frontend/presets/${game}/${folder}/${file}`;
                out.push({ path, doc: JSON.parse(readFileSync(join(ROOT, path), 'utf8')) });
            }
        }
    }
    return out;
}

/** Per player: the substrates of its regions (`preset_sidecars[p][*].substrate`, ⚠ a per-player map). */
function playerSubstrates(doc) {
    const out = {};
    for (const [p, regions] of Object.entries(doc.preset_sidecars ?? {})) {
        out[p] = [...new Set(Object.values(regions ?? {}).map((r) => r?.substrate).filter(Boolean))];
    }
    return out;
}

describe('⛔ every world on main resolves its words exactly as before', () => {
    it('every library that declares a default content pack is registered here (so the pin sees every default)', () => {
        const declaring = SUBSTRATE_LIBRARIES.filter((lib) => readFileSync(join(MODULES, lib), 'utf8').includes(`${DEFAULT_CONTENT_PACK_FIELD}:`));
        for (const lib of declaring) expect(IMPORTED).toContain(lib);
        for (const id of ['maze', 'text_adventure']) expect(substrateRegistry.get(id)?.[DEFAULT_CONTENT_PACK_FIELD]).toBeTruthy();
    });

    /**
     * ⛓ GEN-2 — THE COMMITTED WORLDS THAT RECORD `exists`, by path, each with its packs and why. Every other world must
     * record none: a new recorder is a red here until it is named.
     */
    const RECORDS_EXISTS = Object.freeze({
        'frontend/presets/tile_kinds_demo/AP_1/AP_1_rules.json': Object.freeze({
            exists: Object.freeze(['furniture', 'ledges']),
            why: 'content sets GEN-2: the "Randomly placed tiles" demo names the furniture pack under what exists (⚖ Q2); '
                + 'GEN-5 adds the ledges pack (a one-way kind)',
        }),
    });

    it('every world RECORDS_EXISTS names is committed (no stale row)', () => {
        const paths = new Set(committedPresets().map(({ path }) => path));
        for (const path of Object.keys(RECORDS_EXISTS)) expect(paths.has(path), path).toBe(true);
    });

    const presets = committedPresets()
        .map(({ path, doc }) => ({ path, doc, players: playerSubstrates(doc) }))
        .filter(({ players }) => Object.values(players).some((ids) => ids.some((id) => PINNED.includes(id))));

    it('the surface is non-empty for each pinned substrate', () => {
        for (const id of PINNED) expect(presets.some(({ players }) => Object.values(players).some((ids) => ids.includes(id))), id).toBe(true);
    });

    it.each(presets.map((p) => [p.path, p]))('%s', (path, { doc, players }) => {
        for (const [p, substrateIds] of Object.entries(players)) {
            const meta = doc.procgen_metadata?.[p] ?? {};
            const content = meta[RECORDED_CONTENT_KEY] ?? [];
            const exists = meta[RECORDED_EXISTS_KEY] ?? [];
            // `exists` is recorded only when not the default. A world that records none resolves exactly as C3 did, so
            // the new part is inert there; ⛓ GEN-2 — a world that records one (named in RECORDS_EXISTS, with why) gets
            // its own packs over the substrates' and under its themes, and nothing else moves.
            expect(exists, `${path} records exists: name it in RECORDS_EXISTS`).toEqual(RECORDS_EXISTS[path]?.exists ?? []);
            expect(effectiveContentStack({ substrateIds, exists, content })).toEqual(c3Stack(substrateIds, [...exists, ...content]));
            // Naming the defaults explicitly changes nothing either.
            expect(effectiveContentStack({ substrateIds, exists: defaultExistsOf({ substrateIds }), content })).toEqual(c3Stack(substrateIds, content));
        }
    });
});

describe('Z.5: a world naming its own `exists` packs', () => {
    it('their words sit over the substrates\' own packs and UNDER the named themes', () => {
        expect(effectiveContentStack({ substrateIds: ['maze'], exists: ['example-village'], content: ['meta'] }))
            .toEqual([substrateRegistry.get('maze')[DEFAULT_CONTENT_PACK_FIELD], 'example-village', 'meta']);
        expect(effectiveContentStack({ substrateIds: [], exists: ['example-village'], content: [] })).toEqual(['example-village']);
    });

    it('a region needs them in its set (the seam refuses a set without them, by name)', () => {
        const params = { [RECORDED_EXISTS_KEY]: ['example-village'] };
        expect(() => assertContentLoaded(params, 'maze')).toThrow(/needs the content pack\(s\) \[maze, example-village\]/);
    });
});

describe('Z.5, through a real generation (the concept trial world)', async () => {
    const generate = async (params) => (await runPresetHeadless(await prepareRunFromState(
        { ...structuredClone(CONCEPT_TRIAL_STATE), params: { ...CONCEPT_TRIAL_STATE.params, ...params } }, { io: nodePackIo() }))).rulesJson;
    const viaExists = await generate({ exists: ['meta'] });
    const viaContent = await generate({ content: ['meta'] });
    const strip = (doc) => {
        const c = structuredClone(doc);
        for (const meta of Object.values(c.procgen_metadata ?? {})) { delete meta[RECORDED_EXISTS_KEY]; delete meta[RECORDED_CONTENT_KEY]; }
        return JSON.stringify(c);
    };

    it('a words pack named in `exists` gives the world its words, exactly as naming it as a theme does (same stack)', () => {
        expect(strip(viaExists)).toBe(strip(viaContent));
        const players = Object.keys(viaExists.procgen_metadata ?? {});
        expect(players.length).toBeGreaterThan(0);
        for (const p of players) {
            expect(viaExists.procgen_metadata[p][RECORDED_EXISTS_KEY]).toEqual(['meta']);
            expect(RECORDED_CONTENT_KEY in viaExists.procgen_metadata[p]).toBe(false);
        }
    });
});
