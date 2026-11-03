/**
 * ⛓⛓ seedling-gen-playback-loot-chest — **THE PLAYBACK BOT TAKES A LOOT CHEST AS ITS GOAL** (⚖ the user,
 * 2026-11-03: *"Yes, low priority"*).
 *
 * Seedling gen B1 made each generated loot chest an AP location (`<region> - Chest[ N]`) and kept it OUT of
 * `report.apitems`: the set's report carries it in `report.lootChests`, beside the door chests' `report.chestDoors`.
 * Before this slice `resolveSeedlingGoal` read `apitems` and `chestDoors` only, so a loot chest's name refused.
 *
 *   · THE GOAL — a loot chest resolves exactly as a door chest does (seedling-js-playback-door-chest-goal):
 *     `{kind: 'location', level, tag, entityType: 'chest', name}`, its FIXED tag and the entity named. The page,
 *     the solver mapping (`collect-placement` at the chest, strategy `chest`), the walker (the chest's stance
 *     band, from BELOW) and the walk-tape instrument take it unchanged.
 *   · ⛔ `apitems` stays apitem-only: the lists are read side by side, never merged.
 *   · ⛔ IDENTITY — the committed generated sets (none holds a loot chest) resolve and tape BYTE-IDENTICALLY
 *     (digests measured at the base `1027e5841f` before the change).
 *   · END TO END on the JS runtime — the controller over a live page, solver ON and OFF, ends on the loot
 *     chest's `locationCheck` (the world is `seedlingGenChestLootAp.test.js`'s).
 *   · ⛔ a name that is neither an apitem nor a chest refuses by the same name as before.
 *
 * MUTANTS (measured, each reverted — the slice's as-built):
 *  L1  the resolver ignores `report.lootChests` ⇒ 5 red: the resolver row, e2e ×2, the tape row, and the wasm-engine
 *      row (`seedlingWasmPlayback.test.js` "⛓ LOOT CHESTS");
 *  L2  a loot chest resolved apitem-shaped (no `entityType`) ⇒ the same 5;
 *  L3  `lootChests` merged INTO the `apitems` lookup ⇒ the same 5;
 *  L4  the door-chest lookup dropped in the rewrite ⇒ 6 red: this file's `seedling_generated_chestdoor` IDENTITY row,
 *      and the door-chest precedent's resolver, e2e ×2, tape and wasm-engine rows.
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
import { mountedRecordsOf, walkTapeFromStaging } from '../seedlingDemo/wasmWalkTape.js';
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
const NOT_A_LOCATION = (name) => `"${name}" is not an AP location of the generated Seedling rooms`;
const stagingAt = (boot) => bootStaging({ boot, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
const NAME = 'region_0_0 - Chest';

/** The committed generated-room world with every generated room asked for a loot chest (seedlingGenChestLootAp's). */
const LOOT_STATE = Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
    params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: 'chestloot' }) });
let loot = null;
beforeAll(async () => {
    const rules = (await runPresetHeadless(buildRunFromState(structuredClone(LOOT_STATE)))).rulesJson;
    const assembled = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
    const records = mountedRecordsOf(assembled.set);
    loot = { assembled, records, levelSource: levelSourceFromAtlas(records) };
}, 120_000);

describe('resolveSeedlingGoal — a loot chest is a goal', () => {
    it('each loot `<region> - Chest` resolves to its room, its FIXED tag and the entity it is (a chest)', () => {
        const { report } = loot.assembled;
        expect('chestDoors' in report).toBe(false);
        expect(report.lootChests.map((c) => c.location)).toEqual(['region_0_0 - Chest', 'region_0_1 - Chest']);
        for (const c of report.lootChests) {
            expect(resolveSeedlingGoal({ kind: 'location', name: c.location }, report))
                .toEqual({ goal: { kind: 'location', level: c.room, tag: c.tag, entityType: 'chest', name: c.location } });
        }
        // ⛔ `apitems` stays apitem-only, and an apitem beside the chest keeps the apitem shape (no entity named)
        expect(report.apitems.some((a) => a.location.endsWith(' - Chest'))).toBe(false);
        const a = report.apitems[0];
        expect(resolveSeedlingGoal({ kind: 'location', name: a.location }, report))
            .toEqual({ goal: { kind: 'location', level: a.room, tag: a.tag, name: a.location } });
    });

    it('⛔ a name that is neither an apitem nor a chest refuses by name, as it did', () => {
        const { report } = loot.assembled;
        for (const n of ['Nowhere', 'region_0_0 - Chest 2']) {
            expect(resolveSeedlingGoal({ kind: 'location', name: n }, report)).toEqual({ refused: NOT_A_LOCATION(n) });
        }
    });
});

describe('⛔ IDENTITY — the committed generated sets (no loot chest) resolve and tape BYTE-IDENTICALLY', () => {
    /** sha256 (16 hex) of every resolved target × live level, and of every walker tape — measured at `1027e5841f`. */
    const BASE = {
        seedling_generated_room: { resolved: [51, '7d4c50e7474d7668'], tapes: [54, 'd1b6bbb59b7840ee'] },
        seedling_generated_leaf: { resolved: [24, '7db5371e78fd259f'], tapes: [10, 'ba5acc63683fc948'] },
        seedling_generated_host: { resolved: [24, 'b3ed40464fded258'], tapes: [10, '605c72ec430c6777'] },
        seedling_generated_swim: { resolved: [24, '74deb8ad9d271ada'], tapes: [10, 'fd399d71b9d6aae3'] },
        seedling_generated_chestdoor: { resolved: [57, '36ae9953369ca1e7'], tapes: [69, 'eb16461667688f90'] },
    };
    const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
    it.each(Object.keys(BASE))('%s', (name) => {
        const { report, set } = assembleGeneratedSeedlingSet(readJson(`frontend/presets/${name}/AP_1/AP_1_rules.json`), { selfPlayer: 1 });
        expect('lootChests' in report).toBe(false);
        const records = mountedRecordsOf(set);
        const levelSource = levelSourceFromAtlas(records);
        const region = report.doors[0].region;
        const targets = [
            ...report.apitems.map((a) => ({ kind: 'location', name: a.location })),
            ...(report.chestDoors ?? []).map((c) => ({ kind: 'location', name: c.location })),
            ...report.doors.flatMap((d) => [`${d.region}__${d.exitName}`, `${d.region}__${d.exit_id}`, d.exitName]
                .map((n) => ({ kind: 'exit', name: n }))),
            { kind: 'location', name: 'Nowhere' }, { kind: 'location', name: `${region} - Chest` },
            { kind: 'location', name: `${region} - Chest 2` }, { kind: 'tile', x: 1, y: 1 }];
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
    }, 120_000);
});

/** The loot world mounted on a fresh JS page as the host delivers it, booted at the set's start. */
function livePage() {
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    for (const c of planLevelSetChunks(loot.assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
    const { level, x, y } = loot.assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick(new Set());
    reports.length = 0;
    return { rt, reports };
}

describe('END TO END on the JS runtime — the Playback Bot walks to a loot chest; its locationCheck fires', () => {
    it.each([['solver ON', true], ['solver OFF (the walker)', false]])('%s: `region_0_0 - Chest` opened, checked, reported', (_label, solverWalk) => {
        const { rt, reports } = livePage();
        const { report, table } = loot.assembled;
        const c = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'js', report, jsRuntime: rt, solverWalk }) });
        expect(c.walkTo({ kind: 'location', name: NAME })).toBe(true);
        expect(c.lastRefusal).toBeNull();
        c.play();
        for (let t = 0; t < 3000 && ![WALK_STATES.DONE, WALK_STATES.FAILED].includes(rt.playback.state); t += 1) {
            expect(rt.tick(new Set()).halted ?? null).toBeNull();
        }
        expect(rt.playback.state, rt.playback.reason).toBe(WALK_STATES.DONE);
        const chest = report.lootChests.find((x) => x.location === NAME);
        if (solverWalk) {
            expect(rt.playback.solverStats.lastSolve.goal).toEqual({ kind: 'collect-placement',
                placement: { x: chest.cell.tx * 16, y: chest.cell.ty * 16 } });
            expect(rt.playback.solverStats.lastSolve.verbs).toContain('chest');
            expect(rt.playback.solverStats).toMatchObject({ declines: 0 });
        } else {
            expect(rt.playback.solverStats.solves ?? 0).toBe(0);
        }
        // the LOOT CHEST opened (its fixed slot cleared)
        expect(JSON.parse(rt.game.botStatus()).persistence_cleared).toContainEqual({ level: chest.room, tag: chest.tag });
        // ⚠ the loot chest is NOT the door (unlike a door chest): the walker's straight route crosses the room's apitem
        // (`region_0_0__key_blue_pickup`, cell (2,4)) and the game collects it on the way, as it would for a player;
        // the solver's plan does not. Either way the walk ENDS on the chest's own check (measured).
        const a = report.apitems.find((x) => x.room === chest.room);
        expect([...rt.collected]).toEqual(solverWalk ? [] : [`${a.room}:${a.tag}`]);
        const checks = reports.filter(([p, v]) => p === 'pendingCheck' && v).map(([, v]) => v);
        expect(checks).toEqual(solverWalk ? [`1|${chest.room}|${chest.tag}|0`]
            : [`1|${a.room}|${a.tag}|0`, `2|${chest.room}|${chest.tag}|0`]);
        const binding = new SeedlingCheckBinding({ table, placementKey, selfPlayer: 1 });
        const effects = checks.map((v) => binding.onStateReport('pendingCheck', v)[0]);
        expect(effects.at(-1)).toMatchObject({ type: 'locationCheck',
            location: NAME, ledgerId: NAME, level: chest.room, tag: chest.tag });
        expect(binding.stats).toMatchObject({ checks: checks.length, unknown: 0 });
        expect(rt.deaths).toEqual([]);
    }, 60_000);
});

describe('the walk-tape instrument takes the same goal', () => {
    it('`walkTapeFromStaging` walks to the loot chest\'s stance (from BELOW) and ends ON its clear (`opened`)', () => {
        const { goal } = resolveSeedlingGoal({ kind: 'location', name: NAME }, loot.assembled.report);
        const p = walkTapeFromStaging({ staging: stagingAt({ ...loot.assembled.set.start }), levelSource: loot.levelSource,
            records: loot.records, goal, clock: () => 0 });
        expect(p.end).toBe('opened');
        expect(p.expected.at(-1).level).toBe(goal.level);
        expect(p.expected.at(-1).deaths).toBe(0);
        const chest = loot.assembled.report.lootChests.find((x) => x.location === NAME);
        expect(p.expected.at(-1).y).toBeGreaterThan(chest.cell.ty * 16 + 16);
    });
});
