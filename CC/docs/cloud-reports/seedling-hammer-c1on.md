# Seedling HAMMER-PHASE — slice C1-ON: `STATIC_SWORD_ARM` and `CHOOSER_HIT_SOURCES` ship ON

Slice `seedling-hammer-c1on` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-10):
*"Yes, please turn both of them on."*

| | |
|---|---|
| Start SHA | `e45c9d2a9f` (= `origin/main` at the fetch; ≥ `c0e067961a`, ancestor checked) |
| Head | the commit carrying this report (D1 `d9bc51e`, D2 `63471eb` + `4a57704`, D5 `d6e9c8a`) |
| Branch | `claude/seedling-hammer-c1on-jqbsct` (the harness names it; the brief's `seedling-hammer-c1on`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9571` (`SEEDLING_PORT=9571`), PID 696, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS on C1's list, ⛔ STOP on two unlisted unit rows (§D2.2) · D3 PASS (locally; CI dispatch refused, 403) · D4 not enrolled · D5 PASS** |

## The one thing to know first

**The flip moves exactly C1's movers on the node side and in the page, plus two unit rows C1 did not list.** Those
two are left RED on the branch for the planner: `fidelityStance.test.js` and `turretSolver.test.js`. CI's JS Unit
Tests read 19,555/19,557 at `4a57704`. Both rows pass with the switches `=0`. One moves with `STATIC_SWORD_ARM`
alone, which C1 said moves nothing but its own rows. The patches are written out in §D2.2, but not applied.

In the page, 0 of the 130 legs the switches can reach went solved → refused. Sweep-3's 544, 550, 551 and 553 went
refused → solved, as C1 predicted.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-c1on-jqbsct origin/main` | `e45c9d2a9f` |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0; `bulletml-dodge` was `-` → `git submodule update --init` → `7423ee86` |
| identity block | `SEEDLING_PORT=9571 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`4647e1e050a9e76273ddc937ca301360`** = C1's base, row for row (ENEMY `30bcc49c`, r9-campaign `b064c264`, reference ALL 7 + 5 MATCH) |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted | **589**, `e6c073f99ac92cd28a56f4a95a17d325` |
| surface / constants / entities / profile | each `--check` | GREEN **237** · PASS **5,506** · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` `.tapes` | **266** |
| bounded vitest BEFORE | 21 files: every test naming either switch, `withStaticSwordArm`, `withChooserHitSources`, `KILL_ARM_POLICY`, `killArmModelled`, `ropeSword` (14), the hammer set (`hammerApproach`, `hammerEscape`, `hammerFight`, `hammerFightFallback`), `solverBot`, `solverBotLethalPit`, `solverSpinnerKill`, `combatVerbs`, plus `tapeRunner` | **1438/1438** |

## D1 — the flip (PASS; `d9bc51e`)

- `enemyDamage.STATIC_SWORD_ARM.enabled = env.SEEDLING_STATIC_SWORD_ARM !== '0'`.
- `solverBot.CHOOSER_HIT_SOURCES.enabled = env.SEEDLING_CHOOSER_HIT_SOURCES !== '0'`; its mode stays `empty`
  (`_MODE=order` is still the measurement arm).
- In the browser `process` is absent, so the page worker sees both ON.
- The docblocks say ON with the `=0` opt-out. `withStaticSwordArm` / `withChooserHitSources` and every OFF row are
  kept as the controls.
- `fidelityStaticSword.test.js`: the "ships OFF" rows now pin ON. The `killArmModelled` control flips to OFF inside
  its `try` and restores ON.
- `check-seedling-hammer-monotonicity.mjs`: its `off` capture deleted the env vars, which after the flip would run
  the capture child ON while the re-solve's `off` sets both false, a replay mismatch. The capture now sets both C1
  vars to `'0'` before the mode's own env; `c1` is the shipped pair.
- `plan-seedling-c1-static-sword.mjs` and `probe-seedling-static-sword-mobiles.mjs` already pass both values
  explicitly. Unchanged; `plan … --check` is all green at head.

## D2 — the node movers

### 1. C1's list, re-recorded (PASS)

Measured with the identity block ON at `d9bc51e`: **two rows move, and nothing else.**

| mover | before → after | command | control (`=0` on both) |
|---|---|---|---|
| ENEMY census | `30bcc49ca8ae998fe24600ac647ae1a4` → **`ad84493cea1714607e6c675d7462efbe`**. One row: `turret` corridor **REFUSED → SOLVED 221** (kill, collect); the CORRIDOR arm `{REFUSED 15, SOLVED 7, THREW 1}` → `{14, 8, 1}` | `node scripts/procgen/census-seedling-enemies.mjs` | `30bcc49c` |
| r9-campaign | `--check` `b064c264…` exit 0 → `e30fa83f…` **exit 1, 6 FAILURE(S)**: exactly `r8-solve-6`, `r8-solve-8`, `r9-solve-12`, `-14`, `-16`, `-29` (trace DRIFT). Re-recorded by **`node scripts/procgen/solve-seedling-r9-campaign.mjs`** (its own write, headless latches). Each diff only adds the `sources` array (+36/−9 lines over the six). `--check` → **`712f0eada1a7baab29bccf6de86f0997` exit 0**; the chain is still 10,931 t. Every tape is unchanged | as left | the six drift back (the inverse) |
| `ropeSword.test.js` | `{kind:'danger', id:'arrowtrap@96,32'}` → `+ sources: ['arrowLane:arrowtrap@96,32']` (`63471eb`) | the test | — |
| `fidelityStaticSword.test.js` "ships OFF" | pins OFF → pins ON (D1) | the test | the OFF rows are the controls |

The six traces' consumers (`exportSeedlingView`, `reachClosure`, `walkReport`, `watchOverlays`, `decisionTrace`,
`director`): 280/280. tapeRunner pairs ON: 589, `e6c073f9` (unchanged).

⚠ The ENEMY row has no committed artifact beyond `standing-values.json`, which is the bank's (no
`standing-values --write` here). It is quoted for the bank:
`identity: ENEMY census default` `ad84493cea1714607e6c675d7462efbe` @ this head, and `r9-campaign --check`
`712f0eada1a7baab29bccf6de86f0997`.

### 2. ⛔ STOP — two rows C1 did NOT list (not re-recorded)

CI's JS Unit Tests at `4a57704` (run `38109634563`): **2 failed / 19,557**, and both reproduce locally. With
`SEEDLING_STATIC_SWORD_ARM=0 SEEDLING_CHOOSER_HIT_SOURCES=0` both files are 19/19.

| row | moves with | what changed | proposed patch (not applied) |
|---|---|---|---|
| `fidelityStance.test.js` › *"L8 → L7 from the L9 door (the JS arc's sweep leg 85, no items): LADDER, the ceiling presser named"* (l. 144) | **`STATIC_SWORD_ARM` alone** (`=0` on it → 15/15) | the kill line now leads with the static arm's why: `kill: static sword arm: sandtrap@96,128: the run's \`primary\` slot holds NOTHING — … · the ceiling: the ceiling's presser button@64,48 (group t=0, arming [arrowtrap@96,16]) has no stance …`. The regex `/kill: the ceiling's presser button@64,48 …/` no longer matches | `/kill: static sword arm: sandtrap@96,128: the run's \`primary\` slot holds NOTHING[\s\S]*· the ceiling: the ceiling's presser button@64,48 \(group t=0, arming \[arrowtrap@96,16\]\) has no stance/` |
| `turretSolver.test.js` › *"route step 27 … the ladder refuses AVOID and DODGEs U14's spit, by name"* (l. 81) | `CHOOSER_HIT_SOURCES` (the `sources` field) | `{kind:'danger', id:'turret@80,176#3'}` → `+ sources: ['spit:turret@80,176#3']` | the `ropeSword` shape: add `sources: ['spit:turret@80,176#3']` |

Both changes are the mechanism C1 measured. The first is sweep leg 85's new text (C1 §D4.1, *"the run's `primary`
slot holds NOTHING"*), pinned in a unit row C1's harvest did not run. The second is the `sources` field on a fifth
consumer. They are surprises against the list all the same, so they wait for the planner. **The branch's JS Unit
Tests stay red on exactly these two rows until then.**

## D3 — the page (PASS, locally)

⛔ **CI dispatch was refused**: `403 Resource not accessible by integration` for all four workflows (the MCP; `gh`'s
token is invalid). Pushing a `seedling-probe/**` or `seedling-survey/**` ref would be another branch. So the page
side ran **locally**: p4f, headless logic-only (every probe and sweep page printed the CHANNEL line), with the worker
served from this branch by `serve-nocache.py 9571`. Dispatches owed, for the planner:

- `seedling-full-tier.yml` (defaults) on `claude/seedling-hammer-c1on-jqbsct`;
- `seedling-probe.yml -f battery=standard`;
- `seedling-divergence-sweep.yml` (defaults), the whole 843 legs;
- `seedling-survey.yml -f through=end -f route=full -f only=31 -f shards=1`.

### Standard probe battery (local mirror of the workflow's step: same probes, same args)

| probe | checks | wall |
|---|---|---|
| wasm-logical-links `--only=B` | 16 PASS | 776 s |
| wasm-vanilla-map | 23 PASS | 869 s |
| wasm-arrival-composites | 95 PASS | 118 s |
| wasm-midroom-replan `--only=D` | 10 PASS | 31 s |
| restart-route `--only=W,J` | 18 PASS | 59 s |
| restart-warp `--only=W,J` | 28 PASS | 80 s |
| wasm-adopt | 51 PASS | 175 s |
| obstacle-events `--only=W,J` | 22 PASS | 82 s |
| wasm-generated-playback | 35 PASS | 44 s |
| loop-restart | 30 PASS | 62 s |

**10/10, 328 checks, 0 FAIL.** No probe expectation moved.

### The divergence sweep, against sweep-3 (CI run `38010249317`, `divergence-merged`)

⚠ **Leg ids shifted.** At this head `seedling-divergence-legs.mjs` plans 843 legs; sweep-3 had 841. The L62 legs moved
by +2: sweep-3's 544 is today's 546. So every comparison is by **leg key** (`seedlingDivergenceLegs.legKey`).

**Reach.** Both switches act only where the room's census holds a spinner (the chooser), or a `SandTrap` or `Turret`
(the chooser in a stepped room, and the static arm). The atlas has such entities in 12 levels (6, 8, 16, 18, 29, 36,
39, 40, 59, 62, 65, 92), so the sweep covered **130 of 843 legs**:
`probe-seedling-divergence-sweep.mjs --keys=<those 130> --mode=inv --producer=solver --page=seedling_bot_ap_p4f --page-legs=1`.

| sweep-3 id → now | key | sweep-3 → now |
|---|---|---|
| **solved → refused** | — | **none** |
| 544 → 546 | `level_62 <- in_L61_160_0 -> exit:out_teleporter_240_304` | failed → **done** (335 t, ends L63 (72,24)) |
| 550 → 552 | `level_62 <- in_L63_64_0 -> exit:out_teleporter_48_304` | failed → **done** (347 t, `kill`, ends L61 (120,24)) |
| 551 → 553 | `level_62 <- in_L63_64_0 -> exit:out_teleporter_96_304` | failed → **done** (326 t, `kill`, ends L61 (168,24)) |
| 553 → 555 | `level_62 <- in_L63_64_0 -> exit:out_teleporter_192_304` | failed → **done** (361 t, `kill`, ends L63 (24,24)) |
| 539 → 541 | `level_62 <- in_L61_112_0 -> exit:out_teleporter_240_304` | failed → failed, new text: *"no corridor for goal reach-exit toward (226,256) … Obstacle: solid:bonetorch (bonetorch@128,288)"* (was the turret's EXHAUSTED ladder) |
| 549 → 551 | `level_62 <- in_L63_16_0 -> exit:out_teleporter_240_304` | the same new text as 539 |
| 552 → 554 | `level_62 <- in_L63_64_0 -> exit:out_teleporter_112_64` | failed → failed, now on `darktrap@112,208` (was `turret@232,248`) |
| 85 | `level_8 <- in_L9_144_0 -> exit:out_stairsup_144_32` | failed → failed, gains the static arm's *"`primary` slot holds NOTHING"* |
| 76 | `level_6 <- in_L7_16_32 -> exit:out_teleporter_32_0` | failed → failed, **byte-identical** |
| 376 → 378 | `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | failed (*"the dwell was HIT"*) → **timeout**: the solver now PLANS 1,832 t (hold, kill, walk; 50.6 s), and the leg's wall clock stopped it mid-playback at 1,141 t drained, with no divergence |
| 388 → 390, 395 → 397, 412 → 414 | three L40 legs (an exit to L43, the chest twice) | failed → **timeout** (budget, cancelled while solving) |
| the other 118 | — | identical `end` and text |

- Every solved leg ends exactly where C1's node replay ended (§D4.1's `end`), with no divergence and no recovery.
  The page's tick counts are the arrival-path tape's own (C1's node numbers were 233/209/220/252).
- The four L40 timeouts are **BUDGET-BOUND, not verdicts**. The chooser carries the L40 climbs past t0 into the
  spinner press kill, which is C1's A and its §D4.3 cost (95.7 % in `execKillByPress`). Re-run them on CI with a
  larger budget before reading them.

### Survey step 31 (node; the survey's own solver)

`node scripts/procgen/survey-seedling-route.mjs --through=end --only=31` (route `full`):
- Sweep-3's refusal at t0 (the L36 sandtraps) is gone.
- It now refuses on the chest's own stance walk: *"chest (64,48) stance waypoint 1 (72,66): the route entered a
  proximity-hazard — chest at (64,48) … at (72.98,68.00)"*. That is STANCE's family, as C1 §D4.1 predicted.

## D4 — the witnesses: NOT enrolled

Enrolling `c1-l62-turret` / `c1-l36-sandtraps` means:
- moving or copying the tapes into `fixtures/tapes/`;
- adding `index.json` and tier rows (the roster count 266 → 268);
- re-quoting the composite roster row.

That is more than a one-line union, so it is residue. They keep replaying ON and OFF in `fidelityStaticSword.test.js`
(14/14), and `plan-seedling-c1-static-sword.mjs --check` is all green.

## D5 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase C1-ON — the two switches ship ON*.
- `seedling-bot.md`: C1's paragraph says ON (with the `=0` opt-out) and names what moved.
- Constants: `--write` (29 literals moved by line only), then `--check` PASS **5,506**, 0 moved.
- Surface: `--write` (3 import lines), then `--check` GREEN **237**.
- Entities 528 / profile 138 PASS.
- The reference regenerated (`generate-procgen-reference.mjs`), then `--check`: ALL 7 + 5 MATCH.
- **Bounded vitest AFTER**: W0's 22 files plus `boxLock.test.js`, `seedlingConstantsCensus.test.js`,
  `procgenDocs/generated.test.js` and `entityBlocks.test.js`. **1573/1573**: `generated.test.js` read 54/55 until
  the reference was regenerated after the log edit, then 55/55. tapeRunner pairs 589, `e6c073f9`.
- **Identity block AFTER** at `d6e9c8a`: exactly two rows differ from W0's: ENEMY `ad84493c` and r9-campaign `--check` `712f0ead` exit 0. Every other row equals the base, producers included. The reference row read DIFFER because the log was edited while the block ran (the docs index's word counts); regenerated after, it is ALL 7 + 5 MATCH. The block's non-`#` md5, with that reference row, is `1d2216534720a3398a3892753202e44a`.

## Deltas (base → head)

- Identity: ENEMY `30bcc49c` → `ad84493c`; r9-campaign `--check` `b064c264` → `712f0ead`. Every other row is equal.
- Six committed traces (`sources` only); the `ropeSword` pin; the `fidelityStaticSword` default rows; the
  monotonicity checker's `off` capture env.
- No tape, wasm, gitlink, AS3 or rules change; `KILL_ARM_POLICY` untouched.

## What the brief got wrong (measured)

- *"`ropeSword.test.js` … and this slice's own 'ships OFF' rows"* is not the whole unit-pin list. Two more rows move
  (§D2.2): `turretSolver.test.js` (the `sources` field) and `fidelityStance.test.js`. The latter moves with
  **`STATIC_SWORD_ARM` alone**, against C1 §D4.4's *"STATIC alone … only this slice's own 'ships OFF' rows"*.
  C1's bounded harvest did not include either file.
- *"diff verdicts against sweep-3 … 544/550/551/553 turn SOLVED"*: true by **key**. By id they are 546/552/553/555
  today, because the leg list grew by two before L62.
- The CI dispatches the brief asks for could not be made from this session (403).

## Residue

- ⛔ The two §D2.2 rows (the branch's JS Unit Tests are red on them): the planner's licence to re-record, with the
  patches above.
- The four L40 legs: re-run on CI with a larger budget. 376's 1,832-tick plan never finished its playback here.
- The full CI tier, the full 843-leg sweep, and survey step 31 on CI: owed dispatches (§D3).
- The standing values for the bank: ENEMY `ad84493c`, r9-campaign `712f0ead`.
- Witness enrolment (D4). C1's residue stands: 539/549's stance walk on L62's pit maze, 552's darktrap (F1),
  survey 31's chest stance (STANCE), and L40's press-kill cost.
- Tree dirt: none tracked. Scratch (not committed): the identity logs, the vitest JSONs, the sweep rows and the
  diff, sweep-3's downloaded artifact, the battery logs, and the survey JSON (`.cache/seedling-survey/`, gitignored).
