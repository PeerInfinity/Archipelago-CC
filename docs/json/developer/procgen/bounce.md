# Bounce Substrate

Bounce (substrate id `bounce`, in `frontend/modules/bounceDemo/`) is a Doodle-Jump-style vertical platformer. Each region is one level, a climb from the entrance to pickups and exit portals, and its access rules are derived from the physics rather than authored.

There is no jump button: landing on a platform from above bounces the player, springs and jetpacks boost the launch, platforms are one-way (rising passes through them), and the screen wraps horizontally.

Every layer (generator, solver, runtime and emitted rules) is built on one physics function and one verifier, so they cannot disagree. This page walks the layers bottom-up.

## Files

| File | Role |
|------|------|
| `physics.js` | `step`, `PROFILES`, `simulate`, `launchRise`: the physics. |
| `suppression.js` | Which platforms, springs and jetpacks exist under an ability set. |
| `apRules.js` | Ability to AP item mapping, `VICTORY_ITEM_NAME`, rule and obstacle emission. |
| `canJump.js` | The jump solver and platform graph. |
| `deriveRules.js` | The derive-rules verifier (`deriveAccessRules`, `deriveBraidAccessRules`). |
| `generator.js` | Level generation: column and braid proposers, per-profile geometry. |
| `sideExits.js` | Attaches one exit portal per requested side; maps portals to sides. |
| `level.js` | Structural invariants (`validateLevel`, `braidBlueInvariantErrors`). |
| `regionReport.js` | `formatRegionReport`: text report of a region, per-row requirements included. |
| `verifyObstacles.js` | `verifyObstacleGating`. |
| `bounceDemoLibrary.js` | The registry entry (`createBounceSubstrateEntry`) and its hooks. |
| `bounceLibraryEntry.js` | Capture and instantiate region-library entries. |
| `bounceProcgenParams.js` | Pipeline knobs and defaults (`DEFAULT_BOUNCE_PROCGEN_PARAMS`). |
| `botDriver.js` | The playback bot. |
| `gameCore.js`, `game/` | The in-browser game session and canvas renderer. |
| `djReal/` | The real-Doodle-Jump renderer page. |
| `index.js` | Module registration and the panel class. |

The region editor lives separately in `frontend/modules/bounceRegionEditor/`.

## Physics core (`physics.js`)

`step(state, input, level, abilities, constants)` advances one logical frame. The in-browser game loop runs it, the solver samples it, and the bot forward-simulates with it.

Conventions: y increases downward (a launch is negative `vy`); platform, pickup and portal positions are centres. The module uses no RNG and no clock, so it is deterministic.

`PROFILES` holds two sets of constants, as plain data:

- `experimental` — the original constants (`DEFAULTS`): 60 ticks/s, momentum-based air control, modular screen wrap.
- `dj` — constants taken from the real Doodle Jump: 20 ticks/s, constant gravity, flat air control, latched landings (the catch zeroes `vy` and the impulse applies next tick), and edge-teleport wrap.

`step` branches on behaviour fields (`AIR_CONTROL`, `LANDING`, `WRAP`, impulse and thrust values), never on a profile name, so a profile serializes into the region payload as data. New worlds default to `dj` (`bounceProcgenParams.js`). An `experimental` world stores no profile stamp; an absent stamp means `experimental`.

## Ability items and suppression (`apRules.js`, `suppression.js`)

Six abilities gate movement by controlling whether geometry exists, not by rule checks:

| Ability | AP item | Unlocks |
|---|---|---|
| `left` / `right` | Left arrow / Right arrow | Holding that direction |
| `springs` | Springs | Springs exist (their host platform must exist too) |
| `jetpacks` | Jetpacks | Jetpacks exist (same host rule) |
| `blue` | Blue platforms | Blue platforms exist |
| `brown` | Brown platforms | Brown platforms exist |

The solver and the renderer both go through `suppression.js`, so they cannot diverge. Pickups and portals are never suppressed; whether they are reachable is derived.

`apRules.js` emits derived rules in the shared [paths-and-obstacles](./paths-and-obstacles.md) vocabulary. Physics obstacle ids are `bounce_gate_<ability>`. Authored non-physics terms (foreign items, counts above 1) become `logic_gate` obstacles ANDed onto every path.

## The `canJump` solver (`canJump.js`)

`canJump` samples `step`; it has no physics of its own. A jump edge A→B exists if, from every sampled launch x across A's catch span, some sampled input policy makes the player's next landing on another platform be B. "Every x" because the player cannot always choose where they land; "some policy" because they choose the inputs.

The policy set is finite, so the solver can miss real edges. That is the safe direction: derived rules never claim a jump the player cannot make.

The graph has a synthetic `ENTRANCE` node. Teleport-to-start hosts (`isTeleportHost`) are terminals with an edge back to `ENTRANCE`. Under the `dj` profile, moving blue and breaking brown platforms make edges phase-dependent. `buildPlatformGraph` feeds the BFS solver in `frontend/modules/shared/simulatorCore.js`; a returned plan is the platform sequence the playback bot follows.

## The derive-rules verifier (`deriveRules.js`)

`deriveAccessRules` runs reachability under every subset of the level's ability universe (`abilityUniverse`: both arrows, plus springs/jetpacks/blue/brown only when the level contains them) and returns, per goal, the minimal ability sets that make it reachable. Goals are pickups and exit portals; plain platforms may be unreachable decoration.

It also checks monotonicity. An access rule means "has these items ⇒ reachable", so gaining an item must never make a goal unreachable. Suppression can break this: an unlocked blue or brown platform can catch a boosted launch that used to sail past. Violations are reported as defects the generator must avoid; they cannot be fixed when emitting rules.

With `{ includePlatforms: true }` it also returns per-platform minimal sets, which `regionReport.js` shows next to the authored intent.

## Level generation (`generator.js`)

`generateLevel` proposes a platform layout for a target requirement ("this level needs ability set S") and verifies it with the derive-rules verifier: every pickup and the top exit must derive exactly `[S]`, with no defects. A failed proposal retries with a perturbed seed. Geometry is stored in the payload; the seed only drives generation.

The column proposer builds a climb with one gate segment per required ability, separated by plain bounce steps. A gap gates only if the failing launch cannot clear it. Under `experimental` (`EXPERIMENTAL_GEOMETRY`):

| Gate | Geometry |
|---|---|
| springs | 380–440px gap above a spring: a plain bounce falls short, a spring clears it |
| jetpacks | 1180–1240px gap above a jetpack: a spring falls short, a jetpack clears it |
| blue / brown | A coloured stepping stone mid-gap: without the item the gap is too wide |
| left / right | A 140px column shift, wider than the catch span, so the matching arrow is required |

`EXPERIMENTAL_GEOMETRY` is fixed so committed presets reproduce byte-identically. Other profiles derive theirs with `deriveGeometry` from rises measured by `launchRise`, which runs `step`. `validateGeometry` checks both. Multi-target levels use a fixed width (`FIXED_WIDTH`) so the wrap point and renderer zoom do not depend on placement.

`generateZoneSet` builds a winnable zone table: zone 0 grants both arrows with no requirement, each later zone requires already-granted abilities and grants the next item, fillers grant nothing, and the last zone's pickup is Victory. `generateLevelFromSpecs` builds a level for requirements the pipeline computed.

## Braid generators

A braid is an alternative to the column: 2-wide branching geometry. `generator.js` has one proposer per regime.

**`proposeBraidLevel` (arrows free).** Used when the player holds both arrows from the start, as in top-down worlds. Nothing needs gating; the geometry only has to be climbable with `{left, right}`. The braid is a row-by-row state machine over one or two lanes on the wrap ring (one lane meanders or forks; two lanes shift together or merge). Portals sit on fork branches or the single-lane top.

**`proposeBraidLevelGated` (gated chain).** Used in sphere growth, where abilities are items. A fork cannot gate by arrow, because its two branches are within one wrapped hop, so this proposer builds a fork-free chain with one climbable platform per row. `planBraidGatedChain` validates the goal set first. Gating primitives:

- **Arrow gate row:** the climbable platform shifts toward the gating arrow, and a teleport-to-start host sits where a wrong-arrow player drifts, so nobody soft-locks. At most one arrow gates per region.
- **Blue gate:** a blue stepping stone under a plain landing; without it the doubled gap cannot be cleared.
- **Spring / jetpack gate:** a launch host below a gap a plain bounce cannot clear.
- **Brown gate:** brown breaks on landing, so it can only host the topmost goal.

Gates nest: each goal's requirement is a prefix of the cumulative gate set below it. A set that cannot nest (both arrows, incomparable requirements, a brown that is not the top goal) makes the braid decline, and the region falls back to a column.

Jitter only moves rungs above an arrow gate toward that arrow, so arrow-free goals still derive exactly `[]`.

Braids are verified with `deriveBraidAccessRules`, a row-aware reachability check that gives the same verdict as the full solver on this geometry at a fraction of the cost. Its `suppressBlues` option treats blue platforms as green→blue→green stepping stones to keep subset enumeration small; the bot sets it when `braidBlueInvariantErrors` finds no violations.

## Sphere-growth integration

The registry entry exposes requirement-targeted generation to the engine: `buildZoneSpecs` and `generateZoneForSpecs` produce zones whose goals carry the engine's computed requirements. Structural hooks (`canHostExitGates`, `exitGateVeto`, `backPortalGated`, `gateHostingHint`, `hostsSurplusExitsNatively`) let the engine ask what gate combinations bounce geometry can realise. Gate terms that are not abilities become `logic_gate` locks evaluated by the bridge.

`buildBounceRegionContract` backs the panel's **Edit** flow. The entry also declares a `roomEditor` and a `regionRoundTrip`, both in `bounceRegionEditor/`. The gated braid's per-platform intent (`authoredReqs`) travels alongside the payload for the region report; it is never merged into a world.

A bounce zone declares `regionGeometry: SIDES`: the pipeline writes no exit tile and no `entrance`, and the bridge routes an exit by its side through the payload's `sidePortals` map. See [Substrate Registry Reference](./substrate-registry.md) for the full hook list.

### Exit ids and sides (`sideExits.js`)

`attachSideExits` adds one exit platform and portal per requested side, and returns `{ level, sidePortals }`. In the default `directional` placement, N reuses the level's own `up` portal when there is one; `generator.js` names a climb's top exit `exit_up`, so that id survives. The `arbitrary` placement drops authored portals and puts every side at an interior spot.

`assembleBounceRegionFromLevel` rebuilds a region from a level that already has portals. It reads each exit's id from the level (`portalIdsBySide`) and uses `side_exit_<side>` only for a side with no portal.

**Warning:** do not mint `side_exit_<side>` for a side whose portal already exists. The derived rule is looked up by portal id, so a minted id finds no rule, becomes `False_`, and `sidePortals` names a portal the level lacks.

`portalSide` is the one answer to "which side is this portal on", shared with the region editor. It reads the portal's `direction` arrow first, because `bounceLibraryEntry.js` moves a captured portal to a new side by changing the arrow and keeping the id.

## Runtime: panel, renderers, playback

Bounce reuses `flashSubstrate` code, not its instances: the panel class comes from the shared iframe-panel factory and the bridge is `flashSubstrate/bridge.js` (the game page speaks the same `__swfBridge` contract). Bounce has its own component type `bounceDemoPanel`, load event `bounce:loadRegion` and iframe id `bounceDemo`, so flash and bounce loads target different iframes.

**Renderers.** The `moduleSettings.bounceDemo.renderer` setting picks `js` (the canvas renderer, default) or the real-Doodle-Jump page `djReal/` under a player tier: `ruffle`, `swfrecomp` (browser WASM), `flash` (native, needs a Flash-capable browser) or `dj` (auto). The panel swaps its own iframe source; both pages use the same iframe id and bridge contract, so the registry identity does not change.

**Playback.** `getPlaybackController` returns a host-side proxy that publishes commands on `bounce:playbackControl`. The in-iframe bridge hands `walkTo` targets to `botDriver.js` (`createBotDriver`), which re-plans on every landing: it finds the shortest path over the `canJump` graph and picks an input by forward-simulating candidates through `step`. There is no stored plan. A goal below the player is reached by returning to the entrance, through a teleport host (braids) or by falling off the level (columns).

**Loop mode.** Bounce is a summary substrate (`summaryRecording: true`): Record keeps a visit's net result and Playback applies it instantly, with time-based costs; a Bot block runs the bot with `executeVia: 'solver'`. See [Loop Recording and Block Modes](./loop-recording.md).

## CLI tools

| Script | Purpose |
|---|---|
| `scripts/procgen/dump-bounce-level.js` | One generated level: geometry, physics config, compiled rules. |
| `scripts/procgen/dump-bounce-region.js` | Region report for a gated braid, verified vs authored. |
| `scripts/procgen/check-bounce-embed.mjs` | Playwright: a bounce world through the real frontend, first check to Victory. |
| `scripts/procgen/check-bounce-touch.mjs` | Playwright: the standalone page's touch controls. |
| `scripts/procgen/make-demo-bounce-pack.mjs` | Generates the committed demo bounce region-library pack. |

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — where bounce sits in the pipeline
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract and bounce's hooks
- [Gotchas](./gotchas.md) — bounce/flash code sharing, braid-vs-driver naming
