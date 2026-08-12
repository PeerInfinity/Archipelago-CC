/**
 * seedlingDemo/botDriverV1 — synthesize an input tape that walks the
 * player to a list of targets, at the v1 rung (noclip, one level).
 *
 * ── Why this plans by SIMULATING rather than by solving ───────────────
 * The obvious approach — compute a hold length analytically from the
 * distance — founders on the physics: velocity is not proportional to
 * anything convenient. `Player.input()` overshoots its own speed cap
 * (threshold test, full-magnitude add), so holding a direction produces a
 * ~3-tick limit cycle peaking near 2x `moveSpeed`, and friction is
 * vector-length based, so the two axes are coupled whenever both move.
 * A closed-form solution would be a second model of the physics, free to
 * drift from the first.
 *
 * So the driver runs the REAL physics module in a loop, choosing each
 * tick's held keys greedily, and emits the resulting hold spans as the
 * tape. The physics has exactly one implementation, and the tape is the
 * artifact — which is also what makes the verification honest: the tests
 * re-run the emitted tape through `runTape` independently and check the
 * arrivals, rather than trusting the planner's own running state.
 *
 * ── The braking rule ──────────────────────────────────────────────────
 * Each tick, per axis: hold toward the target if releasing now would stop
 * SHORT of it, otherwise release and coast. "Would stop short" is itself
 * computed by simulating friction-only decay with the real
 * `applyFriction`, so the axis coupling is handled exactly rather than
 * approximated.
 *
 * ── Reachable precision ───────────────────────────────────────────────
 * Movement is quantized by the fact that the player cannot stop instantly.
 * The smallest possible excursion is a single 1-tick tap from rest, which
 * travels 0.8 + 0.55 + 0.30 + 0.05 = 1.70px before friction snaps the
 * velocity to zero. Stopping positions are therefore ~1.70px apart in the
 * worst case, so the tightest *always*-achievable arrival tolerance is
 * half that. DEFAULT_TOLERANCE is 1.0px, comfortably above 0.85.
 */

import { serializeTape } from './tapeFormat.js';
import {
    applyFriction,
    DEFAULT_FRICTION,
    groundTerrain,
    spawnFromBoot,
    step,
} from './playerPhysicsV1.js';

/** See the precision note above: 1.70px quantum → 0.85 worst case. */
export const DEFAULT_TOLERANCE = 1.0;

/** Per-target tick budget. Crossing the 160px world takes well under this. */
export const DEFAULT_MAX_TICKS_PER_TARGET = 400;

/**
 * Displacement the player would still travel if all keys were released
 * now — i.e. friction-only decay to a full stop.
 *
 * Uses the real `applyFriction`, so the vector coupling between axes is
 * exact rather than modelled per-axis. Mirrors the tick order: friction
 * runs BEFORE the move, so each tick contributes its POST-friction
 * velocity.
 */
export function coastDistance(vx, vy) {
    let v = { x: vx, y: vy };
    let dx = 0;
    let dy = 0;
    // The snap-to-zero below 0.05 guarantees termination; the guard is a
    // tripwire for a physics change that breaks that, not flow control.
    for (let i = 0; i < 1000; i++) {
        if (v.x === 0 && v.y === 0) return { dx, dy };
        v = applyFriction(v, DEFAULT_FRICTION);
        dx += v.x;
        dy += v.y;
    }
    throw new Error('coastDistance did not converge — friction no longer snaps to zero?');
}

/**
 * Which keys to hold this tick to approach `target` from `state`.
 *
 * Exported for `botDriverV2`: the pathing driver replaces WHERE it aims
 * (waypoints from A* rather than the caller's target) and WHAT it drives
 * (the real level, through `createLevelRun`), but the controller itself is
 * this one. Two braking rules would be two models of the same physics.
 */
export function chooseHeld(state, target, tolerance) {
    const held = new Set();
    const coast = coastDistance(state.vx, state.vy);

    const dx = target.x - state.x;
    if (Math.abs(dx) > tolerance) {
        // Hold only if coasting from here would leave us short of the
        // target on this axis; otherwise release and let friction land it.
        const remainingAfterCoast = dx - coast.dx;
        if (remainingAfterCoast > 0) held.add('right');
        else if (remainingAfterCoast < 0) held.add('left');
    }

    const dy = target.y - state.y;
    if (Math.abs(dy) > tolerance) {
        const remainingAfterCoast = dy - coast.dy;
        if (remainingAfterCoast > 0) held.add('down');
        else if (remainingAfterCoast < 0) held.add('up');
    }

    return held;
}

/**
 * The arrival criterion, shared with `botDriverV2` for the same reason
 * `chooseHeld` is: v2 carries it over unchanged, per the brief, and a
 * second definition of "arrived" is a second definition of what the
 * fixtures claim.
 */
export function hasArrived(state, target, tolerance) {
    return Math.abs(target.x - state.x) <= tolerance
        && Math.abs(target.y - state.y) <= tolerance
        // Require a full stop: an "arrival" while still moving would be a
        // position the very next tick invalidates, which is not a place the
        // bot can be said to have reached.
        && state.vx === 0
        && state.vy === 0;
}

/**
 * Plan a tape that visits `targets` in order.
 *
 * @param {Array<{x:number,y:number}>} targets
 * @param {object}  [opts]
 * @param {object}  [opts.boot]      `{level, x, y}` (default level 0 @ 80,128 —
 *                                   the skip-splash spawn the bot build boots to)
 * @param {number}  [opts.tolerance]
 * @param {number}  [opts.maxTicksPerTarget]
 * @param {Function}[opts.terrainStateAt]
 * @param {string}  [opts.name]
 * @returns {{tape: object, arrivals: Array<{index:number,target:object,tick:number,x:number,y:number}>}}
 */
export function synthesizeTape(targets, opts = {}) {
    if (!Array.isArray(targets) || targets.length === 0) {
        throw new Error('synthesizeTape: targets must be a non-empty array');
    }
    const {
        boot = { level: 0, x: 80, y: 128 },
        tolerance = DEFAULT_TOLERANCE,
        maxTicksPerTarget = DEFAULT_MAX_TICKS_PER_TARGET,
        terrainStateAt = groundTerrain,
        name,
    } = opts;

    targets.forEach((target, i) => {
        if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) {
            throw new Error(`synthesizeTape: targets[${i}] must be {x, y} finite numbers`);
        }
    });

    const spawn = spawnFromBoot(boot);
    let state = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
    /** @type {Array<Set<string>>} held-key set per tick */
    const perTick = [];
    const arrivals = [];

    targets.forEach((target, index) => {
        let ticksForThisTarget = 0;
        while (!hasArrived(state, target, tolerance)) {
            if (ticksForThisTarget >= maxTicksPerTarget) {
                throw new Error(
                    `synthesizeTape: target ${index} (${target.x},${target.y}) not reached `
                    + `within ${maxTicksPerTarget} ticks; stalled at `
                    + `(${state.x},${state.y}) v=(${state.vx},${state.vy}). `
                    + 'A target outside the world clamp bounds is the usual cause.',
                );
            }
            const held = chooseHeld(state, target, tolerance);
            perTick.push(held);
            state = step(state, held, { terrainStateAt });
            ticksForThisTarget++;
        }
        // Record-then-act indexing: after N recorded ticks the player has
        // completed N movement ticks, so the arrival observation is at
        // index perTick.length.
        arrivals.push({
            index,
            target: { x: target.x, y: target.y },
            tick: perTick.length,
            x: state.x,
            y: state.y,
        });
    });

    return {
        tape: buildTape(perTick, boot, name),
        arrivals,
    };
}

/**
 * Fold a per-tick held-key log into hold spans.
 *
 * Exported because it is the inverse of `heldKeysAt` and the round-trip
 * (`perTick → spans → heldKeysAt`) is worth pinning in tests: an
 * off-by-one here would produce a tape that no longer means what the
 * planner simulated, and the game would be the first to notice.
 *
 * `opts.noclip` defaults TRUE because this module is the v1 rung and every
 * tape it emits runs with collision off. `botDriverV2` passes false — it is
 * the one thing about the emitted tape that differs between the rungs, and
 * it stays an explicit argument rather than a second copy of the fold.
 *
 * ⚠ THE EMITTED TAPE VERSION IS DECIDED BY WHAT THE CALLER DECLARES, not by
 * `tapeFormat.TAPE_VERSION`. Reading the constant would have silently turned
 * every driver-emitted tape into a v2 tape the day R0 bumped it, and the
 * eleven committed fixtures are compared against what the driver emits
 * TODAY — so that bump would have read as eleven fixture changes. Passing
 * any of the three relaxation fields makes it a v2 tape; passing a partial
 * set is a named error rather than a tape with two of three experiments
 * declared.
 *
 * ⚠ AND `persistence` IS SELECTED BY PRESENCE, NOT BY VALUE (R2). A v3 tape
 * carries the field and a v1/v2 tape cannot have one — "versions below 3
 * mean `persistence: []` BY DEFINITION, the build had no such field to
 * read" (`tapeFormat.parseTape`). So an EMPTY clear list is still a v3
 * tape when the caller declares one, and a caller that declares nothing
 * gets the v2 tape it got yesterday, byte for byte. Deciding on the VALUE
 * instead — "empty means v2" — is the R0 value-vs-presence bug: the two
 * consumers would agree about the semantics and disagree about which
 * artifact they were reading.
 */
export function buildTape(perTick, boot = { level: 0, x: 80, y: 128 }, name,
    { noclip = true, noDamage, noHazards, grants, persistence, equips, pins } = {}) {
    const relaxations = { noDamage, noHazards, grants };
    const declared = Object.entries(relaxations).filter(([, v]) => v !== undefined);
    if (declared.length > 0 && declared.length < 3) {
        throw new Error('buildTape: a version 2 tape declares noDamage, noHazards AND '
            + `grants; got only ${declared.map(([k]) => k).join(', ')}. There is no `
            + 'default for a relaxation — the game and the JS engine would be running '
            + 'different experiments.');
    }
    const v2 = declared.length === 3;
    const v3 = persistence !== undefined;
    // R4: `equips` is the version 4 field, and it is version 3 plus the slot
    // — a tape that selects an item must already be declaring clears, for
    // the same reason v3 must declare the v2 relaxations.
    const v4 = equips !== undefined;
    if (v4 && !v3) {
        throw new Error('buildTape: equips is a version 4 field and version 4 is '
            + 'version 3 plus the equip, so a tape that selects a slot must also '
            + 'declare persistence (and therefore noDamage, noHazards and grants).');
    }
    if (v4 && !Array.isArray(equips)) {
        throw new Error('buildTape: equips must be an ARRAY of {t, slot} — [] for '
            + `"this is a v4 tape that equips nothing" — got ${typeof equips}`);
    }
    if (v3 && !v2) {
        throw new Error('buildTape: persistence is a version 3 field and version 3 is '
            + 'version 2 plus clears, so a tape that clears anything must also declare '
            + 'noDamage, noHazards and grants.');
    }
    /**
     * ⛔⛔ R5 SLICE 16 — VERSION 5, AND ITS ABSENCE WAS A SILENT DROP.
     *
     * `synthesizeLegs` has handed `relax.pins` to `createLevelRun` since
     * slice 4 — the run really is pinned, and the docblock there says "the
     * emitted tape carries the same list, per the `relax` rule that one
     * object decides the plan AND the tape". It did not: this function
     * stopped at version 4, so `pins` fell off the end of the destructuring
     * and every synthesized tape was UNPINNED however the plan was written.
     * The driver verified one execution and the tape asked the game for
     * another — the exact failure the `equips` docblock forty lines up was
     * written about, in the same function, one version later.
     *
     * Nothing caught it because the only pinned tape in the tree
     * (`r5-bosskey-leg`) is hand-authored.
     *
     * Version 5 is version 4 plus the pins, for the same reason 4 is 3 plus
     * the equip: a tape that selects an execution must already be declaring
     * everything below it.
     */
    const v5 = pins !== undefined;
    if (v5 && !v4) {
        throw new Error('buildTape: pins is a version 5 field and version 5 is version 4 '
            + 'plus the determinism pins, so a tape that pins anything must also declare '
            + 'equips (and therefore persistence, noDamage, noHazards and grants).');
    }
    if (v5 && !Array.isArray(pins)) {
        throw new Error('buildTape: pins must be an ARRAY of pin names — [] for "this is '
            + `a v5 tape that pins nothing" — got ${typeof pins}`);
    }
    if (v3 && !Array.isArray(persistence)) {
        throw new Error('buildTape: persistence must be an ARRAY of {level, tag, note} '
            + `— [] for "this is a v3 tape that clears nothing" — got ${typeof persistence}`);
    }

    const open = new Map();   // key → span start tick
    const inputs = [];

    perTick.forEach((held, tick) => {
        for (const key of held) {
            if (!open.has(key)) open.set(key, tick);
        }
        for (const [key, from] of [...open.entries()]) {
            if (!held.has(key)) {
                inputs.push({ key, from, to: tick });
                open.delete(key);
            }
        }
    });
    for (const [key, from] of open.entries()) {
        inputs.push({ key, from, to: perTick.length });
    }

    return {
        tape_version: v5 ? 5 : (v4 ? 4 : (v3 ? 3 : (v2 ? 2 : 1))),
        game: 'seedling',
        ...(name ? { name } : {}),
        boot: { level: boot.level, x: boot.x, y: boot.y },
        noclip,
        ...(v2 ? { noDamage, noHazards, grants } : {}),
        ...(v3 ? { persistence } : {}),
        ...(v4 ? { equips } : {}),
        ...(v5 ? { pins } : {}),
        tick_count: perTick.length,
        inputs,
    };
}

/**
 * A SOLVED segment's tape: the staging block it was solved from, plus the
 * inputs the solver derived.
 *
 * ── WHY THIS IS A FUNCTION AND NOT EIGHTEEN LINES IN EACH CALLER ──────
 *
 * `buildTape` above is the ONE span fold, and its docblock says the fields
 * above version 5 are "assembled by callers". That was true and it was the
 * gap: every solve script assembled the v8 header itself, and the editor
 * page would have been the next to. The fold is shared and the assembly
 * was not, so a caller that forgot `seam` would emit a tape the game boots
 * into a different room — silently, because every OTHER field would match.
 *
 * ⚠ THE FOLD IS CALLED WITH EMPTY RELAXATIONS ON PURPOSE. `buildTape`
 * decides its own version from what it is DECLARED (presence, not value),
 * and only its `inputs` are used here — the header it returns is thrown
 * away and replaced by the staging block's real fields. Passing the real
 * `noHazards`/`grants` to the fold would change nothing but would suggest
 * the fold's header mattered.
 *
 * ⛔ AND IT REFUSES A v10 STAGING BLOCK rather than mislabelling one. The
 * emitted header says version 8, which is the vocabulary this assembly
 * writes; a non-empty `despawn` is a version 10 fact and a tape that
 * declared it under a version 8 label would be read by `parseTape` as a
 * tape whose despawns "mean [] BY DEFINITION".
 *
 * ⛔⛔ …AND A v9 ONE, WHICH WAS MISSING AND HAD A LIVE VICTIM (editor arc
 * slice 3). `persistence[].at` — a MID-RUN clear — is a version 9 fact, and
 * `requiredTapeVersion` has always known it (`usesAt ? 9 : floor`). The
 * despawn guard was written and the `at` guard was not, so this assembly
 * emitted a version 8 header around a version 9 field for SIX of the 153
 * committed boots (`r7-act2-5/8/full`, `r8-solve-5/8/18`).
 *
 * ⚠ MEASURED, NOT REASONED: solving in the page from `r8-solve-18`'s own
 * boot block produces a tape the page's own REPLAY arm then REFUSES —
 * "`tape_version 8` has no mid-run clear". Slice 1 shipped that arm and
 * slice 2's acceptance row solved from `r7-act2-4`, a v8 boot, so nothing
 * met it. Found by slice 3's manual arm, which folds through this same
 * function and sweeps a wider set of boots.
 *
 * The refusal is the fix in scope: an unparseable artifact becomes a named
 * refusal at the moment of assembly. EXTENDING the assembly to v9/v10 is the
 * real repair and is a deliberate act with its own gate — the same sentence
 * the v10 guard has said since it was written.
 */
export function buildStagedTape({ staging, perTick, name }) {
    if ((staging.despawn ?? []).length > 0) {
        throw new Error('buildStagedTape: this staging block declares '
            + `${staging.despawn.length} despawn(s), which is a version 10 field, but this `
            + 'assembly writes a version 8 header — and a v8 tape means `despawn: []` BY '
            + 'DEFINITION. Emitting it would silently drop the removals. Extend the '
            + 'assembly to v10 rather than labelling one version as another.');
    }
    const midRun = (staging.persistence ?? []).filter((c) => c.at !== undefined);
    if (midRun.length > 0) {
        throw new Error('buildStagedTape: this staging block declares '
            + `${midRun.length} MID-RUN clear(s) (`
            + `${midRun.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(', ')}`
            + '), which is a version 9 field, but this assembly writes a version 8 header '
            + '— and a v8 tape means every clear "applies before the first live tick BY '
            + 'DEFINITION". Emitting it would produce a tape `parseTape` refuses outright, '
            + 'which is what it did for six committed boots before this guard existed. '
            + 'Extend the assembly to v9 rather than labelling one version as another.');
    }
    const folded = buildTape(perTick, staging.boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return {
        game: 'seedling',
        name,
        boot: staging.boot,
        noclip: false,
        noDamage: false,
        noHazards: staging.noHazards,
        grants: staging.grants,
        persistence: staging.persistence,
        equips: staging.equips,
        pins: staging.pins,
        save: staging.save,
        rng: staging.rng,
        seam: staging.seam,
        tick_count: perTick.length,
        inputs: folded.inputs,
        tape_version: 8,
    };
}

/** Convenience: synthesize and serialize in one step. */
export function synthesizeTapeJson(targets, opts = {}) {
    return serializeTape(synthesizeTape(targets, opts).tape);
}
