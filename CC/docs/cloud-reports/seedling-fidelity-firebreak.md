# Seedling fidelity FIREBREAK — a run with Fire and no Sword breaks an ordinary rock, and the solver plans it (`fireBreakArm`, OFF)

Planner `seedling-fidelity-planning-19`, wave 40. ⚖ The user (2026-11-11): *"Fire break + fencepost now (Recommended)"*.

| | |
|---|---|
| start SHA | `4bbf15fea9` (= `origin/main`, train 91; 131 keys, 121 default-ON) |
| head | see the last commit on the branch (this report is committed last) |
| harness branch | `claude/seedling-fidelity-firebreak-v9qa1n` |
| evidence | `CC/docs/cloud-reports/seedling-fidelity-firebreak-evidence/` |

## Verdicts

| D | verdict | one line |
|---|---|---|
| W0 | **DONE** | 18 of the 24 shipped rocks have a walkable cell whose flame reaches them alone (not L40's three, L41's two, L3's ghost rock). The rules name the Sword or the Ghost Spear on every rock edge and never Fire. Neither the survey route nor the sweep's legs hold Fire without the Sword |
| D1 | **PASS** | `fireBreakArm` (OFF, last key, `SEEDLING_FIRE_BREAK_ARM`). OFF is byte-identical: the identity block equals the published values. 30 rows, ten mutants |
| D2 | **MEASURED, flip-ready** | Six solver plans played on the game (p4g): 0 px, no hit. ON, 60 census requests a Fire-only run was refused now solve, all hitless. Survey rock-room steps byte-identical. Bounded set ON: one red, the defaults pin |
| rules hand-over | **WRITTEN** | Eight rule rows where Fire alone is game-witnessed or solver-proven, and the rows where it is not |

**The one thing to know first:** no shipped instrument can see this arm. All 934 divergence legs and all 54 survey
route legs that hold Fire also hold the Sword, so the survey and the sweep are byte-identical ON and OFF by
construction. The arm's evidence is the game witnesses and a census written for it. It matters for an AP seed in
which Fire arrives before the Sword; today's rules do not credit Fire for a rock.

## W0 — the trace (no code)

**Where the solver stopped.** `resolveBreakStrategy` asked the selected slot first and refused everything but the
Sword or a modelled Ghost Sword (*"only the plain SWORD breaks a rock in this model"*). The four Fire stance planners
(`fireReachFrom`, `resolveFireMoveStrategy`, the corpse push, `ropeFireReach`) refuse a stance whose flame reaches
anything but their own target, and a rock is a `modelled` responder, so a rock was always a stray.

**The rocks, and what a flame reaches from beside each** (`presses.auditFire` from every tile centre of the 3x3 ring;
a Fire-only run, the rocks standing). Every ring cell reaches its rock: the 16 px radius cuts none of them. What
differs is what else is in the flame.

| level | rock (type, tag) | walkable cells that reach it ALONE | note |
|---|---|---|---|
| L0 | `@192,32` (0, 3) | 5 | |
| L0 | `@288,176` (0, 1) | 1 — (280,184) | the other ring cells are solid or the door |
| L0 | `@80,112` (0, 4) | 4 | |
| L3 | `@96,112` (0, 0) | 2, and the L11 door's own cell | the pocket's only way off |
| L3 | `breakablerockghost@0,64` (1, 1) | none walkable | ghost rock: needs the Ghost Sword |
| L15 | `@96,80` (0, 2) · `@96,16` (0, 3) | 3 · 5 | |
| L16 | `@96,64` (0, 3) | 3 (north side) | the south cells also reach `@96,80` |
| L16 | `@96,80` (0, 4) | 1 — (88,104) | |
| L16 | `@112,80` (0, 5) | 1 — (136,104), the far side | from the L15 side every cell reaches `@96,80` too |
| L16 | `@304,64` (0, 6) | 4 | |
| L30 | `@48,224` (0, 1) | 8 | stands on the pit to L31 |
| L40 | `@160,144` (0, 23) · `@176,128` (0, 22) · `@176,144` (0, 24) | **0 · 0 · 0** | every cell reaches a second rock (and spinners) |
| L41 | `@224,64` (0, 1) · `@224,80` (0, 2) | **0 · 0** | every cell reaches both; they shield crushers (`bait`) |
| L53 | `@112,128` (0, 0) · `@128,160` (0, 1) | 3 · 3 | |
| L73 | `@64,48` (0, 0) | 5 | |
| L92 | `@176,48` (0, −1) · `@256,112` (0, −1) | 4 · 5 | |
| L100 | `@128,144` (0, 0) | 2, both east | the west side is the 8 px sliver |
| L101 | `breakablerockghost@224,96` (1, 2) | 2 | ghost rock: needs the Ghost Sword |

**What the rules require there today** (`seedling_playthrough` seed 1, `evidence/rules-rock-levels.txt`): every
rock-gated edge reads `HasAny(Ghost Spear, Progressive Sword)`, alone or under an `And`; L0's two rock events
(`L0 flag 1`, `L0 flag 4`) read the same. L15's `r1c5 → r1c9` adds `Progressive Swim`; L73's adds `Dark Suit`; L40's
edges and L41's `r4c15 → r7c15` add `And Fire`; L101's ghost-rock edge is `HasAll(Ghost Spear, Ghost Sword Fusion,
Progressive Sword)`. No rule names Fire as a rock-breaker.

**Which survey steps and sweep legs depend on a rock.** The 33 survey steps in rock rooms and the 174 sweep legs are
the same sets ROCKFIRE listed (re-derived at this base, `evidence/keys-rock-rooms.txt`). None of them is a
Fire-and-no-Sword request: measured, **0 of 934** divergence legs and **0 of 54** survey route legs hold Fire without
the Sword (`evidence/survey-route-derive.txt`; the route collects the Sword first and Fire at leg 4.2). So every
place the game allows a Fire-only break and the solver refused is outside both instruments. The census below asks
them directly.

## D1 — `fireBreakArm` (OFF, byte-identical)

- `contactFidelity.js`: the key, LAST in `CONTACT_FIDELITY_DEFAULTS` (132 keys, 121 ON), its doc block, the two env
  lines. `solverEnvChannel.js`: `SEEDLING_FIRE_BREAK_ARM` in `SOLVER_ENV_NAMES`.
- `solverBot.js`, all inside the `break` verb:
  - `fireBreakAdmits(run)`: the key and `fireRockArm` ON, and the run HOLDS Fire (an inventory read, never a grant),
    not the Fire Wand fusion, and **neither the Sword nor the Ghost Sword**.
  - `resolveFireBreak`: `rockBreaksUnder` first (a ghost rock is `held: false`, naming the Ghost Sword). Then the
    stance: the `burn` verb's candidates (`burnStanceCandidates` over the window around the rock, a lean when the
    radius cuts the centre), each asked of `rockFireReach` — the flame reaches this rock and no other `modelled` or
    `refused` responder; a rock already gone this visit is not there to reach — outside every static danger volume
    (`pullStanceAdmit`), reachable by `stanceReaches` directly, then under the hypothesis without this rock.
  - `execFireBreak`: settle, lean, re-ask the audit where the walk stopped, **certify the press and its wait
    hit-free on a fork** (`ctx.fork`), select the Fire's slot (`equip`), press once, wait for the run's `brokenRocks`
    and `FIRE_BREAK_WAIT_TICKS`, restore the slot.
  - The clock: `FIRE_BREAK_WAIT_TICKS = WAIT_AFTER_PRESS_TICKS + FIRE_WINDOW.firstHitTick − 1` = 23. The witnessed
    timing is press + 4 for the first hit, `goneAt` = hit + 7, flag on `goneAt + 1`, cell on `goneAt + 2`; the sword's
    20-tick wait has the same margin after a first test at press + 1.
  - `rockHypothesis` admits a rock for such a run where some cell's flame reaches it alone (`fireBreakStances`, the
    resolver's own scan); the step-off's `break` takes a Fire order when the door is its stance, and hands it
    `equip` and `fork`.
- New optional result fields on a `break` record (for the JS arc, nothing to wire): `weapon: 'fire'`, `lean`,
  `restoredSlot`. No new `SolverRefusal.obstacle.kind`. No new per-visit run map, no new run getter, no `run.*`
  field renamed. `runFire` (`botDriverV2.js`) is not used and not edited: the press is the verb's own.

**Three things the measurement changed in the design.**

1. *A Ghost Sword without the Sword is not admitted.* First cut: admitted, since `slash()` is `if (hasSword)` and such
   a run cannot swing. Measured on L0's `@80,112`: OFF refuses by name (`ghostSwingRefusal`); admitted, the walk's
   strike policy (it reads `hasGhostSword`) pressed the ghost slot at tick 0 and `levelRun` threw. So that run keeps
   today's refusal, and a ghost rock is never a Fire order here.
2. *The fork certificate.* The census's first pass solved L73's rock from the L72 landing with **one hit**: the press
   at (72,72) is t101 and `bulb@80,80` walks onto the standing player at t115. The verb now plays the press and its
   wait on a fork first and refuses naming the body; nothing is pressed on the live run. ⚠ INTERIM, named: the game
   does not need the player to stand for the wait (the flame's first hit tick is the whole effect). A wait that
   moves is queued modelling.
3. *The hypothesis asks for a clean cell.* First cut: `rockHypothesis` admitted every rock `rockBreaksUnder` allows.
   The bounded set ON found it: `fidelityL40Button` › *"a run with no sword hypothesises no rock"* went red, because
   that run holds Fire and L40's three rocks were hypothesised, though no flame reaches one of them alone. The guard
   is now the resolver's own scan (`fireBreakStances(…).viable`), and that row is green ON.

**Rows** (`fidelityFireBreak.test.js`, 30, default tier, ~5 s). The clock rows were predicted from ROCKFIRE's timing
(hit = press + 4, gone = hit + 7, 23 ticks from press to return); the stances and press ticks were read off the first
ON run and then pinned.

| mutant | predicted red | measured red |
|---|---|---|
| m1 admission drops `!hasSword` | "with the Sword held … ON plans what OFF plans" | the *held with Fire* row (the *selected alone* row holds no Fire, so it cannot move: my prediction named both) |
| m2 `rockFireReach` reports no `others` | the L40 crowded-stance row | that row and the hypothesis row (L41's two become clean) |
| m3 `FIRE_BREAK_WAIT_TICKS` = the sword's 20 | the clock row and the L0 plan row | those, the L3, L30 and L73 rows and four recorded-tape rows |
| m4 `resolveFireBreak` skips `rockBreaksUnder` | the ghost-rock row | exactly that row |
| m5 the slot is not restored | the Wand-selected row | that row and its recorded-tape row |
| m6 the admission ungated | every OFF row | the four rows that assert an OFF answer (the ON = OFF equalities cannot see it) |
| m7 `execBreak` loses the Fire dispatch | every ON SOLVED row | nine rows (L0's east/west recorded-tape rows hold: from those stances the swing loop emits the same keys) |
| m8 the fork certificate skipped | the L73 row | exactly that row |
| m9 `rockHypothesis` does not admit a Fire run | the L53 prerequisite row | that row and the hypothesis row |
| m10 `rockHypothesis` drops its clean-cell guard | the hypothesis row (L41's two admitted) | exactly that row |

Each mutant was a copy of `solverBot.js`, edited, run, restored (`cmp` clean after).

**Byte-inertia (key OFF).** The identity block at the D1 tree equals the published main values row for row
(`evidence/identity-head-off.txt`): maze `57e07d21`, acceptance **`abb206c88de25e7ba1874510d493ce85`**, c3 `d356fc8a`,
c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate
`7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; producers `7486f32e` · `93f75467` ·
`88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0. ⚠ The BEFORE is by quotation (ROCKFIRE's block, which is
main's): the diff of the two files is empty. The block was run twice: once while the solver edits were still landing
(all behind the key), and again whole at the committed head `1364b06d`. Both equal the published block; the file
in the evidence folder is the second. The later commit `74994268` changes two functions reached only when the
admission is true; the acceptance batch at that head is `abb206c88de25e7ba1874510d493ce85` again, and CI's whole suite
is green there.

## D2 — the key ON, measured

### The game witness (p4g, the default build, headless logic-only, port 9784)

`scripts/procgen/probe-seedling-fire-break.mjs [--record] [--only=]` (box-lock roster row in `boxLock.test.js`; fold
`fidelityFireBreak.js`). Each tape is the SOLVER's own plan (`twoPassSolve`, `dashMode: 'all'`, the key ON) for a run
with Fire and no Sword, played on a fresh page and compared with the model on every sampled tick: the player, the
hits, and the rock's persistence write.

| witness | room, request | the plan | the game |
|---|---|---|---|
| `firebreak-l0-rock-east` | L0 from the L2 landing; clear-tag {0,1} | (280,184), press t102, 125 t | 0 px on 128 ticks; {0,1} on t114 = `goneAt + 1`; no hit |
| `firebreak-l0-rock-west` | L0 from the L13 landing; clear-tag {0,4} | (72,136), press t85, 108 t | 0 px on 111 ticks; {0,4} on t97; no hit |
| `firebreak-l0-wand-fire` | the east rock, the Wand selected, Fire held | equips: Fire's slot at t102, the Wand's at t125 | 0 px on 128 ticks; {0,1} on t114; no hit |
| `firebreak-l3-pocket` | L3 from the L11 landing (latched on the door); reach-exit | the rock broken FROM the door, press t0; step off and back on; 36 t | 0 px on 40 ticks; {3,0} on t12; ends in L11; no hit |
| `firebreak-l30-pit` | L30 from the L28 landing; reach-pit (3,14) | (40,216), press t75; 205 t | 0 px on 207 ticks; {30,1} on t87; ends in L31; no hit |
| `firebreak-l92-cross` | L92 from the L87 landing; reach-exit to L91 (Fire, swim, shield, torch, feather) | `@256,112` from the landing (press t0), `@176,48` from (200,72) (press t156); 463 t | 0 px on 466 ticks; ends in L91; no hit |

L92's rocks are `tag = -1`, so there is no flag for the readout to hold; the crossing through both cells is the
reading. That room holds a spinner, a jellyfish and a bob.

⚠ L92's verdict depends on the staging's game clock. From `arrivalStaging` (the witness, and the census) it solves;
under `r9-solve-16`'s seam clock the same request refuses at the spinner's hammer beside (200,72). One sample each,
named with its staging.

### The census (a Fire-and-no-Sword run, key OFF against ON)

Three request sets, each asked with the Sword (S), with Fire and no Sword OFF (F) and ON (F-ON); items are Fire plus
swim, shield, torch and feather; a fresh save (every rock standing); `solveSegment` with a `forkRun`
(`evidence/census-rocks.txt`, `census-edges.txt`, `census-legs.txt`).

| set | requests | F refuses, F-ON solves | hits in those |
|---|---|---|---|
| each rock's clear-tag from each arrival of its level (+ L92's two crossings) | 89 | **37** | 0 |
| a rock-gated edge crossed, arrival in A to an exit in B | 20 | **7** | 0 |
| the 174 rock-room sweep legs, re-staged swordless | 174 | **16** | 0 |

All 60 were asked again through `twoPassSolve` (`dashMode: 'all'`): 60 SOLVED, 0 hits
(`evidence/census-twopass.txt`). No request that F solves is refused by F-ON. By level: L0 37, L3 8, L30 6, L15 4,
L16 3, L53 1, L92 1.

What stays refused ON, and why:

- **L40, L41, L16 `@112,80`**: *"N walkable cell(s) put `fireRect` on the rock … N also reached another fire
  responder"*. The flame has no aim.
- **L3 and L101's ghost rocks**: by name, the Ghost Sword.
- **L53** (`@112,128` from the L48 landing; `@128,160` from all three), **L73** from the L74 side, **L30** from one
  pit landing: the combat ladder, or a kill order with no weapon — a chaser on the corridor, and this run has
  nothing for it. **L53** `@112,128` from the L54 landing: no reachable stance. **L73** from the L72 side and **L92**
  from the L91 side: the fork certificate (a body reaches the stance inside the wait).
- **L100** from the west: no tile-centre stance in the 8 px sliver.
- **L0 from the L1 and L12 doors**: the landing is inside the standing rock (`arrival-inside-solid`), in every arm.

Two requests THROW in the Sword arm and in F-ON alike (L30's two key-locked arrivals: `execKeylock`'s
`SolverBotError`), where F refuses earlier at the rock. That is the keylock verb's existing error class, reached
later; it is not new.

### The survey and the bounded set

**Survey (local, route=full, through=end), the 33 rock-room steps** (1, 3, 12, 14, 16, 20, 23, 24, 26, 30, 38, 40, 55,
58, 61, 66, 67, 78, 82, 86, 96, 97, 98, 100, 137, 150, 161, 200, 217, 218, 224, 229, 232): **byte-identical ON vs OFF**
on every row field but the wall time: 28 SOLVED / 5 REFUSED in both
(`evidence/survey-rock-rooms-{off,on}.json`). No other step can move: no route leg holds Fire without the Sword.

**The bounded set** (210 fast files: ROCKFIRE's 142, the brief's standing list, and every `grep -a` hit for
`resolveBreakStrategy`, `execBreak`, the `break` verb, `fireReachFrom`, `auditFire`, `fireRockArm`, `rockHypothesis`,
`STANCE_ROCKS`, the rock modules, the step-off and the defaults; `evidence/vitest-bounded-files.txt`):

| arm | result |
|---|---|
| OFF (default) | 208/210 files, 5821/5826. The two red files were mine, caught mid-edit by a 29-minute run (`fidelityFireBreak`: the L92 recording and the certificate row were landing; `seedlingSolverSurface`: its table was regenerated minutes later). Both re-run green at the head. CI's whole suite is green at the pushed heads |
| ON (`SEEDLING_FIRE_BREAK_ARM=1`), first run | 208/210, 5823 passed, 2 red, 1 skipped (my own key-OFF row, `skipIf` the env). Red 1: `contactFidelity.test.js` › *the shipped defaults: all three ON* (the flip re-pin). Red 2: `fidelityL40Button.test.js` › *a run with no sword hypothesises no rock* — a real finding, fixed (design change 3 above) |
| ON, after the fix | the 44 files of the set that stage Fire or a swordless run, re-run: **44/44, 1417 passed**; `fidelityL40Button` and `contactFidelity` again: one red, the defaults pin |

So a flip owes **one re-pin**: `contactFidelity.test.js`'s defaults row (`fireBreakArm` false → true), plus
`fidelityFireBreak`'s own *"ships OFF"* row. Every committed GAME-WITNESS test in the set is green in both arms.

**Train and slow files, key ON, one at a time** (the train tier does not run on a slice push):

| tier | files | result |
|---|---|---|
| train (`vitest.train.config.js`) | 21: every `seedlingDemo` `*.train.test.js` but `seedlingGenCapacity` — `fidelityCorpseBump2`, `fidelityL40Bk2`, `fidelityL40Latch`, `hammerApproachOrder`, `hammerBk2Combat`, `hammerBombPhase`, `hammerChooserPair`, `hammerClearTagChain`, `hammerEscapeExact`, `hammerGhostKillRung`, `hammerIceTurretStatic`, `hammerKeylockTurret`, `hammerL53Killlock`, `hammerLatchWeigh`, `hammerOppPressFallback`, `hammerPitWest`, `hammerPocketBurn`, `hammerSouthDoor`, `hammerSpinnerPress`, `hammerStagedHuntScanMemo`, `hammerTurretApproach` | **21/21 files, 70 tests, all green** |
| slow (`vitest.slow.config.js`) | 6: `fidelityL32ArenaPrefix`, `fidelityLights`, `hammerDashShape`, `jsRuntimeSolverCalibration`, `strategySwitchApproach`, `strategySwitchGrade` | **6/6 files, 28 tests, all green** |

That covers every train file that stages a rock room (L40, L53, L16, L30 and the rest), and the others with them. No
row moved. ⚠ The earlier train files loaded the solver before the hypothesis guard was added (commit `74994268`) and
the later ones after it; the guard is reached only by a run that holds Fire and no Sword. OFF, the train tier was not
run here (the dispatch is below). `evidence/vitest-train-slow-on.txt`.

**Survey/sweep rows this moves: none.** No hitless leg becomes a hit-taking one: every request ON solves that OFF
refused is hitless, and no request OFF solves is touched.

## The rules hand-over (for `seedling-rules-planning-6`; nothing here is edited)

Each row: a rule that names the Sword or the Ghost Spear for a rock, the evidence that Fire alone does it, and what
the rule would read. "Fire alone" means Fire with no Sword and no Ghost Sword; the census runs also held swim,
shield, torch and feather, so a row that needed one of those says so. ⚠ The rock-to-edge pairing is mine, read off
positions and the solver's own break records; confirm it against the region atlas.

**Fire is a proven alternative:**

| rule today | rock | evidence | would read |
|---|---|---|---|
| `level_0__r7c6` @ `L0 flag 1: breakablerock@288,176 cleared` — `HasAny(Ghost Spear, Progressive Sword)` | `@288,176` | GAME `firebreak-l0-rock-east`, `-wand-fire`; solver ON from all 6 `r7c6` arrivals and from `r2c13` | `HasAny(Fire, Ghost Spear, Progressive Sword)` |
| `level_0__r7c6` @ `L0 flag 4: breakablerock@80,112 cleared` — the same | `@80,112` | GAME `firebreak-l0-rock-west`; solver ON from the same 7 arrivals | the same |
| `level_0__r7c6 → level_0__r11c19` — the same | `@288,176` | solver ON, crossing to `out_teleporter_304_176` from 2 arrivals (145 t, 310 t), no hit | the same |
| `level_0__r7c6 → level_0__r6c5` — the same | `@80,112` | solver ON, crossing to `out_teleporter_80_96` from 2 arrivals (209 t, 147 t), no hit | the same |
| `level_3__r8c6 → level_3__r0c4` and `level_3__r0c4 → level_3__r8c6` — the same | `@96,112` | GAME `firebreak-l3-pocket` (from the L11 door, back to L11); solver ON, `r0c4 → r8c6` from 2 arrivals and `r8c6 → r0c4` to `out_teleporter_64_0`, no hit | the same |
| `level_30__r2c10 → level_31__r5c24` — the same | `@48,224` | GAME `firebreak-l30-pit` (from the L28 landing into L31); solver ON from 3 of the 4 `r2c10` arrivals, no hit (the 4th, pit landing (240,80), refuses at `bobsoldier@48,80`) | the same |
| `level_92__r7c17 → level_92__r3c12` and `level_92__r3c12 → level_92__r1c7` — the same | `@256,112`, `@176,48` | GAME `firebreak-l92-cross` (from the L87 landing, both rocks, then `r1c7 → r4c2`, which is a swim edge in the rules, and out to L91). Fire broke both rocks; swim, shield, torch and feather were held | the same, for that direction |
| `level_0__r2c13 → level_0__r1c6` — the same | `@192,32` | solver ON: clear-tag {0,3} from the `r2c13` arrival (92 t) and from 6 `r7c6` arrivals, no hit. No crossing measured (no leg ends in `r1c6`) | the same (solver-proven, not game-witnessed) |

**Fire breaks the rock, but the edge is not shown** (no rule change proposed on this evidence):

| rule today | what was measured |
|---|---|
| `level_15__r1c5 ↔ level_15__r1c9` — `HasAny(Ghost Spear, Progressive Swim, Progressive Sword)` / the swim form | both rocks' clear-tags solve ON from both arrivals (with swim held). With Fire only, the crossing refuses in both arms at `pushableblock@64,64` / `button@112,32`: the block route, not the rock |
| L16's five sword edges | `@96,64`, `@96,80`, `@304,64` solve ON from the L15 landing (84, 83, 464 t); `@112,80` refuses (crowded). No crossing measured; from the L17 side the armed arrow lane refuses, as ruled |
| `level_53__r2c2 ↔ level_53__r9c10` — `And(HasAny(…), Swim)` | `@112,128` solves ON from the L51 landing (160 t); the L48 arrival refuses on the combat ladder (a chaser on the corridor) and the L54 arrival has no reachable stance. `@128,160` refuses from all three (its stance is behind `@112,128`, and that walk meets `puncher@136,96`) |
| `level_92__r3c12 → level_92__r7c17` (the reverse direction) | from the L91 landing the certificate refuses (a hit inside the wait) |
| `level_100__r2c3 ↔ level_100__r4c10` | from the west the stance is the 8 px sliver (refused); east cells exist, no arrival there |
| `level_73__r0c4 ↔ level_73__r3c7` — `HasAny(Dark Suit, …)` | refused both ways (the bulb, the lavarunner) |

**Fire does NOT do it** (the rule is right as written): L40's three and L41's two (no flame reaches one rock alone;
L41's are the crusher bait's), L3's and L101's ghost rocks (the Ghost Sword), and L0's `r6c5 → r7c6` /
`r11c19 → r7c6` (the landing is inside the rock, whatever is held).

⚠ `HasAny(Ghost Spear, Progressive Sword)` already counts the Ghost Spear alone as a rock-breaker. I did not test
that; this slice only adds evidence for Fire.

## The dispatches for the planner (I cannot dispatch)

Branch `claude/seedling-fidelity-firebreak-v9qa1n` at the head.

1. **Survey A/B** — `seedling-survey.yml`, `through=end`, `route=full`, on (A) this branch as is (OFF) and (B) the same
   with `fireBreakArm: true` as the default (a one-line scratch flip; the workflow has no switch input). Expect
   identical rows: no route leg holds Fire without the Sword.
2. **Sweep ×2 per arm** — `seedling-divergence-sweep.yml`, `shards=10`, `mode=inv`, `producer=solver`, `keys=` the 174
   rock-room legs derived at this base (`evidence/keys-rock-rooms.txt`, md5 `8e509c1c…`), `contact_fidelity=` (A)
   `evidence/contact-fidelity-off.txt` (the base's 121 default-ON keys, built fresh from this head, md5 `bab07f58…`)
   and (B) `evidence/contact-fidelity-on.txt` (the same + `fireBreakArm`, md5 `f411b21d…`). Expect no mover: no leg
   holds Fire without the Sword.
3. **Probes** — `seedling-probe.yml`, `battery=standard`, on the branch (OFF), and once with the scratch flip.
4. **Train tier** — `unittests_frontend.yml -f train_only=true` on the branch (OFF), and once with the scratch flip.
5. ⚠ None of 1–4 exercises the arm. To see it on the page: a sweep whose legs are staged with Fire and no Sword. The
   sweep has no inventory override today; if the JS arc adds one, the 60 census requests are the list.

## Handed on

- **Rules arc:** the table above.
- **JS arc:** nothing to wire. Optional new fields on a `break` record (`weapon`, `lean`, `restoredSlot`). The plan
  carries `equips` when another slot is selected, as the `burn` and `rope` verbs already do. JS pins that move: none.
- **Hammer arc:** nothing edited in its region. `execFireBreak` CALLS `ctx.fork()` (the segment's fork, as the rope
  cut's and the boss verbs' certificates do) and edits nothing of it. One finding for its strike policy, not changed
  here: on a walk it reads `hasSword || hasGhostSword` and presses `primary`; with a Ghost Sword and no Sword that
  press is the state `levelRun` throws on.

## What the brief got wrong (measured)

- *"deriving a stance whose flame reaches the rock and NOTHING ELSE"* is achievable for 18 of 24 rocks, not for L40's
  three or L41's two (the sixth is L3's ghost rock, which has no walkable cell beside it). Those five need a rule
  for a flame that breaks several rocks at once, which this slice did not write.
- *"admits Fire when … no Sword/Ghost Sword applies"*: a Ghost Sword without the Sword does not swing, but admitting
  that run turned a refusal into a throw. The admission is "holds neither".
- *"the local survey ON vs OFF"* and the sweep cannot show the arm at all (0 Fire-without-Sword legs in either).
- *"Timing: … a clock from the witnessed timing"*: the witnessed numbers give the leg's wait directly (23); no new
  constant was needed beyond the two the modules already own.
- The brief did not ask for a hit certificate. The census needed one (L73).

## Residue

- **A flame that reaches several rocks** (L40, L41, L16 `@112,80`): not planned. A crowded cell becomes clean once
  the other rocks are gone, and the hypothesis does not chain that.
- **A stance off the tile centres** (L100's sliver; the swing has `fineSwingStance`, the flame has no 8 px arm).
- **A wait that moves** (the certificate's INTERIM, above).
- **The block-route search's `break` steps** (`deriveBlockRoute`, `breakStanceUnder`) are still a swing's stance, so
  L15's block route does not open for a Fire-only run.
- **`refineStrategy`'s crusher `bait`** takes a shield rock from the `break` verb before Fire is asked (L41).
- **The Fire Wand fusion** throws in `levelRun` at the first press in both arms (`useItem` case 5), before any verb.
- The freeze under a pickup ceremony is transcribed in `applyFire` and still not game-witnessed (ROCKFIRE's residue).

## Deltas, records

- Reference regenerated (the new probe: 545 instruments; the docs index after the log entry and the
  `seedling-bot.md` paragraph): `--check` ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH. Solver surface
  `--write`/`--check`: 371 rows, GREEN (site counts only). Constants census: 7088 literals, `--check` PASS.
  `check-procgen-help.mjs --doors=all`: ALL PASS.
- Records: `seedling-bot.md` paragraph; `seedling-bot-log.md` entry (three trap candidates); box-lock roster row.
- No tape added to `fixtures/tapes/` (the witnesses live in `fixtures/firebreak-witness/`), so the roster pins and
  `r8Acceptance` are untouched.
- Newest-key pins extended to admit `fireBreakArm` (found by grepping `fireRockArm`): `fidelityFrozenPress`,
  `fidelityL39Phantom`, `fidelityDrillWater`, `fidelityCeremony126`, `fidelityRockGone`, `fidelityFireSpinner`,
  `fidelityRockFire` (its *"last in the defaults"* became *"followed only by wave 40's key"*). ⚠ Sibling FENCEPOST adds
  its own key; whichever lands second re-admits the other in these seven rows and in `fidelityFireBreak`'s
  *"last in the defaults"*.
- CI, `JavaScript Unit Tests` on the push: at `2b8b6ea9` (D1) run `43051496753` **success**, suite 26874 passed / 0
  failed, slow battery 436 / 0; at `1364b06d` (D2) run `43055021223` **success**, suite 26876 passed / 0 failed, slow
  battery 436 / 0; at `74994268` (the hypothesis guard) run `43062617972` **success**, suite 26877 passed / 0 failed,
  slow battery 436 / 0. `unittests` success at the first two (the third was not read). The report-only head follows `74994268`. The train tier does not
  run on a slice push; the local run is in the table above.

## Rows to BANK

- `fidelityFireBreak.test.js` (30 rows, default tier, ~5 s).
- `fixtures/firebreak-witness/` — six p4g recordings of solver plans: `firebreak-l0-rock-east`, `-rock-west`,
  `-wand-fire`, `firebreak-l3-pocket`, `firebreak-l30-pit`, `firebreak-l92-cross`.
- `FIRE_BREAK_WAIT_TICKS` = 23 (press + 4 hit, + 7 gone, + 2 cell, with the sword wait's margin).
- Census fact: 0 of 934 divergence legs and 0 of 54 survey route legs hold Fire without the Sword.
- Trap candidates: a `solveSegment` harness without `forkRun` runs fork-certified verbs uncertified; a verdict is its
  staging (L92); "holds no Sword" must read `hasGhostSword` too.
