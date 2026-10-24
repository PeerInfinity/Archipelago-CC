/**
 * seedlingDemo/burnableTree — THE EIGHTH GEOMETRY FAMILY: a 2x2 solid that
 * a FIRE press removes, twenty animation frames later.
 *
 * R5 slice 12 step 2. `FIRE_ARM_POLICY.BurnableTree` has been `refused`
 * since slice 11 named it — the census could not even SEE the class, because
 * `PRESS_ARMS` is keyed on the class `genericHit` TESTS (`Tree`) and the
 * lookup is by the class the entity IS. This is the arm.
 *
 * ── ⛔ FIVE THINGS THE SOURCE SAYS THAT A READER WOULD GUESS WRONG ────
 *
 * 1. **IT IS SOLID FOR THE WHOLE BURN.** `hit()` does three things —
 *    `playSound`, `burn = true`, `sprBurnableTreeBurn.play("burn")` — and
 *    removes NOTHING. The cell opens when the animation's callback fires,
 *    not when the press lands. A leg that walks on the press tick walks
 *    into a wall.
 *
 * 2. **THE PERSISTENCE WRITE IS IN `removed()`, AT ANIM END** — the
 *    OPPOSITE of `FallRock`, whose `fall()` writes on the trigger frame
 *    (slice 10 spent a slice on that one). So the flag and the geometry
 *    land together here, and a model that banked the write at the hit
 *    would be ~41 ticks early.
 *
 * 3. **`type = "Solid"`, NEVER `"Tree"`** — and the constructor says why:
 *    *"NOT a tree. Done so it doesn't loop with the other trees."* So it
 *    is not in the `Tree` type at all, `resetSurroundingTreeFrames` is the
 *    only thing that treats it as one, and a census keyed on the type
 *    finds a Solid.
 *
 * 4. **`check()` KILLS IT AT BUILD TIME** when `tag >= 0 &&
 *    !Game.checkPersistence(tag)` — i.e. once the flag is cleared, every
 *    later `new Game` builds the room WITHOUT the tree. ⇒ a window that
 *    boots after the burn must DECLARE the flag, or it boots into a room
 *    the previous window has already opened and the model has not.
 *
 * 5. **A `tag = -1` TREE IS PER VISIT.** The `tag >= 0` guard means a
 *    defaulted tag never satisfies `check()`, so the tree is rebuilt whole
 *    by every `new Game` — L32's arena exit is one of these and L40's is
 *    `tag 0`, i.e. `{40,0}`, which persists. Two trees, two lifetimes.
 *
 * ⚠ AND THE REMOVAL IS ±1, EXACTLY AS THE ROCK'S IS. `World.update` runs
 * each entity's `_graphic.update()` in list order, so whether the callback
 * fires before or after the player's `hit()` in the same pass depends on
 * `Game.as`'s add order. The model takes the LATER: clearing the cell early
 * plans a step the game refuses, clearing it late only makes a leg wait.
 */

import { animCallbackTick, FP_MAX_ELAPSED, outOfBandFlagFor } from './breakableRocks.js';

export class BurnableTreeError extends Error {
    constructor(message) { super(message); this.name = 'BurnableTreeError'; }
}
const fail = (m) => { throw new BurnableTreeError(m); };

/**
 * `sprBurnableTreeBurn.add("burn", [0..19], 15)` — twenty frames at rate
 * 15, `loop` defaulted TRUE, with `burnEnd` as the Spritemap's `complete`
 * callback (`new Spritemap(img, 32, 32, burnEnd)`).
 *
 * ⚠ The loop flag is irrelevant to the OUTCOME and is transcribed anyway:
 * `burnEnd` calls `die()`, which removes the entity, so the wrap that
 * would restart the animation is never seen. Recording it is what stops
 * the next reader deciding the animation "must" be non-looping.
 */
export const BURN_ANIM = Object.freeze({ frames: 20, frameRate: 15, loop: true });

/** The sprite is 32x32 and `centerOO()`-ed: a 2x2 solid on its own cell. */
export const BURN_SPRITE = Object.freeze({ w: 32, h: 32 });

/**
 * Ticks from the tick the FIRE rect fired to the tick the tree is gone.
 *
 * ⛔ SIMULATED, NOT DIVIDED — `animCallbackTick` transcribes
 * `Spritemap.update`'s `while (_timer >= 1)` loop. `15 * 0.0333` is
 * **0.4995**, not 0.5, so twenty frames do not take forty updates: the
 * fractional deficit accumulates and the twentieth index lands one update
 * later than the closed form says. `bobBoss.BURNABLE_TREE` derived the
 * same number for L28's arena exit two slices ago; it is shared here
 * rather than re-derived, and the test pins the two together.
 */
export const HIT_TO_GONE_TICKS = animCallbackTick(BURN_ANIM, FP_MAX_ELAPSED);

/**
 * The leg obligation — how long a leg must wait after the press before it
 * may plan THROUGH the cell.
 *
 * Not `HIT_TO_GONE_TICKS` reused. One is the transcription and one is the
 * promise, and the gap between them is the ±1 the graphic-update order
 * makes unknowable plus room for the press window itself (the fire rect
 * fires on T+4..T+8, and a leg anchors on the PRESS).
 */
export const WAIT_AFTER_PRESS_TICKS = HIT_TO_GONE_TICKS + 12;

/** Per-VISIT burn state for one level, keyed by tree id. */
export function createBurnState() {
    return new Map();
}

/**
 * `BurnableTree.hit("Fire")`.
 *
 * @param {Map} state    from `createBurnState`
 * @param {object} tree  `{id, tag}` from the world's `burnableTrees`
 * @param {number} firedTick  the tick the FIRE rect dispatched
 * @returns {{started:boolean, goneAt:number, why:string|null}}
 */
export function burnTree(state, tree, firedTick) {
    if (!tree?.id) fail('burnTree: a tree needs an id — the state is keyed by it');
    if (!Number.isInteger(firedTick) || firedTick < 0) {
        fail(`burnTree: firedTick must be a non-negative integer, got ${firedTick}`);
    }
    const already = state.get(tree.id);
    if (already) {
        // `hit()`'s body is `if (t == "Fire" && !burn)`, so a second press
        // on a burning tree is a REAL no-op — not a restart, not a second
        // write. Reported rather than swallowed so an audit can say the
        // press was refused and by what.
        return { started: false, goneAt: already.goneAt, why: 'the tree is already burning (`!burn`)' };
    }
    const goneAt = firedTick + HIT_TO_GONE_TICKS;
    state.set(tree.id, { id: tree.id, tag: tree.tag, firedTick, goneAt });
    return { started: true, goneAt, why: null };
}

/**
 * Which of this level's burnable trees are GONE as of `tick`.
 *
 * ⚠ `>=`, and the tick is the one the geometry query is being made FOR.
 * The tree is still a solid on every tick before `goneAt`.
 */
export function burnedTreeIds(state, tick) {
    const gone = new Set();
    for (const b of state.values()) if (tick >= b.goneAt) gone.add(b.id);
    return gone;
}

/**
 * The persistence writes owed as of `tick`, one per tree whose animation
 * has completed.
 *
 * ⛔ AT ANIM END, NOT AT THE HIT — `removed()` is what calls
 * `Game.setPersistence(tag, false)`, and `removed()` runs when
 * `FP.world.remove(this)` is processed. A set has no timestamps, so a
 * model that banked this at the press would pass a ledger check and be
 * forty-one ticks wrong about when the room changed.
 *
 * ⚠ A `tag < 0` tree writes through the OUT-OF-BAND family, exactly like
 * `Fire`/`BreakableRock`/`DarkSword`: `setPersistence(-1, false)` lands at
 * `i * 30 + j` in another level's slot. It is NOT a no-op.
 */
export function burnWrites(state, tick, level) {
    if (!Number.isInteger(level)) fail('burnWrites: needs the level the trees are in');
    const out = [];
    for (const b of state.values()) {
        if (tick < b.goneAt) continue;
        // ⚠ ONE CALL FOR BOTH CASES, deliberately. `outOfBandFlagFor` IS
        // the index arithmetic (`level * 30 + tag`, re-split), so a `tag
        // = -1` tree resolves to the previous level's last slot by the
        // same line that resolves a tagged one to its own. Branching here
        // would be two spellings of one formula, and the `outOfBand` flag
        // it returns is what tells the two apart downstream.
        out.push({ id: b.id, t: b.goneAt, flag: outOfBandFlagFor(level, b.tag) });
    }
    return out;
}

/**
 * ⛔ THE BUILD-TIME KILL. `check()` is `if (tag >= 0 &&
 * !Game.checkPersistence(tag)) die()`, so a tree whose flag this run has
 * already cleared is NOT PRESENT in the rebuilt level at all.
 *
 * @param {object} tree      `{tag}`
 * @param {Set<number>} cleared  this level's cleared tags
 */
export function treeBuiltIn(tree, cleared) {
    if (!tree || !Number.isInteger(tree.tag)) {
        fail('treeBuiltIn: a tree needs an integer tag — -1 is the constructor default and '
            + 'means "per visit", which is a different answer from "absent"');
    }
    if (tree.tag < 0) return true;
    return !(cleared && cleared.has(tree.tag));
}

/**
 * A leg's promise, asserted rather than assumed.
 *
 * A leg that presses and then walks through the cell has to wait at least
 * `WAIT_AFTER_PRESS_TICKS`; anything less and the model and the game can
 * disagree about whether the cell is open on the tick the walk enters it.
 */
export function assertBurnWaitCovers(waitTicks, what) {
    if (!(waitTicks >= WAIT_AFTER_PRESS_TICKS)) {
        fail(`${what}: a burn leg waits ${waitTicks} tick(s) after the press and the tree `
            + `is solid for ${HIT_TO_GONE_TICKS} of them (20 frames at 15 * 0.0333 = `
            + `0.4995 per update). Wait at least ${WAIT_AFTER_PRESS_TICKS} — the `
            + 'transcription plus the press window plus the ±1 the graphic-update order '
            + 'leaves unknowable. `hit()` removes NOTHING; `burnEnd -> die()` does.');
    }
    return true;
}
