# Seedling fidelity AXEFORCEDU: a spinning axe's forced U, certified and priced — and the knockback kills

| | |
|---|---|
| Session | `seedling-fidelity-axeforcedu` (planner `seedling-fidelity-planning-9`, wave 19, model coverage) |
| Start SHA | `4667f7e353` (main: DIGEST harvested; not rebased) |
| Head | the commit carrying this report. Code: D2 `2c8a45b8` + the gate fix `7ffc1b97`; D1 `c548aa40`; D3 `45850084`; records `3339e1cb` + the surface re-write after the fix |
| Harness branch | `claude/axe-priced-crossing-su7dq7` (the brief's name was `seedling-fidelity-axeforcedu`; nothing went to `main`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (one switch, OFF; flip STOP: no mover to license) · D3 PASS (2 game witnesses, 0 px — of refused members; no admitted priced crossing exists on these legs) · Hammer XC PASS (the escape reads nothing new)** |

## The one thing to know first

**With the knockback stepped by the run, the forced U is lethal, not "1–2 hits".**

- The certificate holds on every leg the brief named that still refuses at the axe: 603 (L71 north), 636 (L75 north)
  and 774 (L103). Every phase of the corridor is in blade contact. That covers every doorstep stall `0 … period − 1`
  and, in the full pass, every dash-chain phase too.
- So the priced crossing drives each member on a fork and lets the run bill it. Every member is refused:
  - **L71:** the hit's knockback throws the player out of the one-tile lane beside the hub, into lava. Otherwise the
    walk is pinned: each knockback pushes it back into the next sweep, and the third hit kills it.
  - **L103:** the knockback throws the player into the pit.
  - **L75:** the hit's camera shake leaves `lavarunner@104,64` neither surely on nor surely off screen. The model
    refuses to guess that (⚖ never the cosmetic RNG).
- The game agrees at 0 px. I recorded two of the refused members on the game: the hit, the death and the respawn match
  tick for tick.
- So the switch is built, certified and byte-inert OFF, and it moves no sweep leg and no survey step.
- **These exits are not a planner gap any more.** Along these corridors the game kills the walk. What remains for the
  planner is a route question (another way in, or another corridor), not a pricing one.

## W0 — the bank at base (`4667f7e353`)

| row | command | result |
|---|---|---|
| base | the harness branch was already at `4667f7e353`; `session_bootstrap.sh --seedling` | `READY`, Node v22.22.0. The six non-wasm submodules were initialised by hand. Server `serve-nocache.py 9692` (pid 506; after the container restart, pid 2327). Base worktree `/tmp/claude-0/base` (submodules and `node_modules` symlinked), server 9693 |
| identity block (base worktree) | `SEEDLING_PORT=9693 bash scripts/procgen/identity-block.sh .` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5` = DIGEST's W0 on every row. The generated set needs the primary venv in a worktree; re-run with it: **OK**. Reference: "4 differ" in the worktree (the symlinked submodules, as AXETIMING found); in the primary tree **ALL 7 + 5 MATCH** (`w0/identity-base-worktree.txt`) |
| six `--check`s | (in the block) | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, then DIGEST's `pairs.py` | **617 `8f27f975`**, 0 non-pass (base and head; `w0/taperunner-pairs-*.txt`) |
| surface / constants / entities / profile / roster | the four `--check`s, then `tapes/index.json` | GREEN **312** · PASS **6,028** · PASS **566** · PASS **138** · **280** (`w0/censuses-base.txt`) |
| bounded vitest BEFORE (base worktree) | 75 files: the brief's list, plus every non-slow test naming `forcedHits`, `FORCED_HITS`, `AXE_TIMING_RUNG`, `axeTimingRung`, `spinningaxe`, `CONTACT_FIDELITY_KEYS/_DEFAULTS`, `worldHitsOf`, or the surface/constants censuses (`w0/bounded-files.txt`; `contactFidelityHook` added) | **2,064 / 2,064 pass**, md5 `8016705b…` (`w0/bounded-before-summary.txt`) |

## D1 — the legs at base (PASS)

**Method.** I re-derived the legs with `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`. All 851
ids equal sweep 39153416627's. Each leg is solved in node at its row's `seamTime`, under the page's budget flow
(640 work units, then the held retry's 2,560 over one work clock). The driver is AXETIMING's `drivers/leg.mjs`; my copy
adds two trace sinks.

⚠ No captured requests exist for this sweep (`capture_requests` was not set), so `replay-seedling-solve-request.mjs`
had nothing to replay. I ran the seam census with the driver instead (±3 ticks, below), and I name the capture
dispatch for the planner.

| leg (key) | sweep row | dashless pass (retry) | AXE arm | full pass | forced-hit rung | certificate (D2) | the members on forks (all of them) |
|---|---|---|---|---|---|---|---|
| 603 `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0` | failed | EXHAUSTED, 1,213 work | 598 previews; 21 bent corridors | cut at `kill-chaser` | not proven: *"depth 3 needs 46656 more fork step(s) than the budget's 668"* | 52 / 52 phases in contact (min 1 sample) | **52 / 52 die**: 20 lava, 32 the third hit. Full pass: 572 members over 11 families; 80 driven, all die |
| 636 `level_75 <- in_L71_96_0 -> exit:out_teleporter_64_0` | failed | 2,125 | 1,711 previews; 60 bent (bound) | cut at `axe-dodge` | not proven (same) | 60 / 60 (min 2) | **60 / 60 refused by the model**: the shake band vs `lavarunner@104,64` (ticks 124–184) |
| 774 `level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144` | failed | 1,562 | 1,027 previews; 35 bent | cut at `axe-dodge` | not proven (same) | 72 / 72 (min 1) | **72 / 72 die in the pit** (first hit t153–156) |
| 760 `level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96` | **done** | **SOLVED 354 t** (dodge, kill) | — | cut at `axe-dodge` | — | — | not asked |

(`d1/base-page-*.json`, `d1/priced-members-*.jsonl`, `d1/members-table.txt`.)

**Which rung refuses, and why.** The dashless pass (the page's first) answers EXHAUSTED on the blade. The AXE arm's
stall search and its bent corridors run to completion. The timing rung is not asked, because that pass may not dash.
The forced-hit rung's input tree cannot reach a blade met 47–153 ticks out.

**The priced count, with the knockback stepped by the run.** There is none that survives. AXETIMING's "~1 hit (L71,
L101), 2 (L75)" ignored the knockback.

- `SpinningAxe.hitPlayer` hands `Player.hit` the foot of the perpendicular on the blade two updates back. So the push
  goes along the blade's motion, which is backwards along a corridor that turns against it.
- In L71 that throws the player east out of the lane (x 272–288) into lava, or pins them for a third hit. L103's lane
  borders a pit.
- **Survey.** Of the 24 axe-room steps, only step 149 (L75 north = leg 636) refuses at an axe. AXETIMING's 161/204 are
  older ids.

## D2 — `CONTACT_FIDELITY.axePricedCrossing` (PASS; STOP at the flip)

`SEEDLING_AXE_PRICED_CROSSING=0|1`, OFF, appended after `statueTalkRange`. Module `axePricedCrossing.js`: the switch,
`AXE_PRICED_TRACE`, `admitAxeCrossing`, `isAxeHit`. The block sits in `solverBot`'s ladder as **rung 6½**, right after
the forced-hit rung and before ARROWLANE.

**Where it belongs: beside the FORCEDHIT rung, not inside the AXE arm.**
- It is a forced-hit verdict. It uses the same budget (`FORCED_HITS.maxHitsPerCrossing`, `maxPerSegment`, `margin`),
  the same `forced-hit` row and the same `forcedHits` entry. Only its proof differs: `proof.kind: 'axe-phase'` instead
  of the input tree.
- Placed after every hitless rung, a priced hit is never chosen while a kill, a bait or a detour could have been
  hitless (least damage).
- Under the page's budget, the dashless pass reaches it: its whole ladder costs 1,213–2,125 of the retry's 2,560 units.
- The AXE arm is untouched, so the harvest merges textually. The certificate re-derives the arm's doorstep and rest
  screen locally.

**The gates.** The rung is asked only when all of these hold:
- the switch is ON;
- every reason the probe gave is a spinning axe (the arm's `axeOnly`);
- the segment has a fork and a corridor;
- the run bills the axe (`spinningAxePlayerHit`). This gate was added by the flip battery (below).

**The certificate.** It covers the corridor entered at every phase of the axe:
- the doorstep stalls `0 … period − 1` (a stall of `s + period` meets the blade exactly as `s` does);
- × the dash chain's 10 phases, when the pass may dash with a sword in `primary`.

Each member is priced by `axeHitsPlayer` on its pre-move boxes at the visit's update count. The stalls past `rest` are
priced by shifting one rest preview, as the AXE arm does.

It **holds** when no member crosses free of blade contact. Otherwise it refuses by name:
- *"… crosses free of blade contact in its preview — a gap exists, so no hit is forced"*: the timing rung's question;
  measured on L61 with the timing rung OFF;
- when the preview bound (200) or the deadline cuts it short;
- when the visit clock cannot vouch for the count.

Up to its first hit, a preview IS the run's stepper, so "every member is in contact" means "every member is hit".

⚠ **Not covered, by name:** another corridor; a stall inside the reach; a walk slower than the walk's own policy.

**The crossing.**
- Up to 8 members, fewest contact samples first, are driven on forks exactly as the live drive will drive them: the
  member's own prefix (the walk to the doorstep and the stall), then `botDriverV2.drive` through the rest of the
  corridor.
- The run bills each hit with its knockback, its i-frames and its shake.
- A member is admitted only when it reaches the goal alive, every hit is a spinning axe's, and the hits fit
  `FORCED_HITS`' budget.
- A death on the fork is named before the driver's timeout: *"the crossing dies on the fork at t81 (lava, after
  spinningaxe:spinningaxe@256,144 hit it at t48)"*.
- The fewest-billed admitted member is replayed on the live run. Its rows and its transition must be the fork's, or
  `fail` fires.

**The refusal** appends one clause to the ladder's last reason: *"; and by the axe's phase certificate (AXEPRICED, N
preview(s)): …"*. The OFF message is a prefix of the ON one, and the progress kind is unchanged (`exhausted`; three
corpus rows in `solveProgress.test.js`).

**The fix found by the flip battery** (`7ffc1b97`). The bounded set with the switch ON reddened SPINNINGAXE D2's
step-163 row. That row pins `spinningAxePlayerHit` OFF. The fork then billed nothing, and the rung "admitted" a crossing
the game hits. Now the rung refuses by name before any preview when the run cannot bill the axe. Row added; mutant M7.

**Rows: `fidelityAxePriced.test.js` (19).**
- The switch: OFF, right after `statueTalkRange`; the bounds.
- `admitAxeCrossing`: 5 rows.
- D3: 6 rows.
- Leg 603, dashless: OFF EXHAUSTED; ON certified, stall 2 dies in lava at t81, and the OFF message is a prefix of ON;
  ON with the axe arm OFF, refused by name.
- **The admitted path under `noDamage`** (no hit can land): the first member is admitted and replayed live, 359 t,
  with no `forcedHits` row. This is the only way to drive the replay path, since no real member survives.
- L61 step 152 with the timing rung OFF: the certificate refuses, *"a gap exists"*.

**Mutants** (each predicted, made by copy and restore; `d2/mutants.txt`):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | the clean-member check gutted | only the L61 "gap exists" row | ✔ 15/16, exactly that row |
| M2 | the death classification removed from the catch | only the 603 ON row | ✔ 15/16, exactly that row |
| M3 | `admitAxeCrossing` ignores a death | only the pure "a death is refused first" row | ✔ 15/16 |
| M5 | the member's stall prefix dropped on the fork | only the 603 ON row | ✔ 15/16 |
| M6 | the live replay one key short | only the `noDamage` ON row (the transition check fails) | ✔ 17/18 |
| M7 | the `spinningAxePlayerHit` gate removed | only the new gate row | ✔ 18/19 |

## D3 — game witnesses (PASS)

I recorded the members on the game (p4f headless, `botLoadTape` / `botStart`, `botDrain` plus the last `botStatus`
poll per tick; `drivers/game.mjs`). The model then replayed them (`drivers/cmp.mjs`; `d3/cmp.txt`).

| witness | the member | game | model, axe arm ON | model, axe arm OFF |
|---|---|---|---|---|
| `axeforcedu-l71-603-member` | leg 603 at seam 5412, doorstep stall 2, 416 t | 417 rows. Hits rise at t48 / 128 / 208 / 288 / 368. Each is followed by the lava and a respawn at (296,104) with hits 0 (first respawn at t81) | **0 px** on every tick; bills the same five axe hits and the lava deaths | parts at t48 |
| `axeforcedu-l103-774-member` | leg 774 at 5528, stall 12, 553 t | 554 rows. Hit at t156, the pit, respawn at (24,72) at t178 | **0 px**; bills t156 and the pit death | parts at t156 |

These are the members the fork refused, so the witness is of the model's refusal, not of an admitted crossing. No
admitted priced crossing exists on these legs. ⚠ The tapes carry `seam.items.hitsMax`; `parseTape` rejects it, so I
stripped it (3 is the game's default).

## The survey / sweep rows this moves (before → after)

**None.**

- **Sweep** (node, the page's budget, all 82 axe-room legs at their rows' `seamTime`; `sweep/ab-legs.tsv`):
  - OFF = ON on outcome, ticks and message for 79 legs.
  - 603, 636 and 774 refuse in both arms; ON adds the clause.
  - Work (`sweep/ab-attempts.txt`): the dashless pass spends **+22 units** where it reaches the rung (529, 530, 603,
    604, 606, 607, 636, 774). No pass's answer moves; the full passes of 529/530/604/606/607 still solve with the same
    ticks. ⚠ That is budget the full pass no longer has. It moved nothing here, but it is the cost to watch on a leg
    near the edge.
  - **Seam census** (ON, ±3 ticks; `sweep/seam-census-on.txt`): 603, 636 and 774 are certified and refused at all 7
    times each; 760 solves 354 t at all 7.
- **Survey** (local, the 24 axe-room steps 65 86 119 120 124 134 135 139 140 148 149 151 152 160 169 170 171 179 181
  189 192 194 198 203; `survey/axe-room-steps.tsv`): local OFF = CI 39153361080 on all 24, and ON = OFF on all 24.
  Step 149 gains the clause (162 previews in its full pass).
  - I did not run the other 188 steps. The rung's gate needs every reason to be a spinning axe, and there is none
    outside these nine levels (L48, 54, 61, 63, 71, 75, 98, 101, 103; the atlas census in `d1`).

### Dispatches for the planner (branch `claude/axe-priced-crossing-su7dq7`)

`<D>` = the ON defaults at base:
`collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange`.

1. **Full sweep A/B** (`seedling-divergence-sweep.yml`): `-f contact_fidelity=<D>,axePricedCrossing` against baseline
   39153416627.
   - Expect no `failed` ↔ `done` / `crossed` mover beyond run noise (~20 `crossed` ↔ `done` swaps each way).
   - 603, 636 and 774 stay failed, with the clause.
   - Repeat ×2 on any other key that moves.
2. **Narrow sweep with captures** (cheaper; the JS arc's capture condition is "at the defaults only"):
   - `-f keys='level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0|level_75 <- in_L71_96_0 -> exit:out_teleporter_64_0|level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144|level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96'`
   - `-f capture_requests=true -f seam_census=-3..3`, at the defaults.
   - Then replay the captures in node with `SEEDLING_AXE_PRICED_CROSSING=1` (`replay-seedling-solve-request.mjs
     --seam-time-sweep=-3..3`).
3. **Survey** (no `contact_fidelity` input): make a measurement commit flipping the default, then run
   `seedling-survey.yml -f through=end -f route=full -f only=149 -f base_run=39153361080`. Expect REFUSED, with the
   clause. A full run expects no mover.

## The JS arc's pins that move, and what it must wire

- **Nothing breaks unwired.** One key is appended: `axePricedCrossing` (OFF). `seedlingContactSettings` derives a page
  setting for it automatically (`contactFidelityHook`'s new row: `flashPanel.seedlingContactAxePricedCrossing`, default
  false), and the sweep's `contact_fidelity=` reaches it.
- No signature or contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`). No new
  staging or result field, and no new `obstacle.kind`.
- ON only:
  - an admitted crossing writes a `forced-hit` trace row whose `proof` is `{kind: 'axe-phase', axes, door, period,
    families, members, completed, minContacts, previews}`;
  - it writes a `forcedHits` row with `candidate: 'axe-priced stall S at sample D (walk|chain+O)'`, so `damage` and
    `unbilledDamageOf` read it like any forced hit.
- The rung reuses the `axe-dodge` deadline site and `progressRung('forced-hit')`. `DEADLINE_SITES` and
  `KNOWN_STRATEGY_VERBS` are untouched.
- The walker (`botDriverV2.drive` / …) was not touched. No `producer:walker` row exists in the baseline (all 851 are
  `solver`).
- No `run.*` field was added or reshaped, so the skin renderer is unaffected (`seedlingSkinRenderer` is in the bounded
  set, green).

## Hammer XC (agreed) — the escape reads nothing new (PASS)

- `closure-census.mjs` (`levelRun.js --from=ticksCompleted,state,level,world,previewStepper,spinnerForecastWithPress,gameTimeAt,progress`)
  gives the same md5 at base and head, `ecd6b2f1…`. `levelRun.js` is untouched.
- `escape-reach.mjs strikeEscape,pressEscape` over `solverBot`, `spaceTimeReach`, `solveProgress`, `ghostSpinnerPress`,
  `playerPhysicsV2` and `hazards`: the same 49 functions and 8 run members; only line numbers shift (md5 with line
  numbers stripped, `395780e9…` both; `xc/`).
- The rung adds no run state. It reads the run through `fork()` and the ledgers, which the escape never reads.
  `stateDigestParts` needs nothing.

## Handed to the hammer arc

Nothing. No function in its list was edited. The rung builds a `dashPlan` (`{ticks: Set, starts, windows, why}`) for
`strikePolicyFor` in AXETIMING's format. If hammer DB changes that format, this rung must follow it, exactly as the
timing rung must.

## Deltas (base → head)

- **Code**
  - `axePricedCrossing.js` (new).
  - `solverBot.js`: the import, and rung 6½ inside `climbLadderUnder`, after the forced-hit block.
  - `contactFidelity.js`: one key and its env hook.
- **Tests**
  - `fidelityAxePriced.test.js` (19, new).
  - `contactFidelity.test.js`: the defaults pin +1 key, and the `skipIf` +1 env name.
  - `solveProgress.test.js`: three corpus rows and the switch in the loop.
- **Fixtures** (`fixtures/chaser-witness/`, not the roster): `axeforcedu-l71-603-member`, `axeforcedu-l103-774-member`.
- **Records**
  - Surface `--write`: 312 rows. `axePricedCrossing.js` joins the solver family; count drift on existing rows only.
  - Constants PASS 6,028; entities 566; profile 138; roster 280.
  - `seedling-bot.md` paragraph; `seedling-bot-log.md` § *Seedling fidelity AXEFORCEDU*, with 3 trap candidates.
  - The reference regenerated (the docs index).

## Byte-inertia (OFF) and the flip's movers (ON)

| row | OFF (head) | ON |
|---|---|---|
| identity block | Every value row and the six `--check`s = W0 (`w0/identity-head-off.txt`). Generated set OK. Reference ALL 7 + 5 MATCH after regeneration | `SEEDLING_AXE_PRICED_CROSSING=1` (at `1f256b7e`): **identical to OFF on every value row and all six `--check`s**; generated set OK; reference ALL 7 + 5 MATCH (`w0/identity-head-on.txt`) |
| tapeRunner | 617 `8f27f975`, 0 non-pass | — (no tape replays a solve) |
| bounded vitest (primary tree) | 76 files, **2,083 / 2,083** (= BEFORE + 18 new rows + the hook's new row; at `3339e1cb`) | 2,084 run: **2 red, both expected** — `fidelityAxePriced`'s "its bounds" (asserts `enabled` false) and the surface census before its re-write (since re-written: 36 / 36). The "shipped defaults" row skips by design under the env. The first ON run also reddened `fidelitySpinningAxe` D2 ON: that was the gate defect, fixed in `7ffc1b97` |

## What the brief got wrong (measured)

1. *"At the best stall the walk costs ~1 hit (L71, L101) or 2 (L75)."* With the knockback stepped by the run, no stall
   survives. L71 dies (lava or the third hit), L103 dies in its pit, and L75 cannot be stepped (the shake band). Two of
   these are witnessed on the game at 0 px.
2. *"L101 stairs … still refuse at the spinning axe."* At this baseline, leg 760 is `done` (354 t, dodge and kill),
   stable at seam ±3.
3. *"the axe-room survey steps that refuse (AXETIMING named 161/204)"*. The ids have moved. Only step 149 (L75 north)
   refuses at an axe in survey 39153361080.
4. *"a cheaper FORCEDHIT proof for this class"*. It is cheaper (14 previews for the walk family, 154 with the chain) and
   exact for the class. But the class's verdict is death, so it licenses nothing on these legs.
5. *"Decide on a captured request replayed in node"*: sweep 39153416627 captured none. Seam census by driver instead;
   the capture dispatch is named above.

## Residue

1. **The forced-U exits are lethal along their corridors** (L71 north from L72, L103 east from L104). This is a route
   question for the planner: is the exit reached another way, or with another corridor (the AXE arm's bent corridors
   are bounded at 60 previews, not exhaustive)?
2. **L75: a priced hit in a room with a chaser near the screen edge is undecidable** (the shake band). Either the chaser
   must be handled first, or a both-branches resolution would be needed (a camera/witness owner's question, not this
   slice's).
3. **The admitted path with a real billed hit is not driven by any real member.** It is the forced-hit rung's shape.
   It is driven under `noDamage` (replay, transition, no row), and the billing compare reuses the forced-hit code
   verbatim.
4. **+22 work units in the dashless pass** on axe-exhausting legs (no answer moved).
5. **The CI path filter misses `scripts/**/*.json`**: a census `--write` alone is never run on CI (above).

## Rows to BANK

- `contactFidelity.js`: `axePricedCrossing: false`.
- `AXE_PRICED_CROSSING = { maxPreviews: 200, forkCandidates: 8 }`. It uses `FORCED_HITS`' budget and AXETIMING's
  `rest` / `offsetStep`.
- `fidelityAxePriced.test.js`: 19 rows.
- Witnesses: `axeforcedu-l71-603-member` (417 rows), `axeforcedu-l103-774-member` (554).
- Sweep (node, page budget, 82 axe-room legs): **0 movers**. Survey (24 axe-room steps): **0 movers**.
- Identity = W0. tapeRunner 617 `8f27f975`. Surface GREEN 312, constants 6,028, entities 566, profile 138, roster 280.
  Reference ALL 7 + 5 MATCH.
- CI (`JavaScript Unit Tests`, `node scripts/procgen/ci-vitest-summary.mjs <sha>`):
  - `3339e1cb` (records, before the gate fix): run green, **21,011 passed / 0 failed**; slow battery 254/254.
  - `7ffc1b97` (the gate fix): **1 red**, `seedlingSolverSurface.test.js` (i). The fix added a `CONTACT_FIDELITY` read,
    and the committed surface table was stale. `45850084` was red on the same census (27 rows), before the first
    `--write`.
  - `1f256b7e` re-wrote the table; locally `seedlingSolverSurface.test.js` passes 36 / 36. ⚠ **CI did not run** at
    `1f256b7e` or at this report's commit. `unittests_frontend.yml`'s `paths` watch `scripts/**/*.js|mjs` but not
    `scripts/**/*.json`, so a JSON-only census re-write gets no run. The planner's harvest run is the confirmation; the
    trigger gap is worth a row of its own.
