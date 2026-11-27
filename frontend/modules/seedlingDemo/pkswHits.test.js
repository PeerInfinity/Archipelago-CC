/**
 * seedlingDemo/pkswHits.test — ⛓ hammer-phase PKSW-HITS: the contracts of its two switches, both OFF.
 *   - `PRESS_KILL_REFUGE_BOMBS`: the press kill's refuge asks the lobber's forecast without the rest of
 *     `PRESS_KILL_BOMBS` (behaviour row on BW's own leg-381 witness: the refuge moves exactly as BW's does, the strike
 *     does not move at all).
 *   - `DASH_STAND_SIGHT`: the stand-tailed dash certificate asks the swing's line of sight, as `DASH_CERT_SIGHT` does for
 *     the whole chain (source rows; the witness is survey step 149, measured in the slice's report).
 * The request witnesses (re-measure-8's 32:10, both arrival clocks) are `hammerPkswHits.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    DASH_STAND_SIGHT, DASH_STAND_SIGHT_DEFAULT, PRESS_KILL_REFUGE_BOMBS, PRESS_KILL_REFUGE_BOMBS_COUNTS,
    PRESS_KILL_REFUGE_BOMBS_DEFAULT, deriveRefuge, deriveStrike, withDashStandSight, withPressKillRefugeBombs,
} from './solverBot.js';
import { PRESS_KILL_BOMBS_COUNTS, resetPressKillBombsCounts, withPressKillBombs } from './pressKillCost.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { createTapeStepper } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const SOURCE = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');

/** A top-level function's text, from its declaration to its closing brace (the first `\n}\n`). */
const bodyOf = (decl) => {
    const at = SOURCE.indexOf(decl);
    expect(at).toBeGreaterThan(-1);
    return SOURCE.slice(at, SOURCE.indexOf('\n}\n', at) + 2);
};

describe('PRESS_KILL_REFUGE_BOMBS (hammer-phase PKSW-HITS)', () => {
    it('ships OFF, and its env name is in the worker\'s table', () => {
        expect(PRESS_KILL_REFUGE_BOMBS_DEFAULT).toBe(false);
        expect(PRESS_KILL_REFUGE_BOMBS.enabled).toBe(globalThis.process?.env?.SEEDLING_PRESS_KILL_REFUGE_BOMBS === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESS_KILL_REFUGE_BOMBS');
    });

    it('withPressKillRefugeBombs sets the switch inside and restores it after, also on a throw', () => {
        const was = PRESS_KILL_REFUGE_BOMBS.enabled;
        expect(withPressKillRefugeBombs(!was, () => PRESS_KILL_REFUGE_BOMBS.enabled)).toBe(!was);
        expect(PRESS_KILL_REFUGE_BOMBS.enabled).toBe(was);
        expect(() => withPressKillRefugeBombs(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_KILL_REFUGE_BOMBS.enabled).toBe(was);
    });

    it('source: deriveRefuge is the one reader, through `refugeAsksBombs`; the strike\'s stand is not touched', () => {
        const gate = bodyOf('function refugeAsksBombs(run) {');
        expect(gate).toContain('(PRESS_KILL_BOMBS.enabled || PRESS_KILL_REFUGE_BOMBS.enabled) && bombsInPlay(run)');
        const reads = SOURCE.match(/refugeAsksBombs\(run\)/g) ?? [];
        // the declaration, deriveRefuge's question, and the kill's "nowhere to be" sentence
        expect(reads).toHaveLength(3);
        expect(bodyOf('export function deriveRefuge(')).toContain('const bombs = refugeAsksBombs(run);');
        // `deriveStrike`'s stand question stays BW's alone
        expect(SOURCE).toContain('    const bombs = PRESS_KILL_BOMBS.enabled && bombsInPlay(run);\n    let bombed = 0;');
        // nothing single-game in the switch's own code
        expect(gate).not.toMatch(/level\s*===\s*\d|@\d+,\d+|spinner@|bombpusher/);
    });
});

describe('PRESS_KILL_REFUGE_BOMBS — on BW\'s leg-381 witness (the refuge half alone)', () => {
    const WITNESS = JSON.parse(readFileSync(new URL('./fixtures/bomb-witness/movingwait-l42-381-pace.json',
        import.meta.url), 'utf8'));
    const BODY = 'spinner@192,128';
    const NO_CONTACTS = new Set();
    const REFUGE_WINDOW = 45; // `SPINNER.hammerPeriod`, as `hammerPressBombs.test.js` asks it
    const runAt = (upto) => {
        const cams = new Map(WITNESS.samples.map((s) => [s.t, s.cam]));
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(WITNESS.tape)), {
            levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
            cameraWitness: (t) => cams.get(t) ?? null,
        });
        for (let r = st.next(); !r.done; r = st.next()) if (r.value.observation.t >= upto) break;
        return run;
    };

    it('t1150, #7 in the air: the refuge leaves the blast exactly as BW\'s does; the strike stays OFF\'s', () => {
        const run = runAt(1150);
        const off = withPressKillBombs(false, () => withPressKillRefugeBombs(false,
            () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW)));
        const bw = withPressKillBombs(true, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
        PRESS_KILL_REFUGE_BOMBS_COUNTS.asked = 0;
        PRESS_KILL_REFUGE_BOMBS_COUNTS.refused = 0;
        resetPressKillBombsCounts();
        const mine = withPressKillBombs(false, () => withPressKillRefugeBombs(true,
            () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW)));
        expect([off.x, off.y]).toEqual([232, 200]);
        expect([mine.x, mine.y]).toEqual([bw.x, bw.y]);
        expect([mine.x, mine.y]).not.toEqual([off.x, off.y]);
        // counted on this switch's own instrument, never on BW's
        expect(PRESS_KILL_REFUGE_BOMBS_COUNTS.refused).toBeGreaterThan(0);
        expect(PRESS_KILL_BOMBS_COUNTS.refugeAsked).toBe(0);
        // the strike's stand is BW's question alone: ON here it derives OFF's cell
        const sOff = withPressKillBombs(false, () => deriveStrike(run, BODY, NO_CONTACTS, 0));
        const sMine = withPressKillBombs(false, () => withPressKillRefugeBombs(true,
            () => deriveStrike(run, BODY, NO_CONTACTS, 0)));
        expect(sMine.cell).toEqual(sOff.cell);
    }, 120_000);
});

describe('DASH_STAND_SIGHT (hammer-phase PKSW-HITS)', () => {
    it('ships OFF, and its env name is in the worker\'s table', () => {
        expect(DASH_STAND_SIGHT_DEFAULT).toBe(false);
        expect(DASH_STAND_SIGHT.enabled).toBe(globalThis.process?.env?.SEEDLING_DASH_STAND_SIGHT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DASH_STAND_SIGHT');
    });

    it('withDashStandSight sets the switch inside and restores it after, also on a throw', () => {
        const was = DASH_STAND_SIGHT.enabled;
        expect(withDashStandSight(!was, () => DASH_STAND_SIGHT.enabled)).toBe(!was);
        expect(DASH_STAND_SIGHT.enabled).toBe(was);
        expect(() => withDashStandSight(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(DASH_STAND_SIGHT.enabled).toBe(was);
    });

    it('source: the wrapper enters the certificate\'s sight depth only ON with a tail, and restores it', () => {
        const w = bodyOf('function standDashSighted(stand, fn) {');
        expect(w).toContain('if (!DASH_STAND_SIGHT.enabled || !stand) return fn();');
        expect(w).toMatch(/dashCertSightDepth \+= 1;\s+try \{\s+return fn\(\);\s+\} finally \{\s+dashCertSightDepth -= 1;/);
        expect(w).not.toMatch(/level\s*===\s*\d|@\d+,\d+|chaser|bob/);
    });

    it('source: ONE call site, walkTo\'s window-by-window planSwordDash (the stand-tailed path), and no other', () => {
        const calls = SOURCE.match(/standDashSighted\(/g) ?? [];
        expect(calls).toHaveLength(2); // the declaration + the one call
        expect(SOURCE).toContain(': standDashSighted(stand, () => planSwordDash(run, wps, { tolerance, dashMode,\n'
            + '                                certify: (samples) => probeSamples(samples, except),');
        // the preview's chaser arm reads the same depth counter, so the swing asks `slash()`'s line under it
        expect(SOURCE).toContain('if (dashCertSightDepth > 0 && CONTACT_FIDELITY.pixelMaskSightLines && b.tag !== \'flyer\'');
    });
});
