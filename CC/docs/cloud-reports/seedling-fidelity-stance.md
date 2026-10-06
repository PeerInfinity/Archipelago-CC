# Seedling fidelity STANCE — the stances the solver never landed (keylock, chest, button, swing)

Wave 8 (model coverage), planner `seedling-fidelity-planning-3`. ⚖ The user (2026-10-05): *"The first priority is to
expand the model to include everything in the game."* Standard: the solver handles either state, knows which state
it is in, and never clears the save or leaves and re-enters the room to solve.

| | |
|---|---|
| Start SHA | `0f952e9a9e` (the WAVE-7 harvest: main `9e1361f7c5` + CHECKPOINTS + LINEFLIP) |
| Head | the commit carrying this report, on top of `2b8d8d4` (the last code/records commit) |
| Harness branch | `claude/seedling-fidelity-stance-o7qda1` (local `seedling-fidelity-stance`) |
| Commits | D1 `11d8e6a` · D2 **`1d8cb8a`** · D2b `e807d19` · D2c `f95ceb8` · D3 records `2b8d8d4` · this report |
| Dev servers | `serve-nocache.py 9430` (this tree) and `9431` (a base worktree at `0f952e9a9e`, never pushed: W0, the BEFORE survey, the BEFORE sweep) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (5 game witnesses) · D3 PASS** · one side probe STOPPED (below) |

## The one thing to know first

The "stance loops" were not missing stances. Both are a walk to a stance re-entering its own order with nothing spent
between, and the keylock half is a real game fact: **a bosslock opens only from the row under it**
(`BossLock.update`'s `collideLine`, y = bottom + 1). Every keylock-loop row arrives from the NORTH. So they are not
solvable as staged; they now refuse by the true name, the SHUT state with the save flag named (*"⛔ SEALED BEHIND
ITSELF … The save still holds its flag {L,tag}"*). With the flag cleared, which is the state after the lock was
opened from its own side, the game builds no lock and the same arrival solves. The two chest-loop rows were solvable,
and both SOLVE.

## W0 (at `0f952e9a9e`, base worktree, port 9431)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9431 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`610dccf57c7282807b3bcd47db7db4a7`** |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` · `a569eeec`, all exit 0 (LINEFLIP's six exactly) |
| reference | in the block | *"4 GENERATED MODULE(S)/REGION(S) DIFFER"*: an ENVIRONMENT artefact. `session_bootstrap --seedling` does not initialise `omsi-loops`, `journey-to-ascension`, `cavernous-ii`, `bulletml-dodge`, `textAdventureEngine`; with them initialised (this tree) the base content matches and only this slice's regions differed |
| surface / constants / profile / entities | the four `--check`s | **GREEN 208** · **PASS** (5,327 literals) · **PASS 138** · **PASS 518** |
| roster | `fixtures/tapes/index.json` | **238**, `df76e166414b685b23113394374e9989` |
| bounded vitest BEFORE | 43 files (below) | **2,191 / 2,191 green** |
| tapeRunner | `(fullName, status)` lines, sorted | **533**, md5 **`71bda323e8c6a709fecbfd0734ebf945`** |
| route survey | `survey-seedling-route --through=end` | **221 steps: 138 SOLVED / 80 REFUSED / 3 TIMEOUT** |

The 43 files: the brief's list (`r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`,
`tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `fidelityArrival`,
`fidelityAxe`, `contactFidelity`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`,
`jsRuntimeDeclarations`, `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`), the
pins (`fixtures/tiers`, `rosterCategories`), `tapeRunner`, `solverBot`, and every `grep -a` hit for what this slice
touches (`deriveKeylockStance|keylock|stanceHypothesis|fineLatticeWalks|FINE_LATTICE|MAX_STRATEGIES_PER_GOAL|applied 4
strategies|chestStanceBand|resolveChestStrategy|SEALED BEHIND|surveyFamily|FAMILY_RULES`): `activators`, `chest`,
`fidelityFrontier3`, `fidelityReturn`, `fidelityProximity`, `procgenCountableClock`, `procgenPostSword`,
`procgenSeedlingElementsCertify`, `procgenNestedOpeners`, `procgenPalette`, `procgenCollectPath`, `r5Chain`, `r5Totem`,
`sealCeremony`, `surveyFamily`, `seedlingWasmPlayback`.

⚠ **A measurement hazard I hit and corrected:** my first survey and identity block ran in the primary tree while I
edited `solverBot.js` (from about step 175 on). Both were discarded. Every BEFORE number above comes from the base
worktree.

## D1 — classify every row (PASS)

**The survey at the base** (221 steps, not the brief's 236; see *what the brief got wrong*). The stance families are
two loops, both `unclassified` (*"applied 4 strategies for one goal […] and the corridor still does not plan"*):

| step | level | arrival | refusal (base) | why the stance does not land | the game's truth |
|---|---|---|---|---|---|
| 91 | L46 | (240,448) | `chest(chest@424,40)` ×4 | the chest is on a HALF tile (x 424 = 26.5 tiles); its stance (432,58) is the chest's centre column, which is on no 16 px node; the goal tile's centre is inside the chest, so A\* refuses it; the frontier names the chest again and the walk to its stance re-applies `chest` | solvable: the band under the probe line is open floor (game-witnessed, `stance-l46-chest`) |
| 93 | L48 | (112,288) | `chest(chest@152,184)` ×4 | the same at x 152 (9.5 tiles), stance (160,202) | solvable (`stance-l48-chest`) |
| 50 | L30 | (72,24) | `keylock(bosslock@64,32)` ×4 | arrival NORTH of the lock; the key line is the row under it (y 49); `stanceHypothesis` listed the lock itself, so the far-side stance was "reachable once the lock is discharged" | sealed while `{30,0}` holds |
| 102 | L48 | (16,112) | `keylock(bosslock@48,144)` ×4 | the same, key line y 161 | sealed while `{48,1}` holds (game-witnessed both ways) |
| 135, 176 | L12 | (592,16) | `keylock(bosslock@416,240)` ×4 | the same; the stance (424,264) straddles twin locks `@416`/`@432`, and with the lock itself excluded the twin was still hypothesised | sealed while `{12,4}` holds |
| 155, 186 | L12 | (16,352) | `keylock(bosslock@80,656)` ×4 | the same, key line y 673 | sealed while `{12,3}` holds |

**The brief's other rows, at this base:**

| brief row | measured | state |
|---|---|---|
| `button-stance-unreachable` ×3 (L15/L16) | route steps 17, 18, 25, 26, 36, 37, 74 all SOLVED | not a stance row on the route; the L15 return is RETURN's named seal |
| `swing-stance-unreachable` (L0) | step 1 SOLVED (ARRIVAL's state, as the brief guessed; step 33 is ARRIVAL-INSIDE-SOLID) | not a stance row |
| `chest-stance-loop` L38 ×2 | steps 59, 80, 130 SOLVED (PROXIMITY) | not a row |
| chest L71 | step 159: *"kill work order has no weapon — level 71 tracks NO live spinner bodies"* | KILLLOCK/LADDER's region |
| chest L12 / L12 ×4 | steps 43, 57, 63 TIMEOUT (120 s). Step 63 answers in **850 s** at the base: the combat ladder exhausts on `puncher@416,256` at the keylock stance | LADDER (a slow ladder), not a stance loop |
| L98 chest | step 200: *"the route entered a proximity-hazard — chest at (160,32) … at (167.745,51.257)"* | PROXIMITY's residue 2 (the census volume vs the 1-px probe row); see the STOPPED side probe |
| PROXIMITY's 72/111 (L38 southbound) | not on this base's route (the route is derived; L38 is visited at 59, 80, 130, all northbound) | — |

**The sweep rows** (the JS arc's live engine, `--mode=inv --page-legs=1`, the 46 L8/L15/L16/L71 legs; base 9431 vs
head 9430): 

| leg | level | arrival → goal | before (base, 9431) | state |
|---|---|---|---|---|
| 85 | L8 | (96,176) from L9 → L7 (`stairsup@144,32`), no items | *"no REACHABLE stance inside button@64,48 … none of them plans a corridor from (104,184). A hold that cannot be stood on is not a strategy for this obstacle"* | the throw came from the KILL rung (`deriveCeilingWeapon` → `deriveHoldStance` for the ceiling's presser) and escaped the ladder; the real obstacle is `sandtrap@96,128` on the shove stance's corridor, and the presser is cut off by `pushableblock@96,112` and Water at (120,136). Not budget-bound. Fixed in D2c: LADDER |
| the other 45 | L8, L15, L16, L71 | | 17 done · 10 LADDER · 9 danger-map (arrow lanes) · 4 arrival-inside-solid (L71 from L76) · 4 saved-obstacle EVENT (unresolved by design) · 1 no-corridor (L16 `shove` failed to apply) | no stance row: the brief's 14 "button stance" legs at L15/L16/L71 are not stance refusals at this base |

## D2 — the fixes (PASS, game-witnessed)

1. **`walkTo`'s `STANCE_REENTRY`** (`solverBot.js`). A frontier order with a stance is applied by walking to the
   stance, and that walk has its own frontier. It is a re-entry when that frontier names the SAME order at the same
   tick (`stanceWalks`, keyed `verb(obstacle)#tick`, registered around the stance walk), or when the order's stance IS
   the asking walk's aim under identical plan inputs (no exemption of its own, no axis-aligned approach, no
   teleporter). A `collect-placement` chest goal walks to its own chest's stance, so without the second test the goal,
   the order and the re-entry each ran `runChest` (L48: three records, one opening, +122 t). On a re-entry it asks the
   aim on the 8 px lattice **axis-aligned** (`manhattan` corners, `holdOneAxis`), else refuses *"STANCE_REENTRY — the
   walk to X's `verb` stance (x,y) is itself blocked by X …"*. Axis-aligned because the 8 px nodes (x ≡ 4 mod 8) are
   off a half-tile chest's column too, and a diagonal bang-bang approach to (160,202) cycles at ±1.5 px for the whole
   400-tick budget (vector friction shares one quantum between the axes; measured, replayed tick by tick).
2. **`deriveKeylockStance`**: the lock is excluded from its own hypothesis. A sibling bosslock is hypothesised only
   where its own key line has a direct corridor (`keylockOutOfReach`, memoised per run tick). On the throw path,
   `keyLineBehindLock` asks whether a candidate plans with the lock (and the fewest such siblings) open. If one does,
   the refusal adds *"⛔ SEALED BEHIND ITSELF: the key line is the row y=… under <lock> (`BossLock.update`'s
   `collideLine`, x …), and from (x,y) a corridor reaches the stance (sx,sy) only through the lock itself. The save
   still holds its flag {L,tag}, so the game builds it SOLID: this is the shut state …"*. It also sets an optional
   instance field `sealed` `{wall, presser: null, self: true, with, flag, keyLine, from, stance}`, RETURN's shape. The
   `SolverRefusal` constructor and `obstacle.kind` (`solid`) are unchanged. **For the JS arc:** `sealed.self === true`
   plus `sealed.flag` is the machine-readable "shut state, needs the open state". The solver does not clear the flag
   (⚖ no save clearing); the route is the work order.
3. **`deriveCeilingWeapon` (D2c)**: a ceiling presser with no stance is the KILL rung's refusal, not the solve's. The
   throw used to escape the whole ladder (the sweep's leg 85, L8). It now reads *"kill: the ceiling's presser
   button@64,48 (group t=0, arming [arrowtrap@96,16]) has no stance this run can stand on — …"*, and the ladder
   refuses as LADDER. The throw ended the solve, so nothing that solves passes here, and no route-survey row reaches it
   (before or after).
4. **`surveyFamily.FAMILY_RULES`**: two rows appended (none reordered or reworded): `KEYLOCK-SEALED` (with the flag)
   and `STANCE-REENTRY`.

**Both states, measured on the model** (the survey's staging, the flag cleared by a v3 persistence clear): L48 step
102 with `{48,1}` cleared SOLVES (454 t, into L47); L12 step 135 with `{12,4}` cleared SOLVES (534 t). L12 step 155
with `{12,3}` cleared goes on to the next lock, `bosslock@112,192`, sealed the same way (`{12,11}`).

**Witnesses** (`scripts/procgen/plan-seedling-stance-witness.mjs`, the survey's staging: `r8-solve-11` re-pointed;
`--check` byte-identical). Recorded with `SEEDLING_PORT=9430 check-seedling-bot-differential --record --only=…` on p4f
(headless logic-only). **ALL CHECKS PASSED**, and each tape reads *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"*:

| tape | what | obs | transitions | md5 tape / expectation |
|---|---|---|---|---|
| `stance-l46-chest` | step 91's chest goal, 8 px axis-aligned approach, opened t796 | 1045 | 0 | `a529dd86` / `6f2aa7e2` |
| `stance-l48-chest` | step 93's chest goal, opened t389 | 541 | 0 | `43957a97` / `79f760c5` |
| `stance-l48-keylock-open` | step 102, `{48,1}` cleared: no lock, crosses to L47 | 455 | 1 | `e7b3c216` / `9a21d586` |
| `stance-l48-keylock-south` | CONTROL: the shut lock from its own side; `keylock` lands, opens, crosses to L53 | 370 | 1 | `088c2fc1` / `e367dee0` |
| `stance-l48-keylock-north` | hand keys: east, then **140 ticks** leaning DOWN into the shut lock with key 3; the box rests flush on the lock's top (y 140.63); nothing opens | 201 | 0 | `df6f49a3` / `be919390` |

The north lean is discriminating: 140 > the 60-tick `keyTimer` + the 20-tick fade, so an opened lock would let the
held key carry the box through. The south control shows the same lock does open from its own side. (The first cut
leaned 40 ticks and then rested, which could not tell the two apart; it was re-made and re-recorded.)

**Mutants** (predicted first; copy → edit → `fidelityStance` → restore; `solverBot.js` md5 `0337da9d…` before and
after, verified):

| mutant | predicted | measured |
|---|---|---|
| M1: drop the lock from its own hypothesis exclusion | L48 SHUT row red (STANCE_REENTRY, no `sealed`) | **survived (14/14)**: an EQUIVALENT mutant. The sibling filter drops the lock too: if any of its own candidates had a direct corridor, the derivation would have returned before reading the hypothesis. The explicit exclusion is kept as the readable statement of the rule |
| M2: the re-entry guard off | both chest rows red (the 4-strategy loop); keylock rows unaffected | **2 red** (L46, L48), 12 green ✓ |
| M3: the fine re-entry plan not axis-aligned | L48 red (the stall); L46 solves at a different length | **2 red**: L46 *"the route entered a proximity-hazard — chest at (424,40)"* (a diagonal into the 1-px sliver), L48 818 t ≠ 540 ✓ (shape right, details differ) |
| M4: `sameWalk` off (the in-flight set only) | chest rows red on the record count | **2 red**: 3 `chest` records each ✓ |
| M5: the sibling filter off | the L12 twin-lock row red | **1 red**: `sealed` undefined (STANCE_REENTRY) ✓ |
| M6: the ceiling arm rethrows the stance refusal (D2c; md5 `e5b7323c…` before and after) | the L8 row red | **1 red** ✓ |

**D2b: the generated-level probes.** `procgenPostSword.test.js`'s re-probe rows (in the bounded set by the
`keylock` grep) pinned the old loop text. At D2 they read STANCE_REENTRY (`chest-in-the-gap`; `shieldboss-door` after
its fight) and SEALED BEHIND ITSELF (`key-keylock-pair`). `key-keylock-pair` was **`UNDIAGNOSED`** (*"THE DECIDING
CAUSE IS NOT NAMED"*) since slice-4-era procgen. Its cause is the chest's: a single template's crossing runs
north→south, and both open only from the south. `POST_SWORD_EXCLUDED_TEMPLATES` records the new text and the
diagnosis, with the old record kept and marked BEFORE.

## D3 — census (PASS)

**The route survey, before → after** (`--through=end`; base worktree vs this tree): **138 / 80 / 3 → 140 / 78 / 3.**

| step | level | before | after |
|---|---|---|---|
| 91 | L46 | REFUSED: `chest(chest@424,40)` ×4 | **SOLVED 1528 t** |
| 93 | L48 | REFUSED: `chest(chest@152,184)` ×4 | **SOLVED 1060 t** |
| 50 | L30 | REFUSED (unclassified): `keylock(bosslock@64,32)` ×4 | REFUSED **KEYLOCK-SEALED** `{30,0}` |
| 102 | L48 | REFUSED (unclassified): `keylock(bosslock@48,144)` ×4 | REFUSED **KEYLOCK-SEALED** `{48,1}` |
| 135, 176 | L12 | REFUSED (unclassified): `keylock(bosslock@416,240)` ×4 | REFUSED **KEYLOCK-SEALED** `{12,4}` |
| 155, 186 | L12 | REFUSED (unclassified): `keylock(bosslock@80,656)` ×4 | REFUSED **KEYLOCK-SEALED** `{12,3}` |
| the other 213 | | | verdict, ticks and the first 300 chars of the refusal **identical** |

**The sweep, before → after**: **45 of 46 legs identical** (end and refusal text); 17 done before and after. **Leg 85**: *"no REACHABLE stance inside
button@64,48 …"* → *"… -> shove stance (pushableblock@96,112): the combat ladder is EXHAUSTED … enemy:sandtrap@96,128 …
kill: the ceiling's presser button@64,48 (group t=0, arming [arrowtrap@96,16]) has no stance …"* (LADDER). The node
oracle agrees (`canCross` L8 from L9, `fidelityStance`'s row).

## The JS arc's pins and what it must wire

- No contract changed: `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched,
  and `obstacle.kind` stays `solid`.
- New optional field: `SolverRefusal.sealed` with `self: true` (plus `with`, `flag`, `keyLine`, `from`, `stance`).
  This is RETURN's field, which the JS arc already reads; `self: true` and `flag` distinguish "the lock's own key
  line is behind it" from RETURN's "the presser is behind its lock". Suggested wiring: a refusal carrying
  `sealed.self && sealed.flag` is the SHUT state of a one-sided lock. The walker/route should reach the lock from
  its own side (or arrive with the flag cleared). It is not a solver budget problem.
- `fineLatticeWalks` gains rows whose `refused` starts `STANCE_REENTRY` (diagnostic; already an optional output).
- JS-arc pins that move: none measured. `seedlingWasmPlayback.test.js` (in the bounded set) is green.

## Deltas

| row | W0 | head |
|---|---|---|
| identity block | `610dccf5…` (reference row: environment) | **`1c495d2ff80d04d7473939f4d4c9d92c`** at `f95ceb8` (SEEDLING_PORT=9430, the 5 game submodules initialised); its reference row read 2 DIFFER (the docs index's word counts, before the records regen); at `2b8d8d4` ALL MATCH. An earlier AFTER block at `1d8cb8a`/`e807d19` (`074dd06e…`) gave the same rows |
| six `--check`s | as above | **unchanged**, all exit 0 |
| census rows | | all identical except **`level post-sword s1` `c4841acb…` → `fb1a59e5…`**, attributed: the ONLY output difference is line 36, the printed `cause` of `key-keylock-pair` (D2b's diagnosis text). The generated level's bytes are identical |
| reference | 4 DIFFER (environment) | **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH** (regenerated: docs index, catalogue's `wouldNeed`, instruments + the new producer) |
| surface / constants / profile / entities | 208 / PASS / 138 / 518 | **GREEN 208** after `--write` (site-count drift only; `--write` again identical) / PASS / 138 / 518 |
| roster | 238 | **243**, index md5 `2eb1ca08698cf6143aec9f24793c3de4` |
| tapeRunner | 533, `71bda323…` | **543**, `fc6af1ba022a9786742664d4a0b5b123`; the 533 old pairs are identical (diff adds 10 lines only) |
| bounded vitest | 2,191 / 2,191 (43 files) | **2,222 / 2,223** (44 files: the 43 + `fidelityStance`, 15 rows). The one red is `rosterCategories` (*"expected 178 to be 183"*, by design: BANK). At D2, before D2b, `procgenPostSword` showed 3 red (the old loop text), fixed in D2b |
| survey | 138 / 80 / 3 | **140 / 78 / 3** |

## What the brief got wrong (measured)

1. **"236 steps, 128 SOLVED / 96 REFUSED / 12 TIMEOUT"**: at the wave-7 base the route is **221** steps, 138 / 80 / 3.
   The route is derived, so it moves with the rules arc and the waves.
2. **"`keylock-stance-loop` ×6 (L12 ×4, L30, L48)"**: ×6 is right (50, 102, 135, 155, 176, 186). They are not
   stances that "never land". They are far-side arrivals at one-sided locks, unsolvable as staged, now named.
3. **"`chest-stance-loop` ×5 (L38 ×2, L46, L48, L71)"**: **×2** at this base (L46, L48). L38's rows SOLVE (PROXIMITY);
   L71's chest row is the spinner kill.
4. **"`button-stance-unreachable` ×3 (L15/L16)"** and **"`swing-stance-unreachable` ×1 (L0)"**: no such rows at this
   base. Every L15/L16 step and step 1 (L0) SOLVE.
5. **"L12 ×4"** includes three TIMEOUTs (43, 57, 63) that are the combat ladder on L12's puncher (step 63: 850 s at the
   base), not stance loops.
6. **`solverBot.js` ~:13650 "the keylock stance never lands"**: no such sentence exists in the file. The loop's
   sentence is `walkTo`'s `MAX_STRATEGIES_PER_GOAL` refusal (~:14170 at the base).
7. **The docs the brief pointed to**: `seedling-bot.md` said `FINE_LATTICE_ROSTER_WIDE` was "off"; it is `true`
   since the wave-6 harvest (corrected in the records commit).
8. **The sweep: "no REACHABLE stance inside button@N,N" 14 legs (L15, L16, L71)**: at this base the live engine gives
   **none** of those. Of the 46 L8/L15/L16/L71 legs the only stance refusal is leg 85 (L8). **"L8's button stance
   (budget-bound)"** is not budget-bound: it is the kill rung's stance throw escaping the ladder (D2c).

## Residue

1. **L98's chest (step 200), the census volume vs the probe row** (PROXIMITY's residue 2). ⛔ **STOPPED side probe,
   not landed:** exempting the target chest's own volume on its stance walk does complete step 200's chest goal. The
   step then refuses at its exit: *"kill: the kill work order has no weapon — level 98 tracks NO live spinner
   bodies"*. PROXIMITY measured that the exit's kill-lock needs the turret dead, which is KILLLOCK's region. With that exemption ON, though,
   `plan-seedling-proximity-witness --check` DRIFTS on **`prox-l38-chest`** and `stance-l46-chest`'s plan STALLS
   (400 ticks at (432.23,59.93)). It is wrong as a PLANNER input, not just a mover, so it was not committed even
   behind a flag. The narrower fix is a `line` volume in the drive's watch only (the integer row `y + 17`, x +2..+12),
   leaving the planner's rect alone. That one needs its own mover measurement.
2. **L12's slow ladder** (steps 43, 57, 63; 850 s for 63): the combat ladder at a keylock stance next to
   `puncher@416,256`. LADDER2/KILLLOCK's region.
3. **The SHUT-state rows are route work**, not solver work: the route survey's staged boots carry no "opened from its
   own side" flag. Steps 50/102/135/155/176/186 solve exactly when the route arrives with the lock's flag cleared.
4. `rosterCategories.test.js` is **red by design** (*"expected 178 to be 183"*): the composite standing value is
   owed +5 for the five `stance-*` tapes. `standing-values --write` is not licensed here.

## Byte-inertia

- No committed tape or expectation moved; no producer `--check` digest moved (six unchanged, exit 0).
- The survey's 213 untouched steps are identical (verdict, ticks, refusal text).
- tapeRunner: the 533 old pairs identical.
- Why it is inert by construction: the re-entry guard fires only where the old code would re-apply the same order at
  the same tick with nothing spent, and that path always ended in the 4-strategy refusal. The keylock exclusion
  changes only hypothesis contents, and no committed trace discharges an activator in a stance hypothesis (the
  committed traces' only hypothesis entries are two pushables, `grep -a`).
- One identity census row moved by TEXT only (above).

## Rows to BANK

- Roster **243** (`stance-l46-chest`, `stance-l48-chest`, `stance-l48-keylock-open`, `stance-l48-keylock-south`,
  `stance-l48-keylock-north`); pins by NAME in `tapeEnvelope`, `observationTolerance` (incl. `swapped` 243),
  `dialogueAutoAdvance` (243 / 242), the tape index; `tapeIndexManifest` follows the index.
- **`R8_ENEMY_BRIDGE`**: `stance-l48-keylock-south` declared (ends on L53's arrival, one puncher, 369 t, no hit, no
  kill); exposed **62 → 63**; the test's three mirrors and the synthetic bridged set (+L53).
- The identity row `level post-sword s1` → `fb1a59e5…` (text only, attributed).
- `rosterCategories`' composite standing value +5 (`standing-values --write`, the coordinator's).
- Survey `--through=end`: 140 / 78 / 3.
- New producer `plan-seedling-stance-witness --check` (ALL green, byte-identical).
- No new box-taking instrument: the producer plays nothing (model only); the recording used
  `check-seedling-bot-differential`, and the sweep its own `takeBoxLockOrExit`.

## Trap candidates (also in the log entry)

- **A hypothesis may not contain the thing it is a hypothesis for.**
- **A re-entry with nothing spent is not a retry.**
- **A one-sided trigger is two states, not one.**
- (Process) **A long measurement in the tree you are editing measures your edits.** The first survey and identity
  block ran in the primary tree while `solverBot.js` changed under them. Run BEFORE in a pinned worktree.

## Not done

No AS3, wasm, gitlink or rules edit. No `standing-values --write`, no `pytest`, no unfiltered vitest, no `git stash`.
Mutants were copy → edit → run → copy back, md5-checked. Scratch (`/tmp/claude-0/stance/`, not committed): survey
JSONs and logs, identity logs, vitest JSONs, tapeRunner pair lists, the probes (`probe.mjs`, `map.mjs`, `scan.mjs`),
the recording logs.
