/**
 * ⛓ BOSS WIRING (slice `seedling-js-boss-wiring`) — the L57 Tentacled Beast's mouth exit reaches the solver from the
 * JS runtime's goal mapping, behind `CONTACT_FIDELITY.tentacleBeastFight` (fidelity BOSSKILLS D3), and nothing moves
 * while it is OFF:
 *
 *   legs 505/507  exit `out_tentaclebeast_80_48` (tile (6,4); no live teleporter until the end of "dying")
 *                 → `solverGoalFor` → `{kind: 'sequence', goals: [clear-tag {57,0}, reach-exit (96,64)]}` (`FIGHT_EXITS`)
 *
 * The boss-report halves (506/508, and L82's 665/667) are pinned in `flashPanel/seedlingVanillaArmMap.test.js`. L82's
 * exit (664/666) is a PLACED teleporter, so it needs no `FIGHT_EXITS` row: its row below pins that it stays the door.
 *
 * ⛔ THE STAGING IS fidelity's game witness (`fixtures/tentaclebeast-witness/tb-solve-s2.json`), the goals the ones
 * fidelity's own solve test hands `solveSegment` (`fidelityTentacleBeast.test.js`) — the mapping is pinned to what the
 * model solves.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the tentacle row ignores `cleared`        -> "a revisit…" reds (a second fight asked of a dead beast).
 *   m2 the mouth offsets dropped (exit = body)   -> "ON: the exit is the fight…" reds (no cell matches; old text).
 *   m3 the tag typed instead of read             -> "the tag is the placement's" reds on the rewritten tag.
 *   m4 no levelSource still binds                -> "without the room source…" reds.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { arrivalSolverGoal } from './wasmArrival.js';
import { solverGoalFor, solverGoalsOf } from './jsRuntimeSolver.js';
import { assertGoal } from './solverBot.js';

const levelSource = atlasLevelSource();
const witness = (dir, name) => solveStaging(stagingFromTape(parseTape(JSON.stringify(JSON.parse(readFileSync(
    new URL(`./fixtures/${dir}/${name}.json`, import.meta.url), 'utf8')).tape))));
const TB = witness('tentaclebeast-witness', 'tb-solve-s2');
/** Legs 505/507's goal, as the sweep's legs list spells it. */
const EXIT = { kind: 'exit', level: 57, tiles: [[6, 4]], name: 'level_57 -> level_58__r4c1' };
/** fidelity's solve test's goals (`fidelityTentacleBeast.test.js`). */
const FIDELITY_GOALS = [
    { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
    { kind: 'reach-exit', exit: { x: 96, y: 64 } },
];
const map = (on, staging = TB, goal = EXIT, src = levelSource) => withContactFidelity({ tentacleBeastFight: on },
    () => arrivalSolverGoal(goal, { staging, levelSource: src, record: src(goal.level) }));

describe('BOSS WIRING — legs 505/507: the exit only the Tentacled Beast\'s death opens', () => {
    it('OFF: byte-identical — the old refusal, by its old text', () => {
        expect(map(false)).toEqual({ walker: 'no live teleporter resolved for the exit' });
    });

    it('ON: the exit is the fight, then the exit — fidelity\'s own goals, every field read off the model', () => {
        const m = map(true);
        expect(m).toEqual({ goal: { kind: 'sequence', goals: FIDELITY_GOALS } });
        for (const g of solverGoalsOf(m.goal)) expect(() => assertGoal(g, 'boss-wiring')).not.toThrow();
    });

    it('a revisit (the tag cleared): the beast is built dead with its mouth, so it is the door\'s plain reach-exit', () => {
        const m = map(true, { ...TB, persistence: [...TB.persistence, { level: 57, tag: 0 }] });
        expect(m).toEqual({ goal: { kind: 'reach-exit', exit: { x: 96, y: 64 } } });
    });

    it('an exit on other cells is not the fight\'s (the old refusal)', () => {
        expect(map(true, TB, { ...EXIT, tiles: [[1, 1]] })).toEqual({ walker: 'no live teleporter resolved for the exit' });
    });

    it('the tag is the placement\'s in the room source, never typed', () => {
        const rewrite = (n) => {
            const r = levelSource(n);
            if (n !== 57) return r;
            return { ...r, entities: r.entities.map((e) => (e.type === 'tentaclebeast' ? { ...e, attrs: { ...e.attrs, tag: '3' } } : e)) };
        };
        const m = map(true, TB, EXIT, rewrite);
        expect(m.goal?.goals?.[0]?.tag).toEqual({ level: 57, tag: 3 });
    });

    it('without the room source the row cannot read the tag, so nothing binds (the old refusal)', () => {
        const run = withContactFidelity({ tentacleBeastFight: true }, () => createRunForStaging(TB, levelSource));
        const m = withContactFidelity({ tentacleBeastFight: true },
            () => solverGoalFor(EXIT, { run, resolved: { allowTeleporter: null } }));
        expect(m).toEqual({ walker: 'no live teleporter resolved for the exit' });
    });
});

describe('BOSS WIRING — legs 664/666: L82\'s exit is a placed door, ON and OFF', () => {
    const KOF = witness('lavaboss-witness', 'kof-solve-203');
    const DOOR = { kind: 'exit', level: 82, tiles: [[9, 0]], name: 'level_82 -> level_96' };
    for (const on of [false, true]) {
        it(`kingOfFireFight ${on ? 'ON' : 'OFF'}: the door's reach-exit (the body is the solver's frontier obstacle)`, () => {
            const m = withContactFidelity({ kingOfFireFight: on },
                () => arrivalSolverGoal(DOOR, { staging: KOF, levelSource, record: levelSource(82) }));
            expect(m).toEqual({ goal: { kind: 'reach-exit', exit: { x: 144, y: 0 } } });
        });
    }
});
