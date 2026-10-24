# Seedling HAMMER-PHASE — slice C4: L74's kill rung aims at the bulb, the corridor's hit is the lavarunner

Slice `seedling-hammer-c4` (Opus, cloud), planner `seedling-hammer-phase-planning`. **Measure only: no code changed, no
switch added.** D1 shows that the leg's wall is not the chooser, so D2 is a STOP with a hand-over to fidelity.

| | |
|---|---|
| Start SHA | **`bdb10bb12f`** (`bdb10bb12f1ce12e80031be1a3f2d07211192482` = `origin/main` at the fetch, the brief's floor) |
| Head | the commit carrying this report (D1 evidence `8b977d2`, D4 records `6c04d8c`) |
| Branch | `claude/seedling-hammer-c4-j9alfp` (the harness names it; the brief's `seedling-hammer-c4`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9576` (`SEEDLING_PORT=9576`), PID 828, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (four answers, measured; the game witnesses the decisive one) · D2 STOP (the fix is the chaser arm's strike gate, fidelity's) · D3 not run: no switch, so there is no ON (D1.4's controls stand in) · D4 PASS** |

## The one thing to know first

**Re-aiming the chooser would not solve leg 624.** The kill rung would need to kill `lavarunner@208,96` first, and the
chaser arm refuses every stance for it. The game agrees: the arm's best stance, (264,120), played on p4f, is hit at
t87.

The same tape with the sword press moved from t88 to **t84 or t85** kills the lavarunner at t87 **with no hit**, on the
game and in the model (0 px). The press goes in while the body's i-frame still reads 3–4, and its hit tests
(T+1…T+5) land as the i-frame lapses. `strikePolicy`'s `hitsTimer > 0` gate refuses exactly that press. The gate
belongs to the chaser arm's weapon (fidelity's), not to `chooseBodyToRemove`.

Behind that is a second wall. With a lab gate that anticipates, the solve dies on a model refusal: L74 is rebuilt with
fallrock tag 2 cleared.

## W0 — the base and the reproduction (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-c4-j9alfp origin/main` | `bdb10bb12f`, = `origin/main` |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five non-wasm submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine); `git submodule update --init` on each (C3's finding, again) |
| identity block | `SEEDLING_PORT=9576 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`3a48647f548c821267c3e60cf0ddc496`**, C3's base row for row: maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK, reference ALL 7 + 5 MATCH (`…-evidence/identity-base.txt`) |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| tapeRunner pairs | inside the bounded run; `status\tfullName` sorted, `sort \| md5sum` | **611**, `86af85259c2ab3a51b1f0ebb409743f4` |
| surface / constants / entities / profile | each `--check` | GREEN **269** · PASS **5,684** · PASS 535 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE | 18 files: every non-slow test naming `chooseBodyToRemove`, `CHOOSER_HIT_SOURCES`, `hitSourceBodies`, `withChooserHitSources` or `KILL_ARM_POLICY` (`rg -a -l`), `solverBot*.test.js`, plus `tapeRunner` | **1,367 / 1,367** |

**The reproduction.** Leg list from `seedling-divergence-legs.mjs` (843 legs; ids = LEASH's). The node arrival path is
LEASH's `drivers/leg.mjs` (`createJsRuntime` arrival → `arrivalSolverGoal` → `arrivalSolveRequest` → the in-place
produce service, `ANYTIME_PASSES`), with the sweep row's own `items`/`slots`
(`seedling-fidelity-leash-evidence/sweep-base-solver.jsonl`) and `BUDGET=2560`, the page's retry.

- **The refusal** (both passes): *"reach-exit (16,144)->L75: the combat ladder is EXHAUSTED. The corridor passes
  through danger at (232.2,119.6) — chaser:lavarunner@208,96 (inside leash 80 (d=9.3), …)"*. avoid: different connected
  components with 3 volumes; time: aim 272 px away; bait: *"0 cell(s) in leash"* for `bulb@48,112`; kill: no presser
  covers the bulb, and the chaser arm finds *"20 of THOSE refused by the forecast [(104,56): the APPROACH is dangerous at
  tick 87 — chaser:lavarunner@208,96 …]"*; detour: 246 previews.
- ⚠ **Word for word against the page, it differs in two counts**: the chaser arm's 21 → 20 reachable cells, and detour
  251 → 246 previews. LEASH's page row was taken at `dd6ae2e379`, before `baitForecast` flipped ON, so the bases
  differ. The text is otherwise the page's, and unbudgeted it is the same (12.6 s).
- **`trace.obstacle`**: `{kind:'danger', id:'lavarunner@208,96', sources:['chaser:lavarunner@208,96']}`.
- **The chooser's list**, from a lab copy instrumented at `chooseBodyToRemove` (`drivers/lab-instrumentation.diff`;
  the lab's refusal is byte-identical to the tree's). Aim (24,152), volumes `[lavarunner@24,56, bulb@48,112,
  lavarunner@208,96]`:

  | body | "removal admits a corridor" |
  |---|---|
  | `bulb@48,112` | **yes** |
  | `lavarunner@24,56` | no |
  | `lavarunner@208,96` | no |

  `removable = [bulb@48,112]`. `hitSourceBodies` adds nothing (a chaser is never admitted), so BAIT and KILL read the
  bulb.
- **Arms asked**: avoid, time, bait (`deriveBaitStance` on the bulb), kill (the ceiling, then the chaser arm
  `deriveKillByChaser` on `interceptOrder([bulb], hit)[0]` = the bulb), detour.

## D1 — diagnosis (PASS)

### 1. Why the chooser lists the bulb

Its test is `plansReach` over the room's **t0 danger volumes** with the candidate's volume removed: a static
question, with bodies frozen where they stand. With the bulb's volume gone, a tile path reaches the aim.

**That corridor does not clear the lavarunner.** In the lab, the corridor admitted without the bulb was planned
(`planWaypoints`, the same opts) and probed with the walk's own instrument (`probeCorridor`, the bulb excepted). It is
**hit at (232.2,119.6), eta 87, by `chaser:lavarunner@208,96`**, the walk's own refused hit, to the pixel.

The difference, named: the chooser asks whether a path exists over **t0 volumes**, and the probe asks whether that
path is hit **with the chasers stepped against the walk**. The lavarunner's t0 box does not cut the path. The body
chases into the room's one-tile path, tile (13,6), and meets the walk at t87.

### 2. Why the lavarunner is not listed

By the chooser's own test its removal admits nothing: with it gone, the bulb's volume still cuts the path near the goal.

| removed pair | admits |
|---|---|
| bulb + `lavarunner@208,96` | yes |
| bulb + `lavarunner@24,56` | yes |
| `lavarunner@24,56` + `lavarunner@208,96` | no |

The bulb is necessary for the static path, and the lavarunner is necessary for the probed one. Neither single removal
admits a corridor the probe finds clean, so the chooser's list holds no body whose removal admits one.

### 3. If the kill rung were handed the lavarunner

**Node, scratch override** (lab: the hit's chasers appended to the list, or prepended; `node-runs.json`):
- **Appended** (BAIT still reads the bulb; the chaser arm's `interceptOrder` takes the lavarunner): REFUSED. *"chaser
  arm: no stance derives for lavarunner@208,96 … 81 cell(s) inside its 80 px leash, 21 of those reachable and with a
  corridor onward, and 21 of THOSE refused by the forecast [(280,120): the WAIT is dangerous at tick 99 —
  chaser:lavarunner@208,96; (264,120): the WAIT is dangerous at tick 87 — …]"*.
- **Prepended** (BAIT on the lavarunner): REFUSED. The bait is refused on the chaser forecast (*"(280,120): the WAIT is
  dangerous at dwell tick 27"*; a lavarunner survives lava), and the kill line is the same.
- **In every stance's preview the lavarunner DIES** (t121–141): the stand-and-strike works, but the player is hit
  first. Stance (264,120):
  1. the first press lands at t57 (hits 1, `hitsTimer` 30);
  2. the body is back on the player by t84;
  3. its i-frame lapses at t87, which is the contact;
  4. the strike policy's next press goes in at t88.

**On the game** (p4f, headless logic-only; the committed `probe-seedling-chaser-mobiles.mjs` plus a scratch copy that
also writes the player rows, `drivers/probe-chaser-player.vs-committed.diff`). The stance (264,120)'s preview held
sets were written as a v8 tape from the leg's own staging (`drivers/stance-tape.mjs`).

| tape | game: player hit | model: player hit | `lavarunner@208,96` (game = model) | agreement |
|---|---|---|---|---|
| `tape-l74-624-stance-264-120` (the arm's preview: presses t55, t88, t108) | **t87** | **t87** | hits 1 at t57, **2 at t90** (dies) | LavaRunner 0 px over 311 comparisons, hits and `hits_timer` included; the player on every tick but **t1–t2** |
| `tape-l74-624-press84` (the t88 press moved to t84) | **none** | **none** | hits 1 at t57, **2 at t87** (dies, gone by t117) | 0 px over 308; the player on every tick but t1–t2 |
| `tape-l74-624-press85` | **none** | **none** | as press84 | as press84 |

- The t1–t2 player difference is the known L74 arrival frame. LEASH saw Δy −1.35 at t2: the button / fallrock contact
  capture, the JS arc's. The walk re-converges by t3.
- The probe's clock line therefore reads FAIL on every tape (shifts `[]`), as on LEASH's 624 corridor. That is why
  these are evidence beside their samples and not `--record`ed fixtures.
- Press variants t83 and t86 ran on the game, but the model replay refused them (`LevelWorldError`, fallrock tag 2; see
  the D2 residue).
- **The hitsMax-2 sword kill under K2 is right:** two landings, 30-tick i-frames, the death and its removal, at 0 px.

**So the chaser arm's refusal is the game's, for its own schedule, and a hitless kill exists one schedule over.** The
press it needs goes in while the body's `hitsTimer` reads 3–4 (the policy's one-tick-old reading). `strikePolicy`
refuses it at `if (b.hitsTimer > 0)` (*"`Enemy.hit` refuses while it is up"*). That is true of each hit test's tick,
not of the press: the press's tests run over T+1…T+5, and the last ones land after the lapse.

### 4. Mode `order`, here and on `r9-solve-16`

| run | `empty` (shipped) | `order` | chooser OFF (`=0`) |
|---|---|---|---|
| leg 624 (node, 2,560) | the refusal above | **byte-identical** (`hitSourceBodies` admits no chaser) | byte-identical |
| `solve-seedling-r9-campaign --check`, both C1 switches as shipped | `712f0ead` exit 0 | **THROWS at `r8-solve-6`** (L6): `order` puts the probe's `sandtrap@64,16` (a static body in a stepped room, admitted since `STATIC_SWORD_ARM` is ON) ahead of `bob@112,48`. Bait says *"a KILL question"*; kill says *"static sword arm: … the run's `primary` slot holds NOTHING"*. `r9-solve-16` is never reached (`…-evidence/r9-campaign-order-shipped.head.txt`) | — |
| the same, `SEEDLING_STATIC_SWORD_ARM=0` | — | **`712f0ead` exit 0**: `r9-solve-16` byte-identical, 688 t, 0 hits, ends at the L18 arrival (`r9-campaign-order-static0.txt`) | — |

C1 measured `order` equal to `empty`, and C1-ON then flipped the static arm ON. **`order` is no longer a safe
measurement arm**: it composes with `STATIC_SWORD_ARM` and breaks the campaign before `r9-solve-16`.

## D2 — STOP (the fix is not the chooser's)

The brief: *"Fix it only where D1 shows the chooser's decision is wrong … If D1 shows that the right fix is in the
chaser arm, BAIT or pricing (fidelity's regions), STOP."*

- **The chooser's claim is wrong by the probe's standard.** The bulb's admitted corridor is still hit. A chooser whose
  test were right (the brief's example: *"a body whose removal admits a corridor that the probe still finds hit by
  another body is not a removal that admits it"*) would list **nobody** here, and the leg would refuse the same way.
- **The body the walk actually meets is the lavarunner.** Handing it to the kill rung by any admission (appended,
  prepended, or a C1 `hitSourceBodies` that admitted a chaser, the trap C1 measured on `r9-solve-16`) **moves no
  verdict**. The chaser arm refuses all 21 stances, and the game confirms the best one is hit (D1.3).
- **The hitless kill exists only with a press timed inside the i-frame**, which is `strikePolicy`'s gate in the chaser
  arm's weapon (fidelity's region; a gate every walk and fight in the roster shares).

So no switch was added. A chooser change would ship a behaviour with no leg it solves and no game-witnessed ON plan,
which D2's own acceptance requires. **Hand-over below.**

What a lab gate that anticipates does (a scratch measurement, not a proposal):
- `C4_ANTICIPATE=3` (press while the reading is ≤ 3): the facing tap spends the tick, the press goes in at t86, and the
  refusal is unchanged.
- `C4_ANTICIPATE=4`: the walk's own strikes change. The solve then dies inside `drive` → `enterWorld` →
  `buildLevelWorld`: *"level 74: the tape clears tag 2, which is a "fallrock" at (288,144) … A clear list must never name
  it"* (`node-runs.json`, the stack). This is the same model refusal the t83/t86 tape replays hit. It is a second wall
  past the fight, and it is fidelity's or the JS arc's (the L74 arrival fallrock).

## D3 — not run as specified (there is no switch)

Nothing ships, so there is no ON to measure and no mover. The controls D3 asks for were measured as part of D1:
- **`r9-solve-16`** is unmoved at this head (the identity block's r9-campaign `712f0ead`). In `order` mode with the
  static arm OFF it is byte-identical (688 t), and with both C1 switches as shipped the chain throws earlier, at
  `r8-solve-6` (D1.4).
- **The neighbours at this head** (node, 2,560; `node-runs.json`):

| leg | key | node at `bdb10bb12f` |
|---|---|---|
| 622 | `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` | REFUSED: `lavarunner@72,24`, d 9.1, at (72.8,24.0). The forced hit (FORCEDHIT's) |
| 624 | `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` | REFUSED (W0) |
| 626 | `level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield` | REFUSED: *"a sword press at tick 0 would fire its rect on a FROZEN tick (a button-dropped fallrock)"*. The L74 arrival frame |
| 628 | `level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144` | REFUSED: skirt stance waypoint 2 stalls at (24, 109.75), as LEASH |
| 629 | `level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield` | **SOLVED 307 t** (bait, collect, kill, walk). `baitForecast` ships ON now, and this is LEASH's ON number |

**CI for the planner** (dispatch from here returns 403):
- `seedling-divergence-sweep.yml` on `claude/seedling-hammer-c4-j9alfp`: `mode=inv`, `producer=solver`, `shards=1`,
  `keys=level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0|level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield|level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144|level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield`.
- Expect this head's page verdicts, and that no code changed: 629 done; the rest refused as above, with 626 the
  arrival-frame divergence on the page.
- It is a baseline for fidelity's strike-gate slice, not an A/B of this one.

## D4 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase C4 — the L74 chooser* (after C3's), with two trap candidates.
- `seedling-bot.md`: a paragraph after C3's.
- Surface `--check` GREEN 269 and constants `--check` PASS 5,684, both unmoved (no code changed, so no `--write`).
- `generate-procgen-reference.mjs` regenerated (the docs index's word counts; `README.md`'s count line), then
  `--check`: ALL 7 + 5 MATCH. `scripts/quicklaunch/generate-docs-index.mjs`: no change.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED.
- **No fixture, no roster enrolment.** The three game runs sit beside their samples in the evidence directory
  (`tape-l74-624-*.json` + `game-l74-624-*.json`: every player sample, game and model, and `lavarunner@208,96`'s rows).
  The probe's calibration line cannot pass on an L74-from-L73 arrival (t1–t2), so `--record` refuses, as on LEASH's 624
  corridor. Roster 277, no pin moves, no `rosterCategories` row.
- **Bounded vitest AFTER**: W0's 18 + `boxLock`, `seedlingConstantsCensus`, `entityBlocks`, `seedlingSolverSurface`,
  `checkProcgenHelp`, `procgenDocs/{docLinks,docsRender,generated}`, `quickLaunch/generated` (27 files): **1,641 /
  1,641**; tapeRunner 611, `86af8525` (= BEFORE). `reach-seedling-change --range=bdb10bb12f..HEAD` adds
  `walkMoves.test.js`: 31/31.
- **Identity AFTER**: the range touches no node but the docs. The reach names one identity row, the reference, and its
  `--check` MATCHes. Every other row cannot move; the block was not re-run.

## Deltas (base → head)

- **Code: none.**
- Docs: the log section, the `seedling-bot.md` paragraph, the regenerated docs index and README count line.
- New: `CC/docs/cloud-reports/seedling-hammer-c4-evidence/`:
  - three tapes and their game samples;
  - `node-runs.json`: every node verdict above, the chooser rows, the probe of the bulb's corridor, the pairs, the
    chaser arm's 21 stances, and the anticipate-4 stack;
  - the identity base, the two `order` campaign runs and the vitest summaries;
  - `drivers/`: the lab diff, the probe diff, `trace.mjs` and `stance-tape.mjs`, all scratch, run against a lab copy
    of `frontend/` and LEASH's `drivers/leg.mjs`.
- Identity, tapeRunner, surface, constants, entities, profile and roster: all = W0.

## What the brief got wrong (measured)

1. *"The ladder's choice is what blocks the leg"* (LEASH's hand-over): the choice is the visible symptom, not the
   blocker. With the lavarunner chosen, the chaser arm refuses all 21 stances, and the game confirms the best stance is
   hit at t87. What blocks is the strike policy's refusal to press into a live i-frame, and the fallrock model refusal
   behind it.
2. *"Mode `order` exists as a measurement arm; C1 measured it"*: since C1-ON's static arm, `order` is not inert. The
   r9 chain throws at `r8-solve-6` before `r9-solve-16`.
3. *"Reproduce leg 624 in node, word for word"*: against LEASH's page row it differs in two counts (21 → 20 cells,
   251 → 246 previews), because the page row is from `dd6ae2e379` with `baitForecast` OFF. No word differs.
4. *"(≥ `bdb10bb12f`)"*: the session's branch is the harness's `claude/seedling-hammer-c4-j9alfp`, not
   `seedling-hammer-c4`.
5. The bootstrap's `READY` again left five non-wasm submodules uninitialised.

## Residue — hand-over to fidelity (the chaser arm's region)

1. **`strikePolicy`'s i-frame gate refuses a press whose hit tests land after the lapse.** Witness: the
   `press84`/`press85` tapes: a hitless kill at t87, on the game and in the model. A fix lets a press go in while
   `hitsTimer` (the one-tick-old reading) is ≤ the ticks until its hit tests run past the lapse. It moves every walk's
   and fight's strikes (roster-wide), so it needs its own switch and a full mover census. The `owed` rule and
   `ORDINARY_SWING_PERIOD`'s dash refusal must still hold. Then 624's chaser arm on the lavarunner has a stance, given
   item 3.
2. **The fallrock refusal past the fight.** With a lab anticipating gate (≤ 4), 624's walk re-enters L74 and
   `buildLevelWorld` refuses fallrock tag 2 (`LevelWorldError`). The t83/t86 tape replays hit the same wall. It is
   fidelity's or the JS arc's (the L74 arrival fallrock, the same capture as 626's freeze and the t1–t2 Δ).
3. **Then the chooser (mine, if the planner wants it once 1–2 land).** Even with the lavarunner dead the bulb's volume
   still cuts the path near the goal, so the climb after the kill reads the bulb, as now. If the arm can kill the
   lavarunner, the chooser still has to hand it over. Today `interceptOrder` would, but only if the lavarunner is in the
   list. The smallest change is the brief's *"a body whose removal admits a corridor that the probe still finds hit by
   another body"*: list that other body (a chaser the arm can hunt) after the admitted one. BAIT keeps the head;
   `interceptOrder` puts the hit's chaser first for the kill. Measured in the lab as `C4_APPEND`, it is inert on 624
   today (the refusal names the lavarunner's chaser arm instead of the bulb's). Not shipped: no leg moves until 1–2.
4. **FORCEDHIT** (wave 13): ON here is nothing, so its second harvester re-runs 624 against this head's code. A hitless
   kill exists on the game (item 1's witness), so **624 is not a forced-hit leg**. The chaser-arm route above is a
   hitless crossing in waiting.
5. `order` mode: retire it, or re-measure it with the static arm. It is no longer the inert arm C1 recorded.

Scratch, not committed: the lab copy of `frontend/`, the per-run logs and the vitest JSONs (`/tmp/claude-0/c4/`).
CI at the head: owed (`node scripts/procgen/ci-vitest-summary.mjs <head>`); the suite number is CI's (⚖ 52).
