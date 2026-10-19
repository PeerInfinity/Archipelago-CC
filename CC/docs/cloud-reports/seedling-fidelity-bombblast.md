# Seedling fidelity BOMBBLAST — a bomb's Explosion lands on a body

Session `seedling-fidelity-bombblast` (wave 19, model coverage; planner `seedling-fidelity-planning-9`).

**Verdict: W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS (measured, handed to hammer) · flip STOPPED (movers listed).**

| | |
|---|---|
| Start SHA | **`4667f7e353`** (= main, DIGEST on main) |
| Head | the commit carrying this report. Before it: W0 + D1 `3d099830`, D2 `b3a57e74`, D3 `3ce9e268`, records + measurements `863f497e` |
| Branch | `claude/bomb-blast-enemy-arm-b4akjp`. This is the harness's name; the brief said `seedling-fidelity-bombblast`. Nothing went to `main` |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-bombblast-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `xc/`, `survey/`, `sweep/`, `after/`, `tools/`) |

## The one thing to know first

**The arm is modelled, witnessed on the game, and reproduced at 0 px. Both witnesses also need `chaserSpinnerWalls`
ON.**
- `bombBlastBody` (OFF) lands `Explosion.as:62-65` on a stepped chaser and on a spinner. The walk's chaser forecast
  steps the same blasts.
- Two game witnesses reproduce over their whole tapes (1,533 and 1,579 ticks), covering:
  - one blast on a Bob and a Spinner together;
  - a Bob again, together with the player;
  - a Spinner killed by a blast.
- Each reproduces **only with `chaserSpinnerWalls` ON** (L40CONTACT D1, OFF by default). From t1219, `bob@304,144`
  stops on a spinner in the game and walks through it in the model. That is 75 ticks before any blast, and not this
  arm's.
- That is new game evidence for the L40CONTACT flip.

**For hammer (D4):** with the lapse ON and this switch ON, BW's bombstand ON solve **passes #11** and returns at t1667
with 0 hits. OFF, it stops at t1339 on #11's blast.

## W0 — the base (PASS)

The battery is `evidence/tools/battery.sh` (a copy of DIGEST's), run at the untouched base on port 9693.

| row | result |
|---|---|
| base | `git checkout -B … 4667f7e353`. The harness branch already sat at `4667f7e3` (`w0/sha-w0.txt`) |
| bootstrap | `session_bootstrap.sh --seedling` → `READY`, Node v22.22.0; server `serve-nocache.py 9693` |
| censuses | surface GREEN **312** · constants **6,028** PASS · entities PASS **566** · profile PASS **138** · roster **280** (`w0/censuses-w0.txt`) |
| tapeRunner pairs | **617 `8f27f975cfdd702f442f576e6f217d47`**, 0 non-pass |
| bounded vitest BEFORE | **74 files / 2,124 green** (`w0/vitest-files-w0.txt`, `w0/vitest-w0.txt`). Later, for the AFTER set, the 8 forecast-staging files not in W0's list were run at the base in a worktree: **8 / 187 green** (`w0/vitest-w0-extra.txt`) |
| identity block | md5 **`738b7ab5921f1df5df66a0277c81df5d`** (`w0/identity-w0.txt`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set **OK** |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 (= DIGEST's) |
| reference | 4 generated regions differ at the base (registry, capabilities, the two substrate charts). This is environmental, the same 4 MOVINGWAIT saw |

⚠ The first identity run (`w0/identity-w0-contended.txt`) overlapped my own game probe, which held the box. Its
"generated set" row read the lock notice. It was re-run alone, and that clean run is the row above.

## D1 — the game witness (PASS)

**The instrument.** `scripts/procgen/probe-seedling-bomb-blast-body.mjs` is new.
- It plays a tape on the game (p4f, headless, box taken).
- It keeps one sample per tick, the last poll before the tick advanced: every `Bob`, `BobSoldier` and `Spinner` row
  (position, velocity, anim, `hits`, `hits_timer`), the player and the bombs.
- It names each blast and each body whose `hits` moved.
- `--reuse` re-joins the model with no browser. `--record` writes a window-compacted fixture, only on a model PASS.

**The tapes.** Hammer BW's bombstand prefixes, extended with 240 idle ticks:
- `bombblast-l40-bw-idle`: the committed BW witness tape (t1..1293, lapse OFF) + idle.
- `bombblast-l40-bw-lapse1-idle`: the lapse-ON solve's executed prefix (t1..1339, from `tools/bw-solve.mjs`) + idle.

**What the game did** (`d1/game-*.log`, raw rows in `d1/game-*.json.gz`):

| tick | Explosion (int point) | body | before → after | what it shows |
|---|---|---|---|---|
| A t1294 | #10 (268, 118) | Bob at (269.955, 122.859) | hits 0 → 1, `hits_timer` 30, v (−0.360, 0.346) → (1.133, 4.057) | damage 1, 30 i-frames, knockback `4·(cos a, sin a)` from the blast point added to the chase velocity |
| A t1294 | same blast | Spinner at (262.090, 107.198) | hits 1 → 2, knocked back | one blast lands on every body in its disc |
| A t1340 | #11 (255, 131) | the same Bob | hits 1 → 2, knocked back | (the player is hit by the same blast: `hits` 0 → 1) |
| B t1339 | #11 (250, 160) | Spinner at (242.981, 147.216), 14.6 px from the point | **hits 2 → 3, velocity unchanged** | the killing hit does not knock back |
| B t1350 | | | Spinner rows 4 → 3 | removed 11 ticks after the blow, as a press kill is (t1274 → t1285 in the same tape) |

- **Death and drops.** `dieEffects("")` adds nothing: there is no drop on an `Enemy`, and a Bob's `startDeath` plays
  "die" only.
- **No Bob kill was witnessed.** The Bob path runs `enemyHit` + `stageChaserKill`, the arrow arm's own transcription,
  which is witnessed elsewhere.
- **The BobSoldier cannot be reached.** It sits at (880, 832). Every bomb is aimed at a player within 256 px of
  `bombpusher@112,128` and lands within about 8.5 px of that aim. L40 is the only room with a lobber.

## D2 — the model (PASS)

The change is behind **`CONTACT_FIDELITY.bombBlastBody`** (new, OFF; `SEEDLING_BOMB_BLAST_BODY=0|1`), in
`levelRun.drainBombBlastsNow` and two new closure functions:

- **`bombBlastHitChaser(b, c)`** uses `darkHitChaser`'s pair:
  - `enemyHit` with t `""`, force 4 and damage 1, frozen as the bomb stepped;
  - on a landed non-killing hit, `Enemy.knockback` from the blast's int point (a class with an empty `knockback` does
    not move);
  - a kill goes through `stageChaserKill(c, 'bomb', …, { t: ticksCompleted })`.
- **`bombBlastHitSpinner(b, id)`** uses `hitSpinner` with the same arguments. A kill is accounted as a dark hit's is:
  the `assertSpinnerKillIsAccounted` scan and a `spinnerKills` row, `weapon: 'bomb'`, `removedTick` = tick + 11.
- **The rows.** Each body gets one `bombEvents` row `what: 'body-hit'` (`{t, id, body, arm, landed, killed,
  refusedAt, hitsAfter, hitsTimer, shoved}`). No new ledger kind, so no name pin moves.
- **Still refused.** A static census body in the square (no stepped state) refuses by name, as before. The
  `"ShieldBoss"` arm is unreached: no room has both.
- ⚠ **The tick.** The drain runs in `updateLists()`, after `ticksCompleted++`. The arm's rows carry `ticksCompleted`
  (the blast row's own `t`). The player's `playerHits` row from the same blast reads one tick on (`applyPlayerHit`'s
  convention; BW already reads #7's t1156 blast as "t1157's ledger row").

**The witnesses, reproduced** (`probe … --reuse`, `SEEDLING_BOMB_BLAST_BODY=1 SEEDLING_CHASER_SPINNER_WALLS=1`):
- A: **PASS 1..1533**. This covers the blasts, the player's hits, its death at t1432 and the room reset.
- B: **PASS 1..1579**.
- Bodies are compared to 1e-9 on position and velocity, and exactly on `hits` / `hits_timer` (a spinner on position
  and hits: `spinnerBodies` has no velocity).
- OFF, A refuses at t1294 by name, as before.
- Recorded: `fixtures/bombblast-witness/bombblast-l40-bw-idle.json` (window 1285..1375) and
  `…-lapse1-idle.json` (window 1330..1360), with the tape and the game's camera.
- Replayed by **`fidelityBombBlast.test.js`** (8 rows: 6 for D2, 2 for D3).

⚠ **A one-tick projection lag the probe reads around, not mine.** The run's `spinnerBodies` keeps a faded spinner
(alpha −0.10) one tick after the game removed it, at t1285 for the existing press kill and t1350 for the blast kill
alike. The kill ledger's `removedTick` equals the game's (1285 / 1350). The probe and the test read alpha < 0 as gone,
and say so.

**Mutants** (predicted, made by copy + restore, `d2/`):
- M1, blast force 0: only A's ON row fails.
- M2, spinner `removedTick` + 1: only B's ON row fails.

## D3 — pricing in walks (PASS, same switch)

**Where.** `chaserForecastNow` (the forecast the walk's corridor and strike policy read). With the switch ON:
- It steps its own clones of the lobber and its bombs (`bombBlastClonesNow`, in `bombForecastNow`'s order: bombs first,
  then the lobber against the previewed player where the tick started). These are the same bombs
  `run.spitForecast()` prices against the same walk.
- A bomb removed on tick k lands at the **top of step k+1** (`flushBombBlasts`). That is after the tick's press (`hit`,
  which the caller applies after `step` returns) and before the bodies move, which is where `Explosion.added()` sits.
- The landing uses `darkHitChaser` + knockback. A kill is staged as `hit`'s is (`dyingAt`), and a forecast spinner
  (only under `chaserSpinnerWalls`) is hit by `hitSpinner`.

**The same switch, because it moves the same rows.** D3 only changes walks in a room with a lobber, and there the live
arm is what makes the run step at all.

**Witness** (test rows 7–8, `d3/`). On A, a forecast taken after t1285 and stepped with the live player each tick
holds `bob@272,112` at **0 px through t1300**:
- t1294's projection still reads hits 0 (the press's own convention: `step` returns before the tick's
  `updateLists()`);
- from t1295, the hits and the i-frame equal the live run's;
- a forecast built OFF never takes the blast: hits 0, and 8 px astray by t1297.

**Mutants:**
- M3, no flush: the D3 row fails.
- M4, flush after stepping (a tick early): the D3 row fails.

⚠ **Not covered, handed to hammer:** the *spinner* forecast the walk prices spinners with (`spinnerForecast` /
`spinnerForecastWithPress`, the hit-aware spinner forecast) holds no bomb blast. A blast knocks a spinner back
(A t1294) or kills it (B t1339), and the walk's spinner rows will not know. Those functions are hammer-phase's.

## D4 — the INTERIM (measured; hammer decides)

Tool: `evidence/tools/bw-solve.mjs`. It runs the producer's own `bombStandSolve` construction with `MOVING_WAIT` ON and
`PRESS_KILL_BOMBS` ON, **as in the witness**. Nothing was `--write`n.

| lapse | `bombBlastBody` | ticks | outcome | #11 | player hits | `run.stateDigest()` at the end | keys md5 |
|---|---|---|---|---|---|---|---|
| **ON** | OFF (base) | 1339 | threw: #11's Explosion at (250,160) reaches `spinner@192,160` (by name) | **FAIL** | 0 | `046cd38f8afec414d05043f73043` | `45b02820…` |
| **ON** | **ON** | **1667** | **returned (no refusal)**; #11 kills `spinner@192,160` at t1339, then blasts #12–#21 land on nobody | **PASS** | **0** | `1bcc6e70c3176a05b217fcbff158` | `a00e20d4…` |
| OFF (the pin) | OFF | 1294 | threw: #10 reaches `bob@272,112` (by name) | n/a | 0 | `06a40ba49766900cd012d7190d39` | `cf808fd8…` |
| OFF (the pin) | ON | 1572 | passes #10 (Bob 0→1, Spinner 1→2 at t1294), then threw a **solver** refusal: collect (64,144), combat ladder EXHAUSTED at `chaser:bob@272,112` | n/a | 0 | `1e71a52ae2ecea0633bc1177f657` | `95a9bc49…` |

`plan-seedling-hammer-bw-bombstand --check` with `SEEDLING_BOMB_BLAST_BODY=1` (`d4/producer-check-on.out`):
- **2 rows move.** Both pin a blast refusal: "it stops on #10's blast" and "the INTERIM pin's witness: lapse ON stops at
  t1339".
- The committed tape stays **byte-identical** (its prefix is cut at t1293).
- OFF, all six rows pass (`producer-check-off.out`).
- **For hammer:** the lapse-ON pin can retire with this switch ON. The pin-OFF row now ends in a combat-ladder refusal
  in hammer's own solver region.

## Hammer XC — the escape (PASS: nothing for the digest)

`closure-census.mjs --from=ticksCompleted,state,level,world,previewStepper,spinnerForecastWithPress,gameTimeAt,progress`
(DIGEST D1's members), run on the base and on the D3 tree (`xc/`):
- **144 reached units in both, the same set.** None of `bombBlastHitChaser`, `bombBlastHitSpinner`,
  `bombBlastClonesNow`, `chaserForecastNow` or `drainBombBlastsNow` is reached.
- The read-in-reach binding set is identical (53).
- The change adds no binding. What it writes (chaser and spinner state, `bombEvents`, `spinnerKills`, `chaserKills`)
  are existing bindings.
- **No `stateDigestParts` field is owed.**

## The rows this moves (before → after), and the CI dispatches to confirm

The arm is inert outside a room holding a lobber or a bomb (both halves return early), and **L40 is the only such
room**. So the reachable rows are L40's.

| measurement | OFF | ON |
|---|---|---|
| survey L40 steps 78 / 108 / 110 / 112 (`survey/`) | REFUSED / REFUSED / SOLVED / REFUSED | **byte-identical** (each row's JSON, timings stripped) |
| local sweep, all L40 legs at the default switches (`sweep/l40-*`): 18 legs ran (376, 377, 379, 380, 382–387, 378, 396–398, 381, 413–415) | done 7 · failed 10 · probe-error 1 | 17/18 identical by key; **414** moved within `failed`: its seam clock was 4972 vs 4981, and the ladder names a different arm of `spinner@880,848`, ~620 px from the lobber. That is run noise |
| legs 378 / 381 (key `level_40__r0c53 <- in_L41_0_160` / `<- in_L42_240_336`), default; + `movingWait`; each ± `bombBlastBody` (`sweep/k-*`) | refused: no reachable stance in `buttonroom@160,128` | identical in all four sets. In the sweep's staging, these legs stop before any blast |
| bounded vitest (83 files) | green (`after/vitest-final.txt`) | ON (env) 1 red, the shipped-defaults pin. Default flipped in code: **2 reds**, `contactFidelity` "the shipped defaults" and `fidelityBombBlast` "bombBlastBody ships OFF" |
| hammer's bombstand `--check` | 6 PASS | 2 FAIL (D4) |

⚠ The local L40 sweep ran 18 of the 40 legs it was handed. The probe printed "40 legs in 3 page(s)" and wrote 18 rows,
the same 18 in both runs; the rest did not run. It is one sample per leg.

**Dispatches for the planner** (branch `claude/bomb-blast-enemy-arm-b4akjp`):
1. `seedling-divergence-sweep.yml`, A/B with no code edit:
   - A: `contact_fidelity=<the default ON keys>`;
   - B: the same keys `,bombBlastBody`;
   - the default ON list at this base is the 30 keys `formatContactFidelity(CONTACT_FIDELITY_DEFAULTS)` prints;
   - then a ×2 repeat on any moved key.
   - A third arm, `…,bombBlastBody,chaserSpinnerWalls`, measures the pair the witnesses need.
2. `seedling-survey.yml -f through=end -f route=full -f only=78,108,110,112`. ⚠ The workflow takes no switch input, so
   an ON survey needs a flip-probe commit. Locally the four steps are byte-identical, and no other step can reach the
   arm.

## The JS arc

- **No contract changed.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are
  untouched. There is no new staging field and no new refusal kind.
- **To wire:** the new switch rides `CONTACT_FIDELITY`. The sweep's `contact_fidelity` input and the request stamp
  (`contactFidelityStamp`) already carry any key, so the worker reads it with no change.
- **No `run.*` field renamed or reshaped.** `bombEvents` gains rows of a new `what` (`'body-hit'`), ON only.
  `seedlingSkinRenderer.test.js` is green in the bounded set.

## Hand-overs to hammer

1. **D4** above: with the lapse ON and `bombBlastBody` ON, #11 passes and the solve returns at t1667 with 0 hits.
   Retire vs re-bank is hammer's call.
2. **The spinner forecast and blasts** (D3's uncovered half). It is the walk-side pricing of a blast on a spinner, in
   `spinnerForecast` / `spinnerForecastWithPress`. Measured: A t1294 (a knockback), B t1339 (a kill).

## What the brief got wrong (measured)

- **"Legs 378/381 refuse at #9/#10's Explosion on `bob@272,112`."** That holds only in hammer's node staging with
  `PRESS_KILL_BOMBS` ON. In the wasm sweep at this base, both legs refuse earlier (no reachable stance in
  `buttonroom@160,128`), under the default switches and under `movingWait` alike. One sample per set.
- **"With the lapse ON, its ON solve stops on #11's blast on a body."** True, but the ON solve with this switch does
  not merely pass #11: it **finishes** (t1667, 0 hits).
- **The 0-px reproduction needs a second OFF switch.** The brief did not anticipate it: `chaserSpinnerWalls` (L40CONTACT
  D1) is needed for a pre-blast Bob divergence at t1219.
- **The "Bob vs a spinner vs a BobSoldier" comparison has one impossible arm.** No bomb can reach L40's BobSoldier.

## Residue

- No Bob kill by a blast was witnessed. The arm reuses `stageChaserKill` (the arrow arm's transcription), and the kill
  row's `t` is the blast tick.
- The local sweep ran 18 of 40 L40 legs.
- `FAMILY_RULES`' BOMB text (the hold refusal) is untouched; this change does not reach it.
- The `spinnerBodies` one-tick lag after a fade is pre-existing, shared with the press kill. It is noted for its owner.

## Byte-inertia (OFF)

| row | W0 | AFTER (OFF) |
|---|---|---|
| identity block | `738b7ab5…` | `after/identity-final.txt` (md5 `70f0983b…`): **every value row and the generated-set row equal W0's**. Its one differing line is the reference count, 8 vs 4: the four extra regions were the docs index and the instruments citations, which my doc edits moved after the first regeneration. They were regenerated again in the report commit, and `--check` is back to the base's 4 environmental regions |
| six `--check`s | as W0 | **identical**, all exit 0 |
| tapeRunner pairs | 617 `8f27f975` | **617 `8f27f975cfdd702f442f576e6f217d47`**, 0 non-pass |
| censuses | GREEN 312 · 6,028 · 566 · 138 · roster 280 | GREEN **312** · **6,041** (rewritten, 0 drift) · **566** · **138** · roster **280** |
| bounded vitest | 74 / 2,124 + extras 8 / 187 = **2,311** | **83 files / 2,320 green** (`after/vitest-final.txt`). The per-file delta: + 8 `fidelityBombBlast`, + 1 `contactFidelityHook` (the new key's per-key row); every other file's count is identical |
| reference | 4 environmental regions differ | the same 4; `instruments.js` and `architecture.md`'s instruments region regenerated for the new probe |
| CI `JavaScript Unit Tests` | | At `863f497e` (run 39187714880), 3 red of 21,001: `generated.test.js` (the reference `--check`) and two `docsRender.test.js` heading-count rows, which read their pin from the generated docs index (1119 → 1120, 636 → 637: my log entry's heading). The report commit carries the regenerated reference, and `docsRender` is 46/46 green locally on it. **The CI row at the final head is quoted in the final chat message** |

Two reds in the first AFTER run were fixed before the final battery (`after/vitest-after-off.txt` shows them):
- `boxLock`: the new probe now carries a static `playwright` import and is declared among the guarded takers.
- `seedlingConstantsCensus` (b): `census-seedling-constants --write` rebanked 6,041 rows at 0 drift.

## Rows to BANK

- `fidelityBombBlast.test.js` (8 rows) and `fixtures/bombblast-witness/` (2 witnesses).
- `contactFidelity` "the shipped defaults" gains `bombBlastBody: false`.
- `boxLock`'s guarded-taker list gains `probe-seedling-bomb-blast-body.mjs`.
- The constants census: 6,041 rows.
- The roster is unchanged (280), as is `tapes/index.json`: no new roster tape.
