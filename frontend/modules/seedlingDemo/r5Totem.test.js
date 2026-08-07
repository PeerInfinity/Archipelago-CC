/**
 * seedlingDemo/r5Totem.test — the entrance, the rope, and the shaft.
 *
 * Every claim is driven from the CENSUS on one side and the declaration on
 * the other, so a drift between the generated extract and what was read
 * out of the AS3 is a red rather than a quiet agreement.
 */

import { describe, expect, it } from 'vitest';

import {
    L40_FALLTHROUGH,
    CLUSTER, GROUP_6, L38_CHAIN, TOTEM_ENTRANCE, TOTEM_PAIR, TOTEM_ROPE, TOTEM_SHAFT,
    TotemError, assertPresserWrites,
    L40_ARRIVAL, L40_CHAIN, L40_CORPSE, L40_PREDICTIONS, L41_L42_RECON,
    L37_BURN, L40_JOIN, L40_LINK4, L40_NW, L41_SHIELD, L41_PART3, L42_PART4,
    PARKED_SCAN_AUDIT, L40_ARRIVAL_BREAK, L42_SOLVE, L43_BOSS_WAKE,
} from './r5Totem.js';
import { ROPE_PULL } from './r5Shaft.js';
import {
    FALL_ROCK, createFallRock, fallRockFreezeTicks, publishActivate,
} from './fallRock.js';
import { auditFire } from './presses.js';
import { HAZARD_STATES, parseTape, serializeTape } from './tapeFormat.js';
import { crossRoomWrites, createActivatorState, stepActivators } from './activators.js';
import { PERSISTENCE_RESPONSE, ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt, resolveTerrainState } from './playerPhysicsV2.js';
import { HITBOX } from './playerPhysicsV1.js';
import { fireRect } from './fireVerb.js';
import { rectsOverlap } from './levelWorld.js';
import { chestStanceBand } from './chest.js';
import { plannerObstacleAt, synthesizeLegs } from './botDriverV2.js';
import { crusherRect, detectionRects, laneHitsPlayer, scanCrusher } from './crusher.js';
import { createLevelRun } from './levelRun.js';
import { runTape } from './tapeRunner.js';
import { fadeBand } from './deadFrameBand.js';
import { readFileSync } from 'node:fs';
import {
    HIT_TO_GONE_TICKS as BURN_HIT_TO_GONE,
    WAIT_AFTER_PRESS_TICKS as BURN_WAIT_AFTER_PRESS,
    assertBurnWaitCovers,
} from './burnableTree.js';

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

/**
 * ⛔⛔ R5 SLICE 13 — the recon §24.9 listed as missing, asserted.
 *
 * The claim worth pinning is the NEGATIVE one: this entity is not a trigger
 * and its coordinates are not a place. A route that avoided (224,432) as a
 * volume would be avoiding an empty cell.
 */
describe('control@224,432 — a parameter block, not a trigger', () => {
    it('is read once at loadlevel and consumed only by a pit fall', () => {
        expect(L40_FALLTHROUGH.isTrigger).toBe(false);
        expect(L40_FALLTHROUGH.consumedBy).toMatch(/checkFallingInPit/);
    });

    it('its @x,@y is the BASE OF AN OFFSET — (224,432) + (-64,-320) = (160,112)', () => {
        expect(L40_FALLTHROUGH.entity).toEqual({ tag: 'control', x: 224, y: 432 });
        expect(L40_FALLTHROUGH.offset).toEqual({ x: 160, y: 112 });
    });

    it('⛔ every pit in L40 TRANSPORTS to the wand room rather than killing', () => {
        expect(L40_FALLTHROUGH.toLevel).toBe(43);
        expect(L40_FALLTHROUGH.fallFromCeiling).toBe(true);
        // `int(@sign) - 1` on an @sign of "0".
        expect(L40_FALLTHROUGH.sign).toBe(-1);
    });
});

/**
 * ── ⛓⛓⛓ R5 SLICE 14: THE BURN'S TWO DRIVES ──────────────────────────
 *
 * Both declarations are checked against the EXTRACT and against a flood
 * recomputed here, per this file's rule: a declaration checked against
 * itself is not a check.
 */
describe('⛓⛓ the burn — L37\'s door and L40\'s join', () => {
    const TILE = 16;
    const INV = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const w37 = () => buildLevelWorld(atlasLevelSource()(37), { roles: ROLES, inventory: INV });
    const w40 = () => buildLevelWorld(atlasLevelSource()(40), { roles: ROLES, inventory: INV });

    /**
     * ⚠ THE PLANNER'S QUERY, NOT `collidesSolid`. The two disagree by a
     * whole terrain policy — pits, lethal tiles, teleporter volumes — and
     * the declaration is about what a ROUTE can walk.
     */
    const plannerFlood = (w, start, opts) => {
        const P = 8;
        const rec = w.record ?? null;
        const nx = (rec?.width ?? w.width) * TILE / P;
        const ny = (rec?.height ?? w.height) * TILE / P;
        const ok = (tx, ty) => tx >= 0 && ty >= 0 && tx < nx && ty < ny
            && plannerObstacleAt(w, tx * P + P / 2, ty * P + P / 2, null,
                { avoidVolumes: false, ...opts }) === null;
        const from = [Math.floor(start.x / P), Math.floor(start.y / P)];
        const seen = new Set();
        const key = (a, b) => b * nx + a;
        if (!ok(from[0], from[1])) return seen;
        seen.add(key(from[0], from[1]));
        const q = [from];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = x + dx;
                const b = y + dy;
                if (seen.has(key(a, b)) || !ok(a, b)) continue;
                seen.add(key(a, b));
                q.push([a, b]);
            }
        }
        return seen;
    };

    /** The 8 px flood the planner works at, over `collidesSolid`. */
    const flood = (w, rec, start, opts = {}) => {
        const P = 8;
        const ok = (x, y) => x > 0 && y > 0 && x < rec.width * TILE && y < rec.height * TILE
            && !w.collidesSolid(playerBoxAt(x, y), opts);
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
        return seen;
    };

    it('⛓ L37\'s tree is where the declaration says, and its tag is IN BAND', () => {
        const tree = w37().burnableTrees.find((t) => t.id === L37_BURN.tree.id);
        expect(tree).toBeDefined();
        expect(tree.tag).toBe(L37_BURN.tree.tag);
        expect(tree.tag).toBeGreaterThanOrEqual(0);
        // ⇒ `removed()` writes {37,1} in band. A `tag = -1` tree would go
        // through the out-of-band family instead, which is a DIFFERENT
        // level's slot and a different claim.
        expect(tree.rect).toEqual({ x: 128, y: 192, w: 32, h: 32, right: 160, bottom: 224 });
    });

    /**
     * ⛔⛔ THE FLOOD'S POLICY IS PART OF THE MEASUREMENT, and reading it as
     * a fact about the room is what this test exists to stop.
     *
     * The first cut of `L37_BURN` claimed the tree was a door: 96 nodes
     * shut, 584 burned, "a closed room with one exit". That flood ran with
     * `plannerObstacleAt`'s default lethal-terrain policy — "the player
     * holds nothing" — while the DRIVE plans with `run.inventory`, which
     * on this route includes the CONCH. Under the drive's own policy the
     * burn opens **+16**: the tree's own 2x2 at an 8 px lattice, and
     * nothing else. The 96-node room is bounded by 26 nodes of water and a
     * teleporter.
     *
     * ⇒ both arms are asserted, each named for its policy, so neither can
     * be quoted as the other.
     */
    it('⛔⛔ the burn opens its OWN 2x2 — the "door" was the flood\'s policy', () => {
        const w = w37();
        const B = { burnedTrees: new Set([L37_BURN.tree.id]) };
        const shutHeld = plannerFlood(w, L37_BURN.stance, { inventory: INV });
        const openHeld = plannerFlood(w, L37_BURN.stance, { inventory: INV, ...B });
        expect(shutHeld.size).toBe(L37_BURN.flood.held.shut);
        expect(openHeld.size).toBe(L37_BURN.flood.held.burned);
        expect(openHeld.size - shutHeld.size).toBe(L37_BURN.flood.held.delta);
        // …and the conservative arm, kept because it was once read as a
        // finding. A number that misled should stay visible beside the
        // reading that replaced it.
        expect(plannerFlood(w, L37_BURN.stance, {}).size).toBe(L37_BURN.flood.nothing.shut);
        expect(plannerFlood(w, L37_BURN.stance, B).size).toBe(L37_BURN.flood.nothing.burned);
    });

    it('⛓⛓ the claim that survives every policy: the tree\'s own cells', () => {
        const tree = w37().burnableTrees.find((t) => t.id === L37_BURN.tree.id);
        // The footprint IS the rect, in tiles — derived, not typed.
        const derived = [];
        for (let ty = tree.rect.y / TILE; ty < tree.rect.bottom / TILE; ty += 1) {
            for (let tx = tree.rect.x / TILE; tx < tree.rect.right / TILE; tx += 1) {
                derived.push(`${tx},${ty}`);
            }
        }
        expect(L37_BURN.footprint.map((f) => `${f.tx},${f.ty}`).sort())
            .toEqual(derived.sort());
        // …and the two the route actually crosses are a subset of them.
        for (const c of L37_BURN.crossed) {
            expect(derived).toContain(c);
        }
    });

    it('⛓ the press stance is inside the fire rect AND outside the tree', () => {
        const tree = w37().burnableTrees.find((t) => t.id === L37_BURN.tree.id);
        const r = fireRect(L37_BURN.stance.x, L37_BURN.stance.y);
        expect(rectsOverlap(r, tree.rect)).toBe(true);
        // …and the player's own box does NOT, because the tree is Solid
        // until 41 ticks after the press.
        expect(rectsOverlap(playerBoxAt(L37_BURN.stance.x, L37_BURN.stance.y), tree.rect))
            .toBe(false);
    });

    it('⛔ the boot is the TILE CORNER and the spawn is the tile centre', () => {
        // `Player.as:357` adds (+8,+8) to a `new Game(level, x, y)` boot —
        // the same relationship `L40_ARRIVAL` records. Booting at the tile
        // CENTRE puts the player half a tile into its neighbour, which in
        // this room is a wall, and the failure reads as "the A* start is
        // not walkable" rather than as a boot problem.
        expect(L37_BURN.boot.at).toEqual({
            x: L37_BURN.boot.tile.tx * TILE, y: L37_BURN.boot.tile.ty * TILE,
        });
        expect(L37_BURN.boot.at.x + 8).toBe(L37_BURN.boot.tile.tx * TILE + TILE / 2);
    });

    it('⛓ the leg\'s wait IS the module\'s obligation, not a copy of it', () => {
        expect(L37_BURN.wait).toBe(BURN_WAIT_AFTER_PRESS);
        expect(L40_JOIN.wait).toBe(BURN_WAIT_AFTER_PRESS);
        expect(assertBurnWaitCovers(L37_BURN.wait, 'L37')).toBe(true);
        // ⛔ `breakableRocks` exports a constant of the SAME NAME for a
        // 7-tick shatter. A hand-copied number here is how the two drift,
        // and a burn leg waiting the rock's window walks into a tree.
        expect(BURN_WAIT_AFTER_PRESS).toBeGreaterThan(BURN_HIT_TO_GONE);
    });

    it('⛔⛔ L40\'s join: the burn stance is INSIDE the chest\'s own cell', () => {
        const w = w40();
        const chest = w.chests.find((c) => c.id === L40_JOIN.chest.id);
        expect(chest.persistTag).toBe(L40_JOIN.chest.persistTag);
        const box = playerBoxAt(L40_JOIN.burnStance.x, L40_JOIN.burnStance.y);
        const chestRect = w.solids.find((s) => s.chestId === L40_JOIN.chest.id).rect;
        expect(rectsOverlap(box, chestRect)).toBe(true);
        // ⇒ THE ORDER IS FORCED BY THE ROUTE. §24.5 read the one pixel of
        // shared edge and concluded the two links commute; they commute as
        // FLAGS and not as a walk, because the only stance that reaches the
        // tree is the cell the chest is standing in.
        const tree = w.burnableTrees.find((t) => t.id === L40_JOIN.tree.id);
        expect(rectsOverlap(fireRect(L40_JOIN.burnStance.x, L40_JOIN.burnStance.y), tree.rect))
            .toBe(true);
    });

    it('⛓ the chest\'s stance band is TWO ROWS, and a bobsoldier stands in them', () => {
        const band = chestStanceBand(L40_JOIN.chest.x, L40_JOIN.chest.y, HITBOX);
        expect(band.length).toBe(2);
        expect(band).toContain(L40_JOIN.chestStance.y);
        const w = w40();
        const soldier = w.combat.enemies.find((e) => e.as3 === 'BobSoldier');
        expect(soldier.x).toBe(880);
        // ⛓ It is `type = "Enemy"` and so NOT Solid to the player, and its
        // own `update()` returns on `Game.freezeObjects` — so it neither
        // blocks the stance nor moves through the 331-frame ceremony.
        expect(w.solids.some((s) => s.tag === 'bobsoldier')).toBe(false);
    });

    it('⛔⛔ the kill-ledger rule: only the SPINNER family writes on removal', () => {
        const w = w40();
        const spinners = w.combat.enemies.filter((e) => e.as3 === 'Spinner');
        // Five in the level; the two in the join's chamber are tags 15/16.
        expect(spinners.length).toBe(5);
        const chamber = spinners.filter((e) => e.x >= 800 && e.y >= 800)
            .map((e) => Number(e.attrs.tag)).sort((a, b) => a - b);
        expect(chamber).toEqual(L40_JOIN.spinners.map((s) => s.tag).sort((a, b) => a - b));
        for (const s of spinners) expect(s.row.sideWrite).toBe('own tag');
        // ⛓ …and the bob family's `removed()` is EMPTY, so clearing a press
        // room of bobs costs the ledger nothing. Asserted through the
        // census's own side-write field so the two answers come from one
        // place.
        for (const e of w.combat.enemies.filter((x) => x.as3 === 'Bob' || x.as3 === 'BobSoldier')) {
            expect(e.row.sideWrite ?? 'none').not.toBe('own tag');
        }
    });

    it('⛓ the join\'s ledger is the chest\'s tag and the tree\'s, and nothing else', () => {
        const w = w40();
        const chest = w.chests.find((c) => c.id === L40_JOIN.chest.id);
        const tree = w.burnableTrees.find((t) => t.id === L40_JOIN.tree.id);
        expect([...L40_JOIN.earned].sort())
            .toEqual([`40:${chest.persistTag}`, `40:${tree.tag}`].sort());
    });

    it('⚠ the proof tile is NOT the buttonroom\'s own cell', () => {
        // Stepping on `buttonroom@880,768` is LINK 3 and would put {40,12}
        // in the join tape's ledger, turning a two-write claim into a
        // three-write one. Links are driven one tape at a time, and this is
        // the assertion that keeps the proof honest about which.
        expect([Math.floor(L40_JOIN.proof.x / TILE), Math.floor(L40_JOIN.proof.y / TILE)])
            .not.toEqual([Math.floor(880 / TILE), Math.floor(768 / TILE)]);
    });
});

/**
 * ── ⛓⛓ R5 SLICE 14: L41's SHIELD, AGAINST THE LEVEL ─────────────────
 *
 * §25.6 named this gap itself: the shield claim was asserted on a
 * CONSTRUCTED solid. Here it is asked of L41's own `world.solids`.
 *
 * ⚠⚠ AND THE SHAPES ARE THE TEST'S REAL RISK. `collideLineSolid` reads
 * `s.x/s.y/s.right/s.bottom`; a `world.solids` entry carries its box on
 * `.rect`. `scanCrusher`'s lane test needs a player BOX, not an `{x, y}`.
 * Both wrong shapes return a clean "dir null, shieldedBy null, matched []"
 * — a plausible "it cannot see you" that a route would have been built on.
 * So the test asserts the UNSHIELDED direction too: a probe that silently
 * saw nothing would fail that arm.
 */
describe('⛓⛓ L41\'s crusher — the rocks really do shield it', () => {
    const INV = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const w41 = () => buildLevelWorld(atlasLevelSource()(41), { roles: ROLES, inventory: INV });
    const boxesExcept = (w, self, dropRocks) => w.solids
        .filter((s) => s !== self && !(dropRocks && s.rockId))
        .map((s) => ({ ...s.rect, rockId: s.rockId, tag: s.tag }));
    /**
     * ⛔⛔ R5 SLICE 15 CORRECTED THIS HELPER, and the correction is the
     * §28.8 lesson landing on §28.8's own probe. `{ ...playerBoxAt(x, y),
     * x, y }` is a CHIMERA: a box whose left/top edge has been overwritten
     * with the entity point and whose right/bottom has not, i.e. a 2x3 box
     * shifted 2 px south-east of the real 4x5 one. It reported the right
     * answer for L41 only because the bait stance has a 40 px margin.
     * `scanCrusher` takes the two shapes as two arguments now, so the
     * chimera is unbuildable.
     */
    const playerAt = (x, y) => ({ box: playerBoxAt(x, y), point: { x, y } });

    it('⛓⛓ shielded with the rocks standing, and charging WEST without them', () => {
        const w = w41();
        const self = w.solids.find((s) => s.tag === 'crusher');
        expect(self.rect).toEqual({
            x: 240, y: 64, w: 32, h: 32, right: 272, bottom: 96,
        });
        const c = { x: self.rect.x + 16, y: self.rect.y + 16 };
        const p = playerAt(L41_SHIELD.baitFrom.x, L41_SHIELD.baitFrom.y);
        const withRocks = scanCrusher(c, p.box, p.point, boxesExcept(w, self, false));
        expect(withRocks.dir).toBe(null);
        expect(withRocks.shieldedBy?.rockId).toBe(L41_SHIELD.shieldedBy);
        // ⛓ THE OTHER ARM, and it is what makes the first one a finding
        // rather than a wrong shape: with the rocks gone it charges.
        const without = scanCrusher(c, p.box, p.point, boxesExcept(w, self, true));
        expect(without.shieldedBy).toBe(null);
        expect(without.dir).toBe(L41_SHIELD.unshieldedDir);
        expect(L41_SHIELD.rocks.every((id) => w.solids.some((s) => s.rockId === id))).toBe(true);
    });

    it('⛔ …and the SOUTH lane is shielded by the room, rocks or no rocks', () => {
        const w = w41();
        const self = w.solids.find((s) => s.tag === 'crusher');
        const c = { x: self.rect.x + 16, y: self.rect.y + 16 };
        for (const y of [120, 140]) {
            const p = playerAt(256, y);
            for (const drop of [false, true]) {
                const scan = scanCrusher(c, p.box, p.point, boxesExcept(w, self, drop));
                expect(scan.dir).toBe(null);
                expect(scan.shieldedBy?.tag).toBe(L41_SHIELD.southBlocked);
            }
        }
        // ⇒ the bait can only come from the west, which is a route
        // constraint slice 15's verb has to start from.
        expect(L41_SHIELD.driven).toBe(false);
    });
});

describe('⛓ L40\'s NW cluster — three rocks, TWO swings', () => {
    it('⛔⛔ the swings name their COLLATERAL, and the union is all three rocks', () => {
        const broken = [...new Set(L40_NW.swings.flatMap((sw) => sw.breaks))].sort();
        expect(broken).toEqual(L40_NW.rocks.map((r) => r.id).sort());
        expect(L40_NW.swings.length).toBe(2);
        // ⛔ The two rocks one slash takes down are VERTICALLY ADJACENT —
        // which is why one swing reaches both, and why a plan that named
        // one swing per rock refused itself on target 2.
        const pair = L40_NW.swings[0].breaks
            .map((id) => L40_NW.rocks.find((r) => r.id === id));
        expect(pair[0].x).toBe(pair[1].x);
        expect(Math.abs(pair[0].y - pair[1].y)).toBe(16);
    });

    it('⛔ the buttonrooms need 101 continuous ticks, not a cover\'s 11', () => {
        // `L38_CHAIN`'s buttonrooms open COVERS; both of these open `Lock`s.
        // A 4-tick hold reports "held, and the wall is still solid" — which
        // is what the first cut of the leg did.
        expect(L40_NW.holdTicks).toBeGreaterThan(101);
    });
});

/**
 * ── ⛓⛓⛓ R5 SLICE 15: L41 IS SOLVED, AND THE OBSTACLE IS THE KEY ──────
 *
 * §24.6 measured "the part crosses on the crusher alone" and read it as a
 * wall. It is a wall AND the room's only usable machine. L41 has two gates
 * that each need a SOLID standing on a button, one pushable block, and the
 * block's only push stance is inside the first gate — so a player alone
 * opens neither. `Button.update` collides `["Player","Enemy","Solid"]` and
 * a `Crusher` is `type = "Solid"`.
 *
 * These are DRIVEN, not derived: the three choreographies run through a
 * real `createLevelRun` and the claims are a park POSITION and an empty
 * contact list. A bait that is run over completes exactly like one that
 * works — `Bot.noDamage` is on — so the count is the claim.
 */
describe('⛓⛓⛓ L41: three baits walk the crusher onto the cover\'s button', () => {
    const l41 = () => createLevelRun({
        levelSource: atlasLevelSource(),
        boot: { level: 41, x: 208, y: 80 },
        // The state the rock swing leaves: both `breakablerock`s gone, so
        // the crusher's west sight line is clear. ⛔ THE ORDER IS THE ROOM —
        // with them standing it never scans at all (§28.8).
        persistence: L41_PART3.rocks.map((r) => ({ level: 41, tag: r.tag })),
        noDamage: true,
    });
    const drive = (run, spans) => {
        for (const s of spans) {
            const keys = s.key ? new Set([s.key]) : new Set();
            for (let i = 0; i < s.ticks; i += 1) run.advance(keys);
        }
        return run;
    };
    const only = (run) => [...run.crushers.values()][0];

    it('⛓⛓⛓ each bait ends at its declared park, with ZERO contacts', () => {
        const run = l41();
        expect(only(run)).toMatchObject(L41_PART3.baits[0].from);
        for (const bait of L41_PART3.baits) {
            expect(only(run), `before the ${bait.dir} bait`).toMatchObject(bait.from);
            drive(run, [...bait.approach, ...bait.spans]);
            expect(only(run), `after the ${bait.dir} bait`).toMatchObject(bait.park);
            expect(run.crushersParked).toBe(true);
            // ⛔ THE SURVIVAL CLAIM. `Crusher.hit()` deals 1000 and
            // `Bot.noDamage` is what stops the game dying of it, so a
            // choreography that is run over reaches this line looking
            // identical to one that worked.
            expect(run.crusherContacts, `the ${bait.dir} bait was run over`).toEqual([]);
        }
        expect(only(run)).toMatchObject(L41_PART3.parks[2].to);
    });

    /**
     * ⛓⛓⛓ THE CLAIM THE WHOLE ROOM TURNS ON. The crusher's third park is ON
     * `button@248,232`, and the cover it publishes to is OPEN — which is the
     * only way the room's one block ever becomes pushable.
     */
    it('⛓⛓⛓ …and the third park PRESSES `button@248,232` — the cover opens', () => {
        const run = l41();
        expect(run.openActivators.has(L41_PART3.cover.id)).toBe(false);
        for (const bait of L41_PART3.baits) drive(run, [...bait.approach, ...bait.spans]);
        expect([...run.openActivators]).toEqual([L41_PART3.cover.id]);
        // ⛓ AND IT STAYS OPEN with the player nowhere near: a `Cover` resets
        // the tick nothing is in its cell and its button is released, and
        // this button is held by 32x32 of Solid that is not going anywhere.
        drive(run, [{ key: null, ticks: 300 }]);
        expect(run.openActivators.has(L41_PART3.cover.id)).toBe(true);
        expect(only(run)).toMatchObject(L41_PART3.parks[2].to);
    });

    /**
     * ⛔ THE NEGATIVE ARM, and it is the ORDER rather than the spans: with
     * the rocks STANDING the crusher is shielded, never scans, and the same
     * three choreographies move it not one pixel. The cover stays shut.
     */
    it('⛔ with the rocks STANDING the same spans move nothing — the order is the room', () => {
        const control = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 41, x: 208, y: 80 },
            noDamage: true,
        });
        for (const bait of L41_PART3.baits) drive(control, [...bait.approach, ...bait.spans]);
        expect(only(control)).toMatchObject(L41_PART3.baits[0].from);
        expect(control.openActivators.has(L41_PART3.cover.id)).toBe(false);
        expect(control.crusherContacts).toEqual([]);
    });
});

/**
 * ── ⛓⛓⛓ R5 SLICE 16: THE WHOLE ROOM, THROUGH THE DRIVER ──────────────
 *
 * The block above drives the three choreographies as raw spans, which is
 * how they were searched. This one drives the LEG — three `bait` targets,
 * six `fire.moves` presses, a `wait` and a `collect` — because the two
 * things slice 15 could not check are exactly the ones that only appear
 * once a driver is holding the room:
 *
 *   · `runBait`'s precondition. Two of the three baits present the player
 *     to the lane WITH their first span, so a verb that demanded the lane
 *     up front could express bait 1 and nothing else.
 *   · the 1,307 ticks AFTER the third bait. A park is a position, not a
 *     state — the crusher re-scans every one of them from `button@248,232`,
 *     and if any stance in the block chain, the fade or the ceremony woke
 *     it the cover would shut and the room would seal.
 *
 * `plan-seedling-r5-l41-part3.mjs` is the generator and carries the full
 * claim list; this is the part that has to stay true in CI.
 */
describe('⛓⛓⛓ L41: the leg — three baits, six pushes, a fade nobody holds, a ceremony', () => {
    const leg = () => synthesizeLegs([{
        level: 41,
        targets: [
            ...L41_PART3.baits.map((b) => ({
                ...b.stance,
                bait: {
                    crusher: { x: 240, y: 64 },
                    approach: b.approach.map((sp) => ({ ...sp })),
                    spans: b.spans.map((sp) => ({ ...sp })),
                    park: { ...b.park },
                },
            })),
            { x: 120, y: 136, equip: { slot: 1 } },
            ...L41_PART3.pushes.map((p) => ({
                x: p.stance[0] * 16 + 8,
                y: p.stance[1] * 16 + 8,
                fire: {
                    moves: [{
                        from: { tx: p.from[0], ty: p.from[1] },
                        to: { tx: p.to[0], ty: p.to[1] },
                    }],
                },
            })),
            {
                x: L41_PART3.pushes[5].stance[0] * 16 + 8,
                y: L41_PART3.pushes[5].stance[1] * 16 + 8,
                wait: {
                    ticks: 160,
                    opens: L41_PART3.wandlock.id,
                    why: 'the block parked on `button@176,176` is what publishes group 1',
                },
            },
            { x: L41_PART3.collectStance[0] * 16 + 8, y: L41_PART3.collectStance[1] * 16 + 8 },
            {
                x: L41_PART3.collectStance[0] * 16 + 8,
                y: L41_PART3.collectStance[1] * 16 + 8,
                collect: { pickup: { ...L41_PART3.part } },
            },
        ],
    }], {
        levelSource: atlasLevelSource(),
        boot: { level: 41, x: 208, y: 80 },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 41, items: ['sword', 'fire', 'conch', 'feather'] }],
            // ⛓ The window boots with its own tags clear: the rocks SHIELD
            // the crusher, so the swing that removes them is an earlier
            // window's, exactly as an item is.
            persistence: L41_PART3.rocks.map((r) => ({ level: 41, tag: r.tag })),
            equips: [],
            roles: [...ROLES],
        },
        name: 'r5-l41-part3',
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 4000,
    });

    it('drives all three baits, and each starts where the last one ended', () => {
        const { baits, arrivals } = leg();
        expect(baits.map((b) => b.dir)).toEqual(['W', 'S', 'E']);
        expect(baits.map((b) => b.crusherTo))
            .toEqual(L41_PART3.parks.map((p) => ({ ...p.to })));
        // ⛓ ZERO walk ticks before each bait. The choreographies were
        // searched as one continuous chain, so a stance that cost the
        // planner a tick would be a bait verified from a position its
        // search never saw.
        expect(arrivals[0].tick).toBe(0);
        expect(arrivals[1].tick).toBe(baits[0].to);
        expect(arrivals[2].tick).toBe(baits[1].to);
    });

    it('⛓⛓⛓ …then six pushes, a fade nobody holds, and the fourth ceremony', () => {
        const { fires, waits, collects, tape } = leg();
        expect(fires.map((f) => f.moves[0].to))
            .toEqual(L41_PART3.pushes.map((p) => ({ tx: p.to[0], ty: p.to[1] })));
        // ⛓⛓ THE FADE, MEASURED. `wandlock@240,96` needs 101 CONTINUOUS
        // published ticks and the block's own glide already spent 25 of
        // them inside the sixth press's settle window — so the wait sees 76.
        expect(waits).toHaveLength(1);
        expect(waits[0].openedAt).toBe(76);
        expect(waits[0].to - waits[0].from).toBe(160);
        expect(collects).toHaveLength(1);
        expect(collects[0].item ?? null).toBeNull();
        // The emitted tape is the committed fixture's length, less the
        // trailing rest the plan script adds.
        expect(tape.tick_count).toBe(2231);
    });

    /**
     * ⛔⛔ THE PARKED-SCANNER AUDIT, in its cheap form: the run's OWN
     * answer at the end of the leg. The plan script does it tick by tick
     * off `createTapeStepper`; what has to hold in CI is the invariant
     * those 1,307 ticks exist to protect.
     */
    it('⛔⛔ …with the crusher still on `button@248,232` and never once touched', () => {
        // ⚠ FROM AN INDEPENDENT REPLAY OF THE EMITTED TAPE, not from the
        // driver's own running state — this suite's oldest rule, and the
        // ninth geometry family only became checkable this way in slice 16,
        // when `runTape` started forwarding the crushers at all.
        const run = runTape(parseTape(serializeTape(leg().tape)),
            { levelSource: atlasLevelSource() });
        expect([...run.crushers.values()][0]).toMatchObject({ ...PARKED_SCAN_AUDIT.park });
        expect(run.crushersParked).toBe(true);
        expect(run.crusherContacts).toEqual([]);
        expect([...run.openActivators].sort())
            .toEqual([L41_PART3.cover.id, L41_PART3.wandlock.id].sort());
        expect(PARKED_SCAN_AUDIT.movedTicks).toBe(0);
        expect(PARKED_SCAN_AUDIT.hotTicks).toBe(0);
    });
});

/**
 * ── ⛔⛔ R5 SLICE 16: L42, THE PURE CASE — DRIVEN AS FAR AS IT GOES ────
 *
 * The room has no activator, no presser and no pushable: one part, two
 * crushers, and a two-tile-tall corridor whose middle four tiles they fill.
 * `probe-seedling-r5-l42.mjs` carries the full measurement; what is pinned
 * here is the one thing that IS a driven choreography, because a number in
 * a docblock is a memory and this one has to stay true.
 */
describe('⛔⛔ L42: one choreography, THREE charges — and the room is a pursuit', () => {
    it('⛓⛓⛓ A\'s chain goes W then S then E in one bait, 208 px, zero contacts', () => {
        const chain = L42_PART4.chainA;
        const out = synthesizeLegs([{
            level: 42,
            targets: [{
                x: chain.stance.tx * 16 + 8,
                y: chain.stance.ty * 16 + 8,
                bait: {
                    crusher: { x: 96, y: 144 },
                    approach: chain.approach.map((sp) => ({ ...sp })),
                    spans: chain.spans.map((sp) => ({ ...sp })),
                    park: { ...chain.park },
                },
            }],
        }], {
            levelSource: atlasLevelSource(),
            boot: { level: 42, x: 240, y: 320 },
            relax: {
                noclip: false,
                noDamage: true,
                noHazards: [],
                grants: [{ level: 42, items: ['sword', 'fire', 'conch', 'feather'] }],
                persistence: [],
                equips: [],
                pins: ['sound', 'dead_frames'],
                roles: [...ROLES],
            },
            name: 'l42-chain',
            lattice: 8,
            allowGrazes: true,
            maxTicksPerTarget: 6000,
        });
        expect(out.baits).toHaveLength(1);
        expect(out.baits[0].crusherFrom).toEqual({ ...L42_PART4.crushers[0].home });
        expect(out.baits[0].crusherTo).toEqual({ ...chain.park });
        expect(out.baits[0].ticks).toBe(chain.ticks);
        // ⛓ FROM AN INDEPENDENT REPLAY. A choreography that is run over
        // completes exactly like one that works — `Bot.noDamage` is on —
        // so the contact count is the claim and the park alone is not.
        const run = runTape(parseTape(serializeTape(out.tape)),
            { levelSource: atlasLevelSource() });
        expect(run.crusherContacts).toEqual([]);
        expect([...run.crushers.values()].find((c) => c.id === L42_PART4.crushers[0].id))
            .toMatchObject({ ...chain.park });
        // ⛔ AND THE SECOND CRUSHER HAS NOT MOVED. It is invisible from
        // everywhere the arrival reaches — A shields its only reachable
        // lane — which is why the order is forced and not chosen.
        expect([...run.crushers.values()].find((c) => c.id === L42_PART4.crushers[1].id))
            .toMatchObject({ ...L42_PART4.crushers[1].home });
    });

    it('⚠ …and the room is NOT driven — the miss is named, not implied', () => {
        expect(L42_PART4.driven).toBe(false);
        expect(L42_PART4.miss).toMatch(/component result, not a choreography/);
        // The pure case, asserted against the level rather than remembered.
        const w = buildLevelWorld(atlasLevelSource()(42),
            { roles: ROLES, inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true } });
        expect(w.activators).toEqual([]);
        expect(w.pressers).toEqual([]);
        expect(w.pushables).toEqual([]);
        expect(w.crushers.map((c) => c.id)).toEqual(L42_PART4.crushers.map((c) => c.id));
    });
});

/**
 * ── ⛔⛔ R5 SLICE 16: L40 LINK 4, AND IT IS A FINDING RATHER THAN A ROUTE ─
 *
 * §28.9 named this the thing to price first and said what would follow if
 * it did not work out. It does not, three ways, and each way is asserted
 * against the level rather than remembered.
 */
describe('⛔⛔ L40 link 4: a plain button no block can reach and no boundary can carry', () => {
    const inv = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const w = () => buildLevelWorld(atlasLevelSource()(40), { roles: ROLES, inventory: inv });

    it('⛓⛓ the hold is 101 ticks EXACTLY, and both Locks write together', () => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 40, x: 480, y: 384 },
            inventory: inv,
            noDamage: true,
        });
        for (let i = 0; i < L40_LINK4.holdTicks; i += 1) run.advance(new Set());
        expect(run.lockWrites.map((wr) => wr.flag.tag).sort())
            .toEqual(L40_LINK4.opens.map((o) => o.tag).sort());
        expect(run.lockWrites.every((wr) => wr.t === L40_LINK4.holdTicks)).toBe(true);
        expect([...run.openActivators].sort())
            .toEqual(L40_LINK4.opens.map((o) => o.id).sort());
    });

    /**
     * ⛔⛔ THE ONE THAT DECIDES IT. `Lock.turnOff()` writing persistence
     * looks like a window-boundary answer — hold it in one window, boot the
     * next with the tags clear. `Lock.as:42` despawns on a cleared tag only
     * when `tSet < 0`, and these are group 2, so the cleared build is the
     * shut build.
     */
    it('⛔⛔ …and the write is INERT: a cleared {40,9}/{40,10} builds the same room', () => {
        const shut = w();
        const cleared = buildLevelWorld(atlasLevelSource()(40), {
            roles: ROLES, cleared: L40_LINK4.opens.map((o) => o.tag), inventory: inv,
        });
        expect(cleared.solids.length).toBe(shut.solids.length);
        expect(cleared.activators.map((a) => a.id).sort())
            .toEqual(shut.activators.map((a) => a.id).sort());
        expect(L40_LINK4.clearIsInert).toBe(true);
        // The reason, from the table rather than from the observation.
        expect(PERSISTENCE_RESPONSE.wandlock).toBe('lock-despawn');
        expect(L40_LINK4.opens.every((o) => o.tset >= 0)).toBe(true);
    });

    it('⛔ …and neither plain button is a tile any of the three blocks can be pushed to', () => {
        expect(w().pushables.map((p) => p.id).sort())
            .toEqual(L40_LINK4.pushReach.map((p) => p.id).sort());
        expect(L40_LINK4.pushReach.every((p) => !p.reachesAButton)).toBe(true);
        expect(L40_LINK4.verdict).toMatch(/UNOPENABLE BY THIS RUNG/);
    });
});

/**
 * ⛔⛔⛔ R5 SLICE 17 — the two findings, asserted against the level rather
 * than against their own prose.
 */
describe('⛔⛔ L40: the chain from the arrival is broken at link 4', () => {
    const inv = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

    it('⛓⛓ the two buttons the chain continues through are BOTH group 2\'s children', () => {
        const rec = atlasLevelSource()(40);
        const byTset = (t) => (rec.entities ?? [])
            .find((e) => e.type === 'button' && Number(e.attrs.tset) === t);
        for (const g of L40_ARRIVAL_BREAK.gatedButtons) {
            const e = byTset(g.tset);
            expect(`button@${e.x},${e.y}`).toBe(g.id);
        }
        // …and they are the links §24.5 numbers 5 and 6, so the tail hangs off them.
        expect(L40_ARRIVAL_BREAK.gatedButtons.map((g) => g.link)).toEqual([5, 6]);
        expect(L40_CHAIN.links.find((l) => l.n === 6).what).toMatch(/arms pulser@592,576/);
    });

    it('⛔⛔ …and link 4 is UNOPENABLE, so the break is a finding and not a route', () => {
        // The three refutations slice 16 measured, unchanged.
        expect(L40_LINK4.clearIsInert).toBe(true);
        expect(L40_LINK4.pushReach.every((p) => !p.reachesAButton)).toBe(true);
        expect(L40_LINK4.holdTicks).toBe(101);
        // …and what this slice adds: the necessity arm.
        expect(L40_ARRIVAL_BREAK.everyOtherActivator.gatedButtonsReached).toBe(false);
        expect(L40_ARRIVAL_BREAK.withLink4 - L40_ARRIVAL_BREAK.withoutLink4)
            .toBe(L40_ARRIVAL_BREAK.gain);
        expect(L40_ARRIVAL_BREAK.gain).toBe(L40_CHAIN.links.find((l) => l.n === 4).gains);
        expect(L40_ARRIVAL_BREAK.verdict).toMatch(/STOPS AT LINK 4/);
    });

    it('⛓ …and everything AFTER link 4 still closes, which is what makes it one break', () => {
        expect(L40_ARRIVAL_BREAK.pastLink4.keyReached).toBe(true);
        expect(L40_ARRIVAL_BREAK.pastLink4.l41Door).toBe(true);
        expect(L40_ARRIVAL_BREAK.pastLink4.l42Door).toBe(true);
        expect(L40_ARRIVAL_BREAK.pastLink4.nwCluster).toBe(true);
    });
});

describe('⛓⛓⛓ L42: the ordering that prices the RETURN parks both bodies in the top room', () => {
    const inv = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const world = buildLevelWorld(atlasLevelSource()(42), { roles: ROLES, inventory: inv });

    it('⛓ every park in the ordering is a position a charge actually stops at', () => {
        // A charge stops where the 32x32 body first overlaps a Solid, so a
        // park is a MEASUREMENT. Re-derived from the level's own static
        // solids, with the other crusher wherever the ordering has left it.
        const statics = world.solids.filter((s) => !s.crusherId).map((s) => s.rect);
        const cfg = Object.fromEntries(L42_PART4.crushers.map((c) => [c.id, { ...c.home }]));
        const hit = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        for (const step of L42_SOLVE.ordering) {
            const other = L42_SOLVE.ordering.map((s) => s.id).find((i) => i !== step.id);
            const blockers = [...statics, {
                x: cfg[other].x - 16, y: cfg[other].y - 16,
                right: cfg[other].x + 16, bottom: cfg[other].y + 16,
            }];
            const d = { E: [1, 0], N: [0, -1], W: [-1, 0], S: [0, 1] }[step.dir];
            let { x, y } = cfg[step.id];
            for (;;) {
                const p = { x: x + d[0] - 16, y: y + d[1] - 16 };
                const probe = { ...p, right: p.x + 32, bottom: p.y + 32 };
                if (blockers.some((s) => hit(probe, s))) break;
                x += d[0]; y += d[1];
            }
            expect({ x, y }).toEqual({ x: step.park.x, y: step.park.y });
            expect(Math.abs(x - cfg[step.id].x) + Math.abs(y - cfg[step.id].y)).toBe(step.travel);
            cfg[step.id] = { x, y };
        }
        // …and the ordering ends where the bank says it does.
        expect(cfg).toEqual({
            'crusher@96,144': { ...L42_SOLVE.parks['crusher@96,144'] },
            'crusher@128,144': { ...L42_SOLVE.parks['crusher@128,144'] },
        });
    });

    it('⛓⛓ the ordering is THREE chains — each one bait verb, each ending at REST', () => {
        const chains = [1, 2, 3].map((n) => L42_SOLVE.ordering.filter((s) => s.chain === n));
        expect(chains.map((c) => c.length)).toEqual([3, 3, 3]);
        // Each chain is ONE crusher: the escape from every charge lands in
        // the lane of the next, which is what makes it one verb (§30.8).
        for (const c of chains) expect(new Set(c.map((s) => s.id)).size).toBe(1);
        expect(chains.map((c) => c[0].id))
            .toEqual(['crusher@96,144', 'crusher@128,144', 'crusher@96,144']);
    });

    it('⛔⛔ the slice-16 ordering opens the part and SEALS the exit', () => {
        expect(L42_PART4.orderingSearched.length).toBe(6);
        expect(L42_SOLVE.bankedOrderingPriced.partReachable).toBe(true);
        expect(L42_SOLVE.bankedOrderingPriced.exitReachable).toBe(false);
        // …and the solution's own end state is the opposite on the second.
        expect(L42_SOLVE.solved.partReachable).toBe(true);
        expect(L42_SOLVE.solved.exitReachable).toBe(true);
    });

    it('⛓⛓⛓ the nook at (6,4) is a real, free, one-tile dead end', () => {
        const n = L42_SOLVE.nook;
        const box = playerBoxAt(n.tx * 16 + 8, n.ty * 16 + 8);
        const solidAt = (b) => world.solids.some((s) => rectsOverlap(b, s.rect));
        expect(solidAt(box)).toBe(false);
        // Its own four neighbours: only the one below it is open, which is
        // what "leads nowhere" means.
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !solidAt(
            playerBoxAt((n.tx + dx) * 16 + 8, (n.ty + dy) * 16 + 8),
        ));
        expect(open).toEqual([[0, 1]]);
    });
});

describe('⛔⛔⛔ L42: what the DRIVE said about the search, twice', () => {
    const inv = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const A = 'crusher@96,144';
    const runFrom = (boot, spans, settle = 0) => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(), boot, inventory: inv, noDamage: true,
        });
        for (const s of spans) {
            const keys = s.key ? new Set(s.key.split('+')) : new Set();
            for (let i = 0; i < s.ticks; i += 1) run.advance(keys);
        }
        for (let i = 0; i < settle; i += 1) run.advance(new Set());
        return run;
    };

    /**
     * ⛓⛓⛓ THE PESSIMISTIC ORDERING'S FIRST CHAIN, DRIVEN. Three charges in
     * one choreography, and the park is the one the SEARCH chose.
     */
    it('⛓⛓⛓ chain 1 walks A through three parks with zero contacts', () => {
        const run = runFrom({ level: 42, ...L42_SOLVE.chain1.boot },
            L42_SOLVE.chain1.spans, 200);
        expect(run.crusherContacts.length).toBe(L42_SOLVE.chain1.contacts);
        expect({ x: run.crushers.get(A).x, y: run.crushers.get(A).y })
            .toEqual({ ...L42_SOLVE.chain1.park });
        // …and the park survives the idle ticks after it: a park is a
        // position AND a live scanner (§29.8), so staying is its own claim.
        expect(run.crushersParked).toBe(true);
    });

    it('⛔⛔ …and finishes the player on the far side of the body it parked', () => {
        const run = runFrom({ level: 42, ...L42_SOLVE.chain1.boot },
            L42_SOLVE.chain1.spans, 200);
        const west = run.state.x < 112 || (run.state.y >= 240 && run.state.x < 208);
        expect(west).toBe(L42_SOLVE.chain1.endsInWestRegion);
        expect(west).toBe(false);
        // The part is west; A's rect plugs cols 11,12 of rows 13,14 and row
        // 14 is wall at cols 13,14, so there is no way back along the row.
        expect(L42_SOLVE.chain1.park.x).toBe(192);
        expect(L42_PART4.part.x).toBeLessThan(run.state.x);
        // ⛔ THIS CHAIN STAYS REFUTED EVEN THOUGH THE ROOM IS SOLVED. Slice
        // 17 pinned `driven === false` here as a marker for "the room is
        // not done yet", which is a claim about the SLICE and not about
        // this choreography — and slice 19 made it false. What is durable
        // is that `chain1` and `escape` realise the SAME three parks and
        // only one of them ends on the part's side of the body.
        expect(L42_SOLVE.chain1.park).toEqual({ ...L42_SOLVE.escape.park });
        expect(L42_SOLVE.chain1.endsInWestRegion).toBe(false);
        expect(L42_SOLVE.escape.endsInWestRegion).toBe(true);
    });

    /**
     * ⛔⛔⛔ AND THE PERMISSIVE READING IS REFUTED BY THE CLOCK, NOT BY THE
     * GEOMETRY. Its six-charge ordering is real on the map and its first
     * escape does not exist: the climb out of rows 9,10 is 35 px and the
     * body is 6 px away.
     */
    it('⛔⛔⛔ the permissive ordering\'s first escape is run over', () => {
        const run = runFrom({ level: 42, ...L42_SOLVE.chain1.boot },
            [{ key: 'up', ticks: 60 }]);
        expect(run.crusherContacts.length).toBe(L42_SOLVE.permissiveRefuted.drivenContacts);
        const travelled = (L42_SOLVE.chain1.boot.y + 8) - run.state.y;
        expect(Math.round(travelled)).toBe(L42_SOLVE.permissiveRefuted.drivenTravelPx);
        expect(travelled).toBeLessThan(L42_SOLVE.permissiveRefuted.needsPx);
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 18 — AND THE ESCAPE IS THERE. §31.6's negative was a
 * heuristic's negative, honestly bounded and wrongly explained: the same
 * three parks, from `L42_PART4.chainA`'s own hand-traced stance, end the
 * player in the col-6 shaft on the part's side of the room.
 */
describe('⛓⛓⛓ L42: the escape from A\'s east charge, and it ends WEST', () => {
    const E = L42_SOLVE.escape;
    const A = 'crusher@96,144';
    const B = 'crusher@128,144';
    const driveEscape = (settle) => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 42, ...E.boot },
            noDamage: true,
            roles: [...ROLES],
            grants: [{ level: 42, items: [...E.items] }],
        });
        for (const s of [...E.approach, ...E.spans]) {
            const keys = s.key ? new Set(s.key.split('+')) : new Set();
            for (let i = 0; i < s.ticks; i += 1) run.advance(keys);
        }
        const atEnd = { x: run.state.x, y: run.state.y };
        for (let i = 0; i < settle; i += 1) run.advance(new Set());
        return { run, atEnd };
    };

    it('⛓⛓⛓ drives A through the ordering\'s three parks with zero contacts', () => {
        const { run } = driveEscape(E.idleTicks);
        expect(run.crusherContacts.length).toBe(E.contacts);
        expect({ x: run.crushers.get(A).x, y: run.crushers.get(A).y }).toEqual({ ...E.park });
        // ⛓ B is never woken: the whole chain is one crusher's.
        expect({ x: run.crushers.get(B).x, y: run.crushers.get(B).y })
            .toEqual({ ...L42_PART4.crushers[1].home });
        expect(run.crushersParked).toBe(true);
        expect([...E.approach, ...E.spans].reduce((n, s) => n + s.ticks, 0)).toBe(E.ticks);
    });

    it('⛓⛓⛓ …and the player finishes WEST of the body — §31.6 closed', () => {
        const { run } = driveEscape(E.idleTicks);
        expect(run.state.x).toBeCloseTo(E.playerEndsAt.x, 9);
        expect(run.state.y).toBeCloseTo(E.playerEndsAt.y, 9);
        expect(Math.floor(run.state.x / 16)).toBe(E.endTile.tx);
        expect(Math.floor(run.state.y / 16)).toBe(E.endTile.ty);
        expect(playerBoxAt(run.state.x, run.state.y).right).toBeLessThan(E.westOf);
        expect(E.endsInWestRegion).toBe(true);
        // ⛔ The refuted chain ended EAST of the same body; the two are the
        // same ordering and different choreographies.
        expect(L42_SOLVE.chain1.endsInWestRegion).toBe(false);
    });

    /**
     * ⛓⛓ THE STANCE IS 0.09 px OUTSIDE A's NEW WEST LANE, and the run's own
     * scan is what says so — `crusherScans` is the scan the STEP takes, not
     * a second copy of the model (§30.6).
     */
    it('⛓⛓ holds through the idle tail — both scanners null, not one pixel moved', () => {
        const { run, atEnd } = driveEscape(E.idleTicks);
        expect(run.state.x).toBe(atEnd.x);
        expect(run.state.y).toBe(atEnd.y);
        for (const scan of run.crusherScans.values()) expect(scan.dir).toBeNull();
        expect(E.unseenAfterIdle).toBe(true);
        const laneLeft = E.park.x - 16 - 64;
        expect(playerBoxAt(run.state.x, run.state.y).right).toBeLessThan(laneLeft);
        expect(laneLeft - playerBoxAt(run.state.x, run.state.y).right).toBeLessThan(0.1);
    });

    /**
     * ⛓ THE STANCE BAND, DERIVED FROM THE TWO TRANSCRIPTIONS RATHER THAN
     * QUOTED. Its west edge is LAST-MATCH-WINS and not the room: one pixel
     * further west and `DIRECTIONS`' trailing S matches too.
     */
    it('⛓⛓ the band is 12 px wide, and its west edge is the south lane', () => {
        const body = crusherRect(E.chargeFrom);
        const lanes = Object.fromEntries(detectionRects(E.chargeFrom).map((r) => [r.dir, r]));
        const band = [];
        for (let x = E.col * 16; x < (E.col + 1) * 16; x += 1) {
            const box = playerBoxAt(x, body.bottom + 2);
            if (box.x < E.col * 16 || box.right > (E.col + 1) * 16) continue;
            if (!laneHitsPlayer(box, lanes.E)) continue;
            if (laneHitsPlayer(box, lanes.S)) continue;
            band.push({ x, margin: box.x - body.right });
        }
        expect(band[0]).toEqual({ x: E.band.x0, margin: E.band.margin0 });
        expect(band[band.length - 1]).toEqual({ x: E.band.x1, margin: E.band.margin1 });
        expect(band).toHaveLength(12);
        // ⛔ §31.6 wrote the band as [98,110]: `x = 98` puts box.x at exactly
        // 96 and the INCLUSIVE south lane takes it.
        const at98 = playerBoxAt(98, body.bottom + 2);
        expect(at98.x).toBe(body.right);
        expect(laneHitsPlayer(at98, lanes.S)).toBe(true);
    });

    /**
     * ⛓⛓ THE ONE-PIXEL SEAM THE WHOLE ESCAPE RIDES ON. `laneHitsPlayer` is
     * inclusive on all four edges (§29.5) and every other overlap in the
     * class is strict, so a box sitting exactly on the lane's southern edge
     * is SEEN from a cell the charging body passes one pixel above.
     */
    it('⛓⛓ the lane is inclusive where the body is strict', () => {
        const body = crusherRect(E.chargeFrom);
        const lanes = Object.fromEntries(detectionRects(E.chargeFrom).map((r) => [r.dir, r]));
        const box = playerBoxAt(E.stance.x, body.bottom + 2);
        expect(box.y).toBe(body.bottom);
        expect(laneHitsPlayer(box, lanes.E)).toBe(true);
        expect(box.y < body.bottom && box.bottom > body.y).toBe(false);
    });

    /**
     * ⛔ The three arms are a MEASUREMENT of the search, banked because
     * re-running them is six minutes (`probe-…-l42-escape.mjs --arms`).
     * What they say is that the finest one is the one that failed.
     */
    it('⛔⛔ banks that the COARSEST arm is the one that found it', () => {
        const byBlock = Object.fromEntries(L42_SOLVE.escapeArms.map((a) => [a.block, a]));
        // ⛔ The only arm that finds the escape is the one with the LARGEST
        // block — which is the refutation of §31.6's "a block search steps
        // over a 10 px window", stated as a comparison rather than a claim.
        const found = L42_SOLVE.escapeArms.filter((a) => a.found);
        expect(found).toHaveLength(1);
        expect(found[0].block).toBe(Math.max(...L42_SOLVE.escapeArms.map((a) => a.block)));
        // …and the band it had to hit is 12 px, wider than that block.
        expect(L42_SOLVE.escape.band.x1 - L42_SOLVE.escape.band.x0 + 1)
            .toBeGreaterThan(byBlock[8].block);
        expect(byBlock[4].confine).toBeNull();
        expect(byBlock[1].found).toBe(false);
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 18 — CHAIN 2, BEHIND THE PLANNER'S OWN WALK. §31.9 item 2
 * asked for the search to run behind the tape `synthesizeLegs` emits rather
 * than behind a boot at the stance tile; this is that, driven end to end
 * from the L42 arrival through the driver's own `bait` verb.
 */
describe('⛓⛓⛓ L42: two baits from the arrival, and the second is chain 2', () => {
    const C2 = L42_SOLVE.chain2;
    const E = L42_SOLVE.escape;
    const centre = (tx, ty) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });
    const baitOf = (crusher, chain, stance) => ({
        ...centre(stance.tx, stance.ty),
        bait: {
            crusher,
            approach: chain.approach.map((s) => ({ ...s })),
            spans: chain.spans.map((s) => ({ ...s })),
            park: { ...chain.park },
        },
    });
    const walk = (targets) => synthesizeLegs([{ level: 42, targets }], {
        levelSource: atlasLevelSource(),
        boot: { level: 42, x: L42_PART4.arrival.tx * 16, y: L42_PART4.arrival.ty * 16 },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 42, items: [...E.items] }],
            persistence: [],
            equips: [],
            pins: ['sound', 'dead_frames'],
            roles: [...ROLES],
        },
        name: 'l42-two-baits',
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 6000,
    });

    /**
     * ⛓⛓ `runBait`'s three controls are the claim, and they are the verb's
     * and not this test's: the crusher must be AWAKE after the approach
     * (a shielded one never moves), it must END somewhere else, and
     * `crusherContacts` may not grow — a choreography that is run over
     * completes exactly like one that worked.
     */
    it('⛓⛓⛓ walks A and then B to their parks, from the arrival, with zero contacts', () => {
        const out = walk([
            baitOf({ x: 96, y: 144 }, E, { tx: 4, ty: 11 }),
            baitOf({ x: 128, y: 144 }, C2, C2.stance),
        ]);
        expect(out.baits).toHaveLength(2);
        expect(out.baits[0].crusherTo).toEqual({ ...E.park });
        expect(out.baits[1].crusherTo).toEqual({ ...C2.park });
        expect(out.baits[0].ticks).toBe(E.ticks);
        expect(out.baits[1].ticks).toBe(C2.ticks);
        expect(out.tape.tick_count).toBe(C2.pairTicks);
    }, 120000);

    /**
     * ⛔ THE SPLIT IS MEASURED. Both approaches are seven ticks because both
     * stances sit one step outside the lane — §30.3's "the approach IS the
     * trigger" falling out of the search rather than being designed in.
     */
    it('⛓ both approaches are the walk INTO the lane, and both are seven ticks', () => {
        expect(E.approach.reduce((n, s) => n + s.ticks, 0)).toBe(7);
        expect(C2.approach.reduce((n, s) => n + s.ticks, 0)).toBe(7);
        expect([...C2.approach, ...C2.spans].reduce((n, s) => n + s.ticks, 0)).toBe(C2.ticks);
    });

    /** ⛓ Chain 2 is a whole chain in one bait: three parks, one verb. */
    it('⛓⛓ chain 2 is THREE charges in one bait, and the ordering says so', () => {
        expect(C2.charges).toEqual(['W', 'N', 'E']);
        const chain2 = L42_SOLVE.ordering.filter((s) => s.chain === 2);
        expect(chain2.map((s) => s.dir)).toEqual([...C2.charges]);
        expect(chain2[chain2.length - 1].park).toEqual({ ...C2.park });
        expect(chain2.every((s) => s.id === C2.crusher)).toBe(true);
    });
});

/**
 * ⛔⛔ AND CHAIN 3 IS NOT FOUND. Banked as a measurement with its death in
 * it, because "the search returned nothing" and "the room refuses it" print
 * the same thing otherwise.
 */
/**
 * ⛓⛓⛓ R5 SLICE 19 — CHAIN 3 IS FOUND, AND THE WALL IS WHAT FOUND IT.
 * §32.5 died at depth 43 with 90 of 90 successors run over because the nook
 * at tile (6,4) was a distance HINT; the same beam with the same block and
 * the same score, forbidden the rest of the top room while the crusher is
 * on row 96, finds it at depth 47.
 */
describe('⛓⛓⛓ L42: chain 3, and the nook as a WALL', () => {
    const C3 = L42_SOLVE.chain3;

    it('⛓⛓ is found, ends in the nook, and realises the ordering\'s third chain', () => {
        expect(C3.found).toBe(true);
        // ⛓⛓⛓ …and the room is DRIVEN AND RECORDED: five of five.
        expect(L42_SOLVE.driven).toBe(true);
        expect(C3.endTile).toEqual({ ...C3.nook });
        expect([...C3.approach, ...C3.spans].reduce((n, s) => n + s.ticks, 0)).toBe(C3.ticks);
        expect(C3.approach.reduce((n, s) => n + s.ticks, 0)).toBe(C3.approachTicks);
        const chain3 = L42_SOLVE.ordering.filter((s) => s.chain === 3);
        expect(chain3.map((s) => s.dir)).toEqual([...C3.charges]);
        expect(chain3[chain3.length - 1].park).toEqual({ ...C3.park });
        expect(chain3.every((s) => s.id === C3.crusher)).toBe(true);
    });

    /**
     * ⛔⛔ THE TRIPLE, AND ONLY THE CONSTRAINT MOVED. Same 8-tick blocks,
     * same arc-length score, same prefix — the arm that dies is the one
     * that only PREFERS the nook, and its death is RUN OVER rather than
     * exhausted or deduped, which is what says the room refused it.
     */
    it('⛔⛔ banks both arms — a hint dies run over, a wall finds it', () => {
        const [hint, wall] = L42_SOLVE.chain3Arms;
        expect(hint.found).toBe(false);
        expect(wall.found).toBe(true);
        expect(hint.confine).toBeNull();
        expect(wall.confine).not.toBeNull();
        // ⛓ The only difference between the arms is the constraint.
        expect(hint.block).toBe(wall.block);
        // ⛔ RUN OVER — a different failure from the 1-tick arm's dedup death.
        expect(hint.diedWith.runOver).toBeGreaterThan(0);
        expect(hint.diedWith.alreadySeen).toBe(0);
        expect(hint.diedWith.kept).toBe(0);
        // ⛓ And the wall is the same one chain 1's escape was found behind.
        expect(wall.confine.x1).toBe(L42_SOLVE.escape.col * 16 + 16);
        expect(wall.confine.x0).toBe(L42_SOLVE.escape.col * 16);
    });

    /**
     * ⛓⛓ THE NOOK IS THE ONLY FREE CELL IN ROW 4, and that is what makes
     * the confinement a wall rather than a preference: everything else an
     * eastward charge in the top room could reach is either the charge's
     * own swept volume or solid.
     */
    it('⛓⛓ the nook is the only free cell in its row', () => {
        const w = worldFor(42);
        const room = L42_SOLVE.topRoom;
        const freeIn = (ty) => {
            const out = [];
            for (let tx = room.tx0; tx <= room.tx1; tx += 1) {
                if (!plannerObstacleAt(w, tx * 16 + 8, ty * 16 + 8, null,
                    { inventory: HELD, avoidVolumes: false })) out.push(tx);
            }
            return out;
        };
        // ⛓ Row 4 over the top room's own span: the nook and nothing else.
        expect(freeIn(C3.nook.ty)).toEqual([C3.nook.tx]);
        // ⛓ …and the room below it is two tiles tall and open across.
        expect(freeIn(room.ty0)).toHaveLength(room.tx1 - room.tx0 + 1);
        expect(freeIn(room.ty1)).toHaveLength(room.tx1 - room.tx0 + 1);
        // ⛔ A `Crusher` is 32 px — exactly the two rows — so an eastward
        // charge in it has no lateral escape anywhere but the nook.
        expect((room.ty1 - room.ty0 + 1) * 16).toBe(32);
    });

    /**
     * ⛓⛓⛓ THE SEAM AGAIN, IN THE OTHER AXIS. A parked at (80,96) has body
     * `[64,96) x [80,112)` and east lane `[64,160] x [80,112]`; a player box
     * whose `bottom` is exactly 80 is INSIDE the lane and OUTSIDE the body,
     * so the charge is triggered from a cell the body passes one pixel
     * below. It is the same inclusive-vs-strict split chain 1 rides.
     */
    it('⛓⛓ a box on the lane\'s northern edge triggers east and is not swept', () => {
        const from = { x: 80, y: 96 };
        const body = crusherRect(from);
        const lanes = Object.fromEntries(detectionRects(from).map((r) => [r.dir, r]));
        // The northernmost stance that still triggers: box.bottom == body.y.
        const box = playerBoxAt(105, 77);
        expect(box.bottom).toBe(body.y);
        expect(laneHitsPlayer(box, lanes.E)).toBe(true);
        // ⛔ …and it is the ONLY lane that matches: `DIRECTIONS` has no
        // `break`, so a box also inside N/W/S would be charged at from
        // whichever matched LAST.
        expect(['N', 'W', 'S'].filter((d) => laneHitsPlayer(box, lanes[d]))).toEqual([]);
        // Strict overlap with the swept body: not touching.
        expect(box.bottom > body.y && box.y < body.bottom).toBe(false);
    });

    /**
     * ⛔⛔ THE RECORD'S `dir` IS THE NET DISPLACEMENT. `runBait` derives it
     * from `after - before`, which is the charge direction for ONE charge
     * and not for a chain: chain 3 goes W 112, N 128, E 128 and nets
     * (+16,-128), so the record says N while the last charge is E.
     */
    it('⛔ names the field whose value is not any charge', () => {
        expect(C3.recordDir).toBe('N');
        expect(C3.lastCharge).toBe('E');
        expect(C3.charges[C3.charges.length - 1]).toBe(C3.lastCharge);
        const from = L42_SOLVE.escape.park;
        const dx = C3.park.x - from.x;
        const dy = C3.park.y - from.y;
        expect(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'))
            .toBe(C3.recordDir);
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 19 — THE ROUND TRIP, DRIVEN. Three baits from the L42
 * arrival, the part collected and the exit taken; this is the plan
 * `r5-l42-part4` records, driven here through the driver rather than the
 * tape so the verbs' own controls run.
 */
describe('⛓⛓⛓ L42: the round trip — three chains, the part and the exit', () => {
    const centre = (tx, ty) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });
    const baitOf = (crusher, chain, stance) => ({
        ...centre(stance.tx, stance.ty),
        bait: {
            crusher,
            approach: chain.approach.map((s) => ({ ...s })),
            spans: chain.spans.map((s) => ({ ...s })),
            park: { ...chain.park },
        },
    });
    const walk = (legs) => synthesizeLegs(legs, {
        levelSource: atlasLevelSource(),
        boot: { level: 42, x: L42_PART4.arrival.tx * 16, y: L42_PART4.arrival.ty * 16 },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 42, items: [...L42_SOLVE.escape.items] }],
            persistence: [],
            equips: [],
            pins: ['sound', 'dead_frames'],
            roles: [...ROLES],
        },
        name: 'l42-round-trip',
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 6000,
    });

    it('⛓⛓⛓ walks all three chains from the arrival, both bodies into the top room', () => {
        const out = walk([{
            level: 42,
            targets: [
                baitOf({ x: 96, y: 144 }, L42_SOLVE.escape, L42_PART4.chainA.stance),
                baitOf({ x: 128, y: 144 }, L42_SOLVE.chain2, L42_SOLVE.chain2.stance),
                baitOf({ x: 96, y: 144 }, L42_SOLVE.chain3, L42_SOLVE.chain3.stance),
            ],
        }]);
        expect(out.baits).toHaveLength(3);
        expect(out.baits[2].crusherTo).toEqual({ ...L42_SOLVE.chain3.park });
        expect(out.baits[2].ticks).toBe(L42_SOLVE.chain3.ticks);
        expect(out.baits[2].approachTicks).toBe(L42_SOLVE.chain3.approachTicks);
        expect(out.tape.tick_count).toBe(L42_SOLVE.chain3.tripleTicks);
        // ⛔ The record's dir is the NET displacement, not the last charge.
        expect(out.baits[2].dir).toBe(L42_SOLVE.chain3.recordDir);
    }, 180000);

    /**
     * ⛓⛓ THE PARKS' WITNESS IS THE WALK. A crusher's position is in no
     * readout the game emits, so the claim is where the player may stand:
     * both dipsticks are inside a constructor body until its chain runs.
     */
    it('⛓⛓ both dipstick cells are inside a crusher body at build time', () => {
        for (const c of L42_PART4.crushers) {
            const r = crusherRect(c.home);
            const inside = L42_SOLVE.dipsticks
                .filter((d) => d.of === c.id)
                .every((d) => {
                    const box = playerBoxAt(d.tx * 16 + 8, d.ty * 16 + 8);
                    return box.x < r.right && box.right > r.x
                        && box.y < r.bottom && box.bottom > r.y;
                });
            expect(inside).toBe(true);
        }
        // ⛓ …and both are on the ONLY corridor to the part: rows 9,10.
        expect(L42_SOLVE.dipsticks.map((d) => d.ty)).toEqual([9, 9]);
    });

    /**
     * ⛓ THE COLLECT STANCE IS WEST OF THE PART BECAUSE THE PART'S OWN RECT
     * STRADDLES A COLUMN BOUNDARY, and col 12 of the chamber is inside A's
     * parked SOUTH lane. Touching the volume from the west happens at
     * `box.right == 184`, eight pixels short of it.
     */
    it('⛓⛓ the collect touches the part outside A\'s parked south lane', () => {
        const lanes = Object.fromEntries(
            detectionRects({ ...L42_SOLVE.parks['crusher@96,144'] }).map((r) => [r.dir, r]),
        );
        // The pickup's rect: `pickup('BossTotemPart', …, 16, 16, 8, 8)` at
        // entity (184+8, 152+8) — [184,200) x [152,168).
        const rect = { x: 184, right: 200, y: 152, bottom: 168 };
        expect(rect.right).toBeGreaterThan(lanes.S.x);
        // The touch from the west: box.right == rect.x.
        const touch = playerBoxAt(rect.x - 2, 160);
        expect(touch.right).toBe(rect.x);
        expect(laneHitsPlayer(touch, lanes.S)).toBe(false);
        expect(lanes.S.x - touch.right).toBe(8);
        // …and the stance itself is west of that again.
        expect(L42_SOLVE.collectStance.tx * 16 + 16).toBeLessThanOrEqual(rect.x);
    });

    /**
     * ⛔⛔ AND THE OBVIOUS CONTROL IS NOT A CONTROL — §29.7 one room along.
     * In a PURSUIT room every corridor cell is in somebody's lane, so an
     * unplanned walk is a trigger: emptying the charges' spans and keeping
     * the walks drives the very mechanism the arm exists to withhold.
     */
    it('⛔⛔ banks that the choreography-holed arm is run over 1,127 times', () => {
        const n = L42_SOLVE.naiveControlRefuted;
        expect(n.contacts).toBeGreaterThan(0);
        expect(n.collected).toBe(0);
        expect(n.transitions).toBe(0);
        // ⛓ Both crushers move, and NEITHER to a park.
        const parks = new Set(Object.values(L42_SOLVE.parks).map((p) => `${p.x},${p.y}`));
        expect(n.crushersEndAt).toHaveLength(2);
        for (const c of n.crushersEndAt) expect(parks.has(`${c.x},${c.y}`)).toBe(false);
        // ⛓ …and the room is a pursuit BECAUSE most of it is watched.
        expect(L42_SOLVE.arrival.safeNodes).toBeLessThan(L42_SOLVE.arrival.freeNodes);
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 19 — THE CORPSE-HOLD, PRICED AND NOT BUILT. The claims are
 * re-derived here from the SAME transcribed loop the probe steps, so the
 * banked record cannot drift from the source read that produced it.
 */
describe('⛓⛓⛓ L40: the corpse-hold, priced from the loop', () => {
    const T = 16;
    const sign = (n) => (n > 0 ? 1 : (n < 0 ? -1 : 0));
    const make = (x, y) => ({
        x, y, tile: { x: Math.floor(x / T), y: Math.floor(y / T) }, cTile: null, v: { x: 0, y: 0 },
    });
    const input = (c) => {
        c.cTile = { x: Math.round(c.x / T), y: Math.round(c.y / T) };
        c.v.x = 0.5 * sign(c.tile.x - c.cTile.x);
        if (c.v.x === 0) c.x = Math.floor(c.x / T) * T + T / 2;
        c.v.y = 0.5 * sign(c.tile.y - c.cTile.y);
        if (c.v.y === 0) c.y = Math.floor(c.y / T) * T + T / 2;
    };
    const step = (c) => { input(c); c.x += c.v.x; c.y += c.v.y; };
    const bump = (c, p) => {
        const tT = { x: Math.round(c.x / T), y: Math.round(c.y / T) };
        const a = Math.atan2(-(c.y - 8 + 8) + p.y, p.x - (c.x - 8 + 8));
        if (Math.abs(Math.sin(a)) - 0.1 < Math.abs(Math.cos(a))) {
            c.tile.x = Math.cos(a) > 0 ? tT.x - 1 : tT.x + 1;
        }
        if (Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) - 0.1) {
            c.tile.y = Math.sin(a) > 0 ? tT.y - 1 : tT.y + 1;
        }
    };

    it('⛓⛓⛓ the rest position is a TWO-CYCLE, and the ctor cell is not it', () => {
        const c = make(L40_CORPSE.spawn.x, L40_CORPSE.spawn.y);
        const seen = [];
        for (let i = 0; i < 12; i += 1) { step(c); seen.push(`${c.x},${c.y}`); }
        const cycle = [...new Set(seen.slice(4))];
        expect(cycle).toHaveLength(2);
        expect(new Set(cycle))
            .toEqual(new Set(L40_CORPSE.restCycle.map((p) => `${p.x},${p.y}`)));
        // ⛓ The ctor puts it on a tile CORNER; `input()` snaps to a CENTRE.
        expect(L40_CORPSE.spawn.y % T).toBe(0);
        expect(L40_CORPSE.restCycle.every((p) => p.y !== L40_CORPSE.spawn.y)).toBe(true);
    });

    /**
     * ⛔⛔⛔ WHICH PUSHES MOVE IT IS A PROPERTY OF THE TICK. `bump` reads
     * `Math.round(x / Tile.w)` and the body alternates half a pixel, so the
     * same press is a whole tile on one tick and nothing on the next.
     */
    it('⛔⛔⛔ the two phases of the cycle move OPPOSITE pairs of directions', () => {
        const PRESS = { N: { dx: 0, dy: 44 }, S: { dx: 0, dy: -44 }, W: { dx: 44, dy: 0 }, E: { dx: -44, dy: 0 } };
        for (const declared of L40_CORPSE.pushesByPhase) {
            const moved = [];
            for (const [dir, p] of Object.entries(PRESS)) {
                const c = make(L40_CORPSE.spawn.x, L40_CORPSE.spawn.y);
                for (let i = 0; i < 12 + declared.phase; i += 1) step(c);
                expect({ x: c.x, y: c.y }).toEqual({ ...declared.at });
                const before = { x: c.x, y: c.y };
                bump(c, { x: c.x + p.dx, y: c.y + p.dy });
                const axis = dir === 'N' || dir === 'S' ? 'y' : 'x';
                let arrived = null;
                for (let i = 0; i < 200; i += 1) {
                    step(c);
                    if (arrived === null && c.cTile[axis] === c.tile[axis]) arrived = i + 1;
                }
                const far = Math.abs(c.x - before.x) >= T || Math.abs(c.y - before.y) >= T;
                if (far) moved.push(dir);
                expect(arrived).toBe(far ? L40_CORPSE.arrivalObservedAt : L40_CORPSE.noOpTicks);
            }
            expect(moved.sort()).toEqual([...declared.moves].sort());
        }
        // ⛓ …and between them the two phases cover all four directions.
        expect(L40_CORPSE.pushesByPhase.flatMap((p) => [...p.moves]).sort())
            .toEqual(['E', 'N', 'S', 'W']);
    });

    it('⛓⛓ two northward presses put the 16x16 corpse over the button rect', () => {
        const c = make(L40_CORPSE.spawn.x, L40_CORPSE.spawn.y);
        for (let i = 0; i < 12; i += 1) step(c);
        let n = 0;
        let on = false;
        while (!on && n < 4) {
            let guard = 0;
            while (c.y !== Math.floor(c.y / T) * T + T / 2 - 0.5) {
                step(c);
                guard += 1;
                expect(guard).toBeLessThan(8);
            }
            bump(c, { x: c.x, y: c.y + 44 });
            for (let i = 0; i < 200; i += 1) step(c);
            n += 1;
            const box = { x: c.x - 8, right: c.x + 8, y: c.y - 8, bottom: c.y + 8 };
            on = box.x < L40_CORPSE.target.rect.right && box.right > L40_CORPSE.target.rect.x
                && box.y < L40_CORPSE.target.rect.bottom && box.bottom > L40_CORPSE.target.rect.y;
        }
        expect(n).toBe(L40_CORPSE.presses);
        expect({ x: c.x, y: c.y }).toEqual({ ...L40_CORPSE.corpseEndsAt });
    });

    /**
     * ⛔⛔ THE FREEZE GATE, CORRECTED. §32.6 item 5 read the `super.update()`
     * above `IceTurret`'s own gate and called the corpse ungated; the gate
     * is one level down, in `Mobile.mobileUpdate`.
     */
    it('⛔⛔ records that the MOTION is freeze-gated and the terrain path is not', () => {
        expect(L40_CORPSE.freeze.motionGated).toBe(true);
        expect(L40_CORPSE.freeze.gatedIn).toContain('Mobile.mobileUpdate');
        expect(L40_CORPSE.freeze.ungatedAbove).toContain('Enemy.update()');
        expect(L40_CORPSE.freeze.corrects).toBe('§32.6 item 5');
        // ⛓⛓⛓ AND IT IS WIRED AT SLICE 20 — the module, the roster, the
        // per-visit state and the step in the game's own slot. The record
        // said `wired: false` out loud for a slice; it says true now, and
        // `iceTurret.test.js` is what discharges it.
        expect(L40_CORPSE.wired).toBe(true);
        expect(L40_CORPSE.module).toMatch(/iceTurret\.js$/);
    });

    /**
     * ⛔⛔⛔ AND THE HEADLINE THIS BLOCK BANKED IS CORRECTED BY ITS OWN
     * BUILD. A press is FIVE bumps on five consecutive ticks, so whichever
     * phase the first lands on the second lands on the other.
     */
    it('⛔⛔⛔ the PARITY is not load-bearing once the press is five bumps', async () => {
        const { FIRE_WINDOW } = await import('./fireVerb.js');
        const { createIceTurret, killIceTurret, stepIceTurret, bumpIceTurret } =
            await import('./iceTurret.js');
        expect(L40_CORPSE.parityCorrection.loadBearing).toBe(false);
        expect(L40_CORPSE.parityCorrection.bumpsPerPress).toBe(FIRE_WINDOW.hitTicks.length);

        const run = (parity) => {
            const c = killIceTurret(createIceTurret(472, 400));
            // ⛓⛓ R5 SLICE 21: `startDeath` IS NOT `death()`. `killIceTurret`
            // sets `destroy` and nothing else now; the corpse is made by the
            // NEXT tick's `Mobile.death()`, and that tick moves nothing
            // (`mobileUpdate` gates its whole move block on `!destroy`). Spent
            // here so the parity index below still means what it meant when
            // slice 20 measured it — both banked resting positions are
            // unchanged, which is the point of spending it separately.
            stepIceTurret(c, {});
            for (let i = 0; i < 12 + parity; i += 1) stepIceTurret(c, {});
            for (let p = 0; p < L40_CORPSE.presses; p += 1) {
                const point = { x: c.x, y: c.y + 24 };            // stand SOUTH
                for (let k = 0; k <= FIRE_WINDOW.hitTicks[4]; k += 1) {
                    stepIceTurret(c, {});
                    if (FIRE_WINDOW.hitTicks.includes(k)) bumpIceTurret(c, point, 'Fire');
                }
                for (let i = 0; i < 40; i += 1) stepIceTurret(c, {});
            }
            return { x: c.x, y: c.y };
        };
        // BOTH parities land on the button, half a pixel apart — which is
        // the whole of what the parity is worth.
        for (const banked of L40_CORPSE.corpseEndsAtByParity) {
            expect(run(banked.parity)).toEqual({ x: banked.x, y: banked.y });
        }
        expect(L40_CORPSE.corpseEndsAt)
            .toEqual({ x: L40_CORPSE.corpseEndsAtByParity[0].x,
                y: L40_CORPSE.corpseEndsAtByParity[0].y });
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 19 — THE FIFTH CEREMONY, RECORDED. The numbers are the
 * game's, banked here so the arithmetic that makes them a claim cannot
 * drift from the record that carries them.
 */
describe('⛓⛓⛓ L42: the fifth ceremony, and the subtraction that carries a load', () => {
    const R = L42_SOLVE.recorded;

    it('⛓⛓⛓ is the fifth of five, byte-exact, with no re-records', () => {
        expect(R.ceremony).toBe(5);
        expect(R.of).toBe(5);
        expect(R.divergingTicks).toBe(0);
        expect(R.reRecords).toBe(0);
        expect(R.pair).toEqual(['r5-l42-part4', 'r5-l42-part4-control']);
    });

    /**
     * ⛔ UNLIKE L41's PAIR, THE FADE DOES NOT CANCEL. Both arms are the same
     * 1,920 ticks from the same boot, but the drive crosses into L40 and the
     * control never leaves L42 — so the difference is the freeze PLUS one
     * load, and the extra load is a BANDED quantity.
     */
    it('⛓⛓ the difference is the ceremony plus exactly one load\'s fade', () => {
        const diff = R.deadFrames.drive - R.deadFrames.control;
        const extraLoads = R.loads.drive - R.loads.control;
        expect(extraLoads).toBe(1);
        const residue = diff - R.ceremonyFrames;
        const band = fadeBand(extraLoads);
        expect(residue).toBeGreaterThanOrEqual(band.lo);
        expect(residue).toBeLessThanOrEqual(band.hi);
        // ⛓ Each arm's own residue lands in its own load count's band, too.
        const dBand = fadeBand(R.loads.drive);
        const dResidue = R.deadFrames.drive - R.ceremonyFrames;
        expect(dResidue).toBeGreaterThanOrEqual(dBand.lo);
        expect(dResidue).toBeLessThanOrEqual(dBand.hi);
        const cBand = fadeBand(R.loads.control);
        expect(R.deadFrames.control).toBeGreaterThanOrEqual(cBand.lo);
        expect(R.deadFrames.control).toBeLessThanOrEqual(cBand.hi);
    });

    it('⛓ the observation count is the tape\'s own tick_count + 1', () => {
        const tape = parseTape(JSON.parse(readFileSync(
            new URL('./fixtures/tapes/r5-l42-part4.json', import.meta.url), 'utf8',
        )));
        expect(R.observations).toBe(tape.tick_count + 1);
        // ⛓ …and both arms are the same length, which is what makes the
        // dead-frame difference a subtraction rather than a budget.
        const control = parseTape(JSON.parse(readFileSync(
            new URL('./fixtures/tapes/r5-l42-part4-control.json', import.meta.url), 'utf8',
        )));
        expect(control.tick_count).toBe(tape.tick_count);
        expect(control.boot).toEqual(tape.boot);
    });
});

/**
 * ⛔⛔⛔ L43 — THE WAND ROOM IS A ONE-WAY TRAP. R5 slice 20 step 0, the
 * `BossTotem` wake audit. `L43_BOSS_WAKE` is a table of tick numbers, so
 * every one of them is RE-DERIVED here rather than read back: the ramp by
 * re-stepping the transcribed loop, the freeze by `fallRock.js`' own
 * `fallRockFreezeTicks`, and the seal by a flood over the committed
 * `buildLevelWorld`.
 */
describe('L43 — the boss wake, and the escape south that does not exist', () => {
    const T = 16;
    const w43 = worldFor(43);
    const rec43 = source(43);
    const rockBox = (r) => {
        const ey = r.y + FALL_ROCK.box.dy;
        return {
            x: r.x, right: r.x + FALL_ROCK.box.w,
            y: ey - FALL_ROCK.box.originY, bottom: ey - FALL_ROCK.box.originY + FALL_ROCK.box.h,
        };
    };
    /** The 8 px lattice flood every R5 route plans at, with extra solids. */
    const flood = (start, extra = []) => {
        const P = 8;
        const hits = (b) => extra.some((r) => b.x < r.right && b.right > r.x
            && b.y < r.bottom && b.bottom > r.y);
        const ok = (x, y) => x > 0 && y > 0 && x < rec43.width * T && y < rec43.height * T
            && !w43.collidesSolid(playerBoxAt(x, y), {}) && !hits(playerBoxAt(x, y));
        const seen = new Set([`${start.x},${start.y}`]);
        const q = [[start.x, start.y]];
        while (q.length) {
            const [x, y] = q.shift();
            for (const [dx, dy] of [[P, 0], [-P, 0], [0, P], [0, -P]]) {
                const k = `${x + dx},${y + dy}`;
                if (seen.has(k) || !ok(x + dx, y + dy)) continue;
                seen.add(k);
                q.push([x + dx, y + dy]);
            }
        }
        return {
            cells: seen.size,
            tiles: new Set([...seen].map((k) => {
                const [a, b] = k.split(',').map(Number);
                return `${Math.floor(a / T)},${Math.floor(b / T)}`;
            })),
        };
    };

    it('⛓ the room holds exactly the three tset-0 fallrocks the Wand publishes to', () => {
        expect(w43.fallRocks).toHaveLength(L43_BOSS_WAKE.rocks.length);
        for (const banked of L43_BOSS_WAKE.rocks) {
            const live = w43.fallRocks.find((r) => r.id === banked.id);
            expect(live, `L43 must hold ${banked.id}`).toBeTruthy();
            // ⛓ `Wand.tset` is 0 and `Wand.removed()` sets `activate` on every
            // `Activators` whose `t` matches — one press, three drops.
            expect(live.t).toBe(0);
            expect(live.persistTag).toBe(banked.persistTag);
            const box = rockBox(live);
            expect(box.x / T).toBe(banked.tile.x);
            expect(box.y / T).toBe(banked.tile.y);
        }
    });

    /**
     * ⛔⛔⛔ THE HEADLINE. `ROLES`' own `BossTotem` row says the boss is
     * "escaped south during its 240-tick rumble". The rock the pickup drops
     * lands on the mouth of the only shaft the stairs are at the bottom of.
     */
    it('⛔⛔⛔ the south door is reachable before the drop and NOT after it', () => {
        const stairs = w43.teleporters.find((t) => t.isStairs);
        const stairsTile = `${stairs.x / T},${stairs.y / T}`;
        expect(stairsTile).toBe(L43_BOSS_WAKE.seal.stairsTile);
        const before = flood(L43_BOSS_WAKE.seal.from);
        const after = flood(L43_BOSS_WAKE.seal.from, w43.fallRocks.map(rockBox));
        expect(before.tiles.has(stairsTile)).toBe(true);
        expect(after.tiles.has(stairsTile)).toBe(false);
        expect(before.cells).toBe(L43_BOSS_WAKE.seal.cellsBefore);
        expect(after.cells).toBe(L43_BOSS_WAKE.seal.cellsAfter);
    });

    it('⛔⛔ and it is ONE rock — the other two seal the alcoves nothing needs', () => {
        const stairsTile = L43_BOSS_WAKE.seal.stairsTile;
        const blocker = w43.fallRocks.find((r) => r.id === L43_BOSS_WAKE.seal.blocker);
        expect(blocker).toBeTruthy();
        // Everything EXCEPT the blocker still reaches the stairs…
        const without = flood(L43_BOSS_WAKE.seal.from,
            w43.fallRocks.filter((r) => r !== blocker).map(rockBox));
        expect(without.tiles.has(stairsTile)).toBe(true);
        // …and the blocker ALONE does not.
        const alone = flood(L43_BOSS_WAKE.seal.from, [rockBox(blocker)]);
        expect(alone.tiles.has(stairsTile)).toBe(false);
    });

    /**
     * ⛓⛓ THE FREEZE, AGAINST THE MODULE THAT ALREADY OWNED THE ARITHMETIC.
     * `fallRockFreezeTicks` was written for L39's rope rock; it is an
     * independent stratum for this room's numbers because nothing about it
     * knows L43 exists.
     */
    it('⛓⛓ the freeze span is the EARLIEST rock\'s, and no rock is still falling then', () => {
        const spans = w43.fallRocks.map((r) => ({
            id: r.id, span: fallRockFreezeTicks(r.y + FALL_ROCK.box.dy),
        }));
        // release tick, counted from A (the tick after `Wand.removeSelf()`)
        const release = (s) => s.span.total - 1;
        const landing = (s) => s.span.wait + s.span.fall - 1;
        for (const banked of L43_BOSS_WAKE.rocks) {
            const s = spans.find((q) => q.id === banked.id);
            expect(release(s)).toBe(banked.releases);
            expect(landing(s)).toBe(banked.lands);
        }
        const earliest = Math.min(...spans.map(release));
        const lastLanding = Math.max(...spans.map(landing));
        expect(earliest).toBe(L43_BOSS_WAKE.ticks.freezeReleased);
        expect(earliest).toBe(L43_BOSS_WAKE.freeze.deadFrames);
        // ⛔ The overlap the brief flagged is real and harmless: the three
        // fall times differ by far less than the 91-tick hold after them.
        expect(lastLanding).toBeLessThan(earliest);
        expect(L43_BOSS_WAKE.freeze.noRockStillFallingAtRelease).toBe(true);
        expect(240 - earliest).toBe(L43_BOSS_WAKE.freeze.rumbleLeft);
    });

    /**
     * ⛓⛓⛓ THE RUMBLE CLOCK, RE-STEPPED. `rumblingTime` counts down inside
     * `if (activated)` with no freeze test; the sine-eased ramp starts at
     * 120 and the clamp is tested ABOVE the block that sets its flag, so
     * the onset is one tick later than `fullyActivated`.
     */
    it('⛓⛓⛓ the rumble clock is tick-exact: ramp 119, full 215, clamp 216', () => {
        let rumbling = 240;
        let stage = 0;
        let rampAt = null;
        let fullAt = null;
        let clampAt = null;
        for (let t = 0; t <= 400; t += 1) {
            // the clamp is read at the TOP of update(), before the flag is set
            if (fullAt !== null && clampAt === null) clampAt = t;
            if (rumbling > 0) rumbling -= 1;
            if (rumbling <= 120 && stage < 1) {
                if (rampAt === null) rampAt = t;
                const n = 8;
                stage += 0.02 * (n - 1) / n * Math.sin(stage * Math.PI) + 0.02 / n;
                if (stage >= 1) { stage = 1; fullAt = t; }
            }
        }
        expect(rampAt).toBe(L43_BOSS_WAKE.ticks.rampStarts);
        expect(fullAt).toBe(L43_BOSS_WAKE.ticks.fullyActivated);
        expect(clampAt).toBe(L43_BOSS_WAKE.ticks.clampOnset);
        expect(clampAt).toBe(fullAt + 1);
        // ⛓ 97 increments, and the count is the claim rather than the shape.
        let s = 0;
        let n = 0;
        while (s < 1) { s += 0.02 * 7 / 8 * Math.sin(s * Math.PI) + 0.0025; n += 1; }
        expect(n).toBe(L43_BOSS_WAKE.rampIncrements);
        expect(fullAt).toBe(rampAt + n - 1);
    });

    /**
     * ⛔⛔ THE SHOVE IS AN ASSIGNMENT, and its one number comes out of the
     * ctor's own `setHitbox(80, 32, 40, -12)`.
     */
    it('⛔⛔ the clamp line is `y - originY + height` = 212, and it is freeze-ungated', () => {
        const boss = w43.combat.enemies.find((e) => e.tag === 'bosstotem');
        expect(boss).toBeTruthy();
        expect(boss.y - (-12) + 32).toBe(L43_BOSS_WAKE.clamp.y);
        expect(L43_BOSS_WAKE.clamp.freezeGated).toBe(false);
        // ⛓ …and the body it is derived from spans the arena's five open
        // columns exactly, which is what shuts north BEFORE the wake too.
        const box = L43_BOSS_WAKE.boss.box;
        expect(box.x / T).toBe(L43_BOSS_WAKE.boss.spansCols[0]);
        expect(box.right / T - 1).toBe(L43_BOSS_WAKE.boss.spansCols[1]);
        // ⛔⛔ R5 SLICE 23: THE QUESTION HAS TO NAME WHICH BOSS IT MEANS.
        // Until this slice `bosstotem` was `collider: 'none'` and the query
        // below was about the TILES; now an unwoken boss is a Solid across
        // exactly these columns, so an unqualified `collidesSolid` answers
        // "wall" for all five and the assertion would be inverted for a
        // reason that is not the room's geometry.
        const woken = new Map([[`bosstotem@${boss.x},${boss.y}`, {
            id: `bosstotem@${boss.x},${boss.y}`, activated: true,
            fullyActivated: true, rect: null, clampY: L43_BOSS_WAKE.clamp.y,
        }]]);
        for (let col = box.x / T; col <= box.right / T - 1; col += 1) {
            // every column the body covers is open FLOOR in the arena…
            expect(w43.collidesSolid(playerBoxAt(col * T + 8, 196), { bosses: woken }))
                .toBeFalsy();
            // …and a WALL while the boss is unwoken, which is the same five
            // columns and the other half of why north is shut.
            expect(w43.collidesSolid(playerBoxAt(col * T + 8, 196), {})).toBeTruthy();
        }
        expect(w43.collidesSolid(playerBoxAt(box.x - 8, 196), { bosses: woken })).toBeTruthy();
        expect(w43.collidesSolid(playerBoxAt(box.right + 8, 196), { bosses: woken }))
            .toBeTruthy();
    });

    /**
     * ⛔⛔ THE NORTH DOOR, PRICED. The binding term is the FREEZE, not the
     * clamp: the player is dead for 185 ticks and clamped from 216.
     */
    it('⛔⛔ the north door is out of reach — 31 live ticks against 160 px', () => {
        const north = w43.teleporters.find((t) => !t.isStairs);
        expect(north.to).toBe(37);
        const free = L43_BOSS_WAKE.ticks.clampOnset - L43_BOSS_WAKE.ticks.freezeReleased;
        expect(free).toBe(L43_BOSS_WAKE.north.freeTicks);
        const needed = L43_BOSS_WAKE.seal.from.y - (north.y + 8);
        expect(needed).toBe(L43_BOSS_WAKE.north.neededPx);
        expect(free * L43_BOSS_WAKE.north.walkSpeed)
            .toBeCloseTo(L43_BOSS_WAKE.north.reachPx, 6);
        expect(free * L43_BOSS_WAKE.north.walkSpeed).toBeLessThan(needed);
        // ⛓ and the lock in front of it is a wand shot, not a key
        const lock = w43.objectSolids.find((s) => s.tag === 'magicallock');
        expect(`magicallock@${lock.x},${lock.y} {tag 4}`).toBe(L43_BOSS_WAKE.north.lock);
    });

    /**
     * ⛓⛓ THE UPDATE ORDER IS THE REVERSE OF THE LOADER, and it is the whole
     * reason the release tick is already a live tick for the tape and the
     * reason the camera contest is not a contest.
     */
    it('⛓⛓ the loader\'s add order decides both the camera and the first movable tick', () => {
        const L = L43_BOSS_WAKE.updateOrder;
        // reverse of the add lines is the update order
        const byAdd = [...L.order].sort((a, b) => L.addLines[b] - L.addLines[a]);
        expect(byAdd).toEqual(L.order);
        expect(L.addLines.player).toBeLessThan(L.addLines.bosstotem);
        expect(L.addLines.bosstotem).toBeLessThan(L.addLines.fallrock);
        // ⇒ the boss updates after the rocks, so it wins the camera…
        expect(L43_BOSS_WAKE.camera.winner).toBe('bosstotem');
        // …and the player updates after the boss, so the freeze release is live
        expect(L43_BOSS_WAKE.ticks.firstMovablePlayerTick)
            .toBe(L43_BOSS_WAKE.ticks.freezeReleased);
    });

    it('⛓ the window\'s earned ledger is FOUR writes — the wand\'s and one per rock', () => {
        const expected = ['43:0', ...w43.fallRocks.map((r) => `43:${r.persistTag}`)];
        expect(new Set(L43_BOSS_WAKE.earnedLedger)).toEqual(new Set(expected));
        expect(L43_BOSS_WAKE.earnedLedger).toHaveLength(4);
    });

    it('⛔ and the verdict is NO-GO for any window that leaves L43', () => {
        expect(L43_BOSS_WAKE.verdict.leaveL43).toBe('NO-GO');
        expect(L43_BOSS_WAKE.playerPositionRewrite).toEqual({ x: 144, y: 352 });
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 21 — THE REPAIR, AND THE TWO THINGS IT MOVED.
 *
 * Both records here are claims about the ROOM, so both are checked against
 * the committed atlas and the shipped geometry rather than against each
 * other. The tolerance correction is DRIVEN — the ±2 window is re-run on
 * the real flood and shown to disagree with the ±1 one — because "that
 * probe's window was too wide" is exactly the kind of statement that reads
 * as true and can be false.
 */
describe('⛓⛓⛓ L40: the break at link 4 is repaired', () => {
    it('⛓ the record names what it corrects, and the old verdict still says link 4', async () => {
        const { L40_ARRIVAL_BREAK, L40_LINK4_REPAIRED } = await import('./r5Totem.js');
        expect(L40_LINK4_REPAIRED.corrects).toMatch(/L40_ARRIVAL_BREAK\.verdict/);
        expect(L40_ARRIVAL_BREAK.verdict).toMatch(/STOPS AT LINK 4/);
        // ⛓ …and the clause that is still TRUE is the one about blocks.
        expect(L40_ARRIVAL_BREAK.verdict).toMatch(/no block in the level can reach/);
    });

    it('⛓⛓⛓ the kill stance is in the links-1-3 component — the walk does not need link 4', async () => {
        const { buildLevelWorld, ROLES } = await import('./levelWorld.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        const { nodeCentre, plannerObstacleAt } = await import('./botDriverV2.js');
        const { L40_CHAIN, L40_LINK4_REPAIRED } = await import('./r5Totem.js');
        const rec = atlasLevelSource()(40);
        const INV = { hasSword: true, canSwim: true, hasFeather: true, hasFire: true };
        const world = buildLevelWorld(rec, { roles: ROLES, inventory: INV, cleared: [0] });
        const L = L40_LINK4_REPAIRED.lattice;
        const opts = {
            inventory: INV,
            avoidVolumes: false,
            openChests: new Set(['chest@880,816']),
            openActivators: new Set(['wandlock@480,560']),
        };
        const free = (cx, cy) => {
            if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
            const c = nodeCentre(cx, cy, L);
            try { return plannerObstacleAt(world, c.x, c.y, null, opts) === null; } catch { return false; }
        };
        const seen = new Set();
        const fr = [];
        const from = L40_CHAIN.from;
        const sx = Math.floor(from.x / L);
        const sy = Math.floor(from.y / L);
        for (let dy = 0; dy <= 1; dy += 1) {
            for (let dx = 0; dx <= 1; dx += 1) {
                if (free(sx + dx, sy + dy)) { seen.add(`${sx + dx},${sy + dy}`); fr.push([sx + dx, sy + dy]); }
            }
        }
        while (fr.length > 0) {
            const [cx, cy] = fr.pop();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const k = `${cx + dx},${cy + dy}`;
                if (seen.has(k) || !free(cx + dx, cy + dy)) continue;
                seen.add(k); fr.push([cx + dx, cy + dy]);
            }
        }
        expect(seen.size).toBe(L40_LINK4_REPAIRED.cells.links13);
        const s = L40_LINK4_REPAIRED.killStance;
        expect(seen.has(`${Math.floor(s.x / L)},${Math.floor(s.y / L)}`)).toBe(true);
        expect(L40_LINK4_REPAIRED.killStanceInArrivalComponent).toBe(true);

        /**
         * ⛔⛔ AND THE ±2 WINDOW IS THE CORRECTION, DEMONSTRATED. Re-run on
         * THIS flood, the ancestor probe's tolerance answers REACHED for
         * `button@816,400` and the ±1 one does not — which is the whole of
         * the method finding, and it is checked rather than asserted in
         * prose. [[feedback_distance_hint_is_not_a_constraint]]
         */
        const win = (n, p) => {
            for (let dx = -1; dx <= n; dx += 1) {
                for (let dy = -1; dy <= n; dy += 1) {
                    if (seen.has(`${Math.floor(p.x / L) + dx},${Math.floor(p.y / L) + dy}`)) return true;
                }
            }
            return false;
        };
        const t4 = { x: 816, y: 400 };
        // Neither window reaches it from links 1-3 — the disagreement is in
        // the link-4 arm, and what THIS asserts is that the two windows are
        // genuinely different tests rather than the same one spelled twice.
        const stairs = { x: 320, y: 576 };
        expect(win(2, stairs)).toBe(true);
        expect(win(0, stairs)).toBe(false);
        expect(win(0, t4)).toBe(false);
        expect(L40_LINK4_REPAIRED.toleranceCorrection.was).toMatch(/±2 nodes/);
    });

    it('⛔⛔⛔ …and the chain now stops at link 5, with ONE holder for TWO holds', async () => {
        const { L40_LINK4_REPAIRED } = await import('./r5Totem.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        expect(L40_LINK4_REPAIRED.stopsAt.link).toBe(5);
        expect(L40_LINK4_REPAIRED.stopsAt.trap.cells).toBe(8);
        expect(L40_LINK4_REPAIRED.stopsAt.trap.reachesTheT5Button).toBe(false);
        // ⛔ ONE holder, read off the atlas rather than off the record.
        const turrets = atlasLevelSource()(40).entities.filter((e) => e.type === 'iceturret');
        expect(turrets).toHaveLength(L40_LINK4_REPAIRED.stopsAt.holders);
        expect(L40_LINK4_REPAIRED.stopsAt.dependency).toMatch(/re-shutting the locks/);
        // ⚠ …and the open question is RECORDED rather than answered.
        expect(L40_LINK4_REPAIRED.openQuestion).toMatch(/ANSWERED at slice 22/);
    });

    /**
     * ⛓⛓⛓ R5 SLICE 22 — AND THE PAIR IS BYTE-EXACT NOW, WHICH INVERTS THE
     * STRONGEST THING THIS BLOCK USED TO ASSERT.
     *
     * It used to check a NEGATIVE — that no fixture existed, because a
     * fixture whose model is wrong is either a permanent red or a silenced
     * one. The model is right, the two withdrawn recordings replay
     * byte-identical through it, and both arms were re-recorded. So the
     * check is the positive: the roster CARRIES both arms.
     */
    it('⛓⛓⛓ …and the pair is BYTE-EXACT — both arms are on the roster', async () => {
        const { L40_LINK4_REPAIRED } = await import('./r5Totem.js');
        const { ICE_TURRET_PLAN } = await import('./iceTurret.js');
        expect(L40_LINK4_REPAIRED.recorded.byteExact).toBe(true);
        expect(L40_LINK4_REPAIRED.recorded.fixturesWithdrawn).toBe(false);
        expect(ICE_TURRET_PLAN.blasts.modelled).toBe(true);
        // ⛔ THE CONTACT TICK IS NOT THE DIVERGENCE TICK, and the record
        // keeps both: 1614 is when the blast landed, 1616 is the first tick
        // the refusal was visible in the position stream.
        expect(L40_LINK4_REPAIRED.recorded.contactTick).toBe(1614);
        expect(L40_LINK4_REPAIRED.recorded.divergedAt)
            .toBe(ICE_TURRET_PLAN.blasts.divergence.tick);
        expect(L40_LINK4_REPAIRED.recorded.divergenceWasVisibilityNotContact).toBe(true);
        // …and the roster carries both arms, checked rather than described.
        const { fixtureNames } = await import('./fixtures/index.js');
        const names = fixtureNames();
        expect(names).toContain('r5-l40-part5');
        expect(names).toContain('r5-l40-part5-control');
    });

    /**
     * ⛔⛔⛔ AND THE OPEN QUESTION IS ANSWERED — the corpse cannot cross.
     */
    it('⛔⛔⛔ …and the corpse cannot make the 17½ tiles — `openQuestion` is NO', async () => {
        const { L40_LINK4_REPAIRED } = await import('./r5Totem.js');
        const R = L40_LINK4_REPAIRED.corpseReach;
        expect(R.reachesTheGoal).toBe(false);
        // ⛓ NOT VACUOUS: the body moves, it just does not get there. A
        // refusal from a search that could move nothing would be a claim
        // about the stance model, not about the room.
        expect(R.tiles).toBeGreaterThan(1);
        expect(R.eastMostColumn).toBeLessThan(R.goalTile.tx);
        expect(L40_LINK4_REPAIRED.openQuestion).toMatch(/ANSWERED at slice 22, and it is NO/);
        // ⛔ …and the holder census RAN, over every class rather than one.
        const C = L40_LINK4_REPAIRED.holderCensus;
        expect(C.holders).toBe(1);
        expect(C.holder).toBe('iceturret');
        expect(C.hitableClasses).toBeGreaterThan(10);
        expect(C.enemiesFailOn).toMatch(/staying/);
    });
});

/**
 * ⛔⛔⛔ AND THE WAND WINDOW IS BLOCKED ON A SAVE ARRAY, which is a
 * different kind of blocker from every other one this rung has met: not
 * geometry, not a policy, not an unmodelled mechanic — a piece of state the
 * tape format has no field for.
 */
/**
 * ⛓⛓⛓ R5 SLICE 22 — THE TERMINAL WAND WINDOW, PLANNED AGAINST THE MODEL.
 *
 * The ruling for this rung is that it records ONCE, as the tail of the
 * rung-closing chain. So this block asserts the SCHEDULE — derived from the
 * wake table and from `dialogue.js`, never restated — and nothing here
 * needs a tape.
 */
describe('⛓ L43: the terminal wand window, planned', () => {
    it('⛔⛔⛔ the boundary band is [A+217, A+334], and BOTH ends are derived', async () => {
        const { L43_WAND_WINDOW, L43_BOSS_WAKE } = await import('./r5Totem.js');
        const B = L43_WAND_WINDOW.boundaryBand;
        // ⛔ THE FLOOR IS THE CLAMP, not the freeze. `p.y := 212` is an
        // ASSIGNMENT at A+216, so a boundary before it lands inside a
        // displacement the window has not finished taking.
        expect(B.from).toBe(L43_BOSS_WAKE.ticks.clampOnset + 1);
        // ⛔ AND THE CEILING IS THE BOSS WALKING, not the first laser: the
        // moment it moves the room holds an unmodelled mover, which is a
        // harder stop than damage `noDamage` makes free.
        expect(B.to).toBe(L43_BOSS_WAKE.ticks.walkStarts - 1);
        expect(B.width).toBe(B.to - B.from + 1);
        // ⛓ …and it clears the two rules that were NOT binding, which is
        // what makes "the floor is the clamp" a finding rather than a guess.
        const lastFlag = Math.max(...L43_BOSS_WAKE.rocks.map((r) => r.lands));
        expect(B.from - lastFlag).toBeGreaterThanOrEqual(100);
        expect(B.from).toBeGreaterThan(L43_BOSS_WAKE.ticks.freezeReleased);
    });

    it('⛓⛓ the ceremony cost is DRIVEN through `stepDialogue`, not estimated', async () => {
        const { L43_WAND_WINDOW } = await import('./r5Totem.js');
        const { PICKUP_CEREMONY, beginDialogue, stepDialogue } = await import('./dialogue.js');
        // ⛔ THE WAND IS THE ONLY INPUT-BOUNDED CEREMONY IN R5, so its cost
        // is a function of the RELEASE CADENCE the tape picks — which no
        // other ceremony's is, and which is why it is driven here.
        const d = beginDialogue(PICKUP_CEREMONY.wand.text);
        expect(d.pages).toHaveLength(L43_WAND_WINDOW.ceremony.dialoguePages);
        let n = 0; let releases = 0;
        while (!d.done && n < 2000) {
            const released = n % 2 === 0;
            if (released) releases += 1;
            stepDialogue(d, released);
            n += 1;
        }
        expect(d.done).toBe(true);
        expect(d.frames).toBe(L43_WAND_WINDOW.ceremony.dialogueFramesAtTwoTickCadence);
        expect(releases).toBe(L43_WAND_WINDOW.ceremony.dialogueReleasesAtTwoTickCadence);
        // ⛓ AND A SLOWER CADENCE COSTS MORE, which is the half that makes
        // the number a CHOICE rather than a constant. `currentCharacter` is
        // set to `length - 1` rather than `length`, so a release that lands
        // too late has to be followed by another one.
        const slow = beginDialogue(PICKUP_CEREMONY.wand.text);
        let m = 0;
        while (!slow.done && m < 2000) { stepDialogue(slow, m % 8 === 0); m += 1; }
        expect(slow.frames).toBeGreaterThan(d.frames);
    });

    it('⛔ …and the window ARRIVES rather than boots, which its own gate forces', async () => {
        const { L43_WAND_WINDOW, L43_WAND_WINDOW_BLOCKED } = await import('./r5Totem.js');
        expect(L43_WAND_WINDOW.entry).toMatch(/ARRIVAL/);
        expect(L43_WAND_WINDOW.arrivalIsFallFromCeiling).toBe(true);
        // ⛓ TWO INDEPENDENT REASONS, and only ONE of them was retired.
        // ⛔ The boot could not arm `hasTotemPart[]` — R5 slice 23's v6
        // `save` block does — but the collect's own gate still excludes the
        // descent tick, so the ARRIVAL half of this record is untouched and
        // an arriving window would still have to land before it collects.
        expect(L43_WAND_WINDOW_BLOCKED.blocked).toBe(false);
        expect(L43_WAND_WINDOW_BLOCKED.retiredBy).toMatch(/slice 23/);
        expect(L43_WAND_WINDOW.arrivalGate).toMatch(/fallFromCeiling/);
        // ⛓ …and the window is DRIVEN now, from a boot rather than a pit.
        expect(L43_WAND_WINDOW.driven.pair)
            .toEqual(['r5-l43-wand', 'r5-l43-wand-control']);
        expect(L43_WAND_WINDOW.blockedOn).toBeNull();
        expect(L43_WAND_WINDOW.terminal).toBe(true);
        expect(L43_WAND_WINDOW.mustBeLastInTheItinerary).toBe(true);
    });

    it('⛓ the four earned writes are the wand\'s and one per rock — from the wake table',
        async () => {
            const { L43_WAND_WINDOW, L43_BOSS_WAKE } = await import('./r5Totem.js');
            expect(L43_WAND_WINDOW.earnedLedger).toEqual(L43_BOSS_WAKE.earnedLedger);
            // …and the count is the rocks' own, not a number typed twice.
            expect(L43_WAND_WINDOW.earnedLedger).toHaveLength(
                L43_BOSS_WAKE.rocks.length + 1);
        });
});

describe('⛔ L43: the terminal wand window cannot be booted', () => {
    it('⛔ the gate reads a save array `persistence` does not reach — and slice 23 '
        + 'reached it', async () => {
        const { L43_WAND_WINDOW_BLOCKED } = await import('./r5Totem.js');
        // ⛓ THE ANALYSIS SURVIVES THE RETIREMENT, which is why the record is
        // kept rather than deleted: `hasTotemPart[]` really IS a different
        // array from `levelPersistence`, and `wouldCost` named the exact
        // line that turned out to fix it.
        expect(L43_WAND_WINDOW_BLOCKED.state.isLevelPersistence).toBe(false);
        expect(L43_WAND_WINDOW_BLOCKED.state.count).toBe(5);
        expect(L43_WAND_WINDOW_BLOCKED.bootBlock.totemParts).toBe(null);
        expect(L43_WAND_WINDOW_BLOCKED.wouldCost).toMatch(/ONE boot field/);
        expect(L43_WAND_WINDOW_BLOCKED.blocked).toBe(false);
    });

    /**
     * ⛓ THE INDEPENDENT STRATUM: the tape format's OWN schema, not the
     * record's description of it. A field that quietly appeared would make
     * this record wrong, and the record cannot notice that about itself.
     */
    it('⛓⛓ …and `tapeFormat` HAS a field for it now — checked, not described',
        async () => {
        // ⛓ THE SAME STRATUM, INVERTED. Until slice 23 this test asserted
        // that no committed tape and no round trip through the parser could
        // carry a totem-part field, which was the record's blocking claim
        // measured against the artifact rather than described. The batch
        // added one, so the artifact is what says so.
        const { fixtureNames, loadTape } = await import('./fixtures/index.js');
        const { parseTape, serializeTape, SAVE_SLOTS } = await import('./tapeFormat.js');
        // ⛔ EVERY tape carries the block, because `parseTape` NORMALISES —
        // which is exactly why the AS3's version gate is value-scoped and
        // not presence-scoped.
        for (const n of fixtureNames()) {
            expect(loadTape(n).save).toBeTruthy();
        }
        // …and only a v6 tape may DECLARE anything in it.
        const declaring = fixtureNames().map(loadTape)
            .filter((t) => (t.save.totem_parts.length + t.save.keys.length
                + t.save.seal_parts.length) > 0);
        expect(declaring.length).toBeGreaterThan(0);
        for (const t of declaring) expect(t.tape_version).toBe(6);
        // ⛓ AND THE ROUND TRIP KEEPS IT, which is the half an artifact
        // cannot answer alone.
        const wand = loadTape('r5-l43-wand');
        expect(wand.save.totem_parts).toHaveLength(SAVE_SLOTS.totem_parts);
        expect(parseTape(serializeTape(wand)).save.totem_parts)
            .toEqual(wand.save.totem_parts);
        // ⛔ …and a v5 tape still carries an EMPTY one, so the pre-slice-23
        // fixtures are untouched on disk.
        const older = loadTape('r5-l40-part1');
        expect(older.save)
            .toEqual({ totem_parts: [], keys: [], seal_parts: [] });
        expect(JSON.parse(serializeTape(older))).not.toHaveProperty('save');
    });

    it('⛓ …and everything §34.3 measured for the ceremony is untouched', async () => {
        const { L43_BOSS_WAKE, L43_WAND_WINDOW_BLOCKED } = await import('./r5Totem.js');
        expect(L43_WAND_WINDOW_BLOCKED.tableStillHolds).toMatch(/L43_BOSS_WAKE/);
        // the two the window would have asserted, still banked and still undriven
        expect(L43_BOSS_WAKE.ticks.freezeReleased).toBe(185);
        expect(L43_BOSS_WAKE.ceremony.dialogueSegments).toBe(2);
    });
});
