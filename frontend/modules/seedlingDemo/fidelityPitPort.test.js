/**
 * ⛓⛓⛓ SEEDLING FIDELITY PITPORT — a live teleporter standing on a Pit tile is crossed, not refused (wave 26; switch
 * `CONTACT_FIDELITY.pitTeleporterCrossing`, OFF).
 *
 *     Teleporter.as:89-118   update(): no fall guard — a live door fires on the first frame the box overlaps its rect
 *     Game.as:2040 / :2169   the doors update before the player (`addUpdate` prepends)
 *     Player.as:745-771      checkFallingInPit(): 20 frames of fade before the fall's own swap / `die()`
 *
 * Three doors in the atlas stand on their own Pit tile: L43 → L37 (9,4), L58 → L46 (5,1; the Yeti's tag 1), L100 →
 * L101 (18,6). Witnessed on the game (p4g headless logic-only, `probe-seedling-pit-doors.mjs`,
 * `fixtures/pitdoor-witness/`): every LIVE door crosses on the tick after the box first overlaps it, from the south,
 * north, west, east and diagonally; the SHUT L58 door lets the Pit take the player (YETI's `shut`, and `l58-shut-east`).
 * The model reproduces all six at 0 px with the switch either way (the run already crossed; only the walker's door
 * lookup refused).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { solveSegment } from './solverBot.js';
import { liveDoorPitTile, plannerObstacleAt } from './botDriverV2.js';
import {
    PIT_DOORS, PIT_DOOR_WITNESSES, pitDoorParsedTape, pitDoorStaging, pitDoorTape,
} from '../../../scripts/procgen/probe-seedling-pit-doors.mjs';
import { YETI_CLEAR, yetiStaging } from '../../../scripts/procgen/probe-seedling-yeti.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'pitdoor-witness');
const witness = (name) => JSON.parse(readFileSync(join(WIT, `pitdoor-${name}.json`), 'utf8'));
const ON = (fn) => withContactFidelity({ pitTeleporterCrossing: true }, fn);
const OFF = (fn) => withContactFidelity({ pitTeleporterCrossing: false }, fn);
const pos = (o) => ({ t: o.t, x: o.x, y: o.y, level: o.level });
const ENV = ['SEEDLING_CONTACT_FIDELITY', 'SEEDLING_PIT_TELEPORTER_CROSSING'];
const doorIndex = (w, level) => w.teleporters.findIndex((t) => t.x === PIT_DOORS[level].x && t.y === PIT_DOORS[level].y);

const solveExit = (staging, level) => {
    const run = createRunForStaging(staging, atlasLevelSource());
    try {
        const out = solveSegment({ run, name: `pitport-L${level}`, boot: staging.boot,
            goals: [{ kind: 'reach-exit', exit: { x: PIT_DOORS[level].x, y: PIT_DOORS[level].y } }] });
        return { solved: true, out, level: run.level, at: { x: run.state.x, y: run.state.y } };
    } catch (e) {
        return { solved: false, name: e.name, message: e.message, obstacle: e.obstacle ?? null };
    }
};

describe('PITPORT D2 — the switch and the door lookup', () => {
    it.skipIf(ENV.some((k) => process.env[k]))('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.pitTeleporterCrossing).toBe(false);
        expect(CONTACT_FIDELITY.pitTeleporterCrossing).toBe(false);
    });

    it('the atlas holds exactly three doors on a Pit tile, each on its own tile, in a room with no fallthrough', () => {
        const src = atlasLevelSource();
        const found = [];
        for (const level of Object.keys(PIT_DOORS).map(Number)) {
            const w = buildLevelWorld(src(level));
            expect(w.fallthrough ?? null).toBe(null);
            const i = doorIndex(w, level);
            const tp = w.teleporters[i];
            expect([Math.floor(tp.x / 16), Math.floor(tp.y / 16)]).toEqual(PIT_DOORS[level].tile);
            expect(tp.to).toBe(PIT_DOORS[level].to);
            found.push(level);
        }
        expect(found).toEqual([43, 58, 100]);
    });

    it('the planner: ON exempts the allowed live door\'s pit tile only; OFF, another door, or a shut door keep it', () => {
        const src = atlasLevelSource();
        const w43 = buildLevelWorld(src(43));
        const i = doorIndex(w43, 43);
        const c = { x: 152, y: 72 };
        expect(OFF(() => plannerObstacleAt(w43, c.x, c.y, i)?.kind)).toBe('pit');
        expect(OFF(() => liveDoorPitTile(w43, i))).toBe(null);
        expect(ON(() => plannerObstacleAt(w43, c.x, c.y, i))).toBe(null);
        expect(ON(() => liveDoorPitTile(w43, i))).toMatchObject({ tx: 9, ty: 4 });
        // Another exit allowed (the stairs): the door is a trigger, and its tile still a pit.
        expect(ON(() => plannerObstacleAt(w43, c.x, c.y, 1 - i)?.kind)).toBe('pit');
        expect(ON(() => plannerObstacleAt(w43, c.x, c.y, null)?.kind)).toBe('pit');
        // L100: the door's tile is exempt, the pit ring around it is not (the walk may enter ONE pit, the door's).
        const w100 = buildLevelWorld(src(100));
        const k = doorIndex(w100, 100);
        expect(ON(() => plannerObstacleAt(w100, 296, 104, k))).toBe(null);
        expect(ON(() => plannerObstacleAt(w100, 264, 72, k)?.kind)).toBe('pit');
        expect(ON(() => plannerObstacleAt(w100, 328, 104, k)?.kind)).toBe('pit');
        // L58 on a fresh build: the door is SHUT, so its pit is forbidden floor.
        const w58 = buildLevelWorld(src(58));
        const j = doorIndex(w58, 58);
        expect(w58.teleporters[j].deactivated).toBe(true);
        expect(ON(() => liveDoorPitTile(w58, j))).toBe(null);
        expect(ON(() => plannerObstacleAt(w58, 88, 24, j)?.kind)).toBe('pit');
    });

    it('OFF: L43, L100 and the cleared L58 refuse `unmodelled-pit-teleporter` by name, as at the base', async () => {
        for (const name of ['l43-south', 'l100-west', 'l58-east']) {
            const w = PIT_DOOR_WITNESSES.find((x) => x.name === name);
            const staging = await pitDoorStaging(w);
            const off = OFF(() => solveExit(staging, w.level));
            expect(off.solved, name).toBe(false);
            expect(off.obstacle, name).toEqual({ kind: 'unmodelled-pit-teleporter',
                id: `teleporter@${PIT_DOORS[w.level].x},${PIT_DOORS[w.level].y}`, tile: PIT_DOORS[w.level].tile });
        }
    });

    it('ON: the solver crosses each live door, and its plan IS the witnessed tape\'s prefix, key for key', async () => {
        for (const name of ['l43-south', 'l100-west', 'l58-east']) {
            const w = PIT_DOOR_WITNESSES.find((x) => x.name === name);
            const staging = await pitDoorStaging(w);
            const on = ON(() => solveExit(staging, w.level));
            expect(on.solved, `${name}: ${on.message}`).toBe(true);
            expect(on.level).toBe(PIT_DOORS[w.level].to);
            expect(on.out.records.at(-1)).toMatchObject({ goal: 'reach-exit', to: PIT_DOORS[w.level].to });
            if (w.via !== null) continue;
            const tape = witness(name).tape;
            const keysAt = (t) => tape.inputs.filter((sp) => sp.from <= t && t < sp.to).map((sp) => sp.key).sort();
            expect(on.out.perTick.map((h) => [...h].sort())).toEqual(on.out.perTick.map((_, t) => keysAt(t)));
        }
    });

    it('ON: the SHUT L58 door stays refused (DEACTIVATED) and its pit stays a pit', async () => {
        const w = PIT_DOOR_WITNESSES.find((x) => x.name === 'l58-shut-east');
        const staging = await pitDoorStaging(w);
        for (const arm of [ON, OFF]) {
            const r = arm(() => solveExit(staging, 58));
            expect(r.solved).toBe(false);
            expect(r.message).toMatch(/^the teleporter at \(80,16\) in level 58 is DEACTIVATED/);
        }
    });

    it('ON: a run LATCHED on a pit door keeps the named refusal (the door cannot fire; the pit takes the player)', () => {
        for (const level of [43, 100]) {
            const d = PIT_DOORS[level];
            const staging = arrivalStaging({ level, x: d.x, y: d.y }, { items: ['hasSword'] });
            const run = createRunForStaging(staging, atlasLevelSource());
            expect([...run.state.latched]).toEqual([doorIndex(run.world, level)]);
            const r = ON(() => solveExit(staging, level));
            expect(r.solved).toBe(false);
            expect(r.obstacle).toEqual({ kind: 'unmodelled-pit-teleporter', id: `teleporter@${d.x},${d.y}`, tile: d.tile });
        }
    });

    it('ON, L58 after the Yeti\'s talk: the door is admitted, and the walk then stalls on the Yeti\'s Solid (the next gap)',
        async () => {
            const staging = await yetiStaging();
            const r = withContactFidelity({ yetiTalk: true, pitTeleporterCrossing: true }, () => {
                try {
                    solveSegment({ run: createRunForStaging(staging, atlasLevelSource()), name: 'yeti', boot: staging.boot,
                        goals: [YETI_CLEAR, { kind: 'reach-exit', exit: { x: 80, y: 16 } }] });
                    return { solved: true };
                } catch (e) { return { solved: false, message: e.message, obstacle: e.obstacle ?? null }; }
            });
            expect(r.solved).toBe(false);
            expect(r.obstacle?.kind).not.toBe('unmodelled-pit-teleporter');
            // The planner's A* edge (56,56) → (72,56) passes 0.07 px into `yeti@56,56`'s 10x12 Solid (y 58..70): the
            // walk holds `right` alone at y 55.93 and stalls. Handed over (PITPORT report, "the next gap").
            expect(r.message).toMatch(/waypoint 1 \(72,56\): not reached within 400 ticks; stalled at \(56\.8\d*,55\.93\d*\)/);
        });
});

describe('PITPORT D1 — the game witnesses, reproduced by the model at 0 px', () => {
    for (const w of PIT_DOOR_WITNESSES) {
        it(`${w.name}: every tick of the game's stream (switch ON and OFF alike)`, () => {
            const wit = witness(w.name);
            for (const arm of [ON, OFF]) {
                const out = arm(() => runTape(parseTape(wit.tape), { levelSource: atlasLevelSource() }));
                expect(out.ticks.map(pos)).toEqual(wit.gameTicks);
            }
        });
    }

    it('the game\'s verdicts: each live door crosses the tick after the box first overlaps it; the shut or latched one never',
        () => {
            for (const w of PIT_DOOR_WITNESSES) {
                const g = witness(w.name).game;
                if (w.shut || w.latched) {
                    expect(g.crossedAt, w.name).toBe(null);
                    expect(g.respawns.length, w.name).toBeGreaterThan(0);
                } else {
                    expect(g.crossedAt, w.name).toBe(g.firstOnDoor + 1);
                }
            }
        });

    it('the committed tapes are what the producer derives today', async () => {
        for (const w of PIT_DOOR_WITNESSES) {
            const t = await pitDoorParsedTape(w.name, await pitDoorTape(w));
            expect(JSON.parse(JSON.stringify(t)), w.name).toEqual(witness(w.name).tape);
        }
    });
});
