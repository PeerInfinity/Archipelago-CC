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
 * @param {Function} [opts.onTick]    called as (t, state, held, run) after each
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
            // ⛓⛓⛓ R7 slice 6e: and the v10 `despawn` list, for the reason
            // every field above it is here — `combat.contactPricing` REFUSES
            // a `mover` body by name, so a runner that kept this on the
            // header would throw on a recording the game made cleanly.
            despawn: t.despawn ?? [],
            equips: t.equips,
            // R5 slice 4: `pins` reaches the PHYSICS, not just the tape
            // header. `stepV2` refuses a wet tick on a tape that does not
            // pin "sound" — the term reads a wall clock otherwise — so a
            // runner that recorded the field and did not pass it on would
            // refuse every armed-water tape ever written.
            pins: t.pins ?? [],
            // ⛓⛓⛓ R5 slice 23: and the v6 SAVE block, for the `pins`
            // reason one version on — `Wand.update`'s body is gated on
            // `Player.hasAllTotemParts()`, so a runner that kept this on
            // the header would model an inert pickup while the game ran a
            // ceremony.
            save: t.save ?? null,
            // ⛓⛓⛓ R6 slice 6f: and the v7 `rng` block, for the same reason
            // one version on — L112's gameplay READS the draw stream, so a
            // runner that kept this on the header would model the Owl fight
            // from a stream position nobody declared. `parseTape` normalises
            // a pre-v7 tape to `{seed: 0, split: false}`, which is exactly
            // what those tapes mean, and only the Owl refuses it.
            rng: t.rng ?? null,
            // ⛓⛓⛓ R7 slice 1: and the v8 `seam` block, for the same reason
            // one version on — most of what it declares is read at BUILD
            // time (a `Karlore` removes itself when `Player.hasFire`, a
            // `BossKey` removes itself in the new world's first `check()`,
            // `cutscene[2]` spawns the player inert), so a runner that kept
            // it on the header would build a different world from the one
            // the game builds. `parseTape` normalises a pre-v8 tape to
            // `null`, which is exactly what those tapes mean.
            seam: t.seam ?? null,
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
            // ⛓ R6 SLICE 4: the RUN is the fourth argument. A window whose
            // claim is an OFFSET between two moving bodies cannot get it
            // from a terminal summary, and `createTapeStepper` is tooling
            // only (see its docblock) — so the per-tick hook is the one
            // seam a claim may read live state through.
            if (onTick) onTick(tick, now, held, run);
            yield {
                observation,
                state: now,
                held,
                world: run ? run.world : null,
                transitions: run ? run.transitions : [],
                transports: run ? run.transports : [],
                lockSnaps: run ? run.lockSnaps : [],
                collected: run ? run.collected : [],
            /**
             * ⛔ R6 slice 6d: one per ceremony BEGUN, which is what the
             * dead-frame ledger has to count. `Pickup.pick_up()` spends
             * phase A on CONTACT and does not ask whether the dialogue
             * after it is ever dismissed — a tape that ends mid-ceremony
             * paid 150 dead frames and banked no completion.
             */
            ceremonyStarts: run ? run.ceremonyStarts : [],
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
            /**
             * ⛔ R6 slice 6d: one per ceremony BEGUN, which is what the
             * dead-frame ledger has to count. `Pickup.pick_up()` spends
             * phase A on CONTACT and does not ask whether the dialogue
             * after it is ever dismissed — a tape that ends mid-ceremony
             * paid 150 dead frames and banked no completion.
             */
            ceremonyStarts: run ? run.ceremonyStarts : [],
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
            /**
             * ⛓⛓⛓ R6 SLICE 3 — WHAT THE RUN TOOK, AND WHAT IT SURVIVED.
             *
             * `playerHits` / `playerDeaths` / `contactsSuppressed` are the
             * three halves of `noDamage`'s retirement (the third one is the
             * negative control: a contact that paid nothing, with the gate
             * that swallowed it). `damage` is the terminal
             * `{hits, hitsTimer, directionFace}`, which the differential
             * checks against the GAME's own `botStatus.hits` /
             * `hits_timer` readouts — the R5 batch added those and nothing
             * consumed them until this slice.
             *
             * ⚠ `playerDeaths` IS ALSO A LOAD COUNT. A death rebuilds the
             * `Game` without changing the level, so the dead-frame budget's
             * `transitions.length + 1` undercounts by exactly its length —
             * which is a two-sided check rather than a bookkeeping detail.
             */
            playerHits: run ? run.playerHits : [],
            playerDeaths: run ? run.playerDeaths : [],
            contactsSuppressed: run ? run.contactsSuppressed : [],
            damage: run ? run.damage : { hits: 0, hitsTimer: 0, directionFace: -1 },
            shake: run ? run.shake : 0,
            /**
             * ⛓⛓⛓ R6 SLICE 4 — THE FIGHT'S SIX LEDGERS.
             *
             * ⛔ SIX, AND NOT ONE SUMMARY, because they are six different
             * claims and a pair has to be able to name which one it meant.
             * `bossLasers` carries `hitCalls: 0` for a volley that MISSED —
             * an exactness claim a "did the player survive" counter cannot
             * make — and `bossHits` carries the shots the boss's own 20-tick
             * `hitsTimer` REFUSED beside the ones it took, so a schedule
             * that is one tick fast reads as nine landings and not as ten.
             */
            bossWalks: run ? run.bossWalks : [],
            bossLasers: run ? run.bossLasers : [],
            bossShotsFired: run ? run.bossShotsFired : [],
            bossHits: run ? run.bossHits : [],
            bossKills: run ? run.bossKills : [],
            bossBlasts: run ? run.bossBlasts : [],
            /**
             * ⛓⛓⛓ R6 SLICE 5 — THE SHIELDSPIRE'S FOUR, and they are its
             * own rather than an extension of the totem's.
             *
             * ⛔ `shieldBossKills` CARRIES THREE ROWS PER DEATH — `tag`,
             * `destroy` and `removed`, 23 and 11 ticks apart — because the
             * three release different things and a window has to be able to
             * name which one it meant. The totem's `bossKills` is one row
             * per kill with a `tagTick` beside it; merging the two shapes
             * would have forced one of them to lie.
             */
            shieldBossBand: run ? run.shieldBossBand : [],
            shieldBossStabs: run ? run.shieldBossStabs : [],
            shieldBossHits: run ? run.shieldBossHits : [],
            shieldBossKills: run ? run.shieldBossKills : [],
            /**
             * ⛓⛓⛓ R6 SLICE 6c — THE WATCHER'S, and the first row of the
             * rung's ledger that is not a kill at all.
             *
             * ⛔ `cause` TRAVELS WITH IT because the flag alone cannot tell
             * the two writers apart: `doneTalking()` runs when the pages are
             * exhausted AND when the radius test tears the dialogue down, and
             * the second costs two ticks and reads nothing. A differential
             * that saw only `{114,0}` off would call both of them the window.
             */
            watcherTalks: run ? run.watcherTalks : [],
            /**
             * ⛔⛔ Every tick the Watcher's live `Seed` existed. The positive
             * half of a refusal the shipped tapes cannot reach — "the stance
             * never touched it" and "there was nothing to touch" print the
             * same without it. (trap 101)
             */
            watcherSeedLive: run ? run.watcherSeedLive : [],
            /**
             * ⛓⛓⛓ R6 SLICE 6c — THE FINAL DOOR's three, and the first is a
             * DEAD-FRAME claim rather than a positional one.
             *
             * ⛔ `doorCeremonies` IS THE WINDOW'S SECOND WITNESS. A
             * `SealController` costs 181 dead frames against a load fade's
             * ~19, and the differential's dead-frame band reads them — so a
             * model that predicted the ceremony on the wrong tick, or not at
             * all, fails on a number the observation stream cannot carry.
             */
            doorCeremonies: run ? run.doorCeremonies : [],
            /** `open` then `removed`, 56 ticks apart — the wall goes on the second. */
            doorEvents: run ? run.doorEvents : [],
            /** The `{113,0}` write `removed()` makes. */
            finalDoorFlags: run ? run.finalDoorFlags : [],
            /**
             * ⛓⛓⛓ R6 SLICE 6d — THE BLOODY BRANCH's five, and the first
             * window on the ladder whose ledger row has no FLAG in it.
             *
             * ⛔ `watcherHits` CARRIES THE REFUSED TESTS TOO, because they
             * are the derivation: one press is FIVE dispatches (§13.2) and
             * `hitsTimer = 25` refuses four of them, which is what makes
             * "four presses" a fact about presses rather than about repeats.
             * A ledger of landings alone could not tell a four-press
             * schedule from a one-press one against a receiver with no
             * timer — which is exactly the Owl (§14.4).
             */
            watcherHits: run ? run.watcherHits : [],
            /** `{t, id, ex, ey, from, hits, liveAt}` per RUNTIME-spawned Seed. */
            seedSpawns: run ? run.seedSpawns : [],
            /** `{t, id, arm, fadeFrames}` per `Seed.removeSelf()` cover fade. */
            seedFades: run ? run.seedFades : [],
            /**
             * ⛓⛓⛓ The window's TERMINAL — `{t, arm, fromLevel, toLevel,
             * cutscene}` per GAME-INITIATED ending reboot. The differential
             * reads it three ways: the level sequence against the stream's
             * own, the `cutscene` slot against `botStatus`, and the
             * `receiveInput` refusal the scripted walk earns.
             */
            endingReboots: run ? run.endingReboots : [],
            /**
             * ⛔ Every tick of a `cutscene[1]` world, with the distance to
             * L1's Oracle. The positive half of the second refusal this rung
             * cannot reach from a shipped tape (trap 101): the walk really
             * does park INSIDE the 24 px circle, and nothing is live there.
             */
            oracleApproach: run ? run.oracleApproach : [],
            /**
             * ⛓ `{t, level, what, r, updates}` — the tree's `endAnim` and
             * `coverFull`, with the relative tick each fired on. Two
             * fenceposts, kept apart from the total that hides them.
             */
            treeEvents: run ? run.treeEvents : [],
            /**
             * ⛓⛓⛓ THE RUNG'S TERMINAL, or `null`. The differential reads it
             * against `botStatus.menu_state` — the DIRECT readout slice 6a
             * bundled — and keeps `R6_MENU_WRITERS`'s elimination as the
             * second stratum: the readout says it is a menu with index 2,
             * the elimination says the 2 came from the tree.
             */
            credits: run ? run.credits : null,
            /** `Game.cutscene`, the run's own copy of the static. */
            cutscene: run ? run.cutscene : [false, false, false, false],
            /** Every tick a shot's own cull was a §11.6 BAND question. */
            bossShotCullBand: run ? run.bossShotCullBand : [],
            /**
             * ⛓⛓ THE BOSS'S OWN STATE, PER TICK — the second stratum §3.2
             * asked for, on the model side.
             *
             * ⛔ IT IS ON THE FRAME AND NOT IN A TERMINAL SUMMARY, because
             * the quantity every stance is about is an OFFSET between two
             * moving bodies and a terminal snapshot cannot express it. A
             * window that asserted only the end state would pass on a plan
             * that spent the whole fight inside the body and stepped out on
             * the last tick.
             */
            bosses: run ? run.bossesWoken : [],
            /** The clamp's assignments — R5 slice 23's, still the window's spine. */
            bossClamps: run ? run.bossClamps : [],
            /**
             * ⛓⛓⛓ R6 SLICE 6h — THE OWL'S FOUR, and the rung's LAST ledger
             * rows travel on `finalBossFlags`.
             *
             * ⛔ `finalBossLava` IS WHAT MAKES THE CONTROL'S NEGATIVE ARM A
             * CLAIM. The Owl can only be killed by his own lava self-hit, so
             * "no flag was written" is worth nothing on its own — a model
             * that never reached the room says the same thing. The control's
             * claim is that the fight RAN (two lava hits, both landed) and
             * `{112,0}`/`{112,1}` stayed set anyway, which is a statement
             * about the game's persistence array and not about the model's.
             *
             * ⛔ `finalBossShoves` carries the REFUSED test beside the landed
             * ones for the same reason `watcherHits` does: the first press's
             * third test reaches him on the tick his own lava hit set
             * `hitsTimer = 30`, and a ledger of landings alone could not tell
             * a three-test press from a two-test one.
             */
            finalBossLava: run ? run.finalBossLava : [],
            finalBossShoves: run ? run.finalBossShoves : [],
            /** `startDeath` / `dieAnimEnded` / `tagsWritten`, 109 ticks apart. */
            finalBossKills: run ? run.finalBossKills : [],
            /** The `{112,0}` and `{112,1}` writes `endAnim`'s "dead" arm makes. */
            finalBossFlags: run ? run.finalBossFlags : [],
            /** ⛔⛔ R5 slice 9: `{t, level, id, persistTag}` per chest OPENED. */
            chestOpens: run ? run.chestOpens : [],
            /** ⛓ R5 slice 9: one per completed seal ceremony, with its dead frames. */
            sealCollections: run ? run.sealCollections : [],
            final: run ? run.state : state,
            // The R0 relaxations' JS-side outcome. `inventory` is a MIRROR —
            // an acceptance assertion reads `botStatus.items` from the game,
            // not this. See `levelRun.initialInventory`.
            inventory: run ? run.inventory : null,
            /**
             * ⛓⛓⛓ R7 slice 1 (R6 debt 6): the model's own save arrays, for
             * the differential to assert `botStatus.save` against — the
             * readout has shipped since R5 slice 23 and nothing read it.
             * See `levelRun.saveState` for why `seal_parts` is a FILLED
             * COUNT and not an identity list (the identity is a
             * rejection-sampled draw at chest OPEN).
             */
            saveState: run ? run.saveState : null,
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
