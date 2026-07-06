# JtA Substrate Integration — Review Findings & Prioritized Plan

Plan for finishing Journey to Ascension as a procgen substrate. Produced by the
2026-07-05 review session that closed out the automation arc (see
`completed/jta-automation-v2-plan.md`). The substrate wrapper
(`frontend/modules/jtaSubstrateWrapper/`) predates the entire Fork 1.4/1.5
automation surface, so this review checked it file-by-file against the game
submodule, the substrate contract (`docs/json/developer/procgen/substrate-registry.md`),
and the submodule's own `docs/substrate-integration.md`.

> **Status (2026-07-05): Phases 1 + 3 SHIPPED, Phase 4 tests SHIPPED.**
> All §6 rulings received and recorded inline; implementation landed the same
> day: submodule **Fork 1.6** (`e26ce3b` — managed-mode persistence under the
> shared `incrementalGameSave_substrate` slot, synthetic tasks excluded from
> saves, `doPrestige` fires the energy-reset callback), registry entry fixes
> (`1e72e6f03` — zoneCount 30, `iframeId`, `victoryItem: 'Victory'`),
> bidirectional reset + two-way mana sync + strict pause/resume
> (`d75408ba0` — gameState grew `gainMana`; bridge echo-detection via
> `_expectedPool`), docs refresh (`5f67739f8`), and the in-app test suite the
> tests README always promised (`1ec00967a` — 4 JtA tests, all 15
> substrate-mode tests green, regression suite unaffected; note the loop-reset
> teleport target is `getResolvedStartRegion()`, which in procgen-aware modes
> resolves the first substrate region, not Menu).
> **Phase 4 SHIPPED too** (`973417997`, pushed): PlaybackController (shared
> PlaybackProxy on `jta:playbackControl`, setter-injected into the library) +
> `loopSupport.executeVia: 'playbackBot'`; bridge command handler
> (play/stop/step/instant/reset) and a walkTo driver that performs the zone's
> Travel task (else next enabled Mandatory) via `performTask` — guarded by the
> new `getFullState().activeTaskId` (submodule `1c105a8`) — then takes the
> requested exit on Travel completion. This subsumed the reduced Phase 2
> command set. Fifth in-app test `jta-bot-walkto-exit` covers the executeVia
> path end-to-end; 16/16 substrate tests + regression green.
> **Still open:** §4 harness measurements (threshold rescale under pooled
> max_energy), Phase 5 doc relocation (old stack kept per ruling), Phase 6.
> Nothing in this doc re-opens settled automation decisions (defaults,
> auto-fill order, `threshold_all_skipped`, Use Free Items kept≡0).

## 1. Current state — the map

### Two parallel, non-interoperating JtA stacks

| | **Substrate stack** (this plan) | **Randomizer stack** (March 2026, frozen) |
|---|---|---|
| Modules | `jtaSubstrateWrapper` | `jtaGameDataPanel`, `jtaCostDebugger`, `jtaQueueEngine`, `jtaActionQueue`, `jtaArchipelago` + libs `jta-randomizer`, `jta-remote` |
| Game copy driven | `frontend/modules/journey-to-ascension/` **submodule** (`?managed=1`) | `jta-remote/game-bundle/` (own built copy, via `iframeAutoLoad: "jta"`) |
| Enabled in | default `modules.json` | `?mode=jta` (`modules-jta.json`) — does *not* load the wrapper |
| Automation | in-game Fork 1.4/1.5 mods (thresholds, auto-fill, autopilot, auto-prestige, Unlock Savings, Instant Mode) | host-side queue builder / drain / auto-reset driving the game over `jta:*` events |
| AP integration | region topology only (`region_topology_from_source`); no location checks | `jtaArchipelago`: perk-task completion → `user:locationCheck`, received item → `jta:grantPerks` |
| Shared imports | none of the old cluster | `jta-randomizer` is the dependency hub; `shared/actionQueue` submodule lib |

There are **three live copies of the game plus two dead archives**:
the submodule (current, Fork 1.5), `jta-remote/game-bundle/` (built, what the
old panels drive), `iframe_games/journey-to-ascension/` (TS source the bundle
was built from, last touched 2026-03-08), and gitignored
`iframe_games/journey-to-ascension-{backup,modified}/`.

### What already works (verified)

- Registry entry follows the standard pattern (self-register + module-phase
  register, exits array↔Map both directions); wired in `modules.json`,
  `__BUNDLED_MODULES__`, Golden Layout, `world-mapping.json`, presets
  (`jta_substrate_test`, `jta_mixed_test` + generator scripts).
- Managed mode: `?managed=1` flips pre-DOMContentLoaded; save/load and
  auto-`advanceZone` correctly guarded in the submodule.
- Travel-task callback, synthetic exit tasks (ids ≥ 10000, `free: true`,
  one-shot callbacks, cleared on region load), single-exit direct
  `user:regionMove` — all correct against `simulation.ts`.
- Host-side mana brokering (`jta:bridgeDeductMana` → shared pool → loop reset
  at zero) matches the maze/text-adventure pattern; energy catch-up resets +
  `setEnergy` pinning on region entry work.
- Loop wiring unit-tested in `loops/loopBlockBuilder.test.js`.

### worlds/jta (the APWorld — randomizer-stack asset)

Hand-written (March 2026, not world_generator): 44 perk locations, linear
27-zone region chain, count-based generic-perk access rules, cost calibration
via Node `scripts/jta/cost-adjust.js` shelled out from a non-standard
`post_output` hook. Template + world-mapping + 3 seed presets exist. It models
the *randomizer* game, not the substrate: no synthetic-exit/zone-payload
awareness, and the substrate presets are generated by separate scripts, not by
this world.

## 2. Findings (ranked)

**HIGH — the three contract breaks Fork 1.4/1.5 exposed:**

1. **Game-initiated energy resets desync zone/region/pool.** The bridge never
   registers `setEnergyResetCallback` (grep-verified), even though
   `doEnergyReset()` fires it *specifically* for pool sync
   (`simulation.ts:1133-1143`). Reset-screen click,
   `auto_continue_energy_reset`, threshold End-Run, and auto-prestige all send
   the game to zone 0 with refilled energy **behind the host's back** (energy
   refill is a negative poll delta — never mirrored). Pre-Fork-1.4 this needed
   a player click; the automation mods now do it autonomously.
2. **Game loop never paused on region exit.** `game.ts` documents
   "host calls resumeGameLoop() on region entry, pauseGameLoop() on exit"; the
   bridge resumes once at startup and only stops the *energy poll* on
   `gameState:regionChanged`. With autopilot on, JtA plays itself unmirrored
   while the player is in maze/runner regions.
3. **No host↔game channel for the automation surface.** `setMod`/`getMods`,
   `autoFillPriorities`, auto-fill order, queue-config CRUD, prestige buy
   queue, Unlock Savings, `setInstantMode`, `stepTick` are all `window.*`
   inside the iframe. The bridge exposes no message for any of them; there is
   no sidecar/regionParams path for automation config. Instant Mode's
   programmatic hook is headless-harness-only today.

**MEDIUM:**

4. **No persistence in managed mode.** Docs claim "host supplies and stores
   state" but no supply/store mechanism exists on either side: `getFullState`
   is lossy (no mods, no queue configs, no run history, no prestige
   repeatables) and `loadGameFromData` is module-private. Every panel mount is
   a fresh game; `setMod` persists via `saveGame()` which is a managed no-op,
   so even automation settings are session-only. `_completedThisLoop` is
   bridge-memory-only.
5. **Reload-while-in-region race.** The entry lacks `iframeId`, so
   procgenPlayer's `iframe:appReady` re-publish catch-up (built for the
   flash family) skips jta; an app/panel reload mid-region leaves the panel
   unloaded until the next transition. The iframe already announces
   `iframeId=jtaSubstrateWrapper` — this is a one-field fix.
6. **`zoneCount: 16` vs 30 real zones** (verified: 30 task arrays in the
   submodule's `build/zones.js`). Drivers silently cap jta at 16 regions;
   zones 16–29 unreachable via procgen. The "kept in sync with
   `iframe_games/journey-to-ascension/build/zones.js`" comment
   (library.js:98) points at the *wrong game copy*; `docs/json/developer/procgen/jta.md`
   repeats both stale facts.

**LOW / cleanup:**

7. Threshold budgets are `pct × max_energy`, and the bridge pins `max_energy`
   to host `maxMana` on region entry — the sweep-tuned defaults were calibrated
   against standalone Energetic-Memory energy growth and may not transfer.
   Measurable with the stats harness before deciding anything.
8. No `victoryItem` on the entry — standalone-emitted jta worlds are goal-less
   if the scenario pool contributes no `is_victory` item (bounce/runner declare
   one).
9. Stale bridge header comment (describes pre-`?managed=1` state wiping).
10. `frontend/modules/tests/README.md` names `jtaSubstrateWrapperTests.js` +
    `jtaSubstrateWrapper/test-helpers.js` (test id `jta-out-of-mana-loop-reset`)
    as its worked example — **neither file exists**, and there is no jta
    category in `playwright_tests_config-substrates.json`.
11. No shipped procgen-pipeline preset for jta in `presetDefs.js` (runner and
    bounce have demos; maze also has none — optional parity item).
12. Shared `incrementalGameSave` localStorage key on the host origin between
    standalone JtA, the old stack's game-bundle, and any future host
    persistence.

## 3. Phased plan

### Phase 1 — Contract correctness (do first; small, mostly mechanical)

1. **Energy-reset sync** (finding 1). Register `setEnergyResetCallback` in the
   bridge.
   > **RULED (2026-07-05): Option A, made explicitly bidirectional.** A JtA
   > energy reset triggers a loop reset AND a loop reset triggers a JtA energy
   > reset (the entry-time catch-up mechanism becomes immediate propagation
   > while a jta region is loaded). Additionally, **JtA energy and the Loops
   > mana pool stay continuously synchronized in both directions** — not just
   > spend-mirroring plus entry pinning: pool changes from other substrates
   > must reflect into JtA energy, and JtA-side gains/refills must reflect
   > into the pool (today a positive energy delta is silently dropped by the
   > deduct-only poll).
   - **Option A — reset is host-authoritative-after-the-fact:** bridge notifies
     the host; host treats a game-initiated reset like pool exhaustion
     (`triggerLoopReset` + `user:regionMove {fromReset}` to the resolved start
     region). One reset semantics everywhere; JtA's own reset button/mods
     become loop-reset triggers.
   - **Option B — suppress game-initiated resets in managed mode:** guard
     `doEnergyReset`/reset-screen/auto-prestige behind `_managed_mode` so only
     the host can reset. Keeps loop semantics pure but lobotomizes the Fork
     1.4/1.5 automation (thresholds/auto-prestige depend on ending runs).
   - **Option C — mirror as mana deduction:** on callback, deduct the remaining
     pool so host and game hit zero together. Preserves both reset paths but
     two systems still race; least clean.
2. **Pause/resume on region enter/exit** (finding 2):
   > **RULED (2026-07-05): Option A — strict pause.** Switching from a JtA
   > region to a different substrate region pauses JtA; switching from any
   > region to a JtA region resumes it.
   - **Option A — strict pause:** `pauseGameLoop()` when leaving a jta region /
     substrate deactivation, `resumeGameLoop()` on entry. Contract-correct,
     no unmirrored progress.
   - **Option B — background play as a feature:** keep ticking, keep the energy
     poll always-on so background spend is mirrored to the pool (idle-game
     flavored; JtA progresses while you play other regions). Not chosen; could
     return later as an opt-in loops setting on top of A.
3. **`zoneCount` → 30** + repoint the owning-path comment to the submodule
   build + fix `docs/json/developer/procgen/jta.md` (16→30, `iframe_games/` →
   submodule path). Consider deriving the count from the submodule's
   `build/zones.js` at registration instead of hand-syncing (import is
   same-origin; keeps the runtime warning as backstop).
4. **Add `iframeId: 'jtaSubstrateWrapper'`** to the registry entry (finding 5).
5. **Add `victoryItem: 'Victory'`** to the entry (finding 8).
   > **RULED (2026-07-05):** `'Victory'`, matching bounce/runner
   > (`VICTORY_ITEM_NAME = 'Victory'` in both).
6. Delete the stale bridge header comment; fix the "JtA now at zone 0" log
   claim (skipFreeZones can advance past 0).

### Phase 2 — Automation control channel (scope REDUCED by ruling)

> **RULED (2026-07-05): JtA configuration and automation settings stay
> persisted only in the JtA page for now** — no host-settings block, no
> sidecar/regionParams authoring. May be revisited later. Consequences:
> - The host does NOT drive `setMod`/auto-fill/mods config; the player
>   configures automation inside the game UI as in standalone play.
> - The bridge channel this phase builds shrinks to what Phase 4 (playback
>   controller + tests) needs: `setInstantMode`, `stepTick`, and whatever
>   task-targeting command `walkTo` requires. `setMod`-over-bridge is deferred.
> - **Refined same-day:** since `mods` lives inside the single GAMESTATE save
>   blob (no separate settings store exists), settings persistence is
>   delivered by Phase 3's re-enabled managed-mode save — no settings-only
>   carve-out. See the Phase 3 ruling.

Original options, kept for the record (the choice among them is deferred, not
made): **A** host settings block pushed on region load; **B**
sidecar/regionParams stamped at generation; **C** layered A+B (sidecar sets the
allowed surface, host settings set preference — mirrors the game's
Settings-gate vs Advanced Automation split).

### Phase 3 — Persistence ownership

> **RULED (2026-07-05, refined same-day): Option B — game-owned save under a
> substrate-specific SHARED key.** Re-enable the normal `saveGame()`/
> `loadGame()` path in managed mode, writing to a distinct localStorage key
> (e.g. `incrementalGameSave_substrate`) so substrate saves never touch the
> standalone/old-stack slot (`incrementalGameSave` is origin-shared by the
> submodule copy, standalone testing, and `jta-remote/game-bundle`). One
> shared save across all presets/worlds (game content is identical across
> presets; only the host-owned region topology differs) — per-preset keying
> deferred until cross-world carryover proves wrong in play. This persists
> the WHOLE blob — mods AND progression — superseding the earlier "progression
> ephemeral" ruling; that's consistent with loop reset ≡ energy reset (JtA
> skills/perks natively survive energy resets). Implementation caveats:
> - **Extend the save-time `tasks` filter to `isSyntheticTask`** — injected
>   exit-choice tasks (ids ≥ 10000) have the same not-in-`TASK_LOOKUP` load
>   reviver problem the existing `isArtifactTaskId` filter guards against
>   (simulation.ts:3326-3330); unfiltered, one save poisons the slot.
> - **Reconcile with Phase 1.1:** `start()` currently skips load in managed
>   mode; with load re-enabled, `energy_reset_count` persists — the bridge's
>   catch-up counter must seed from loaded state or (cleaner) be replaced by
>   the ruled immediate reset propagation.
> - `_completedThisLoop` reconstruction (below) still applies — it is bridge
>   state, not game state.

Options, kept for the record:

- **Option A — host-owned save:** add `getSaveData()` / `loadGameFromData()`
  window hooks in the submodule (export the existing private loader), bridge
  ships the blob to the host, host stores it (gameState/localStorage keyed by
  preset+slot) and restores on mount. Fits "host supplies and stores state";
  survives loop resets in whatever way loop semantics demand (which parts of
  JtA state persist across a loop reset is itself a sub-question: skills/perks
  are per-run in JtA terms, but a loop reset ≠ energy reset).
- **Option B — game-owned save under a substrate key:** relax the managed-mode
  save guard to save/load under a distinct key (`incrementalGameSave.substrate`
  or per-preset). Cheapest; but the host can't inspect/version it and the
  loop-reset boundary is fuzzy.
- **Option C — stay ephemeral, persist only mods:** accept fresh-game-per-mount
  for v1 (current de-facto behavior), but persist the *automation config* via
  Phase 2's channel so at least settings survive. Smallest step; defensible
  because a loop-mode session arguably *should* start fresh.
- Related regardless of option: `_completedThisLoop` should move to (or be
  reconstructible from) host state so an iframe reload mid-loop doesn't forget
  completed regions.

### Phase 4 — Playback controller + in-app tests (make jta bot-drivable)

The automation arc built exactly the pieces a PlaybackController needs:
`setInstantMode` (programmatic hook untouched by the UI gate), `stepTick`,
autopilot + auto-fill. Implement `getPlaybackController` as a host-side proxy →
bridge commands (the text-adventure wrapper pattern):

- `play/stop/setRate` → resume/pause + tick rate; `instant()` →
  `setInstantMode(true)`; `step()` → `stepTick`.
- `walkTo({kind:'exit', name})` → ensure autopilot/queue targets the Travel
  task (or directly `performTask` the travel/synthetic-exit task id).
- Then add `loopSupport.executeVia: 'playbackBot'` (second user after bounce)
  so loop queues actually drive the game instead of generic timers.
- **Tests:** create the `jtaSubstrateWrapperTests.js` + `test-helpers.js` the
  tests README already documents (start with `jta-out-of-mana-loop-reset`, add
  a region-transition + a game-initiated-reset case), register in
  `testDiscovery.js` and `playwright_tests_config-substrates.json`. This is
  also the regression net for Phases 1–3.

Ordering note: the test scaffolding (README's promised files) can land with
Phase 1 to lock in the correctness fixes; the controller itself can follow.

### Phase 5 — Consolidation: two stacks, five game copies, old docs

> **RULED (2026-07-05): Option A — keep the old JtA modules for now.** They
> will be retired eventually, once it's confirmed nothing needed remains in
> them (the apworld + cost-adjust pipeline and `jtaArchipelago`'s perk↔item
> bridging logic are the known keep/migrate candidates feeding Phase 6).
> No retirement work this arc; document the split and move on.

Options, kept for the record:

- **Option A — keep both, clearly labeled:** `?mode=jta` remains the
  "JtA randomizer" mode (apworld + cost-adjust + host-side queues), substrate
  stays in default mode. Zero code work; document the split and move on.
- **Option B — re-home the randomizer stack onto the submodule:** point
  `jta-remote`/`jtaArchipelago` at the submodule copy, retire
  `game-bundle/` + `iframe_games/journey-to-ascension*` (~3 copies deleted),
  keep the apworld pipeline. Medium effort; kills copy drift, and Fork 1.4/1.5
  in-game automation supersedes most of `jtaQueueEngine`'s host-side
  automation (builder/drain/auto-reset), which could then shrink.
- **Option C — full retirement:** delete the old stack and `worlds/jta`
  randomizer path until Phase 6 revives AP checks on the substrate path.
  Not recommended — the apworld + cost-adjust pipeline is the only
  perk-randomization story and Phase 6 will want it.

Cleanup items that apply under any option: the gitignored
`iframe_games/journey-to-ascension-{backup,modified}/` archives can go;
`jta-cost-adjustment-algorithm.md` is reference documentation (not a plan) and
should move under `docs/json/` once the stack decision fixes its scope.

### Phase 6 (future) — AP location checks inside zones

The convergence of the two stacks: grow `supportedFeatures` beyond
`region_topology_from_source` so perk tasks become AP locations *inside*
substrate zones (the engine already stubs "extract locations from zone data"
and "generateZoneForSpecs — bounce now, JtA later"). `jtaArchipelago`'s
perk↔item bridging logic is the seed of this, re-targeted at the submodule.
Out of scope for this arc; recorded so Phases 2–5 don't paint over it.

## 4. Measurements (stats harness, before/with Phase 2)

Reuse `CC/scripts/jta-stats/` (headless Node over the committed build):

- **Threshold rescale under pooled `max_energy`** (finding 7): re-run the
  defaults sweep with `max_energy` pinned to typical loop-pool values instead
  of Energetic-Memory growth; decide whether substrate play needs different
  default percentages (or whether the bridge should scale thresholds).
- **Autopilot-as-bot viability:** time-to-travel-task per zone under
  autopilot + Instant Mode, to size Phase 4's `walkTo` behavior and any test
  budgets.

## 5. Plan-doc dispositions (recorded by this review)

| Doc | Verdict | Action taken |
|---|---|---|
| `jta-queue-ui-plan.md` | 9/11 phases shipped (March); remaining Phase 4 (separable panels) + Phase 11 (record mode) dropped — host-side queue UI is superseded by Fork 1.4/1.5 in-game automation for the substrate path | Archived to `completed/` with status header |
| `jta-strategy-and-apworld-plan.md` | Phases 1/1b/2 largely shipped; Phase 3 factor refactor partial (grindPushCollect/artifacts unimplemented); Phase 4 partial (jtaArchipelago). Its APWorld/cost-adjust track is a Phase-5/6 input, not this arc's next step | Moved to `partial/` with status header |
| `jta-cost-adjustment-algorithm.md` | Not a plan — accurate reference doc for the shipped cost adjuster + old auto queue | Left in place; relocate under `docs/json/` in Phase 5 |
| `completed/jta-automation-v2-plan.md` | Background for this arc | none |

## 6. Design rulings (all received 2026-07-05)

| # | Question | Ruling |
|---|---|---|
| 1 | Phase 1.1 reset semantics | **Option A, bidirectional**: JtA energy reset ⇒ loop reset AND loop reset ⇒ JtA energy reset; JtA energy ↔ Loops mana continuously synchronized in both directions |
| 2 | Phase 1.2 pause policy | **Option A, strict**: leaving a JtA region for another substrate pauses JtA; entering a JtA region from anywhere resumes it |
| 3 | Phase 2 automation-config home | **Deferred — config/automation settings persist only in the JtA page** for now (delivered via ruling 4's save, not a settings-only system); host-settings vs sidecar may be revisited later |
| 4 | Phase 3 persistence | **Game-owned save re-enabled in managed mode under a substrate-specific SHARED localStorage key** (Option B variant; refined same-day from "ephemeral"): whole blob persists — mods and progression; synthetic tasks excluded from serialization; one save across presets, per-preset keying deferred |
| 5 | Phase 5 old-stack fate | **Option A — keep for now**; retire eventually once nothing needed remains in them |
| 6 | Phase 1.5 `victoryItem` name | **`'Victory'`** (same as bounce/runner) |
