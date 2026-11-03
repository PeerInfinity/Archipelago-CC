# Seedling hammer-phase ESCAPE-EXACT — the press escape search, exact under a shield

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-escape-exact` (planner `seedling-hammer-phase-planning-2`), cloud, one of five parallel hammer slices |
| Start SHA | `6d9f991739b4d0589bd86cfed32c890e765fe0ed` (= `origin/main` at start) |
| Head | W0 `583363c4`; I `721d9cae`; M `3ea7355c`; D `f0e9a6bd` (the CI-measured head); this report is the last commit (docs + evidence only) |
| Branch | `claude/seedling-hammer-escape-exact-qluhex` (pushed) |
| Switch | `PRESS_ESCAPE_EXACT` (`pressEscapeExact.js`), **OFF**; `SEEDLING_PRESS_ESCAPE_EXACT=1` / `withPressEscapeExact`; its `SOLVER_ENV_NAMES` line added |
| Fidelity's key | `forecastShieldBump` (SHIELDBUMP, `origin/claude/seedling-fidelity-wave-36-3zxrzc` @ `8f73e94b24`), **not on main**. Every key-ON answer below was measured in a THROWAWAY worktree (`git worktree add --detach` of main + that branch merged, docs conflicts taken from main), with my two changed files copied in. Never merged into my branch |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-escape-exact-evidence/` (scratch tools in `tools/`) |
| Mid-run scope messages | none received |

## 2. The answer first

**The question:** with (i)+(ii)+(iii), does `pressEscape` CLAIM exactly where the game escapes under a shield, so that
SPIN's stand-in becomes unnecessary?

**At the stands and in the room, yes, and it is more exact than SPIN. On leg 860, no: SPIN cannot be retired yet.**

| | measured (key ON, in the scratch merge) |
|---|---|
| Four stands | ON certifies (808,854) **and** (814,854); both certificates DRIVEN on a fresh run: 0 hits, body hit. (829,860) and (820,854) claim `approach` at **t0**, and the run IS hit at t0 at both. SPIN had claimed "exhausted" at (829,860) and left (814,854) and (820,854) as no claim |
| Room scan, 1,140 stand × aim-key cases | ON certifies 132 (SPIN 85). 131 drive hitless. The one driven hit is `bobsoldier@880,832`'s sword at +62, a body the spinner escape does not model at all (the spinner rows err 0.00 px on every row of that path). Not a shield error |
| Leg 860 (A5, deadline 10240, SPIN OFF) | **Not hitless and not past the spinner.** 200 escape asks (OFF 29, all no claim). At t541 `deriveStrike`'s candidates on `spinner@880,848` are claimed `no-landing` (184 asks): **the same claim the escape makes with no shield**, since no bump is on those paths and the bump-blind forecast does not land either. OFF's no-claim had admitted those presses. The walk then goes another way, and the solve refuses at **t2119 by name: `FROZEN_TICK_PRESS`** (the known `unmodelled-frozen-press` can't-do, a press scheduled inside an ice turret's freeze). `spinner@816,848` is never reached |
| c3 / c6 / c4 | move ON (key ON) in both SPIN arms: c3 `31dc4572` → `33de4606`, c6 `40d0a4c4` → `0a5b8bda`, c4 `c9bdd11e` → `677b5246`. c3's 9 movers of 201 are ALL shield-carrying rows (post-shield 6, post-swim 1, post-feather 2), the same level kept, only the solve's ticks move (7 of 9 shorter) |
| Survey, the ten spinner-level steps | 4 movers, all L39, all SOLVED both ways, all SHORTER (3496→3389, 3376→3275 ×2, 3253→3236), replays 0 hits 0 deaths; no verdict moves |
| Key ABSENT (main), switch ON | only part (iii) can act. Stands under a shield: OFF's no-claim. c3/c6/c4 = OFF. Survey steps: 0 movers. 860: = OFF (REFUSED, work 3068) |

**The one thing to know first:** the exact escape claims MORE than SPIN, and not only under the bump. SPIN kept every
negative except "exhausted" as no claim. That was what let 860's walk press candidates the escape now honestly refuses
(the press does not land). So the reason SPIN still passes 860 is not exactness. SPIN's blanket no-claim hides a
downstream defect: under exact claims the walk reaches a press inside a freeze (`FROZEN_TICK_PRESS`). That defect is
not in this slice's region (the freeze-blind press scheduling, `iceTurret.js` / the kill executor). Flip neither
`forecastShieldBump` nor this switch on the strength of 860 until that is handed over.

| design | verdict |
|---|---|
| (1) (i) alone | **unsound**: same answers as (3) on the four stands, but the prune is what keeps a negative honest. At (817,851) and three other scan cases the search, without the prune, claims "exhausted" through states a bump would fire on |
| (2) (i)+(ii) per-node cursor | **not built**: answers equal to (3) wherever the prune cuts nothing (1,122 of 1,140 scan cases; every certificate). Where it cuts (18 cases), (3) says no claim and (2) would search the bumped worlds. Its cost is a forecast fork per node, and the kernel's coarse-key dedup would merge nodes with different body states (unsound unless the key carries the bump history). `spaceTimeReach` has no per-node context to hang it on |
| (3) (i)+(ii) pruning | **built** (the switch) |
| ± (iii) | **owed**: without it (829,860) CERTIFIES a path the run is hit on at t0; on the scan, 6 false certificates without (iii) against 1 with it (that one is the bobsoldier) |

## 3. W0 — reproduction

- Base `6d9f991739`, `session_bootstrap.sh --seedling` → done (node v22.23.4); non-wasm submodules initialised.
- Scratch merge `/tmp/claude-0/sbwt` = main + SHIELDBUMP (code merged clean; four docs/generated conflicts taken from main).
- **SPIN's four stands, the 2×2 (key × SPIN), switch OFF** (`evidence/w0-stands.txt`): identical to SHIELDBUMP § 5. All
  four no-claim with SPIN OFF in both key arms. SPIN ON: certified (75 keys) / envelope / **exhausted** / approach (t1) with
  key OFF; key ON moves (829,860) to no claim (envelope).
- **The contact miss at (829,860)** (`verify.mjs`): the aim key held one tick from the stand, the run is HIT at t0 in every
  arm. (820,854) too: the run is hit at t0 and shoves the body at t1.
- **Leg 860, the 2×2** (`evidence/860/`): key OFF·SPIN OFF and key ON·SPIN OFF REFUSED at work 3068 (29 escape asks, all no
  claim), no kill. SPIN ON in both key arms: `spinner@816,848` killed (landings 2626 / 2761 / 2817, replayed on a fresh
  run: gone, 0 hits, 0 deaths), counts 37 / 17 / 8 / 3 / 9 key OFF and 37 / 17 / **6** / 3 / **11** key ON. = SHIELDBUMP § 5.
- **c3 / c6 / c4** (`evidence/id-*.txt`; the identity block's own commands): base `31dc4572` / `40d0a4c4` / `c9bdd11e`;
  SPIN ON `2d527877` / `b6d7de6a` / `62bc5f69`; key ON alone c3 `31dc4572`. = SHIELDBUMP's.

## 4. M — the design, measured

### The design (what the switch does ON)
- **(i) coverage, not the probe.** When the zero-row probe names the shield bump and nothing else, AND fidelity's key
  exists and is ON, the escape goes on. The approach and the train are previewed as OFF, and `first` is asked with
  `players` = those states. Its own report, `shieldBump.uncoveredFrom`, must lie past the last previewed tick
  (`bumpCoveredThrough`), or the escape makes no claim (`uncovered`, named). `first.unmodelled` itself is NOT read as
  "modelled". The brief's (i) said read it, but it is `[]` only when every one of `first`'s rows was stepped, and the
  rows past the train belong to the search, which no state is told. The coverage report is the same reading for the
  rows that were told.
- **(ii) the prune.** Past the last stepped tick, a search state whose shield box touches a live, non-dying body on its
  own row (`shieldBumpFiresAt`: `shieldBumpTouches` at either `slashing`) is pruned. A certificate is then bump-free past
  the train and exact on its whole path. A negative is claimed only if the prune cut nothing (`exhaustedCut` otherwise).
  If `first` stepped a shove AFTER the landing (on the stood train), the free search's rows are re-forecast, told the
  path only through the landing (`rowsReforecast`; 0 times on every workload measured).
- **(iii) the aim tick's row.** The approach check starts at `at`, not `at + 1`, for every escape.
- SPIN is not consulted where (i) applies; elsewhere (no shield, key absent/OFF) the escape is OFF's, SPIN included.

### The design table (`evidence/m-stands-parts.txt`, `m-scan-k1.txt`, `860/`, `id-*.txt`, `survey-spinner-steps.txt`)

| arm (key ON unless said) | 4 stands | scan: cert / false cert | 860 | c3 |
|---|---|---|---|---|
| OFF | 4× no claim | 0 / 0 | REFUSED 3068 | `31dc4572` |
| SPIN | cert / envelope / exhausted / approach-noclaim | 85 / 0 | **kill, hitless** | `2d527877` |
| (1) (i) only, + (iii) | cert / cert / approach t0 / approach t0 | 132 / 1 (bobsoldier); 7 claimed exhausted, 4 of them through bump states | REFUSED 5067 FROZEN | — |
| (1) (i) only, − (iii) | cert / cert / **cert (false)** / approach t1 | not scanned | — | — |
| (3) (i)+(ii)+(iii) = the switch | cert / cert / approach t0 / approach t0 | 132 / 1 (bobsoldier); 3 exhausted claimed, 4 named no claim | REFUSED 5067 FROZEN | `33de4606` |
| (3) − (iii) | cert / cert / **cert (false)** / approach t1 | 137 / 6 | REFUSED 5067 FROZEN | — |
| switch ON, key ABSENT (main) | 4× no claim | — | = OFF (3068) | `31dc4572` (= OFF) |
| switch ON, key ON, SPIN ON | = the switch | — | = the switch (5067) | `33de4606` |

- The prune changed 4 of 1,140 scan answers (exhausted → named no claim); it cut ≥ 1 state in 18 cases. On 860 it cut 8
  states over 200 asks, and the solve ends the same without it (work 5067, the same refusal). (1) and (3) differ only on negatives the prune shaped.
- **Cost.** At the stands ON spends 13–91 ms per escape against OFF's 3–11 ms (OFF returns at the probe), comparable to
  SPIN's 8–72 ms. One forecast is asked (two only when `rowsReforecast` fires; it never did). The prune is one
  `shieldBumpTouches` pair per live body per kept-candidate state past the train. On 860 ON spends 5067 work units to
  its refusal (OFF 3068, SPIN 10241 to the deadline). Wall clock 591 s against OFF's 364 s and SPIN's 520 s, measured 8
  arms in parallel on 4 cores, so the milliseconds are relative only.

### Leg 860, read (`evidence/860/860b-k1-s0-x1*.json`; `tools/dbg541.mjs`)
- All three part-arms ((iii) dropped, (ii) dropped, all) end identically (work 5067, the same refusal), so part (i) alone
  moves 860.
- The 184 `walk` asks at t541 are `deriveStrike`'s candidates for `spinner@880,848` (aim 8–13 ticks out). The escape's
  forecast, told the candidate's own walk, steps **no bump** (`shieldBump.bumps` empty), and the bump-blind forecast on
  the same path has no landing either. So the claim is the escape's ordinary no-shield `no-landing`. OFF reached the
  probe's no claim, so `deriveStrike` admitted the first candidate and pressed it.
- Who presses at t2119 was not traced to its executor (the refusal arrives as a plain `levelRun` throw named by
  `nameRefusalByCode`). It is the documented `unmodelled-frozen-press` class: *"the solver's presses are not scheduled
  around a freeze"* (`solverBot.js` `REFUSAL_BY_NAME`).

## 5. I — the fix

- **Switch** `PRESS_ESCAPE_EXACT` in a new `pressEscapeExact.js` (the docblock is the switch's): `enabled`, `parts`
  (`probe`, `prune`, `contact`, all true; a measurement may turn one off), `PRESS_ESCAPE_EXACT_DEFAULT = false`,
  `PRESS_ESCAPE_EXACT_COUNTS`, `withPressEscapeExact`, `shieldBumpForecastStepped`, `bumpCoveredThrough`,
  `shieldBumpFiresAt`. It imports only through `solverView.js` (the census's door). The key is read with
  `Object.hasOwn(CONTACT_FIDELITY, 'forecastShieldBump')`, which is `CONTACT_FIDELITY_KEYS.includes(…)` (that list is the
  object's own keys); `CONTACT_FIDELITY_KEYS` is not on the door, so the brief's spelling would have added a door export.
- **`pressEscapeOnce`** (`solverBot.js`): the sites above, each gated by `PRESS_ESCAPE_EXACT.enabled` (`XP === null` ⇒
  `exact` false, `contactFrom = at + 1`, `prune` false, `free = first`, every forecast asked with OFF's arguments).
  SLASHRECT's `refuseNoFacing` wrapper is kept on every forecast call, the new one included.
- **The cross-pass cache key** gains `exact:<parts>` ONLY when ON, so OFF's key text is OFF's.
- No `pressKillGuards.js` change was needed: SPIN's claim is simply not reached where (i) applies.
- **Rows** `hammerEscapeExact.test.js` (12; on main 8 run and 4 skip BY NAME, `[needs fidelity's forecastShieldBump]`):
  ships OFF (+ `SOLVER_ENV_NAMES`); the key read never throws; `bumpCoveredThrough`; `shieldBumpFiresAt`; OFF = SPIN's four
  classes; (iii) the aim-tick contact caught with no shield, with the run hit on that tick; ON with the key absent/OFF =
  OFF's no-claim; and, key-only, the two certificates driven hitless, **(829,860) claims exactly** (approach t0, run hit
  t0; both SPIN arms), (iii) dropped ⇒ a false certificate, (ii) at (817,851) ⇒ a named no claim, (820,854) approach t0.
  `hammerEscapeExact.slow.test.js` (1, key-only, skipped by name on main): 860 under ON pinned to what was measured (the
  t541 no-landing claims, the t2119 `FROZEN_TICK_PRESS` refusal, no kill).
- **Mutants** (scratch merge, copy and restore, md5 `a346f706` before = after; `evidence/` has the commands in this report):

| mutant | red |
|---|---|
| M1 the zero-row probe restored (`exact` reads `probe.unmodelled.length === 0`) | 5 (every key-ON row) |
| M2 the path not told (`players` dropped: the "cursor not advanced") | 5 (coverage fails: no claim) |
| M3 the contact check dropped (`contactFrom = at + 1`) | 3 (the no-shield contact row, (829,860), (820,854)) |
| M4 the bump prune dropped | 1 (the (817,851) row) |

- **The ON radius, by mover class** (key ON; with the key absent the radius is (iii) alone, and it moved nothing measured
  except escape answers at contact stands): shield-carrying generated certify solves (c3 9/201, c6, c4: ticks only, same
  levels kept); L39 survey steps (4 of 10, shorter, hitless); L40 leg 860 (a different refusal). No pre-shield row
  moved anywhere.

## 6. D — gates and records

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52): 35 files, every `hammer*` fast file + every test naming `pressEscape` / `PRESS_ESCAPE` / `spaceTimeReach` / `escapeCrossPass` + `strategySwitch` + `solverEnvChannel` | 373 passed, 5 skipped, **3 timeouts** (240–300 s, at load average ~9 on 4 cores while 8 solves ran). Those two files re-run alone: `hammerChooserPair`, `hammerOpportunisticStrike` (+ mine) **15 passed, 5 skipped**, 0 red |
| `hammerEscapeExact.test.js` | main (key absent): 8 passed, 4 skipped by name. Scratch merge (key present): **12/12** |
| `hammerEscapeExact.slow.test.js` | main: 1 skipped by name. Scratch merge: **1/1** (657 s) |
| `solverEnvChannel.test.js` | 11/11 (the new line, sorted, wrapped) |
| `strategySwitch.test.js` | green (in the bounded set). No new kill arm or rung; nothing to gate |
| `ci-producer-checks --jobs=4`, defaults | 97 producers, every row exit 0; the battery read **1 red = `TREE-MOVED`**: my own docs edits landed mid-run (README, log, bot.md, docsIndex). No producer drifted |
| `ci-producer-checks --jobs=4`, `SEEDLING_PRESS_ESCAPE_EXACT=1` | **97 run, 0 red**, 1 skipped, EXIT 0 (key absent: only (iii) acts) |
| `census-seedling-solver-surface` | `--write` (count / file moves only: `shieldBumpTouches` +2 sites, `CONTACT_FIDELITY` +2, `canonicalDigestText` +1, the family gains `pressEscapeExact.js`); no new row to classify; `--check` GREEN 371 rows |
| `census-seedling-constants --check` | PASS, 7045 literals, 0 drift |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless) | **not finished locally**: it reached the r9 campaign window (deadline 7156 s) and I stopped it by PID to release the box lock. CI's JSUT run is the measurement (below) |
| identity block (`identity-block.sh .` at the head, OFF; `evidence/identity-head-off.txt`) | **every row = the base**: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`, generated set OK; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8` (r9 campaign), all exit 0; reference ALL MATCH. EXIT 0 |
| hammer `.slow` files locally (8, serial) | `hammerSouthDoor` 4/4, `hammerTurretApproach` 3/3, `hammerSpinnerPress` 2/2, mine skipped by name; `hammerLatchWeigh` 1 red = **its 900 s test timeout** (905 s, with the identity block sharing the 4 cores). The rest were still running when this was written. CI's slow battery at the same SHA is the measurement, and it is green |
| **CI, JSUT run `41402326902` at `f0e9a6bd`** (`ci-summary.mjs --run=41402326902`) | **success**. Shards 1–3 green; **slow battery 365/366 passed, 0 failed** (39 files; mine skipped by name); unfiltered vitest **25274 passed, 5 skipped, 0 failed**. Producer `--check`s, headless procgen shards 0/1 and every browser gate shard, `seedling-wasm-ship` included, are green |

## 7. What the harvest A/B should expect, and the ON sweep

- **OFF: no movers.** Every OFF site reads nothing new; c3/c6/c4 at OFF = the base (`31dc4572` / `40d0a4c4` / `c9bdd11e`),
  survey steps OFF = base, 860 OFF = REFUSED 3068.
- **ON with the key absent (main as it stands)**: only (iii) acts. Expect escape-answer movers where a body steps onto the
  player on the aim tick. No identity row or survey step moved here.
- **The ON sweep the planner should run** (`seedling-divergence-sweep.yml`). ON is meaningful only with fidelity's key, so
  it must run on a commit carrying both. Make a scratch branch from this head with SHIELDBUMP merged (`git merge
  origin/claude/seedling-fidelity-wave-36-3zxrzc`, docs conflicts from main), then dispatch:
  - **ON arm:** `solver_env=SEEDLING_PRESS_ESCAPE_EXACT=1`, `contact_fidelity=` SHIELDBUMP's
    `evidence/sweep-arm-on.txt` (the default-ON keys + `forecastShieldBump`), `keys=` SHIELDBUMP's
    `evidence/sweep-keys-l40.txt` (the 52 L40 keys, 860/861 included), `capture_requests=true`; then the full sweep (no
    `keys`) twice.
  - **Control:** the same with `solver_env` empty and `contact_fidelity=` `evidence/sweep-arm-off.txt`.
  - Also `solver_env=SEEDLING_PRESS_ESCAPE_EXACT=1;SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1` (it should equal the ON arm:
    SPIN is not consulted under (i)).
  - Expect: 860 moves from SPIN's kill to `unmodelled-frozen-press` (only if SPIN was on in the comparison arm; vs OFF both
    refuse); shield-carrying legs move in ticks; any leg that turns SOLVED → REFUSED is the regression to read before a
    flip.
- **Survey A/B** (`seedling-survey.yml through=end route=full`) on the same scratch branch with both flips committed
  (the survey has no switch input). Expect the four L39 steps shorter.

## 8. What the brief got wrong (measured)

- *"860 hitless with SPIN OFF + your switch ON"*: not so. The exact escape refuses `deriveStrike`'s non-landing presses
  at t541, and the walk then meets `FROZEN_TICK_PRESS` at t2119. Pinned as measured in the slow row.
- *"the escape's probe should read `first.unmodelled`"*: `first.unmodelled` is `[]` only when every row was stepped, and the
  search's rows are told no state. So it can never be `[]` for a search. The switch reads `first`'s coverage report
  through the told rows instead, and makes the search's rows exact by the prune.
- *"(ii) fork a cursor per node … or prune"*: the cursor needs a per-node context `spaceTimeReach` does not have, and the
  coarse-key dedup would merge different worlds. The prune is the exact form for certificates. For negatives it is exact
  only where it cut nothing, and that is how the switch claims them.
- *"(iii) at the exhausted stand the approach check misses the spinner contact"*: confirmed. It is not shield-specific:
  with no shield (829,860) OFF claims "exhausted" while the run is hit at t0.
- `CONTACT_FIDELITY_KEYS.includes(…)` is not reachable from a solver family file without a new door export; `Object.hasOwn`
  is the same test.

## 9. Residue and hand-overs

- **To the kill / ice-turret arc (not this slice's region):** under exact claims, leg 860's walk presses inside an ice
  turret's freeze at t2119 (`FROZEN_TICK_PRESS`). Until presses are scheduled around a freeze, flipping this switch (with
  the key) trades SPIN's 860 kill for that refusal.
- **To the strike policy (STRIKE-SLOT / AXIS-L12HITS):** `deriveStrike` offers candidates whose press the escape's
  forecast says does not land (t541, `spinner@880,848`: 184 candidates in a row). Under a shield OFF hid that; ON shows it.
  Why `deriveStrike`'s cell forecast and the press forecast disagree there was not traced.
- **The escape models spinners only:** the scan's one false certificate is a sword hit by `bobsoldier@880,832` at +62, a
  body `clearOfHammersAt` does not ask. Pre-existing; OFF without a shield certifies the same path.
- **To fidelity:** nothing to change in `spinnerForecastWithPress`. Its `players` source and `shieldBump` report were exactly
  what the escape needed. SHIELDBUMP's advice holds: flip the key with this switch, not alone. Fidelity's pinned hammer row
  (`hammerSpinnerPress.test.js` "ON at (829,860) … EXHAUSTS … claimed", key OFF) is unchanged by this slice OFF. With the
  key AND this switch ON, SPIN is not consulted, and that row's answer becomes "approach at t0".
- Not measured here: the L40 requests other than 860, the r9 campaign under the key (r9's producers run in D only with the
  key absent), the dark shield (not stepped by the forecast; (i) does not apply), a stand where `rowsReforecast` fires.
- The scratch worktree `/tmp/claude-0/sbwt` (SHIELDBUMP merged, my files copied in) was never committed.
