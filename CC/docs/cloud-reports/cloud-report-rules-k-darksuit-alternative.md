# cloud-report — rules-k-darksuit-alternative (REPORT ONLY): can K's charge take a Dark Suit alternative, derived generally from the game?

Branch `claude/rules-k-dark-suit-alt-ler7mr`, from `origin/main` @ **`f96d6b66254cd8c2dd08323a489d5d1f07525600`** (it carries rule K + (b), `3c602f965d`).
- `session_bootstrap.sh --seedling`: READY. The six submodules are initialised; no pointer moved.
- Host settings: `minimal-spoilers`. Dev server: `serve-nocache.py 8000`.
- Game runs: wasm `seedling_bot_ap_p4g`, headless logic-only (asserted), the DELIVERED set `seedling-vanilla-record-23510f80`, one fresh page per tape.

**Scope.** No rule, preset, atlas, table, solver, `levelRun`, `CONTACT_FIDELITY`, level-data or engine-closure file changed.
- Every sketch was a throwaway patch (`…-evidence/sketch.patch`, selected by `K_SUIT_ALT`). It was applied, the producers were run, then `git checkout`.
- `git status` was clean after each run. The derived-rule table was moved aside for every run, the base included (the narrowing slice's recipe: a K re-cut renames sub-regions the table names).
- So every route diff here is **composed AP_1 vs composed AP_1**.

Evidence: `CC/docs/cloud-reports/rules-k-darksuit-alternative-evidence/`.

## Answer

**Does a general Suit alternative exist that frees only GAME YES rows? NO, not from the class constants, the ports, the grid and the bodies. It exists ONLY WITH a missing model: a goal-aware pursuit race. That race needs the player's heading-dependent speed and the swim boost, the body woken by its current-position leash and active only on screen, bodies as each other's solids, and contact decided at the 1–2 px margin. The repo has no such model.**

| candidate (all general: no level literal, no row list, no typed speed; each only REMOVES K cells) | routes moved (AP_1 = ER = maze) | GAME YES it frees ✔ | GAME NO it frees ✘ | verdict |
|---|---|---|---|---|
| **S1**: a K cut cell on a SWIM tile (the Suit's lava) charges no arm where the body does not out-swim the player's **best heading** there (the port's diagonal swim speed, 0.940 > runner 0.75) | 14 | L72 Suit ×2; L75 Suit ×2 (new witnesses) | **L73 L72↔L74 Suit ×2, L78 L77↔L79 Suit ×2, L80 chest from L71**; and L77 L78→L76 (attempts, new) | **FAILED** |
| **S1all**: S1's test on every tile type (best heading on floor too: 1.696 > 1.25) | 16 | as S1 | as S1, **plus L72 L71→L73 item-less (GAME NO, t35)**, L74 L73→L75 item-less (attempt t81), L80 from L79 and L79→L71 | **FAILED** |
| **S2**: S1 restricted to OPEN lava: the cut cell and all 8 neighbours are swim tiles, so every heading is free | **7** | **L72 L71→L73, L73→L71 (Suit); L75 L71→L74, L74→L71 (Suit, new)** | **L80 chest from L71** (attempt t67 + model no route); **L77 L78→L76** (attempts t7–37, new; model no route) | **FAILED** (2 rows; L77 L76→L78 pending) |
| **S2R**: S2 ∧ the narrowing slice's race with arrivals (ported: `tools/kNarrow.mjs`), at cell level | 0 | none: the race loses every cell S2 frees (it walks the Suit holder at the axis swim 0.45) | none | correct but useless: it keeps L72's over-charge |
| the narrowing slice's (b)+(c)+race+arrivals (quoted, `b48f397863`) | 13 | L72 Suit ×2 | L73 Suit ×2, L80 L79→L71 | FAILED (prior slice) |

**The closest candidate is S2.** It moves 7 routes, all inside L72, L75, L77 and L80:
- 4 are correct, and all 4 are now witnessed GAME YES: L72 Suit ×2 (reused), L75 Suit ×2 (new here);
- 1 is pending: L77 L76→L78 belongs to `rules-l77-suit-alone-witness`, and no branch exists yet;
- 2 are NO-class: L80 chest from L71, and L77 L78→L76 (new attempts).

S2 fails for one reason (§ Why S2 fails). It prices FLIGHT: a Suit holder in open lava outruns a lavarunner. It cannot price PASSING: on the L80 row the goal sits beyond the runner's own 1-wide column, and on the L77 row the landing is inside two leashes.

## 1. Mechanisms, from source (`vendor/seedling/src`)

| effect | source | bears on a lavarunner encounter? |
|---|---|---|
| **Lava immunity**: the drown/hit tick fires only `eff == 17 && !hasDarkSuit` | `Player.as:1460` (→ `hit(null,0,null,0)` at `:1464-1466`) | **YES**: the only Suit effect a route can use. It opens the lava seas these levels are made of (`runs/k-levels-main.txt`: L72, L74, L75, L77, L78, L80 are mostly lava) |
| **Retaliation**: `e.hit(darkSuitForce, …, darkSuitDamage, "Suit")` | `Player.as:1384-1386` | **RULED OUT.** It fires only inside `hit()` on a hit the player TAKES (no tanking, ⚖ Robert). Also `KILL_ARM_EXCLUDED.hasDarkSuit` |
| A LavaTrap reel is survived (`attached.onGround = true; attached = null; wait = true` instead of `die()`) | `Enemies/LavaTrap.as:64-68` | Not a runner term (rule T's) |
| Sprite and night layer | `Player.as:606-614`, `:1206-1219` | render only |
| **No enemy reads the suit.** `grep -rn "hasDarkSuit" Enemies/` hits only `LavaTrap.as:64` | — | A Suit holder can play any item-less line unchanged (used for L75 L74→L71, § 3) |

**What the Suit's lava does to the race** (all MEASURED off the repo's ports, `tools/swimPort.mjs` → `runs/swim-port.txt`):

| mover | axis px/tick | best heading (diagonal) px/tick | source |
|---|---|---|---|
| player, walk | 1.1746 | **1.6963** | `Player.as:1525-1553` adds `accel` on EACH axis while that axis is under `moveSpeed`. `Mobile.as:73-84` shortens the VECTOR by `f`. So the diagonal is faster |
| player, lava (Suit) | 0.4500 | **0.9404** (0.9491 over 1200 t) | `Player.as:544-548` `moveSpeeds[17]` 0.45 + `WATER_FRICTION` 0.5 |
| player, lava, with the swim boost | 0.5171 | 1.0253 | `Player.as:548` `+ 0.25 * int(Music.soundPosition("Swim") < 0.1)`: 6 of 47 frames (`Music.as:540`). `playerPhysicsV1.step` does not model it; K's measure omits it (the strict side) |
| lavarunner | walk 1.25, swim 0.75 | the same (isotropic) | `Bob.as:61-68` (`v.normalize(moveSpeed)`), `LavaRunner.as:17-18, 84-94, 106-119` |

**The game agrees** (`tools/speeds.mjs` → `runs/game-speeds.txt`, mean px/tick over consecutive same-terrain ticks):
- L72 Suit YES runs: the player swims 0.874–0.883 and the runner 0.656–0.783. On floor the player runs 1.44–1.45 and the runner 1.22–1.23.
- In those runs the runner trails at 10–30 px for hundreds of ticks without closing (`tools/trace.mjs`; closest 10.13 px at t52).
- K's (b) compares AXIS speeds ("the player walking AWAY along an axis"). That is the strict side: a fleeing player on an open diagonal outruns the runner on BOTH terrains. **Speed alone cannot be the Suit term.** S1all shows it: the same best-heading test on floor frees L72 item-less, a GAME NO.

**Other source terms that decide a lavarunner encounter.** None of them is Suit-specific, and none is in K's grid:
- `Bob.as:58`: `FP.distance(x, y, player…) <= runRange` is measured from the body's CURRENT position, not its spawn. A woken body that is not outrun never drops the player. K's zone is drawn from the spawn.
- `Enemy.as:64-66`: `if (!activeOffScreen && !onScreen()) return;` a body off the camera does not move.
- `Bob.as:39`, `LavaRunner.as:43` `solids.push(… "Enemy")`, swept by `Mobile.as:86-118`: bodies block each other (L75's jam, Q4).
- `LavaRunner.as:38` `dieInLava = false`; `:84-94` swim on state 1 and 17. The runner follows the player into lava and water: **no Suit-only lava detour exists that a runner cannot follow.** Any detour helps only by heading and geometry, never by terrain.
- The lava flood: the runner's flood (`FCG.bodyRegion`) already includes lava, so K's zones already cover the Suit holder's lava. Using "the cells a Suit holder can use" for K's cut changes nothing: K's player cells are every non-`BLOCKING` cell, lava included.

## 2. The sketch

All four candidates are filters that only REMOVE a K charge, as (b) does. They are written as functions of the ports, the class constants, the tile types and the grid (`sketch.patch`, in `seedlingChaserPursuitGuard.js`, throwaway):
- `measurePlayerHeading(terrain, keys)`: `playerPhysicsV1.step` on an open plane, Euclidean px/tick. `playerBestSpeedOn(t)` = max(axis, diagonal).
- **S1**: for each guarding body, drop a cut cell `i` with `tileTypes(i) ∈ SWIM_TILES` and `bodySpeedOn(tag, t) <= playerBestSpeedOn(t)`. The cell keeps its own terrain cost (the lava's `Dark Suit`), so a route through it costs the Suit alone.
- **S1all**: the same test on every tile type.
- **S2**: S1, and the cell and its 8 neighbours are all swim tiles (in the grid, not `BLOCKING`): the best heading is available in every direction.
- **S2R**: S2, and the narrowing slice's race does not lose the cell. That is the straight crossings, plus the walks in from every landing and door (`kNarrow.narrowBody`, ported onto main's `chaserGuardCells`).

None needs a level literal, a row list or a typed speed. **None passes** (Answer table).

### Why S2 fails (the two NO-class rows it frees)

- **L80 chest from L71** (`runs/k-levels-main.txt`, L80):
  - S2 frees (1,4), (2,4), (5,4) and (1,5). They are open-lava cells on the NORTH edge of `lavarunner@0,96`'s and `lavarunner@80,32`'s zones.
  - The chest pocket (c0 r6–r9, c1 r8–r9) opens only through the 1-wide lava column c0. `lavarunner@0,96` SPAWNS at (0,6), in that column.
  - K charges the pocket only at the zone boundary, so freeing the boundary frees the chest.
  - Fleeing through open lava is real, but reaching the chest means swimming TOWARD a woken runner into a 1-wide channel.
  - Game: `l80chest-suit-from71-a` is hit at **t67** by `lavarunner@0,96` (`rules-l77-trap-chase-witness`), and the model found no route (21,537 nodes). My beam with `--lava` (lava scored as walkable, width 96, seg 4, depth 250): **NO MODEL ROUTE**, 211,167 nodes. Its best hit-free line gets within 5 tiles at t120: it had drawn both runners east into open lava and could not get back to c0 first.
- **L77 L78→L76** (new, § 3):
  - The landing (6,18) is inside both runners' leashes. Every heading that stays in L77 is hit at **t7–37**, Suit alone, and the model finds no route.
  - S2 frees L77's open-lava cut cells around the spawns (rows 13–18).
  - The arrival never gets the open water to flee in: the runners are on it from t0.

A correct Suit term would have to tell "the runner is behind me in open lava" (L72, L75: YES) from "the runner is between me and the goal" or "the runner is on me at the landing" (L73, L77, L78, L80: NO). That is an interception race. The narrowing slice built one (`kNarrow`). Here it is either too lenient (it freed L73 and L80 L79→L71) or, intersected with S2, too strict (S2R frees nothing). Its contact calls miss the game by 2–4 px (`b48f397863` § Model check). **The missing model: a pursuit race validated against the game at the contact margin.** It needs:
- the player's heading-dependent speeds, and the swim boost;
- the current-position leash (`Bob.as:58`) and the on-screen gate (`Enemy.as:64`);
- body-body solids in `World.as` update order;
- the player's search over lines, since the question is existential.

The repo has the engine for that (`levelRun`, the beam tools), but only as a per-row search, which is a witness, not a general term.

## 3. Per row: the sketches' verdicts vs the game

Today's rule = main @ f96d6b6625 (rule K + (b)), composed. "arm" = `Or(Progressive Sword, Ghost Spear, Wand, Progressive Shield ×2)` (`KILL_ARM_CONDITION`).

**Main's rule on every row below is the arm alone or `Dark Suit & arm`, plus a level's own extra items** (for example `| Ghost Spear` or `| Sword`).

| row | today | S1 | S2 | GAME verdict + witness | S2 loosens? | S2 correct? |
|---|---|---|---|---|---|---|
| L72 L71→L73, Suit | arm (Suit no help) | + `Dark Suit` | + `Dark Suit` | **GAME YES**: `beam/L72-71to73-suit`, t376, 0 hits (reused, `rules-k-chaser-narrowing`) | yes | ✔ |
| L72 L73→L71, Suit | arm | + `Dark Suit` | + `Dark Suit` | **GAME YES**: `beam/L72-73to71-suit`, t376, 0 hits (reused) | yes | ✔ |
| L72 L71→L73, item-less | arm | arm | arm | GAME NO, t35 (reused). S1all frees it: ✘ | no | ✔ |
| **L75 L74→L71, Suit** | arm | + `Dark Suit` | + `Dark Suit` | **GAME YES (new)**: `L75-74to71-suit-replay`, left→L71 at **t216**, 0 hits. The item-less YES tape `movers/L75-74to71` with only `hasDarkSuit` set; no enemy reads the suit | yes | ✔ |
| L75 L74→L71, item-less | arm | arm | arm | GAME YES, t216 (reused): **kept over-charge**; no Suit term reaches it (Q4) | no | — (over-charge kept) |
| **L75 L71→L74, Suit** | arm | + `Dark Suit` | + `Dark Suit` | **GAME YES (new)**: `L75-71to74-suit` (beam: model route 192 t, 18,911 nodes), left→L74 at **t192**, 0 hits. Closest runner 11.25 px (t149). It dips through lava (3–4,9) at t64, where the item-less attempt met the grenade blast | yes | ✔ |
| L77 L76→L78, Suit | `DS & arm \| Spear` | `DS \| Spear` | `DS \| Spear` | **pending `rules-l77-suit-alone-witness`**: `git branch -r` shows no `claude/*l77-suit-alone*` branch. Not witnessed here (⛔ brief) | yes | pending |
| **L77 L78→L76, Suit** | `DS & arm \| Spear` | `DS \| Spear` | `DS \| Spear` | **NO-class (new attempts)**: 9 headings from the landing (96,288), Suit alone: up t15, up-left t7, up-right t14, left t34, right t37, idle t37 hit; down ×3 walk back to L78 at t6. Beam: **NO MODEL ROUTE** (57,303 nodes, best hit-free 16 t). Item-less: GAME NO, t15–37 (reused) | yes | **✘** |
| L73 L72→L74, L74→L72, Suit | `DS&Sh×2 \| DS&Wand \| Spear \| Sword` | `DS \| Spear \| Sword` ✘ | unchanged | GAME NO (attempts: first hit t117 for 72→74 and t39 for 74→72 on the run files' hit clock; the brief quotes t43 / t117; `movers-attempt/L73-*-suit-push`). The runner spawns 1 tile beside the Suit's lava column c0–1 and intercepts from the side | no | ✔ |
| L74 L73→L75, L73→Darkshield, L75→L73 | arm | + `Dark Suit` | unchanged | item-less GAME NO (attempt t81, reused); **Suit alone UNWITNESSED** | no | ✔ (S1: unknown) |
| L78 L77→L79, L79→L77, Suit | `DS & arm \| Spear` | `DS \| Spear` ✘ | unchanged | GAME NO (attempts t212 / t57, reused) | no | ✔ |
| **L80 chest from L71, Suit** | `DS & arm` | `DS` ✘ | `DS` ✘ | GAME NO (attempt `l80chest-suit-from71-a`, t67; model no route 21,537 nodes; mine with `--lava`: no route, 211,167 nodes) | yes | **✘** |
| L80 chest from L79, L79→L71, Suit | `DS & arm` | unchanged | unchanged | GAME NO (attempts; L79→L71 t153, reused). S1all frees both: ✘ | no | ✔ |
| L78 r0c16 → r6c11 (internal) | `[Spear] [Sword] [Wand] [Shield×2]` | unchanged | unchanged | pull: GAME YES on K's route (x ≥ 180, resume What 4); runner contact UNWITNESSED | no | ✔ (no move) |
| L78 r5c6 → r6c9 (internal) | `DS&Sh×2 \| DS&Sword \| DS&Wand \| Spear` | unchanged | unchanged | UNWITNESSED (resume FINDING 3). ⚠ Measured on MAIN's disc, as briefed: the designer's pixel-level pull disc (`origin/tile-pixel-pull-disc-choice`, not read, not used) may supersede this verdict. No sketch moves it | no | ✔ (no move) |
| L99 (3 runners) | — | no route moves | no route moves | — | no | ✔ |

- **Presets.** `runs/<variant>/route-diff-{seedling_playthrough,seedling_er,seedling_playthrough_maze}.txt`: the three are **identical** for every variant.
- **Levels.** Every moved route is in L72–L80; no route outside the K levels moves.
- **Internal rows.** L78's two internal rows: `runs/l78-internal-rows.txt` (`tools/subReach.py` on each variant's atlas).

## 4. L75 L74→L71 item-less (pointer only)

No Suit term can reach it: it is GAME YES with no item. The term that would is **the jam: two runners blocking each other.**
- **Source.** `Bob.as:39` / `LavaRunner.as:43` `solids.push("Enemy")`, swept by `Mobile.as:86-118` `moveX`/`moveY`, stepped in `World.as` update order.
- **What happened in the game.** `lavarunner@8,112` stalls against `lavarunner@104,64`'s box at x = 48.4 (`b48f397863` § Why L75 cannot be separated from L77).
- **The model.** It needs a joint body step in FlashPunk's order, validated to about 1 px; the narrowing's joint step drifts 2–4 px.
- **A second pointer, not Suit-specific.** (b)'s axis-only player speed is strict against the game's diagonal flight (§ 1), and both L75 YES runs show the runners trailing at 13–15 px. A heading-aware (b) is a K-wide question, not this slice's.

## 5. Witness needs

For S2, the only candidate close enough to matter:

| row | status | what a witness must show |
|---|---|---|
| L77 L76→L78, Suit alone | **pending `rules-l77-suit-alone-witness`** (no branch yet) | Dark Suit alone, a line from L76's landing to the L78 door, 0 hits, a fresh page per tape. T's trap (6,12) must be survived by the suit's reel (`LavaTrap.as:64-68`) AND the runners outpaced |
| L80 chest from L71, Suit alone | NO-class (attempt + model searches) | S2 is rescued only if this is a **GAME YES**. A line must lure both `lavarunner@0,96` (spawn in the 1-wide column c0) and `@80,32` out of the column through open lava, then reach the chest at (16,128) first, with 0 hits. A NO needs every reasonable line NO: the attempts and two beams (21,537 nodes without `--lava`; mine with `--lava`: 211,167 nodes, best 5 tiles short at t120) are the evidence so far |
| L77 L78→L76, Suit alone | NO-class (new: 9 attempts + 57,303-node beam) | S2 is rescued only if a hit-free line exists from the landing inside two leashes. The model's best survives 16 t |
| L74 L73→L75, Darkshield, L75→L73, Suit alone | UNWITNESSED | Only S1 moves them (S1 has failed anyway). Dark Suit alone, 0 hits |

**L72 ×2 and L75 ×2 Suit are witnessed YES** (above). No follow-up is proposed: no candidate passes.

## Runs index (`rules-k-darksuit-alternative-evidence/`)

| path | what |
|---|---|
| `sketch.patch` | the throwaway patch (S1 / S1all / S2 / S2R by `K_SUIT_ALT`); applied, measured, reverted |
| `tools/sketchRun.sh` | the producer chain (rules, partition, maze, ER) with the table aside; copies the outputs, restores the tree |
| `tools/routeWalk.py` | the walker (from `rules-k-pursuit-resume-evidence`) → `runs/<variant>/route-diff-*.txt` |
| `tools/subReach.py` → `runs/l78-internal-rows.txt` | an atlas's minimal sets for one level's internal row |
| `tools/levelDump.mjs` → `runs/k-levels-main.txt` | the K levels: terrain, spawns, zones, cuts (main) |
| `tools/swimPort.mjs` → `runs/swim-port.txt` | the port speeds (axis, diagonal, swim boost) |
| `tools/speeds.mjs` → `runs/game-speeds.txt`; `tools/trace.mjs` | per-terrain speeds and per-tick traces off the game runs |
| `tools/kNarrow.mjs` | the narrowing slice's race, ported onto main (S2R) |
| `tools/rows.mjs`, `tools/runBeams.sh`, `tools/chase/` (from `rules-l77-trap-chase-witness`) → `runs/beam/`, `tapes/` | the beams |
| `runs/play.log`, `runs/play-l77.log`, `runs/game/*.game.json.gz`, `tapes/*.tape.json`, `tapes/l77-arrival/` | the game runs |
| `runs/<variant>/*.log`, `changed.txt` | the producer logs per variant (base = main's rule, table aside) |
