/**
 * `flash_seedling_gen`'s declared location capacity (SEEDLING GENERATED G9;
 * `seedlingGenCapacity.js`) held to the room that builds it: the FLOOR bound is
 * `roomCanHold`'s count, the CEILING is the level's 30 persistence tags (what
 * `placeGenItems`/`placeGenRules` accept: N seats, N+1 is refused by name), a
 * draw whose own elements spend the tags is RE-ROLLED like one short of cells,
 * and a slot past the ceiling is refused BY NAME at Initialise before any build.
 * The census over seeds 1–60 is `seedlingGenCapacity.slow.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { LOCATION_CAPACITY_KINDS, locationDemandOf, roomHolds } from '../procgenCore/locationCapacity.js';
import { TAGS_PER_LEVEL } from './breakableRocks.js';
import {
    GEN_ROOM_CEILING_WHY, GEN_ROOM_LOCATION_CEILING, genRoomCapacityAt, genRoomFloorCells,
} from './seedlingGenCapacity.js';
import * as room from './seedlingGenRoom.js';
import { withHammerEscape } from './solverBot.js';
import { TILE_SIZE, tagOf } from './levelWorld.js';
import {
    FLASH_SEEDLING_GEN_SUBSTRATE_ID, substrateRegistryEntry as ENTRY,
} from '../flashPanel/flashSeedlingGenLibrary.js';
import '../flashPanel/flashSeedlingGenBuild.js';
import {
    initialiseArgs, initialiseFormDefaults, initialisePreview, withInitialisePatch,
} from '../apworldEditor/initialiseFlow.js';
import { initialiseSlot, planInitialise } from '../apworldEditor/slotInitialise.js';

for (const rel of REGISTRY_LIBRARIES) await import(`../../../${rel}`);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
/** 5 regions: `Act 1` lists 17 locations, `Act 2` 52, `Act 3` 31 — one at N+1 and one far past it. */
const INSCRYPTION = read('inscryption/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const P = '1';

/** An rng whose first draw yields exactly `seed` under the room's `(next()*0x7fffffff | 0) || 1`. */
const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const genRoom = (seed, { exits = 2, biome = 'pre-sword', elements } = {}) => room.generateGenRoom({
    region_id: 'cap', exits: Array.from({ length: exits }, (_, i) => ({ exit_id: `e${i}` })),
    size: { width: 10, height: 10 }, rng: seededRng(seed),
    params: { seedlingGen: { biome, ...(elements !== undefined ? { elements } : {}) } },
}).world;
const items = (n) => ({ items_to_place: Array.from({ length: n }, (_, i) => `i${i}`) });
/** The tags the room's own record spends, the goal pickup left out (location 0 takes the goal's). */
const ownTags = (world) => {
    const gx = world.goalCell.tx * TILE_SIZE;
    const gy = world.goalCell.ty * TILE_SIZE;
    return new Set((world.record.entities ?? []).filter((e) => !(e.x === gx && e.y === gy))
        .map((e) => tagOf(e.type, e.attrs)).filter((t) => t >= 0)).size;
};

describe('the declaration', () => {
    it('⛓ tiles, answered by this module; the ceiling is the game\'s tag budget, named', () => {
        expect(ENTRY.locationCapacity.kind).toBe(LOCATION_CAPACITY_KINDS.TILES);
        expect(ENTRY.locationCapacity.capacityAt).toBe(genRoomCapacityAt);
        expect(GEN_ROOM_LOCATION_CEILING).toBe(TAGS_PER_LEVEL);
        expect(TAGS_PER_LEVEL).toBe(30);
        expect(genRoomCapacityAt({ width: 10, height: 10 }, {}, { locations: 0, exits: 0 }).ceiling)
            .toEqual({ locations: 30, why: 'the game\'s 30 persistence tags' });
        expect(GEN_ROOM_CEILING_WHY).toBe('the game\'s 30 persistence tags');
    });

    it('⛓ the FLOOR bound is roomCanHold\'s count, exactly — over sizes × exits × demands up to the ceiling', () => {
        for (let w = 4; w <= 24; w += 2) {
            for (let h = 4; h <= 24; h += 3) {
                const size = { width: w, height: h };
                for (let exits = 0; exits <= 4; exits += 1) {
                    // n ≥ 1: a capacity counts LOCATIONS, so 0 of them always "holds" — a room
                    // whose doors alone exceed its floor is the core's own case (G2 re-roll, G8 growth)
                    for (let n = 1; n <= 30; n += 1) {
                        const demand = { locations: n, gated: n, exits, listed: n };
                        expect(roomHolds(ENTRY, size, {}, demand), `${w}x${h} e${exits} n${n}`)
                            .toBe(room.roomCanHold(size, exits + n));
                    }
                }
            }
        }
        expect(genRoomFloorCells({ width: 10, height: 10 })).toBe(63);
    });

    it('⛓ `gated` = `locations` (a rule is logic only), and an untiled listed location takes a cell and a tag', () => {
        const size = { width: 12, height: 12 };
        const cap = genRoomCapacityAt(size, {}, { locations: 4, exits: 1, listed: 10 });
        expect(cap.gated).toBe(cap.locations);
        expect(cap.locations).toBe(Math.min(genRoomFloorCells(size) - 1, 30) - 6);
        // the demand of 4 item-locations + 6 bare ones: 10 cells and 10 tags
        const locations = [...Array.from({ length: 4 }, (_, i) => ({ id: `i${i}`, item: 'x' })),
            ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, access_rule: { rule: 'True_' } }))];
        expect(locationDemandOf({ locations, exits: [{}] })).toMatchObject({ locations: 4, listed: 10 });
    });
});

describe('⛓⛓ the ceiling is what the room accepts: N seats, N+1 is refused by name', () => {
    it('drawn seed 1 (pre-sword, 10×10, 2 doors): 30 locations seat with 30 distinct tags; 31 is refused, the room untouched', () => {
        const w = genRoom(1);
        expect(ownTags(w)).toBe(0);
        room.placeGenItems(w, items(30));
        expect(w.locations).toHaveLength(30);
        expect(new Set(w.locations.map((l) => l.tag))).toEqual(new Set(Array.from({ length: 30 }, (_, t) => t)));
        const w2 = genRoom(1);
        const before = JSON.stringify({ seed: w2.seed, size: w2.size, generation: w2.generation });
        expect(() => room.placeGenItems(w2, items(31))).toThrow(room.GEN_ROOM_REFUSALS.tagBudget('cap', 31, 30));
        expect(JSON.stringify({ seed: w2.seed, size: w2.size, generation: w2.generation })).toBe(before);
        expect(w2.locations).toEqual([]);
    });

    /**
     * ⛓ RE-AIMED AT SEEDLING SWIM U8 (⚖ Q13). The row was written on the
     * post-sword DEFAULT's draw at seed 29, which landed a kill gate. With the
     * opt-in heads folded in, that list's one `pick` is over nine heads, and no
     * post-sword seed in 1..60 meets the row's whole rule through the default.
     * The tag-spending draws re-roll at 29 already. The subject is the re-roll
     * MECHANISM, not the default, so the row now names its head: `killgate`
     * explicitly. Over seeds 1..40, ONLY seed 31 meets the whole rule (one tag
     * spent, 29 seated at re-roll 0, 30 re-rolled by the locations cause, the
     * deserialized room refused in the tag sentence). A named head also keeps
     * the row still at the next default move.
     *
     * ⛓ RE-SEEDED 31 → 57 (swim planning-3, 2026-10-01): after U9/U10 seed 31's
     * 30-item placement re-rolls 12 times (CI 59.5 s → 65.6 s against the 60 s
     * bound, red at `f20ac752ae`). Over seeds 31..119, the rule is met by 31, 53,
     * 57, 81, 89, 93, 108; 57 is the cheapest (ONE re-roll, 3.2 s for the three
     * draws on the box). A chosen input that turns slow is re-seeded, not re-bounded.
     *
     * ⛓ HAMMER-PHASE A2 — `HAMMER_ESCAPE` ON by default (⚖ user 2026-10-07): the killgate draws re-roll far more
     * with the escape on, and the row TIMED OUT on CI (60 s, `56b5422`). Measured on the box, the whole rule:
     * seed 53 escape off 1 re-roll / 3.2 s, ON 48 re-rolls / 291 s; seed 57 off 3 re-rolls / 7.5 s, ON 51 re-rolls / 315 s.
     * Every seed above still meets the rule with the escape off (31 41 s, 81 104 s, 89 139 s, 93 44 s, 108 246 s).
     * The subject is the re-roll MECHANISM, not the escape, so the row is asked with the escape OFF by the switch.
     *
     * ⛓ HAMMER-PHASE A3 — the escape as a PREFERENCE does not bring the row back ON. Per draw the escape refuses
     * nothing here; it CERTIFIES the kill gates the switch OFF refuses (seed 57's OFF draws k=3, 5; seed 53's k=1), and
     * a refused gate is dropped, which is what lets those draws seat. ON keeps the gate's tag, so the room re-rolls
     * (57: 51 + a growth; 53: 48 + a growth) with or without the fallback, which only ever replaces a refusal.
     */
    const KILLGATE_ROOM = { exits: 1, biome: 'post-sword', elements: 'killgate' };
    it('⛓⛓ a draw whose own element spends a tag is RE-ROLLED like one short of cells (post-sword drawn seed 57, `killgate` named)', () => withHammerEscape(false, () => {
        const w = genRoom(57, KILLGATE_ROOM);
        expect(w.generation.rerolls).toBe(0);
        expect(ownTags(w)).toBe(1);
        // 29 = 30 less the lock's own tag: seated in the first draw
        const a = genRoom(57, KILLGATE_ROOM);
        room.placeGenItems(a, items(29));
        expect(a.generation.rerolls).toBe(0);
        // 30: that draw has 29 tags left, so the room re-rolls — and the next draw seats all 30
        room.placeGenItems(w, items(30));
        expect(w.locations).toHaveLength(30);
        expect(w.generation.rerolls).toBeGreaterThan(0);
        expect(w.generation.rerollCause).toBe(room.GEN_ROOM_REROLL_CAUSES.locations);
        expect(ownTags(w)).toBe(0);
        expect(new Set(w.locations.map((l) => l.tag)).size).toBe(30);
        expect(w.seed).toBe(room.rerollSeed(w.drawnSeed, w.generation.rerolls));
    }));

    it('a deserialized room cannot re-roll: short of tags it refuses in the tag sentence, not the cell one', () => {
        const w = genRoom(57, KILLGATE_ROOM);
        delete w.drawnSeed;
        expect(() => room.placeGenItems(w, items(30)))
            .toThrow(room.GEN_ROOM_REFUSALS.tooFewTags('cap', 30, 29, 30));
    });
});

describe('⛓⛓ Initialise refuses a slot past the ceiling BY NAME, before any build', () => {
    const state = () => withInitialisePatch(INSCRYPTION, P, initialiseFormDefaults(INSCRYPTION, P),
        { substrate: FLASH_SEEDLING_GEN_SUBSTRATE_ID });

    it('the plan names every room past it; the preview is the refusal — the form draws no Generate', () => {
        const st = state();
        expect(st.substrate).toBe(FLASH_SEEDLING_GEN_SUBSTRATE_ID);
        const plan = planInitialise(INSCRYPTION, P, initialiseArgs(P, st));
        expect(plan.overCeiling.map((r) => [r.region, r.demand.listed])).toEqual([['Act 2', 52], ['Act 3', 31]]);
        const pv = initialisePreview(INSCRYPTION, P, st);
        expect(pv.plan).toBeNull();
        expect(pv.refusal).toContain('flash_seedling_gen: at most 30 locations per room (the game\'s 30 persistence '
            + 'tags) — \'Act 2\' lists 52, \'Act 3\' lists 31.');
    });

    it('⛔ the maze (no ceiling) previews the same slot with no refusal', () => {
        const st = withInitialisePatch(INSCRYPTION, P, initialiseFormDefaults(INSCRYPTION, P), { substrate: 'maze' });
        expect(planInitialise(INSCRYPTION, P, initialiseArgs(P, st)).overCeiling).toEqual([]);
        expect(initialisePreview(INSCRYPTION, P, st).refusal).toBeNull();
    });

    it('the op itself (the engine) refuses the first room past it before its core runs', () => {
        const cores = [];
        const base = substrateRegistry.get(FLASH_SEEDLING_GEN_SUBSTRATE_ID);
        substrateRegistry.entries.set(base.id, {
            ...base, generateRegionCore: (input) => { cores.push(input.region_id); return base.generateRegionCore(input); },
        });
        let res;
        try {
            res = initialiseSlot({ doc: structuredClone(INSCRYPTION), ...initialiseArgs(P, state()) });
        } finally {
            substrateRegistry.entries.set(base.id, base);
        }
        expect(res.ok).toBe(false);
        expect(String(res.why ?? res.threw)).toMatch(/flash_seedling_gen: at most 30 locations per room \(the game's 30 persistence tags\) — 'Act [23]' lists (52|31)/);
        expect(cores).not.toContain('Act 2');
        expect(cores).not.toContain('Act 3');
    });
});
