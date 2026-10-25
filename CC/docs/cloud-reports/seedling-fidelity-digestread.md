# Seedling fidelity DIGESTREAD — reading a run getter no longer moves `run.stateDigest()`

Session `seedling-fidelity-digestread` (Opus, cloud), planner `seedling-fidelity-planning-12`, wave 29.
Evidence: `seedling-fidelity-digestread-evidence/`.

| | |
|---|---|
| start SHA | `8fe415817e` (`fidelity-harvest/firepush`, FIREPUSH's three keys **ON**: 65 `: true,` in `contactFidelity.js`) |
| code head | `373e3ad5` (CI `JavaScript Unit Tests` run 40129991101: **22,649 / 22,649** unfiltered, slow **268 / 268**) |
| harness branch | `claude/seedling-digest-read-guard-jag371` (the report commit is the branch's last) |
| verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS**, byte-inert: no tick, tape, `--check`, survey row or probe moves |

**The one thing to know first:** the defect is real, but it is wider and narrower than the brief said. It is **31
getters**, not 2, and one of them moves `player`, not `visit`. It also hits only **one tick per visit** (the span
between a visit's build and its first `advance`), not every tick. The exception is L112, where a `bobBoss` read moves
`player` after any tick. The fix is in place: a getter read keeps nothing a lazy builder builds. The guard is
`levelRunDigestRead.test.js`.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B … 8fe415817e`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0; server 9731 |
| identity block | `SEEDLING_PORT=9731 bash scripts/procgen/identity-block.sh .` (`w0/identity-w0.txt`) | maze `57e07d21`, **acceptance `481b7a1c`** (the FIREPUSH-ON base; FIREPUSH's OFF W0 read `933c14f7`), c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER (the known box artifact, as every W0 since DRILLKILL) |
| surface / constants / entities / profile | each `--check` (`w0/censuses-w0.txt`) | GREEN **347** · PASS **6,911** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** |
| tapeRunner pairs | `tools/pairs.py` over the JSON reporter (`w0/taperunner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`**, 635 passed |
| bounded vitest BEFORE | 118 files (`vitest-files.txt`: the brief's set + every test reading a touched getter, `stateDigest(`, the skins, `escapeCrossPassCache`, `solverBot`, `r5Totem`, the boss/lights/king-of-fire rows + `fidelityL32ArenaPrefix.slow`) | **3,342 / 3,348**; the 6 red are D1's own guard rows (red by design at the base) |

**The reproduction (`tools/w0.mjs`, `tools/iso.mjs`, `tools/g5.mjs`, `tools/tapewalk.mjs`; `w0-probe/`).**
I predicted the hit list first (`w0-probe/prediction.txt`). Two getters were certain, about ten likely, and another ten
unsure, all in `visit` only. The measurement:

- **Fresh boots of all 116 levels, every getter read (`w0.mjs`):** reads move the digest **before the first tick
  only**. After one tick nothing moves, except `bobBoss → player` on L112.
- **Each getter alone on its own fresh run (`iso.mjs`, 15 rooms; `w0-probe/iso-base.txt`):** **31 getters**. 30 move
  `visit`: `moonrock spinnerBodies lavaBossFight shakeWritersHere openActivators openBridges pushables brokenRocks
  burnedTrees pulledRopes crushers crushersParked turrets bosses bossesWoken turretsSettled turretsDead pulls
  lightsFight turretDamage crusherScans openChests armedPulsers latchedGroups arrowCoverAt pushedBlocks pushesSettled
  shieldBosses finalDoors armedArrowTraps` (the last on L16 only). 1 moves `player`: `bobBoss`, through `bobArena`. 29
  of the 31 move in every room. The prediction got the part wrong (it said `visit` only) and the count wrong.
- **Level entries (`tapewalk.mjs` over every fixture tape that crosses a room; 61 tapes):** a read moves `visit` on
  exactly one tick per visit, the tick the entry lands (the read precedes that visit's first `advance`). Examples:
  `r2-walk-4-spear` 12 of 3,533 ticks; `r2-walk-1-sword-shield` 12 of 928 (`w0-probe/tapewalk.txt`).
- **G5's pattern on L63 (`g5.mjs`, G3c's 9 getters every tick, 120 ticks; `w0-probe/g5-l63.txt`):** the first
  difference is at **t0**, `visit`, and the two runs are equal from t1 to the end.

**Cause** (as the brief said, for each of the 31): a lazy `…StateFor(n)` STORES its build, and the `visit` part hashes
the maps whole. The tick builds every one of these states on its own first ask, so a never-read run catches up on the
first `advance`. Nothing a tick produces differs; only a digest compared across a read seam does.

## D1 — the guard (PASS; written red first, `dd51bd99`)

`frontend/modules/seedlingDemo/levelRunDigestRead.test.js`, 8 rows. It exports `runGetters`, `digestMovesOnRead` and
`G3C_READS`.

- The getters are enumerated from `Object.getOwnPropertyDescriptors(run)`, with no hand list (**202 getters** at the
  base). Methods are not read; they take arguments. Nothing on the surface is documented as mutating; I checked every
  getter's docblock.
- **15 rooms:** 0, 12, 16, 18, 19, 32, 40, 41, 43, **63**, 69, 82, 107, 112, 113. Between them they hold every lazily
  built family, each present and absent; the first row re-checks this from the boot worlds.
- **The rows:**
  - fresh boots before the first tick;
  - fresh boots after one tick (this is the row that catches L112's `bobBoss`);
  - **each getter alone** on its own boot of L16 and L41, added after the rework found a masked hit (below);
  - the tick each level entry lands (`f7-l16-walkin`, `r2-two-teleporters`);
  - a tape read every tick against its never-read twin: digest equal every tick, and equal `{fresh:true}` at the end.
- All `stateDigest()` digests and `stateDigestParts()` parts must be unchanged across every read.

## D2 — the fix (PASS; `ba2ad37d` → reworked `0ca9640b`, `373e3ad5`)

In `levelRun.js`:

- `let readingDepth = 0`, and `reading(read)` raises it around `read()`.
- `keptUnlessReading(map, n, built)` stores only when `readingDepth === 0`.
- **The builders** (each returns `keptUnlessReading(...)` for a new build): `activatorStateFor` `bridgeStateFor`
  `rockStateFor` `burnStateFor` `ropeStateFor` `fallRockStateFor` `moonrockStateFor` `crusherStateFor` `bossStateFor`
  `shieldBossStateFor` `lavaBossFightFor` `finalDoorStateFor` `turretStateFor` `beamTowerStateFor`
  `magicalLockStateFor` `chestStateFor` `pulserStateFor` `pushableStateFor` `spinnerStateFor` `pullsFor`
  `lightsFightFor`.
- **Side writes:** `lavaBossFightFor` writes `worldCtor` only when it keeps its build, and `bobArenaNow` keeps the arena
  (`player`) only outside a read.
- **The getters:** each of the 31 hits calls its builder through `reading(…)`.
- **Untouched:** `stateDigest` and `stateDigestParts` are not edited, and nothing is added to `DIGEST_EXEMPT`.

**The first shape broke three tools, and was reworked.** `ba2ad37d` wrapped every getter from the object's descriptors
(`return readingGetters({…})`). That made `census-seedling-solver-surface` crash: *"createLevelRun: expected ONE
top-level object return, found 0"*. The hammer arc's `member-reach.mjs` and the XC/DIGEST labs (`make-lab.py`) parse the
same literal `    return {`. The rework keeps the literal return and wraps only the 31 getters, so the hot getters
(`state`, `level`, `ticksCompleted`) pay nothing. A blanket wrap cost about 7 ns per read (`tools/bench.mjs`). The rework
turned up two more things:

- **A 32nd site the cumulative row had masked:** `armedArrowTraps` on L16, which had been built by the earlier
  `pushables` read. It is wrapped now, and the isolated row guards it.
- **`r8Acceptance`'s `R8_NORMALIZE_LIVE_BATCH` counts `liveSolidOpts(` call text** (25 sites). `reading(liveSolidOpts)`
  hid two of them (red at `0ca9640b`), so `373e3ad5` spells it `reading(() => liveSolidOpts())`.

**Mutants** (`mutants.txt`; each predicted, made by copy + restore, `cmp`-verified):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | wrap removed | the base's 6 reds, `bobBoss` included | = |
| M2 | always store | red, `bobBoss` absent, after-one-tick green | = |
| M3 | `crusherStateFor` stores again | `crushers` in all 15 rooms | = |
| M4 | `worldCtor` gate removed | green: `worldCtor` is in no digest part | = |
| M5 | `armedArrowTraps` unwrapped | only the isolated row red | isolated row red **and** the cumulative boot and `f7` entry rows red: **my prediction was wrong**, because once `pushables` reads without keeping, nothing earlier masks it |

## D3 — the page's read pattern (PASS)

G3c's getters (`world crushers bossesWoken bossShots bombPushers bombs placedGrenades cameraNow gameTime`) are read every
tick for 120 ticks on L63, against a run that is never read. The digest is equal, all parts, at every tick from t0, and
the end states are equal. At the base the same row reds at t0 (`w0-probe/g5-l63.txt`, base vs head).

## Byte-inertia — what this moves (nothing)

| gate | before | after |
|---|---|---|
| identity block + six `--check`s (`after/identity-after.txt`) | W0 | **byte-equal to W0** (`diff`: none) |
| tapeRunner pairs | 635 `88fc7df4` | 635 **`88fc7df4`** |
| surface / constants | 347 / 6,911 | `--write`: surface **line moves only** (347 GREEN); constants **6,917** (+6 structural: `readingDepth`'s `0`/`1`) |
| entities / profile / roster | 566 / 138 / 289 | 566 / 138 / 289 |
| bounded vitest AFTER (the same 118 files) | 3,342 / 3,348 | **3,349 / 3,349**: the 6 guard rows green, the isolated row added; `r8Acceptance` green at `373e3ad5` (red at `0ca9640b`, fixed) |
| **route survey, full, local** (`survey-seedling-route.mjs --through=end --route=full`, base worktree at `dd51bd99` vs `373e3ad5`; `survey-compare.txt`) | 239 rows: SOLVED 186 / REFUSED 53 | **0 rows differ in any field but `ms`** |
| **probes, `standard`, local** (port 8000; `probe-battery-standard-head.txt`) | — | **11 / 11 ALL CHECKS PASSED**, `arrival-composites` included, 0 boot retries |
| `member-reach.mjs --members-of=` crusherStates / bossStates / lightsFights / pushableStates | — | byte-identical answers at base and head |
| CI `JavaScript Unit Tests` @ `373e3ad5` | — | 22,649 / 22,649; slow 268 / 268 |
| `procgenDocs/generated` + `docLinks` (the docs commits) | — | docLinks green; `generated` 1 red = the box artifact: `noiz2saPricing.js` cannot import the absent `bulletml-dodge` checkout (the identity block's "4 DIFFER") |

**Survey and sweep rows moved: none.** Survey: 0 of 239. The sweep was not run locally. The change touches no solve:
the survey's solves are byte-equal, and so are the solver producers' `--check`s and the 635 tape pairs.

**Dispatches for the planner to confirm** (branch `claude/seedling-digest-read-guard-jag371`, after harvest onto
`fidelity-harvest/firepush` or main):

1. `seedling-survey.yml` with `through=end route=full`, default `contact_fidelity`, on the branch. Compare against a
   run at `fidelity-harvest/firepush` by (level, goal, boot). Expected: 0 rows differ.
2. `seedling-divergence-sweep.yml`, full legs, default arm (`contact_fidelity` = every default-ON key; ⚠ an unlisted key
   is OFF), on the branch versus the same arm at the base. Expected: only run noise (the documented `crossed`↔`done`
   swaps). A verdict that differs is worth a ×2 repeat on its key. I expect none, because the solver's reads that used
   to store builds stored only states the first tick would have built from the same inputs.
3. `seedling-probe.yml battery=standard` on the branch. Expected: 11 / 11, as local.

## Hand-overs

- **To the hammer arc (owner of the DA digest guard and XC).** The guard row is `levelRunDigestRead.test.js`; reuse
  `runGetters` and `digestMovesOnRead`. DA's `DIGEST_EXEMPT`, `digestCoverage` and `stateDigest*` are untouched, and the
  13 `levelRunStateDigest` rows are green. DA's `lightsFights` row still builds through `entities('lightsFight')`: that
  is a METHOD, and methods still keep their builds. For XC, an `ESCAPE_CROSS_PASS_CACHE` key computed after a page read
  now equals the never-read key (before, it was a miss, never a false hit). No escape-read field was added.
- **To the JS arc (G-slices compare digests).** A digest is now stable across ANY getter read: graphics on vs off, page
  vs node. **No `run.*` field is renamed or reshaped**, every getter returns what it did, and the skin tests
  (`seedlingSkinRenderer`, `seedlingHazardSkin`, `seedlingRoomBodySkin`, `seedlingDialogueSkin`) are green. There is
  no contract change: `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched, and
  there is no new obstacle kind or staging field. **Nothing to wire.** ⚠ `run.entities(family)` still keeps what it
  builds: a page that reads `entities('crushers')` instead of `run.crushers` before a visit's first tick still moves
  `visit` (see residue).
- The walker is untouched, so no `producer:walker` row can move.

## What the brief got wrong (measured)

1. *"one read per tick moves `visit` … 120 ticks"*: the move is **one tick per visit** (before its first `advance`). On
   G5's L63 boot it is t0 only. G5's digest values (`11056294…` → `03509d99…`) come from the page's staging and cannot
   be compared with mine.
2. *"`get crushers` … and `get bossesWoken`"*: the full list is **31 getters**, and `bobBoss` moves **`player`**, not
   `visit`.
3. The header says the base is "FIREPUSH merged with its three keys OFF"; the slice section says ON. **Measured ON**
   (`fireBlockPulseShove`, `fireLiveTurretReach`, `pulserPublishLag` all `true`; 65 default-ON keys).
   `kingOfFireFight`, `tentacleBeastFight` and `lightsBossFight` are ON too, although the header's wave-21 text calls
   the first two OFF.
4. *"enumerate the run's own property descriptors"* is the right guard, but a CUMULATIVE sweep over them masks a
   getter behind an earlier one that built the same state (`armedArrowTraps`). The guard therefore also reads each
   getter alone.

## Residue

- **Methods still keep their builds:** `entities(family)`, `progress`, `ledger`, `previewStepper` and the forecasts.
  This keeps DA's row and XC's LAZY rule exactly as they were. A G-slice that reads through `entities()` should read the
  getter instead, or ask for the same treatment. That would be a small follow-up, but it moves DA's `lightsFights` row,
  which is the hammer arc's call.
- **The `worldCtor` gate** (King of Fire, L82) is not digest-visible, so this guard cannot see it (M4). It is correct by
  reading.
- **Maps in `DIGEST_EXEMPT`** (for example, `owlStateFor` through `shakeWritersHere`) may still be created by a getter
  read. They are not digested, so the digest cannot move, but I did not measure whether a getter creates them. A
  stricter rule ("a read changes no run state") would need its own census.

## Rows to BANK

- `levelRunDigestRead.test.js` (8 rows) into the bounded set and the roster pins of any slice that touches a lazy
  `…StateFor` or a run getter.
- The tools `tools/iso.mjs` (`ROOT=<tree>` to point it at another worktree) and `tools/tapewalk.mjs`: per-getter,
  per-visit digest movers.
- W0 numbers at this base: acceptance `481b7a1c`; tapeRunner 635 `88fc7df4`; surface 347; constants 6,917 after.
