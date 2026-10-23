# Seedling fidelity SPEARRECT — the spear's test as the game runs it, for every spear arm (`spearGameTest`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-spearrect` (planner `seedling-fidelity-planning-10`, wave 25) |
| Start SHA | `e2b0f2b63f` (main; the brief's base) |
| Code head | `ffa4dbfa` (code); `b1fa1dca` (records); the report is the commit after it |
| Harness branch | `claude/spearrect-hit-test-1nkcoz` (the brief's `seedling-fidelity-spearrect`; nothing pushed elsewhere) |
| Port | 9714 (the pristine base worktree's own server: 9715) |
| Verdicts | **W0 PASS · D1 PASS (5 p4g witnesses, 0 px; the line waiver unwitnessed) · D2 PASS behind `spearGameTest` (OFF) · Movers: STOP for a licence (the list is below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-spearrect-evidence/` |

## The one thing to know first

**With `spearGameTest` ON every spear arm tests `Player.spear()`'s rule — the `int`-origined 32x5 rect with inclusive
edges, no reach gate, no line test, `spearForce` 7, and the T+3 / T+5 tests — and five p4g witnesses reproduce at 0 px
that the old model gets wrong in five different ways** (a T+3 hit on a mover, a hit 32 px up the rect, a corner touch at
half pixels, a far edge, a truncated origin that the float rect over-reaches). Two of those the brief did not name: the
spear borrowed `slash()`'s **16 px reach gate** (and its line of sight) in most arms, and handed `genericHit` the
**sword's force 5** — `spear()` has neither gate and passes `spearForce` 7 (the jellyfish witness's knockback found it).
**0 movers** on the local full route survey (250 steps, ON = OFF byte for byte) and on the four committed tapes that
thrust; the flip owes re-pins of **ledger-shape controls** (the press ledger gains the T+3 / T+5 rows), listed below.

## W0 — the base (PASS)

**`Player.spear()`, read** (`Player.as:954-992`, `:1341-1348`, `:142-148`, `:807-825`, `:1051`): `spearDelay`/`spearDelayMax`
1, so the test runs on alternate ticks while `spearing` holds (T+1, T+3, T+5: `presses.SPEAR_HIT_TICKS_UNMODELLED`, and
DRILL's and LIGHTS' witnesses); `spearDirection` is latched at the press (`set spearing`), the rect is rebuilt from the live
`spearX`/`spearY` (`int` getters) on every test; `collideRectInto(hitables[i], …)` → `Entity.collideRect` (`>=`/`<=`,
`Entity.as:263`; a masked entity is then tested by its mask); then `genericHit(v[i], "Spear", spearForce 7, spearDamage 2)`
for every collected entity — no `distanceRectPoint`, no `collideLine`. A press while `spearing` is ignored (`input()`'s
`if (!spearing)`).

**Every model arm that tests a spear (at the base), and what each can meet:**

| arm | rect / test at the base | reach / line at the base | force | repeats | the body can move into a later test? |
|---|---|---|---|---|---|
| audit (`pressRespondersIn`) | float `spearRect`, strict `rectsOverlap` | — | — | one | — |
| Tile (bridge) | audit | none | — | one (fitted: one decrement) | no |
| PushableBlockSpear | audit | none | — | one | no (refuses while moving) |
| BreakableRock | audit | none | — | one | no |
| RopeStart (`pullRope`) | audit | none for the spear (sword only) | — | one | no |
| LightPole | audit | none | — | one | no (its `hitsTimer`) |
| IceTurret | audit | none | `swordForce` 5 | one | rests ±0.5 px (a turret's rest cycle) |
| ShieldBoss | audit + body rect | 16 px reach + line (assert) | 5 | one | yes |
| Spinner | audit + body | 16 px + line (`spinnerSwingLineOfSight`) | 5 | one | yes |
| FinalBoss (Owl) | audit + body | 16 px + line (assert) | 5 | one | yes |
| Watcher | audit + eye | 16 px + line | — | one | — |
| drill (DRILL) | `spearTouchesDrill` (game rule) with `drillMixedRooms` | waived | — | T+3/T+5 (`drillSpearRepeats`) | yes |
| wallflyer | audit + body | 16 px + line | — | one | yes |
| static (hammer C1, `STATIC_SWORD_ARM`) | audit | 16 px; line waived for the spear | 5 | one | no |
| chaser (generic `Enemy`) | audit | 16 px | 5 | one | yes |
| BobBoss (`bobBossSlashNow`) | inclusive vs the float rect | 16 px + line | — | one | yes |
| LightBoss fliers (LIGHTS) | strict vs `spearRect` | waived | `spearForce` 7 | T+3/T+5 (`lightsSpearRepeats`) | yes |
| King of Fire (`lavaBossSlashNow`) | strict | 16 px + line | — | one | yes |
| Tentacled Beast | inclusive vs the float rect | 16 px + line; damage `SWORD_DAMAGE` | — | one | yes |
| solver stances | `spearRect` + strict `rectsOverlapLocal` (block push, runSpear's L0 check, turret, rope, light pole); `lightsVerb` forecast | — | — | C3's `spearRepeatReaches` refuses a mover near the repeats | — |

**The census where the game's rule differs, on the route** (`evidence/w0-tape-census.mjs` → `w0-tape-census.txt`): the
committed tapes that thrust the spear are four — `pushblock-l65-reach-l63`, `pushblock-l65-reach-l68`,
`r4-walk-6-health`, `r4-walk-full` (19 thrusts: blocks in L63/L65/L67 and the L65 pole). ON, every first test collects
exactly what OFF did, the 38 repeat rows are all inert (a moving block: `v.length > 0`; the pole: `hitsTimer > 0`), and
**0 observation streams move**. Off the tapes, the stances where the two rules part are found by a model search
(`evidence/d1-edge-search.mjs`, `d1-chaser-search.mjs`): integer stances where an edge touches (inclusive), fractional
ones a tap leaves (+1.7 px), half-pixel bodies (a resting turret), and chasers entering the rect beyond 16 px.

| row | result |
|---|---|
| identity block (`identity-block.sh`, pristine base worktree, port 9715; `evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640` (all exit 0) — equal to DRILL's head on every row. Reference: 4 DIFFER (environmental: registry/capabilities, as DRILL and ROPESTANCE measured) |
| tapeRunner pairs (`tapeRunner.test.js`, `fullName\tstatus` sorted, base worktree) | 635 rows, md5 `a02def3b2b47710b8825a88cd62f6c4c`, 0 non-pass |
| surface / constants | surface GREEN 342 at the base; constants `--check` PASS |
| bounded vitest BEFORE (`evidence/vitest-files.txt`: DRILL's 149 + every test that greps for what I touch: `spearRect`, `spearOrigin`, `swordWindowStep`, `SPEAR_HIT_TICKS`, `auditPress`, `pressRespondersIn`, the repeats, `runSpear`, `ropeSpearReach`, + `pushables`, `bridges`, `spearPush`, `fidelityLights*`, `jsRuntimeLightsWiring`; 156 listed, 153 run — the `.slow` files are excluded by the default config) | **5,332 tests, 5,332 passed** (`evidence/rows-before.txt`) |

## D1 — the game witnesses (PASS; p4g, headless logic-only, 0 px)

`scripts/procgen/probe-seedling-spearrect.mjs --record` → `fixtures/spearrect-witness/`. Each records the drained player
stream and one `botMobiles()` sample per game tick; `fidelitySpearRect.test.js` replays each in node: ON the model
reproduces the player on every observation and every sampled row of the witnessed class (a jellyfish's hits/hitsTimer
AND position, a turret's hits/hitsTimer, a block's position); OFF it parts from the game at a pinned tick
(`evidence/probe-record.txt`).

| witness | body class / rule | what the game does | OFF parts at |
|---|---|---|---|
| `spearrect-l98-jelly-repeat` | a MOVER, the T+3 test | hammer C3's L98 tape (`c3-d1-l98-spear-west`, two thrusts east from (76,40)) replayed on p4g: the second thrust's T+3 test hits `jellyfish@56,48`, which walked into the rect after the first test — 3/30, "die" | t39: game 3/30, OFF 1/19 |
| `spearrect-l63-jelly-reach` | a MOVER, no reach gate (+ `spearForce`) | L63, boot (192,96), tap up, thrust at t5 from (200,102.3): `jellyfish@192,56` ~32 px up the rect is hit (2/28) and knocked to y 55.93 | t9: game 2/28, OFF 0/0 (`slash()`'s 16 px gate refused it) |
| `spearrect-l40-turret-corner` | a STATIC body at half pixels, both inclusive edges | L40, boot (431,432), tap right, thrust from (440.7,440): the game's rect x 440..472, y 439.5..444.5 touches `iceturret@472,400`'s resting box (x 472.., bottom 439.5) at a corner — hits 2 at t8 | t8: game 2/30, OFF 0/0 |
| `spearrect-l63-block-far-edge` | a STATIC body, the far edge | L63, boot (72,84), taps down + right, thrust from (80,92.8): `int(80) + 32 = 112` touches `pushableblockspear@112,96`'s x 112 — the block slides to (128,96) | t15: game 112.5, OFF 112 (never moves) |
| `spearrect-l63-block-truncated-y` | the other way — the float rect over-reaches | boot (73,83), same taps, thrust from (81,91.8): the game's rect is y `int(92.8) - 1.5` .. +5 = 90.5..95.5, the block's top 96: not hit, the block stays | t16: game 112, OFF 113 (the float rect, to y 96.3, pushed it) |

The search candidates the witnesses were picked from are in `evidence/edge-search-*.txt` and `evidence/chaser-search.txt`.
**Not witnessed: the line waiver.** No witnessed arm tests a line (the chaser arm never did; the turret and block arms
have none), and the spinner / wallflyer / ShieldBoss rooms' search (`evidence/spinner-search.txt`, thrusts every 8 ticks
from every walkable tile) found no stance where the two rules part. The waiver is the AS3's (`spear()` has no
`collideLine`), declared, and mutant m5 survives it.

## D2 — the model (PASS, behind `spearGameTest`, OFF)

`contactFidelity.js`: a new key `spearGameTest` (OFF; `SEEDLING_SPEAR_GAME_TEST=0|1`). With it ON:

- **One rule, `presses.js`:** `spearGameRect(x, y, dir)` (the `int` origin, `spear()`'s four cases, `inclusive: true`),
  `pressRectTouches(rect, box)` (inclusive for a rect that says so, `rectsOverlap` otherwise — `pressRespondersIn`'s nine
  joins ask it), `spearHitRect` (the switch: the game rect ON, `spearRect` OFF) and `SPEAR_REPEAT_OFFSETS` [2, 4] (derived
  from `SPEAR_HIT_TICKS_UNMODELLED`).
- **`levelRun.applyThrust`:** `gameSpear` = a spear thrust with the key ON. The rect is `spearHitRect`; `spearReach`
  (Infinity) and `lineWaived` replace `reachLimit` / `!ghost` in the ShieldBoss, Spinner, FinalBoss, Watcher, drill,
  wallflyer and chaser arms and in `bobBossSlashNow` (a new `lineWaived` argument to `bobBossSlashGeometry`),
  `lavaBossSlashNow`, `tentacleSlashNow`; `hitForce` (`spearForce` 7) replaces `SWORD_FORCE` in the IceTurret, ShieldBoss,
  Spinner, FinalBoss and chaser arms; the tentacle arm's spear damage is `pressHitDamage('spear')` (unwitnessed — the fight
  ships OFF). The first test schedules **`spearRepeats`** (T+3, T+5): each re-runs the WHOLE thrust (`spearRepeatsNow`,
  beside the fliers' and drills' at the window's seat) from the live position in the latched direction; a ledger row
  carries `repeat: 2|4`. The fliers' (`lightsSpearRepeats`) and drills' (`drillSpearRepeats`) lists stay empty ON, and
  DRILL's first-test pass is skipped (the audit already asked the game's rect).
- **The fold:** DRILL's `spearTouchesDrill` is `pressRectTouches(spearGameRect(…), drillRect(d))` — no second copy (its
  OFF behaviour, with `drillMixedRooms` ON by default, is byte-identical: the same arithmetic). LIGHTS' flier test reads
  `pressRectTouches`, its forecast (`lightsVerb`) `spearHitRect`.
- **The solver's spear stances** ask the same rule: the block push (`spearPressStance`), runSpear's L0 check, the turret
  (`killIceTurretBySpear`), the rope (`ropeSpearReach`), the dark-trap light pole (both the derivation and the settle
  check). C3's `spearRepeatReaches` (the guard against the unmodelled repeats) returns null ON — the run steps them.
- **⛔ Hammer-owned call sites untouched:** the static arm (`STATIC_SWORD_ARM`) keeps `reachLimit` and `SWORD_FORCE` for
  the spear (a hand-over), `execKillByPress`/`pressKillCost.js` are not edited, and `swordWindowStep` is not changed (the
  repeats live in the run only — see residue).

**The digest rule.** `spearRepeats` is a new per-visit array (`freshVisitState` resets it). Member-reach
(`--members-of=spearRepeats`): readers `freshVisitState`, `applyThrust`, `spearRepeatsNow`; members `[advance]` → a
`DIGEST_EXEMPT` row `UNREAD: read via advance only (spearRepeatsNow, applyThrust)` — its two twins carry the same row.
Landed in the D2 commit; the guard reds without it (checked). `stateDigest`/`stateDigestParts` untouched.

## Mutants (predicted first, copy + edit + run + restore)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `SPEAR_REPEAT_OFFSETS` → `[]` | jelly-repeat reds | jelly-repeat red (+ the offsets unit row) |
| m2 | `spearGameRect` untruncated | truncated-y reds; the turret and far edge stay green | as predicted (+ 3 unit rows) |
| m3 | `pressRectTouches` strict | turret-corner and far-edge red | as predicted (+ 2 unit rows) |
| m4 | the 16 px reach kept for the spear | jelly-reach reds | red (first run, before the reach witness existed: green — which is why it was searched for) |
| m5 | the line kept for the spear | green (no witnessed arm tests a line) | green — **survives, named** |
| m6 | `hitForce` → `SWORD_FORCE` | jelly-reach reds (the knockback) | red |

## The survey and sweep rows this moves (before → after) and the dispatches to confirm

**Survey (local, at head `ffa4dbfa`, `--through=end --route=full`):** 250 steps, OFF 191 SOLVED / 53 REFUSED / 3 NO-EDGE /
3 NO-ARRIVAL; ON identical — **0 movers** by (level, goals, boot, visit) on verdict, ticks, refusal text and replay
(`evidence/survey-full-{off,on}.tsv`, md5 equal `04c8f8d8…`). (CI's baseline has 254 steps at 934f99422b; the local
derivation at this head has 250.)

**Which legs thrust.** The base sweep 39496135591 has no spear verb; in all 205 legs that hold the spear the selected
slot is 0, the sword or the ghost sword, and only **two** legs' tapes equip the spear's slot mid-leg: **761** (L98 →
L99, C3's turret kill: `kill`) and **591** (L65). The keyed set widens that to every leg that holds the spear in a room
with a spear responder (blocks, poles, ropes, bridges, turrets: L61-67, L70, L74, L93, L98, L101-109) — **43 legs**,
`evidence/spear-leg-keys.txt` (base: 40 done, 3 failed). (The rope rooms L16/L28/L39 have no spear-holding leg.)

**Keyed sweep (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g
--page-legs=1`, the 43 keys, `--capture-requests`).** Arm A = the 44 defaults; arm B = the 44 + `spearGameTest` (the
`CONTACT:` stamp read off each log: B's names it, A's does not). Once each locally (one leg ≈ 1.5 min; the ×2 is the
CI dispatch below):

| | A1 | B1 | movers |
|---|---|---|---|
| ends | 40 done, 3 failed | 40 done, 3 failed | **0** (end and failure text identical on all 43; `evidence/sweep-a1-b1.tsv`) |
| failed legs | 592 (L63, no corridor), 602 (L66, `pixelmask:building8`), 764 (L98, `jellyfish@176,72` chaser kill) | the same three, the same words | — |

**Every captured request replayed in node, OFF vs ON** (`replay-seedling-solve-request.mjs --requests=<A1's capture>`,
`SEEDLING_SPEAR_GAME_TEST=0|1`; A's requests carry no switch stamp, so the instance's switch decides;
`evidence/replay-a1-off-on.jsonl`): 47 requests, **46 identical answers**; the one that moves is **leg 764, request 0**
(`level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112`) — refused both ways, the WORDS move: OFF the dashless pass
stops on C3's interim guard after 19 work units (*"jellyfish@56,48 could walk into the thrust's rect during its repeats
… the model would not"*) and the full pass runs out of budget at `kill-chaser`; ON the guard stands down (the run steps
the repeats), the dashless pass spends the whole 640 at `kill-chaser` and the full pass meets the deadline at `walk`. With
the budget raised to 20,000 (`evidence/replay-764-budget20000.txt`) OFF and ON end on the SAME named refusal
(`jellyfish@176,72 … still in the world after the whole 231-tick bound`), so nothing ON would solve that OFF refuses. The
leg's row-level refusal is request 1's, identical, which is why the live rows do not move.

**Please run, on this branch:**
1. **Survey, full:** `seedling-survey.yml` `through=end route=full`, once at the defaults and once with
   `contact_fidelity=` the 44 defaults + `spearGameTest` (⚠ an unlisted key is OFF: the 44 are
   `formatContactFidelity(CONTACT_FIDELITY_DEFAULTS)` at the branch head). Compare by (level, goal, boot) against
   39496129402. Expected: 0 movers.
2. **Keyed sweep, ×2:** `seedling-divergence-sweep.yml` with `keys=` the 43 keys in `evidence/spear-leg-keys.txt` (column
   4, `|`-separated), `capture_requests=true`, `contact_fidelity=` the 44 defaults (ARM A) and the 44 + `spearGameTest`
   (ARM B), twice each.
3. **The wasm probes:** `seedling-probe.yml battery=standard` on this branch (OFF — expected = main) AND on a scratch
   branch whose only change is `spearGameTest: true` in `contactFidelity.js` (the workflow has no switch input).
   Measured here (the brief's warning): `probe-seedling-wasm-arrival-composites.mjs` on p4g with a scratch flip of the
   default (not committed): **ALL CHECKS PASSED** ON and OFF, the same 95 checks; one detail differs, `T pit L48` (a
   walk-only leg) `done` ON / `crossed` OFF — the crossed↔done noise class
   (`evidence/probe-arrival-composites-{on,off}.txt`). The other ten probes of the battery were not run locally.
4. **The witnesses:** `seedling-probe.yml probes=probe-seedling-spearrect.mjs` — ALL CHECKS PASSED here on 9714.

## Bounded vitest — AFTER (default) and with the key ON

- **AFTER (default, OFF)** at `ffa4dbfa`, 154 files: **5,350 tests, 5,350 passed** (`evidence/rows-after.txt`) = BEFORE
  (5,332) + 18 new rows and nothing removed: `fidelitySpearRect.test.js` (17) and `contactFidelityHook`'s per-switch row.
  tapeRunner pairs at head: 635 rows, md5 `a02def3b2b47710b8825a88cd62f6c4c`, 0 non-pass (= W0); ON: the same md5.
- **ON** (`SEEDLING_SPEAR_GAME_TEST=1`, the whole bounded set, at `82f9cd8c` — the model as it stands; the two later
  commits touch a CSV row and a test roster only): **10 red, 9 of them the flip's** (`evidence/rows-on.txt`;
  the 10th, `boxLock.test.js`, was this slice's missing roster row — fixed in `ffa4dbfa`, red OFF too before it):
  1. `contactFidelity.test.js > the shipped defaults` — the defaults table.
  2. `dashShape.test.js > … the defaults add no field` — the request stamps an off-default switch (moot at a real flip).
  3-4. `fidelityIceTurretSpear.test.js > C3 D1 > the ice turret … tick for tick` (the model's `died` now holds the
     jellyfish too, as the game does) and `> the jellyfish rows disagree from t39 …` — **C3's "red by design" rows**: ON
     the model reproduces the game's t39 hit (`spearrect-l98-jelly-repeat` is their replacement).
  5. `watchOverlays.test.js > ⚠ a SPEAR press is ONE row, and the missing two are a NAMED model bound` — a control on the
     old behaviour (the bound is modelled ON).
  6-8. `levelRun.test.js > R4: the spear press, the bridge and the block` × 3 (`opens L63's bridge exactly 60 ticks after
     the press`, `reproduces the L65 breach pair's PRESS arm`, `⚠ the lightpole is a TOGGLE`) and 9.
     `botDriverV2.test.js > R4: the spear leg verb > presses once, waits, and the bridge is open` — **ledger-shape
     controls**: each expects ONE press-ledger row per thrust (or a pole hit list of one entry per thrust); ON the T+3 /
     T+5 rows follow with `repeat: 2|4` (the bridge re-hit is a no-op by `bridges.has(id)`, the pole's is refused on
     `hitsTimer`). The bridge still opens on tick 85, the block and the pole end where they did — the outcomes are
     unchanged; re-pin by filtering `p.repeat == null` at a flip.
  - No tape, producer `--check` or identity row moves ON (`w0-tape-census.txt`: the four spear tapes' streams are
    identical ON; no tapeRunner row reds ON).

## Byte-inertia (OFF)

- **Identity at head equals W0 on every row** (`evidence/identity-head.txt` vs `identity-w0.txt`: `diff` empty — all
  md5 rows, generated set OK, all six producer `--check`s exit 0 with their W0 digests, and the same 4 environmental
  reference DIFFERs). Measured at the code head plus the records (`b1fa1dca`'s tree), port 9714.
- tapeRunner pairs: 635 rows, md5 `a02def3b…` (= W0), and the same with the key ON.
- surface census GREEN 344 (two new imports classified: `spearHitRect`, `pressRectTouches`; line moves); constants
  `--write` 6,896 literals, `--check` PASS (`spearGameRect` physics/derivation, `SPEAR_REPEAT_OFFSETS` rule/derivation);
  the docs index regenerated (word counts) and the instruments index (the new probe); `check-procgen-help` ALL PASS (458).
- No committed tape and no producer digest moved; the witness fixtures are not tapes (roster/`index.json` unchanged).

## CI at the code head

- `JavaScript Unit Tests` run **39818187192** @ `ffa4dbfa` (the code head): **success**. Suite (unfiltered, quoted from CI
  per ⚖ 52): **22,124 passed, 0 skipped, 0 failed**; the slow battery 263/263 (`ci-vitest-summary.mjs`).
- The run at `ac4ce325` (D2) was red on exactly what `6f6e6acc` fixed: `seedlingConstantsCensus.test.js` (the two
  `SPEAR_REPEAT_OFFSETS` literals classified `structural`; they are `rule`/`derivation`).
- Run **39831715264** @ `b1fa1dca` (records only): every Vitest job green (22,124 / 263, as above), the producer
  `--check`s and both headless gate shards green; **the two browser gate shards red at "Install Chromium for Playwright"**
  — *"ERROR: Playwright does not support chromium on ubuntu26.04-x64"*: the jobs' `runs-on: ubuntu-latest`
  (`unittests_frontend.yml`) landed on the Ubuntu 26.04 image. Not this branch's (the same shards were green at
  `ffa4dbfa`, and no test body ran); it will meet main too. A re-run was refused (403: "Resource not accessible by
  integration"). **For the planner:** re-run the two shards, and if the image keeps landing, pin those jobs'
  `runs-on: ubuntu-24.04` (or move Playwright to a version that supports 26.04) — a workflow change outside this slice.

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched; no new
  `SolverRefusal.obstacle.kind`.
- **`run.presses`** rows gain an optional `repeat: 2|4` (key ON only) — the T+3 / T+5 rows of a spear thrust. No rename,
  no reshape of any `run.*` field; the skin renderer's tests are in the bounded set (green OFF and ON).
- **`presses.js`** exports `spearGameRect`, `spearHitRect`, `pressRectTouches`, `SPEAR_REPEAT_OFFSETS` (re-exported by
  `solverView.js`: the last three are read by `solverBot` / `lightsVerb`).
- The walker (`botDriverV2.*`) is untouched: no `producer:walker` row can move.
- A flip owes re-pins of: the 9 ON rows above.

## Hand-overs

- **The hammer arc — the static arm (`STATIC_SWORD_ARM`, `levelRun.applyThrust`'s `family === 'static'` arm):** with the key
  ON a SPEAR thrust there still applies `slash()`'s 16 px `distanceRectPoint` gate (`reachLimit`) and hands
  `SWORD_FORCE` 5; `spear()` has no reach gate and passes `spearForce` 7. The call site is the hammer's; what it needs:
  `reach > spearReach` and `f: hitForce` (both already in scope there). Measurement: none (no static-body spear witness);
  m4's red on the chaser arm is the analogue.
- **The hammer arc / the JS arc — the preview's spear is one test.** `presses.swordWindowStep` (read by `solverBot.previewWalk`,
  `solverView` and the hammer's spinner forecasts) still schedules no spear repeats; ON the run steps them
  (`spearRepeatsNow`). A preview that should see a mover meet the T+3 test owes the same offsets (`SPEAR_REPEAT_OFFSETS`).
- **R4's bridge:** `probe-seedling-bridge.mjs` measured ONE decrement per press (`bridges.js`: "spearing does not survive
  long enough for spearDelay to drain"), while two game witnesses (DRILL's `drill-l28-spear-l25`, this slice's
  `spearrect-l98-jelly-repeat`) show the T+3 test landing on a mover. The model keeps the fitted single decrement ON (the
  repeat re-hit is a no-op), so nothing moves — but the two measurements are not yet reconciled. Queued: a bridge witness
  that reads `bridgeOpeningTimer` (or the opening tick) with the player inside the rect through T+5.

## What the brief got wrong (measured)

- "the spear's T+3/T+5 tests and the int/inclusive rect" was not the whole gap: most spear arms borrowed `slash()`'s
  **16 px reach gate** and its **line of sight**, and every arm handed `genericHit` the **sword's force** (5, not 7).
  The reach and the force are witnessed (`spearrect-l63-jelly-reach`); the line is not.
- "turrets (`fidelityIceTurretSpear`)" as a spear ARM: the turret arm has no reach gate and no line, so the int/inclusive
  rect is its only change — and it bites only at half pixels (the turret's rest cycle), not at the route's stances.
- "LIGHTS modelled the repeats for the fliers": yes, but on the float `spearRect` with strict edges (the drill's were the
  game's rect); ON both read the one rule.
- "Census where the int/inclusive rect differs from `spearRect` on the route": on the committed route it never does
  (the four spear tapes, 19 thrusts, collect the same responders ON); the differences live off the route (searched).

## Residue

- The line waiver is the AS3's and unwitnessed (m5 survives).
- A pixelmasked responder: `collideRect` tests its mask in the game; the model's responders are boxes (as for `spearRect`).
- `spearDelay` persists across thrusts in the game; the model's repeats always start at T+1 (a thrust pressed on the tick
  after the last one's T+5 is the only case where they could differ; not met on the route).
- The tentacle arm's spear damage (2 ON) is unwitnessed.

## Rows to BANK

- W0: the arm table above; `evidence/w0-tape-census.txt` (4 tapes, 19 thrusts, 0 movers ON).
- D1: five p4g witnesses at 0 px (`fixtures/spearrect-witness/`), mutants m1-m6 (m5 survives).
- Trap candidates (in the bot-log entry): a weapon's ARGUMENTS are part of its test (`spearForce`); a half-pixel body meets
  an int-origined rect's `.5` edges; one effect per press is not one test per press.
- Commits: D2 `ac4ce325`, D2b `63f53be3`, D1 `82f9cd8c`, census fix `6f6e6acc`, roster `ffa4dbfa`, records `b1fa1dca`.
