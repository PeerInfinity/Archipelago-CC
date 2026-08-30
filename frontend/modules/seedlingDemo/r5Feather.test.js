/**
 * r5Feather — the declared half of the feather route, against the extract.
 *
 * The planner CONFIRMS these by synthesizing a walk, which takes half a
 * minute; these assert the same declarations in milliseconds, so a
 * coordinate that stops naming anything fails at the unit level instead of
 * a third of the way through a route that no longer exists.
 *
 * ⚠ AND ONE OF THEM IS A RETIREMENT. `SUPERSEDES` names §16.10's constant
 * and the two reasons it was wrong; the test that matters is the one that
 * asserts what §16.10 got RIGHT is still true, because a retirement that
 * threw out the surviving half would be the more expensive mistake.
 */

import { describe, expect, it } from 'vitest';

import {
    FEATHER, FEATHER_EARNED, FEATHER_FLIP, FEATHER_LADDER, FEATHER_UNCROSSED,
    FEATHER_WALK, L92_ROCKS, R5FeatherError, ROCK_OUT_OF_BAND_FLAG, SUPERSEDES,
    assertWalkDoors,
} from './r5Feather.js';
import { FEATHER_BLOCKER } from './r5Swim.js';
import { outOfBandFlagFor, rockBreaksUnder } from './breakableRocks.js';
import { atlasLevelSource } from './levelSource.js';
import { ADDED_TIME_REMOVAL, ROLES, TILE_SIZE, buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { HAZARD_STATES } from './tapeFormat.js';
import { LADDER } from './encounters.js';

const source = atlasLevelSource();
const held = { hasSword: true, canSwim: true };
const worldFor = (n) => buildLevelWorld(source(n), { roles: ROLES, inventory: held });

describe('the chain, door by door', () => {
    it('every leg\'s exit is a real teleporter that goes where the next leg is', () => {
        const hops = assertWalkDoors(worldFor);
        expect(hops.map((h) => `${h.from}->${h.to}`))
            .toEqual(['87->92', '92->91', '91->89']);
    });

    it('and the arrivals are where the route says', () => {
        const hops = assertWalkDoors(worldFor);
        expect(hops.map((h) => `${h.arrival.x},${h.arrival.y}`))
            .toEqual(['280,136', '248,72', '216,24']);
    });

    it('refuses a walk whose door does not exist', () => {
        expect(() => assertWalkDoors(() => ({ teleporters: [] })))
            .toThrow(R5FeatherError);
    });

    it('the boot is L87\'s L44 arrival, minus the ctor\'s +8', () => {
        const tel = worldFor(44).teleporters.find((t) => t.to === 87);
        expect(FEATHER_WALK.boot).toMatchObject({
            level: 87, x: tel.arrival.x - 8, y: tel.arrival.y - 8,
        });
    });

    it('⚠ and NEITHER grant names a level whose BUILD reads an item', () => {
        // §15.8: `added()` runs inside `new Game`, so a grant naming a level
        // whose geometry depends on the inventory lands too late. The only
        // modelled case is Karlore in L48, which this route does not enter —
        // asserted against the table rather than remembered.
        // ⚠ KEYED BY ENTITY TAG, NOT BY LEVEL. `ADDED_TIME_REMOVAL` names
        // classes (`karlore`), so the question is whether any level this
        // route BUILDS holds one — which is a query against the extract,
        // not a set difference over level numbers. (The first cut compared
        // level numbers against `Number('karlore')` and asserted nothing at
        // all.)
        const tags = Object.keys(ADDED_TIME_REMOVAL);
        expect(tags.length).toBeGreaterThan(0);
        const levels = new Set([
            ...FEATHER_WALK.legs.map((l) => l.level),
            ...FEATHER_WALK.grants.map((g) => g.level),
        ]);
        for (const level of levels) {
            const w = worldFor(level);
            const here = [...w.solids, ...w.pickups]
                .map((e) => e.tag).filter((t) => tags.includes(t));
            expect(here, `L${level}`).toEqual([]);
        }
        // ...and the check is not vacuous: the level the table IS about
        // fails it.
        const karlore = worldFor(48);
        expect(karlore.solids.some((e) => tags.includes(e.tag))).toBe(true);
    });
});

describe('the feather, and the pocket §16.10 got RIGHT', () => {
    it('is where the route says, with an 8x8 hitbox rather than a tile', () => {
        const w = worldFor(FEATHER.level);
        const f = w.pickups.find((p) => p.x === FEATHER.pickup.x && p.y === FEATHER.pickup.y);
        expect(f?.tag).toBe(FEATHER.item);
        // `setHitbox(8, 8, 4, 4)` on a body built at `(_x + 8, _y + 8)`.
        expect(f.rect).toMatchObject({ x: 164, y: 100, w: 8, h: 8 });
    });

    it('⛓ and the surviving half of §16.10 still holds: a waterfall ABOVE and BELOW', () => {
        // The retirement is of the ROUTE, not of the geometry. If this ever
        // went false the walk would not need to go the long way round, and
        // the whole shape of the route would be wrong for a reason nobody
        // had noticed.
        const w = worldFor(FEATHER.level);
        const typeAt = (tx, ty) => w.walkableTiles.find((t) => t.tx === tx && t.ty === ty)?.t;
        const { tx, ty } = FEATHER.tile;
        expect(typeAt(tx, ty)).toBe(HAZARD_STATES.water);
        expect(typeAt(tx, ty - 1)).toBe(HAZARD_STATES.waterfall);
        expect(typeAt(tx, ty + 1)).toBe(HAZARD_STATES.waterfall);
        expect(FEATHER.tile).toMatchObject(FEATHER_BLOCKER.tile);
    });

    it('the approach cell is the waterfall above, and the player fits in it', () => {
        const w = worldFor(FEATHER.level);
        expect(Math.floor(FEATHER.approach.x / TILE_SIZE)).toBe(FEATHER.tile.tx);
        expect(Math.floor(FEATHER.approach.y / TILE_SIZE)).toBe(FEATHER.tile.ty - 1);
        expect(w.collidesSolid(playerBoxAt(FEATHER.approach.x, FEATHER.approach.y))).toBeNull();
    });

    it('⛔ ...and the tile CENTRES east and west are solid, which is why', () => {
        const w = worldFor(FEATHER.level);
        const { tx, ty } = FEATHER.tile;
        for (const dx of [-1, 1]) {
            expect(w.collidesSolid(
                playerBoxAt((tx + dx) * TILE_SIZE + 8, ty * TILE_SIZE + 8),
            ), `tile (${tx + dx},${ty})`).not.toBeNull();
        }
    });
});

describe('⛔ the two rocks, and the order the route breaks them in', () => {
    it('both are real, breakable by this walk\'s weapon, and stood next to', () => {
        const w = worldFor(92);
        for (const r of L92_ROCKS) {
            const solid = w.solids.find((s) => s.rockId === `breakablerock@${r.rock.x},${r.rock.y}`);
            expect(solid, `${r.rock.x},${r.rock.y}`).toBeDefined();
            expect(rockBreaksUnder(solid.rockType, held)).toBe(true);
            expect(w.collidesSolid(playerBoxAt(r.stance.x, r.stance.y))).toBeNull();
        }
    });

    it('⛓ the ORDER is forced: the second stance is inside the first rock\'s shadow', () => {
        // The L87 door lands in a 14-cell pocket whose only neighbour is the
        // east rock. Asserted as a REACHABILITY question rather than as a
        // memory of the probe's numbers: with neither rock broken, the
        // second stance is not reachable from the arrival; with the first
        // one broken it is.
        const w = worldFor(92);
        const CELL = 8;
        const free = (cx, cy, ignore) => {
            if (cx < 0 || cy < 0 || cx >= w.width * 2 || cy >= w.height * 2) return false;
            const hit = w.collidesSolid(playerBoxAt(cx * CELL + CELL / 2, cy * CELL + CELL / 2));
            return hit === null || ignore.includes(hit.rockId);
        };
        const reaches = (ignore, to) => {
            const seen = new Set();
            const q = [[Math.floor(280 / CELL), Math.floor(136 / CELL)]];
            while (q.length > 0) {
                const [x, y] = q.pop();
                const k = `${x},${y}`;
                if (seen.has(k) || !free(x, y, ignore)) continue;
                seen.add(k);
                for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                    if (!seen.has(`${a},${b}`) && free(a, b, ignore)) q.push([a, b]);
                }
            }
            return seen.has(`${Math.floor(to.x / CELL)},${Math.floor(to.y / CELL)}`);
        };
        const first = `breakablerock@${L92_ROCKS[0].rock.x},${L92_ROCKS[0].rock.y}`;
        expect(reaches([], L92_ROCKS[1].stance)).toBe(false);
        expect(reaches([first], L92_ROCKS[1].stance)).toBe(true);
        // ...and the first stance needs neither, which is what makes it first.
        expect(reaches([], L92_ROCKS[0].stance)).toBe(true);
    });

    it('⛔ both `endAnim` writes land on ONE flag, in ANOTHER level', () => {
        const w = worldFor(92);
        const flags = new Set(L92_ROCKS.map((r) => {
            const solid = w.solids.find((s) => s.rockId === `breakablerock@${r.rock.x},${r.rock.y}`);
            const f = outOfBandFlagFor(92, solid.persistTag);
            return `${f.level}:${f.tag}`;
        }));
        expect([...flags]).toEqual([`${ROCK_OUT_OF_BAND_FLAG.level}:${ROCK_OUT_OF_BAND_FLAG.tag}`]);
        expect(ROCK_OUT_OF_BAND_FLAG.level).not.toBe(92);
    });
});

describe('the ledgers, and the ladder', () => {
    it('the earned set names BOTH ledgers, and they are different ones', () => {
        expect(FEATHER_EARNED.map((c) => c.from).sort()).toEqual(['collected', 'earnedClears']);
        expect(FEATHER_EARNED.find((c) => c.from === 'collected'))
            .toMatchObject({ level: FEATHER.level, tag: FEATHER.tag });
        expect(FEATHER_EARNED.find((c) => c.from === 'earnedClears'))
            .toMatchObject(ROCK_OUT_OF_BAND_FLAG);
    });

    it('every declared rung is on the ladder', () => {
        for (const v of FEATHER_LADDER) expect(LADDER).toContain(v.rung);
    });

    it('⚠ and the deferral is EXPLICIT — none of the six is a thread', () => {
        // The declaration is what a later rung reads to know what it owes.
        // A silent "0 threads" and a silent "6 threads" print the same
        // count, so the count is asserted from the rung.
        expect(FEATHER_LADDER.filter((v) => v.rung === 'wake-and-thread')).toEqual([]);
        expect(FEATHER_LADDER.length).toBe(6);
    });

    it('the crossed and uncrossed sets are disjoint, and every instance is real', () => {
        const key = (v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}`;
        const crossed = new Set(FEATHER_LADDER.map(key));
        for (const v of FEATHER_UNCROSSED) expect(crossed.has(key(v))).toBe(false);
        for (const v of [...FEATHER_LADDER, ...FEATHER_UNCROSSED]) {
            const w = worldFor(v.level);
            const all = [...w.combat.enemies, ...w.combat.hazards];
            expect(all.some((e) => e.tag === v.tag && e.x === v.at.x && e.y === v.at.y),
                key(v)).toBe(true);
        }
    });
});

describe('the flip window, declared before it is run', () => {
    it('retires the waterfall, justified by the item this walk earns', () => {
        expect(FEATHER_FLIP.noHazards).toEqual([]);
        expect(FEATHER_FLIP.justifiedBy).toBe(FEATHER.property);
        expect(FEATHER_WALK.noHazards).toEqual(['waterfall']);
    });

    it('and the tile it climbs is the waterfall the walk descended', () => {
        expect(FEATHER_FLIP.tile).toMatchObject({
            tx: FEATHER.tile.tx, ty: FEATHER.tile.ty - 1,
        });
    });
});

describe('what this route SUPERSEDES', () => {
    it('names the constant it retires, and it still exists', () => {
        expect(SUPERSEDES.constant).toBe('r5Swim.FEATHER_BLOCKER');
        expect(FEATHER_BLOCKER.level).toBe(FEATHER.level);
    });

    it('gives TWO reasons, because there were two', () => {
        expect(SUPERSEDES.reasons.length).toBe(2);
        expect(SUPERSEDES.reasons.join(' ')).toMatch(/lattice/);
        expect(SUPERSEDES.reasons.join(' ')).toMatch(/INDEX/);
    });
});
