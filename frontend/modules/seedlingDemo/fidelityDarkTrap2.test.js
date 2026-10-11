/**
 * SEEDLING FIDELITY DARKTRAP2 — why wave 11's PUSHBLOCK saw the DarkTrap light arm "refuted" in L65, and the two
 * press gates the model was missing (`contactFidelity.spearingWindow`, `.fallBurnsPress`).
 *
 * D1, measured per tick on the game (p4f, headless): the light death was never wrong. Replaying PUSHBLOCK's two
 * refuted tapes, the game lights `lightpole@128,168` at t50 (t133) and `darktrap@144,144` plays "die1" from t81
 * (t164) — the model's ticks exactly. Both walks left the game at a SWORD press inside the spear's animation:
 * `spearing` is up through the thrust's press tick + 5 (`combatVerbs.SPEAR_ANIM_TICKS`), `set slashing` is gated by
 * it, and the model's gate read only the one-tick pending thrust — so it slashed, then DASHED (t53 → dy 1.88 at t54;
 * t136 → dx −1.88 at t137). Step 146's game, without that dash, then drifted into a pit and rebuilt the room before
 * "die1" ended (no tag written — PUSHBLOCK's "still SET"); and a press at t230, mid-fall, was lost in the game.
 *
 * The witnesses are `fixtures/darktrap-witness/darktrap2-*.json` (`probe-seedling-darktrap-mobiles.mjs --record
 * --fidelity=…`); `fidelityDarkTrap.test.js` replays every one of them under its recorded switches. This file holds
 * what that loop does not: the switches' defaults, each switch's necessity, the window's end, the ledger outcomes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SPEAR_ANIM_FRAMES, SPEAR_ANIM_RATE, SPEAR_ANIM_TICKS, animCompleteTicks } from './combatVerbs.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'darktrap-witness', `${n}.json`), 'utf8'));
const levelSource = atlasLevelSource();

/** Replay a witness's tape under `switches`; the player per tick, and the run's slash presses at `at`. */
function replay(w, switches, at = null) {
    // The two gates are set EXPLICITLY (OFF unless asked): `SEEDLING_CONTACT_FIDELITY` may have turned them on.
    return withContactFidelity({ darkTrapLight: true, spearingWindow: false, fallBurnsPress: false, ...switches }, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), {
            levelSource, onTick: (t, s, h, rn) => { run = rn; },
        });
        const col = [];
        let presses = null;
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            col[o.t] = { x: o.x, y: o.y };
            if (o.t === at) presses = run.slashPresses.map((p) => `${p.t}:${p.outcome}`);
            r = st.next();
        }
        return { col, presses };
    });
}
/** The first sampled tick where the model's player is not the game's, or null. */
const firstOff = (w, col) => w.samples.find((s) => !col[s.t] || col[s.t].x !== s.player.x || col[s.t].y !== s.player.y)
    ?.t ?? null;

describe('DARKTRAP2 — the switches', () => {
    // ⚖ (user, 2026-10-10, "Yes to all") ON since the wave-11 harvest: the three switches flip together.
    it('ship ON together with `darkTrapLight`', () => {
        expect(CONTACT_FIDELITY_DEFAULTS).toEqual(expect.objectContaining(
            { darkTrapLight: true, spearingWindow: true, fallBurnsPress: true }));
        expect(CONTACT_FIDELITY.spearingWindow).toBe(true);
        expect(CONTACT_FIDELITY.fallBurnsPress).toBe(true);
    });
    it('the spear animation: 8 frames at 45, `spearEnd` 5 ticks after the press (the slash period\'s own arithmetic)', () => {
        expect([SPEAR_ANIM_FRAMES, SPEAR_ANIM_RATE]).toEqual([8, 45]);
        expect(SPEAR_ANIM_TICKS).toBe(animCompleteTicks(8, 45));
        expect(SPEAR_ANIM_TICKS).toBe(5);
    });
});

describe('DARKTRAP2 D1 — PUSHBLOCK\'s refuted L65 tapes', () => {
    it('step 148: OFF leaves the game at t137 (the dash the game gated); `spearingWindow` alone reproduces it', () => {
        const w = witness('darktrap2-l65-step148-spear-gate');
        expect(w.fidelity).toEqual(['spearingWindow']);
        expect(firstOff(w, replay(w, {}).col)).toBe(137);
        expect(firstOff(w, replay(w, { spearingWindow: true }).col)).toBe(null);
    });
    it('the ledger: t134 and t136 slash and DASH with it off, and are GATED with it on', () => {
        const w = witness('darktrap2-l65-step148-spear-gate');
        expect(replay(w, {}, 140).presses.filter((p) => /^13[0-9]:/.test(p))).toEqual(['134:slash', '136:dash']);
        expect(replay(w, { spearingWindow: true }, 140).presses.filter((p) => /^13[0-9]:/.test(p)))
            .toEqual(['134:gated', '136:gated']);
    });
    it('step 146 needs BOTH switches: off → t54, the window alone → t231 (the press inside the pit fall), both → none', () => {
        const w = witness('darktrap2-l65-step146-spear-gate');
        expect(w.fidelity).toEqual(['spearingWindow', 'fallBurnsPress']);
        expect(firstOff(w, replay(w, {}).col)).toBe(54);
        expect(firstOff(w, replay(w, { spearingWindow: true }).col)).toBe(231);
        expect(firstOff(w, replay(w, { spearingWindow: true, fallBurnsPress: true }).col)).toBe(null);
    });
});

describe('DARKTRAP2 D3 — the window\'s end and the spear\'s own gate, on the game', () => {
    it('press + 5 is still gated (a 4-tick window would slash there and DASH at + 7)', () => {
        const w = witness('darktrap2-l65-spear-window-t5');
        expect(replay(w, { spearingWindow: true }, 145).presses.filter((p) => /^13[0-9]:/.test(p)))
            .toEqual(['136:gated', '138:slash']);
        expect(firstOff(w, replay(w, {}).col)).not.toBe(null);
    });
    it('press + 6 is open (a 6-tick window would gate it, and + 8 would not dash)', () => {
        const w = witness('darktrap2-l65-spear-window-t6');
        expect(replay(w, { spearingWindow: true }, 145).presses.filter((p) => /^13[0-9]:/.test(p)))
            .toEqual(['137:slash', '139:dash']);
    });
    it('a spear press inside a sword swing starts no thrust: the pole stays out and the darktrap lives', () => {
        const w = witness('darktrap2-l65-spear-in-swing');
        expect(w.samples.every((s) => s.bodies.every((b) => b.anim !== 'die1'))).toBe(true);
        expect(firstOff(w, replay(w, {}).col)).not.toBe(null);
    });
    it('the thrust origin is NOT truncated (the int hypothesis was refuted on the game): x 35.45 reaches x 67', () => {
        const w = witness('darktrap2-l63-spear-origin-float');
        expect(w.samples.some((s) => s.bodies.some((b) => b.anim === 'die1'))).toBe(true);
    });
});
