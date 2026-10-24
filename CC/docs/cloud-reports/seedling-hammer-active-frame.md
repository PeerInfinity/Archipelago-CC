# Seedling hammer-phase TC2: the active frame's detail (solve-progress `frame`)

Slice `seedling-hammer-active-frame` (Opus, cloud) for planner `seedling-hammer-phase-planning-2`. This is solve-progress
Tier C's "active frame's detail" (hammer #2, fidelity #6 on the investigation's wishlist). It ran in parallel with SP
(`botDriverV2.planWaypoints`) and EX (the `pressEscape` region), and edited neither.

| | |
|---|---|
| start | `b3adfad282` (`origin/main` at checkout; `6fe75d9493` is an ancestor) |
| head | `16802e97` (D4 evidence), then this report's own commit. Commits: `d472c25b` W0 + D1 · `9a06b8bf` D2 · `ec4d31ef` D3 · `3ea1cf43` D4 records · `16802e97` D4 evidence |
| branch | `claude/seedling-active-frame-5xj4l8`. The brief named `seedling-hammer-active-frame`; this session's harness designates the `claude/…` branch. Not merged, and not pushed to `main` |
| evidence | `CC/docs/cloud-reports/seedling-hammer-active-frame-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

**Verdicts.** W0 PASS · D1 PASS (no STOP) · D2 PASS · D3 PASS · D4 PASS.

**The one thing to know first.** Nothing had to be computed. The solver's trace rows already carry all three values: a
climb's `hit` (`obstacle.id`), and a rung row's `target` and `stance`. The press arm's `cycles` carry its body and cell.
So `frame` only copies them, and every pre-TC2 byte of every snapshot is unchanged. The real decision was **which open
frame is "current"**: the innermost one that has detail. A frontier verb's target is an obstacle (`lock@144,112`), not
always a body, so the field is `target`, the trace's own word, not `body`.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-active-frame-5xj4l8 origin/main` → `b3adfad282` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. Six submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` on each. Node v22.22.0. Server `serve-nocache.py 9599`, PID 734 |
| identity block | `w0/identity-w0.txt`: RK2's D4 byte for byte, **except ENEMY `f0bec576`** (RK2 had `36b59445`). That moved at `68b81a1a`, *"bank(seedling-fidelity BeamTower trio flip): ENEMY census default → f0bec576"*. It is a moved baseline, not a red row |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 (= RK2) |
| reference | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN 312 · 6,002 · 566 · 138 · 280 |
| bounded vitest BEFORE | RK2's 30 files (`w0/vitest-files-w0.txt`, `lintGateLabels` included): **883 / 883** (RK2's D4 was 866; main moved in between) |
| RK's L18 / L40 | `w0/l18-*.json`, `w0/l40-*.json` (`tools/rkprobe.mjs`, the real tap at 100 ms and unhooked): L18 `230dc0ff`, `shouldStop` 165, asks `{walk 13, hammer-escape 37}` · `{walk 14, hammer-escape 37}` · `{walk 18, hammer-escape 37, sword-dash 9}`; L40 `3addc379`, 167, `{walk 61, kill-chaser 97, sword-dash 9}`. All = RK |
| v1 projection md5s | `w0/v2proj-w0.jsonl` (`tools/v2proj.mjs`): L18 `84b55e41`, L40 `642785a1`, L6 `c2d3c373`, L3 `d87fd4b1` (= RK) |
| TC2's own baseline | the same file: the md5 of **every** snapshot of a peek-at-every-call stream (`frame` dropped; the base has none). L18 `815d03a1` (1,593 snapshots), L40 `ffb863ee` (372), L6 `4225dd84` (41), L3 `b45dd8f1` (27). Also each segment's final `budget.work` |

## D1 — where the values live (PASS, measure only)

Measured by reading and by `tools/d1probe.mjs`, which prints each trace row's `strategy` and `obstacle` unhooked
(`d1/l40-trace-rows.jsonl`, `d1/l18-trace-rows.jsonl`, `d1/l6-trace-rows.jsonl`). Line numbers are at the base
`b3adfad282`.

| value | the site that already has it when the frame is active | line(s) | already computed? |
|---|---|---|---|
| **blocking danger** | the walk's corridor probe: `let hit = probeCorridor(wps, …)`, handed to `climbLadder({…, hit})`. `probeCorridor` returns `probeSamples`' `{x, y, tick, danger, sources}` plus `eta`. Each source is `{kind, id, why, …}`, and a chain/beam carries `phase` and an axe carries `axe` (`dangerMap.js:573`, `:707`). The trace's `obstacle` is `dangerObstacleOf(hit)` = `hit.sources[0].id` | `:22021`, `:22069` (the climb call), `:19296`, `:19321`, `:11999` | yes: the climb's own parameter. ⛔ No re-probe |
| **target** (a climb's rung) | `rowFor(rung, refused, extra)`, whose `extra.target` is the trace's `strategy.target`: light arm `body.id`, BAIT `body.id`, KILL static-sword / ceiling / press / chaser `target.id` / `hunted.id`, PULL's `ropeId`. `progressRow` already receives `extra` (`:19570`) | `:19601`, `:20550`, `:20723`, `:20786`, `:20799`, `:20959`, `:21058`, `:21180` | yes: zero new lines needed for the rows |
| target (the chaser arm, before its row) | `const hunted = interceptOrder(removable, hit)[0] ?? target` is chosen **before** `deriveKillByChaser`'s stance scan. On L40 that scan is 254 of the solve's 372 snapshots (the `kill-stance` heartbeats) | `:21164` | yes |
| **stance** (a climb's rung) | `extra.stance`: BAIT `bait.stance`, chaser `hunt.stance`, light `d.stance` | `:19601`, `:20723`, `:21180` | yes |
| target + stance (a frontier verb) | `plan.obstacle.id` and `plan.resolved.stance` at the verb's `progressEnter` | `:21938` | yes |
| target + stance (the press arm) | `execKillByPressOnce`'s strike adoption: `strike = seeded` (×2) and `strike = next`, each followed by `cycles.push({body: plan.id, cell: ….cell, …})`, which is the record's `cycles` | `:14409`, `:14422`, `:14580` | yes. These are in the press kill's loop, **outside** EX's `pressEscape` / `pressEscapeOnce` / `strikeEscape` (`:10719`, `:11436`–`:11680`) |

Which frames carry which values:

| frame | target | stance | danger |
|---|---|---|---|
| a climb (on its cursor: a rung or arm) | the rung row's / the hunted body | the rung row's | the climb's `hit` |
| a frontier verb | its obstacle | its resolved stance | — |
| the press arm | the strike's body | the strike's cell | — |
| a walk, a goal, a search, a segment | — | — | — |

A walk owns its probe's `hit`, but on a hit it opens a climb and hands the hit to it. So the danger is the climb's (the
walk frame itself carries nothing).

Measured on the committed solves:
- **L40**: climb 1, KILL's chaser arm: target `puncher@128,624`, stance (136,616) → tile `[8, 38]`, obstacle
  `puncher@128,624`, sources `chaser:…` (a forecast).
- **L6**: BAIT: target `bob@112,48`, stance (56,24) → `[3, 1]`, obstacle `sandtrap@64,16` (`enemy:` source, a static
  volume).
- **L18**: no climb. Verb `kill` on obstacle `lock@144,112` (a `solid`), then the press arm's 7 cycles over
  `spinner@48,96` and `spinner@112,48`.

**No STOP.** No value lives only in fidelity's files (`levelRun`, `mover`, `strikePolicy`, `contactFidelity`), in SP's
`planWaypoints`, or in EX's `pressEscape` region.

## D2 — the fields (PASS)

`frame: {key, target, stance, danger} | null`, a top-level snapshot field, additive within `v: 2`
(`SOLVE_PROGRESS_VERSION` stays **2**: no consumer gates on `v`, and I found no reason to bump).

| field | value | why this shape |
|---|---|---|
| `key` | the active node of the frame that has the detail: a climb's cursor (`…/climb/rung:kill/arm:chaser`), or a verb's or arm's own node | ties the detail to its tree row, which is always `active` |
| `target` | an id string or `null` | the trace's own word, `strategy.target`. L18's verb target is `lock@144,112`, a lock, so `body` would be wrong for it |
| `stance` | `[col, row]` or `null` | `tiles.cells`' own convention (`floor(x / 16)` of the player's point), so the view needs no second grid |
| `danger` | `{source, tick, kind, at}` or `null` | a bounded summary of the climb's hit. `source` is the first source's id (the trace's `obstacle.id`) and `tick` is the absolute run tick of the sample that met it. `kind` is `phase` (the source has `phase` / `axe`), `forecast` (`arrow`, `chaser`, `spinner`, `spit`, `bomb`) or `volume` (everything else `dangerMap.js` writes: `hazard`, `enemy`, `crusher`, `terrain`, `pit`, `danger`). `at` is the tile of that sample, added because "placed on the tile map" needs where the corridor met it, and a source id gives only its census placement |

**Which frame is "current".** The innermost open frame that has detail. A stance walk launched by the kill rung shows
the rung's detail, a nested climb inside it shows its own, and the outer one comes back when the nested one closes. A
climb's `target` and `stance` belong to its rung: they reset when the cursor moves to another rung, and its `danger`
stays. `frame` is `null` before the first such frame, on a plain walk (L3: 27 of 27 snapshots), and on every
segment's final snapshot (a closed segment has no open frame).

`frontend/modules/seedlingDemo/solveProgress.js`: a `detail` slot on each stack frame; `progressFrame(d)` (it copies,
and `dangerOf` summarises a hit); `noteDetail` / `clearRungDetail`; `progressRow` reads `extra.target` / `extra.stance`;
`frameOf` at `peek()`; `dangerKindOf` (pure, exported for the gate row); `frameEntered()` (the counter).

**`solverBot.js`, six emit-only lines** (plus `progressFrame` in the import). Each is
`if (activeProgress !== null) progressFrame({…}); // ⛓ TC2…`, at the head's line numbers:

| line | site | reads |
|---|---|---|
| `:14410` | the press arm adopts the continuation strike | `{target: plan.id, stance: seeded.cell}` |
| `:14424` | the press arm adopts the approach strike | `{target: plan.id, stance: seeded.cell}` |
| `:14583` | the press arm adopts a derived strike | `{target: plan.id, stance: next.cell}` |
| `:19555` | `climbLadderUnder`'s head | `{danger: hit}` |
| `:21166` | the chaser arm, after `interceptOrder` | `{target: hunted.id}` |
| `:21945` | the frontier verb, after its `progressEnter` | `{target: plan.obstacle.id, stance: plan.resolved.stance}` |

None of them is a count point: no hook call, no ask, no `shouldStop`, no work unit, no deadline site. No default or plan
changed.

**Gate rows** (`solveProgress.test.js`, 33 → 43; the TC2 describe):

| row | what it pins |
|---|---|
| L18, L40 byte-identity | the digest is equal hooked and unhooked; `shouldStop` 165 / 167 both ways; `budget.asks` = RK's; **each segment's final `budget.work` = the base's, unit for unit**; unhooked, `frameEntered()` does not move (and hooked, it does) |
| L18, L40, L6, L3: the pre-TC2 bytes and the shape | the md5 of every snapshot with `frame` dropped = W0's (and the snapshot count); every snapshot has a `frame` key, which is `null` or one non-array object with keys `['key','target','stance','danger']`; `key` is an active node of its tree; cells are two integers; `danger` has `['source','tick','kind','at']`, an integer tick and a kind in `forecast` / `volume` / `phase`; every final `frame` is `null` |
| RK's rows (unchanged) | the v1 projection md5s (`v1Of` now also drops `frame`) and the per-solve kind totals |
| L40's kill rung | every `…/rung:kill/arm:chaser` frame: the target is a body of the room's census (`world.combat.enemies`) and the trace row's `strategy.target`; the stance is the row's `stance` as a tile, and `isWalkableTile` there; the danger's source is the row's `obstacle.id`, kind `forecast`. The AVOID / PULL / TIME / BAIT frames carry that danger and no target |
| L18's press arm | every `…/verb:kill/arm:press` frame's `[target, stance]` is one of the record's `cycles` (body, cell tile), with no danger; the last segment shows them in the record's order |
| `dangerKindOf` | phase / forecast / volume per field, and every source `kind` that `dangerMap.js` writes is covered (read out of the source) |
| the source | exactly six `progressFrame(` lines in `solverBot.js`, each one guarded line; `solverBot.js` never names `frameEntered` / `dangerKindOf`; the frame section of `solveProgress.js` reads no `shouldStop`, deadline, clock, `emit(`, `work(` or probe |

**Mutants** (`tools/mutants-tc2.py`, `d2/mutants.txt`, each against the TC2 rows):

| mutant | caught by |
|---|---|
| f1: `frame` kept as a growing list (every open frame's detail) | 5 red: the L18, L40 and L6 shape rows, the L40 kill-rung row and the L18 press row |
| f2: the climb's danger from a **fresh probe** (`probeCorridor(corridor, dangerExcept)`) instead of the hit it was handed | 4 red: the L40 byte-identity row (`budget.work.previews` moves), the L40 and L6 stream rows, and the L40 kill-rung row |
| f3: a frame read outside the null check (the setter made null-safe, the chaser arm's guard dropped) | 2 red: the L40 byte-identity row (`frameEntered()` moves unhooked) and the source row |

**What the frames look like** (`d2/l40-frames.jsonl`, `d2/l18-frames.jsonl`, `d2/l6-frames.jsonl`,
`d2/l3-frames.jsonl`; `tools/frameprobe.mjs` prints each distinct frame and how many snapshots held it):
- **L40**: `rung:avoid` → `pull` → `time` → `bait` with the danger `{puncher@128,624, t539, forecast, [10,39]}` and no
  target. Then `rung:kill` with target `puncher@128,624` for 254 snapshots (the stance scan). Then `arm:chaser` with
  stance `[8,38]` for 47. 313 of 372 snapshots carry a frame.
- **L18**: `verb:kill` on `lock@144,112` (3 snapshots). Then `arm:press` on `spinner@48,96` at `[3,3]` → `[5,6]` →
  `[6,3]`, and on `spinner@112,48` at `[6,5]` → `[7,6]` → `[2,4]`, the same in each of the three passes. 1,433 of 1,482
  carry a frame.
- **L6**: two climbs on `sandtrap@64,16` (`volume`, at ticks 20 and 72). The first one's BAIT has `bob@112,48` at
  `[3,1]`.

**For js-7 (the view; no JS-arc file touched).** `frame` is read by name, and a `v: 2` view that does not know it loses
nothing.
- Draw, on the tile map, while `frame !== null`:
  - the **stance** tile (`frame.stance`);
  - the **danger** tile (`frame.danger.at`), labelled with its source id and a glyph per kind: forecast, volume or
    phase;
  - the **target**, at the tile of the position in its id (`tag@x,y` → `floor(x/16), floor(y/16)`). That is the body's
    census placement, not its live position, which the snapshot does not carry. A rope or lock id names an obstacle
    the same way, and a `tile:`/`pit:` id is already a tile.
- Highlight the tree row whose key is `frame.key`. Clear every mark when `frame` is `null`.
- The cells are in the run's current level. Draw them only when `tiles.level === segment.level`, because a crossing
  can leave the map one level behind.
- ⚠ A naming note: `SolveProgressView`'s constructor already takes an option named `frame` (the render scheduler,
  `seedlingSolveProgressView.test.js:127`). It does not collide with the snapshot field, but a reader of the view's code
  could confuse the two.

**For fidelity:** nothing is owed. `dangerKindOf` reads `phase` / `axe` / `kind` off the source, and the gate row reads
the kinds out of `dangerMap.js`, so a new source kind there goes red until it is classed.

## D3 — measure (PASS)

L18 and L40, base (the main tree at `b3adfad282`) vs TC2 (the dev worktree), each unhooked and under the real tap at
100 ms, 3 interleaved rounds (`tools/d3-tc2.sh`, `d3/rounds.jsonl`; load 0.65–1.21):

| solve · tree · hook | wall (3 rounds) | median | digest | `shouldStop` | final bytes / segment | mean / max posted bytes |
|---|---|---|---|---|---|---|
| L18 · base · none | 3.89 / 4.08 / 3.86 | 3.89 s | `230dc0ff` | 165 | — | — |
| L18 · tc2 · none | 4.08 / 3.96 / 3.78 | 3.96 s | `230dc0ff` | 165 | — | — |
| L18 · base · 100 ms | 4.17 / 4.28 / 4.00 | 4.17 s | `230dc0ff` | 165 | 2,893 · 2,965 · 2,444 | 2,775–2,803 / 3,555–3,558 |
| L18 · tc2 · 100 ms | 4.55 / 4.03 / 4.22 | 4.22 s | `230dc0ff` | 165 | **2,906 · 2,978 · 2,457** | 2,855–2,893 / 3,566–3,570 |
| L40 · base · none | 5.25 / 4.76 / 4.74 | 4.76 s | `3addc379` | 167 | — | — |
| L40 · tc2 · none | 5.38 / 5.76 / 4.57 | 5.38 s | `3addc379` | 167 | — | — |
| L40 · base · 100 ms | 5.39 / 5.02 / 5.46 | 5.39 s | `3addc379` | 167 | 3,683 | 3,452–3,481 / 4,704–4,707 |
| L40 · tc2 · 100 ms | 5.14 / 5.36 / 4.46 | 5.14 s | `3addc379` | 167 | **3,696** | 3,606–3,734 / 4,707–4,718 |

- The digest and `shouldStop` are identical in all 24 runs.
- No wall difference is resolvable. The medians move −0.25 to +0.6 s, inside the round-to-round spread (about ±0.5 s),
  and unhooked the two trees run the same code but for six null checks.
- Each final snapshot grows exactly 13 bytes (`"frame":null,`). A posted snapshot grows +80 to +112 bytes on average
  on L18 and +154 to +253 on L40 (a non-null frame is ~150–200 bytes). The largest posted snapshot grows by at most 14
  bytes. 34–40 of the tap's 40–46 posts carry a frame.

## D4 — records (PASS)

| row | result |
|---|---|
| bot log | `seedling-bot-log.md`: `### Seedling hammer-phase TC2 — the active frame (solve-progress)` |
| schema doc | `seedling-solve-progress.md`: §2's block (`frame`), the paragraph, a new `### frame` section (fields, the frames-and-values table, the reset rule); §3's note that the six setter lines are not count points; §5 "v2 additions (TC2)", one row per field; §6 the TC2 pins |
| surface / constants | `--check` GREEN 312 rows · 6,002 literals, 0 drift, at D2 and again in D4's battery. Nothing to `--write`: the import gained a name, and no export or literal moved |
| reference | regenerated (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`: the two docs' counts), then `--check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH; `generate-docs-index.mjs`: current (176 docs), no diff |
| identity block AFTER | `d4/identity-d4.txt`, run at `3ea1cf43` (D2's code + D4's records): **byte-equal to W0**, every row; the six `--check`s exit 0 with the same md5s; reference MATCH |
| tapeRunner pairs AFTER | **617 `8f27f975`**, 0 non-pass (= W0) |
| censuses AFTER | GREEN 312 · 6,002 · 566 · 138 · 280 (= W0) |
| bounded vitest AFTER | the W0 set (`d4/vitest-files-d4.txt`): **893 / 893** (= 883 + TC2's ten; `solveProgress.test.js` 43 tests) |
| not run (⚖ 52, the brief) | no unfiltered vitest, no `pytest`, no `standing-values --write`. The CI vitest suite at the pushed SHA and the in-app `seedling-js-runtime-solve-progress-view` row are the harvest's |

## What the brief got wrong (measured)

1. **"The target body id".** A frontier verb's target is an obstacle (L18: `lock@144,112`, a `solid` kill lock), and
   PULL's is a rope. The field is `target`, the trace's own word (`strategy.target`), and it holds a body where the
   frame is a body's (the kill rung's arms, BAIT, the press arm's strikes).
2. **`danger: {source, tick, kind}`.** That shape cannot be "placed on the tile map". A source id gives only the
   body's census placement, not where the corridor met it, so the summary adds `at` (the sample's tile). It is still
   one source, never the list.
3. **"The walk's danger probe" as a frame's value.** The walk owns the probe, but on a hit it opens a climb and hands
   the hit to it. The danger is the climb's, and a walk frame carries nothing.
4. **"`frame` … for the active node".** The deepest active node (a stance walk, a search leaf) usually has no detail.
   The frame that does is an ancestor on the active path: the climb whose kill rung launched that walk. So `frame` is
   the innermost open frame **with detail**, and its `key` names that frame's active node.
5. **The vitest set's path.** The brief pointed at `seedling-hammer-refusal-kinds-evidence/d4/vitest-files-d4.txt`,
   which is RK's directory, not RK2's. The two files are identical (30 files), so this changed nothing.
6. **The identity block.** ENEMY is `f0bec576` at this base, not RK2's `36b59445`: the BeamTower trio flip
   (`68b81a1a`) banked it. AFTER equals it.
7. **The branch.** The brief's `seedling-hammer-active-frame`; the harness designates
   `claude/seedling-active-frame-5xj4l8`.

## Residue

1. **The frontier kill's chaser arm** (`execKill`'s `arm:chaser` → `execKillByChaser`) gets only the verb's detail
   (obstacle, resolved stance). Its own per-body stance, if it differs, is inside `execKillByChaser` and is not
   surfaced. No committed solve takes that path, and one more guarded line would cover it.
2. **BAIT's target before its row.** BAIT's body is known before `deriveBaitStance` runs, but it reaches the frame only
   with the row (3 snapshots without it on L6). The chaser arm got its pre-row line because it spends 254 snapshots in
   its scan; BAIT's derivation is short.
3. **The climb's danger is the hit that opened it.** AVOID's re-planned corridor that "STILL probes dangerous" has its
   own `still` hit, and it is not shown (that sentence is in `lastWhy`). A walk whose hit the dash rescues
   (`corridorDashRescue`) opens no climb, so it has no frame.
4. **`phase` has no committed-solve row.** L40 is `forecast` and L6 is `volume`. `phase` (a chain, beam or axe) is
   pinned on the source's fields only. A committed solve that climbs on a LavaChain, BeamTower or SpinningAxe would be
   its first real row.
5. **At harvest, not run here:** the CI vitest suite at the pushed SHA (⚖ 52), and the view half with its in-app row
   (js-7's).
6. **Scratch worktree.** `/home/user/af-wt` (branch `af-dev`) was created for development and D3's `tc2` arm. It is
   removed at the end, by name.
