/**
 * seedlingDemo/r5Totem.test — the entrance, the rope, and the shaft.
 *
 * Every claim is driven from the CENSUS on one side and the declaration on
 * the other, so a drift between the generated extract and what was read
 * out of the AS3 is a red rather than a quiet agreement.
 */

import { describe, expect, it } from 'vitest';

import {
    CLUSTER, GROUP_6, TOTEM_ENTRANCE, TOTEM_PAIR, TOTEM_ROPE, TOTEM_SHAFT,
    TotemError, assertPresserWrites,
} from './r5Totem.js';
import { crossRoomWrites, createActivatorState, stepActivators } from './activators.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const source = atlasLevelSource();
const HELD = { hasSword: true, canSwim: true, hasFeather: true, hasFire: true };
const worldFor = (n, cleared = null) => buildLevelWorld(source(n), {
    roles: ROLES, inventory: HELD, ...(cleared ? { cleared } : {}),
});

describe('the entrance — the census carries the cross-room fields', () => {
    it('L38 builds the button with its tset, tag, flip and room', () => {
        const w = worldFor(38);
        const p = w.pressers.find((q) => q.tag === 'buttonroom' && q.x === 32 && q.y === 48);
        expect(p, 'L38 must hold `buttonroom@32,48`').toBeTruthy();
        expect(p.t).toBe(TOTEM_ENTRANCE.presser.t);
        expect(p.persistTag).toBe(TOTEM_ENTRANCE.presser.persistTag);
        expect(p.flip).toBe(TOTEM_ENTRANCE.presser.flip);
        expect(p.room).toBe(TOTEM_ENTRANCE.presser.room);
        // ⚠ The tset and the tag are DIFFERENT numbers here, which is the
        // whole reason the write is easy to misread.
        expect(p.t).not.toBe(p.persistTag);
    });

    it('the press volume is `setHitbox(8, 6, 4, 3)` at (x + 8, y + 8)', () => {
        const w = worldFor(38);
        const p = w.pressers.find((q) => q.x === 32 && q.y === 48);
        expect(p.rect).toMatchObject(TOTEM_ENTRANCE.rect);
    });

    // ⛔ CORRECTED AT R5 SLICE 7. This test used to assert that a
    // `room = -1` buttonroom "writes nothing", which was this module's
    // reading and is wrong: `Game.setPersistence(tag, !activate)` sits
    // OUTSIDE the `if (room == -1) … else …` in `ButtonRoom.as:95`, so a
    // local button writes its own tag exactly as a cross-room one does. It
    // publishes to its group as well, and that publish LATCHES — which is
    // Dungeon 4's whole opening mechanic. See `r5Shaft.test.js`.
    it('a room = -1 buttonroom carries no ROOM write — but it does write its own tag', () => {
        const w = worldFor(38);
        const inRoom = w.pressers.find((q) => q.tag === 'buttonroom' && q.x === 144 && q.y === 128);
        expect(inRoom.room).toBe(-1);
        expect(crossRoomWrites(inRoom))
            .toEqual([{ level: null, tag: 0, value: false, which: 'own' }]);
        // ...and a plain `Button` is not a cross-room presser at all.
        const plain = w.pressers.find((q) => q.tag === 'button');
        expect(crossRoomWrites(plain)).toEqual([]);
    });

    it('the two writes are {39,8}=false and {38,4}=false, in that order', () => {
        const w = worldFor(38);
        const p = w.pressers.find((q) => q.x === 32 && q.y === 48);
        const writes = crossRoomWrites(p);
        expect(writes).toHaveLength(2);
        expect(writes[0]).toEqual({ level: 39, tag: 8, value: false, which: 'room' });
        // `level: null` is "the level the press happened in" — the module
        // that derives the write does not know which that is.
        expect(writes[1]).toEqual({ level: null, tag: 4, value: false, which: 'own' });
        expect(() => assertPresserWrites({ ...p, level: 38 }, TOTEM_ENTRANCE.writes))
            .not.toThrow();
    });

    it('⚠ `flip` decides the SIGN, and a flip = 0 button writes TRUE', () => {
        const w = worldFor(38);
        const p = w.pressers.find((q) => q.x === 32 && q.y === 48);
        const unflipped = crossRoomWrites({ ...p, flip: false });
        expect(unflipped[0].value).toBe(true);
        // ...and the OWN write is false either way — `setPersistence(tag,
        // !activate)` has no `flip` in it.
        expect(unflipped[1].value).toBe(false);
    });

    it('assertPresserWrites is a real check, not a formality', () => {
        const w = worldFor(38);
        const p = { ...w.pressers.find((q) => q.x === 32 && q.y === 48), level: 38 };
        expect(() => assertPresserWrites(p, [{ level: 39, tag: 4, value: false }]))
            .toThrow(TotemError);
        expect(() => assertPresserWrites(p, [
            { level: 39, tag: 8, value: false }, { level: 38, tag: 4, value: true },
        ])).toThrow(/writes \[.*\] and the declaration says/);
    });
});

describe('the entrance — what the write deletes', () => {
    it('L39 builds the plug with nothing cleared, and it is one tile from the arrival', () => {
        const w = worldFor(39);
        const lock = w.solids.find((s) => s.tag === 'wandlock' && s.x === 144 && s.y === 592);
        expect(lock, 'the plug must be SOLID on a fresh build').toBeTruthy();
        expect(TOTEM_ENTRANCE.plug.tile).toEqual({ tx: 9, ty: 37 });
    });

    it('...and does NOT build it once {39,8} is cleared', () => {
        const w = worldFor(39, [8]);
        const lock = w.solids.find((s) => s.tag === 'wandlock' && s.x === 144 && s.y === 592);
        expect(lock, '`Lock.check()` removes a tSet < 0 lock whose flag is off')
            .toBeFalsy();
    });

    it('⛔ the spinners are on the FAR SIDE — the superseded claim, kept', () => {
        expect(TOTEM_ENTRANCE.supersedes.claim).toBe('kill the 3 spinners');
        const w = worldFor(39);
        const spinners = w.combat.enemies.filter((e) => e.tag === 'spinner');
        expect(spinners).toHaveLength(3);
        // every one of them is north of the plug, which is what makes the
        // brief's route circular
        for (const s of spinners) expect(s.y).toBeLessThan(592);
    });
});

describe('the rope — the seventh arm', () => {
    it('is a 112 px WALL spanning seven tiles, and shrinks to one cell', () => {
        const w = worldFor(39, [8]);
        const rope = w.solids.find((s) => s.tag === 'rope');
        expect(rope.rect).toMatchObject(TOTEM_ROPE.rect);
        expect(rope.span).toEqual({ xend: TOTEM_ROPE.xend, w: 112 });
        const pulled = worldFor(39, [8, 9]).solids.find((s) => s.tag === 'rope');
        expect(pulled, 'it SHRINKS — a model that removed it opens a tile the game keeps')
            .toBeTruthy();
        expect(pulled.rect).toMatchObject(TOTEM_ROPE.shrunkRect);
    });

    it('group 6 has exactly the three members the publication reaches', () => {
        const rec = source(39);
        const group = (rec.entities ?? [])
            .filter((e) => Number(e.attrs?.tset) === 6)
            .map((e) => `${e.type}@${e.x},${e.y}`)
            .sort();
        expect(group).toEqual(GROUP_6.map((m) => m.member).sort());
    });

    it('⚠ and the FallRock in it is a no-op, by two independent gates', () => {
        const rock = GROUP_6.find((m) => m.member.startsWith('fallrock'));
        expect(rock.verdict).toBe('no-op');
        // gate 1: a different tag from the one the rope writes
        expect(rock.persistTag).not.toBe(TOTEM_ROPE.persistTag);
        // gate 2: parked off-map, so `activate && y >= fallTo` cannot fire
        const w = worldFor(39, [8, 9]);
        const built = w.solids.find((s) => s.tag === 'fallrock');
        expect(built, 'a tag-10 fallrock is parked at y = -16 with type ""').toBeFalsy();
    });

    it('the pulser is a COST, not a wall — it is Solid either way', () => {
        const pulser = GROUP_6.find((m) => m.member.startsWith('pulser'));
        expect(pulser.verdict).toMatch(/cost/);
        for (const cleared of [[8], [8, 9]]) {
            const w = worldFor(39, cleared);
            expect(w.solids.some((s) => s.tag === 'pulser'), `cleared ${cleared}`).toBe(true);
        }
    });
});

describe('⛔⛔ the shaft — the gate the brief did not price', () => {
    it('the three locks are vertically adjacent in one column', () => {
        const w = worldFor(39, [8, 9]);
        for (const l of TOTEM_SHAFT.locks) {
            const a = w.activators.find((x) => x.id === l.id);
            expect(a, `${l.id} must be built`).toBeTruthy();
            expect(a.t).toBe(l.t);
            expect(a.persistTag).toBe(l.persistTag);
        }
        const tys = TOTEM_SHAFT.locks.map((l) => l.tile.ty).sort((a, b) => a - b);
        expect(tys).toEqual([2, 3, 4]);
        expect(new Set(TOTEM_SHAFT.locks.map((l) => l.tile.tx)).size).toBe(1);
    });

    it('each lock-button sits UNDER a cover — same tile, different tset', () => {
        const rec = source(39);
        const at = (type, t) => (rec.entities ?? []).find(
            (e) => e.type === type && Number(e.attrs?.tset) === t,
        );
        for (const p of TOTEM_SHAFT.pairs) {
            const cover = at('cover', p.cover.t);
            const lockButton = at('button', p.lockButton.t);
            expect(cover, `cover t${p.cover.t}`).toBeTruthy();
            expect(lockButton, `button t${p.lockButton.t}`).toBeTruthy();
            // THE claim: the button that opens a lock is under the cover
            expect({ x: cover.x, y: cover.y }).toEqual({ x: lockButton.x, y: lockButton.y });
            // ...and its own opener is somewhere else entirely
            const coverButton = at('button', p.coverButton.t);
            expect({ x: coverButton.x, y: coverButton.y })
                .not.toEqual({ x: cover.x, y: cover.y });
        }
    });

    it('three lock-buttons, three blocks, one player — the count is the claim', () => {
        const rec = source(39);
        const blocks = (rec.entities ?? []).filter((e) => e.type === 'pushableblockfire');
        expect(blocks).toHaveLength(3);
        expect(blocks.map((b) => `${b.x},${b.y}`).sort())
            .toEqual(TOTEM_SHAFT.blocks.map((b) => `${b.x},${b.y}`).sort());
        expect(TOTEM_SHAFT.pairs).toHaveLength(3);
    });

    it('⛔ and the weapon that moves them is the FIRE attack, not the sword', () => {
        const b = TOTEM_SHAFT.blockedBy;
        expect(b.mechanic).toBe('the FIRE attack');
        expect(b.as3).toMatch(/genericHit\(e, "Fire"/);
        expect(b.target).toMatch(/moveTypes = \["Fire", "Pulse"\]/);
        expect(b.alsoNeeds.length).toBeGreaterThanOrEqual(3);
    });

    it('the 44 cells the shaft is worth are the whole errand', () => {
        expect(TOTEM_SHAFT.cells.withShaft - TOTEM_SHAFT.cells.withoutShaft).toBe(44);
        expect(TOTEM_ENTRANCE.cells.andRope).toBe(TOTEM_SHAFT.cells.withoutShaft);
        expect(TOTEM_ENTRANCE.cells.andShaft).toBe(TOTEM_SHAFT.cells.withShaft);
    });

    it('and the cluster still has exactly one door from outside', () => {
        const outside = [];
        for (let l = 0; l < 116; l += 1) {
            let rec;
            try { rec = source(l); } catch { continue; }
            if (CLUSTER.includes(l)) continue;
            for (const e of rec.entities ?? []) {
                if (e.type === 'teleporter' && CLUSTER.includes(Number(e.attrs?.to))) {
                    outside.push(`L${l}->L${e.attrs.to}`);
                }
            }
        }
        expect(outside).toEqual(['L38->L39']);
    });
});

describe('the press, stepped', () => {
    /** Stand the player on a presser and step one tick. */
    const pressAt = (level, px, py, cleared = null) => {
        const w = worldFor(level, cleared);
        const state = createActivatorState(w);
        const events = stepActivators(state, w, playerBoxAt(px, py), {
            inventory: HELD, keys: new Set(),
        });
        return { w, state, events };
    };

    it('emits ONE roomwrite when the player stands on the button', () => {
        const { events } = pressAt(38, 40, 56);
        const room = events.filter((e) => e.kind === 'roomwrite');
        expect(room).toHaveLength(1);
        expect(room[0].id).toBe('buttonroom@32,48');
        expect(room[0].writes).toEqual([
            { level: 39, tag: 8, value: false, which: 'room' },
            { level: null, tag: 4, value: false, which: 'own' },
        ]);
    });

    it('...and NOT a second one on the next tick — `set activate` is idempotent', () => {
        const w = worldFor(38);
        const state = createActivatorState(w);
        const box = playerBoxAt(40, 56);
        const first = stepActivators(state, w, box, { inventory: HELD, keys: new Set() });
        const second = stepActivators(state, w, box, { inventory: HELD, keys: new Set() });
        expect(first.filter((e) => e.kind === 'roomwrite')).toHaveLength(1);
        expect(second.filter((e) => e.kind === 'roomwrite')).toHaveLength(0);
    });

    it('emits nothing when the player is elsewhere', () => {
        const { events } = pressAt(38, 200, 200);
        expect(events.filter((e) => e.kind === 'roomwrite')).toEqual([]);
    });

    it('⚠ the L37 arrival lands ON the OTHER cross-room button', () => {
        // Both arms of the pair press this, so both ledgers carry {37,4}
        // and {38,5} — declared rather than discovered.
        const { events } = pressAt(38, 152, 296);
        const room = events.filter((e) => e.kind === 'roomwrite');
        expect(room).toHaveLength(1);
        expect(room[0].id).toBe(`buttonroom@${TOTEM_PAIR.arrivalButton.presser.split('@')[1]}`);
        expect(room[0].writes).toEqual([
            { level: 37, tag: 4, value: false, which: 'room' },
            { level: null, tag: 5, value: false, which: 'own' },
        ]);
    });

    it('a state object without `roomWritten` is REFUSED, not silently skipped', () => {
        const w = worldFor(38);
        const stale = { ...createActivatorState(w) };
        delete stale.roomWritten;
        expect(() => stepActivators(stale, w, playerBoxAt(40, 56), {
            inventory: HELD, keys: new Set(),
        })).toThrow(/predates the cross-room writes/);
    });
});
