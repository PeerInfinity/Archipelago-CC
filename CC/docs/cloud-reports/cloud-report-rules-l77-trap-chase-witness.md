# cloud-report — rules-l77-trap-chase-witness (REPORT ONLY)

Branch `claude/rules-l77-trap-chase-witness-0zl1f6`, from `origin/claude/rules-chaser-arrival-killarm-9yxgyy`.
`git rev-parse HEAD` at setup: `5e750c4465a1aab58da2043f2e3c2d18edee599d`. `session_bootstrap.sh --seedling` reached READY (wasm `seedling_bot_ap_p4g`).
The six submodules are initialised and no pointer moved. Host settings: `minimal-spoilers`. Dev server: `serve-nocache.py 8000`.

**Scope.** This slice changes no rule, preset, atlas, table, level data, solver or `CONTACT_FIDELITY`. Every game run plays the DELIVERED set (`seedling-vanilla-record-23510f80`, `play.mjs --spot=delivered`) on a fresh page per tape, headless logic-only (asserted).

Evidence and tools are in `CC/docs/cloud-reports/rules-l77-trap-chase-witness-evidence/`. Run files are `runs/game/<dir>/<tape>.game.json.gz` (per-tick reads), and tapes are `tapes/<dir>/<tape>.tape.json`.

**Items.** Each tape grants one game flag, item-less otherwise:
- AP `Ghost Spear` is the game's `hasSpear` ("It hits harder and through walls", `dialogue.js:269`; `seedlingAtlasDerivation.js:86`).
- `Progressive Sword` ×1 is `hasSword`; ×2 (`hasDarkSword`, damage 2, same reach) was not played.
- `Wand` is `hasWand`, `Fire` is `hasFire`, and `Dark Suit` is `hasDarkSuit`.

**How to read the verdicts.**
- **GAME YES**: one witnessed tape with 0 hits and 0 restarts.
- **GAME NO**: names what hit and when, and how many attempts were made. Where the model found no route and only open-loop game attempts were made, the row says so: that is a NO from attempts, not a proof.
- **UNWITNESSED**: nothing decisive was played.

## Answer

### 1. The trap: is L77's lavatrap killable from outside its 32 px, and does that cross?

| direction | Ghost Spear | Wand | Progressive Sword | Fire |
|---|---|---|---|---|
| **forward L78 → L76** (south landing (96,288)) | **GAME YES**: `chain/l77-fwd-spear`, out at **t538**, 0 hits, 0 restarts. Trap dead at **t178**; the player was ≥ **34.00 px** from it until then | **GAME NO** (runners, not the trap): `wand/l77w-fwd-wand-{left,up}` hit at **t35 / t34** by the L77 lavarunners and knocked into the L78 door. The model finds no hit-free route past them (62,334 nodes, trap hidden from the model) | **GAME NO**: the slash cannot reach the trap from outside 32 px (source below). `spot/l77spot-{N,W}-sword` (4 swings each) leave it alive. The crossing then dies as the chase witness saw (tongued t52–57, dead t63) | **GAME NO**: Fire does not damage it (`hitByFire` false). `spot/l77spot-{N,W}-fire` leave it alive |
| **reverse L76 → L78** (north landing (16,32)) | **GAME YES**: `chain/l77-rev-spear`, out at **t530**, 0 hits, 0 restarts. Trap dead at **t332**, killed from the W spot | **GAME NO** (the bulb, not the trap): 3 open-loop attempts (`wand/l77w-rev-wand-bulb-{a,b,c}`) hit at **t103 / t102 / t172** with `bulb@80,72` alive. Model: no route past the bulb (48,762 nodes). An item-less model search finds no route past it either (32,229 nodes) | GAME NO (as above) | GAME NO (as above) |

- **The kill itself, booted at the spot** (`spot/`, 0 hits, 0 restarts each):
  - Spear from N (104,165.7), through the c6 r11 wall: trap gone at **t62**.
  - Spear from W (70.7,200): trap gone at **t62**.
  - Wand from W: trap gone at **t232**.
  - Wand from N: blocked by the c6 r11 wall, trap alive.
- **Vanilla order: death-free with the Ghost Spear.** Seed 1's sphere log puts L77 in reach at **sphere 11.7**. The player then holds:
  - **Ghost Spear** (since sphere 7.5);
  - Wand (10.1), Progressive Sword ×2, Progressive Shield ×2 and Fire;
  - but not the Dark Suit (12.2, at `Level 079 - Darksuit`).

  Vanilla's way to the Dark Suit is L76 → L77 → L78 → L79, and both trap rooms are witnessed with the Spear:
  - L77 reverse: `chain/l77-rev-spear`, GAME YES.
  - L78, L77 → L79: `l78/l78-fwd-spear`, **GAME YES**, out at **t897**, 0 hits, 0 restarts. It kills `lavatrap@144,96` at t216 and `lavatrap@96,80` at t627, from ≥ 36.21 / 33.55 px. The third trap, `lavatrap@144,48`, stays alive and is never nearer than 34.23 px. The Spear also clears the kill-lock: all 5 runners and the grenade.

  So `Or(Dark Suit, Ghost Spear)` in place of T's lone Dark Suit keeps the vanilla order hit-free and death-free at both rooms. The Wand does not do it alone (row above).
- **The general claim: no, L77 is not the only room.** `tools/necks.mjs` checks every T disc in `guards-tip.txt`: for each door/chest pair connected at base, does making the disc impassable disconnect it?
  - **L77** `lavatrap@96,192` alone seals L76 ↔ L78.
  - **L78** `lavatrap@96,80` (tile 6,5) alone seals **L77 ↔ L79**: L78's only neck, on the vanilla Dark Suit path. L78's other two discs (9,3 and 9,6) seal nothing alone.
  - L80 (2 discs) and L108 (3 discs) seal nothing.

  This matches the prior slice's T-only route diff: 4 moved routes, the L77 and L78 crossings both ways.

### 2. K's 12 unwitnessed movers (cheapest committed state, through the charged cut)

| row | state | verdict | evidence |
|---|---|---|---|
| L26 L25 → L27 (2 punchers) | FREE | **GAME YES** | `movers/L26-25to27`: t280, 0 hits. Stood on both bodies' cut cells (t104 4,6; t131 4,8; t228 4,15). Closest approach 11.1 / 12.7 px; both punchers alive at the end |
| L26 L27 → L25 | FREE | **GAME YES** | `movers/L26-27to25`: t284, 0 hits. Cut cells t34, t38, t136, t166. Closest 8.1 / 11.9 px |
| L28 L25 → L26 (2 drills) | FREE | **GAME YES** | `movers/L28-25to26`: t124, 0 hits. Cut cells of both drills (t23 6,3; t39–63 5,4/5,5; t98 2,6). Closest 7.2 px |
| L28 L26 → L25 | FREE | **GAME YES** | `movers/L28-26to25`: t136, 0 hits. Cut cells t9, t65, t93. Closest 7.4 / 9.5 px |
| L40 L39 → `Level 040 - Totem Part 160,640` (`puncher@128,624`) | FREE | **GAME YES (reach)** | `movers/L40-39toTotem160`: the player reaches the totem at **t492** with 0 hits, after standing on cut cell 12,42 at t457. The puncher was at 21 px and closing. ⚠ `inputVerdict` says `dies`: `dead_frames` jumps 20 → 170 at t492 with no reset to the boot, read as the pickup's freeze, not a death (the run ends at t500, so nothing after the pickup is witnessed) |
| L40 L39 → L43 stairs (exits `#2`–`#12`) | FREE | **GAME YES, but not through the cut** | `movers/L40-39to43`: out at **t419**, 0 hits. ⚠ The game route stood on **none** of either puncher's 5 cut cells, so it does not test K's cut. The logic route K moves must pass the cut where this walk did not; a region-graph question for the planner, not answered here |
| L53 L48 → L51 (`puncher@136,96`) | FREE | **GAME YES** | `movers/L53-48to51`: t219, 0 hits. Stood on 2 of its 5 cut cells (t100 5,2; t177 3,6). The puncher was **never nearer than 35.3 px** |
| L53 L51 → L48 | FREE | **GAME YES** | `movers/L53-51to48`: t229, 0 hits. Cut cells t37, t114. Never nearer than 39.5 px |
| L73 (Dark Suit only), L74 → L72 and L72 → L74 | Dark Suit | **GAME NO (attempts)** | Model: no route (42,336 / 42,588 nodes). A second, wider pass (width 96, seg 3) also found none in 25 min each (`*-wide.log`). Open-loop attempts hit at **t43** (`lavarunner@32,24`, 5.0 px) and **t117** (`lavarunner`, 10.3 px), both K bodies |
| L74 L73 → L75 (2 runners) | FREE | **GAME NO (attempt)** | Model: no route (5,004 nodes). The attempt is hit at **t81** by `lavarunner@208,96` (1.1 px), a K body |
| L74 L75 → L73 | FREE | **UNWITNESSED for K** | Model: no route (6,354). The attempt is hit at **t22** by `bulb@48,112`, which is not a K body |
| L75 L74 → L71 (2 runners) | FREE | **GAME YES** | `movers/L75-74to71`: t216, 0 hits. Stood on 6 + 2 cut cells (t9–187). Closest 10.2 / 13.3 px; both runners alive at the end |
| L75 L71 → L74 | FREE | **UNWITNESSED for K** | Model: no route (5,337). The attempt is hit at **t66**, nearest body `grenade@80,128` at 21 px (not a K body) |
| L78 (Dark Suit only), L77 → L79 | Dark Suit | **GAME NO (attempt)** | Model: no route (42,228). Hit at **t212** with two runners at 11.8 / 13.3 px |
| L78 L79 → L77 | Dark Suit | **GAME NO (attempt)** | Model: no route (5,355). Hit at **t57** by a runner (11.2 px) |
| L80 L79 → L71 (`lavarunner@120,208`'s cut) | Dark Suit | **GAME NO (attempt)** | Model: no route (42,606). Hit at **t153** by a runner (11.2 px) |
| L80 L71 → L79 (both doors) | Dark Suit | **GAME NO (attempts)** | Model: no route (7,866 / 8,019). Hit at **t162 / t163** by a runner (10.4 / 11.1 px) |
| L88 L12 → L87 and L87 → L12 (`drill@128,160`) | FREE | **GAME NO (attempts)** on 2 of 4; the other 2 UNWITNESSED | Model: no route on all four door pairs (41,184–42,498 nodes). Attempts toward L87 (east door) and toward L12 (from the east landing) are hit by the drill at **t264** (12.4 px) and **t137** (5.7 px). The other two pushes stall clear |
| L91 L89 → L92 (`drill@64,80`) | FREE | **GAME YES** | `movers/L91-89to92`: t240, 0 hits. Cut cells t24 1,6 and t120 7,5. Drill closest 7.9 px; three Bobs to 9.1–12.9 px |
| L91 L92 → L89 | FREE | **UNWITNESSED for K** | Model: no route (42,084). The attempt is hit at **t295** by a Bob (6.2 px), not a K body |
| L12 (`puncher@416,256`), via the bosslocks | Red Key (locks opened: tags 4 and 5 pre-cleared) | **UNWITNESSED** | Model: no route L33 → L37 / L37 → L33 (56,970 / 56,925 nodes). Open-loop pushes stall clear on walls and never stand on the 3 cut cells (c22–23 r12–13) |

**Summary.** K over-charges at least **L26, L28, L40 (the totem), L53, L75 (L74 → L71) and L91 (L89 → L92)**: the old FREE state is right there.
- Each of these GAME YES runs crosses the charged cut, item-less, with the K body alive and 0 hits.
- L40's run to the L43 stairs is hit-free but never stands on a cut cell, so it does not test K's cut.
- Only the first, narrow search pass (width 32) ran on every row. The wider pass ran on L73 only; it was stopped after that for time.
- The Dark Suit rows (L73, L78, L80) are GAME NO from attempts only, each hit by a K lavarunner. That agrees with K, but is not a proof.

### 3. The L80 chest, Dark Suit alone

| from | verdict | evidence |
|---|---|---|
| L71 (landing 32,16) | **GAME NO (attempt)** | Model: no route (21,537 nodes; best hit-free at (12,55), 6 tiles short). `l80/l80chest-suit-from71-a` is hit at **t67** by `lavarunner@0,96` |
| L79 (landing 40,288) | **GAME NO (attempts)** | Model: no route (170,730 nodes; best hit-free at (33.2,247.4), 20 tiles short). `l80chest-suit-from79-a` stalls clear 3 tiles below the chest, walled off. `-b` goes on and is hit at **t331** by `lavarunner@120,208` |

Why the game agrees:
- The chest pocket (c0 r6–r9 and c1 r8–r9) opens only through the 1-wide lava column c0.
- `lavarunner@0,96` sits in that neck, and in both runs two runners park at the pocket's foot, (13.5,153.6) and (25.7,153.9).
- In lava a runner swims at 1.0 px/tick (`LavaRunner.as:17,106-111`, `case 17: swim()`), faster than the player's 0.8 walk (`Player.as:73`).
- The Dark Suit damages a body only when the player takes the hit (`Player.as:1383-1386`), so it cannot clear a body hit-free.

## What decides the trap (source)

- **The tongue.**
  - It launches only when `int(distance) <= chompRange` (32), `!wait`, and the trap-to-player line is free of `Solid` (`LavaTrap.as:21,81-93`). `wait` starts true and clears only when the player is beyond 32 px (`:26,101-104`).
  - Once attached, the player is reeled in and `die()`s unless `Player.hasDarkSuit` (`:56-74`).
  - The hitbox is 10×10, centred: x 99..109, y 195..205 for L77's trap (`:30,43`).
- **What kills it.** `Enemy.hit` applies damage `d` until `hits >= hitsMax` (3), with 30 invulnerable ticks after each hit (`Enemy.as:20-25,141-170`). `hitByFire` is false by default, so Fire only knocks back (`:38,151`), and `LavaTrap.knockback` is empty (`:158`).
- **A dying trap cannot tongue.** `startDeath` plays `die` (`:119-122`), and `update` returns before any tongue code while it plays (`:51-54`). The trap is then removed (`:161-167`).
- **Ghost Spear.** A 32×5 rect from the player's centre, with no `Solid` test, damage 2 (`Player.as:144,960-990`, `spearX/Y` `:1341-1347`). From a cardinal spot it reaches the hitbox from [33, 37) px, which is outside the tongue.
  - L77 windows: N y ∈ (161, 167], W x ∈ (67, 71], S y ∈ [233, 235).
  - It hits through the c6 r11 wall (spot N).
- **Wand.** The shot spawns 16 px ahead (`Player.as:994-1002`), flies 3 tiles (`WandShot.as:24-29,64-65`) for damage 0.5 (6 hits), and stops at `Solid` and `Enemy` (`Mobile.as:17`, `WandShot.as:69`). So it reaches about 64 px along a clear cardinal line: W yes, N no (the wall).
- **Sword.** It lands only within `slashingSprite.width × scaleX` (16, or 24 for the narrow slash) of the hitbox rect, needs a free line (`Player.as:908-926,1259-1267`), and has a 30-tick timer. Its centre reach is therefore ≤ 29 px, inside the disc, and a kill needs 3 hits (2 for the Dark Sword) ≥ 30 ticks apart. The tongue kills in about 6 ticks (t26 → t32 in the chase witness).

**Two side notes from the runs.**
- `l77-rev-spear` came to **29.6 px** at t189 while the trap was alive. The c6 r11 wall blocks the trap's line there (`:88`), so it never launched; that cell (c6 r10) is correctly outside T's disc.
- The S spot (y 233–235) lies in T disc cell **6,14**: that cell's centre is at exactly 32 px, but a standing point 2 px further out is safe.
- Also: `dead_frames` rises by 20 at every level change, not only at a death (e.g. `chain/l77-fwd-spear` 20 → 40 at its L76 arrival, t538, with 0 restarts). The `restarts` column (`inputVerdict`) is the death signal used here.

### Option (a) as a general rule (sketch, not applied)

T's arm would be `Or(Dark Suit, Ghost Spear)` where the trap can be speared from outside the disc. The test, from the source:
- the trap has a **cardinal kill spot**: a standable floor point on one of its four axes at distance [33, 37) (spear rect 32 + hitbox half 5);
- that spot is reachable from the entry **without entering any live disc**, i.e. a cell within 32 px of a live trap with a `Solid`-free line.

Discs are killed in an order (L78: 9,6 first, then 6,5). The Wand qualifies only where the spot also has a `Solid`-free cardinal line of ≤ 64 px to the hitbox and the room's other bodies allow 6 shots 30 ticks apart. Witnessed here: L77 W (yes) and N (no, wall). Sword and Fire never qualify. There are no single-level literals: everything comes from `chompRange`, the hitboxes, `spearOffset` and the tile grid.

## K: what lets the player through, and narrowings (sketch, not applied)

Observed on the GAME YES rows:
- **Walls stop a straight-line pursuer (L53).** Punchers and Bobs (and runners, `LavaRunner extends Bob`) steer straight at the player: velocity along `atan2`, moved axis by axis against `solids` (`Puncher.as:62-73`, `Bob.as:58-69`, `Mobile.as:86-110`). There is no pathfinding. K's cut uses flood connectivity ("a non-zone cell the body can still follow the player to"). L53's puncher never came within 35 px while the player stood on its cut.
- **Drills are slower than the player (L28, L91).** A drill hops one tile only from `sit`, within 48 px, with a `Solid`-free line (`Drill.as:18,85-110`). It then plays `drill` + `undrill` (9 frames at 20 fps, `:19,27-28`; `Main.FPS` 60): about 27 ticks per 16 px, ≈ 0.59 px/tick against the player's 0.8 (`Player.as:73`). The drills reached about 7 px but never landed contact.
- **Punchers wind up (L26), and runners can be dodged (L75).**
  - A puncher that reaches `attackRange` (10) switches to `attack` and stops steering (`Puncher.as:60,111-117`). The punch lands only via `attackPlayer` on its frame, so the player keeps walking out of it. Closest 8.1 px, no hit.
  - L75's runners (1.5 px/tick on land) came to 10.2 / 13.3 px without contact.

General narrowings that drop the measured over-charges (to be measured against L72 / L77 / L80-chest before any adoption):
1. **(c), follow by the body's own step rule, not by flood.** A cut cell counts only if the body, steering straight at a player standing there, can reach contact (hitbox overlap) under axis-separated moves against its `solids`. This would drop L53 (the puncher stalled ≥ 35 px away).
   - The expected rows likely keep their charge: L72, L77 and the L80 chest are runners in open lava fields with straight approaches.
   - That is not measured here.
2. **(b), a pursuit speed above the player's.** Charge a class only if its pursuit speed exceeds 0.8, derived per class from the source (`moveSpeed`, or the hop cycle for teleport-hoppers). This would drop the drills (L28, L91; and L88, which is GAME NO here only from attempts, so it would need its own witness).
   - It keeps the runners (1.5 walk / 1.0 swim), so L72 / L77 / L80-chest stay.
   - It keeps the punchers (1.0), so L26 needs term 3.
3. **Cut, a race term.** Charge a cut cell only where the body, starting from its spawn when the player enters its `runRange`, can close to contact before the player has crossed the cell and left its `runRange` (speeds and radii from the source).
   - L26 (a 1.0 vs 0.8 closing speed) and L75 suggest this is where they fall.
   - L75's runners are fast, so its YES may need a dodge-aware term or simply this witness; not derived here.

## Runs index (`…-evidence/`)

| path | what |
|---|---|
| `tools/chase/l77trap.mjs` | L77 / L78 kill scripts and spot probes (author ops + `nudge`, `replay`, open-loop `raw`/`rawTail`) |
| `tools/chase/beam.mjs` | the chase beam + `--prefix`, `--avoid` (live traps), `--clear` (no live chaser within R at the goal), `--cleared` (boot tags), `MODEL_DROP` (hide a class from the model only) |
| `tools/chase/{rows.py,cutcheck.py,near.py,firsthit.py}` | game-run summaries: hits / restarts / trap death; K cut cells stood on; closest approaches; who hit first |
| `tools/necks.mjs` | which T discs seal a room's only neck |
| `tools/movers.mjs`, `tools/runMovers.sh` | K mover rows (game landings → doors) and the beam batch (`WIDE=1` for a second pass) |
| `runs/game/spot/` | the 8 L77 spot probes (4 arms × N/W) |
| `runs/game/chain/` | `l77-fwd-spear`, `l77-rev-spear`, `l77c-S-spear-kill` |
| `runs/game/wand/` | Wand forward attempts, reverse bulb attempts, S-spot probes (booted with the runners alive: hit at t65) |
| `runs/game/l78/` | `l78-fwd-spear` (GAME YES); `l78c-spear-kill96`, `l78c-spear-kill80` (segments); `l78c-spear-kill80-try1-died` (the model drifted about 2 px; the game pulled the player into `lavatrap@144,48` from 31.1 px) |
| `runs/game/l80/` | the chest attempts |
| `runs/game/movers/`, `runs/movers/*.log` | K GAME YES runs and every beam log |
| `runs/game/movers-attempt/`, `runs/movers-attempt-game.txt` | open-loop push attempts for the no-route rows |
