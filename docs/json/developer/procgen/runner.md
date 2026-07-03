# Runner Substrate

Runner ("Runner Demo", substrate id `runner`) is an auto-runner platformer substrate in `frontend/modules/runnerDemo/`. The player permanently runs right; the only inputs are jump (with variable hold height), a second air jump when the Double Jump item is held, drop-through on one-way platforms, and a reset key that respawns at the entrance. Each generated region is one level — a horizontal left-to-right strip from a bottom-left entrance to pickups and exit portals — whose access rules are *derived from the physics*, not authored.

Like bounce, every layer is built on one physics function and one verifier, so the generator, the solver, the runtime, and the emitted Archipelago rules cannot disagree with each other. The auto-run premise is what makes the solver tractable: a player who always holds right has `vx` converging to `maxSpeed` as a deterministic function of distance run since landing, so the per-hop state collapses to (landing x, arrival vx) with no free velocity dimension, and the input space per hop collapses to jump timings and hold lengths.

**Nothing in a level persists between attempts.** All level state resets on region entry and on every respawn (death, kill floor, or reset key); the only persistent state is collected items, which live in host/AP state. New stateful content must route through this same per-attempt reset path.

## Physics core (`physics.js`)

`step(state, input, level, abilities, constants)` advances one tick at `TICK_HZ: 50` and is the single source of truth: the in-browser game loop runs it, the solver samples it, and the bot driver forward-simulates with it. It is a faithful port of the GMTK Platformer Toolkit (MIT), pinned per-tick to a vendored copy of the upstream source (`vendor/toolkit-physics-original.js`) by `parity.test.js` under identical input tapes.

Conventions — and the gotcha-class difference from bounce: runner uses the toolkit's **Unity-native units with +y up** (`GRAVITY: -9.81`), not bounce's y-down pixels. Platform x/y is the bottom-left corner; the renderer scales by `UNIT` at draw time only.

The engine adds what the toolkit lacks: auto-run (`directionX` forced to `+1`; left/right input is ignored), one-way platforms with drop-through, non-solid hazard AABBs (touch → death → respawn with per-attempt state reset), coyote time and jump buffering (0.15s each), `standingOn`/`landedOn` bookkeeping for the solver and bot, and a `state.hits` hook reserved for the hit-budget feature (any hit kills today).

**Physics profiles are pure data.** `PROFILES` exposes `toolkit`, `celeste` (the default), `nsmbu`, `sonic`, and `meatboy` — the toolkit's measured presets as verbatim constant overrides. Constants are logic-affecting and are stamped into every generated payload (`physicsStampFor` / `resolvePhysicsStamp`); the runtime trusts the embedded constants, never a profile name lookup.

## Ability items and suppression (`suppression.js`, `gameCore.js`)

Two v1 ability items gate movement, via the two monotone-by-construction mechanisms:

| Ability | AP item | Mechanism |
|---|---|---|
| `doubleJump` | Double Jump | Effective params: overlays `maxAirJumps: 1`. Voluntary — any trajectory possible without it survives gaining it. |
| `blue` | Blue Platforms | Existence: `blue` platforms are one-way with drop-through, so their appearance never removes a route. |

`suppression.js` is the one shared answer to "does this platform exist / what are the physics params under this ability set" — solver, verifier, generator, and renderer all go through it so they cannot diverge. Pickups, portals, and hazards are never suppressed. `gameCore.js` owns `ABILITY_ITEM_NAMES` and `VICTORY_ITEM_NAME`; rule emission imports from there. (A per-platform `gate` override field exists solely so tests can plant a non-monotone level for the verifier's tripwire; production levels never set it.)

## Level model (`level.js`)

A level is authored geometry: `platforms` (typed: `ground` solid, `blue` gated one-way), `hazards` (static kill AABBs — spikes), `pickups`, `portals` (with an `arrow` and an `exitName`), and `spawn`. Gaps are not entities — they are the empty space between floors, and the kill floor below ends any fall.

The key placement rule is the **goal-wake invariant**: every pickup and portal sits in the auto-run wake of its host platform — overlapping the standing box near the host's right end, with the host's run corridor free of solid blocks and hazards — so that *any* landing on the host followed by default auto-run collects the goal. Goal-reachable ⇔ host-platform-reachable, and the verifier needs no trajectory-level goal checks. `validateLevel` enforces this plus structural stuck-freedom (no full-height wall pockets, no fully-lethal walk surfaces, solid ground under the spawn).

## The `canRun` solver (`canRun.js`)

A conservative forward-query sampler of `step` — it never simulates physics of its own. The edge A→B exists iff from *every* sampled arrival condition on A (landing x across the stand span × arrival-vx fractions of `maxSpeed`), *some* sampled input policy makes the player's next **support** be B. Legs end when `standingOn` switches to a foreign platform, which covers both airborne landings and auto-running across flush platform boundaries (those never fire `landedOn` — and they cross by *walking*, so the policy family always includes the no-input candidate). The policy family is finite and cheapest-first: `none`, position-triggered jumps × holds {tap, mid, full}, second-press timings when Double Jump is held, drop-through on one-way hosts, plus hazard-lead triggers placed a closed-form ascent ahead of each hazard. Pessimism is the safe direction: derived rules never claim a jump the player can't make.

The refinement that makes corridor hazards and pre-gate goals verifiable is the **doom/touch/launch model** (the `canRun.js` header is the authoritative statement). An arrival is LIVE if some policy from it avoids death, DOOMED otherwise. Edges come in two grades: a TOUCH edge is enough to grant the target's wake goals even if the player dies right after — which is how a pickup on a doomed pre-gate floor derives its true requirement instead of circularly requiring the gate's own item — while only LAUNCH edges (whose witness landing is itself live) chain onward. Death costs nothing permanent (per-attempt reset, monotone world), so accessibility means "some spawn trajectory reaches the goal".

The graph feeds the shared BFS in `frontend/modules/shared/simulatorCore.js`. On generated levels the full N² graph is replaced by `reachableRunPlatforms`, a lazy left-to-right layered flood with an x-monotonicity prune (auto-run `vx` is never negative) that is verdict-identical on this geometry. Node keys reserve a `hitsRemaining` dimension (always 0 today). `witnessSearch.js` is a test-only forward-search oracle — sound and more complete than the policy family — used in slow tests to measure the conservatism gap (solver ⊆ oracle).

## The derive-rules verifier (`deriveRules.js`)

Runs reachability under every subset of the level's ability universe (`doubleJump` always; gated platform types only when present), with signature dedup (subsets with identical active geometry *and* identical effective params share one evaluation), and derives per goal the **minimal ability sets**. Goals are pickups and portals only; plain platforms may be unreachable decoration. Goal derivation consumes touch-reach; chaining uses launch edges.

The verifier also checks **monotonicity** — gaining an item must never make a goal unreachable. Runner's vocabulary is monotone by construction (voluntary abilities, one-way gated platforms, non-solid hazards), so the check is a tripwire that should never fire; a violation is a generator defect, not repairable at emission.

## Level generation (`generator.js`)

Generate-and-test: `generateLevel` proposes a strip for a target requirement and verifies it with the same derive-rules path the pipeline uses (`deriveGeneratedRules`) — every pickup and exit must derive minimal sets of exactly `[S]`, zero defects; failed proposals retry with a perturbed seed. Geometry is stored explicitly; the seed drives nothing at runtime.

The strip proposer chains floors separated by gap kinds: `run` (plain, clearable by a grounded full-hold jump), `dj` (wider than any single jump, within double-jump reach), `stone` (a double-wide gap with a one-way `blue` stepping stone mid-gap — suppressed without the item, the gap is uncrossable), and `branch` (a widened plain gap with an elevated tip platform hosting a surplus exit). Gate windows are derived-then-swept: closed forms where clean, solver-swept horizontal reach (`sweepMaxGap`) where not — the sweep is coyote-inclusive, and `sonic`/`meatboy` saturate its cap (`SWEEP_SATURATING_PROFILES`), so physics gates are refused on those profiles rather than emitted unverifiably. Static spike patches decorate floors outside gate margins, with flush partner floors where a spiked floor ends in a gap; the end-of-proposal verify run is the gatekeeper.

The wall-clamped main exit (`exit_main`) sits at the strip's right end; surplus exits ride branch tips (`exit_br0..N`). `generateZoneSet` builds a whole winnable zone table (zone 0 requires nothing and grants the first item; fillers grant nothing; the final pickup is Victory) and stamps each zone's generation `spec` so `extractZoneRules` can regenerate with matching branch count.

For sphere-grown worlds, `planStripSpecs` is the requirement-targeted planner (the analog of bounce's gated braid chain): the distinct physics requirements must form one **nested chain** (∅ ⊂ R1 ⊂ … ⊂ Rk — a strip realises gates sequentially), the maximal requirement must belong to an exit (it becomes `exit_main`), and every other exit rides a branch tip inside its requirement window. A requirement-`[]` exit lands on a tip *before* the first gate — which is exactly how the sphere engine's ungated entrance-side back portal is realised; it is not a separate primitive. Incomparable requirements decline the spec.

## Rule emission (`apRules.js`, `zoneRules.js`)

Minimal ability sets become OR-of-paths of physics obstacle ids `runner_gate_<ability>` in the shared paths-and-obstacles vocabulary; authored non-physics terms (foreign items, counts > 1) become per-term `logic_gate` obstacles ANDed onto every path and ride the payload as `gate_rules` for bridge evaluation — this is what makes runner regions work in mixed-substrate sphere worlds. Empty-case conventions: `[] → False_`, `[[]] → True_`. `zoneRules.js` (`assembleRunnerRegion`) is the shared emission tail for both the zone-table and spec paths: it maps requested exit sides to portals (first/'E' side → `exit_main`, surplus → `exit_br*`), re-derives and re-validates before emitting (fail-loudly), and builds the game payload (level + side portals + the physics stamp, always embedded).

## Runtime: panel, game page, playback (`runnerDemoLibrary.js`, `index.js`, `game/`, `botDriver.js`)

Runner rides `flashSubstrate`'s machinery as shared code with its own identity, exactly like bounce: `createRunnerSubstrateEntry` builds on `createFlashSubstrateEntry` with component type `runnerDemoPanel`, load event `runner:loadRegion`, iframe id `runnerDemo`, playback event `runner:playbackControl`. The game page (`game/`) is a canvas renderer speaking the `__swfBridge` contract, with render-side juice and built-in touch controls (the whole panel is the jump area — tap = buffered press, hold = variable jump, release = cut — plus a corner drop button; visibility follows coarse-pointer detection with a host `moduleSettings` override). The default entry's zone table is built lazily on first use (several seconds of solver time) and cached.

**Playback.** The registry entry's `getPlaybackController` returns a host-side `PlaybackProxy`; the in-iframe bridge hands `walkTo` targets to `botDriver.js` — a greedy re-plan controller that, on every landing edge (`landedOn` *or* a `standingOn` switch), recomputes the shortest path over a lazily-expanded, cached `canRun` graph and picks a policy by forward-simulating candidates from the live state. A goal behind the player (auto-run cannot go left) routes via the implicit reset edge — one respawn — taken only when the entrance can actually route there. Hosts of open non-target portals are avoided at both route and candidate level, with legs into such hosts preferring the leftmost clean landing (jump off a tip before its portal box). A locked target is handled by driving to its host and parking (wall-pinned on `exit_main` — zero deaths), then synthesizing one full re-enter jump when the gate opens, because goal events fire on touch-*enter*; interior locked hosts cannot park under auto-run, and the die-retry loop is the accepted behavior there. Loop mode queues `regionMove`/`locationCheck` with `executeVia: 'playbackBot'`, same as bounce.

## Sphere-growth integration

The registry entry exposes the requirement-targeted hooks to the generic engine: `buildZoneSpecs` / `generateZoneForSpecs` (+ the stepped-flow `…Gen` variant), `canHostExitGates` / `exitGateVeto` / `gateHostingHint` (gates must nest along the strip; all physics gates are vetoed on sweep-saturating profiles), `backPortalGated → false`, and `buildRegionContract` for the panel's "Edit ▸" flow. `gateableItems` is constrained to the two ability items. Pipeline panel params are runner-prefixed to survive mixed-substrate merging: `runnerPhysicsProfile`, `runnerGapMargin` (how close plain run gaps sit to max grounded jump — gate windows are pinned and never move), `runnerHazardDensity`, `runnerLengthSteps`.

## CLI tools

- `scripts/procgen/dump-runner-level.js` — fixture/generated levels: geometry, derived rules per ability set, JSON export.
- `scripts/procgen/verify-runner-game.mjs` — Playwright: keyboard and touch input tapes on the standalone game page.
- `scripts/procgen/verify-runner-smoke.mjs` — Playwright: a runner world through the real frontend, solver-witness tape to a real check.
- `scripts/procgen/verify-runner-bot.mjs` — Playwright: bot `walkTo` through the playback controller surface.
- `scripts/procgen/verify-runner-embed.mjs` — Playwright round-trip of a sphere-grown runner world, first check to Victory, bot-driven.

Substrate tests run in the **test-substrates** config (the regression config lacks substrate runtimes). Slow suites (`*.slow.test.js`) run via `vitest.slow.config.js`.

## Related documentation

- [Architecture](./architecture.md) — where runner sits in the pipeline
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract and runner's adapter hooks
- [Bounce Substrate](./bounce.md) — the sibling substrate most of runner's patterns port from
- [Sphere-Driven Growth](./sphere-growth.md) — the driver runner's spec generation serves
- [Paths and Obstacles](./paths-and-obstacles.md) — the rule vocabulary runner emits into
