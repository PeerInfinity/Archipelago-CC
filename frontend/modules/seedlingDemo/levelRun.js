/**
 * seedlingDemo/levelRun — ONE run of the v2 engine across levels, with the
 * end-of-tick world swap in it.
 *
 * v2 slice 4. This is a factoring, not a new mechanism: every line below
 * was `tapeRunner`'s loop, and it moved here the moment a SECOND caller
 * appeared. `botDriverV2` has to advance the same physics through the same
 * transitions while CHOOSING each tick's keys instead of reading them off a
 * tape, and the two ways of getting a held-key set must not each grow their
 * own idea of what a world swap is.
 *
 * That is not a tidiness argument. The swap is five coupled facts — the
 * arrival offset, the zeroed velocity, the reset terrain state, the
 * pre-armed latch, and the destination world's own `beforeTypeFlip` tick —
 * and a second copy would agree with the first exactly until one of them
 * was edited. The differential could not catch it either, because the
 * driver's copy is what SYNTHESIZES the tape the differential then runs
 * through the runner's copy: they would be wrong together and the tape
 * would still reconcile. (The same failure mode as a verifier sharing the
 * generator's assumptions, and the same fix — one implementation.)
 *
 * ── What this owns, and what it does not ──────────────────────────────
 * It owns: which level we are in, that level's world, the physics state,
 * the latch, the `beforeTypeFlip` flag, the transition log, and the count
 * of completed ticks. It does NOT own the observation stream — that is
 * RECORD-THEN-ACT bookkeeping and belongs to whoever is recording (see
 * `tapeRunner`), because "record the state, then advance" is a rule about
 * the AS3 hook's position, not about the engine.
 *
 * Worlds are built lazily and memoised, for the reason `playerPhysicsV2`'s
 * docblock gives: `buildLevelWorld` throws by name on geometry v2 does not
 * model, and that throw should fire when a run walks INTO a level, naming
 * it, rather than eagerly for all 116.
 */

import { buildLevelWorld, rectsOverlap } from './levelWorld.js';
import {
    INITIAL_FRAMES_THIS_CHARACTER, PICKUP_CEREMONY, TALK_KEY,
    beginDialogue, stepDialogue,
} from './dialogue.js';
import {
    createActivatorState, openActivatorIds, stepActivators,
} from './activators.js';
import { ITEM_PROPERTIES, ITEM_NAMES } from './tapeFormat.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import {
    INITIAL_TERRAIN_STATE,
    arriveFromFall,
    arriveIn,
    initialLatch,
    playerBoxAt,
    step as stepV2,
} from './playerPhysicsV2.js';

/**
 * The inventory a fresh boot starts from — every boolean false, `hitsMax`
 * at `Player.hitsMaxDef` (3).
 *
 * ⚠ THIS IS A MIRROR, NOT THE ORACLE. `Bot.as` writes the real `Player`
 * statics and `botStatus.items` reads them back, and that readout is what
 * an acceptance assertion must consult. This object exists so the JS engine
 * can be asked "which items would the game have by now" without a second
 * source of truth about WHEN — the two sides share the tick contract, not
 * the storage. A test that asserted an item from here instead of from the
 * game's own report would be asserting that this file agrees with itself.
 */
export function initialInventory() {
    const inv = {};
    for (const name of ITEM_NAMES) {
        const spec = ITEM_PROPERTIES[name];
        inv[spec.property] = spec.kind === 'add' ? spec.base : false;
    }
    return inv;
}

/** Apply one item name to an inventory mirror, in place. */
function applyItem(inventory, name) {
    const spec = ITEM_PROPERTIES[name];
    if (spec.kind === 'add') inventory[spec.property] += spec.value;
    else inventory[spec.property] = true;
}

/**
 * Start a run at `boot`, in the level the boot names.
 *
 * @param {object}   opts
 * @param {Function} opts.levelSource  `(level) => levelRecord` — the ONE seam
 *                                     by which real geometry enters
 * @param {object}   opts.boot         `{level, x, y}` GAME CONSTRUCTOR args;
 *                                     the half-tile spawn offset is applied here
 * @param {boolean}  opts.noclip       the tape's flag: picks the arm of the AS3's
 *                                     `Bot.noclip ? null : collideTypes(...)`
 * @param {Array}    [opts.noHazards]  the tape's hazard-name set (R0)
 * @param {boolean}  [opts.noDamage]   the tape's flag (R0). Carried, not
 *                                     consumed — see the note on `noDamage` below.
 * @param {Array}    [opts.grants]     the tape's `{level, items}` list (R0)
 * @returns {{
 *   level: number, world: object, state: object, transitions: Array,
 *   ticksCompleted: number, advance: (held: Set<string>) => object,
 * }} a live view — `level`/`state`/... are getters over the run's own state,
 *    so a caller may hold the object and read fields after each `advance`.
 *
 * ⚠ `noDamage` IS CARRIED AND NOT CONSUMED, and that is a bounded vacuity
 * rather than an oversight. The JS engine models no enemy, no projectile and
 * no trap, so there is no site at which `Player.hit()` would have been
 * called — `noDamage: false` is equally inert here. It is threaded anyway so
 * the tape schema is symmetric and the field reaches the game, which is
 * where it does something. The witness that would close it is the first
 * fixture whose route is in range of a damage source, i.e. R5.
 */
export function createLevelRun({
    levelSource, boot, noclip = false, noHazards = [], noDamage = false, grants = [],
    persistence = [], roles,
}) {
    if (typeof levelSource !== 'function') {
        throw new TypeError('createLevelRun needs a levelSource (level) => levelRecord');
    }

    // `roles` is the census a caller consults (see `levelWorld.ROLES`).
    // Undefined means the builder's own default, which is ALL roles — so
    // every pre-R0 caller keeps exactly the census it had.
    const worlds = new Map();
    /**
     * R2: the tape's persistence clears, indexed BY LEVEL.
     *
     * A clear is `(level, tag)` and a world is built per level, so the run
     * hands each level only its own tags. Passing the whole list would make
     * `buildLevelWorld`'s orphan guard fire for every level that does not
     * happen to own one — which is every level but a handful.
     */
    const clearedByLevel = new Map();
    for (const c of persistence) {
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }
    const worldFor = (n) => {
        if (!worlds.has(n)) {
            const opts = { ...(roles ? { roles } : {}) };
            if (clearedByLevel.has(n)) opts.cleared = clearedByLevel.get(n);
            worlds.set(n, buildLevelWorld(levelSource(n),
                Object.keys(opts).length > 0 ? opts : undefined));
        }
        return worlds.get(n);
    };
    /**
     * R2: per-level activator state (buttons, locks, covers).
     *
     * ⚠ PER LEVEL AND PER VISIT. `Game` is reconstructed on every world
     * swap, so a Lock that was open when the player left is a fresh
     * `type = normType` when they come back — unless the persistence its
     * `turnOff()` wrote is what despawns it, which is a different
     * mechanism entirely. Memoising this alongside the world would keep a
     * lock open across a round trip the game closes.
     */
    const activatorStates = new Map();
    const activatorStateFor = (n) => {
        const w = worldFor(n);
        if (!activatorStates.has(n)) activatorStates.set(n, createActivatorState(w));
        return activatorStates.get(n);
    };
    const freshActivatorState = (n) => {
        activatorStates.set(n, createActivatorState(worldFor(n)));
        return activatorStates.get(n);
    };

    let level = boot.level;
    let world = worldFor(level);
    const spawn = spawnFromBoot(boot);
    let state = {
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        terrain: INITIAL_TERRAIN_STATE,
        // The boot `Game` arms the latch on its first frame exactly as an
        // arrival does (`Game.as:803-812` runs `check()` above the
        // blackCover gate), so a spawn that sits on a teleporter does not
        // immediately fall through it.
        latched: initialLatch(world, spawn.x, spawn.y),
        hitX: null,
        hitY: null,
    };
    // The world's first LIVE tick, when no Tile has run its own first
    // update yet and so no tile is solid. `blackCover` frames update
    // nothing, so tick 0 is that tick for the boot world — and the tick
    // after an arrival is that tick for the destination world, for exactly
    // the same reason. It is per WORLD, not per run.
    let firstTickInWorld = true;
    let ticksCompleted = 0;
    const transitions = [];
    /**
     * The PIT TRANSPORTS this run drove, `{t, from_level, to_level}` — the
     * subset of `transitions` a fall produced.
     *
     * Deliberately a SEPARATE list rather than a `kind` field on the
     * transition records: those are the minimal symmetric record the
     * differential compares element-wise, and the game side derives them
     * from the level field alone, so it cannot know a kind. This is JS-side
     * bookkeeping, and it exists so a consumer can say "the model expects a
     * transport here" — which is what makes the harness's
     * `saw_input_refused` check TWO-SIDED instead of a blanket tolerance.
     */
    const transports = [];

    // ── grants ────────────────────────────────────────────────────────
    // The shared contract (R0 kickoff §3.1): a grant is applied by BOTH
    // sides on the FIRST OBSERVATION TICK whose level equals the grant's
    // level. Observation `t` is the state after `t` completed ticks, and a
    // world swap lands at END of tick `t`, so "the run's level just became
    // L" and "observation `t` reports level L" are the same instant. Hence
    // the two call sites below and no third: construction (the boot level,
    // observed at tick 0) and immediately after a swap.
    //
    // FIRST entry only — a revisit does not re-grant. For a boolean that is
    // invisible, but `health` ADDS to `hitsMax`, so a re-grant on every
    // visit would silently inflate it.
    const inventory = initialInventory();
    const grantsByLevel = new Map(grants.map((g) => [g.level, g.items]));
    const firedGrants = [];
    const applyGrantsFor = (n) => {
        if (!grantsByLevel.has(n)) return null;
        const items = grantsByLevel.get(n);
        grantsByLevel.delete(n);
        for (const item of items) applyItem(inventory, item);
        const record = { t: ticksCompleted, level: n, items: [...items] };
        firedGrants.push(record);
        return record;
    };
    applyGrantsFor(level);

    // ── the pickup CEREMONY (R3) ──────────────────────────────────────
    /**
     * The ceremony currently running, or null.
     *
     * ⚠ THIS IS THE CRUTCH `grants` USED TO BE. R0 handed an item over as a
     * property write on room entry; R3 walks onto the pickup and lets the
     * game do it, which costs the tape TICKS — and the number of them is
     * what the observation stream measures.
     *
     * Two phases, and only one of them is visible:
     *
     *   PHASE A — `Pickup.pick_up()` sets `Game.freezeObjects` and counts
     *     `specialTimer` down from 150. `Pickup` is the only writer of the
     *     flag on those frames, so the bot's dead-frame gate holds and the
     *     tick counter does not advance. **The stream cannot see phase A at
     *     all**, so this model does not represent it: no ticks, no
     *     observations, nothing to reproduce. (It is 151 dead frames in the
     *     `r3-collect-sword` recording, against 20 for the boot fade.)
     *
     *   PHASE B — the NPC is up. `Game.freezeObjects` now has several
     *     writers and no per-frame reset, so it reads TRUE inside
     *     `Mobile.mobileUpdate` and FALSE again at the next frame's gate:
     *     **the tick counter runs while the player cannot move.** Every
     *     observation repeats the contact position, and the TAPE supplies
     *     the X releases, because `NPC.talk()` reads `Input.released` from
     *     the NPC's own update, outside the frozen block.
     *
     * ⚠ VELOCITY SURVIVES. `mobileUpdate` skips friction, input AND the
     * move, so `v` is exactly what it was when the freeze began — which is
     * why `r3-collect-sword` shows the player still drifting for three
     * ticks after the ceremony (61.65 -> 61.00 -> 60.60 -> 60.45) before
     * friction stops it. Not stepping is therefore the whole model: nothing
     * about the state is reset.
     */
    let ceremony = null;
    /** `${level}:${x},${y}` of every pickup this run has already taken. */
    const collectedPickups = new Set();
    const pickupKey = (n, p) => `${n}:${p.x},${p.y}`;
    /** One record per completed ceremony, for the acceptance ledger. */
    const collected = [];
    /**
     * `Game.framesThisCharacter`, which is a `Game` FIELD and not the NPC's.
     *
     * ⚠ It carries across dialogues within one level and is fresh only on a
     * world swap, so two ceremonies in the same room do NOT cost the same
     * number of ticks. Owned here rather than inside a dialogue because a
     * dialogue does not outlive its NPC and this does.
     */
    let framesThisCharacter = INITIAL_FRAMES_THIS_CHARACTER;

    /** The item a pickup grants, and the text its ceremony shows. */
    function ceremonyFor(p) {
        const entry = PICKUP_CEREMONY[p.tag];
        if (!entry) {
            throw new Error(`levelRun: the player is standing on a "${p.tag}" pickup `
                + 'with no ceremony entry. Add it to `dialogue.PICKUP_CEREMONY` with its '
                + 'item name and its verbatim text — an unpriced pickup would cost the '
                + 'tape an unknown number of ticks and every observation after it would '
                + 'be shifted.');
        }
        return entry;
    }

    /**
     * The release EDGE the ceremony's dialogue reads.
     *
     * `Input.released(k)` is true on the frame the KEY_UP was dispatched,
     * which for a span `{from, to}` is tick `to` — held at `to - 1` and not
     * at `to`. The run derives it rather than being told, so the driver and
     * the runner cannot grow two ideas of what a release is.
     */
    let prevHeld = new Set();
    const releasedThisTick = (held, key) => prevHeld.has(key) && !held.has(key);

    /**
     * Does the CURRENT position stand on an uncollected pickup?
     *
     * ⚠ Tested BEFORE the step, because `World.addUpdate` PREPENDS and
     * `loadlevel` adds the Player before the pickups — so a `Pickup` tests
     * the position the PREVIOUS tick left, exactly as a teleporter does.
     * The recording agrees: the contact observation is 23 and the freeze
     * covers 23..57, i.e. the pickup saw observation 23 and the advance that
     * would have produced 24 became phase B's first frame instead.
     */
    function pickupUnderfoot() {
        if (!world.pickups) return null;
        const box = playerBoxAt(state.x, state.y);
        for (const p of world.pickups) {
            if (collectedPickups.has(pickupKey(level, p))) continue;
            if (rectsOverlap(box, p.rect)) return p;
        }
        return null;
    }

    return {
        get level() { return level; },
        get world() { return world; },
        get state() { return state; },
        get transitions() { return transitions; },
        /** The `transitions` entries a PIT FALL produced, not a teleporter. */
        get transports() { return transports.map((r) => ({ ...r })); },
        get ticksCompleted() { return ticksCompleted; },
        get inventory() { return { ...inventory }; },
        /**
         * One record per completed ceremony: `{t, level, item, frames}`.
         *
         * The crutch LEDGER at R3. A grant that fired is in `grantsFired`;
         * an item that was walked over and talked through is here. The
         * claim "collected for real, not granted" is exactly the statement
         * that the first list is empty and this one is not.
         */
        get collected() { return collected.map((c) => ({ ...c })); },
        /** `{t, level, items}` per grant that fired, in firing order. */
        get grantsFired() { return firedGrants.map((g) => ({ ...g, items: [...g.items] })); },
        /**
         * Levels named by `grants` the run never entered. A grant that never
         * fires is a ROUTE CLAIM that silently stopped being true, which is
         * exactly how a routing regression hides behind a green tape — so
         * the caller turns a non-empty list into a named failure.
         */
        get unfiredGrantLevels() { return [...grantsByLevel.keys()]; },
        get noDamage() { return noDamage; },
        /**
         * The activator ids that are NOT solid right now, in the level the
         * run is in — or `null` under `noclip`, matching the arm `advance`
         * hands `stepV2`.
         *
         * ⚠ THIS IS THE PLANNER'S ONLY LEGITIMATE VIEW OF AN OPEN LOCK.
         * `botDriverV2` re-plans before every target, and a Lock's solidity
         * is per-tick state: shut, then open after 101 ticks on its button,
         * then shut again the moment the player steps off a volume they are
         * not inside. A planner with its own idea of which locks are open
         * would certify a route the executor then walks into a wall on —
         * the walkTo-divergence lesson, one mechanic later. Reading it off
         * the run means the two cannot disagree.
         */
        get openActivators() {
            return noclip ? null : openActivatorIds(activatorStateFor(level));
        },
        /** Build (and memoise) another level's world — for planning ahead. */
        worldFor,

        /**
         * Run one tick with `held` down, applying the end-of-tick swap if a
         * teleporter fired.
         *
         * Returns `{transition, hitX, hitY}` for this tick: `transition` is
         * the `{t, from_level, to_level}` record that was just appended (or
         * null), and the two hits are the sweep results the AS3 caller
         * discards — the driver needs them to tell "walked the whole way"
         * from "stopped early", which is the difference between a plan that
         * worked and a planner bug.
         *
         * ⚠ On a transition the returned `hitX`/`hitY` are the OLD player's,
         * from the last doomed step it completes in the old level before the
         * swap. That step is never observed; the hits are reported anyway
         * rather than swallowed, because a caller that wants to ignore them
         * can, and one that wants them cannot get them back.
         */
        advance(held) {
            // The player reads the activator state as of the END of the
            // previous tick: `World.addUpdate` PREPENDS and `loadlevel` adds
            // the Player LAST, so the Player updates before every Button and
            // every Lock. Stepping the machinery first would open a lock one
            // tick early, in every run, forever.
            const activators = activatorStateFor(level);

            // ── the ceremony, before anything else ─────────────────────
            // A pickup updates BEFORE the player, so a contact found here
            // is a contact the game found on this frame too. Starting one
            // and stepping one are the same branch: phase A is invisible,
            // so the advance that discovers the contact IS phase B's first
            // frame.
            if (ceremony === null) {
                const hit = pickupUnderfoot();
                if (hit) {
                    const entry = ceremonyFor(hit);
                    ceremony = {
                        pickup: hit,
                        level,
                        item: entry.item,
                        // ⚠ `text: ''` is a REAL case (a totem part, a
                        // non-zero boss key): `pick_up()` spawns no NPC, so
                        // phase A runs and the pickup removes itself with no
                        // dialogue at all. Charging it a dialogue would cost
                        // the tape ticks the game never spends.
                        dialogue: entry.text === ''
                            ? null
                            : beginDialogue(entry.text, { framesThisCharacter }),
                    };
                }
            }
            if (ceremony !== null) {
                const released = releasedThisTick(held, TALK_KEY);
                prevHeld = new Set(held);
                if (ceremony.dialogue) stepDialogue(ceremony.dialogue, released);
                const finishing = ceremony.dialogue === null || ceremony.dialogue.done;
                if (finishing) {
                    // `removeSelf()` -> `removed()`: the property write and
                    // `Game.setPersistence`. The item lands HERE and not on
                    // contact, which is the whole difference between a real
                    // collection and R0's grant.
                    collectedPickups.add(pickupKey(ceremony.level, ceremony.pickup));
                    // `item: null` is a pickup the fourteen-property mirror
                    // does not track (a boss key, a totem part) — the
                    // ceremony is real, there is just nothing to apply.
                    if (ceremony.item) applyItem(inventory, ceremony.item);
                    collected.push({
                        t: ticksCompleted + 1,
                        level: ceremony.level,
                        item: ceremony.item,
                        frames: ceremony.dialogue ? ceremony.dialogue.frames : 1,
                    });
                    if (ceremony.dialogue) {
                        framesThisCharacter = ceremony.dialogue.framesThisCharacter;
                    }
                    ceremony = null;
                    // ⚠ AND THEN FALL THROUGH TO A NORMAL STEP. The frame
                    // that ENDS a dialogue is not a frozen frame: the NPC
                    // updates BEFORE the player (`World.addUpdate` PREPENDS
                    // and the temporary NPC is added last), so `talking =
                    // false` has already cleared `Game.freezeObjects` by the
                    // time `Mobile.mobileUpdate` reads it, and the player
                    // moves on that very tick. The oracle says so exactly:
                    // `r3-collect-sword` is frozen for observations 24..57
                    // and observation 58 — the completing one — is already
                    // back in motion at y 61.00, carrying the velocity the
                    // freeze preserved. Counting it as frozen made the model
                    // one tick long and was the only divergence in the
                    // whole ceremony.
                } else {
                    ticksCompleted++;
                    // The game keeps updating every non-Mobile entity
                    // through a freeze, so a Button under the frozen player
                    // stays pressed and a Lock's fade keeps running.
                    // Unobservable on R3's route — no ceremony is near a
                    // presser — but transcribed rather than assumed,
                    // because "no route does that yet" is how the statue got
                    // its offset wrong for two slices.
                    if (!noclip) {
                        stepActivators(activators, world, playerBoxAt(state.x, state.y));
                    }
                    // No step: the position is unchanged and — critically —
                    // so is the VELOCITY, which is why the player drifts on
                    // for a few ticks once the freeze lifts.
                    return {
                        transition: null, grant: null, hitX: null, hitY: null,
                        frozen: true,
                    };
                }
            } else {
                prevHeld = new Set(held);
            }
            const next = stepV2(state, held, {
                level: world,
                noclip,
                noHazards,
                beforeTypeFlip: firstTickInWorld,
                openActivators: noclip ? null : openActivatorIds(activators),
            });
            ticksCompleted++;
            // ...and THEN Button.update and Lock.update run, against where
            // the player ended up.
            if (!noclip) stepActivators(activators, world, playerBoxAt(next.x, next.y));
            const hits = { hitX: next.hitX, hitY: next.hitY };

            if (!next.transition) {
                state = next;
                firstTickInWorld = false;
                return { transition: null, grant: null, ...hits };
            }

            // End-of-tick: `Engine.checkWorld` swaps only after the whole
            // tick has run, so `next` is the old player's last (never
            // observed) position and the state that survives is the arrival.
            // `ticksCompleted` is now "the number of completed movement
            // ticks", which is exactly the index of the first observation
            // showing the new level — the §1 ruling 2 definition of `t`.
            const record = {
                t: ticksCompleted,
                from_level: next.transition.from_level,
                to_level: next.transition.to_level,
            };
            transitions.push(record);
            if (next.transition.kind === 'fall') transports.push({ ...record });
            level = next.transition.to_level;
            world = worldFor(level);
            // A new `Game` means new entities: every lock is solid again.
            if (!noclip) freshActivatorState(level);
            // ONE swap, TWO arrival kinds. A fall lands the player at the
            // ctor args `checkFallingInPit` computed, `fallFromCeiling`, 83
            // px above where it will end up; a teleporter lands them at its
            // own oel attrs, on the ground. Everything else about the swap —
            // when it happens, the fresh velocity and terrain, the pre-armed
            // latch, the destination world's own `beforeTypeFlip` tick — is
            // shared, which is the point of the transition record carrying a
            // `kind` rather than the caller sniffing which fields are set.
            state = next.transition.kind === 'fall'
                ? arriveFromFall(world, next.transition.ctor)
                : arriveIn(world, next.transition.teleporter);
            firstTickInWorld = true;
            // `ticksCompleted` is already the arrival observation's index, so
            // the grant's `t` is that observation — the same tick the
            // transition record carries, and the same tick `Bot.as` applies
            // it on. Applied AFTER the swap, so a grant naming the level
            // being LEFT does not fire on the way out.
            const grant = applyGrantsFor(level);
            return { transition: record, grant, ...hits };
        },
    };
}
