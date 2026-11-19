# seedling-fidelity-dialoguefreeze — a dialogue's later frames freeze the families that update after the NPC (wave 52)

⚖ GO: Robert 2026-11-18 (planning-22's session), *"Dialogue-frame freeze (Recommended)"*, plus the launch GO for this
brief. Scope: ONE new `contactFidelity` key, default OFF. No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-22` |
| Base | `435ce06e4d27a9214f0b20347110247d640747a3` (wave 51's head; 142 keys, 126 ON, the last four `darkSuitBossRetaliation`, `owlContactInStep`, `turretSuitRetaliation`, `pickupTickFreeze`, all OFF: measured) |
| Harness branch | `claude/dialogue-frame-freeze-order-9l1fjm` (local branch `seedling-fidelity-dialoguefreeze`) |
| Commits | D1 evidence `9d0e0bb6` · D2 `678da5f1` (the last CODE commit, on the workflow's paths) + evidence `316205e1` · D3 evidence `3ca576e9` · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; ON moves no measured route answer: 0 ON movers in vitest, train, the survey and 294 tapes; the keyed sweep is 9 legs, the planner's) |

**The one thing to know first:** the gap is real but has almost nothing to act on in the shipped game. Only one shipped
room has a texted dialogue next to one of the four families: L88 (introchar + drill). From the talk circle, that drill
never has the player within its 48 px sight range. L103's watcher has NO text (`text=""`, `text1=""`), so it never talks;
wave 51's "L103's watcher dialogue reaches it" was wrong. So every ON row is staged. The fix is exact, by construction or
by refusal, and pins the closing frame as UNFROZEN: `talk()` lowers the flag through the `talking` setter on the frame
the pages run out, before the families update. That is the same shape as a text-less pickup's release frame (wave 51).

## D1 — the AS3 order and the model's split

### The game

- **Update order.** `World.addUpdate` PREPENDS (`net/flashpunk/World.as:937-947`). `Game.loadlevel` adds `drill :2290`,
  `turret :2295`, `iceturret :2296` and `beamtower :2297` before every texted NPC: `introchar :2389`, `rekcahdam :2390`,
  `forestchar :2391`, `karlore :2392`, `adnanchar :2393`, `watcher :2394`, `oracle :2395`, `witch :2396`, `hermit :2397`,
  `yeti :2398`, `sensei :2399`, `sign :2400`, `totem :2401`, `statue1/2 :2405-2406`. So the NPC updates first.
  (`dialogue.PLACED_NPC_TALK`'s `spawn` lines, `Game.as:2265-2282`, are 124 lines stale, but their relative order is
  unchanged; that order is all the talker sort reads.)
- **`NPC.update`** is `super.update(); talk();` (`NPCs/NPC.as:128-132`). **`talk()`** (`:185-239`):
  - `:193-195`: `if (talking) { Game.freezeObjects = true; …`. This is the ONLY raise.
  - `:196-217`: the advance on `Input.released(p.keys[6])`. Past the last page, `:207-214` runs `talking = false`
    (`temporary` NPCs are removed) and **`return`s**.
  - `:219-229`: in range → `startTalking()` when `(hitKey || !keyNeeded) && !Game.talking && !Game.inventory.open`.
  - `:230-237`: out of range → `talked = false; if (talking) talking = false`.
- **`startTalking()`** (`:241-248`): `talking = true; talked = true` when `!talked`.
- **`set talking`** (`:250-273`): FALSE → `Game.freezeObjects = false` (`:255`), `Game.talking = false`, …,
  `doneTalking()`. TRUE → `Game.talking = true` and the text, pic, speed and align. **It does not raise the freeze.**
- **Who lowers it, every frame.** The `talking` setter's false branch, as above. And `Game.update`'s tail on every
  dialogue frame: `canInventory()` is false while `Game.talking` (`Game.as:1549-1553`), so `inventory.open = false`
  (`:1044-1050`), which is `Game.freezeObjects = _open = false` (`Inventory.as:151-154`). So the flag is always down at
  the next frame's `Bot.update` gate (`Bot.as:3201`). **Every dialogue frame is a LIVE tape tick.** The model already
  says this: `runFrozenTick` is "a frozen TICK", and `r8-d2-19`'s 28-tick sign dialogue is the game witness
  (`levelRun.js` talker docblock).
- **The three frames:**
  - **Start** (the release `startTalking()` reads): `if (talking)` was false at `:193`, so the flag is not raised. The
    families update UNFROZEN.
  - **Middle** (`talking` at `:193`, no close): raised before the NPC returns. Every family added before the NPC
    updates FROZEN.
  - **Closing**: the last page's release (or leaving the circle). `:195` raises the flag and `:209` / `:235` lowers it
    through the setter, still inside the NPC's own update. The families update UNFROZEN. Like a text-less pickup's
    F+150 (wave 51).
- **Subclasses.** None overrides `talk`, `startTalking` or the setter, except `BobBossNPC.talk` (`BobBossNPC.as:24-60`).
  That is the BobBoss arena's own freeze, modelled in its own block, and it is not a talker or a watcher here.
  - `Watcher.update` (`Watcher.as:62-66`) gates `super.update()` on `checkPersistence(tag)`. Its `keyNeeded` is
    `!checkPersistence(tag)` (`:46`): it auto-talks.
  - `Witch.update` (`Witch.as:30-43`) swaps `myText`, then `super.update()`.
  - `Karlore`, `Oracle`, `Watcher`, `Witch` and `Yeti` override only `doneTalking` / `talking_extras`.
  - `IntroCharacter`, `Sign`, `Statue`, `Totem`, `Hermit`, `Sensei`, `ForestCharacter`, `AdnanCharacter` and
    `Rekcahdam` override none of these.
  - `Help` is a separate freeze (the tutorial popups).

### The family table (what updates after a texted NPC, on a dialogue's frames)

"OFF" = what the model steps at the base. Every row's slot is above the talker/watcher arms.

| family | gate | game: start / middle / closing | model OFF | model ON | differs OFF? |
|---|---|---|---|---|---|
| **Turret** | `Turret.as:48` (aim, `shootTimer`, fire); `hitPlayer` refused by `Player.hit`'s `!freezeObjects` (`Player.as:1382`) | unfrozen / **frozen** / unfrozen | `stepShootersNow`, `frozen: ceremony !== null` = unfrozen on every frame | frozen on the middle frames | **yes** |
| **IceTurret** | `IceTurret.as:58` | unfrozen / **frozen** / unfrozen | `stepIceTurretsNow`, unfrozen | frozen on the middle frames | **yes** |
| **BeamTower** | `BeamTower.as:54,126` | unfrozen / **frozen** / unfrozen | unfrozen main-slot step, THEN `runFrozenTick`'s frozen step: **two** per middle frame | ONE frozen step, `runFrozenTick`'s | **yes** |
| **Drill** | `Drill.as:54` | unfrozen / **frozen** / unfrozen | `stepDrillsNow({mainTick})`, unfrozen | frozen on the middle frames | **yes** |
| ShieldBoss (L19, beside a sign) | moves are no-ops; `hitPlayer` (swing counter) ungated; its stab is refused by `Player.hit` under the freeze | counter runs; stab refused | counter runs; a stab would be billed | unchanged | **unreachable**: the stab band (`ShieldBoss.as:104`, y [88,104) for `shieldboss@80,32`) is ≥ 6 px from every player box in the sign's circle (measured: the nearest box top is y 110) |
| chasers (Bob, Flyer, Puncher, …) | `Mobile.mobileUpdate` | frozen move; `hitUpdate` runs | NOT stepped on a frozen tick (`runFrozenTick` returns above `stepChasersNow`) | unchanged | move: no. `hitUpdate` not stepped: a pre-existing gap of every frozen tick (hand-over). L12's puncher is the one shipped case |
| spits, bombs, blasts, runtime adds | `Mobile` move gated | update BEFORE the NPC: unfrozen on every frame | unfrozen (top of the tick) | unchanged | no |
| wallflyers `:2415`, spinners `:2416`, FrozenBoss `:2410` | added AFTER the NPCs | unfrozen | unfrozen | unchanged | no |
| static bodies, crushers, bomb pushers, pulsers, pulls, arrow traps, chests, LightPoles, spinning axes, activators | no `freezeObjects` read in the class | run | run | unchanged | no |
| pushable blocks | `Mobile` move gated | frozen | stepped unfrozen | unchanged | **vacuous**: no texted-dialogue room holds one (`d1/rooms.json`), and the player is frozen, so nothing pushes |

### Where it reaches (`d1/world-rooms.txt`, `d1/rooms.json`)

The model's built worlds hold texted talkers or watchers in 17 rooms: L0, 1, 12, 19, 34, 35, 36, 37, 48, 58, 64, 87, 88,
89, 94, 111 and 114 (the only texted watcher is L114's). **Only L88 also holds one of the four.** The `.oel` has
watchers in L12, 32, 37, 43, 57, 69, 82, 89, 94 and 103 too, all with `text=""` (so `myText[0].length > 0` at `:188` is
false and `talk()` never runs). L103's beam towers never see a dialogue.

### The model's dialogue tick

The main tick's order, with line numbers at the head:
- `stepSpitsNow` → … → `stepWallFlyersNow`;
- **`stepDrillsNow({mainTick})`**;
- shieldboss, pushables, LightPoles;
- the button-fall frozen return;
- chests, pulsers, pulls, arrow traps, static bodies, dark traps, crushers, bomb pushers;
- **the beam towers** → **`stepIceTurretsNow`** → **`stepShootersNow`**;
- `frozenTimer` → credits/tree/walk → Lights;
- **talkers** (`stepTalkersNow`, `return runFrozenTick(…, 'a placed NPC's dialogue')`);
- **watchers** (likewise);
- final door, …;
- the pickup detections and the live step.

`runFrozenTick` steps the beam towers (frozen), the activators, the camera and the render. It does not step the drill,
the ice turret or the turret.

- **Ticks per dialogue = the game's frames.** Each frame is a live tick. The model's first dialogue tick is the start
  frame: `startTalking()` in the arm, NOT frozen, live step. The middle ticks run `runFrozenTick`. The closing tick
  sets `frozen = false` in the arm and falls through to the live step. The game is the same: the setter lowers the
  flag before the Player.
- **No off-by-one at either end.** The row: L88 frozen ticks are 3..33 for the X release at 2. The dialogue closes on
  tick 34 (`talkerTalks` t 35) and the drill, turret and ice turret move on 34.

### The beam-tower double step (D1.4)

On a dialogue's middle frame the game runs ONE `BeamTower.update` (frozen: the drift and beam return, the graphic
steps), after the NPC. The model ran two: the main slot's (unfrozen, BEFORE the NPC's arm, so in the wrong place) and
`runFrozenTick`'s (frozen, after the arm, the right place). Its `lastClock` check then saw the same `Game.time` twice
and marked the anim unknown. **Verdict: `runFrozenTick`'s step is the one that should exist.** It lies on the dialogue
path, so it is in scope: ON, the main slot does not step the towers on a predicted middle frame.

The other paths that reach `runFrozenTick` with a tower in the room are NOT changed. They are handed over:
- A texted pickup's T. With `pickupTickFreeze` ON the main slot steps frozen and `runFrozenTick` steps again: still two
  (wave 51's row `[true, true]`).
- The fall-rock frozen tick returns above the tower slot, so it is stepped once: correct.
- The wand's approach fade steps no family.

### The reorder chosen

The same shape as wave 51: a pure predicate, asked from each family's main-tick slot, cross-checked, refused by name on
a disagreement.
- **`dialogueFreezeAheadNow(slot)`** → `predictDialogueFrameFrozen()`. It walks the talker rows, then the watcher rows,
  with the arms' own gates (`cleared`, `text`, `persistTag`, `talking`). For the NPC that is talking, it steps a
  **clone** of its dialogue with `stepNpcDialogue` (the arms' own step). The release comes from the tick's keys; the
  radius comes from `inTalkRange` / `talkRangeOf`. If the clone stays open, this tick is a middle frame. The predicate
  writes nothing to the run.
- Every slot that asks is recorded per tick. A later slot that reads a different answer is refused by name: the player
  crossed a circle between slots, which only `pendingSnapY` could do.
- **`assertDialogueFreezeAheadHeld(frozen)`** runs at the arms: `true` in the talker arm's frozen return, and
  `wr.frozen` after the watcher arm. It refuses a disagreement by name. `runFrozenTick` refuses a predicted middle
  frame that another freeze pre-empted (Lights, tree, fall rock).
- It shares no state with wave 51's `pickupFreezeAhead`: one model of one flag, two sources. Each slot ORs them.

What it does to:
- **`spitForecastNow`**: unchanged. It does not predict a dialogue freeze. Hand-over to hammer.
- **Spits, bombs, runtime adds**: untouched. They update before the NPC in the game, so they are unfrozen on every
  dialogue frame there too.
- **Wave 50's slot contact**: on a middle frame the turret slot passes no hook, so nothing is billed (the game's
  `Player.hit` refuses it) and wave 50's "the same tick then froze (a placed NPC's dialogue)" refusal is never
  reached. See D2.
- **Wave 51's key**: independent. A dialogue and a ceremony up together is still refused by the arms' existing
  `ceremony !== null` throw.

**STOP rule: not triggered.** The predicate reads only state the model holds at the slot: the talker and watcher rows,
their dialogue state, the tick's keys and the player's position. OFF, no slot asks it (`dialogueFreezeAheadNow`
returns `false` before reading anything, and the advance's key stash is behind the flag).

## D2 — the key

`CONTACT_FIDELITY.dialogueFrameFreeze` is **OFF** and appended LAST (143 keys, 126 ON). Its env is
`SEEDLING_DIALOGUE_FRAME_FREEZE=0|1`. It is entered in `SOLVER_ENV_NAMES` after `SEEDLING_DETOUR_VIA_BOUND`; a node
import of `solverEnvChannel.js` measured 221 names, sorted and duplicate-free. The doc block (`contactFidelity.js`), in
brief:

> fidelity DIALOGUEFREEZE D2 (wave 52) — A DIALOGUE'S LATER FRAMES FREEZE THE FAMILIES THAT UPDATE AFTER THE NPC. … `talk()`
> raises `Game.freezeObjects` only inside `if (talking)` (`:193-195`): NOT on the frame `startTalking()` runs …, and on
> the LAST frame the same block lowers it again before the families update … every dialogue frame is a LIVE tape tick
> … ON: each slot asks a pure prediction of the talker and watcher arms … the drill, the ice turret and the turret …
> step FROZEN, and the beam tower's main slot does not step at all: `runFrozenTick`'s step is its one frozen update …
> OFF: byte-identical.

**The change** (`levelRun.js`, plus the key):
- Two new run-scoped variables: `dialogueFreezeAhead` (the per-tick record) and `dialogueHeldNow` (the tick's keys,
  stashed at the top of `advance` only when the key is ON).
- New helpers: `dialogueFreezeAheadNow`, `predictDialogueFrameFrozen` and `assertDialogueFreezeAheadHeld`.
- `stepDrillsNow`: `frozen: ceremony !== null || frozenAhead || dialogueAhead` (main tick only, as wave 51's).
- `stepIceTurretsNow`: the same `|| dialogueAhead`.
- The tower slot: skipped when ON and predicted.
- The turret slot: `stepShootersNow(undefined, { frozen: true })` when either prediction says so.
- The arms: the cross-check.
- `runFrozenTick`: the pre-emption refusal.

### How it composes

| | `turretSuitRetaliation` | `dialogueFrameFreeze` | a turret contact on a middle frame |
|---|---|---|---|
| dialogue | ON | OFF | billed in the slot, then **refused by name** in `runFrozenTick` (wave 50; row: tick 4, "a placed NPC's dialogue") |
| dialogue | ON | ON | **nothing billed, nothing refused**; the contacts are the static scan's own (t1, then the closing frame t35), the same as with wave 50's key OFF |
| dialogue | OFF | either | the static scan runs after the player's step, which a frozen tick never reaches: no change |

- **`pickupTickFreeze`**: a dialogue row with both keys ON = this key ON alone (whole result). A pickup row (L29
  text-less key) with both ON = `pickupTickFreeze` ON alone (whole result). A pickup's text NPC is the ceremony's,
  `ceremony !== null`, and this predicate reads only the placed talkers and watchers.

### Key-order pins re-pinned (19 files)

- 17 lists that ended `'pickupTickFreeze']` gain `'dialogueFrameFreeze'`: `Ceremony126`, `CorridorBody`,
  `DarkSuitBosses`, `DarkSuitStatic`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `FrozenPress` (`W39`),
  `L39Hit`, `L39Phantom`, `OwlSuit`, `RockButton`, `RockFire`, `RockGone`, `TurretSuit`, `WallFlyerCorpse`.
- `fidelityPickupFreeze`'s `.at(-1)` → a tail of `['dialogueFrameFreeze']` (and its label).
- `contactFidelity.test.js`: the defaults row and the env-guard line.
- `contactFidelityHook.test.js` gains its per-key row by itself.
- Also: `fidelityFencepost`'s SOURCE-SHAPE pin forbids anything between `spinnersSteppedThisTick = null` and the arrow.
  The key stash sits inside the arrow, below the forecast memo.

### Rows (`fidelityDialogueFreeze.test.js`, fast tier, 12 rows)

Every family row is STAGED in L88: boot (56,112), X released at tick 2 and then every 8 ticks, the drill removed. The
frozen ticks are 3..33, and tick 34 closes the dialogue (t 35).

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| turret `@0,104` | `shootTimer` 39 on frame 14; spits `[7, 61]` | 40 through frame 33, 39 on the closing frame 34; spits `[7, 81]`; start frames 0..2 ON = OFF; the frozen set equal |
| ice turret `@0,104` | volleys `[4, 49]` | `[4, 63]` |
| drill on the player `@56,112` | hits t1, **t21 (mid-dialogue)**, 41, 42 | t1, **t35 (the closing frame)**, 55, 56 |
| drill in sight `@88,88` | hops to (80,112) on frame 15 | sits at (96,112) through frame 33, hops ≥ 34 |
| beam tower `@0,104` | `[false, true]` on frames 3, 14, 33 | `[true]`; frames 2 and 34 `[false]` both ways |
| watcher (L114, `turret@72,128`) | the 237-tick dialogue; spits `[7, 61, 115, 169, 223, 244, 298, 352]` | `[7, 283, 337, 391]`; the frozen set equal |
| composition, `turretSuitRetaliation` (`turret@56,120` on the player) | wave 50's refusal, tick 4, by name | no throw; hits t1, 35, 55, 56 (= the no-suit run) |
| composition, `pickupTickFreeze`, a dialogue | — | both ON = this key ON |
| composition, `pickupTickFreeze`, a pickup (L29) | — | both ON = `pickupTickFreeze` ON |
| no dialogue (L88, staged turret + tower, no X) | — | **ON = OFF**, the whole result |
| L88 as shipped | the dialogue runs (t 35); the drill sits at (136,168) every frame | **ON = OFF**, the whole result |

**Mutants** (copy + restore; `grep -c MUTANT` → 0 after each; `d2/mutant{1,2}.txt`):
1. **The closing frame predicted frozen too** (`staysOpen` → `true`). Predicted: every row with a dialogue and a family
   goes red, because the cross-check refuses at the closing tick (turret, ice, both drills, tower, watcher, suit
   composition, L88 shipped = 8). The four without a dialogue, or equal under both keys, stay green. Measured:
   **exactly 8 red / 4 green**, the refusal text naming tick 34 (`levelRun: turret stepped tick 34 in l…`).
2. **The tower's main slot steps frozen instead of skipping** (the double step stays). Predicted: the beam-tower row
   alone. Measured: **exactly that** (`expected [ true, true ] to deeply equal [ true ]`), 11 green.

⚠ **Not game-witnessed:** every ON row. The pieces are:
- `NPC.talk` and the setter (source);
- `r8-d2-19`'s measured 28-tick sign dialogue (open 15 / close 43), which pins the model's arm frame for frame;
- the families' transcriptions.

No recording has one of the four in range of a dialogue.

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only 435ce06e4d HEAD | grep -aE 'fixtures/|golden|tapes/'` is EMPTY (exit 1).
  The four acceptance md5s are all the standing `391322d681b7aa0229d94b3f6906d024`: base, head OFF, head ON, and head ON
  with `pickupTickFreeze` + `turretSuitRetaliation` ON (`d3/acceptance-*.md5`).
- **Committed tapes**: all **294** replay byte-identical ON vs OFF (`d3/tapes-onoff.txt`, `tools/tape-onoff.mjs`,
  wave 51's tool re-keyed).
- **The census** (`d3/leg-census.txt`, `d3/l88_legs.json`; legs from `seedling-divergence-legs.mjs`, 924):

| set | count |
|---|---|
| legs in a room with a texted talker or watcher | 223 (L0 45, L1 1, L12 90, L19 6, L34 2, L35 1, L36 4, L37 7, L48 5, L58 4, L64 2, L87 26, L88 9, L89 7, L94 4, L111 4, L114 6) |
| … that also holds one of the four (a differing family) | **9**, all L88: ids **685-693** (the three exits from each of the three arrivals) |
| survey steps in such a room | **2**: 84 (L88 → L87) and 116 (L88 → L12) |

- **Survey** (`--through=end --only=84,116`, OFF vs `SEEDLING_DIALOGUE_FRAME_FREEZE=1`; `d3/survey-{off,on}.*`):
  - Step 84 SOLVED 246 ticks, 0 hits; step 116 SOLVED 192 ticks, 0 hits. OFF = ON.
  - The rows JSON differs only in the two wall-clock `ms` fields.
  - The row does not record whether a dialogue opened. In shipped L88 it would not move anything either way: the
    shipped-room row pins a full dialogue there as ON = OFF.
- **Vitest ON** (the gate set, `--maxWorkers=3`, `SEEDLING_DIALOGUE_FRAME_FREEZE=1`): 129/129 files, 4185 passed, 2 skipped (the env-guarded "ships OFF" rows). **0 ON movers** (`d3/vitest-on.txt`).
- **Train ON**: the one `.train.` file of these rooms is `hammerWallFlyerDrillKill.train.test.js` (survey step 84, L88's
  drill), `vitest.train.config.js`, ON: 1/1 file, 5/5 tests, 73 s. **0 ON movers** (`d3/train-on.txt`). No `.slow.` file names L88, a talker or a watcher.
- **Why ON moves nothing measured:** the only shipped dialogue+family room is L88, and its drill cannot see the talk
  circle.

### The named sweep (for the planner)

- Keys: the **9** legs in `d3/l88_legs.json` (ids 685-693).
- Shards = min(10, 9) = **9**, ×1 per arm, OFF and `SEEDLING_DIALOGUE_FRAME_FREEZE=1`.
- Expectation: no mover. A possible mover is a named refusal (the prediction cross-check), never a silent change.
  Measure for the flip test anyway: a leg that is hitless OFF must stay hitless ON.

## Gates

- **Bounded vitest BEFORE** (base worktree, submodules symlinked; 128 files, the new test absent): 127/128, 4172 passed,
  2 skipped. The 1 red file (`seedlingWasmPlayback`) is wave 51's symlink artifact, not the base: it is green in the
  real tree at the head (below).
- **AFTER** (head, OFF, 129 files): 129/129, **4187 passed**. (The first AFTER run caught `fidelityFencepost`'s
  SOURCE-SHAPE pin; fixed in `678da5f1` before commit.) `lintGateLabels`, `oneSpelling`, `seedlingConstantsCensus`,
  `seedlingSolverSurface`, `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace` are in the set.
- `ci-producer-checks.mjs --jobs=3`: 99 run, 0 red, 1 skipped (`plan-seedling-r7-ends-meet`, a browser arm in CI).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match. Constants census `--check` PASS (after `--write`; `--profile-rows` stable); solver surface `--check` GREEN
  (374 rows, after `--write`: line numbers only).
- **CI** `JavaScript Unit Tests` at `678da5f1` (run 44233626797): **success** — suite 28393 passed, 0 skipped, 0 failed (3 shards); slow battery 437/437. The later commits are evidence/docs only (off the workflow's paths), so this is the suite number at the code head.
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/dialogue-frame-freeze-order-9l1fjm -f train_only=true`

## What the brief got wrong (measured)

1. **"L103 (watcher + beam towers); L103–L108 hold beam towers"** as a dialogue room. L103's watcher has `text=""`
   (and `text1=""`), so `talk()` never runs (`NPC.as:188`). No texted dialogue shares a room with a beam tower. The
   tower rows are staged.
2. **"Rooms named by wave 51: L88 and L103 … there may be others (signs?)."** Signs freeze the same way (no
   override), but no sign room holds one of the four. L19's sign sits beside the ShieldBoss, whose stab is out of
   reach of the circle (≥ 6 px). L88 is the only room.
3. **The last dialogue frame is not frozen.** The brief asked; it is the closing frame, lowered by the setter before
   the families. "Step them frozen on every dialogue tick after the first" would be wrong on the last one. Mutant 1
   pins it.
4. **"`talker :22784`, `watchers :22800`"**: at this base they are ≈`:22899` and `:22915`, after wave 51's
   additions.

## Hand-overs

- **To the planner:**
  - the keyed sweep (D3, 9 legs);
  - the `train_only` dispatch at my head:
    `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/dialogue-frame-freeze-order-9l1fjm -f train_only=true`;
  - at harvest, `SOLVER_ENV_NAMES`: my entry sits after `SEEDLING_DETOUR_VIA_BOUND`;
  - the constants census re-keyed one rule row in place (`levelRun.js|terrainAt`, `h53a7bb63` → `h424d5e72`, the ice
    turret's `stepIceTurret` call, same classification). Wave 51 had re-keyed the same row; it sits above the
    generated profile block, and `--profile-rows` measured stable.
- **To fidelity (later), beyond this slice's licence:**
  - **The beam tower's double step on a texted pickup's T** (with `pickupTickFreeze` ON): the main slot steps frozen,
    then `runFrozenTick` steps again. Wave 51's row pins `[true, true]`. The same skip would fix it under that key.
  - **Chasers on a frozen tick** (any freeze): `runFrozenTick` returns above `stepChasersNow`. Their moves are
    correctly frozen, but `Enemy.update`'s ungated `hitUpdate` (the `hitsTimer` drain) is not stepped. Shipped
    dialogue case: L12's puncher.
  - **Pushable blocks** are stepped unfrozen above the arms. This is vacuous for dialogues (no texted-dialogue room
    holds one). It is not checked for the other freezes.
  - **`PLACED_NPC_TALK`'s `spawn` cites** (`Game.as:2265-2282`) are 124 lines stale (now `:2389-2406`). The order
    the talker sort derives from them is unchanged.
- **To hammer:** `spitForecastNow` and anything else that steps `turret.js` ahead never predicts a dialogue freeze. A
  plan that opens a dialogue beside a turret previews the shot on the old timeline; with this key ON, the live run
  moves it by the frozen frames (row: the next spit t61 → t81).

## Residue

- Every ON row is staged and model-derived, not game-witnessed.
- The 9 L88 legs were not replayed in node; the leg runner is the browser sweep.
- A predicted dialogue frame on a tick that then returns early WITHOUT `runFrozenTick` (none found) would leave the
  record unspent and unchecked. The next tick's ask replaces it.
- Evidence: `seedling-fidelity-dialoguefreeze-evidence/`:
  - `tools/`: `rooms.mjs`, `world-rooms.mjs`, `probe-l88.mjs`, `stage.mjs` and `tape-onoff.mjs`;
  - `d1/`: the room censuses and the shipped L88 probe;
  - `d2/`: the gate file list and the mutants;
  - `d3/`: the acceptance md5s, the leg census, the survey OFF/ON, the tapes, vitest BEFORE/AFTER/ON, train ON and the
    producer line.
