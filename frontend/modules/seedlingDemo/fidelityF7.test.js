/**
 * Seedling fidelity F7: a LATCHED publisher re-publishes its group on RE-ENTRY.
 *
 *   · D-A (the rope): `RopeStart.check()` (`Puzzlements/RopeStart.as:31-38`)
 *     calls `hit()` on a new `Game`'s first frame when the rope's tag is
 *     cleared, so `set activate` (`:79-91`) publishes the group AGAIN. L16's
 *     three `shoot = 1` arrow traps stay silent on the way back from L17. Before
 *     F7 the model rebuilt only the shrunk geometry, so the traps were armed and
 *     the solver refused the return leg (`level_16 -> level_15__r1c5`) at the
 *     arrival tile. The game's side: `f7-l16-reentry` and `f7-l16-walkin`
 *     (recorded by `check-seedling-bot-differential --record`; tapeRunner holds
 *     the model to them) and `fixtures/f7-reentry-oracle.json`
 *     (`probe-seedling-f7-reentry.mjs --record`: each witness without `{16,0}`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { createActivatorState, latchAtBuild } from './activators.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const BASE = parseTape(readFileSync(join(HERE, 'fixtures', 'witness-bases', 'r9-solve-32.f6.json'), 'utf8'));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'f7-reentry-oracle.json'), 'utf8'));
const SRC = atlasLevelSource();
const TRAPS = ['arrowtrap@96,32', 'arrowtrap@112,32', 'arrowtrap@128,32'].sort();
/** The L17 return arrival in L16, in the chain-end staging (which carries `{16,0}`). */
const L16_BACK = { level: 16, x: 112, y: 48 };
const stagingAt = (boot, { rope = true } = {}) => ({
    ...BASE, boot, equips: [], despawn: [], tick0: null,
    persistence: rope ? BASE.persistence : BASE.persistence.filter((p) => !(p.level === 16 && p.tag === 0)),
});
const ids = (s) => (s ? [...s].sort() : s);
const back = (rope) => createRunForStaging(stagingAt(L16_BACK, { rope }), SRC, { scratchPersistence: true });
/** `wasmArrival.arrivalSolverGoal`'s shape for `level_16 -> level_15__r1c5` (L16's `stairsup@16,64`). */
const TO_L15 = { kind: 'reach-exit', exit: { x: 16, y: 64 } };

describe('fidelity F7 — D-A: a pulled rope re-publishes its group at build', () => {
    it('the chain-end staging carries {16,0} (the rope the forward leg pulled)', () => {
        expect(BASE.persistence.some((p) => p.level === 16 && p.tag === 0)).toBe(true);
    });
    it('a cleared rope builds SHRUNK and `bootPulled`; an uncleared one does neither', () => {
        const pulled = buildLevelWorld(SRC(16), { cleared: [0] }).solids.find((s) => s.ropeId === 'rope@32,16');
        const whole = buildLevelWorld(SRC(16)).solids.find((s) => s.ropeId === 'rope@32,16');
        expect([pulled.bootPulled, pulled.rect.right - pulled.rect.x]).toEqual([true, 16]);
        expect([whole.bootPulled, whole.rect.right - whole.rect.x]).toEqual([false, 64]);
    });
    it('the L17 return arrival: the rope is pulled, group 0 latched, NO trap armed (t0..t3)', () => {
        const run = back(true);
        expect(ids(run.entities('pulledRopes'))).toEqual(['rope@32,16']);
        expect(ids(run.entities('latchedGroups'))).toEqual([0]);
        for (let t = 0; t < 4; t += 1) {
            expect(ids(run.entities('armedArrowTraps'))).toEqual([]);
            run.advance(new Set());
        }
        // ⚠ A re-pull is not a pull: no `ropePulls` row and no second banked clear.
        expect(run.ledger('ropePulls')).toEqual([]);
    });
    it('CONTROL: the same arrival WITHOUT {16,0} arms all three traps and pulls nothing', () => {
        const run = back(false);
        expect(ids(run.entities('pulledRopes'))).toEqual([]);
        expect(ids(run.entities('latchedGroups'))).toEqual([]);
        expect(ids(run.entities('armedArrowTraps'))).toEqual(TRAPS);
    });
    it('`level_16 -> level_15__r1c5` SOLVES from the return arrival (it refused at the arrival tile)', () => {
        const run = back(true);
        const out = solveSegment({ run, goals: [TO_L15], name: 'f7-l16-back', boot: L16_BACK });
        expect(run.level).toBe(15);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(out.perTick).toHaveLength(99);
    });
    it('CONTROL: without {16,0} the same leg still refuses, by the old name', () => {
        const run = back(false);
        expect(() => solveSegment({ run, goals: [TO_L15], name: 'f7-l16-back-control', boot: L16_BACK }))
            .toThrow(/the danger map forbids \(120,56\) — arrowLane:arrowtrap@112,32 \(an ARMED trap's lane/);
    });
    it.each([[28, 0, 'rope@160,64', 'fallrock@112,240'], [39, 9, 'rope@96,384', 'fallrock@144,624']])(
        'L%i: a cleared rope whose group holds an UNFALLEN FallRock is refused by name (the game would drop it at the arrival)',
        (level, tag, rope, rock) => {
            const run = createRunForStaging({ ...stagingAt({ level, x: 16, y: 16 }), persistence: [{ level, tag }] },
                SRC, { scratchPersistence: true });
            expect(() => run.entities('latchedGroups')).toThrow(new RegExp(
                `${rope} in level ${level} boots PULLED .* and ${rock} .* has NOT fallen`));
        });
    it.each(['REENTRY', 'WALKIN'])('the game (WITNESS-%s): walks the committed recording, the model\'s stream, no hit', (name) => {
        const a = ORACLE.arms.find((r) => r.arm === `WITNESS-${name}`);
        expect([a.observations, a.vsRecorded.worst, a.vsModel.worst, a.hits, a.error]).toEqual([61, 0, 0, 0, '']);
        expect(a.last.level).toBe(16);
    });
    it('the ORDER (game-measured): an UNlatched trap fires on L16\'s first update, a re-latched one never does', () => {
        // Without {16,0} the stream leaves the witness 6 rows after the world's first update in BOTH
        // arms: the boot's t0, and the walk-in's arrival on t7. So the trap updates in the arrival
        // frame — and with {16,0} that frame already sees the group published (`check()` runs above
        // every `update()`), because the witness takes no hit at all.
        const boot = ORACLE.arms.find((r) => r.arm === 'CONTROL-REENTRY');
        const walk = ORACLE.arms.find((r) => r.arm === 'CONTROL-WALKIN');
        expect([boot.vsWitness.first, walk.vsWitness.first]).toEqual([6, 7 + 6]);
        expect(boot.vsWitness.worst).toBeGreaterThan(0);
        expect(walk.vsWitness.worst).toBeGreaterThan(0);
    });
    it.each(['REENTRY', 'WALKIN'])('CONTROL-%s: the model does not replay a control (an arrow hit\'s shake band), by name', (name) => {
        expect(ORACLE.arms.find((r) => r.arm === `CONTROL-${name}`).modelControl)
            .toMatch(/whether bob bob@192,80 is on screen at tick \d+ depends on where inside `Game.shake`/);
    });
    it('`latchAtBuild` is the ONE latch a build takes: it credits a fade row one update, once', () => {
        const world = buildLevelWorld(SRC(20));
        const st = createActivatorState(world);
        expect(latchAtBuild(st, 0, world)).toBe(true);
        expect(st.byId.get('lock@32,80')).toMatchObject({ alpha: 0.99, held: 1 });
        expect(latchAtBuild(st, 0, world)).toBe(false);
        expect(st.byId.get('lock@32,80')).toMatchObject({ alpha: 0.99, held: 1 });
    });
});
