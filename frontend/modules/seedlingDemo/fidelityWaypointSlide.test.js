/**
 * ⛓ fidelity SMALLGAPS D2 — AN INTERMEDIATE WAYPOINT ON ICE IS PASSED, NOT PARKED ON
 * (`CONTACT_FIDELITY.waypointSlide`, OFF by default; `botDriverV2.waypointReached`).
 *
 *     Player.as:516-537   onIce → friction = slidingFriction (0.025), moveSpeed = slidingSpeed
 *
 * `hasArrived` asks "within tolerance AND stopped" of every waypoint, and on ice a ±1 px STOP is reachable only by luck:
 * route step 62 (L45 → L46) with the strike lapse ON limit-cycled x 117.3–122.9 around (120,72) for ~300 t (748 t;
 * 386 OFF). ON, a waypoint that is not the walk's last is reached at "within tolerance" while the player stands on
 * ice; `drive` and `solverBot.previewWalk` ask the same predicate, so the preview still certifies the drive.
 *
 * Game witnesses (p4f headless, `probe-seedling-chaser-mobiles.mjs --class=Jellyfish --player-hits --record`, the
 * survey's own walk of step 62 with the switch ON): `smallgaps-l45-62-slide-lapse` (strike lapse ON, 239 t) and
 * `smallgaps-l45-62-slide` (lapse OFF, 249 t) — every sample at 0 px, no hit.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TOLERANCE, hasArrived } from './botDriverV1.js';
import { drive, waypointReached } from './botDriverV2.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { previewWalk } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const W_LAPSE = witness('smallgaps-l45-62-slide-lapse');
const W_PLAIN = witness('smallgaps-l45-62-slide');

/** The sampled ticks where the model's player is not the game's, to the bit. */
const parted = (w, over) => withContactFidelity(over, () => {
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: SRC });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    return w.samples.filter((s) => !col[s.t] || col[s.t].x !== s.player.x || col[s.t].y !== s.player.y
        || col[s.t].level !== s.level).map((s) => s.t);
});

/** L45 from the witness's own staging, rebooted on the ice east of (120,72). */
const l45 = (x, y) => createRunForStaging({ ...stagingFromTape(parseTape(JSON.stringify(W_PLAIN.tape))),
    boot: { level: 45, x, y } }, SRC);
const WPS = [{ x: 120, y: 72 }, { x: 120, y: 40 }];
const key = (h) => [...h].sort().join('+') || '-';
/** The preview's and the drive's held sets over WPS, from one boot. */
const both = (x, y) => {
    const pv = previewWalk(l45(x, y), WPS, DEFAULT_TOLERANCE);
    const b = l45(x, y);
    const perTick = [];
    let err = null;
    try {
        WPS.forEach((wp, i) => drive(b, wp, perTick, { until: 'arrival', tolerance: DEFAULT_TOLERANCE, maxTicks: 400,
            what: 'the slide row', avoidVolumes: false, intermediate: i < WPS.length - 1 }));
    } catch (e) {
        err = e.message;
    }
    return { preview: pv.samples.map((s) => key(s.held ?? new Set())), truncated: pv.truncated?.kind ?? null,
        drive: perTick.map(key), err, end: b.state };
};

describe('SMALLGAPS D2 — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.waypointSlide).toBe(false);
    });
});

describe('SMALLGAPS D2 — `waypointReached`', () => {
    const wp = { x: 120, y: 72 };
    const sliding = { x: 120.6, y: 72.4, vx: 1.5, vy: 0, hazard: { onIce: true } };
    it('OFF it is `hasArrived`, whatever the ice', () => withContactFidelity({ waypointSlide: false }, () => {
        expect(waypointReached(sliding, wp, 1, true)).toBe(false);
        expect(hasArrived(sliding, wp, 1)).toBe(false);
    }));
    it('ON: an intermediate waypoint on ice is reached within tolerance at any velocity', () => withContactFidelity({ waypointSlide: true }, () => {
        expect(waypointReached(sliding, wp, 1, true)).toBe(true);
        expect(waypointReached({ ...sliding, x: 121.2 }, wp, 1, true)).toBe(false);
    }));
    it('ON: the LAST waypoint still needs the stop, and so does an intermediate one off the ice', () => withContactFidelity({ waypointSlide: true }, () => {
        expect(waypointReached(sliding, wp, 1, false)).toBe(false);
        expect(waypointReached({ ...sliding, hazard: { onIce: false } }, wp, 1, true)).toBe(false);
        expect(waypointReached({ ...sliding, vx: 0 }, wp, 1, false)).toBe(true);
    }));
});

describe('SMALLGAPS D2 — L45 (120,72): the preview and the drive agree, and ON the walk passes', () => {
    it('OFF from (152,80): the walk limit-cycles on the ice around (120,72) and stalls — preview and drive alike', () => withContactFidelity({ waypointSlide: false }, () => {
        const r = both(152, 80);
        expect(r.truncated).toBe('stalled');
        expect(r.err).toMatch(/not reached within 400 ticks; stalled at \(11[89]\.\d+,7[23]\.\d+\)/);
        expect(r.drive).toEqual(r.preview);
    }));
    it('ON from (152,80): both cross in 54 t and stop on the last waypoint', () => withContactFidelity({ waypointSlide: true }, () => {
        const r = both(152, 80);
        expect(r.err).toBeNull();
        expect(r.truncated).toBeNull();
        expect(r.drive).toEqual(r.preview);
        expect(r.drive.length).toBe(54);
        expect(hasArrived(r.end, WPS[1], DEFAULT_TOLERANCE)).toBe(true);
    }));
    it('from (168,88): OFF 231 t, ON 65 t, preview = drive both ways', () => {
        const off = withContactFidelity({ waypointSlide: false }, () => both(168, 88));
        const on = withContactFidelity({ waypointSlide: true }, () => both(168, 88));
        expect([off.drive.length, on.drive.length]).toEqual([231, 65]);
        expect(off.drive).toEqual(off.preview);
        expect(on.drive).toEqual(on.preview);
    });
});

describe('SMALLGAPS D2 — the game witnesses of route step 62 walked with the switch ON', () => {
    it('strike lapse ON: 239 t, every sample at 0 px, no hit', () => {
        expect(W_LAPSE.tape.tick_count).toBe(239);
        expect(parted(W_LAPSE, { strikeIframeLapse: true, waypointSlide: true })).toEqual([]);
        expect(W_LAPSE.samples.every((s) => s.player.hits === 0)).toBe(true);
    });
    it('strike lapse OFF: 249 t, every sample at 0 px, no hit', () => {
        expect(W_PLAIN.tape.tick_count).toBe(249);
        expect(parted(W_PLAIN, { waypointSlide: true })).toEqual([]);
        expect(W_PLAIN.samples.every((s) => s.player.hits === 0)).toBe(true);
    });
});
