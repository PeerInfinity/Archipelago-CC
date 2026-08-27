// Rows for the TOP-DOWN stepped runner's recorded layout edits (B-d).
//
// verify-topdown-steps.mjs already pins "stepped runner == monolith" and the
// codec round-trip; these are the edit-list rows, which are what the layout
// editor never had. The load-bearing one is `replays AFTER ③, never before`:
// finalizeTopDown reads layout.cellsByName, so an edit applied before it would
// double-apply back-exits — the reason the panel's top-down write-back depth
// deliberately keeps ③ and drops only ④.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

// Side-effect: register the substrates the steps dispatch through.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import { topDownFromRulesJson } from './procgenPipelineEngine.js';
import {
    TOPDOWN_STEPS, newTopDownEnvelope, runTopDownToStep, resumeTDEnvelope,
    serializeTDEnvelope, deserializeTDEnvelope,
    TD_EDIT_BINDING, invalidateTDFrom, topDownUndoStep, topDownReRollCount,
} from './topDownSteps.js';
import { pushLayoutEdit, popLayoutEdit, replayLayoutEdits } from './layoutEdits.js';

// The same synthetic source verify-topdown-steps.mjs uses: a Menu, a hub, three
// children and one gated deep room.
function mazeSource() {
    const reg = (name, exits, locs) => ({ name, exits, locations: locs });
    const has = (item) => ({ rule: 'Has', args: { item_name: item } });
    const T = { rule: 'True_' };
    return {
        start_regions: { 1: { default: ['Menu'] } },
        assume_bidirectional_exits: true,
        game_name: 'MazeStepCheck',
        regions: {
            1: {
                Menu: reg('Menu', [{ name: 'GameStart', connected_region: 'Hub', access_rule: T }], []),
                Hub: reg('Hub', [
                    { name: 'toN', connected_region: 'North', access_rule: T },
                    { name: 'toE', connected_region: 'East', access_rule: T },
                    { name: 'toW', connected_region: 'West', access_rule: T },
                ], [{ name: 'Hub_Chest', item: { name: 'key_red' } }]),
                North: reg('North', [{ name: 'toDeep', connected_region: 'Deep', access_rule: has('key_red') }],
                    [{ name: 'North_A', item: { name: 'key_blue' } }, { name: 'North_B', item: { name: 'f1' } }]),
                East: reg('East', [], [{ name: 'East_A', item: { name: 'Victory' } }]),
                West: reg('West', [{ name: 'toDeep2', connected_region: 'Deep', access_rule: has('key_blue') }],
                    [{ name: 'West_A', item: { name: 'f3' } }]),
                Deep: reg('Deep', [], [{ name: 'Deep_A', item: { name: 'f4' } }]),
            },
        },
    };
}

const OPTS = () => ({
    gridDims: { width: 4, height: 4 },
    regionSizeBase: { width: 6, height: 6 },
    seed: 1,
    substrateMix: { maze: 1 },
});

function makeEnv(opts = OPTS()) {
    const source = mazeSource();
    return newTopDownEnvelope({
        source,
        opts,
        regionSize: { ...opts.regionSizeBase },
        compileIn: {
            seed: opts.seed,
            enableLoopMode: false,
            regionXpEffect: 'cost',
            assumeBidirectional: true,
            startingItems: [],
            grantedItems: [],
            sourceItemDefs: {},
            sourceGameName: source.game_name,
            sphereLog: null,
        },
    });
}

// Hash placement AND interior — a re-roll changes only the payload (top-down
// rooms run with maxIterations 0, so extracted_rules alone would not move).
const gridSha = (grid) => createHash('sha256').update(JSON.stringify(
    grid.allRegions()
        .map((r) => [r.region_id, r.cell.gx, r.cell.gy,
            JSON.stringify(r.extracted_rules), JSON.stringify(r.playable_payload)])
        .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
)).digest('hex');

function emptyCell(grid) {
    for (let gy = 0; gy < grid.height; gy += 1) {
        for (let gx = 0; gx < grid.width; gx += 1) {
            if (!grid.hasRegion({ gx, gy })) return { gx, gy };
        }
    }
    return null;
}

const liveCell = (grid, id) => ({ ...grid.allRegions().find((r) => r.region_id === id).cell });

describe('topDownSteps — recorded layout edits', () => {
    it('an unedited envelope still reproduces the monolith (byte-identity)', async () => {
        const opts = OPTS();
        const mono = topDownFromRulesJson(mazeSource(), opts);
        const env = makeEnv(opts);
        env.edits = [];
        await runTopDownToStep(env, 'compile');
        expect(gridSha(env.finalize.grid)).toBe(gridSha(mono.grid));
        expect(JSON.stringify(env.finalize.stats)).toBe(JSON.stringify(mono.stats));
    });

    it('a recorded move REPLAYS from source + seed + edits alone', async () => {
        const clean = makeEnv();
        await runTopDownToStep(clean, 'compile');
        const cleanSha = gridSha(clean.finalize.grid);

        const live = makeEnv();
        await runTopDownToStep(live, 'finalize');
        const edit = {
            op: 'move-region',
            from: liveCell(live.finalize.grid, 'East'),
            to: emptyCell(live.finalize.grid),
        };
        expect(pushLayoutEdit(live, edit, TD_EDIT_BINDING).ok).toBe(true);
        await runTopDownToStep(live, 'compile');
        expect(gridSha(live.finalize.grid)).not.toBe(cleanSha);

        const replayed = makeEnv();
        replayed.edits = [edit];
        await runTopDownToStep(replayed, 'compile');
        expect(gridSha(replayed.finalize.grid)).toBe(gridSha(live.finalize.grid));
        expect(JSON.stringify(replayed.compile.rulesJson))
            .toBe(JSON.stringify(live.compile.rulesJson));
    });

    // §1's load-bearing measurement: ③ must see the UNMOVED placement.
    it('a layout edit replays AFTER ③, so finalize s own output is untouched', async () => {
        const clean = makeEnv();
        await runTopDownToStep(clean, 'compile');

        const edited = makeEnv();
        edited.edits = [{
            op: 'move-region', from: { gx: 0, gy: 0 }, to: { gx: 0, gy: 0 },
        }];
        // Resolve the edit against the real placement, then run it end to end.
        const probe = makeEnv();
        await runTopDownToStep(probe, 'finalize');
        edited.edits = [{
            op: 'move-region',
            from: liveCell(probe.finalize.grid, 'East'),
            to: emptyCell(probe.finalize.grid),
        }];
        await runTopDownToStep(edited, 'compile');

        // finalize's stats + teleporter edges are computed from cellsByName,
        // which the move deliberately leaves alone: they must MATCH the clean
        // run. An edit applied before ③ would move them.
        expect(JSON.stringify(edited.finalize.stats))
            .toBe(JSON.stringify(clean.finalize.stats));
        // …while the compiled world, which reads only the grid, differs.
        expect(JSON.stringify(edited.compile.rulesJson))
            .not.toBe(JSON.stringify(clean.compile.rulesJson));
    });

    it('the start cell follows a moved start region', async () => {
        const env = makeEnv();
        await runTopDownToStep(env, 'finalize');
        const startName = env.layout.actualStartName;
        const r = pushLayoutEdit(env, {
            op: 'move-region',
            from: liveCell(env.finalize.grid, startName),
            to: emptyCell(env.finalize.grid),
        }, TD_EDIT_BINDING);
        expect(r.ok).toBe(true);
        expect(env.finalize.startCell).toEqual(liveCell(env.finalize.grid, startName));
    });

    it('re-roll stages at ① and composes in list order', async () => {
        const clean = makeEnv();
        await runTopDownToStep(clean, 'compile');
        const cleanSeed = clean.layout.subSeedByRegion.East;

        const one = makeEnv();
        one.edits = [{ op: 're-roll', region_id: 'East', n: 1 }];
        await runTopDownToStep(one, 'compile');
        expect(one.layout.subSeedByRegion.East).not.toBe(cleanSeed);
        expect(gridSha(one.finalize.grid)).not.toBe(gridSha(clean.finalize.grid));

        // Two re-rolls COMPOSE: the second bumps the first's result, so the
        // list — not a session counter — is what determines the sub-seed.
        const two = makeEnv();
        two.edits = [
            { op: 're-roll', region_id: 'East', n: 1 },
            { op: 're-roll', region_id: 'East', n: 2 },
        ];
        await runTopDownToStep(two, 'compile');
        expect(two.layout.subSeedByRegion.East).not.toBe(one.layout.subSeedByRegion.East);
        expect(two.layout.subSeedByRegion.East).not.toBe(cleanSeed);
        // ⚠ Measured: on THIS 6×6 room the composed sub-seed happens to realise
        // the same maze as the unedited one — a collision in a small room space,
        // not a replay failure. So the claim is pinned on the SUB-SEED, which is
        // what the recording determines, and on the grid only where the room
        // space actually separates them (the single re-roll above).
        expect(gridSha(two.finalize.grid)).not.toBe(gridSha(one.finalize.grid));

        // Deterministic: the SAME list reproduces the same world.
        const again = makeEnv();
        again.edits = [...two.edits];
        await runTopDownToStep(again, 'compile');
        expect(gridSha(again.finalize.grid)).toBe(gridSha(two.finalize.grid));
        expect(again.layout.subSeedByRegion.East).toBe(two.layout.subSeedByRegion.East);

        expect(topDownReRollCount(two, 'East')).toBe(2);
        expect(topDownReRollCount(two, 'West')).toBe(0);
    });

    // 'West' (not the leaf 'East'): a bounce region needs at least one exit spec.
    it('set-substrate stages at ① and re-realises that region only', async () => {
        const clean = makeEnv();
        await runTopDownToStep(clean, 'compile');
        expect(clean.finalize.grid.allRegions().find((r) => r.region_id === 'West').substrate)
            .toBe('maze');

        const env = makeEnv();
        env.edits = [{ op: 'set-substrate', region_id: 'West', substrate: 'bounce' }];
        await runTopDownToStep(env, 'compile');
        expect(env.layout.substrateByRegion.West).toBe('bounce');
        expect(env.finalize.grid.allRegions().find((r) => r.region_id === 'West').substrate)
            .toBe('bounce');
        // Regions are sub-seed decoupled, so a leaf on another branch is untouched.
        const sib = (e) => JSON.stringify(
            e.finalize.grid.allRegions().find((r) => r.region_id === 'East').playable_payload,
        );
        expect(sib(env)).toBe(sib(clean));
    });

    it('N edits → undo ×N → the never-edited world, byte for byte', async () => {
        const clean = makeEnv();
        await runTopDownToStep(clean, 'compile');
        const cleanSha = gridSha(clean.finalize.grid);

        const env = makeEnv();
        await runTopDownToStep(env, 'finalize');
        pushLayoutEdit(env, {
            op: 'move-region',
            from: liveCell(env.finalize.grid, 'East'),
            to: emptyCell(env.finalize.grid),
        }, TD_EDIT_BINDING);
        pushLayoutEdit(env, {
            op: 'swap-regions',
            a: liveCell(env.finalize.grid, 'North'),
            b: liveCell(env.finalize.grid, 'West'),
        }, TD_EDIT_BINDING);
        await runTopDownToStep(env, 'compile');
        expect(gridSha(env.finalize.grid)).not.toBe(cleanSha);

        for (let i = 0; i < 2; i += 1) {
            const popped = popLayoutEdit(env, TD_EDIT_BINDING);
            // A top-down layout edit rewinds to ① — the grid it moved regions on
            // is created there, and there is no cheaper clean slate.
            expect(topDownUndoStep(popped.edit)).toBe('layout');
            invalidateTDFrom(env, 'layout');
            // eslint-disable-next-line no-await-in-loop
            await resumeTDEnvelope(env, 'compile');
        }
        expect(env.edits).toHaveLength(0);
        expect(gridSha(env.finalize.grid)).toBe(cleanSha);
        expect(JSON.stringify(env.compile.rulesJson))
            .toBe(JSON.stringify(clean.compile.rulesJson));
        expect(env.completed).toBe(TOPDOWN_STEPS.length - 1);
    });

    it('undoing a ①-staged edit rewinds to ①, dropping the grid ②③ alias', async () => {
        const env = makeEnv();
        await runTopDownToStep(env, 'compile');
        env.edits = [{ op: 'set-substrate', region_id: 'East', substrate: 'maze' }];
        const popped = popLayoutEdit(env, TD_EDIT_BINDING);
        expect(popped.stage).toBe('layout');
        invalidateTDFrom(env, 'layout');
        expect(env.layout).toBeNull();
        expect(env.realise).toBeNull();
        expect(env.finalize).toBeNull();
        expect(env.completed).toBe(-1);
    });

    it('the codec carries the recording across a serialise/deserialise boundary', async () => {
        const env = makeEnv();
        await runTopDownToStep(env, 'finalize');
        pushLayoutEdit(env, {
            op: 'move-region',
            from: liveCell(env.finalize.grid, 'East'),
            to: emptyCell(env.finalize.grid),
        }, TD_EDIT_BINDING);
        const round = deserializeTDEnvelope(JSON.parse(JSON.stringify(serializeTDEnvelope(env))));
        expect(round.edits).toEqual(env.edits);
        await runTopDownToStep(round, 'compile');
        await runTopDownToStep(env, 'compile');
        expect(gridSha(round.finalize.grid)).toBe(gridSha(env.finalize.grid));
    });

    it('an exit-side op on a maze region refuses BY NAME (zone substrates only)', async () => {
        const env = makeEnv();
        await runTopDownToStep(env, 'finalize');
        const before = gridSha(env.finalize.grid);
        const r = pushLayoutEdit(env, {
            op: 'move-exit-side', cell: liveCell(env.finalize.grid, 'Hub'), exitId: 'toN', side: 'S',
        }, TD_EDIT_BINDING);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/zone substrates/);
        expect(env.edits ?? []).toHaveLength(0);
        expect(gridSha(env.finalize.grid)).toBe(before);
    });

    it('a stale recorded edit makes the REPLAY throw, not silently drop', async () => {
        const env = makeEnv();
        await runTopDownToStep(env, 'finalize');
        // Address a cell the layout left EMPTY — the shape a recording takes
        // when the source (or the grid dims) changed under it.
        const stale = emptyCell(env.finalize.grid);
        env.edits = [{ op: 'move-region', from: stale, to: { ...stale, gx: stale.gx } }];
        env.edits = [{ op: 'move-region', from: stale, to: emptyCell(env.finalize.grid) }];
        expect(() => replayLayoutEdits(env, 'finalize', TD_EDIT_BINDING))
            .toThrow(/edit #0 \(move-region\) refused after step 'finalize'/);
    });

    it('the exit-side ops size a region from layout.uniformSize, not the base', async () => {
        const env = makeEnv();
        await runTopDownToStep(env, 'layout');
        // The hub has 3 exits + a location, so layoutTopDown widened the 6x6 base.
        expect(env.layout.uniformSize.width).toBeGreaterThanOrEqual(env.regionSize.width);
        expect(TD_EDIT_BINDING.regionSize(env)).toEqual(env.layout.uniformSize);
    });
});
