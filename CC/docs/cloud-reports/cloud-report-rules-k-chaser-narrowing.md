# cloud-report — rules-k-chaser-narrowing (REPORT ONLY): which chaser-guarded routes really cost a kill arm?

Branch `claude/rules-k-chaser-narrowing-5dn7vf`, from `origin/claude/rules-l77-trap-chase-witness-0zl1f6`.
`git rev-parse HEAD` at setup: `642a87f29c03e2b0248081fb4a4029d8fc6e141d` (this sits on the K/T slice `5e750c4465`).
- `session_bootstrap.sh --seedling` reached READY, with wasm `seedling_bot_ap_p4g`.
- The six submodules are initialised and no pointer moved.
- Dev server: `serve-nocache.py 8000`.
- Host settings: `minimal-spoilers` was set at the end. Nothing here ran `Generate.py`, so it changed no measurement.

**Scope.** No rule, preset, atlas, table, solver, `levelRun` or `CONTACT_FIDELITY` file changed. Every producer run was throwaway and reverted:
- `producer-hook.patch` applied for the run, then `git checkout`;
- `git status` was clean after each run.

Game runs play the DELIVERED set (`seedling-vanilla-record-23510f80`, `play.mjs --spot=delivered`), headless logic-only (asserted), on a fresh page per tape.

Evidence: `CC/docs/cloud-reports/rules-k-chaser-narrowing-evidence/`.

## Answer

**No combination of (b), (c) and the race charges every real fault without charging a GAME YES row.** The smallest near-misses:

| combination | real faults (L72 → L73, L77 runners) | GAME YES rows charged (wrong) | GAME-NO-from-attempts rows it frees | verdict |
|---|---|---|---|---|
| K as built | charged ✔ | L26 ×2, L28 ×2, L40 totem, L53 ×2, L75 L74→L71, L91 ×2, **L72 Dark Suit ×2** | none | 12 wrong |
| **(b) alone** | charged ✔ | **L75 L74→L71**; **L72 Dark Suit ×2** (new witness) | none | 3 wrong; the simplest |
| (c) alone | charged ✔ | L26 ×2, L28 ×2, L40 totem, L75, L91 ×2, L72 Dark Suit ×2 | L73 Dark Suit ×2 | worse than (b) |
| (b)+(c) | charged ✔ | L75 L74→L71, L72 Dark Suit ×2 | L73 Dark Suit ×2 | worse than (b) |
| (b)+(c)+race (the brief's: straight crossings, the body woken at leash entry) | **L77 LOST** ✘ (L78→L76 and L76→L78 go free) | none | L73 Dark Suit ×2, L80 L79→L71 | fails a real fault |
| (b)+(c)+race **with arrivals** (my extension, below) | charged ✔ | **L75 L74→L71 only** | L73 Dark Suit ×2, L80 L79→L71 | 1 wrong, but frees 3 attempt rows |
| (b)+race-with-arrivals, no (c) | charged ✔ | L75 L74→L71 only | as above | the same routes as the row above |

**What breaks every combination is L75 L74 → L71 against the L77 runners.** It is decided from the source and the replays (§ "Why L75 cannot be separated from L77"):
- **L75's GAME YES does not come from any per-body term.** On the game run's own trajectory, `lavarunner@8,112` alone makes contact at **t84** in the step model (9.2 px; game 10.2 px).
- What stopped it in the game was **the other runner**. `LavaRunner` `solids` hold `"Enemy"` (`Bob.as:39`, `LavaRunner.as:43`), and the game's runner@8,112 stalls at x = 48.4 against runner@104,64's box.
- That is a 1–2 px, timing-exact jam between two bodies. A joint step model, with bodies as each other's solids in FlashPunk's update order (`World.as:937-951`), drifts 2–4 px and misses it.
- L77 has the same class, the same speeds and the same arrival-inside-the-leash shape, and it is hit at t15–37.

So no general term derived from class constants and the grid separates the two rooms. The STOP condition holds: fitting L75 needs a per-level literal or a set/level-data change.

**Recommendation for Robert's ruling: wire (b) alone, and add a Dark-Suit alternative only where a witness shows it.**
- (b) is exact from the source, and the game run files confirm it (table 2).
- It never frees a witnessed fault or an attempt row.
- It is wrong in only two places: L75 L74 → L71 and L72's Dark Suit rows. Both over-charge, and both are now witnessed.
- Neither (c) nor the race is safe to wire. Their contact verdicts are strict at the margin and their motion is fragile (§ "Model check").

### 1. Term (b): pursuit speed, measured off the AS3 ports (not typed)

| mover | px/tick per axis | source |
|---|---|---|
| **player, walk** | **1.1746** (diagonal 1.1995 per axis) | `playerPhysicsV1.step`: `Player.as:73` dMS 0.8, `:1515-1555` input (adds `accel` while `v < moveSpeed`), `Mobile.as:73-84` friction 0.25. The saw-tooth averages 1.17, **not 0.8** |
| player, swim (lava/water, Dark Suit) | 0.45 | `Player.as:544-548` `moveSpeeds[17]` + `WATER_FRICTION` |
| lavarunner | walk **1.25**, swim 0.75 | `chasers.chaserStep`: `Bob.as:57-75`, `LavaRunner.as:17-18,84-93`, net of friction |
| puncher | **0.75** | `Puncher.as:18,62-73` (moveSpeed 1, net of friction) |
| drill (teleport-hop) | **1.0667** (16 px per **15**-tick cycle) | `drill.stepDrill` + `stepDrillGraphic`: `Drill.as:27-28,85-110`; the repo's `animTicks` at `FP_ELAPSED` 0.0333 |
| bob / bulb / bobsoldier, jellyfish / flyer | 0.25 / 0.40 / 0.55 / 0.69 | `chasers.chaserStep` |

- **The game run files agree.** Over 30-tick windows of the witness slice's runs:
  - player 1.16–1.24;
  - puncher 0.62–0.71;
  - drill 1.067;
  - runner faster than the player.
- ⚠ **The witness's two readings were both off.**
  - The player is not 0.8. dMS is the cap that `input()` adds up to, and friction applies before it.
  - The drill is not 0.59. The witness counted 27 ticks at 60 fps; the repo's validated port runs the anims at `FP_ELAPSED` 0.0333, which makes the cycle 15 ticks.
  - The conclusion still stands: the drill is slower than the player.
- **The (b) rule.** A body is charged iff, on some tile type of its own flood, its speed is greater than the player's on that tile.
  - Runners qualify on floor: 1.25 > 1.17.
  - Runners qualify in lava: 0.75 > 0.45.
  - Punchers and drills never qualify.
- **(b) drops every puncher and drill row.** That is L12, L26, L28, L40/L43, L53, L88 and L91.

### 2. The matrix (K-only, T off; composed AP_1 with the derived table hidden; `routeWalk.py` per-level DNF)

**How to read it.**
- "ch" means the route gains a charge it does not have at base.
- "free" means the variant leaves the route at its base rule.
- "ch+DS" means the route is charged, but `Dark Suit` alone is also enough (an alternative K/(b) do not offer).
- The race column is the straight race. Race+arr adds the arrival walks.

The full per-route table is `runs/matrix.md` (also `runs/matrix-compact.txt`). The diffs are `runs/route-diff-<variant>.txt`. Columns:
- `K`, `b`, `c`, `bc` and `bcr` are the brief's five;
- `bcR` is (b)+(c)+race-with-arrivals;
- `R`, `r` and `bR` are the race terms alone or with (b);
- a trailing `J` is joint stepping.

| row (state) | K | (b) | (c) | (b)+(c) | (b)+(c)+race | (b)+(c)+race+arr | witnessed |
|---|---|---|---|---|---|---|---|
| L26 L25→L27, L27→L25 (FREE) | ch | free | ch | free | free | free | **GAME YES** (witness `movers/L26-*`) |
| L28 L25→L26, L26→L25, and the rope flag (FREE) | ch | free | ch | free | free | free | **GAME YES** (`movers/L28-*`) |
| L40 L39→totem 160,640 (FREE) | ch | free | ch | free | free | free | **GAME YES** (reach, t492) |
| L40 L39→L43 stairs `#2`–`#12` (FREE) | ch | free | ch | free | free | free | UNWITNESSED through the cut |
| L53 L48↔L51 | ch | free | free | free | free | free | **GAME YES** both ways |
| L12 (130 bosslock fan-out routes) | ch | free | free | free | free | free | UNWITNESSED |
| **L72 L71→L73 (FREE)** | ch | ch | ch | ch | ch+DS | ch+DS | **GAME NO item-less** (real fault, t35) |
| L72 L73→L71 (FREE) | ch | ch | ch | ch | ch+DS | ch+DS | not witnessed item-less |
| **L72 L71→L73, Dark Suit alone** | arm needed | arm needed | arm needed | arm needed | **DS ok** | **DS ok** | **GAME YES** (new: `beam/L72-71to73-suit`, t376, 0 hits) |
| **L72 L73→L71, Dark Suit alone** | arm needed | arm needed | arm needed | arm needed | **DS ok** | **DS ok** | **GAME YES** (new: `beam/L72-73to71-suit`, t376, 0 hits) |
| L73 L72↔L74, Dark Suit | ch | ch | free | free | free | free | GAME NO (attempts: t43, t117) |
| L74 L73→L75, and the Darkshield (FREE) | ch | ch | ch+DS | ch+DS | ch+DS | ch | GAME NO (attempt t81) |
| L74 L75→L73 (FREE) | ch | ch | ch+DS | ch+DS | ch+DS | ch | UNWITNESSED (a bulb hits) |
| **L75 L74→L71 (FREE)** | ch | ch | ch+DS | ch+DS | **free** | ch | **GAME YES** (`movers/L75-74to71`, t216) |
| L75 L71→L74 (FREE) | ch | ch | ch+DS | ch+DS | free | ch | UNWITNESSED: the new attempt is hit by the **grenade blast** at t66 (22.5 px), not a K body |
| **L77 L78→L76 (FREE)** | ch | ch | ch+DS | ch+DS | **free** | ch | **GAME NO item-less** (real fault, t15–37) |
| L77 L76→L78 (FREE; T decides it with T on) | ch | ch | ch | ch | free | ch | (T's trap kills, t32) |
| L78 L77↔L79, Dark Suit | ch | ch | ch | ch | ch | ch | GAME NO (attempts t212, t57) |
| L80 chest from L71 / from L79 (Dark Suit) | ch | ch | ch | ch | ch | ch | GAME NO (attempts) |
| L80 L79→L71, Dark Suit | ch | ch | ch | ch | free | free | GAME NO (attempt t153) |
| L88 four door pairs (FREE) | ch | free | ch | free | free | free | GAME NO from open-loop attempts on 2 (drill t264, t137); 2 UNWITNESSED |
| L91 L89→L92 (FREE) | ch | free | ch | free | free | free | **GAME YES** |
| **L91 L92→L89 (Progressive Swim)** | ch | free | ch | free | free | free | **GAME YES** (new: `beam/L91-92to89-swim`, t281, 0 hits; stood on drill cut cells 7,6 / 7,5) |
| L99 (3 runners, 17 cut cells) | no route moves in any variant | | | | | | — |

**Notes on the matrix.**
- **K check.** My K variant reproduces the prior slice's `route-diff-Konly.txt` byte for byte (236 rows).
- **Route counts.**
  - K moves 236;
  - (b) 16, (c) 84, (b)+(c) 14;
  - (b)+(c)+race 9, (b)+(c)+race+arr 13;
  - race alone 91, race+arr alone 95.
- **Where (b)+(c) offers `Dark Suit` (ch+DS).** It drops lava cut cells that a runner "cannot reach" a standing player in. That matches the L72 Dark Suit witness, but not L73 (attempts).
- **Joint stepping (`J`).** It moves no row toward the witness. It frees L78's Dark Suit rows (attempts say NO), and under (b)+(c)+race it frees L77 → L79.

### 3. The witnesses run here (`runs/play-beam.log`, `runs/game/beam/`, `tapes/beam/`)

The tapes come from the witness slice's `beam.mjs`: the JS model only chooses keys (width 48, seg 4, depth 200, margin 2). The game decides.

| tape | state | game | K cut cells stood on (`cutcheck.py`) | decides |
|---|---|---|---|---|
| `L72-71to73-suit` | Dark Suit alone | **GAME YES**: out to L73 at **t376**, 0 hits, 0 restarts | runner@80,216 at t159 (7,9); runner@136,88 at t139 (7,10) | (b) and K over-charge L72's Dark Suit state |
| `L72-73to71-suit` | Dark Suit alone | **GAME YES**: out to L71 at **t376**, 0 hits, 0 restarts | runner@80,216 at t229 (1,10); runner@136,88 at t125 (3,6) | the same |
| `L91-92to89-swim` | `canSwim` (the base rule's Progressive Swim) | **GAME YES**: out to L89 at **t281**, 0 hits, 0 restarts | drill@64,80 at t111 (7,6) and t119 (7,5); the drill closest 7.4 px | K over-charges; every (b) variant is right |
| `L75-71to74` | item-less | hit at **t66** by the grenade's blast (22.5 px; `Grenade.as` radius 20). Runner@8,112 never nearer than 81.9 px | (3,12) t11, (4,11) t30, (5,10) t45 | **UNWITNESSED for K**: the model found no route (`runs/beam/L75-71to74.log`, best hit-free 14 tiles short) |

**Not closed** (each needs the grenade avoided, or a stronger search):
- L75 L71 → L74;
- L74 L75 → L73;
- L88's other two pairs;
- L40 L39 → L43 through the cut;
- L12.

All variants agree on L74 L75 → L73, so it does not decide between combinations.

## Why L75 cannot be separated from L77 (source and replays)

`tools/replayCheck.mjs` feeds a game run's per-tick player positions into the candidate step model (`kNarrow.chase`, the repo's own ports against the grid) and prints the model body beside the game's. Logs: `runs/replay/`.

**L75 L74→L71 (GAME YES), solo.**
- **runner@104,64** stays within **0.5–1.5 px** of the game body for 126 ticks. Then the game body stalls at (70.6, 133), where the model does not. Closest approach: game 13.3 px, model 13.3 px. No contact in either.
- **runner@8,112** follows the game body within 0.4–1 px until t78. At t84 the game body is at **x = 48.4 and stays there**; the model body walks on to x = 54.9 and **makes contact at t84** (9.2 px).
  - At t84 the game's runner@104,64 is at (60.8, 91.6), so its box spans x 54.8–66.8 and y 85.6–97.6.
  - One more pixel right puts runner@8,112's box (x ≤ 55.4, y 93.7–105.7) into it.
  - **The two runners jam.** `Bob.as:39` / `LavaRunner.as:43` `solids.push("Enemy")`, swept by `Mobile.as:86-118` `moveX`/`moveY`.

**L75, joint** (`K_NARROW_JOINT=1`: room-mates step with it, each a solid to the others, the last-added first per `World.as:937-951` `addUpdate` prepending).
- runner@104,64 drifts 2–4 px behind the game (y 87.7 vs 91.6 at t84). The jam does not form, and runner@8,112 still makes contact at t84.

**L77 L78→L76 (real fault).**
- The arrival race from the south landing (6,18) is caught at **t14–33** on every cut cell of both runners. The game is hit at t15–37.
- The straight race (the brief's) frees L77. Its player starts outside the leash on a line, but L77's landing is inside both leashes, so the body is awake from t0.

So the game's L75 YES is a two-body timing outcome. A term per body, or a coarse joint model, either charges L75 or frees L77.

## Model check of the step model (honest limits)

| run | what the model gets right | where it differs |
|---|---|---|
| L75 YES, runner@104,64 | motion within ~1.5 px for 126 t | — |
| L72 Dark Suit YES (both ways) | motion within ~2–3 px | it calls **contact** at t37 / t187 (8.9 / 8.6 px) where the game took 0 hits (closest 9.1 px) |
| L73 Dark Suit attempt (`movers-attempt/L73-74to72-suit-push`) | first 20 t exact | contact at t25 vs the game's first hit at t39 (the game's runner sits 3.5 px from a stationary player for ~15 t without a hit; not explained here) |
| L74 L73→L75 attempt | — | contact at t56 vs the game's t81 |
| L80 L79→L71 attempt | — | no contact (closest 10.6 px) vs the game's hit at t153 (9.1 px) |

**(c) and the race are strict at the contact margin and miss some hits.** Their per-cell verdicts are evidence, not a rule.

## The candidates as built (`tools/kNarrow.mjs`; pure functions over K's grid inputs)

**General shape.**
- Each candidate filters K's own cut (`AG.chaserGuardCells`) and only removes cells or bodies.
- Every constant comes from the ports (`playerPhysicsV1`, `chasers`, `drill`, `combat.ENEMY_CLASSES`). There is no level literal.

**(b)** is described in table 1.

**(c) step-rule follow.**
- The body steers at a player standing in the cut cell: 9 sample points, inset 3 px, with the player's box clear.
- The leash is off: (c) asks about walls and terrain, and the race owns the leash.
- Moves are axis-separated against the body's solids, which are walls, sinks, entity-gated cells and other static bodies; the static bodies are optional (`K_NARROW_STATICS`) and changed no row.
- The body dies on the tile under its centre if that tile is lethal to it.
- **Contact** depends on the class:
  - `Enemy.hitPlayer` box overlap for a chaser;
  - the drill's own contact for a drill;
  - for a puncher, the punch rect at `endAnim`, after `animTicks(4, 12)` of wind-up (`Puncher.as:111-117,127-143`). The puncher also has `"Player"` in its solids.

**Race (straight).**
- For each crossing axis of a cut cell, both ways, the player walks a straight line through the cell's centre.
- The body wakes when the player is within `runRange` of the spawn (`Bob.as:58`).
- It is lost on contact before the player is past the cell and out of `runRange` of the body. A line that stalls on a wall is recorded and not charged.

**Race with arrivals.** The same as the straight race, but the player walks the shortest cell path from each landing or door of the room (`exempt` minus trap tiles), through the cell to its outside neighbour, and on.

**The player's walkable cells.** In every race the player walks only cells whose conditions are a subset of the cut cell's own: the cheapest player who can stand there. The first build walked an item-less player through lava, and that was wrong.

## Wiring sketch (not applied): what moves under (b), and under (b)+(c)+race+arr

**How it was run.** `tools/sketchRun.sh` ran the recipe's producers on a throwaway tree, with the patch applied and `K_NARROW_NO_T=1`:
1. rules (atlas + AP_1);
2. partition;
3. maze;
4. `seedling_er`.

Then it copied the outputs out, ran `git checkout` and moved the table back. The base for every walk is the same pipeline with no K stamp (`K_NARROW=none`).

**⚠ The derived-rule table must be re-derived before K can land.** With the committed table, the producer refuses: `derived-rule table: level_72|level_72 -> level_71__r0c6 names no element of the compiled document`. Any K split renames sub-regions the table names. So these runs move the table aside.
- What they show is the composed AP_1.
- The shipped AP_1 needs the CI probe (`seedling-probe.yml`, `probe-seedling-derived-rules.mjs`) and the designer review if verdicts move.

| | (b) | (b)+(c)+race+arr |
|---|---|---|
| AP_1 `seedling_playthrough` | **16 routes** move (`runs/sketch-route-diff-b-seedling_playthrough.txt`, identical to the composed run). Key walk: 453 paths, in levels **71–78, 80, 98, 99** (`runs/keywalk-b-seedling_playthrough.txt`; L98/L99 are renames from L99's split) | 13 routes; the same levels |
| maze `seedling_playthrough_maze` | the same 16 routes; 962 paths in the same levels | 13 routes |
| `seedling_er` | the same 16 routes; **50 placements, 1 draw, 0 unbeatable**. The only placement change is a rename (`level_99__r2c7` → `level_99__r7c5`, placements 20/21), so it is **the same draw** | the same (the same rename) |
| seed 1 vanilla-placement spheres (`vanillaSpheres.py`) | **0 of 88 move** (last sphere 15 → 15) | 0 of 88 |
| ER draw's spheres | **0 of 88 move** (last sphere 13 → 13): **stays beatable** | 0 of 88 |
| seal check (every item, from Menu) | 88 / 88 | — |
| atlas | `seedling-817c842f → 69ec0fc5`; regions 1, 4, 5, 72–75, 77, 78, 80, 98 | `→ 32ab06bf` |

**What seed 1's sphere log would do.** On the composed rules it would not move: vanilla placement is 0/88. `Generate.py` was not run, because the committed table refuses this grid.

**The 16 routes (b) moves** are the L72, L73-Dark-Suit, L74, L75, L77, L78-Dark-Suit and L80 rows of the matrix.
- Two of them are wrong by the new witness: **L72's Dark Suit alternative**.
- One of them is wrong by the old witness: **L75 L74 → L71**.

## Runs index (`…-evidence/`)

| path | what |
|---|---|
| `producer-hook.patch` | the prior slice's wiring + `K_NARROW=<variant>` selecting `tools/kNarrow.mjs` (apply, measure, `git checkout`) |
| `tools/kNarrow.mjs` | the candidates; variants `K b c bc bcr r bcR bR R` (+ `K_NARROW_JOINT=1`, `K_NARROW_STATICS=1`, `K_NARROW_NO_T=1`) |
| `tools/narrowReport.mjs` → `runs/narrow-summary*.txt`, `runs/narrow-cells*.json.gz` | per body: speeds, each variant's cut, and every cell's (c) / race / arrival verdict |
| `tools/composedDump.mjs`, `routeWalk.py`, `matrix.py` → `runs/regions-*.json.gz`, `runs/route-diff-*.txt`, `runs/matrix*.{md,txt}` | the matrix |
| `tools/replayCheck.mjs` → `runs/replay/` | game trajectories through the step model |
| `tools/levelmap.mjs` | a level's grid with cut cells, (c) marks and a game path |
| `tools/rows.mjs`, `tools/runBeams.sh` → `runs/beam/`, `tapes/beam/`, `runs/play-beam.log`, `runs/game/beam/` | the new witnesses |
| `tools/sketchRun.sh`, `keywalk.py` → `runs/keywalk-*.txt`, `runs/sketch-route-diff-*.txt` | the wiring sketch |
