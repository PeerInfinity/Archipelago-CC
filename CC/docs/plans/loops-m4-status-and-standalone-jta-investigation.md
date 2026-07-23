# Loops M4 — status + the standalone-jta (loop-mode-off) investigation

**Written 2026-07-23 (Opus session, mid-M4). Paused at slice 3 pending an
architectural decision the user flagged for a fresh session.** Companion to
the kickoff `NewDocs/plans/loops-m4-jta-opus-kickoff.md` (which holds the
settled M4 design rulings — don't re-litigate those).

## M4 progress

| Slice | State |
|---|---|
| **1. Fork zone-stamp on item entries** | ✅ **DONE + BYTE-GATED.** Submodule commit `755056809` (branch `substrate`). `recordPerformedItem` stamps `zone_id: GAMESTATE.current_zone`. jta-parity PASS all 4 scenarios; perturbation canary confirmed non-vacuous. **Gitlink bump NOT yet applied** (outer still points at `e1e38d9f0`); ASK before bumping. Submodule branch UNPUSHED. |
| **2. Wrapper per-visit slice + converter + stash** | ✅ **DONE + COMMITTED.** Outer commit `59ddb867f`. Bridge slices one visit from the fork's performed-actions log (index-mark at `jta:loadRegion`, drop the departure trigger at exit), publishes `jta:visitRecording` BEFORE the departing `user:regionMove` (11/n ordering); host converts to shared/actionQueue vocab + stashes; registry exposes `takeLastRecording`. +10 unit tests. Byte-inert to jta runtime (nothing pulls the stash until slice 3's caps). |
| **3. Declare record+playback + executor replay + instant pump** | 🔨 **MECHANISM BUILT, UNCOMMITTED, vitest green (579), but the gate opt-in breaks 3 in-app tests — PAUSED.** WIP saved as `CC/docs/plans/loops-m4-slice3-wip.patch`. |
| 4. Universal annotations | ⏸ not started |
| 5. Universal UI | ⏸ not started |
| 6. Docs | ⏸ not started |

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

## Deferred to a fresh session (the fix)

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
  `git apply` from repo root; excludes the submodule pointer).
- Fork commit (slice 1): submodule `755056809` (UNPUSHED; gitlink un-bumped).
- Slice 2 commit: `59ddb867f`.
- Substrates run log this session: was under the session scratchpad.
- Kickoff (design rulings): `NewDocs/plans/loops-m4-jta-opus-kickoff.md`.
- Memory: `project_loops_block_modes`.
