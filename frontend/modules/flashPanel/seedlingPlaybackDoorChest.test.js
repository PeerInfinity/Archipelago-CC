/**
 * ⛓⛓ seedling-js-playback-door-chest-goal — **THE PLAYBACK BOT TAKES A DOOR CHEST AS ITS GOAL.**
 *
 * `seedling-gen-chestdoor-ap` made each generated door chest an AP location (`<region> - Chest`) and kept it
 * OUT of `report.apitems` (the wiring counts replacements): the set's report carries it in `report.chestDoors`.
 * Before this slice `resolveSeedlingGoal` read `apitems` only, the JS page's `validateGoal` accepted a mounted
 * set's location only as an apitem, and the walk-tape instrument (`wasmWalkTape.walkTapeFromStaging`) likewise.
 *
 *   · THE GOAL — a door chest resolves to `{kind: 'location', level, tag, entityType: 'chest', name}`: the
 *     chest's FIXED tag, and the entity named, so every consumer finds the CHEST (`locationEntityOf`), as in a
 *     real room. The solver maps it to `collect-placement` at the chest's placement (`arrivalSolverGoal` /
 *     `solverGoalFor`, unchanged) and plans it with its existing `chest` strategy; the walker walks to the
 *     chest's stance band (`locationPointOf`, from BELOW). The certificate's `[chest, collect]` route is the
 *     proof a stance below the chest is reachable; the chest IS the door, so opening it is the walk.
 *   · ⛔ IDENTITY — a world without a door chest resolves, and tapes, BYTE-IDENTICALLY (digests measured at the
 *     base before the change, `65c9ea5590`): apitem goals carry no `entityType`, so nothing they reach moved.
 *   · END TO END on the JS runtime — the controller over a live page, solver ON and OFF: the chest opens, the
 *     page reports `pendingCheck`, the check binding turns it into `locationCheck` for `region_0_0 - Chest`.
 *   · the walk-tape instrument walks it too, ending ON the chest's clear (`end: 'opened'`).
 *   · ⛔ a name that is neither an apitem nor a door chest refuses by the same name as before.
 *
 * Mutants (measured, each reverted — the slice's report lists them).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import { resolveSeedlingGoal, SeedlingPlaybackController } from './seedlingPlaybackController.js';
import { SeedlingCheckBinding } from './seedlingCheckBinding.js';
import { assembleGeneratedSeedlingSet } from '../seedlingDemo/seedlingGeneratedSet.js';
import { placementKey } from '../seedlingDemo/apPlacementRewriter.js';
import { mountedRecordsOf, walkTapeFromStaging, WalkTapeRefusal } from '../seedlingDemo/wasmWalkTape.js';
import { levelSourceFromAtlas } from '../seedlingDemo/atlasSource.js';
import { planLevelSetChunks } from '../seedlingDemo/levelSetValidator.js';
import { createJsRuntime, JS_RUNTIME_PINS } from '../seedlingDemo/jsRuntimeCore.js';
import { bootStaging } from '../seedlingDemo/procgenOracle.js';
import { ITEM_PROPERTIES } from '../seedlingDemo/tapeFormat.js';
import { buildLevelWorld } from '../seedlingDemo/levelWorld.js';
import { WALK_STATES } from '../seedlingDemo/jsRuntimeWalker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const FLAGS = Object.fromEntries(Object.values(ITEM_PROPERTIES).map((s) => [s.property, s.kind === 'add' ? s.base : false]));
const PRESETS = ['seedling_generated_room', 'seedling_generated_leaf', 'seedling_generated_host', 'seedling_generated_swim'];
const NOT_A_LOCATION = (name) => `"${name}" is not an AP location of the generated Seedling rooms`;
const stagingAt = (boot) => bootStaging({ boot, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });

/** The committed generated-room world with every generated room asked for a door chest (chestdoor-ap's world). */
const CHEST_STATE = Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
    params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: 'chestdoor' }) });
let chest = null;
beforeAll(async () => {
    const rules = (await runPresetHeadless(buildRunFromState(structuredClone(CHEST_STATE)))).rulesJson;
    const assembled = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
    const records = mountedRecordsOf(assembled.set);
    chest = { assembled, records, levelSource: levelSourceFromAtlas(records) };
}, 120_000);

describe('resolveSeedlingGoal — a door chest is a goal', () => {
    it('each `<region> - Chest` resolves to its room, its FIXED tag and the entity it is (a chest)', () => {
        const { report } = chest.assembled;
        expect(report.chestDoors.map((c) => c.location)).toEqual(['region_0_0 - Chest', 'region_0_1 - Chest']);
        for (const c of report.chestDoors) {
            expect(resolveSeedlingGoal({ kind: 'location', name: c.location }, report))
                .toEqual({ goal: { kind: 'location', level: c.room, tag: c.tag, entityType: 'chest', name: c.location } });
        }
        // the apitem beside it keeps the apitem shape (no entity named)
        expect(resolveSeedlingGoal({ kind: 'location', name: 'region_0_0__key_blue_pickup' }, report))
            .toEqual({ goal: { kind: 'location', level: 0, tag: 0, name: 'region_0_0__key_blue_pickup' } });
    });

    it('⛔ a name that is neither an apitem nor a door chest refuses by name, as it did', () => {
        expect(resolveSeedlingGoal({ kind: 'location', name: 'Nowhere' }, chest.assembled.report))
            .toEqual({ refused: NOT_A_LOCATION('Nowhere') });
        // a world WITHOUT a door chest: the chest-shaped name is no location of it
        const { report } = assembleGeneratedSeedlingSet(readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'), { selfPlayer: 1 });
        expect('chestDoors' in report).toBe(false);
        expect(resolveSeedlingGoal({ kind: 'location', name: 'region_0_0 - Chest' }, report))
            .toEqual({ refused: NOT_A_LOCATION('region_0_0 - Chest') });
    });
});

describe('⛔ IDENTITY — a world without a door chest resolves and tapes BYTE-IDENTICALLY', () => {
    /** sha256 (16 hex) of every resolved target × live level, and of every walker tape — measured at `65c9ea5590`. */
    const BASE = {
        seedling_generated_room: { resolved: [48, '0f328447ba81f9c5'], tapes: [54, 'd1b6bbb59b7840ee'] },
        seedling_generated_leaf: { resolved: [21, '2e31c1065414a1d9'], tapes: [10, 'ba5acc63683fc948'] },
        seedling_generated_host: { resolved: [21, '1cc05550429156d3'], tapes: [10, '605c72ec430c6777'] },
        seedling_generated_swim: { resolved: [21, '5338400059fbe52e'], tapes: [10, 'fd399d71b9d6aae3'] },
    };
    const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
    it.each(PRESETS)('%s', (name) => {
        const { report, set } = assembleGeneratedSeedlingSet(readJson(`frontend/presets/${name}/AP_1/AP_1_rules.json`), { selfPlayer: 1 });
        const records = mountedRecordsOf(set);
        const levelSource = levelSourceFromAtlas(records);
        const targets = [
            ...report.apitems.map((a) => ({ kind: 'location', name: a.location })),
            ...report.doors.flatMap((d) => [`${d.region}__${d.exitName}`, `${d.region}__${d.exit_id}`, d.exitName]
                .map((n) => ({ kind: 'exit', name: n }))),
            { kind: 'location', name: 'Nowhere' }, { kind: 'location', name: `${report.doors[0].region} - Chest` },
            { kind: 'tile', x: 1, y: 1 }];
        const resolved = targets.flatMap((t) => [null, 0, 1].map((lv) => [t, lv, resolveSeedlingGoal(t, report, { liveLevel: lv })]));
        const goals = resolved.map(([, , r]) => r.goal).filter((g) => g && g.kind !== 'tile');
        const arrivals = [{ ...set.start }];
        for (const [, rec] of records) {
            for (const tp of buildLevelWorld(rec).teleporters) arrivals.push({ level: tp.to, x: tp.arrival.x - 8, y: tp.arrival.y - 8 });
        }
        const tapes = [];
        for (const a of arrivals.filter((x) => records.has(x.level))) {
            for (const g of goals.filter((x) => x.level === a.level)) {
                try {
                    const p = walkTapeFromStaging({ staging: stagingAt(a), levelSource, records, goal: g, clock: () => 0 });
                    tapes.push([a, g, p.end, p.solution.map((s) => [...s].sort()), p.expected]);
                } catch (e) { tapes.push([a, g, 'refused', e.message]); }
            }
        }
        expect({ resolved: [resolved.length, h(resolved)], tapes: [tapes.length, h(tapes)] }).toEqual(BASE[name]);
    }, 60_000);
});

/** The chest world mounted on a fresh JS page as the host delivers it, booted at the set's start. */
function livePage() {
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    for (const c of planLevelSetChunks(chest.assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
    const { level, x, y } = chest.assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick(new Set());
    reports.length = 0;
    return { rt, reports };
}

describe('END TO END on the JS runtime — the Playback Bot walks to a door chest; its locationCheck fires', () => {
    it.each([['solver ON', true], ['solver OFF (the walker)', false]])('%s: `region_0_0 - Chest` opened, checked, reported', (_label, solverWalk) => {
        const { rt, reports } = livePage();
        const { report, table } = chest.assembled;
        const c = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'js', report, jsRuntime: rt, solverWalk }) });
        expect(c.walkTo({ kind: 'location', name: 'region_0_0 - Chest' })).toBe(true);
        expect(c.lastRefusal).toBeNull();
        c.play();
        for (let t = 0; t < 3000 && ![WALK_STATES.DONE, WALK_STATES.FAILED].includes(rt.playback.state); t += 1) {
            expect(rt.tick(new Set()).halted ?? null).toBeNull();
        }
        expect(rt.playback.state, rt.playback.reason).toBe(WALK_STATES.DONE);
        const door = report.chestDoors.find((x) => x.location === 'region_0_0 - Chest');
        if (solverWalk) {
            expect(rt.playback.solverStats.lastSolve.goal).toEqual({ kind: 'collect-placement',
                placement: { x: door.cell.tx * 16, y: door.cell.ty * 16 } });
            expect(rt.playback.solverStats.lastSolve.verbs).toContain('chest');
            expect(rt.playback.solverStats).toMatchObject({ declines: 0 });
        } else {
            expect(rt.playback.solverStats.solves ?? 0).toBe(0);
        }
        // the CHEST opened (its fixed slot cleared) — no apitem was taken
        expect(JSON.parse(rt.game.botStatus()).persistence_cleared).toContainEqual({ level: door.room, tag: door.tag });
        expect(rt.collected.size).toBe(0);
        const checks = reports.filter(([p, v]) => p === 'pendingCheck' && v).map(([, v]) => v);
        expect(checks).toEqual([`1|${door.room}|${door.tag}|0`]);
        const binding = new SeedlingCheckBinding({ table, placementKey, selfPlayer: 1 });
        expect(binding.onStateReport('pendingCheck', checks[0])[0]).toMatchObject({ type: 'locationCheck',
            location: 'region_0_0 - Chest', ledgerId: 'region_0_0 - Chest', level: door.room, tag: door.tag });
        expect(rt.deaths).toEqual([]);
    }, 60_000);

    it('⛔ a door-chest goal whose tag holds no chest is refused BY NAME by the page (never walked)', () => {
        const { rt } = livePage();
        expect(rt.playback.walkTo({ kind: 'location', level: 0, tag: 9, entityType: 'chest', name: 'x' }))
            .toEqual({ ok: false, reason: 'level 0 has no chest with tag 9' });
        // a goal naming no entity stays apitem-only (the old rule, its old words)
        expect(rt.playback.walkTo({ kind: 'location', level: 0, tag: 1 }))
            .toEqual({ ok: false, reason: 'level 0 has no apitem with tag 1' });
    });
});

describe('the walk-tape instrument takes the same goal', () => {
    it('`walkTapeFromStaging` walks to the chest\'s stance and ends ON its clear (`opened`)', () => {
        const { goal } = resolveSeedlingGoal({ kind: 'location', name: 'region_0_0 - Chest' }, chest.assembled.report);
        const p = walkTapeFromStaging({ staging: stagingAt({ ...chest.assembled.set.start }), levelSource: chest.levelSource,
            records: chest.records, goal, clock: () => 0 });
        expect(p.end).toBe('opened');
        expect(p.expected.at(-1).level).toBe(goal.level);
        expect(p.expected.at(-1).deaths).toBe(0);
        // ⛓ the chest is reached from the SOUTH: the stance is strictly below the chest's cell
        const door = chest.assembled.report.chestDoors[0];
        expect(p.expected.at(-1).y).toBeGreaterThan(door.cell.ty * 16 + 16);
    });

    it('⛔ a door-chest goal whose tag holds no chest refuses by name', () => {
        const goal = { kind: 'location', level: 0, tag: 9, entityType: 'chest', name: 'x' };
        const walk = () => walkTapeFromStaging({ staging: stagingAt({ ...chest.assembled.set.start }), levelSource: chest.levelSource,
            records: chest.records, goal, clock: () => 0 });
        expect(walk).toThrow(WalkTapeRefusal);
        expect(walk).toThrow('level 0 of the mounted set has no chest with tag 9');
    });
});
