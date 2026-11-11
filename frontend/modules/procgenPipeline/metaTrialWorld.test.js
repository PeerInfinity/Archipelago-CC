/**
 * ⛓⛓⛓ CONTENT SETS R3 — **THE THEME `meta`: PRESENTATION MOVES, LOGIC DOES NOT.**
 *
 * `META_TRIAL_STATE` is `CONCEPT_TRIAL_STATE` with `content: ['meta']`. Built
 * headless through the panel's own assembly (`prepareRunFromState` →
 * `runPresetHeadless`, the pack read from disk) beside its control (the concept
 * trial), it must:
 *   · compile the control's logic: the document minus the text adventure's
 *     `prose` (the one thing the theme writes in this world) and minus
 *     `procgen_metadata[p].content` is the control's, string for string;
 *   · speak the theme where the theme presents something: the guardian gate's two
 *     lines are the Gate's, the sword's check line is the theme's, every
 *     text-adventure room takes one of the theme's places;
 *   · fall through where it does not: the theme presents no water, so the maze's
 *     water gate (and every maze item row) is the control's, byte for byte;
 *   · BE the committed `meta_trial` preset, byte for byte.
 * Every expected string is read from the pack on disk, never spelled here.
 *
 * ⚠ In this world the guardian is the TEXT ADVENTURE's gate; the maze's only
 * concept gate is water. The Gate's MAZE look is pinned on the concept
 * library's D4 maze sphere world (maze only, both gates realised), built in
 * memory with the same real pack.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { CONCEPT_TRIAL_STATE, META_TRIAL_STATE } from './presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { CONCEPTS } from '../procgenCore/concepts.js';
import { RECORDED_CONTENT_KEY, documentContentOf } from './worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const THEME = META_TRIAL_STATE.params.content[0];
const PACK = readJson(`frontend/packs/${THEME}/pack.json`);
const PACK_CONCEPTS = readJson(`frontend/packs/${THEME}/${PACK.layers.concepts}`).concepts;
const PACK_STRINGS = readJson(`frontend/packs/${THEME}/${PACK.layers.text}`).strings;
const presenterOf = (mechanic) => Object.values(PACK_CONCEPTS).find((c) => c.presents === mechanic) ?? null;
const PLACES = Object.values(PACK_CONCEPTS).filter((c) => c.kind === 'place');

const build = async (state) => runPresetHeadless(await prepareRunFromState(structuredClone(state), { io: nodePackIo() }));
const sidecarsOf = (rj, substrate) => Object.entries(rj.preset_sidecars['1']).filter(([, s]) => s.substrate === substrate);
/** The document minus what the theme may write in this world: text-adventure prose, and the record. */
const withoutPresentation = (rj) => {
    const out = structuredClone(rj);
    for (const [, s] of sidecarsOf(out, 'text_adventure')) delete s.playable_payload.prose;
    for (const block of Object.values(out.procgen_metadata ?? {})) delete block[RECORDED_CONTENT_KEY];
    return out;
};
const isConceptGate = (def) => typeof def?.concept === 'string';

describe('R3 — the meta trial world beside its control (the concept trial)', async () => {
    const world = await build(META_TRIAL_STATE);
    const ctrl = await build(CONCEPT_TRIAL_STATE);

    it('the pack presents the guardian, the sword and the swim, and NOT water (water is the fall-through)', () => {
        for (const m of ['guardian', 'sword', 'swim']) expect(presenterOf(m), m).not.toBeNull();
        expect(presenterOf('water')).toBeNull();
        expect(PLACES.length).toBeGreaterThan(0);
    });

    it('the compiled logic is the control\'s; the record names the theme for player 1 only', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(JSON.stringify(withoutPresentation(world.rulesJson))).toBe(JSON.stringify(withoutPresentation(ctrl.rulesJson)));
        expect(documentContentOf(world.rulesJson, 1)).toEqual([THEME]);
        expect(documentContentOf(ctrl.rulesJson, 1)).toEqual([]);
        expect(Object.keys(world.rulesJson.procgen_metadata)).toEqual(Object.keys(ctrl.rulesJson.procgen_metadata));
    });

    it('the guardian gate speaks the Gate\'s two lines', () => {
        const gate = presenterOf('guardian');
        const exits = sidecarsOf(world.rulesJson, 'text_adventure')
            .flatMap(([, s]) => Object.values(s.playable_payload.prose?.exits ?? {}));
        expect(exits).toEqual([{
            moveMessage: PACK_STRINGS[gate.text.passedWith],
            inaccessibleMessage: PACK_STRINGS[gate.text.blocked],
        }]);
    });

    it('the sword\'s check speaks the theme\'s line', () => {
        const locs = sidecarsOf(world.rulesJson, 'text_adventure')
            .flatMap(([, s]) => Object.values(s.playable_payload.prose?.locations ?? {}));
        expect(locs).toEqual([{ checkMessage: PACK_STRINGS[presenterOf('sword').text.checkMessage] }]);
    });

    it('every text-adventure room takes one of the theme\'s places (the control\'s none)', () => {
        const rooms = sidecarsOf(world.rulesJson, 'text_adventure');
        expect(rooms.length).toBeGreaterThan(0);
        for (const [rid, s] of rooms) {
            const { name, description } = s.playable_payload.prose ?? {};
            expect(PLACES.map((p) => [p.name, p.description]), rid).toContainEqual([name, description]);
        }
        for (const [rid, s] of sidecarsOf(ctrl.rulesJson, 'text_adventure')) {
            expect(s.playable_payload.prose?.name, rid).toBeUndefined();
        }
    });

    it('the fall-through: every maze payload is the control\'s byte for byte, the water gate among them', () => {
        const maze = (rj) => JSON.stringify(sidecarsOf(rj, 'maze'));
        expect(maze(world.rulesJson)).toBe(maze(ctrl.rulesJson));
        const water = sidecarsOf(world.rulesJson, 'maze')
            .flatMap(([, s]) => Object.values(s.playable_payload.obstacleLib ?? {})).filter((d) => d.concept === 'water');
        expect(water.length).toBeGreaterThan(0);
    });
});

describe('R3 — the committed meta_trial preset IS this world', async () => {
    const text = readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8');
    const fresh = await build(META_TRIAL_STATE);

    it('byte for byte a fresh build of META_TRIAL_STATE (the producer\'s --check, in the suite)', () => {
        expect(text).toBe(JSON.stringify(fresh.rulesJson, null, 2));
    });

    it('is listed as a dev preset, as concept_trial is', () => {
        const index = readJson('frontend/presets/preset_files.json');
        expect(index.meta_trial?.folders?.AP_1?.files).toEqual(['AP_1_rules.json']);
        const preserved = readFileSync(join(ROOT, 'scripts/release/preserved-dev-presets.txt'), 'utf8')
            .split('\n').map((l) => l.trim().split(/\s+/)[0]);
        expect(preserved).toContain('meta_trial');
    });
});

/**
 * The Gate in a MAZE: the concept library's D4 world (maze only, seed 1, both gate concepts realised; not a
 * committed preset). The same bundle is what a user generates in the pipeline panel with Content set `meta`
 * ticked to SEE the Gate drawn in a maze.
 */
const mazeBundle = (content) => ({
    mode: 'sphereGrowth',
    params: {
        seed: 1, startSubstrate: 'maze', sphereCount: 3, fillerCount: 0, revisitPercent: 25,
        concepts: ['sword', 'guardian', 'swim', 'water'], content,
    },
    scenario: { items: { [CONCEPTS.sword.item.id]: 1, [CONCEPTS.swim.item.id]: 1, victory: 1 }, obstacles: {} },
    substrateQuotas: { maze: 99 },
    substrateMix: {},
    substrateMode: 'quotas',
});

describe('R3 — the Gate\'s maze look (a maze world where the guardian is a maze gate)', async () => {
    const world = await build(mazeBundle([THEME]));
    const ctrl = await build(mazeBundle([]));
    const gates = (rj, concept) => sidecarsOf(rj, 'maze')
        .flatMap(([, s]) => Object.values(s.playable_payload.obstacleLib ?? {}))
        .filter((d) => isConceptGate(d) && d.concept === concept);

    it('every guardian gate carries the Gate\'s name, colour and symbol', () => {
        const gate = presenterOf('guardian');
        const got = gates(world.rulesJson, 'guardian');
        expect(got.length).toBeGreaterThan(0);
        for (const d of got) expect({ name: d.name, color: d.color, symbol: d.symbol }).toEqual({ name: gate.name, ...gate.look });
        expect(gates(ctrl.rulesJson, 'guardian').every((d) => d.color !== gate.look.color)).toBe(true);
    });

    it('the water gates and every item row are the control\'s (the theme gives no look to them)', () => {
        expect(gates(world.rulesJson, 'water').length).toBeGreaterThan(0);
        expect(gates(world.rulesJson, 'water')).toEqual(gates(ctrl.rulesJson, 'water'));
        const items = (rj) => JSON.stringify(sidecarsOf(rj, 'maze').map(([rid, s]) => [rid, s.playable_payload.itemLib]));
        expect(items(world.rulesJson)).toBe(items(ctrl.rulesJson));
    });

    it('apart from the guardian gates\' presentation and the record, the world is the control\'s', () => {
        const strip = (rj) => {
            const out = structuredClone(rj);
            for (const [, s] of sidecarsOf(out, 'maze')) {
                for (const d of Object.values(s.playable_payload.obstacleLib ?? {})) {
                    if (isConceptGate(d) && d.concept === 'guardian') for (const f of ['name', 'color', 'symbol']) delete d[f];
                }
            }
            for (const block of Object.values(out.procgen_metadata ?? {})) delete block[RECORDED_CONTENT_KEY];
            return out;
        };
        expect(JSON.stringify(strip(world.rulesJson))).toBe(JSON.stringify(strip(ctrl.rulesJson)));
    });
});
