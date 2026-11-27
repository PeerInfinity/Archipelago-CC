/**
 * ⛓ seedling-js-l57-exit-check — **AN EXIT A BOSS FIGHT ADDS** passes the JS runtime's exit check, and the walker hands
 * it to the solver.
 *
 * The JS whole-game walk stopped at entry 24 ("Level 089 - Feather", `level_57`) on
 *   `the JS runtime refused {"kind":"exit","level":57,"tiles":[[6,4]],…}: level 57 has no teleporter or pit on tile (6, 4)`
 * L57 places no teleporter at all: its only way on is the mouth `TentacleBeast.createMouthEntrance` adds at the end of
 * "dying" (`TentacleBeast.as:211-214`, a `Teleporter` at the body's `(x - 8, y - 8)` = `.oel` (80,48) + (24,24) − (8,8)
 * = (96,64), tile (6,4)). It is no `.oel` entity, so no `EXIT_TYPES` cell of the record holds it, and it is no pit. The
 * census over the committed vanilla-room presets (`seedling_playthrough` AP_1 / seed 1, `seedling_er`: 320 named exits
 * each) finds exactly two such exits: this one and L69's `out_lightbosscontroller_72_72` (`LightBossController.endState`,
 * `:102-107`) — the two rows of the solver's own `FIGHT_EXITS` (`jsRuntimeSolver.fightExitOf`). The check now asks that
 * row of the live run (`jsRuntimeCore.fightExit`), so it accepts exactly what `solverGoalFor` maps (the fight, then the
 * exit) and nothing else.
 *
 * ── THE MUTATION LIST (each predicted red by name; reds measured on the base ac1d02e6fb) ──
 *   m0 the base (both files at ac1d02e6fb)                 -> the six "now" rows red (6 failed / 5 passed).
 *   m1 `validateGoal`'s fight arm dropped                  -> "walkTo accepts L57's mouth…", "…L69's…" red.
 *   m2 the walker's `resolve` fight arm dropped             -> the three "now" walker rows red.
 *   m3 the fight arm accepts any cell of the level          -> "a cell that is no exit is still refused by name" reds.
 *   m4a the core's solver-off refusal dropped               -> "now: with the solver mode off the mouth is refused…" reds.
 *   m4b the walker's solver-off refusal dropped             -> "now: with the solver mode off the walker refuses…" reds.
 *   m5 a declined fight exit walks instead of failing       -> "a declined fight exit FAILS…" reds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { createRuntimeWalker, WALK_STATES } from './jsRuntimeWalker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const PLAYTHROUGH = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json').preset_sidecars['1'];
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });

const payload = (region) => PLAYTHROUGH[region].playable_payload;
/** The playthrough's own exit goal, as the host controller resolves it (`exit_tiles`, the exit's name). */
const exitGoal = (region, exitId) => {
    const pl = payload(region);
    const e = pl.exits.find((x) => x.exit_id === exitId);
    return { kind: 'exit', level: pl.level, tiles: e.exit_tiles, name: e.exitName };
};
/** A live runtime on the vanilla map, booted into `level` at `(x, y)`; the solver mode as asked. */
function arrive(level, { x, y }, { solverWalk = true } = {}) {
    const rt = createJsRuntime({});
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
    expect(rt.run.level).toBe(level);
    rt.playback.setSolverWalk(solverWalk);
    return rt;
}

const MOUTH = exitGoal('level_57', 'out_tentaclebeast_80_48');
const LIGHTS = exitGoal('level_69', 'out_lightbosscontroller_72_72');
/** L57's way in: L56's pit lands at (96,160); L69's: L70's pit lands at (48,128) (the payloads' entrance spawns). */
const L57_IN = payload('level_57').exits.find((e) => e.exit_id === 'in_pit_L56_6_10').entrance_spawn;
const L69_IN = payload('level_69').exits.find((e) => e.exit_id === 'in_pit_L70_3_8').entrance_spawn;

describe('the exit check — an exit a boss fight adds', () => {
    it('the goals are the presets\' own: L57 → L58 at tile (6,4), L69 → L36 at tile (4,4)', () => {
        expect(MOUTH).toEqual({ kind: 'exit', level: 57, tiles: [[6, 4]], name: 'level_57 -> level_58__r4c1' });
        expect(LIGHTS).toEqual({ kind: 'exit', level: 69, tiles: [[4, 4]], name: 'level_69 -> level_36' });
        expect(L57_IN).toEqual({ x: 96, y: 160 });
        expect(L69_IN).toEqual({ x: 48, y: 128 });
    });

    it('now: walkTo accepts L57\'s mouth (the Tentacled Beast\'s `createMouthEntrance`), and the walk does not fail on it', () => {
        const rt = arrive(57, L57_IN);
        expect(rt.playback.walkTo(MOUTH)).toEqual({ ok: true });
        expect(rt.events.filter((e) => e.type === 'walk-refused')).toEqual([]);
    });

    it('now: walkTo accepts L69\'s Lights exit (`LightBossController.endState`)', () => {
        const rt = arrive(69, L69_IN);
        expect(rt.playback.walkTo(LIGHTS)).toEqual({ ok: true });
    });

    it('a cell that is no exit is still refused by name, in the fight\'s room too', () => {
        const rt = arrive(57, L57_IN);
        expect(rt.playback.walkTo({ kind: 'exit', level: 57, tiles: [[1, 1]] }))
            .toEqual({ ok: false, reason: 'level 57 has no teleporter or pit on tile (1, 1)' });
        // One cell off the mouth is not the mouth.
        expect(rt.playback.walkTo({ kind: 'exit', level: 57, tiles: [[5, 4]] }))
            .toEqual({ ok: false, reason: 'level 57 has no teleporter or pit on tile (5, 4)' });
        const r69 = arrive(69, L69_IN);
        expect(r69.playback.walkTo({ kind: 'exit', level: 69, tiles: [[4, 5]] }))
            .toEqual({ ok: false, reason: 'level 69 has no teleporter or pit on tile (4, 5)' });
    });

    it('now: with the solver mode off the mouth is refused by name — the walk alone fights nothing', () => {
        const rt = arrive(57, L57_IN, { solverWalk: false });
        expect(rt.playback.walkTo(MOUTH)).toEqual({ ok: false, reason: 'level 57\'s exit at (96, 64) is the teleporter a '
            + 'boss fight adds when it ends: it is walked by the solver\'s fight, and the solver mode is off '
            + '(`flashPanel.seedlingSolverWalk`)' });
    });

    it('the run standing in another level binds no fight: the old refusal, by its old text', () => {
        const rt = arrive(56, { x: 96, y: 16 });
        expect(rt.playback.walkTo(MOUTH)).toEqual({ ok: false, reason: 'level 57 has no teleporter or pit on tile (6, 4)' });
    });

    it('pits and placed teleporters are unchanged: L56\'s pit, L58\'s door back to L57', () => {
        const r56 = arrive(56, { x: 96, y: 16 });
        expect(r56.playback.walkTo(exitGoal('level_56', 'out_pit_6_10'))).toEqual({ ok: true });
        const pl58 = payload('level_58__r4c1');
        const back = pl58.exits.find((e) => e.exit_id === 'out_teleporter_48_112');
        const r58 = arrive(58, back.entrance_spawn);
        expect(r58.playback.walkTo(exitGoal('level_58__r4c1', 'out_teleporter_48_112'))).toEqual({ ok: true });
    });
});

describe('the walker — a fight exit resolves to its own cell, for the solver', () => {
    const run = { level: 57, world: { teleporters: [], pitTiles: [] }, state: { x: 96, y: 160 } };
    const FIGHT = { controller: { id: 'tentaclebeast@80,48' }, exit: { x: 96, y: 64 } };
    const walk = (solver, fightExitOf = () => FIGHT) => {
        const w = createRuntimeWalker({ solver, apItemOf: () => null, isCollected: () => false, fightExitOf });
        w.setGoal(MOUTH);
        w.play();
        return w;
    };

    it('now: the walker resolves a fight exit to the exit\'s cell and asks the solver with it', () => {
        const asked = [];
        const solver = { enabled: true, keysFor: (r, g, res) => { asked.push(res); return { held: new Set(['RIGHT']) }; },
            clear() {}, cancel() {} };
        const w = walk(solver);
        expect(w.heldFor(run)).toEqual(new Set(['RIGHT']));
        expect(asked).toEqual([{ target: { x: 104, y: 72 }, allowTeleporter: null, fight: FIGHT }]);
        expect(w.state).toBe(WALK_STATES.WALKING);
    });

    it('no fight on the cells: the old refusal, by its old text', () => {
        const solver = { enabled: true, keysFor: () => ({ held: new Set() }), clear() {}, cancel() {} };
        const w = walk(solver, () => null);
        expect(w.heldFor(run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.FAILED);
        expect(w.describe()).toContain('level 57 has no live teleporter or pit on tile (6, 4)');
    });

    it('now: with the solver mode off the walker refuses a fight exit by name', () => {
        const solver = { enabled: false, keysFor: () => null, clear() {}, cancel() {} };
        const w = walk(solver);
        expect(w.heldFor(run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.FAILED);
        expect(w.describe()).toContain('level 57\'s exit at (96, 64) is the teleporter a boss fight adds when it ends: '
            + 'only the solver fights it, and the solver mode is off');
    });

    it('now: a declined fight exit FAILS by the solver\'s reason (a walk to the cell fights nothing)', () => {
        const solver = { enabled: true, keysFor: () => ({ declined: 'no Tentacled Beast policy variant opens the mouth' }),
            clear() {}, cancel() {} };
        const w = walk(solver);
        expect(w.heldFor(run)).toBeNull();
        expect(w.state).toBe(WALK_STATES.FAILED);
        expect(w.describe()).toContain('the solver declined — no Tentacled Beast policy variant opens the mouth');
    });
});
