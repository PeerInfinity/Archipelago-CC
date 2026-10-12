/**
 * seedlingDemo/hammerPressBombs.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE BW: THE PRESS KILL'S WAITS SEE THE LOBBER'S BOMBS
 * (`PRESS_KILL_BOMBS`, `pressKillCost.js`, OFF).
 *
 * Fidelity MOVINGWAIT's hand-over: with `SEEDLING_MOVING_WAIT=1`, divergence leg 381 (L40) walks to the strike cell
 * (248,184) on `spinner@192,128` that `deriveStrike` chose at t1099 and stands there until the press; the lobber's `#7`,
 * launched at the arriving player at t1125, explodes on the stance at t1156. The walk was priced against the bombs,
 * the dwell and the train were not. ON, `deriveStrike` asks the lobber's forecast of the stand (`strikeStandBlast`) and
 * `deriveRefuge` of the refuge's walk and wait (`refugeBlast`).
 *
 * The rows replay fidelity's committed witness `fixtures/bomb-witness/movingwait-l42-381-pace` (the MOVING_WAIT
 * solver's own walk for leg 381 from the atlas arrival, recorded on the game to t1150) to the tick the press kill began
 * (t1099) and to t1150, six ticks before the blast, and ask the two derivations OFF against ON. The control is P1's
 * staging A, a room the lobber never reaches: ON derives exactly what OFF derives.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    PRESS_KILL_BOMBS, PRESS_KILL_BOMBS_COUNTS, PRESS_KILL_BOMBS_DEFAULT, resetPressKillBombsCounts,
    withPressKillBombs,
} from './pressKillCost.js';
import { deriveRefuge, deriveStrike } from './solverBot.js';
import { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const WITNESS = JSON.parse(readFileSync(new URL('./fixtures/bomb-witness/movingwait-l42-381-pace.json',
    import.meta.url), 'utf8'));
const BODY = 'spinner@192,128';
const NO_CONTACTS = new Set();
const REFUGE_WINDOW = 45; // `SPINNER.hammerPeriod`: the window the press kill asks a refuge over when no i-frame runs

/** The model's run after the witness tape's tick `upto` (the game's camera on uncertain shake ticks). */
function runAt(upto) {
    const cams = new Map(WITNESS.samples.map((s) => [s.t, s.cam]));
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(WITNESS.tape)), {
        levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        cameraWitness: (t) => cams.get(t) ?? null,
    });
    for (let r = st.next(); !r.done; r = st.next()) if (r.value.observation.t >= upto) break;
    return run;
}

const bombWhys = (d) => (d?.rejected ?? []).filter((r) => /the STAND meets a bomb/.test(r.why));

describe('PRESS_KILL_BOMBS — the switch', () => {
    it.skipIf(globalThis.process?.env?.SEEDLING_PRESS_KILL_BOMBS !== undefined)('ships OFF', () => {
        expect(PRESS_KILL_BOMBS_DEFAULT).toBe(false);
        expect(PRESS_KILL_BOMBS.enabled).toBe(false);
    });

    it('withPressKillBombs sets and restores it, also on a throw', () => {
        const was = PRESS_KILL_BOMBS.enabled;
        expect(withPressKillBombs(true, () => PRESS_KILL_BOMBS.enabled)).toBe(true);
        expect(PRESS_KILL_BOMBS.enabled).toBe(was);
        expect(() => withPressKillBombs(true, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_KILL_BOMBS.enabled).toBe(was);
    });
});

describe('PRESS_KILL_BOMBS — leg 381 (the MOVINGWAIT witness walk)', () => {
    it('t1099, the kill\'s first tick: OFF stands on (248,184) to press at t1153; ON names #7\'s blast on that '
        + 'stance and strikes from (232,184)', () => {
        const run = runAt(1099);
        expect(run.ticksCompleted).toBe(1099);
        const off = withPressKillBombs(false, () => deriveStrike(run, BODY, NO_CONTACTS, 0));
        expect(off.cell).toEqual({ x: 248, y: 184 });
        expect(off.pressAt).toBe(1153);
        expect('bombed' in off).toBe(false);
        resetPressKillBombsCounts();
        const on = withPressKillBombs(true, () => deriveStrike(run, BODY, NO_CONTACTS, 0));
        expect(on.cell).toEqual({ x: 232, y: 184 });
        expect(on.pressAt).toBe(1161);
        expect(on.bombed).toBe(8);
        expect(PRESS_KILL_BOMBS_COUNTS.strikeRefused).toBe(8);
        const why = bombWhys(on).find((r) => r.option === 'strike (248,184) at +54');
        expect(why?.why).toMatch(/at \+57 bombpusher@112,128#7's Explosion at \(256,187\) lands on the stance/);
    }, 120_000);

    it('t1150, #7 in the air: OFF still stands on (248,184); ON has no stance #7 does not reach, and its refuge '
        + 'leaves the blast', () => {
        const run = runAt(1150);
        expect(run.entities('bombs').map((b) => b.id)).toEqual(['bombpusher@112,128#7']);
        const off = withPressKillBombs(false, () => deriveStrike(run, BODY, NO_CONTACTS, 0));
        expect(off.cell).toEqual({ x: 248, y: 184 });
        const on = withPressKillBombs(true, () => deriveStrike(run, BODY, NO_CONTACTS, 0));
        expect(on.cell).toBeNull();
        expect(on.bombed).toBe(9);
        expect(bombWhys(on)[0].why).toMatch(/at \+6 bombpusher@112,128#7's Explosion at \(255,187\)/);
        const rOff = withPressKillBombs(false, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
        resetPressKillBombsCounts();
        const rOn = withPressKillBombs(true, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
        expect([rOff.x, rOff.y]).toEqual([232, 200]);
        expect([rOn.x, rOn.y]).toEqual([216, 168]);
        expect(PRESS_KILL_BOMBS_COUNTS.refugeRefused).toBeGreaterThan(0);
    }, 120_000);

    it('OFF asks nothing (the instrument stays at zero)', () => {
        const run = runAt(1099);
        resetPressKillBombsCounts();
        withPressKillBombs(false, () => {
            deriveStrike(run, BODY, NO_CONTACTS, 0);
            deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW);
        });
        expect(Object.values(PRESS_KILL_BOMBS_COUNTS).every((n) => n === 0)).toBe(true);
    }, 120_000);
});

describe('PRESS_KILL_BOMBS — a room the lobber does not reach derives as OFF', () => {
    it('staging A (L40 south door, 380+ px from bombpusher@112,128): the strike and the refuge are OFF\'s', () => {
        const view = readFileSync(new URL('./fixtures/hammer-p1-l40-south-boot.json', import.meta.url), 'utf8');
        const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(view))), atlasLevelSource());
        for (const id of ['spinner@880,848', 'spinner@816,848']) {
            const off = withPressKillBombs(false, () => deriveStrike(run, id, NO_CONTACTS, 0));
            const { bombed, ...on } = withPressKillBombs(true, () => deriveStrike(run, id, NO_CONTACTS, 0));
            expect(bombed).toBe(0);
            expect(on).toEqual(off);
        }
        const rOff = withPressKillBombs(false, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
        const rOn = withPressKillBombs(true, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
        expect(rOn).toEqual(rOff);
    }, 120_000);
});
