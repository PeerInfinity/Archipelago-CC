/**
 * ⛓⛓ RESTART ON SEEDLING (⚖ the user, 2026-10-05: *"We already have a menu panel with a button to return to
 * the start region. We might just need to listen for this and use the existing teleport tool to teleport the
 * player back to the start region."*).
 *
 * WHAT THESE ROWS PIN:
 *   - THE COVERED LIST: the committed Seedling presets whose start region (the declared start's one hop) is
 *     a Seedling room. That list is what the rules arc adds its warp edge to, so it is DERIVED here from
 *     the presets and asserted, never typed in one place and trusted in another.
 *   - `seedlingStartSpawn` is THE start: the binding's start-hop arrival teleports to it, a Restart's re-take
 *     teleports to it WITH the delivered set, and the randomized load's reset asks it for its boot position.
 *   - the glue hears `menuPanel:restarted`, stops a walk in flight, and re-takes procgenPlayer's hop only
 *     when the start is ours; nothing else (no check, no move it did not ask for).
 *
 * The live witness (the game lands, the binding reads the start, a check does not fire) is the probe's.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi } from 'vitest';

import { SeedlingRegionBinding, bootSpawnIn, resolveArrivalSpawn, seedlingStartSpawn } from './seedlingRegionBinding.js';
import { BUILD_SPAWN } from '../seedlingDemo/seedlingBootSpawn.js';
import { SeedlingRegionGlue } from './seedlingRegionGlue.js';
import { returnSpawnTable } from './seedlingReturnSpawns.js';
import { resetTargetFor } from './seedlingRandomizerWiring.js';
import { mapDocumentPath } from './mapDocumentPath.js';
import { substrateRegistryEntry as seedlingEntry, FLASH_SEEDLING_LOAD_REGION_EVENT, FLASH_SEEDLING_SUBSTRATE_ID } from './flashSeedlingLibrary.js';
import { FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
import { RESTARTED_EVENT } from '../menuPanel/menuPanelEngine.js';
import { findStartRegion } from '../procgenPlayer/procgenPlayerEngine.js';

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url));
const PRESETS = `${FRONTEND}presets/`;
const OURS = new Set([FLASH_SEEDLING_SUBSTRATE_ID, FLASH_SEEDLING_GEN_SUBSTRATE_ID]);
const rulesOf = (preset) => JSON.parse(readFileSync(`${PRESETS}${preset}/AP_1/AP_1_rules.json`, 'utf8'));
const PARTITION = JSON.parse(readFileSync(`${FRONTEND}modules/flashPanel/atlases/seedling-subregion-partition.json`, 'utf8'));

/** The start hop of a preset, the way procgenPlayer resolves it (every sidecar counts as warehoused). */
function startOf(rules) {
    const sidecars = rules.preset_sidecars?.['1'] ?? {};
    const warehouse = { has: (r) => Object.hasOwn(sidecars, r) };
    const hop = findStartRegion(rules, '1', warehouse);
    return hop ? { ...hop, substrate: sidecars[hop.region]?.substrate ?? null } : null;
}

describe('the covered presets — DERIVED from the committed presets', () => {
    const seedlingPresets = readdirSync(PRESETS)
        .filter((d) => d.startsWith('seedling') && existsSync(`${PRESETS}${d}/AP_1/AP_1_rules.json`)).sort();

    it('a Restart warps the Seedling player on exactly these presets (the start hop enters a Seedling room)', () => {
        const census = Object.fromEntries(seedlingPresets.map((p) => {
            const s = startOf(rulesOf(p));
            return [p, s ? `${s.sourceRegion} -> ${s.region} (${s.substrate})` : null];
        }));
        const covered = seedlingPresets.filter((p) => OURS.has(startOf(rulesOf(p))?.substrate));
        expect(covered).toEqual([
            'seedling_atlas',
            'seedling_atlas_location',
            'seedling_generated_host',
            'seedling_generated_room',
            'seedling_playthrough',
            'seedling_spiral_room',
        ]);
        // ⛓ and the rest start in a MAZE room: a Restart parks the game there, like any excursion.
        for (const p of seedlingPresets.filter((x) => !covered.includes(x))) {
            expect(census[p] === null || census[p].endsWith('(maze)'), `${p}: ${census[p]}`).toBe(true);
        }
        // ⛓ every covered start is one hop out of `Menu` — the hop a Restart re-takes.
        for (const p of covered) expect(startOf(rulesOf(p)).sourceRegion).toBe('Menu');
    });
});

describe('seedlingStartSpawn — the one start', () => {
    const rules = rulesOf('seedling_playthrough');
    const world = seedlingEntry.deserializeWorld(rules.preset_sidecars['1'].level_0__r7c6.playable_payload);
    const map = JSON.parse(readFileSync(`${FRONTEND}${mapDocumentPath(rules, '1').path}`, 'utf8'));
    const returnSpawns = returnSpawnTable(map);
    const partition = PARTITION;

    it('⚖ START IN FRONT (2026-10-28): the playthrough starts where the GAME boots — Main.as:51, level 0 at (80, 128)', () => {
        expect(BUILD_SPAWN).toEqual({ level: 0, x: 80, y: 128 });
        expect(seedlingStartSpawn({ world, returnSpawns, partition })).toEqual({ level: 0, x: 80, y: 128, source: 'boot' });
    });

    it('without the partition (not loaded yet) the old answer stands: the first exit\'s return spawn, (16, 128)', () => {
        expect(seedlingStartSpawn({ world, returnSpawns })).toEqual({
            level: 0, x: 16, y: 128, source: 'arrival', exitId: 'out_teleporter_0_128', landing: 'return-spawn' });
    });

    it('the arrival with no "came from" is unchanged — and the GameStart hop\'s arrivedFrom resolves the same exit', () => {
        const plain = resolveArrivalSpawn(world, null, returnSpawns);
        const viaHop = resolveArrivalSpawn(world, { exit_id: 'GameStart', source_region: 'Menu' }, returnSpawns);
        for (const a of [plain, viaHop]) {
            expect([a.level, a.x, a.y]).toEqual([0, 16, 128]);
        }
    });

    it('a set that names its start POSITION wins (the generated arm); a level-only set gets the boot position', () => {
        expect(seedlingStartSpawn({ world, returnSpawns, partition, set: { start: { level: 0, x: 48, y: 64 } } }))
            .toEqual({ level: 0, x: 48, y: 64, source: 'set' });
        expect(seedlingStartSpawn({ world, returnSpawns, partition, set: { start: { level: 0 } } }))
            .toMatchObject({ level: 0, x: 80, y: 128, source: 'boot' });
    });

    it('the randomized reset lands on it: resetTargetFor(set, its boot position) === seedlingStartSpawn(set)', () => {
        for (const set of [{ start: { level: 0 } }, { start: { level: 0, x: 48, y: 64 } }]) {
            const boot = seedlingStartSpawn({ world, returnSpawns, partition, set: null });
            const t = resetTargetFor(set, boot);
            const s = seedlingStartSpawn({ world, returnSpawns, partition, set });
            expect([t.level, t.x, t.y]).toEqual([s.level, s.x, s.y]);
        }
    });
});

describe('bootSpawnIn — the PLAYER BOX at the boot position, in the start region\'s OWN sub-region', () => {
    const payload = (preset, region) => seedlingEntry.deserializeWorld(rulesOf(preset).preset_sidecars['1'][region].playable_payload);
    const hub = payload('seedling_playthrough', 'level_0__r7c6');

    it('MEASURED: the partition puts the boot cell in the playthrough\'s start hub, r7c6', () => {
        const atlas = PARTITION.atlases[hub.atlas_ref];
        const e = atlas.regions[hub.atlas_region];
        const ch = e.rows[BUILD_SPAWN.y / atlas.tile_size][BUILD_SPAWN.x / atlas.tile_size];
        expect(e.sub_regions[PARTITION.alphabet.indexOf(ch)]).toBe('r7c6');
    });

    it('the box, not the point: a box straddling the hub\'s edge is refused though its top-left is inside', () => {
        // row 8 of level_0 is `EEEEEEEEE.` — column 8 is the hub, column 9 is not.
        expect(bootSpawnIn(hub, PARTITION, { level: 0, x: 128, y: 128 })).toEqual({ level: 0, x: 128, y: 128 });
        expect(bootSpawnIn(hub, PARTITION, { level: 0, x: 136, y: 128 })).toBe(null);
    });

    it('another sub-region of the boot level, another level, no partition, no atlas: null (the caller keeps its answer)', () => {
        expect(bootSpawnIn(payload('seedling_playthrough', 'level_0__r1c6'), PARTITION)).toBe(null);
        expect(bootSpawnIn({ ...hub, level: 3 }, PARTITION)).toBe(null);
        expect(bootSpawnIn(hub, null)).toBe(null);
        expect(bootSpawnIn({ level: 0, tile_size: 16, exits: hub.exits }, PARTITION)).toBe(null);
    });

    it('the same test answers the starter atlas\'s r8c0 and the spiral\'s placed copy of it (region_0_0)', () => {
        expect(bootSpawnIn(payload('seedling_atlas', 'overworld_start__r8c0'), PARTITION)).toEqual(BUILD_SPAWN);
        expect(bootSpawnIn(payload('seedling_spiral_room', 'region_0_0'), PARTITION)).toEqual(BUILD_SPAWN);
    });
});

describe('the binding — a start-hop load arrives at seedlingStartSpawn', () => {
    const atlas = rulesOf('seedling_atlas');
    const start = seedlingEntry.deserializeWorld(atlas.preset_sidecars['1'].overworld_start__r8c0.playable_payload);
    const house = seedlingEntry.deserializeWorld(atlas.preset_sidecars['1'].starting_house.playable_payload);

    function booted() {
        const b = new SeedlingRegionBinding();
        b.onStateReport('level', 0);
        return b;
    }
    const teleports = (effects) => effects.filter((e) => e.type === 'teleport').map((e) => [e.level, e.x, e.y]);

    it('the start hop teleports to seedlingStartSpawn, remembers the start, and a re-take uses the delivered set', () => {
        const b = booted();
        const hop = { region_id: 'overworld_start__r8c0', world: start, arrivedFrom: { exit_id: 'GameStart', source_region: 'Menu' }, startHop: true };
        const want = seedlingStartSpawn({ world: start });
        expect(teleports(b.onLoadRegion(hop))).toEqual([[want.level, want.x, want.y]]);
        expect(b.startRegion).toBe('overworld_start__r8c0');
        // into the house, then Restart with a set that carries a position: the warp goes THERE.
        b.onLoadRegion({ region_id: 'starting_house', world: house, arrivedFrom: { exit_id: 'house_door' } });
        b.setStartSet({ start: { level: 0, x: 48, y: 160 } });
        const effects = b.onLoadRegion({ ...hop, restart: true });
        expect(teleports(effects)).toEqual([[0, 48, 160]]);
        expect(effects.some((e) => e.type === 'info' && /Restart: back to the start region/.test(e.message))).toBe(true);
        expect(b.restarts).toBe(1);
        // ⛔ no check, no region move: a Restart is a warp.
        expect(effects.filter((e) => ['locationCheck', 'regionMove'].includes(e.type))).toEqual([]);
    });

    it('⚖ START IN FRONT — a queued start-hop arrival is re-resolved when the partition arrives (like the return spawns)', () => {
        const rules = rulesOf('seedling_playthrough');
        const hub = seedlingEntry.deserializeWorld(rules.preset_sidecars['1'].level_0__r7c6.playable_payload);
        const b = new SeedlingRegionBinding();
        b.onLoadRegion({ region_id: 'level_0__r7c6', world: hub, arrivedFrom: { exit_id: 'GameStart', source_region: 'Menu' }, startHop: true });
        expect(b.pendingSpawn).toMatchObject({ level: 0, source: 'arrival' });
        b.setPartition(PARTITION);
        expect(b.pendingSpawn).toEqual({ level: 0, x: 80, y: 128, source: 'boot' });
        expect(b.startSpawn({ set: null })).toEqual({ level: 0, x: 80, y: 128, source: 'boot' });
        // ⛓ the game's own first frame (the baseline) releases it: the teleport is still sent, to the spot it booted on.
        expect(teleports(b.onStateReport('level', 0))).toEqual([[0, 80, 128]]);
    });

    it('a teleport from another level arms the echo, so the landing is not read as a crossing', () => {
        const b = booted();
        b.onLoadRegion({ region_id: 'starting_house', world: house, arrivedFrom: null });
        b.onStateReport('level', 86);
        b.onLoadRegion({ region_id: 'overworld_start__r8c0', world: start, arrivedFrom: null, startHop: true, restart: true });
        expect(b.pendingArrival).toMatchObject({ level: 0 });
        expect(b.onStateReport('level', 0)).toEqual([]);
        expect(b.region).toBe('overworld_start__r8c0');
    });

    it('an ordinary load (no startHop) is unchanged: the door it came through', () => {
        const b = booted();
        const effects = b.onLoadRegion({ region_id: 'overworld_start__r8c0', world: start, arrivedFrom: { exit_id: 'owls_nest_stairs' } });
        const door = resolveArrivalSpawn(start, { exit_id: 'owls_nest_stairs' });
        expect(teleports(effects)).toEqual([[door.level, door.x, door.y]]);
        expect(b.startRegion).toBe(null);
        expect(b.startSpawn()).toBe(null);
    });
});

describe('the glue — menuPanel:restarted re-takes the start hop when the start is ours', () => {
    function harness({ startSubstrate = FLASH_SEEDLING_SUBSTRATE_ID, retake = () => ({ taken: true, why: null, region: 's' }), busy = false } = {}) {
        const subs = new Map();
        const eventBus = { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} };
        const retakeStartHop = vi.fn(retake);
        const stops = [];
        const published = [];
        const glue = new SeedlingRegionGlue({
            eventBus,
            getDispatcher: () => ({ publish: (name, data) => published.push({ name, data }) }),
            loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
            getProcgen: () => ({
                getResolvedStartRegion: () => 's',
                getRegionInfo: (r) => (r === 's' ? { substrate: startSubstrate } : null),
                retakeStartHop,
            }),
            stopBotWalks: () => { if (busy) stops.push('stop'); return stops.length; },
        });
        glue.start();
        return { glue, retakeStartHop, stops, published, restart: (p) => subs.get(RESTARTED_EVENT)(p), subscribed: () => subs.has(RESTARTED_EVENT) };
    }

    it('subscribes at start(), and a world-mode Restart on a Seedling start re-takes the hop', () => {
        const h = harness();
        expect(h.subscribed()).toBe(true);
        h.restart({ mode: 'world', target: 'Menu', from: 'level_13' });
        expect(h.retakeStartHop).toHaveBeenCalledTimes(1);
        expect(h.glue.lastRestart).toMatchObject({ taken: true, start: 's', substrate: FLASH_SEEDLING_SUBSTRATE_ID });
        expect(h.glue.stats.restarts).toBe(1);
    });

    it('⛔ the glue publishes NOTHING itself on a Restart — no location check, no move (the hop is procgenPlayer\'s)', () => {
        const h = harness();
        h.glue.checkBinding = { hostOwnedLocations: () => new Set(['Level 010 - Sword']), onStateReport: () => [] };
        h.restart({ mode: 'world', target: 'Menu', from: 'level_13' });
        expect(h.published).toEqual([]);
        expect(h.glue.stats.locationChecks).toBe(0);
    });

    it('the generated entry counts as ours too', () => {
        const h = harness({ startSubstrate: FLASH_SEEDLING_GEN_SUBSTRATE_ID });
        h.restart({ mode: 'world' });
        expect(h.retakeStartHop).toHaveBeenCalledTimes(1);
    });

    it('a MAZE start, or a loop-mode restart: nothing re-taken', () => {
        const maze = harness({ startSubstrate: 'maze' });
        maze.restart({ mode: 'world' });
        expect(maze.retakeStartHop).not.toHaveBeenCalled();
        const loop = harness();
        loop.restart({ mode: 'loop' });
        expect(loop.retakeStartHop).not.toHaveBeenCalled();
    });

    it('a walk in flight is STOPPED before the hop is re-taken', () => {
        const h = harness({ busy: true });
        h.restart({ mode: 'world' });
        expect(h.stops).toEqual(['stop']);
        expect(h.glue.lastRestart.stoppedWalks).toBe(1);
    });

    it('⛓ WALK IDENTITY — the re-taken hop\'s teleport is PUSHED in the Restart\'s own turn (the stop released the room before it queued)', () => {
        const order = [];
        const h = harness({ busy: true, retake: () => { order.push('retake'); return { taken: true, why: null, region: 's' }; } });
        h.glue.adapter = { pushNow: () => { order.push('push'); return true; } };
        h.restart({ mode: 'world' });
        expect(order).toEqual(['retake', 'push']);
        expect(h.glue.lastRestart).toMatchObject({ taken: true, pushed: true, stoppedWalks: 1 });
    });

    it('⛓ WALK IDENTITY — a refused re-take, a maze start or no adapter pushes nothing', () => {
        const refused = harness({ retake: () => ({ taken: false, why: 'no', region: 's' }) });
        const pushNow = vi.fn(() => true);
        refused.glue.adapter = { pushNow };
        refused.restart({ mode: 'world' });
        const maze = harness({ startSubstrate: 'maze' });
        maze.glue.adapter = { pushNow };
        maze.restart({ mode: 'world' });
        expect(pushNow).not.toHaveBeenCalled();
        const bare = harness();
        bare.restart({ mode: 'world' });
        expect(bare.glue.lastRestart).toMatchObject({ taken: true, pushed: false });
    });

    it('⛓ WALK IDENTITY — the stopped engines are told to EXPECT the hop\'s arrival after the stop and BEFORE the hop is queued', () => {
        const order = [];
        const h = harness({ retake: () => { order.push('retake'); return { taken: true, why: null, region: 's' }; } });
        h.glue.stopBotWalks = () => { order.push('stop'); return 1; };
        h.glue.expectBotArrivals = () => { order.push('expect'); return 1; };
        h.restart({ mode: 'world' });
        expect(order).toEqual(['stop', 'expect', 'retake']);
        expect(h.glue.lastRestart).toMatchObject({ taken: true, watching: 1 });
        const maze = harness({ startSubstrate: 'maze' });
        maze.glue.expectBotArrivals = () => { order.push('maze-expect'); return 1; };
        maze.restart({ mode: 'world' });
        expect(order).not.toContain('maze-expect');
    });

    it('a refused re-take is said, not hidden', () => {
        const h = harness({ retake: () => ({ taken: false, why: 'the load does not skip this start', region: 's' }) });
        h.restart({ mode: 'world' });
        expect(h.glue.lastRestart).toMatchObject({ taken: false, why: 'the load does not skip this start' });
        expect(h.glue.stats.restarts).toBe(0);
    });
});

/**
 * ⛔ THE RESTART HOLD (found by `seedling-js-panel-restart`; ⚖ the user 2026-10-28, "Fix it"): the arrival watch
 * `expectBotArrivals` arms HOLDS the landing until the bot's next goal. Only a stopped walk has one coming, so a
 * Restart arms it only when `stopBotWalks()` stopped one — the same gate as `teleportTool`. Before, it armed
 * unconditionally, and on wasm a hand walk after a Restart was stranded (`held: true`, 0 ticks).
 */
describe('handleMenuRestart — the arrival watch only behind a stopped walk', () => {
    function harness({ walks }) {
        const subs = new Map();
        const eventBus = { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} };
        const expects = vi.fn(() => 1);
        const glue = new SeedlingRegionGlue({
            eventBus,
            getDispatcher: () => ({ publish: () => {} }),
            loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
            getProcgen: () => ({
                getResolvedStartRegion: () => 's',
                getRegionInfo: (r) => (r === 's' ? { substrate: FLASH_SEEDLING_SUBSTRATE_ID } : null),
                retakeStartHop: () => ({ taken: true, why: null, region: 's' }),
            }),
            stopBotWalks: () => walks,
            expectBotArrivals: expects,
        });
        glue.start();
        return { glue, expects, restart: (p) => subs.get(RESTARTED_EVENT)(p) };
    }
    /** The row's claim: a Restart with no walk arms nothing, and records `watching: 0`. */
    const noWalkArmsNothing = (h) => {
        h.restart({ mode: 'world' });
        return h.expects.mock.calls.length === 0 && h.glue.lastRestart.watching === 0 && h.glue.lastRestart.taken === true;
    };

    it('no walk in flight: nothing watches, so no hold strands a player who walks by hand', () => {
        const h = harness({ walks: 0 });
        expect(noWalkArmsNothing(h)).toBe(true);
        expect(h.glue.lastRestart).toMatchObject({ taken: true, stoppedWalks: 0, watching: 0 });
    });

    it('a walk in flight was stopped (Restart mid-walk): the engines watch for the hop\'s landing', () => {
        const h = harness({ walks: 1 });
        h.restart({ mode: 'world' });
        expect(h.expects).toHaveBeenCalledTimes(1);
        expect(h.glue.lastRestart).toMatchObject({ taken: true, stoppedWalks: 1, watching: 1 });
    });

    it('MUTANT: the unconditional arm (main before this fix) fails the no-walk row', () => {
        const h = harness({ walks: 0 });
        const real = SeedlingRegionGlue.prototype.handleMenuRestart;
        // the pre-fix shape: whatever the stop returned, the watch is armed after it
        h.glue.handleMenuRestart = function unconditional(payload) {
            const stop = this.stopBotWalks;
            this.stopBotWalks = () => { const n = stop(); this.expectBotArrivals(); return n; };
            try { return real.call(this, payload); } finally { this.stopBotWalks = stop; }
        };
        expect(noWalkArmsNothing(h)).toBe(false);
        expect(h.expects).toHaveBeenCalledTimes(1);
    });
});

/**
 * ⛔ THE RESTART HOLD, part 2 (⚖ js-12 2026-10-28, option (a)): `stopBotWalks` (`stopBotWalksOf`) COUNTS only the
 * controllers that were `busy()`. An idle wasm engine left driving / gated / frozen by earlier work is still stopped
 * (its gate released) but is no walk: it counted once, and in the seedling-wasm batch a Restart with no walk read
 * 1 stopped / 2 watching and held the hand walk after it (TT 40812209196).
 */
describe('stopBotWalksOf — only a busy controller is a stopped walk; the Restart arms on that count', () => {
    const controller = ({ busy = false, wasm = null } = {}) => ({ busy: () => busy, status: () => (wasm ? { wasm } : null), stop: vi.fn() });
    const idleDriving = () => controller({ wasm: { phase: 'idle', driving: true, gate: false, frozen: false } });
    const walking = () => controller({ busy: true, wasm: { phase: 'latching', driving: true, gate: false, frozen: false } });
    /** The pre-(a) count (main's `flashPanel/index.js`): every controller it stopped. */
    const countEveryStop = (cs) => cs.filter((c) => {
        if (c?.busy?.() === true) return true;
        const w = c?.status?.()?.wasm ?? null;
        return !!(w && (w.driving || w.gate || w.frozen));
    }).map((c) => c.stop()).length;
    const restartOver = (stopBotWalks) => {
        const subs = new Map();
        const expects = vi.fn(() => 1);
        const glue = new SeedlingRegionGlue({
            eventBus: { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} },
            getDispatcher: () => ({ publish: () => {} }),
            loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
            getProcgen: () => ({
                getResolvedStartRegion: () => 's',
                getRegionInfo: (r) => (r === 's' ? { substrate: FLASH_SEEDLING_SUBSTRATE_ID } : null),
                retakeStartHop: () => ({ taken: true, why: null, region: 's' }),
            }),
            stopBotWalks,
            expectBotArrivals: expects,
        });
        glue.start();
        subs.get(RESTARTED_EVENT)({ mode: 'world' });
        return { verdict: glue.lastRestart, expects };
    };

    it('an idle-but-driving engine is STOPPED (its gate released) but counted 0: the Restart arms nothing', async () => {
        const { stopBotWalksOf } = await import('./seedlingRegionGlue.js');
        const cs = [idleDriving(), controller()];
        const r = restartOver(() => stopBotWalksOf(cs));
        expect(cs[0].stop).toHaveBeenCalledTimes(1);
        expect(cs[1].stop).not.toHaveBeenCalled();
        expect(r.expects).not.toHaveBeenCalled();
        expect(r.verdict).toMatchObject({ taken: true, stoppedWalks: 0, watching: 0 });
    });

    it('a busy engine is a walk: counted 1, and the Restart arms', async () => {
        const { stopBotWalksOf } = await import('./seedlingRegionGlue.js');
        const cs = [walking(), idleDriving()];
        const r = restartOver(() => stopBotWalksOf(cs));
        expect(cs[0].stop).toHaveBeenCalledTimes(1);
        expect(cs[1].stop).toHaveBeenCalledTimes(1);
        expect(r.expects).toHaveBeenCalledTimes(1);
        expect(r.verdict).toMatchObject({ taken: true, stoppedWalks: 1, watching: 1 });
    });

    it('MUTANT: counting every stop (main\'s count) arms behind the idle engine — the batch\'s 1 stopped, held', () => {
        const r = restartOver(() => countEveryStop([idleDriving(), controller()]));
        expect(r.verdict.stoppedWalks).toBe(1);
        expect(r.expects).toHaveBeenCalledTimes(1);
    });

    it('MUTANT: counting no walk at all loses the busy walk\'s arm (the Restart mid-walk on JS)', () => {
        const r = restartOver(() => { walking().stop(); return 0; });
        expect(r.verdict).toMatchObject({ stoppedWalks: 0, watching: 0 });
        expect(r.expects).not.toHaveBeenCalled();
    });
});
