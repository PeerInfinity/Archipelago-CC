# Seedling HAMMER-PHASE FF — why `HAMMER_FIGHT_FALLBACK` ON makes a solve its shadow cannot replay (measure only)

Slice `seedling-hammer-fight-fallback-shadow` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ User approval of
2026-10-25 (*"Yes, I approve fast forwarding main, and all of the tasks that belong to this session."*). Measure first:
no runtime file, switch, tape, fixture or pin was edited. Evidence is in
[`seedling-hammer-fight-fallback-shadow-evidence/`](seedling-hammer-fight-fallback-shadow-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`cfc681a566`** (`origin/main` at the fetch: `STRIKE_ETA_FLOOR` ON, `PRESS_KILL_BOMBS` ON, PDS, DIGESTREAD, waves 29a/29b) |
| head | the commit that adds this report. Before it: `5f17cf61` (W0 + M1 + M2 evidence), `619d865b` (the radius evidence) |
| branch | `claude/hammer-fight-fallback-shadow-u2ypme`, the session's designated branch (not the brief's `seedling-hammer-fight-fallback-shadow`). It holds this report and its evidence only. Nothing went to `main` |
| the leg | **`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`**, still id **371** (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 928 legs) |
| second base | **`f9342f25b8`** (L371's), as a detached worktree in the scratchpad, for the reproduction of L371's own message (§ 3.2). Removed by name at the end |
| box | 4 cores, node v22.22.0, dev server `serve-nocache.py 9601` (killed by PID). Answers, units and ticks are box-independent |

## 2. The answer

**Cause class: (c), the shadow harness.** The fight fallback's plan is sound and replays exactly; the worker's
recorder does not follow the run the plan was made on.

**The one function that decides it: `jsRuntimeSolver.solveFromTape`** — its recording `Proxy` around the shadow.
- `solveFromTape` builds `expected` (and `equipsAt` / `equipItems`) by recording every `advance` / `equipNow` on the
  Proxy it hands `solveSegment` as `run`.
- The fallback's **rewind arm** (`execKillByPress`, `solverBot.js` ~16220, `HAMMER_FIGHT_FALLBACK` rewind mode)
  replaces the segment's run with a **fresh fork** (`rewind.to(t0)` → `run = viewOf(fresh, t)`, ~22743). When the
  retry kills, the fork is adopted and the segment goes on on it. Nothing after that reaches the Proxy.
- `solveSegment` announces this: a rewound result carries a non-enumerable **`liveRun`** (~28138) *"so a caller that
  reads the run after the solve … can take it"*. `watchSolve.solveForPage` takes it (`out.liveRun ?? built`).
  **`solveFromTape` does not.** So its count stops at the refused kill's last tick, and
  `solution.length !== expected.length - 1` throws the ShadowDivergence.
- **Measured: "the shadow advanced N" is exactly the fallback row's `refusedAt`, on every diverging seam** (L371's
  1342 included, § 3.2). The 315 "missing" sets of L371's message are `1657 − 1342`: the retry's ticks plus everything
  after it, minus the refused tail the recorder kept.

**The plan replays.** An independent `replayTape` of the returned keys equals the adopted fork tick for tick
(`stateDigest`), apart from the `persist` part over the last 6–9 ticks — the item take, which the no-fallback control
seam 5250 shows identically. `runDigest` (the harness's own check) is equal at the end. The recorder, by contrast,
holds the *refused* branch from tick t0 + 1.

**What it costs.** `solveAnytime` ends at a divergence (`kind: 'divergence'` → `break`), so the full pass never runs and
the page treats it as its own bug. The fallback's promise, *"can only add solves"*, is broken exactly where it succeeds:
on 371, 4 of 45 phases are default refusals that the rewind **solves** and the harness then **throws away**
(30 → 31 phases with the switch ON today; 35 with a harness that follows `liveRun`).

**Recommendation:** keep `HAMMER_FIGHT_FALLBACK` OFF, and fix the harness before anyone measures the switch again — a
small JS-arc slice in `jsRuntimeSolver.solveFromTape` (§ 6). No solver-logic change. Whether to flip the fallback after
that is a separate question (§ 6.3).


**Radius of the symptom, measured:** with the switch ON, among 47 fresh L40 page requests (42 legs) plus the 7 legs of
the other spinner rooms (L18, L39, L92), the only mover and the only divergence is leg 371 itself. Every other request
is byte-identical to the default, and no fallback row runs on any of them.

## 3. W0 — the base, the reproductions, the census, the radius

### 3.1 Base and the page

| row | result |
|---|---|
| base | `git checkout -B claude/hammer-fight-fallback-shadow-u2ypme origin/main` → **`cfc681a566`** |
| bootstrap | `session_bootstrap.sh --seedling` → `READY`. Six submodules were `-` after it (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each. No gitlink moved |
| the page capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --ids=371 --capture-requests=…` → the page's seam was **5254**, `end: done` (the full pass, 1684 t; `w0/page-row-371.json`). The page runs the default: the env switch does not reach the page's worker (L371/BW residue), so every ON number below is node |
| the instrument | `tools/ff-solve.mjs`: L371's `l371-solve.mjs` (the worker's `solveAnytime` on one captured request, `--seam=` via `atSeamTime`) plus a `HAMMER_FIGHT_FALLBACK_TRACE` sink, so every row records which fallback ran and its verdict. One fresh node process per seam, one file per seam (`tools/census.sh`; PKB's append-to-one-file driver interleaved lines at `--jobs=3`) |

### 3.2 The census: 5226–5280 (one hammer period of 45 plus a 10-seam overlap), default vs ON

`w0/census-default.txt`, `w0/census-ff-on.txt` (raw: `w0/census-raw.tgz`).

| | default | `SEEDLING_HAMMER_FIGHT_FALLBACK=1` |
|---|---|---|
| phases solving, of 45 | **30** (PKB's number) | **31** |
| overlap pairs (s, s+45) identical | 10 / 10 | 10 / 10 |
| seams identical to the default | — | 41 of 55 |
| **divergences** | 0 | **4: 5251, 5264, 5265, 5266** (phases 31, 44, 0, 1) |

**Every divergence is a seam where the rewind arm SOLVED.** Over the 55 seams the switch ran three kinds of row:
- **rewind, solved** (`execKillByPress` at **t1112**, the kill on `spinner@192,128`, `HAMMER_SAFETY` *"There is no step
  out"*): **4 seams, all 4 diverge.** No other seam diverges;
- **admission** (the combat ladder's kill rung, `PRESS_ADMISSION`): 10 seams. They never diverge. Where the admission
  solved (5249, phase 29) the answer is a **new solve** (1812 t, from a default refusal): the switch's one real gain;
- none: the other 41 seams, byte-identical to the default.

| seam | default (OFF) | ON | the fallback row | the shadow's count = `refusedAt`? |
|---|---|---|---|---|
| 5251 | `HAMMER_SAFETY` at `kill (spinner@192,128)`, corner (260.63, 183.74) (179) | *returned **1795** … shadow advanced **1260*** (162) | rewind t1112, refusedAt **1260**, solved, 180 t | **yes** |
| 5264 | the same, corner (246.39, 154.67) (177) | 1775 / **1237** (159) | rewind t1112, refusedAt **1237**, solved, 148 t | **yes** |
| 5265 | the same (177) | 1775 / **1239** (159) | rewind t1112, refusedAt **1239**, solved, 148 t | **yes** |
| 5266 | the same (177) | 1775 / **1242** (159) | rewind t1112, refusedAt **1242**, solved, 148 t | **yes** |

**Byte-stable:** each diverging seam repeated in a fresh process gives the same sha and units (§ 5, `repeat`), and each
s ± 45 partner (5219, 5220, 5221, 5296) gives the same answer sha as its seam (`w0/census-ff-on-partners.txt`). The
divergence is periodic in the hammer period like everything else on this leg.

**L371's own message, reproduced.** In a detached worktree at **`f9342f25b8`**, the same captured request at seam 5230
with the switch ON gives L371's answer byte for byte: work **425**, dashless *"the hold stands still … bombpusher"*,
full ***"the solve returned 1657 key set(s) but the shadow advanced 1342"***. Its fallback row: rewind at **t1236**
(`spinner@192,160`, L371 § 5.1's kill start), **refusedAt 1342**, solved, 78 t (`w0/f934-5230.json`). The same
mechanism: the 1342 is the refusal tick. At this base 5230 no longer reaches that kill (it solves, 1915 t, identical
ON and OFF): `STRIKE_ETA_FLOOR` and `PRESS_KILL_BOMBS` moved which kill refuses, and so which seams the defect shows on.
**No landing fixed it** (it is not (d)).

### 3.3 The radius (`radius/`)

Every captured request replayed at its OWN seam, default vs ON, one process per cell (`tools/radius.sh`,
`tools/radius.py`).

| set | requests | identical ON vs OFF | fallback rows run | divergences |
|---|---|---|---|---|
| L40, all 42 legs, freshly captured at this base (`radius-l40.txt`) | 47 (30 solve by default) | **46** | 1 | **1: leg 371 i0 at seam 5265**, 1775 / 1239, rewind t1112 — the census's own case |
| the other spinner rooms: L18 (220, 221), L39 (363, 364, 365), L92 (720, 721) (`radius-spin.txt`) | 7 (7 solve) | **7** | 0 | 0 |

(L18, L39, L40 and L92 are the four levels whose `.oel` holds a Spinner: `Dungeon2/5`, `Dungeon4/1`, `Dungeon4/2`,
`OverWorld/mountain1`, by `Game.as`'s embed table.) The page's own row for the 371 request was a refusal at seam
5265, *"kill (spinner@192,128) by press: no reachable cell … nowhere to be"* (`HAMMER_SAFETY`): exactly the refusal the
rewind arm answers. PKB's 47 L40 requests were not in the tree (only their page rows), so this is a fresh capture of
the same 42 legs; it also gives 47 requests.

## 4. M1 — where the replay parts

**Tool:** `tools/ff-replay.mjs`. It rebuilds one pass the way `solveFromTape` does (the same `replayTape` shadow and
recording Proxy, the same `forkRunFor`, the same `passShouldStop` budget) but keeps `solveSegment`'s result instead of
letting the length check throw. It records `run.stateDigest({parts: true})` after every advance on three runs: the
**recorder** (the Proxy's target, which `expected` is read off), **every fork** (the rewind's fresh run is one), and an
**independent `replayTape`** of the solve's returned `perTick`. Reads are DIGESTREAD-safe: only `stateDigest` after an
advance. It is inert: at every seam its solution length, `refusedAt` and work equal the census's.

| seam | solution | recorder advanced | recorder vs replay, first parting | its part | adopted fork vs replay | end `runDigest` fork = replay |
|---|---|---|---|---|---|---|
| **5250** (control: solves, no fallback) | 1843 | 1843 | t1836 | `persist` (the item take) | — (no fork) | recorder = replay |
| **5251** | 1795 | **1260** | **t1113** | `player` | first parts at t1790, `persist` only | **yes** |
| 5264 | 1775 | 1237 | **t1113** | `player` | t1767, `persist` only | **yes** |
| 5265 | 1775 | 1239 | **t1113** | `player` | t1767, `persist` only | **yes** |
| 5266 | 1775 | 1242 | **t1113** | `player` | t1767, `persist` only | **yes** |

(`m1/replay-*.json`.)
- **The parting is the first tick after the rewind point t1112:** from there the recorder carries the REFUSED kill's
  keys (it ends at (260.63, 183.74) on t1260 at 5251, which is the default's corner exactly), and the plan carries the
  retry's.
- **The key sets at and after the parting are the fallback's own retry segment (t1112 → t1292 at 5251), and then
  every segment after it.** The recorder sees none of them. The fault is not in any key set: the replay of the
  returned keys and the adopted fork agree on every part of the digest until the item take's `persist` tail, which the
  no-fallback control has too (the replay does not re-make the take, the run does). The harness's own end check
  (`runDigest`) is equal.
- **The full pass, run alone** (`m1/replay-full-*.json`): at 5251 it also rewinds at t1112 and also solves (1661 t),
  and would also diverge. At 5264 it rewinds, solves the kill, and later refuses at the paced hold. A refusing pass
  returns no plan, so its stale recorder is never checked. That is why other seams "gave ordinary refusals": the
  fallback's rewind ran in a refusing pass too (at `f9342f25b8`'s 5230 the dashless pass did exactly this).

## 5. M2 — the candidates, toggle by toggle

One fresh process per cell, at the four diverging seams. `=` is identical to the ON row (answer sha and units).
(`m2/toggles.md`, raw `m2/toggles-raw.tgz`.)

| arm (env, with `SEEDLING_HAMMER_FIGHT_FALLBACK=1`) | 5251 | 5264 | 5265 | 5266 | reading |
|---|---|---|---|---|---|
| default (switch OFF) | refusal@kill (179) | refusal@kill (177) | refusal@kill (177) | refusal@kill (177) | — |
| **ON** | **DIVERGE 1795/1260** | **DIVERGE 1775/1237** | **DIVERGE 1775/1239** | **DIVERGE 1775/1242** | — |
| repeat, fresh process | = | = | = | = | **no RNG or clock read** between the solve and the shadow: byte-stable |
| `SEEDLING_ESCAPE_CROSS_PASS_CACHE=0` | = | = | = | = | **XC is not it.** XC's scope is `twoPassSolve`'s; the worker path never opens one |
| `SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1` | = | = | = | = | the same |
| `SEEDLING_HAMMER_FIGHT_FALLBACK_MODE=whole` | **= default** | **= default** | **= default** | **= default** | no rewind, so no divergence. The worker has no whole-segment retry (only `twoPassSolve` and `procgenOracle.solve` do), so `whole` is inert here: exactly OFF's bytes |
| `SEEDLING_PRESS_KILL_BOMBS=0` | = | = | another refusal (642), no row | **DIVERGE 1775/1247**, rewind refusedAt 1247 | moves the trajectory; **wherever a rewind solves, the divergence follows, at that rewind's `refusedAt`** |
| `SEEDLING_STRIKE_ETA_FLOOR=0` | refusal@hold, admission row | refusal (shake) | SOLVE 1781 t, admission row | = | the same: no rewind solved → no divergence |
| `SEEDLING_HAMMER_ESCAPE=0` | = | = | = | = | not involved |

**The brief's candidates, each answered:**
- **A preview's state leaking into the plan, or a cached answer reused on another state:** no. The returned keys,
  replayed independently, reproduce the adopted fork's state at every tick (§ 4).
- **A key set from a truncated or death preview (PDS's `previewWalkOrDeath`):** no. PDS has no env switch, so it was
  not toggled; it is excluded by measurement instead, because such a key set would make the replay part from the fork,
  and it does not.
- **XC:** no (OFF and VERIFY both `=`).
- **A stale RNG or clock read:** no (byte-stable repeats; the s ± 45 partners give the same sha).
- **The shadow's own harness: yes.** The count of advances the recorder saw equals `refusedAt` on all 4 seams here,
  on L371's 5230 at `f9342f25b8`, and on the PKB=0 mover. The recorder ends on the refused branch. The adopted fork
  ends where the plan ends.

## 6. M3 — the recommendation

### 6.1 The class and the function
**(c), the shadow harness: `jsRuntimeSolver.solveFromTape`** does not honour `solveSegment`'s rewound-result contract
(`liveRun`, B3, `solverBot.js` ~28133–28138). Not (a): the fallback's plan is sound (it replays, and it solves a
default refusal). Not (b): nothing is nondeterministic, and no shared state leaks; the recorder is just the wrong run.
Not (d): it reproduces at both bases.

The owner is the hammer arc's B3 (it wrote the rewind and the `liveRun` contract, and wired `watchSolve.solveForPage`
to it), in a JS-arc file. `hammerFightFallback.test.js` drives the fallback through `twoPassSolve` / `solveSegment`
only; no row drives it through `solveFromTape` / `solveAnytime`, which is how the gap went unseen.

### 6.2 The honest fix (a recommendation, not done)
In `solveFromTape`, record the forks the same way as the shadow, and follow the run the segment ended on:
1. hand `solveSegment` a `forkRun` whose runs are wrapped in the same advance / `equipNow` recorder as the shadow
   (each with its own `expected` / `equipsAt` / `equipItems`, indexed from boot, so the prefix replay lands at
   `perTick.length`);
2. after the solve, if `out.liveRun` is set, take `expected` (from index `perTick.length`), `equipsAt` and
   `equipItems` from the recorder of the fork that is `out.liveRun`, instead of the shadow's;
3. make the trailing-equip `advance(new Set())` on `out.liveRun ?? run`.

**Its radius:** `liveRun` is set only by `rewind.to`, which only `HAMMER_FIGHT_FALLBACK` (rewind mode) calls, so with
the switch OFF (the default) the change is byte-inert: no shipped answer, tape or pin can move. With the switch ON, on
371 it turns the 4 diverging phases into plans: **35 of 45** phases solve, against 30 OFF (each of the 4 has a
dashless plan that replays, § 4; the full pass may shorten it). It also covers the latent case in § 8.1.

**The rows it needs:** a `solveFromTape` (or `solveAnytime`) row on the B3 fixture `r9-solve-18` residue 4 with
`HAMMER_ESCAPE` off (the one `hammerFightFallback.test.js` already rewinds and solves), asserting `ok`,
`expected.length − 1 === solution.length`, and `expected` = a `replayTape` of the plan row for row. Mutant: drop step 2
→ the divergence. Plus `equipsAt` across a rewind, if the fixture equips.

### 6.3 The switch
**Keep `HAMMER_FIGHT_FALLBACK` OFF; fix it, do not retire it.**
- It does add solves where it is allowed to finish: the admission arm's +1 phase on 371 (5249), and the rewind arm's 4
  phases that the harness now discards.
- Measured nowhere else on the route's spinner legs (0 rows on 53 of 54 requests). So its value is small and
  concentrated on 371, and a flip is a later question.
- Until the harness is fixed, **no measurement of the switch through the worker is honest**: every rewind that solves
  reads as a page bug, and it also ends the anytime loop before the full pass.

**Next-slice proposal (for the user):** **FF-HARNESS**, small, JS arc + hammer: § 6.2's three steps plus the rows,
the bounded vitest set naming `jsRuntimeSolver` / `hammerFightFallback` (⚖ 52), and one re-census of 371 ON over a
period (expected: 35 of 45, 0 divergences). Then the planner can decide whether a fallback flip is worth its own A/B.

## 7. What the brief got wrong (measured)

1. **"The seam that diverges"** is not 5230 at this base. 5230 solves (1915 t), ON and OFF alike. The diverging seams
   are **5251, 5264, 5265, 5266** (phases 31, 44, 0, 1), 4 of 45.
2. **"A plan that its own shadow cannot replay is a determinism or state-isolation defect."** It is neither: the plan
   replays. The "shadow" in that message is not a replay of the returned keys. It is the recording Proxy the solve was
   DRIVEN on, and it was abandoned mid-solve by the rewind.
3. **"Stopped advancing 315 sets short."** The recorder did not stop short of a replay. It holds the refused kill's
   tail (t1236 → t1342 in L371's case) and none of the retry or anything after it. 1657 − 1342 is not a count of sets
   it failed on.
4. **None of the listed candidates** (preview leak, PDS's death preview, XC, RNG / clock) is the cause; the last one
   (the harness) is.
5. **`HAMMER_FIGHT_FALLBACK` at `solverBot.js` ~12566:** it is at **~13907** at this base.
6. **"Other seams under the switch gave ordinary refusals":** also because a rewind that solves inside a pass that
   later refuses is never checked (§ 4). And one seam gained a solve (5249, the admission arm).
7. Branch: the designated branch is `claude/hammer-fight-fallback-shadow-u2ypme`, not `seedling-hammer-fight-fallback-shadow`.
8. The bootstrap again left six submodules uninitialised after `READY`.

## 8. Residue

1. **The admission arms' failure path is the same defect, latent.** `resolveKillStrategy` (~14871) and the kill rung
   (~25085) call `rewind.to(t)` on a failed fight-on kill and do NOT undo it: the segment goes on (to its refusal) on a
   fresh fork, and the recorder is stale from there. In every measured case a refusal followed (10 admission rows on
   371; at 5256 the admission-rewound dashless pass refused, and the solving full pass ran no fallback), so no plan was
   checked. If an outer rung ever catches that refusal and solves on, it will diverge the same way. § 6.2 covers it.
2. **`equipsAt` / `equipItems` are stale across a rewind too** (the same Proxy). Not exercised on 371; not measured.
3. **The page cannot see the env switch** (BW's residue 6), so the 4 rescued plans were never played on wasm. Their
   model-level replay is exact. Wasm fidelity is the CI's to show after the fix.
4. **`HAMMER_FIGHT_FALLBACK_MODE=whole` is inert through the worker** (no whole-segment retry in `solveFromTape`).
   If the whole mode is meant to reach the page, that is its own gap.
5. **Not run:** no vitest (nothing was changed, and ⚖ 52 bounds it to touched paths), no CI.
6. **Tree hygiene:**
   - no runtime, switch, tape, fixture, pin, gitlink, AS3, wasm or rules edit;
   - switches set by env in node only;
   - no `pytest`, no `standing-values --write`, no unfiltered vitest, no stash, no force-push, nothing pushed to `main`;
   - the `f9342f25b8` worktree removed by name (`git worktree remove`), the dev server killed by PID (1182);
   - the page captures (the 530 KB 371 request, the L40 and spinner-room captures) stay in the session scratchpad.
