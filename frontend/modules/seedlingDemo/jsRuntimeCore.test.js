/**
 * jsRuntimeCore — the Seedling JS runtime speaking the wasm page's contract
 * (Seedling JS J1). Every row drives the core through the SAME calls the host
 * makes (`configure`, `botLoadLevels`, `queueItems`, the tick) and reads only
 * what the host reads (`onStateChanged` reports, `botStatus`, `botLevelSet`),
 * then hands the reports to the host's own parsers and bindings.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime, isDeathRefusal, JS_RUNTIME_CAPABILITIES } from './jsRuntimeCore.js';
import { assembleGeneratedSeedlingSet, placementKey } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { levelSetDisagreement } from './levelSetDisagreement.js';
import { cellOf, routeWalker, tileRoute } from './jsRuntimeTestWalk.js';
import { PhysicsV2Error } from './playerPhysicsV2.js';
import { parsePendingExit } from '../flashPanel/seedlingRegionBinding.js';
import { parsePendingCheck, SeedlingCheckBinding } from '../flashPanel/seedlingCheckBinding.js';
import { JS_RUNTIME_CAPABILITIES as ELIGIBILITY_JS_CAPABILITIES } from '../flashPanel/seedlingRandomizerEligibility.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const GAME_CONFIG = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(
    join(ROOT, 'frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'), 'utf8'));
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
/**
 * ⛓ W5 — the two Moonrock statics `games/seedling.json` declares for the WASM
 * arrival staging. The JS page does not carry them across room boots (each
 * room boots from its own staging), so it answers nothing for them and the
 * bridge contract's skip rule applies: an unanswerable property is left out of
 * `readState` and the reports — as BridgeGeneric does for a property a build
 * cannot read. Every other declared row is answered, in declaration order.
 */
const JS_PAGE_SKIPS = ['beam', 'rockSet'];
const DECLARED = GAME_CONFIG.state_properties.map((p) => p.property).filter((p) => !JS_PAGE_SKIPS.includes(p));

/** The assembled set the host delivers, and a runtime with it mounted and started. */
function started({ mutateSet = null, chunkOpts = {} } = {}) {
    const assembled = assembleGeneratedSeedlingSet(RULES, { selfPlayer: 1 });
    if (mutateSet) mutateSet(assembled.set);
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.tick();
    reports.length = 0; // the baseline burst — its own row asserts it
    const { chunks } = planLevelSetChunks(assembled.set, chunkOpts);
    const answers = chunks.map((c) => rt.game.botLoadLevels(JSON.stringify(c)));
    const { x, y, level } = assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false },
        { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
    return { rt, reports, assembled, answers, chunks };
}

/** Walk by keys to a cell of the current room; stops early on a crossing or death. */
function walkTo(rt, to, { allow = [], maxTicks = 3000 } = {}) {
    const run = rt.run;
    const route = tileRoute(rt.mounted.records.get(run.level), cellOf(run.state.x, run.state.y), to, { allow });
    expect(route, `a route to (${to.tx},${to.ty})`).not.toBeNull();
    const walker = routeWalker(route);
    for (let t = 0; t < maxTicks && !walker.done; t += 1) {
        const out = rt.tick(walker.next(rt.run.state.x, rt.run.state.y));
        if (out.crossing || out.death || out.halted) return out;
    }
    return { done: walker.done };
}

const AP_CELL = { tx: 4, ty: 1 };       // region_0_0's apitem
const DOOR_ABOVE_START = { tx: 8, ty: 1 }; // the teleporter to region_0_1
const PIT_CELL = { tx: 4, ty: 5 };

describe('jsRuntimeCore — the bridge contract', () => {
    it('answers readState "not configured" before configure, then the declared properties', () => {
        const rt = createJsRuntime();
        expect(rt.game.readState()).toMatch(/not configured/);
        expect(typeof rt.game.wireCheck).toBe('function');
        expect(typeof rt.game.botStatus).toBe('function');
        expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
        const state = JSON.parse(rt.game.readState());
        expect(Object.keys(state)).toEqual(DECLARED);
        for (const p of JS_PAGE_SKIPS) expect(GAME_CONFIG.state_properties.map((q) => q.property)).toContain(p);
        expect(state.level).toBe(-1);
    });

    it('reports the baseline burst once, in DECLARATION order, then only changes', () => {
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        rt.game.configure(BRIDGE_CONFIG);
        // ⛓ J3: not inside configure — the host attaches only after it returns.
        expect(reports).toEqual([]);
        rt.tick();
        expect(reports.map(([p]) => p)).toEqual(DECLARED);
        reports.length = 0;
        rt.tick();
        rt.flush();
        expect(reports).toEqual([]);
    });

    it('takes a level set in chunks (pending… ok) and reads it back as the delivery checks it', () => {
        const { rt, answers, assembled } = started({ chunkOpts: { maxRooms: 1 } });
        expect(answers).toEqual(['pending', 'pending', 'ok']);
        const back = JSON.parse(rt.game.botLevelSet());
        expect(levelSetDisagreement(assembled.set, back)).toBeNull();
    });

    it('boots at the teleport recipe\'s constructor args; level and spawn report, botStatus/botMobiles agree', () => {
        const { rt, reports, assembled } = started();
        const { level, x, y } = assembled.set.start;
        expect(reports).toEqual([['playerPositionX', x], ['playerPositionY', y], ['level', level]]);
        expect(JSON.parse(rt.game.botStatus()).level).toBe(level);
        const mob = JSON.parse(rt.game.botMobiles()).mobiles;
        expect(mob).toEqual([{ cls: 'Player', x: x + 8, y: y + 8 }]);
        expect(rt.arrival).toEqual({ level, x, y });
    });

    it('queueItems flag writes are idempotent: a re-pushed write changes nothing, a new one reboots once', () => {
        const { rt, reports } = started();
        reports.length = 0;
        const boots = () => rt.events.filter((e) => e.type === 'boot').length;
        const b0 = boots();
        const write = { class: 'main', property: 'hasSword', value: true };
        rt.queueItems([write]);
        rt.tick();
        expect(rt.flags.hasSword).toBe(true);
        expect(boots()).toBe(b0 + 1);
        expect(reports).toEqual([['hasSword', true]]);
        for (let i = 0; i < 5; i += 1) { rt.queueItems([write]); rt.tick(); }
        expect(boots()).toBe(b0 + 1);
        expect(reports).toEqual([['hasSword', true]]);
        // ⛔ The reboot keeps the ROOM's arrival — a death still respawns at the door.
        expect(rt.arrival).toEqual({ level: 0, x: 128, y: 32 });
    });

    it('the JS capability row is the eligibility module\'s, and declares apitem', () => {
        expect(JS_RUNTIME_CAPABILITIES).toBe(ELIGIBILITY_JS_CAPABILITIES);
        expect(JS_RUNTIME_CAPABILITIES).toContain('apitem');
    });
});

describe('jsRuntimeCore — the check and the crossing', () => {
    it('collecting the apitem reports pendingCheck "<seq>|<level>|<tag>|0", and the check binding resolves it', () => {
        const { rt, reports, assembled } = started();
        reports.length = 0;
        walkTo(rt, AP_CELL);
        rt.tick();
        const checks = reports.filter(([p]) => p === 'pendingCheck');
        expect(checks).toEqual([['pendingCheck', '1|0|0|0']]);
        expect(parsePendingCheck(checks[0][1])).toMatchObject({ seq: 1, level: 0, tag: 0, cleared: true });
        const binding = new SeedlingCheckBinding({ table: assembled.table, placementKey, selfPlayer: 1 });
        const effects = binding.onStateReport('pendingCheck', checks[0][1]);
        expect(effects[0]).toMatchObject({ type: 'locationCheck', location: 'region_0_0__key_blue_pickup' });
        // Collected stays collected: walking back over the cell reports nothing more.
        walkTo(rt, { tx: 5, ty: 1 });
        walkTo(rt, AP_CELL);
        expect(reports.filter(([p]) => p === 'pendingCheck')).toHaveLength(1);
    });

    it('a door reports pendingExit BEFORE level, naming the teleporter the payload\'s exit id names', () => {
        const { rt, reports, assembled } = started();
        reports.length = 0;
        walkTo(rt, { tx: 8, ty: 3 });
        const out = walkTo(rt, DOOR_ABOVE_START, { allow: [DOOR_ABOVE_START] });
        expect(out.crossing).toEqual({ from: 0, to: 1, x: 128, y: 16, type: 'teleporter' });
        const order = reports.map(([p]) => p);
        expect(order.indexOf('pendingExit')).toBeLessThan(order.indexOf('level'));
        const exit = parsePendingExit(reports.find(([p]) => p === 'pendingExit')[1]);
        expect(exit).toMatchObject({ seq: 1, fromLevel: 0, type: 'teleporter', x: 128, y: 16, to: 1 });
        const door = assembled.report.doors.find((d) => d.room === 0 && d.to === 1);
        expect(door.exit_id).toBe(`out_${exit.type}_${exit.x}_${exit.y}`);
        expect(reports.find(([p]) => p === 'level')).toEqual(['level', 1]);
    });
});

describe('jsRuntimeCore — ⚖ death = respawn at the arrival, and only death', () => {
    it('a pit with NO control block is the MODEL\'s death: the run restarts the room itself and the page reports it', () => {
        const { rt } = started();
        walkTo(rt, { tx: 4, ty: 6 });
        let out = walkTo(rt, PIT_CELL, { allow: [PIT_CELL] });
        for (let i = 0; i < 200 && !out.death; i += 1) out = rt.tick(new Set(['up']));
        expect(out.death).toBe('pit');
        expect(rt.deaths).toHaveLength(1);
        expect(rt.halted).toBeNull();
        expect(rt.run.level).toBe(0);
        // The respawn is the model's (swim R3: `die()` → the game's restart at
        // the world's ctor args), recorded in the run's own `playerDeaths`.
        expect(rt.run.playerDeaths).toHaveLength(1);
        expect(rt.run.playerDeaths[0].source).toBe('pit');
        expect(rt.deaths[0].respawn).toEqual(rt.run.playerDeaths[0].respawn);
        expect({ x: rt.run.state.x, y: rt.run.state.y }).toEqual({ x: 136, y: 40 });
    });

    it('⛔ a pit WITH a control block is a TRANSITION, not a death', () => {
        const { rt, reports } = started({
            mutateSet: (set) => {
                set.rooms[0].source.record.entities.push(
                    { type: 'control', x: 0, y: 0, attrs: { fallthrough: '1', xOff: '0', yOff: '0', sign: '0' } });
            },
        });
        reports.length = 0;
        walkTo(rt, { tx: 4, ty: 6 });
        let out = walkTo(rt, PIT_CELL, { allow: [PIT_CELL] });
        for (let i = 0; i < 200 && rt.run.level === 0; i += 1) out = rt.tick(new Set(['up']));
        expect(rt.run.level).toBe(1);
        expect(rt.deaths).toHaveLength(0);
        expect(rt.run.playerDeaths).toHaveLength(0);
        // ⛓ solver-walk S4 — the fall IS a crossing for the walk (a pit exit completes on it)…
        expect(out.crossing).toEqual({ from: 0, to: 1, type: 'pit' });
        // …but a fall writes no pendingExit in the game, and none here.
        expect(reports.filter(([p]) => p === 'pendingExit')).toEqual([]);
        expect(reports.filter(([p]) => p === 'level')).toEqual([['level', 1]]);
    });

    it('isDeathRefusal still names the old refusal words (a PREVIEW step that reaches a death throws them)', () => {
        const pit = new PhysicsV2Error('the player fell into a pit in level 900, which has NO control block — …');
        const drown = new PhysicsV2Error('the player DROWNED in level 3 at (1, 2) — terrain state 1.');
        expect(isDeathRefusal(pit)).toBe('pit');
        expect(isDeathRefusal(drown)).toBe('drown');
        expect(isDeathRefusal(new Error(pit.message))).toBeNull();
        expect(isDeathRefusal(new PhysicsV2Error('stepV2 refuses a wet tick without the sound pin'))).toBeNull();
    });

    it('any other refusal HALTS by name — it is not respawned through', () => {
        const { rt } = started();
        rt.session.step = () => { throw new Error('levelRun: an unmodelled thing'); };
        const out = rt.tick(new Set(['left']));
        expect(out.halted.message).toMatch(/unmodelled thing/);
        expect(rt.deaths).toHaveLength(0);
        expect(JSON.parse(rt.game.botStatus()).halted).toMatch(/unmodelled thing/);
    });
});
