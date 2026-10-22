# Seedling fidelity IGFADE — the Igneous-to-Lava tiles count the dead frames' renders

| | |
|---|---|
| Session | `seedling-fidelity-igfade` (wave 23, planner `seedling-fidelity-planning-10`) |
| Start SHA | `eaf8cc4597` (js's `rope-land` = main 83861d68fa + the ROPE verb and its flip) |
| Code head | `c909d2da` (this report is the commit after it) |
| Harness branch | `claude/igneous-load-fade-q7wean` (local `seedling-fidelity-igfade`) |
| CI | `JavaScript Unit Tests` **green at `03dc6388`** (the code head before the docs commit): vitest 21,985 / 21,985, slow 263 / 263. The docs and report commits change no JS; read the run at the final head before harvesting |
| Switch | `CONTACT_FIDELITY.igneousDeadFrames`, **OFF**, under `igneousLava` (ON). OFF is byte-identical |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (staged witness, see its limit) · D3 STOP (the pins stay OFF, reason measured)** · switch movers measured, flip licence asked |

## The one thing to know first

**On the game, a room load gives a type-31 tile 21 renders at the arrival before the visit's first live tick.** The
render after the swap is already the new world's, and then the fade's 20 dead updates each render too. A boot or a death
restart that stands in range therefore turns the tile at the **t15** render (36 − 21), not at t36. This is witnessed on
p4g down to the frame, using the game's own `dead_frames` curve.

With the switch ON, the model steps those renders, so the interim's arrival refusal goes. The model also steps the
frozen spans: a pickup's phase A, a Help, and the wand and seed fades. Across the 15 type-31 survey steps and the 49
type-31 sweep legs, ON moves **nothing**: the interim never fired on the route.

Spans that move the player inside them stay refused by name. Those are the only ones on the game's content where a tile
is actually in play: L74's button fall and L71's chest seal ceremony.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B seedling-fidelity-igfade eaf8cc4597` | bootstrap `READY` (node v22.22.0); server PID 986 on port 9711 |
| identity block | `SEEDLING_PORT=9711 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`e484c3b22d5c5b3940b1112e458a8a1b`** (`evidence/w0/identity.txt`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, **all exit 0** |
| reference | `generate-procgen-reference.mjs --check` | ⚠ **4 differ AT THE BASE**: `registry.js`, `capabilities.js`, and the substrate matrix and chart regions. They are pre-existing and left as they are |
| surface / constants / entities / profile | each `--check` | GREEN **341** · PASS **6,856** · PASS 566 · PASS 138 (both) (`evidence/w0/surface-etc.txt`) |
| roster | `fixtures/tapes/index.json` `.tapes` | **289** (unchanged: the witness tapes live in `fixtures/igneous-witness/`, outside the roster) |
| bounded vitest BEFORE | 144 files (`evidence/bounded-files.txt`): the brief's standing list, plus every test naming `igneous`/`IGNEOUS`, `deadFramesOwed`, `clock.spans`, `CONTACT_FIDELITY_KEYS`/`_DEFAULTS`, `settleCameraForLoad` or `surface`, plus the key-list pins (`dashShape`, `solveProgressTap`, `seedlingWasmPlayback`, `seedlingDivergenceWindow`, `fidelityApBosses`) | **5,233 rows: 5,222 pass, 10 skipped, 1 FAIL at the base** (`procgenDocs/generated.test.js`, the same 4 reference regions). Sorted md5 `67ae3ff4…` |
| tapeRunner pairs | `tapeRunner.test.js` | **635 / 635**, sorted-rows md5 `1378a8d9…` |
| slow L32 | `vitest.slow.config.js fidelityL32ArenaPrefix` | 5 / 5 |

⚠ `apReportBosses`, `fidelityBossKills` and `fidelityBossFork` have no test files of those names.

## W0 — the count, measured (PASS)

**From the AS3** (vendor/seedling `src/` @`ccdf189776`):
- `Main.as:79`: `Bot.update(); super.update();`. `Engine.onEnterFrame` (`Engine.as:155-177`) is `update(); render();`.
  So a frame the bot's gate counts dead (`Bot.as` `if (game.blackCover > 0 || Game.freezeObjects) { deadFrames++; return; }`)
  still updates the world and **renders** it.
- `FP.world = new Game(…)` only writes `_goto`. `Engine.update` runs `checkWorld()` at its END (`Engine.as:77,242-252`),
  so the same frame's `render()` is the **new** world's.
- `Game.loadlevel` writes the camera raw (`Game.as:2251-2252`: `player.x − screen.width/2`, the model's
  `initialCamera`).
- `Game.update` (`Game.as:856-889`) skips `super.update()` while `blackCover > 0` but still runs `stepBlackCover` (under
  the pin) and `view()`. Twenty such updates (`LOAD_FADE_FRAMES`) each render.
- ⇒ **1 + 20 = 21 renders** at the arrival, before the render of the visit's first live tick. The Player is built at
  the arrival and nothing updates it. The cameras are `initialCamera`, then the settle's 20 `view()`s
  (`settleCameraForLoad`'s own loop).
- `Tile.render`'s case 31 (`Tile.as:126-130,390-433`) runs on every one of those renders. So does its `onScreen(0)`
  test.

**On the game** (p4g headless, port 9711). The probe was the encounter-ticks probe plus each sampled tick's
`botStatus().dead_frames` (`evidence/drivers/probe-igfade.mjs`). The predictions were written first: lava at the
t15 render, a restart obs at t46, then t61 and t92 for 21 renders, or t16/t47 for 20.

| tape | boot | game | model ON |
|---|---|---|---|
| `igneous-l76-fade-stand` | (152,92) → (160,100), 8.94 px from (10,6) | `dead_frames` 20 → 40 sampled at t47, → 60 at t93. With the fresh-stand tape's calibration (obs jump t111 ↔ sample t112), the restart obs are **t46** and **t92** | break in the fade (`t1 load`), **lava t15**, restart t46; the rebuilt tile breaks in its own fade, **lava t61**, restart t92. 101 ticks at 0 px, dead curve equal on every tick |
| `igneous-l76-fade-stand-86` | (128,92) → (136,100), **4.00 px from (8,6)** | the same: t47 / t93, plus the chain's hit at t40 | the same timing on (8,6), 0 px |

So the count is **21 for a boot and 21 for a death restart**. The position stream alone cannot see these deaths,
because the respawn is the boot spot; the dead curve is what shows them (trap candidate below).

## D1 — the load fade (PASS)

**Change** (`levelRun.js`, my functions only; ON only):
- `renderIgneousNow` hands off to `renderIgneousStepped` when `igneousDeadFrames` is ON. The OFF path is untouched, so
  the interim is byte-identical.
- On a visit's first render, every tile in range of the arrival (`spawnFromBoot(worldCtor)`) takes the fade's 21 dead
  renders. Each is under the settle's own camera, through `renderIgneousDead`: on screen with margin 0, the machine
  stepped, and the lava written through the same overlay. The events carry `dead: 'load'`.
- The arrival refusal is gone. Still refused: an arrival in range whose settle left a shake band (the `rebootShake`
  path). ⚖ The cosmetic RNG is never modelled.
- New per-visit fields `spans` and `last` live **inside `igneousStates`'** entries (ON only), and that map is already
  IN `stateDigestParts`' `visit`. So no new map and no `DIGEST_EXEMPT` row was needed.
- `CONTACT_FIDELITY.igneousDeadFrames` (OFF, env `SEEDLING_IGNEOUS_DEAD_FRAMES=0|1`).
  `contactFidelityHook` derives the page setting `flashPanel.seedlingContactIgneousDeadFrames` (default false) by
  itself.

**Gate**: `fidelityIgfade.test.js`, 14 rows:
- Both fade stands ON: 0 px, the dead curve, restarts [46, 92], and the events.
- The interim refuses them by name.
- `igneousLava` OFF misses the t46 restart.
- The L74 rows.
- The six IGNEOUS witnesses at 0 px ON.

**Mutants** (predicted first, made by copy + restore):

| mutant | predicted | measured |
|---|---|---|
| M1 the fade takes 20 renders (`LOAD_FADE_FRAMES − 1` view steps) | the two D1 ON rows red (lava t16, restarts t47/t93), nothing else | exactly those 2 |
| M3 the after-render spans not stepped | the L74 ON row red on its events (lava at the live t40, not `t31 ceremony`); positions still 0 px | exactly that 1 row; ⚠ caught by the event list, not by the game (see D2) |

## D2 — the dead spans (PASS; the witness is staged, with a limit)

**Change.** `clock.spans` since the last render, read per visit:
- **`help`** is drained at the TOP of its tick (`drainPickupHelp`). The Help's dead frame precedes that tick's update,
  so it renders BEFORE this render, at the previous render's position and camera.
- **Pickup phase A** (`ceremony`, `pickup phase A …`), the **wand approach fade** and the **seed cover fade** are spent
  inside this tick's update. They render AFTER it, once per frame, at this tick's position. The camera is stepped per
  frame with `stepCamera(…, {cameraTarget: bossCameraTarget})`, because `view()` runs on every dead frame
  (`Game.as:889`).
- **Refused by name** (`IGNEOUS_UNMODELLED`, fidelity IGFADE). Each refusal fires only when a tile is breaking or in
  range:
  - a span that moves the player inside it: the `fallrock` snap and its release step, moonrock and arena-rock
    releases, a door ceremony, the seal piece (CEREMONYSHOVE);
  - any dead render under a shake band;
  - a `load` span inside a visit.

**Witness (STAGED; the route has none)**: `igneous-l74-phase-a`, on p4g. L74 is booted at (64,48) → (72,56) with
`noDamage` and no Dark Shield. (5,3) is broken at t13. The Dark Shield is touched at t30, and its 150 dead frames turn
the breaking tile (`5,3 lava t31 ceremony`). After the dialogue, the walk back steps on it, and the player dies and
respawns at t126. ON: 151 ticks at 0 px, with the restart on the game's curve. The interim refuses at t31 by name.
`igneousLava` OFF walks on where the game dies (first off > t90).

⚠ **What it does not discriminate (measured):** the phase-A stance is 26 px from the nearest tile. The return trip, at
least 15 ticks plus the dialogue, is longer than the 27 renders a breaking tile has left anyway. So a model that skipped
the dead renders would ALSO see lava by the time the player returns; that is mutant M3, green on the game positions and
red only on the event row. ⇒ **On the game's content, the frozen spans that can be stepped change nothing a player can
observe.** The spans that do touch a live tile are exactly the ones still refused:
- **L74's button fall.** `button@288,128` stands 11.31 px from (18,7)'s centre, exactly the radius (`FP.distance <=`
  counts it). The 197-frame span would break and turn (18,7), the corridor north of the button.
- **L71's chest seal ceremony.** The stance under `chest@160,256` at x ≥ 174 is within range of (11,17).

## D3 — the two pins (STOP: kept OFF, reason measured, not silently)

With `igneousDeadFrames` ON, `chain-L76` (boot [152,92]) and the clock row (boot [128,92]) are no longer refused. They
**die in lava every 46 ticks**, exactly as `igneous-l76-fade-stand` / `-86` witness on the game. So:
- `chain-L76`'s golden LavaChain ops change;
- the clock row bills **3** chain hits where it asserts `> 3`.

The rows test the chain, so they keep `{ igneousLava: false }`. Their comments now say what ON does and why the pin
stays (`seedlingHazardSkin.test.js`, commit `5a7fb387`). Note: once `igneousDeadFrames` is ON, `igneousLava: false` is
the only setting under which these stands are not killed by the tile.

## Movers with the switch ON (measured locally)

| set | OFF | ON | moved |
|---|---|---|---|
| route survey `--through=end --route=full --only=185,186,188,190,191,192,193,195,196,197,198,216,217,219,228` (the 15 steps on L71/74/76/77/78/85/99 in today's 250-step route; L76 = **191** and 197) | `evidence/survey/steps-off.json` (191 SOLVED 496, the flip's value) | `steps-on.json` | **0** (verdict, ticks and refusal text byte-equal) |
| the 49 type-31 sweep legs in node (`drivers/inv-leg.mjs`, the baseline 39496135591 rows' `seamTime`, ANYTIME_PASSES) | 45 ok | 45 ok | **0** (incl. L76's 648–651) |
| bounded vitest (145 files) | 4,987 rows. Every BEFORE row is equal, except 262 rows of 4 non-seedling files that do not load in my scratch worktree (no submodules); re-run in the main tree at the head: 284 / 284 pass. Plus **+1** `contactFidelityHook` row (the new key's setting) and +14 `fidelityIgfade` | 4,987 rows | 3 red ON: two **env artifacts** (`contactFidelity` "shipped defaults", `dashShape` "the defaults add no field"; any off-default env switch reds them) and **`fidelityIgneous` "an arrival within range … refuses by name"**, the interim's own pin, which this switch retires (a flip re-pins it) |
| tapeRunner | 635 `1378a8d9` | 635 `1378a8d9` | 0 |
| slow L32 | 5 / 5 | 5 / 5 | 0 |
| identity block | `e484c3b2…` | `e484c3b2…` | 0 |

Why only those 15 steps and 49 legs can move: the stepper returns at once in a room with no type-31 tile, and a survey
step or sweep leg solves one room. Inside those rooms, ON differs from the interim only where the interim throws, plus a
`help` span whose tile is in range of the previous position only (the sword is the only Help, and no type-31 level has
one).

## The CI dispatches the planner should run (I cannot dispatch)

1. **Survey, ON arm.** `seedling-survey.yml`, `route=full`, `through=end`, full (no `only`, so no empty-shard hazard).
   Ref: a scratch branch off `claude/igneous-load-fade-q7wean` with one line,
   `igneousDeadFrames: true` in `contactFidelity.js` (the workflow has no switch input). Compare with an OFF run at the
   branch head **by (level, goal, boot)**. Expected: 0 movers.
2. **Sweep A/B on the L76 legs, ×2 each.** `seedling-divergence-sweep.yml`, ref `claude/igneous-load-fade-q7wean`,
   `capture_requests=true`, `keys=` the content of `evidence/legs/keys-l76.txt` (the four `level_76 …` keys, 648–651).
   ⚠ The input turns every unlisted key OFF:
   - A: `contact_fidelity=` line `A=` of `evidence/legs/cf-AB.txt` (the 40 default-ON keys);
   - B: line `B=` (the 40 plus `igneousDeadFrames`).

   Expected: no mover beyond the crossed↔done noise. For the wider net, the same pair on `evidence/legs/keys-type31.txt`
   (49 keys).

## What moves for the JS arc (wire; no pin of theirs moves OFF)

- New optional run surface:
  - `run.igneousEvents` rows may carry `dead: 'load' | 'help' | 'ceremony' | 'freeze'` (ON only);
  - `igneousStates` entries gain `spans` and `last` (ON only, and inside the digest's `visit`).
- The refusal code `IGNEOUS_UNMODELLED` keeps its name; the texts now name "fidelity IGFADE" for the residual cases.
- No `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging` contract change, and no walker edit.
  Renamed or reshaped `run.*` fields: none. `seedlingSkinRenderer.test` and `seedlingHazardSkin.test` are green OFF.
- At a flip: `fidelityIgneous`'s arrival-refusal row (it pins the interim) and the two hazard-skin pins (D3) need their
  decision.

## Handed to the hammer arc

Nothing in their region. The new visit fields are inside `igneousStates`, which DA already put IN `visit`.

## Deltas

| row | before | after |
|---|---|---|
| identity block | `e484c3b2…` | `e484c3b2…` OFF and ON |
| surface | GREEN 341 | GREEN 341, re-recorded (line shifts only) |
| constants | 6,856 | **6,870** (re-recorded, +14 literals of the new function) |
| entities / profile | 566 / 138 | unchanged (no edit in their inputs) |
| reference | 4 differ at the base | the same 4. `docsIndex.js` and the README index were regenerated for my doc edits; the base's 4 are reverted after regeneration, not touched |
| roster | 289 | 289 |
| tapeRunner | 635 `1378a8d9` | 635 `1378a8d9` (OFF and ON) |

## What the brief got wrong (measured)

1. *"the 'chain's clock' row (`[128, 92]`) … within 11.31 px of L76's tile (10,6)"*: that stand (spawn (136,100)) is
   **4.00 px from (8,6)** and 41 px from (10,6). Only `chain-L76` (spawn (160,100)) is by (10,6), at 8.94 px.
2. *"stepping a dead span = rendering `frames` times at the frozen position under the frozen camera"*: the camera is
   not frozen. `view()` runs on every dead frame, so the fade's cameras are the settle's 21 and a span's lerp toward the
   frozen player. The swap frame adds one render the span count does not have (21, not 20). A Help's frame renders
   before its tick's render, not after.
3. *"D2 … witness one if the route has one"*: neither the route nor the game's content has an observable frozen span
   over a live tile. The two real cases (L74's button fall, L71's seal) are spans that move the player.
4. (IGNEOUS's report) *"no teleporter arrival on any of the seven levels lands within range"* still holds. So the
   arrival case is reachable only by a boot, a death restart at a boot spot, or a test stand.

## Residue (queued, named)

- **L74's button fall and L71's seal ceremony** over a live tile, still refused. The fall needs its snap and
  release-step positions per frame (`dropRock`/`resolveButtonFalls`, `buttonFallReleaseStep`). The seal needs
  CEREMONYSHOVE's per-frame positions. Witness first: a stand on `button@288,128` should turn (18,7) inside the
  197-frame span.
- **The solver's walk check does not apply the fade.** `dangerMap.igneousWalkDanger` replays the live clocks, which are
  fresh until the visit's first render. A plan from an in-range arrival is priced without the fade's 21 renders. It is
  never reached on the route (no arrival in range); it would matter for a staged boot.
- Dead renders under a shake band stay refused (⚖ the cosmetic RNG is not modelled).
- The model spends phase A as one 150-frame span where the game's curve reads 149 + 1 (the +1 at the dialogue's end,
  t46/47). This is pre-existing and changes no position.

## Byte-inertia

OFF: `renderIgneousNow`'s OFF path is untouched, and the new function and fields exist only behind the key. The
identity block, the six `--check`s, tapeRunner (635, same md5), the 15 survey steps and the 49 legs all equal the base.
Identity block AFTER, OFF **and** ON (`SEEDLING_IGNEOUS_DEAD_FRAMES=1`): **`e484c3b2…`, equal to W0** byte for byte, the six `--check`s included (`evidence/after/`).

## Rows to BANK

- `fidelityIgfade.test.js` (14 rows) and `fixtures/igneous-witness/igneous-l76-fade-stand{,-86}`, plus the staged
  `igneous-l74-phase-a` (tapes + the game's streams with their `dead_frames` curves).
- The game constant: **21 renders per room load** (1 swap-frame render + `LOAD_FADE_FRAMES`), for a boot and for a
  death restart.
- Surface 341 (re-recorded), constants **6,870**.
- Movers for a flip licence: **none on the survey's 15 type-31 steps or the 49 type-31 legs (node)**. The pins a flip
  owes: `fidelityIgneous`'s arrival row and the two hazard-skin stands (D3). Confirm with the two CI dispatches above.

## Trap candidates

- A frame **dead to the bot's gate is not dead to `render()`**. Anything render-driven (`Tile.render`, the totem's head)
  counts it, and the swap frame's render is the NEW world's.
- **A death that respawns on the spot is invisible in the position stream.** Read `dead_frames` or a death ledger for a
  stand witness.
- An instrument citing an evidence-dir script by bare name reds `instruments.js` (the reference check). Cite the path.
