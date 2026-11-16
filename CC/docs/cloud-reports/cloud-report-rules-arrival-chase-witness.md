# cloud-report — rules-arrival-chase-witness

Branch `claude/rules-arrival-chase-witness-yv6xwh`, from `origin/claude/l73-lavarunner-move-patch-5h4k7x` =
`f2ef58c47b8b681ee11ebfc4e655a6d54aab4b04` (`git rev-parse HEAD` at setup). This slice REPORTS only: no rule, preset, atlas,
table, level-data, solver, `levelRun` or `CONTACT_FIDELITY` change. No submodule pointer moved. Evidence and tools:
`CC/docs/cloud-reports/rules-arrival-chase-witness-evidence/` (`tools/`, `tapes/{solver,beam,hand}/`, `runs/`, and every
polled game tick in `runs/game/*.game.json.gz`).

Game = wasm page `seedling_bot_ap_p4g`, headless logic-only (asserted on every page), on the DELIVERED set
`seedling-vanilla-record-23510f80`. None of L72, L77, L80 or L105 carries a set patch, so delivered = atlas for these
rooms. Every tape ran on a fresh page, booted as the door boots (`arrivalStaging` → `new Game(level, x, y)`). The four
census landings re-ran first (`runs/play-arrivals.log`, 20 rows) and matched the census row for row.

## Answer

AP_1 rules (`frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json`): all four arrival edges are `True_`. "Return"
means walking back out through the door you arrived by.

| row | state | goal (rule) | verdict | evidence (tape → run; ticks; hits) |
|---|---|---|---|---|
| **L77** (96,288) ← `level_78__r0c16` | item-less | return → L78 (`True_`) | **GAME YES** | held down: out to L78 at **t6**, 0 hits (`runs/play-arrivals.log`) |
| | item-less | → L76 (`level_77 -> level_76`, `True_`) | **GAME NO** | hit at **t15–37** on every straight input, by both runners. A model beam search (22,158 nodes) finds no hit-free state past ~1 tile. Its best prefix is hit on the game at **t17**. The lavatrap kills further on (below) |
| | Sword | → L76 | **GAME NO** | the runners are beaten (steered route, 0 hits to t56), then the **lavatrap** tongues the player at t52–57 and kills at **t63** (`l77-sword-e3+left`). Every floor path passes within 23 px of it |
| | Dark Suit | → L76 | **UNWITNESSED** (none found) | beam to the trap's approach (17,487 nodes) finds no route past t12. The Sword+Suit keys without the Sword: hit at **t15** (`l77-suit-d`) |
| | **Sword + Dark Suit** | → L76 | **GAME YES** | `tapes/hand/l77-swordsuit-d`: out to L76 at **t641**, **0 hits, 0 restarts** (`runs/play-l77-swordsuit.log`) |
| **L72** (16,256) ← `level_71__r0c6` | item-less | return → L71 (`True_`) | **GAME YES** | held left: out at **t7**, 0 hits |
| | item-less | → L73 (`level_72 -> level_73__r3c7`, `True_`) | **GAME NO** | solver REFUSED (`lavarunner@80,216`, combat ladder exhausted). Beam (7,506 nodes) finds no route. Its best prefix is hit on the game at **t35** by `lavarunner@80,216`. Straight inputs: hit t47/t65 or lava |
| | **Sword** | → L73 | **GAME YES** | `tapes/beam/l72-sword-w40`: out to L73 at **t556**, **0 hits, 0 restarts** (`runs/play-l72-sword.log`) |
| **L80** (32,16) ← `level_71__r0c6` | item-less | return → L71 (the only item-less goal) | **GAME YES** | solver plan `tapes/solver/L80-32-16-to-32-0-none`: out at **t7**, 0 hits |
| | Dark Suit | → `r6c4` (`Has Dark Suit`) | **GAME YES** | `tapes/beam/l80-darksuit-r6c4-m12` / `-m14`: enters r6c4 at **t75 / t89**, **0 hits, 0 restarts** over the whole tape |
| | Dark Suit | → `r8c1` (`Level 080 - Chest`, `Has Dark Suit`) | **UNWITNESSED** (none found) | solver REFUSED (`lavarunner@0,96`). Beam to the chest (33,507 nodes) and to the chest's stance (60,966 nodes, 12 px margin) find none. The best prefix on the game falls in the c5 r7 Pit (t~128) and is hit at t183 |
| | **Dark Suit + Sword** | → `r8c1` (chest) | **GAME YES** | `tapes/hand/l80-suitsword-chest`: the chest opens at **t~296** (a SealPiece spawns at (24,138)), **0 hits** |
| **L105** (208,64) ← `level_104` | item-less | → L106 (`True_`) | **GAME YES** | solver plan `tapes/solver/L105-208-64-to-80-144-none`: out to L106 at **t417**, **0 hits, 0 restarts** |
| | item-less | return → L104 (`True_`) | **GAME YES** | held right: out at **t7**, 0 hits |

**In short:**
- **L105 is not a fault.** The solver's steered route is clean, and its `dies` are pit falls, not enemies (§ L105).
- **L80 is clean for every goal the cheapest state opens:** the return, and r6c4 with Dark Suit. Its open question is the chest arm: Dark Suit alone found no hit-free route, and Dark Suit + Sword is clean.
- **L72 needs a kill arm** for its runner. Sword is witnessed.
- **L77 needs more than the runners fixed.** A **lavatrap** stands on the only path north. Its tongue kills any player without Dark Suit, so even a perfect dodge of the runners dies item-less or with Sword only. Witnessed: Sword + Dark Suit.

## Setup

`git fetch origin claude/l73-lavarunner-move-patch-5h4k7x main && git checkout -B claude/rules-arrival-chase-witness-yv6xwh
origin/claude/l73-lavarunner-move-patch-5h4k7x` → `f2ef58c47b…`. `session_bootstrap.sh --seedling` → READY. The six
submodules initialised, no pointer moved. `update_host_settings.py minimal-spoilers`. Dev server:
`scripts/serve-nocache.py 8000`.

The brief's tool branches `claude/rules-route-goals-witness-7o9pu5` and `claude/l40-bk2-reachability-witness-h589su`
no longer exist on origin. `l40-bk2`'s tools are on `main`, but `legwitness.mjs` is on neither. I built on the census's
`play.mjs`/`author.mjs` instead. The §3.2 slot trap does not arise here, because every tape is built from the fresh
page's own `arrivalStaging`, never from a sweep page's grant order.

## Method (tools in `…-evidence/tools/`)

- **`solve.mjs`**: the production solver (`twoPassSolve`, FIREBREAK's switches, `dashMode: 'all'`) from the game's
  arrival staging to one `reach-exit` (or `collect-placement` with `--chest`), on the delivered level source.
  Logs: `runs/solve-*.log`.
- **`beam.mjs`**: a STEERED-route search on the JS model, used where the solver refuses.
  - It runs a beam over held key sets (8 directions + idle, `--primary` adds the weapon press), each held 4 ticks, 40–60
    wide, from the arrival staging.
  - A node dies on any model hit, death or level change. It scores by the BFS tile distance to the goal (exit tile,
    sub-region tiles, or chest).
  - Two guards are there because the game disagreed with the model, each measured once:
    - `--margin=M` refuses a tick with a chaser centre inside M px on both axes. The game hit L80's first Dark Suit
      plan at t75, where the model had a ~2 px gap.
    - `--edge=E` refuses a tick whose ±E px corners leave the floor. The game killed L77's first Sword plan in the
      lava column c5 at x 95.6 (t47), where the model let it stand.
  - The model also does **not** model the lavatrap's tongue: it refuses contact with the trap.
  - Logs: `runs/beam/*.log`.
- **`play.mjs`** (the census's; the lock name changed): plays tapes on the game, one fresh page each, and writes every
  polled tick. **`restage.mjs`** re-stages a tape's first N ticks on another item set and appends held keys (open loop);
  this is how the hand tapes were built leg by leg against game feedback. **`append.mjs`**, **`modelcheck.mjs`** (replays
  a tape on the model, including chest opens) and **`trace.mjs`** (prints polled ticks) are helpers.
- **"restarts"** is the census probe's `inputVerdict` count of dead-frame rises. One exception, in the L80 chest run:
  the rise at t296 is the chest pickup's freeze (dead frames 20 → 351, the player held at (26.9,142.9), a SealPiece
  spawned). It is not a respawn: there is no return to the landing and no hit.

## L77 — the runners, then the lavatrap

Room: a 1-wide floor corridor at c6 r13–r19 between lava. A one-way crumbling bridge (`Igneous-to-Lava`, tile 31,
`Tile.as:390-422`: it breaks 8 ticks after the player stands on it) runs at c7 r7–r9 and c2 r2. The L76 door is at
c0 r2.

**The runners decide the item-less NO.**
- Bodies: `lavarunner@80,272` (centre (88,280), gap 8 to the landing) and `lavarunner@112,256` (centre (120,264)).
- `LavaRunner.as:17-18`: swim 1, walk 1.5. `:38`: `dieInLava = false`. Both against the player's `dMS` 0.8
  (`Player.as:73`).
- `Bob.as:21`: `runRange` 80. `Bob.as:55-69`: they home without a line-of-sight test. The only thing that stops them
  is `Mobile` solids (`Mobile.as:17`).
- Game, straight inputs (my re-run = the census): idle hit@37 and then knocked back through the door to L78 at t40;
  up hit@15; left hit@34, then back to L78 at t37; right hit@35. Down leaves cleanly at t6.
- Steered: beam, item-less, 22,158 nodes. It keeps 16 hit-free survivors pinned at the door (they never get past
  y ≈ 282). Its best prefix plays hit at **t17** on the game (`runs/play-itemless-prefixes.log`).
- **Knockback:** an idle hit throws the player back through the L78 door (t37 → t40), and so does a held left (t34 → t37).

**The lavatrap decides the Sword NO.**
- Body: `lavatrap@96,192`, centre (104,200), on the corridor tile c6 r12.
- `LavaTrap.as:81-93`: it launches when the player is within `chompRange` 32 with a clear `collideLine("Solid")`.
- `:56-73`: it drags the attached player in, then calls `die()` unless `Player.hasDarkSuit`. It never "hits"
  (`hitPlayer` is empty, `:159`), so this is a death with 0 hits.
- Geometry: every floor path north from c6 r14 crosses c5 r13 (22.6 px from the trap centre) or c6 r13 (16 px), with
  a clear line. So the trap cannot be bypassed on foot.
- Game (`l77-sword-e3+left`): Sword slashes turn both runners, which jam at ~(112,263)/(100,251) behind the c7 r14–15
  wall by t44 (0 hits). From t57 (d ≈ 18) the player is pulled to (100,207). Restart at **t63**.
- The first Sword plan (`l77-sword-w40`) died earlier, at t47 in the lava column c5: a model edge error, which the
  `--edge` guard fixed.

**Sword + Dark Suit, GAME YES.**
- `l77-swordsuit-a`: the same 56-tick prefix with Dark Suit. The tongue pulls the player to (102.1,204.3) and lets go
  (`:64-69`): 0 hits, 0 restarts.
- The runner `@112,256` dies at t66 (the earlier slashes).
- Legs b–d were appended against game feedback: west and north by swimming lava (`dMSwater` 0.45 in lava,
  `Player.as:78,86-87`), up the x ≈ 94 lane to r1, down, then west over the c2 r2 bridge.
- `l77-swordsuit-d`: **left → L76 at t641, 0 hits, 0 restarts**. The bulb `@80,72` dies on its own in lava at t280
  (`Bulb` extends `Bob` and keeps `Enemy`'s default `dieInLava = true`, `Enemy.as:40,84-88`). The surviving runner idles at (75.6,198), past its 80 px leash.

**Dark Suit alone: UNWITNESSED.** The same keys without the Sword are hit at t15: the slashes were what turned the
runners. A Dark Suit beam to the trap's approach tiles (c6 r14 / c5 r13) found nothing past t12. Two attempts is not a
proof of impossibility.

## L72 — one runner on the only corridor

- Body: `lavarunner@80,216` (centre (88,224)), on c5 r13, the floor neck between the landing pocket (r13–r16 west) and
  the north rooms. Same class facts as L77.
- The solver refuses item-less ("combat ladder EXHAUSTED … chaser:lavarunner@80,216 inside leash 80 (d=8.4)").
- Beam, item-less, 7,506 nodes: no route. Its best prefix plays hit at **t35** on the game (`l72-none-w40`).
- Straight inputs: idle hit@65, then knocked back to L71 at t69. Right hit@47. Up and down die in lava.
- **Sword GAME YES:** the beam's route (556 ticks, every runner killed on the way, `ch: []` at the end) plays on the game
  → L73 at **t556, 0 hits, 0 restarts**.

## L80 — the arrival is clean, the chest arm is the question

- The arrival island r0c2 (c2–3 r1–2) has one item-less goal, the door back to L71: GAME YES at t7. A held up does the
  same.
- The FINDING (no clean straight-line input) therefore costs item-less logic nothing.
- **r6c4 with Dark Suit, GAME YES.** The m12/m14 tapes swim the lava south and enter c5 r6 at t75 / t89, 0 hits.
  - The tongue of `lavatrap@80,96` (on c5 r6, inside r6c4) pulls and releases a Dark Suit player.
  - Both tapes' tails drift toward the **Pit at c5 r7** (the region's floor neighbour). The goal is reached before that.
- **r8c1 (the chest), Dark Suit alone: UNWITNESSED.**
  - `Chest.as:63-66`: the chest opens on contact with the line just below it, so the player must stand in lava at c1 r9.
  - `lavarunner@0,96` and `@0,144` sit in that lava, and with the Dark Suit the player swims at 0.45 against their 1.
  - The solver refuses (`lavarunner@0,96`); both beams fail.
  - Its best prefix played on the game sinks into the c5 r7 Pit (t~128, respawn at the landing), then is hit at t183
    by `lavarunner@80,32`.
- **Dark Suit + Sword, GAME YES**: the chest opens at t~296, 0 hits.

## L105 — what kills the player (step 3)

The census's held-up and held-down `dies` are **pit falls**, not enemies:
- Room tiles: 112 `Pit`, 34 `Odd Tile`, 4 `Fuchsia Tile`. The landing c13 r4 is a one-tile-wide walkway.
- Held up: y 72 → 56.4 by t15, into the Pit at c13 r3, then it slows to a stop (the sink). Respawn at the landing at
  **t28–29**.
- Held down: the same into the Pit at c13 r5, respawn at t27. This repeats (6 episodes in 180 ticks), with **0 hits**.
- `flyer@192,16` creeps from (200,24) to (210,39) and never gets close. `Flyer.as:58-69` hits only by its "fall" when
  the player stands under its target point.
- Held left is hit at t49 by `jellyfish@120,72`, as in the census. Idle is hit at t66.
- The model calls up/down "clear": it does not drop the player into these pits. That is the fidelity gap the census
  named, left unchased.
- The steered solver route (walkway west, then down the c5 r6–r9 neck) is clean on the game.

## Remedy sketches (GAME NO rows only; NOT applied; Robert decides)

The two GAME NO goals are L77 → L76 and L72 → L73. Both rooms are single AP regions, so "arriving" already grants the
far exit. The charge belongs on the arrival edge, or the region needs splitting.

- **L72 → recommend (b): charge the arrival edge `level_71__r0c6 -> level_72` with the runner class's kill arm.**
  - Derived: a lavarunner is a `Bob` homer with `hitsMax` 2 (`LavaRunner.as:41`), faster than the player.
  - The arm is the weapons that damage the class: `Progressive Sword` (witnessed here). `Ghost Spear` is the other
    melee arm the rock rows already use, but it is unwitnessed here.
  - Not Fire: the census measured Fire damage 0 on a runner.
  - Not Dark Suit: its retaliation (`Player.as:1384-1387`) needs a hit first.
  - **(a) would not do:** the runner sits on the only floor neck (c5 r13) that the route must cross. No placement in
    that room keeps its 80 px leash off both the landing and the route without walling it out of the corridor, and that
    would be a route change, not a move.
- **L77 → recommend (b), with two arms: the lavatrap's and the runners'.**
  - **Lavatrap arm:** `Dark Suit`, derived from `LavaTrap.as:64-72` (it releases only when `Player.hasDarkSuit`).
  - The generalisable rule: a `lavatrap` whose 32 px `chompRange` covers every floor path of an edge (a clear
    `collideLine`) prices that edge `Has Dark Suit`.
  - Today the solver treats the trap as an unpriced `proximity-hazard` ("No strategy row exists for this obstacle").
  - **Runner arm:** the same kill arm as L72.
  - Only `And(Dark Suit, Progressive Sword)` is witnessed. Dark Suit alone is UNWITNESSED, not shown impossible.
  - (a) cannot fix this row on its own: moving the runners leaves the trap, which kills item-less and Sword-only.
- ⚠ **Beyond the four rows, not chased:** the same trap sits between the L76 door and the L78 door in the other
  direction too (`level_76 -> level_77`, then `level_77 -> level_78__r0c16`, both `True_` in the rule rows printed
  above). Any rule set that sends an item-less player from L76 south through L77 crosses it. Worth one witness.
- **L80 chest (not a GAME NO; a pending arm):** if a further witness confirms that Dark Suit alone cannot reach the
  chest hit-free, the same kill arm belongs on the edges into `level_80__r8c1`. These are sub-region edges, not the
  arrival.
- **L105:** no remedy. GAME YES on both goals.

## Runs index

| run log | what |
|---|---|
| `runs/play-arrivals.log` | the 20 straight-line arrivals on the game (census re-run) |
| `runs/solve-itemless.log`, `runs/play-solver-itemless.log` | solver for the 4 rows item-less; L105 and L80-return played |
| `runs/solve-l80-darksuit.log` | solver, L80 chest with Dark Suit (REFUSED) |
| `runs/beam/*.log` | every beam (verdict, nodes tried, best hit-free prefix) |
| `runs/play-itemless-prefixes.log` | best item-less beam prefixes on the game (L77 hit t17, L72 hit t35) |
| `runs/play-l77-sword.log`, `runs/play-l77-sword-e3.log` | L77 Sword: lava death t47 (model edge), tongue death t63 |
| `runs/play-l77-swordsuit.log`, `runs/play-l77-suit.log` | L77 Sword+Suit YES t641; the same keys Suit-only hit t15 |
| `runs/play-l72-sword.log` | L72 Sword YES t556 |
| `runs/play-l80-darksuit-margin.log` | L80 r6c4 Dark Suit YES (m12 t75, m14 t89); the unguarded plan hit at t75 is `runs/game/l80-darksuit-r6c4-w40` |
| `runs/play-l80-darksuit-chestprefix.log`, `runs/play-l80-suitsword-chest.log` | L80 chest: Suit-only best prefix (pit t~128, hit t183); Suit+Sword YES |
