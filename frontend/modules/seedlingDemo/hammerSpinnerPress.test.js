/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SPIN — `PRESS_ESCAPE_SHIELD_CLAIM` (OFF): the press kill's escape claims through a carried
 * shield. The fast rows; the leg-860 solve (OFF's corner at (770.96,860.99), ON's kill of `spinner@816,848` replayed
 * on a fresh run) is `hammerSpinnerPress.slow.test.js`.
 *
 * The real rows stand the player beside `spinner@816,848`'s spawn on leg 860's own captured staging
 * (`fixtures/spin-witness/leg860-request.json.gz`, the page's request 860/1 at main `9c0f9045`, its seam re-stamped to
 * L40C's 5950 as `fidelityL40Bk2`'s leg-368 rows do) and ask `pressEscape` for a press at the body, OFF and ON. Each
 * stand is one class of the switch's answer, found by a scan of the room (`seedling-hammer-spinner-press.md` § 5).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { bobsoldier2Plan } from '../../../scripts/procgen/plan-seedling-bobsoldier2.mjs';
import { levelSourceFromAtlas } from './atlasSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { playerShieldRect } from './bobBossFight.js';
import { replayTape } from './jsRuntimeSolver.js';
import { pressEscape } from './solverBot.js';
import {
    PRESS_ESCAPE_SHIELD_CLAIM, PRESS_ESCAPE_SHIELD_CLAIM_COUNTS, PRESS_ESCAPE_SHIELD_CLAIM_DEFAULT, SHIELD_ENVELOPE,
    resetPressEscapeShieldClaimCounts, shieldEnvelopeMeets, shieldOnlyUnmodelled, withPressEscapeShieldClaim,
} from './pressKillGuards.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPIN_WITNESS_DIR = join(HERE, 'fixtures', 'spin-witness');
/** L40C's seam for leg 860: the hammer phase its press-kill corner was measured at. */
const SPIN_SEAM = 5950;
const SPIN_BODY = 'spinner@816,848';
const SHIELD = ['shield bump (`shieldBumpNow`)'];

/** Leg 860's captured request (860/1), its seam re-stamped to `seam`. */
function leg860Request(seam = SPIN_SEAM) {
    const row = JSON.parse(gunzipSync(readFileSync(join(SPIN_WITNESS_DIR, 'leg860-request.json.gz'))).toString('utf8'));
    const c = row.request;
    return restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: seam } } });
}

const REQ = leg860Request();
const SOURCE = levelSourceFromAtlas(REQ.source.records);

/** A fresh run of the request's staging with the player's point at (x, y) (the boot is the box's corner, 8 px up-left). */
function standAt(x, y, { shield = true } = {}) {
    const items = { ...REQ.staging.seam.items, hasShield: shield };
    const staging = { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 },
        seam: { ...REQ.staging.seam, items } };
    return replayTape({ staging, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true,
        equips: REQ.equips ?? null, holds: REQ.holds ?? null });
}

/** `pressEscape` for a press at the body from the stand, the aim key held one tick (the live arm's own shape). */
function escapeAt(run, key) {
    return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([key])],
        pressAt: run.ticksCompleted + 1, id: SPIN_BODY, caller: 'aim' });
}

/** The four stands, one per class of ON's answer (OFF makes no claim at every one: the shield is carried). */
const STANDS = {
    certified: { x: 808, y: 854, key: 'right' },
    envelope: { x: 814, y: 854, key: 'right' },
    exhausted: { x: 829, y: 860, key: 'left' },
    approach: { x: 820, y: 854, key: 'right' },
};

describe('hammer-phase SPIN — PRESS_ESCAPE_SHIELD_CLAIM, the switch and its pieces', () => {
    it('ships OFF: the default is false, and a node process turns it on only by its own variable', () => {
        expect(PRESS_ESCAPE_SHIELD_CLAIM_DEFAULT).toBe(false);
        expect(PRESS_ESCAPE_SHIELD_CLAIM.enabled).toBe(process.env.SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM === '1');
        expect(withPressEscapeShieldClaim(true, () => PRESS_ESCAPE_SHIELD_CLAIM.enabled)).toBe(true);
        expect(withPressEscapeShieldClaim(false, () => PRESS_ESCAPE_SHIELD_CLAIM.enabled)).toBe(false);
    });

    it('the envelope is the union of every box `playerShieldRect` places, derived (each edge attained by a box)', () => {
        const boxes = [];
        for (const direction of [0, 1, 2, 3]) {
            for (const vx of [-1, 0, 1]) {
                for (const slashing of [false, true]) {
                    const r = playerShieldRect({ x: 0, y: 0, vx, direction }, slashing);
                    if (r) boxes.push(r);
                }
            }
        }
        for (const b of boxes) {
            expect(b.x).toBeGreaterThanOrEqual(SHIELD_ENVELOPE.x);
            expect(b.y).toBeGreaterThanOrEqual(SHIELD_ENVELOPE.y);
            expect(b.right).toBeLessThanOrEqual(SHIELD_ENVELOPE.right);
            expect(b.bottom).toBeLessThanOrEqual(SHIELD_ENVELOPE.bottom);
        }
        expect(boxes.some((b) => b.x === SHIELD_ENVELOPE.x)).toBe(true);
        expect(boxes.some((b) => b.y === SHIELD_ENVELOPE.y)).toBe(true);
        expect(boxes.some((b) => b.right === SHIELD_ENVELOPE.right)).toBe(true);
        expect(boxes.some((b) => b.bottom === SHIELD_ENVELOPE.bottom)).toBe(true);
    });

    it('`shieldOnlyUnmodelled`: the shield bump alone, never with another source and never an empty list', () => {
        expect(shieldOnlyUnmodelled(SHIELD)).toBe(true);
        expect(shieldOnlyUnmodelled([])).toBe(false);
        expect(shieldOnlyUnmodelled([...SHIELD, 'a lobber\'s bomb'])).toBe(false);
        expect(shieldOnlyUnmodelled(['a lobber\'s bomb'])).toBe(false);
        expect(shieldOnlyUnmodelled(undefined)).toBe(false);
    });

    it('`shieldEnvelopeMeets`: a body on the row before, at or after the state\'s own is met; two rows on is not', () => {
        const q = { x: 100, y: 100 };
        // a 7x7 body whose left edge is the envelope's right edge minus one: overlapping by one px
        const near = { x: 100 + SHIELD_ENVELOPE.right - 1, y: 100, right: 100 + SHIELD_ENVELOPE.right + 6, bottom: 107 };
        const flush = { ...near, x: near.x + 1, right: near.right + 1 }; // touching edges: strict overlap says no
        const path = [[5, q]];
        for (const at of [4, 5, 6]) {
            const rows = [];
            rows[at] = [near];
            expect(shieldEnvelopeMeets(path, rows)).toBe(5);
        }
        for (const at of [3, 7]) {
            const rows = [];
            rows[at] = [near];
            expect(shieldEnvelopeMeets(path, rows)).toBe(null);
        }
        const rows = [];
        rows[5] = [flush];
        expect(shieldEnvelopeMeets(path, rows)).toBe(null);
        // the NEXT state's point is asked too (the box the previous frame rendered): a step onto the body is met
        expect(shieldEnvelopeMeets([[5, { x: 90, y: 100 }], [6, q]], (() => { const r = []; r[5] = [near]; return r; })()))
            .toBe(5);
    });
});

describe('hammer-phase SPIN — `pressEscape` beside spinner@816,848 on leg 860\'s staging, OFF against ON', () => {
    it('OFF makes no claim at every stand: the forecast names the carried shield as unmodelled', () => {
        for (const { x, y, key } of Object.values(STANDS)) {
            const r = withPressEscapeShieldClaim(false, () => escapeAt(standAt(x, y), key));
            expect(r).toEqual({ ok: false, claim: false,
                why: 'the forecast names shield bump (`shieldBumpNow`) as unmodelled' });
        }
    });

    it('ON at (808,854): a certificate, its whole path clear of the shield\'s envelope', () => {
        resetPressEscapeShieldClaimCounts();
        const run = standAt(STANDS.certified.x, STANDS.certified.y);
        const r = withPressEscapeShieldClaim(true, () => escapeAt(run, STANDS.certified.key));
        expect(r).toMatchObject({ ok: true, claim: true });
        expect(r.keys.length).toBe(75);
        expect(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS).toMatchObject({ asked: 1, certified: 1, envelope: 0 });
    });

    it('ON at (814,854): the certificate\'s path puts the envelope on the body, so NO CLAIM (OFF\'s answer, named)', () => {
        resetPressEscapeShieldClaimCounts();
        const r = withPressEscapeShieldClaim(true, () => escapeAt(standAt(STANDS.envelope.x, STANDS.envelope.y),
            STANDS.envelope.key));
        expect(r).toMatchObject({ ok: false, claim: false });
        expect(r.why).toMatch(/^the forecast names shield bump \(`shieldBumpNow`\) as unmodelled \(PRESS_ESCAPE_SHIELD_CLAIM: the certificate's path puts the shield's envelope on a body at t\d+\)$/);
        expect(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS).toMatchObject({ asked: 1, certified: 0, envelope: 1 });
    });

    it('ON at (829,860): the escape search EXHAUSTS, and that negative is claimed (the aim then waits)', () => {
        resetPressEscapeShieldClaimCounts();
        const r = withPressEscapeShieldClaim(true, () => escapeAt(standAt(STANDS.exhausted.x, STANDS.exhausted.y),
            STANDS.exhausted.key));
        expect(r).toMatchObject({ ok: false, claim: true, bound: 'exhausted' });
        expect(r.why).toMatch(/^no ESCAPE from the landing at t\d+/);
        expect(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS).toMatchObject({ asked: 1, exhausted: 1, noClaim: 0 });
    });

    it('ON at (820,854): any other negative (here the approach meets the body) stays NO CLAIM, as OFF returns it', () => {
        resetPressEscapeShieldClaimCounts();
        const r = withPressEscapeShieldClaim(true, () => escapeAt(standAt(STANDS.approach.x, STANDS.approach.y),
            STANDS.approach.key));
        expect(r).toMatchObject({ ok: false, claim: false });
        expect(r.why).toMatch(/\(PRESS_ESCAPE_SHIELD_CLAIM: the approach or the train meets a body or the line at t\d+, before the press lands\)$/);
        expect(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS).toMatchObject({ asked: 1, noClaim: 1 });
    });

    it('with no shield carried the switch is never reached: ON equals OFF at every stand', () => {
        resetPressEscapeShieldClaimCounts();
        for (const { x, y, key } of Object.values(STANDS)) {
            const off = withPressEscapeShieldClaim(false, () => escapeAt(standAt(x, y, { shield: false }), key));
            const on = withPressEscapeShieldClaim(true, () => escapeAt(standAt(x, y, { shield: false }), key));
            expect(on).toEqual(off);
        }
        expect(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS.asked).toBe(0);
    });
});

describe('hammer-phase SPIN — a solve the switch never reaches', () => {
    // `fidelityStrikeLapse`'s solving arm (survey step 50, 413 t): a chaser kill with no spinner on any press
    const plan = () => withContactFidelity({ strikeIframeLapse: true, ceremonyShove: false }, () => bobsoldier2Plan(true));
    it('ON = OFF on the bobsoldier2 L30 plan (no spinner on the press): the same keys, the switch never asked', async () => {
        resetPressEscapeShieldClaimCounts();
        const off = await withPressEscapeShieldClaim(false, plan);
        const on = await withPressEscapeShieldClaim(true, plan);
        expect(off.solved.out.perTick.length).toBe(413);
        expect(on.solved.out.perTick.map((k) => [...k].join('+'))).toEqual(off.solved.out.perTick.map((k) => [...k].join('+')));
        expect(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS.asked).toBe(0);
    });
});
