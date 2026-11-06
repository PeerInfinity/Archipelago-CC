# Seedling hammer-phase KEYLOCK-TURRET — flag 8's key line inside the ice turret's range: the turret dies first (`KEYLOCK_TURRET`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-keylock-turret` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-05 (the census's step 5) |
| Start SHA | `97739720dd4121e306312a111b00873dda9d00a4` (origin/main at start; the brief's floor `2342e25604` is an ancestor) |
| Head | W0 `4f440b9b`, M `7b036cd4`, I `149e7114` (the code and rows), D `4dd07abc` (docs, census write); the gate evidence and this report are the last commit(s) on the branch |
| Branch | `claude/seedling-keylock-turret-flag8-twuh7u` (the harness's designated branch) |
| Switch | `solverBot.KEYLOCK_TURRET`, **OFF**. `SEEDLING_KEYLOCK_TURRET=1` / `withKeylockTurret(enabled, fn)`; its `SOLVER_ENV_NAMES` line is added |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-keylock-turret-evidence/` (its README names every file) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done; every submodule initialised (the wasm one too: the page sweeps drive `seedling_bot_ap_p4g`); node v22.23.4; 4 cores; `:8000` = `serve-nocache.py` started by this session |

## 2. The answer first

**The one thing to know first:** the "hazard" on flag 8's key line is the game's, not a planner margin, and the turret
can be killed hitless from the door-open side by an arm that already exists. APPROACH's fork search
(`approachKillForCorpse`, built for LWEIGH's corpse weigh) kills it; the keylock arm only had to ask for it.

| question | answer (measured) |
|---|---|
| Does wall F reproduce? | Yes, word for word, on the page and in node, at the defaults and with tag 12 staged: *"no REACHABLE stance on bosslock@480,352's key line in level 40 — 0 cell(s)"* (20 work units) |
| Is the hazard the game's or the planner's margin? | **The game's.** On the key line with the turret alive a blast lands at t54 of the stand, before the lock opens at t83 (4 hits and a death by t200); with no turret the same stand is hitless and opens at t83 (`w0/stand-keyline.txt`, the model). On L40 the live turret's 32 px body also fills the only column to the pocket |
| Is it intermittent (a timing window on the key line)? | No usable window. The latch needs one tick on the line, but the walk to it is ~190 px inside the range past the body; braving the disc (no kill) refuses on the body: AVOID "different connected components" |
| The design | **A keylock stance PREREQUISITE**: the stance derived with the turret's disc exempt, and the turret killed first by APPROACH's fork search, in the same visit |
| 395 / 412 with tag 12 staged (the door carried), ON | **412 SOLVED 748 t at 323 work units** (inside the page's 640); **395 SOLVED 718 t at 2534** (inside the 2560 retry, by 26). Both hitless and deathless on a fresh run of the model (30(c)) |
| …in the game | **Both `done`** on the p4g page (`--solver-env=SEEDLING_KEYLOCK_TURRET=1`, `--stage-flags`): 0 room hits, no divergence, no recovery, flag {40,8} set and collected; the end row equals the model's to the last digit |
| The door shut (no tag 12), ON | REFUSED by name, both legs: *"no approach to iceturret@472,400 from the staging point (488,579) is hitless — 12 fork(s), {"no-plan":12}"* (APPROACH's own answer behind the latched `wandlock@480,560`, as on 860) |
| OFF | byte-identical (nothing asked; the refusal is the one it was) |
| The ON radius | In the committed atlas, `bosslock@480,352` is the only keylock with a key line inside a turret's disc. The bounded set ON: 0 movers (93 files, 2588/2588). The producer battery ON: §6 |

**Before → after (with tag 12 staged):** 395 and 412 refused → both solve hitless, model and game.

## 3. W0 — reproduction, and is the hazard the game's?

| row | result |
|---|---|
| base | `git fetch origin main` → `97739720`; the branch reset onto it; `session_bootstrap.sh --seedling` → done |
| leg ids | `seedling-divergence-legs.mjs` at this SHA: 395 = `level_40__r23c29 <- in_L39_144_0 -> location:L40 flag 8: bosslock@480,352 cleared`, 412 = the same `<- in_L43_176_464` (unchanged) |
| page, defaults (`w0/page-defaults-rows.jsonl`) | both `failed`: *"'keylock' could not be resolved from (488,904)"* / *"from (328,600)"*, "0 cell(s)" |
| page, tag 12 staged (`w0/page-tag12-rows.jsonl`, `--stage-flags=<key>=>40:12`) | both `failed`, the same text. The staging is real (`stagedFlags: [{flag:L40:12}]`) |
| node replay (`w0/node-chain.jsonl`) | defaults and `--persist=40:12`: REFUSED at 20 work units, the same text |
| what tag 12 is | the **button room's** flag (`buttonroom@880,768`, the rules' presser for "L40 flag 12: wandlock@480,560"); the door itself carries persistence tag 11. With tag 12 cleared at the build, the room's latch republishes group 3 and the door fades open at **~t100** (`w0/door-opens-tag12.txt`); without it, never |
| the room (`w0/map-395-tag12.txt`) | the key line `{x 482–491, y 369}` sits under the lock in a three-cell pocket (x 472–504, y 376); below it `button@480,384`, then the turret's live box (x 472–504, y 400–432) filling the column, `pushableblockfire@480,480` / `wandlock@512,480` lower down, then the south door at y 560. Every key-line cell is inside the turret's 129 px disc (47 px from its centre) |

**Is the hazard the game's?** `IceTurret.update` (AS3): a live turret within 128 px (`int` distance) turns toward the
player and every `shootTimerMax` (25) plus its shot animation fires three `IceTurretBlast`s; a blast that meets the player
calls `freeze(15)` and `hit(null, 0, …)` (one damage). `Enemy.hitPlayer` also hurts on contact with the live body. The
keylock latches on one tick of the key line (`BossLock.update`: `activate` is a latch), then `keyTimer` (60) and the
fade; `execKeylock` stands still for that hold (110-tick bound).

The model witness (`tools/stand.mjs`, a generated room: the lock in a wall, the turret's box two tiles below the line,
the boot ON the stance; the player leans into the lock until the line latches, then presses nothing):

| arm | key line touched | lock open | hits (t) | deaths by t200 |
|---|---|---|---|---|
| turret alive | t4 | t83 | **t54**, t99, t144, t198 | 1 |
| no turret (control) | t4 | t83 | none | 0 |

So a stand on the key line with the turret alive is hit before the lock opens: the disc prices a real volley. The
model's turret, blasts and freeze are fidelity's transcriptions (TURRETCIRCLE, TURRETSNAP, ICEBLAST…), and the game
witness in §5 drives the chosen design's plans in the game hitless. A separate p4g witness of the hit itself was not run:
it would stand a player in a volley the design no longer asks for.

## 4. M — the design table

| design | 395 (tag 12) | 412 (tag 12) | verdict |
|---|---|---|---|
| OFF | REFUSED 20 u, "0 cell(s)" | REFUSED 20 u | — |
| (a) **a timing window on the key line** (the disc exempt, no kill: "brave") | REFUSED 144 u: the stance walk's ladder EXHAUSTED at (471.6,441.1) on `enemy:iceturret@472,400`'s live body; AVOID "different connected components" | not run | rejected: the live body cuts the only corridor, and the stand is hit anyway (W0) |
| (b) kill first by ICEST's `killIceTurretOnWalk` | REFUSED 20 u at t0: "no plannable staging point outside the range" on every side (the door is shut at t0, opens ~t100) | — | rejected alone |
| (b) + a pre-walk to the corridor's last point outside the range | REFUSED 12809 u: 490 forks, every approach hit by a blast. ICEST spends its delay OUTSIDE the range, where `IceTurret.update`'s `else` re-arms `shootTimer` (VOLLEY-APPROACH's finding) | — | rejected |
| (c) **kill first by APPROACH's search** (`approachKillForCorpse`: the loop's walk to a staging point past the range, then sides × routes × waits stood INSIDE the range, on forks) | **SOLVED 718 t, 2534 u**: the `up` side's 147 tries all hit at this arrival clock, the `right` side at wait 29 (276 forks) | **SOLVED 748 t, 323 u**: `up` via (466,445), wait 25 (27 forks) | **chosen** |

The door shut, design (c): 395 REFUSED 1405 u, 412 REFUSED 284 u, both on APPROACH's 12 `no-plan` forks at (488,579).
Rows: `m/node-arms.jsonl` (each arm named), `m/design.md`.

**Why a prerequisite, not a corpse weigh:** the brief's "known killer" was LWEIGH's corpse weigh, whose press stance is
behind the door. The keylock needs the turret dead, not its corpse moved: the 16×16 corpse leaves 16 px lanes either
side of it in the 48 px column, and the player's box is 4×5. So only the kill is asked, and `execCorpseWeigh` (and its
fade dwell, VOLLEY-APPROACH's wall) is never reached. **The fade dwell did not block this slice.**

**The side.** `approachKillForCorpse` tries its "push" side first; for a kill alone the side is free (an `IceTurret`
takes no knockback, the corpse stays where it dies), so the arm passes the direction from the player to the turret. On
both arrivals that is `up` (the south face). 395's arrival clock makes every `up` wait hit, and the `right` side solves
after them: that order is where 395's 2484 fork units go.

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, beside `APPROACH_DOOR`): `KEYLOCK_TURRET = { enabled }` (`SEEDLING_KEYLOCK_TURRET ===
'1'`), `KEYLOCK_TURRET_DEFAULT = false`, `withKeylockTurret`, `KEYLOCK_TURRET_COUNTS` (`stances`, `kills`; written only ON,
read by nothing that decides) and `resetKeylockTurretCounts`. `solverEnvChannel.SOLVER_ENV_NAMES` gains
`SEEDLING_KEYLOCK_TURRET`.

**The code** (all in `solverBot.js`; lines touched: the switch block after `resetApproachDoorCounts`;
`resolveKeylockStrategy`'s destructure and its `stance`/`turretFirst` fields; one guarded call in `deriveKeylockStance`
before its sibling/sealed refusal; the new `keylockTurretStance` after `keylockCandidates`; one guarded call at the head of
`execKeylock`; the new `keylockTurretFirst` after it):
- `deriveKeylockStance`, ON and only on its refusal path with **0 candidate cells**, asks `keylockTurretStance`: the cells
  around the lock that `plannerObstacleAt` removes as an IceTurret's `proximity-hazard` name the turrets; their discs are
  exempted, `keylockCandidates` is asked again, and the first candidate `stanceReaches` reaches (the same hypothesis) is
  the stance. A live turret is carried as `turretFirst: {kill, stance, exempt}`; a dead one only exempts its disc. No
  turret named, or no reachable cell with the discs exempt: `null`, and the refusal is the one it was.
- `resolveKeylockStrategy` then returns `stance: null` (so neither the clear-tag arm nor the frontier walks into the
  range) and `turretFirst`.
- `execKeylock` → `keylockTurretFirst`: per live turret `requireVerb('kill', 'keylock:turretFirst', id)` (the strategy
  switch's nested-kill gate, before any fork), then `approachKillForCorpse(run, perTick, {corpse: {turret, dir}, exempt},
  ctx)`; the death read back off the live run (`fail` if not dead); then the loop's own `walkTo` to the stance with the
  discs exempt and the hold priced as its tail (`keylockStandWalk`, as the frontier prices it); then the lean and hold,
  unchanged.
- Nothing in `approachKillForCorpse`, `killIceTurretOnWalk`, `execCorpseWeigh`, `iceTurret.js`, `levelRun.js`,
  `dangerMap.js`, `strikePolicy.js`, `strategySwitch.js`, the clear-tag arm or the chooser is edited.

**The rows** (no fixture: the generated room is built in the test; the L40 staging is inline, ~1 KB, with the committed
atlas — the capture's own level records answer byte for byte, 412 SOLVED 748 at 322 units both ways):

| file | row | asserts |
|---|---|---|
| `hammerKeylockTurret.test.js` (fast, ~19 s) | ships OFF | `KEYLOCK_TURRET_DEFAULT` false; `enabled` follows the env; `withKeylockTurret` toggles it |
| | the gate | a source row: the kill sits under `requireVerb('kill', 'keylock:turretFirst', id)` at the loop's head, before `approachKillForCorpse` |
| | generated key line in a live turret's range | OFF "0 cell(s)"; ON the stance (88,184) with the turret live, then the kill refuses by name (*"no approach … is hitless"*: an open room has no cover) |
| | its controls | no turret, and the turret out of range: ON = OFF (SOLVED), counters empty |
| | L40 leg 412, tag 12 | OFF "0 cell(s)" from (328,600); ON SOLVED 748 `['keylock','walk']`, fresh run: hits [], deaths 0, the lock open, the turret dead; the kill `{side: up, wait: 25, forks: 27, ticks: 579}` |
| | L40 leg 412, door shut | ON refuses by name at (488,579), 12 `no-plan` forks |
| `hammerKeylockTurret.train.test.js` (train, ~69 s) | L40 leg 395, tag 12 | OFF "0 cell(s)" from (488,904); ON SOLVED 718, fresh run hitless/deathless, lock open; the kill `{side: right, wait: 29, forks: 276, ticks: 563}` |
| `hammerKeylockTurretL40.js` | (support) | the inline staging and the worker-path solve + fresh replay; imported by the two test files only |

**The mutants** (`tools/mutants.py`; each applied, the fast rows run, the file restored byte for byte, `mutants/`):

| mutant | red rows |
|---|---|
| M1 no derivation (`false &&` on the guard) | generated ON; 412 tag 12 ON; 412 door shut |
| M2 no kill (`for (const id of [])`) | the gate source row; generated ON; 412 tag 12 ON; 412 door shut |
| M4 the guard inverted (`!KEYLOCK_TURRET.enabled`) | generated (its OFF half); 412 tag 12 (its OFF half); 412 door shut |
| M3 the stance walk without the disc exemption | **none** — equivalent here: once the turret is dead, the loop's own `brave` row exempts a corpse's disc (`resolveBraveStrategy`: "a corpse does not shoot") |
| M5 a dead turret listed as live | **none** — equivalent: `approachKillForCorpse` returns null for a dead turret, and the death read-back passes. No row stages a dead turret at the derivation (residue) |

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| legs 395/412, tag 12 staged (node, captured requests) | 2 | REFUSED → **SOLVED** hitless |
| legs 395/412, tag 12 staged (page, p4g) | 2 | failed → **done**, 0 room hits |
| legs 395/412, door shut (node) | 2 | refusal text: "0 cell(s)" → the named kill refusal at (488,579) |
| the committed atlas (`m/radius-atlas.txt`) | — | only L40's `bosslock@480,352` has a key line inside a turret's disc (47 px); L98's turret has no lock |
| bounded set ON (93 fast files) | **0** | 2588/2588 |
| producer battery ON | see §6 | |
| other L40 legs, the route survey | not measured here | the planner's sweep / survey A/B (§7). A leg whose frontier names `bosslock@480,352` with 0 cells would move the same way |

## 6. D — the gates

GATES_PLACEHOLDER

## 7. What the harvest A/B should expect, and the ON dispatch

- **OFF: no movers.** Nothing is asked OFF; the identity block is byte-identical to the base (§6).
- **ON:** 395 and 412 move only when tag 12 is staged (the door carried). Without the staging (the sweep's default) they
  stay `failed`, the text moving to the named kill refusal at (488,579). No other leg is expected to move (the atlas has
  no other key line in a disc), but the route's L40 legs whose chain reaches the flag-8 lock are the ones to watch.
- **The ON sweep dispatch** (`seedling-divergence-sweep.yml`):
  - `keys` = `level_40__r23c29 <- in_L39_144_0 -> location:L40 flag 8: bosslock@480,352 cleared|level_40__r23c29 <- in_L43_176_464 -> location:L40 flag 8: bosslock@480,352 cleared`
  - `stage_flags` = `level_40__r23c29 <- in_L39_144_0 -> location:L40 flag 8: bosslock@480,352 cleared=>40:12|level_40__r23c29 <- in_L43_176_464 -> location:L40 flag 8: bosslock@480,352 cleared=>40:12`
  - `solver_env` = `SEEDLING_KEYLOCK_TURRET=1`, `shards` = 1 (defaults otherwise: `page` p4g, `mode` inv, `page_legs` 1)
  - Expect both `done`, 0 room hits. The door-shut control is the same dispatch with `stage_flags` empty: both `failed`
    by name. ⚠ 395's leg took 83 s of the 90 s leg budget here (the 640 pass, then the 2560 retry at ~28 s of solve, then
    the 718-tick play); a slower runner could cut it on wall time.
- The full-roster A/B (`solver_env` only, no `stage_flags`): expect 0 `done`/`failed` flips.

## 8. What the brief got wrong (measured)

- *"Its known killer is LWEIGH's corpse weigh"*: the keylock needs only the kill. The corpse weigh (and its fade dwell,
  VOLLEY-APPROACH's wall) is never reached; APPROACH's search, its kill half, is the killer here.
- *"Staging flag 12 … changes nothing (digest `5ef26e7cad6c`)"*: true of the OFF refusal, but tag 12 is not the door's own
  flag. It is the button room's (`buttonroom@880,768`); the door `wandlock@480,560` carries persistence tag 11 and fades
  open ~t100 after a build that holds tag 12 cleared. It changes the ON answer from a refusal to a solve.
- *"a timing window on the key line if the hazard is intermittent"*: the latch is one tick, but the line is unreachable
  past the live body, so there is no window to time.
- The brief's floor `2342e25604`: this slice started at `97739720`; the leg ids are unchanged.

## 9. Residue and hand-overs

- **The door in the visit** (census walls B/C/D/E): ON with the door shut the arm stops at APPROACH's staging point, as
  860 does. `APPROACH_DOOR` + `FIFTH_ORDER` + the burn (`STANCE_BURN`) are the existing arms for it; not measured
  together here (⚖ "solve in visit after that works").
- **395's margin**: 2534 of 2560 work units and 83 of 90 s on the page. The cost is APPROACH's side order (the `up` side's
  147 hit tries first). A cheaper first side (e.g. the side whose stance is nearest the keylock stance) is APPROACH's
  code, not edited here.
- **A dead turret at the derivation** (a visit that killed it earlier): exempted with no kill, by construction; no row
  stages it (M5 survives), because no L40 staging carries a dead turret and the generated room would need a two-goal
  solve.
- **The frontier path**: when the frontier itself names the lock (a goal north of it), the turret's `brave` row has
  usually already put its disc in the contacts, so the candidates are non-empty and this arm is not asked (measured on
  the generated room with a collect goal: OFF stands in the volley and the lock does not open in its bound — a
  `SolverBotError`, OFF's behaviour, unchanged here). Named, not fixed: the keylock hold under a braved live turret is
  the frontier's question.
- **Not committed:** the captured requests (~3.7 MB); the README names the re-capture commands. The census's report and
  evidence (from its unharvested branch) were read in place and not committed.
