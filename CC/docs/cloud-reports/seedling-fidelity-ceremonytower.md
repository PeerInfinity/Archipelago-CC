# seedling-fidelity-ceremonytower — the one update a family takes on a freeze's edge frames (wave 54)

⚖ GO: Robert 2026-11-19 (planning-22's session), *"W54: ceremony tower + span release (Recommended)"*, plus the launch GO
for this brief. Scope: ONE new `contactFidelity` key, default OFF, covering the two gaps wave 53 handed back. No flip, no
default change, no change to any existing key's ON branch.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-22` |
| Base | `d16235993efd3b57699d19d1af9386026a735f62` (the W53 harvest, TRAIN 169; 144 keys, 126 ON, the last six `darkSuitBossRetaliation`, `owlContactInStep`, `turretSuitRetaliation`, `pickupTickFreeze`, `dialogueFrameFreeze`, `frozenTickUngated`, all OFF: measured) |
| Harness branch | `claude/ceremony-tower-frame-updates-7i9q1f` (local branch `seedling-fidelity-ceremonytower`) |
| Commits | D2 `257bf23a` (the code, the key, the pins, the rows: **the last CODE commit**) · evidence `24b0bcf8` · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; the acceptance md5 is the standing value at all four settings; 294/294 tapes ON = OFF; the survey's 4 rock-room steps ON = OFF. **ON moves L29**: its turrets fire 5 ticks earlier after the button's rock: 2 gate rows move ON; the train tier ON moves nothing (10 files, 41/41)) |

**The one thing to know first:** gap 2 is not vacuous. The shipped L29 room moves ON. Its two turrets are mid-shot when
the button drops the rock. In the game their anim runs out through the 172 frozen frames, and the release frame counts
one `shootTimer`, so the next spit leaves 5 ticks earlier (t57, not t62). Two gate rows move ON for this reason: wave
53's L29 bob row and the `stand:29` sound-cue golden. No survey step or tape presses that button, and L29's 7 legs are
in the keyed sweep. Gap 1 is vacuous (no tower room holds a special pickup). It also left a different defect on the
ceremony's closing tick, named below and not changed.

## D1 — the AS3 and the model

### D1.1 — a texted pickup's later frames, and the tower

- **`Pickup.update`** (`Pickups/Pickup.as:50-88`): `if (special && specialTimer < specialTimerMax) pick_up();` (`:57-60`)
  on every frame after T. **`pick_up()`** (`:90-124`): `Game.freezeObjects = true` (`:95`) FIRST, every frame. Then
  `specialTimer--` to 0 (`:96-98`; at 0 it adds the text NPC, `:99-104`). Then, once `specialTimer` is 0 and `!myText`,
  it sets `Game.freezeObjects = false` and calls `removeSelf()` (`:106-112`).
- **The text NPC** (`NPCs/NPC.as`). It is a runtime add, so it updates first. `talk()` (`:185-239`) raises the flag
  inside `if (talking)` (`:193-195`). On the last page `talking = false` lowers it (`:207-214` via the setter,
  `:250-263`) and `FP.world.remove(this)`. The removal is deferred to the frame's end, and only then does `removed()`
  null the pickup's `myText` (`:71-85`).
- **The add order** (`Game.as` loadlevel; `addUpdate` prepends): the pickups are at `:2330-2351`, AFTER the tower
  (`:2297`), the ice turret (`:2296`), the turret (`:2295`) and the drill (`:2290`). So the pickup updates before all
  four.
- **Frame by frame:**

| frame | NPC | `Pickup.update` | the 4 families (tower, ice turret, turret, drill) | model tick |
|---|---|---|---|---|
| a dialogue frame | raises | re-raises | **frozen, once** | a frozen tick (`runFrozenTick(…, 'a pickup ceremony')`) |
| the close frame C | lowers, removes itself (deferred) | re-raises (`myText` still set) | frozen | a DEAD frame, collapsed into the finishing tick (`stepCeremonyReleaseFrameNow`, chasers only) |
| the release frame R | gone | `!myText` → lowers, `removeSelf` | **UNFROZEN** | the finishing tick (it falls through, live) |

- **The tower verdict.** On a dialogue tick the model stepped the tower twice, frozen: the main slot (`frozen: ceremony
  !== null`), then `runFrozenTick`'s step. The game's one update comes after the pickup, so it is frozen. Either model
  step has the right state. **`runFrozenTick`'s is the right place**, as wave 52 found for dialogues: it runs after the
  ceremony's raiser in the model's order. The main slot runs above the detection and the dialogue step. So ON skips the
  main slot. Measured (`d1/tower-ceremony-frames.txt`, `tools/tower-ceremony.mjs`, wave 53's tool extended to the close):

| setting | T | dialogue ticks | finishing tick (C+R) | after |
|---|---|---|---|---|
| OFF | `[false,true]` | `[true,true]` ×N | `[true]` | `[false]` |
| this key ON | `[false,true]` | `[true]` ×N | `[true]` | `[false]` |
| all five keys ON | `[true]` | `[true]` ×N | `[true]` | `[false]` |

- **⚠ The finishing tick: one step, but the wrong state (measured; beyond this licence, NOT changed).** The model's one
  step stands for R, where the pickup has already lowered the flag, so the game's tower is UNFROZEN. The model steps it
  frozen (`ceremony` is still set at the slot). The same holds for the other three families in the main slot: the ice
  turret (`ceremony !== null || …`), the turret (`stepShootersNow`'s `frozen = ceremony !== null`) and the drill. All
  four take R frozen. C is a dead frame these lump-less families never step (wave 51's named gap). Hand-over.
- **The other three families on the dialogue ticks:** the turret, the ice turret and the drill are stepped ONCE, in the
  main slot, frozen (`ceremony !== null`); `runFrozenTick` steps none of them. Right count and right state.

### D1.2 — a falling rock's release frame

- **`FallRock.update`** (`Scenery/FallRock.as:51-101`):
  - The landing arm (`:64-85`) runs while `trigger && y < fallTo`.
  - Then the camera hold counts down (`:88-91`). When it ends (`:92-97`) the rock sets `Game.freezeObjects = false` and
    calls `Game.resetCamera()`. **That is the release frame.**
  - `fall()` (`:103-109`) raises the flag. Its callers are `set activate` (`:111-118`) on a button's press, a rope's
    publish (`RopeStart.set activate`) and the wand's `removed()`.
- **The order.** `fallrock` is added at `Game.as:2353`, so it updates before every family added above that line:
  - the pickups (`:2330-2351`) and the button (`:2341`);
  - the puncher (`:2301`), the crusher (`:2300`), the bomb pusher (`:2299`) and the beam tower (`:2297`);
  - the ice turret (`:2296`) and the turret (`:2295`);
  - the traps (`:2291-2294`) and the drill (`:2290`);
  - the chasers (`:2276-2288`) and the boss totem (`:2281`);
  - and the player.
- **Already lowered for them:** on the release frame every one of those families sees the flag down. That is ONE
  UNFROZEN update on a frame the tape never sees (the `Bot` reads the flag at the frame's top and calls it dead).
- **Still frozen:** the families added after the rock update before it: the pushables (`:2382-2384`), the pull
  (`:2352`), the NPCs, the locks and the runtime adds (spits, bombs).
- **The model's span:**
  - `dropRock` (a rope's pull: `publishRopeGroup` → `dropRock`, inside the pressing tick, below the chasers' live
    step). It steps the rock and, ON under `drillTimedPass`, the camera and the drills. On the release frame it steps
    the drills UNFROZEN (`fallRockFrozenFrame`). It banks **no** `pendingFreeSteps` (the player's release step is not
    modelled; its doc names it).
  - `dropRocksTogether` (a button's drop via `resolveButtonFalls`, after frame A's `runFrozenTick`, and the wand's,
    inside the wand ceremony's finishing tick). It steps the rocks, the drills' graphic and the boss totem
    (`freezeObjects: true` on the release frame too: "cannot matter", named). It banks one `pendingFreeSteps`.
  - Wave 53's `frozenTickUngated` steps the chasers frozen on every span frame but the release frame, and the pushables
    on every frame.
- **The census per rock source** (`tools/rockrooms.mjs` → `d1/rockrooms.json`: every rock room, its types split by add
  order):

| source | rooms | families after the rock in the room | base model on the release frame | observable ON (staged unless "shipped") |
|---|---|---|---|---|
| button (`dropRocksTogether`) | L29 | 3 turrets, `bosskey`, button | none | **shipped:** the turrets leave the span as `''` with `shootTimer` 39, not `finishshot`/40; the next spit at t57, not t62. Staged `bob@112,150`: one move, and `hitsTimer` 25, not 26 |
| button | L74 | bulb, 2 lavarunners, `darkshield`, button | none | shipped: **ON = OFF** (all off-screen or idle at the rock's camera) |
| rope (`dropRock`) | L28 | bobsoldier, 2 drills, button | the drills (`drillTimedPass`) | shipped tape: **ON = OFF** (the bobsoldier does not move there). Staged `jellyfish@144,176`: its one move, `(152,184)` → `(152.18,183.48)` |
| rope | L39 | `totempart`, buttons | none | vacuous (no stepped family) |
| wand (`dropRocksTogether`) | L43 | bosstotem | the totem with the flag up | the totem reads the flag down ON; no observable (its rest arm is behind `fullyActivated`, 30 ticks later) |
| `fallrocklarge` | L32, L82 | — | the BobBoss and lava-arena paths | not these paths; untouched |

- **The two lists in the brief:**
  - **Pushables** update BEFORE the rock, not after. They are not skipped on the release frame: wave 53's key already
    steps them on every span frame.
  - **Pickups** update after the rock and are not stepped (named: a pickup under the player at R is collected a frame
    late).

### D1.3 — the change chosen

- **Gap 1.** `ceremonyHoldsThroughNow(held)`: ON, a texted ceremony that will NOT finish this tick. It is read off a
  `structuredClone` of `ceremony.dialogue`, stepped with the tick's own talk-key release (`releasedThisTick(held,
  TALK_KEY)`). `prevHeld` is not written between the slot and the branch on any path that reaches the branch. The tower
  slot skips on it.
  - Every other return between the slot and the branch is a `runFrozenTick` (the tree, the Lights, the arenas, the Owl,
    the moonrock). The rest refuse a ceremony by name. So the skipped tower always gets its one frozen step.
  - `assertCeremonyHoldAheadHeld(finishing)` re-checks the prediction at the ceremony branch and refuses a disagreement
    by name. This is waves 52 and 53's shape.
- **Gap 2.** In the game's order on the release frame:
  - `stepRockSpanShootersNow(true)`: the spits frozen (they are runtime adds, ahead of the rock), then the turrets
    UNFROZEN. This is `stepShooterReleaseFrameNow`, the shape of a text-less pickup's F+150.
  - The drills: their whole update in `dropRocksTogether`. `dropRock` already does it.
  - The chasers UNFROZEN (`stepRockReleaseBodiesNow`: `stepChasersNow` with `ceremony` held to null, so the wand's
    path, inside its ceremony, reads the flag down too).
  - The boss totem with `freezeObjects: false`.
  - The player stays where it was (`pendingFreeSteps`, unchanged).
- **And the frames the turret's release reads.** A turret's anim runs through every frozen frame (`Turret.as:48-51`
  returns; the Spritemap does not). So ON also steps the turrets frozen on each span frame and on a button rock's frame
  A (`stepShootersThroughFreeze(1)`). Without them, the release frame would read an anim the game has already finished.
  The L29 row shows it: `finishshot` → `''`.
  - This is the one piece beyond "the release frame" alone. It is in the key's doc, and it is mutant 3's row.
- **A rock room with an ice turret or a beam tower** is REFUSED by name at the release frame ON. Their slots ask the
  pickup and dialogue predicates, which a collapsed frame cannot answer. No shipped rock room holds one.
- **What it does to:**
  - **`spitForecastNow` and the hammer forecasts:** no line changed, and no forecast steps a rock span. They read the
    live state, so after L29's drop ON they start from the turrets' new phase. Whether a solver preview across a button
    press models the drop is hammer's (hand-over).
  - **Wave 50's turret slot:** the release frame's turret step passes `turretHitPlayerNow` when `turretSuitRetaliation`
    and `STATIC_SWORD_ARM` are ON, as `stepShooterReleaseFrameNow` does. `turretSlotContact` is saved and restored
    around the call, so no live slot's skip reads a dead frame's contact.
  - **Waves 51, 52 and 53:** no predicate or key line moved.
    - `pickupFreezesFamilyNow` and `dialogueFreezeAheadNow` are asked by the main slots only, before mine.
    - Wave 53's frozen span step is unchanged (`!r.unfroze`); mine is its complement (`r.unfroze`).
    - Composition rows (all five keys ON) are below.
- **STOP rule:** triggered for one family pair only. The ice turret's and the beam tower's slot code reads per-tick
  predicates that a collapsed dead frame cannot answer, so those two are refused by name, not modelled (vacuous: no
  shipped rock room). Everything else reads state the model holds there. OFF: every new line sits behind
  `CONTACT_FIDELITY.freezeEdgeFrames`.

## D2 — the key

`CONTACT_FIDELITY.freezeEdgeFrames` is **OFF** and appended LAST: 145 keys, 126 ON. Its env is
`SEEDLING_FREEZE_EDGE_FRAMES=0|1`. Its `SOLVER_ENV_NAMES` entry sits between `SEEDLING_FORECAST_SPEED_BY_TERRAIN` and
`SEEDLING_FRONTIER_DOOR_ROUTE` (a node import of `solverEnvChannel.js`: 233 names, sorted, duplicate-free). Its doc
block, in brief:

> fidelity CEREMONYTOWER D2 (wave 54) — THE ONE UPDATE A FAMILY TAKES ON A FREEZE'S EDGE FRAMES … (1) THE BEAM TOWER ON
> A TEXTED CEREMONY'S DIALOGUE FRAMES … ON the main slot does not step it on a tick whose ceremony holds through …
> (2) A FALLING ROCK'S RELEASE FRAME … the turrets, the drills, the chasers and the boss totem take ONE UNFROZEN update
> there … The turrets' anim runs through the span's frozen frames (and a button-dropped rock's frame A), so those are
> stepped frozen ahead of it … A rock room holding an ice turret or a beam tower is REFUSED by name … OFF: byte-identical.

**Key-order pins re-pinned** (grep `'frozenTickUngated']`, not a list):
- the 19 tail lists, which now end `'frozenTickUngated', 'freezeEdgeFrames']`;
- `contactFidelity.test.js`: the defaults row and the env guard;
- `fidelityFrozenTick.test.js`: its `.at(-1)` → a tail of `['freezeEdgeFrames']`.

`fidelityFencepost`'s SOURCE-SHAPE pin is untouched: nothing was added near `spinnersSteppedThisTick`.

### Rows (`fidelityFreezeEdgeFrames.test.js`, fast tier, 11 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| tower through a texted ceremony (L29 + `beamtower@112,40` + a feather underfoot, talk tapped to the close) | dialogue ticks `[true,true]`; closing tick `[true]`; T `[false,true]` | dialogue ticks `[true]`; closing `[true]` (named); T as OFF |
| the same, composition | all five ON: T, dialogue and closing ticks `[true]` each; the other four ON, this key OFF: dialogue `[true,true]` | — |
| rope (L28 livefall tape + `jellyfish@144,176`) | the first post-fall tick `(152,184)` | `(152.18,183.48)`; OFF reaches it a tick later; the player stream equal |
| rope, composition | all five ON vs this key OFF under them: the same one-tick lead, no throw | — |
| button, L29 as shipped | `turret@80,176` `[40, finishshot]` at the fall tick; next spit t62 | `[39, '']`; next spit t57; the player stream equal |
| button, staged `bob@112,150` (suited) | `hitsTimer` 26, `(119.746,157.921)` | 25, `(119.865,157.701)`; OFF moves there a tick later. All five ON: the same move, `hitsTimer` 0 both (wave 53 drained it) |
| refusal (L29 + a beam tower) | no throw | refused by name at the release frame |
| no freeze (L88, bob + Puncher, no X) | — | **ON = OFF**, the whole result |
| L74 as shipped (the arrival press) | — | **ON = OFF**, the whole result |
| L28 tape as shipped | — | **ON = OFF**, the whole result |

**Mutants.** Each was applied to a copy and restored (`grep -c MUTANT` → 0 after each; `d2/mutant*.txt`). Each ran over
this file, `fidelityPickupFreeze.test.js` and `fidelityFrozenTick.test.js`: 32 rows.
1. **The tower skip never fires** (`ceremonyHoldsThroughNow` → false). Predicted: the two tower rows. Measured:
   **exactly those 2**.
2. **No release-frame bodies step.** Predicted: the jellyfish row and its composition, the bob row, and the refusal row;
   the turret row stays green. Measured: **exactly those 4**.
3. **No turret span or release step.** Predicted: the L29 turret row alone (the bob rows read bodies only). Measured:
   **exactly that 1**.
4. **The cross-check inverted** (`holds: c.done`). Predicted: both tower rows refuse by name. Measured: **exactly those
   2**.

⚠ **Not game-witnessed:** every ON row. The pieces are the AS3 lines above and the families' own transcriptions
(`stepShooterReleaseFrameNow` is wave 51's; the chasers' unfrozen step is the live one).

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only d16235993e HEAD | grep -aE 'fixtures/|golden|tapes/'` is EMPTY.
- **Acceptance.** `batch-seedling-acceptance.mjs | md5sum` gives the standing `391322d681b7aa0229d94b3f6906d024` at all
  four settings (`d3/acceptance-*.md5`): the base; the head OFF; the head with this key ON; and the head with this key,
  `frozenTickUngated`, `pickupTickFreeze`, `dialogueFrameFreeze` and `turretSuitRetaliation` all ON.
- **Committed tapes.** All **294** replay byte-identical ON vs OFF (`d3/tapes-onoff.txt`, wave 53's `tools/tape-onoff.mjs`
  with `KEY=freezeEdgeFrames`).
- **The census.** Method: the room census (`d1/rockrooms.json`) names every room where ON can step something: a rock room
  with a family after the rock (L28, L29, L74, and L43's totem), or a tower room with a special pickup (none). Then the
  legs (`seedling-divergence-legs.mjs`, 924) and the survey's 250 steps were filtered by level (`d3/leg-census.txt`).

| set | count |
|---|---|
| legs in a reached room (`d3/reached_legs.json`) | **73** (L28 8, L29 7, L43 52, L74 6); gap 1: **0** |
| survey steps in a reached room | **4**: step 36 (L29), steps 167 and 174 (L43), step 191 (L74); none in L28 |

- **Survey** (`--through=end --only=36,167,174,191`, OFF vs `SEEDLING_FREEZE_EDGE_FRAMES=1`; `d3/survey-{off,on}.*`):
  - Every step line is equal, and the rows JSON is equal once the `ms` fields are stripped.
  - Steps 36 and 191 are SOLVED with **0 hits** both ways.
  - Steps 167 and 174 are REFUSED for the same pre-existing reason both ways (the wand stance's corridor; the sleeping
    totem).
  - Neither SOLVED walk drops its room's rock: its `earnedClears` holds no `{29,0}` and no `{74,2}`.
  - **ON answers: none moves.**
- **Vitest ON** (the gate set, 53 files, `--maxWorkers=3`, `SEEDLING_FREEZE_EDGE_FRAMES=1`; `d3/vitest-on.txt`): 51/53
  files; 1335 passed, 2 failed, 2 skipped (the env-guarded "ships OFF" rows). **ON movers:**
  - `fidelityFrozenTick.test.js:174` — the L29 button-rock bob row: OFF `hitsTimer` 26 at the fall becomes 25. Both
    sides run this key, so the release frame drains one more.
  - `seedlingSoundCues.test.js:215` — `stand:29:112,144:60:up`: a new `"Turret Shoot"` cue at t56, inside the 60-tick
    window. This is L29's turret firing 5 ticks earlier.
- **Train ON** (`vitest.train.config.js`, the 10 `.train.` files naming L28/L29/L43/L74: `d3/train-files.txt`):
  **10/10 files, 41/41 tests passed, 3535 s: 0 ON movers**. The first run was cut off by a container restart, and this is the re-run (`d3/train-on.txt`).

### The named sweep (for the planner)

- **`freezeEdgeFrames`:** the **73** legs in `d3/reached_legs.json`. Shards = min(10, 73) = **10**, ×1 per arm: OFF, and
  `SEEDLING_FREEZE_EDGE_FRAMES=1`.
  - Expect movers only where a walk presses L29's button (the turrets' phase) or drops L28's rock with a chaser on
    screen.
  - L43's 52 legs can move only through the totem's flag, which is not observable there.
  - The flip gate: a leg hitless OFF must stay hitless ON. L29's turrets now fire earlier after the press; that is the
    one place it can fail.
- **Gap 1:** **0 legs** (no tower room holds a special pickup).

## Gates

- **Bounded vitest BEFORE** (a clean worktree at the base, submodules symlinked; 52 gate files, the new test absent):
  **52/52 files, 1327 passed** (`d3/vitest-before.txt`, `d2/gate-files-before.txt`).
  - ⚠ My first BEFORE run overlapped my first edits and was discarded.
- **AFTER** (the head, OFF; 53 files): **53/53, 1339 passed** (`d3/vitest-after.txt`, `d2/gate-files-after.txt`).
  - The set: `contactFidelity*`, `playerDamage*`, `levelRun*`, `fidelityPickupFreeze*`, `fidelityDialogueFreeze*`,
    `fidelityFrozenTick*`, `fidelityCeremony*`, `fidelityRock*`, `fidelityTurret*`, and `oneSpelling`.
  - Plus every test file `grep -a -l` finds for `runFrozenTick`, `dropRock`, `dropRocksTogether`, `resolveButtonFalls`,
    `pendingFreeSteps`, `beamTower`, `BeamTower`, `frozenTickUngated`, `pickupTickFreeze`, `freezeEdgeFrames` and the
    pins.
  - Plus `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`
    and `seedlingSolverSurface`.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, a browser arm in CI). The first run's one red was the battery's `TREE-MOVED` guard (evidence files were written while it ran); this re-run, with the tree held still, is clean (`d3/producer-checks.txt`).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match.
- **Constants census:** `--check` PASSes after `--write` (8 new + 1 vanished cosmetic/structural, 953 line moves).
  `--profile-rows` left `seedling-constants-fields.csv` byte-identical, and a second `--write` then `--check` showed 0
  drift.
- **Solver surface:** `--check` GREEN (374 rows) after `--write` (line numbers only).
- **CI** `JavaScript Unit Tests` at the code head `257bf23a`: run 44593504993 **success**; suite 29039 passed, 0 skipped, 0 failed (3 shards); slow battery 438/438. Later commits are evidence and docs only.
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/ceremony-tower-frame-updates-7i9q1f -f train_only=true`

## What the brief got wrong (measured)

1. **"The model steps only the player there (`pendingFreeSteps`)."** That is only for a button's or the wand's rock
   (`dropRocksTogether`). A rope's `dropRock` banks no `pendingFreeSteps`: the player's release step is not modelled
   there at all (its own doc names it). And it already stepped the drills UNFROZEN on the release frame (`drillTimedPass`).
2. **"pushables … updates after the rock."** The pushables are added after the rock (`:2382-2384` vs `:2353`), so they
   update BEFORE it and read the flag up. They have no freeze gate anyway, and wave 53's key already steps them on every
   span frame, the release frame included.
3. **"Model the whole frame, not only the chasers."** The release frame alone was not enough for the turrets: their anim
   runs through the span's frozen frames. Those frames (and a button rock's frame A) are stepped too (D1.3).
4. **"vacuous today" (gap 1) is right; gap 2 is not.** Shipped L29 moves ON.
5. **"Include the closing frame" — and the closing tick's one step is FROZEN where the game's is unfrozen.** That is a
   distinct defect, shared by the ice turret, the turret and the drill (D1.1). Named, not changed.
6. Wave 53's census said L74 holds three lavarunners. The atlas holds two (`@24,56`, `@208,96`).

## Hand-overs

- **To the planner:**
  - the keyed sweep (D3);
  - the `train_only` dispatch at my head;
  - at harvest, `SOLVER_ENV_NAMES`: my entry sits after `SEEDLING_FORECAST_SPEED_BY_TERRAIN`;
  - ⚠ a stray remote branch, `seedling-fidelity-ceremonytower`, at `257bf23a`. I pushed it by mistake before the harness
    branch, and the proxy refused its delete. It is safe to delete; nothing consumes it.
- **To fidelity (later), beyond this licence:**
  - **A texted ceremony's finishing tick.** The tower, the ice turret, the turret and the drill are stepped FROZEN in
    the main slot (`ceremony` still set). In the game their update on the release frame R is unfrozen: `pick_up`'s
    `!myText` arm lowers the flag first (`Pickup.as:106-112`). And the close frame C, a dead frame, is not stepped for
    them. Measured on the tower: `t23-C:[true]` in `d1/tower-ceremony-frames.txt`.
  - **The release frame's pickups** (`Pickup.update` after the rock): not stepped. A pickup under the player at R is
    collected a frame late.
  - **A rock room with an ice turret or a beam tower:** refused ON by name (no shipped one).
  - **The crusher, the bomb pusher and the arrow traps** in a rock room: no freeze gate on the crusher's move, and none
    of them is stepped through a span. No shipped rock room holds one.
  - **The rope's player release step** (`dropRock`): not modelled (pre-existing).
- **To hammer:** after L29's button rock, the live run ON starts the turrets 5 ticks further along (anim done,
  `shootTimer` 39). Any forecast or preview that crosses the press without the span keeps OFF's phase.

## Residue

- Every ON row is staged or shipped-model-derived, not game-witnessed.
- The reached legs were not replayed in node; the leg runner is the browser sweep.
- Evidence: `seedling-fidelity-ceremonytower-evidence/`:
  - `tools/`: `rockrooms.mjs` (the rock-room census), `rockrelease.mjs` (the release probe: tape or key script, injected
    rows, OFF/ON), `tower-ceremony.mjs` (wave 53's, extended to the close), `tape-onoff.mjs` (wave 53's);
  - `d1/`: `rockrooms.json`, `tower-ceremony-frames.txt`;
  - `d2/`: the gate file lists and the four mutants;
  - `d3/`: the acceptance md5s, the leg census and the 73 legs, the survey steps and the survey OFF/ON, the tapes
    OFF/ON, vitest BEFORE/AFTER/ON, the train files and train ON, the producer line.
