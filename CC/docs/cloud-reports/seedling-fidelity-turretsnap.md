# Seedling fidelity TURRETSNAP — a live ice turret priced where its contact is tested, not at its placement

Wave 35 (model coverage after R7), planner `seedling-fidelity-planning-16`. ⚖ The user (2026-10-05): *"The first priority
is to expand the model to include everything in the game."*

| | |
|---|---|
| Start SHA | `9dadbdfc4b` (main: the W34 flip + rules-ghostsword-probe; 102 default-ON keys of 113) |
| Head | the commit carrying this report, on top of `85e73a0e` |
| Harness branch | `claude/seedling-fidelity-wave-35-0rtxyq` |
| Commits | D1 + witnesses `b0a59bf3` · records `7be113de` · bot log + docs index `85e73a0e` · this report |
| Servers | `serve-nocache.py 9766` (this tree) · `9767` (the scratch worktree of `7be113de` with `turretSnapPricing` flipped ON, never committed: the probe battery ON) |
| Verdicts | **W0 PASS · D1 PASS (OFF, byte-identical) · D2 PASS (measured; nothing moves) · D3 PASS (flip-ready list below)** |
| New key | `CONTACT_FIDELITY.turretSnapPricing` (OFF), appended at the END of the defaults (114 keys, 102 ON) |

## The one thing to know first

**The fix is real and game-witnessed, and it moves nothing on the route.** The danger map priced L40's live
`iceturret@472,400` at its ctor box (y 400..432). The game snaps the turret 8 px in `input()` *before* `hitPlayer` in the
same update, and an off-screen turret runs neither, so the ctor box is never a contact. The box the game tests is the rest
two-cycle (y 408..440 / 407.5..439.5). Two p4g witnesses prove it at 0 px. With the player inside only the snapped body,
the game bills on t1. With the player inside only the ctor box, the game never bills. OFF, the map reads both strips
backwards; ON it reads them as the game does. Local survey full OFF = ON (203/37, **0 of 240 rows differ**). ICEST's two
measurements re-read ON move no verdict: the generated control's refusal point moves 8 px and ICEST's stance becomes calm on
the map, and the latch chain is byte-equal in all three arms. The ice-turret levels in the game are L40 and L98 only, and
L98's turret already sits on a snap centre (half-pixel cycle).

## W0 (base `9dadbdfc4b`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block (partial) | `SEEDLING_PORT=9766 bash scripts/procgen/identity-block.sh .` at the base | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, each = the published W33/W34 value. ⚠ The worker restarted mid-block and killed it after row 4 (`evidence/identity-base-partial.txt`); the rest is **baseline by quotation** (⚖ ruling 32 A) from L12DOORS' published block. The block at the head is below (Byte-inertia) |
| survey full, OFF | `survey-seedling-route.mjs --through=end --route=full --timeout=900` (`SEEDLING_TURRET_SNAP_PRICING=0`) | **203 SOLVED / 37 REFUSED**. This equals the CI baseline count of `40811598699` (203/37 at the W34 flip) |
| ice-turret levels | `evidence/tools/levels.mjs` over every level's census | **L40** `iceturret@472,400` (ctor (488,416)) and **L98** `iceturret@104,24` (ctor (120,40)). Neither room holds a light pole or an arrow trap |
| keyed legs | `seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks` at the base | 919 legs. **48** are on an ice-turret level (L40 42, L98 6); keys in `evidence/sweep-keys-iceturret-levels.txt` |
| roster | `fixtures/tapes/index.json` | 293, unchanged (the witnesses live in `fixtures/turretsnap-witness/`, not the roster) |

### The census: every reader of a live IceTurret's position or box

`grep -a iceturret|IceTurret|turrets` over `dangerMap.js`, `hazards.js`, `entityBlocks.js`, `entityRecords.js`, `solverBot.js`,
`levelRun.js`, `watchOverlays.js`. Measured on L40's turret (pocket boot) and on ICEST's generated 1-tall corridor
(`iceturret@64,16`, ctor (80,32)):

| reader | reads | L40: box priced vs the run's box | corridor: box priced vs the run's | verdict |
|---|---|---|---|---|
| `dangerMap.staticEnemyDanger` (`dangerAt`'s static ingredient) | **placement** (`contactRect`) | (472,400)–(504,432) vs t0 the same (not yet updated), t≥1 (471.5,408)–(503.5,440) / (472,407.5)–(504,439.5) | (64,16)–(96,48) vs t≥1 (72,24)–(104,56) / (71.5,23.5)–(103.5,55.5) | **D1 fixes** |
| `dangerMap.dangerVolumes` (the planner's volumes) | **placement** | same | same | **D1 fixes** |
| `solverBot.resolvePoleThrustStrategy`, `deriveLightPole` (the thrust's crowd test) | **placement** | same box | same box | D1 fixes (no pole shares a room with a turret in the game: general only) |
| `levelRun.arrowBodiesNow` (an arrow meets an unbridged "Enemy") | **placement** | — | — | residue: no arrow trap shares a room with a turret; it is the MODEL's arrow collision (levelRun), outside the danger-map/stance brief |
| `watchOverlays.staticEnemyBodies` (the viewer) | placement | — | — | residue: a drawing, not a pricing |
| `solverBot.resolveBraveStrategy` | `world.iceTurrets` point (the range disc's centre) | (488,416) vs the game's range point (488,424)/(487.5,424) | — | residue: the 129 px disc is the proximity volume the brave verb EXEMPTS; an 8 px disc offset, not a body box |
| `killForCorpse` → `corpseKillSide` | the RUN's rect at the call | pocket: called with the turret updated, the Ghost-Sword stance (488,444.5) = the snapped bottom 439.5 + 5 ✔ | — | run reader. Called before the turret's first update it would read the ctor box, which is ICEST's measurement (1). Hammer's kill code, handed over (below) |
| `killIceTurretInPlace` (`t0.rect`), `circleKillIceTurret` | the RUN's rect | as above | — | run readers (hammer's) |
| `killIceTurretOnWalk` (ICEST) | a LOCAL snap of `t.x/t.y` | the snapped box | the snapped box | already correct (hammer's) |
| `guardedChaserDwell`, `execKillByChaser` range tests | the RUN's `t.x/t.y` | the run's truth at that tick | — | run readers |
| `levelRun.stepIceTurret` (the model) | the stepped body | = the game, 0 px (witnesses) | — | the model already steps it right |
| `hazards.js`, `entityRecords.js`, `entityBlocks.js` | no live-turret position reader (descriptive rows only) | — | — | — |

**Off screen.** The run's turret keeps its ctor point until its first on-screen update. The game's does too, and the model
does not snap it early: the witness tick t0 reads (488,416) on both. ON, the map still prices the cycle for that turret.
That is right because the ctor box is never contact-tested. `Enemy.update`'s first line returns off screen (contact
included), and the first update that runs snaps before `hitPlayer` (`stepIceTurret`'s order). The pin
`fidelityTurretSnap.test.js` holds `t.x/t.y` unchanged by the read. ⛓ hammer-2's two `latchWeighFirst` reads are untouched:
`t.x`/`t.y` and the live `rect` mean what they meant.

## D1 — `turretSnapPricing` (PASS, OFF, byte-identical)

**The change** (`b0a59bf3`):
- `iceTurret.iceTurretLiveContactCycle(ex, ey)` derives the rest two-cycle from the ctor point by `input()` and
  `moveAxis` themselves, over three ticks (the third must equal the first or it refuses by name). It returns both points,
  both 32×32 boxes and their hull. L40: (487.5,424) / (488,423.5), hull (471.5,407.5)–(504,440). L98: (119.5,39.5) /
  (120,40). The generated corridor: (88,40) / (87.5,39.5). Exported through `solverView` (surface row `seedling`,
  `geometry-query`).
- `dangerMap.liveTurretContactRect(run, inst)`: with the key ON, a live IceTurret the run steps (a row in
  `run.entities('turrets')`, not dead or removed) is priced at the hull, with a `why` that says so. A run position outside
  the cycle is added to the hull rather than trusted away. Otherwise it returns `null` and the caller keeps `contactRect`.
  Used by `staticEnemyDanger`, `dangerVolumes`, and the two pole crowd tests (`solverBot`, one line each).
- OFF: the function returns before reading anything. Byte-identical by construction, and measured (Byte-inertia).

**The witness** (`fixtures/turretsnap-witness/`, p4g headless logic-only, `probe-seedling-turret-snap.mjs --record`). Both
tapes boot from the pocket boot's header with the player moved and standing 16 ticks:

| witness | player box | game | model OFF / ON |
|---|---|---|---|
| `turretsnap-l40-below-strip` (entity (488,440)) | y 438..443: inside only the snapped body | turret (488,416) → (487.5,424) at t1; **hit at t1**, knocked to y 456.48 | 0 px on all 16 ticks, both |
| `turretsnap-l40-above-strip` (entity (488,400)) | y 398..403: inside only the ctor box | the same snap; **never hit** | 0 px on all 15 sampled ticks, both |

The model already steps this right, so the key moves no stepped body. What it moves is the danger map. At the boot, and
at t1 and t2, OFF calls `(488,440)` calm and `(488,400)` dangerous: wrong both ways. ON calls them as the game does.

**Tests** `fidelityTurretSnap.test.js` (9 rows): the switch ships OFF; the recorded tapes are the module's; the game's
turret reads the derived cycle; the game's bills; the model reproduces both witnesses at 0 px, ON and OFF; the boot danger
map OFF vs ON; the volume's rect and `why`, and a second read moves neither the turret nor the digest; dead / non-turret /
OFF return `null`; L98's and the corridor's cycles.

**Mutants** (predicted first, copy + restore, md5 verified after):
- M1, the cycle skips `input()` (the ctor box). Predicted: the cycle and ON danger rows go red. Measured: 4 red (the cycle
  row, the boot danger row, the volume row, the L98/corridor row).
- M2, the key check dropped. Predicted: the OFF rows go red. Measured: 3 red (the boot danger row, the volume row, the
  `null` row).
- M3, `staticEnemyDanger` ignores the live box. Predicted: the boot danger row alone. Measured: exactly that 1.

## D2 — ICEST's two measurements re-read with the key ON (PASS: measured, nothing to hand back)

**(2) The generated control** (`evidence/d2-corridor.txt`, `evidence/tools/d2.mjs`; ICEST's `corridorRoom`, the oracle's
`solve`, collect (128,128)):

| corridor | key | ICEST arm OFF (default) | ICEST arm ON |
|---|---|---|---|
| 1 tall | OFF | REFUSED: danger at **(62.4,24.0)**, `enemy:iceturret@64,16` "at its placement" | SOLVED 263 t, the kill from `down` (88,18) |
| 1 tall | ON | REFUSED: danger at **(70.6,24.0)**, "a live ice turret, priced at the hull of its rest two-cycle" | SOLVED 263 t, the same kill |
| 2 tall | OFF | REFUSED at (62.6,40.0) | REFUSED: no side hitless (490 forks) |
| 2 tall | ON | REFUSED at (69.9,39.8) | REFUSED: the same 490 forks |

**ICEST's stance is now calm on the map.** The danger probe at ICEST's chosen stance (88,18) (box y 16..21) is *danger*
OFF and *calm* ON (also (88,20); (88,21) and the lattice centre (88,24) stay danger ON, because the hull's top is 23.5).
That is ICEST's measurement (2), *"the live stance walk is refused by its own danger probe"*, fixed at the map. The verdict
does not move because the corridor's 16 px lattice centre (y 24) sits inside the snapped body too. The open strip above it
is 7.5 px, under a lattice node. With ICEST's arm OFF, the walk therefore still refuses, 8 px further on. With it ON, the
arm kills alike (it steps on forks, so the body decides, not the map).

**(1) The stance inside the live body** was ICEST's scratch variant (`killForCorpse` called from the walk with the turret
not yet updated, so `corpseKillSide` read the ctor box). No shipped path does that. In the shipped corpse weigh the stance
comes from the RUN's rect after the turret's first update. Measured: the pocket solves are equal OFF/ON. Circle (Sword) is
SOLVED 518 t, side `up`, delay 0. Ghost Sword is SOLVED 462 t, side `up`, delay 5, stance (488,444.5) = the snapped bottom
+ 5. The kill functions are hammer's, so nothing there is changed.

**The latch chain** (L40LATCH's boot, Boss Key 2 from the held latch; `evidence/d2-latch.jsonl`,
`evidence/tools/d2latch.mjs`). Measurement only (⛓ hammer-2):

| arm | key OFF | key ON |
|---|---|---|
| defaults | REFUSED t271, `bob@736,800` (leash) | identical (ticks, text) |
| `CHOOSER_PAIR` size 3 | REFUSED t271, the same | identical |
| `CHOOSER_PAIR` 3 + `ICETURRET_STATIC_KILL` | REFUSED t833: the turret handed at t577 `via: hit`, the arm spends 256 t and refuses "no side … gives a hitless kill — up" | identical (handing, ticks, refusal) |

`LATCH_WEIGH_FIRST` is **not on this base** (LWEIGH is in flight), so its ON/OFF arms could not be measured here. The
approach volley LWEIGH meets (the t917 blast) is not a danger-map row (blasts are stepped, not priced), and this key
changes no tick on the latch chain in any arm measured.

## D3 — flip readiness with the key ON (PASS: the list)

| gate | command | ON result |
|---|---|---|
| bounded vitest (124 files: the brief's list + every `grep -a` hit for `iceturret`, `IceTurret`, `dangerMap`, `staticEnemyDanger`, `dangerVolumes`, my names, the pole strategies; `evidence/bounded-files.txt`) | `SEEDLING_TURRET_SNAP_PRICING=1 npx vitest run <files>` | **121 / 124 files, 4006 passed, 8 failed** (`evidence/bounded-on.txt`), every red attributed below |
| `ci-producer-checks.mjs --jobs=3` | `SEEDLING_TURRET_SNAP_PRICING=1 node scripts/procgen/ci-producer-checks.mjs --jobs=3` | **97 run, 0 red**, 1 skipped (`evidence/producers-on.txt`) |
| the six @ci-box `--check`s + identity rows | `SEEDLING_TURRET_SNAP_PRICING=1 bash scripts/procgen/identity-block.sh .` | **every row = OFF** (`evidence/identity-head-on.txt` vs `-off.txt`): the 13 identity rows and the six producers (`7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0). The ON block's "generated set" row lost the box lock to the OFF block beside it, so it was re-run alone ON: `OK` |
| ICEST's tests | `hammerIceTurretStatic.test.js` ON | 7 / 7 (the slow pair's rows measured in D2: equal) |
| probes standard | the battery from the flipped worktree on :9767 | **10 / 11 green** (`evidence/probes-standard-on.txt`). The one red, logical-links **R** (*"≥ 1 expected arrival"*, 0 seen; it walks L17 → L0 → L2 only), **fails identically OFF** on :9766 (`evidence/probe-logical-links-R-off-control.txt`): base/environment, not this key. Logical-links B ended on its budget at L49 (16/48) on this box and never reached L40, so the battery did not exercise the turret here |

**Every ON red, attributed:**
1. `contactFidelity.test.js` › *the shipped defaults*: the live switch object under the env is not the shipped default.
   That is the re-pin a flip owes (`turretSnapPricing: true` in the pinned table). Not a behaviour.
2. `seedlingConstantsCensus.test.js` (6 rows): my new literals were unclassified. That is a records gap, fixed in
   `7be113de` (classified beside `createIceTurret`'s rows). Not ON-dependent; green after.
3. `fidelityTurretSnap.test.js` › *the boot danger map*: its OFF arm read the ambient switch. That is a test artefact, fixed
   in `7be113de` (the OFF arm explicit); green ON after.

So the flip owes exactly one re-pin: `contactFidelity.test.js`'s defaults table. A flip would also invert
`fidelityTurretSnap.test.js`'s "ships OFF" row.

## Movers

| instrument | OFF | ON | moved |
|---|---|---|---|
| local survey full (`--through=end --route=full`) | 203 / 37 | 203 / 37 | **0 of 240 rows** (all fields but `ms`; `evidence/survey-full-off-vs-on.txt`). The ice-turret steps: 67 L40 REFUSED, 95 L40 REFUSED, 97 L40 SOLVED 70, 136 L40 SOLVED 172, 149 L40 SOLVED 172, 217 L98 SOLVED 724, all equal |
| latch chain ×3 arms | above | above | 0 |
| ICEST corridor ×8 | above | above | verdicts 0. The refusal point moves (62.4 → 70.6 px; 62.6 → 69.9) |
| L40 pocket ×2 | above | above | 0 |

**The dispatches the planner should run** (I cannot dispatch; branch `claude/seedling-fidelity-wave-35-0rtxyq`):
1. Survey full ON vs OFF: `seedling-survey.yml` on the branch, inputs `through=end route=full`. Run it once with the
   default (OFF = the base, control) and once with the key ON. The survey has no switch input, so the ON arm needs a
   scratch commit flipping `turretSnapPricing: true`, or `SEEDLING_TURRET_SNAP_PRICING=1` in the job env if the planner
   has such a hook. Expect 203/37 both, 0 rows moved.
2. Keyed sweep ×2 per arm on the 48 ice-turret legs: `seedling-divergence-sweep.yml`, `keys=<evidence/sweep-keys-iceturret-levels.txt>`,
   `contact_fidelity=<evidence/sweep-arm-on.txt>` (the 102 default-ON keys + `turretSnapPricing`) and
   `contact_fidelity=<evidence/sweep-arm-off.txt>` (the 102 alone), each twice, `capture_requests=true`. Match legs by KEY.
3. Probes: `seedling-probe.yml battery=standard` on a scratch branch with the key flipped (the browser reads the defaults, no
   env).

## For the other arcs

- **JS arc:** nothing to wire. No `run.*` field was renamed or reshaped (the turret's `x`/`y`/`rect` unchanged). No new
  `SolverRefusal.obstacle.kind`, no staging field. The danger `why` for a live turret changes wording ON only.
- **Hammer (measured hand-over, no change made in your region):** `corpseKillSide` (`killForCorpse`) and
  `killIceTurretInPlace` read the RUN's `rect`. Before the turret's first on-screen update, that rect is the ctor box. No
  shipped caller reaches them in that state (the pocket's stance is off the snapped box, measured), but a kill called from
  a walk with the turret still off screen would stand inside the live body (ICEST's measurement (1)). The general fix is
  the one ICEST's arm already uses (a local snap) or `iceTurretLiveContactCycle(…).hull` (now exported through
  `solverView`). On the latch chain with CPAIR 3 + ICEST, this key changes nothing (t833 both).

## What the brief got wrong (measured)

- *"L40's `iceturret@472,400` sits at y 416 and snaps to 424"*: the x axis moves too. The game's cycle is
  **(487.5,424) / (488,423.5)**. x alternates 487.5/488 because `round` and `floor` disagree at 488 = 30.5 tiles. The box
  the contact meets is therefore 32.5 × 32.5 over two ticks, not one 32×32 box at y 424.
- *"the danger map's turret when the turret is OFF screen … the map must not snap it early"*: the RUN must not, and does
  not (t0 = (488,416) on the game and the model). The MAP should price the snapped cycle even then. The ctor box is never
  contact-tested: the first update that runs at all snaps before `hitPlayer`. Pricing it unsnapped is the error, not the
  care.
- *"the stance … stood INSIDE the live body"*: that was ICEST's scratch variant. No shipped stance reads the placement
  record. The shipped kill stances read the run's box (hammer's, handed over above).
- The ICEST corridor's ON verdict does not move: the 16 px lattice centre (y 24) is inside the snapped body too.

## Byte-inertia

- OFF, `liveTurretContactRect` returns before it reads anything (`CONTACT_FIDELITY.turretSnapPricing` is its first test), and
  no other hunk runs without it. The new export and the probe are additions.
- The identity block at the head (OFF) equals L12DOORS' published block on every row: maze `57e07d21`, acceptance
  `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate
  `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`, generated set OK, the six producers as above, all
  exit 0. Reference "4 DIFFER" is this tree's submodule state (the four outputs restored above, and also red at the base).
- Bounded set AFTER (OFF, the head): **124 / 124 files, 4015 / 4015** (`evidence/bounded-off.txt`).
- Survey full OFF: 203/37, equal to CI's `40811598699` count.
- No tape, fixture or producer `--check` digest moved. The roster is 293, unchanged.

## Re-pins and records

- `contactFidelity.test.js`: the defaults table gains `turretSnapPricing: false`.
- `seedling-solver-surface.json`: the `iceTurretLiveContactCycle` row (`--write`, classified; `--check` GREEN 364 rows).
- `seedling-constants-fields.csv` / `-census.csv` / `seedling-constants.md`: 19 literal rows (`--check` PASS).
- `boxLock.test.js`: `probe-seedling-turret-snap.mjs` among the guarded instruments.
- `generate-procgen-reference.mjs`: the instruments index + `architecture.md`'s region (the probe). ⚠ Run in this cloud
  tree, the generator also rewrites `registry.js`, `capabilities.js`, `substrate-registry.md` and `procgen-substrates.md`,
  dropping `noiz2sa`. That is the environment's submodule state, not this change, and those four were restored, not
  committed.
- `seedling-bot.md` (the paragraph), `seedling-bot-log.md` (the entry).

## Residue

- `levelRun.arrowBodiesNow` prices an arrow against a live turret's placement. No arrow trap shares a room with a turret
  in the game. It is the model's own collision, so it was left for a model slice.
- `resolveBraveStrategy`'s range disc is centred on the ctor point, 8 px from the game's range point. The disc is the
  exempted proximity volume, and the game's range test is stepped by the run.
- `watchOverlays.staticEnemyBodies` draws the placement (viewer).
- The first read of the danger map at t0 moves `stateDigest` in both arms (it builds rosters). That is base behaviour,
  measured, not introduced here.

## Rows to BANK

- `fidelityTurretSnap.test.js` 9/9 (OFF) and 9/9 with 1 skip (ON).
- Game witnesses `turretsnap-l40-below-strip` (hit at t1) and `turretsnap-l40-above-strip` (never hit), 0 px.
- Survey full local OFF = ON, 203/37, 0 of 240 rows.
- Producers ON 97/0 red.
- CI `JavaScript Unit Tests` at `85e73a0e` (run `40926694608`, success): vitest unfiltered **24179 / 24179**, slow battery
  **273 / 273**. ⚠ At `7be113de` shard 2 was red on `procgenDocs/generated.test.js`. The cause was mine: the reference
  paragraph moved the docs index's word and citation counts, and I had not regenerated after it. Fixed in `85e73a0e`. The
  report commit after it touches `CC/docs` only.
