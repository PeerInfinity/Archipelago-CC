# seedling-js-boot-rng-clock — JS room boots declare their random stream and carry the game clock

Cloud slice for `seedling-js-planning-24` (js-24); `seedling-hammer-phase-planning-17` copied. ⚖ Robert 2026-11-28T02:08:21Z (via
`user-decisions-liaison-6`): *"Random stream + clock together"*. BUILD + RE-MEASURE + LANDING PACKET. Plus js-24's extra arm JA
("Hand JS L20 to js-24"), measure only.

## Summary for Robert

**What JS rooms now start with.** Every JS room start (a host teleport, the solver's re-entry into a room, a restore) now says what the
game state is, the way the wasm game already did:
- **A real random stream.** Before, the stream was "inherit", which no model can predict, and the model refused every fight that
  needs it. Now the start declares the page's own seed and the game's split stream (`split: true`, the shipped game's setting). That
  opens the Tentacled Beast fight in L57 and the Owl in L112.
- **The game clock keeps running across room starts**, as the game's `Main.time` does. Before, every start reset it to 4800 (midday).

A saved game still restores its own clock. A fresh page and a newly loaded level set still start at midday.

**How far JS gets.** At the shipped limits (seed 1), JS went from **23/48 to 36/48 and 31/48** in two walks.
- Both walks win the L57 fight with 0 hits and take the mouth to L58. They then match wasm's L58 answers exactly.
- **The next wall is not JS-only.** J1 stops at L63, where the solver refuses a WandShot that five unplaced enemies would block. That
  is the same answer (`9c5ba5c37277`) hammer's re-measure-12 lists for **wasm** at base.
- With your hammer switches on (arm JA), JS passes that L63 exit with wasm's exact answer (`6fc9184e21ed`). JA then ran out of time
  at the same entry 37.
- The second JS walk stopped earlier, at an L40 Totem Part where even the 4× retry ran out of budget. That depends only on the clock:
  the same request with the first walk's clock solves.

**L20 (js-24's question).** "L20 flag 4" passes on all three JS walks. It solves on the first try (no retry, no fallback), right
after the Shield is picked up.

**Rows that moved: 5 unit-test rows, each re-recorded with its reason.**
- **The stream:**
  - L112 now boots instead of halting (2 rows).
  - An arrow-lane test's refusal reason changed, because the split stream makes the camera shake exact.
- **The clock:** two save-clock rows had pinned "a teleport resets the clock".

No in-app row moved (45/45). No solver answer changed for any captured request (30/30 identical before and after).

## Base, tip, branches

| | |
|---|---|
| base | `origin/claude/js-l57-exit-check-izu8ut` @ **`8199cdb59f`** (carries held-retry `ac1d02e6fb`). Neither predecessor was re-tipped (checked at the end: `8199cdb5`, `ac1d02e6`) |
| landing branch | **`claude/js-boot-rng-clock-wz0p4o`** (the harness's pinned branch; the brief's `seedling-js-boot-rng-clock`) |
| fix commit | **`0d31231e`** (code + tests + re-records); docs `bd3f5bfc` (`flash.md`); interim evidence `bd0d83fa` |
| merge of origin/main | **`3e7cfc8b`** = merge of origin/main **`aa749df3`**. Held-retry has landed on main (`b6863466`, train) since the base was cut. Between `ac1d02e6` and `aa749df3` the seedling runtime is identical: in `seedlingDemo/`, `flashPanel/` and `scripts/procgen/`, only `make-seedling-spiral-room-preset.mjs` moved. The only conflict was the generated docs word count, regenerated with `generate-procgen-reference.mjs` (`--check`: 7 modules, 5 regions match). The walks ran before the merge (they touch no file the merge moves); the closure, docs check and bounded vitest were re-run at the merge tip |
| landing tip | the report commit on top of `3e7cfc8b` |
| measuring branch (J1, J2) | local `measure/seedling-js-boot-rng-clock` = `0d31231e` + the diagnosis's capture probe `d1d9da5e` → `0b2f8e03`, `a3b1633f` → `d910491d`. **Not pushed** |
| measuring branch (JA) | local `measure-ja/seedling-js-boot-rng-clock` = `0d31231e` + **merge of `d1725843a2`** (hammer-probe-rm12-all; `f288a10e`, 0 conflicts, 0 gitlinks) + the same probe → `9e5040e5`. **Not pushed.** Why the merge: 9 of the 13 ALL names (`OPP_AIM_CHASERS`, `HIT_AVOID_STAND_BOMBS`, `REFUSAL_STAND_BOMBS`, `HIT_PLAN_RETRY`, `KILLLOCK_PINNED_SPEAR`, `PRESS_KILL_HOLD_MODEL_UNDO`, `WAND_SHOT_TRAP_BODIES`, `WAND_SHOT_ENEMY_BODIES`, `AXE_TIMING_SWORD_SWAP`) are not in `SOLVER_ENV_NAMES` at `8199cdb59f`, and the channel refuses an unknown name |
| no-limit probe `3028cb27` | not taken: every walk ran at the shipped limits |

### Diff stat (landing `3e7cfc8b`'s first parent vs base `8199cdb59f`, the slice's own change) — 0 gitlinks

```
 docs/json/developer/procgen/flash.md               |   5 +-
 .../modules/seedlingDemo/fidelityArrowLane.test.js |   7 +-
 .../seedlingDemo/jsRuntimeArrivalOnDoor.test.js    |   6 +-
 .../modules/seedlingDemo/jsRuntimeAtlas.test.js    |  27 +++-
 .../seedlingDemo/jsRuntimeBootRngClock.test.js     | 159 +++++++++++++++++++++
 frontend/modules/seedlingDemo/jsRuntimeCore.js     |  66 ++++++++-
 .../modules/seedlingDemo/jsRuntimeSave.test.js     |  21 ++-
```
Plus this report and its evidence directory. **One code file.** No engine / closure / solverBot / levelRun / contactFidelity /
generator / tileStep file, no rules / preset / atlas, no wasm / vendor change. `jsRuntimeSolver.js` is untouched.

## Sources of truth (quoted)

**The wasm side** (the thing JS now mirrors):
- `wasmArrival.js:71`: `export const SHIPPED_RNG = Object.freeze({ seed: 0, split: true, cosmetic: 0, fp: 0 });`.
- `:114`: `'static.Rng.split': { from: 'shipped', read: () => SHIPPED_RNG.split }`. The comment above it reads: *"⛔ NEVER
  `botStatus().rng.split`: that is the ECHO of the LAST tape's `Bot.rngSplit` … `botReset` sets it false while the live `Rng.split` is
  true"*. The JS side reads no echo: its split is a declaration, held equal to `SHIPPED_RNG.split` by a test.
- `:312-313`: `const { fp: _recordedNotStaged, ...rest } = blocks.rng; const rng = { ...rest, cosmetic: SHIPPED_RNG.cosmetic };`, with
  `seed` = *"the BEGIN record's (live, pre-build)"* `rng.gameplay`.

**The JS side, before:** `procgenOracle.js:339` `rng: { seed: 0, split: false, cosmetic: 0, fp: 987286273 }` (*"`seed: 0` here means
what it means to a TAPE — 'inherit the build's own boot state'"*), and `time = GENERATED_BOOT_TIME` = `PAGE_BOOT_TIME` (4800) unless
a restore was pending.

**The JS side, now** (`jsRuntimeCore.js` at `0d31231e`):
- **seed**: the JS page's own gameplay stream. `:502` `const gameplayRng = new SeedlingRng(0);` (seed 0 = `BOOT_SEED`, a fresh build's
  `Math.random()` state, `rng.js:166`). At each non-tape boot, `:769-770`:
  `staging.rng = { seed: gameplayRng.state, split: JS_BOOT_RNG.split, cosmetic: JS_BOOT_RNG.cosmetic }; gameplayRng.next();`.
  This is the page's own state, read at the boot: no wasm number is copied, and it is never 0.
- **split / cosmetic**: `:203` `export const JS_BOOT_RNG = Object.freeze({ split: true, cosmetic: 0 });`. It must equal
  `SHIPPED_RNG.split` / `.cosmetic`, and a test holds it so. One constant cannot serve both, because `wasmArrival` imports
  `jsRuntimeCore`. The cosmetic stream is declared, never simulated (⚖ Robert 2026-10-10 / 10-25).
- **fp**: not staged, as the wasm arrival leaves it out. No model reads it, and the JS frame has no FlashPunk LCG.
- **clock**: `:755` `const carriedClock = declared || restorePending ? null : carriedClockOf(session);`. `carriedClockOf` (`:1385`)
  returns the run's `savedClock` (its `gameTime`) once the run has stepped. Before the run's first tick, it returns the clock the
  run's own boot declared. Why the clock carries: `Game.time` is `Main.time` (`Game.as:490-497`), a static that every `new Game` keeps.
- **Where JS legitimately differs from wasm, named.**
  - The wasm seed is the game's stream after every draw since load (each enemy's `coins`, each orb, each grass tile). The model books
    those draws only inside a fight that reads them. So the JS page reseeds each room boot from its own stream (one `SeedlingRng` step
    per boot), as `Bot.botStart` reseeds a tape's window. The seeds are deterministic for a given boot history, and they are not
    wasm's numbers.
  - The clock follows the same arithmetic as the sdc-js-save-day-clock restore. The next run reads `time + BOOT_PRESWAP_FRAMES +
    LOAD_FADE_FRAMES`, and that is not frame-exact against wasm's swap. Measured below: within 21–466 ticks of wasm's at the same goal,
    where before it was 4800.

**Which boots carry the clock and which keep a default.**

| boot | clock staged | why |
|---|---|---|
| host `new Game` (teleport), the solver's forced re-arrival (W7), a boot after play | **the replaced run's `gameTime`** | `Main.time` survives `new Game` |
| a run replaced **before its first tick** (the host's start teleport right after the first frame) | that run's **own declared clock** | it ran no `Game.update()` on this page; its `gameTime` already counts a fade it never ran |
| the restore's reboot (`restorePending`) | **the saved clock**; a version-1 / null `time` → a fresh start's | the save is the state put back (sdc-js-save-day-clock, unchanged) |
| no live run: the first frame (`Main.as:51`), the first boot after a mount (a new set is a new save) | `PAGE_BOOT_TIME` | a fresh page's default (unchanged) |
| a tape's `botStart` (`declared`) | the tape's own | `Bot.as` (unchanged); the gameplay stream is not stepped either |

## Tests and their mutant reds

New `frontend/modules/seedlingDemo/jsRuntimeBootRngClock.test.js`, 7 rows on the real vanilla map:
1. `JS_BOOT_RNG` = `SHIPPED_RNG`'s split and cosmetic;
2. a JS room boot declares the live seed and `split: true`, never seed 0, with no `fp`;
3. the seed is the page's own stream: `BOOT_SEED` at the first frame, then one step per boot; two pages with one history agree;
4. L57: a JS boot in the beast's room opens the fight's draw stream (`streamRefusal === null`; base: *"has no declared seed for this
   room"*);
5. **the clock carries across two room boots**;
6. **a restore keeps the saved day clock** (not the run it replaces), a version-1 save gets a fresh start's, and the next boot carries
   on from there;
7. **a fresh page keeps its default**: the first frame and the host's start declare `PAGE_BOOT_TIME`, and a new mounted set does too.

Mutant reds (`evidence/mutants.txt`; each run on a copy, the file restored byte-for-byte afterwards, `cmp` checked):

| mutant | red rows |
|---|---|
| m0 **base** `jsRuntimeCore.js` @ `8199cdb59f` | **7/7** |
| m1 the boot keeps `bootStaging`'s rng | 4 (rows 2, 3, 4, 7) |
| m2 `split: false` | 3 (2, 4, 7) |
| m3 the stream never steps | 1 (3) |
| m4 the clock is not carried | 3 (5, 6, 7) |
| m5 the carry beats a pending restore | 1 (6) |
| m6 a never-stepped run hands on its `gameTime` | 1 (7) |

**Bounded vitest** (⚖ 52), `--maxWorkers=3`, over the 160 default-tier test files that name `jsRuntimeCore`, `jsRuntime.html`,
`createJsRuntime`, `jsRuntimeWalker`, `jsRuntimeSolver`, `bootStaging`, `PAGE_BOOT_TIME`, `GENERATED_BOOT_TIME` or `4800`
(`grep -a -l`; submodules, `.slow`, `.train` and `.calib` excluded; list `evidence/vitest-bounded.files.txt`):
- before the re-records: 156 files passed, 4 files with 5 rows red (the moved rows below);
- the landing tip before the merge (`bd0d83fa`): **160 files / 3058 passed**;
- the merge tip `3e7cfc8b`: **160 files / 3058 passed** (`evidence/vitest-bounded-mergetip.txt`).

The suite number for the pushed SHA comes from CI.

## The JS-pinned rows that moved (Robert's caveat)

Each was attributed by turning one half off at a time: m1 = the stream off, m4 = the clock off, m2 = `split` alone off
(`evidence/moved-rows-attribution.txt`). At base all 60 rows of those 4 files pass.

| row | old → new | why | proof |
|---|---|---|---|
| `jsRuntimeAtlas` "L112 refuses on its first tick (the Owl needs `rng.split`)" | halts by name → **boots and runs 600 ticks, no halt** (new row). The halt-by-name branch keeps its witness: the same room booted by a **tape** that declares the unsplit stream still halts by name | **the declared stream** (split + a seed meet `assertOwlStreamPremises`) | red with the stream on, green with m1 and m2 |
| `jsRuntimeArrivalOnDoor` "the only level no committed arrival can boot is L112" | `HALTED` `[112]` → **`[]`** | **the declared stream** | same |
| `fidelityArrowLane` "ON: leg 211 refused BY NAME … `Game.shake`'s jiggle" | still `ok: false`, `ARROWLANE …` by name, but the reason moves from *"is on screen at tick N depends on where inside `Game.shake`'s jiggle"* (the camera band, `SHAKE_BAND_KEPT.unsplit`) to *"the fork's drive is refuted — … the run crossed from level 16 to 17 at tick 54 without being asked to"* | **`split: true`**: the test builds its staging from the JS boot. Under split, `view()`'s jiggle is a point (`shakeExactSplit`, ON), so no band opens | green with m2 (`split` off, seed on): the old reason returns |
| `jsRuntimeSave` "with no restore the clock is untouched: every boot is a fresh page's" | teleport → `PAGE_BOOT_TIME + offset` (4822) → **the old run's `gameTime` + offset** (4894) | **the carried clock** | red with the clock on, green with m4 |
| `jsRuntimeSave` "the restored clock is staged ONCE: the boot after … is a default one again" | → **the boot after carries the restored run's clock** (7866). Still staged once: `restorePending` is false after | **the carried clock** | same |

No other row moved for any reason. The in-app `seedling-js` batch had no mover (below). `rg -a '\b4800\b|seed: 0, split: false|seam\.time'`
over `frontend/test-configs` and `frontend/modules/tests`: 0 hits, so no in-app config pins the old clock or stream.

## No solver answer for a FIXED request changed

The solver is a pure function of its request, and this slice changes only what the page sends. Every captured request was replayed
(`replay-seedling-solve-request.mjs --n=1 --jobs=1`) in two clean worktrees, base `8199cdb59f` and tip `0d31231e`
(`evidence/replay/`). The 30 requests were:
- held-retry's 16 (`seedling-js-held-retry-evidence/premerge-replay`);
- L57's 5 (`l57.requests.jsonl.gz`);
- the diagnosis's J0 #62/#126/#127 and W2 #45/#46/#93–#96.

**30/30 identical answer AND trace, base = tip**, and each equals the page's live answer (`replay-tip.txt`, the `LIVE:` lines):
`d777bfb2c075`, `78614fcbef7f`, `668f4ca7aff6`, `8e2c3dcc23fd`, `72fb6ec7ac18`, `acb3a63487eb`, `124fe8a24dc3`, `5d514a643e92`,
`a0d702e11a78`, `59f9ba4d8666`, `de3dfedeffe6`, `9a2dd6e53352`, `9bb3364d43ce`, `d638696bfa03`, …

## The NEW JS requests vs wasm's, at the same goals (`evidence/request-diff.txt`, `reqdiff.py`)

Each comparison uses the same diagnosis/L57 wasm request. The base-JS request comes from held-retry / diagnosis / L57, the new one
from J1 (measuring branch). Persistence is compared as a set; `name` is ignored.

| goal | wasm | base JS: fields differing | **now: fields differing** | `rng` now (JS / wasm) | `seam.time` base → now (wasm) |
|---|---|---|---|---|---|
| L22 exit a0 | W2 #45 | 13 | **11** | `{seed 1251847133, split true, cosmetic 0}` / `{seed 1920394485, split true, cosmetic 0}` | 4800 → **16315** (15919) |
| L40 item 1 a0 | W2 #93 | 13 | **11** | split true / true; seeds differ | 4800 → **33784** (33953) |
| L40 item 2 continuation | W2 #95 | 18 | **17** | same | 4800 → **33784** (33953) |
| L40 item 2 fresh | W2 #96 | — (no base request) | 11 | same | **35059** (35080) |
| L57 exit | W1 #118 | 13 | **11** | split true / true; seeds differ | 4800 → **43741** (43275) |

Gone from every diff: `rng.split` (false/true), `rng.fp` (JS-only), and the 4800 clock. Left:
- `rng.seed` (by design, above), and `seam.time` within 21–466 ticks;
- the fields the L57 report already named, which decided nothing there: 16–21 fewer `persistence` rows (other rooms' clears),
  `passes` absent (the worker's default, the same two), `items.hitsMax` vs `hits_max`, and seam defaults JS leaves absent;
- on the continuation, its own arrival (`live`, `perTick`), because the first plan differs.

## The walks (seed 1, the SHIPPED limits, no `SEEDLING_*` env except JA's, a fresh page per walk, `--stall-s=300`)

Runner `evidence/run-arm.sh`, order `evidence/seq.sh` / `seq.log`. Capture probe `TEST_MEASURE_CAPTURE_SERVICE=1` on the JS arms
(`<arm>.solves.txt` via `sumcap.py`). There was no container restart.

| arm | branch / head | runtime | budget | checked | stop | cause (verbatim) | walk |
|---|---|---|---|---|---|---|---|
| **W1** (control) | landing `0d31231e` | wasm | 2400 s | **27/48** | entry 28 "Level 064 - Ghostspear" in `level_63__r0c1` | `budget: the step's wait ran out` (by design; past entry 24 and L57/L58) | 2400 s |
| **J1** | `measure` `d910491d` | JS | 3600 s | **36/48** | entry 37 "Level 068 - Health" in `level_63__r6c9` | see below (1) | 3407 s |
| **J2** | `measure` `d910491d` | JS | 3600 s | **31/48** | entry 32 "Level 040 - Totem Part 64,144" in `level_40__r4c4` | see below (2) | 2864 s |
| **JA** | `measure-ja` `9e5040e5` | JS, **ALL** | 3600 s | **36/48** | entry 37 "Level 068 - Health" in `level_63__r6c9` | `budget: the step's wait ran out` (status `routing via "level_63__r6c9 -> level_65__r0c8" → level_68__r1c1 (37/48)`) | 3601 s |

⚠ W1 started at `0d31231e`. The docs commit `bd3f5bfc` and the evidence commit `bd0d83fa` landed on the landing branch while W1 ran.
Both are docs/evidence only, and the page and spec were already loaded.

(1) J1, verbatim: `refusal "error: level_63__r6c9: the bot cannot walk to exit \"level_63__r6c9 -> level_65__r0c8\" — the JS runtime's walk failed: not reached within 1800 ticks — stalled at (55.476117417220365, 135.47611741722037); the planner said: no walkable tile path in level 63 from tile (2,8) to (8,19). The two are in different connected components of the tiles the player box fits in — which at the v2 rung includes being separated by water, a pixelmask or a teleporter volume, none of which is a wall in the game.; the solver declined: levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272. \`WandShot\`'s ctor pushes \"Enemy\" onto its own solids, so a live enemy STOPS a shot — and a live enemy is invisible to \`collidesSolid\`, which only sees the ones something has flipped to \"Solid\". Reporting rather than flying through: a shot that passed through a body would report a clean corridor that does not exist. — the solver declined — levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272. \`WandShot\`'s ctor pushes \"Enemy\" onto its own solids, so a live enemy STOPS a shot — and a live enemy is invisible to \`collidesSolid\`, which only sees the ones something has flipped to \"Solid\". Reporting rather than flying through: a shot that passed through a body would report a clean corridor that does not exist.; walking instead (after 3 retries)"`

(2) J2, verbatim: `refusal "error: level_40__r4c4: the bot cannot walk to location \"Level 040 - Totem Part 64,144\" — the JS runtime's walk failed: the solver ran out of 640, then 2560 work units on its held retry on location in level 40: solverBot(js-runtime-L40-location): the caller's anytime deadline (\`shouldStop\`) was reached at the \`walk\` site before solverBot(js-runtime-L40-location) apitem (64,144) contact's corridor (attempt 1) — the segment's own work is bounded there, so the solve stops here instead of overrunning. ⏱ DEADLINE: the caller's \`shouldStop\` tripped (first at \`walk\`) and refused 1 \`walk\` scan(s) — this refusal may be the deadline's, not the room's. — solving… (budget 640 work units)"`

**Before** (L57 slice, same limits): J1 / J2 / FJ1 **23/48**, every one stopping at the L57 fight's *"no declared seed"*. **Now** 36
and 31.

### L22, L40 and L57, solve by solve (answer, ticks, model hits)

| goal | J1 | J2 | JA (ALL) | wasm (diagnosis W2 / L57 W1) | same as wasm? |
|---|---|---|---|---|---|
| L22 exit, a0 @640 | #67 REFUSED `124fe8a24dc3` (cut) | #67 the same | the same | W2 #45 REFUSED `d777bfb2c075` (cut) | same verdict (the refusal text embeds the request name) |
| L22 exit, held retry @2560 | #68 **SOLVED `78614fcbef7f`**, 113 t, 0 h | #68 the same | #67 the same | W2 #46 `78614fcbef7f`, 113 t, 0 h | **same** |
| L40 item 1, a0 @640 | #133 REFUSED `5d514a643e92` (cut) | #129 the same | #127 the same | W2 #93 REFUSED `668f4ca7aff6` (cut) | same verdict |
| L40 item 1, held retry | #134 **SOLVED `f3e5f8fcb4a2`**, 1262 t, 0 h | #130 SOLVED `acab7067a155`, 985 t, 0 h | #128 SOLVED `244a43c85ad9`, 1262 t, 0 h | W2 #94 `8e2c3dcc23fd`, 1106 t | **differs** (the clock, the spinner's hammer: the diagnosis measured that `seam.time` alone picks this plan) |
| L40 item 2, continuation | #135 REFUSED `ba987f42fbfd` (the combat ladder) | #131 **SOLVED `471558589c95`**, 795 t, 0 h | #129 REFUSED `c1feca9228ee` | W2 #95 REFUSED `72fb6ec7ac18` (named, any budget) | same verdict on J1/JA; J2 solves it |
| L40 item 2, fresh | #136 **SOLVED `acb3a63487eb`**, 494 t, 0 h | — | #130 `acb3a63487eb` | W2 #96 **`acb3a63487eb`**, 494 t | **same, byte for byte** |
| L57 exit (the fight, then the mouth) | #167 **SOLVED `efcd223ed82a`**, 1932 t, **0 h** | #163 SOLVED `1fd88ecbc8b8`, 1795 t, 0 h | #162 SOLVED `0a23de600354`, 1321 t, 0 h | W1 #118 `9a2dd6e53352`, 1830 t, 0 h | **differs** (the seed: the tentacles' places are draws from it) |
| L58 location / exit | #168 `8df1f566fc8e` / #170 `d638696bfa03` | #164 / #166 the same | the same | `8df1f566fc8e` / `d638696bfa03` | **same** |

**The L57 slice's follow-up 3 is answered:** JS's first L58 request after the mouth boots at `(48, 96)`, row `(56, 104)`, exactly as
wasm's does.

**Every solve the walks show, compared with wasm** (`evidence/J1-vs-wasm-solves.txt`, `J2-…`, `JA-…`, `solvecmp.py`). The wasm
answers are the union of the L57 slice's W1 and held-retry's MW1 (the most recent wasm walks with captures). This is coarse: a goal
counts as "same" if any JS answer for it is one of wasm's.
- **J1:** 69 goals the same; 5 differ (**L18** exit, **L39** location, **L54** exit, **L57** exit — the seed — and **L92** exit).
  L18's room has spinners, so the clock is the likely reason. The other three are not attributed here.
- **J2:** 70 the same; 3 differ (L18, L57, L92).
- **JA:** 69 the same; 5 differ.
- 26 goals have no wasm answer, because the wasm walks stop earlier (entry 28 by the time budget).

**The JS walk is now history-dependent, as wasm's is (named, measured).** J1 vs J2 at the same goals (`evidence/J1-vs-J2-request-diff.txt`):
- at L22 they differ by **one clock tick** only (16315 vs 16316);
- by L40 they also differ in `rng.seed`, because the two walks made a different number of room boots.

Before this slice every JS room started at 4800 / seed 0, so a JS walk could not drift this way.
**J2's stop is the clock's.** J2 #262 replayed with only `seam.time` set to J1's 82985 → **SOLVED `a404ddf42e41`** (1889 t), J1
#266's exact answer. With only J1's seed, it stays REFUSED `7fbb6d50edf4`, the same budget cut (`evidence/replay/l40swap.out.jsonl`).

### The next wall, and is it JS-only?

**No, it is shared with wasm.**
- **L63, exit `level_63__r6c9 -> level_65__r0c8`, entry 37.**
  - J1's held retry (#314) refuses `9c5ba5c37277` on the WandShot check (`grenade@128,128`, 4 darktraps).
  - Hammer's re-measure-12 lists that exact hash for **wasm under base** on its L1 37:8 stop request (its replay table: *"L1 37:8
    (stop) under ALL | `6fc9184e21ed` solved (2309, 617 t, 0 h) | `9c5ba5c37277` | `9c5ba5c37277`"*). Its summary says that *"under
    base the same request stops earlier, on the WandShot check (`33d1bad340b8`, `grenade@128,128`)"*.
  - **Under ALL, JA's held retry (#312) SOLVES it as `6fc9184e21ed`, 617 t, 0 h**: the same answer re-measure-12 gives under ALL.
    JA then ran out of its 3600 s budget, routing on from that entry.
- **The second wall, seen on J2: the L40 Totem Part (64,144), entry 32.** It is a budget cut even at 4×, and it depends on the clock.
  No current wasm walk at defaults reaches entry 32 (both stop at entry 28 by the time budget), so whether wasm meets it is not
  measured.

## js-24's arm JA — L20 flag 4 (measure only, not fixed)

JA ran with B1's spec verbatim:
`--solver-env="SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1;SEEDLING_HIT_PLAN_RETRY=1;SEEDLING_KILLLOCK_PINNED_SPEAR=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1"`
(re-measure-12 `seq2.sh`: `ALL="$CORE;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1"`).
It ran on the hammer-merged measuring branch above.

- **Does L20 flag 4 pass? Yes.** The order in JA's log is:
  - `bot: done → Level 020 - Shield in level 20`: #56 `collect-placement (112,48)` SOLVED `71280758af23`, 99 t, 0 h;
  - then `bot: done → L20 flag 4: lock@32,80 cleared in level 20`.
- **The flag-4 request** is JA #57: `js-runtime-L20-location`, `clear-tag {20,4} at (32,80) obstacle lock@32,80`, budget 640, attempt
  `{"retry":0}`, a continuation at prefix 94 (the Shield is picked up in-run).
  - Its answer: **SOLVED `80eaba4942a6`**, 171 t, 0 h (`dashless:ok w14 t205`, `full:ok w75 t171`).
  - **Neither the held retry nor the W7 fallback passed it**: it solved on attempt 0.
  - **J1 #58 and J2 #57, at defaults, give the identical answer `80eaba4942a6`.**
- The W7 forced re-arrival does fire in L20, but on the **exit** `level_20__r3c1 -> level_13`. #58 refuses (`fc1b6762e282`,
  *"no corridor … Obstacle: proximity-hazard"*); then *"boot level 20 at (192, 64) — re-entering level 20 (forced re-arrival …)"*; then
  #59 SOLVED `c630ffc9a519`. J1 and J2 do the same.
- **How far JA gets:** **36/48** (above).
- No L20 diff is needed, because L20 does not refuse. What B1 saw (*"shieldlocknorm@176,16 needs `Player.hasShield`"*) was a flag-4
  request posted without the Shield. B1's base had neither held-retry nor the L57 fix (re-measure-12's own note). Which of B1's
  missing changes posted that request without the Shield is not measured here; its request was not captured
  (*"The capture does not wrap JS-frame services, so B1 has no answer stamp"*).

## Invariants

- **Closure-nil.** `seedlingDerivedRuleTable.js --print-engine-closure`: **42 files, engineMd5 `6c8cd75145bdf58d2eed7d7cc9e6b512`**,
  root `certifyPlaythroughMaze.js`. The same at base, at the tip `0d31231e`, at the merge tip `3e7cfc8b`, and at origin/main
  `aa749df3` (a worktree): the merge tip's md5 = origin/main's. diff ∩ closure = **∅** at base→tip and merge-tip vs origin/main.
  `rng.js` here is `seedlingDemo/rng.js`; the closure's `rng.js` is `shared/rng.js`.
- **Docs.** `docs/json/developer/procgen/flash.md` (outside any GENERATED region): the JS Halts bullet (L112 boots now; a tape's
  unsplit stream still halts by name), the save-clock bullet (a later teleport carries the clock), and a new bullet for the room
  boot's stream and clock. `check-procgen-docs.mjs`: **ALL CHECKS PASSED** at `bd3f5bfc` and at the merge tip. The generated pin that
  moved is the docs word count (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`), regenerated at the
  merge. `seedling-bot-log.md` and `architecture.md` were not edited.
- **In-app `seedling-js`** at the landing tip `0d31231e`: **45 run · 45 passed · 0 failed · 45 enabled · 0 not run**, 0 import
  failures (`evidence/inapp-seedling-js.txt`). The tutorials-seedling JS rows were not run here; js-24's dispatch covers them.
- **The wasm path is unchanged.** No wasm file moved. W1 reaches 27/48 by the time budget, past entry 24, and plays L57 → L58.
  The L57 slice's W1/FW1 reached 28/48 the same way; the walk is bimodal and budget-bound.
- `git status` was clean on the landing branch after every mutant restore (`cmp` checked). The measurement-only probes and the hammer
  merge live only on the two local measuring branches.

## CI for js-24 to dispatch at the landing tip

- JSUT (`unittests_frontend.yml` default tier) and ut (`unittests.yml`) at the tip;
- the TT dispatch: fast-batch headroom vs the median of 3 main samples (STOP > +20 s or > 70 %);
- `test-substrates-manual.yml` `batch=tutorials-seedling` and `batch=tutorials-seedling-whole-game`. The whole-game row's JS leg, if
  it asserts a JS count, should now read higher (36/31 here at 3600 s);
- surveys END + 4.2 with **0 movers per step**. The solver is unchanged (30/30 replays), and no request the surveys build goes
  through the JS room boot;
- no `train_only` (no solverBot / hammer / fidelity / generator / tileStep file).

## Follow-ups (asks, not built)

1. **The next wall, L63's WandShot (entry 37), is shared with wasm.** It is the same refusal as wasm at base. ALL passes it on JS
   with wasm's answer. So it is a hammer-switch landing question, not a JS one.
2. **The L40 Totem Part (64,144) budget cut (J2's stop)** depends on the clock: one walk's clock solves it, the other's is cut at
   2560. It is now reachable on JS because the clock runs. Ask: whether wasm meets it at defaults (a wasm walk with a longer budget,
   or a `--seam-time-sweep` census of J2 #262: `evidence/J2.sel.requests.jsonl.gz`).
3. **JS walks now drift between runs** (a 1-tick clock difference by L22, and a different boot count by L40), as wasm's do. A future
   JS k/N needs N > 1, as wasm's does.
4. **Not modelled, named:** the JS seed is the JS page's own stream, reseeded per room boot. It is not the game's live position. If a
   JS fight ever needed to match wasm's tentacle placements draw for draw, the page would need to book every gameplay draw per room.
   That is not asked.

## Evidence (`CC/docs/cloud-reports/seedling-js-boot-rng-clock-evidence/`, ≈ 6 MB, no file > 1 MB)

- `mutants.txt`, `moved-rows-attribution.txt`, `vitest-bounded.files.txt`, `vitest-bounded-tip.txt`, `vitest-bounded-mergetip.txt`;
- `replay/`: `requests.jsonl.gz` (the 30), `replay-{base,tip}.out.jsonl`, `replay-tip.txt`, `l40swap.*` (J2 #262's clock/seed swap);
- `request-diff.txt` + `reqdiff.py` (vs wasm), `J1-vs-J2-request-diff.txt`;
- `W1/J1/J2/JA.summary.txt`, `.measure.log.gz`; `J1/J2/JA.solves.txt`; `J1/J2/JA.sel.requests.jsonl.gz` (the L20/L22/L40/L57/L63 rows);
  `*-vs-wasm-solves.txt` + `solvecmp.py`, `sumcap.py`;
- `seq.log`, `seq.sh`, `run-arm.sh`, `replays.sh`; `inapp-seedling-js.txt`; `engine-closure-tip.txt`, `engine-closure-mergetip.txt`.
  The raw captures (0.5–168 MB) are not kept.
