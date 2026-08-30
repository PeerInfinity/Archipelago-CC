/**
 * seedlingDemo/procgenSeedlingArena.test — **THE ARENA'S BINDING HALF**: the
 * kill lock the binding puts on the main path, the mouth it picks out of the
 * four the element declares, the entities it realises, and the tag it spends.
 *
 * PROCGEN ELEMENTS arc 5, slice 4 (§3.4). ⛔ The element's own geometry is
 * `procgenCore/elements/arena.test.js`; what is asked HERE is everything that
 * needs a room — and every row runs over REAL generated skeletons rather than
 * hand-drawn ones, except the two that must construct a case the corpus does
 * not offer and say so.
 *
 * ── ⛓ THE CORPUS ─────────────────────────────────────────────────────
 *
 * `bushy`/`rooms`/`winding`/`branchy` × seeds 1..8 at 15x15, post-sword (the
 * arena declares `needs: ['hasSword']`, so a pre-sword room refuses it at the
 * seam for free). The first row is the NON-VACUITY gate: if the arena stopped
 * placing on this ladder every row below would pass while asking nothing.
 */

import { describe, expect, it } from 'vitest';

import { connected, reachableFrom } from '../procgenCore/gridFlood.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { seedlingModel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { POST_SWORD_PALETTE } from './procgenPalette.js';
import { compositeSeedlingElement } from './procgenSeedlingElements.js';
import { buildArena } from '../procgenCore/elements/arena.js';
import { buildOpenChamber } from '../procgenCore/elements/openChamber.js';
import { ProcgenRng } from '../procgenCore/procgenRng.js';
import { terrainAt } from './procgenLevel.js';

const SPEC = 'arena;w=5;h=5;bodies=1';
const KINDS = ['bushy', 'rooms', 'winding', 'branchy'];
const SEEDS = [...Array(12)].map((_, i) => i + 1);
const key = (c) => `${c.x},${c.y}`;

const modelFor = (kind, seed, spec = SPEC) => seedlingModel({
    seed,
    items: POST_SWORD_PALETTE.items,
    skeleton: seedlingSkeletonSpec(kind),
    defaults: { width: 15, height: 15 },
    elements: parseElementSpec(spec),
});

const PLACED = [];
for (const kind of KINDS) {
    for (const seed of SEEDS) {
        if (modelFor(kind, seed).elements.ran) PLACED.push({ kind, seed });
    }
}

describe('the arena in a room', () => {
    it('placed on enough of the ladder for the rows below to mean anything', () => {
        expect(PLACED.length).toBeGreaterThan(10);
    });

    /**
     * ⛓⛓⛓ **THE KILL LOCK IS A CUT, AND THE ARENA IS ON THE START'S SIDE OF
     * IT** — the two halves that make the fight compulsory rather than
     * decorative, both asked by FLOODING the room this level shipped.
     *
     * ⛔ (a) WITHOUT the cut the player walks to the goal without fighting, and
     * ⚖ ruling 17 calls that decoration. ⛔ (b) WITHOUT the second half the
     * bodies are behind the lock they open, `totalEnemies() == 0` can never
     * become true, and the level is unsolvable — which is exactly why the lock
     * is NOT on the blob's mouth (the brief's first shape).
     */
    it('puts the KILL LOCK on a cut, with the arena\'s mouth START-side of it', () => {
        for (const { kind, seed } of PLACED) {
            const m = modelFor(kind, seed);
            const p = m.elements.placed[0];
            const rec = m.skeleton();
            const ground = (x, y) => terrainAt(rec, x, y) === 'ground';
            const start = { x: m.defaults.start.tx, y: m.defaults.start.ty };
            const goal = { x: m.goalCell.tx, y: m.goalCell.ty };
            const walled = (x, y) => ground(x, y)
                && !(x === p.killLockCell.x && y === p.killLockCell.y);
            expect(connected(rec.width, rec.height, ground, start, goal),
                `${kind}/${seed} open`).toBe(true);
            expect(connected(rec.width, rec.height, walled, start, goal),
                `${kind}/${seed} the lock is a CUT`).toBe(false);
            expect(connected(rec.width, rec.height, walled, start, p.entryMouth),
                `${kind}/${seed} the mouth is START-side`).toBe(true);
        }
    });

    /**
     * ⛓⛓ **THE ARENA HAS NO DOOR AND NO FLAG, AND THE TEST IS `symbols`.** The
     * composite's (iii)-(v) are the GUARD's — a flag one step past a door it
     * holds — and an arena holds nothing. ⛔ Slice 3 gated them on *the element
     * declared no obstacle at all*; an arena declares several and none is a
     * door, which is why the gate had to move to `symbols.holds` (arc 5, slice
     * 4). A binding that still read `obstacles[0]` would call a SPINNER a door.
     */
    it('realises NO door and NO flag — its obstacles are bodies', () => {
        for (const { kind, seed } of PLACED) {
            const p = modelFor(kind, seed).elements.placed[0];
            expect(p.door, `${kind}/${seed}`).toBeNull();
            expect(p.flagCell).toBeNull();
            expect(p.flagLockCell).toBeNull();
            expect(p.block).toBeNull();
            expect(p.button).toBeNull();
            expect(p.ids).toBeNull();
            expect(p.bodies.length).toBe(1);
        }
    });

    /**
     * ⛓⛓⛓ **THE REALISATION: `n` SPINNERS AND ONE `tset:-1` LOCK, ONE TAG.**
     * ⛔ Read off the RECORD the level ships, not off the placement — the
     * placement is what the binding decided and the record is what the game
     * will be handed, and the whole point of a mapping is that the two agree.
     */
    it('puts `bodies` spinners in the blob and ONE kill lock on the cut', () => {
        for (const { kind, seed } of PLACED) {
            for (const bodies of [1, 2]) {
                const m = modelFor(kind, seed, `arena;w=5;h=5;bodies=${bodies}`);
                if (!m.elements.ran) continue;
                const p = m.elements.placed[0];
                const ents = m.skeleton().entities ?? [];
                const spinners = ents.filter((e) => e.type === 'spinner');
                const locks = ents.filter((e) => e.type === 'lock');
                expect(spinners, `${kind}/${seed} bodies=${bodies}`).toHaveLength(bodies);
                expect(spinners.every((e) => e.attrs.tag === '-1')).toBe(true);
                expect(locks).toHaveLength(1);
                expect(locks[0].attrs.tset).toBe('-1');
                expect(locks[0].x / 16).toBe(p.killLockCell.x);
                expect(locks[0].y / 16).toBe(p.killLockCell.y);
                /**
                 * ⛔ THE TAG IS PRIVATE AND IT IS NOT THE GOAL'S. An unresolved
                 * or shared tag parses as 0 — the goal's own flag — and a lock
                 * writes its tag on every open AND every close (⚖ GENERATE-UI
                 * slice 3, track C). ⛓ ONE tag whatever `bodies` is: the count
                 * buys enemies, never persistence.
                 */
                expect(Object.keys(p.tags)).toEqual(['lock']);
                expect(String(p.tags.lock)).toBe(locks[0].attrs.tag);
                expect(locks[0].attrs.tag).not.toBe('0');
                const goalEnt = ents.find((e) => e.type === 'torchpickup');
                expect(locks[0].attrs.tag).not.toBe(goalEnt.attrs.tag);
            }
        }
    });

    /**
     * ⛓⛓⛓ **D4, AS A LAW RATHER THAN A HOPE: PASS 2 CANNOT WRITE IN THE BLOB.**
     * The brief asked how often pass 2 paints into an arena's fight space and
     * whether a keep-open mechanism is owed. ⛔ THE COUNT IS ZERO BY
     * CONSTRUCTION — both pass-2 write gates (`freeRefusal` and
     * `carveCellRefusal`) ask `elementRefusalAt` first, and it refuses every
     * cell of the reserved rectangle and of the tunnel BY NAME. Measured over
     * this corpus at 15x15 and 20x20: **575 of 575 blob cells refused, 0 free**
     * (as-built §12). ⇒ no mechanism was built, and this row is what says the
     * reason is a rule and not luck.
     */
    it('refuses pass 2 every cell of the blob, BY NAME', () => {
        const ONE_WALL = {
            footprint: [{ dx: 0, dy: 0 }],
            terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
            clearance: [],
        };
        let checked = 0;
        for (const { kind, seed } of PLACED) {
            const m = modelFor(kind, seed);
            const rec = m.skeleton();
            for (const c of m.elements.placed[0].areaCells) {
                const why = m.refusalAt(rec, ONE_WALL, c.x, c.y);
                expect(why, `${kind}/${seed} ${key(c)}`).toMatch(/belongs to the ELEMENT/);
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(100);
    });
});

/**
 * ⛓⛓⛓ **THE FOUR-MOUTH PICK — asked of the binding directly** (arc 5, slice
 * 4; slice 3's §11.11 residue 2).
 *
 * ⛔ THESE TWO ROWS BUILD THEIR ROOM, and that is the point rather than a
 * shortcut: the whole change is about what happens when the DRAWN mouth is
 * unusable, and a row that waited for the corpus to produce one would be a row
 * that passes when the corpus does not. The corpus half is the census in the
 * as-built (`the-entry-mouth-is-the-rooms-border-ring` **28 -> 0** at 10x10,
 * with `the-entry-port-cannot-be-joined` UNMOVED at 35).
 */
describe('the mouth the BINDING picks', () => {
    const mulberry32 = (seed) => {
        let s = seed | 0;
        return () => {
            s |= 0; s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
    const SOURCE = Object.freeze({
        name: 'mulberry32 (arena binding test)',
        assertSeed: (s) => s,
        create: (seed) => {
            const next = mulberry32(seed);
            return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
        },
    });
    /**
     * An OPEN square room, all interior floor, start (1,1), goal at the far
     * corner. ⛔ **THE SUBJECT IS THE CHAMBER, NOT THE ARENA**, and the reason
     * is isolation rather than convenience: the two share
     * `openChamberMouths` and the binding's pick is the same line for both, but
     * an arena in an OPEN room refuses at `no-cut-for-the-kill-lock` before the
     * mouth is ever reported — an open room has no one-cell cut (slice 2's door
     * census: on `empty` a span-1 door cuts NOTHING). Asking the mouth question
     * of a placement that refuses for a different reason would be a row that
     * measures the second refusal. The arena's own mouths are asserted in
     * `arena.test.js` to be the chamber's, object-for-object.
     */
    const roomOf = (site, values, seed, size = 12) => {
        const rng = new ProcgenRng(seed, { source: SOURCE });
        const { placement } = buildOpenChamber(values, site, rng);
        return {
            width: size,
            height: size,
            groundAt: (x, y) => x > 0 && y > 0 && x < size - 1 && y < size - 1,
            site,
            placement,
            start: { tx: 1, ty: 1 },
            goal: { tx: size - 2, ty: size - 2 },
        };
    };

    /**
     * ⛓⛓ A SITE AGAINST THE INTERIOR'S WEST EDGE: every W mouth is the room's
     * border ring, and the binding must take one of the other three. ⛔ The row
     * asserts the CHOSEN mouth is off the ring AND that the element really did
     * offer a W entry — otherwise it would pass on an element that had simply
     * drawn something else.
     */
    it('skips a mouth that lands on the room\'s border ring', () => {
        const values = { w: 3, h: 3 };
        let sawWestPreferred = 0;
        for (let seed = 1; seed <= 40; seed += 1) {
            const r = roomOf({ x: 1, y: 4, w: 3, h: 3 }, values, seed);
            const first = r.placement.ports.find((p) => p.role === 'entry');
            const out = compositeSeedlingElement(r);
            expect(out.refused, `seed ${seed}`).toBeUndefined();
            const m = out.placed.entryMouth;
            expect(m.x > 0 && m.y > 0 && m.x < 11 && m.y < 11, `seed ${seed}`).toBe(true);
            if (first.dir === 'W') {
                sawWestPreferred += 1;
                /** the element PREFERRED the unusable one and the binding did
                 *  not take it — which is the change, stated as a difference */
                expect(out.placed.ports.length).toBe(8);
                expect(m.x).not.toBe(0);
            }
        }
        /** ⛓ NON-VACUITY: the drawn mouth really was the unusable one sometimes. */
        expect(sawWestPreferred).toBeGreaterThan(3);
    });

    /**
     * ⛓ AND WHEN THERE IS NO USABLE MOUTH AT ALL IT STILL REFUSES BY NAME. A
     * 10x10 site in a 12x12 room touches the interior's edge on every side, so
     * all four mouths are ring cells. ⛔ The refusal text names every one of
     * them and which the element preferred — the four-mouth change must not
     * turn a graded refusal into a silent redraw.
     */
    it('refuses BY NAME when every declared mouth is on the ring', () => {
        /** ⛓ AN 8x8 ROOM, whose interior is exactly 6x6: a 6x6 site fills it,
         *  so all four mouths are border-ring cells and there is nothing left
         *  to fall back to. */
        const values = { w: 6, h: 6 };
        const out = compositeSeedlingElement(roomOf({ x: 1, y: 1, w: 6, h: 6 }, values, 3, 8));
        expect(out.refused?.reason).toBe('the-entry-mouth-is-the-rooms-border-ring');
        expect(out.refused.detail).toMatch(/EVERY one of the 4 mouth\(s\)/);
    });
});
