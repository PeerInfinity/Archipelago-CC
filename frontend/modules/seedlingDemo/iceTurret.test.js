import { describe, it, expect } from 'vitest';
import {
    ICE_TURRET, ICE_TURRET_PLAN, IceTurretError, bumpIceTurret, createIceTurret,
    iceTurretMovableDirections, iceTurretPhase, iceTurretRect, iceTurretSettled,
    hitIceTurret, killIceTurret, stepIceTurret,
} from './iceTurret.js';
import { MOBILE_DEATH_FADE, PIT_FADE } from './enemyDamage.js';
import { FIRE_WINDOW } from './fireVerb.js';
import { L40_CORPSE } from './r5Totem.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const OEL = { x: 472, y: 400 };
const settled = (ticks = 12) => {
    const c = createIceTurret(OEL.x, OEL.y);
    killIceTurret(c);
    // ⛓⛓ R5 SLICE 21: `startDeath` IS NOT `death()`. `killIceTurret` now sets
    // only what `Enemy.startDeath` sets — `destroy` — and the corpse is made
    // by the NEXT tick's `Mobile.death()`, which is where the game makes it.
    // That tick moves NOTHING (`mobileUpdate` gates the whole move block on
    // `!destroy`), so it is spent here rather than counted into the settle
    // budget below, and every parity in this file is unchanged by the fix.
    stepIceTurret(c, {});
    if (!c.dead) throw new Error('the staging step did not produce a corpse');
    for (let i = 0; i < ticks; i += 1) stepIceTurret(c, {});
    return c;
};
/** One real fire press: five bumps on `FIRE_WINDOW.hitTicks`, then settle. */
const press = (c, point, { settle = 60 } = {}) => {
    for (let k = 0; k <= FIRE_WINDOW.hitTicks[FIRE_WINDOW.hitTicks.length - 1]; k += 1) {
        stepIceTurret(c, {});
        if (FIRE_WINDOW.hitTicks.includes(k)) bumpIceTurret(c, point, 'Fire');
    }
    for (let i = 0; i < settle; i += 1) stepIceTurret(c, {});
    return c;
};

describe('the constructor, and the box that is never where the .oel says', () => {
    it('⛔ `super(_x + Tile.w, _y + Tile.h)` adds a WHOLE tile, so the offset SURVIVES', () => {
        const c = createIceTurret(OEL.x, OEL.y);
        expect(c.x).toBe(OEL.x + 16);
        expect(c.y).toBe(OEL.y + 16);
        // ⛔⛔ AND L40's PLACEMENT IS NOT ON THE GRID. `x = 472` is 29.5
        // tiles, and adding a whole tile preserves that — so the entity
        // sits at a half-tile in x and a corner in y. Every other family's
        // ctor adds Tile.w/2 and lands on a centre; this one inherits
        // whatever the .oel author typed, which is what makes the two axes
        // of the rest cycle behave differently.
        expect(OEL.x % 16).toBe(8);
        expect(OEL.y % 16).toBe(0);
        expect(c.x % 16).toBe(8);
        expect(c.y % 16).toBe(0);
        expect(iceTurretRect(c)).toMatchObject({ x: 472, y: 400, right: 504, bottom: 432 });
    });

    it('⛓ `death()` shrinks the box to 16x16 centred on the entity', () => {
        const c = killIceTurret(createIceTurret(OEL.x, OEL.y));
        // ⛔⛔ R5 SLICE 21: THE KILLING BLOW IS NOT THE CORPSE. `startDeath`
        // sets `destroy` and nothing else; the box is still 32x32 and the
        // anim is still not "dead" until `Mobile.mobileUpdate` calls
        // `death()` — which is the NEXT tick, because the body's update for
        // this one has already run (it updates before the Player, so the hit
        // that killed it landed after its own turn).
        expect(c.dead).toBe(false);
        expect(c.destroy).toBe(true);
        expect(iceTurretRect(c)).toMatchObject({ x: 472, y: 400, right: 504, bottom: 432 });

        stepIceTurret(c, {});
        expect(c.dead).toBe(true);
        expect(iceTurretRect(c)).toMatchObject({ x: 480, y: 408, right: 496, bottom: 424 });
        // ⛔ `death()` puts `destroy` BACK to false — the corpse is not removed
        // and still answers `classCount(IceTurret)`, so a kill lock stays shut.
        expect(c.destroy).toBe(false);
        expect(c.removed).toBe(false);
        // ⛔⛔ AND THE STAGING TICK MOVES NOTHING. `mobileUpdate`'s whole
        // move block is inside `if (!destroy)`, and `destroy` was still true
        // when it ran — so `input()`'s 8 px snap does not happen either.
        expect({ x: c.x, y: c.y }).toEqual({ x: 488, y: 416 });
    });

    it('⛔ …and the ctor cell is NOT the resting cell — `input()` snaps it 8 px', () => {
        // ⚠ NOT "both axes move". The cycle returns ONE axis to the ctor
        // coordinate on each of its two ticks, which is exactly why the
        // resting position is a cycle and not a point — so the claim is
        // about the PAIR.
        for (const ticks of [12, 13]) {
            const c = settled(ticks);
            expect(`${c.x},${c.y}`).not.toBe(`${OEL.x + 16},${OEL.y + 16}`);
        }
        // ⛓ and the snap is 8 px: on each tick exactly one axis sits on
        // `floor(v/16)*16 + 8`, which the ctor corner never does.
        for (const ticks of [12, 13]) {
            const c = settled(ticks);
            const onSnap = [c.x, c.y].filter((v) => v === Math.floor(v / 16) * 16 + 8);
            expect(onSnap).toHaveLength(1);
        }
    });

    it('refuses a non-integer placement', () => {
        expect(() => createIceTurret(472.5, 400)).toThrow(IceTurretError);
    });
});

describe('the two-cycle, and the phase rule', () => {
    /**
     * ⛓⛓⛓ THE MEASUREMENT `L40_CORPSE` BANKED, now produced by the module
     * rather than by a probe's own stepped loop.
     */
    it('⛓⛓⛓ a standing corpse is a TWO-CYCLE and it is `L40_CORPSE.restCycle`', () => {
        const c = killIceTurret(createIceTurret(OEL.x, OEL.y));
        const seen = [];
        for (let i = 0; i < 12; i += 1) { stepIceTurret(c, {}); seen.push(`${c.x},${c.y}`); }
        const cycle = [...new Set(seen.slice(4))];
        expect(cycle).toHaveLength(2);
        expect(new Set(cycle))
            .toEqual(new Set(L40_CORPSE.restCycle.map((p) => `${p.x},${p.y}`)));
    });

    it('⛓⛓ an axis ON its snap centre is phase 0 and moves POSITIVE', () => {
        for (const ticks of [12, 13]) {
            const c = settled(ticks);
            const p = iceTurretPhase(c);
            const dirs = iceTurretMovableDirections(c);
            expect(dirs).toEqual([p.x ? 'W' : 'E', p.y ? 'N' : 'S']);
            // ⛓ The two axes of a body parked on a tile corner are in
            // OPPOSITE phases — each snap moves the other axis's reading.
            expect(p.x).not.toBe(p.y);
        }
    });
});

describe('`bump` — the gates, and the direction', () => {
    it('⛔ a live turret is undisplaceable: `bump` is gated on the "dead" anim', () => {
        const c = createIceTurret(OEL.x, OEL.y);
        for (let i = 0; i < 12; i += 1) stepIceTurret(c, {});
        const before = { x: c.x, y: c.y };
        const r = bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        expect(r.applied).toBe(false);
        expect(r.why).toMatch(/alive/);
        for (let i = 0; i < 60; i += 1) stepIceTurret(c, {});
        expect({ x: c.x, y: c.y }).toEqual(before);
    });

    it('⛔ and only Fire and Pulse reach it — a sword press is a no-op', () => {
        const c = settled();
        expect(bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Sword').applied).toBe(false);
        for (const t of ICE_TURRET.pushedBy) {
            expect(bumpIceTurret(settled(), { x: 488, y: 448 }, t).applied).toBe(true);
        }
    });

    it('⛓ the push is AWAY from the press point', () => {
        // press from the SOUTH -> the body targets NORTH
        const c = settled();
        const r = bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        expect(r.tile.y).toBeLessThan(Math.round(c.y / 16));
        // press from the WEST -> the body targets EAST
        const d = settled();
        const q = bumpIceTurret(d, { x: d.x - 24, y: d.y }, 'Fire');
        expect(q.tile.x).toBeGreaterThan(Math.round(d.x / 16) - 1);
    });

    it('refuses a press point that is not the player\'s entity position', () => {
        const c = settled();
        expect(() => bumpIceTurret(c, null, 'Fire')).toThrow(IceTurretError);
        expect(() => bumpIceTurret(c, { x: 1 }, 'Fire')).toThrow(IceTurretError);
    });
});

/**
 * ⛔⛔⛔ THE CORRECTION SLICE 20 IS FOR. §33.5 measured ONE bump and
 * concluded that a fire press's tick parity is load-bearing. A press is
 * FIVE bumps on five consecutive ticks, and the second one lands on the
 * phase the first one was refused by.
 */
describe('one press is FIVE bumps, and the parity stops mattering', () => {
    it('⛓ `FIRE_WINDOW.hitTicks` is the sequence, and the plan carries it', () => {
        expect(ICE_TURRET_PLAN.bumpsPerPress).toBe(FIRE_WINDOW.hitTicks.length);
        expect(ICE_TURRET_PLAN.bumpTicks).toEqual([...FIRE_WINDOW.hitTicks]);
    });

    it('⛓⛓⛓ all four cardinal pushes move a tile from BOTH parities', () => {
        const STANCES = { N: { dx: 0, dy: 24 }, S: { dx: 0, dy: -24 },
            W: { dx: 24, dy: 0 }, E: { dx: -24, dy: 0 } };
        for (const parity of [0, 1]) {
            for (const [dir, d] of Object.entries(STANCES)) {
                const c = settled(12 + parity);
                const from = { x: c.x, y: c.y };
                press(c, { x: c.x + d.dx, y: c.y + d.dy });
                const moved = Math.max(Math.abs(c.x - from.x), Math.abs(c.y - from.y));
                // ⚠ A tile MINUS the half-pixel the cycle owes — 16 is the
                // wrong threshold and 15.5 is a real net.
                expect(moved, `parity ${parity} push ${dir}`).toBeGreaterThanOrEqual(15);
            }
        }
        expect(ICE_TURRET_PLAN.parityIsLoadBearing).toBe(false);
    });

    it('⛔ and a SINGLE bump on the refusing phase moves half a pixel where a press moves a tile', () => {
        // Find the tick whose phase refuses NORTH — the module names it
        // rather than the test guessing, which is the point of the rule.
        const refusing = [12, 13].find((t) => !iceTurretMovableDirections(settled(t)).includes('N'));
        expect(refusing, 'exactly one of the two phases refuses north').toBeDefined();

        const one = settled(refusing);
        const fromOne = one.y;
        bumpIceTurret(one, { x: one.x, y: one.y + 24 }, 'Fire');   // push NORTH
        for (let i = 0; i < 60; i += 1) stepIceTurret(one, {});
        expect(Math.abs(one.y - fromOne)).toBeLessThan(1);

        // …and the five-bump press from the SAME rest tick moves a tile,
        // because bump 2 lands on the other phase.
        const five = settled(refusing);
        const fromFive = five.y;
        press(five, { x: five.x, y: five.y + 24 });
        expect(Math.abs(five.y - fromFive)).toBeGreaterThanOrEqual(15);
    });
});

describe('the four gates', () => {
    it('⛔ the motion is FREEZE-GATED — one level down, in `Mobile.mobileUpdate`', () => {
        const c = settled();
        bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        const at = { x: c.x, y: c.y };
        for (let i = 0; i < 40; i += 1) stepIceTurret(c, { frozen: true });
        expect({ x: c.x, y: c.y }).toEqual(at);
        for (let i = 0; i < 60; i += 1) stepIceTurret(c, {});
        expect(c.y).toBeLessThan(at.y);
    });

    it('⛔⛔ and off screen NOTHING runs — not the glide, not the terrain check', () => {
        expect(ICE_TURRET.activeOffScreen).toBe(false);
        const c = settled();
        bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        const at = { x: c.x, y: c.y };
        for (let i = 0; i < 40; i += 1) {
            stepIceTurret(c, { onScreen: false, terrainAt: () => ICE_TURRET.fatalTiles.lava });
        }
        expect({ x: c.x, y: c.y }).toEqual(at);
        expect(c.destroy).toBe(false);
    });

    /**
     * ⛔⛔ §32.6 item 2 is right about `input()`'s own check and it is NOT
     * the only fatal-terrain path: `Enemy.update`'s `getState()` switch is
     * unconditional and above every gate, so a corpse standing on lava dies
     * at REST. The brief's "price paths, not rest cells" is half the rule.
     */
    it('⛔⛔ a corpse on lava dies AT REST, not only mid-glide', () => {
        const c = settled();
        stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.lava });
        expect(c.destroy).toBe(true);
        // ⛔⛔⛔ R5 SLICE 21: AND `destroy` IS NOT REMOVAL. Slice 20 asserted
        // `removed` on this very tick. `Mobile.death()` is
        // `alpha -= 0.1; if (alpha <= 0) FP.world.remove(this)`, and
        // `Image.set alpha` CLAMPS — so it takes ELEVEN calls, ten of which
        // leave 1.39e-16. The corpse is still `type = "Solid"` for all of
        // them, which is eleven ticks of wall a route can be priced against.
        expect(c.removed).toBe(false);
        expect(c.solid).toBe(true);
        // fade calls 2 .. n-1: still a wall
        for (let i = 2; i < MOBILE_DEATH_FADE.ticks; i += 1) {
            stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.lava });
            expect(c.removed).toBe(false);
        }
        // …and the nth is the one that removes.
        stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.lava });
        expect(c.removed).toBe(true);
        expect(MOBILE_DEATH_FADE.ticks).toBe(11);
    });

    /**
     * ⛔⛔⛔ AND A LIVE TURRET ON LAVA BECOMES A CORPSE FIRST.
     *
     * `IceTurret.death()`'s gate is the ANIM, not `hits` — so the first
     * `destroy` is consumed exactly as a kill's would be, and the body dies
     * on the tick after. `dieInLava` is the base default and this class
     * clears only `dieInWater`, which is what lets the sequence start.
     */
    it('⛔ a LIVE turret on lava is intercepted into a corpse, then dies', () => {
        const c = createIceTurret(OEL.x, OEL.y);
        expect(c.dieInLava).toBe(true);
        expect(c.dieInWater).toBe(false);
        stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.lava });
        expect(c.dead).toBe(true);
        expect(c.destroy).toBe(false);
        expect(c.removed).toBe(false);
        for (let i = 0; i <= MOBILE_DEATH_FADE.ticks; i += 1) {
            stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.lava });
        }
        expect(c.removed).toBe(true);
    });

    /**
     * ⛓ AND WATER IS THE ONE THE `hits` GATE DECIDES. `IceTurret`'s ctor
     * writes `dieInWater = false` and `update()`'s FIRST line re-derives it
     * as `hits >= hitsMax` — so a live turret standing in water is fine and
     * a corpse in the same cell drowns.
     */
    it('⛓ water kills the CORPSE and spares the live body — `dieInWater = hits >= hitsMax`', () => {
        const live = createIceTurret(OEL.x, OEL.y);
        for (let i = 0; i < 20; i += 1) {
            stepIceTurret(live, { terrainAt: () => ICE_TURRET.fatalTiles.water });
        }
        expect(live.destroy).toBe(false);
        expect(live.dead).toBe(false);

        const corpse = settled();
        stepIceTurret(corpse, { terrainAt: () => ICE_TURRET.fatalTiles.water });
        expect(corpse.dieInWater).toBe(true);
        expect(corpse.destroy).toBe(true);
    });

    it('⛓ a pit takes it too, and the descent REPLACES the glide', () => {
        const c = settled();
        bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        const at = { x: c.x, y: c.y };
        stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.pit });
        expect(c.fallInPit).toBe(true);
        // it lerps toward the tile centre instead of gliding a full 0.5 px
        expect(Math.abs(c.y - at.y)).toBeLessThan(ICE_TURRET.moveSpeed);
        for (let i = 0; i < 40; i += 1) {
            stepIceTurret(c, { terrainAt: () => ICE_TURRET.fatalTiles.pit });
        }
        expect(c.removed).toBe(true);
    });

    it('⛓ the Solid flip is a LATCH, and the player standing on it holds it off', () => {
        const c = settled();
        expect(c.solid).toBe(true);          // nothing overlapping by default
        const d = killIceTurret(createIceTurret(OEL.x, OEL.y));
        let onIt = true;
        for (let i = 0; i < 4; i += 1) {
            stepIceTurret(d, { playerOverlaps: () => onIt });
            expect(d.solid).toBe(false);
        }
        onIt = false;
        stepIceTurret(d, { playerOverlaps: () => onIt });
        expect(d.solid).toBe(true);
        // …and it never goes back
        onIt = true;
        stepIceTurret(d, { playerOverlaps: () => onIt });
        expect(d.solid).toBe(true);
    });

    it('⛓ the player is in the corpse\'s own solids list, so it BLOCKS the glide', () => {
        expect(ICE_TURRET.corpseSolids).toContain('Player');
        expect(ICE_TURRET.corpseSolids).toContain('Enemy');
        expect(ICE_TURRET.solids).not.toContain('Player');
        const c = settled();
        bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        const at = { x: c.x, y: c.y };
        for (let i = 0; i < 60; i += 1) stepIceTurret(c, { blockedAt: () => true });
        expect({ x: c.x, y: c.y }).toEqual(at);
    });
});

/**
 * ⛔⛔⛔ THE MODEL CORRECTION THIS SLICE MADE, asserted against the level
 * rather than against the docblock: an ALIVE turret is not a solid, and the
 * corpse is one only through the run's own state.
 */
describe('L40 — the level agrees that an alive turret is not a wall', () => {
    const w = buildLevelWorld(atlasLevelSource()(40), {
        roles: ROLES, inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true },
    });

    it('⛓ the roster carries both points, and the id is the join', () => {
        expect(w.iceTurrets).toHaveLength(1);
        const [t] = w.iceTurrets;
        expect(t).toMatchObject({ id: 'iceturret@472,400', x: 472, y: 400, ex: 488, ey: 416 });
        expect(w.solids.some((s) => s.turretId === t.id)).toBe(true);
    });

    it('⛔⛔⛔ an alive turret blocks NOTHING — `type = "Solid"` is the dead arm', () => {
        // the cell the corpse will be pushed off, dead centre of the live body
        expect(w.collidesSolid(playerBoxAt(488, 424), {})).toBeFalsy();
        expect(w.collidesSolid(playerBoxAt(488, 424), { turrets: null })).toBeFalsy();
    });

    it('⛓⛓ …and the corpse blocks only when the RUN says it is standing', () => {
        const id = 'iceturret@472,400';
        const rect = { x: 480, y: 384, right: 496, bottom: 400 };
        const up = new Map([[id, { id, rect, solid: true }]]);
        const down = new Map([[id, { id, rect, solid: false }]]);
        expect(w.collidesSolid(playerBoxAt(488, 392), { turrets: up })).toBeTruthy();
        expect(w.collidesSolid(playerBoxAt(488, 392), { turrets: down })).toBeFalsy();
    });
});

describe('settling — and the two predicates that lie about it', () => {
    it('⛔ `tile == cTile` is FALSE half the time at rest, so it cannot be the test', () => {
        const c = settled();
        let disagreed = 0;
        for (let i = 0; i < 8; i += 1) {
            stepIceTurret(c, {});
            if (c.tile.x !== c.cTile.x || c.tile.y !== c.cTile.y) disagreed += 1;
        }
        // The body is parked and the round-based `cTile` still straddles the
        // boundary on alternate ticks.
        expect(disagreed).toBeGreaterThan(0);
        expect(iceTurretSettled(c)).toBe(true);
    });

    it('⛓ a settled body is where it was two ticks ago; a gliding one never is', () => {
        const c = settled();
        expect(iceTurretSettled(c)).toBe(true);
        bumpIceTurret(c, { x: c.x, y: c.y + 24 }, 'Fire');
        stepIceTurret(c, {});
        stepIceTurret(c, {});
        stepIceTurret(c, {});
        expect(iceTurretSettled(c)).toBe(false);
    });

    it('⛓ …and `waitAfterPressTicks` covers BOTH parities', () => {
        for (const parity of [0, 1]) {
            const c = settled(12 + parity);
            const point = { x: c.x, y: c.y + 24 };
            let settledAt = null;
            for (let k = 0; k <= ICE_TURRET_PLAN.waitAfterPressTicks; k += 1) {
                stepIceTurret(c, {});
                if (FIRE_WINDOW.hitTicks.includes(k)) bumpIceTurret(c, point, 'Fire');
                if (k > FIRE_WINDOW.lastHitTick && settledAt === null && iceTurretSettled(c)) {
                    settledAt = k;
                }
            }
            expect(settledAt).toBe(ICE_TURRET_PLAN.settledBy[`parity${parity}`]);
            expect(settledAt).toBeLessThanOrEqual(ICE_TURRET_PLAN.waitAfterPressTicks);
        }
    });
});

/**
 * ⛓⛓⛓ THE ARM, DRIVEN. `FIRE_ARM_POLICY.IceTurret` was `refused` until this
 * slice, so a fire press whose 32x32 rect touched the turret THREW one layer
 * below the verb. It is `modelled` now and `levelRun.applyFire` routes it to
 * `bumpIceTurret` — and the press is still inert against a LIVE body, which
 * is the arithmetic rather than the policy.
 */
describe('the fire arm, through `levelRun`', () => {
    const runAt = async (x, y) => {
        const { createLevelRun } = await import('./levelRun.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        return createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 40, x, y },
            noclip: false,
            noDamage: true,
            grants: [{ level: 40, items: ['sword', 'fire', 'conch', 'feather'] }],
        });
    };

    it('⛓⛓ a fire press beside the turret no longer throws — the arm is open', async () => {
        const { FIRE_ARM_POLICY } = await import('./presses.js');
        expect(FIRE_ARM_POLICY.IceTurret.policy).toBe('modelled');
        const run = await runAt(488, 448);
        expect(run.turrets.get('iceturret@472,400')).toBeTruthy();
        // The press itself: `applyFire`'s IceTurret arm runs and reports.
        expect(() => {
            run.equip?.(1);
            for (let i = 0; i < 20; i += 1) run.advance(new Set());
        }).not.toThrow();
    });

    it('⛔ …and it is INERT against a live body, by arithmetic not by policy', async () => {
        const run = await runAt(488, 448);
        const before = run.turrets.get('iceturret@472,400');
        expect(before.dead).toBe(false);
        expect(before.solid).toBe(false);
        // A live turret is not a Solid, so the cell it stands in is walkable
        // — which is the census correction this slice made, seen from the run.
        for (let i = 0; i < 20; i += 1) run.advance(new Set());
        const after = run.turrets.get('iceturret@472,400');
        expect(after.dead).toBe(false);
        expect(after.solid).toBe(false);
    });
});

/**
 * ⛓⛓ `fire.bumps` — THE FOURTH SHAPE OF A FIRE PRESS, and its refusals.
 *
 * ⛔⛔ THE LEG ITSELF CANNOT BE DRIVEN YET, and that is the slice's own
 * finding rather than an omission: the corpse has to be KILLED first and no
 * enemy in this model is killable by any weapon. `PRESS_ARM_POLICY.Enemy`
 * is `refused` ("a death moves totalEnemies(), which opens tSet == -1
 * locks") and only four sword/spear arms are modelled at all
 * (Tile, PushableBlockSpear, BreakableRock, LightPole). So what is
 * assertable here is every gate the verb puts in front of that — including
 * the one that says exactly why.
 */
describe('`fire.bumps` — the verb, and the gate that names the blocker', () => {
    const legs = async (fire, { roles = null, ...extra } = {}) => {
        const { synthesizeLegs } = await import('./botDriverV2.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        return synthesizeLegs([{
            level: 40,
            // ⛔ A BUMP STANCE IS ALWAYS INSIDE THE TURRET'S OWN HAZARD DISC,
            // and that is geometry rather than sloppiness: the fire rect is
            // 32x32 around the player and `attackRange` is 128, so every
            // stance that can reach the body is 96 px inside the volume the
            // route would otherwise avoid. The leg has to DECLARE it —
            // which is the right shape, because a live turret really does
            // shoot and the declaration is what a recording has to answer.
            contacts: ['proximity-hazard:iceturret@472,400'],
            targets: [{ x: 488, y: 448, equip: { slot: 1 } }, { x: 488, y: 448, fire }],
        }], {
            levelSource: atlasLevelSource(),
            boot: { level: 40, x: 488, y: 448 },
            relax: {
                noclip: false,
                noDamage: true,
                noHazards: [],
                grants: [{ level: 40, items: ['sword', 'fire', 'conch', 'feather'] }],
                equips: [],
                ...(roles ? { roles } : {}),
            },
            ...extra,
        });
    };
    const TO = { tx: 30, ty: 24 };
    const BUMP = { id: 'iceturret@472,400', to: TO };

    it('⛔⛔ refuses a LIVE turret, and names the kill it needs', async () => {
        await expect(legs({ bumps: [BUMP], enemyRoom: 'test' }))
            .rejects.toThrow(/is ALIVE.*undisplaceable.*Kill it first/s);
    });

    /**
     * ⛔⛔ THE ENEMY-ROOM REFUSAL, BOTH HALVES — because a corpse collides
     * with "Enemy" exactly as a pushable block does (`death()` runs
     * `solids.push("Enemy", "Player")`), so its glide corridor is
     * uncertifiable in a room with a wandering bob in it.
     */
    it('⛔⛔ refuses an ABSENT combat census — not an empty one', async () => {
        await expect(legs({ bumps: [BUMP] }))
            .rejects.toThrow(/NO COMBAT CENSUS.*absent census is not an empty one/s);
    });

    it('⛔ …and refuses the room itself once the census is there', async () => {
        await expect(legs({ bumps: [BUMP] }, { roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'] }))
            .rejects.toThrow(/other enem.*enemyRoom/s);
    });

    it('⛔ refuses a turret the level does not hold', async () => {
        await expect(legs({ bumps: [{ id: 'iceturret@0,0', to: TO }], enemyRoom: 'test' }))
            .rejects.toThrow(/holds no iceturret@0,0/);
    });

    it('⛔ refuses a malformed target and a `to` that is where it already is', async () => {
        await expect(legs({ bumps: [], enemyRoom: 'test' }))
            .rejects.toThrow(/non-empty array of \{id, to:\{tx,ty\}\}/);
        await expect(legs({ bumps: [{ id: 'iceturret@472,400' }], enemyRoom: 'test' }))
            .rejects.toThrow(/\{id, to:\{tx,ty\}\} with integer tiles/);
        // ⛓ ALREADY-THERE is a property of the PLAN, so it is checked
        // before the run-state refusals — which is what lets this assert it
        // at all while nothing can kill the turret.
        await expect(legs({ bumps: [{ id: 'iceturret@472,400', to: { tx: 30, ty: 26 } }],
            enemyRoom: 'test' })).rejects.toThrow(/is ALREADY on \(30,26\)/);
    });

    it('⛔ and a fire press still names EXACTLY ONE effect', async () => {
        await expect(legs({ bumps: [BUMP], burns: [{ x: 0, y: 0 }], enemyRoom: 'test' }))
            .rejects.toThrow(/EXACTLY ONE/);
    });
});
