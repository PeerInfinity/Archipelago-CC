/**
 * seedlingDemo/procgenPalette.test — EVERY TEMPLATE AGAINST A BUILT WORLD,
 * and the bindings that place them.
 *
 * PROCGEN PoC arc, slice 2. `procgenLevel.test.js`'s law, one layer up: a
 * template's claim about what it builds is only worth what the ENGINE says.
 * So each template is placed into a real room, the room is built with
 * `buildLevelWorld`, and the template is found by the ROSTER it is for — a
 * wall in `solids`, water in `lethalTerrainTiles`, a pit in `pitTiles`, an
 * arrow trap in `arrowTraps` with the `shootDefault` its attrs claim.
 *
 * ⚠ TRAP 199's LESSON IS THE STRUCTURE HERE: the roster assertions are built
 * FROM `PRE_SWORD_TEMPLATES`, so a template added to the palette without a
 * verification arrives as a FAILING test rather than as an uncounted row.
 */

import { describe, expect, it } from 'vitest';

import { ROLES, TILE_SIZE, buildLevelWorld } from './levelWorld.js';
import { arrowLaneForPlacement, arrowLaneRect, arrowTrapEntityPoint } from './arrowTrap.js';
import { ProcgenLevelError, terrainAt } from './procgenLevel.js';
import {
    EXCLUDED_TEMPLATES, PRE_SWORD_PALETTE, PRE_SWORD_TEMPLATES, ProcgenPaletteError,
    assertPalette,
} from './procgenPalette.js';
import { generateSeedlingLevel, seedlingModel, seedlingOracle } from './procgenSeedling.js';
import { rngFor } from './procgenRng.js';

const model = () => seedlingModel({ seed: 1 });
const worldFor = (record) => buildLevelWorld(record, { roles: ROLES });
const byName = (name) => PRE_SWORD_TEMPLATES.find((t) => t.name === name);

/** Place a template at a chosen anchor, ignoring the draw. */
const placedAt = (m, name, at) => m.place(m.skeleton(), byName(name), at);

describe('the palette itself is well formed', () => {
    it('passes its own structural assertion at load and on demand', () => {
        expect(assertPalette()).toBe(true);
    });

    it('refuses a template that writes outside its own footprint', () => {
        expect(() => assertPalette({
            name: 'bad',
            templates: [{
                name: 'x', family: 'x', footprint: [{ dx: 0, dy: 0 }],
                terrain: [{ dx: 5, dy: 5, terrain: 'wall' }],
            }],
        })).toThrow(ProcgenPaletteError);
    });

    it('refuses a duplicate name — the trace keys on it (trap 199)', () => {
        expect(() => assertPalette({
            name: 'dup', templates: [
                { name: 'x', family: 'a', footprint: [{ dx: 0, dy: 0 }] },
                { name: 'x', family: 'b', footprint: [{ dx: 0, dy: 0 }] },
            ],
        })).toThrow(/must be unique/);
    });

    it('every family in the roster is represented, and the count comes FROM the roster', () => {
        const families = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        // ⛓ PoC slice 3b added `weigh` — the palette's SECOND clearer family
        // and the first whose template places three cooperating entities.
        expect([...families].sort())
            .toEqual(['arrow-lane', 'pit', 'shove', 'wall', 'water', 'weigh']);
        expect(PRE_SWORD_PALETTE.templates).toBe(PRE_SWORD_TEMPLATES);
        expect(PRE_SWORD_PALETTE.items).toEqual({ hasSword: false, hasShield: false });
    });
});

describe('every template builds what it claims — asked of the BUILT WORLD', () => {
    it('wall-segment-h3 joins `solids` with the Stone tag, three cells of it', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'wall-segment-h3', { tx: 3, ty: 3 }));
        // ⚠ a solid's `x`/`y` are its CENTRE; `rect` is the cell.
        const placed = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.y === 3 * TILE_SIZE
            && s.rect.x >= 3 * TILE_SIZE && s.rect.x <= 5 * TILE_SIZE);
        expect(placed).toHaveLength(3);
    });

    it('wall-segment-v3 is the same segment on end', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'wall-segment-v3', { tx: 3, ty: 3 }));
        const placed = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.x === 3 * TILE_SIZE
            && s.rect.y >= 3 * TILE_SIZE && s.rect.y <= 5 * TILE_SIZE);
        expect(placed).toHaveLength(3);
    });

    it('water-pool-2x2 lands four cells in `lethalTerrainTiles` as tile type 1', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'water-pool-2x2', { tx: 3, ty: 3 }));
        const pool = world.lethalTerrainTiles.filter((t) => t.tx >= 3 && t.tx <= 4
            && t.ty >= 3 && t.ty <= 4);
        expect(pool).toHaveLength(4);
        expect(pool.every((t) => t.t === 1)).toBe(true);
    });

    it('pit-patch-2x1 lands two cells in `pitTiles` as tile type 6', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'pit-patch-2x1', { tx: 3, ty: 3 }));
        const pit = world.pitTiles.filter((t) => t.ty === 3 && t.tx >= 3 && t.tx <= 4);
        expect(pit).toHaveLength(2);
        expect(pit.every((t) => t.t === 6)).toBe(true);
    });

    it('arrow-lane joins `arrowTraps` with shootDefault TRUE — it fires from tick 0', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'arrow-lane', { tx: 3, ty: 3 }));
        expect(world.arrowTraps).toHaveLength(1);
        const trap = world.arrowTraps[0];
        expect(trap.shootDefault).toBe(true);
        expect(trap.t).toBe(0);
        // ⛓ the ENTITY POINT is the ctor's own (+8,+2) — never retyped here
        expect({ x: trap.ex, y: trap.ey })
            .toEqual(arrowTrapEntityPoint(3 * TILE_SIZE, 3 * TILE_SIZE));
    });

    it('the arrow lane has NO presser in this palette, so nothing can turn it off', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'arrow-lane', { tx: 3, ty: 3 }));
        expect(world.pressers).toEqual([]);
        expect(world.activators).toEqual([]);
    });

    /**
     * ⛓⛓ THE DOOR — slice 3's promotion, verified the same way as the other
     * five: what the template CLAIMS, asked of the built world.
     *
     * Two claims, and the second is the one that makes it a door rather than a
     * decoration: the wall's cells are Stone in `world.solids`, and the gap
     * holds a `pushableblock` in `world.pushables` — at the gap's own cell, so
     * the block really is standing in the one hole the wall leaves.
     */
    it('wall-gap-block-h walls the whole interior but one cell, and stands a block in it', () => {
        const m = model();
        const t = byName('wall-gap-block-h');
        const at = { tx: 1, ty: 4 };
        const world = worldFor(placedAt(m, 'wall-gap-block-h', at));
        const gapDx = t.entities[0].dx;

        // ⚠ SCOPED TO THE TEMPLATE'S OWN CELLS. The room's BORDER RING is
        // Stone too and sits on every row, so an unscoped filter counts the
        // two border columns and reports 9 where the template wrote 7 — a
        // count about the room, not about the template.
        const cols = new Set(t.terrain.map((c) => (at.tx + c.dx) * TILE_SIZE));
        const row = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.y === at.ty * TILE_SIZE && cols.has(s.rect.x));
        // The count comes FROM the template, never from a number typed here.
        expect(row).toHaveLength(t.terrain.length);
        // ⛔ and the gap is a HOLE in that row, not a cell the paint missed
        // elsewhere: no Stone stands at the gap column.
        expect(row.some((s) => s.rect.x === (at.tx + gapDx) * TILE_SIZE)).toBe(false);

        // ⚠ A `pushables` row carries the OEL POINT (`x`/`y`), not a `rect` —
        // unlike a `solids` row two assertions up, whose `x`/`y` are its
        // CENTRE. Two rosters, two conventions, and the id spells the point.
        expect(world.pushables).toHaveLength(1);
        const block = world.pushables[0];
        expect(block.tag).toBe('pushableblock');
        expect({ x: block.x, y: block.y })
            .toEqual({ x: (at.tx + gapDx) * TILE_SIZE, y: at.ty * TILE_SIZE });
        expect(block.id).toBe(`pushableblock@${block.x},${block.y}`);
    });

    it('wall-gap-block-v is the same door on end', () => {
        const m = model();
        const t = byName('wall-gap-block-v');
        const at = { tx: 4, ty: 1 };
        const world = worldFor(placedAt(m, 'wall-gap-block-v', at));
        const gapDy = t.entities[0].dy;
        const rows = new Set(t.terrain.map((c) => (at.ty + c.dy) * TILE_SIZE));
        const column = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.x === at.tx * TILE_SIZE && rows.has(s.rect.y));
        expect(column).toHaveLength(t.terrain.length);
        expect(column.some((s) => s.rect.y === (at.ty + gapDy) * TILE_SIZE)).toBe(false);
    });

    /**
     * ⛓⛓⛓ THE LOCKED DOOR — PoC slice 3b's promotion, verified the same way.
     *
     * Three claims, because it places three things and any two without the
     * third is a room with no answer (⚖ §1.2's atomic placement at its
     * fullest): the LOCK is in the wall's gap and in `world.activators`; the
     * BUTTON is in `world.pressers` and in the SAME tSet group; the BLOCK is
     * in `world.pushables` and shares the button's lane so a single lean
     * reaches it. The last one is the constraint `runShove` enforces — a lean
     * moves a block along ONE axis — and it is asserted here rather than
     * trusted, because a template whose block and button shared neither
     * coordinate would be L16's shape, which needs a chain nobody has ruled on.
     */
    for (const [name, at, axis] of [
        ['wall-gap-lock-weigh-h', { tx: 1, ty: 4 }, 'row'],
        ['wall-gap-lock-weigh-v', { tx: 4, ty: 1 }, 'column'],
    ]) {
        it(`${name} stands a lock in the gap and a block that can reach its button`, () => {
            const m = model();
            const t = byName(name);
            const world = worldFor(placedAt(m, name, at));
            const entityAt = (type) => {
                const e = t.entities.find((x) => x.type === type);
                return { tx: at.tx + e.dx, ty: at.ty + e.dy };
            };

            // ── the LOCK, in the gap the wall leaves ──────────────────
            const lockCell = entityAt('lock');
            expect(world.activators).toHaveLength(1);
            const lock = world.activators[0];
            expect(lock.tag).toBe('lock');
            expect(lock.id).toBe(`lock@${lockCell.tx * TILE_SIZE},${lockCell.ty * TILE_SIZE}`);
            // ⛔ and it really is in a HOLE: the template paints no wall there.
            expect(t.terrain.some((c) => at.tx + c.dx === lockCell.tx
                && at.ty + c.dy === lockCell.ty)).toBe(false);

            // ── the BUTTON, publishing the lock's OWN group ───────────
            expect(world.pressers).toHaveLength(1);
            const button = world.pressers[0];
            expect(button.tag).toBe('button');
            // ⛔ THE GROUP IS COMPARED, NOT ASSUMED. A button in a different
            // tSet would build perfectly and open nothing — the template
            // would place an obstacle and a decoration.
            expect(button.t).toBe(lock.t);

            // ── the BLOCK, in the button's own lane ───────────────────
            expect(world.pushables).toHaveLength(1);
            const block = world.pushables[0];
            expect(block.tag).toBe('pushableblock');
            expect(block.family).toBe('walk');
            const blockTile = { tx: block.x / TILE_SIZE, ty: block.y / TILE_SIZE };
            const buttonTile = {
                tx: Math.floor(button.x / TILE_SIZE), ty: Math.floor(button.y / TILE_SIZE),
            };
            if (axis === 'row') {
                expect(blockTile.ty).toBe(buttonTile.ty);
                expect(buttonTile.tx).toBeGreaterThan(blockTile.tx);
            } else {
                expect(blockTile.tx).toBe(buttonTile.tx);
                expect(buttonTile.ty).toBeGreaterThan(blockTile.ty);
            }
        });
    }

    /**
     * ⛔⛔ THE S1 GUARD, AND IT IS TEMPLATE LEGALITY RATHER THAN A SOLVER
     * SPECIAL CASE. `legalAt` tests footprint ∪ clearance with `isFree`, and
     * `isFree` refuses the start and the goal cells — so declaring the cells
     * the block slides THROUGH (clearance) and the cell it lands ON (the
     * button, footprint) makes it structurally impossible to anchor this
     * template where the shove would put a block on the goal.
     *
     * ⚠ Slice 3 met that shape on `wall-gap-block` and correctly left it to
     * the LOOP to reject, because there the destination is derived per-room
     * and unknowable at anchor time. Here the destination IS the button and
     * the button is part of the template. Same law, different information —
     * which is why this assertion can exist for one family and not the other.
     */
    it('the weigh templates declare the whole slide path, so no anchor can '
        + 'land the block on the goal', () => {
        for (const name of ['wall-gap-lock-weigh-h', 'wall-gap-lock-weigh-v']) {
            const t = byName(name);
            const block = t.entities.find((e) => e.type === 'pushableblock');
            const button = t.entities.find((e) => e.type === 'button');
            const declared = new Set([...t.footprint, ...t.clearance]
                .map((c) => `${c.dx},${c.dy}`));
            // Every cell from the block to the button INCLUSIVE — the ones the
            // block occupies at some point during the lean.
            const dx = Math.sign(button.dx - block.dx);
            const dy = Math.sign(button.dy - block.dy);
            const steps = Math.max(Math.abs(button.dx - block.dx),
                Math.abs(button.dy - block.dy));
            for (let i = 0; i <= steps; i += 1) {
                const key = `${block.dx + dx * i},${block.dy + dy * i}`;
                expect(declared, `${name}: slide cell ${key} is not declared, so an anchor `
                    + 'could put the goal there').toContain(key);
            }
            // AND the stance behind the block, or the lean cannot start.
            expect(declared).toContain(`${block.dx - dx},${block.dy - dy}`);
        }
    });

    /**
     * ⛔ THE SPAN IS THE INTERIOR'S, AND THAT IS THE WHOLE DESIGN. A shorter
     * wall is walked around, the block is never in the way, and the template
     * becomes an obstacle that obstructs nothing (traps 171/173 — the same
     * failure `shoot="0"` would have been for the arrow lane). Asserted
     * against the ROOM's own size rather than against 8.
     */
    it('the door spans the whole interior — anything less obstructs nothing', () => {
        const m = model();
        const room = m.skeleton();
        for (const [name, axis] of [['wall-gap-block-h', 'dx'], ['wall-gap-block-v', 'dy']]) {
            const t = byName(name);
            const span = Math.max(...t.footprint.map((c) => c[axis])) + 1;
            const interior = (axis === 'dx' ? room.width : room.height) - 2;
            expect(span).toBe(interior);
        }
    });

    /**
     * ⛓⛓⛓ AND IT CERTIFIES IN A ROOM THE LOOP ACTUALLY BUILT — the standard
     * every other family met (kickoff §9.2), which "the template builds what
     * it claims" does not reach: a door that builds correctly and is never
     * shoved would pass every assertion above.
     *
     * ⛔ THIS IS THE ROW SLICE 2 COULD NOT HAVE WRITTEN. Its measurement was
     * that `shove` is never SELECTED under a collect-only goal; here the loop
     * places the door, the solver shoves the block, and the run certifies its
     * collect — end to end, from the generator's own seed.
     */
    /**
     * ⛔ BOUND NAMED: seeds 1..20 at `obstacleTarget: 6`, and the search stops
     * at the first run that keeps the family. The bound is stated because a
     * search that found nothing and a search that was never run print the same
     * thing otherwise. [[feedback_bounded_sweep_must_name_what_it_bounded]]
     *
     * ⛓ Slice 3b widened this from ONE PINNED SEED to a named search, because
     * the palette is part of the draw stream: adding the two `weigh` templates
     * moved what seed 1 draws, and a test pinned to one seed is a test about
     * the draw order rather than about the family.
     *
     * ⛔⛔⛔ AND THE TICK CLAIM MOVED WITH IT, BECAUSE THE OLD ONE WAS NOT TRUE
     * OF THE FAMILY — it was true of one seed. `trace[].ticks` is the WHOLE
     * ROOM's solve after that placement, so it rises only when the obstacle is
     * on the route at all, and a full-span door with the goal on the START's
     * side is kept (the room still solves) having cost nothing. Comparing a
     * kept row against the SKELETON also mis-attributes: at seed 1 the water
     * pool placed after a weigh door reports the door's 330 as its own. The
     * honest comparison is against the row BEFORE it, and the honest claim is
     * an EXISTENCE one.
     */
    it('every CLEARER family is KEPT in a generated room that certifies its collect', () => {
        // Built FROM the roster's clearer families, so a third one added
        // without a case here is a missing test rather than an uncounted one.
        const clearers = [...new Set(PRE_SWORD_TEMPLATES.map((t) => t.family))]
            .filter((f) => f === 'shove' || f === 'weigh');
        expect(clearers.sort()).toEqual(['shove', 'weigh']);
        for (const family of clearers) {
            let found = null;
            for (let seed = 1; seed <= 20 && !found; seed += 1) {
                const out = generateSeedlingLevel({ seed, bounds: { obstacleTarget: 6 } });
                const kept = out.trace.filter((r) => r.family === family
                    && r.outcome === 'KEPT');
                if (kept.length) found = { out, kept };
            }
            expect(found, `no ${family} template was KEPT in seeds 1..20 at target 6`)
                .not.toBeNull();
            for (const d of found.kept) {
                expect(d.verdict).toBe('SOLVED');
                expect(d.ticks).toBeGreaterThan(0);
            }
        }
    });

    /**
     * ⛓⛓⛓ NON-VACUITY — the `weigh` door is not merely KEPT in generated
     * rooms, it is CROSSED in one.
     *
     * ⛔ THIS IS THE ASSERTION THE `shove` FAMILY WOULD FAIL, and finding that
     * out is what this test exists for. Measured over seeds 1..20 at target 6
     * (2026-08-12), splitting kept/reverted rows by whether the goal is beyond
     * the template's wall from the start:
     *
     *   | family | NEAR (goal on the start's side) | FAR (goal beyond it) |
     *   |---|---|---|
     *   | `weigh` | 15 KEPT, 0 REVERTED | **3 KEPT**, 3 REVERTED |
     *   | `shove` | 11 KEPT, 0 REVERTED | **0 KEPT**, 4 REVERTED |
     *
     * ⇒ `wall-gap-block` is kept in a generated room exactly when it is
     * IRRELEVANT, and refuses every time it is the room's actual door
     * (*"Obstacle: solid:pushableblock … Strategy 'shove' failed to apply"*).
     * Slice 3 promoted it on three dedicated probe geometries, which were
     * real; the GENERATED-room evidence for it has always been vacuous, and a
     * KEPT row looks identical whether or not the obstacle was ever in the
     * way. ⚠ NOT slice 3b's to fix — the family and its derivation are slice
     * 3's — but recorded here so the next slice starts from a measurement
     * rather than from a keep-count. [[feedback_graceful_skip_hides_the_surface]]
     *
     * The assertion is deliberately the EXISTENCE one for `weigh` only: a
     * count asserted here would be a test about the draw order again.
     */
    it('⛔ the weigh door is CROSSED in a generated room, not merely kept beside one', () => {
        let crossing = null;
        for (let seed = 1; seed <= 20 && !crossing; seed += 1) {
            const out = generateSeedlingLevel({ seed, bounds: { obstacleTarget: 6 } });
            const goal = seedlingModel({ seed }).goalCell;
            let prev = out.trace.find((r) => r.family === 'skeleton').ticks;
            for (const r of out.trace) {
                if (r.outcome !== 'KEPT' || r.family === 'skeleton') continue;
                const isFar = r.template.endsWith('-h')
                    ? goal.ty > r.at.ty : goal.tx > r.at.tx;
                if (r.family === 'weigh' && isFar && r.ticks > prev) {
                    crossing = { seed, template: r.template, before: prev, after: r.ticks };
                    break;
                }
                prev = r.ticks;
            }
        }
        expect(crossing, 'no generated room in seeds 1..20 placed a `weigh` door BEYOND '
            + 'which the goal lay AND paid ticks for it — the family would then be kept '
            + 'only where it is irrelevant, which is what `shove` does').not.toBeNull();
        // The measured instance, as the record of what "crossed" cost.
        expect(crossing.after).toBeGreaterThan(crossing.before);
    });

    it('EVERY template in the roster is verified above — by name, not by count', () => {
        // The list this test compares against is the one the cases assert on.
        const verified = ['wall-segment-h3', 'wall-segment-v3', 'water-pool-2x2',
            'pit-patch-2x1', 'arrow-lane', 'wall-gap-block-h', 'wall-gap-block-v',
            'wall-gap-lock-weigh-h', 'wall-gap-lock-weigh-v'];
        expect(PRE_SWORD_TEMPLATES.map((t) => t.name).sort()).toEqual([...verified].sort());
    });
});

describe('the arrow lane\'s clearance rule is the ENGINE\'s geometry', () => {
    it('the lane rect comes from `arrowLaneForPlacement` + `arrowLaneRect`', () => {
        const m = model();
        const record = m.skeleton();
        const { lane, laneRect } = m.laneClear(record, 4, 2);
        const point = arrowTrapEntityPoint(4 * TILE_SIZE, 2 * TILE_SIZE);
        const expected = arrowLaneForPlacement({ id: lane.id, t: 0, ex: point.x, ey: point.y });
        expect(lane).toEqual(expected);
        expect(laneRect).toEqual(arrowLaneRect(expected, record.height * TILE_SIZE));
    });

    it('refuses an anchor whose lane covers the goal cell, and says which', () => {
        const m = model();
        // the model's goal cell for seed 1 — the lane straight above it
        const { tx, ty } = m.goalCell;
        const verdict = m.laneClear(m.skeleton(), tx, ty - 1);
        expect(verdict.ok).toBe(false);
        expect(verdict.over).toBe('the goal cell');
    });

    it('a lane that reaches neither the start nor the goal is legal', () => {
        const m = model();
        const far = m.goalCell.tx === 8 ? 2 : 8;
        expect(m.laneClear(m.skeleton(), far, 1).ok).toBe(true);
    });

    it('the anchor scan honours the rule — every drawn anchor is lane-clear', () => {
        const m = model();
        const rng = rngFor(3);
        for (let i = 0; i < 20; i += 1) {
            const at = m.anchorFor(m.skeleton(), byName('arrow-lane'), rng);
            expect(at).not.toBeNull();
            expect(m.laneClear(m.skeleton(), at.tx, at.ty).ok).toBe(true);
        }
    });
});

describe('the bindings place atomically and refuse illegally', () => {
    it('the skeleton is a bordered room with exactly the goal pickup in it', () => {
        const m = model();
        const record = m.skeleton();
        expect(record.entities).toHaveLength(1);
        expect(record.entities[0].type).toBe('torchpickup');
        expect(terrainAt(record, 0, 0)).toBe('wall');
        expect(terrainAt(record, 1, 1)).toBe('ground');
    });

    it('never anchors on the start or the goal cell', () => {
        const m = model();
        expect(m.isFree(m.skeleton(), m.defaults.start.tx, m.defaults.start.ty)).toBe(false);
        expect(m.isFree(m.skeleton(), m.goalCell.tx, m.goalCell.ty)).toBe(false);
    });

    it('never anchors on a cell an earlier template already painted', () => {
        const m = model();
        const once = placedAt(m, 'wall-segment-h3', { tx: 3, ty: 3 });
        expect(m.isFree(once, 3, 3)).toBe(false);
        expect(m.isFree(once, 4, 3)).toBe(false);
        expect(m.isFree(once, 6, 3)).toBe(true);
    });

    it('never anchors on a cell an earlier ENTITY template occupies', () => {
        const m = model();
        const once = placedAt(m, 'arrow-lane', { tx: 3, ty: 1 });
        expect(m.isFree(once, 3, 1)).toBe(false);
    });

    it('PLACEMENT IS PURE — the old record is untouched, which is what revert is', () => {
        const m = model();
        const before = m.skeleton();
        const json = JSON.stringify(before);
        const after = m.place(before, byName('water-pool-2x2'), { tx: 3, ty: 3 });
        expect(JSON.stringify(before)).toBe(json);
        expect(after).not.toBe(before);
        expect(Object.isFrozen(after)).toBe(true);
    });

    it('an out-of-rectangle footprint is refused by the LEVEL MODEL, by name', () => {
        const m = model();
        expect(() => m.place(m.skeleton(), byName('wall-segment-h3'), { tx: 9, ty: 5 }))
            .toThrow(ProcgenLevelError);
        // and the loop is told which error class is the model's own
        expect(m.placementError).toBe(ProcgenLevelError);
    });

    it('`anchorFor` returns null rather than looping when nothing fits', () => {
        const m = model();
        // a template whose footprint is the whole interior cannot be placed
        const huge = {
            name: 'huge', family: 'x',
            footprint: Array.from({ length: 64 }, (_, i) => ({ dx: i % 8, dy: Math.floor(i / 8) })),
            terrain: [], entities: [],
        };
        expect(m.anchorFor(m.skeleton(), huge, rngFor(5))).toBeNull();
    });
});

describe('the water template obliges the `sound` pin, by argument', () => {
    it('the oracle takes the pin union over the templates a candidate holds', () => {
        const m = model();
        const oracle = seedlingOracle({ model: m });
        expect(oracle.pinsFor([])).toEqual(['dead_frames']);
        expect(oracle.pinsFor([byName('wall-segment-h3')])).toEqual(['dead_frames']);
        expect(oracle.pinsFor([byName('water-pool-2x2')]).sort())
            .toEqual(['dead_frames', 'sound']);
        expect(oracle.pinsFor([byName('water-pool-2x2'), byName('water-pool-2x2')]))
            .toHaveLength(2);
    });

    it('only the water template declares it — the others carry no pins', () => {
        for (const t of PRE_SWORD_TEMPLATES) {
            expect(t.pins).toEqual(t.family === 'water' ? ['sound'] : []);
        }
    });
});

describe('the exclusions are a list with measurements in it', () => {
    it('names the three clearer families the kickoff asked for, each with a cause', () => {
        const names = EXCLUDED_TEMPLATES.map((x) => x.name);
        // ⛓ SLICE 3: `pushable-block` is GONE from this list because it was
        // PROMOTED — the row's cause was a solver defect and the defect is
        // fixed. An exclusion whose cause has been repaired is a stale claim,
        // and leaving it here would have the palette arguing against itself.
        expect(names).not.toContain('pushable-block');
        expect(names).toContain('button-lock-pair');
        expect(names).toContain('arrow-ceiling-killlock');
        for (const x of EXCLUDED_TEMPLATES) {
            expect(typeof x.cause).toBe('string');
            expect(x.cause.length).toBeGreaterThan(0);
            expect(typeof x.measured).toBe('string');
            expect(typeof x.wouldNeed).toBe('string');
        }
    });

    it('the MEASURED ones carry the refusal text verbatim, and it is THIS slice\'s', () => {
        const measured = EXCLUDED_TEMPLATES.filter((x) => x.refusalText !== null);
        expect(measured).toHaveLength(2);
        // ⛔ Both texts are re-measured on the CORRIDOR after the collect-path
        // fix. Slice 2's texts were about a path that no longer exists, and a
        // refusal text is this arc's evidence channel (kickoff §3.1) — a stale
        // one is a claim about a run nobody can reproduce.
        expect(measured.find((x) => x.name === 'button-lock-pair').refusalText)
            .toMatch(/grazing 396 solid\(s\): lock at \(64,80\)/);
        expect(measured.find((x) => x.name === 'arrow-ceiling-killlock').refusalText)
            .toMatch(/held button@32,48 for the whole bound of 227 tick\(s\)/);
        // ⚠ NOT ONE of them still carries the derivation message the fix
        // deleted — the regression that says the list was actually re-measured.
        for (const x of measured) {
            expect(x.refusalText).not.toMatch(/no REACHABLE stance/);
        }
    });

    it('NOTHING excluded is also in the palette', () => {
        const paletteFamilies = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        for (const x of EXCLUDED_TEMPLATES) {
            expect(PRE_SWORD_TEMPLATES.some((t) => t.name === x.name)).toBe(false);
        }
        // ⛓ `shove` is NO LONGER on this list — slice 3 promoted it. The
        // families still out are the ones whose measurement still says so.
        for (const family of ['hold', 'kill', 'break', 'chaser']) {
            expect(paletteFamilies.has(family)).toBe(false);
        }
        expect(paletteFamilies.has('shove')).toBe(true);
    });
});
