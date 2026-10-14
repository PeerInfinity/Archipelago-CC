/**
 * ⛓⛓⛓ SEEDLING FIDELITY CEREMONYSHOVE — a pickup ceremony's dead frames, STEPPED for the chasers and the player
 * (`CONTACT_FIDELITY.ceremonyShove`, OFF byte-identical).
 *
 * `Player.update` runs `addShield(); shieldBump();` and `hitUpdate()` outside the freeze-gated move, and an `Enemy`'s
 * `knockback`, `hitUpdate` and `Mobile.death` fade have no freeze gate either. The player's `v` stays frozen non-zero,
 * so a body inside the moving shield box is shoved on every one of phase A's dead frames; a body's i-frames drain and
 * its fade finishes through them; and so do the player's own i-frames. OFF, the model spends those frames as a lump:
 * the touched body leaves the freeze 149 shoves short, and an i-framed or dying body refuses the ceremony
 * (`assertNoCeremonyBesideLiveChaser`).
 *
 * Four game witnesses on p4f (`fixtures/chaser-witness/ceremonyshove-l30-*.json`, each the tape and the GAME's first
 * and last poll at every tick): ON, the model is EXACT on every tick (the player, its `hits_timer`, the BobSoldier's
 * position, velocity, hits and `hits_timer`); OFF, each one is the control that shows the gap.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { CEREMONY_DEAD_FRAMES } from './sealCeremony.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `ceremonyshove-l30-${n}.json`),
    'utf8'));

/** The model's readings per observation tick, and the run (or the throw). */
function replay(w) {
    let run = null;
    const rows = new Map();
    let threw = null;
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), {
        levelSource: SRC, onTick: (t, s, h, rn) => { run = rn; },
    });
    try {
        for (let r = st.next(); !r.done; r = st.next()) {
            const o = r.value.observation;
            const c = (run?.entities('chasers') ?? []).find((b) => !b.removed) ?? null;
            rows.set(o.t, { px: o.x, py: o.y, pht: run.damage.hitsTimer,
                body: c && { x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer } });
        }
    } catch (e) {
        threw = e.message;
    }
    return { run, rows, threw };
}

/** The worst |Δ| of one model row against one game poll. */
function delta(m, g) {
    const d = (a, b) => Math.abs((a ?? 0) - (b ?? 0));
    let w = Math.max(d(m.px, g.px), d(m.py, g.py), d(m.pht, g.pht));
    if (!!m.body !== !!g.body) return Infinity;
    if (m.body) {
        w = Math.max(w, d(m.body.x, g.body.x), d(m.body.y, g.body.y), d(m.body.vx, g.body.vx), d(m.body.vy, g.body.vy),
            d(m.body.hits, g.body.hits), d(m.body.hitsTimer, g.body.hitsTimer));
    }
    return w;
}

/** Every tick against the closer of its first and last game poll: `{worst, at}`. */
function compare(w, rows) {
    let worst = 0;
    let at = null;
    let n = 0;
    for (const g of w.ticks) {
        const m = rows.get(g.t);
        if (!m) continue;
        n += 1;
        const e = Math.min(delta(m, g.first), g.last ? delta(m, g.last) : Infinity);
        if (e > worst) { worst = e; at = g.t; }
    }
    return { worst, at, n };
}

const on = (fn) => withContactFidelity({ ceremonyShove: true }, fn);
const off = (fn) => withContactFidelity({ ceremonyShove: false }, fn);

describe('CEREMONYSHOVE — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.ceremonyShove).toBe(false);
    });
});

describe('CEREMONYSHOVE D2 — the four game witnesses, ON: exact on every tick', () => {
    for (const n of ['touch', 'iframe', 'dying', 'player-iframe']) {
        it(`ceremonyshove-l30-${n}`, () => {
            const w = witness(n);
            const { rows, threw, run } = on(() => replay(w));
            expect(threw).toBeNull();
            const c = compare(w, rows);
            expect(c.n).toBe(w.tape.tick_count);
            expect(c).toEqual({ worst: 0, at: null, n: w.tape.tick_count });
            // the lump and the release frame: 149 + 1 = the 150 dead frames the game reports for phase A
            const lumps = run.ceremonyLumps;
            expect(lumps.map((l) => l.frames)).toEqual([CEREMONY_DEAD_FRAMES.pickup - 1, 1]);
            expect(lumps[0].t).toBe(run.ceremonyStarts[0].t + 1);
        });
    }
});

describe('CEREMONYSHOVE D2 — the same witnesses, OFF: the controls', () => {
    it('touch: the body leaves the freeze 149 shoves (745 px/tick) short', () => {
        const w = witness('touch');
        const { rows, threw } = off(() => replay(w));
        expect(threw).toBeNull();
        const c = compare(w, rows);
        expect(c.at).toBeGreaterThan(150);
        const g = w.ticks.find((r) => r.t === 157).first.body;
        const m = rows.get(157).body;
        expect(Math.hypot(g.vx - m.vx, g.vy - m.vy)).toBeCloseTo(149 * 5, 6);
    });
    it('iframe and dying: the ceremony is refused (`assertNoCeremonyBesideLiveChaser`)', () => {
        expect(off(() => replay(witness('iframe'))).threw).toMatch(/inside 21 ticks of i-frames/);
        expect(off(() => replay(witness('dying'))).threw).toMatch(/is DYING/);
    });
    it('player-iframe: the player\'s own i-frames do not drain through the lump', () => {
        const w = witness('player-iframe');
        const { rows } = off(() => replay(w));
        expect(rows.get(154).pht).toBe(17);
        expect(w.ticks.find((r) => r.t === 154).first.pht).toBe(0);
    });
    it('OFF steps no lump', () => {
        expect(off(() => replay(witness('touch'))).run.ceremonyLumps).toEqual([]);
    });
});
