/**
 * mazeRoom/reversePullBlock.certify.test — ⛓⛓⛓ THE GADGET, SOLVED BY THE
 * ENGINE. The half of slice 2 that counts.
 *
 * PROCGEN ELEMENTS arc 2, slice 2 (kickoff §3.2.1(i), §8.12). The element is
 * "solvable by construction" — that is an ARGUMENT. This file is the
 * MEASUREMENT: every constructed (len, turns, seed) is stamped into a real maze
 * world with slice 1's blocks / buttons / flags and handed to `bfsSolver`.
 *
 * ⛔ IT LIVES HERE AND NOT IN `procgenCore/` because `procgenCore/` imports no
 * engine — that is the seam's own rule and `bindingContract.test.js` asserts
 * it. The geometry half is `procgenCore/elements/reversePullBlock.test.js`.
 *
 * ⛓ THE SITE IS THE SUBJECT, NOT THE ROOM (slice 1 §8.1). An 11×11 open room
 * with two free blocks already spends 87% of the 20000-node budget on a level
 * whose solution never touches them. A gadget certifies on its OWN rectangle,
 * walled, with the two ports as the only mouths — which here costs at most
 * **261** nodes.
 *
 * ── ⛓⛓ THE CLAIM IS NOT "IT SOLVES", AND IT IS NOT "IT PUSHES ENOUGH" ──
 *
 * The brief asked for `pushes >= len`. **Both halves of that turned out to be
 * the wrong instrument, and the measurement is what said so:**
 *
 *   `pushes >= len` is FALSE on real data — 18 of 408 plans finish in FEWER
 *   pushes than `len`, every one of them at `turns = 3`, because a walk that
 *   folds back three times carves corner cells that hand the block a shortcut
 *   to its own button. §3.2.1 licensed exactly this ("a shorter one is allowed
 *   if the geometry admits it — record when it does; that is a finding about
 *   pockets"), so it is RECORDED below rather than asserted away.
 *
 *   `pushes > 0` is TRUE but INERT: the deliberately-violating world, whose
 *   door sits next to its button and which the player opens by standing on the
 *   button themselves, still spends ONE push — the block sits in the entry
 *   lane and has to be shoved out of the way. A test that asked "did the plan
 *   touch the block" would have passed the very level the law exists to forbid.
 *
 * ⇒ **THE CLAIM IS: A BLOCK WAS ON THE BUTTON AT THE INSTANT THE PLAYER FIRST
 * ENTERED THE DOOR CELL.** That is the mechanism, stated as the mechanism. It
 * is what the adjacent-door arm fails, and it is what a mutant that drops the
 * `DOOR_GAP` corridor reddens.
 */

import { describe, expect, it } from 'vitest';

import {
    BUTTON_ID, DOOR_ID, HOLD_ID, buildReversePull,
} from '../procgenCore/elements/reversePullBlock.js';
import { rngFor } from './procgenRng.js';
import {
    TILE_WALL, bfsSolver, createState, createWorld, setBlock, setButton, setItem,
    setObstacle, setTile, step,
} from './mazeRoomEngine.js';
import { reach } from '../shared/simulatorCore.js';

const DIR = { N: { dx: 0, dy: -1 }, S: { dx: 0, dy: 1 }, E: { dx: 1, dy: 0 }, W: { dx: -1, dy: 0 } };

/** ⛔ MEASURED FIRST, THEN ASSERTED (and never widened to make a level pass).
 *  The worst single search over the whole 408-row sweep expanded **261** nodes;
 *  the bound is that with headroom for a domain that grows, and it is 2% of the
 *  engine's own 20000-node budget. */
const NODE_BOUND = 400;

/** The site the gadget is certified on — 9×9, walled into an 11×11 world so the
 *  `demand` ring (everything outside except the two mouths stays wall) is what
 *  the world actually has. */
const SITE = Object.freeze({ x: 1, y: 1, w: 9, h: 9 });
const SEEDS = [...Array(24)].map((_, i) => i + 1);

/**
 * §8.12's recipe, spent once. The GUARD shape: the entry port is the entrance,
 * `flag_B` sits one cell beyond `door_A`, and the goal predicate is holding it
 * — so the only thing being asked is "can the player get past the door".
 *
 * @param opts.noBlock  build the same world with no block at all (the ablation
 *   that removes the KEY rather than the door — trap 291)
 * @param opts.doorAt   move `door_A` somewhere else (the violating placement)
 */
function worldFor(placement, opts = {}) {
    const w = createWorld(SITE.w + 2, SITE.h + 2, { entrance: { x: 0, y: 0 }, exits: [] });
    for (let y = 0; y < w.height; y += 1) {
        for (let x = 0; x < w.width; x += 1) setTile(w, x, y, TILE_WALL);
    }
    for (const t of placement.tiles) setTile(w, t.x, t.y, t.tile);
    w.obstacleLib = { ...w.obstacleLib,
        [DOOR_ID]: { id: DOOR_ID, clear_set_type: 'combo_list', clear_set: [[HOLD_ID]] } };
    w.itemLib = { ...w.itemLib, flag_B: { id: 'flag_B', kind: 'flag' } };
    w.buttonLib = { [BUTTON_ID]: { kind: 'button', holds: HOLD_ID } };
    if (!opts.noBlock) for (const b of placement.entities.blocks) setBlock(w, b.x, b.y);
    for (const b of placement.entities.buttons) setButton(w, b.x, b.y, b.id);
    const exit = placement.ports.find((p) => p.role === 'exit');
    const doorAt = opts.doorAt ?? placement.entities.obstacles[0];
    setObstacle(w, doorAt.x, doorAt.y, DOOR_ID);
    const flag = opts.flagAt
        ?? { x: doorAt.x + DIR[exit.dir].dx, y: doorAt.y + DIR[exit.dir].dy };
    setItem(w, flag.x, flag.y, 'flag_B');
    w.entrance = { x: placement.ports.find((p) => p.role === 'entry').x,
        y: placement.ports.find((p) => p.role === 'entry').y };
    return { world: w, doorAt, button: placement.entities.buttons[0] };
}

const hasFlag = (s) => s.inventory.has('flag_B');
const solve = (built) => reach(built.world, bfsSolver, createState(built.world), hasFlag,
    { budget: 20000 });

/**
 * Replay the plan through the ENGINE and report what the plan actually did:
 * how many pushes, and — the claim — whether a BLOCK sat on the button at the
 * instant the player first entered the door cell.
 */
function replay({ world, doorAt, button }, plan) {
    const bkey = `${button.x},${button.y}`;
    let s = createState(world);
    let pushes = 0;
    let heldAtDoor = null;
    for (const input of plan) {
        const before = (s.blocks ?? []).join(';');
        const blockOnButton = (s.blocks ?? []).includes(bkey);
        const next = step(world, s, input);
        expect(next, `the plan's ${input} was refused by the engine`).not.toBeNull();
        if (heldAtDoor === null
            && next.player_pos.x === doorAt.x && next.player_pos.y === doorAt.y) {
            heldAtDoor = blockOnButton;
        }
        if ((next.blocks ?? []).join(';') !== before) pushes += 1;
        s = next;
    }
    return { pushes, heldAtDoor, final: s };
}

const PAIRS = [];
for (let len = 2; len <= 6; len += 1) {
    for (let turns = 0; turns <= 3; turns += 1) if (turns <= len - 1) PAIRS.push({ len, turns });
}

describe('the reverse-pull gadget SOLVES, over every (len, turns) × 24 seeds', () => {
    const census = { rows: 0, shortcuts: 0, shortcutPairs: new Set(), worstNodes: 0 };

    it.each(PAIRS)('len=$len turns=$turns — 24 seeds, each solved by the block', ({ len, turns }) => {
        for (const seed of SEEDS) {
            const out = buildReversePull({ len, turns }, SITE, rngFor(seed));
            expect(out.refused, `${len}/${turns}/${seed} refused on a 9×9 site`).toBeUndefined();
            const built = worldFor(out.placement);
            const r = solve(built);
            const at = `len=${len} turns=${turns} seed=${seed}`;
            expect(r.ok, `${at} did not solve (${r.reason})`).toBe(true);
            expect(r.expanded, `${at} expanded ${r.expanded}`).toBeLessThanOrEqual(NODE_BOUND);

            const rep = replay(built, r.plan);
            // ⛓⛓ THE CLAIM.
            expect(rep.heldAtDoor, `${at}: the door was crossed with no block on the button`)
                .toBe(true);
            // …and the block is still home afterwards — it holds the door open,
            // it is not consumed by it.
            expect(rep.final.blocks).toEqual([`${built.button.x},${built.button.y}`]);

            // ⛔ NEVER MORE than `len` pushes — the constructed walk is optimal
            // — and never fewer EXCEPT where a fold-back gives a shortcut.
            expect(rep.pushes).toBeLessThanOrEqual(len);
            if (rep.pushes < len) {
                census.shortcuts += 1;
                census.shortcutPairs.add(`${len},${turns}`);
            } else {
                expect(rep.pushes).toBe(len);
            }
            census.rows += 1;
            census.worstNodes = Math.max(census.worstNodes, r.expanded);
        }
    });

    /**
     * ⚠ THE SHORTCUT CENSUS — a MEASURED fact about the element, asserted as a
     * literal so it is a drift detector rather than a shrug. A change that made
     * bent walks fold differently moves this number, and the reader is then
     * told which rows moved instead of discovering it in slice 3.
     */
    it('the shortcut census: 18 of 408 plans finish under `len`, ALL of them at turns=3', () => {
        expect(census.rows).toBe(17 * 24);
        expect(census.shortcuts).toBe(18);
        expect([...census.shortcutPairs].sort()).toEqual(['4,3', '5,3', '6,3']);
        // …and the bound this file asserts is the one that was measured.
        expect(census.worstNodes).toBe(261);
        expect(census.worstNodes).toBeLessThanOrEqual(NODE_BOUND);
    });
});

describe('the two arms that say the block is LOAD-BEARING', () => {
    /**
     * ⚖ trap 291 — REMOVE THE KEY, NOT THE DOOR. Taking the door away only
     * makes a level easier and could never falsify anything; taking the BLOCK
     * away leaves the door with nothing that can ever hold it.
     */
    it.each(SEEDS.slice(0, 8))('seed %i: with the block REMOVED the flag is unreachable', (seed) => {
        const out = buildReversePull({ len: 3, turns: 1 }, SITE, rngFor(seed));
        const r = solve(worldFor(out.placement, { noBlock: true }));
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unreachable');
    });

    /**
     * ⛓⛓⛓ THE LAW'S OWN WITNESS (§3.1-AS-BUILT ⚖ Q2, trap 302). The SAME
     * gadget with `door_A` moved to the cell ORTHOGONALLY ADJACENT to its
     * button — the placement `assertPlacement` refuses to build — and the level
     * still solves, because the player walks onto the button and steps through
     * on their own press.
     *
     * ⚠ AND IT STILL SPENDS A PUSH (the block is in the entry lane), which is
     * exactly why the certification claim above is about WHAT HELD THE DOOR and
     * not about how many pushes the plan contains.
     */
    it('with door_A ADJACENT to button_A the level solves WITHOUT the block holding it', () => {
        const out = buildReversePull({ len: 3, turns: 1 }, SITE, rngFor(1));
        const exit = out.placement.ports.find((p) => p.role === 'exit');
        const b = out.placement.entities.buttons[0];
        const adjacent = { x: b.x + DIR[exit.dir].dx, y: b.y + DIR[exit.dir].dy };
        const built = worldFor(out.placement, { doorAt: adjacent,
            flagAt: out.placement.entities.obstacles[0] });
        const r = solve(built);
        expect(r.ok).toBe(true);
        const rep = replay(built, r.plan);
        expect(rep.heldAtDoor).toBe(false);      // ← the mechanism was BYPASSED
        expect(rep.pushes).toBe(1);              // ← and "it pushed something" is inert
    });

    /** The same world, unmodified, for contrast — one line, so the pair reads. */
    it('…and the gadget as BUILT crosses that same door with the block on the button', () => {
        const out = buildReversePull({ len: 3, turns: 1 }, SITE, rngFor(1));
        const built = worldFor(out.placement);
        expect(replay(built, solve(built).plan).heldAtDoor).toBe(true);
    });
});
