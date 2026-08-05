/**
 * seedlingDemo/r5Totem.test — the entrance, the rope, and the shaft.
 *
 * Every claim is driven from the CENSUS on one side and the declaration on
 * the other, so a drift between the generated extract and what was read
 * out of the AS3 is a red rather than a quiet agreement.
 */

import { describe, expect, it } from 'vitest';

import {
    CLUSTER, GROUP_6, L38_CHAIN, TOTEM_ENTRANCE, TOTEM_PAIR, TOTEM_ROPE, TOTEM_SHAFT,
    TotemError, assertPresserWrites,
    L40_ARRIVAL, L40_CHAIN, L40_PREDICTIONS, L41_L42_RECON,
} from './r5Totem.js';
import { ROPE_PULL } from './r5Shaft.js';
import { createFallRock, fallRockFreezeTicks, publishActivate } from './fallRock.js';
import { auditFire } from './presses.js';
import { HAZARD_STATES } from './tapeFormat.js';
import { crossRoomWrites, createActivatorState, stepActivators } from './activators.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt, resolveTerrainState } from './playerPhysicsV2.js';

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

    it('⛔⛔ the FallRock in it FALLS — the two "independent" gates share an opener', () => {
        const rock = GROUP_6.find((m) => m.member.startsWith('fallrock'));
        expect(rock.verdict).toBe('IT FALLS');
        // The wrong verdict is kept as data so this assertion is about a
        // CORRECTION and not merely about the current string.
        expect(rock.was).toBe('no-op');

        // Both of the old gates are still exactly as described…
        // gate 1: a different tag from the one the rope writes
        expect(rock.persistTag).not.toBe(TOTEM_ROPE.persistTag);
        // gate 2: parked off-map at build, so `activate && y >= fallTo`
        // cannot fire from a world the census builds
        const w = worldFor(39, [8, 9]);
        expect(w.solids.find((s) => s.tag === 'fallrock'),
            'a tag-10 fallrock is parked at y = -16 with type ""').toBeFalsy();

        // …and `set activate` opens both, because `fall()` writes tag 10.
        const parked = createFallRock(144, 624, 6, 10, false);
        const pub = publishActivate(parked, true);
        expect(pub.fell).toBe(true);
        expect(pub.write).toEqual({ tag: 10, value: false });
        expect(pub.freeze).toBe(true);
        // …at a cost of 197 frozen frames, which is 197 of the refuted
        // recording's 217 dead ones.
        expect(fallRockFreezeTicks(624 + 8).total).toBe(197);
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

// ── R5 SLICE 8: ⛔⛔ THE ENTRANCE BUTTON IS IN A ROOM THE ARRIVAL CANNOT
// REACH, and the chain that joins them is five links long ──────────────
//
// Every claim here is measured from the census, not read off `L38_CHAIN` —
// the declaration is the transcription of the AS3 and the flood is the
// geometry, and a helper that returned the declaration would hide a drift
// between them. `probe-seedling-r5-l38-entrance` is the readable version.

const TILE = 16;

/** An 8 px lattice flood, the pitch every R5 route plans at. */
const flood = (world, rec, start, { open = new Set(), pushables = null } = {}) => {
    const ok = (x, y) => x > 0 && y > 0 && x < rec.width * TILE && y < rec.height * TILE
        && !world.collidesSolid(playerBoxAt(x, y), { openActivators: open, pushables });
    const seen = new Set([`${start.x},${start.y}`]);
    const q = [[start.x, start.y]];
    while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (!ok(nx, ny) || seen.has(`${nx},${ny}`)) continue;
            seen.add(`${nx},${ny}`);
            q.push([nx, ny]);
        }
    }
    return {
        cells: seen.size,
        tiles: new Set([...seen].map((k) => {
            const [a, b] = k.split(',').map(Number);
            return `${Math.floor(a / TILE)},${Math.floor(b / TILE)}`;
        })),
    };
};

describe('⛔⛔ L38 is TWO ROOMS — §20.8\'s one-line entrance leg, refuted', () => {
    const rec = source(38);
    const w = worldFor(38);
    const blockId = w.solids.find((s) => s.pushableId)?.pushableId;
    const blockAt = (tx, ty) => new Map([[blockId, {
        rect: {
            x: tx * TILE, y: ty * TILE, w: TILE, h: TILE,
            right: tx * TILE + TILE, bottom: ty * TILE + TILE,
        },
        removed: false,
    }]]);

    it('the L37 arrival cannot reach the entrance button OR the L39 door', () => {
        const south = flood(w, rec, { x: 152, y: 296 }, { pushables: blockAt(5, 13) });
        expect(south.tiles.has('2,3')).toBe(false);   // buttonroom@32,48
        expect(south.tiles.has('9,0')).toBe(false);   // teleporter -> L39
        expect(south.cells).toBe(L38_CHAIN.rooms[0].cells);
    });

    it('...and the two rooms share NOT ONE TILE', () => {
        const south = flood(w, rec, { x: 152, y: 296 }, { pushables: blockAt(5, 13) });
        const north = flood(w, rec, { x: 152, y: 24 }, { pushables: blockAt(5, 13) });
        expect(north.tiles.has('2,3')).toBe(true);
        expect(north.tiles.has('9,0')).toBe(true);
        expect(north.cells).toBe(L38_CHAIN.rooms[1].cells);
        expect([...south.tiles].filter((t) => north.tiles.has(t))).toEqual([]);
    });

    it('⛔ the join is ONE cell, and the cover is only the OUTER of its two solids', () => {
        const box = playerBoxAt(9 * TILE + 8, 7 * TILE + 8);
        expect(w.collidesSolid(box)).toBeTruthy();
        // The cover open, and the cell is STILL solid — the chest is behind it.
        const withCoverOpen = w.collidesSolid(box, {
            openActivators: new Set(['cover@144,112']),
        });
        expect(withCoverOpen?.tag).toBe('chest');
        // ...and row 7 has no other column at all.
        const free = [];
        for (let tx = 0; tx < rec.width; tx += 1) {
            if (!w.collidesSolid(playerBoxAt(tx * TILE + 8, 7 * TILE + 8))) free.push(tx);
        }
        expect(free).toEqual([]);
    });

    it('⛔ links 3-5 add NOTHING to the flood — the chest is an entity state change', () => {
        const after1 = flood(w, rec, { x: 152, y: 296 },
            { open: new Set(['cover@208,224']), pushables: blockAt(5, 13) });
        const after4 = flood(w, rec, { x: 152, y: 296 },
            { open: new Set(['cover@208,224', 'cover@144,112']), pushables: blockAt(5, 12) });
        expect(after1.cells).toBeGreaterThan(L38_CHAIN.rooms[0].cells); // link 1 opens the cover
        expect(after4.cells).toBe(after1.cells);                        // links 3+4 open nothing
        expect(after4.tiles.has('9,7')).toBe(false);
    });

    it('⛔⛔ the `Pulser` — the engine — is not a census responder at all', () => {
        expect(w.activators.some((a) => a.id.startsWith('pulser'))).toBe(false);
        // ...and it is the ONLY thing group 1 has, so the group opens nothing.
        const group1 = w.pressers.filter((p) => p.t === 1);
        expect(group1).toHaveLength(1);
        expect(group1[0]).toMatchObject({ tag: 'buttonroom', x: 208, y: 224 });
        expect(w.activators.filter((a) => a.t === 1)).toEqual([]);
    });

    it('⛓ NOBODY CAN STAND ON `button@80,192` — the block is not a shortcut', () => {
        const group0 = w.pressers.filter((p) => p.t === 0);
        expect(group0).toHaveLength(1);
        expect(group0[0]).toMatchObject({ tag: 'button', x: 80, y: 192 });
        // Its two approaches are the block (5,13) and the pulser (5,14), both Solid.
        for (const [tx, ty] of [[5, 13], [5, 14]]) {
            expect(w.collidesSolid(playerBoxAt(tx * TILE + 8, ty * TILE + 8),
                { pushables: blockAt(5, 13) })).toBeTruthy();
        }
    });

    it('⛓ the block is the pulser\'s exact NORTH neighbour — a pure axis push', () => {
        const link = L38_CHAIN.links.find((l) => l.kind === 'pulse-push');
        expect(link.moves.from).toEqual({ tx: 5, ty: 13 });
        expect(link.moves.to).toEqual({ tx: 5, ty: 12 });
        // The destination IS the button cell, which is what makes it link 4.
        const button = w.pressers.find((p) => p.t === 0);
        expect(Math.floor(button.x / TILE)).toBe(link.moves.to.tx);
        expect(Math.floor(button.y / TILE)).toBe(link.moves.to.ty);
    });

    it('names the three unbuilt mechanics rather than leaving the leg "hard"', () => {
        expect(L38_CHAIN.unbuilt.map((u) => u.what)).toEqual([
            'the `Pulser` cycle',
            'the pulse\'s player damage',
            'the `Chest` verb',
            'the `SealPiece` pickup',
            '⛔⛔ the `SealController` BEHIND the SealPiece',
            '⚠ and it moves TWO `Music` STATICS',
        ]);
        for (const u of L38_CHAIN.unbuilt) expect(u.src).toMatch(/\.as/);
        expect(L38_CHAIN.links.filter((l) => !l.modelled)).toHaveLength(3);
    });
});

describe('⛔ the rope\'s declared stance was unreachable, and its water was not on the path', () => {
    const rec = source(39);
    const w = buildLevelWorld(source(39), {
        roles: ROLES, inventory: HELD, cleared: [8],
    });

    it('(7,25) is not reachable from L39\'s arrival by any path', () => {
        const f = flood(w, rec, { x: 152, y: 616 });
        expect(f.tiles.has('7,25')).toBe(false);
        expect(ROPE_PULL.supersededStance).toMatchObject({ tx: 7, ty: 25, section: '§20.5' });
    });

    it('⛓ (9,25) IS, it reaches the rope, and it is the only column that does', () => {
        const f = flood(w, rec, { x: 152, y: 616 });
        expect(f.tiles.has(`${ROPE_PULL.stance.tx},${ROPE_PULL.stance.ty}`)).toBe(true);
        const reach = [];
        for (const t of f.tiles) {
            const [tx, ty] = t.split(',').map(Number);
            const a = auditFire(w, { x: tx * TILE + 8, y: ty * TILE + 8 });
            if (a.live.some((r) => r.as3 === 'RopeStart')) reach.push(t);
        }
        expect(reach).toEqual([`${ROPE_PULL.stance.tx},${ROPE_PULL.stance.ty}`]);
    });

    it('⛔ and it is DRY — §20.5\'s canSwim prerequisite is retired', () => {
        const t = resolveTerrainState(w, ROPE_PULL.stance.tx * TILE + 8,
            ROPE_PULL.stance.ty * TILE + 8);
        expect(t).toBe(ROPE_PULL.stanceTerrain);
        expect(t).not.toBe(HAZARD_STATES.water);
        expect(t).not.toBe(HAZARD_STATES.waterfall);
    });
});

/**
 * ⛔⛔ L40 FROM THE L39 ARRIVAL — R5 slice 10.
 *
 * The flood is RECOMPUTED here rather than trusted from `L40_ARRIVAL`: a
 * declaration checked against itself is not a check, and the numbers are
 * what the two predictions turn on.
 */
describe('⛔⛔ L40 from the L39 arrival — two predictions, both named failures', () => {
    const TILE = 16;
    const l40 = () => buildLevelWorld(atlasLevelSource()(40), {
        roles: ROLES,
        inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true },
    });
    const rec = atlasLevelSource()(40);

    const flood = (w, start, open = new Set()) => {
        const P = L40_ARRIVAL.lattice;
        const ok = (x, y) => x > 0 && y > 0 && x < rec.width * TILE && y < rec.height * TILE
            && !w.collidesSolid(playerBoxAt(x, y), { openActivators: open });
        const seen = new Set([`${start.x},${start.y}`]);
        const q = [[start.x, start.y]];
        while (q.length) {
            const [x, y] = q.shift();
            for (const [dx, dy] of [[P, 0], [-P, 0], [0, P], [0, -P]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (!ok(nx, ny)) continue;
                const k = `${nx},${ny}`;
                if (seen.has(k)) continue;
                seen.add(k);
                q.push([nx, ny]);
            }
        }
        const tiles = new Set([...seen].map((k) => {
            const [a, b] = k.split(',').map(Number);
            return `${Math.floor(a / TILE)},${Math.floor(b / TILE)}`;
        }));
        return { cells: seen.size, tiles };
    };

    it('⛓ reaches `totempart 1` with EVERYTHING SHUT — part 1 is a free walk', () => {
        const f = flood(l40(), L40_ARRIVAL.spawn);
        expect(f.cells).toBe(L40_ARRIVAL.flood.cells);
        expect(f.tiles.size).toBe(L40_ARRIVAL.flood.tiles);
        for (const r of L40_ARRIVAL.reached) {
            expect(f.tiles.has(`${r.tile.tx},${r.tile.ty}`), `${r.what} must be reachable`)
                .toBe(true);
        }
        // The spawn is the boot plus `Player.as:357`'s half-tile, not the boot.
        expect(L40_ARRIVAL.spawn).toEqual({
            x: L40_ARRIVAL.boot.x + 8, y: L40_ARRIVAL.boot.y + 8,
        });
    });

    it('⛔ PREDICTION 1: the buttonrooms are UNREACHABLE, and their groups add ZERO', () => {
        const w = l40();
        const shut = flood(w, L40_ARRIVAL.spawn);
        // None of the three `room = -1` buttonrooms is in the flood…
        for (const p of w.pressers.filter((x) => x.tag === 'buttonroom')) {
            expect(p.room).toBe(-1);
            expect(shut.tiles.has(`${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`),
                `buttonroom@${p.x},${p.y} must NOT be reachable`).toBe(false);
        }
        // …and opening groups 0 and 1 by fiat adds nothing, so the rooms are
        // behind the same wall their own groups are.
        const open = new Set(w.activators.filter((a) => a.t === 0 || a.t === 1).map((a) => a.id));
        expect(open.size).toBeGreaterThan(0);
        const latched = flood(w, L40_ARRIVAL.spawn, open);
        expect(latched.cells - shut.cells).toBe(L40_ARRIVAL.groupDelta);
        expect(L40_ARRIVAL.groupDelta).toBe(0);
    });

    it('⛔⛔ PREDICTION 2: the bosslock is in group -1, so no publish reaches it', () => {
        const w = l40();
        const boss = w.activators.find((a) => a.tag === 'bosslock');
        expect(boss.t).toBe(-1);
        expect(boss.keyType).toBe(2);
        const pred = L40_PREDICTIONS.find((p) => p.id === 'keytype-2-boss-key-is-not-collected');
        expect(pred.verdict).toBe('REFUTED AT SOURCE');
        // The wrong prediction is kept as data so this asserts a CORRECTION.
        expect(pred.was).toMatch(/should NOT collect/);
        // …and it is moot for this walk anyway: neither is in the flood.
        const shut = flood(w, L40_ARRIVAL.spawn);
        expect(shut.tiles.has('30,22'), 'bosslock@480,352').toBe(false);
        expect(shut.tiles.has('41,33'), 'bosskey@656,528').toBe(false);
    });

    it('the unreached list is exactly what the flood says it is', () => {
        const shut = flood(l40(), L40_ARRIVAL.spawn);
        // Every name in `unreached` carries its own @x,y — parse it rather
        // than duplicating the coordinates, so the list cannot drift from
        // the thing it names.
        for (const name of L40_ARRIVAL.unreached) {
            const m = name.match(/@(\d+),(\d+)/);
            expect(m, `${name} must carry its placement`).toBeTruthy();
            const tx = Math.floor(Number(m[1]) / TILE);
            const ty = Math.floor(Number(m[2]) / TILE);
            expect(shut.tiles.has(`${tx},${ty}`), `${name} must NOT be reachable`).toBe(false);
        }
        expect(L40_ARRIVAL.unreached.length).toBe(15);
    });
});

/**
 * ── ⛓⛓ L40's OPENING CHAIN — R5 slice 11 ─────────────────────────────
 *
 * §23.9's open question, answered. The geometry is recomputed here rather
 * than read back out of `L40_CHAIN`, for the reason the block above gives:
 * a declaration checked against itself is not a check.
 *
 * ⚠ THE FLOOD IS `collidesSolid`'s, NOT THE PLANNER'S, and that is
 * deliberate: this file already has one and a second transcription of one
 * reachability question is how a ±1 lands in one place and not the other.
 * It runs at a different lattice PHASE from `probe-seedling-r5-l40`, so
 * the two disagree about cell COUNTS and agree about every verdict — which
 * is the claim, and is why nothing here asserts a count from the probe.
 */
describe('⛓⛓ L40\'s opening chain — the join is a PAIR, and the key is behind a BLOCK', () => {
    const TILE = 16;
    const INV = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const rec = atlasLevelSource()(40);
    /** ⚠ The burn has no per-visit family, so it is stood in for at BUILD. */
    const TREE_TAG = 0;
    const l40 = (cleared = []) => buildLevelWorld(rec, { roles: ROLES, inventory: INV, cleared });

    const flood = (w, open = new Set(), chests = new Set()) => {
        const P = 8;
        const ok = (x, y) => x > 0 && y > 0 && x < rec.width * TILE && y < rec.height * TILE
            && !w.collidesSolid(playerBoxAt(x, y),
                { openActivators: open, openChests: chests });
        const start = L40_ARRIVAL.spawn;
        const seen = new Set([`${start.x},${start.y}`]);
        const q = [[start.x, start.y]];
        while (q.length) {
            const [x, y] = q.shift();
            for (const [dx, dy] of [[P, 0], [-P, 0], [0, P], [0, -P]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (!ok(nx, ny)) continue;
                const k = `${nx},${ny}`;
                if (seen.has(k)) continue;
                seen.add(k);
                q.push([nx, ny]);
            }
        }
        return new Set([...seen].map((k) => {
            const [a, b] = k.split(',').map(Number);
            return `${Math.floor(a / TILE)},${Math.floor(b / TILE)}`;
        }));
    };
    const CHEST = new Set(['chest@880,816']);
    /** `buttonroom@880,768` — the first thing on the far side of the join. */
    const BR3 = '55,48';

    it('⛔⛔ the chest ALONE and the tree ALONE both leave the chamber sealed', () => {
        expect(flood(l40()).has(BR3)).toBe(false);
        // The chest opens one cell — into the tree.
        expect(flood(l40(), new Set(), CHEST).has(BR3)).toBe(false);
        // The tree opens nothing at all, because the chest is still under it.
        expect(flood(l40([TREE_TAG])).has(BR3)).toBe(false);
        // ⛓ …and TOGETHER they open it. `L38_CHAIN`'s shape (§21.4) with a
        // different second solid.
        expect(flood(l40([TREE_TAG]), new Set(), CHEST).has(BR3)).toBe(true);
        expect(L40_CHAIN.joinPairs.map((p) => p.reachesButtonroom))
            .toEqual([false, false, true]);
    });

    it('⛓ the tree is a 32x32 solid whose box ENDS where the chest\'s begins', () => {
        const w = l40();
        const tree = w.solids.find((s) => s.tag === 'burnabletree');
        const chest = w.solids.find((s) => s.tag === 'chest');
        expect(tree.rect).toEqual({ x: 872, y: 784, w: 32, h: 32, right: 904, bottom: 816 });
        expect(chest.rect.y).toBe(tree.rect.bottom);
        // ⚠ WHICH IS WHY THE CHEST IS OPENABLE WITH THE TREE STANDING.
        // `Chest.update`'s gate is its own `!collide("Solid", x, y)`, and
        // FlashPunk's overlap is strict — `y1 + h1 > y2` is `816 > 816`,
        // false. One pixel of shared edge either way and the order of the
        // two links would be forced.
        expect(chest.rect.y < tree.rect.bottom).toBe(false);
    });

    it('⛔⛔ NO publication reaches the boss key — the key is behind a BLOCK', () => {
        const w = l40([TREE_TAG]);
        const everything = new Set(w.activators.map((a) => a.id));
        expect(everything.size).toBeGreaterThan(0);
        const f = flood(w, everything, CHEST);
        // `bosskey@656,528` -> tile (41,33)
        expect(f.has('41,33')).toBe(false);
        // …and its chamber's only door is the plain, WALK-pushed block.
        const block = w.pushables.find((p) => p.family === 'walk');
        expect(block.id).toBe('pushableblock@576,560');
        expect([Math.floor(block.x / TILE), Math.floor(block.y / TILE)]).toEqual([36, 35]);
    });

    it('⛔⛔ the bosslock is the largest link, and it is what reaches L41 and L42', () => {
        const link = L40_CHAIN.links.find((l) => l.what.startsWith('bosslock@480,352'));
        expect(link.gains).toBe(732);
        expect(link.gains).toBe(Math.max(...L40_CHAIN.links.map((l) => l.gains)));
        // ⇒ `totempart 3` and `totempart 4` are behind a key §20.6 wrote off
        // and §23.8 reinstated. The two statements are asserted together so
        // the correction cannot drift from its consequence.
        const pred = L40_PREDICTIONS.find((p) => p.id === 'keytype-2-boss-key-is-not-collected');
        expect(pred.verdict).toBe('REFUTED AT SOURCE');
        const key = L40_CHAIN.links.find((l) => l.what.startsWith('bosskey@656,528'));
        expect(key.why).toMatch(/MANDATORY/);
    });

    /**
     * ⛔⛔ Step 4's recon, and its answer is one mechanic rather than two.
     *
     * ⚠⚠ THE STAND-IN GOES IN THE LEVEL RECORD, NOT IN `world.solids`.
     * `collidesSolid` closes over the list `buildLevelWorld` gave it, so
     * filtering the array afterwards is a NO-OP — and the no-op reads
     * exactly like "the crusher is not the wall", which is the answer this
     * comparison produced first and had to throw away.
     */
    it('⛔⛔ L41 and L42 both end at the CRUSHER, with every other opener given away', () => {
        for (const spec of L41_L42_RECON.levels) {
            const base = atlasLevelSource()(spec.level);
            const part = base.entities.find((e) => e.type === 'totempart');
            expect(Number(part.attrs.totempart)).toBe(spec.part);
            const results = [false, true].map((drop) => {
                const r = drop
                    ? { ...base, entities: base.entities.filter((e) => e.type !== 'crusher') }
                    : base;
                const w = buildLevelWorld(r, { roles: ROLES, inventory: INV });
                const open = new Set(w.activators.map((a) => a.id));
                const rocks = new Set(base.entities.filter((e) => e.type === 'breakablerock')
                    .map((e) => `breakablerock@${e.x},${e.y}`));
                const P = 8;
                const ok = (x, y) => x > 0 && y > 0 && x < r.width * 16 && y < r.height * 16
                    && !w.collidesSolid(playerBoxAt(x, y),
                        { openActivators: open, brokenRocks: rocks });
                const seen = new Set([`${spec.boot.x + 8},${spec.boot.y + 8}`]);
                const q = [[spec.boot.x + 8, spec.boot.y + 8]];
                while (q.length) {
                    const [x, y] = q.shift();
                    for (const [dx, dy] of [[P, 0], [-P, 0], [0, P], [0, -P]]) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (!ok(nx, ny)) continue;
                        const k = `${nx},${ny}`;
                        if (seen.has(k)) continue;
                        seen.add(k);
                        q.push([nx, ny]);
                    }
                }
                const tiles = new Set([...seen].map((k) => {
                    const [a, b] = k.split(',').map(Number);
                    return `${Math.floor(a / 16)},${Math.floor(b / 16)}`;
                }));
                return tiles.has(`${Math.floor(part.x / 16)},${Math.floor(part.y / 16)}`);
            });
            expect(results, `L${spec.level}: the part must cross on the crusher alone`)
                .toEqual([false, true]);
        }
        expect(L41_L42_RECON.blocker).toBe('crusher-motion');
    });

    it('⛔⛔ `tset -1` means ALWAYS ON for a Crusher and KILL-LOCK for a Lock', () => {
        // The same literal, two meanings, one class apart — and both are in
        // this cluster. `Crusher.update` is `if (activate || t == -1)`;
        // `Lock.check` is `tag >= 0 && tSet < 0 && !checkPersistence(tag)`.
        const w = buildLevelWorld(atlasLevelSource()(42), { roles: ROLES, inventory: INV });
        const crushers = w.solids.filter((s) => s.tag === 'crusher');
        expect(crushers).toHaveLength(2);
        // ⛓ L42 IS THE PURE CASE: no activator, no presser, nothing else.
        expect(w.activators).toHaveLength(0);
        expect(w.pressers).toHaveLength(0);
        expect(L41_L42_RECON.levels[1].why).toMatch(/PURE CASE/);
        // …and the ladder's verdict is a conflict rather than a clearance.
        expect(L41_L42_RECON.conflict).toMatch(/ruling/);
    });

    it('the chain is eleven links, numbered, and every link cites what builds it', () => {
        expect(L40_CHAIN.links.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        for (const l of L40_CHAIN.links) expect(l.built, l.what).toBeTruthy();
        // ⛔ …and exactly one link is declared UNBUILT, which is the honest
        // half: a chain whose every link claimed to be built would say this
        // level is routable today, and it is not.
        const unbuilt = L40_CHAIN.links.filter((l) => l.built.startsWith('⛔'));
        expect(unbuilt.map((l) => l.n)).toEqual([2]);
        expect(unbuilt[0].what).toMatch(/burnabletree/);
    });
});
