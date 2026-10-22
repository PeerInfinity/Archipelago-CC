# Seedling fidelity MASKS — the swing's line samples the "Solid" pixelmasks, and the chaser arm asks it (`pixelMaskSightLines`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-masks` (planner `seedling-fidelity-planning-10`, wave 25) |
| Start SHA | `e2b0f2b63f` (main) |
| Code head | `516d8c2b` (the report is the commit after it) |
| Harness branch | `claude/seedling-pixel-mask-sight-lines-x57owr` (the brief's `seedling-fidelity-masks`; nothing pushed elsewhere) |
| Port | 9715 (the pristine base worktree: 9716; the scratch-flip worktree for the probe battery: 9717) |
| Verdicts | **W0 PASS · D1 PASS (2 p4g witnesses, 0 px — one is a CONTROL; no CliffSide-on-a-chaser-line witness found) · D2 PASS behind `pixelMaskSightLines` (OFF) · spinner family: STOP → handed to the hammer arc · Movers: STOP for a licence (list below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-masks-evidence/` |

## The one thing to know first

**The biggest gap was not the masks: the model's swing at a CHASER (bob, jellyfish, bobsoldier, puncher, lavarunner)
asked no line of sight at all — not even against walls.** `Player.slash` gates every non-Solid/Rope/Flyer target on
`collideLine("Solid", …)` (`Player.as:917`). Witnessed on p4g (`mask-l65-wall`): the line's first sample meets a wall tile,
the game's bob takes no hit, the model (OFF) knocks it back at t3. With the key ON the arm asks the game's line (boxes and
masks) and the witness reproduces at 0 px. Second finding: **an `OpenTree` is not "Solid"** — it extends `Tree`
(`type = "Tree"`, `Scenery/Tree.as:22`); the first cut sampled it and refused a swing the game LANDS (`mask-l65-opentree`,
now a control). `ENTITY_CLASSES.opentree` says "Solid" — handed over.

## W0 — the readers and the census (PASS)

**The game's line tests** (`grep collideLine vendor/seedling/src`):

| AS3 line | type | masks? | model reader | decision |
|---|---|---|---|---|
| `Player.as:917` slash → each target's entity point | "Solid" | YES (`collidePoint` → `Pixelmask.collideMask`) | `applyThrust`'s arms, the boss verbs, `corridorBodyForecastNow`, the forecasts, `run.collideLineSolid` (solver mirrors) | see D2 per arm |
| `Crusher.as:58` crusher → player | "Solid" | yes | `crusher.scanCrusher` (box list) | **leave**: no level holds a crusher AND a mask (`w0-census.txt`: `crushers=0` in every mask level); `assertCrusherSolidsBound` still refuses by name |
| `Drill.as:86` drill → player | "Solid" | yes | `stepDrill.lineBlocked` | DRILL masked mixed rooms; ON adds the lone L88 drill |
| `Spinner.as:82` spinner → player (chase) | "Solid" | yes | none | moot: `runRange` 0 |
| `LavaTrap.as:88` trap → player | "Solid" | yes | none | the tongue's launch is not stepped (static `aggro`) |
| Spinner hammer `:72`, WallFlyer `:62`, BobSoldier/BobBoss swords `:165`, SpinningAxe `:55`, Chest `:63`, BossLock `:62`, LavaTrap tongue `:145` | **"Player"** | never | spinner.js, wallFlyer.js, bobBossFight.js, spinningAxe.js, chest probe, dangerMap's sword lines, lightsVerb | **leave**: a mask is never type "Player" |

The brief's "BobBoss rays", "chest probe line", "wallflyer", "spinner hammer" are all "Player" lines: no mask can change them.

**Census** (`w0-census.mjs` → `w0-census.txt`; `w0-swing-census.mjs` → `w0-swing-census.txt`). Every atlas level with a
"Solid" pixelmask (22 levels once the OpenTree is excluded). A swing at a Tree does nothing (`Tree.hit` is empty), at a
LightPole only on "Spear" (and a ghost swing waives the line), at a text-less Watcher nothing (`Watcher.hit` needs
`text != ""`) — so L66's two lightpoles behind Building8 and L94's watcher behind the TreeLarge are moot. With the game's
full gate (the slash rect `collideRectInto`, inclusive; `distanceRectPoint` ≤ 16 / 24 dash; player free):
- static targets: only L57's tentacle beast body (its own mask);
- movers (a geometric bound: the enemy anywhere free within 40 px of a mask, 2 px grid): L12 puncher, L28 drills +
  bobsoldier, L88 drill, L91 bobs + drill, **L92 jellyfish + bob + SPINNER**, L99 lavarunners, L100 jellyfish;
- the drill trigger (48 px): L28, L91 (DRILL's), **L88 (one placement point at 47.4 px; more once it hops)**.

## D1 — the game witnesses (PASS; p4g, headless logic-only, 0 px)

`scripts/procgen/probe-seedling-mask-lines.mjs --record` → `fixtures/mask-witness/`; `fidelityMasks.test.js` replays them
(DRILL's sampler/comparator: player x/y/level/hits and every Bob row, every tick).

| witness | script | game | key ON | key OFF |
|---|---|---|---|---|
| `mask-l65-wall` | L65 boot (216,72), idle, sword at t2 and every 12 t, 60 t | the player stands at (224,80); the line's first sample meets `tile:Body Wall` at (224,80); the bob takes no hit | 0 px (60 ticks) | leaves at t5 (knocked the bob back at t3) |
| `mask-l65-opentree` (control) | L65 boot (192,40), same presses, 110 t | t87-89 the line from (200,48) starts inside the OpenTree's opaque pixels — and the swing LANDS (bob knocked back t88) | 0 px (109 ticks) | 0 px |

**Searched, not found** (`search-swing.mjs`): a CliffSide/Building blocking a swing at a chaser — idle boots on a 4 px grid
(L12, L28, L91, L92, L100) and walk-then-swing scripts (L28, L91, L92, L99, L100), and a lone-drill trigger divergence in L88
and a wallflyer in L27: 0 cases. A chaser closes on the player along a clear line, so a mask between them is rarely within
reach. The masked line itself is DRILL's sampler, witnessed at 0 px by `drill-l28-cliffside`.

## D2 — the model (PASS, behind `pixelMaskSightLines`, OFF)

`contactFidelity.js`: `pixelMaskSightLines` (OFF; `SEEDLING_PIXEL_MASK_SIGHT_LINES=0|1`). One implementation (DRILL's):

- **`levelRun.collideLineSolid(…, {masks})`** — unchanged default (boxes). New: an exact bounding prefilter (only masks
  whose rect meets the line's bbox; integer origins) — `fidelityMasks.test.js` checks it against an every-mask,
  every-sample reference on 9,000 lines; and the **OpenTree is excluded** (AS3 type "Tree").
- Readers passing `{masks: CONTACT_FIDELITY.pixelMaskSightLines}`: the swing at a **drill** and a **wallflyer**, the
  **tentacle** arm (the bosskills D3 by-name interim — "the line crosses the beast's pixelmask box" — is skipped ON: the
  line samples the beast's mask itself), the **corridor body forecast**, the **drill trigger** (`mixed || key`: the lone
  L88 drill too; and the drill forecast `drillMixedRooms || key`).
- **The chaser arm of `applyThrust`** (`r.as3 === 'Enemy'`, the family arm) gains `Player.as:917`'s line, ON only: a sword
  (not the spear — `spear()` has no line; not a ghost swing; not a `flyer`), boxes and masks; a blocked line records
  `landed: false, why: 'collideLine("Solid") meets <tag> at (x, y)'`.
- **`run.collideLineSolid`** takes an optional 5th `{masks}`; the solver mirrors pass the key: `guardedChaserDwell`'s pin
  diagnosis, `ropeStanceAdmit` / `rankRopeStances`' drill lines (the ROPESTANCE interim, live only with `drillMixedRooms` OFF).
- **Not changed**: the boss arms whose rooms hold no mask (shield, final, BobBoss, lights, lava), the watcher arm (moot),
  the static-body arm (hammer's `STATIC_SWORD_ARM`), and the spinner family (below).

**Digest rule**: no new per-visit state (the switch and the static `world.pixelmasks` only); `stateDigest*` untouched.

## Mutants (predicted first, copy + edit + run + restore; all red as predicted)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | the chaser arm asks no line | `mask-l65-wall` reds | red (0 px row + the OFF/ON row) |
| m2 | the mask filter keeps the OpenTree | `mask-l65-opentree` reds | red (and the OpenTree unit row) |
| m3 | the prefilter drops `p.maskX + w > lx0` → `p.maskX > lx0` | the prefilter row reds | red |
| m4 | the masks always sampled | the byte-inertia row reds | red (and the L28 row, the prefilter row) |

## The survey / sweep / probe rows this moves (key ON) and the dispatches to confirm

- **Route survey, full, local** (`survey-seedling-route.mjs --through=end --route=full`, OFF vs
  `SEEDLING_PIXEL_MASK_SIGHT_LINES=1`): **0 movers** — all 250 rows identical but `ms`; both 191 SOLVED / 53 REFUSED /
  3 NO-EDGE / 3 NO-ARRIVAL (`survey-full-{off,on}.txt`).
- **Standard probe battery, local, key ON** (a scratch worktree with the default flipped, port 9717): **11/11 ALL CHECKS
  PASSED** — `wasm-arrival-composites` included (`probe-battery-standard-on.txt`).
- **Bounded vitest ON** (`SEEDLING_PIXEL_MASK_SIGHT_LINES=1`, 149 files): 3 red (`rows-on.txt`):
  1. `contactFidelity.test.js > the shipped defaults` — the defaults table;
  2. `dashShape.test.js > the defaults add no field` — the request stamps an off-default switch (moot at a flip);
  3. **`seedlingRobust.test.js > {sword} alone is unmoved (878 t, PULL)`** (strikeIframeLapse OFF, L16 from L15): **878 →
     882 t, hash `b9fc18ae79` → `8d7368f487`**, 0 hits both. The cause: t587-591, swings at `bob@224,96` from
     (280.5, 106→102.6) whose line meets `tile:Stone` at (271.3, 96) and a `pushableblock` at (272, 95.6) — the BOX half
     of the chaser line, the `mask-l65-wall` rule. Unwitnessed on the game for this plan.
- **Keyed sweep: not run locally** (it shares the box with the battery). The chaser arm reaches every room the run steps
  chasers in, so the keyed set is the 369 legs in chaser rooms (`leg-keys-chaser-rooms.txt`, levels 4-6, 12, 14, 16, 17,
  22, 25, 26, 28, 30, 40, 45, 53, 54, 60, 63, 65, 71-75, 77, 78, 80, 88, 91, 92, 98-101, 103-105); the mask rooms alone are
  121 (`leg-keys-mask-rooms.txt`).

**Please run, on this branch:**
1. `seedling-survey.yml` `through=end route=full`, ARM A `contact_fidelity=` the 44 defaults, ARM B the 44 +
   `pixelMaskSightLines`. Compare by (level, goal, boot) against **39496129402**. Expected: 0 movers.
2. `seedling-divergence-sweep.yml`, `keys=` `leg-keys-chaser-rooms.txt` (`|`-joined), `capture_requests=true`, ARM A /
   ARM B as above, **×2 each**. The 44: `collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,
   wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,
   totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,
   waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,
   sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,
   coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,igneousLava,kingOfFireFight,ropeCutVerb,chestProbeLineEnd,
   enclosedPitCorner,igneousDeadFrames,ropeCutAnyWeapon,drillMixedRooms` (⚠ an unlisted key is OFF). Expected: movers only
   where a chaser swing crosses a wall/mask; `crossed↔done` noise.
3. `seedling-probe.yml battery=standard` on a scratch commit flipping the default (expected 11/11, as measured here), and
   `probe-seedling-mask-lines.mjs` (2 witnesses — ALL CHECKS PASSED on 9715).

## Bounded vitest and byte-inertia (OFF)

- BEFORE (base worktree, 148 files): **5,244 passed / 5,244** (`rows-before.txt`). AFTER (head, 149 files, OFF): 5,254 /
  5,255 at `87775c50` — the one red was mine (`boxLock.test.js`: the new probe takes the box and was not on the guarded
  roster; fixed in `6faa0acd`, 26/26) (`rows-after.txt`). The +10 rows are `fidelityMasks.test.js`.
- **Identity**: head = base on every md5 row and on all six producer `--check`s (exit 0) (`identity-w0.txt`,
  `identity-head.txt`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY
  `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`;
  battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640`.
  Reference: 4 DIFFER — environmental (this checkout lacks the noiz2sa/omsi/jta submodules; the same at the base).
- Surface census GREEN 342 (`--write`: solverBot's three new switch reads); constants `--write` 6,891, `--check` PASS.
- No committed tape and no producer digest moved; the witness fixtures are not tapes.

## CI at the code head

`JavaScript Unit Tests` @ `516d8c2b`: **success** — suite (unfiltered, quoted from CI per ⚖ 52) 22,117 passed / 0 skipped
/ 0 failed; slow battery 263/263 (`ci-vitest-summary.mjs`). Same at `6faa0acd`. The report commit is docs-only.

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched; no new
  refusal kind. `run.collideLineSolid` gains an optional 5th `{masks}` (four arguments: as before).
- `run.chaserPressHits` rows may carry `why: 'collideLine("Solid") meets …'` (key ON only). No `run.*` field renamed.
- The walker (`botDriverV2.*`) untouched: no `producer:walker` row can move.
- A flip owes re-pins of: `contactFidelity.test.js` (the defaults table), `dashShape.test.js` (moot at a flip),
  `seedlingRobust.test.js`'s L16 `{sword}` row (882 t, `8d7368f487`), `fidelityMasks.test.js > is OFF by default`.

## Hand-overs

- **⛔ The hammer arc — the spinner's swing line needs the masks in L92.** L92 holds `spinner@224,64` beside 38 CliffSide
  masks; the mover census finds 101,213 normal-reach (player, spinner) pairs whose line is clear on the boxes and blocked
  by a CliffSide (e.g. P(21,88)→E(36,76), `cliffside1@16,80`; `w0-swing-census.txt`). Every reader of that line is the
  hammer arc's or must agree with it: `forecastSwordTest` (`spinnerForecastWithPress` / `spinnerFightForecast`),
  `solverBot.lineOnce` / `trainLineBlockedHere` (the strike line, `pressKillCost.js`' carried book — keyed by world
  identity, so a static mask set keeps it sound), and the executor's `spinnerSwingBlockedNow` / `assertSpinnerLineOfSight`
  (kept on the boxes so step and forecast agree). The door: pass `{masks: CONTACT_FIDELITY.pixelMaskSightLines}` at all of
  them at once. Unwitnessed on the game (no search reached it).
- **`ENTITY_CLASSES.opentree.type` is "Solid"; AS3 says "Tree"** (`OpenTree extends Tree`, `Tree.as:22`; measured
  `mask-l65-opentree`). The line here excludes it; other readers of the table (the blast and arrow cover lists — "Tree" is
  in both, so the same; `Crusher.solids` = "Solid" only, so a crusher would pass through an OpenTree — no level has both;
  the bobs' / chasers' solids lists) were not audited. Owner: whoever holds `levelWorld.ENTITY_CLASSES`.
- The general chaser arm's line is witnessed for boxes only; a masked chaser line is DRILL's sampler (witnessed on the
  drill) — no CliffSide case was found to record.

## What the brief got wrong (measured)

- "the BobBoss rays, the chest probe line, the wallflyer, the lights verb, the totem … are still mask-blind": they are
  `collideLine("Player", …)` (or a box list in a room with no mask) — no mask can change them.
- "the crusher's sight": no level holds a crusher and a mask.
- "Every other reader is still mask-blind": the chaser arm was LINE-blind — it asked no `collideLine` at all.
- "`collideLine("Solid", …)` tests every 'Solid' entity INCLUDING pixelmask ones (a CliffSide, a Building)": yes — but the
  model's mask list also holds the OpenTree, which is type "Tree".
- The census found masks on L66's lightpoles (5 px) and L94's watcher: both moot (a sword does nothing to either).

## Residue

- No game witness of a mask (as opposed to a wall) blocking a chaser swing, of the lone L88 drill's masked trigger, or of
  the tentacle line across the beast's mask (`tentacleBeastFight` OFF).
- The keyed sweep is the planner's (above).

## Rows to BANK

- W0: the five "Solid" line tests; the "Player" lines; no crusher-and-mask level; the OpenTree's type.
- D1: `mask-l65-wall` (0 px ON, OFF leaves at t5), `mask-l65-opentree` (control) — `fixtures/mask-witness/`.
- Mutants m1-m4.
- Movers ON: survey 0; standard battery 11/11; bounded vitest 3 (two flip pins + `seedlingRobust` L16 878→882 t).
- Trap candidates (in the bot-log entry): a collider's type comes from the constructor chain, not its asset; a gate the
  game runs on every swing target can be missing from one arm of the model's dispatch.
- Commits: D2 `3954654c` / `d933f61f`, D1 `4adb9775`, censuses `87775c50`, boxLock roster `6faa0acd`, records `516d8c2b`.
