// Unit tests for the region-atlas play-time state machine
// (CC/docs/plans/region-atlas-plan.md, Phase 4 — projection 3, host side).
//
// The anchor is the COMMITTED seedling_atlas preset read off disk and put
// through the substrate's own deserializeWorld, so these exercise the payload
// the compiler really emits (exits as a Map keyed by AP exit name) rather than
// a hand-shaped stand-in. Synthetic worlds appear only where the starter atlas
// has nothing to say yet — the two-exits-to-one-level tie-break.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach } from 'vitest';

import { substrateRegistryEntry as seedlingEntry } from './flashSeedlingLibrary.js';
import {
    SeedlingRegionBinding,
    resolveArrivalSpawn,
    resolveCrossingExit,
    exitList,
    ARRIVAL_ECHO_TIMEOUT_MS,
} from './seedlingRegionBinding.js';

const PRESET = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../presets/seedling_atlas/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const SIDECARS = PRESET.preset_sidecars['1'];

/** A warehouse-shaped world, built exactly the way procgenPlayer builds it. */
const worldFor = (regionId) => seedlingEntry.deserializeWorld(SIDECARS[regionId].playable_payload);

// The three levels the starter atlas covers: overworld 0, starting house 86,
// owl's nest entrance 2.
const OVERWORLD = 'overworld_start';
const HOUSE = 'starting_house';

// A clock the tests drive by hand, so the echo timeout is exercised without
// waiting on it.
let clock;
const binding = () => new SeedlingRegionBinding({ now: () => clock });
beforeEach(() => { clock = 1_000_000; });

const load = (b, regionId, arrivedFrom = null) =>
    b.onLoadRegion({ region_id: regionId, world: worldFor(regionId), arrivedFrom });

const types = (effects) => effects.map((e) => e.type);

describe('payload shape the binding depends on', () => {
    it('the substrate deserializer keys exits by AP exit NAME, and levels are present', () => {
        const world = worldFor(OVERWORLD);
        expect(world.exits).toBeInstanceOf(Map);
        expect([...world.exits.keys()]).toEqual([
            'overworld_start -> starting_house',
            'overworld_start -> owls_nest_entrance',
        ]);
        expect(world.level).toBe(0);
        expect(exitList(world)).toHaveLength(2);
    });
});

describe('resolveArrivalSpawn', () => {
    it('lands at the entrance spawn of the exit named by arrivedFrom', () => {
        expect(resolveArrivalSpawn(worldFor(OVERWORLD), { exit_id: 'owls_nest_stairs' }))
            .toMatchObject({ level: 0, x: 256, y: 272, exitId: 'owls_nest_stairs', matchedArrivedFrom: true });
    });

    it('falls back to the region\'s first exit on the initial load (no arrivedFrom)', () => {
        expect(resolveArrivalSpawn(worldFor(OVERWORLD), null))
            .toMatchObject({ level: 0, x: 160, y: 272, exitId: 'house_door', matchedArrivedFrom: false });
    });

    it('falls back — and flags it — when arrivedFrom names an exit this region lacks', () => {
        const spawn = resolveArrivalSpawn(worldFor(HOUSE), { exit_id: 'no_such_exit' });
        expect(spawn.matchedArrivedFrom).toBe(false);
        expect(spawn.exitId).toBe('door');
    });

    it('returns null for a region with no wired exits', () => {
        expect(resolveArrivalSpawn({ level: 3, exits: new Map() }, null)).toBeNull();
    });
});

describe('trap 2 — the first level report is baseline, not a crossing', () => {
    it('swallows the boot report even though it names a different level', () => {
        const b = binding();
        load(b, HOUSE, { exit_id: 'door' });
        // The game boots on the overworld while AP thinks we are in the house.
        // That is baseline, not the player walking anywhere.
        const effects = b.onStateReport('level', 0);
        expect(types(effects)).toEqual(['teleport']);
        expect(effects[0]).toMatchObject({ level: 86, x: 48, y: 64 });
        expect(b.lastLevel).toBe(0);                       // where the game is
        expect(b.pendingArrival).toMatchObject({ level: 86 }); // armed for the echo
    });

    it('holds the arrival until the game reports, then releases it', () => {
        const b = binding();
        const onLoad = load(b, OVERWORLD, null);
        expect(types(onLoad)).toEqual(['info']); // queued, no adapter yet
        expect(b.pendingSpawn).toMatchObject({ level: 0, x: 160, y: 272 });
        const onBoot = b.onStateReport('level', 0);
        expect(types(onBoot)).toEqual(['teleport']);
        expect(b.pendingSpawn).toBeNull();
    });
});

describe('trap 1 — the teleport echo', () => {
    it('swallows the level report its own arrival teleport caused', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);          // baseline (already on level 0)
        // Now cross into the house: procgen loads it, we teleport, the game
        // reports level 86 — that report is OURS.
        const tp = load(b, HOUSE, { exit_id: 'door' });
        expect(types(tp)).toEqual(['teleport']);
        expect(b.pendingArrival).toMatchObject({ level: 86 });
        expect(b.onStateReport('level', 86)).toEqual([]);
        expect(b.pendingArrival).toBeNull();
    });

    it('does NOT arm when the teleport cannot change the level — the next crossing survives', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);
        // Re-entering the region we are already standing in: same level, so
        // there is no level change to echo. Arming here would eat the player's
        // next real door.
        const again = load(b, OVERWORLD, { exit_id: 'house_door' });
        expect(types(again)).toEqual(['teleport']);
        expect(b.pendingArrival).toBeNull();
        expect(types(b.onStateReport('level', 86))).toEqual(['regionMove']);
    });

    it('writes an unlanded arrival off after the timeout and resumes detecting', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);
        load(b, HOUSE, { exit_id: 'door' });   // arms level 86
        expect(b.pendingArrival).toBeTruthy();
        // The teleport never lands; the player walks somewhere else instead.
        clock += ARRIVAL_ECHO_TIMEOUT_MS + 1;
        const effects = b.onStateReport('level', 2);
        expect(b.pendingArrival).toBeNull();
        // Region is `starting_house` now, which has no exit to level 2.
        expect(types(effects)).toEqual(['warn']);
    });

    it('swallows unrelated reports while an arrival is still in flight', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);
        load(b, HOUSE, { exit_id: 'door' });
        clock += 1000; // still inside the window
        expect(b.onStateReport('level', 2)).toEqual([]);
        expect(b.pendingArrival).toBeTruthy();
    });
});

describe('crossings', () => {
    const started = () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);   // baseline
        b.onStateReport('level', 0);   // the arrival teleport's own no-op
        return b;
    };

    it('publishes a region move naming the AP exit, not the atlas exit id', () => {
        const b = started();
        const effects = b.onStateReport('level', 2);
        expect(effects).toEqual([{
            type: 'regionMove',
            sourceRegion: 'overworld_start',
            targetRegion: 'owls_nest_entrance',
            exitName: 'overworld_start -> owls_nest_entrance',
            exitId: 'owls_nest_stairs',
            fromLevel: 0,
            toLevel: 2,
        }]);
    });

    it('ignores a repeated report of the level we are already on', () => {
        const b = started();
        expect(b.onStateReport('level', 0)).toEqual([]);
    });

    it('ignores position reports on their own — they only feed the tie-break', () => {
        const b = started();
        expect(b.onStateReport('playerPositionX', 48)).toEqual([]);
        expect(b.onStateReport('playerPositionY', 64)).toEqual([]);
        expect(b.lastSpawn).toEqual({ x: 48, y: 64 });
    });
});

describe('tie-break — two exits of one region reaching the same level', () => {
    const twoDoors = {
        level: 5,
        exits: [
            {
                exit_id: 'north_door',
                exitName: 'room -> hall #north',
                targetRegion: 'hall_north',
                target_level: 9,
                target_spawn: { x: 32, y: 16 },
                entrance_spawn: { x: 0, y: 0 },
            },
            {
                exit_id: 'south_door',
                exitName: 'room -> hall #south',
                targetRegion: 'hall_south',
                target_level: 9,
                target_spawn: { x: 32, y: 400 },
                entrance_spawn: { x: 0, y: 32 },
            },
        ],
    };

    it('picks the exit whose stamped target spawn is nearest the reported coordinates', () => {
        expect(resolveCrossingExit(twoDoors, 9, { x: 30, y: 20 }).exit_id).toBe('north_door');
        expect(resolveCrossingExit(twoDoors, 9, { x: 30, y: 390 }).exit_id).toBe('south_door');
    });

    it('falls back to the first candidate when no coordinates have been reported', () => {
        expect(resolveCrossingExit(twoDoors, 9, { x: null, y: null }).exit_id).toBe('north_door');
    });

    it('drives the tie-break end to end, coordinates first then the level change', () => {
        const b = binding();
        b.onLoadRegion({ region_id: 'room', world: twoDoors, arrivedFrom: null });
        b.onStateReport('level', 5);          // baseline
        b.onStateReport('level', 5);          // the arrival teleport's no-op
        // games/seedling.json declares playerPositionX/Y BEFORE level exactly
        // so this ordering holds on a real `new Game(level, x, y)`.
        b.onStateReport('playerPositionX', 32);
        b.onStateReport('playerPositionY', 396);
        const effects = b.onStateReport('level', 9);
        expect(effects[0]).toMatchObject({ targetRegion: 'hall_south', exitId: 'south_door' });
    });
});

describe('unmapped levels — the atlas is partial by design', () => {
    it('WARNS and does not move the AP region', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);
        b.onStateReport('level', 0);
        const effects = b.onStateReport('level', 42);
        expect(types(effects)).toEqual(['warn']);
        expect(effects[0].level).toBe(42);
        expect(effects[0].repeat).toBe(false);
        expect(effects[0].message).toMatch(/no marked exit to/);
        expect(effects[0].message).toMatch(/Region Marking Tool/);
    });

    it('marks the repeat so the glue can keep the log readable', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);
        b.onStateReport('level', 0);
        b.onStateReport('level', 42);
        b.onStateReport('level', 0);
        expect(b.onStateReport('level', 42)[0].repeat).toBe(true);
    });

    it('a region with no arrival spawn warns rather than teleporting nowhere', () => {
        const b = binding();
        const effects = b.onLoadRegion({ region_id: 'empty', world: { level: 3, exits: new Map() } });
        expect(types(effects)).toEqual(['warn']);
        expect(effects[0].message).toMatch(/carries no arrival spawn/);
    });

    it('warns when arrivedFrom names an exit the region does not declare', () => {
        const b = binding();
        load(b, OVERWORLD, null);
        b.onStateReport('level', 0);
        const effects = load(b, HOUSE, { exit_id: 'ghost_door' });
        expect(types(effects)).toEqual(['warn', 'teleport']);
    });
});

describe('a fresh adapter (preset switch / reload)', () => {
    it('re-arms the arrival for the region we are already in', () => {
        const b = binding();
        load(b, HOUSE, { exit_id: 'door' });
        b.onStateReport('level', 0);
        expect(b.baselineSeen).toBe(true);
        b.onGameRestart();
        expect(b.baselineSeen).toBe(false);
        expect(b.pendingArrival).toBeNull();
        expect(b.pendingSpawn).toMatchObject({ level: 86, x: 48, y: 64 });
        expect(types(b.onStateReport('level', 0))).toEqual(['teleport']);
    });
});
