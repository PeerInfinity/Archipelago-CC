# Runner Substrate

Runner (substrate id `runner`, in `frontend/modules/runnerDemo/`) is an auto-runner platformer: the player always runs right. Each region is one level, a left-to-right strip from the entrance to pickups and exit portals, and its access rules are derived from the physics rather than authored.

The only inputs are jump (hold for height), a second air jump when Double Jump is held, drop-through on one-way platforms, and a reset key that respawns at the entrance.

As in [bounce](./bounce.md), every layer (generator, solver, runtime and emitted rules) is built on one physics function and one verifier, so they cannot disagree. Auto-run is what keeps the solver small: with right always held, `vx` is a fixed function of distance run since landing. A hop's state is just (landing x, arrival vx), and its inputs are just jump timings and hold lengths.

**Nothing in a level persists between attempts.** All level state resets on region entry and on every respawn (death, kill floor or reset key). The only lasting state is collected items, held by the host. New stateful content must use the same per-attempt reset.

## Files

Each of `physics.js`, `suppression.js`, `level.js`, `canRun.js`, `deriveRules.js`, `generator.js`, `apRules.js`/`zoneRules.js` and `botDriver.js` has its own section below. The rest:

| File | Role |
|------|------|
| `vendor/toolkit-physics-original.js` | Upstream toolkit source, used by `parity.test.js`. |
| `gameCore.js` | `ABILITY_ITEM_NAMES`, `VICTORY_ITEM_NAME`, the game session. |
| `witnessSearch.js` | Test-only forward-search oracle. |
| `verifyObstacles.js` | `verifyObstacleGating`. |
| `runnerDemoLibrary.js` | The registry entry (`createRunnerSubstrateEntry`) and its hooks. |
| `runnerLibraryEntry.js` | Capture and instantiate region-library entries. |
| `runnerProcgenParams.js` | Pipeline knobs (`DEFAULT_RUNNER_PROCGEN_PARAMS`). |
| `fixtures.js` | Hand-authored test levels (`FIXTURES`). |
| `game/`, `index.js` | The game page and module registration. |

## Physics core (`physics.js`)

`step(state, input, level, abilities, constants)` advances one tick at `TICK_HZ` (50). The game loop runs it, the solver samples it and the bot forward-simulates with it. It is a port of the GMTK Platformer Toolkit (MIT); `parity.test.js` checks it tick by tick against the vendored upstream source under the same input tapes.

**Warning:** runner uses the toolkit's Unity units with +y up (`GRAVITY` is negative), unlike bounce's y-down pixels. A platform's x/y is its bottom-left corner; the renderer scales by `UNIT` only when drawing.

The engine adds what the toolkit lacks: auto-run (left/right input is ignored), one-way platforms with drop-through, non-solid hazard boxes (touch means death and respawn), coyote time and jump buffering (`coyoteTime`, `jumpBuffer`), `standingOn`/`landedOn` bookkeeping for the solver and bot, and a hit counter for the Shield.

`PROFILES` holds `toolkit`, `celeste` (the default, `DEFAULT_PROFILE_ID`), `nsmbu`, `sonic` and `meatboy`: the toolkit's presets as constant overrides. Constants affect logic, so every generated payload carries them (`physicsStampFor` / `resolvePhysicsStamp`). The runtime uses the embedded constants, never a profile-name lookup.

## Ability items and suppression (`suppression.js`, `gameCore.js`)

Five abilities gate progress. Each is monotone by construction: gaining it can only add routes.

| Ability | AP item | Mechanism |
|---|---|---|
| `doubleJump` | Double Jump | Params overlay: `maxAirJumps: 1`. Using it is optional, so every route without it survives. |
| `blue` | Blue Platforms | Existence: `blue` platforms are one-way with drop-through, so they never block a route. |
| `spring` | Springs | Existence: `spring` platforms launch the player on contact (rising `SPRING_RISE`) and can be refused with drop-through. They are mid-leg geometry, never graph nodes, and never host goals. |
| `glide` | Glide | Existence: `glider` pads are one-way. Holding jump during a non-jump fall that left a pad caps fall speed at `GLIDE_FALL_CAP`. No params overlay is needed, because a glide can only start from a pad that exists. |
| `shield` | Shield | Params overlay on the death threshold: `MAX_HITS` becomes the number of Shields held. Trajectories never change; a hit only increments a counter, so more hits allowed can only add outcomes. |

An ungated `oneway` platform type (always present, drop-through) is used for reward shelves.

Solver, verifier, generator and renderer all ask `suppression.js` whether a platform exists and which params apply, so they cannot diverge. Pickups, portals and hazards are never suppressed. A per-platform `gate` field overrides the type's gate; only tests use it, to build a non-monotone level for the verifier to catch.

## Level model (`level.js`)

A level is stored geometry:

- `platforms`, typed by `KNOWN_PLATFORM_TYPES`: `ground` (solid), `blue`, `spring`, `glider`, `oneway`.
- `hazards`: static kill boxes. The type (`spikes`, `saw`, `ceiling`, `bed`) affects rendering; `bed` also adds `shield` to the verifier's ability universe.
- `pickups`, `portals` (with an `arrow` and an `exitName`), and `spawn`.

Gaps are not entities: they are empty space between floors, and the kill floor ends any fall.

The key placement rule is the **goal-wake rule**. Every pickup and portal sits in the auto-run path just past its host platform's right end, with that path clear of solids and hazards. Any landing on the host followed by plain auto-run collects the goal, so a goal is reachable exactly when its host is. `validateLevel` enforces this, plus: no full-height wall pockets, no fully lethal walk surfaces, and solid ground under the spawn.

## The `canRun` solver (`canRun.js`)

`canRun` samples `step`; it has no physics of its own. An edge A→B exists if, from every sampled arrival on A (landing x across the stand span × arrival speeds as fractions of `maxSpeed`), some sampled input policy makes the player's next support be B.

A leg ends when `standingOn` switches platform. That covers airborne landings and also running across flush platform edges, which never fire `landedOn`; this is why the policy set always includes "no input".

The policy set (`policiesFor`) is finite and ordered cheapest-first:

- no input;
- position-triggered jumps × holds (tap, mid, full);
- second-press timings, when Double Jump is held;
- drop-through, on one-way hosts;
- hazard-lead jumps placed just ahead of each hazard;
- on `glider` pads only: press-and-hold past the lip, and hop-and-hold (a short hop whose landing keeps jump held).

A finite set can miss real edges. That is the safe direction: derived rules never claim a jump the player cannot make.

### Doom, touch and launch

The `canRun.js` header is the authoritative statement of this model. An arrival is **live** if some policy from it avoids death, **doomed** otherwise (`survivesFrom`).

- A **touch** edge is enough to collect the target's wake goals, even if the player dies right after.
- Only **launch** edges, whose landing is live, chain onward.

This lets a pickup on a doomed floor just before a gate derive its real requirement, instead of circularly requiring the gate's own item. Death costs nothing permanent, so "accessible" means "some trajectory from spawn reaches the goal".

### Graph and hit budget

Nodes are (platform, hits remaining) pairs (`nodeKey`); an edge's cost is the worst hit spend among its witnesses. With no Shield the budget is always 0 and the graph has one node per platform.

`buildRunGraph` builds the full graph for the shared BFS in `frontend/modules/shared/simulatorCore.js`. Generated levels use `reachableRunPlatforms` instead: a lazy left-to-right flood that prunes by x (auto-run never moves left) and reaches the same verdicts. Two caches are shared within an evaluation: a doom cache (survival scans) and a leg cache (a leg's outcome does not depend on the target, so one simulation serves every candidate target).

`witnessSearch.js` is a test-only forward search, more complete than the policy set. Slow tests use it to check that everything the solver finds, the oracle finds too.

## The derive-rules verifier (`deriveRules.js`)

`deriveAccessRules` runs reachability under every subset of the level's ability universe (`abilityUniverse`: `doubleJump` always, gated types only when present) and returns per goal the minimal ability sets. Subsets with identical active geometry and identical params share one evaluation. Goals are pickups and portals; plain platforms may be unreachable decoration. Goals use touch reach; chaining uses launch edges.

It also checks monotonicity: gaining an item must never make a goal unreachable. Runner's content is monotone by construction, so this is a tripwire. A violation is a generator bug.

## Level generation (`generator.js`)

`generateLevel` proposes a strip for a target requirement and verifies it with `deriveGeneratedRules`: every pickup and exit must derive exactly `[S]`, with no defects. A failed proposal retries with a perturbed seed. Geometry is stored in the payload; the seed only drives generation.

The strip is a chain of floors separated by gaps. Gap kinds:

| Kind | Crossing | Gates on |
|---|---|---|
| `run` | A grounded full-hold jump. | nothing |
| `dj` | Wider than any single jump, within double-jump reach. | `doubleJump` |
| `stone` | A double-wide gap with a `blue` stepping stone mid-gap. | `blue` |
| `spring` | A gap too wide for double jump, crossed by a spring bounce. | `spring` |
| `glide` | A ramp up to a `glider` pad over a drop too wide for double jump; running off the pad holding jump glides across. The landing floor is widened so a glide never overflies it. | `glide` |
| `bed` | A plain-jump gap filled by one `bed` hazard that every crossing arc passes through, so crossing costs one hit. At most one per strip. | `shield` |
| `branch` | A widened plain gap with a raised tip platform holding a surplus exit. | nothing |

Gate widths come from closed forms where possible and from solver sweeps otherwise (`sweepMaxGap`, `sweepSpringTotal`, `sweepMaxRise`, `sweepGlideChasm`, `sweepCeilingMin`). `sonic` and `meatboy` saturate the gap sweep (`SWEEP_SATURATING_PROFILES`), so physics gates are refused on those profiles rather than emitted unverified.

Spike patches decorate floors outside gate margins. Landing floors are kept hazard-free wherever a crossing lands in a narrow window: after shelves, split merges, ceilings, glides, beds and branch tips.

**Note:** keep branch-tip landing floors spike-free. A tip's portal box covers its wake, so clean crossings jump from the tip's left half and land on the next floor's left end. Spikes there trap real play while the logic, which treats touching an open portal as travel, still passes.

### Optional features

These draw from the rng only when their chance is non-zero, so with all at 0 the generator reproduces the plain layout draw for draw.

- **Reward shelves** (`shelfChance`): a `oneway` shelf in the last spring or dj gate's descent, holding a pickup. The crossing arc lands on it; running off drops to the landing floor, and holding drop skips it. Its height is set so it needs exactly that gate's ability. Spring shelves may hang a `saw` underneath, off every required path.
- **Ceiling hazards** (`ceilingChance`): a kill slab over a short gap, low enough that a full-height jump dies and a short hop passes under. `ceilingMargin` 1 (default) makes a grounded short hop enough; 0 requires a coyote-time tap off the edge. A profile where no hold height separates the two (`nsmbu`) refuses ceilings.
- **Jitter**: plain floors rise by a random amount; gate, branch, entrance and exit floors stay at base height because gate widths are calibrated on flat ground.
- **Splits**: a ramp climbs to a fork where jumping catches a one-way upper lane and running on falls to the lower floor. Both lanes are plain geometry, so requirements do not change.

### Exits, zone tables and specs

The main exit `exit_main` sits at the strip's right end; surplus exits sit on branch tips (`exit_br0`, `exit_br1`, …).

`generateZoneSet` builds a winnable zone table: zone 0 requires nothing and grants the first item, fillers grant nothing, and the last pickup is Victory. Each zone records its generation `spec` so `extractZoneRules` can regenerate it.

For sphere growth, `planStripSpecs` plans a strip for requirements the engine computed. The requirements must form one nested chain (∅ ⊂ R1 ⊂ … ⊂ Rk), because a strip realises gates in order. The largest must belong to an exit, which becomes `exit_main`; every other exit sits on a branch tip inside its requirement window. An exit with requirement `[]` lands on a tip before the first gate, which is how the engine's ungated back portal is realised. Incomparable requirements decline the spec.

## Rule emission (`apRules.js`, `zoneRules.js`)

Minimal ability sets become an OR of paths over physics obstacle ids `runner_gate_<ability>`, in the shared [paths-and-obstacles](./paths-and-obstacles.md) vocabulary. Authored non-physics terms (foreign items, counts above 1) become `logic_gate` obstacles ANDed onto every path, and travel in the payload as `gate_rules` for the bridge to evaluate. This is what lets runner regions sit in mixed-substrate worlds. `[]` becomes `False_`; `[[]]` becomes `True_`.

`assembleRunnerRegion` in `zoneRules.js` is the shared tail for the zone-table and spec paths. It maps exit sides to portals (`assignSidePortals`: the first side to `exit_main`, the rest to `exit_br*`), re-derives and re-validates before emitting, and builds the payload (level, side portals, physics stamp).

## Runtime: panel, game page, playback

Runner reuses `flashSubstrate` code with its own identity, like bounce: `createRunnerSubstrateEntry` builds on `createFlashSubstrateEntry` with component type `runnerDemoPanel`, load event `runner:loadRegion`, iframe id `runnerDemo` and playback event `runner:playbackControl`.

The game page (`game/`) is a canvas renderer speaking the `__swfBridge` contract. It has touch controls: the whole panel is the jump area (tap, hold, release) plus a corner drop button. They show on coarse-pointer devices unless `moduleSettings.runnerDemo.touchControls` overrides that. The default entry's zone table (`RUNNER_ZONE_COUNT` zones) is built lazily on first use and cached.

### The bot (`botDriver.js`)

`getPlaybackController` returns a host-side proxy; the in-iframe bridge hands `walkTo` targets to `createBotDriver`. On every landing (`landedOn` or a `standingOn` switch) the bot finds the shortest path over a lazily built, cached `canRun` graph and picks a policy by forward-simulating candidates from the live state.

- **Budget-aware routing.** Route nodes carry hits spent. Without this the bot can pick a leg whose witness needs a hit the player no longer has, die, respawn with a full budget and repeat the same route forever.
- **Doom-aware choice.** A candidate must land in a live state. Fallback order: clean and live, then one that touches a foreign portal (leaves the region, recoverable), then a doomed one.
- **Goals behind the player** are reached by respawning, only when the entrance can route there.
- **Open portals** that are not the target are avoided when routing and when choosing candidates.
- **Locked targets:** the bot drives to the host and waits (pinned against the wall on `exit_main`), then jumps back in once the gate opens, because goal events fire on entering. Interior locked hosts cannot hold position under auto-run, so there the bot dies and retries.

### Loop mode

Runner is a summary substrate (`summaryRecording: true`): Record keeps a visit's net result and Playback applies it instantly, with time-based costs. A Bot block runs the bot through the loops solver (`executeVia: 'solver'`), which is not this page's `canRun` solver. See [Loop Recording and Block Modes](./loop-recording.md).

## Sphere-growth integration

The registry entry exposes requirement-targeted hooks: `buildZoneSpecs`, `generateZoneForSpecs` (and `generateZoneForSpecsGen` for the stepped flow), `canHostExitGates`, `exitGateVeto` and `gateHostingHint` (gates must nest along the strip; all physics gates are vetoed on sweep-saturating profiles), `backPortalGated` (always false), `hostsSurplusExitsNatively`, and `buildRegionContract` for the panel's **Edit** flow. `gateableItems` is limited to the ability items.

A runner zone declares `regionGeometry: SIDES`: the pipeline writes no exit tile and no `entrance` for it. The entry declares `generationCost: 'heavy'`, so the CI preset test skips runner presets ([Pipeline Presets](./pipeline-presets.md)).

Pipeline params are prefixed so they survive mixed-substrate merging (defaults in `DEFAULT_RUNNER_PROCGEN_PARAMS`):

| Param | Meaning |
|---|---|
| `runnerPhysicsProfile` | Physics profile. |
| `runnerGapMargin` | How close plain run gaps sit to the maximum grounded jump (0–1). Gate widths never move. |
| `runnerHazardDensity` | Spike-patch chance per eligible plain floor. |
| `runnerLengthSteps` | Maximum plain floors between features. |
| `runnerJitter` | Vertical jitter of plain floors (0–1). |
| `runnerSplitChance` | Split-segment chance per plain slot. |
| `runnerCeilingDensity` | Ceiling-hazard chance per plain slot. |
| `runnerCeilingMargin` | 1 = a grounded short hop crosses ceilings; 0 = coyote-tap only. |

## CLI tools

| Script | Purpose |
|---|---|
| `scripts/procgen/dump-runner-level.js` | Fixture or generated levels: geometry, derived rules per ability set, JSON export. |
| `scripts/procgen/check-runner-game.mjs` | Playwright: keyboard and touch input on the standalone game page. |
| `scripts/procgen/check-runner-smoke.mjs` | Playwright: a runner world in the real frontend, a solver-witness tape to a real check. |
| `scripts/procgen/check-runner-bot.mjs` | Playwright: bot `walkTo` through the playback controller. |
| `scripts/procgen/check-runner-embed.mjs` | Playwright: a sphere-grown runner world, bot-driven from first check to Victory. |
| `scripts/procgen/check-region-library-sphere-roundtrip-runner.mjs` | A sphere world mixing a committed runner library entry with generated runner regions, through `world_generator` and `Generate.py`, to a winnable seed. |
| `scripts/procgen/make-demo-runner-pack.mjs` | Generates the committed demo runner pack (`frontend/region-libraries/demo-runner-pack.json`). |

The four `check-runner-*.mjs` Playwright scripts need a dev server on port 8000.

## Tests

- Unit tests (`*.test.js`) run in `npm run test:unit`; `generator.calib.test.js` runs only in `npm run test:unit:calib`.
- The runner's `*.slow.test.js` files are excluded by `vitest.slow.config.js`; its comment explains why.
- In-app runner tests run in the `test-substrates` config (the regression config has no substrate runtimes).

## Related documentation

- [Architecture](./architecture.md) — where runner sits in the pipeline
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract and runner's hooks
- [Bounce Substrate](./bounce.md) — the sibling substrate most of runner's patterns come from
- [Sphere-Driven Growth](./sphere-growth.md) — the driver runner's spec generation serves
- [Paths and Obstacles](./paths-and-obstacles.md) — the rule vocabulary runner emits into
