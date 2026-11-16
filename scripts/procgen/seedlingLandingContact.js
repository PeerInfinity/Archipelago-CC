/**
 * Seedling LANDING CONTACT — the pure half of `probe-seedling-landing-contact.mjs` (rules
 * `rules-landing-contact-census`). It asks one question of every landing the `seedling_playthrough` rules put a
 * player on: **at the landing, does the player's box overlap, or come within one tick's reach of, a hostile body's
 * contact box at its spawn?** A door arrival that starts inside an enemy's contact box takes a hit whatever the
 * player does (L73's `lavarunner@72,24` vs the L74 door's landing (64,16): the game hits at t2 on every input and
 * the knockback throws the player back through the door at t6 — `rules-fire-only-witness`, § "L73 south").
 *
 * Everything is DERIVED, nothing is typed per level:
 *   - the landings: each sub-region exit's `resolveArrivalSpawn` over the committed rules' sidecars, the
 *     enumeration `probe-seedling-lethal-landings.mjs` uses (there filtered to lethal terrain; here all of them);
 *   - the player's box: `playerPhysicsV1.spawnFromBoot` + `HITBOX` (`Player.as` `setHitbox(4, 5, 2, 2)`);
 *   - the bodies: the map document's entities whose extract tag has a row in `combat.ENEMY_CLASSES` with a
 *     `hitbox` — the centre is `(x + ctor.dx, y + ctor.dy)` (the class's own constructor offset) and the contact
 *     box is `setHitbox(w, h, ox, oy)` about it; `speed` is the class's per-tick speed; `homer` says its aggro
 *     closes on the player (`chase*`), with its `runRange`.
 *
 * The SCREEN (`contactOf`): `gap` is the box separation — the larger of the two axis gaps, negative when the boxes
 * overlap on both axes (FlashPunk's `collide` is strict, so two boxes touching at gap 0 are not in contact yet).
 * `overlap` = gap < 0; `reach` = a mover (speed > 0) whose gap is below `ticks × speed`, i.e. one that can close the
 * gap in `ticks` ticks while the player stands. A screen hit is a CANDIDATE: the game decides (the probe boots each
 * one as a door does, idle and the four held directions, and reads the hit off `botStatus.hits`).
 *
 * The CHASE tier (`chase`): a homer FASTER than the player's walk (`playerPhysicsV1.WALK_SPEED`, `Player.as` dMS) that
 * is AWAKE at the boot (centre distance ≤ its `runRange`). It is not a contact at the boot, but nothing the player does
 * outruns it, so whether the arrival is hit-free is a question of walls, and only the game answers it (measured: the
 * L78 → L77 arrival, `lavarunner@80,272` at a gap of 8 px, is hit or thrown back through the door on every input).
 *
 * Nothing here reads a browser or the filesystem; the caller passes the rules and the (patched) map document.
 */

import { resolveArrivalSpawn } from '../../frontend/modules/flashPanel/seedlingRegionBinding.js';
import { returnSpawnTable } from '../../frontend/modules/flashPanel/seedlingReturnSpawns.js';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import { HITBOX, WALK_SPEED, spawnFromBoot } from '../../frontend/modules/seedlingDemo/playerPhysicsV1.js';

/** The ticks the screen gives a mover to close the gap ("within one tick's reach"). */
export const CONTACT_SCREEN_TICKS = 1;

/** The player's box at a landing `{x, y}` (the boot's tile top-left, the `resolveArrivalSpawn` convention). */
export function playerBoxAt(boot) {
    const c = spawnFromBoot(boot);
    const x = c.x - HITBOX.originX;
    const y = c.y - HITBOX.originY;
    return { cx: c.x, cy: c.y, x, y, right: x + HITBOX.width, bottom: y + HITBOX.height };
}

/** One placed entity's body, or null when its tag has no contact row (`ENEMY_CLASSES` with a hitbox). */
export function bodyOf(entity) {
    const row = ENEMY_CLASSES[entity?.type];
    if (!row || !row.hitbox) return null;
    const cx = Number(entity.x) + row.ctor.dx;
    const cy = Number(entity.y) + row.ctor.dy;
    const x = cx - row.hitbox.ox;
    const y = cy - row.hitbox.oy;
    const kind = row.aggro?.kind ?? 'none';
    return {
        id: `${entity.type}@${entity.x},${entity.y}`, type: entity.type, as3: row.as3, cx, cy,
        x, y, right: x + row.hitbox.w, bottom: y + row.hitbox.h,
        speed: Number(row.speed) || 0, homer: /^chase/.test(kind), aggro: kind,
        range: Number.isFinite(row.aggro?.range) ? row.aggro.range : null,
        damage: row.damage ?? null, kill: row.kill, threat: row.threat ?? null, terrain: row.terrain ?? null,
    };
}

/** The hostile bodies of one level record (every entity with a contact row). */
export const bodiesOf = (levelRecord) => (levelRecord?.entities ?? []).map(bodyOf).filter(Boolean);

/** The box separation (max of the axis gaps; < 0 means overlap on both axes). */
export function boxGap(a, b) {
    const gx = Math.max(a.x - b.right, b.x - a.right);
    const gy = Math.max(a.y - b.bottom, b.y - a.bottom);
    return Math.max(gx, gy);
}

/** The screen verdict of one (landing, body) pair. */
export function contactOf(player, body, { ticks = CONTACT_SCREEN_TICKS } = {}) {
    const gap = boxGap(player, body);
    const centreDist = Math.hypot(body.cx - player.cx, body.cy - player.cy);
    const overlap = gap < 0;
    const reach = !overlap && body.speed > 0 && gap < ticks * body.speed;
    const awake = body.homer && body.range !== null && centreDist <= body.range;
    return { gap, centreDist: Math.round(centreDist * 100) / 100, overlap, reach, hit: overlap || reach,
        awake, chase: awake && body.speed > WALK_SPEED };
}

/**
 * Every landing the committed rules put a player on: `{level, x, y, regions: ['<region>/<exit_id>', …],
 * arrivedFrom: [region, …]}`, deduped by position. `arrivedFrom` lists the regions whose exits name this one as
 * their `targetRegion`/`targetExitId` — a landing with none is reachable only if an entrance shuffle pairs it
 * (a pit's own spawn, say), so the census reports it but marks it unarrived. `mapDoc` must be the document the rules were derived from (the PATCHED one for `seedling_playthrough`)
 * — its return-spawn table decides a door's landing.
 */
export function landingsOfRules(rules, mapDoc) {
    const returns = returnSpawnTable(mapDoc);
    const slot = Object.keys(rules.preset_sidecars)[0];
    const sides = rules.preset_sidecars[slot];
    // who arrives THROUGH an exit: another region's exit whose `targetRegion`/`targetExitId` name it
    const into = new Map();
    for (const [from, side] of Object.entries(sides)) {
        for (const e of side.playable_payload?.exits ?? []) {
            if (!e.targetRegion || !e.targetExitId) continue;
            const k = `${e.targetRegion}/${e.targetExitId}`;
            if (!into.has(k)) into.set(k, []);
            into.get(k).push(from);
        }
    }
    const out = new Map();
    for (const [region, side] of Object.entries(sides)) {
        const w = side.playable_payload;
        if (!w || !Number.isFinite(w.level)) continue;
        for (const e of w.exits ?? []) {
            const s = resolveArrivalSpawn(w, { exit_id: e.exit_id }, returns);
            if (!s) continue;
            const key = `${s.level},${s.x},${s.y}`;
            if (!out.has(key)) out.set(key, { level: s.level, x: s.x, y: s.y, regions: [], arrivedFrom: [] });
            const row = out.get(key);
            row.regions.push(`${region}/${e.exit_id}`);
            for (const f of into.get(`${region}/${e.exit_id}`) ?? []) if (!row.arrivedFrom.includes(f)) row.arrivedFrom.push(f);
        }
    }
    return [...out.values()].sort((a, b) => a.level - b.level || a.y - b.y || a.x - b.x);
}

/**
 * The census: one row per (landing, body) pair whose screen says `hit` or `chase`, plus `near` rows (gap below
 * `nearPx`) as the screen's own control band. `{landings, rows}` where each row is
 * `{level, x, y, regions, arrivedFrom, body: {id, …}, gap, centreDist, overlap, reach, hit, awake, chase}`.
 */
export function landingContactCensus(rules, mapDoc, { ticks = CONTACT_SCREEN_TICKS, nearPx = 0 } = {}) {
    const byLevel = new Map(mapDoc.levels.map((l) => [l.level, l]));
    const landings = landingsOfRules(rules, mapDoc);
    const rows = [];
    for (const L of landings) {
        const p = playerBoxAt(L);
        for (const b of bodiesOf(byLevel.get(L.level))) {
            const c = contactOf(p, b, { ticks });
            if (c.hit || c.chase || c.gap < nearPx) rows.push({ level: L.level, x: L.x, y: L.y, regions: L.regions, arrivedFrom: L.arrivedFrom, body: b, ...c });
        }
    }
    return { landings, rows };
}
