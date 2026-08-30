/**
 * seedlingDemo/watchEntrances — WHERE THE GAME PUTS YOU when you walk into a
 * level, derived from the level graph instead of guessed.
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer`/`watchSolve`/
 * `watchOverlays`: it makes no claims, gates nothing, and nothing that DOES
 * make a claim may depend on it. It reports RAW TRUTH — a level whose world
 * will not build is named in `refused` rather than skipped, a deactivated
 * teleporter is listed WITH its flag rather than filtered away, and a level
 * with no entrance at all says so by name.
 *
 * ── WHY THIS EXISTS, AND WHAT IT REPLACES ─────────────────────────────
 *
 * ⚖ The user's item: *"instead of guessing the player's start position in each
 * level, it reads the start position from entrances to that level, if
 * possible."*
 *
 * The page's boot panel had two answers for "where does the player start in
 * level N": a COMMITTED BOOT harvested from the tape roster (42 of the atlas's
 * 116 levels have one) and, failing that, `chooseSpawn` — the nearest walkable
 * non-pit cell, which Group A shipped under an explicit warning that it is *a
 * convenience for looking around, not a position the game ever used*. So two
 * thirds of the stepper's destinations dropped the player somewhere the game
 * never puts anybody.
 *
 * ⛔ THE GAME ALREADY ANSWERS THIS, AND THE ANSWER IS THE TELEPORTER.
 * `Teleporter` carries `to` (the destination LEVEL) and `playerx`/`playery`,
 * and `Game.as:2040` builds `new Player(playerx, playery)` in the destination
 * — which is exactly what `playerPhysicsV2.arriveIn` replays and exactly what
 * `levelRun`'s transition arm passes as the new `Game`'s ctor args. So:
 *
 *   **an ENTRANCE to level N is a teleporter, in any level, whose `to` is N**,
 *   and its start position is that teleporter's own `playerx`/`playery`.
 *
 * ⛔⛔ MEASURED BEFORE IT WAS BUILT, over all 116 levels: 280 teleporters, 1
 * deactivated, 52 stairs; every one has an integer `to` inside 0..115 and
 * integer `playerx`/`playery` (the builder throws otherwise, so this is the
 * BUILDER's guarantee and not a hope). **112 of 116 levels have at least one
 * entrance**; the four that have none are **58, 69, 81 and 84**. The count
 * distribution is 26 levels with exactly one, 51 with two, and a long tail up
 * to L12's fourteen.
 *
 * ⚠ AN ENTRANCE IS NOT A COMMITTED BOOT AND THE TWO ARE NOT RANKED HERE.
 * Measured: of the 42 committed boots, **21 sit exactly on an entrance** and
 * **21 do not** — a tape that boots mid-room to isolate one mechanism
 * (`r3-collect-shield` at 112,72 in L20) is a position the game used, and an
 * entrance is where the game puts you when you walk in. Different questions,
 * both true, and the page offers both rather than this module deciding.
 *
 * ⛔⛔⛔ THE COORDINATES ARE THE `Game` CONSTRUCTOR'S ARGS, NOT THE PLAYER'S
 * POSITION, AND THE HALF TILE BETWEEN THEM IS LOAD-BEARING.
 *
 * A staging block's `boot.x`/`boot.y` are `playerx`/`playery`; the Player ctor
 * re-centres onto the tile (`Player.as:357`), so the player is observed at
 * `(boot.x + 8, boot.y + 8)`. MEASURED on `r3-collect-sword`: boot `(48,80)`,
 * first observation `(56,88)`. `levelWorld` precomputes the observed point as
 * `teleporter.arrival` and this module hands back the CTOR ARGS, because that
 * is what a boot block holds — an entrance written as its arrival would spawn
 * the player half a tile down and to the right of where the game puts them.
 *
 * ⛓ AND THAT HALF TILE IS A DEFECT THIS DERIVATION FOUND IN THE THING IT
 * REPLACES. `chooseSpawn` validates a tile CENTRE — `playerBoxAt(cx, cy)`
 * clears the solids — and then writes that centre into `boot`, which the
 * engine adds the half tile to. MEASURED over a twelve-level sample: **five of
 * the twelve actually spawn INSIDE A SOLID**, which is the precise failure the
 * function exists to prevent. Fixed at the same time (`watchViewer`'s
 * `chooseSpawn` now returns the tile CORNER), and named here because the
 * lesson is the general one: *a validated coordinate written into a field
 * somebody else offsets has not been validated.*
 */

import { buildLevelWorld } from './levelWorld.js';

/**
 * ⛔ THE HALF TILE, ONCE. `Player.as:357` re-centres the constructed player
 * onto its tile, so an observed position is a ctor arg plus this and a ctor
 * arg is an observed position minus it. Exported so the page's readouts can
 * show BOTH numbers without either of them being retyped.
 */
export const BOOT_TO_PLAYER_OFFSET = 8;

/** The point the player is OBSERVED at, given a boot block's ctor args. */
export const playerPointFor = (boot) => ({
    x: boot.x + BOOT_TO_PLAYER_OFFSET,
    y: boot.y + BOOT_TO_PLAYER_OFFSET,
});

/**
 * ⛓⛓⛓ EVERY ENTRANCE IN THE ATLAS, INDEXED BY DESTINATION.
 *
 * ⛔ IT BUILDS WITH `roles: ['trigger']` AND THAT IS THE WHOLE COST STORY.
 * Teleporters are the trigger role's own collection; asking for the blocking
 * or combat roles as well would price a census this question does not use.
 * MEASURED at **93 ms for all 116 levels** in node, which is why the page can
 * afford to build the index once at mount rather than lazily per level — a
 * per-level scan would have to walk every OTHER level anyway, since an
 * entrance to L10 lives in L9 and L11.
 *
 * ⚠ A LEVEL THAT WILL NOT BUILD IS NAMED IN `refused`, NEVER SKIPPED. The
 * index would otherwise be silently short by however many rooms failed, and
 * "level N has no entrance" would mean both "nothing leads there" and "the
 * room that leads there would not build" — trap 196's shape, on a derivation
 * instead of a layer.
 *
 * @param {Function} levelSource `(n) => levelRecord`
 * @param {number[]} levels the atlas's own level list
 * @returns {{index: Map<number, object[]>, scanned: number, refused: object[]}}
 */
export function collectEntrances(levelSource, levels) {
    const index = new Map();
    const refused = [];
    let scanned = 0;
    for (const from of levels) {
        let world;
        try {
            world = buildLevelWorld(levelSource(from), { roles: ['trigger'] });
        } catch (e) {
            refused.push({ level: from, why: e.message });
            continue;
        }
        scanned += 1;
        // ⚠ AN ORDINAL PER SOURCE LEVEL, because `from` alone is not a key.
        // MEASURED: L94 holds TWO teleporters into L0 (arriving at 16,128 and
        // 16,144) and L24 holds two into L12 that share ONE arrival point. An
        // id that named only the source room would collide in both cases, and
        // a picker whose options collide silently picks the wrong one.
        const seen = new Map();
        for (const t of world.teleporters ?? []) {
            const ord = seen.get(t.to) ?? 0;
            seen.set(t.to, ord + 1);
            if (!index.has(t.to)) index.set(t.to, []);
            index.get(t.to).push(Object.freeze({
                id: `L${from}#${ord}`,
                from,
                to: t.to,
                // ⛔ THE CTOR ARGS — see the docblock. `arrival` rides along so
                // a readout can show where the player is OBSERVED without
                // recomputing the half tile.
                x: t.playerx,
                y: t.playery,
                arrival: { x: t.arrival.x, y: t.arrival.y },
                isStairs: t.isStairs,
                tag: t.tag,
                // ⚠ CARRIED, NOT FILTERED. A deactivated teleporter cannot be
                // walked through on a fresh boot, and its arrival point is
                // still exactly where the game would put you if it could — so
                // dropping it would hide a real entrance, and offering it
                // unmarked would imply a route that is shut. MEASURED: 1 of
                // the atlas's 280.
                deactivated: t.deactivated,
            }));
        }
    }
    return { index, scanned, refused };
}

/**
 * The entrances to one level, with a NAMED absence when there are none.
 *
 * ⚠ THREE ANSWERS, not one. "This index was never built", "the atlas has
 * nothing leading into this room", and "here they are" are different facts,
 * and the first two look identical to a caller that only counts the list.
 *
 * @returns {{entrances: object[], why: string|null}}
 */
export function entrancesTo(collected, level) {
    if (!collected || !(collected.index instanceof Map)) {
        return {
            entrances: [],
            why: 'the entrance index has not been built for this page, so where the game '
                + 'puts you in this room is not a question it can answer yet — which is NOT '
                + 'the same as "nothing leads here"',
        };
    }
    const list = collected.index.get(level) ?? [];
    if (list.length > 0) return { entrances: list, why: null };
    const short = collected.refused.length > 0
        ? ` ⚠ ${collected.refused.length} level(s) would not build and were not scanned `
            + `(${collected.refused.map((r) => r.level).join(', ')}), so this may be an `
            + 'absence in the INDEX rather than in the game'
        : '';
    return {
        entrances: [],
        why: `no teleporter anywhere in the atlas leads into level ${level} — measured, `
            + 'four of the 116 rooms are like this (58, 69, 81, 84), and they are reached '
            + `by falling or by a save file rather than by walking in.${short}`,
    };
}

/**
 * One entrance, as a line a human can pick between.
 *
 * ⛔ THE SOURCE ROOM IS THE HEAD OF THE LABEL because it is the only field
 * that is always distinguishing to a reader: two entrances can share an
 * arrival point (measured, L24's two into L12) and every entrance to one level
 * shares its destination. "Where did I come from" is the question a person
 * actually has when they pick one.
 */
export function entranceLabel(e) {
    const parts = [`from L${e.from}`];
    if (e.isStairs) parts.push('stairs');
    parts.push(`start ${e.x},${e.y}`);
    // ⚠ The OBSERVED point too, because the two differ by the half tile and a
    // reader comparing this against the HUD would otherwise see a mismatch.
    parts.push(`→ player at ${e.arrival.x},${e.arrival.y}`);
    if (e.deactivated) parts.push('⚠ DEACTIVATED on a fresh boot');
    return parts.join(' · ');
}
