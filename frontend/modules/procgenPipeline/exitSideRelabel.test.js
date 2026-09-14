/**
 * procgenPipeline — **THE PIPELINE'S MOVE EXIT THROUGH THE DECLARED RELABEL**
 * (PIPELINE RELAYOUT R2): `moveSphereExitSide` / `swapSphereExitSides` rewrite a
 * region's payload with its substrate's `exitSides.relabel`
 * (`procgenCore/exitSides.js`), and a side that already carries an exit takes
 * another iff `sideMayHoldAnotherExit` says so.
 *
 * ⛓ Worlds: `check-region-step-editing.mjs`'s own bounce sphere world (every
 * region a zone), and a small top-down world whose hub is a text adventure.
 * Regions are picked off the built grid by the law (a back exit, a
 * `backExitSide` carrier, two exits on different sides), never by id.
 */
import { describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import {
    prepareBounceSphereGrowth, buildBounceRegionParams, DEFAULT_BOUNCE_PROCGEN_PARAMS,
} from '../bounceDemo/bounceProcgenParams.js';
import { planSpheres } from './spherePlanner.js';
import {
    DEFAULT_REGION_SIZE, buildRulesJson, getRegionExits, growSpheres, moveSphereExitSide, regionExitSides,
    swapSphereExitSides, topDownFromRulesJson,
} from './procgenPipelineEngine.js';
import { SIDE_SHARING } from '../procgenCore/exitSides.js';

const SIDES = ['N', 'S', 'E', 'W'];
const exitsOf = (region) => [...getRegionExits(region).values()];
const bytes = (o) => JSON.stringify(o);

/** `check-region-step-editing.mjs`'s `buildWorld()`: a bounce sphere world, every region a zone. */
function bounceWorld() {
    const itemPool = {
        'Right arrow': 1, 'Left arrow': 1, Springs: 1, Jetpacks: 1, 'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
    };
    const seed = 1;
    const prep = prepareBounceSphereGrowth({ itemPool, seed, params: DEFAULT_BOUNCE_PROCGEN_PARAMS });
    const plan = planSpheres({
        itemPool: prep.itemPool ?? itemPool, sphereCount: 3, seed, exclusiveSpheres: prep.exclusiveSpheres,
        startingItems: prep.startingItems ?? [], victoryItem: 'Victory',
    });
    const regionParams = {
        ...buildBounceRegionParams({ params: DEFAULT_BOUNCE_PROCGEN_PARAMS, mode: 'sphere' }), ...(prep.regionParams ?? {}),
    };
    return growSpheres({
        regionSize: DEFAULT_REGION_SIZE, itemLib: prep.itemLib, seed, regionParams,
        growthParams: {
            spherePlan: plan, maxItemsPerRegion: 2, fillerCount: 0, revisitRatio: 0.25,
            substrateQuotas: { bounce: 99 }, startSubstrate: 'bounce',
        },
    });
}

/** The first region (grid order) passing `pick(region, exits)`. */
const regionWhere = (grid, pick) => grid.allRegions().find((r) => pick(r, exitsOf(r))) ?? null;
const freeSideOf = (region) => SIDES.find((s) => !exitsOf(region).some((e) => e.side === s));

describe('⛓⛓ a ZONE region — the declared relabel (keyed: `params.sidePortals`)', () => {
    it('the world is the law\'s: its zone regions declare keys, so a side holds one exit', () => {
        const { grid } = bounceWorld();
        const r = regionWhere(grid, (_r, l) => l.length > 1);
        expect(r).not.toBeNull();
        expect(regionExitSides(r).sharing.reason).toBe(SIDE_SHARING.KEYED);
    });

    it('a forward exit moved to a FREE side and back: `playable_payload` byte-identical, INCLUDING the '
        + 'portal map\'s key order (the M3 §22.9 #1 defect)', () => {
        const { grid } = bounceWorld();
        // ⛔ The exit's side must NOT be the portal map's LAST key: a delete + append of the last key
        //   leaves the order as it was, and the row could not tell the two builds apart.
        const notLast = (reg, e) => {
            const keys = Object.keys(reg.playable_payload?.params?.sidePortals ?? {});
            return keys.includes(e.side) && keys.indexOf(e.side) < keys.length - 1;
        };
        const r = regionWhere(grid, (reg, l) => l.some((e) => !e.isBackExit && notLast(reg, e))
            && SIDES.some((s) => !l.some((e) => e.side === s)));
        expect(r).not.toBeNull();
        const before = bytes(r.playable_payload);
        const keysBefore = Object.keys(r.playable_payload.params.sidePortals);
        const fwd = exitsOf(r).find((e) => !e.isBackExit && notLast(r, e));
        const from = fwd.side;
        const to = freeSideOf(r);
        moveSphereExitSide(grid, r.cell, fwd.exit_id, to, DEFAULT_REGION_SIZE);
        const moved = grid.getRegion(r.cell).playable_payload.params.sidePortals;
        expect(Object.keys(moved)).toEqual(keysBefore.map((k) => (k === from ? to : k)));
        moveSphereExitSide(grid, r.cell, fwd.exit_id, from, DEFAULT_REGION_SIZE);
        expect(Object.keys(grid.getRegion(r.cell).playable_payload.params.sidePortals)).toEqual(keysBefore);
        expect(bytes(grid.getRegion(r.cell).playable_payload)).toBe(before);
    });

    it('a swap swapped back is byte-identical too', () => {
        const { grid } = bounceWorld();
        const r = regionWhere(grid, (_r, l) => l.length > 1 && l[0].side !== l[1].side);
        const before = bytes(r.playable_payload);
        const [a, b] = exitsOf(r);
        const sideB = b.side;
        swapSphereExitSides(grid, r.cell, a.exit_id, b.exit_id, DEFAULT_REGION_SIZE);
        expect(getRegionExits(grid.getRegion(r.cell)).get(a.exit_id).side).toBe(sideB);
        swapSphereExitSides(grid, r.cell, a.exit_id, b.exit_id, DEFAULT_REGION_SIZE);
        expect(bytes(grid.getRegion(r.cell).playable_payload)).toBe(before);
    });

    it('a moved BACK exit carries `params.backExitSide` with it', () => {
        const { grid } = bounceWorld();
        const r = regionWhere(grid, (reg, l) => Object.hasOwn(reg.playable_payload?.params ?? {}, 'backExitSide')
            && l.some((e) => e.isBackExit) && SIDES.some((s) => !l.some((e) => e.side === s)));
        expect(r).not.toBeNull();
        const back = exitsOf(r).find((e) => e.isBackExit);
        expect(r.playable_payload.params.backExitSide).toBe(back.side);
        const to = freeSideOf(r);
        moveSphereExitSide(grid, r.cell, back.exit_id, to, DEFAULT_REGION_SIZE);
        expect(grid.getRegion(r.cell).playable_payload.params.backExitSide).toBe(to);
    });

    it('⛔ onto a side another exit holds: REFUSED with the sentence it always had, nothing written', () => {
        const { grid } = bounceWorld();
        const r = regionWhere(grid, (_r, l) => l.length > 1 && l[0].side !== l[1].side);
        const [a, b] = exitsOf(r);
        const before = bytes({ p: r.playable_payload, e: exitsOf(r), placed: r.exits_placed });
        expect(() => moveSphereExitSide(grid, r.cell, a.exit_id, b.side, DEFAULT_REGION_SIZE))
            .toThrow(`moveSphereExitSide: side ${b.side} already has an exit`);
        const after = grid.getRegion(r.cell);
        expect(bytes({ p: after.playable_payload, e: exitsOf(after), placed: after.exits_placed })).toBe(before);
    });
});

/** A top-down world whose Hub — three exits — is a text adventure. */
function textAdventureTopDown() {
    const T = { rule: 'True_' };
    const source = {
        start_regions: { 1: { default: ['Menu'] } },
        assume_bidirectional_exits: true,
        game_name: 'R2TextAdventureTopDown',
        regions: {
            1: {
                Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: T }], locations: [] },
                Hub: {
                    name: 'Hub',
                    exits: [
                        { name: 'toNorth', connected_region: 'North', access_rule: T },
                        { name: 'toEast', connected_region: 'East', access_rule: T },
                        { name: 'toWest', connected_region: 'West', access_rule: T },
                    ],
                    locations: [{ name: 'Hub_Chest', item: { name: 'key_red' } }],
                },
                North: { name: 'North', exits: [], locations: [{ name: 'North_A', item: { name: 'Victory' } }] },
                East: { name: 'East', exits: [], locations: [{ name: 'East_A', item: { name: 'f1' } }] },
                West: { name: 'West', exits: [], locations: [{ name: 'West_A', item: { name: 'f2' } }] },
            },
        },
    };
    const res = topDownFromRulesJson(source, {
        gridDims: { width: 5, height: 5 }, seed: 1,
        substrateByRegion: { Menu: 'maze', Hub: 'text_adventure', North: 'maze', East: 'maze', West: 'maze' },
    });
    const compile = () => buildRulesJson(res.grid, {
        startCell: res.startCell, seed: 1, embedSphereLog: false, assumeBidirectional: true,
    });
    return { ...res, compile };
}

/** Every region's exits as `name → connected_region`, from a compiled rules.json. */
const linksOf = (rj) => Object.fromEntries(Object.entries(rj.regions['1']).map(([name, r]) => [name,
    Object.fromEntries((r.exits ?? []).map((e) => [e.name, e.connected_region]))]));

describe('⛓⛓ a TEXT-ADVENTURE region — the declaration keys nothing by side', () => {
    it('an exit moved onto a side another exit holds is ACCEPTED: both exits on it, the compiled '
        + '`connected_region`s unchanged', () => {
        const world = textAdventureTopDown();
        const r = regionWhere(world.grid, (reg, l) => reg.substrate === 'text_adventure'
            && l.some((a) => l.some((b) => a.side && b.side && a.side !== b.side)));
        expect(r, 'no text-adventure region with exits on two sides').not.toBeNull();
        expect(regionExitSides(r).sharing.may).toBe(true);
        const links = linksOf(world.compile());
        const l = exitsOf(r);
        const a = l.find((x) => x.side);
        const b = l.find((x) => x.side && x.side !== a.side);
        moveSphereExitSide(world.grid, r.cell, a.exit_id, b.side, DEFAULT_REGION_SIZE);
        const onSide = exitsOf(world.grid.getRegion(r.cell)).filter((x) => x.side === b.side).map((x) => x.exit_id);
        expect(onSide).toContain(a.exit_id);
        expect(onSide).toContain(b.exit_id);
        expect(linksOf(world.compile())).toEqual(links);
    });
});
