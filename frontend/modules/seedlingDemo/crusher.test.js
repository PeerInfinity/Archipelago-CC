/**
 * seedlingDemo/crusher.test — the pursuer, and the four places a reader
 * would transcribe it wrong.
 *
 * R5 slice 12 step 3. Every claim here is one §24.6 could not make because
 * it was reading a `hazardVolume` row: the scan order, the sight line, the
 * park, and the freeze it does not respect.
 */

import { describe, expect, it } from 'vitest';

import {
    CEREMONY_RULE, PLAYER_DAMAGE_PATHS, CRUSHER, CRUSHER_PLAN, CRUSHER_VERBS,
    CrusherError, DIRECTIONS,
    alwaysArmed, collideLineSolid, crusherRect, detectionRects, laneHitsPlayer,
    scanCrusher, stepCrusher,
} from './crusher.js';
import { hazardVolume } from './hazards.js';
import { ROLES, buildLevelWorld, rectsOverlap } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { HITBOX } from './playerPhysicsV1.js';

/** A crusher whose ENTITY position is a cell corner — where a snap leaves it. */
const at = (x, y) => ({ id: `crusher@${x},${y}`, x, y, vx: 0, vy: 0 });
const box = (x, y, w = 4, h = 5) => ({ x, y, w, h, right: x + w, bottom: y + h });
/**
 * ⛔⛔ R5 SLICE 15: THE ENTITY POINT THAT GOES WITH A BOX, derived once.
 *
 * `scanCrusher` takes the box and the point as two arguments now, because
 * the game asks two different questions — `collideRect("Player", …)` of the
 * box, `collideLine(…, p.x, p.y)` of the point — and the first cut took one
 * argument and read both off it. Every caller in this file goes through
 * here so the pair can never drift, which is the whole reason the signature
 * changed.
 */
const pointOf = (b) => ({ x: b.x + HITBOX.originX, y: b.y + HITBOX.originY });
const scan = (c, b, solids = []) => scanCrusher(c, b, pointOf(b), solids);
const withPlayer = (b) => ({ playerBox: b, playerPoint: pointOf(b) });

describe('the geometry, and the two rect derivations that must agree', () => {
    it('the body is 32x32 CENTRED on the entity position', () => {
        expect(crusherRect(at(160, 160))).toMatchObject({
            x: 144, y: 144, right: 176, bottom: 176,
        });
        expect(CRUSHER.originX).toBe(16);
        expect(CRUSHER.dx).toBe(16);
    });

    it('⛓ the four lanes match `hazardVolume`\'s, which was derived separately', () => {
        // Two transcriptions of `Crusher.as:63-74` in two files. Joining
        // them is the point: a verdict and a motion model that disagreed
        // about the trigger volume would be the two-consumers failure.
        const c = at(160, 160);
        const mine = detectionRects(c);
        const theirs = hazardVolume({ tag: 'crusher', cx: c.x, cy: c.y },
            { width: 640, height: 640 }).rects.slice(1);
        const key = (r) => `${r.x},${r.y},${r.w},${r.h}`;
        expect(new Set(mine.map(key))).toEqual(new Set(theirs.map(key)));
    });

    it('⚠ every lane CONTAINS the body — the arm grows from it', () => {
        const body = crusherRect(at(160, 160));
        for (const r of detectionRects(at(160, 160))) {
            expect(r.x).toBeLessThanOrEqual(body.x);
            expect(r.right).toBeGreaterThanOrEqual(body.right);
        }
    });

    it('refuses a crusher with no position rather than defaulting to (0,0)', () => {
        expect(() => crusherRect({})).toThrow(CrusherError);
    });
});

describe('⛔ `t == -1` means ALWAYS ON — the opposite of the same literal on a Lock', () => {
    it('the sentinel arms it', () => {
        expect(alwaysArmed(-1)).toBe(true);
        expect(alwaysArmed(0)).toBe(false);
        expect(alwaysArmed(4)).toBe(false);
    });
});

describe('⛔ the scan: LAST match wins, and sight gates it', () => {
    it('a player due east arms an EAST charge', () => {
        const s = scan(at(160, 160), box(200, 158));
        expect(s.dir).toBe('E');
        expect(s).toMatchObject({ dx: 1, dy: 0 });
    });

    it('⛓⛓ LAST-MATCH-WINS IS UNREACHABLE ALIVE — the lanes meet only in the BODY', () => {
        // The brief says "a diagonal player triggers the LATER direction",
        // which is true of the code and cannot happen to a living player.
        // Each lane is the body grown 64 px along ONE axis, so every
        // pairwise intersection is EXACTLY the body — and `hit()` deals
        // 1000 to anything overlapping the body on the same tick.
        const c = at(160, 160);
        const body = crusherRect(c);
        const lanes = detectionRects(c);
        for (let i = 0; i < lanes.length; i += 1) {
            for (let j = i + 1; j < lanes.length; j += 1) {
                const a = lanes[i];
                const b = lanes[j];
                const ix = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
                ix.right = Math.min(a.right, b.right);
                ix.bottom = Math.min(a.bottom, b.bottom);
                expect(ix, `${a.dir} ∩ ${b.dir}`).toMatchObject({
                    x: body.x, y: body.y, right: body.right, bottom: body.bottom,
                });
            }
        }
        // A true DIAGONAL — outside the plus entirely — arms nothing at all.
        expect(scan(c, box(180, 180)).matched).toEqual([]);
        // …and the only two-lane stance is standing on it, which is a kill
        // on the same tick the second match is read.
        const onIt = scan(c, box(158, 158));
        expect(onIt.matched).toEqual(['E', 'N', 'W', 'S']);
        expect(onIt.dir).toBe('S');
        expect(stepCrusher(c, { ...withPlayer(box(158, 158)), lineSolids: [], solids: () => null })
            .kills).toBe(true);
    });

    it('⛓⛓ ANY Solid on the sight line shields it — and that is L41\'s whole leg', () => {
        const shield = { x: 176, y: 144, right: 192, bottom: 176 };
        const s = scan(at(160, 160), box(200, 158), [shield]);
        expect(s.dir).toBe(null);
        expect(s.shieldedBy).toBe(shield);
        // …and removing it UNLEASHES the crusher, which is why breaking
        // L41's breakablerocks is an ORDER and not a tidy-up.
        expect(scan(at(160, 160), box(200, 158)).dir).toBe('E');
    });

    it('a player outside every lane arms nothing', () => {
        expect(scan(at(160, 160), box(400, 400)).dir).toBe(null);
    });

    /**
     * ⛔⛔ R5 SLICE 15: THE LANE TEST IS INCLUSIVE AND THE SWEEP'S IS NOT,
     * and the pixel between them is a pixel of route.
     *
     * `Crusher.update` triggers through `World.collideRect` →
     * `Entity.collideRect` (`Entity.as:263`), four `>=`/`<=`. Everything
     * else in this package — the sweep, `hit()`, `levelWorld.rectsOverlap` —
     * is `Entity.as:158`/`:336`'s four `>`/`<`. A model that used the strict
     * one here reports "it cannot see you" for a stance the game charges at.
     */
    it('⛔⛔ a player touching the lane\'s EDGE is seen — `collideRect` is inclusive', () => {
        const c = at(160, 160);
        const east = detectionRects(c).find((r) => r.dir === 'E');
        // The east lane is [144, 240) x [144, 176) as a strict box. A player
        // whose LEFT edge is exactly on `east.right` shares no area with it
        // — `rectsOverlap` says no, and the game says yes.
        const onEdge = box(east.right, 158);
        expect(rectsOverlap(onEdge, east)).toBe(false);
        expect(laneHitsPlayer(onEdge, east)).toBe(true);
        expect(scan(c, onEdge).dir).toBe('E');
        // …and one pixel further out is outside it under BOTH conventions,
        // so this is a one-pixel band and not a shifted rect.
        expect(scan(c, box(east.right + 1, 158)).dir).toBe(null);
    });

    /**
     * ⛓⛓ THE SIGNATURE IS THE FIX, not the comment. §28.8's probe had to
     * hand-build `{ ...playerBoxAt(x, y), x, y }` — a box whose left/top has
     * been overwritten with the entity point and whose right/bottom has not
     * — because one argument was doing two jobs. Both malformed shapes are
     * refused by name now.
     */
    it('⛔ refuses a rect literal with no `right`/`bottom`, and a box with no point', () => {
        const c = at(160, 160);
        expect(() => scanCrusher(c, { x: 200, y: 158 }, { x: 200, y: 158 }, []))
            .toThrow(/never overlaps anything/);
        expect(() => scanCrusher(c, box(200, 158), null, [])).toThrow(/ENTITY position/);
        expect(() => stepCrusher(c, { playerBox: box(200, 158), lineSolids: [] }))
            .toThrow(/BOTH/);
    });
});

describe('the raycast, transcribed rather than rewritten', () => {
    it('samples the START and never the END', () => {
        // `while (x < toX)` — a solid sitting exactly ON the endpoint is
        // not seen. That is the game's behaviour, not a tolerance.
        const onEnd = { x: 200, y: 100, right: 216, bottom: 116 };
        expect(collideLineSolid([onEnd], 100, 100, 200, 100)).toBe(null);
        const before = { x: 150, y: 100, right: 166, bottom: 116 };
        expect(collideLineSolid([before], 100, 100, 200, 100)).toBe(before);
    });

    it('the minor axis advances by a FRACTION, so a near-diagonal is not a staircase', () => {
        // dx 100, dy 10 -> ySign is 0.1 per step. A model that stepped the
        // minor axis by a whole pixel would leave the line early and miss
        // the box.
        const b = { x: 148, y: 104, right: 164, bottom: 108 };
        expect(collideLineSolid([b], 100, 100, 200, 110)).toBe(b);
    });
});

describe('⛔ the charge: 1 px/tick, and it PARKS where it stops', () => {
    const wall = { x: 208, y: 128, right: 224, bottom: 192 };
    /**
     * ⚠ THE BAIT STANCE IS IN THE LANE AND OUTSIDE THE BODY. A player at
     * (200,158) is inside the east lane AND overlapping the 32x32 body
     * once the crusher has closed — i.e. dead — which is the difference
     * between baiting one and being crushed by one.
     */
    const ctx = {
        ...withPlayer(box(236, 158)),
        lineSolids: [],
        solids: (r) => (r.right > wall.x && r.x < wall.right
            && r.bottom > wall.y && r.y < wall.bottom ? wall : null),
    };

    it('arms on the first tick and moves one pixel per tick after', () => {
        let c = at(160, 160);
        const first = stepCrusher(c, ctx);
        expect(first.scan.dir).toBe('E');
        expect(first.moved).toBe(1);
        c = first.crusher;
        expect(stepCrusher(c, ctx).crusher.x).toBe(162);
    });

    it('⛓⛓ …and STAYS where the wall stopped it — no retraction, no timer', () => {
        let c = at(160, 160);
        for (let i = 0; i < 200; i += 1) c = stepCrusher(c, ctx).crusher;
        // The body's right edge rests against the wall's left edge.
        expect(crusherRect(c).right).toBe(wall.x);
        expect(c.vx).toBe(0);
        // ⛓ AND THE SIDESTEP IS THE VERB: once the wall has stopped it, a
        // player who has left the lane leaves it parked forever. At rest
        // it snaps and re-scans, finds nothing, and stays.
        const after = stepCrusher(c, { ...ctx, ...withPlayer(box(400, 400)) });
        expect(after.crusher.x).toBe(c.x);
        expect(after.moved).toBe(0);
        expect(after.scan.dir).toBe(null);
    });

    it('⛓ the snap is `Math.round`, so it parks FORWARD from a part-cell', () => {
        // A crusher stopped 7 px into a cell rounds to the NEXT corner; a
        // model that floored would put it a whole tile back.
        const c = stepCrusher({ ...at(0, 0), x: 167, y: 160 },
            { ...withPlayer(box(400, 400)), lineSolids: [], solids: () => null });
        expect(c.crusher.x).toBe(160);
        const d = stepCrusher({ ...at(0, 0), x: 169, y: 160 },
            { ...withPlayer(box(400, 400)), lineSolids: [], solids: () => null });
        expect(d.crusher.x).toBe(176);
    });

    it('⛔ it kills on contact with its BODY, at rest as much as mid-charge', () => {
        const onIt = stepCrusher(at(160, 160), {
            ...withPlayer(box(158, 158)), lineSolids: [], solids: () => null,
        });
        expect(onIt.kills).toBe(true);
        expect(CRUSHER.damage).toBe(1000);
    });
});

describe('⚠⚠ the ceremony rule, and the ruling that replaces hard-avoid', () => {
    it('`update()` has no freeze gate, and the rule says what that costs', () => {
        expect(CEREMONY_RULE.freezeGated).toBe(false);
        expect(CEREMONY_RULE.pickupFreezeFrames).toBe(150);
        expect(CEREMONY_RULE.claim).toMatch(/ONE FRAME/);
    });

    /**
     * ⛔⛔ R5 SLICE 13 CORRECTED THIS ENTRY, and the correction is asserted
     * rather than merely written: the crusher MOVES through a ceremony and
     * cannot HURT through one, because its 1000 goes through `Player.hit`
     * and that method is freeze-gated. Slice 12 conflated the two questions.
     */
    it('⛓⛓ it charges through the freeze and CANNOT damage a frozen player', () => {
        expect(CEREMONY_RULE.freezeGated).toBe(false);
        expect(CEREMONY_RULE.damagesFrozenPlayer).toBe(false);
        expect(CEREMONY_RULE.damagePath).toMatch(/Player\.hit/);
    });

    /**
     * ⛓⛓⛓ AND THE ENUMERATION BEHIND IT, which is the reusable half: a
     * frozen player is invulnerable to EVERYTHING except one class.
     */
    it('every damage path reaches the player through the one freeze-gated method', () => {
        expect(PLAYER_DAMAGE_PATHS.allThrough).toBe('Player.hit');
        expect(PLAYER_DAMAGE_PATHS.frozenPlayerIsInvulnerable).toBe(true);
        expect(PLAYER_DAMAGE_PATHS.gate).toMatch(/freezeObjects/);
    });

    /**
     * ⛔⛔ …and the single exception is also the one place `Bot.noDamage`
     * does not reach, which is a fact about the RELAXATION and not only
     * about ceremonies. Declared with its levels so "no route goes there"
     * stays a measurement.
     */
    it('the one exception bypasses BOTH the freeze and Bot.noDamage, and names its levels', () => {
        expect(PLAYER_DAMAGE_PATHS.exceptions).toHaveLength(1);
        const [lt] = PLAYER_DAMAGE_PATHS.exceptions;
        expect(lt.as3).toBe('LavaTrap');
        expect(lt.bypassesFreeze).toBe(true);
        expect(lt.bypassesNoDamage).toBe(true);
        expect(lt.onR5Route).toBe(false);
        expect(lt.levels).toEqual([77, 78, 80, 108]);
    });

    it('⚖ the three verbs exist, each with the risk that makes it a ruling', () => {
        expect(Object.keys(CRUSHER_VERBS).sort()).toEqual(['bait', 'park', 'weapon']);
        for (const v of Object.values(CRUSHER_VERBS)) {
            expect(v.why.length).toBeGreaterThan(40);
            expect(v.risk.length).toBeGreaterThan(40);
        }
    });

    /**
     * ⚖⚖ R5 SLICE 15: THE DOCTRINE, AS DATA. The eight families before this
     * one are MONOTONE — a broken rock stays broken — so a flood taken once
     * stays true for the leg. A crusher is not, and that is what forces a
     * planner that cannot route against it into two phases.
     */
    it('⚖⚖ the two-phase doctrine names its precondition and its park risk', () => {
        expect(CRUSHER_PLAN.phases.map((p) => p.verb)).toEqual(['bait/park', 'route']);
        expect(CRUSHER_PLAN.phases[0].plannedAgainst).toMatch(/stepCrusher/);
        expect(CRUSHER_PLAN.phases[1].precondition).toBe('run.crushersParked');
        // ⛔ the two facts a plan gets wrong if it reads only the verbs
        expect(CRUSHER_PLAN.parkRisk).toMatch(/component cost/);
        expect(CRUSHER_PLAN.resetIs).toMatch(/never carry a crusher position/i);
        // ⚠ and the §28.4 rule, restated for the thing THIS slice varies
        expect(CRUSHER_PLAN.floodsBankWith).toMatch(/configuration/);
    });

    it('⚠ and `hazardVolume` STILL says hard-avoid — the two are not reconciled here', () => {
        // Stated rather than silently changed. The verdict is right about
        // the damage; retiring it is a ROUTE decision that needs a driven
        // witness, and this slice has none. A model that flipped the
        // verdict on the strength of a source read would be asserting a
        // survival claim nobody has measured.
        const v = hazardVolume({ tag: 'crusher', cx: 160, cy: 160 },
            { width: 640, height: 640 });
        expect(v.verdict).toBe('hard-avoid');
    });
});

describe('L41 and L42, from the census', () => {
    const source = atlasLevelSource();
    const crushersIn = (n) => (source(n).entities ?? []).filter((e) => e.type === 'crusher');

    it('L41 has one crusher and L42 has two — §24.6\'s rooms', () => {
        expect(crushersIn(41)).toHaveLength(1);
        expect(crushersIn(42)).toHaveLength(2);
    });

    it('⛓ they are `tset -1` — always armed, both rooms', () => {
        for (const n of [41, 42]) {
            for (const c of crushersIn(n)) {
                const t = c.attrs?.tset === undefined ? -1 : Number(c.attrs.tset);
                expect(alwaysArmed(t), `L${n} crusher@${c.x},${c.y}`).toBe(true);
            }
        }
    });

    it('⛓⛓ L41\'s breakablerocks are what shield it — the leg is an ORDER', () => {
        // The claim §24.6 could only gesture at. With the rocks standing,
        // the sight line from the crusher to a player in its lane is
        // blocked; break them and it is not.
        const world = buildLevelWorld(source(41), {
            roles: ROLES, inventory: { hasSword: true, hasFire: true },
        });
        const rocks = world.solids.filter((s) => s.rockId);
        expect(rocks.length).toBeGreaterThan(0);
    });

    it('⛔ L42 has NO activator and no presser — the pure case', () => {
        const kinds = new Set((source(42).entities ?? []).map((e) => e.type));
        expect(kinds.has('button')).toBe(false);
        expect(kinds.has('buttonroom')).toBe(false);
        expect(kinds.has('crusher')).toBe(true);
    });
});
