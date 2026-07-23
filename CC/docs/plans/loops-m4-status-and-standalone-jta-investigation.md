# Loops M4 — status + the standalone-jta (loop-mode-off) investigation

> **✅ SLICE 3 SHIPPED + PUSHED 2026-07-23 (Opus session 69).** The
> "Ruling + revised plan" work list at the bottom is DONE. Outer
> `cf5d5d286`; jta gitlink bumped + fork pushed `f6e7de1ca` (fork
> `7550568` now on `origin/substrate` — user approved both ask-first
> steps). The WIP patch is spent; the mechanism landed unchanged.
> **Two corrections to what this doc originally said — read them:**
> 1. **"3 red tests" was an UNDERCOUNT — it is SIX.** `bridge.js`
>    `_dispatchRegionMove` publishes `user:regionMove` with NO
>    `fromLoop`, so EVERY walkTo-driven exit crossing is gate-blocked
>    once jta declares record+playback. Also affected:
>    `jta-randomized-balanced-progression`,
>    `jta-dataset-world-progression`,
>    `jta-starting-energy-bonus-raises-pool`. All four walkTo tests are
>    now `enabled:false` KNOWN-DEFERRED to M6 (user-ruled); the 2 perk
>    tests run parked-Manual and PASS.
> 2. A latent, unrelated maze bug surfaced when those 4 tests stopped
>    padding the loop-reset counts — fixed in `c78e8a78b`.
> **Substrates 45/45** (49 baseline − 4 deferred); vitest 3227/3228 (the
> odd one is the documented braidRegime2 flake, 40/40 alone).
>
> **✅ M4 COMPLETE 2026-07-23 (Opus session 70).** The record→playback leg
> `9e5881a8c`, annotations `7d6837e04`, UI `47c3a7f34`, docs — all
> pushed. Substrates **46/46**; vitest 3247/3248 (same braidRegime2
> flake). The leg found a real slice-3 bug: `jtaQueueEngine` was
> `enabled: false` in `modules.json`, so `getEngine()` returned null and
> jta Playback crossed the recorded exit WITHOUT replaying anything —
> indistinguishable from a working replay from the queue's side, and
> invisible to unit tests that stub the engine. Enabled the module; the
> fallback now warns loudly. Durable contract:
> `docs/json/developer/procgen/loop-recording.md`.

**Written 2026-07-23 (Opus session, mid-M4). Paused at slice 3 pending an
architectural decision the user flagged for a fresh session.** Companion to
the kickoff `NewDocs/plans/loops-m4-jta-opus-kickoff.md` (which holds the
settled M4 design rulings — don't re-litigate those).

> **⚠ RESOLVED 2026-07-23 (Fable review session, USER RULING): jta regions
> are NOT supported outside loop mode — the standalone split proposed in
> "Deferred to a fresh session" below is SUPERSEDED.** The findings (§
> Investigation) were verified against the code and stand; the *fix
> direction* changed. See "Ruling + revised plan" at the bottom — that
> section, not the original deferred-fix list, is what the resuming
> session implements.

## M4 progress

| Slice | State |
|---|---|
| **1. Fork zone-stamp on item entries** | ✅ **DONE + BYTE-GATED.** Submodule commit `755056809` (branch `substrate`). `recordPerformedItem` stamps `zone_id: GAMESTATE.current_zone`. jta-parity PASS all 4 scenarios; perturbation canary confirmed non-vacuous. **Gitlink bump NOT yet applied** (outer still points at `e1e38d9f0`); ASK before bumping. Submodule branch UNPUSHED. |
| **2. Wrapper per-visit slice + converter + stash** | ✅ **DONE + COMMITTED.** Outer commit `59ddb867f`. Bridge slices one visit from the fork's performed-actions log (index-mark at `jta:loadRegion`, drop the departure trigger at exit), publishes `jta:visitRecording` BEFORE the departing `user:regionMove` (11/n ordering); host converts to shared/actionQueue vocab + stashes; registry exposes `takeLastRecording`. +10 unit tests. Byte-inert to jta runtime (nothing pulls the stash until slice 3's caps). |
| **3. Declare record+playback + executor replay + instant pump** | ✅ **SHIPPED + PUSHED** (`cf5d5d286`). Mechanism landed unchanged from the WIP patch, plus the `requiresLoopMode` invariant + disable guard rail, the parked-Manual restructure of the 2 perk tests, and 4 walkTo tests deferred to M6. ⚠ the in-app **record→playback leg is still owed** (see below). |
| 3b. In-app record→playback leg | ✅ **SHIPPED** (`9e5881a8c`) — `jta-record-playback-crosses-zone-boundary`, multi-region and driven through the real loops queue (parked Record → hand-played fork task → walkTo departure → persisted+bound+auto-switched recording → the same block restarted in Playback replays through the jtaQueueEngine executor and crosses the boundary again). Folds in the energyBonusSync assertion from the M6-deferred `jta-starting-energy-bonus-raises-pool`. Found + fixed the `jtaQueueEngine` module-disabled bug. |
| 4. Universal annotations | ✅ **SHIPPED** (`7d6837e04`) — `blockAnnotations.js`; item deltas + conservative minima + XP, savedQueueStore as the universal envelope with actions-less coarse entries and `hasPlayableRecording` guarding every read. |
| 5. Universal UI | ✅ **SHIPPED** (`47c3a7f34`) — recording-exists indicator, Playback disabled without playable content, annotation badges per the display rule, `defaultBlockMode` → 'record' with the Manual clamp. |
| 6. Docs | ✅ **SHIPPED** — loop-recording.md (jta joins the fine-grained column; the annotations contract; `requiresLoopMode`), substrate-registry.md, jta.md, this doc + the handoff queue. |

### Slice 3 — what's built (in the WIP patch)

- `jtaSubstrateWrapperLibrary.js`: `loopSupport` declares `record:true,
  playback:true,instant:true` (`customQueues` stays false per the 2026-07-23
  ruling). **This declaration is what opts jta into the M3b strict action
  gate.**
- `bridge.js`: `crossExit(exitName)` (stable-exit departure, `fromLoop:true`,
  resolves target from `_world.exits`) + an energy-respecting instant
  `stepTick` pump (`startInstantPump`/`stopInstantPump`; NOT the
  affordability-blind `setInstantMode` flag — matches the jtaDatasetTests
  pump discipline).
- `jtaQueueEngine.js`: `replayRecording(actions, {onComplete})` — transient
  executor over the recorded queue (the `drain()` precedent; `drainEnabled:
  false` → exhaust fires `onQueueExhausted`).
- `jtaSubstrateWrapper/index.js`: `_driveReplay` attaches `replayActions` to
  the jta PlaybackProxy instance (shared class untouched) → routes loops'
  fine-grained replay through the executor, then `crossExit`.
- `loops/loopState.js`: Playback + no bound recording on a FINE-GRAINED
  substrate → park (Manual behavior), per the ruling.
- `loops/loopBlockBuilder.test.js`: capability-matrix test updated for jta.

Vitest: 579 green across loops + jtaSubstrateWrapper + jtaQueueEngine
(including the capability-matrix test).

## The breakage the gate opt-in causes

`npm test -- --mode=test-substrates` (2026-07-23): **46 pass, 3 fail**, all
walkTo-driven jta bridge-mechanic tests:

- `jta-bot-walkto-exit`
- `jta-location-check-and-perk-grant`
- `jta-prestige-perk-regrant`

Cause (confirmed in the browser log):
```
[procgenPlayer] user:regionMove blocked by the loop-mode action gate
[loopEvents] Gate blocked locationCheck ... : notStarted
```
The jta test presets carry `loop_costs`, so **loop mode auto-enables**
(`loops/index.js:180`). Now that jta declares `record`+`playback`, the M3b
strict gate applies to it, and these tests drive `controller.walkTo` + zone
play **directly** (no parked loops block), so their regionMoves and the
zone's automation location-checks are blocked. Note `jta-bot-walkto-exit`
explicitly tests *"the loops executeVia path end-to-end"* — the
walkTo/delegation chain the M4 ruling deprecates from Playback (unreachable
until M6's Bot radio).

## The user's reframing (2026-07-23) — the standalone-jta question

> "The main thing that makes Loop mode different is that it enforces a
> shared mana pool between substrates, and shared resets for the whole loop.
> If Loop mode is disabled, then JtA should still be able to manage its own
> mana pool and its own resets."

The real question isn't "how do I unbreak 3 tests" — it's **the relationship
between loop mode and standalone jta**, which the current architecture does
not cleanly separate.

## Investigation findings (preliminary — verify in the fix session)

1. **Loop mode auto-enables from `loop_costs`.** `loops/index.js:180`: a
   preset carrying `loop_costs` publishes `loops:setLoopMode {enable}` at
   rules load; symmetric auto-disable when it doesn't. The jta test presets
   carry `loop_costs`, so loop mode is ON during them.

2. **The mana-pool + reset coupling is ALWAYS-ON — NOT gated on loop mode.**
   - The jta **bridge** mirrors energy↔shared-pool (`_syncEnergyFromPool`,
     the poll's `substrate:resourceDelta`, `resourceBonus`) and syncs resets
     bidirectionally (`substrate:resourceReset` on the fork's energy-reset
     callback; `_applyCatchUpResets` applies host `gameState:loopReset` as
     `doEnergyReset`) with **no `isLoopModeActive` guard**. Bridge activation
     is `jta:loadRegion`-driven (region transitions), independent of loop
     mode.
   - **resourceChannels** (`handleResourceDelta` → `chargeMana` →
     `_fireReset`; `handleResourceReset` → `_fireReset`) fires the shared
     loop-reset teleport (`fireLoopResetTeleport`) **unconditionally** — no
     loop-mode check anywhere in the path.

3. **Only the ACTION GATE and path-tracking are loop-mode-conditional.** The
   strict gate is staged on `record && playback` AND `isLoopModeActive`;
   gameState path appends skip when `isLoopModeActive`. The mana/reset
   machinery is not gated on it at all.

4. **Consequence — there is currently NO standalone-jta path.** jta is
   coupled to the shared economy (shared pool + shared reset teleport)
   whenever a jta region is loaded, regardless of the loop-mode flag. The
   fork HAS its own native energy + `doEnergyReset` (a real standalone
   economy), but the bridge OVERRIDES it with the shared-pool sync. The
   behavior the user wants — "loop mode off → jta runs on its own native
   energy + its own resets" — **does not exist today**; implementing it means
   gating the bridge's energy-sync + reset-propagation (and/or the
   resourceChannels handling) on loop mode (or a per-substrate standalone
   flag), so that with loop mode off the fork runs its native economy and the
   bridge does not pin/override it.

5. **Why this matters for the 3 tests.** They need loop mode ON only because
   (a) the presets auto-enable it and (b) `jta-bot-walkto-exit` relies on the
   reset/teleport to compound skills across attempts. Because the reset
   machinery is NOT loop-mode-gated, turning loop mode OFF today would still
   yield jta resets/teleports (via the always-on resourceChannels path) AND
   stop the gate from blocking — so loop-off *might* unbreak them. But that
   is exploiting the always-on coupling, not the clean design. The right fix
   is the architectural decoupling in (4); the tests then choose their axis
   deliberately (standalone bridge-mechanic vs. loops-integrated flow).

## ~~Deferred to a fresh session (the fix)~~ SUPERSEDED — see "Ruling + revised plan" below

1. **Decide + implement the loop-mode ↔ standalone-jta split.** Likely: gate
   the bridge's energy-sync + reset-propagation (and the resourceChannels
   consumption of jta's channel events) on loop mode / a standalone flag, so
   that loop-mode-off → jta uses its native fork energy + resets and does not
   feed/override the shared pool. Verify no regression to the shared-economy
   behavior when loop mode is ON (the shipped jta loop integration).
2. **Then resolve the 3 gated tests** against the clarified model — either
   run them standalone (loop mode off, native jta economy) or restructure to
   the parked-Record flow. `jta-bot-walkto-exit` tests a path the M4 ruling
   deprecates (executeVia walkTo) — reconsider its scope.
3. **Then finish M4**: re-run substrates green, add the in-app record→playback
   leg, commit slice 3, ASK before the gitlink bump, then slices 4–6.

## Artifacts / pointers

- Slice-3 WIP: `CC/docs/plans/loops-m4-slice3-wip.patch` (apply with
  `git apply` from repo root; excludes the submodule pointer). The
  working-tree copy was REVERTED 2026-07-23 after verifying the patch is
  byte-identical to it — `git apply` restores it exactly.
- Fork commit (slice 1): submodule `755056809` (UNPUSHED; gitlink un-bumped).
- Slice 2 commit: `59ddb867f`.
- Substrates run log this session: was under the session scratchpad.
- Kickoff (design rulings): `NewDocs/plans/loops-m4-jta-opus-kickoff.md`.
- Memory: `project_loops_block_modes`.

## Ruling + revised plan (Fable review session, 2026-07-23 — THE plan for the resuming session)

**Review outcome first: every investigation claim above was verified
against the code** — bridge.js has zero `isLoopModeActive`/
`getLoopModeActive` references (energy sync + reset propagation
unguarded); `resourceChannels/index.js:160,182` → `_fireReset` →
`fireLoopResetTeleport` with no loop-mode check; `evaluateActionGate`'s
first check returns allowed when loop mode is off; auto-enable/disable at
`loops/index.js:180-196`. The slice-3 mechanism matches the M4 rulings on
every checked point (crossExit `fromLoop:true`, energy-respecting
`stepTick` pump, executor-routed replay, fine-grained
Playback-without-recording parks).

**USER RULING (2026-07-23): jta regions are NOT supported outside loop
mode.** Rationale: the fork's native economy has reset-to-zone-0
semantics baked in. With zones mapped to host regions, a native reset IS
a host teleport-to-start — i.e. `fireLoopResetTeleport`, the loop-mode
reset mechanism. A "standalone" jta-regions mode would reimplement loop
mode under another name (and leave the host path/queue semantics of a
game-initiated region-5→region-0 yank undefined). **The always-on
economy coupling the investigation flagged as the bug is hereby the
documented CONTRACT.** Standalone jta play remains available via the
legacy `?mode=jta` stack (different module config; untouched).
**Generalizes:** the same ruling applies to omsi (native mana-out
restarts the loop) for arc D, and to future loop-game substrates
(Idle Loops, Cavernous) — capture as a general declaration (e.g.
`requiresLoopMode`), not a jta special case. Non-loop substrates
(maze/TA/runner/bounce/flash) are unaffected.

**Revised work list (replaces the superseded deferred-fix list):**

1. **Formalize the invariant.** `requiresLoopMode`-style declaration on
   the jta wrapper + a guard rail: the only remaining path to the
   incoherent state is the user-facing manual toggle
   (`loopUI.js:334`, `action:'toggle'`) — refuse (warn-and-refuse) a
   manual DISABLE while a requires-loop-mode substrate's world is
   loaded. The M3b preset auto-enable/auto-disable already handles rules
   loads (jta presets carry loop_costs; auto-enable fires at rules load,
   before any region load / bridge activation). Optional: defensive warn
   in the bridge if it activates with loop mode off.
2. **Restructure the 3 red tests WITHIN loop mode** (not around it):
   - `jta-location-check-and-perk-grant` + `jta-prestige-perk-regrant`
     test AP integration (perk grants), which is NOT loop economy — they
     work under the gate via **parked-Manual live play** (park a Manual
     block in the zone region, drive checks as live play; the
     `parkedLivePlay` exemption exists for exactly this, and it is the
     honest post-M3b shape of manual play). Drains apply — one economy.
   - `jta-bot-walkto-exit` tests the executeVia-walkTo path slice 3
     makes deliberately unreachable until M6's Bot radio: register it
     `enabled:false` KNOWN-DEFERRED with a pointer to M6 (tasw #4
     precedent). The walkTo machinery itself STAYS (it becomes the M6
     Bot path). Note: it also relied on the reset teleport to compound
     skills across attempts — restructure when M6 revives it.
3. **Finish slice 3 as built** (`git apply
   CC/docs/plans/loops-m4-slice3-wip.patch`) — the mechanism needed NO
   changes for this ruling — then substrates green, the in-app
   record→playback leg, commit slice 3, ASK before the gitlink bump,
   then slices 4–6 per the kickoff.

**Boundary note for implementers (from the review):** nothing gets gated
on loop mode anymore, but keep the conceptual boundary straight — the
bridge's AP-integration surface (perk grants/`perkOrigin.js`,
location-check reconciliation, prestige regrant) is AP semantics, not
loop economy; the invariant + guard rail are about the ECONOMY coupling
(energy sync, reset propagation, reset teleport) being loop-mode-only by
contract.
