# Seedling fidelity SPINNINGAXE: a spinning axe hits the player, a partial phase dodge is re-probed, and leg 768 is a beam

| | |
|---|---|
| Session | `seedling-fidelity-spinningaxe` (planner `seedling-fidelity-planning-8`, wave 17, model coverage) |
| Start SHA | `e967758748` (main: wave 16 + the lapse flip + hammer DD/RE/SF; not rebased) |
| Head | the commit carrying this report (code: D1 `cdb2ba1` + `20cbd1f`, D2 `67579d5`; censuses `978a689`; docs `b296237`, `28379ce`) |
| Harness branch | `claude/spinning-axe-player-arm-8mobcw` |
| Verdicts | **W0 PASS · D1 PASS (STOP at the flip, movers listed) · D2 PASS (STOP at the flip, movers listed) · D3 PASS (named: not the axe — handed over)**. Two new switches, both OFF and byte-inert. |

## The one thing to know first

**Step 163 walked into the axe because the walk executor stopped probing, not because the preview and the drive differ.**
The whole step-163 solve calls `probeCorridor` exactly once, at t0 (measured by instrumenting it). The ladder's phase
arm stalls for `lavachain@96,48` and keeps that stall as `partial: [spinningaxe@80,144]`. Its docblock says "the next
probe meets the other danger alone", but `walkToUnder` walks the rest of the corridor with no next probe. A preview
rebuilt from the t52 `walk` row equals the drive tick for tick, and the danger map flags the axe on it at t160–169. The
axe the game hits at t160 was visible to the solver's own instrument, and nobody asked.

## W0 — the bank at base (`e967758748`)

| row | command | result |
|---|---|---|
| base | the harness branch at `e967758748`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Dev server `serve-nocache.py 9681` (pid 558); base worktree `/tmp/claude-0/sa/base` on 9682. The five non-wasm substrate submodules were initialised by hand (as L74ARRIVAL and SMALLGAPS found) |
| identity block (base worktree) | `SEEDLING_PORT=9682 bash scripts/procgen/identity-block.sh .` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`. The six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0 (`evidence/w0/identity-base.txt`). ⚠ In the worktree the generated set failed (no venv) and the reference read "4 differ" (symlinked submodules). At head, in the primary tree with its venv, both rows are `OK` and `ALL 7 + 5 MATCH` |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`; md5 over sorted `status\tfullName` | **611**, `75a3c41f0c91f6e71953e82d8259dc60`, 0 non-pass (= SMALLGAPS's banked value) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE (base worktree) | 155 files: the brief's list + every non-slow test naming `spinningaxe`, the axe names, `hazards.js`, `solverView`, `CONTACT_FIDELITY_KEYS/_DEFAULTS`, `lavaChainPlayerHit`, `stepLavaChainsNow`, surface/constants (`/tmp/claude-0/sa/bounded-base.txt`) | 5,338: 5,326 pass, 10 skip, **2 red, both from the worktree environment**: `loopBlockBuilder` (the substrate matrix) and `generated.test.js` (the reference). Both pass in the primary tree. md5 `2b3c8436cb6d46699f31420d406469bb` |

## D1 — G1: the spinning axe's player arm (PASS; STOP at the flip)

**Re-derived at the base.** Step 163 solves in **366 t**, not 476. Played on p4f (`drivers/game.mjs` from SMALLGAPS), the
game's `hits` rise at **t160** at (86.05,132.60). The model OFF bills nothing and parts at t160. On the game's own
positions, `hazards.axeHitsPlayer` names `spinningaxe@80,144` (hub 88,152, rate −6): the blade at update 160 against
t159's (pre-move) box. Update 159 against t158's box misses (`drivers/axecheck.mjs`).

**Change.**
- **The move** (a pure refactor). `SPINNING_AXE`, `collideLinePlayer`, `axeLine`, `axeHitsPlayer` and `axeCanReach`
  moved verbatim from `hazards.js` to `spinningAxe.js`. `levelRun` imports it, which makes it simulation.
  `solverView.js` re-exports the five names; `hazards.js` imports them there and re-exports them. `dangerMap.js`,
  `solverBot.js`, `plan-seedling-axe-witness.mjs` and `probe-seedling-axe-phase.mjs` are untouched. A vitest pins
  `hazards.X === solverView.X === spinningAxe.X` for all five.
- **The hit point.** New: `axeHitPoint(axe, updates, px, py)`, which is `SpinningAxe.hitPlayer`'s point transcribed:
  `m = tan(a + 2·spinRate/180·π)`, then the foot of the player's point on that line. ⚠ `a` is `−angle`, so this is the
  blade **two updates back**, not ahead. My first docblock said "ahead", and its perpendicularity test failed until I
  corrected the sign. A non-finite point (`m = 0`) is refused by name.
- **The arm.** `levelRun.stepSpinningAxesNow` sits behind `CONTACT_FIDELITY.spinningAxePlayerHit`
  (`SEEDLING_SPINNING_AXE_PLAYER_HIT=0|1`); OFF, it returns at its first test.
  - Order: it steps right after `stepLavaChainsNow`. `Game.as:2358` (the axe) is one line above `:2359` (the chain),
    and `addUpdate` prepends.
  - The counter: per world, `spinningAxeStates`, dropped at both rebuild sites beside `lavaChainStates`.
    `World.update` runs on every `Game.update` with `blackCover <= 0` (`Game.as:880`), so a `load` span does not turn
    the axe.
  - The billing: `applyPlayerHit({source: 'spinningaxe', force 5, damage 1, from: axeHitPoint, retaliate: null})`.
  - When the count is unknown, it is refused by name if the player is within `axeCanReach`. Unknown means: a frozen
    tick this function did not step (`World.update` still runs under `freezeObjects`, but no witness has measured
    that), a non-load dead span in the visit, or a counter that began after the visit's first tick.

**Witnesses** (p4f headless, `probe-seedling-chaser-mobiles.mjs --class=LavaRunner --player-hits --record`, recorded ON;
probe PASS, worst |Δ| 0):

| witness | the plan | game hit | ON | OFF |
|---|---|---|---|---|
| `spinningaxe-l75-163-plan` (367) | survey step 163 at base, 366 t | t160 | **0 px**, bills t160 | parts t160 |
| `spinningaxe-l75-163-reboot` (477) | SMALLGAPS's 476-t plan (`s163-tape-on.json`) | chain t124, death reboot at t160, **axe t357** | **0 px**, bills t357, which is update 197 of the rebuilt world (the boot's count, 357, misses). This witnesses the counter restart | parts t357 |
| `spinningaxe-l75-633-plan` (355) | sweep leg 633's node plan at the row's `seamTime` 5411, 354 t | t159 at (82.49,131.97), the baseline row's own hit | **0 px**, bills t159 | parts t159 |

Rows: `fidelitySpinningAxe.test.js` (15).

**Mutants** (predicted, then made by copy + restore):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | `applyPlayerHit` not called | the three "ON 0 px" rows | ✔ exactly those 3 |
| M2 | the counter not dropped at `freshVisitState`'s rebuild | the reboot ON row only | ✔ exactly that 1 |

**The census.** 11 axes in 9 rooms: L48, L54, L61 ×2, L63, L71, L75, L98 ×2, L101, L103 (`drivers/axe-census.mjs`).
- Survey steps in those rooms: 23.
- Sweep legs in those rooms: 77. The baseline has them as 56 done, 20 failed, 1 skipped.

## D2 — G2: the corridor the walk certifies vs the one it walks (PASS; STOP at the flip)

**Measured first.**
1. The decision at base (`drivers/` scratch survey with the trace dumped; `evidence/d2/s163-trace-base.json`). Two
   rows: a t0 `dodge` (phase arm, `lavachain@96,48`, stall at 31 for 21 t, `partial: [spinningaxe@80,144]`), then a
   t52 `walk` (9 waypoints, no dash planned).
2. G2's premise at base. The t124 chain crossing **no longer happens**: the 366-t plan takes no hit before t160, game
   or model.
3. Preview vs drive (`drivers/probe52.mjs`). `previewWalk` rebuilt from t52 with the row's path gives 314 samples,
   **equal to the game's drive at every tick up to the hit**. `dangerDuringTransit` flags `spinningaxe@80,144`
   (blade, updates 160–169) on those samples.
4. The certification. Instrumenting `probeCorridor` in the base worktree (copy + restore) shows **one call** in the
   whole solve: at t0, hit at t34 = `lavachain@96,48`. No probe ever ran after the stall.

**The first disagreement, named.** It is not a preview field. It is a missing call:
- `solverBot.js`, `walkToUnder`, at the `if (hit) { … climbLadder(…) … }` block. After the phase arm returns a
  `partial` stall's remaining waypoints (`climbLadderUnder`'s phase arm,
  `return { wps: dodge.wps.slice(…), escalations }`), the walk goes straight to `planSwordDash` and the drive.
- The phase arm's own docblock promises "the next probe meets the other danger alone — the AXE arm's question".
- SMALLGAPS's 476-t and 434-t plans had the same t0 dodge row. Their "preview from t53 parts at t77" was a rebuild
  without the run's strike policy, not the walk executor's corridor.

**Change.** `CONTACT_FIDELITY.partialDodgeReprobe` (`SEEDLING_PARTIAL_DODGE_REPROBE=0|1`), OFF.
- The phase arm's return gains `...(dodge.partial ? { partial } : {})`. Nothing reads it while OFF.
- `walkToUnder`'s single `if (hit)` becomes `climbs: while (hit)`. After a climb whose result carries `partial`, and
  only with the switch ON, the rest is re-probed (`probeCorridor`, same options, `walkCheck`) and a hit climbs again.
  The attempt loop gained the label `attempts:` so its `continue` still means the same thing.
- OFF: one climb, then `break`, byte-identical.
- The repeat is bounded by the phase arm's own `PHASE_DODGE_RUNG.maxPerSegment`. The function is the walk executor's
  probe, in my region. It touches none of `deriveStrike`, `strikeEtaFloorOf`, `minTicksBetween` or `jsRuntime*`.

**Result.** Step 163 ON is REFUSED: "the combat ladder is EXHAUSTED … hazard:spinningaxe@80,144 (a SpinningAxe's 32 px
blade on its update 160 of this visit …)". That is the exact contact the game takes.

Rows: `fidelitySpinningAxe.test.js` § D2 (3: ships OFF; OFF solves 366; ON refuses by name at update 160). The rows pin
the axe arm OFF, so they isolate the probe.
- **M3** (`break climbs` unconditional; predicted: the ON row only) → ✔ exactly that 1.

**For the JS arc.** `jsRuntimeWalker` does not walk ladder rungs, so nothing of D2 needs wiring there. A walker that
replays the solver's `perTick` inherits it.

## D3 — G3: leg 768 flips on a beam tower, not the axe (PASS; named and handed over)

**Not the axe.**
- The baseline row's divergence is at t389 at (194.87,245.60). L103's axe (`spinningaxe@112,144`, hub 120,152) is
  ~95 px away; `beamtower@208,248` (direction 2, west) is beside it.
- Leg 768 solved in node at seams 5497–5517 with the axe switch ON and OFF: **identical at all 21**. It refuses for
  ≤5506; 444 t at 5507–08; 443 at 5509–10; 428 at 5511–12; 443 at 5513–15; 447 at 5516–17
  (`evidence/d3/seam768.jsonl`).
- No captured request exists in the baseline (no `capture_requests`), so these are node reconstructions with SMALLGAPS's
  `leg.mjs` (inv staging + the row's items and slots).

**The flip, reproduced to every digit.**
- The sweep's plan is the 577-t `dashless` pass (its `full` pass was cut at the page's `axe-dodge` deadline).
  `ONLY_PASS=dashless` at seam 5507 gives that 577-t plan.
- Booted from its tape on p4f at seam **5507**, it plays **clean**: no hit, 0 px.
- The **same tape** with `seam.time` set to **5506** is hit at **t389 at (194.87037443454506, 245.60447982765967)**, the
  baseline row's `got` to the last digit (`evidence/d3/shiftgame-5506.json`).
- Further shifts: 5501–5506 all hit at t389; 5509 hits at t405; 5511 and 5513 are clean.
- The danger map agrees with the game at both clocks (`drivers/beam389.mjs`). At 5506 `hazardDanger` names
  `beamtower@208,248`, "a BeamTower's beam on its update 389 of this visit (side left)". At 5507 it is clear.

**So:**
1. The plan grazes the beam's phase edge.
2. The solver priced it at the row's `seamTime` 5507, where it is clear.
3. The page's game ran it one `Game.time` behind (5506).
4. The live run does not bill a beam either, so neither the model nor the walk could see the hit once it happened.

The axe arm is not the cause, and neither switch moves the leg. This is two hand-overs (below).

## The survey/sweep rows this moves (before → after, by step/leg)

**Survey** (local, `--through=end --route=full`, all 222 steps per arm; OFF = CI 38778265493 on **every** step,
170 / 50 / 1 / 1; `evidence/survey/survey-table.tsv`):

| step | level | OFF (= CI) | `spinningAxePlayerHit` | `partialDodgeReprobe` | both | the game |
|---|---|---|---|---|---|---|
| 163 | 75 | SOLVED 366 | **REFUSED** (the drive is hit at t160, dies; the re-plan refuses at `lavachain@96,32`) | **REFUSED** by name at the axe's update 160 | **REFUSED** (as D2) | the 366-t plan is hit at t160 (witness): REFUSED is the verdict the game agrees with |

221 steps byte-equal in every arm. Tallies ON: 169 / 51 / 1 / 1.

**Sweep legs** (node at each baseline row's `seamTime`, `drivers/ab.sh`, `evidence/legs/`). The 77 axe-room legs were
run OFF/D1; the 37 chain/beam-room legs OFF/D2/both:

| leg (by key) | baseline 38778270309 | node OFF | D1 | D2 | both | the game |
|---|---|---|---|---|---|---|
| 633 `level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224` | failed (hit t159) | SOLVED 354 | **REFUSED** by name (`lavachain@96,32`) | **REFUSED** by name (`lavarunner@8,112`) | REFUSED | the 354-t plan is hit by the axe at t159 (witness `spinningaxe-l75-633-plan`) |
| 765 `level_103 <- in_L102_0_96 -> exit:out_teleporter_0_64` | failed | SOLVED 678 | **REFUSED** by name ("no strategy row … `solid:spinningaxe`") | **REFUSED** by name (`spinningaxe@112,144`'s blade) | REFUSED | ⚠ the OFF plan parts FIRST at t245 beside `beamtower@208,248`, on both arms; D1's model bills the axe at t464, downstream of that unmodelled beam hit. Not witnessable until the beam's player arm is modelled |

Every other leg is unchanged in every arm. No `producer:walker` row exists in the baseline (all 843 are `solver`), so no
walker row moves.

**Hammer's workloads.** Staging A sword/ghost, L40 397/414 and the L18 sweep sit in no axe, chain or beam room. Both
switches are gated on room content: D1 returns at `axes.length === 0`; D2 needs a phase arm's `partial`, which needs a
chain or a beam. The full survey confirms it: none of their steps moves.

### Dispatches for the planner (branch `claude/spinning-axe-player-arm-8mobcw`)

`<D>` = the ON defaults at base:
`collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove`.

1. **Full sweep A/B** (`seedling-divergence-sweep.yml`), three runs: `-f contact_fidelity=<D>,spinningAxePlayerHit`,
   `-f contact_fidelity=<D>,partialDodgeReprobe`, and `-f contact_fidelity=<D>,spinningAxePlayerHit,partialDodgeReprobe`,
   each against `-f contact_fidelity=<D>` (or baseline 38778270309). Expect 633 and 765 failed → a named refusal. ~20
   `crossed`↔`done` swaps each way are noise; repeat ×2 on any other key that moves.
2. **Narrow sweep** (cheaper, the same claim): `-f keys='level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224|level_103 <- in_L102_0_96 -> exit:out_teleporter_0_64|level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144'`
   with the three `contact_fidelity` sets above. Expect 768 unmoved by either switch.
3. **Survey** (no `contact_fidelity` input). A measurement commit flipping one default (or both), then
   `seedling-survey.yml -f through=end -f route=full -f only=163 -f base_run=38778265493`. Expect REFUSED; a full run
   expects no other mover.
4. **D3, for the JS arc** (`seedling-divergence-sweep.yml -f keys='level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144' -f capture_requests=true -f seam_census=true`):
   the captured request's `staging.seam.time` against the page's live `Game.time` at the arrival's first live tick.
   Expect them one apart on a row that fails.

## The JS arc's pins that move + what it must wire

- **Nothing breaks unwired.** Two new `CONTACT_FIDELITY` keys, appended (no reorder). `seedlingContactSettings.js`
  derives a page setting per key, and the sweep's `contact_fidelity=` reaches both.
- No signature or contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`).
- No new staging or result field, and no new `obstacle.kind`. New `playerHits` rows carry `source: 'spinningaxe'`.
- **Hand-over, D3:** leg 768's failing row ran one `Game.time` behind its recorded `seamTime` (5506 vs 5507, reproduced
  to the digit above). Owners: the seam census and `wasmArrival` / `staging.seam.time`. A request's `seam.time` that is
  not the game's clock at the first live tick turns phase-edge plans into run-to-run flips: beams here, chains and
  axes alike.
- **Found, not mine:** a sweep row's `items` now carries `hitsMax` (`seam.items.hitsMax: 3|4`), and `parseTape` rejects
  it ("not a seam field"). A plan built from such a row (SMALLGAPS's `leg.mjs` with `TAPE_OUT`) cannot be booted on the
  game unedited. I stripped it for the game plays; on 765, `hitsMax 4` → the default changes the game's death count, so
  that record is not evidence for 765's late ticks.

## Handed to the hammer arc

Nothing. No hammer-owned function was touched: `deriveStrike`, `strikeEtaFloorOf`, `minTicksBetween`, `strikeScanBox`,
the press and escape kernels, and `hazards.js`' SandTrap pricing are all unchanged.

## To other wave-17 slices

- **BEAMTOWER.** The live run never bills a beam on the player either (`BeamTower.as:88-93`:
  `collideRect("Player", getRect(direction))` → `p.hit(null, force, (x, y), damage)`; `Game.shake = 15`).
  - Leg 768's t389 hit and 765's first parting (t245) are both `beamtower@208,248`.
  - The danger map prices the beam at its update (LADDER2) and agrees with the game at both clocks I tested.
  - The arm is the `lavaChain.js`/`spinningAxe.js` shape in your region.
- **CORRIDOR.** D2's missing re-probe is upstream of any corridor pricing: a corridor that is never probed is never
  priced.

## Deltas (base → head)

**Code**
- `spinningAxe.js` (new: the moved geometry + `axeHitPoint`).
- `hazards.js` (the block removed; import + re-export through the door).
- `solverView.js` (+1 re-export line).
- `levelRun.js` (the import; `spinningAxeStates` + its two drops; `stepSpinningAxesNow` and its call).
- `solverBot.js` (the phase arm's `partial`; `walkToUnder`'s `attempts:` label and `climbs:` loop).
- `contactFidelity.js` (+2 switches, OFF, env hooks).

**Tests**
- `fidelitySpinningAxe.test.js` (15, new).
- `contactFidelity.test.js` (the defaults pin +2 keys, its `skipIf` +2 env names).

**Fixtures** (`fixtures/chaser-witness/`, not the roster): `spinningaxe-l75-163-plan`, `spinningaxe-l75-163-reboot`,
`spinningaxe-l75-633-plan`.

**Censuses and docs**
- Surface `--write`: 301 rows; the 5 axe imports now resolve to `spinningAxe.js`, classified; lines moved.
- Constants `--write`: 5,909; 6 `spinningAxe.js` bindings classified, placed above the profile block.
- Docs: the `seedling-bot.md` paragraph; `seedling-bot-log.md` § *Seedling fidelity SPINNINGAXE*; the reference
  regenerated.
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-spinningaxe-evidence/`.

## Byte-inertia (OFF) and the flip's movers (ON)

| row | OFF (head) | ON (both switches) |
|---|---|---|
| identity block | every value row = W0. Generated set `OK`, the six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c` exit 0, reference `ALL 7 + 5 MATCH` (`evidence/w0/identity-head-off.txt`) | **identical to OFF on every row**, the six producer `--check`s included (`evidence/w0/identity-head-on.txt`; `SEEDLING_SPINNING_AXE_PLAYER_HIT=1 SEEDLING_PARTIAL_DODGE_REPROBE=1`) |
| tapeRunner | 611, `75a3c41f…`, 0 non-pass | — (no tape replays an axe room) |
| bounded vitest (156 files) | 5,697: **5,696 pass**. 1 red: `boxLock`'s "a QUEUED taker dies on SIGTERM", which ran beside a second vitest contending for the box; **26/26 alone** | — |
| a real default flip (both `true`, scratch worktree at `28379ce`) | — | **3 rows of ours**: `contactFidelity.test.js` "the shipped defaults"; `fidelitySpinningAxe`'s two "ships OFF". Plus the base's two worktree-environment reds (`loopBlockBuilder`, `generated`). md5 `e5c1d463947d15bcef54778737e26926`. Nothing else in the bounded set, including `r8Acceptance` and every roster pin |

## What the brief got wrong (measured)

1. *"Re-derive which plan meets the axe at your base first"*: done. At base, step 163's 366-t plan meets it at
   **t160**, not t357. The t357 hit is SMALLGAPS's 476-t plan, after a death reboot.
2. *"G2 — Both of SMALLGAPS's 163 plans walk into the t124 chain arm … the corridor the walk executor certifies and the
   one it walks differ somewhere in its preview/probe"*:
   - At base no plan crosses t124.
   - The preview equals the drive.
   - The defect is a missing probe after a `partial` phase dodge (one `probeCorridor` call per solve), not a
     preview/probe disagreement.
3. *"G3 — leg 768 … the spinning-axe ladder … If the axe arm (D1) is the cause, say so"*: it is not. The axe switch moves
   none of 21 seams. The flip is `beamtower@208,248` on a one-tick clock difference.
4. *"a projected hit point"*: the point is the foot on the blade **two updates back** (`a + 2·spinRate`, `a = −angle`).

## Residue

1. **The axe under a freeze.** `World.update` runs under `freezeObjects` (`Game.as:880`), so the axe turns through a
   frozen tick or a freeze/ceremony/help span. The arm treats the count as unknown there and refuses only if the player
   is in reach. No axe room in the survey or the 77 legs reached that refusal. It is unwitnessed.
2. **Leg 765** past t245: needs the beam's player arm (BEAMTOWER) before its axe at t464 can be witnessed.
3. **D3's clock difference** (the JS arc), and the beam's live arm (BEAMTOWER).
4. **The sweep row's `hitsMax`** is not a tape seam field (the JS arc).

## Rows to BANK

- `contactFidelity.js`: `spinningAxePlayerHit: false`, `partialDodgeReprobe: false`.
- `fidelitySpinningAxe.test.js` 15 rows.
- Witnesses: `spinningaxe-l75-163-plan` (367), `spinningaxe-l75-163-reboot` (477), `spinningaxe-l75-633-plan` (355).
- Survey local OFF = CI 38778265493 on all 222; both ON: step 163 alone moves.
- Surface GREEN 301 · constants PASS 5,909 · entities PASS 566 · profile PASS 138 · roster 277 · reference ALL 7 + 5
  MATCH · tapeRunner 611 `75a3c41f…`.
- CI (`JavaScript Unit Tests`) at `28379ce` (the last code/test head): run 38806363523, **success** — vitest unfiltered 20,423 passed / 0 failed, slow battery 253/253. This report's own commit adds only the report and one evidence file.
