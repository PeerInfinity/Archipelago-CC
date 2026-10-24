# Seedling HAMMER-PHASE — slice C3: the L98 → L99 iceturret kill ("no side is reachable")

Slice `seedling-hammer-c3` (Opus, cloud), planner `seedling-hammer-phase-planning`. One new switch, **OFF**, and OFF is
byte-inert: `solverBot.ICE_TURRET_SPEAR_ARM`.

| | |
|---|---|
| Start SHA | **`8f8eb2f760`** (= `origin/main` at the fetch; the brief's floor) |
| Head | the commit carrying this report. D1 `19eefae`, D2 `d655609` + `eb07e1a` (spear first), D4 `40e94e6` |
| Branch | `claude/seedling-hammer-c3-ft4ba6` (the harness names it; the brief's `seedling-hammer-c3`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9574` (`SEEDLING_PORT=9574`), PID 673, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (a modelling gap in the kill arm: the weapon) · D2 PASS (game-witnessed, OFF) · D3 PASS, no mover · D4 PASS** |

## The one thing to know first

**The kill rung was the right rung with the wrong weapon.** Every sword side of `iceturret@104,24` lies inside, or is
reached only between, the two spinning axes whose hubs sit on its bottom corners. `Player.spear()` has no
`collideLine("Solid")` gate (`slash()` has one), so its 32x5 thrust reaches the turret **through the wall** from the
pockets beside it, clear of both axes.

With `ICE_TURRET_SPEAR_ARM` ON, the arrival from L93 (leg 745) SOLVES:
- unbudgeted, 693 t;
- inside the page's 2,560 retry, 853 t;
- the game crosses it to L99 at 0 px with 0 hits.

The arrival from L99 (leg 748) refuses BY NAME in 601 units, not on the budget. There the turret comes first, while
`jellyfish@56,48` is alive beside the stance, and the thrust's repeat hits are unmodelled (fidelity's).

**No committed artifact moves ON or OFF.**

## W0 — the base and the reproduction (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-c3-ft4ba6 origin/main` | `8f8eb2f760`, `merge-base --is-ancestor 8f8eb2f760 origin/main` yes |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. `bulletml-dodge` was `-` → `git submodule update --init` → `7423ee86`. The other four non-wasm submodules (cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine) were also `-`; initialised so the reference row can match (solvecost's finding) |
| identity block | `SEEDLING_PORT=9574 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`3a48647f548c821267c3e60cf0ddc496`**. maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, level pre/post `e28c1e5d`/`fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted | **605**, `ec857f0ad361491f4a7735994b2322ab` |
| surface / constants / entities / profile | each `--check` | GREEN **265** · PASS **5,623** · PASS 535 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **274** |
| bounded vitest BEFORE | 35 files: every non-slow test naming `KILL_ARM_POLICY`, `chooseBodyToRemove`, `iceturret`/`IceTurret`, `STATIC_SWORD_ARM` or `CHOOSER_HIT_SOURCES` (`grep -a -l`), + `solverBot*.test.js`, + `tapeRunner` | **2124 / 2124** (36 files) |

**The reproduction, word for word.** The node leg staging is the solvecost shape, rebuilt as scratch:
- the arrival through `createJsRuntime` with the leg's AP inventory queued as the game's properties in acquisition
  order (13 items: sword, dark sword, shield, dark shield, fire, wand, conch, feather, spear, dark suit, torch,
  `hitsMax` 4);
- keys 0–4 through `Main.hasKeySet`;
- slots `[0,1,3,2]` through `stageItems`;
- `arrivalSolverGoal` → `arrivalSolveRequest` → `solveAnytime`.

The other-level persistence flags are not staged; none is L98's. Leg list: `seedling-divergence-legs.mjs` (843 legs).

| leg | key | budget 640 / 2560 | unbudgeted |
|---|---|---|---|
| 745 | `level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112`, arrival (112,176) | 643 then 2,563 units (deadline `kill-chaser`, then `axe-dodge`) = solvecost's | dashless 12,462 + full 19,097 = **31,559** units, REFUSED, perTick 356 (the jellyfish are killed first) |
| 748 | `level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112`, arrival (96,112) | 643 then 2,563 (`axe-dodge`) | 12,365 + 12,365 = **24,730**, REFUSED at t0 (the turret is in range, so K4 kills it first) |

⚠ The brief pairs the arrivals the other way round. By the leg list, 745 is from L93 at (112,176) and 748 is from L99 at
(96,112). Solvecost's units (31,559 from (112,176), 24,730 from (96,112)) agree with this table.

- **Refusal text (both):** *"… reach-exit (112,112)->L99 -> kill: no side of iceturret@104,24 is reachable — down: … ->
  kill -> iceturret@104,24 stance (down): the combat ladder is EXHAUSTED. The corridor passes through danger at
  (119.7,59.7) [748; (120.3,63.0) for 745] — hazard:spinningaxe@96,64 (a SpinningAxe's 32 px blade on its update 97 …)"*.
- **`trace.obstacle`:** `{kind: 'kill-lock', id: 'lock@112,112'}`. The side walk's own refusal (instrumented in a
  scratch copy) is `{kind: 'danger', id: 'spinningaxe@96,64', sources: ['hazard:spinningaxe@96,64']}`.
- **The bodies:** the kill-lock count is `[jellyfish@56,48, jellyfish@176,72, jellyfish@72,104, iceturret@104,24]`. The
  climb's BAIT line names the live roster `[jellyfish@56,48, jellyfish@176,72, jellyfish@72,104]`, and its KILL line
  says *"the danger on this corridor is [hazard:spinningaxe@96,64] … not a body this run can watch die"*.
- **Which arms were asked:**
  - the kill-lock rung's chaser arm (`execKillByChaser`), with K4's in-range pre-pass for 748;
  - `killIceTurretInPlace`;
  - inside its one surviving side walk (down): avoid, dodge (1,478 previews), detour, time, bait, kill.

## D1 — diagnosis (PASS)

### 1. What the iceturret is, in the model and in the game

- **Class:** `IceTurret` (`Enemies/IceTurret.as`), `combat.ENEMY_CLASSES.iceturret`. A 32x32 box at
  (104,24)–(136,56). Its centre (120,40) sits on Water.
- **What hurts the player:**
  - While alive it is `type "Enemy"`, **not Solid**: `type = "Solid"` is only in the "dead" branch. Its contact is
    `Enemy.hitPlayer`, force 3.
  - Within 128 px it turns and fires three `IceTurretBlast`s per volley, which freeze the player. They die on walls.
- **How it dies:**
  - `hitsMax` 3, `knockback` empty.
  - The sword: 1 per hit, behind `slash()`'s distance and `collideLine("Solid")` gate.
  - **The spear: `spearDamage` 2, the 32x5 rect only, no distance and no line gate (`Player.as:954-990`).**
  - Fire: nothing (`hitByFire || t != "Fire"`).
  - `death()` turns the first `destroy` into a corpse, which drowns on Water/Lava/Pit and is then removed.
    `classCount` drops only at the removal.
- **The game witness** `c3-d1-l98-spear-west`, hand-built by `probe-seedling-iceturret-spear.mjs`:
  - the setup: the KILLLOCK turret witness's staging (survey step 200) booted at (68,32), so the player stands at
    (76,40) in the west pocket; the spear selected at t0; thrusts east at t2 and t33; 60 ticks;
  - the run: p4f headless, 273 samples;
  - **the player is equal at 0 px over 61 observations**;
  - **the turret's hits/i-frame are equal on all 108 (tick, class) rows**. Landings: t4 (hits 2) and t35 (hits 4).
    "dead" on t36; the corpse is removed on t47 on both sides.

  The one disagreement is not the turret's. `jellyfish@56,48` reaches the pocket, and the second thrust's REPEAT hit
  lands on it in the game at t39. The game reads hits 1 → 3, "die"; the model reads 1/19. The jellyfish is inside its
  i-frame, but an earlier dark-shield bump had latched `hitByDarkStuff`.

  `presses.SPEAR_HIT_TICKS_UNMODELLED` already names the gap: the thrust repeats at T+1/T+3/T+5 and the model carries
  one landing. On the turret the repeats are inert: a spear landing clears the latch, and the 30-tick i-frame holds them
  off (game-measured above). **Handed to fidelity.**

  **The game's own way past:** stand in a side pocket, outside the axes, and spear the turret through the wall.

### 2. Why no side reaches

The sides are the class's own geometry: the live 32x32 box ± `ICE_TURRET_STANCE_MARGIN` 3. They are not `Turret`'s.
The two axes' hubs are (104,72) and (136,72), with a 32 px blade (+1, and the 12x12 hub rect).

| side | stance | filter that refused it |
|---|---|---|
| up | (120,61) | the axe-disc filter (centre ≤ 36 px): 19.4 px from both hubs |
| left | (141,40) | the axe-disc filter: 32.4 px from (136,72) |
| right | (99,40) | the axe-disc filter: 32.4 px from (104,72) |
| down | (120,18) | passes the filters (56.3 px). Its walk refuses at plan time: the corridor runs between the two blades, and every rung of the ladder exhausts (avoid: the A* goal tile (7,1) is not walkable (`danger:iceturret@104,24`); dodge: no stall in one revolution, 1,478 previews; detour: 60/60 previews spent; time: the aim is 103 px away; bait: no live body's removal admits a corridor; kill: the axe is not a body) |

So it is no wall and no pit. Three sides sit in the blades' reach, and the fourth (the water pocket above) is reachable
only between them.

### 3. Is the iceturret on the corridor because the chooser put it there?

**No.** The turret is in the kill work order because `lock@112,112` (`tset -1`) counts it: the obstacle is
`kill-lock`. The side walk's probe hit names the axe alone (`sources: ['hazard:spinningaxe@96,64']`). C1's
`hitSourceBodies` would admit only a spinner, or a static `SandTrap`/`Turret` in a stepped room, so the chooser's list
holds no iceturret either way. `chooseBodyToRemove`'s admission rules are not involved; nothing was changed there.

## D2 — `ICE_TURRET_SPEAR_ARM` (OFF) (PASS)

- **The switch:** `solverBot.ICE_TURRET_SPEAR_ARM.enabled = env.SEEDLING_ICE_TURRET_SPEAR_ARM === '1'`, plus
  `withIceTurretSpearArm(enabled, fn)` (`withStaticSwordArm`'s shape). OFF, `killIceTurretInPlace` never calls the arm.
- **Asked first, ON** (`eb07e1a`): `killIceTurretBySpear` runs before the sword sides. An arm that answers `why` has
  spent no tick, and the sword sides run exactly as OFF. Its `why` is appended to their refusal.
  - First cut: the spear after the sword sides (`d655609`). Measured ON, both legs stayed budget-bound on the page,
    because the down-side walk spends 12,365–12,462 units exhausting the axe ladder before the spear is asked.
  - Spear first, 745 needs 1,344 + 1,572 units.
- **Stance, all four must hold** (nearest first, at most 4 walks):
  1. a walkable tile's centre ±4 px, whose `spearRect(x, y, dir)` overlaps the live box;
  2. the box is off the body, and its nearest point is more than 33 + 2 px from every axe hub (`boxGapFrom`,
     `axeCanReach`'s measure, plus the facing tap's drift room);
  3. it lies inside `axeFreeFlood`: a 2 px, 4-neighbour flood from the player over points whose box is plannable and
     clear of every axe's reach;
  4. `planWaypoints` reaches it.
- **Why the flood (each step measured):**
  1. The sword sides' centre test admits the 8 px channels beside the turret. Leg 745's walk stalled 400 ticks against
     the channel's wall.
  2. A planner screen with the axes' reach as `extraVolumes` (strips) found nothing. The one tile into the west pocket,
     (4,3), has its centre 32.7 px from a hub, though a box off that centre passes. That is the game witness's path.
  3. Ranking by the planned waypoints' distance from the hubs failed too: the smoothed waypoints cut straight lines
     across the room.
- **The executor** (the sword sides'):
  - `ctx.walkTo` with the turret's proximity braved;
  - `ctx.equip(spear slot)`;
  - per thrust: drift back, one facing tap, a check that the thrust still overlaps, then one press, waiting out
    `KILL_PRESS_CADENCE`;
  - `dead` and then `removed` observed (`ICE_TURRET_PRESS_BOUND` / `ICE_TURRET_DROWN_BOUND`);
  - `ctx.equip(prior)`.
- **Refusals by name:** a player hit, a crossing, and **a live chaser that could walk into the thrust's rect by its
  last repeat** (`spearRepeatReaches`: the body's box grown by `speed × 6`). The last is the D1 divergence, guarded
  rather than modelled. `SPEAR_HIT_TICKS_UNMODELLED` is now exported through `solverView`.
- **Game-witnessed:** `c3-l98-spear-l93`, authored by `probe-seedling-iceturret-spear.mjs` (`twoPassSolve`, the
  authoring scripts' path):
  - the setup: the same KILLLOCK staging re-pointed at leg 745's arrival (112,176), `hits_max` 4, solved ON;
  - the plan: the chaser arm kills `jellyfish@72,104`, `@56,48` and `@176,72` (gone t222/278/330); the spear arm kills
    the turret from the west pocket (spear at t454, landings t458/t489, "dead" t490, gone t501, sword back at t501);
    the lock; L99 at t693;
  - **on p4f: player 0 px over 694 observations, 831 body rows equal (jellyfish included), every removal on the
    model's tick, the game ends in L99 with `hits 0`, and the model's replay has 0 hits too;**
  - `--check` re-derives the tape byte for byte and asserts that OFF refuses with the sweep's words.
- `fidelityIceTurretSpear.test.js` holds 7 rows: D1's three (the turret tick for tick, and the jellyfish disagreement
  pinned at t39), and D2's four (ships OFF, the game witness, the model replay, and OFF refuses / ON re-derives, with an
  explicit 600 s timeout).

## D3 — ON, measured; STOP at the movers (PASS, **no mover**)

Command: `SEEDLING_ICE_TURRET_SPEAR_ARM=1 …` for every row. The sweep legs were run with the scratch leg runner above.

| row | OFF | ON |
|---|---|---|
| leg 745 (112,176), unbudgeted | REFUSED, 12,462 + 19,097 | **SOLVED 693 t** (full pass; dashless 853 t), 1,344 + 1,572 units |
| leg 745, budget 640 then 2,560 (the page's) | budget, budget | budget (642, `kill-chaser`), then **SOLVED 853 t** (dashless, 1,344 units; the full pass cut at 1,218, `kill-chaser`) |
| leg 748 (96,112), unbudgeted | REFUSED, 12,365 + 12,365 | REFUSED by name in 601 + 135 units. Full pass: the repeat guard (*"jellyfish@56,48 could walk into the thrust's rect during its repeats …"*). Dashless pass: the turret is speared, then `jellyfish@176,72` is pinned on a wall (*"a chaser does not path-find"*), which is the chaser arm's |
| leg 748, budget 640 / 2,560 | budget, budget | refused by name at both (601 units; at 640 the full pass is cut at `sword-dash`, 41) |
| identity block (`SEEDLING_PORT=9574`) | `3a48647f…` | every row equal to OFF, ENEMY `afdc6d1a` and the six `--check`s included (**r9-campaign `712f0ead` exit 0: `r9-solve-16`, the control, unmoved**). The reference row read 2 DIFFER only because this slice's surface/docs records were not yet regenerated (ON md5 `806ac6a3`) |
| bounded vitest (W0's 36 + `fidelityIceTurretSpear`) | 2124/2124 | **2131/2131** |
| tapeRunner pairs | 605 `ec857f0a` | 605 `ec857f0a` |
| committed tapes / census rows with an IceTurret (`grep -a -il iceturret`) | — | none can move. The roster tapes that hold one (`r4-iceturret-bobs`, `r5-l40-part5`(-control), `prox-l40-turret-contact`, `-volley`) are L40 replays, and a replay asks no solver. The KILLLOCK witnesses are replays. Only L98's turret is lock-counted (L40 has no lock), and no committed producer solves L98 |

**Movers: none.** There is nothing to re-record, so the flip touches no committed artifact. It changes the two L98 legs'
live verdicts (above) and nothing else measured.

**CI.** `seedling-divergence-sweep.yml` dispatch from this session: **403 Resource not accessible by integration**,
again. The planner should dispatch it on this branch at the default (OFF):
- inputs: `-f mode=inv -f producer=solver -f shards=1`
- `-f keys="level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112|level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112"`
- expect sweep-4's verdicts (budget) on both: OFF is inert.

⚠ **The page cannot run ON.** The worker sees no `process`, so the switch reads OFF there, and the sweep has no input
for it (`contact_fidelity` sets only `CONTACT_FIDELITY`). For a page A/B, the JS arc would wire a request stamp in
`solveAnytime`'s KILLLOCK-hook shape. Until then the node table above is the ON measurement.

## D4 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase C3 — the L98 iceturret* (after hammer D1's section).
- `seedling-bot.md`: a paragraph after C1's.
- Surface `--write` then `--check`: GREEN **266**, with `SPEAR_HIT_TICKS_UNMODELLED` classified (`seedling`,
  `constant`) and line/site counts re-recorded.
- Constants `--write` then `--check`: PASS **5,623**, unmoved.
- Entities 535 / profile 138 PASS.
- `generate-procgen-reference.mjs` regenerated (the instruments roster and the docs index; `README.md` /
  `architecture.md` count lines), then `--check`: ALL 7 + 5 MATCH.
- `scripts/quicklaunch/generate-docs-index.mjs`: no change.
- The probe imports `playwright` statically (the KILLLOCK probe's shape), so the instrument roster classes it as a
  browser driver. `boxLock.test.js` names it among the conditional takers: it takes the box only under `--record`.
  Both boxLock rows went red in the first AFTER run until this was done.
- `check-procgen-help.mjs`: the new probe PASSes HELP and IMPORT. The run reads 26 failed elsewhere; C1 counted 25
  pre-existing at its base, and none is this slice's file.
- **No roster enrolment.** The two witnesses sit beside their game samples (`fixtures/iceturret-spear-witness/`), in
  the KILLLOCK/C1 shape. So no roster-count pin moves (roster **274**), and there is no `rosterCategories` row to name.
- **Bounded vitest AFTER** (46 files): W0's 36, `fidelityIceTurretSpear`, `boxLock`, `seedlingConstantsCensus`,
  `seedlingSolverSurface`, `procgenDocs/{generated,docLinks,docsRender}`, `quickLaunch/generated`, and every non-slow
  test naming `spearRect`/`PushableBlockSpear`. `entityBlocks` and the four roster-count pin files are in W0's set.
  Result: **2439 / 2439**; tapeRunner 605 `ec857f0a`.
- **Identity block AFTER** (OFF): see *Deltas*.

## Deltas (base → head, switch OFF)

| | before | after |
|---|---|---|
| identity block | `3a48647f…` | **`3a48647f548c821267c3e60cf0ddc496`, IDENTICAL row for row** (at `40e94e6`, reference ALL 7 + 5 MATCH) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 | identical |
| the two legs (node, OFF) | the words and units above | identical (12,462/19,097; 12,365/12,365) |
| surface | GREEN 265 | GREEN 266 (+1 import) |
| constants / entities / profile | 5,623 / 535 / 138 | unchanged |
| bounded vitest | 2124/2124 (36 files) | 2439/2439 (46 files) |
| tapeRunner pairs | 605 `ec857f0a` | 605 `ec857f0a` |
| roster | 274 | 274 |

New:
- `solverBot.ICE_TURRET_SPEAR_ARM`, `withIceTurretSpearArm`, `killIceTurretBySpear`, `axeFreeFlood`,
  `spearRepeatReaches`;
- `scripts/procgen/probe-seedling-iceturret-spear.mjs`;
- `fixtures/iceturret-spear-witness/` (2 witnesses, with their game samples);
- `fidelityIceTurretSpear.test.js` (7 rows).

## What the brief got wrong (measured)

1. **The leg ↔ arrival pairing is swapped.** 748 is `in_L99` at (96,112); 745 is `in_L93` at (112,176).
2. *"If the cause is the chooser … STOP"*: it is not the chooser. The turret is the kill-LOCK's count, and the probe's
   hit is the axe alone.
3. *"Is the side geometry the class's real one, or a default borrowed from Turret?"*: it is the IceTurret's own (the
   32x32 box). The gap was the **weapon**, not the geometry: the arm knew only the sword.
4. *"Game-witnessed: … the game's hits equal to the model's"* holds for the turret. The D1 hand witness shows a
   model gap on a CHASER (the spear's repeat hits, `SPEAR_HIT_TICKS_UNMODELLED`), which belongs to fidelity.
5. **A fix that keeps the existing arm first does not move the page.** The first cut was correct and witnessed, and
   left both legs budget-bound.
6. The bootstrap's `READY` leaves five submodules uninitialised (solvecost's finding, again).

## Residue

- **For fidelity:**
  - the spear's repeat hits (`SPEAR_HIT_TICKS_UNMODELLED`) against a `hitByDarkStuff`-latched chaser. The game
    witness is `c3-d1-l98-spear-west` t39 (the game: hits 3, "die"; the model: 1/19). The arm guards it by name, and a
    slice that models the repeats turns `fidelityIceTurretSpear`'s jellyfish row red by design;
  - with that modelled, 748's guard can be relaxed.
- **For the chaser arm (KILLLOCK K3, not this slice's):** from (96,112) the turret goes first. Afterwards the dashless
  pass's `jellyfish@176,72` pins itself on a wall from the west pocket, the shape of L60's east arrivals.
- **For the JS arc:** a page/worker setter for `ICE_TURRET_SPEAR_ARM` (the KILLLOCK request-stamp pattern) if the
  planner wants the sweep to A/B it.
- **The user's call:** flipping the default. There are no committed movers; the live changes are the two L98 legs
  above.
- **Standing rows for fidelity to bank:**
  - surface GREEN 266 at `40e94e6`;
  - constants 5,623 (unchanged);
  - the identity block unchanged OFF and ON (bar the reference row's regeneration);
  - new tests: `fidelityIceTurretSpear.test.js` (7);
  - the new switch `solverBot.ICE_TURRET_SPEAR_ARM` (OFF).
- Scratch, not committed: the leg runner (`leg.mjs`), the solve drivers (`on.mjs`, `raw.mjs`), the lab copy of
  `frontend/`, the identity logs and the vitest JSONs.
- CI at the head: owed (`node scripts/procgen/ci-vitest-summary.mjs <head>`). The suite number is CI's (⚖ 52).
