# Seedling fidelity YETI — the Yeti's `doneTalking()` and L58's tag-1 door

Slice `seedling-fidelity-yeti`, wave 25 (model coverage after R7), planner `seedling-fidelity-planning-10`.

| | |
|---|---|
| Start SHA | `e2b0f2b63f` (= main), as briefed |
| Harness branch | `claude/yeti-talk-teleporter-yo2vs5` (the brief's local name `seedling-fidelity-yeti` was not used; only the harness branch is pushed) |
| Commits | D2 `972275e0` · D3 `067cf9b8` · D1 `a74bf6fb` · censuses `bf7d4310` · records `ab623713` · levelRun pin `8e82377c` · this report (the head) |
| Dev server | `serve-nocache.py 9716` (PID 910) over the checkout; a pristine detached worktree at `e2b0f2b63f` (submodules and `node_modules` symlinked, never pushed) for every BEFORE |
| Switch | `CONTACT_FIDELITY.yetiTalk`, **OFF** (`SEEDLING_YETI_TALK=0\|1` for node) |
| Verdicts | **W0 PASS · D1 PASS (four game witnesses, 0 px) · D2 PASS (switch OFF, byte-inert; STOP for the flip) · D3 PASS (the clear-tag talks; the door after it is the next gap, named)** |

## The one thing to know first

**The talk works on the game and in the model, but L58's door still cannot be walked by the solver after it, because
the door stands on a Pit tile.** `teleporter@80,16` sits on tile (5,1), which is a Pit. After the Yeti's talk opens the
door, the solver's `reach-exit` refuses `unmodelled-pit-teleporter`: housekeep D1's named refusal, previously seen at
L43 and L100, and now a third room. Two witnesses here give the game's answer for this door:
- `talk`: on a straight approach to the LIVE door, the game crosses to L46 (t202);
- `shut`: on the same approach to the SHUT door, the Pit takes the player (respawn at the arrival); there is no crossing.

So survey steps 91/122 move (REFUSED DEACTIVATED → REFUSED pit-teleporter) once rules-2 adds the talk goal. They need
that refusal modelled before they can SOLVE. The refusal lives in `botDriverV2.findExit` / `solverBot.findExitNamed`
(the walker's door lookup). That is outside this slice; see the residue.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `e2b0f2b63f`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9716 bash scripts/procgen/identity-block.sh .` in the pristine worktree (venv on) | log md5 **`e484c3b22d5c5b3940b1112e458a8a1b`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | "4 GENERATED MODULE(S)/REGION(S) DIFFER": registry, capabilities and two substrate regions. This is the box artifact WATCHERTALK named (no `bulletml-dodge` checkout); the same at head |
| surface / constants / entities / profile | each `--check` | GREEN **342** · PASS **6,891** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` from a `--reporter=json` run of `tapeRunner.test.js` | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 105 files (below) | **3,681 passed, 0 red**; slow `fidelityL32ArenaPrefix` 5/5 |
| route survey | `survey-seedling-route.mjs --through=end --route=full` in the pristine worktree | **191/250 SOLVED** (my local baseline; the CI baselines are the brief's) |

The bounded set is the brief's standing list (one name, `apReportBosses`, has no test file of that name; I used
`fidelityApBosses` and `fidelityApFlip`), plus every non-slow test naming `PLACED_NPC_TALK`, `stepTalkersNow`,
`talkerTalks`, `PERSISTENCE_RESPONSE`, `persistenceResponseOf`, `execClearTag`, `clearTagExecutor`, `'yeti'`, `yeti@`,
`CONTACT_FIDELITY_KEYS` or `earnedClears`, plus `placedTalk`, `watcherL114`, `fidelityWatcherTalk`, `rosterCategories`,
`tapeRunner`, `seedlingConstantsCensus` and `seedlingSolverSurface`. AFTER adds `fidelityYeti` (106 files).

⚠ A first identity block ran in the main tree while my OFF-only edits were landing. I did not use it, and re-ran the
BEFORE in the pristine worktree. Both logs are identical except for the box-lock lines, which `b` drops. The
"generated set" row drives the page on `SEEDLING_PORT`, which serves the main tree in every run. It reads OK in all of
them.

### The tick chain on the game (W0's reading of the AS3 @ `ccdf189776`)

- **The room.** L58 is `DeadBoss.oel` (128×128):
  - `yeti@56,56`: tag 0, five pages, `frames="3"`. The ctor's half-tile puts its centre at (64,64), and its Solid is
    10×12;
  - `teleporter@80,16` → L46: tag 1, `show=1`;
  - two untagged doors back to L57 at (48,112) and (64,112).
  The floor is water except a four-tile island under the Yeti and the door's ledge, so the run needs Swim. **The
  door's own tile (5,1) is a Pit.** The Tentacled Beast's mouth lands the player at `new Game(58, 56, 96)` → (64,104),
  40 px below the Yeti.
- **The talk** (`NPCs/NPC.as:185-248`):
  - `keyNeeded` is true (only `Watcher.as:46` assigns it), so the dialogue opens on an X release
    (`Input.released(p.keys[6])`) inside `FP.distance(x, y, p.x, p.y) <= 24`. This is the Witch's shape, not the
    Watcher's proximity open.
  - `talking` raises `freezeObjects` from the next frame.
  - The `talking` setter's false branch calls `doneTalking()`. It runs on the last page's release (`:207-214`) AND on
    leaving the circle (`:230-236`).
- **The writes** (`NPCs/Yeti.as:40-50`): `if (!createdPortal) { createdPortal = true; setPersistence(tag, false);
  setPersistence(1, false); }`. `createdPortal` is an instance field, so the writes happen once per visit.
- **The door** (`Teleporter.as:84-94`):
  - `update()` calls `checkDeactivated()` EVERY frame: `tag >= 0 && (!checkPersistence(tag) == invert)`. A fresh room's
    door is shut, and the clear opens it in the same visit.
  - The Yeti is added later than the teleporters (`Game.as:2274`), and `addUpdate` prepends, so the Yeti updates first
    and the door reads the clear on the closing frame itself. The player cannot stand on the door then: the circle and
    the door's rect are more than 30 px apart. So the fencepost is unobservable.
- **The revisit** (`NPC.as:119-126`): `check()` removes an NPC whose tag is cleared, on a new `Game` only. The Yeti stays
  for the rest of the visit.
- **The host report.** `setPersistence` sets `pendingCheck` on each call (`Game.as:1902-1910`), so the frame's second
  write overwrites the first's report string; the sequence still advances by 2. See the residue (the JS arc's).

## D1 — the game witnesses (PASS)

`scripts/procgen/probe-seedling-yeti.mjs`:
- box lock, headless logic-only, p4g, port 9716;
- staging: `r8-solve-11`'s block (`watcherStaging`) re-pointed at the mouth's arrival L58 (56,96), plus `canSwim`;
- the model replays each tape with `yetiTalk` ON and is compared tick by tick; the game's `persistence_cleared` is read
  for `{58,0}` / `{58,1}`;
- `--out` writes `fixtures/yeti-witness/yeti-l58-<name>.json` (the tape, the game's stream and its verdict).

| witness | ticks | game | model (ON) |
|---|---|---|---|
| `talk` (the solver's clear-tag plan, then a straight walk onto the door, 10 t in L46) | 212 | clears **58:0 + 58:1**; **crosses to L46 at t202, in the same visit** | 0 px every tick; open t54, close t144 (`done`), both writes at t144 |
| `control` (the same, cut one page after the open, 20 still ticks) | 83 | **no** 58 flag cleared | 0 px; `yeti-open` only |
| `shut` (no talk: the walk to the stance, then onto the door) | 175 | no flag; **no crossing; the Pit takes the player, respawn (64,104)** | 0 px (the OFF model gives the same: no Yeti event) |
| `revisit` (`{58,0}` and `{58,1}` cleared at the boot; straight up through the Yeti's old Solid, then onto the door) | 108 | crosses at t98 | 0 px |

Run log: `probe-seedling-yeti.mjs --host=http://localhost:9716` → **ALL CHECKS PASSED** (talk/control/revisit),
and `--only=shut` → **ALL CHECKS PASSED**.

Not witnessed: the `left` cause, where a release on the circle's rim carries the player out on the opening frame. The
model's arm is the shared `stepNpcDialogue` path, which writes on `left` as on `done` (the Watcher's `left` is
witnessed). This is a residue.

## D2 — the model (PASS; switch OFF, STOP for the flip)

**Change** (`972275e0`, plus `bf7d4310`'s fold order):
- `contactFidelity.js`: `yetiTalk: false`, `SEEDLING_YETI_TALK=0|1`; the defaults pin gains the row.
- `dialogue.js`: `YETI_PORTAL_TAG = 1` (the hardcoded second tag). `PLACED_NPC_TALK.yeti` is **unchanged** (`'REFUSED'`).
- `levelRun.js`'s talker arm, with the switch ON:
  - the REFUSED throw skips the Yeti;
  - the close runs `yetiDoneTalking(w, cause)` on both causes;
  - `createdPortal` is kept on the visit's talker row;
  - `{58,1}` goes through `applyClearNow` (`clearedByLevel` + rebuild + rebinding `world`), so the door opens mid-visit;
  - `{58,0}` is banked in `pendingEarnedClears` for the next build.
- New: the ledger `yetiEvents` (`yeti-open` / `yeti-close {cause, wrote}` / `yeti-write {tag, bootCleared}`) and the run
  field `yetiFlags`.
- An `earnedClears` arm filtered on `bootCleared`, NOT on `clearedByLevel`: the door's clear lands there mid-visit, so
  that filter would hide it.
- `levelWorld.js`: `YETI_PERSISTENCE_RESPONSE = {yeti: 'despawn'}`, read by `persistenceResponseOf` under the switch. OFF,
  a build handed `{58,0}` still refuses by name.
- `tapeRunner.runTape` carries `yetiFlags` / `yetiEvents`. `check-seedling-bot-differential` gains a two-sided Yeti row:
  every model write is off in the game's array, and an opened, unfinished dialogue leaves both flags set.
- **Digest rule.** No new per-visit map: `yetiFlags` is a run-long ledger like `watcherFlags`, and `createdPortal` lives
  on `talkerStates`' rows (`DIGEST_EXEMPT`, UNREAD). member-reach:
  `yetiFlags` → readers `yetiDoneTalking`, `earnedClearsNow`, `run.yetiFlags`; members `advance`, `earnedClears`,
  `ledger`, `yetiFlags`. `yetiLedger` → `advance`, `ledger`, `yetiEvents`. Neither reaches an IN reader. The writes'
  effect lands in `clearedByLevel` / `pendingEarnedClears`, already in `stateDigestParts`' `persist`.
  `levelRunStateDigest` is green. I did not edit `stateDigest`.

**Mutants** (predicted first; made by copy and restore; md5 of `levelRun.js` / `solverBot.js` identical after):

| mutant | predicted | measured |
|---|---|---|
| M1: no mid-visit apply of `{58,1}` | 5 red: talk witness, ON-close row, drift guard, plan-prefix, pit-teleporter row (it becomes DEACTIVATED) | **5 red**, those five |
| M2: no `{58,0}` bank | 1 red (ON-close `bankedClears`; the row was added for this mutant) | **1 red** |
| M3: the REFUSED throw kept ON | 8 red | **7 red**. I miscounted: there is no separate tag-1 solve row, it is the plan-prefix row |
| M4: `already-clear` never taken | 1 red (the states row) | **1 red** |

## D3 — the verb (PASS)

**Change** (`067cf9b8`, door import fixed in `bf7d4310`):
- `execClearTag` gains a `yeti` arm behind `yetiTalk`, placed before the rope arm.
- A clear-tag `{58,1}` (or `{58,0}`) whose obstacle names `yeti@56,56` runs `execYetiTalk`, a keyed talk in the Witch's
  shape:
  - the walkable tile centre nearest the player within 22 px of the Yeti's centre;
  - walk to it (the strike policy's `talkGuard` keeps the walk from opening anything) and settle;
  - the ceremony cadence until `yeti-close` with `wrote`; never ends on a press; settle;
  - then the clear-tag's own `waitForWrite` on `earnedClears`.
- Its states, read off the run:
  - either flag already off at the build is `already-clear` (the tag-1 portal reads live / `NPC.check()` removed the
    Yeti);
  - no talker with the door shut is `cannot-act`. That state is impossible in the game, but it is named.
- OFF, the generic arm finds the Yeti's Solid and refuses `no-verb`, as at the base.
- No new obstacle kind, no `STRATEGY_EXECUTORS` row, no `refineStrategy` change. The frontier is untouched: a Yeti in a
  corridor is a Solid, and the talk is not a way past it.

**Measured** (`fidelityYeti.test.js`, 16 rows):

| case | OFF | ON |
|---|---|---|
| `{58,1}` from the mouth (L58 56,96, `canSwim`) | `no-verb` | **SOLVED 145 t**, stance (56,72), open t54, close t144 `done`; plan = the witnessed `talk` tape's first 145 ticks, key for key |
| `{58,0}` | `no-verb` | the same talk |
| `{58,1}` cleared at boot | — | `already-clear`, 0 t |
| `{58,0}` cleared at boot | — | `already-clear`, 0 t |
| `{58,1}` with only `{58,0}` cleared (no Yeti, door shut) | — | `cannot-act` |
| `{58,1}` then `reach-exit teleporter@80,16` | `no-verb` | talk, then **`unmodelled-pit-teleporter`** (`teleporter@80,16`, tile [5,1]) |

**The goal shape the JS arc and rules-2 should use:**

```js
{ kind: 'clear-tag', tag: { level: 58, tag: 1 }, at: { x: 56, y: 56 }, obstacle: 'yeti@56,56' }
```

- `at` and `obstacle` name the WRITER, the Yeti, as the Watcher's `{114,0}` goal names the Watcher; `tag` names the flag
  the door reads.
- rules-2's talk EVENT, gating `level_58__r1c4 -> level_46__r6c24`, should map to `flag:L58:1` with that obstacle.
- The survey's talk goal is this clear-tag, followed by the `reach-exit`.

## The movers (before → after) — and the CI dispatches

| surface | OFF | ON |
|---|---|---|
| route survey, local, all 250 steps (`--through=end --route=full`) | = base on every step (every field but `ms`); 191/250 | **= base on every step: 0 movers**; 191/250. No step reaches the Yeti: L58 steps 91/122 are NO-ARRIVAL while `tentacleBeastFight` is OFF |
| steps 90/91/121/122 with `SEEDLING_TENTACLE_BEAST_FIGHT=1` (rules-2's view) | 91/122 REFUSED "the teleporter at (80,16) in level 58 is DEACTIVATED" | **the same** (the route asks for no talk until rules-2 adds the goal) |
| sweep: the L58 legs | the only L58 leg is **509** (`level_58__r4c1 <- in_tentacle_beast_mouth_L57_56_96 -> exit:out_teleporter_48_112`), local inv sweep ×2: done, done (7-tick plan, lands L57 (104,72)) | ×2: **done, done**, the same 7-tick plan, stamped `contactFidelity` with `yetiTalk`. 0 movers. No leg asks for the tag-1 door |
| wasm probe battery (`standard`) | no probe has a contact knob, so at the branch default (OFF) the battery runs byte-inert code | its one L58 leg, arrival-composites' `moved L58 dead door` (arrival (64,16), expect `named`): node solve OFF = ON, "DEACTIVATED" (no talk goal). Expected 0 movers |
| committed tapes / tapeRunner | 635 pairs `88fc7df4…` | **635 pairs `88fc7df4…`**, identical ON |
| six producer `--check`s | = W0 | **= W0 ON** (`SEEDLING_YETI_TALK=1`, all six md5-identical, exit 0) |
| identity block | AFTER (OFF) log md5 `e484c3b2…` = W0, byte-identical | the six producers ON above; no generated or identity row reaches L58 |

**Dispatches for the planner** (none was possible from this session):
1. **Sweep A/B** (`seedling-divergence-sweep.yml`, on this branch, `keys=level_58__r4c1 <- in_tentacle_beast_mouth_L57_56_96 -> exit:out_teleporter_48_112`, ×2 each):
   - A: default inputs;
   - B: `contact_fidelity=` today's 44 ON keys **plus `yetiTalk`** (the list is in this report's evidence: 45 keys).
   - Expected: done ×2 both arms.
   - Once rules-2 adds the talk event and the JS arc wires `clearTagVerbOf`, the new `flag:L58:1` leg(s) should go
     `no-verb` → done (talk) in B.
2. **Survey ON** (`seedling-survey.yml through=end route=full`, on a branch with the default `true`). Expected: = base on
   every step. To see the talk, it needs rules-2's talk goal and `tentacleBeastFight` ON; then 91/122 go DEACTIVATED →
   `unmodelled-pit-teleporter`.
3. **`seedling-probe.yml battery=standard`** on a branch with `yetiTalk` default `true`. Expected: = OFF (0 movers;
   `moved L58 dead door` stays `named`).

## The JS arc: what it must wire

- **`jsRuntimeSolver.clearTagVerbOf`, one line** (the WATCHERTALK pattern; `talk` is already a `STRATEGY_EXECUTORS` row,
  so `registered` needs no widening; OFF it is `{null, false}` byte for byte):

  ```js
  // ⛓ fidelity YETI (`CONTACT_FIDELITY.yetiTalk`): the Yeti's verb is `talk` — `solverBot.execClearTag`'s yeti arm.
  if (CONTACT_FIDELITY.yetiTalk && key === 'solid:yeti') verb = 'talk';
  ```
- The event goal for rules-2's talk event: the clear-tag shape above.
- New run fields `run.yetiFlags` / `run.yetiEvents` and the ledger `yetiEvents` (38th kind). Nothing was renamed or
  reshaped, and `seedlingSkinRenderer` is green.
- No signature or contract change to `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`. No new
  staging field, result field or obstacle kind.
- **Residue for the host:** `Yeti.doneTalking` calls `setPersistence` twice in one frame, so `Game.pendingCheck` holds only
  the second report (`{58,1}`). The sequence advances by 2. Whether the AP host needs `{58,0}` reported is the JS arc's
  call; I believe neither tag is a location.

## Handed over

- **`unmodelled-pit-teleporter` at L58** (walker / housekeep D1's family; not the hammer arc's).
  - `botDriverV2.findExit` refuses a door on a Pit tile because "which one wins is FlashPunk bookkeeping".
  - Measured here on the game, for this door: approached straight from the island, the LIVE door wins (`talk`, t202)
    and the SHUT door loses to the Pit (`shut`). The model reproduces both at 0 px; the run itself crosses, and only the
    planner-side guard refuses.
  - A switch-gated relaxation of the guard for a live door would need the same witness for L43 and L100's approaches.
    That is the next slice's work, with the JS arc's review (it is the walker).
- Nothing for the hammer arc: no escape-read state changed, and `stateDigest` is untouched.

## What the brief got wrong (measured)

1. *"Survey steps 91/122 (L58, tentacle route) refuse on the tag-1 teleporter."* At the base (`tentacleBeastFight` OFF)
   both are **NO-ARRIVAL**, because the mouth crossing is not built. They refuse on the DEACTIVATED door only with
   `tentacleBeastFight` ON (rules-2's view, reproduced here).
2. *"The pattern to follow is the WATCHER's."* The Yeti is a KEYED talker (`keyNeeded` true): an X release opens it, not
   proximity. The arm follows the Witch's shape; only the clear-tag binding follows the Watcher's.
3. *"The keyed sweep on every L58 leg ×2."* There is exactly ONE L58 leg (509, back through the water door to L57), and
   no sweep leg asks for the tag-1 door.
4. *"Reached by talking to the Yeti first"* is necessary, not sufficient. The door's tile is a Pit, so the `reach-exit`
   after the talk is the existing named `unmodelled-pit-teleporter` refusal.
5. The brief does not say the room is water: the talk needs Swim (`canSwim`) to reach the Yeti's island at all.

## Residue

- The `left` cause is not game-witnessed for the Yeti (see D1).
- The witnesses stage `r8-solve-11`'s seam plus `canSwim`, not the route's full AP inventory at L58. The room reads no
  item besides Swim (no enemies).
- A `seam_census` on L58 legs was not run. The talk has no moving body, so I expect no seam sensitivity, but that is
  not measured.
- `rosterCategories`: green, because I added no committed tape. The witnesses live in `fixtures/yeti-witness/`, and the
  default replay would refuse them by name while the switch is OFF.
- The reference's four box-artifact rows read "differ" here, as at the base (CI has `bulletml-dodge`).

## Byte-inertia

OFF is byte-identical to the base:
- the identity block (`e484c3b2…`, AFTER = BEFORE), including the six `--check`s;
- the 635 tapeRunner pairs;
- the 250 survey steps;
- leg 509;
- the censuses move by the new rows only: surface 342 → 343 (`import:YETI_PORTAL_TAG`, plus site counts); constants
  6,891 → 6,893 (`YETI_PORTAL_TAG`'s literal, classified); entities 566 and profile 138 unchanged.

## Bounded vitest AFTER

- **OFF: 106 files, 3,699 passed, 0 red**; slow `fidelityL32ArenaPrefix` 5/5.
  - A first OFF run (before `bf7d4310`/`ab623713`/`8e82377c`) had 3 reds, each fixed in its own commit: `boxLock` (the
    new probe on the takers list) and `levelRun` ×2 (the ledger fold: 38 kinds, `yetiEvents` witnessed).
- **ON (`SEEDLING_YETI_TALK=1`): 3,697 passed, 1 red, 1 skipped.**
  - The red is `contactFidelity` "the shipped defaults: all three ON", the defaults pin read under the env override. It
    is the flip's to move.
  - The skip is `fidelityYeti`'s "ships OFF" row, skipped under the env.

## CI at the last code head

`node scripts/procgen/ci-vitest-summary.mjs 8e82377c` (run 39822720911): **vitest 22,124 passed, 0 failed; slow battery
263/263.**
- The run is marked failure by three browser gate shards (`seedling-wasm-ship`, `seedling-editor-world +14`,
  `seedling-ap-placement +17`). Each failed at **"Install Chromium for Playwright"** in 0 s, so the gates never ran.
- The MASKS and Lights-flip branches' runs in the same window are red too.
- This is not this branch's code, and I could not re-run it (no dispatch). The report commit's push re-runs it.

## Records

- Bot log: "Seedling fidelity YETI", with two trap candidates:
  - a dialogue's two writes can have two readers that read at different times;
  - an `earnedClears` arm filtered on `clearedByLevel` hides a clear the run applied mid-visit.
- Witness fixtures: `fixtures/yeti-witness/yeti-l58-{talk,control,shut,revisit}.json`. Instrument
  `probe-seedling-yeti.mjs` (box lock; on `boxLock.test`'s takers list).
- Reference: instruments and docs index regenerated; the four box-artifact rows left as committed.
- Surface census `--write` (343 rows, `import:YETI_PORTAL_TAG` classified `seedling/constant`); constants `--write`
  (6,893; the literal classified `rule/sentinel`, anchor `NPCs/Yeti.as:createdPortal`).
- No tape index or roster change (289 tapes).

## Rows to BANK

- `yetiTalk`: OFF. ON movers = **none** today (survey 0, leg 509 0, the probe battery's L58 leg 0). It moves once
  rules-2's talk event / survey goal lands: the `flag:L58:1` clear-tag goes `no-verb` → talk (145 t from the mouth), and
  91/122's refusal moves to `unmodelled-pit-teleporter`.
- Game witnesses (p4g, 0 px): `yeti-l58-talk` 212 t (crosses t202), `-control` 83 t, `-shut` 175 t, `-revisit` 108 t
  (crosses t98).
- tapeRunner pairs: 635, md5 `88fc7df4dd05d11dfd84ebbea675cc8e` (unchanged, OFF and ON).
- Identity block: `e484c3b22d5c5b3940b1112e458a8a1b` (unchanged).
- Bounded vitest: 106 files / 3,699 OFF.
