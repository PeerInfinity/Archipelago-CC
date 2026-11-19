# Seedling hammer-phase L40-CORNER: the L40 spinner corner is not an arrival-phase press, and a phase wait cannot reach it

Slice `seedling-hammer-l40-corner` (Opus, cloud). Planner `seedling-hammer-phase-planning-12`. ⚖ The user approved the slice on
2026-11-19 (*"Slice it now (Recommended)"*): measure first, switch-guarded OFF. Landing needs the user's SHA-bound OK through the
planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `f43e2de82a26cbc23d8304ffc46ed0013fce16c0` (origin/main, TRAIN 166, `HIT_AWARE_ANSWER` ON) |
| Reproduction | `558a5801e3` (tools, the base seam sweep, the existing-switch probe, survey steps 66/96, the leg census) |
| Rows | `b63365e637` (`hammerL40Corner.train.test.js`; the phase-wait patch and its measurements as evidence) |
| Game witness | `3017f22cd2` (p4g play of the {40,12} plan) |
| Survey | `1f5e0c995f` (`--through=end` OFF vs ON) |
| Report | `4621050fbe` (this report and the remaining evidence), then the commit carrying this line, which drops two raw survey JSONs the `.gz` copies already hold (`survey/end-*.json.gz`) |
| Branch | `claude/seedling-l40-corner-press-eexmol` (the harness's designated branch) |

No planner follow-up arrived (`ReadNotifications` empty, checked twice). I followed the brief alone.

## 2. The answer first

**No switch ships. The product code at the head is the base's** (one new train-tier test file, no module change). The
acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base and at the head.

**The one thing to know first: the brief's mechanism does not hold.** The press kill of `spinner@816,848` does refuse by
arrival clock (5241 and 5242 refuse; the other 43 clocks of the period do not), but the arrival clock (`seam.time` =
`Game.time`) drives **only the hammer's angle** (`spinner.hammerLine`). The spinner bodies move without reading it. So a
different arrival clock changes the hammer's angle **relative to the bodies' paths**, and nothing the player does inside the
room can change that relation. A wait moves the player against a fixed (body, angle) picture. Measured:

- I built the wait (`PRESS_PHASE_WAIT`: rewind to the refused kill's first tick, stand still `w` = 1 … 44 ticks, redo). On
  synthetic L18 phases it works (39/45 → 45/45 with `HAMMER_ESCAPE` off). On L40 it moves nothing: at clock 5241 **all 44
  waits refuse** (one kills with a hit, correctly refused); on survey step 96 **all 44 refuse**; on the `spinner@880,848`
  face it ran past 20 minutes. I did not ship it (§ 4, § 8).

**What does answer the corner is a switch that already exists, OFF: `PRESS_ESCAPE_SHIELD_CLAIM`** (the SPIN slice's). The
player carries the shield in L40, so `pressEscape` claims nothing and the press is taken with no certified way out; the
corner forms 7 ticks after the landing. ON, at the shipped budget 2560:

- clocks 5241 and 5242 **solve hitless** (1110 t and 1169 t, flags 40:0 and 40:12 earned);
- **p4g played the 5241 plan 1110/1110 ticks, 0 hits, end = model to the last digit, 109 samples, 0 diverging**;
- survey step 96 gets past the spinner press and stops at the next wall, the `iceturret@472,400` approach;
- the survey `--through=end`: 224 SOLVED both ways, every solved step identical; **no step gains a hit**.

**But it is not clean on the legs themselves** (one hammer period, 45 clocks each, § 7). From L39 it solves 2 more clocks,
**loses 1** (5250: the ladder EXHAUSTED on `chaser:bob@736,800` and a covered goal at `bobsoldier@880,832`, face 1's own
shape) and **makes 1 plan hit-taking** (5247: `bob@736,752` at t735). From L43 it makes **5 clean clocks hit-taking** (3 → 7).
With `PRESS_KILL_CHASERS` also ON, the L39 period has 0 hit-taking plans (+2 / −1); 5250 stays lost under every combination
tried. Its sibling `SHOVED_BODY_LOOKAHEAD` solves the `spinner@880,848` clock 5225 hitless.

## 3. The reproduction (measured at the base)

**Tools** (`…-evidence/tools/`): `seam.mjs` solves a committed L40 request re-stamped to an arrival clock, through the worker's
dispatch (`solveAnytime`), and replays the plan on a fresh run to count hits. The three requests:

| `--fx` | leg (key) | fixture |
|---|---|---|
| `flag12-L39` | `level_40__r48c54 <- in_L39_144_0 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` | `fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz` (captured at 5213) |
| `flag12-L43` | `level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` | `…/leg872-l43-l40-request.json.gz` (5211) |
| `chest-L39` | `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` | `fixtures/hammer-l40-spinner-walls/chest-L39-request.json.gz` (5233) |

At the request's own 640 the flag-12 leg runs out of budget (work 645, at the `walk` site), as the wasm walk did. So every
row below is at **2560, the page's held retry**.

**The seam sweep, 5213 … 5257 (one full hammer period, 45 clocks), OFF** (`seams/base-off.txt`):

| leg | solved (hitless / with a hit) | refused | refusals |
|---|---|---|---|
| flag12-L39 | 40 (40 / 0) | 5 | 5225, 5227, 5228: `kill (spinner@880,848) by press` "no step out" (the phase rung: "NO PHASE admits a step … walk-offset −1..0 (0 tried)"); **5241, 5242: `kill (spinner@816,848) by press` "no step out", the corner 7 t after the press LANDED at t1360** |
| chest-L39 | 40 (40 / 0) | 5 | the same five clocks, the same two bodies (the Chest leg is the flag-12 leg's first part) |
| flag12-L43 | 30 (27 / **3**) | 15 | 5222–5226, 5234, 5235: `spinner@880,848` press; 5232, 5233, 5236–5240: the burn-stance ladder EXHAUSTED on `spinner@816,848`'s body/hammer; 5219: deadline |

⚠ **The base already ships three 1-hit plans** on flag12-L43 (5213, 5256, 5257: one plan, `bfecf9bc7bbd`, 1749 t). Not this
slice's; recorded for the planner.

**The three faces:**
1. **Face 3 (leg 866's arrival-phase refusal):** reproduced exactly. In the brief's 15-clock window 5239…5253 the flag-12 L39
   leg refuses at **5241 and 5242 only**, with *"burn stance (burnabletree@872,784) -> kill (spinner@816,848) by press: every
   key set … at (868.73,855.83) … There is no step out. The corner formed 7 tick(s) after the press on spinner@816,848 LANDED
   at t1360"*. (The brief's `(861.35,850.11)` is the same corner on leg 866's own capture.) The refusal comes at work 724 of
   2560: a **hard** refusal, not a deadline.
2. **Face 2 ("Level 040 - Chest", wasm A2):** A2's status is word for word chest-L39's refusal at 5241/5242: *"apitem
   (880,816) contact -> kill (spinner@816,848) by press … LANDED at t1360"*. It is a hard refusal at work 340, which is why A2
   got no held retry. **Faces 2 and 3 are one press.** Survey step 66 is a different refusal: *"collect (160,640) stance: the
   combat ladder is EXHAUSTED … spinner@816,848 (a live Spinner BODY … at horizon 419)"*, on the Totem Part leg's corridor, no
   press at all (`survey/s66-96-off.log`).
3. **Face 1 (seed 1's first wall, wasm A1/A3, the burn stance's ladder on `chaser:bob@736,752`):** not reproducible in node.
   The page asked it from `level_40__r48c54` after a 2460-tick routing walk (A1's log), and the re-measure kept no request
   capture. The node flag-12 legs refuse that way at no OFF clock. **But the same shape appears ON** (5250 with the claim: the
   ladder EXHAUSTED on `chaser:bob@736,800`, `bobsoldier@880,832`'s covered goal at (888,824)), so face 1 is what the burn
   stance meets when the press kill ends at another time, not a press refusal. **Survey step 96** (the same goal pair) refuses
   on the press: *"kill (spinner@816,848) by press: every key set … at (759.23,850.01) … The corner formed 12 tick(s) after the
   press … LANDED at t2743"* (the plain fallback's redo from t1419 also refuses).

**One mechanism?** For faces 2 and 3 and step 96, yes: a press on `spinner@816,848` **with the shield carried**, so the press
escape claims nothing (`pressEscape`: *"the forecast names shield bump (`shieldBumpNow`) as unmodelled"*), and the landing's
rebound corners the player. It is not "the key-set search has no wait option" (§ 4). Face 1 is a different rung (the
ladder), downstream of when that kill ends.

**The existing OFF switches, at the refused clocks** (`probes/existing-switches.jsonl`, flag12-L39, 2560):

| switch ON | 5241 | 5242 | 5225 |
|---|---|---|---|
| `PRESS_ESCAPE_SHIELD_CLAIM` | **solved, 1110 t, 0 hits** | **solved, 1169 t, 0 hits** | refused (same text) |
| `SHOVED_BODY_LOOKAHEAD` | refused (same text) | refused | **solved, 1715 t, 0 hits** |
| `HAMMER_BODY_GATE` | refused | refused | refused |

## 4. Design and change

**Built, measured, not shipped: `PRESS_PHASE_WAIT`** (`phase-wait/press-phase-wait.patch`, 290 lines over `pressPhaseWait.js`,
one call site and one function in `solverBot.js`, `SOLVER_ENV_NAMES`, a unit test). It ran in the solve **worker** (where the
press kill runs). ON, a press kill refused with `HAMMER_SAFETY` / `STRIKE_BOUND_EXHAUSTED` after the defaults' own fallbacks
was rewound to its first tick (`ctx.rewind`, as `OPP_PRESS_FALLBACK` does). The player then stood still `w` = 1 … period − 1
ticks (`SPINNER.hammerPeriod` = 45; each tick checked with `landsClearOfHammers` and hit-free), the admission was asked again,
and the kill redone. The first redo that killed with no hit was adopted.

| measurement | OFF | ON |
|---|---|---|
| acceptance md5 | `391322d681b7aa0229d94b3f6906d024` | `391322d681b7aa0229d94b3f6906d024` |
| L18 `r9-solve-18`, 45 residues, `HAMMER_ESCAPE` off (`phase-wait/l18-noesc-*.txt`) | 39 solve; 4, 14, 44 `HAMMER_SAFETY`; 38, 40, 41 `STRIKE_BOUND_EXHAUSTED` | **45 solve, 0 hits**; the 39 are digest-identical |
| L18 at the shipped defaults (`HAMMER_ESCAPE` ON) | 45/45 already | nothing to answer |
| L40 flag12-L39 @5241 (`phase-wait/on-5241.json`) | refused, work 724 | **refused**: 44 waits, 42 `HAMMER_SAFETY`, w18 killed **with a hit** (undone), w42–44 refused otherwise; then a second ask cut by the deadline at w37; 233 s |
| survey step 96 (`survey/s96-PPW-t900.*`) | refused | **refused**: 44 redos, 0 with a hit; 371 s |
| L40 chest-L39 @5227 | refused, work 112, **216 s** | over 20 minutes, killed |

Why it cannot work on L40 is § 2's point: the wait shifts the player, not the hammer's angle against the bodies. On L18 the
kill's own timing was the free variable, so the wait found it. The `spinner@880,848` face also showed a cost hazard: OFF
already spends 170–225 s refusing it at 56–248 work units (the phase rung's stall search is not counted as work), so a retry
loop multiplies wall time the budget does not see.

**What I did not do:** flip or edit either existing switch (not this slice's), or add a rung. "Stop at the smallest correct
change": for the corner that change already exists, OFF.

## 5. Rows and bounded vitest runs

| file | tier | rows | result |
|---|---|---|---|
| `frontend/modules/seedlingDemo/hammerL40Corner.train.test.js` (new) | train | 3 | **3/3, 346 s** (`vitest-train.txt`, `npx vitest run --config vitest.train.config.js <file>`) |
| `hammerPressPhaseWait.test.js` (in the patch only) | default | 3 | 3/3, 17.5 s on the patched tree; mutation m1 (no stand) reds the "refuses OFF, plans ON" row |

The train rows pin, on the flag-12 L39 request at 2560: 5241 OFF refuses (`spinner@816,848`, `LANDED at t1360`);
`PRESS_ESCAPE_SHIELD_CLAIM` ON solves 5241 (1110 t, `106c40080ca0`) and 5242 (1169 t, `ed9ae605061d`) hitless with 40:0 and
40:12 earned; `SHOVED_BODY_LOOKAHEAD` ON solves 5225 (1715 t, `3e354fdefb42`) hitless. They are train tier because each solve is
45–170 s. No default-tier row ships (no behaviour change ships).

Generated surfaces: `census-seedling-solver-surface.mjs --check` GREEN (374 rows), `generate-procgen-reference.mjs --check` all
match, `generate-docs-index.mjs --check` current. No docs edit, so no link-census pins are owed.

## 6. Game witness (p4g)

The flag-12 L39 request at 5241, `PRESS_ESCAPE_SHIELD_CLAIM` ON, the worker's dispatch at 2560: plan `106c40080ca0`, 1110 t,
work 1802 (`game/f12-5241-shield-solve.json`). Played with L40-SPINNER-WALLS' `legwitness.mjs` on `seedling_bot_ap_p4g`
(headless logic-only, the delivered set, under the box lock; `serve-nocache.py` started for it and stopped by PID):

| | model | game |
|---|---|---|
| ticks | 1110 | **finished 1110 / 1110** |
| hits | 0 | **0** |
| end | (888.7435497133375, 775.3939828247179) | **the same to the last digit** |
| flags | 40:0 (t1033, the burn), 40:12 (t1100, `buttonroom@880,768`) | 40:0, 40:12 (and 40:13, 40:16, the run's pickups) |
| samples | | **109 sampled ticks against the model, 0 diverging** (`game/f12-5241-shield-samples.txt`, `tools/samples.mjs`) |

## 7. Census: which seed-1 divergence-sweep legs can move

`tools/census.mjs` over the seed-1 leg list (`seedling-divergence-legs.mjs --presets=seedling_playthrough`, 922 legs):
`PRESS_ESCAPE_SHIELD_CLAIM` is read only on a press kill of a spinner with the shield carried. Spinners exist in L18 (2),
L39 (3), L40 (5) and L92 (1). **50 legs** stand in a spinner room with the shield in their AP inventory: **L40 46, L39 3, L92
1** (`census.txt` lists every key). That is an upper bound: a leg moves only if its plan presses a spinner. The 4 spinner-room
legs without the shield (L18, L92) cannot move. The divergence sweep's `solver_env` input
(`seedling-divergence-sweep.yml`) can run the real count with `SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1` (and
`SEEDLING_PRESS_KILL_CHASERS=1`, § 9); no full sweep was run here (the planner's).

**The leg sweep, ON vs OFF, one hammer period** (`tools/compare.sh seams/base-off.jsonl seams/shield-on.jsonl`):

| leg | OFF: solved (with a hit) / refused | `PRESS_ESCAPE_SHIELD_CLAIM` ON | `… + PRESS_KILL_CHASERS` ON |
|---|---|---|---|
| flag12-L39 | 40 (0) / 5 | 41 (**1**) / 4: **+5241, +5242**; **−5250** (ladder EXHAUSTED); **5247 now takes `bob@736,752`** | 41 (**0**) / 4: +5241, +5242; −5250 |
| chest-L39 | 40 (0) / 5 | 41 (**1**) / 4: the same four clocks, the same movers (5247 takes a hit, 5250 lost) | not run |
| flag12-L43 | 30 (3) / 15 | 32 (**7**) / 13: +5232, +5233, +5237, +5240 (the last with a hit); −5244, −5245; **5214, 5215, 5241, 5248, 5249 become hit-taking** | not run |

In the brief's 15-clock window (5239…5253) on flag12-L39: OFF 2 refusals (5241, 5242), the claim ON 1 refusal (5250) and
1 hit-taking plan (5247), the claim with PKC ON 1 refusal (5250) and none hit-taking. Every other clock in the window solves
both ways, mostly with another hitless plan (`seams/compare-shield*.txt`). **The claim alone gains hits; it must not ship
alone.**

## 8. What the brief got wrong (measured)

1. *"The press kill of spinner@816,848 refuses by ARRIVAL PHASE … the press's key-set search has no phase-shift
   (wait-N-ticks) option"*: the refusal does follow the arrival clock, but a wait-N-ticks option cannot reach it. The clock moves
   the hammer's angle against the bodies' paths, and a wait inside the room moves only the player (§ 2, § 4: 44/44 waits refuse
   at 5241 and on step 96). The kill fails because the press is taken with **no escape claim while the shield is carried**.
   `PRESS_ESCAPE_SHIELD_CLAIM` answers that (5241, 5242 solved, game-witnessed).
2. *"It is switch-independent"*: it is independent of the switches ON at the base. An OFF switch answers it.
3. *"Survey step 66 … REFUSED … 'apitem (880,816) contact -> kill (spinner@816,848) by press …'"*: that is wasm A2's text.
   **Survey step 66** refuses on a different rung (the Totem Part leg's corridor ladder on the spinner's BODY at horizon 419),
   with no press. The press text is chest-L39's at clocks 5241/5242.
4. *"Seed 1's first wall … is the press kill"* (face 1): the wasm A1/A3 refusal is the burn stance's ladder on `chaser:bob`
   with a covered goal. It is not a press refusal, and no node request reproduces it at the base. Its shape appears ON at 5250,
   downstream of a re-timed kill.
5. *"SPIN: At the shipped budget (2560) no arm reaches the spinner@816,848 press kill"* (the SPIN report, quoted as history):
   on the flag-12 and Chest legs from L39 the press **is** reached at 2560, and the claim answers it there.

## 9. Residue and hand-overs

- **For the planner (flip question, not this slice's):** `PRESS_ESCAPE_SHIELD_CLAIM` answers the L40 corner at 2560, but on
  the flag-12 L39 period it trades +2 solved / −1 lost (5250, face 1's shape) / +1 hit-taking (5247, `bob@736,752` at t735).
  With `PRESS_KILL_CHASERS` also ON, flag12-L39's period is +2 / −1 / **0 hits** (5247 hitless, 1180 t). The pair is NOT
  measured on flag12-L43, where the claim alone makes five clean clocks hit-taking: that is the next measurement. The SPIN report's held reasons stand
  (identity rows c3/c4/c6 move on a flip). ⚖ No-hit logic: the claim alone must not ship to a page that plays 5247.
- **5250 ON** (the burn stance's ladder on `chaser:bob@736,800` + `bobsoldier@880,832`'s covered goal) is the rung that also
  stops wasm A1/A3. It is a ladder/chaser-arm question (`GUARD_APPROACH_STANCE`, `COVERED_GOAL_REFUSAL`), not a press one.
- **Step 96 ON** reaches `iceturret@472,400`'s approach from (488,579) (504 forks, all hit): ICEST/turret territory (the SPIN
  report's "what 860 meets next").
- **Wall-time hazard (base):** the `spinner@880,848` refusal costs 170–225 s of wall time at 56–248 work units (chest-L39 /
  flag12-L39 5225/5227/5228). The budget does not see it; the page sees it as a stall.
- **Base hit-taking plans:** flag12-L43 at 5213, 5256 and 5257 ships one plan (`bfecf9bc7bbd`, 1749 t) that takes
  `bob@736,800` at t790, with `HIT_AWARE_ANSWER` ON. A chaser hit on the press-kill walk; `PRESS_KILL_CHASERS` is the
  candidate to ask.
- `PRESS_PHASE_WAIT` (`phase-wait/press-phase-wait.patch`) is kept as evidence only. It is a correct, OFF-identical retry
  that answers synthetic L18 phases (with `HAMMER_ESCAPE` off). It has no L40 witness and an unbounded wall-time cost on the
  `spinner@880,848` face. Do not merge it.
