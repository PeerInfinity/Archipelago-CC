/**
 * seedlingResponderFade — G9c's responder fades (⚖ fidelity-14, 2026-10-26: the AS3
 * recurrence anchored on the run, no game read), in node:
 *
 *   1. THE FADE PIN (`seedlingFadeOnce.test.js`'s shape): a Lock's alpha per update is
 *      the clamped repeated subtraction, monotone, and the step that reaches 0 is the
 *      step BEFORE the open; the open is step 101 (Cover 11, BossLock 80). A mutant step
 *      fails it.
 *   2. THE ANCHOR ON EVERY COMMITTED TAPE THAT OPENS A RESPONDER (the 42 the anchor
 *      census found): the class's `type` never disagrees with the run's `open`
 *      (`skin.drift` 0), and every tick the renderer's alpha differs from the run's own
 *      `activatorsNow` alpha is one of the AS3 branches the model does not carry
 *      (fidelity-14's corrections), named.
 *   3. THE AS3 ROWS fidelity-14 asked for: a Lock opened → released with overlap, then
 *      without (one-step alpha lag); a Cover released under the player vs under a
 *      Chest; a BossLock released mid-fade and resumed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { BOSS_KEY_TIMER, RESPONDER_CLASS, SOLIDS_RULES, solidsSkinView, stepResponder, stepSolidsSkin } from './seedlingSolidsSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));

/** Step one responder `n` updates with a fixed input; the alphas after each, and the step its `solid` went false on. */
function ramp(tag, n, input = {}, step = stepResponder) {
    let st = null;
    const alphas = [];
    let openedOn = null;
    for (let k = 1; k <= n; k += 1) {
        // `open: undefined` — the class's own step, not anchored on a run (the anchor is section 2's)
        const a = { tag, held: k, touched: true, open: undefined, overlap: false, chestUnder: false, ...input };
        const { state } = step(st, a);
        st = state;
        alphas.push(st.alpha);
        if (!st.solid && openedOn === null) openedOn = k;
    }
    return { alphas, openedOn, st };
}

describe('1. the fade pin — each class opens on its own step, by repeated subtraction', () => {
    it('Lock: 1 − 0.01 per update, clamped (Image.alpha), monotone, 0 on update 100 and OPEN on 101', () => {
        const { alphas, openedOn } = ramp('lock', 120);
        let a = 1;
        for (let k = 0; k < 100; k += 1) {
            a = Math.min(Math.max(a - 0.01, 0), 1);
            expect(alphas[k]).toBe(a);
        }
        for (let k = 1; k < alphas.length; k += 1) expect(alphas[k]).toBeLessThanOrEqual(alphas[k - 1]);
        expect(alphas[98]).toBeGreaterThan(0);
        expect(alphas[99]).toBe(0);
        expect(openedOn).toBe(101);
        expect(ramp('wandlock', 120).openedOn).toBe(101);
        expect(ramp('shieldlocknorm', 120).openedOn).toBe(101);
    });

    it('Cover: −0.1 then the test — open on 11; BossLock: keyTimer 60, then −0.05 / +0.05 scale — open on 80', () => {
        expect(ramp('cover', 20).openedOn).toBe(11);
        const b = ramp('bosslock', 80);
        expect(b.openedOn).toBe(BOSS_KEY_TIMER + 20);
        expect(b.alphas.slice(0, 60).every((x) => x === 1)).toBe(true);
        expect(b.st.scale).toBeCloseTo(1 + 0.05 * 20, 12);
        // ⚠ and it keeps going: `activate` latches, so every later update is `scale += 0.05; alpha −= 0.05` — a private
        //    Number the Image clamps to 0 at the render (the run pins it at 0: the same picture)
        const on = ramp('bosslock', 100);
        expect(on.st.alpha).toBeLessThan(0);
        expect(on.st.scale).toBeCloseTo(1 + 0.05 * 40, 12);
    });

    it('MUTANT: a wrong step (0.011 for Lock, 0.11 for Cover) moves the open off its pinned step', () => {
        const wrong = (fade, tag) => (prev, a) => {
            const s = prev ? { ...prev } : { alpha: 1, solid: true, active: false };
            s.active = a.held > 0;
            if (s.alpha > 0) s.alpha = Math.max(s.alpha - fade, 0);
            else s.solid = false;
            if (tag === 'cover' && s.alpha <= 0) s.solid = false;
            return { state: s, drift: false };
        };
        expect(ramp('lock', 120, {}, wrong(0.011, 'lock')).openedOn).not.toBe(101);
        expect(ramp('cover', 20, {}, wrong(0.11, 'cover')).openedOn).not.toBe(11);
    });
});

/** The 42 committed tapes on which a responder opens (the anchor census, §5.148). */
const OPENING_TAPES = Object.freeze(['axe-l71-reach-l76', 'bobsoldier2-l30-torch', 'f6-l20-reentry', 'l30keylock-pit224',
    'l30keylock-pit224-before', 'l30keylock-pit240', 'l40button-l41-part0', 'l40button-l42-part0', 'l71-button-lock', 'l71-hold-101-shut',
    'l71-hold-102-open', 'l71-shieldlock-open', 'prox-l38-chest', 'prox-l38-reach-l39', 'r2-walk-5-darkshield', 'r2-walk-full',
    'r3-walk-5-darkshield', 'r3-walk-6-darksuit', 'r3-walk-full', 'r4-walk-6-health', 'r4-walk-full', 'r5-bosskey-leg', 'r5-l40-part0',
    'r5-l40-part0-control', 'r5-l40-part5', 'r5-l40-part5-control', 'r5-l41-part3', 'r5-shaft', 'r5-totem-entrance',
    'r5-totem-entrance-control', 'r8-d2', 'r8-d2-19', 'r8-d2-20', 'r9-solve-12', 'r9-solve-15', 'r9-solve-16', 'r9-solve-19',
    'r9-solve-20', 'r9-solve-30', 'r9-solve-31', 'robust-l16-l18-sword-conch', 'stance-l48-keylock-south']);

describe('2. ⛓ the anchor on every committed tape that opens a responder', () => {
    const totals = { ticks: 0, opens: 0, equal: 0, lag: 0, coverHeld: 0, other: [] };
    for (const name of OPENING_TAPES) {
        it(`${name}: no drift from the run's open; every alpha the run disagrees on is a named AS3 branch`, () => {
            totals.other = [];
            let skin = null;
            let prevOpen = new Map();
            runTape(fixture(name), {
                levelSource: atlasLevelSource(),
                onTick: (t, now, held, run) => {
                    const view = solidsSkinView(run, { record: null });
                    skin = stepSolidsSkin(skin, view, t);
                    const live = new Map((run.activatorsNow?.responders ?? []).map((r) => [r.id, r]));
                    for (const a of view.responders) {
                        const st = skin.responders.get(a.id);
                        const r = live.get(a.id);
                        if (!st || !r) continue;
                        totals.ticks += 1;
                        if (r.open && !prevOpen.get(a.id)) totals.opens += 1;
                        // the DRAWN alpha (`Image.alpha` clamps): a BossLock's private alpha runs negative after it opens, the run's stays 0
                        const clamp = (v) => Math.min(Math.max(v, 0), 1);
                        if (clamp(st.alpha) === clamp(r.alpha)) { totals.equal += 1; continue; }
                        const cls = RESPONDER_CLASS[a.tag];
                        // (1) Lock: the tick the run re-closes an opened lock, the alpha line ran first (still 0)
                        if (cls === 'lock' && prevOpen.get(a.id) && !r.open && st.alpha === 0) { totals.lag += 1; continue; }
                        // (2) Cover: released while a non-Chest hitable overlaps it — no reset, the faded alpha kept
                        if (cls === 'cover' && !r.held && a.overlap && !a.chestUnder) { totals.coverHeld += 1; continue; }
                        totals.other.push({ name, t, id: a.id, mine: st.alpha, run: r.alpha, held: r.held, open: r.open });
                    }
                    prevOpen = new Map([...live].map(([id, r]) => [id, r.open]));
                },
            });
            expect(skin?.drift ?? 0, `${name}: the class's type disagreed with the run's open`).toBe(0);
            expect(totals.other, JSON.stringify(totals.other.slice(0, 5))).toEqual([]);
        }, 240_000);
    }
    it('the census found what it was built for (openings happened; most ticks agree with the run)', () => {
        expect(totals.opens).toBeGreaterThanOrEqual(42);
        expect(totals.equal).toBeGreaterThan(totals.ticks * 0.9);
        // eslint-disable-next-line no-console
        console.log(`[responder census] ticks ${totals.ticks}, opens ${totals.opens}, equal ${totals.equal}, lock re-close lag ${totals.lag}, cover held under a hitable ${totals.coverHeld}`);
    });
});

describe('3. the AS3 rows (⚖ fidelity-14\'s corrections, transcribed)', () => {
    const step = (st, a) => stepResponder(st, { touched: false, overlap: false, chestUnder: false, open: undefined, ...a }).state;

    it('Lock (Lock.as:76-86): opened, released WITH overlap — alpha stays 0 and it stays open; without — re-closed, alpha 0 that step, 1 the next', () => {
        let st = null;
        for (let k = 1; k <= 101; k += 1) st = step(st, { tag: 'lock', held: k, open: k >= 101 });
        expect([st.solid, st.alpha]).toEqual([false, 0]);
        // released, the player still inside: `type == ""` so no `alpha = 1`; `returnToNormal` blocked by occupancy (the run stays open)
        st = step(st, { tag: 'lock', held: 0, open: true });
        expect([st.solid, st.alpha]).toEqual([false, 0]);
        // the player leaves: the run re-closes it; the alpha line ran BEFORE returnToNormal, so still 0
        st = step(st, { tag: 'lock', held: 0, open: false });
        expect([st.solid, st.alpha]).toEqual([true, 0]);
        st = step(st, { tag: 'lock', held: 0, open: false });
        expect([st.solid, st.alpha]).toEqual([true, 1]);
        // a MID-FADE release (still normType) does snap to 1
        let m = null;
        for (let k = 1; k <= 40; k += 1) m = step(m, { tag: 'lock', held: k });
        m = step(m, { tag: 'lock', held: 0 });
        expect(m.alpha).toBe(1);
    });

    it('Cover (Cover.as:49-67): released under the PLAYER keeps its faded alpha; under a CHEST (or nothing) it resets', () => {
        let st = null;
        for (let k = 1; k <= 5; k += 1) st = step(st, { tag: 'cover', held: k });
        const faded = st.alpha;
        expect(faded).toBeCloseTo(0.5, 12);
        expect(step(st, { tag: 'cover', held: 0, overlap: true }).alpha).toBe(faded);
        expect(step(st, { tag: 'cover', held: 0, overlap: true, chestUnder: true }).alpha).toBe(1);
        expect(step(st, { tag: 'cover', held: 0 }).alpha).toBe(1);
        // and re-activated after a held release, it RESUMES from the kept alpha — by the same repeated subtraction (the
        // kept 0.5 is 1 − 5·0.1 in floats, so it takes what the arithmetic says, not 10 and not "5 by hand")
        let r = step(st, { tag: 'cover', held: 0, overlap: true });
        let n = 0;
        while (r.solid && n < 20) { n += 1; r = step(r, { tag: 'cover', held: n }); }
        let left = faded;
        let m = 0;
        do { left = Math.max(left - 0.1, 0); m += 1; } while (left > 0);
        expect(n).toBe(m);
        expect(n).toBeLessThan(10);
    });

    it('BossLock (BossLock.as:85-90): a mid-fade release keeps alpha, scale and keyTimer; a re-activation resumes; a re-close restores alpha only', () => {
        let st = null;
        for (let k = 1; k <= 70; k += 1) st = step(st, { tag: 'bosslock', held: k, touched: true });
        const mid = { ...st };
        expect(mid.keyTimer).toBe(0);
        expect(mid.scale).toBeCloseTo(1.5, 12);
        const rel = step(st, { tag: 'bosslock', held: 0, touched: false });
        expect([rel.alpha, rel.scale, rel.keyTimer, rel.solid]).toEqual([mid.alpha, mid.scale, 0, true]);
        let res = rel;
        for (let k = 1; k <= 10; k += 1) res = step(res, { tag: 'bosslock', held: k, touched: true, open: k >= 10 });
        expect(res.solid).toBe(false);
        // re-closed: `type != normType` → alpha 1, scale kept (grown), keyTimer kept (0)
        const closed = step(res, { tag: 'bosslock', held: 0, touched: false });
        expect([closed.solid, closed.alpha, closed.scale, closed.keyTimer]).toEqual([true, 1, res.scale, 0]);
    });

    it('the reducer\'s rule is swappable (a mutant reaches the ops through `rules`)', () => {
        expect(SOLIDS_RULES.stepResponder).toBe(stepResponder);
    });
});
