/**
 * seedlingDemo/pull — ⛓⛓⛓ U12-swim D1: `Pull.update`, TRANSCRIBED.
 *
 * The first entity in the model that MOVES A BODY BY A VOLUME. The whirlpool
 * is priced (`hazards.js`), never stepped; a pull is now stepped. Brief: the
 * swim plan §18.5–§18.6 (⚖ Q42). L12 places all fourteen, around its one pit.
 *
 * ── THE AS3 (`Puzzlements/Pull.as`, whole) ─────────────────────────────
 *
 * ```
 *   Pull(_x:int, _y:int, _d:Number, _f:Number) {
 *       super(_x, _y); setHitbox(Tile.w, Tile.h); type = "Pull";
 *       direction = _d * Math.PI * 2; force = _f;
 *   }
 *   update() {
 *       collideTypesInto(["Player", "Enemy", "Solid"], x, y, v);
 *       for each (e in v) { e.x += force * Math.cos(direction);
 *                           e.y -= force * Math.sin(direction); }
 *       // alpha / radius: render-only
 *   }
 * ```
 *
 * ⛓ A DIRECT POSITION WRITE: no `moveBy`, no solid test, no `hit()` — so
 * `noDamage` does not touch it and nothing in the class tests
 * `Game.freezeObjects`. `World.update` stops it only where it stops every
 * entity: under `blackCover` (the dead frames), which `advance` never steps.
 *
 * ── THE TICK ORDER, READ (`Game.loadlevel` + `World.addUpdate`) ────────
 *
 * `addUpdate` PREPENDS, so the update list is reverse add order. `loadlevel`
 * adds the Player (`Game.as:2227`), then `bob`…`puncher` (`:2253`–`:2281`),
 * then `pull` (`:2329`), then `lock` (`:2333`), `pulser` (`:2334`), …, `chest`.
 * ⇒ (a) every pull updates BEFORE the chasers and BEFORE the player, so its
 *   overlap test reads the player's box where the PREVIOUS tick left it (an
 *   observation, exactly), and the player's own update this tick starts from
 *   the pushed position. Between the pulser and the arrow traps in `advance`.
 * ⇒ the pulls among themselves run in REVERSE `.oel` order, and each one
 *   tests the box the pull before it has already moved: a box straddling two
 *   cells of one current is pushed TWICE in a frame. `createPulls` returns
 *   the list in that order, and `pushBody` applies it sequentially.
 * (b) A push into a solid is not undone by anything in `Pull`; the player's
 *   next `moveBy` would start embedded. NO pull on L12 can do it — every
 *   push points into another pull cell or into the pit
 *   (`plan-seedling-u12-pull.mjs` checks the geometry) — so a push that
 *   leaves the box in a solid is REFUSED BY NAME in `levelRun`, not modelled.
 * (c) Mid pit-fall the push still lands: `checkFallingInPit`'s lerp reads
 *   `x`/`y` after this write (`stepV2`'s fall-out arm starts from the pushed
 *   state), and every L12 push points at the pit's centre.
 * (d) `Solid` and `Enemy` are pullable too. No `Solid` entity on L12 overlaps
 *   a pull (the rocks and poles of column 34 end at x 560, the spire at
 *   y 656: AABB overlap is strict), and L12's one Enemy (`puncher@416,256`)
 *   is a sealed room away. A body arm is REFUSED BY NAME in `levelRun`.
 */

import { TILE_SIZE, rectsOverlap } from './levelWorld.js';

/** `setHitbox(Tile.w, Tile.h)` — the cell, origin 0. */
const PULL_W = TILE_SIZE;
const PULL_H = TILE_SIZE;

/**
 * The level's pulls in UPDATE order — the reverse of the `.oel` (= `loadlevel`'s
 * add) order. Each carries the two terms `update()` writes, computed exactly as
 * the AS3 does (`force * Math.cos(direction)`, `force * Math.sin(direction)`),
 * so `cos(3π/2)`'s −1.8e−16 is kept rather than rounded to zero.
 */
export function createPulls(entities) {
    const out = [];
    for (const e of entities ?? []) {
        if (e.type !== 'pull') continue;
        const x = Math.trunc(Number(e.x));
        const y = Math.trunc(Number(e.y));
        const force = Number(e.attrs?.force);
        const turn = Number(e.attrs?.direction);
        if (!Number.isFinite(force) || !Number.isFinite(turn)) {
            throw new Error(`pull: pull@${x},${y} carries force "${e.attrs?.force}" / direction `
                + `"${e.attrs?.direction}" — \`Pull\`'s ctor reads both as Numbers, and a NaN `
                + 'would push every overlapping body to NaN.');
        }
        // `_d * Math.PI * 2`: the `.oel`'s 0–1 turn, in radians, in the AS3's order.
        const direction = turn * Math.PI * 2;
        out.push(Object.freeze({
            id: `pull@${x},${y}`,
            x,
            y,
            force,
            direction,
            cosTerm: force * Math.cos(direction),
            sinTerm: force * Math.sin(direction),
            rect: Object.freeze({ x, y, right: x + PULL_W, bottom: y + PULL_H }),
        }));
    }
    return Object.freeze(out.reverse());
}

/**
 * One frame of every pull on one body, in update order: each pull tests the
 * body's box AS THE PULLS BEFORE IT LEFT IT (`collideTypesInto` is per pull,
 * per frame). `boxAt(x, y)` is the body's hitbox. Returns the moved position
 * and the ids that pushed, in order.
 */
export function pushBody(pulls, pos, boxAt) {
    let { x, y } = pos;
    const by = [];
    for (const p of pulls) {
        if (!rectsOverlap(boxAt(x, y), p.rect)) continue;
        x += p.cosTerm;
        y -= p.sinTerm;
        by.push(p.id);
    }
    return { x, y, by };
}

/**
 * The cell a pull's push points INTO: the unit axis of its push. A push that
 * is not axis-aligned (no `.oel` places one) answers null, which the funnel
 * test reads as "not a ride".
 */
function pushCell(p, tile) {
    const ax = Math.round(p.cosTerm / p.force);
    const ay = -Math.round(p.sinTerm / p.force);
    if (Math.abs(ax) + Math.abs(ay) !== 1) return null;
    return { tx: Math.floor(p.x / tile) + ax, ty: Math.floor(p.y / tile) + ay };
}

/**
 * ⛓⛓⛓ U12-swim D2 — THE CURRENTS THAT DRAIN INTO ONE PIT.
 *
 * A pull is a RIDE into `pit` when following its push cell to cell — each
 * next cell another pull, read by ITS push — reaches the pit tile. Every
 * other pull answers no: it is still an avoid volume to the planner. On L12
 * all fourteen drain into (36,43); the walk through the funnel is a ride,
 * because each push it meets points the way it is going.
 */
export function pullsDrainingInto(pulls, pit, tile = PULL_W) {
    const byCell = new Map(pulls.map((p) => [`${Math.floor(p.x / tile)},${Math.floor(p.y / tile)}`, p]));
    const rides = [];
    for (const p of pulls) {
        let cur = p;
        for (let hop = 0; hop <= pulls.length; hop += 1) {
            const next = pushCell(cur, tile);
            if (next === null) break;
            if (next.tx === pit.tx && next.ty === pit.ty) {
                rides.push(p);
                break;
            }
            cur = byCell.get(`${next.tx},${next.ty}`);
            if (!cur) break;
        }
    }
    return rides;
}

/**
 * ⛓⛓ U12-swim D2 — IS THIS PULL STEPPED BY THE MODEL FOR A WALKING PLAYER?
 *
 * The model steps the PLAYER arm. A pull whose box overlaps a solid of the
 * built world (`collidesSolid`, which over-approximates the AS3's `"Solid"`
 * type with the player's whole solid list) would move that solid — an arm
 * `levelRun` does not step — so it answers `{modelled: false, why}` and the
 * frontier names it rather than misattributing it to the nearest resolvable
 * sub-order.
 */
export function pullModelled(p, world, solidOpts = {}) {
    const hit = world.collidesSolid({ ...p.rect }, solidOpts);
    if (hit) {
        const tag = hit.tag ?? hit.cls?.as3 ?? '?';
        return { modelled: false, why: `its box overlaps ${tag}@${hit.x ?? '?'},${hit.y ?? '?'}, `
            + 'which `Pull.update` would move — an arm the model does not step' };
    }
    return { modelled: true, why: null };
}
