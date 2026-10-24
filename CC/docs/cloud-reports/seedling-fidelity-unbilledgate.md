# Seedling fidelity UNBILLEDGATE — refusing a solve whose drive took damage no plan billed

Session `seedling-fidelity-unbilledgate` (Opus build, cloud), planner `seedling-fidelity-planning-7`, wave 15 (model
coverage).

| | |
|---|---|
| Start SHA | `926cc2a86f` (main: wave 14 + its four-switch flip) |
| Head | the commit that adds this report (docs only), on `27f46ca` (CI 38324019162 green) |
| Harness branch | `claude/seedling-unbilledgate-f64y27` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (refusal built, OFF; candidate-level form handed over with numbers) · D3 PASS (STOP for the flip: 5 survey steps, 7 sweep legs and 3 procgen identity rows move; 0 tapes, 0 `--check`s, 0 real bounded reds)** |

## The one thing to know first

**Every unbilled hit the route survey accepts is real: the game takes it at the same tick.** At the base, route
steps 19, 47, 53, 114 and 170 return SOLVED walks whose drive is hit (step 53 dies twice). Each staged walk played on p4f
headless hits on the same ticks, and step 53 dies at t99 and t235 in the game as well. So the gate (`CONTACT_FIDELITY.unbilledDamageGate`, OFF) turns
those 5 SOLVED into named `unbilled-damage` refusals (169 → 164). It also moves **three procgen identity rows**:
empty pairs c3 and c6, and carved pairs c4. In each, one generated level's solve took unbilled spinner hits, so ON the
generator keeps another candidate. No tape, no producer `--check` and no real bounded red moves.
The second thing to know: **two sweep-5 legs (633, 635) are model gaps the gate cannot see**. The game's `hits_timer`
rises with no body nearby, and the model has no hit to bill.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `926cc2a86f` | bootstrap `READY`, node v22.22.0; server PID kept, port 9661 |
| identity block | `SEEDLING_PORT=9661 bash scripts/procgen/identity-block.sh .` | every row = the published bank (maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK). ⚠ The reference row first read **4 DIFFER**: the bootstrap's `READY` again left five non-wasm submodules uninitialised. After `git submodule update --init` on them: ALL 7 + 5 MATCH. With that row, the non-`#` md5 is **`77080c2ed34820619273d5d9d6fcdaa9`** (measured at head OFF, below) |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| surface / constants / entities / profile | each `--check` | GREEN **284** · PASS **5,841** · PASS 558 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE | 136 files: flip14's 97 (`census/bounded-files.txt` on its branch, which covers every name in the brief's standing list) + every non-slow test naming `forcedHits`, `worldHitsOf`, `playerHits`, `SolverRefusal`, `obstacle.kind` or `CONTACT_FIDELITY_KEYS` (`grep -a -l`) | **4,136 / 4,136**, sorted `status\tfile > name` md5 `42e3201868069d35e754a69dfa68f3fc`. ⚠ The first run read 4,135: `boxLock.test.js` audits every `.mjs` in `scripts/procgen/`, and this session's scratch probe copy was sitting there. Once it was moved out, the test is 26/26 |
| tapeRunner rows | the tapeRunner rows of the bounded run, sorted | **614**, `e882485a3b5008a386dfb20a5488da1c` (this report's method: every row naming `tapeRunner`; flip14 counted 611 by its own) |

Evidence: `seedling-fidelity-unbilledgate-evidence/w0/`.

## D1 — the census (PASS)

**The instrument.** `solverBot.UNBILLED_DAMAGE_TRACE.sink` (D2's read-only window) is called at every segment that
reached its goals. It reports `{name, boot, prefix, ticks, unbilled, deaths, billed}`, where `unbilled` is the
`playerHits` rows after the handover clock that `forcedHits` did not bill. A `NODE_OPTIONS=--import` preload
(`evidence/d1/drivers/census-preload.mjs`) installs it in every node process, child processes included. Installing it
changes nothing: the acceptance batch and the ENEMY census print `933c14f7` / `afdc6d1a` with it installed.

| set | segment successes | with unbilled damage |
|---|---|---|
| route survey `--through=end --route=full` (local, = CI 38310171450 on all 222 rows by level, goals, boot and occurrence: verdicts and ticks) | 170 (169 SOLVED + step 5's `withCommitted`) | **5**: steps 19, 47, 53, 114, 170. No forced hit is billed on the route |
| the six producers' `--check` (r8 battery, d2-chain, l18, tail; r9 l3, campaign) | 41 | **0** |
| acceptance batch + ENEMY census | 682 | **0** |
| sweep-5 legs in node (inv staging from the sweep row, `ANYTIME_PASSES`, no budget; `evidence/d1/drivers/inv-leg.mjs`) | 12 legs answered (the six L12 keylock legs refuse in this driver's staging, which does not reproduce the page's key state) | **10 legs**, below |

**The survey's five, each witnessed on the game** (the survey's staged walk, played on p4f headless by
`probe-seedling-chaser-mobiles.mjs --player-hits` through a scratch copy that also dumps the player rows,
`evidence/d1/drivers/probe-hits.diff`; clock shift exactly [0] on all five):

| step | level | ticks | model: unbilled hits (tape tick, source) | game: player `hits` rises | verdict |
|---|---|---|---|---|---|
| 19 | L17 (staged) | 122 | t101 chaser `bob@96,32` | t102 0→1 | **real**, same tick |
| 47 | L22 (staged) | 201 | t83 wallflyer `wallflyer@64,80` | t84 0→1 | **real**; the bodies also agree at 0 px (201 comparisons) |
| 53 | L22 (staged) | 406 | t39 `wallflyer@144,112`, t66/t98† `@48,112`, t143 `@48,112`, t171/t234† `@144,112`; **2 deaths** | t40, t67, **t99 reset** (death), t144, t172, **t235 reset** | **real**, both deaths in the game |
| 114 | L88 (staged) | 476 | t47, t109 drill `drill@128,160` | t48, t110 | **real** |
| 170 | L77 (staged) | 480 | t16 chaser `lavarunner@112,256` | t17 | **real** |

The model's ledger records a hit at run tick `t` = tape tick + 1, and the game sample at `t` reads it. The `FAIL` body
lines for 19, 53 and 170 compare bodies of another class (or none): those positions differ, and the player's hits
do not.

**Sweep-5's 17 legs**, re-derived by KEY (every id is the same as sweep-5's) and re-run in node at the base:

| leg | node at base (OFF) | the model's unbilled hits | reading |
|---|---|---|---|
| 262 | 229 t walk | t57 `wallflyer@128,80` | real (model-predicted) |
| 265 | 123 t walk | t71 `wallflyer@48,112`, t111 `bob@96,144` | real. Contact probe on the game: hits 1 by t106, and the play leaves the plan at t112 by 0.04 px, right after the bob hit |
| 283 | 182 t walk | t79 `wallflyer@48,48` (the dashless pass: t115 `@64,48`) | real |
| 288 / 289 | 106 t / 135 t walk | **only the dashless candidate** (t70 `wallflyer@48,48`); the returned full-pass plan is clean | OFF already answers clean |
| 302 | 126 t walk | t15 `wallflyer@192,48` (dashless: 5 hits and a **death**) | real |
| 696 / 698 / 703 | 476 / 379 / 213 t walk | the drill `drill@128,160`, ×2 / ×2 / ×1 | real |
| 622 | 4 t forced-hit | none; **billed 1** | the gate's control |
| 633 | 413 t dodge,walk | **none** | **model gap**: sweep-5's play left the plan at t81 by 4.85 px. Re-played on the game now, the page's solver refuses the leg (no play) |
| 635 | 515 t walk | **none** | **model gap**: on the game the player's `hits_timer` jumps to 19 at t279 with `hits` staying 0 and no body near; the model reads 0 |
| 624 | refused (danger map) | — | at the base 624 no longer solves (wave 14 changed the strike rule), so L74LEG624's drafts do not reproduce here |
| 130/131/140/141/160/161 | refused in this driver (`keylock cannot act`) | — | not reproduced: the page's key state is not staged by `inv-leg.mjs` |

**Model-only vs real.** Every unbilled hit the model records (survey and sweep) is a hit the game takes. None is
model-only. The two hits the game takes that the model does not record (633, 635) are model gaps, handed over below.

Evidence: `evidence/d1/` (census jsonl per set, `legs/`, `witness/` with the five walk tapes and the game's player
rows, the contact-divergence rows for 265/633/635).

## D2 — the gate (PASS)

**Which switch, and why a `CONTACT_FIDELITY` row.** The gate is a solver policy, as `baitForecast` and `forcedHits` are
(both are `CONTACT_FIDELITY` rows). Being a row there gives it, with no edit outside fidelity:
- the JS page's `?contactFidelity=`, the flashPanel setting `seedlingContactUnbilledDamageGate` (derived from the key
  list, so `contactFidelityHook.test.js` grows one row);
- the solve worker's off-default stamp;
- the divergence sweep's `contact_fidelity=` input, which makes the switch A/B dispatchable with no code edit.

Node: `SEEDLING_UNBILLED_DAMAGE_GATE=0|1`.

**The change** (`solverBot.js`, three edits, all inside `solveSegment` and new module-level exports):
- `UNBILLED_DAMAGE` (the switch), `UNBILLED_DAMAGE_TRACE` (the census window, `null` by default) and
  `unbilledDamageOf(run, since, forcedHits, tapeOf)` (the check).
- In the run view's `advance`, a run-clock → tape-tick map. It is kept only when the gate or the window asks.
- At success, after the trace is built and before `result`: the check against `ticked` (the run clock at the
  handover, so hits inside a replayed `prefix` are the prefix's). With the gate ON, any remainder throws through the
  segment's own `refuse` (so it carries `rows`, `perTick` and `dangerQueries`).

OFF, the check is not asked: one boolean read per segment, and nothing else changes.

**The refusal.** A `SolverRefusal` whose message starts `solverBot(<name>): UNBILLED DAMAGE — the segment reached its N
goal(s), but its drive took H hit(s) no plan billed [...]`. Its `goal` is the trace row's goal at the first hit. Its
`obstacle` carries:

| field | meaning |
|---|---|
| `kind` | `'unbilled-damage'` (**new**) |
| `id` | the first source body |
| `tick` | the tape tick (the page's clock) |
| `t` | the run clock |
| `level` | the level |
| `source` | `chaser` / `wallflyer` / `drill` / … (the ledger's) |
| `hits` | the count of unbilled hit rows |
| `deaths` | the count of death rows |
| `billed` | the forced-hit rows billed |
| `damage` | the unbilled hit rows |
| `died` | the death rows |

**Witness and test** (`fidelityUnbilledGate.test.js`, `fixtures/unbilled-witness/survey-step-47.json`: the tape, the
goals, and the game's `[t, level, hits, hits_timer]` at every sampled tick). Seven rows:
- the default is OFF;
- `unbilledDamageOf` (handover clock, billed rows, deaths);
- the game's rise at t84;
- OFF: step 47 solves and the window sees the hit;
- ON: step 47 refuses with the obstacle above;
- ON: a hit inside a replayed prefix is not the segment's (the rest of step 47 solves);
- ON: leg 622's billed forced hit still solves.

**Mutants** (predicted, then made by copy + restore):

| mutant | predicted | measured |
|---|---|---|
| M1: drop the billed filter | the unit row and the leg-622 control red | exactly those 2 |
| M2: count from clock 0, not `ticked` | the prefix row red | exactly that 1 |
| M3: the gate always on | the OFF row red | exactly that 1 |

**Whole segment vs candidate.** All 5 survey steps and the 7 sweep legs that refuse are single-decision `walk`
segments: one decision, 0 re-plans. The danger map reads the corridor as clean, and the body hits the drive anyway.
- **Inside `solveSegment` there is no next candidate.** A retry needs the hit body to become a danger the walk's
  planner routes around: the walk executor's ladder and the danger map's reading of wallflyers, drills and chasers. That is
  an executor edit, outside this slice's region.
- **One level up, the candidates already exist**: the anytime passes. On 288/289 the gate refuses the dirty dashless
  candidate and the clean full pass stands (both legs answer exactly as OFF). On the other 7 legs and the 5 survey steps,
  every pass's plan is hit, so a candidate retry would buy back **0** steps today.

⇒ The refusal is implemented. The candidate-level form is handed over with these numbers.

## D3 — the movers, ON (PASS; STOP for the flip)

| row | OFF (head) | ON |
|---|---|---|
| route survey, local, `--through=end --route=full` | 169 / 51 / 1 / 1 (= CI 38310171450, all 222 rows) | **164 / 56 / 1 / 1**: steps **19, 47, 53, 114, 170** SOLVED → REFUSED (`unbilled-damage`, the hits in the table above), nothing else moves (by level, goals, boot, occurrence; ticks included) |
| `surveyFamily` | the five ON refusals read `unclassified` | `UNBILLED-DAMAGE — the walk reached its goal but took N hit(s) …, the first at tN (source body)` (a new `FAMILY_RULES` row, appended; it matches nothing else) |
| sweep legs in node | as D1 | **262, 265, 283, 302, 696, 698, 703 refuse** (both passes); 288, 289, 622, 633, 635 answer exactly as OFF; 624 refuses as OFF |
| identity block | **`77080c2e…`** = W0 on every row | md5 **`697be6158e692c5ba77062bc8805c436`**: **three rows move**. Empty pairs c3 `4937da80` → `a6b02e2e`, c6 `430573e9` → `40688be9`, carved pairs c4 `b9d2185d` → `caa8cda2`. One line each (below). Every other row = OFF |
| six `--check`s | W0's six md5s, exit 0 | **unchanged**, all exit 0 |
| tapeRunner rows | 614, `e882485a` (= W0) | 614, `e882485a` |
| bounded vitest (137 files: W0's 136 + `fidelityUnbilledGate`) | 4,142 passed + 2 skipped by the env guard (re-run with no env: `contactFidelity` + `fidelityUnbilledGate` 70 / 70). Every W0 row is unchanged; 8 rows are new (7 gate rows, 1 `contactFidelityHook` setting row) | 4,140 passed, 2 red, both **artifacts**: `axeDodgeAskHook` "the default adds no field" reds under ANY off-default env switch (the `SEEDLING_MOVING_WAIT=1` control reds it the same way; it is green with no env); `surveyFamily` read the family row mid-edit (11 / 11 under the gate=1 env afterwards). **0 real reds** |
| producers' census under the gate | — | the 41 producer segments, 682 batch segments and every bounded solve are clean, so none can refuse |

**The three identity movers** (`dump-seedling-kind-pairs.mjs`, OFF vs ON, `evidence/d3/c{3,6,4}-gate{0,1}.txt`):

| row | line that moves | OFF → ON |
|---|---|---|
| c3 | `empty post-sword seed=7` | kept `963e5f3b` (186 → 440 t) → `53754a7a` (65 → 65 t) |
| c6 | `empty post-sword seed=7` | kept `1a213795` (186 → 377 t) → `9c943a22` (65 → 61 t) |
| c4 | `loopy post-sword seed=7` | level `b1ed7c73` → `307f32c7` (80 → 84 t; same kept) |

The census on c3's seed 7 names the reason: generated L900's 186-t solve takes `spinner@16,32` at t70 and t90, billed
by nothing. ON, that candidate is refused and the generator's next one is kept. These are generated rooms, so there
is no game level to witness them on. The spinner's contact is a game-measured model. They are movers the user
licenses with the flip.

**No committed tape and no producer `--check` digest moves with the gate ON** (no tape is re-recorded). The route
survey's 5 steps and the sweep's 7 legs are refusals telling the truth: the game takes each hit.

**For a flip licence, the movers are:**
- survey 19 / 47 / 53 / 114 / 170 (SOLVED → REFUSED);
- the identity block's c3, c6 and c4 rows (one generated level each, above), which the bank re-pins;
- sweep legs 262 / 265 / 283 / 302 / 696 / 698 / 703 (served → refused);
- `contactFidelity.test.js`'s defaults pin (`unbilledDamageGate: false` → `true`);
- `fidelityUnbilledGate.test.js`'s "ships OFF" row;
- the axeDodge default-request row would then read its default as the new set (no edit expected).

### The CI dispatches the planner should run

1. **Survey ON.** `seedling-survey.yml` has no `contact_fidelity` input, so ON needs the default flipped on a branch: a
   one-line commit `unbilledDamageGate: true` in `contactFidelity.js`. Dispatch it on that branch with `through=end
   route=full`, and dispatch the same at this branch's head for OFF. Expected: OFF = run 38310171450 on all 222 rows;
   ON = steps 19, 47, 53, 114, 170 → REFUSED, nothing else. (A cheaper ON dispatch: `only=19,47,53,114,170
   route=full through=end base_run=38310171450`.)
2. **Sweep A/B** (`seedling-divergence-sweep.yml`, branch `claude/seedling-unbilledgate-f64y27`, `mode=inv
   producer=solver`), twice:
   - `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,fallRockPostFall,forecastSpeedByTerrain,unbilledDamageGate`
     (the defaults + the gate);
   - the default (empty).

   Expected: the legs whose plans were hit become solver refusals of kind `unbilled-damage` (in node: 262, 265, 283,
   302, 696, 698, 703; under the page budget also any leg whose full pass is cut and whose dashless plan is hit, e.g.
   288 / 289). 633 and 635 do not move (model gaps). Add `leg_budget_ms` to match sweep-5 if the planner compares with it.
3. **Probe battery**: `seedling-probe.yml battery=standard` on this branch. Default OFF, so it should be byte-identical to
   main's.

## The JS arc's wiring

- **The kind**: `SolverRefusal.obstacle.kind === 'unbilled-damage'`, with the fields in D2's table.
- **The message**: starts `solverBot(<name>): UNBILLED DAMAGE —`.
- **The switch**: `CONTACT_FIDELITY.unbilledDamageGate` (OFF), the setting `flashPanel.seedlingContactUnbilledDamageGate`,
  and `?contactFidelity=` / the worker's stamp, all derived. No edit on the JS arc's side is needed to turn it on.
- **Which page paths see it**: any path that gets its answer from `solveSegment` success. That is a cold adoption /
  arrival solve (no prefix: every hit counts), a continuation (`prefix` replayed: only hits after the handover clock
  count) and a delivery (the same). The anytime layer (`ANYTIME_PASSES`) sees it per pass, so a dashless pass refused by
  the gate yields to the full pass (legs 288 / 289).
- **For the sweep row / analysis bucket / walk-note label**: `refusalKind`/`kind` from the produce service, plus the
  obstacle's `source` and `tick`. `surveyFamily` already files it `UNBILLED-DAMAGE`.
- **STAGEDHITS**: a hit inside a replayed prefix is not billed to the segment. A cold adoption with `player_damage`
  staged has no ledger rows for the staged hits (they are a starting state), so it is not refused for them either.
- **No JS-arc pin moves with the gate OFF.** With it ON, only the axeDodge default-request row (an env artifact).

## Handed over

- **To the fidelity arc (model gaps, not this gate's job):** legs 633 and 635. On 635 the game's `hits_timer` rises to 19
  at t279 with `hits` staying 0 and no body within the sampled rows: a hit with no damage from a source the model does
  not have. 633's sweep-5 play left the plan at t81 by 4.85 px; at the base the page's solver now refuses the leg.
- **To whoever owns the walk executor and the danger map's body readings** (the candidate-level retry): the five survey
  steps and seven legs are all walk-only segments hit by a wallflyer (47, 53, 262, 265, 283, 302), a drill (114, 696,
  698, 703) or a chaser (19, 170, 265's bob). A retry is worth steps only once the danger map prices those bodies along the
  corridor. The gate itself costs nothing to keep: one boolean per segment OFF, one ledger scan ON.
- Nothing to the hammer-phase arc.

## Deltas (files)

`solverBot.js` (the switch, the window, the check, the success-path refusal) · `contactFidelity.js` (one row + the env
line) · `contactFidelity.test.js` (the defaults pin + its env guard) · `fidelityUnbilledGate.test.js` +
`fixtures/unbilled-witness/survey-step-47.json` (new) · `surveyFamily.js` / `.test.js` (one appended row) ·
`seedling-solver-surface.json` (`--write`: three site counts) · `seedling-bot.md` (a paragraph) · `seedling-bot-log.md`
(the entry) · reference regenerated (`README.md`, `docsIndex.js`).

## What the brief got wrong (measured)

1. *"The L74LEG624 leg-624 drafts … re-run in node"*: they do not reproduce at the base. Wave 14 changed the strike rule
   and the flip turned three switches ON, so 624 now refuses (the danger map) with no unbilled plan to measure. The drafts'
   evidence stands as L74LEG624 recorded it.
2. *"Legs 265 and 633 tick-exact"*: 265 is model-predicted (the model has both hits, and the game leaves the plan
   0.04 px after the second). 633 is not: the model bills nothing, and the game left the plan at t81 by 4.85 px in
   sweep-5. It is a model gap, as is 635.
3. *"17 legs take game hits that no plan billed"*: at the base, 10 of them still take model-predicted unbilled hits.
   Two of those (288 / 289) only on the discarded dashless candidate, and two (633 / 635) are model gaps. The six L12
   keylock legs were not reproduced (staging).
4. The bootstrap's `READY` again left five non-wasm submodules uninitialised (the reference row read 4 DIFFER until
   `git submodule update --init`).
5. *"the forced-hit continuation guard"*: no committed producer or survey step bills a forced hit. The only billed
   crossing measured is 622's, and it passes the gate.

## Residue

- The survey workflow has no `contact_fidelity` input, so a survey A/B of any switch still needs a flip branch. That is
  a CI-input addition for whoever owns the workflow.
- The window (`UNBILLED_DAMAGE_TRACE`) has no committed driver. This report's census preload lives in the evidence
  dir.
- 633 / 635 (above). The six L12 keylock legs' census needs the page's key staging (`inv-leg.mjs` does not reproduce it).

## Byte-inertia

OFF, the gate is one boolean read per segment, and the window is `null`. The identity block at head OFF is
`77080c2e…` on every row (= W0). The tapeRunner rows are identical (614, `e882485a`). Every W0 bounded row is
unchanged. The local survey at head OFF equals CI 38310171450 on all 222 rows. ON, identity moves only c3, c6 and c4. Installing the window changes no
identity row (acceptance / ENEMY md5s unchanged).

## Rows to BANK

- identity OFF `77080c2ed34820619273d5d9d6fcdaa9`; ON `697be6158e692c5ba77062bc8805c436` (c3 `a6b02e2e`, c6 `40688be9`, c4 `caa8cda2`).
- bounded 137 files, OFF md5 `3411dd1f9ec9ab3210e2ba1eeb8498b1`; ON md5 `159e0c0c2b4a0bb5b9d9413432141df9` (2 artifact reds named above).
- surface GREEN 284 (`--write`); constants PASS 5,841; entities 558; profile 138; roster 277 (no tape added).
- survey OFF 169 SOLVED (= CI 38310171450); ON 164 (−19, −47, −53, −114, −170).
- CI (`JavaScript Unit Tests`) at `05bc8ad`: run 38320700792, success; vitest (unfiltered) 20,201 / 20,201, slow battery
  253 / 253. At `27f46ca` (the last code/evidence head before this report): run 38324019162, success; 20,201 / 20,201, slow
  253 / 253. This report's own commit is docs-only.

Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push.
