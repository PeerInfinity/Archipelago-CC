# Seedling fidelity DRILL — every drill of a mixed room stepped (`drillMixedRooms`, OFF); the rope interim retires

| | |
|---|---|
| Session | `seedling-fidelity-drill` (planner `seedling-fidelity-planning-10`, wave 24) |
| Start SHA | `addc6ff7b2` (fidelity ROPESTANCE's head) |
| Code head | `4051233d0b` (the report is the commit after it) |
| Harness branch | `claude/seedling-drill-mixed-rooms-sjjcob` (the brief's `seedling-fidelity-drill`; nothing pushed elsewhere) |
| Port | 9712 (the pristine base worktree's own server: 9713) |
| Verdicts | **W0 PASS · D1 PASS (5 p4g witnesses, 0 px; (b) re-pointed — see below) · D2 PASS behind `drillMixedRooms` (OFF) · D3 PASS behind the same key (refuses BY NAME on the drill) · Movers: STOP for a licence (the list is below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-drill-evidence/` |

## The one thing to know first

**With `drillMixedRooms` ON the model steps L28's two drills and L91's drill beside their other enemies, and five p4g
witnesses reproduce at 0 px — the player, both drills' position and animation, and every chaser, every tick.** Getting
there needed three model fixes the brief did not name, each found by a witness diverging:
1. **the drill's sight line samples PIXELMASKS** — L28's CliffSide at (160,112) hides a player 46.9 px away on the game;
   `collideLineSolid` walked boxes only (it takes an optional `{masks: true}` now, used by the drill alone);
2. **the spear's T+3 / T+5 tests reach a drill** — a drill hops INTO the thrust after the first test;
3. **the spear's rect is `int`-origined and `collideRect` is inclusive** (`spearX`/`spearY` are `int` getters) —
   `presses.spearRect` carries neither. The drill's tests use the game's rule; the rest of the package is a hand-over.

ROPESTANCE's failing run (L28's spear from the L25 arrival) is now a witness the model reproduces (the t59 hit at
(129.344, 72.019)), and with the key ON the solver refuses that cut **naming `drill@128,96` at run tick 59**.
The brief's (b) — a drill meeting **the bobsoldier in L28** — **cannot happen**: the drills and the bobsoldier are in
different walkable components of L28. The drill↔chaser meet is witnessed in **L91** instead, both ways.

## W0 — the base (PASS)

**The census** (`evidence/w0-census.mjs` → `w0-census.txt`, every atlas level, `combatCensusOf`):

| level | census enemies | the drill's "Enemy" term meets |
|---|---|---|
| L28 | `drill@80,96`, `drill@128,96`, `bobsoldier@264,168` | **the other drill only.** The drills (tiles (5,6), (8,6)) are in the L25-arrival component; the bobsoldier (tile (17,11)) is in another (`planWaypoints`: "different connected components"). A lure search (`evidence/lure-search-l28-bobsoldier.mjs`, 12 boots × 154 targets, greedy walks, and a planned-waypoint variant) found no tick where the bobsoldier's box is in a triggered drill's hop target once the sight line is the game's |
| L88 | `drill@128,160` | nothing (stepped since TERRAIN W3) |
| L91 | `bob@128,64`, `bob@160,96`, `bob@192,80`, `drill@64,80` | the bobs (Bob's own `solids` carry "Enemy" too, so the bobs meet the drill as well) |

**`Enemies/Drill.as`, read.** The trigger is `currentAnim == "sit" && distance(x, y, player) <= 48 &&
!collideLine("Solid", x, y, player.x, player.y)`; the hop is `tox`/`toy` ±16 per axis, each taken only when
`collideTypes(solids, …)` is null at the target, `solids = Mobile.solids + "Enemy"` (`:35`) — every "Enemy" body's
HITBOX where it stands at that moment. Update order (`Game.as:2276-2290`, `addUpdate` prepends): the drills update
**before** the bobs and the bobsoldier (so a drill reads a chaser where the PREVIOUS tick left it) and the **last** drill
placement first (so the second drill reads the first where THIS tick left it). There is no stop/turn on meeting a body:
a blocked axis just does not move, and the other axis is still tried. `Enemy.update`'s off-screen return gates the
contact and the i-frame only, never the hop.

| row | result |
|---|---|
| identity block (`identity-block.sh`, pristine base worktree, port 9713; `evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640` (all exit 0) — **equal to ROPESTANCE's head on every md5 row**. `generated set`: environmental (the worktree has no venv). Reference: 4 DIFFER (environmental, as ROPESTANCE measured) |
| tapeRunner pairs (`tapeRunner.test.js` rows, ROPESTANCE's format) | 636 rows, md5 `56c18c64cbd7e5595b0e4903bbc65477`, 0 non-pass (= ROPESTANCE) |
| surface / constants / entities / profile | surface GREEN 342 at the base's census; entities PASS 566; profile PASS 138 (both) |
| bounded vitest BEFORE (`evidence/vitest-files.txt`: ROPESTANCE's 131 + every test that greps for what I touched, 149 listed; 147 run — the `.slow` files are excluded by the default config) | **5,212 tests, 5,212 passed, 0 failed** (`evidence/rows-before.txt`) |

## D1 — the game witnesses (PASS; p4g, headless logic-only, 0 px)

`scripts/procgen/probe-seedling-drill-mixed.mjs --record` → `fixtures/drill-witness/`. Each poll reads `botStatus` (the
player) and `botMobiles` (every `Drill`, `Bob`, `BobSoldier` row); the model replays the same tape with the key ON and
`fidelityDrill.test.js` re-checks every recorded tick in node (`compareDrillWitness`: player x/y/level/hits, each drill's
x/y/anim, each chaser's x/y, joined by the cheapest pairing within a class). Output: `evidence/probe-record.txt`.

| witness | what it shows | game |
|---|---|---|
| `drill-l28-pair` (a) | boot (96,64), idle 60 t: `drill@128,96` (updates first) is refused its x-hop by `drill@80,96` from t16 | hits t17, t37; 60 ticks at 0 px |
| `drill-l28-cliffside` | boot (240,192), the greedy walk toward (176,88), 264 t: at t65 the player is 46.9 px from `drill@128,96` and **the game's drill does not hop** — the line crosses the CliffSide's opaque half | no drill moves in 264 ticks; hit t244; 0 px |
| `drill-l91-bob` (b, re-pointed) | L91, boot (120,72), idle 80 t: from t49 `drill@64,80`'s x-hop is refused by `bob@128,64` | hits t13, t79; 0 px |
| `drill-l91-bob-wall` | L91, boot (112,80), idle 70 t: at t41 a bob's sweep stops against the live drill | 0 px |
| `drill-l28-spear-l25` (ROPESTANCE's failing run) | the spear plan the solver made with the drills unstepped (stance (136,72), 71 t + 4 idle): the hop at t58, the contact at t59, the spear's T+1 hit on `drill@128,96` and its T+3 hit on `drill@80,96`, which hopped into the rect at t71 | hit t59 at (129.34416718774472, 72.01906775986716) — the model's point; 0 px |

The `plan` witness's keys are ROPESTANCE's own plan, made by mutant m4 of that slice (`unsteppedDrills` → `[]`, the key
OFF); `--plan=<tape.json>` feeds them, and the fixture keeps them.

## D2 — the model (PASS, behind `drillMixedRooms`, OFF)

`contactFidelity.js`: a new key `drillMixedRooms` (OFF; `SEEDLING_DRILL_MIXED_ROOMS=0|1`). With it ON (and `drillLive`):

- **`levelRun.drillStateFor`** admits every drill of a room whose census holds more than the one drill (a lone drill's
  rule is untouched).
- **`stepDrillsNow`** walks them LAST placement first. The hop's `collides` is the box solids plus
  **`drillEnemyBodiesTest`**: the other drills (the map being stepped — earlier updaters where this tick left them), the
  chasers (`chaserStateFor`, where the previous tick left them; a non-collidable body skipped), the static census boxes and
  turrets (`chaserStaticEnemyBoxesNow`), the wallflyers and the spinners. A census body of a MOVING class the run does not
  step (e.g. the bobsoldier with `bobSoldierLive` OFF) is **refused by name when a hop asks**, never passed through.
- **The sight line** is `collideLineSolid(…, {masks: true})`: the box solids, then each "Solid" pixelmask per point
  (`maskHitsBox` with a 1x1 box = `Entity.collidePoint` → `Pixelmask.collideHitbox`). Every other caller passes nothing
  and reads boxes only, as before.
- **A hop onto water, lava or a pit is refused by name** (`drill.js` has no terrain switch; the L91 scan met one at
  boot (32,112)).
- **The spear against a drill**: `spearTouchesDrill` is `spear()`'s rect from the `int` origin with `collideRect`'s
  inclusive edges, for the T+1 test (the audit's arm, plus any drill the audit's `spearRect` missed) and for the T+3 /
  T+5 repeats (`drillSpearRepeats`, scheduled by a spear thrust in a drill room). The spear arm's reach gate and line test
  are waived for a drill (`spear()` has neither).
- **The chasers meet the drills**: `drillWallsNow` adds the live drills to `stepChasersNow`'s "Enemy" walls (and,
  held where they stand, to `chaserForecastNow`'s — the forecast does not hop them; named in the code).
- **The danger map** (`staticEnemyDanger`) prices a stepped drill as a static box at its LIVE position (a removed one not
  at all), and says so in its `why`.
- The corridor body forecast (`corridorBodyPricing`, OFF by default) steps the cloned drills in the same order with the
  same "Enemy" test (the run's chasers held where they stand — named) and the masked line.

**The digest rule.** `drillSpearRepeats` is a new per-visit array (`freshVisitState` resets it). Member-reach
(`--members-of=drillSpearRepeats`): readers `freshVisitState`, `applyThrust`, `drillSpearRepeatsNow`; members
`[advance]` → a `DIGEST_EXEMPT` row `UNREAD: read via advance only (drillSpearRepeatsNow, applyThrust)` — its twin
`lightsSpearRepeats` has the same row. It landed in the D2 commit with the array. `drillStates` was already exempt. No
other new per-visit state; `stateDigest`/`stateDigestParts` untouched.

## D3 — the interim retires (PASS, behind the same key)

With `drillLive && drillMixedRooms` ON: `unsteppedDrills` returns `[]`, `ropeStanceAdmit` is `pullStanceAdmit` itself, and
`rankRopeStances`' corridor check is a no-op (it already returned true on an empty list). OFF: the interim, byte-identical
(`fidelityDrill.test.js` pins ROPESTANCE's refusal text OFF).

**L28's spear from the L25 arrival, the key ON: REFUSED, by name on the drill.** The interim's avoidance is gone, so the
solver walks to its first spear stance (136,72); the stepped `drill@128,96` hops onto the player at **run tick 59** (the
game's tick, `drill-l28-spear-l25`), and the knocked-back walk stalls. `execRopeCut` now wraps the cut: a refusal after a
drill's contact (the `playerHits` ledger since the cut began) is re-thrown naming that drill and tick, with
`obstacle: {kind: 'solid', id: 'rope@160,64', drill: 'drill@128,96'}`. Fire and the Sword from the L25 arrival plan
tick-identically ON and OFF (89 t, 52 t).

Is the hit real for EVERY stance? Not established — the walk is refused after ticks are spent, so the executor does not
try the next stance (ROPESTANCE's rule). With `corridorBodyPricing` ON as well, the walk dodges and ends at
(154.18, 57.78), where the thrust misses the rope (runSpear's post-condition). So: a measured refusal at the first stance,
named; **queued**: a drill-aware stance ranking (or the corridor body forecast for the rope walk) to decide the others.

## Mutants (predicted first, copy + edit + run + restore; all red as predicted)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `drillEnemyBodiesTest` skips the other drills | `drill-l28-pair` reds | red (and `drill-l28-spear-l25`) |
| m2 | placement order, not reversed | `drill-l28-pair` reds | red (and the by-name refusal row: the other drill asks first) |
| m3 | the drill's line without masks | `drill-l28-cliffside` reds (hop at t65) | red |
| m4 | no T+3/T+5 drill test | `drill-l28-spear-l25` reds (t73 "hit") | red |
| m5 | `spearTouchesDrill` untruncated | `drill-l28-spear-l25` reds | red |
| m6 | the hop test skips the chasers | `drill-l91-bob` reds | red |
| m7 | `drillWallsNow` → `[]` | first run: GREEN — no witness had a bob meet a drill. A search (`evidence/m7-search-l91.mjs`: m7's module copy against the key, L91 boots) found boot (112,80); recorded as `drill-l91-bob-wall` | red |

## The survey and sweep rows this moves (before → after) and the dispatches to confirm

**Every changed path needs a drill in the room** (`drillStateFor` is empty elsewhere; the masked line, the spear repeats,
the drill walls and the danger row are drill-only; `execRopeCut`'s wrapper re-throws unchanged without a drill contact).

**Survey (local).** The derived full route (`--through=end --route=full --derive-only`) has ONE drill-room step:
**127 (L88 visit 1, `reach-exit teleporter@96,304 → L12`)** — no L28 or L91 step (route-only: none either). Step 127,
key OFF vs ON: REFUSED both, every field identical except `ms` (`evidence/survey-step127-drill{0,1}.log`). → **0 movers**
expected on the full survey.

**Sweep (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver`, the page's default build, the 19 legs
in L28/L88/L91 — `evidence/drill-leg-keys.txt`).** Arm A = the 40 defaults; arm B = the 40 + `drillMixedRooms` (the
`CONTACT:` stamp read off each log). B ran twice: before the danger-map row and on the final code (B2).

| leg | A | B | B2 | note |
|---|---|---|---|---|
| 304-309 (L28 ×6) | done | done | done | 0 hits all |
| 712, 715, 732 | done | done | done | |
| 713, 714, 718, 719, 720 | crossed | crossed | crossed | |
| 716 (L88 `in_L87_272_304 → teleporter_96_304`) | failed | failed | failed | **wording mover**: A/B "the re-planned corridor failed … stalled at (155.8,124.9)"; B2 "the combat ladder is EXHAUSTED … `drill@128,160`" at its live box (the danger row) |
| 717 (L88), 729 (L91) | crossed | **done** | crossed | `crossed↔done` — the noise class |
| 730, 731 (L91) | failed | failed | failed | identical refusal: the ladder exhausted on the drill at (64,80) (it has not hopped) |

(`evidence/sweep-armA.jsonl`, `sweep-armB-pre-dangermap.jsonl`, `sweep-armB.jsonl`.)

**Please run, on this branch:**
1. **Survey, full:** `seedling-survey.yml` with `through=end route=full`, once with the defaults and once with
   `contact_fidelity=` the 40 defaults + `drillMixedRooms` (or a scratch line flipping the default). Compare by (level,
   goal, boot) against **39496129402**. Expected: 0 movers (only step 127 is in a drill room, identical locally).
2. **Keyed sweep, ×2:** `seedling-divergence-sweep.yml` with `keys=` the 19 keys in `evidence/drill-leg-keys.txt`
   (`|`-separated), `capture_requests=true`, `contact_fidelity=` the 40 defaults (ARM A) and the 40 + `drillMixedRooms`
   (ARM B), twice each. ⚠ An unlisted key is OFF; the 40 are `collideLinePointsExact,…,ropeCutVerb,chestProbeLineEnd,
   enclosedPitCorner` (read `formatContactFidelity(CONTACT_FIDELITY_DEFAULTS)` at the branch head). Expected: leg 716's
   refusal wording moves (verdict `failed` both); 717/729 `crossed↔done` noise. If the planner's main flips
   `ropeCutAnyWeapon` meanwhile, add it to both arms.
3. **The probe:** `seedling-probe.yml` running `probe-seedling-drill-mixed.mjs` (5 witnesses; it reads
   `drill-l28-spear-l25`'s keys from its fixture) — ALL CHECKS PASSED here on 9712.

## Bounded vitest — AFTER (default) and with the key ON

- **AFTER (default, OFF)** at `366cf2c352`, 149 files: **5,234 tests, 5,234 passed** (`evidence/rows-after.txt`) =
  BEFORE (5,212) + 22 new rows and nothing removed: `fidelityDrill.test.js` (20), `contactFidelityHook`'s per-switch row
  for `drillMixedRooms`, and `levelRun.test.js`'s fold row for `drillBodies`. tapeRunner pairs: 636, md5 `56c18c64…` (= W0).
- **ON** (`SEEDLING_DRILL_MIXED_ROOMS=1`, the whole bounded set): **6 red** (`evidence/rows-on.txt`) — the list a flip
  must re-pin:
  1. `contactFidelity.test.js > the shipped defaults: all three ON` — the defaults table.
  2. `dashShape.test.js > … the defaults add no field` — the request stamps an off-default switch (moot at a real flip).
  3. `fidelityDrill.test.js > is OFF by default`.
  4. `fidelityRopeStance.test.js > L28 from the L25 arrival, the Spear: refused by name — every stance is in the
     UNSTEPPED drill's trigger` — **a control on the old behaviour**: ON, the refusal names `drill@128,96` at t59
     (`fidelityDrill.test.js`'s D3 row is its replacement).
  5-6. `arrivalCompositesLegs.test.js > residue L88 a` / `b` — both still DECLINE (`ok: false`); the expected wording
     `/the re-planned corridor failed too/` moves (the danger map now sees `drill@128,160` where it stands — the same
     mover as sweep leg 716). Re-pin the wording at a flip.
  - No tape, producer `--check` or identity row moves ON (the six producers do not visit L28/L91, and L88's tapes
    replay identically: tapeRunner pairs at the default are unchanged, and no tapeRunner row reds ON).

## Byte-inertia (OFF)

- **Identity at head equals W0 on every md5 row** and on all six producer `--check`s (exit 0)
  (`evidence/identity-head.txt`, port 9712, the primary tree's venv): the only differences are the two environmental
  rows of the base worktree — `generated set` now **OK**, and the reference now **ALL 7 GENERATED MODULES AND 5 MARKDOWN
  REGIONS MATCH THE CODE** (the regenerated instruments/docs index committed).
- surface census GREEN 342 (`--write`: site counts for the new `CONTACT_FIDELITY`/ledger reads and the `drillBodies`
  fold); constants `--write` 6,877 literals, `--check` PASS; entities PASS 566; profile PASS 138 (both).
- No committed tape and no producer digest moved; the witness fixtures are not tapes (roster/`index.json` unchanged).

## CI at the code head

`JavaScript Unit Tests` run **39719560402** @ `4051233d0b`: **success**. Suite (unfiltered, quoted from CI per ⚖ 52):
22,011 passed, 0 skipped, 0 failed; the slow battery 263/263 (`ci-vitest-summary.mjs`). The run at `89d3693e73` was red
on exactly what the next three commits fixed: `seedlingSolverSurface.test.js` (25: the danger map read `run.drills`
directly — now the `drillBodies` fold), `seedlingConstantsCensus.test.js` (1: the census `--write`), and
`generated.test.js` + the two gate shards' `procgen-reference` arm (the regenerated reference). The report commit is
docs-only.

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched.
  **New optional field:** a rope cut's `SolverRefusal.obstacle` may carry `drill: '<id>'` (key ON only).
- **`run.drills.bodies`** (no rename, no reshape) holds L28's and L91's drills with the key ON — the skin renderer
  (`seedlingSkinRenderer.js`) will draw them there; its test file is in the bounded set (default OFF).
- **`collideLineSolid`** gains an optional 5th argument `{masks}` (default false) — no caller but the drill passes it.
- The walker (`botDriverV2.*`) is untouched: no `producer:walker` row can move.
- A flip owes re-pins of: `contactFidelity.test.js` (the defaults table), `fidelityDrill.test.js > is OFF by default`,
  and whatever the ON run lists above.

## Hand-overs

- **`presses.spearRect` is not the game's rect** (`int` `spearX`/`spearY`, inclusive `collideRect`): measured on p4g (the
  player at x 125.13 facing east hits a box ending at 125). Every spear arm but the drill's still uses it (the rope cut,
  the turret, the block, the bridge…). Owner: whoever holds `presses.js` (not the hammer arc's list).
- **`collideLineSolid` is blind to pixelmasks** for every other reader (the spinner, the BobBoss rays, the chest probe,
  the crusher — which refuses by name already). The `{masks}` door exists now.
- **The spear's T+3/T+5 tests** are modelled for the fliers (LIGHTS) and the drills (here) only.
- **Nothing for the hammer arc**: none of its functions were edited (`execKillByPress`, the escape, `planWaypoints`,
  `stateDigest*` untouched).

## What the brief got wrong (measured)

- "(b) the bobsoldier [in L28]": the drills and the bobsoldier are in **different walkable components** of L28; the term
  cannot meet there. Witnessed in L91 (drill ↔ bob, both directions).
- "what the drill's 'Enemy' solid term meets … the stop/turn on hitting an enemy body": there is no stop or turn — a
  blocked axis just does not move.
- "drill states already in the digest (`stateDigestParts`)": `drillStates` is in `DIGEST_EXEMPT` (`UNREAD`), not in a
  digest part.
- The gap was not only the admission: the sight line (pixelmasks) and the spear (repeats, `int` rect) were needed for the
  ROPESTANCE run to reproduce.
- "Rooms with mixed drills are on the route": the local full route has no L28 or L91 step (19 sweep legs do touch them).

## Residue

- D3's other stances are undecided (see D3).
- L91 legs 730/731 refuse on the drill at its placement with the key ON or OFF (the combat ladder has no drill crossing);
  not a model gap.
- The `drill-l28-cliffside` tape stops at t264: on t266 a drill's on-screen verdict falls in the camera shake's band
  (⚖ the cosmetic RNG is not modelled).
- The chaser forecast holds the drills where they stand (it does not hop them); the corridor forecast holds the chasers.

## Rows to BANK

- W0 census (`evidence/w0-census.txt`); L28's components (drills vs bobsoldier).
- D1: five p4g witnesses at 0 px (`fixtures/drill-witness/`), mutants m1-m7.
- Trap candidates (in the bot-log entry): a sight line is a raycast of POINTS (masks); a test run once in the model can run
  three times on the game (`spearDelayMax` 1); an `int` getter truncates and `collideRect` is inclusive.
- Commits: D2 `184681b953`, D3 `8e8342e017`, D1 `d106ccb020`, D2b `96ab184792` / `89d3693e73` / `ab2d2b507b`, D1b `d9bc460709`,
  censuses `366cf2c352`, records `4051233d0b`.
