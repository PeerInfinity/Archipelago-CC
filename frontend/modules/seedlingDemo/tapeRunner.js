/**
 * seedlingDemo/tapeRunner — replay a tape through the physics and emit an
 * observation stream in exactly the shape `Bot.as` drains from the
 * recompiled game.
 *
 * The whole point is that this function and the AS3 bot's armed loop are
 * the same algorithm written twice, so the differential compares physics
 * rather than bookkeeping. The bookkeeping rule is RECORD-THEN-ACT (see
 * `tapeFormat.js`): the AS3 hook sits at the top of `Main.update()`,
 * before `super.update()` runs this tick's movement, so it records the
 * state it can see — which is the result of the PREVIOUS tick — and then
 * dispatches this tick's key edges.
 *
 * Consequence, and the easiest off-by-one in the arc: observation `t` is
 * the state after exactly `t` completed movement ticks. `ticks[0]` is the
 * boot position under no input, and an N-tick tape yields N+1
 * observations (0..N inclusive) — the last one being the only place the
 * final tick's movement is visible.
 *
 * ── Which engine runs ─────────────────────────────────────────────────
 * `opts.levelSource` decides, and it is the ONE seam by which real
 * geometry enters (see `playerPhysicsV2`'s docblock for why injection
 * rather than loading):
 *
 *   without it   the v1 engine — no collision, terrain stubbed to ground.
 *                A `noclip: false` tape is REFUSED rather than run, because
 *                a stream produced without collision disagrees with the
 *                game for a reason the differential would misattribute to
 *                physics.
 *   with it      the v2 engine — the level's real solids and its real,
 *                sticky `getState`, with the sweep's collision test on or
 *                off exactly as the tape's `noclip` flag says. A tape may
 *                cross levels: a fired teleporter swaps the world here, at
 *                end-of-tick, and the destination world is built from the
 *                same source (and memoised) even though nobody named that
 *                level at call time.
 *
 * The v1 fixtures are run BOTH ways by `tapeRunner.test.js`: without a
 * source they are the byte-identical regression net for the v2 refactor,
 * and with one they are 220 further ticks of real routes over which the
 * new terrain resolver has to agree with the recordings too.
 */

import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createLevelRun } from './levelRun.js';
import { RELAXED_ROLES, ROLES } from './levelWorld.js';
import { groundTerrain, spawnFromBoot, step as stepV1 } from './playerPhysicsV1.js';

/**
 * Run `tape` through the physics.
 *
 * @param {object|string} tape        tape object or JSON (re-validated here)
 * @param {object}  [opts]
 * @param {Function} [opts.levelSource]     `(level) => levelRecord`; selects the
 *                                    v2 engine (see the docblock above)
 * @param {Function} [opts.terrainStateAt]  v1-engine terrain probe (default: ground)
 * @param {Function} [opts.onTick]    called as (t, state, held) after each
 *                                    observation is recorded — for tests and
 *                                    the bot driver, never for control flow
 * @returns {{ticks: Array, transitions: Array, final: object}}
 *   `ticks` is the observation stream; `final` is the full physics state in
 *   whichever level the run ended in (including velocity, the sticky
 *   terrain state and the teleporter latch, none of which the game exposes
 *   and the stream therefore cannot carry).
 */
export function runTape(tape, opts = {}) {
    // ⚠ ONE LOOP, TWO FACES. This used to BE the loop; it now drives the
    // stepper below to completion and returns what it returns. The watch
    // page needs to advance a tape one tick at a time, and a second copy of
    // the tick loop — even a "read-only viewer" copy — is the
    // verifier-shared-assumption trap in tooling clothes: the two would
    // agree until one was edited, and the one nobody tests is the one that
    // drifts. `tapeRunner.test.js` pins that stepping a committed fixture to
    // completion yields a stream byte-identical to this.
    const stepper = createTapeStepper(tape, opts);
    let r = stepper.next();
    while (!r.done) r = stepper.next();
    return r.value;
}

/**
 * The INCREMENTAL face of `runTape`, for the watch page.
 *
 * Setup and validation are EAGER — the same throws `runTape` has always
 * made happen when you create the stepper, not when you first advance it,
 * because a caller that gets a stepper back should already know the tape
 * can run. Only the tick loop is lazy.
 *
 * `next()` yields once per OBSERVATION (so `tick_count + 1` times, ending
 * with the disarm tick), each time with:
 *
 *   `observation`  the `{t, x, y, level}` record just pushed
 *   `state`        the full physics state behind it — velocity, the sticky
 *                  terrain state, the latch, the pit-transport phase; none
 *                  of which the stream carries and all of which the viewer
 *                  draws
 *   `held`         the keys this tick will dispatch
 *   `world`        the built level world, for geometry the viewer renders
 *   `transitions` / `grants` / `inventory`  live views, as they accumulate
 *
 * When the loop finishes, the generator's RETURN value is `runTape`'s whole
 * result — which is how the two faces cannot diverge.
 *
 * ⚠ Tooling only. Nothing that makes a claim may consume this instead of
 * `runTape`: the unfired-grant check fires at the END of the loop, so a
 * consumer that stops early skips it, honestly but silently.
 */
export function createTapeStepper(tape, opts = {}) {
    const t = parseTape(tape);
    const { terrainStateAt = groundTerrain, onTick, levelSource } = opts;

    if (!t.noclip && !levelSource) {
        throw new Error(
            'runTape: the tape has noclip=false and no opts.levelSource was given, '
            + 'so there is no collision geometry to run it against. Collision is the '
            + 'v2 rung — running it on the v1 engine would produce a stream that '
            + 'disagrees with the game for a reason the differential would '
            + 'misattribute to physics. Pass a levelSource (node: '
            + "`atlasLevelSource()` from ./levelSource.js).",
        );
    }

    // The v2 engine's level tracking, world swapping and transition log all
    // live in `createLevelRun`, because `botDriverV2` advances the same
    // physics through the same transitions while choosing its keys instead
    // of reading them — and two copies of a five-fact world swap would
    // agree until one was edited. See that module's docblock.
    // `parseTape` normalises a v1 tape's relaxations to version 1's own
    // semantics, so this reads the same three fields for either version and
    // no engine carries a version branch.
    const run = levelSource
        ? createLevelRun({
            levelSource,
            boot: t.boot,
            noclip: t.noclip,
            noHazards: t.noHazards,
            noDamage: t.noDamage,
            grants: t.grants,
            persistence: t.persistence,
            equips: t.equips,
            // R5 slice 4: `pins` reaches the PHYSICS, not just the tape
            // header. `stepV2` refuses a wet tick on a tape that does not
            // pin "sound" — the term reads a wall clock otherwise — so a
            // runner that recorded the field and did not pass it on would
            // refuse every armed-water tape ever written.
            pins: t.pins ?? [],
            // ⚠ The runner consults the SAME census the driver plans with,
            // and `noclip` is what decides it on both sides. A noclip tape
            // asks no collider question, so requiring a blocking
            // classification for every tag in every level it crosses would
            // make the runner refuse tapes the driver can emit — the two
            // would disagree about which levels exist. (`pickup` and
            // `proximity-hazard` stay consulted either way: an unpriced
            // hazard is a level whose behaviour is not modelled at all, and
            // saying so at replay time is cheaper than a red recording.)
            roles: t.noclip ? RELAXED_ROLES : ROLES,
        })
        : null;
    if (!levelSource && t.grants.length > 0) {
        throw new Error(
            'runTape: the tape declares grants but no opts.levelSource was given. The v1 '
            + 'engine has no level tracking, so it could not tell when the run entered a '
            + "granted level — it would silently drop every grant. Pass a levelSource.",
        );
    }

    // The v1 engine keeps its own two lines: no geometry, no transitions,
    // and the entity spawns half a tile in from the constructor args
    // (Player.as:357 — see SPAWN_OFFSET).
    const spawn = spawnFromBoot(t.boot);
    let state = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
    const ticks = [];

    function* loop() {
        // <= tick_count: the final iteration records the last tick's result
        // without dispatching anything, mirroring the bot's disarm tick.
        // RECORD-THEN-ACT stays HERE and not in the run: it is a rule about
        // where the AS3 hook sits, not about the engine.
        for (let tick = 0; tick <= t.tick_count; tick++) {
            const now = run ? run.state : state;
            const observation = {
                t: tick, x: now.x, y: now.y, level: run ? run.level : t.boot.level,
            };
            ticks.push(observation);
            const held = heldKeysAt(t, tick);
            if (onTick) onTick(tick, now, held);
            yield {
                observation,
                state: now,
                held,
                world: run ? run.world : null,
                transitions: run ? run.transitions : [],
                transports: run ? run.transports : [],
                lockSnaps: run ? run.lockSnaps : [],
                collected: run ? run.collected : [],
                grants: run ? run.grantsFired : [],
                inventory: run ? run.inventory : null,
                /**
                 * ⛓⛓ R5 slice 16: the live crushers and what each one CAN
                 * SEE this tick — forwarded because a parked crusher is a
                 * live scanner and auditing a leg beside one is a per-tick
                 * question. Reading them off this loop is what keeps the
                 * audit and the run one walk; the alternative is a second
                 * `createLevelRun` driven from the same tape, which is a
                 * second copy of the tick loop wearing a plan script.
                 */
                crushers: run ? run.crushers : null,
                crusherScans: run ? run.crusherScans : null,
                last: tick === t.tick_count,
            };
            if (tick === t.tick_count) break;
            if (run) run.advance(held);
            else state = stepV1(state, held, { terrainStateAt });
        }

        // A grant for a level the tape never entered is a ROUTE CLAIM that
        // stopped being true. Silently no-opping it is how a routing
        // regression hides: the stream still matches its oracle (the grant
        // changes no position), every assertion passes, and the tape quietly
        // stopped visiting the room it exists to visit.
        if (run && run.unfiredGrantLevels.length > 0) {
            throw new Error(
                'runTape: the tape grants items in level(s) '
                + `${run.unfiredGrantLevels.join(', ')}, which the run never entered. A `
                + 'grant fires on FIRST ENTRY, so this tape no longer walks where it '
                + 'claims to. Fix the route or drop the grant — do not leave it as a '
                + 'silent no-op.',
            );
        }

        return {
            ticks,
            // Derived from the engine's OWN world swap — deliberately NOT
            // re-derived from the level field, which is what the GAME's side
            // is derived from (`tapeFormat.deriveTransitions`). If both sides
            // read the level field the transitions diff would degenerate into
            // diffing the tick stream against itself.
            transitions: run ? run.transitions : [],
            // The subset a PIT FALL produced. JS-side bookkeeping, not part
            // of the stream contract — it exists so the differential harness
            // can read `saw_input_refused` two-sidedly: a transport means the
            // game MUST have refused input, and its absence means no fall
            // fired.
            transports: run ? run.transports : [],
            // R3: the touch-lock windows this tape drove. Same job as
            // `transports` — the differential reads `saw_input_refused`
            // two-sidedly, and a ShieldLock is the second thing on the ladder
            // that refuses input by design.
            lockSnaps: run ? run.lockSnaps : [],
            // R3: one record per COMPLETED pickup ceremony. The other half
            // of the crutch ledger — `grants` is what was HANDED over and
            // this is what was WALKED ONTO, so "collected for real, not
            // granted" is exactly the statement that the first is empty and
            // this one is not.
            collected: run ? run.collected : [],
            // R3/R4/R5: the flags this run's own openers cleared —
            // `{level, tag, by}`. The other end of the ledger the game
            // reports as `persistence_cleared`, and the only place a
            // PLANNER can see an out-of-band write (a `tag = -1` rock
            // clears a slot in the previous level) before the recording
            // does.
            earnedClears: run ? run.earnedClears : [],
            /** R5 slice 5: `{level, id, hitTick, goneAt, ...}` per rock broken. */
            rocksBroken: run ? run.rocksBroken : [],
            /**
             * ⛓⛓ R5 slice 14: `{id, level, t, goneAt, flag}` per BURNABLE
             * TREE set alight — and the two ticks are the whole point.
             *
             * `t` is the press and `goneAt` is `removed()`, forty-one ticks
             * later, which is where `Game.setPersistence(tag, false)` lives.
             * ⛔ THE OPPOSITE OF `rockFalls`, whose flag lands on the trigger
             * frame — and a SET has no timestamps, so a ledger check alone
             * cannot tell the two apart (§24.7's finding, on the rock).
             */
            treeBurns: run ? run.treeBurns : [],
            /**
             * ⛓ R5 slice 7/9: the persistence writes a plain `Lock` makes,
             * BOTH WAYS — `turnOff()` false and `returnToNormal()` TRUE.
             *
             * ⚠ NOT COVERED BY `earnedClears`, and the shaft is where that
             * stopped being academic. A banked clear is CASHED when the
             * level it names is next built, so a run that opens three locks
             * and never leaves the room reports an EMPTY `earnedClears` —
             * which reads exactly like a run whose locks never opened. The
             * writes are the claim; the cashing is bookkeeping.
             */
            lockWrites: run ? run.lockWrites : [],
            /** R5 slice 7: `{level, id, flag}` per rope PULLED. */
            ropePulls: run ? run.ropePulls : [],
            /**
             * ⛔⛔ R5 slice 10: `{id, level, t, flag, deadFrames}` per
             * `FallRock` an activator publication DROPPED.
             *
             * A rope pull's SECOND ledger entry, and the one the refuted
             * shaft recording carried that no model produced: {39,10}, at the
             * pull's own tick, from `fall()`'s first line.
             */
            rockFalls: run ? run.rockFalls : [],
            /**
             * ⛓⛓ R5 slice 10: frozen frames the RUN caused that the tape
             * never advanced through — the run's share of `dead_frames`.
             */
            frozenFramesOwed: run ? run.frozenFramesOwed : 0,
            /**
             * ⛓ R5 slice 10: the armed-pulser ledgers, forwarded.
             *
             * `pulserHits` is every tick a ring fired; `pulserPlayerHits` is
             * every tick one reached the PLAYER (inert only because
             * `Bot.noDamage` is on — the run refuses it otherwise);
             * `pulsePushes` is every block a pulse moved. A route whose
             * clearance is a claim rather than a computation shows up here.
             */
            pulserHits: run ? run.pulserHits : [],
            pulserPlayerHits: run ? run.pulserPlayerHits : [],
            pulsePushes: run ? run.pulserPushes : [],
            /**
             * ⛔⛔ R5 slice 13: `{level, id, tag, cause}` per spinner that LEFT
             * THE WORLD — and the cause is why it is here.
             *
             * `Spinner.removed()` writes `Game.setPersistence(tag, false)`
             * without testing HOW it was removed, and `Enemy.update` destroys
             * one in water or lava and fades one out over a pit. So a
             * billiard that bounces into a hazard banks the same ledger entry
             * a kill does, on a tick no route chose. A run that never fights
             * one can still owe a flag; without this list nothing downstream
             * could say so. (`spinner.SPINNER_TERRAIN_WRITE`.)
             */
            spinnerDeaths: run ? run.spinnerDeaths : [],
            /**
             * ⛓ R5 slice 13: the same removals as PERSISTENCE WRITES, with
             * ticks — the shape `lockWrites` and `ropePulls` use, so a
             * ledger sum can include them without a special case.
             */
            spinnerWrites: run ? run.spinnerWrites : [],
            /**
             * The live block rects at the END of the run, by id.
             *
             * ⚠ A SUMMARY, not a stream. It answers "where did the blocks
             * finish", which a wedge probe needs and no other readout gives —
             * `pulsePushes` records the pushes that LANDED and a swallowed
             * one lands nothing at all.
             */
            pushables: run ? run.pushables : null,
            /**
             * ⛔⛔ R5 SLICE 16 — THE NINTH FAMILY WAS NOT IN THIS LEDGER.
             *
             * Slice 15 plumbed the crusher through `levelWorld`,
             * `levelRun`, `collidesSolid`, `plannerBlockerAt` and `stepV2`,
             * and stopped one consumer short: a tape replayed through
             * `runTape` reported nothing at all about it. So a fixture-level
             * claim — "the choreography was not run over", "the crusher is
             * still on the button at the end" — was unstateable, and the
             * only place the family could be checked was the driver's own
             * synthesis, which is the model checking itself.
             * ⇒ [[feedback_dropped_option_key_is_a_silence]], one consumer
             * further along than §28.2 found it.
             *
             * `crusherContacts` is every tick a 32x32 body overlapped the
             * player (1000 damage each, survived only because
             * `Bot.noDamage` is on, which is exactly why an empty list is a
             * CLAIM); `crushers` is where they finished, which for L41 is
             * the difference between a held button and a shut room.
             */
            /**
             * ⛓ …and the responder set they HOLD, for the same reason.
             * `cover@112,128` in L41 is open only while a `"Solid"` is in
             * `button@248,232`'s cell, and the only Solid that can reach it
             * is the crusher — so "which activators are open at the end" is
             * the room's own answer to "did the third bait land".
             * ⚠ Null under noclip, where nothing publishes.
             */
            openActivators: run ? run.openActivators : null,
            crusherContacts: run ? run.crusherContacts : [],
            // ⚠ `run.crushers` is NULL under noclip — `advance` steps none —
            // and null is not "this room has no crusher". Forwarded as-is so
            // a caller cannot read a relaxation as an empty room.
            crushers: run ? run.crushers : null,
            crushersParked: run ? run.crushersParked : null,
            /**
             * ⛓⛓⛓ R5 SLICE 21 — THE KILL LEDGER, AND IT IS THE ONLY WITNESS.
             *
             * `IceTurret` writes no persistence, its body is never removed
             * by a kill, and nothing in the tape or the observation stream
             * says it died — so a replay that could not see these two lists
             * could not check the claim at all. `turretKills` is the walk's
             * history WITH the kill-lock arithmetic it computed;
             * `turretsDead` is which corpses are standing in the level
             * being replayed right now. Different questions.
             * ⚠ Both empty (not null) under noclip, where nothing is stepped.
             */
            turretKills: run ? run.turretKills : [],
            turretsDead: run ? run.turretsDead : [],
            /** ⛓ mid-fight `hits`/`hitsTimer`, so a refused press has a name. */
            turretDamage: run ? run.turretDamage : [],
            /**
             * ⛓⛓⛓ R5 SLICE 22 — WHAT STANDING IN RANGE COST, AS A NUMBER.
             *
             * `blastFreezes` is one entry per tick an `IceTurretBlast`
             * reached the player, each worth `freezeTicks - 1` ticks of
             * refused input; `volleys` is one per three-blast spawn, so a
             * leg can say the shooter fired N times and hit M. ⛔ The two
             * together are the only model-side witness of the mechanism
             * that refuted `r5-l40-part5`: the position stream shows the
             * DISPLACEMENT, and these say what caused it.
             *
             * ⚠ `frozenTimer` is the final value, against the game's own
             * `botStatus.frozen_timer` — a readout the R5 batch added and
             * nothing consumed until this slice.
             */
            blastFreezes: run ? run.blastFreezes : [],
            volleys: run ? run.volleys : [],
            frozenTimer: run ? run.frozenTimer : 0,
            /** ⛔⛔ R5 slice 9: `{t, level, id, persistTag}` per chest OPENED. */
            chestOpens: run ? run.chestOpens : [],
            /** ⛓ R5 slice 9: one per completed seal ceremony, with its dead frames. */
            sealCollections: run ? run.sealCollections : [],
            final: run ? run.state : state,
            // The R0 relaxations' JS-side outcome. `inventory` is a MIRROR —
            // an acceptance assertion reads `botStatus.items` from the game,
            // not this. See `levelRun.initialInventory`.
            inventory: run ? run.inventory : null,
            grants: run ? run.grantsFired : [],
            // R4: the equip mirror the differential asserts against the
            // game's own `primary` / `inventory_slots` readout.
            primary: run ? run.primary : 0,
            inventorySlots: run ? run.inventorySlots : [],
            equips: run ? run.equipsFired : [],
        };
    }

    const it = loop();
    return {
        tape: t,
        tickCount: t.tick_count,
        /** The built world for a level — for a viewer drawing geometry. */
        worldFor: run ? run.worldFor : null,
        next: () => it.next(),
        [Symbol.iterator]() { return it; },
    };
}

/**
 * The observation stream alone, for direct comparison against a committed
 * oracle recording.
 */
export function runTapeToStream(tape, opts = {}) {
    const { ticks, transitions } = runTape(tape, opts);
    return { ticks, transitions };
}
