# Seedling fidelity: slice ROCKBUTTON (`seedling-fidelity-rockbutton`), wave 41

Planner: `seedling-fidelity-planning-19`. ⚖ The user's GO (2026-11-12): *"Launch it now (Recommended)"*. The slice
starts from hammer ROCK-HOLDER's report (`claude/seedling-rock-holder-switch-iq5jyb` @ `1e6e80e47a`).

## 1. Start SHA, head, branch

- Base: `add369e82fc41b0a88505c74b665284ac7337269` (= `origin/main` at launch; 122 default-ON keys of 133).
- Harness branch: `claude/seedling-fidelity-wave-41-i399y5`.
- Commits: D1 `5d23d76c` (the key, OFF) → D0 `61aa3d4b` (the game witness + rows) → D2 `48c7d474` (measured ON; two
  pin fixes; evidence; bot-log entry) → `628f2877` (the procgen reference regenerated) → this report (the head).

## 2. The answer first

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Hammer's walk and control reproduce on p4g at this base. The census over all 116 atlas levels finds 11 rock entities and exactly ONE rock-on-activator overlap: L28 `fallrock@112,240` on `button@112,240`. |
| D0 | **PASS** | Three p4g tapes are committed (`fixtures/rockbutton-witness/`): the walk, its control, and a NEW live fall. With the key ON all three match at 0 px, including the lock's write tick. |
| D1 | **PASS** | `fallRockHoldsButton` (OFF, last key, `SEEDLING_FALL_ROCK_HOLDS_BUTTON`). OFF is byte-identical. 9 rows; 4 mutants, each red exactly as predicted. |
| D2 | **PASS (measured; not flipped)** | Key ON: no committed tape stream moves, and neither does the identity block (acceptance `391322d6…`) or a producer `--check`. The four L39 survey steps are identical. ONE bounded pin moves (`seedlingSoundCues`, `rope-l28-cut`: the game's Switch cue). |
| Solver | **STOP → hammer** | With the key ON the model opens the lock at t101 with no input. The solver still refuses seed 2's L28 → L30 door at t0. |

**The one thing to know first:** a game rule hammer's report did not name. `Button`, `Lock` and `Cover` have no
`Game.freezeObjects` gate. So through a rope-dropped rock's 181-frame frozen span, which the model collapses into one
tick, the game keeps pressing the button and fading the lock. A rope cut IN PLAY opens `grasslock@176,208` **ten live
ticks** after the cut (game t166), not 101 (t257). The key models both halves: the landed rock in
`movingSolidsNow()`, and the span's activator frames.

## 3. W0

**AS3.**
- `Button.update` collides `hitables = ["Player","Enemy","Solid"]` and excludes only a `Cover`
  (`Puzzlements/Button.as:16,29-39`). `set activate` plays "Switch" when the state changes (`:44`).
- A `FallRock` is `type = "Solid"` in two places: in the ctor when its tag is already cleared (`Scenery/FallRock.as:42-47`),
  and at the landing (`:76-83`). `FallRockLarge` is the same (`Scenery/FallRockLarge.as:50-56,96-104`).
- **Update order.** `Game.loadlevel` adds `button` (`Game.as:2341`), then `fallrock` (`:2353`), then `grasslock`
  (`:2361`), then `RopeStart` (`:2427`). `World.addUpdate` PREPENDS (`net/flashpunk/World.as:937-951`) and
  `Entity.type`'s setter re-files the entity immediately (`Entity.as:400-411`). So within one frame the lock updates
  first, then the rock, then the button. On the landing frame the button therefore already sees the Solid, and the lock
  fades from the next frame.
- **Freeze gates.** `grep freezeObjects` finds gates in `Mobile.as:35`, the enemies, `Player`, `BeamTower`, `RockFall`
  and `LightBossShot`. There is none in `Button`, `Lock`, `Cover` or `Activators`.

**Reproduced at this base.** Hammer's two tapes, played on p4g (port 9787, headless logic-only):

| tape | game |
|---|---|
| walk | min y 191.71, {28,2} at t102, 0 hits |
| control | stalls at 226.04, no write |

This matches hammer's §3 exactly.

**Census** (`evidence/census-rock-solids.mjs` + `.out.txt`): 116 levels, 11 rock entities (fallrock ×8, fallrocklarge ×2,
moonrock ×1).
- **Overlaps with a presser rect or an activator cell: 1.** That is `L28 fallrock@112,240 (tset 1) on button@112,240 (t 0)`.
  No FallRockLarge (L32, L82) and no Moonrock (L0) rests on any activator.
- **Rope-dropped rocks** (the only path the span step runs on): L28 (`rope@160,64`) and L39 (`rope@96,384` →
  `fallrock@144,624`).

| | L28 | L39 |
|---|---|---|
| Sweep legs at this base (`seedling-divergence-legs.mjs`, 934 legs, md5 `2ad2344d…`; `evidence/census-legs.txt`) | 8 legs. None stages {28,1}. Two cut the rope in play (`location:L28 flag 0: rope@160,64 cleared`, from L25 and L26), so the span step runs on them. The other six never drop the rock. | 3 legs |
| Route survey (seed 1, `--through=end --route=full`, 238 steps; `evidence/census-survey-steps.txt`) | **no step** | steps 65, 95, 136, 149 |

**Committed tapes.** Of the 293, 0 replay errors either way, and their streams are identical ON vs OFF (§6).

## 4. D0: the game witness

`scripts/procgen/probe-seedling-rock-button.mjs` (with `--record`; it takes the box lock) and
`frontend/modules/seedlingDemo/fidelityRockButton.js` (the tapes, the model samples, the comparison). Each tape plays on a
fresh p4g page. Each sample is `{t, level, x, y, hits, cleared}`, taken from the LAST poll of each tick.

| tape | staging | game | model ON | model OFF |
|---|---|---|---|---|
| `rockbutton-l28-walk` | boot (128,288), {28,0}+{28,1} cleared | {28,2} **t102**; min y 191.71; 0 hits | 0 px on 150/150; lockWrites t101 | differs on 96 ticks (first t102) |
| `rockbutton-l28-control` | nothing cleared | no write; stalls 226.04 | 0 px on 150/150 | 0 px |
| `rockbutton-l28-livefall` (NEW) | boot (96,16); the solver's rope cut (170 t) + 160 idle | {28,0}/{28,1} t156; {28,2} **t166**; 0 hits | 0 px on 330/330; lockWrites t165 | differs on 164 ticks (first t166) |

The walk and control inputs are hammer's, re-derived by `rockButtonWalkInputs`. They are byte-identical to hammer's
`tapes/l28-rock-holder-{walk,control}.json` (`inputs` and `persistence` equal).

The probe's last run: **ALL CHECKS PASSED** (6 PASS rows).

## 5. D1: `fallRockHoldsButton` (OFF)

**The change.** All of it is behind the key:
- `levelRun.movingSolidsNow()` adds `fallenRocksNow()`'s `fallrock` / `fallrocklarge` rows: the per-visit rocks, L32's
  arena rock and L82's arena rock. Moonrock is left out; no button lies under one.
  - This list feeds `stepActivators`, which uses it for the press (`pressedGroups`) and for the lock/cover occupancy
    (`occupied`). It also feeds `presserDown` / `activatorsNow`, `fallRocksArmedBy`, and the inventory-hold / frozen-tick
    activator steps. Every one of these readers is right to count a landed rock, by the same `Button.as` /
    `Lock.returnToNormal` / `Cover.update` rules.
- `levelRun.spanActivatorFrameNow(inSpan)`: `dropRock` (a rope's pull) calls it on every span frame **but the release
  frame**. The rock in flight counts as a Solid from its landing frame.
  - A span press that would drop ANOTHER rock is refused by name.
  - Why not the release frame: the pull tick's own end-of-tick `stepActivators` runs after the collapsed span, with the
    rock landed, so it already IS the release frame's update. Measured: stepping frames 1..181 opens the lock at t164
    (game t166); 1..180 gives t165, which is correct.
- `dropRocksTogether` (a button's or the wand's drop: L29, L43, L74) is **not** stepped. It is unwitnessed, and none of
  its rocks lands on an activator. This is named in the docblocks.
- Env: `SEEDLING_FALL_ROCK_HOLDS_BUTTON=0|1`, added to `SOLVER_ENV_NAMES` in sorted position.

**Digest.** No new run state. `fallRockStates`, `bobArena` and `lavaArenaRocks` are already in `stateDigestParts`
(`levelRun.js` ~18898–18913). `spanActivatorFrameNow` writes only the activator state and the lock ledgers, which the
existing activator machinery already owns.

**OFF byte-identity.** The identity block at `61aa3d4b` (`evidence/identity-d1-off.txt`) equals the published block row
for row (FIREBREAK's `identity-head-off.txt`), with two exceptions:
- The acceptance batch is `391322d681b7aa0229d94b3f6906d024`, the brief's standing value at main.
- The reference line moved because of the new instrument. It was regenerated in `628f2877`, and `--check` now passes.

The producers are `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0.

**Rows** (`fidelityRockButton.test.js`, 9):
- the key: OFF, last, and in the env table;
- the fixtures' provenance;
- the game's walk/control facts;
- the game's live-fall ticks (156/156/166);
- ON 0 px on all three;
- ON lock writes t101 / none / t165, and the fall ledger `[fallrock@112,240, 155, 181]`;
- OFF stalls, with the diverging-tick counts 96 / 164 / 0;
- the boot read: ON the button is down from t0, OFF it is up;
- the HAND-OVER pin: ON the solver still refuses at `button@112,240`. Hammer re-pins this one.

**Newest-key pins**, extended by name: `contactFidelity`, `fidelityFencepost` (the last-key row now points at the new
key), `fidelityFrozenPress`, `fidelityCeremony126`, `fidelityDrillWater`, `fidelityFireSpinner`, `fidelityL39Phantom`,
`fidelityRockGone`, `fidelityFireBreak`, `fidelityRockFire`. `boxLock.test.js` lists the new probe. Solver surface:
371 rows, `--check` GREEN. Constants census: 7089 literals, PASS.

**Mutants** (predicted first; each made by copy + edit, then restored and checked with `cmp`):

| mutant | predicted red | actual |
|---|---|---|
| M1: the `movingSolidsNow` rock arm off | ON 0 px, ON lock writes, boot read | exactly those 3 |
| M2: the span also steps the release frame | ON 0 px, ON lock writes (t164) | exactly those 2 |
| M3: no span step | ON 0 px, ON lock writes (t256) | exactly those 2 |
| M4: env name dropped from `SOLVER_ENV_NAMES` | the key row | exactly that row |

## 6. D2: the key ON, measured (the flip is not made)

| measurement | OFF | ON | moves |
|---|---|---|---|
| 293 committed tapes, stream md5 (`evidence/tape-streams-{off,on}.txt`, FENCEPOST's tool) | — | identical | **0** |
| identity block (`evidence/identity-d2-on.txt`) | `391322d6…` + six producers | identical | **0** |
| **acceptance batch md5** | `391322d681b7aa0229d94b3f6906d024` | `391322d681b7aa0229d94b3f6906d024` | **0** |
| local survey, L39 steps 65/95/136/149 (`evidence/survey-l39-{off,on}.txt`) | SOLVED 2740/2624/2624/2626 t, 0 hits | rows identical (`ms` aside) | **0** |
| `.slow.` in the census rooms: `deriveLevelWorldLogic.slow` (L28's world), `fidelityL32ArenaPrefix.slow` (L32's arena rock) | 2/2, 5/5 | 2/2, 5/5 | **0** |
| bounded vitest, 143 files (`evidence/vitest-bounded-*.txt`) | 4502/4504 (2 reds: mine, fixed in `48c7d474`, 37/37 after) | 4499/4504 | **2 pins** (below) |

The two bounded pins that move ON:
1. `seedlingSoundCues` › `rope-witness/rope-l28-cut`: the golden gains
   `45 L28 Puzzlements/Button.as:44 "Switch" -1 0.000 -0.448`. That is the game's own cue: the rock lands on the button
   in the span and `Button.set activate` flips. But the model stamps it at t45 with no `+90f` span annotation, while the
   Rock cue beside it carries one, because the cue reader diffs `activatorsNow` between ticks. A flip re-records this
   golden, and the cue module's owner may want the span offset.
2. `contactFidelity` › "the shipped defaults": an env-ON run of a defaults pin. A flip re-pins it.

**Census of what CAN move, for the sweep:** the change reaches only the two L28 rope-cut legs, through the span step.
Nothing a leg observes moves in node: the live-fall witness and every committed tape show identical positions, and only
the lock's ledger write is new. No leg stages the fallen rock.

## 7. The solver side: STOP, handed to hammer

`evidence` probe (node), boot (128,288) with {28,0}+{28,1} cleared, goal `reach-exit (304,16)`:

| arm | model at boot | solver |
|---|---|---|
| OFF | button `down: false` | refuses: `proximity-hazard button@112,240` (hammer's Arm A′ words) |
| ON | button `down: true`; the lock opens at t101 with no input | **the same refusal** |

The refusal comes from `solverBot.stanceHypothesis`: the lock's strategy refines to `weigh`, and `deriveWeighSource` asks
for a block that can reach the button. It never reads that the presser is already held by a resting Solid, which a
landed rock holds for the rest of the visit.

A caller cannot add the wait itself: `solveSegment` refuses a run that is not fresh ("the run must be fresh
(ticksCompleted 0)").

⇒ **For hammer:** treat an activator whose opener presser is `presserDown` under a non-moving Solid as discharged after
its fade (`opensOnTick`), i.e. plan a wait. The walk reaches the lock ~16 ticks before t101 (hammer's §4). The witness
for that page play is `rockbutton-l28-walk`; its inputs already cross the lock on the game. The ON hand-over pin in
`fidelityRockButton.test.js` will red when hammer lands the wait, and hammer re-pins it.

## 8. Dispatches for the planner

- **Survey A/B** (`seedling-survey.yml`, branch `claude/seedling-fidelity-wave-41-i399y5`, `route=full`, `through=end`):
  A = the default arm; B = with `SEEDLING_FALL_ROCK_HOLDS_BUTTON=1`, or `contact_fidelity` =
  `evidence/contact-fidelity-on.txt`. Expectation: 0 movers. No step visits L28, and the four L39 steps are identical
  locally.
- **Sweep** (⚖ economy): ONE keyed sweep per arm on the two rope-cut legs (`evidence/keys-rope-cut.txt`, `shards=2`).
  - A: `contact_fidelity` = `evidence/contact-fidelity-off.txt` (122 keys, md5 `f411b21d…`).
  - B: `contact_fidelity` = `evidence/contact-fidelity-on.txt` (123 keys, md5 `44b4fe14…`).
  - Expect no verdict or hit move. These are the only legs the span step reaches. No `capture_requests`.
- `seedling-probe.yml battery=standard` on this branch. Expect no mover: no wasm probe leg is in L28 with the rock
  fallen, and the change is OFF by default anyway. Run it with the key ON if the battery takes an env.
- `unittests_frontend.yml -f train_only=true` at the head. No train file is in the census rooms (the four `.train.` hits
  for "L39" are L40 legs that arrive from L39).
- The push CI (`JavaScript Unit Tests`) at this report's head: see §11.

## 9. JS arc / hammer / others

- **JS arc:** no contract change. There is a new optional ledger behaviour: lock writes inside a rope span, ON only.
  `--carry-route-flags` (side finding, not fixed): staging {28,0} without {28,1} throws "Declare both tags or neither".
  My stagings work around it by declaring both tags (`arrivalStaging(..., { cleared: [0, 1] })`) or by cutting the rope
  in play.
- **Hammer:** §7. No hammer-owned pin moved.
- **Sound cues** (`seedlingSoundCues.js`): §6 item 1.

## 10. What the brief got wrong (measured)

1. **"ON: landed FallRocks join `movingSolidsNow()` on the game's tick" is only half of it.** The game also presses and
   fades through the rock's frozen span. Without the span step the live fall opens the lock at t257; the game opens it
   at t166.
2. **The census rooms for `.train.`/`.slow.` files.** The rock-on-button geometry is L28 only. The span step adds L39,
   whose survey steps exist but do not move. Seed 1's route survey has **no L28 step**, so the L28 evidence is the game
   witnesses plus the leg census.
3. **The brief's bounded list names an `apReportBosses` test.** No such test file exists; only the module
   `apReportBosses.js` does.
4. **"Probably needs only a WAIT".** That holds for the model: it opens the lock with no input. The solver cannot
   express the wait from t0, because it reads the stance first (§7).

## 11. Residue, byte-inertia, rows to BANK

- **Byte-inertia:** OFF is identical in every way measured. ON is also identical on tapes, identity, acceptance and the
  L39 survey; only 2 pins move.
- **Residue:**
  1. `dropRocksTogether` spans do not step activators (unwitnessed; no geometry needs it).
  2. The Switch cue's `+90f` annotation.
  3. The solver's wait (hammer).
  4. Enemies as pressers (unchanged, already named in `movingSolidsNow`).
- **Rows to BANK:** the three fixtures. The OFF/ON tick counts 96/164 (walk/live). The lock write ticks t102 / t166
  (game) and t101 / t165 (model ON). The acceptance md5 is `391322d6` both ways.
- **CI:** this report's commit changes docs/evidence only (no code since `628f2877`), and it cancels `628f2877`'s push run (`43150125717`), so the `JavaScript Unit Tests` verdict is the one at THIS head — `node scripts/procgen/ci-vitest-summary.mjs <this head> --wait`; the session's final message quotes it.
- The dev server I started (PID 574) went away with the container restart; nothing else is left running.
