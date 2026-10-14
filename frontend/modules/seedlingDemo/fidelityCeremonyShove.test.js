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
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { rectsOverlap } from './levelWorld.js';
import { ceremonyBesideLiveBody } from './solverBot.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { CEREMONY_DEAD_FRAMES } from './sealCeremony.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness',
    `${n.startsWith('l17') ? 'ceremonyshove-' : 'ceremonyshove-l30-'}${n}.json`), 'utf8'));

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
            const live = (run?.entities('chasers') ?? []).filter((b) => !b.removed);
            rows.set(o.t, { px: o.x, py: o.y, pht: run.damage.hitsTimer,
                bodies: live.map((c) => ({ x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer })) });
        }
    } catch (e) {
        threw = e.message;
    }
    return { run, rows, threw };
}

/** The worst |Δ| of one model row against one game poll: the player, and each game body against its nearest model one. */
function delta(m, g) {
    const d = (a, b) => Math.abs((a ?? 0) - (b ?? 0));
    const one = (a, b) => Math.max(d(a.x, b.x), d(a.y, b.y), d(a.vx, b.vx), d(a.vy, b.vy), d(a.hits, b.hits),
        d(a.hitsTimer, b.hitsTimer));
    if (m.bodies.length !== g.bodies.length) return Infinity;
    return Math.max(d(m.px, g.px), d(m.py, g.py), d(m.pht, g.pht),
        ...g.bodies.map((gb) => Math.min(...m.bodies.map((mb) => one(mb, gb)))));
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
        const g = w.ticks.find((r) => r.t === 157).first.bodies[0];
        const m = rows.get(157).bodies[0];
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

describe('CEREMONYSHOVE D3 — a chest\'s seal piece: its 331 dead frames, stepped inside the collecting tick', () => {
    it('ceremonyshove-l17-chest-19 (survey step 19\'s lapse-ON plan; three Bobs, one i-framed): ON exact', () => {
        const w = witness('l17-chest-19');
        const { rows, threw, run } = on(() => replay(w));
        expect(threw).toBeNull();
        expect(compare(w, rows)).toEqual({ worst: 0, at: null, n: w.ticks.length });
        expect(run.ceremonyLumps).toEqual([{ t: 71, level: 17, what: 'sealpiece', frames: CEREMONY_DEAD_FRAMES.total - 1,
            seal: true }]);
    });
    it('OFF: the i-framed Bob keeps 19 ticks the game drained', () => {
        const w = witness('l17-chest-19');
        const { rows } = off(() => replay(w));
        const c = compare(w, rows);
        expect(c.worst).toBe(19);
        expect(c.at).toBe(73);
    });
});

describe('CEREMONYSHOVE D3 — `ceremonyBesideLiveBody` asks where the ceremony LEAVES each body', () => {
    const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
    const run = createRunForStaging(stagingFromTape(tape('bobsoldier2-l30-torch')), SRC);
    const torch = run.world.pickups.find((p) => p.tag === 'torchpickup');
    // the torch ceremony's start, the player moving down onto it (its shield box below it: (71,66)–(78,73))
    const player = { x: 72, y: 66, vx: 0, vy: 1.2, direction: 3, slashing: false };
    const at = { x: 72, y: 66, ceremony: true, player };
    const body = (x, y, over = {}) => ({ id: 'bobsoldier@48,80', tag: 'bobsoldier', x, y, hits: 1, hitsTimer: 0, ...over });
    const ask = (sw, sample, corpses = []) => withContactFidelity({ ceremonyShove: sw },
        () => ceremonyBesideLiveBody(run, sample, corpses));

    it('the run steps the torch ceremony\'s dead frames ON (a ceremony with text), not OFF', () => {
        expect(rectsOverlap(playerBoxAt(at.x, at.y), torch.rect)).toBe(true);
        expect(withContactFidelity({ ceremonyShove: true }, () => run.ceremonyStepsDeadFrames(torch))).toBe(true);
        expect(withContactFidelity({ ceremonyShove: false }, () => run.ceremonyStepsDeadFrames(torch))).toBe(false);
    });
    it('a live body inside the moving shield box is shoved away: refused OFF, not asked ON', () => {
        const s = { ...at, chasers: [body(75, 71)] };
        expect(ask(false, s).danger).toBe(true);
        expect(ask(true, s)).toEqual({ danger: false, sources: [] });
    });
    it('the same body beside a STILL player is not shoved: ON it is parked there and asked the WAIT question', () => {
        const s = { ...at, player: { ...player, vy: 0 }, chasers: [body(75, 71)] };
        const r = ask(true, s);
        expect(r.danger).toBe(true);
        expect(r.sources[0].why).toMatch(/parked beside the player/);
    });
    it('a body below the shield box is parked: asked ON', () => {
        const r = ask(true, { ...at, chasers: [body(72, 78)] });
        expect(r.danger).toBe(true);
        expect(r.sources[0].why).toMatch(/parked beside the player/);
    });
    it('an i-framed body far off and a corpse: refused OFF (the lump was unstepped), clean ON (drained, faded)', () => {
        const iframed = { ...at, chasers: [body(200, 200, { hitsTimer: 12 })] };
        expect(ask(false, iframed).danger).toBe(true);
        expect(ask(true, iframed).danger).toBe(false);
        const corpse = [{ id: 'bobsoldier@48,80', tag: 'bobsoldier', x: 75, y: 71, dying: true }];
        expect(ask(false, { ...at, chasers: [] }, corpse).danger).toBe(true);
        expect(ask(true, { ...at, chasers: [] }, corpse).danger).toBe(false);
    });
    it('without the sample\'s player no body counts as shoved (the side to err on)', () => {
        expect(ask(true, { x: 72, y: 66, ceremony: true, chasers: [body(75, 71)] }).danger).toBe(true);
    });
});
