# Seedling fidelity WANDHOLD: L40's hold is the solver's stillness, not the game's; L39's cover is a wall a plain Button cannot redeem

| | |
|---|---|
| Session | `seedling-fidelity-wandhold` (planner `seedling-fidelity-planning-11`, wave 28, model coverage) |
| Start SHA | `d3346cf784` (main; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-wandhold-stance-xju3zd` |
| Commits | D2 `53a23d48` · D1 `d4dfc646` · records `79871f41` · this report |
| Verdicts | **W0 PASS · D1 PASS (three p4g witnesses, 0 px) · D2-L40 PASS by measurement, no new key (the strategy is MOVINGWAIT's, OFF; STOP for the pair's flip licence) · D2-L39 PASS (`coverWeighRefine`, OFF) and STOP past it (the room's opener is a fire-push nobody models)** |

**The one thing to know first.** L40's *"the hold stands still for up to 131 tick(s)"* is the solver's choice, not the
game's. `buttonroom@272,208` is a `room = -1` ButtonRoom, so group 0 latches, and the fade finishes wherever the player
stands. The wait the game allows was built in wave 14: MOVINGWAIT's paced hold (`movingWait`, OFF). At this base, turning
on **`movingWait` + `bombBlastBody`** solves both L40 legs (368: 1601 t, 371: 1667 t). The game (p4g, damage on) plays
both plans to the part with **0 hits**, and the model matches at **0 px** on every sampled tick, every bomb to the bit.
I built no duplicate key for L40. What it needs is the pair's flip licence. L39 is not a planner geometry defect (nothing
handed to the hammer arc). Its hold stance was hypothesised behind a Cover that only a plain Button holds open. The new
`coverWeighRefine` (OFF) turns that into a named refusal. The room's real opener is Fire pushing its `PushableBlockFire`s
onto the buttons, and nothing models that yet.

## W0: the bank at base (`d3346cf784`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block (base) | `SEEDLING_PORT=9726 bash scripts/procgen/identity-block.sh .` in a detached worktree of `d3346cf784` (submodules + `node_modules` symlinked; venv activated) | log md5 **`e484c3b22d5c5b3940b1112e458a8a1b`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK |
| six `--check`s (base) | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 0dd65640`, all exit 0 |
| reference (base) | in the block | 4 DIFFER: environmental (`registry.js`, `capabilities.js`, two doc regions: this box's substrate submodules) |
| tapeRunner (base) | `npx vitest run frontend/modules/seedlingDemo/tapeRunner.test.js --reporter=json`, md5 over sorted `status\tfullName` | **635** pairs, md5 `e164838673a48b38ce187093c363edb2`, 0 non-pass |
| bounded vitest BEFORE (base) | 97 files (below), `--reporter=json` | **97 files / 2,480 tests, 2,480 pass**, md5 `200a4a7b8c6f3d369fedb4160ea10c0d` |
| surface / constants (base) | the committed tables | surface 345 rows; constants 6,908 literals |

**The bounded set (97 → 98 files).** The brief's standing list, except two names that have no test file of that name at
this base: `apReportBosses` (only `apReportBosses.js`; its rows live in tests the grep below catches) and
`fidelityL32ArenaPrefix` (a `.slow` file, not run: it is L32's arena and every change here is OFF and byte-identical).
To that I added the surface/constants tests and every non-slow test file that `git grep` hits for
`refineStrategy|stanceHypothesis|deriveHoldStance|resolveWeighStrategy|coverWeighRefine|cover@112,144|CONTACT_FIDELITY_DEFAULTS|CONTACT_FIDELITY_KEYS|bomb-witness`.
AFTER adds `fidelityWandHold`. The list: `/tmp` at run time; reconstructable with that command.

## W0: what the hold is (the AS3, read only)

| question | answer |
|---|---|
| What opens `wandlock@176,80` (L40)? | Group 0's `Lock` fade (`Lock.activationStep`, 0.01 a tick ⇒ 101 ticks to `turnOff`). A `WandLock` is a `Lock` with another sprite (`WandLock.as`); no wand is involved (WAND's D1). |
| Its opener | `buttonroom@272,208`, `room = -1`: `ButtonRoom.set activate` is behind `if (a)`, *"Can't be reset to false!!"*, so the group stays published once pressed. |
| `BombPusher` (`Enemies/BombPusher.as`) | It is centred at (136,152). It shoots when the nearest player is within `maxDistance` 256 px and `shotTime == 0`. On the shoot anim's end it adds `Bomb(x, y, player point)` and sets `shotTime = 15`. It is `activeOffScreen`, and its `hit`/`knockback` are empty. |
| `Bomb` (`Projectiles/Bomb.as`) | It flies `tMax` 30 updates toward the aim point (`v = (p - x) / 30`, no solids), then `removed()` adds `Explosion(x, y, ["Player","Enemy","ShieldBoss"], 24)` (radius int(24 × 0.65) = 15). |
| The model's pricing | `dangerAt(…, {mode: 'wait'})` (`lobberWaitDanger`): a standing player within 256 px is hit once the wait outlasts the next shot plus ~61 ticks. `lobberHoldRefusal` refuses the still hold by name. |
| **Is "stands still for 131 ticks" the game's requirement?** | **No.** 131 is the executor's still bound (fade 101 + `HOLD_SLACK` 30), and standing still is the `hold` contract. The group latches, so the game requires only that the player is not under a blast; a moving wait suffices (MOVINGWAIT § D1). The whole north half of L40 is inside the 256 px reach, so a "stance outside the reach" would mean walking well east of x ≈ 392 and back. Pacing in place is the smaller motion and is already game-witnessed. |
| **L39: planner geometry or stance choice?** | **Stance choice** (a hypothesis), not `planWaypoints`/`stringPull`. `deriveHoldStance` for `button@112,144` (group 3, `wandlock@144,64`'s opener) accepted the stance (120,152) because `stanceReaches` probes under `stanceHypothesis`, and that hypothesis listed `cover@112,144` {t 2} as discharged by a `hold`. Cover's only presser is the plain `button@160,144`. `Button.update` republishes every update, and `Cover.update` → `reset()` makes it Solid the moment the group drops (unless something Solid or the Player is inside it). So nothing redeems that hypothesis while the walker is 36 px away, and the walk grinds 400 ticks against the cover. The planner is right that the cell is shut. |
| Why guard (iii) missed it | `refineStrategy`'s outlive refinement (PoC slice 3b) asks only `KILL_LOCK_TAGS` (`lock`, `wandlock`, `rocklock`, `grasslock`). A `cover` (`OBSTACLE_STRATEGIES['solid:cover'] = 'hold'`) keeps `hold` whatever its pressers are. Guard (iii) checks only `weigh`, on the stated premise that *"a `hold` survives here precisely because its group has a LATCHING presser"*. That premise is false for a Cover. |
| L39's real opener | `pushableblockfire` (`PushableBlockFire.as`): `moveTypes = ["Fire", "Pulse"]`, so only a Fire or Pulse shot moves it; a walk cannot push it. The three outer buttons sit under three covers, crossed (cover W ← inner E, cover N ← inner W, cover E ← inner N). The rules gate `level_39__r2c11 → level_39__r0c9` on **Fire**. So the room is opened by Fire-pushed blocks parked on buttons, a weight that outlives the walker. The model has no such verb. |

## D1: the witnesses (PASS; p4g, headless, damage on, `SEEDLING_PORT=9725`)

All three were recorded with `probe-seedling-bombpusher.mjs --record` (its default page is `seedling_bot_ap_p4g`). The
probe compares the player, every `Bomb` row and the lobber's anim at every sampled tick. The model side ran under the
process's switches.

| witness | inputs | game | model |
|---|---|---|---|
| `wandhold-l41-368-paced` | the solver's own plan for leg 368 (`l40buttonStaging({40,928,96})`, `movingWait` + `bombBlastBody` ON): `brave, kill, hold (paced up/down ×20), break, hold (paced down+right/up+left ×24), collect`, 1601 t | 1,599 of 1,600 ticks sampled, **0 hits**, 15 blasts | **0 px** through t1600, every bomb to the bit, the anim |
| `wandhold-l42-371-paced` | leg 371 (`{40,848,16}`): `brave, hold (paced down+left/up+right ×12 gap 12), kill, break, hold (paced down+right/up+left ×6 gap 18), collect`, 1667 t | 1,665 of 1,666 sampled, **0 hits**, 18 blasts, one landing on `spinner@192,160` | **0 px** through t1666; the blast on the spinner is the one `bombBlastBody` lands (1 `body-hit` row) |
| `wandhold-l39-cover-shuts` | L39 boot block (160,184), `{39,8}` staged: up onto `button@160,144`, stand 20 t, left 70 t, stand 10 | 135 of 135 sampled, 0 hits; the player stops at **x 130.25** (no tile there: the cover's east face) | **0 px**; the model's `cover@112,144` is open at t40-60 (held) and shut from t64 (dropped) |

⚠ **The witnesses cut one tick before the pickup.** At t1601 (368) and t1667 (371) the game's sample repeats the
previous tick (the pickup freezes the world), while the model moves on. That is the collect, not a divergence.

⚠ The L39 witness reads the cover through the player's stop. The probe has no column for a Cover's alpha or type, so the
open phase is the model's; the game shows the shut phase (the stop).

`fidelityWandHold.test.js` (10 rows) pins the following:
- the switch defaults;
- L39 OFF (the stall, to the bit: *"stalled at (119.37585598070463,162.0184411286208) … cover at (112,144)"*) and ON
  (the named refusal);
- both L40 legs OFF (the sweep's text, with each leg's still stance), ON (SOLVED, the verbs, two paced holds, the tick
  count, and **the plan equal to the witness tape key for key**), and the game rows replayed ON at 0 px with 0 hits and
  the blast and body-hit counts.

**Mutants** (predicted first; copy + restore, `cmp` clean):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | `coverWeighArm` returns `false` (the key ignored) | the L39 ON row only | ✔ 1 red |
| M2 | the L40 arm without `bombBlastBody` | leg 371's ON solve and its replay (the walk throws on the blast at `spinner@192,160`); 368 unaffected | ✔ 2 red |

## D2-L40: the strategy (PASS by measurement; no new code; STOP for the licence)

At this base, in node with the l40button staging (the survey's construction, re-pointed at each arrival):

| arm | leg 368 (928,96) | leg 371 (848,16) |
|---|---|---|
| defaults | REFUSED 8 s, the sweep's text: still hold at (279.41,215.58), *"a Bomb's Explosion at (284,217) 56 tick(s) into the wait"* | REFUSED 5 s: (280.69,215.82), 51 ticks |
| `movingWait` | **SOLVED 1601 t** (10 s) | **THREW** a plain `Error` (not a `SolverRefusal`): *"levelRun: the Explosion of bombpusher@112,128#11 at (250, 160) on tick 1339 … reaches the spinner spinner@192,160 — `Enemy.hit(4, …, 1)` … is not staged"* |
| `movingWait` + `bombBlastBody` | **SOLVED 1601 t** (7 s) | **SOLVED 1667 t** (6 s) |

MOVINGWAIT's two residues have since closed on main: 378's second-hold bomb on `spinner@192,128`, and 381's
`execKillByPress` hit. Both legs now pace twice and reach the part. A new key would duplicate `movingWait`, so I built
none. ⚖ 2026-10-12 is met: the bomb is modelled (BOMBPUSHER), the wait moves (MOVINGWAIT), and a blast on a body is
modelled (BOMBBLAST). This D adds the game witness of the whole leg on p4g.

**The licence to ask: flip `movingWait` and `bombBlastBody` ON together.** `bombBlastBody` must come with it, or leg 371
regresses from a named REFUSAL to a plain-`Error` THROW.

## D2-L39: `coverWeighRefine` (PASS; OFF by default; STOP past it)

- **`contactFidelity.js`**: `coverWeighRefine: false`, appended (`SEEDLING_COVER_WEIGH_REFINE=0|1`). The sweep's
  `contact_fidelity=` input switches it; the flashPanel setting `seedlingContactCoverWeighRefine` is derived from
  `CONTACT_FIDELITY_KEYS` (the settings row in `contactFidelity`'s suite gained it automatically).
- **`solverBot.js`**: `coverWeighArm(row, obstacle)`, and two lines in `refineStrategy`. ON, a `cover` with a group
  (`t >= 0`) goes through the lock's outlive question: every presser republishing ⇒ `weigh`, otherwise `hold` (a latched
  `buttonroom`, like L38's `cover@208,224`, keeps `hold`). Guard (iii) then **derives** the weigh, and a cover no block
  reaches is a wall. OFF: `false`, so the old arm runs unchanged.
- **ON at L39** (node, 0-1 s): *"solverBot: no REACHABLE stance inside button@112,144 in level 39 … ⛔ AND THE
  PREREQUISITES WERE TRIED AND REFUSED … cover@112,144 — its group t=2 publishes only while a Solid sits on
  button@160,144, and NO block in this room can reach it … ⛔ SEALED BEHIND A WALL: with cover@112,144 discharged a
  corridor … reaches the stance"*. There is no 400-tick grind. (The walk up from y 608 to ~408, before the refusal, is
  unchanged.)
- ⚠ **The ON refusal loses the `solverBot(survey-step-N) … -> hold stance (…)` context prefix.** This throw comes from
  `deriveHoldStance` through a path that does not re-wrap. The survey families it `unclassified` either way. I left it
  alone: re-wrapping is `walkTo`'s path, not mine.
- **STOP past it:** "NO block in this room can reach it" is true only of the **walk** family. The game's answer is
  Fire-pushed `PushableBlockFire`s (`moveTypes` Fire/Pulse) parked on the outer buttons, inside the faded covers (a Solid
  in a Cover also stops its `reset()`). That is a fire-push weigh, a model gap in FIREPUSH's family (the `shove` for a
  `pushableblockfire`). Per ⚖ 2026-10-12 this refusal is a **named interim**: the modelling is queued, not planned around.

## The survey and sweep rows this moves (before → after)

**Survey, local** (`SEEDLING_CONTACT_FIDELITY=<the 54 defaults>[,…] node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=48,65,66,67,91,92,93,94,95,132,133,134,152,153,154 --timeout=3600`;
step ids are this base's route (239 steps, `--derive-only`). These are every step in L38-L41, the only levels with a
Cover (L38/L39/L41, plus L110's presser-less ones) or a BombPusher (L40 only). Rows are in
`seedling-fidelity-wandhold-evidence/survey-l38-41-arms.jsonl`.

| step | level / goal | defaults | `+coverWeighRefine` | `+movingWait,bombBlastBody` |
|---|---|---|---|---|
| 48 | L38 Chest | SOLVED 371 | = | = |
| 65 | L38 `{39,8}` + exit | SOLVED 480 | = | = |
| **66** | L39 Totem Part 72,40 | REFUSED: the 400-tick grind at `cover@112,144` | **REFUSED by name** (cover = wall) | = defaults |
| 67 | L40 Boss Key 2 | REFUSED `pushableblockfire@576,576` | = | = |
| 91 / 132 | L38 → L39 | SOLVED 359 | = | = |
| **92 / 133 / 153** | L39 → L40 | REFUSED: the grind | **REFUSED by name** | = defaults |
| 93 | L40 Totem Part 64,144 (from the L39 teleporter, 480,896) | REFUSED STANCE_REENTRY `wandlock@448,432` | = | = (residue, below) |
| 94 | L41 Totem Part 240,144 | REFUSED `crusher@240,64` (SEARCHGAPS) | = | = |
| 95 / 134 / 154 | L40 exits | SOLVED 70 / 172 / 172 | = | = |
| 152 | L38 → L39 | REFUSED `chest@144,112` NEVER OPENED | = | = |

No verdict moves; four L39 rows change family (the grind becomes a named refusal). The L40 pair moves **no survey row**:
the survey reaches the part from the south (step 93), not from the north arrivals.

**Sweep** (leg ids re-derived at this base: `seedling-divergence-legs.mjs --out=… --presets=seedling_playthrough --blocks`;
L38-L41 = 55 legs, keys in `seedling-fidelity-wandhold-evidence/keys-l38-41.txt`):

| leg | key | before (base) | after, predicted (node) |
|---|---|---|---|
| 368 | `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | REFUSED (still hold, bomb) | `movingWait`+`bombBlastBody`: **SOLVED 1601 t** |
| 371 | `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | REFUSED (still hold, bomb) | pair: **SOLVED 1667 t** (`movingWait` alone: THROW) |
| 364 | `level_39__r0c9 <- in_L40_480_912 -> location:Level 039 - Totem Part 72,40` | (from the top; no cover on the way) | predicted unchanged by either arm |
| the L39 links-b leg (Sphere 6.4, from L38) | not a sweep leg (a cross-region logical link) | REFUSED: the grind | `coverWeighRefine`: REFUSED by name. ⚠ js pins this as its `long` battery's named end: its text moves under the switch |

**The dispatches for the planner** (branch `claude/seedling-wandhold-stance-xju3zd`):
1. `seedling-divergence-sweep.yml`, `keys=<keys-l38-41.txt>`, ×2 per arm:
   - (a) `contact_fidelity=<the 54 defaults>` (the control);
   - (b) `<defaults>,movingWait,bombBlastBody`;
   - (c) `<defaults>,coverWeighRefine`.
   - ⚠ Every unlisted key goes OFF, so each arm lists all 54 defaults.
   - Add `capture_requests` on (b) for legs 368/371: with `seam.time` noise, decide on a replay
     (`replay-seedling-solve-request.mjs --seam-time-sweep=-3..3`), not one row.
2. `seedling-survey.yml`, `--through=end --route=full`, arms (b) and (c) against the control: confirms no other step moves.
3. `seedling-probe.yml battery=standard`, arms (b) and (c): the wasm arrival composites (DRILL's lesson).

## The JS arc

- Nothing of theirs was edited. There is no new `SolverRefusal.obstacle.kind`: L39 ON throws the existing
  `proximity-hazard` refusal from `deriveHoldStance`.
- The flashPanel setting `seedlingContactCoverWeighRefine` exists automatically, derived from the key.
- js-links-b's `long` battery names L39's refusal as its end. With `coverWeighRefine` ON that text becomes the named
  refusal above; the outcome stays a refusal, so its budget does not move. With the L40 pair ON, links-b's L40 part (if
  its route reaches it from the north) would SOLVE.
- `producer:walker` rows: none (the walker was not touched).

## Handed over

- **Hammer arc:** nothing. L39 is not `planWaypoints`/`stringPull`, and no new run state is read by the escape.
- **FIREPUSH / the planner: the fire-push weigh** for L39. Fire or Pulse shots move `PushableBlockFire` onto a covered
  button; the block keeps the cover faded and the button pressed. Without it, the L39 route from below stays a correct
  named refusal behind `coverWeighRefine`.

## Deltas

| row | base | head |
|---|---|---|
| identity block | md5 `e484c3b2…` | **identical** `e484c3b22d5c5b3940b1112e458a8a1b` (every row, the six `--check`s, 4 environmental DIFFERs) |
| tapeRunner | 635, `e1648386…` | **635, `e164838673a48b38ce187093c363edb2`**, 0 non-pass |
| bounded vitest (defaults) | 97 files, 2,480 pass | **98 files, 2,491 pass** (+10 `fidelityWandHold`, +1 the derived flashPanel settings row), md5 `621122be6e79c72f14696dacca5b5424` |
| bounded, `+coverWeighRefine` | — | 2,461 pass, 30 skipped (env-gated rows), **0 red** |
| bounded, `+movingWait,bombBlastBody` | — | 2,459 pass, 30 skipped, **2 red**: `fidelityBombPusher` *"BOMBPUSHER D3 … ON: the cluster boot's plan stops at buttonroom@272,208's hold"* and `fidelityL40Button` *"L40BUTTON D2 … bombPusherLive ON (the default): the hold inside the lobber's reach is refused by name"*. Both are controls that pin the still refusal at the default and are owed re-pins on a flip (wave 9's lesson) |
| surface census | 345 rows | 345 rows, re-sealed: the one drift is `CONTACT_FIDELITY` read sites 95 → 96 (`solverBot.js` 74 → 75, `coverWeighArm`) |
| constants census | 6,908 | 6,908, PASS, 0 drift |
| reference | 4 environmental DIFFER | 4 (the docs index regenerated for the log entry: 441,187 → 441,601 words) |
| producers | — | `plan-seedling-l40button-witness` pins `bombPusherLive` OFF, so the L40 pair cannot reach its plans (no bomb ⇒ no pacing); not re-run |

**Branch CI** (`node scripts/procgen/ci-vitest-summary.mjs 79871f41 --wait`, run 40044735717, the last code head):
the unfiltered vitest suite has **22,435 passed, 0 failed** and the slow battery **267 passed** (⚖ 52: this is the
suite number). The report commits after it are docs-only, and the path filter starts no JavaScript Unit Tests run for them (`ci-vitest-summary.mjs 1c633232`: *"No JavaScript Unit Tests run"*), so 40044735717 is the branch's last code run.

## What the brief got wrong (measured)

1. **"D2 — the strategy, behind a NEW key"** for L40: the strategy already exists. MOVINGWAIT's paced hold is OFF and was
   game-witnessed on p4f. At this base it solves leg 368 alone, and leg 371 with `bombBlastBody`. A new key would be a
   second spelling. The work owed is the pair's flip, now witnessed whole-leg on p4g.
2. **"the hold stands still for 131 ticks … the game's requirement?"** No: the group latches, and 131 is the executor's
   bound.
3. **"L39: … a planner geometry defect … or a stance choice?"** Neither exactly: it is a hypothesis the guard admitted
   (a Cover outside the outlive question). The room's opener is Fire, which no verb models.
4. Leg ids at this base are as the brief named them (364, 368, 371).

## Residue

- **Survey step 93** (L40 part from the south): `hold stance (wandlock@448,432): STANCE_REENTRY`. Group 2's
  `button@480,384` is a plain Button, so the hold there is the L16 fallback (`resolveWeighStrategy` → `hold`) against a
  lock the walker re-shuts. It moves in no arm. It is in this slice's family, but its answer is again a weight that
  outlives the walker; queued, not built.
- The ON L39 refusal's missing context prefix (above).
- `seedling-bot.md` is unchanged (the reference doc of the solver as built). Add a line when `coverWeighRefine` flips.

## Byte-inertia

Every change is behind a switch that is OFF. The identity block and tapeRunner are byte-identical base → head, and the
defaults' bounded set is all green. No committed tape, producer digest, rules, AS3, wasm or gitlink moved.

## Rows to BANK

- `coverWeighRefine` (OFF): `fidelityWandHold` L39 rows; survey steps 66/92/133/153 change family.
- The L40 pair (`movingWait` + `bombBlastBody`): `fidelityWandHold` L40 rows; witnesses `wandhold-l41-368-paced` and
  `wandhold-l42-371-paced` (p4g, 0 hits, 0 px); the two control re-pins named above.
- Trap candidates (in the log): a "stands still" refusal quotes the executor, not the game; guard (iii)'s latch premise
  holds only for the tags the refinement asks; a repeated game sample at a collect is the pickup freeze.
