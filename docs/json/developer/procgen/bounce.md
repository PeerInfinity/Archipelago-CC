# Bounce Substrate

Bounce ("Bounce Demo", substrate id `bounce`) is a Doodle-Jump-style vertical platformer substrate in `frontend/modules/bounceDemo/`. There is no jump button: landing on a platform from above bounces the player automatically, springs and jetpacks boost the launch, collision is one-way (rising passes through platforms), and the screen wraps horizontally. Each generated region is one level — a climb from a bottom-center entrance to pickups and exit portals — whose access rules are *derived from the physics*, not authored.

The substrate's defining property is that every layer is built on one physics function and one verifier, so the generator, the solver, the runtime, and the emitted Archipelago rules cannot disagree with each other. This page walks the layers bottom-up.

## Physics core (`physics.js`)

`step(state, input, level, abilities, constants)` advances one logical frame and is the single source of truth: the in-browser game loop runs it, the solver samples it, and the bot driver forward-simulates with it — all importing this one dependency-free module.

Conventions: y increases downward (screen-style; launches are negative `vy`), platform/pickup/portal positions are centers, and the module uses no RNG and no clock — determinism is a design principle (no algorithm may rely on RNG determinism, so there is none to begin with).

**Physics profiles are pure data.** `PROFILES` exposes two constant sets:

- `experimental` — the original engine constants (`DEFAULTS`): 60 ticks/s, gravity 0.5, plain bounce `vy −13` (apex ≈ 169px), spring `−22` (≈ 484px), jetpack `−36` (≈ 1296px), momentum-based air control, modular screen wrap.
- `dj` — constants measured from the real Doodle Jump: 20 ticks/s, constant gravity 4, flat (momentum-free) air control, "latched" landings (catch is a one-tick lookahead that zeroes `vy` in place; the impulse applies next tick), edge-teleport wrap.

The differences are expressed entirely through structural behavior fields (`AIR_CONTROL: 'accel' | 'flat'`, `LANDING: 'immediate' | 'latched'`, `WRAP: 'modular' | 'edge'`, impulse/thrust values) — `step` branches on the specific field, never on a profile name, so a profile serializes into the region payload as plain data. The pipeline's default for new worlds is `dj` (`bounceProcgenParams.js`).

## Ability items and suppression (`apRules.js`, `suppression.js`)

Six ability items gate movement, by gating the *existence* of geometry rather than by rule checks:

| Ability | AP item | What it unlocks |
|---|---|---|
| `left` / `right` | Left arrow / Right arrow | Holding that movement direction |
| `springs` | Springs | Springs exist (host platform must also exist) |
| `jetpacks` | Jetpacks | Jetpacks exist (same host rule) |
| `blue` | Blue platforms | Blue platforms exist |
| `brown` | Brown platforms | Brown platforms exist |

`suppression.js` is the one shared answer to "does this platform/spring/jetpack exist under this ability set" — both the solver and the runtime renderer must go through it, precisely so they cannot diverge. Pickups and portals are never suppressed; their accessibility is derived from reachability. `apRules.js` owns the ability↔AP-item mapping, the `Victory` item name, and the emission of derived rules into the shared paths-and-obstacles vocabulary (physics obstacle ids `bounce_gate_<ability>`; authored non-physics terms become `logic_gate` obstacles ANDed onto every path).

## The `canJump` solver (`canJump.js`)

A conservative forward-query sampler of `step` — it never simulates physics of its own, so solver and engine cannot disagree by construction. The jump edge A→B exists iff from *every* sampled launch x across A's catch span, *some* sampled input policy makes the player's next landing on a different platform be B (∀ arrival position because the player can't always choose where they arrive; ∃ policy because they choose the inputs). The policy family is finite, so the solver can miss real edges — pessimistic, which is the safe direction: derived rules never claim a jump the player can't make.

Details that matter downstream: the graph has a synthetic `ENTRANCE` node; teleport-to-start hosts are terminals with an edge back to `ENTRANCE` (landing there sends the player home); and under the `dj` profile edges are *phase-dependent* (moving blue platforms, breaking browns), handled by the phase machinery. The graph feeds the shared BFS solver in `frontend/modules/shared/simulatorCore.js`, and a returned plan is the platform sequence itself — the same data the playback bot replays.

## The derive-rules verifier (`deriveRules.js`)

Runs reachability under every subset of the level's *ability universe* (arrows always; springs/jetpacks/blue/brown only when the level contains the corresponding geometry) and derives, per goal, the **minimal ability sets** that make it reachable. Goals are pickups and exit portals only — both are landing-triggered on their host platform, so goal-reachable ⇔ host-platform-reachable; plain platforms are allowed to be unreachable decoration.

The verifier also checks **monotonicity**: an Archipelago access rule means "has these items ⇒ accessible", so gaining an item must never make a goal *un*reachable. Suppression can violate this — an unlocked blue/brown platform can intercept a boosted launch that previously sailed past it. Violations are reported as defects that the generator must design away; they are not repairable at rule-emission time.

`deriveAccessRules({ includePlatforms: true })` additionally exposes per-platform minimal sets ("items required to reach this row"), which the region report and the `dump-bounce-region.js` CLI surface as a verified-vs-authored side-by-side.

## Level generation (`generator.js`)

Generate-and-test: `generateLevel` *proposes* a platform arrangement for a target requirement ("this level needs ability set S") and *verifies* it with the same derive-rules verifier the pipeline uses — every pickup and the top exit must derive minimal sets of exactly `[S]`, with no defects. Failed proposals retry with a perturbed seed. Geometry is stored explicitly; the seed only drives generation, nothing at runtime replays it.

The column proposer builds a vertical climb with one **gate segment** per required ability, separated by plain bounce steps, and the spacing is a function of the physics constants (a gap only gates if the failing launch's apex can't clear it):

| Gate | Geometry (experimental profile) |
|---|---|
| springs | 380–440px gap above a spring — plain apex 169 fails, spring apex 484 clears |
| jetpacks | 1180–1240px gap above a jetpack — spring 484 fails, jetpack 1296 clears |
| blue / brown | A colored stepping stone mid-gap (240px total): plain bounce can't skip it; with the item it's two 120px steps |
| left / right | A 140px column shift — the catch span is 42px, so the matching arrow is required |

Per-profile geometry is either apex-derived (recomputed from the constants via apex = vy²/2g) or sweep-calibrated (empirical, e.g. the 600px width floor below which single-arrow gating collapses under screen wrap); the experimental profile's table is pinned to legacy literals so committed presets reproduce byte-identically, and the generate-verify loop remains the gatekeeper either way. Multi-target levels use a fixed 700px width so the wrap point and renderer zoom never depend on placement.

`generateZoneSet` builds a whole winnable zone table for the substrate factory: zone 0 grants both arrows with no requirement, each later non-filler zone requires a subset of already-granted abilities and grants the next item, fillers grant nothing, and the final zone's pickup is Victory.

## Braid generators

Braids are an alternative proposer producing 2-wide branching-path geometry instead of a single column. Two regimes, selected by whether abilities are free or gated:

**Regime 1 — arrows free** (top-down regions where the player holds both arrows as starting inventory). Nothing needs to gate; the geometry only has to be *traversable* with `{left, right}`. The braid is a vertical state machine over 1–2 active lanes (a 1-lane row meanders or forks; a 2-lane row shifts rigidly or merges) living directly on the wrap ring, which frees it from the column's symmetric width-fit wall — it fits widths down to ~2× the catch span. Portals ride fork branches or the single-lane capstone.

**Regime 2 — gated chain** (sphere growth, where abilities are gated items). The Regime-1 fork can't gate by arrow — its two branches are within one wrapped hop of each other, so one arrow *leaks* to the other branch. Regime 2 therefore uses a fork-free single-climbable-platform-per-row chain, with these gating primitives:

- **Arrow gate row**: the climbable platform offsets toward the gating arrow; a teleport-to-start host sits at the mirror position where a wrong-arrow player drifts (landing there sends them home — no soft-lock). At most one distinct arrow gates per region.
- **Blue gate**: a blue stepping stone under a plain landing — without the item the stone is suppressed and the doubled gap can't be cleared.
- **Spring / jetpack gate**: a launchable host below a gap a plain bounce can't clear.
- **Brown gate**: brown breaks on landing (terminal), so it can only host a *ceiling* goal — the chain's topmost.
- Gates compose as a **nested chain** (each goal's requirement a prefix of the cumulative gate set below it). Requirement sets that can't nest — two arrows, incomparable requirements, a non-ceiling brown — make the braid decline, and the region falls back to a column.

Jitter is arrow-directional: the arrow-free spine stays straight (so arrow-free goals derive exactly `[]`); rungs above an arrow gate may drift toward it.

Braid verification uses `deriveBraidAccessRules`, a row-aware reachability that is verdict-identical to the full solver on this geometry but much cheaper; an opt-in `suppressBlues` mode treats blue platforms purely as green→blue→green stepping stones to keep the subset enumeration tractable. `level.js` (`validateLevel`, `braidBlueInvariantErrors`) holds the structural invariants.

## Sphere-growth integration

For sphere-grown worlds, the registry entry exposes requirement-targeted generation to the generic engine: `generateZoneForSpecs` / `buildZoneSpecs` produce zones whose goals carry the engine's computed requirements, and the structural hooks (`canHostExitGates`, `exitGateVeto`, `backPortalGated`, `gateHostingHint`, …) let the engine ask bounce what gate combinations its geometry can realise instead of hard-coding the answer. Non-geometry gate terms (foreign items, counts > 1) are realised as bridge-evaluated `logic_gate` locks rather than physics. `buildRegionContract` backs the pipeline panel's "Edit ▸" flow, and the authored per-platform build intent (`authoredReqs`) rides alongside the payload for the verified-vs-authored region report — it is never merged into generated worlds. The full hook list is in the [Substrate Registry Reference](./substrate-registry.md).

## Runtime: panel, renderers, playback (`index.js`, `bounceDemoLibrary.js`, `botDriver.js`)

Bounce rides `flashSubstrate`'s machinery as shared **code**, not shared instances: the panel class comes from `flashSubstratePanel.js`'s factory and the injected bridge is `flashSubstrate/bridge.js` itself (the game page speaks the same `__swfBridge` contract). Bounce owns its identity — component type `bounceDemoPanel`, load event `bounce:loadRegion`, iframe id `bounceDemo` — so flash and bounce region loads configure different iframes and host activation brings the right panel forward.

**Renderers.** The `moduleSettings.bounceDemo.renderer` setting routes region loads to one of: `js` (the canvas renderer, default), or the real-Doodle-Jump page (`djReal/`) under a player tier — `ruffle`, `swfrecomp` (browser WASM), `flash` (native NPAPI, needs a Flash-capable browser), or legacy `dj` (auto). The single panel swaps its own iframe src between the two pages; both load under the same iframe id and speak the same bridge contract, so the registry identity stays constant and the renderer choice is panel-local. The tier is relayed to the dj page via localStorage.

**Playback.** The registry entry's `getPlaybackController` returns a host-side `PlaybackProxy` that publishes controller commands on `bounce:playbackControl`; the in-iframe bridge translates `walkTo` targets and hands them to `botDriver.js` — a greedy re-plan controller that, on every landing, recomputes the shortest path over the canJump graph and picks an input policy by forward-simulating candidates from the live state through the real `step`. There is no stored plan; divergence just means the next landing re-plans. On-column legs synthesize no input (the cheapest policy), so the familiar auto-climb of sphere worlds is this driver's degenerate case, not a separate mode. Since bounce physics can't descend a column, a goal below the player is recovered by returning to the entrance — via a teleport host edge when the level has one (braids), or by deliberately falling off the level (legacy columns).

Loop mode: bounce regions queue `regionMove` and `locationCheck` actions with `executeVia: 'solver'` — the loops queue parks while the bot plays the action, then charges its `loop_costs` value.

**Loop mode: the SUMMARY capture category (M5, 2026-07-23).** Bounce is one of the two *summary* substrates — a third capture contract beside coarse-only and fine-grained. Its play is real-time and its action stream is not worth replaying, so **Record** captures the visit's net RESULT (duration in drain seconds, the checks performed, the actions that carried an explicit cost, the exit crossed) and **Playback** applies that envelope instantly: deduct the repriced mana, refire the checks, cross the departure. The game replays nothing and the player character stays where it is — that is the design of the category, not a bug.

The economy is **time**: a per-second drain (`timeDrainPerSecond`, per region, default 1/s, XP-discounted like every other cost) is charged for every second the queue is parked on a Manual or Record block here, and per-action costs apply only where the `loop_costs` data names one explicitly. Playback prices at replay time (recorded seconds × the *current* rate), so region XP keeps mattering. The per-block Instant checkbox is hidden — summary playback is inherently instant.

`executeVia: 'solver'` stays declared but is **not reachable from Playback**: a summary block with no bound recording parks for live play instead. M6's Bot radio re-homes that path. Bounce does *not* declare `requiresLoopMode` — it is not a loop game. Full contract: [Loop Recording and Block Modes](./loop-recording.md#summary-substrates-m5-2026-07-23).


## CLI tools

- `scripts/procgen/dump-bounce-level.js` — one generated level: platform geometry, physics config, compiled rules.
- `scripts/procgen/dump-bounce-region.js` — per-platform requirement data / region report for a gated braid (verified vs authored).
- `scripts/procgen/verify-bounce-embed.mjs` — Playwright round-trip of a bounce world through the real frontend, first check to Victory.

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — where bounce sits in the pipeline
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract and bounce's adapter hooks
- [Gotchas](./gotchas.md) — bounce/flash code sharing, braid-vs-driver naming
