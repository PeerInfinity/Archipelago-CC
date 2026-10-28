# Seedling hammer-phase ICEST — the walk's kill rung kills a static IceTurret (`ICETURRET_STATIC_KILL`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-iceturret-static` (planner `seedling-hammer-phase-planning-2`), cloud |
| Start SHA | `9066e869` (main, "Merge origin/main a84c416724 into the CPAIR harvest") |
| Head | the code is `3e8dafe1` (I) and `6e7dda58` (D: the pocket row, docs); this report is the last commit |
| Branch | `claude/seedling-hammer-iceturret-static-juuw8y` (the harness's designated branch; the brief's `seedling-hammer-iceturret-static` name was not used) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-iceturret-static-evidence/` |
| Scope messages | none arrived mid-run |

## 2. The answer first

**The census: the turret blocks almost nothing.** No measured climb outside the latch chain has a live IceTurret on
the hit or in its smallest admitting set:

| workload | climbs with the live turret in the room | turret in the hit | turret in the smallest admitting set |
|---|---|---|---|
| 60 captured L40 requests, each at its own seam | 56 | **0** | **0** (50 empty climbs, all chaser sets: the x≈744 trio with the bobsoldier, the west bobs with `puncher@128,624`) |
| route survey, 240 rows | 2 (L40, t0) | **0** | **0** (both: `bobsoldier@880,832` + both x≈744 bobs) |
| latch chain (L40LATCH staging), t271 | 1 | 0 | **1**: `bob@736,800` + `bob@736,752` + `iceturret@472,400` (size 3; no single or pair) |
| latch chain with chasers unscoped (CPAIR's D2u scratch), t577 | 1 | **1** (its only source) | none of size ≤ 3; inclusion-minimal = the same triple (`bob@736,800` dying, `bob@736,752` alive) |
| generated control (`census-seedling-enemies`' corridor room, level 900) | 1 | **1** | **1**, a single removal |
| `l40bk2b` scratch (OPP + `orbitFreeAim` + `strategyBoundDistinct`), 853/854 request 1, seams ±3 | — | 1 of 14 seams (854 d+3) | — |

**The design chosen: both halves, measured.** Design 1 (the chooser hypothesises a live turret, single and as a CPAIR
set partner) and design 2 (`hitSourceBodies` admits a live turret from the hit) hand the SAME arm a turret. They are
one switch with a `mode` knob (`SEEDLING_ICETURRET_STATIC_KILL_MODE=chooser|hit`, a measurement arm; the default is
`both`). On the latch chain neither half alone reaches the turret's kill (§4), so both ship together.

**The arm** (`killIceTurretOnWalk`) calls the existing kills, it does not change them. It walks the live run to a
staging point outside the turret's 129 px range. Then, for each start delay, it tries on FORKS the standing kill
(`killIceTurretInPlace`, approached on the fork) and the circling kills (`circleKillIceTurret`). The first try that
ends with the turret dead, no hit and no blast in flight is replayed on the live run, and the death is read back there.

**Does the turret die in the model?** Yes, where a hitless try exists:
- the generated control: 1 tile tall, OFF refuses, ON SOLVES in 263 t; the keys replay on a fresh run to the same death;
- **`iceturret@472,400` on L40**, from CORPSEBUMP's pocket boot with the weigh unarmed (`blockSweepBodies` OFF): OFF the
  walk refuses at t0 on the turret; ON the arm kills it in 69 ticks, hitless, and the prefix replays on a fresh run to
  the same death.

**Does its corpse block?** The corpse stays: `dead`, not `removed` (only a fatal tile under it removes it). It is a
**16x16** Solid where the run left it (`levelWorld.collidesSolid`'s turret arm), not the live 32x32 box (a live turret is
no Solid at all, only a contact), and harmless to the danger map with `corpseBumpWeigh` ON. In the generated corridor
it does not block (the snapped body leaves the corridor's top 8 px). On L40 it does not block the walk either, but it is
the route's KEY: `button@480,384`, which opens `wandlock@448,432`, wants the corpse as its weight.

**The measured effect:**

| workload | OFF | ON | ON + CPAIR size 3 | ON + CPAIR size 3 + OPP |
|---|---|---|---|---|
| latch chain | t271, `bob@736,800` | **= OFF, byte for byte** | the triple admits, `bob@736,800` dies, t577 the turret is handed to the arm (`via: hit`): **no try is hitless** (490 forks: 98 the turret's body on the approach, 392 a blast while circling), refused by name at t833 | the same |
| L40 pocket, weigh unarmed | t0, `iceturret@472,400` | **turret dead (69 t, hitless)**, then the walk stalls on `wandlock@448,432` | — | — |
| generated corridor, 1 tile | REFUSED | **SOLVED** 263 t | — | — |
| generated corridor, 2 tiles | REFUSED | REFUSED by the arm's name (no hitless try) | — | — |
| 60 L40 requests | 41 solved | **60/60 identical** | — | — |
| route survey | 240 rows | **240/240 identical** (ms aside) | — | — |
| r9 campaign (`--check` in the producer roster) | PASS | **PASS** | — | — |
| `l40bk2b` 853/854 req 1, 14 seams | 12 refuse on the bobsoldier / an x≈744 bob, 854 d+2 another refusal, 854 d+3 on the turret | **2 move** (854 d+2, d+3): the chooser names the turret, the arm has no staging point (no tick spent), the run ends on `spinner@816,848` | **14 move**: the turret is handed on every seam; on 8 the arm runs into the anytime deadline (11–23 tries at the `crusher-fork` site; each fork replays the whole 1300–2900-tick segment) | — |

**What the chain meets next** (named, not fixed):
- **On the latch chain:** the approach to `iceturret@472,400` from below. A walk that enters the range draws the volley.
  Two findings explain it. First, start delays outside the range cannot re-time the volley, because the turret's clock
  re-arms out of range. Second, the straight radial line from the south (x 488) is blocked by `pushableblockfire`, which
  the chain's own shove left at (488,495). The room's own answer is the corpse weigh from the pocket: booted at (480,456)
  with the same latch persistence, Boss Key 2 SOLVES OFF (4495 t), with the circling kill and the corpse pushed onto
  `button@480,384`. The latch chain instead plans to STAND on that button (`hold stance (wandlock@448,432)`), inside
  the turret's range. That strategy choice is the real gap.
- **From the pocket (weigh unarmed):** `wandlock@448,432`. Its button wants the corpse, which is the weigh's job.
- **On `l40bk2b` + CPAIR size 3:** the arm's own cost under the anytime deadline (each fork replays the whole segment).
- `bobsoldier@880,832` and the press kill are untouched; on `l40bk2b` with ICEST alone, 12 of 14 seams still stop on them.

**Is the switch ready to flip?** **No.** It is safe: OFF is byte-identical, and ON no measured workload ships a hit or
loses a solve. But it is not useful yet. The one natural L40 use, the latch chain, finds no hitless kill. Its one L40
kill (the pocket, weigh unarmed) leads to a lock that only the corpse weigh opens. And under the page's anytime budget
the arm is deadline-bound.

**The one thing to know first:** on L40 the turret's corpse is not the obstacle, it is the key. The weigh already kills
the turret hitlessly from the pocket and uses the corpse as `button@480,384`'s weight. Killing the turret from the walk
back west is a worse route than the weigh, and from below it is not hitless at all.

## 3. W0 — the base and the census

| row | result |
|---|---|
| base | `git fetch origin main` → `9066e869`; `claude/seedling-hammer-iceturret-static-juuw8y` reset onto it |
| bootstrap | `session_bootstrap.sh --seedling` → READY, node v22.22.0; the six non-wasm submodules initialised |
| identity block (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, the six producer `--check`s exit 0, reference ALL MATCH. **Every row equals CPAIR's published values** (its W0 and after). ⚠ My first edits began while this block ran; its rows equal CPAIR's at the base, so it stands as the base by quotation |
| `ci-producer-checks --jobs=4` | not run at the base (box time went to the census replays); at the head, OFF and ON: 94 run, 0 red (§6) |
| bounded set at the base (`bounded-files.txt`; every test naming `killIceTurretInPlace`, `circleKillIceTurret`, `killForCorpse`, `STATIC_SWORD_ARM`, `hitSourceBodies`, `chooseBodyToRemove`, `CHOOSER_PAIR`, every L40/iceTurret/turretCircle/hammer row, plus `fidelityCorpseBump`/`fidelityKillLock`) | a pristine worktree at `9066e869`: **35 files, 490/490** (`bounded-base.txt`) |
| the L40 capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, CPAIR's 52 L40 leg KEYS, this tree on :8000: 52 legs (39 done, 12 failed, 1 timeout), **60 requests**, 853/854 two each (seams 5936 and 5429). The capture (~31 MB) is not committed |

**The instrument** (`tools/census.patch`, applied in a scratch worktree only). On every climb it logs:
- the hit's sources, the room's live turrets, and whether a turret is among the sources;
- where the chooser's list is empty and a turret is live: the smallest sets (≤ 3, from the hit's chasers, the 4 nearest
  chasers and the live turrets) whose removal admits, whether every chaser's or every volume's removal admits, and an
  inclusion-minimal admitting set (every volume removed, then each put back, farthest from the hit first).

It asks the chooser's own question and decides nothing. The rows are `census-latch-off.jsonl`, `census-latch-d2u.jsonl`,
`census-radius.jsonl`, `census-survey.jsonl` and `census-enemy-iceturret.jsonl`. The table in §2 is their summary.

## 4. M — the design table and the scratch measurements

The latch chain (`l40LatchSolve`'s staging; `holdWaitPriced` + `chaserOrbitKill` are ON by default now):

| arm | t271 | t577 | verdict |
|---|---|---|---|
| OFF | refuses on `bob@736,800` | — | |
| CPAIR size 3 alone (`latch-cp3-only.txt`) | refuses (no chaser set admits) | — | inert |
| ICEST `hit` + CPAIR 3 (`latch-cp3-hit.txt`) | refuses (no turret partner) | — | inert |
| ICEST `chooser` + CPAIR 3 (`latch-cp3-chooser.txt`) | the triple admits; `bob@736,800` killed | refuses: the turret's single removal does not admit (`bob@736,752` lives), so it is not named | half |
| **ICEST `both` + CPAIR 3** (`latch-on-cp3.txt`) | the triple admits | the turret handed `via: hit` → no hitless try (490 forks) | **built** |
| ICEST `both` alone (`latch-on.txt`) | **= OFF byte for byte** | — | inert |
| ICEST `both` + CPAIR 3 + OPP (`latch-cp3-opp.txt`) | as `both` + CPAIR 3 | as `both` + CPAIR 3 | OPP changes nothing |

The generated control kills alike under `chooser`, `hit` and `both` (`m-generated-modes.txt`).

**How the arm came to be (measured, in order, on the latch chain with CPAIR 3):**
1. `killForCorpse` called from the walk (the brief's "call the existing machinery"): its stance came off the UNSNAPPED
   box. A turret off screen has not taken `input()`'s 8 px stationary-axis snap; L40's sits at y 416 and snaps to 424.
   So the below stance stood inside the live body: three body contacts from t908, a death at t958. The walk then
   continued after the death (the walk executor does not stop on a hit), and the respawned bobsoldier killed the
   player twice more.
2. The side off the snapped box, and a refusal on any hit: the walk to the stance arrived just as a volley left (t914),
   frozen (a blast's `Player.freeze` is not a hit) and then hit.
3. A faced shield (the latch staging holds one; `iceBlastShield` ON): the blast still landed (t917).
4. The fork-certified approach (the staging point outside the range; delays, the approach and the kill tried
   together on forks), with circles from the staging point, a planned approach, lead points fanned 20–40 px out and
   ±16 px across, and the delay before or after the approach: no try is hitless on the latch chain. The tallies run
   from 265 to 490 forks, and every failure is a blast or the turret's body. One intermediate variant is kept as
   `tools/forkcert-approach.patch`.
5. The braved `killForCorpse` route on the generated control: the live stance walk is refused by its own danger
   probe, because the danger map prices the turret at its UNSNAPPED placement (`dangerMap.js`, out of scope). The
   fork-certified approach is stepped on the fork's own run, so the snapped body, not the map, decides.

So the built arm is (4) in the shape that kills the generated control and the L40 pocket turret. Its tries are the
standing kill, delay before or after, plus 8 circles, over 49 delays.

**The pocket answer** (`m-lp480-off.txt`, `m-lp480-on.txt`): the latch boot's persistence booted at (480,456) SOLVES
Boss Key 2 OFF in 4495 t through the weigh (the circling kill, `cw` from corner 3, delay 0, 1 fork; the corpse onto
`button@480,384`). ON is identical, because the weigh kills first and the arm is never handed the turret.

**The `orbitFreeAim` scratch merge** (measurement only, not shipped). `origin/fidelity-harvest/l40bk2b` (`dc7f94a0`)
merges into main with conflicts only in docs, generated files and `boxLock.test.js` (taken from main's side);
`solverBot.js` merges cleanly, and ICEST's diff applies on top. With OPP + `orbitFreeAim` + `strategyBoundDistinct` ON,
853/854 request 1 at seams ±3 (`bk2b-*.jsonl`):
- OFF: 853 refuses on the bobsoldier (5) and `bob@736,800` (2); 854 on the bobsoldier (5), another refusal (d+2), and
  `iceturret@472,400` (d+3). **1 of 14 reaches the turret on this capture** (the brief's 4 of 14 was BK2B's own capture).
- ICEST: 2 of 14 move (854 d+2, d+3). The chooser names the turret (its single removal admits there), but the arm has
  no staging point: three sides have none on the normal, and the `up` staging walk refuses with no tick spent. The run
  ends on `spinner@816,848`'s press kill instead.
- ICEST + CPAIR 3: 14 of 14 move. The turret is handed on every seam (12 first via the chooser, 2 via the hit). The
  arm spends up to 3565 ticks (its staging walk) and on 8 seams runs into the anytime deadline (most at the
  `crusher-fork` site after 11–23 tries); 3 seams end on the bobsoldier and 3 on `spinner@816,848`. Nothing solves.

## 5. I — the switch, the rows, the mutants, the ON radius

**The switch** (`solverBot.js`, beside `CHOOSER_PAIR`):
- `ICETURRET_STATIC_KILL = { enabled, mode }`: `enabled` is `SEEDLING_ICETURRET_STATIC_KILL === '1'`, and `mode` is
  `both` unless `SEEDLING_ICETURRET_STATIC_KILL_MODE` names `chooser` or `hit`;
- `ICETURRET_STATIC_KILL_DEFAULT = false`, `withIceTurretStaticKill(enabled, fn, mode)`;
- `ICETURRET_STATIC_KILL_COUNTS` (`handed`, `kills`; written only ON, read by nothing that decides) and
  `resetIceTurretStaticKillCounts()`.

The code:
- `liveIceTurretBodies(run)`: the live turrets the run steps, as static chooser entries (`iceTurret: true`);
- the chooser's stepped-room statics, CPAIR's partner pool (after the near chasers), and `hitSourceBodies` (ahead of
  C1's static-sword branch, which would `continue` past any `enemy` source) admit them;
- the kill rung's `iceTurret` branch (before the static arm): `killIceTurretOnWalk`, the re-entry guard
  (`killingTurrets`, `body#tick`, `ICEST_REENTRY`), and the instrument;
- `killIceTurretOnWalk` itself, with `ICE_TURRET_STAGE_CLEAR` 8, `ICE_TURRET_STAGE_REACH` 240 and
  `ICE_TURRET_APPROACH_DELAY_MAX` 48. `ICE_TURRET` is imported through `solverView.js`.

`killIceTurretInPlace`, `circleKillIceTurret` and `killForCorpse` are unchanged. OFF, the climb runs one new statement
per site, the `ICETURRET_STATIC_KILL.enabled` test.

**The rows** (`hammerIceTurretStatic.test.js`, 7 rows, ~7 s; the rooms are built in the test, no fixture file):

| row | asserts |
|---|---|
| ships OFF | `ICETURRET_STATIC_KILL_DEFAULT` false; `enabled` follows the env; `mode` `both` |
| the 1-tall corridor | OFF REFUSED, the kill rung's "not a body this run can watch die"; ON SOLVED, `handed` `[{iceturret@64,16, t0, chooser}]`, `kills[0].dead`, the record `{arm: 'iceturret', side: 'down', stance: (88,18)}` (off the snapped box), the goal collected |
| the 1-tall corridor's replay | the shipped keys on a fresh run: the turret dead, no hit, `{dead: true, removed: false}` |
| the 2-tall corridor | ON refuses by the arm's name, no tick spent; the other rungs read as OFF's |
| no turret on the hit | a bob in the same corridor: ON = OFF, nothing handed |
| **L40's pocket, the weigh unarmed** | OFF refuses at t0 on `iceturret@472,400`; ON `handed` `[{t0, chooser}]`, `kills` `[{dead: true, ticks: 69}]`, the refusal names `wandlock@448,432`; the refused prefix replays on a fresh run to the death, hitless, the corpse not removed |
| TURRETCIRCLE's corpse weigh | `killIceTurretInPlace`'s circling kill: the record and the keys identical ON, nothing handed |

`hammerIceTurretStatic.slow.test.js` (the slow tier: 325 s and 178 s here):
- the latch chain ON alone = OFF byte for byte (t271);
- with CPAIR size 3, handed at t577 and refused by name, with no hit.

**The mutants** (`tools/mutants.py`, `mutants.txt`; each applied, the file run, restored):

| mutant | red rows |
|---|---|
| M1 drop the arm | 1-tall, its replay, 2-tall, the pocket |
| M2 hand the arm a turret it cannot reach (an id no run steps) | 1-tall, its replay, 2-tall, the pocket |
| M2b the side off the UNSNAPPED box | 1-tall, its replay, the pocket |
| M3 treat the corpse as gone (removed on the death tick, `iceTurret.js`) | the replay, the pocket, TURRETCIRCLE's weigh |

**The ON radius by mover class:**

| workload | movers | class |
|---|---|---|
| 60 L40 requests | 0 | — |
| route survey, 240 rows | 0 | — |
| r9 campaign | 0 | in the producer roster ON |
| latch chain | 0 alone; with CPAIR 3 the walk runs on from t271 to the arm's refusal at t833 | refusal moves, no hit, no solve |
| L40 pocket, weigh unarmed | 1 | **a kill**: the turret dies in the model; the refusal moves to `wandlock@448,432` |
| `l40bk2b` 853/854, 14 seams | 2 alone; 14 with CPAIR 3 | refusal text (the chooser names the turret; the arm declines or runs out of deadline); no solve, no hit |
| generated corridor (1 tile) | 1 | **a solve** |
| bounded set ON (36 files) | 1: CORPSEBUMP's `blockSweepBodies`-OFF control | the pocket kill above; that row now pins ICEST OFF (its ON answer is the new pocket row) |
| producer roster ON | 94 run, **0 red**, 1 skipped | |

**A flip is not ready** (§2).

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52; `bounded-files-head.txt`) | OFF 36 files, **497/497** (`bounded-off.txt`) · ON before the pin 495/496 (the CORPSEBUMP control above; the run had 6 of my 7 rows, `bounded-off-6rows.txt` is its OFF twin) · **ON after the pin 36 files, 497/497** (`bounded-on.txt`) |
| hammer `.slow` files (`hammerDashShape.slow`, `hammerEscapeGenerated.slow`, `hammerIceTurretStatic.slow`) | 3 files, **4/4** (`slow-hammer.txt`) |
| `ci-producer-checks --jobs=4` | OFF 94 run, **0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, a browser arm CI runs) · `SEEDLING_ICETURRET_STATIC_KILL=1` 94 run, **0 red**, 1 skipped (`producer-off.txt`, `producer-on.txt`; run on a frozen tree) |
| identity block at the head (`identity-after.txt`) | **byte-identical to W0**, every row (a first try read 2 rows off from my own concurrent work: the generated set could not take the box lock, the reference differed mid-edit; re-run on a quiet box) |
| `census-seedling-solver-surface --check` | RED on site counts (one new `ICE_TURRET` site) → `--write` → GREEN, **360 rows** (no new row) |
| `census-seedling-constants --check` | PASS (6977 literals, 0 new) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README word counts, docs index) → ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS, 415 PASS, 0 FAIL** (`wasm-ship.txt`) |
| JSUT at `3e8dafe1` (run 40630915564) | slow battery **273/273**; 28 red in shard 1 (before the D commit's `census-seedling-solver-surface --write`) |
| JSUT at `2ba8b244` (run 40636864822) | the three vitest shards, the producer `--check`s and the headless gates **green**; the slow battery was still running at this commit (read it with `ci-summary.mjs --run=40636864822`) |

## 7. What the planner's harvest A/B should expect

- **Switch OFF: no movers.** OFF, the climb runs only the `ICETURRET_STATIC_KILL.enabled` tests. The evidence: the
  identity block, the producer roster, the bounded set, and the latch chain and generated rows OFF.
- **`SEEDLING_ICETURRET_STATIC_KILL=1` (node half):** the 52-leg L40 sweep and the survey should not move. The 60
  requests and the 240 rows are identical, and no climb there has the turret on the hit. The r9 campaign does not move.
- The page's worker has no `process`, so the env cannot turn the switch on in the browser half of the sweep (OPP's and
  CPAIR's precedent).
- With BK2B's keys merged as well: 854 seams near d+2/d+3 of this capture move (refusal text). With CPAIR size 3 on top,
  every 853/854 seam hands the turret to the arm and runs into the anytime deadline.

## 8. What the brief got wrong (measured)

- *"With L40LATCH's unscoped chaser scratch the bobs die"*: at t577 `bob@736,800` is dying (3 hits) and `bob@736,752`
  is alive with 0 hits. Both are still in the danger volumes, and the inclusion-minimal set there is still the triple.
- *"legs 853/854 request 1 reach `iceturret@472,400` on 4 of 14 seams"*: that was BK2B's own capture. On this capture
  (seams 5936/5429) with OPP + both BK2B keys, 1 of 14 (854 d+3) refuses on the turret.
- *"call the existing `killIceTurretInPlace` / `circleKillIceTurret` machinery, then re-climb"*: called from the walk's
  arrival it is not enough. The stance must come off the SNAPPED box, and the approach must be certified with the kill
  on a fork. The braved stance walk was hit, frozen, and, unsnapped, ran into the body (§4).
- *"a staged or cut-fixture row where OFF refuses on `iceturret@472,400` and ON kills it"*: the latch chain cannot kill
  it hitlessly, so the row lives on CORPSEBUMP's pocket boot with the weigh unarmed (`blockSweepBodies` OFF).
- *"A dead turret's CORPSE still has a body"*: yes, but a 16x16 one where the run left it, not the 32x32 box; the live
  body is not a Solid at all (`levelWorld.ENTITY_CLASSES.iceturret`).
- *"one generated level with an IceTurret"*: the generator's palette places none (`procgenPalette.js` names the class
  only in a refusal reason). The control is `census-seedling-enemies`' hand-drawn corridor room (level 900), solved
  through the generator's own oracle (`procgenOracle.solve`).
- The branch: the harness designated `claude/seedling-hammer-iceturret-static-juuw8y`, so that is where the commits are.

## 9. Residue and hand-overs

- **To the strategy layer (the latch chain's order):** the walk back west plans `hold stance (wandlock@448,432)`, the
  player standing on `button@480,384` inside the turret's range. From the pocket the same room solves through the corpse
  weigh. The chain should reach the weigh, not the hold; that is an order choice, not a kill arm.
- **To fidelity (`dangerMap.js`):** a live IceTurret is priced at its UNSNAPPED placement, and the live body moves 8 px
  on its first on-screen `input()`. That is why the 1-tall generated corridor refuses OFF (the snapped body leaves 8 px
  open), and why the braved stance walk refuses its own snapped stance.
- **To the executor (`walkTo` / `botDriverV2`):** a walk does not stop on a player hit or death. In the first design the
  walk went on after the player died at t958 (the room reloaded, the bobsoldier respawned and killed the player twice
  more), and only the strategy bound refused. The arm refuses on any hit over its span; a walk in general does not.
- **The arm's cost:** each fork replays the whole segment from tick 0, so under the anytime deadline the arm gets 11–23
  tries on 853/854. A cheaper fork (a snapshot) is `levelRun`'s, out of scope.
- **The approach from outside the range** (latch chain): the turret's clock re-arms out of range, so a start delay
  cannot re-time the first volley; a radial approach is on the barrel's line; the shield did not stop the blasts in the
  standing kill. A volley-aware approach (an entry timed to the turret's own clock, or a tangential spiral in) is the
  arm this needs, if the weigh is not taken instead.
- **Not touched:** `bobsoldier@880,832` (fidelity's L40BK2B), the press kill, `strikePolicyFor`, `pressKillCost.js`.
- **The capture** (60 requests, ~31 MB) is not committed. The rooms of the rows are built in the test.
