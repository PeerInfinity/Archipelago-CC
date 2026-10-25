/**
 * seedlingDemo/hammerRefugeBandText.test — ⛓ SEEDLING HAMMER-PHASE BX I2: THE PRESS KILL'S "NOWHERE TO BE" NAMES THE
 * REFUGES THE CAMERA'S SHAKE BAND HID (LB's hand-over 5b, second half; no switch: a refusal's words).
 *
 * When `deriveRefuge` refused candidates for the shake band (PKB's catch under `PRESS_KILL_SHAKE_GUARD`, counted in
 * `shakeRefused`), `execKillByPressOnce`'s refusal says so; with none refused its text is the words it was. The rows were
 * BX's (`hammerExecutorShakeBand.test.js` on its branch); the harvest took I2 alone, by the user's ruling of 2026-10-25
 * (the executor band switch, BX's I1, was not landed).
 *
 * The state is the page's own request: L40 leg 371 (`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem
 * Part 64,144`), captured by BX, its atlas records cut to level 40, replayed at another arrival clock (`atSeamTime`'s
 * one field) on the dashless pass alone. The band is the forecast's own, not staged.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { withPressKillBombs } from './pressKillCost.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const LEG371 = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-bx-371',
    'leg371-l40-request.json.gz'))).toString('utf8'));
function solve371(seam, { bombs }) {
    const captured = LEG371.requests[0].request;
    const req = restoreRequest({ ...captured, staging: { ...captured.staging,
        seam: { ...captured.staging.seam, time: seam } } });
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const answer = withPressKillBombs(bombs, () => solveAnytime({ ...tape, source,
        levelSource: levelSourceFromAtlas(source.records) }, { passes: passes.slice(0, 1) }));
    return { ok: answer.ok, work: answer.work, message: answer.ok ? null : String(answer.message) };
}

const NOWHERE = 'and no strike on spinner@192,128 is derivable. The room has nowhere to be.';
describe('the press kill\'s "nowhere to be" names the refuges the shake band hid (hammer-phase BX I2)', () => {
    it('371 at 5266, `PRESS_KILL_BOMBS` OFF: every one of the 12 previewed refuges is banded, and the refusal says so', () => {
        const r = solve371(5266, { bombs: false });
        expect([r.ok, r.work]).toEqual([false, 88]);
        expect(r.message.endsWith(`${NOWHERE} (PRESS_KILL_SHAKE_GUARD: 12 refuge candidate(s) whose preview the `
            + 'camera-shake band hid are not counted.)')).toBe(true);
    }, 120_000);

    it('371 at 5265, the defaults: no refuge was banded, and the refusal is the words it was (BW\'s suffix, no other)', () => {
        const r = solve371(5265, { bombs: true });
        expect([r.ok, r.work]).toEqual([false, 88]);
        expect(r.message.endsWith(`${NOWHERE} (PRESS_KILL_BOMBS: a refuge whose walk or wait a forecast Bomb's `
            + 'Explosion lands on is not counted.)')).toBe(true);
        expect(r.message).not.toContain('PRESS_KILL_SHAKE_GUARD');
    }, 120_000);
});
