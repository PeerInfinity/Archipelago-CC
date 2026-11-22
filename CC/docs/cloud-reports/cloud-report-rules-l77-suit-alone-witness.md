# cloud-report — rules-l77-suit-alone-witness (REPORT ONLY): **Q1 GAME YES both ways. L77's charge on the Dark Suit alone is an over-charge. The pixel-disc SE-corner line is GAME NO: a STOP for the pixel-disc slice**

Branch `claude/l77-dark-suit-witness-jo1yfp`.
- **Base:** `origin/main` @ **`f96d6b66254cd8c2dd08323a489d5d1f07525600`**, which carries rule K + (b) (`3c602f96`).
- `origin/main` has since moved to `c1b250e638`. `frontend/presets/seedling_playthrough/AP_1/` and the pursuit guard are unchanged between the two.
- **Game:** wasm `seedling_bot_ap_p4g`, headless logic-only (`CHANNEL: … lost:1`).
- **Every tape ran on a fresh page, with damage on:** `noDamage: false`, no hazard coerced.
- **Setup:** `session_bootstrap.sh --seedling` reached READY; the six submodules are initialised; `minimal-spoilers`. No pointer moved.
- **Nothing in the rules, presets, atlas, tables, solver, levelRun or engine changed.**

Evidence: `CC/docs/cloud-reports/rules-l77-suit-alone-witness-evidence/`
- `tapes/`: every tape I authored or derived.
- `runs/game/<batch>/<arm>.{tape,game}.json`: the tape actually played, and the game's per-tick trace with the row.
- `runs/summary.txt`: one line per attempt.
- `l78-pulls.json`, `all-pulls.json`: the reel logs.
- `tools/`: the tools (§ Tools).

## Answer table

| # | question | verdict | witness (tape → run) | ticks | hits | decided by |
|---|---|---|---|---|---|---|
| 1a | **Suit alone, L76 → L78** (r2c0 → r15c6 → L78) | **GAME YES** | `tapes/beam-suit-rev-avoid-w24` → `runs/game/beam/q1-rev-beam-avoid-w24` | in L78 at **t349** | **0**, 0 deaths, 0 reels | a dodge through the west lava, past both runners (route below) |
| 1b | **Suit alone, L78 → L76** (r15c6 → r2c0 → L76) | **GAME YES** | `tapes/beam-suit-fwd-w24-ext` → `runs/game/beam/q1-fwd-beam-w24-ext` | in L76 at **t432** | **0**, 0 deaths | east lava around the runners. One reel at t181, from (8,12) onto (6,12); the Suit makes it harmless (`LavaTrap.as:64-69`) |
| 1c | Suit alone, the other lines (K's derivation line, the wall hugs, a model line) | GAME NO, each line | 7 named attempts (§ Q1) | — | 1–9 each | the runners `lavarunner@80,272` and `@112,256` (§ Q5) |
| 2 | **Spear, no Suit**, both ways | **GAME YES** (expected) | `tapes/prior/l77-rev-spear` → `spear/q2-rev-spear`; `tapes/prior/l77-fwd-spear` → `spear/q2-fwd-spear` | L78 t530 / L76 t538 | 0 / 0 | the Spear kills the trap from outside its reach, and the runners (the trap-chase slice's tapes, replayed unchanged) |
| 3 | **Suit + each weapon K accepts**, both ways | **GAME YES, all 8** | Suit+Spear: `spear/q3-{rev,fwd}-suit-spear` (L78 t530 / L76 t538). Suit + Sword / Wand / Shield×2: `q3/q3-{rev,fwd}-suit-{sword,wand,shield2}` (L78 t349 / L76 t432) | — | 0 everywhere | the Suit-alone keys (or the Spear keys), with the weapon added to the seam items. The weapon is **never pressed**, so these rows show the weapon is not needed, not that it works |
| 4 | every reel and contact | logged | `all-pulls.json` (13 reels, every one on L77's `lavatrap@96,192`); contacts in `runs/summary.txt` and § Q4 | — | — | — |
| 4′ | **L78 reels** | **none seen** | `l78-pulls.json`: `pulls: []` over the 11 attempts that spent ticks in L78 | — | — | Suit alone on K's L78 route to r6c11 dies to L78's runners before (11,4) (§ Q4) |
| **PX** | **Pixel-disc line: stand in (4,11)'s SE corner, get reeled onto (6,12), go on to L78** | **GAME NO: no reel at the SE corner. This is a STOP for the pixel-disc slice** | `runs/game/px/px-d5u1`: at rest at **(77.97, 191.48)** from t436 for 80 ticks, **0 reels** | — | 0 | `World.collideLine` takes **int** arguments (`net/flashpunk/World.as:411`). (77.97,191.48) truncates to (77,191), and from there the ray to (104,200) runs into wall (5,11) (§ PX) |
| PX′ | the same tile, where the game DOES reel | reeled from (4,11), then UNWITNESSED to L78 | `px/pxs-d20u1`: at rest at (74.21, 191.05), **reeled t437–442** onto (97.30, 197.99), never in (4,12) first | — | 0 to the reel | the game's (4,11) sliver is 5 integer positions: (73,190), (73,191), (74,191), (75,191), (76,191). The SE corner is not among them. Going on to L78 from the reel: 2 lines, both GAME NO (3 hits, death). Not every line was tried, so this leg is UNWITNESSED |

**The committed AP_1 rule** (`frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json`, quoted by `tools/ap1rules.py` → `runs/ap1-l77-rules.txt`):
```
level_77__r2c0  -> level_77__r12c6  (Suit & (Sword|Spear|Wand|Shield×2)) | ((Sword|Spear|Wand|Shield×2) & (Suit|Spear))
level_77__r2c0  -> level_77__r15c6  (same)
level_77__r12c6 -> level_77__r15c6  (Suit & arm) | Suit | Spear
level_77__r15c6 -> level_77__r2c0   (Suit & arm) | (arm & (Suit|Spear))
level_77__r15c6 -> level_78__r0c16  True
level_76 -> level_77__r2c0 ; level_78__r0c16 -> level_77__r15c6
```
- **Both directions charge** `Spear | Suit & (Sword | Wand | Shield×2)`. The Dark Suit alone never passes r2c0 ↔ r15c6.
- **The game says the Dark Suit alone crosses both ways with 0 hits** (1a, 1b). So the charge is an over-charge, on the same footing as L72 Suit ×2 and L75 L74→L71.
- A looser rule is a separate slice and needs ⚖ Robert's word. A sketch follows at the end.

## Q1: Suit alone, every line

**The YES lines** were found by the trap-chase slice's steered-route search on the JS model (`tools/chase/beam.mjs`, copied unchanged) and then **played on the game, which decides**.
- **1a's search avoided the trap.** It ran with `--avoid=104,200`: no tick within 33.5 px of the live trap, because the model does not have the tongue.
- **1b's model route was 12 ticks short.** The game trails the model by a few px at the L76 door, so 1b is the model route plus 60 ticks of `up+left` (`tapes/beam-suit-fwd-w24-ext`).

| line | direction | result on the game | contacts (tick, player tile, body) |
|---|---|---|---|
| **`beam/q1-rev-beam-avoid-w24`** | L76→L78 | **YES, L78 t349, 0 hits, 0 reels** | — |
| **`beam/q1-fwd-beam-w24-ext`** | L78→L76 | **YES, L76 t432, 0 hits**; reel t181 (8,12)→(6,12) | — |
| `hand/q1-rev-K-4-12-col6-west`: **K's derivation line** (r2c0 → (4,11) → (4,12), a K cut cell → reeled onto (6,12) → straight down column 6 on its west side, x 97) | L76→L78 | NO, 3 hits, death | t480 (6,15) runner 9.6 px (from spawn 80,272); t510 (6,15) the same runner 1.1 px. The Suit's two counter-hits kill it (`Player.as:1383-1386`). The killing hit is from `@112,256` ≈t527 (the cal-5 probe, below) |
| `hand/q1-rev-K-4-12-col6-east`: K's line, then column 6 hugging its **east** wall (x ≈110) | L76→L78 | NO, 1 hit, door not reached | t508 (7,13) runner 9.6 px |
| `hand/q1-rev-K-7-11-col6`: K's **other** entry, (7,10) → (7,11), a K cut cell → reeled t381 → column 6 | L76→L78 | NO, 3 hits, death | t442 (5,14) runner 7.6 px; t468 (5,14) 4.2 px |
| `beam/q1-rev-beam-w24`: model route **without** `--avoid` | L76→L78 | NO, 2 hits | the game reeled it at t188 from (4,12), which the model does not have, so the model's line was gone; t334 (4,15) 9.0 px; t366 (4,16) 4.4 px |
| `hand/q1-fwd-col6-up-west`: straight up column 6 from the south landing | L78→L76 | NO, 6 hits, 2 deaths | t11 (6,17) 7.8 px; t33 (7,17) 0.2 px; … |
| `hand/q1-fwd-col6-up-east`: up column 6 on its east side | L78→L76 | NO, 4 hits, 2 deaths | t144, t166; deaths ≈t66, ≈t131 |
| `hand/q1-fwd-west-lava`: up, then diagonally into the west lava | L78→L76 | NO, 9 hits, 3 deaths | t11, t32, t67, t97, t134, t165 |

**How 1a crosses** (its tile path, `runs/summary.txt`):
- It starts down the **west lava field** (1,3)…(1,7), so the bulb never reaches it. The bulb is `Bulb.as`, `dieInLava`.
- It then goes (2,8) → (3,9) → (4,10) → (4,11) → (4,12) → (3,12) → (4,12) → (4,13) → (5,14) → (4,14) → (4,15) → (3,15) → (3,16) → (4,16) → (4,17) → (5,17) → (6,17) → (6,18) → L78.
- It walks **through K's cut cells** (3,12) and (4,12), and through the runners' own field, without a contact. It is a timed dodge in lava, not a lure or a jam.

**Why one YES line is enough here (the brief's rule).** A single 0-hit YES line is a YES. The NO lines show it is a **narrow** dodge:
- every straight line, and both wall hugs, are hit;
- the model with a 3 px contact margin finds **no** route: `runs/beam-suit-rev-avoid-m3-w32.log`, 34,047 nodes;
- so a looser rule rests on this exact line's timing (§ Sketch).

## Q2 / Q3: the controls

- **The Spear rows** replay the trap-chase slice's committed tapes `l77-rev-spear` / `l77-fwd-spear`, byte for byte (`tapes/prior/`), on fresh pages here. They are GAME YES as that report found: 0 hits, 0 reels, out at t530 / t538.
- **Suit + Spear** is the same keys with `hasDarkSuit` added to the seam items: YES, same ticks.
- **Suit + Sword, Suit + Wand, Suit + Shield×2** (`hasShield` + `hasDarkShield`) are the Suit-alone YES keys with the weapon added to the seam items: all six YES (L78 t349 / L76 t432, 0 hits).
- ⚠ **The weapon is never pressed in these six**, and the slot array on the page held the weapon (`inventory_slots: [0]` for the Sword). They witness that **holding** a weapon leaves the Suit's dodge intact. They do not witness the weapon killing the runners.

## Q4: every reel and contact

**Reels** (`all-pulls.json`): all 13 are `lavatrap@96,192` (centre (104,200)) in L77, each the full tongue 32→29→22→15→10→7, released onto (6,12) holding the Suit. Each record has the tick attached, the tick before (x/y/tile/distance), the attach point and the release point.

| attempt | attached t | from (x, y) tile | released at |
|---|---|---|---|
| `px/pxs-d20u1` (the stand) | 437 | (74.21, 191.05) **(4,11)** | (97.30, 197.99) (6,12) |
| `pxcont/*` (the same stand) | 437 | (74.21, 191.05) (4,11) | (6,12) |
| `hand/q1-rev-K-4-12-col6-*`, `cal/cal-5` | 437 | (74.21, 197.35) (4,12) | (97.06, 200.40) (6,12) |
| `hand/q1-rev-K-7-11-col6` | 381 | (7,11) | (6,12) |
| `beam/q1-rev-beam-w24` | 188 | (72.47, 196.82) (4,12) | (6,12) |
| `beam/q1-fwd-beam-w24(-ext)`, `q3/q3-fwd-*` | 181 | (132.22, 203.27) **(8,12)**, 28.41 px | (6,12) |

**Not reeled, at rest** (each a witness for the pixel-disc slice):
- `px/px-d5u1` (77.97, 191.48), 80 ticks;
- `px/px-d3u1` (77.85, 190.80);
- `px/pxs-d19u1` (74.21, 190.45).

**Contacts:** per attempt in § Q1 and `runs/summary.txt`: tick, player tile, nearest live body and its distance.
- The contact tick is **bisected on fresh-page replays** of the same tape cut at tick t, reading `botStatus.hits`. Each death is found by the respawn jump.
- ⚠ **The killing body of a death is read at the last tick that still holds the life's hits.** Where the room had already reset, that body reads at its spawn. So `killing=` names in `summary.txt` that sit exactly at a spawn are not attributions.
- **cal-5 is the one death probed tick by tick** (`--probe`, K's line):
  - hit 1 t≈481 by the runner from (80,272), then at (91.8,254);
  - hit 2 t≈511 by the same runner, which the Suit's counter-hit then kills (destroyed by t526);
  - the killing hit ≈t527 by the runner from (112,256), then at (103.9,279.1);
  - room reset at t528.
- **The three L78 `--no-bisect` arms** (`l78/…-left64/-left71/-left74-westedge`) report deaths only. Their `total=0` is "not bisected", not 0 hits.

**L78.**
- **No L78 reel in any attempt.** `l78-pulls.json` lists the 11 attempts that spent ticks in L78.
- **The four `q4-…-L78-K-route-*` arms** continue the 1a YES tape into L78, along the pursuit-resume slice's K route arms: (16,1)↓(16,4)←row 4←(11,4)↓(11,6), with lefts 64/69/71/74, **damage on**.
- **Suit alone dies on all four**, to L78's runners, before row 4 reaches (11,4). Centre-left69: t475 (12,4) 4.8 px, t504 (12,4) 2.8 px, death ≈t524 (13,6).
- That agrees with K's charge on L78 (GAME NO, Suit, in the trap-chase report).
- So **this slice adds no L78 pull data for the `tile-pixel-pull-disc` slice.** The pursuit-resume slice's `noDamage` lines stay the only (11,4) evidence.

## Q5: why the other Suit lines fail (source)

- **The runners out-run the player.** `LavaRunner.as:17-18,40`: walk 1.5, swim 1.0. They chase straight at the player inside `runRange` 80 (`Bob.as:21,55-69`). The player walks ≈1.2 px/tick on floor and 0.45 in lava (`dMSwater`, `Player.as:78`; measured in the traces).
- **They wake late.** Off-screen they do not update (`Enemy.as:64-67`, 160×160 view, `Main.as:36`). They wake when the player reaches y ≳ 178.
- **The Suit gives no protection from them.** It damages the runner only when the player takes the hit (`Player.as:1381-1386`). Every contact is a hit; `hitsMax` 3 kills.
- **So every straight or wall-hugging line is caught.** Column 6 is one tile wide between walls (7,14), (7,15) and (5,18), (5,19), and the runners' spawns sit beside it.
- **Only a timed weave through the lava field avoids both.** That is the 1a / 1b lines.
- **Neither the bulb nor the trap decides a line.** The bulb dies in lava, and the trap only relocates a Suit holder.

## PX: the pixel-disc line, in detail (the designer's binding row)

**The game's launch test** is `LavaTrap.as:81-88`:
```as3
var d:int = FP.distance(x, y, player.x, player.y);                 // :81, truncated
if (d <= chompRange && !wait) { ... if (!FP.world.collideLine("Solid", x, y, player.x, player.y) ...) launch(); }
```
- `World.collideLine(type, fromX:int, fromY:int, toX:int, toY:int, …)` (`net/flashpunk/World.as:411`) truncates the player's position to int. It steps 1 px on the major axis with a `Number` minor step, and tests `collidePoint` against half-open hitboxes.
- `tools/fpline.mjs` transcribes that over every integer position of a tile (`runs/fpline-L77.txt`). For (4,11) it finds launch positions at **(73,190), (73,191), (74,191), (75,191) and (76,191) only** (5/256).
  - **(77,191) is blocked.** Its ray reaches x = 80 at y = 200 − 24·(9/27), which is not ≥ 192 in doubles, so it is inside wall (5,11).
  - **(78,·) is never reachable.** The player's x stops at 77.97 against that wall (hitbox 4 wide, `Player.as:295`).
- **The game agrees at every point tried:**
  - (77.97, 191.48) → int (77,191): **not reeled** in 80 ticks (`px-d5u1`);
  - (74.21, 190.45) → (74,190): not reeled (`pxs-d19u1`);
  - (74.21, 191.05) → (74,191): **reeled** t437 (`pxs-d20u1`).

**The verdict, plainly.**
- The designer's prototype puts the (4,11) sliver in the **SE corner**, with the nearest pulled origin ≈(77.75, 191.75). **The game does not reel a player standing there.**
- Per the brief, this is a **STOP for the pixel-disc slice**, even though Suit lines through L77 are GAME YES.
- The sliver the game does have is the bottom edge at x ∈ [73, 77), one pixel row (two at x = 73).
- **A pixel disc that is to match the game must reproduce the int truncation and the stepping of `collideLine`**, not a real-valued segment test.

**After the reel** (PX′), two continuations to L78 were tried, `pxcont/q1-px-reel-then-beam-w21/-w23`. Both are GAME NO: 3 hits, death; hits at t543 (6,14) and t606–608 (3,14).
- They were built from a model search booted at the reel's end with the runners at spawn.
- In the game the runners had already moved for about 17 ticks, so these are weak lines.
- **"Reeled from (4,11), then on to L78 with 0 hits" is UNWITNESSED.**

## Sketch only (Q1 is YES): a general loosening, NOT implemented

**What the witness says.**
- K charges a runner's cut cell with the kill arm, on the premise that a chaser faster than the player always catches it.
- In L77 that premise is false for a Suit holder. Lava opens a 2-D field in which a timed line avoids two faster runners (1a, 1b).
- No speed or reach term can see that: both runners are faster on every surface. A race term, the trap-chase report's option 3, would keep the charge.

**A general rule derived from the game:** a **search exemption**.
- **The search.** For each K-guarded crossing (level, from-region, to-region) and each item set the rule would otherwise charge, run the engine's steered-route search (the `beam.mjs` procedure over `levelRun`, the same transcription the solver uses).
  - Live lava traps get the game's own launch test (`fpline`'s int ray and `int(d) ≤ chompRange`) as a forbidden set, since the model has no tongue.
  - Use a contact margin calibrated against these witnesses.
- **Where the search finds a 0-hit route,** drop the kill arm for that item set on that crossing. **Where it does not,** keep K's charge.
- **Every exemption is then game-confirmed by its tape, like this slice,** before it may loosen a rule. The model is only a proposer: `q1-rev-beam-w24` was a model YES that the game refused.
- **No level literals.** Everything comes from the room's data, the item flags and the source constants.

**What it would loosen.** Each needs its own witness under the new rule:

| row | today | expected under the sketch | existing evidence |
|---|---|---|---|
| **L77 L76→L78 and L78→L76** | Spear \| Suit&(Sword\|Wand\|Shield×2) | + **Dark Suit alone** | **this slice, GAME YES both ways** |
| L72 L71↔L73, Dark Suit alone | the arm | + Dark Suit | GAME YES (`beam/L72-71to73-suit`, `-73to71-suit`, as cited in the pursuit-resume report) |
| L75 L74→L71, item-less | the arm | + nothing (FREE) | GAME YES (`movers/L75-74to71`, the two-runner jam, as cited there) |
| L73, L78, L80 Dark Suit rows | charged | **kept**: the model finds no route there (trap-chase report: 42,336 / 42,228 / 42,606 nodes), and the game attempts are hit | consistent |

- **Margin risk.** With a 3 px margin this slice's search finds no L77 route (above). The calibration of the margin is the open design question: too small risks a model YES the game refuses; too large drops 1a.

## Tools (`…-evidence/tools/`)

| tool | what |
|---|---|
| `w77.mjs` | the game harness: one fresh page per tape; `--arms=<json>` (segments, or `tapeFile`); a reel detector (≥ 4 ticks on the tongue table within 1.6 px); deaths by respawn; contact bisection on truncated replays (`--no-bisect` to skip); `--probe=t,…`; `--reanalyse=<dir>` (offline) |
| `fpline.mjs` | `World.collideLine` + `LavaTrap.as:81-88` over a tile's integer positions |
| `chase/` | the trap-chase slice's beam and helpers, unchanged. Runs here: `runs/beam-*.log` |
| `summarise.py` | builds `runs/summary.txt`, `l78-pulls.json` and `all-pulls.json` |
| `ap1rules.py` | prints a level's AP_1 exits as readable rules |

**Where the arms live.** The arm definitions are in `runs/arms-*.json`. The `cal`, `px` and `pxs` arms were calibration sweeps run into the scratchpad. Their decisive runs are copied into `runs/game/{cal,px}/`.

**Calibration finding, for the next tape author:** the L77 bulb (`bulb@80,72`) hits a player walking the dry corridor at t91. Luring it into row-1 lava kills it (`cal/cal-bulb-row1b`), because `Bulb` keeps `dieInLava`.

## Stops checked

- **No change** to any rule, preset, atlas, table, solver, levelRun, `CONTACT_FIDELITY`, level data or engine closure. Nothing outside the evidence directory and this report is in the diff.
- **Nothing edited** in `worlds/seedling/`, `vendor/seedling`, `.github/` or any submodule pointer.
- **No CI dispatch** (B1 not engaged). No vitest run: no code under test changed.
