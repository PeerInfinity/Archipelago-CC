/**
 * ⛓⛓ SEEDLING HAMMER-PHASE ESCAPE-EXACT — `PRESS_ESCAPE_EXACT` (OFF): the press escape search, exact under a shield.
 * Report: `CC/docs/cloud-reports/seedling-hammer-escape-exact.md`; the switch's docblock is `pressEscapeExact.js`.
 *
 * The real rows stand the player beside `spinner@816,848` on leg 860's captured staging (SPIN's four stands,
 * `hammerSpinnerPress.test.js`) and ask `pressEscape` for a press at the body. Each answer is then checked against the
 * RUN: the escape's own path (the aim key, the press, the train, the certificate) is driven on a fresh run of the same
 * stand, and a certificate must drive hitless while a claimed contact must be a hit on the aim tick.
 *
 * ⚠ THE EXACT ARM NEEDS FIDELITY'S KEY (`CONTACT_FIDELITY.forecastShieldBump`, SHIELDBUMP, not on main when this
 * landed). Its rows are skipped BY NAME where the key does not exist (`it.skipIf`, the reason in the title); the
 * rows that do not need it (OFF, the aim tick's contact, the predicates) run everywhere.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { replayTape } from './jsRuntimeSolver.js';
import { pressEscape } from './solverBot.js';
import { withPressEscapeShieldClaim } from './pressKillGuards.js';
import {
    PRESS_ESCAPE_EXACT, PRESS_ESCAPE_EXACT_COUNTS, PRESS_ESCAPE_EXACT_DEFAULT, SHIELD_BUMP_FORECAST_KEY,
    bumpCoveredThrough, resetPressEscapeExactCounts, shieldBumpFiresAt, shieldBumpForecastStepped, withPressEscapeExact,
} from './pressEscapeExact.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPIN_BODY = 'spinner@816,848';
const NO_KEY = !CONTACT_FIDELITY_KEYS.includes(SHIELD_BUMP_FORECAST_KEY);
const NO_SHIELD_UNMODELLED = 'the forecast names shield bump (`shieldBumpNow`) as unmodelled';

/** Leg 860's captured request (860/1), its seam re-stamped to L40C's 5950 (SPIN's loader). */
function leg860Request(seam = 5950) {
    const row = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'spin-witness', 'leg860-request.json.gz')))
        .toString('utf8'));
    const c = row.request;
    return restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: seam } } });
}
const REQ = leg860Request();
const SOURCE = levelSourceFromAtlas(REQ.source.records);

/** A fresh run of the staging with the player's point at (x, y), the shield carried or not. */
function standAt(x, y, { shield = true } = {}) {
    const items = { ...REQ.staging.seam.items, hasShield: shield };
    const staging = { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 },
        seam: { ...REQ.staging.seam, items } };
    return replayTape({ staging, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true,
        equips: REQ.equips ?? null, holds: REQ.holds ?? null });
}

/** SPIN's four stands (`hammerSpinnerPress.test.js`): the aim key held one tick, the press on the next. */
const STANDS = {
    certified: { x: 808, y: 854, key: 'right' },
    envelope: { x: 814, y: 854, key: 'right' },
    exhausted: { x: 829, y: 860, key: 'left' },
    approach: { x: 820, y: 854, key: 'right' },
};

/** `pressEscape` at a stand, and the escape's own path driven on a fresh run of it: the ticks the run is hit on. */
function askAndDrive({ x, y, key }, { shield = true } = {}) {
    const run = standAt(x, y, { shield });
    const n = run.ticksCompleted;
    const r = pressEscape(run, { state: run.state, at: n, keys: [new Set([key])], pressAt: n + 1, id: SPIN_BODY,
        caller: 'aim' });
    const keys = [new Set([key]), new Set(['primary'])];
    if (r.ok) {
        for (let t = n + 2; t < r.landing; t += 1) keys.push(new Set());
        keys.push(...r.keys);
    }
    const drive = standAt(x, y, { shield });
    const hitsAt = [];
    keys.forEach((k, i) => {
        const before = drive.playerHits.length;
        drive.advance(k);
        if (drive.playerHits.length > before) hitsAt.push(n + i);
    });
    const body = (drive.entities('spinnerBodies') ?? []).find((b) => b.id === SPIN_BODY);
    return { r, n, hitsAt, bodyHits: body?.hits ?? null };
}

describe('hammer-phase ESCAPE-EXACT — the switch', () => {
    it('ships OFF, and is on the page\'s switch channel', () => {
        expect(PRESS_ESCAPE_EXACT_DEFAULT).toBe(false);
        expect(PRESS_ESCAPE_EXACT.enabled).toBe(process.env.SEEDLING_PRESS_ESCAPE_EXACT === '1');
        expect(withPressEscapeExact(true, () => PRESS_ESCAPE_EXACT.enabled)).toBe(true);
        expect(withPressEscapeExact(false, () => PRESS_ESCAPE_EXACT.enabled)).toBe(false);
        expect(PRESS_ESCAPE_EXACT.parts).toEqual({ probe: true, prune: true, contact: true });
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESS_ESCAPE_EXACT');
    });

    it('reads fidelity\'s key only through CONTACT_FIDELITY_KEYS (no throw where it does not exist)', () => {
        expect(() => shieldBumpForecastStepped()).not.toThrow();
        if (NO_KEY) {
            expect(shieldBumpForecastStepped()).toBe(false);
        } else {
            expect(withContactFidelity({ [SHIELD_BUMP_FORECAST_KEY]: true }, shieldBumpForecastStepped)).toBe(true);
            expect(withContactFidelity({ [SHIELD_BUMP_FORECAST_KEY]: false }, shieldBumpForecastStepped)).toBe(false);
        }
    });
});

describe('hammer-phase ESCAPE-EXACT — the predicates', () => {
    it('bumpCoveredThrough: every row through the last index stepped, read off the forecast\'s own report', () => {
        expect(bumpCoveredThrough({}, 100, 3)).toBe(false);
        expect(bumpCoveredThrough({ shieldBump: { bumps: [], stepped: 9, uncoveredFrom: null } }, 100, 3)).toBe(true);
        expect(bumpCoveredThrough({ shieldBump: { bumps: [], stepped: 4, uncoveredFrom: 104 } }, 100, 3)).toBe(true);
        expect(bumpCoveredThrough({ shieldBump: { bumps: [], stepped: 3, uncoveredFrom: 103 } }, 100, 3)).toBe(false);
        expect(bumpCoveredThrough({ shieldBump: { bumps: [], stepped: 0, uncoveredFrom: 100 } }, 100, 0)).toBe(false);
    });

    it('shieldBumpFiresAt: a moving player whose box touches a live body; a standing one, a dying body, a far one not', () => {
        // the box facing right while moving right: 3x7 (origin 2,3) at (x + 4, y) — x 102..105, y 97..104
        const q = { x: 100, y: 100, vx: 1, vy: 0, direction: 0 };
        const touch = { x: 104, y: 98, w: 7, h: 7 };
        const far = { x: 120, y: 98, w: 7, h: 7 };
        expect(shieldBumpFiresAt(q, [[touch]], [[{ destroy: false }]], 0)).toBe(true);
        expect(shieldBumpFiresAt(q, [[far]], [[{ destroy: false }]], 0)).toBe(false);
        expect(shieldBumpFiresAt(q, [[touch]], [[{ destroy: true }]], 0)).toBe(false);
        expect(shieldBumpFiresAt({ ...q, vx: 0 }, [[touch]], [[{ destroy: false }]], 0)).toBe(false);
        expect(shieldBumpFiresAt(q, [], [], 0)).toBe(false);
    });
});

describe('hammer-phase ESCAPE-EXACT — beside spinner@816,848 on leg 860\'s staging', () => {
    it('OFF is OFF\'s answer at every stand, SPIN OFF and ON (SPIN\'s own four classes)', () => {
        const off = (s, spin) => withPressEscapeExact(false, () => withPressEscapeShieldClaim(spin, () => askAndDrive(s).r));
        for (const s of Object.values(STANDS)) {
            expect(off(s, false)).toEqual({ ok: false, claim: false, why: NO_SHIELD_UNMODELLED });
        }
        expect(off(STANDS.certified, true)).toMatchObject({ ok: true, claim: true });
        expect(off(STANDS.envelope, true).why).toMatch(/PRESS_ESCAPE_SHIELD_CLAIM: the certificate's path puts the shield's envelope/);
        expect(off(STANDS.exhausted, true)).toMatchObject({ ok: false, claim: true, bound: 'exhausted' });
        expect(off(STANDS.approach, true).why).toMatch(/PRESS_ESCAPE_SHIELD_CLAIM: the approach or the train meets a body or the line at t\d+, before/);
    });

    it('(iii) the aim tick\'s CONTACT is caught: at (829,860) with no shield, OFF claims "exhausted" from the landing, '
        + 'ON the approach at t0 — and the run IS hit on that tick', () => {
        const off = withPressEscapeExact(false, () => askAndDrive(STANDS.exhausted, { shield: false }));
        expect(off.r).toMatchObject({ ok: false, claim: true, bound: 'exhausted' });
        resetPressEscapeExactCounts();
        const on = withPressEscapeExact(true, () => askAndDrive(STANDS.exhausted, { shield: false }));
        expect(on.r).toEqual({ ok: false, claim: true, bound: 'approach',
            why: `the approach or the train meets a body or the line at t${on.n}, before the press lands` });
        expect(PRESS_ESCAPE_EXACT_COUNTS.contact).toBe(1);
        expect(on.hitsAt).toEqual([on.n]);
        // (820,854): OFF named t1 (the press tick); the run is hit at t0 already
        const off2 = withPressEscapeExact(false, () => askAndDrive(STANDS.approach, { shield: false }));
        const on2 = withPressEscapeExact(true, () => askAndDrive(STANDS.approach, { shield: false }));
        expect(off2.r.why).toMatch(new RegExp(`at t${off2.n + 1}, before`));
        expect(on2.r.why).toMatch(new RegExp(`at t${on2.n}, before`));
        expect(on2.hitsAt[0]).toBe(on2.n);
    });

    it('with fidelity\'s key absent or OFF, ON under a shield is OFF\'s no-claim (only (iii) can move a SPIN answer)', () => {
        const keyOff = NO_KEY ? (fn) => fn() : (fn) => withContactFidelity({ [SHIELD_BUMP_FORECAST_KEY]: false }, fn);
        for (const s of Object.values(STANDS)) {
            const r = keyOff(() => withPressEscapeExact(true, () => askAndDrive(s).r));
            expect(r).toEqual({ ok: false, claim: false, why: NO_SHIELD_UNMODELLED });
        }
    });

    const keyOn = (fn) => withContactFidelity({ [SHIELD_BUMP_FORECAST_KEY]: true }, fn);

    it.skipIf(NO_KEY)('[needs fidelity\'s forecastShieldBump] key ON, SPIN OFF: (808,854) and (814,854) CERTIFY, and '
        + 'each certificate drives hitless with the body hit', () => {
        for (const s of [STANDS.certified, STANDS.envelope]) {
            resetPressEscapeExactCounts();
            const d = keyOn(() => withPressEscapeShieldClaim(false, () => withPressEscapeExact(true, () => askAndDrive(s))));
            expect(d.r).toMatchObject({ ok: true, claim: true });
            expect(d.r.keys.length).toBe(75);
            expect(d.hitsAt).toEqual([]);
            expect(d.bodyHits).toBe(1);
            expect(PRESS_ESCAPE_EXACT_COUNTS).toMatchObject({ asked: 1, certified: 1, uncovered: 0, noClaim: 0 });
        }
    });

    it.skipIf(NO_KEY)('[needs fidelity\'s forecastShieldBump] key ON: (829,860) CLAIMS EXACTLY — the approach meets '
        + 'the body at t0 (SPIN said "exhausted", SPIN + key "no claim") — and the run is hit at t0', () => {
        for (const spin of [false, true]) {
            resetPressEscapeExactCounts();
            const d = keyOn(() => withPressEscapeShieldClaim(spin, () => withPressEscapeExact(true,
                () => askAndDrive(STANDS.exhausted))));
            expect(d.r).toEqual({ ok: false, claim: true, bound: 'approach',
                why: `the approach or the train meets a body or the line at t${d.n}, before the press lands` });
            expect(d.hitsAt).toEqual([d.n]);
            expect(PRESS_ESCAPE_EXACT_COUNTS).toMatchObject({ asked: 1, contact: 1, claimedNegative: 1 });
        }
    });

    it.skipIf(NO_KEY)('[needs fidelity\'s forecastShieldBump] key ON, (iii) dropped: (829,860) CERTIFIES a path the '
        + 'run is hit on at t0 (why the contact part is owed)', () => {
        const was = PRESS_ESCAPE_EXACT.parts.contact;
        PRESS_ESCAPE_EXACT.parts.contact = false;
        try {
            const d = keyOn(() => withPressEscapeExact(true, () => askAndDrive(STANDS.exhausted)));
            expect(d.r).toMatchObject({ ok: true, claim: true });
            expect(d.hitsAt[0]).toBe(d.n);
        } finally {
            PRESS_ESCAPE_EXACT.parts.contact = was;
        }
    });

    it.skipIf(NO_KEY)('[needs fidelity\'s forecastShieldBump] key ON, (ii): at (817,851) the search prunes states a bump '
        + 'would fire on, so its exhausted negative is NO CLAIM (named); without the prune it claimed "exhausted"', () => {
        const stand = { x: 817, y: 851, key: 'right' };
        resetPressEscapeExactCounts();
        const r = keyOn(() => withPressEscapeShieldClaim(false, () => withPressEscapeExact(true, () => askAndDrive(stand).r)));
        expect(r).toMatchObject({ ok: false, claim: false });
        expect(r.why).toMatch(/\(PRESS_ESCAPE_EXACT: no ESCAPE from the landing at t\d+ .*; the search pruned \d+ state\(s\) a shield bump would have moved a body on\)$/);
        expect(PRESS_ESCAPE_EXACT_COUNTS.exhaustedCut).toBe(1);
        expect(PRESS_ESCAPE_EXACT_COUNTS.cuts).toBeGreaterThan(0);
        const was = PRESS_ESCAPE_EXACT.parts.prune;
        PRESS_ESCAPE_EXACT.parts.prune = false;
        try {
            const blind = keyOn(() => withPressEscapeExact(true, () => askAndDrive(stand).r));
            expect(blind).toMatchObject({ ok: false, claim: true, bound: 'exhausted' });
        } finally {
            PRESS_ESCAPE_EXACT.parts.prune = was;
        }
    });

    it.skipIf(NO_KEY)('[needs fidelity\'s forecastShieldBump] key ON: (820,854) claims the approach at t0, and the run '
        + 'is hit at t0', () => {
        const d = keyOn(() => withPressEscapeExact(true, () => askAndDrive(STANDS.approach)));
        expect(d.r).toMatchObject({ ok: false, claim: true, bound: 'approach' });
        expect(d.r.why).toMatch(new RegExp(`at t${d.n}, before`));
        expect(d.hitsAt[0]).toBe(d.n);
    });
});
