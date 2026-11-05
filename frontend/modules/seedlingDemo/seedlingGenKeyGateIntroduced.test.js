/**
 * ⛓⛓ KEYGATE IN THE PLAN-LESS MODES (slice 2b, `procgen-region-introduced`; ⚖ the user 2026-11-03: *"B: Distinct
 * colour per room"*, *"Yes, add introduced"*, on top-down with several key gates *"Yes, allow"*, and on a room
 * configured for a key gate that got none *"Accept, and report it"*).
 *
 * Shuffled spiral, grid growth and top-down REQUEST nothing; each region generator is handed `introduced` (the items
 * standing at the run's other regions; `procgenPipeline/regionIntroduced.test.js` pins the field), and a generated
 * room's key gate takes the LEAST colour in neither `held` nor `introduced` (`seedlingGenRoom.allocatedKnobs`):
 *   1. the room alone: the colour rule, the first room's knobs untouched, an explicit type taken and the 6th colour
 *      refused by name, a request still winning;
 *   2. real worlds of each plan-less mode: 2+ key-gate rooms, DISTINCT colours, the set assembles, and the
 *      introductions report counts exactly the rooms configured / keyed / not;
 *   3. a 6th key-gate room in a real top-down world is refused (`keygate-colours-exhausted`);
 *   4. REGENERATE replays the first generation (the APWorld editor, from the document: colour, key location, goal
 *      rule); a top-down RE-ROLL of another region leaves every key-gate room's colour where it was.
 *
 * MUTANTS (measured, each reverted — the as-built):
 *   i1  the engine hands no `introduced` (introducedFromGrid → null at every site) ⇒ the mode rows refuse
 *       `keygate-colour-not-allocated`;
 *   i2  `allocatedKnobs` ignores `introduced` (only `held`) ⇒ two rooms take Red Key ⇒ the assembly backstop refuses
 *       `keygate-colour-shared` (the mode rows red);
 *   i3  RECOMPUTE INSTEAD OF REPLAY: `introductionRequestOf` → null (the regenerate reads the room's knobs, never its
 *       document) ⇒ the regenerate rows red (the form-default regenerate loses the key).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import { buildTopDownEnvelope, runTopDownToStep } from '../procgenPipeline/topDownSteps.js';
import { regenerateRegionEntry } from '../apworldEditor/regionRegenerate.js';
import { composeRegenerateArgs, regionGenerationPlan } from '../apworldEditor/regionGenerationFlow.js';
import { freezeIntroduced } from '../procgenCore/itemIntroduction.js';
import { BOSS_KEY_ITEMS, BOSS_KEY_KIND, generateGenRoom } from './seedlingGenRoom.js';
import { KEYGATE_EXHAUSTED_REFUSAL, KEYGATE_SHARED_REFUSAL } from './seedlingGenRoomPayload.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ADVENTURE = JSON.parse(readFileSync(join(ROOT,
    'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));

const GEN = 'flash_seedling_gen';
const HAS = (item) => ({ rule: 'Has', args: { item_name: item } });
const ruleHas = (rule, item) => !!rule && (JSON.stringify(rule) === JSON.stringify(HAS(item))
    || (rule.rule === 'And' && (rule.children ?? []).some((c) => ruleHas(c, item))));

/** The plan-less fixture worlds, every generated room configured `keygate` (no type). */
const WORLDS = {
    spiral: (seed) => [{ ...SEEDLING_GENERATED_ROOM_STATE, substrateQuotas: { maze: 1, [GEN]: 4 },
        params: { ...SEEDLING_GENERATED_ROOM_STATE.params, seed, seedlingGenElements: 'keygate' } }, {}],
    grid: (seed) => [{ mode: 'gridGrowth', params: { seed, gridWidth: 3, gridHeight: 3, seedlingGenElements: 'keygate' },
        scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
        substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 2 }, substrateMode: 'mix' }, {}],
    topDown: (seed) => [{ mode: 'topDown', params: { seed, regionWidth: 10, regionHeight: 10, seedlingGenElements: 'keygate' },
        scenario: { items: {}, obstacles: {} }, substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 1 },
        substrateMode: 'mix' }, { topDownSource: ADVENTURE, sphereLog: null }],
};
const runOf = (mode, seed) => { const [state, ctx] = WORLDS[mode](seed); return buildRunFromState(structuredClone(state), ctx); };
const build = async (mode, seed) => (await runPresetHeadless(runOf(mode, seed))).rulesJson;

/** Every generated room of a world: its key (or null), and its rules.json locations. */
function genRooms(rules) {
    return Object.entries(rules.preset_sidecars['1']).filter(([, sc]) => sc.substrate === GEN).map(([region, sc]) => ({
        region,
        payload: sc.playable_payload,
        key: sc.playable_payload.locations.find((l) => l.kind === BOSS_KEY_KIND) ?? null,
        locations: rules.regions['1'][region].locations ?? [],
    }));
}

// --- 1. the room alone -------------------------------------------------------------------------------------

describe('1 — the room: the least colour in neither `held` nor `introduced`', () => {
    const room = (elements, extra = {}) => generateGenRoom({ region_id: 'region_0_1', exits: [{ side: 'east' }],
        size: { width: 10, height: 10 }, rng: { next: () => 0.2 },
        params: { seedlingGen: { elements, skeleton: 'empty', biome: 'pre-sword' } }, ...extra }).world;
    const intro = (...items) => freezeIntroduced(Object.fromEntries(items.map((i) => [i, 1])));

    it('nothing stands elsewhere → red, and the knobs are EXACTLY as written (the first key-gate room is byte-unchanged)', () => {
        const plain = room('keygate');
        const handed = room('keygate', { introduced: intro() });
        expect(handed.generation).toEqual(plain.generation);
        expect(handed.locations.find((l) => l.kind === BOSS_KEY_KIND)?.item).toBe('Red Key');
        expect(plain).not.toHaveProperty('keyColourFromRun');
        expect(handed.keyColourFromRun).toBe(true);
    }, 60_000);

    it('red and green stand elsewhere (one in `introduced`, one in `held`) → purple, recorded in the knobs', () => {
        const w = room('keygate', { introduced: intro('Red Key'), held: { items: { 'Green Key': 1 } } });
        expect(w.generation.elements).toBe('keygate;type=2');
        expect(w.locations.find((l) => l.kind === BOSS_KEY_KIND)?.item).toBe('Purple Key');
    }, 60_000);

    it('an element LIST keeps its other members; only the key gate member takes the colour', () => {
        expect(room('chestdoor+keygate', { introduced: intro('Red Key') }).generation.elements).toBe('chestdoor+keygate;type=1');
    }, 60_000);

    it('an explicit type already standing elsewhere → refused by name (`keygate-colour-shared`); a free one is kept', () => {
        expect(() => room('keygate;type=0', { introduced: intro('Red Key') }))
            .toThrow(new RegExp(`^${KEYGATE_SHARED_REFUSAL}: generated Seedling room 'region_0_1' asks for the KEY GATE opened by 'Red Key'`));
        expect(room('keygate;type=3', { introduced: intro('Red Key') }).generation.elements).toBe('keygate;type=3');
    }, 60_000);

    it('all five standing → refused by name (`keygate-colours-exhausted`); a room configured for no key gate is untouched', () => {
        expect(() => room('keygate', { introduced: intro(...BOSS_KEY_ITEMS) }))
            .toThrow(new RegExp(`^${KEYGATE_EXHAUSTED_REFUSAL}: generated Seedling room 'region_0_1'`));
        expect(room('chestdoor', { introduced: intro(...BOSS_KEY_ITEMS) }).generation.elements).toBe('chestdoor');
    }, 60_000);

    it('a pipeline REQUEST wins over `introduced` (sphere growth, a regenerate replaying its document)', () => {
        const w = room('keygate', { introduced: intro('Red Key'), introduce: { items: { 'Blue Key': 1 } } });
        expect(w.generation.elements).toBe('keygate;type=3');
        expect(w).not.toHaveProperty('keyColourFromRun');
    }, 60_000);
});

// --- 2. the modes ------------------------------------------------------------------------------------------

/** MEASURED at the slice's tip (each world's report, recounted from its sidecars below). */
const EXPECTED = {
    spiral: { seed: 1, report: { requested: 4, placed: 3, notPlaced: { 'not-drawn': 1 } } },
    grid: { seed: 1, report: { requested: 6, placed: 4, notPlaced: { 'not-drawn': 2 } } },
    topDown: { seed: 3, report: { requested: 4, placed: 3, notPlaced: { 'not-drawn': 1 } } },
};
const BUILT = {};
beforeAll(async () => {
    for (const [mode, { seed }] of Object.entries(EXPECTED)) BUILT[mode] = await build(mode, seed);
}, 600_000);

describe('2 — every plan-less mode: distinct colours, the set assembles, the report counts the rooms', () => {
    it.each(Object.keys(EXPECTED))('%s: 2+ key-gate rooms, each its own colour, and the set assembles', (mode) => {
        const keys = genRooms(BUILT[mode]).filter((r) => r.key).map((r) => r.key.item);
        expect(keys.length).toBeGreaterThanOrEqual(2);
        expect(new Set(keys).size).toBe(keys.length);
        for (const k of keys) expect(BOSS_KEY_ITEMS).toContain(k);
        expect(() => assembleGeneratedSeedlingSet(BUILT[mode], { selfPlayer: 1 })).not.toThrow();
    });

    it.each(Object.keys(EXPECTED))('%s: a location behind a lock requires ITS room\'s key in rules.json', (mode) => {
        for (const r of genRooms(BUILT[mode]).filter((x) => x.key)) {
            const goal = r.payload.locations.find((l) => l.cell.tx === r.payload.goal_cell.tx
                && l.cell.ty === r.payload.goal_cell.ty && l.kind !== BOSS_KEY_KIND);
            if (!goal) continue; // ⚠ a room dealt no item has nothing behind its lock (named limit)
            expect(ruleHas(r.locations.find((l) => l.name === goal.name).access_rule, r.key.item), r.region).toBe(true);
        }
    });

    it.each(Object.keys(EXPECTED))('%s: the introductions report — the measured numbers, and a recount of the sidecars', (mode) => {
        const report = BUILT[mode].procgen_metadata['1'].introductions;
        expect(report).toEqual(EXPECTED[mode].report);
        const rooms = genRooms(BUILT[mode]);
        expect(report.requested).toBe(rooms.length);
        expect(report.placed).toBe(rooms.filter((r) => r.key).length);
    });
});

describe('3 — a 6th key-gate room is refused by name', () => {
    it('top-down Adventure seed 2: Adventure\'s own Yellow Key plus four rooms take all five; the next is refused', async () => {
        await expect(build('topDown', 2)).rejects.toThrow(new RegExp(`^${KEYGATE_EXHAUSTED_REFUSAL}: generated Seedling `
            + `room 'CreditsRoomFarSide' would take a KEY GATE, and all 5 key colours`));
    }, 120_000);
});

// --- 4. regenerate -----------------------------------------------------------------------------------------

describe('4 — REGENERATE replays the first generation; it never recomputes the colour', () => {
    /** The APWorld editor: each key-gate room whose key guards a location (so its document carries `Has(<key>)`). */
    it.each([['topDown'], ['grid']])('%s: the editor\'s regenerate of each key-gate room keeps its colour, key location and goal rule', (mode) => {
        const doc = structuredClone(BUILT[mode]);
        const guarded = genRooms(doc).filter((r) => r.key && r.locations.some((l) => ruleHas(l.access_rule, r.key.item)));
        expect(guarded.length).toBeGreaterThanOrEqual(1);
        for (const room of guarded) {
            const plan = regionGenerationPlan(doc, '1', room.region, GEN, { seed: 7 });
            expect(plan.refusal ?? null).toBe(null);
            /** the form's plain defaults (elements empty: the document alone replays) AND the recorded knobs */
            for (const bag of [plan.defaults, plan.recorded ?? plan.defaults]) {
                const res = regenerateRegionEntry(composeRegenerateArgs(doc, '1', room.region, GEN, { ...bag }));
                expect(res.ok, res.threw).toBe(true);
                const p = res.entry.playable_payload;
                const key = p.locations.find((l) => l.kind === BOSS_KEY_KIND);
                expect(key, room.region).toMatchObject({ name: room.key.name, item: room.key.item });
                expect(p.locations[0].access_rule).toEqual(HAS(room.key.item));
                expect(p.record.entities.filter((e) => e.type === 'bosslock').map((e) => e.attrs.keyType))
                    .toEqual([String(BOSS_KEY_ITEMS.indexOf(room.key.item))]);
            }
        }
    }, 240_000);

    /** Top-down RE-ROLL replays the recording from a fresh ① (`topDownSteps.js`): re-roll a region that is not a
     *  key-gate room, and every key-gate room keeps its colour (each room sees the same regions before it). */
    it('top-down: re-rolling another region leaves every key-gate room\'s colour as it was', async () => {
        const before = Object.fromEntries(genRooms(BUILT.topDown).map((r) => [r.region, r.key?.item ?? null]));
        const other = Object.keys(BUILT.topDown.preset_sidecars['1']).find((r) => !(r in before)
            && BUILT.topDown.preset_sidecars['1'][r].substrate === 'maze');
        expect(other).toBeTruthy();
        const env = buildTopDownEnvelope(runOf('topDown', EXPECTED.topDown.seed).run);
        env.edits = [{ op: 're-roll', region_id: other, n: 1 }];
        await runTopDownToStep(env, 'compile');
        const after = Object.fromEntries(genRooms(env.compile.rulesJson).map((r) => [r.region, r.key?.item ?? null]));
        expect(after).toEqual(before);
        expect(env.compile.rulesJson.preset_sidecars['1'][other].playable_payload)
            .not.toEqual(BUILT.topDown.preset_sidecars['1'][other].playable_payload);
    }, 240_000);
});
