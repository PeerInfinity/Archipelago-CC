/**
 * seedlingDemo/bulbPlacement — ⛓⛓⛓ seedling-fidelity-bulb D3: A BULB'S KILL IS PLACED.
 *
 * ⚖ The user, 2026-10-10: *"On death, they turn the floor under them to lava … This will affect combat planning. We
 * don't want them to die on a tile that we need to walk on."*
 *
 * A Bulb's death writes LAVA under its centre for the rest of the visit (`bulb.js`), and lava is forbidden floor to
 * the planner (`botDriverV2.plannerObstacleAt`'s lethal arm; `Player.checkDrowning` without the dark suit). So a
 * kill is a TERRAIN EDIT, and where it happens decides whether the rest of the segment can still be walked.
 * MEASURED on survey step 160 (L74, the Darkshield) with the Bulb bridged and nothing placing it: the walk's
 * opportunistic strike killed `bulb@48,112` standing on the one-tile floor (3,7) between the lava pools, the lava
 * landed there 27 ticks later, and the way back to `teleporter@16,144` was gone.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────
 *
 * Every press is decided by ONE policy (`strikePolicy.createStrikePolicy`, ⚖ ruling 30(b)/(c)) — the AVOID walk's
 * opportunistic strike, the TIME/BAIT walks' and the KILL rung's dwell alike — so the constraint lives where a press
 * is decided: a per-body VETO the policy asks before it aims. A press is vetoed when its swing would kill a body
 * with a drop death and some tile that body can stand on when "drop" begins is NEEDED:
 *
 *   · the candidate tiles are the ones under the body's centre grown by how far it can still move before "drop"
 *     starts — the press lands within `SLASH_HIT_TICKS` of the aim, and the armed update moves it once more — at
 *     its own `moveSpeed`: `(SLASH_HIT_TICKS + 2) * speed` px (the slide never leaves the tile "drop" began on);
 *   · a tile is NEEDED when, with lava written there (`levelWorld.withTileWrites`), some goal the segment still owes
 *     (`setDropKillNeeds`, set by `solveSegment` per goal: the pickups and the exit) that the player can reach now
 *     can no longer be reached (`botDriverV2.plansReach` — the planner's own existence rules, `run.world`'s live bag).
 *
 * ⇒ a Bulb on the bridge is not struck (the walk must route round it, bait it, or wait for it), and the KILL rung's
 * stance search (`deriveKillByChaser`) — whose dwell is the same policy — keeps only stances where the body comes to
 * the player somewhere its lava cuts nothing: the kill is lured off the path.
 *
 * ⚠ What this does NOT place, named: a kill the policy does not decide — the dark suit's retaliation, the dark
 * shield's bump, an arrow. A Bulb those kill dies where it stands.
 */

import { DEFAULT_LATTICE, plansReach } from './botDriverV2.js';
import { ENEMY_CLASSES } from './combat.js';
import { hasDropDeath, tileUnder } from './bulb.js';
import { TILE_SIZE, withTileWrites } from './levelWorld.js';
import { CHASERS } from './chasers.js';
import { SLASH_HIT_TICKS } from './presses.js';

/** run → `{ needs: [{what, aims: [{x, y}], allowTeleporter}], planOpts: () => opts }` for the goals the segment still owes. */
const NEEDS = new WeakMap();

/**
 * `solveSegment`'s hand-off: the goals the segment still owes from here, as planner aims. A run with no entry (or an
 * empty list) has no veto — every strike policy built on it is the policy it was before this slice.
 */
export function setDropKillNeeds(run, needs, planOpts) {
    if (!needs || needs.length === 0) { NEEDS.delete(run); return; }
    NEEDS.set(run, { needs: needs.map((n) => ({ ...n })), planOpts, cache: new Map() });
}

/** The current needs of a run (a copy), or null. */
export function dropKillNeedsOf(run) {
    const n = NEEDS.get(run);
    return n ? n.needs.map((x) => ({ ...x })) : null;
}

/**
 * The tiles a drop-death body can stand on when "drop" begins, struck from a press aimed NOW: the tiles under its
 * centre grown by `(SLASH_HIT_TICKS + 2) * moveSpeed` (see the header). Sorted, unique.
 */
export function dropTileCandidates(tag, x, y) {
    const speed = ENEMY_CLASSES[tag]?.speed ?? 0;
    const r = (SLASH_HIT_TICKS + 2) * speed;
    const lo = tileUnder(x - r, y - r);
    const hi = tileUnder(x + r, y + r);
    const out = [];
    for (let ty = lo.ty; ty <= hi.ty; ty += 1) {
        for (let tx = lo.tx; tx <= hi.tx; tx += 1) out.push({ tx, ty });
    }
    return out;
}

/**
 * The veto for this run's strike policy, or null when it has none (no drop-death class bridged, or no needs).
 * `(body, player) => null | {why, tile, need}` — `body` a strike-body row (`{id, tag, rect, hits}`), `player` the
 * position the policy decides from.
 */
export function dropKillVetoFor(run) {
    const entry = NEEDS.get(run);
    if (!entry) return null;
    return (body, player) => {
        if (!hasDropDeath(body.tag)) return null;
        const hitsMax = ENEMY_CLASSES[body.tag]?.kill?.hits ?? 1;
        // A body already at `hitsMax` takes nothing (`Enemy.hit`'s fourth gate): no new death, nothing to place.
        if ((body.hits ?? 0) >= hitsMax) return null;
        const cx = (body.rect.x + body.rect.right) / 2;
        const cy = (body.rect.y + body.rect.bottom) / 2;
        const world = run.world;
        const writes = run.tileWrites instanceof Map ? run.tileWrites : new Map();
        const becomes = CHASERS[body.tag].dropDeath.becomes;
        const pnode = `${Math.floor(player.x / DEFAULT_LATTICE)},${Math.floor(player.y / DEFAULT_LATTICE)}`;
        for (const tile of dropTileCandidates(body.tag, cx, cy)) {
            const k = `${tile.tx},${tile.ty}`;
            if (writes.get(k) === becomes) continue;
            const base = world.tiles?.find((t) => t.tx === tile.tx && t.ty === tile.ty);
            // `collidePoint("Tile", …)` reaches only a tile still typed "Tile"; the body cannot stand on any other.
            if (!base || base.entityType !== 'Tile') continue;
            const ck = `${k}|${pnode}|${[...writes.keys()].join(';')}|${world.level}`;
            let verdict = entry.cache.get(ck);
            if (verdict === undefined) {
                verdict = needVerdict(run, entry, world, new Map([...writes, [k, becomes]]), player, tile);
                entry.cache.set(ck, verdict);
            }
            if (verdict) {
                return {
                    tile,
                    need: verdict.need,
                    why: `⛔ a kill here may write LAVA at tile (${tile.tx},${tile.ty}) — ${body.id}'s drop death `
                        + `(\`Bulb.endAnim\`) — and with lava there ${verdict.need} is no longer reachable from `
                        + `(${player.x.toFixed(1)},${player.y.toFixed(1)}). ⚖ "We don't want them to die on a tile that `
                        + 'we need to walk on." (fidelity-bulb D3)',
                };
            }
        }
        return null;
    };
}

/** Does writing `writes` cut the player off from a need it can reach today? `{need}` naming the first, or null. */
function needVerdict(run, entry, world, writes, player, tile) {
    const after = withTileWrites(world, writes);
    const opts = entry.planOpts();
    for (const n of entry.needs) {
        const before = plansReach(world, n.allowTeleporter ?? null, opts);
        const now = plansReach(after, n.allowTeleporter ?? null, opts);
        if (!before || !now) continue;
        const fromPlayer = before.from(player);
        const was = n.aims.filter((a) => fromPlayer(a));
        if (was.length === 0) continue;
        // ⚠ The player standing ON the tile: the lava lands ~27 ticks on and the walk will have left it, so the
        // question is asked from the tile's neighbours (any one that still reaches the need is enough).
        const starts = [player];
        const pt = tileUnder(player.x, player.y);
        if (pt.tx === tile.tx && pt.ty === tile.ty) {
            starts.length = 0;
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                starts.push({ x: (tile.tx + dx + 0.5) * TILE_SIZE, y: (tile.ty + dy + 0.5) * TILE_SIZE });
            }
        }
        if (!starts.some((s) => { const f = now.from(s); return was.some((a) => f(a)); })) return { need: n.what };
    }
    return null;
}
