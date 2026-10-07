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

import { SeedlingRegionBinding, resolveArrivalSpawn, seedlingStartSpawn } from './seedlingRegionBinding.js';
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
    const world = seedlingEntry.deserializeWorld(rules.preset_sidecars['1'].level_0__r8c0.playable_payload);
    const map = JSON.parse(readFileSync(`${FRONTEND}${mapDocumentPath(rules, '1').path}`, 'utf8'));
    const returnSpawns = returnSpawnTable(map);

    it('the playthrough: level 0 at (16, 128) — the first exit\'s return spawn, MEASURED as the boot position (§5.18)', () => {
        expect(seedlingStartSpawn({ world, returnSpawns })).toEqual({
            level: 0, x: 16, y: 128, source: 'arrival', exitId: 'out_teleporter_0_128', landing: 'return-spawn' });
    });

    it('it IS the arrival with no "came from" — and the GameStart hop\'s arrivedFrom resolves the same exit', () => {
        const plain = resolveArrivalSpawn(world, null, returnSpawns);
        const viaHop = resolveArrivalSpawn(world, { exit_id: 'GameStart', source_region: 'Menu' }, returnSpawns);
        for (const a of [plain, viaHop]) {
            expect([a.level, a.x, a.y]).toEqual([0, 16, 128]);
        }
    });

    it('a set that names its start POSITION wins (the generated arm); a level-only set does not', () => {
        expect(seedlingStartSpawn({ world, returnSpawns, set: { start: { level: 0, x: 48, y: 64 } } }))
            .toEqual({ level: 0, x: 48, y: 64, source: 'set' });
        expect(seedlingStartSpawn({ world, returnSpawns, set: { start: { level: 0 } } }))
            .toMatchObject({ level: 0, x: 16, y: 128, source: 'arrival' });
    });

    it('the randomized reset lands on it: resetTargetFor(set, its boot position) === seedlingStartSpawn(set)', () => {
        for (const set of [{ start: { level: 0 } }, { start: { level: 0, x: 48, y: 64 } }]) {
            const boot = seedlingStartSpawn({ world, returnSpawns, set: null });
            const t = resetTargetFor(set, boot);
            const s = seedlingStartSpawn({ world, returnSpawns, set });
            expect([t.level, t.x, t.y]).toEqual([s.level, s.x, s.y]);
        }
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

    it('a refused re-take is said, not hidden', () => {
        const h = harness({ retake: () => ({ taken: false, why: 'the load does not skip this start', region: 's' }) });
        h.restart({ mode: 'world' });
        expect(h.glue.lastRestart).toMatchObject({ taken: false, why: 'the load does not skip this start' });
        expect(h.glue.stats.restarts).toBe(0);
    });
});
