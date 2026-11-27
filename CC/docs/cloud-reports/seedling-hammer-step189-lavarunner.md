# SEEDLING HAMMER-PHASE — slice STEP-189 LAVARUNNER (`seedling-hammer-step189-lavarunner`)

Planner: `seedling-hammer-phase-planning-17`. ⚖ Approved by the user on 2026-11-26 (*"… Step-189 lavarunner"*): measure first,
switch-guarded OFF. Landing needs the user's own SHA-bound OK (the planner asks). No planner follow-up arrived during the
slice. Evidence: `CC/docs/cloud-reports/seedling-hammer-step189-lavarunner-evidence/` (its `README.md` lists every file).

## 1. Start SHA, head, branch

- **Start (base):** `hammer-harvest-f1-refusal` @`de6e6e7fa8`: the LHM flip (LHM ON by default) plus the switches
  PKSW/PKRB/DSS/OAC/PSB/HSB/RSB, all OFF, over main `754b1909bb`. It is not landed.
  - ⚠ The LHM flip's 10 JSUT re-pins (fidelityBombPusher, fidelityL40Bk2, fidelityWandHold, hammerRefugeBandText,
    fidelityL40Button) are not applied at this base, so those rows are red here. That is not this slice's doing.
- **Branch:** `claude/step189-lavarunner-1iw5q6`.
  - The session's pre-made branch pointed at main `e341f1d0` and held no work, so it was reset to the base before the
    first commit.
- **Commits:**
  - `bf20044c` step 1, the reproduction;
  - `356976de` step 2, the switch;
  - `d9a5bf7d` step 3, the rows;
  - `75ec82f4` step 2b, which removes the no-spear sentence;
  - `c322a719` steps 4–5, the evidence;
  - then this report.
- **Head:** the commit that adds this report. Its trailers are `Cloud-Slice` and `Cloud-Status: final`.

## 2. The answer first

- **The switch:** `KILLLOCK_PINNED_SPEAR` (`SEEDLING_KILLLOCK_PINNED_SPEAR=1`, `withKillLockPinnedSpear`). It ships OFF and
  is decided in the solver, on the worker thread.
  - **What it does:** it spears a counted kill-lock chaser through the Solid that pins it.
  - **Why that works in the game:** `Player.spear()` has no `collideLine("Solid")` gate. `slash()` has one.
- **Solved and hitless:**
  - re-measure-11 P1 **38:6** solves in **1081 t**, and **39:1** solves in **808 t** (it ends in L75);
  - both have **0 hits and 0 deaths** on a fresh model replay;
  - both play on a **fresh p4g page** to the model's exact end with 0 hits.
- **The survey** (`--through=end`):
  - **steps 189 and 217**, both in L71 and both the same lavarunner refusal, go REFUSED → **SOLVED** in 1407 t and 777 t,
    with 0 hits;
  - every other step is byte-identical, under the defaults and under SIX;
  - no step gains a hit.
- **The one thing to know first:** the kill-lock is **right** to wait.
  - The game's `Lock` with `tSet == -1` opens on `totalEnemies() == 0`, and that count includes `LavaRunner`.
  - The five lavarunners sit in a pocket walled on every side by Dark Stone, which is always Solid.
  - So the model was not wrong; the solver had no verb for this room. The game's way in is the spear through one tile
    of wall.

## 3. The reproduction (measured, at the base)

**The refusals.** `tools/rc.mjs` replays re-measure-11's request in process. The outputs are `measure/{38-6,39-1}-{base,six}.txt`.

- **38:6** refuses with `e410e113fd01`, work 1876 (938 per pass), and both passes refuse. The text in full:
  > solverBot(wasm-location-71) apitem (160,256) contact -> kill: the count is still waiting on [lavarunner@64,224] and no
  > stance kills one of them in 1 attempt(s), each rewound (KILLLOCK_CHASER_REWIND) — lavarunner@64,224 at (24,296): hole
  > 144-tick bound (0 guard step(s)); it stands at (54.8,233.5), 69.7 px from the player, and its straight chase line to
  > the player is blocked by tile:Dark Stone — the body is PINNED on the solid between them (a chaser does not path-find).
- **39:1** refuses with `6bd9d381b7df`, the same 1876 work and the same text after `reach-exit (96,0)->L75 -> kill:`.
- **The same everywhere:**
  - the answers are the same under the defaults and under SIX;
  - `replay-seedling-solve-request.mjs --n=3` gives 1 answer and 1 trace;
  - no FIVE/SIX counter fires (all asked 0).
- **Survey step 189**, at the base, refuses with the same text. So does **step 217** (`L71 → L80`), which the brief did not name.

**The room.** `measure/l71-scene-38-6.txt` shows the request's tick 0, with `#` = Solid and `~` = lava.

- The player is at (24,296). Five counted lavarunners sit at (56–88, 200–232), inside a 3×3 pocket (columns 3–5, rows
  12–14).
- Every side of the pocket is Dark Stone.
  - `Tile.as` type 15 is `"Solid"`, and `Mobile.solids` holds `"Solid"`.
  - A lavarunner's own list adds `"LavaBoss"` and `"Enemy"`.
- `lock@112,192` (`tset -1`) is one tile east, at the head of a second pocket that the player can walk into. That pocket
  is columns 7–8, rows 13–15.

**The game's rules (AS3, `vendor/seedling`):**

- **The lock:** `Lock.checkEnemies` activates when `tSet == -1 && totalEnemies() == 0`. `Game.totalEnemies` includes
  `classCount(LavaRunner)`.
- **The body:** `LavaRunner` extends `Bob`.
  - It has `hitsMax 2`, `runRange 80`, a straight-line chase and no path-finding.
  - It has `dieInLava = false`, so it survives lava.
- **The sword cannot reach it:** `Player.slash()` hits only when `!collideLine("Solid", …) || hasGhostSword` (`Player.as:917`).
  The run holds `hasSpear` but not `hasGhostSword`.
- **The spear can:** `Player.spear()` (`:954-990`) collides its 32×5 rect and calls `genericHit(…, spearDamage 2)` with
  no line gate. That damage is one landing per lavarunner kill.

**Hand-driven on the model** (`tools/probe.mjs`, `measure/l71-hand-spear-38-6.txt`):

- The keys walk into the east pocket to (125.6,223), select the spear (slot 2 of the request's `[0,1,3,2]`), then tap
  left and press, 30 times.
- That kills **4 of 5** through the wall, with **0 hits**.
- The fifth sits at y 214, 7 px off the thrust's 5 px band. This is why the switch has a free-axis alignment step.

**Existing switches:**

- `KILLLOCK_LINE_STANCE=1` (measured) does not help. It names all five as PINNED, and its line stances fail on the
  corridor: *"tried 4 strategies … kill(lock@112,192) … the corridor still does not plan"*.
- The refusal's list `[lavarunner@64,224]` names one body only because the turn had already asked the other four.

## 4. Design + change; the OFF identity

**`solverBot.js`.** The new functions follow `killLockLineStanceTurn`, and there is one call site.

- **The new functions:**
  - `chaserPinPoint`;
  - `pinnedSpearStances` (exported);
  - `killLockPinnedSpearAttempt`;
  - `killLockPinnedSpearTurn`.
- **The call site:** it is in `killLockChaserRewindTurn`, behind `KILLLOCK_PINNED_SPEAR.enabled`. It runs after the arm's
  own stances (and the line stances, when that switch is on) are spent, and before the turn's refusal.
- **Stances:** lattice cells that meet all four conditions:
  - they are inside the body's own leash (`aggro.range`), so it chases;
  - they are plannable floor for the player;
  - the body's straight line to the cell **meets** one of its own Solids, so it stops there;
  - and a thrust in one of the four facings (`spearHitRect`) touches the body's box at that stop, or at the stop slid
    along the free axis to the cell's own coordinate.
- **Order and limits:** cells are sorted nearest to the player first. A body gets at most 3 cells, and a turn gets at
  most 6.
- **The attempt:**
  1. The ladder walks to the cell, and any hit on that walk refuses.
  2. It selects the spear (`ctx.equip`).
  3. While a counted body touches the thrust, it taps facing (with the turret arm's back-step drift correction), then
     presses at `KILL_PRESS_CADENCE`.
  4. Otherwise it takes one step along the free axis toward the target, never more than half a tile off the cell.
  5. Otherwise it presses no keys.
  6. It stops when the target is dying, or at its bound (the travel ceiling plus 12 presses × cadence).
  7. It restores the prior slot.
- **Safety:**
  - a hit, a death or a door crossing refuses by name, and the turn rewinds and tries the next cell;
  - the last kill's stand-out goes through `killLockStandOutRefusal`, as the line stance's does;
  - the anytime deadline is honoured as in the line-stance turn;
  - with no spear (or no `equip`/`rewind`), the turn counts `noSpear`, adds nothing to the refusal and returns. This is
    commit 2b.
- **Generic:** nothing reads a level, a coordinate, a body name or a Seedling constant. A unit row checks this.

**`solverEnvChannel.js`:** `SEEDLING_KILLLOCK_PINNED_SPEAR` is added to `SOLVER_ENV_NAMES`. The page passes it to the
worker, and the decision is the worker's.

**The OFF identity:** `batch-seedling-acceptance.mjs | md5sum`:

| tree | md5 |
|---|---|
| base `de6e6e7fa8` | **`391322d681b7aa0229d94b3f6906d024`** |
| with the switch OFF (`d9a5bf7d`) | **`391322d681b7aa0229d94b3f6906d024`** |
| with the switch OFF (`75ec82f4`) | **`391322d681b7aa0229d94b3f6906d024`** |

`census-seedling-solver-surface.mjs --write` (375 rows, line moves only) then `--check` is GREEN.
`generate-procgen-reference.mjs` and `generate-docs-index.mjs` were run; the outputs are unchanged.

## 5. Rows and bounded vitest runs

**Default tier:** `frontend/modules/seedlingDemo/hammerStep189.test.js`, **6 rows**, 6/6 passed.

- the switch ships OFF, reads its env, and its name is on the channel;
- the wrapper restores, also on a throw;
- the counts reset;
- there is one call site, between the line stances and the turn's last refusal, and two textual references;
- there is no single-game constant in the four new functions;
- `pinnedSpearStances` on 38:6's tick 0:
  - all five bodies are offered cells;
  - none of the cells is a line stance;
  - each faces the wall between, within the 80 px leash;
  - the first body's cells are exactly `(120,232)` and `(120,216)`, facing left.

**Train tier:** `hammerStep189.train.test.js`, **4 rows**, 4/4 passed in 28 s on this box. Each is a whole-request solve.

| request | switch | pinned result |
|---|---|---|
| 38:6 | OFF | `e410e113fd01`, 1876 work |
| 38:6 | ON | `733c3d7160f8`, 1081 t, 0 hits, 0 deaths, the dashless pass solves, three spear kills facing west |
| 39:1 | OFF | `6bd9d381b7df` |
| 39:1 | ON | `0d5aa914fd84`, 808 t, L75, 0 hits |

- `scripts/test/train-shard-costs.json` has a new row (27.6 s).

**Shared support and fixtures:**

- `hammerStep189Legs.js` replays each plan with its `equipsAt`.
- The fixtures are in `fixtures/hammer-step189-lavarunner/`. They are the page worker's two requests, with `source`
  trimmed to L71 and its teleporter targets (6 KB each). Their answers are identical to the untrimmed requests'.

**Bounded runs** (by path only):

| file | result |
|---|---|
| `hammerStep189.test.js` | 6 passed |
| `hammerStep189.train.test.js` (train config) | 4 passed |
| `hammerNewLocks.test.js` + `hammerL53Killlock.test.js` + `solverEnvChannel.test.js` (+ `hammerStep189.test.js`) | 35 passed |
| `trainShardPlan.test.js` | 21 passed |

No unfiltered vitest was run.

## 6. Page play / game witness

`tools/reqwitness.mjs` is f1-refusal's tool plus one fix, below. It solves the captured request in node with the switch
ON, then plays the plan on a **fresh p4g page** (headless, logic-only, under the box lock).

| request | game | model | divergence |
|---|---|---|---|
| **38:6** | finished, 1081 ticks, **0 hits**, ends L71 (168.06,263.62) at the chest | ends L71 (168.06,263.62) | none (`tools/cmp.mjs`: every 5-tick sample equal) |
| **39:1** | finished, 808 ticks, **0 hits**, ends L75 (72,216) | ends L75 (72,216) | none |

**How far it gets:**

- 38:6's plan is the chest leg.
- The survey's step 189 runs chest then exit, to L75, in 1407 t.
- The next survey step, **190** (L75 → L74), refuses at both base and ON on `spinningaxe@80,144`: *"the combat ladder is
  EXHAUSTED"*. That is a different wall, and it is the likely next stop for entry 39 after this one.

**⚠ The first witness run diverged, and the fault was the tool, not the plan.**

- The divergence:
  - the fresh page builds its slot array from the held items, which gives `[0,1,2,3]`;
  - the request's own array is `[0,1,3,2]`;
  - so the plan's `equip slot 2` selected the **wand** on the fresh page, and the presses fired `WandShot`s;
  - `botMobiles` shows it, in `game/38-6-kps-unmapped-slot.log`;
  - the lock never opened, and the player stopped under it at t515.
- The fix: re-aim each equip at the same **item** in the fresh array, so 2 → 3.

## 7. Census: which seed-1 divergence-sweep legs (by key) the change can move, and why

**Where the switch can act.**

- **The leg list:** `seedling-divergence-legs.mjs --presets=seedling_playthrough` gives **915** legs at this head.
- **The switch is read only** inside `killLockChaserRewindTurn`, which runs when a kill-lock's chaser arm has spent its
  stances.
- **It acts only** when the run holds a spear in a slot.
- **Kill-lock rooms in the atlas** (`census/killlock-census.txt`) are L5, L18, L53, L60, L71, L78, L98 and L99.
  - Of these, the legs that hold the Ghost Spear are in **L71 (29), L78 (2), L98 (6) and L99 (3)**: 40 legs. Every one is
    listed by key in `census/legs-killlock-rooms.txt`.
  - The 19 legs in L5, L18, L53 and L60 hold no spear. Since 2b, ON leaves them unchanged.

**Measured, all 29 L71 legs** (`--mode=inv`, live wasm page, OFF vs `--solver-env=SEEDLING_KILLLOCK_PINNED_SPEAR=1`, in
`sweep/l71-legs.md`):

- **29 of 29 are identical.** That covers end, failure text, every plan, every tape and room hits.
- The ends are 26 `done`, 2 `failed` and 1 `skipped`. Every leg has 0 room hits and 0 divergences.
- The two failures are unchanged and are not this lock:
  - 584 `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0` fails on the combat ladder (an axe);
  - 901 `level_71__r14c12 <- in_L72_0_256 ~> level_71__r0c6 -> exit:out_pit_10_17` fails on the budget.
- **Why the sweep cannot see it:**
  - the sweep's L71 regions arrive from L72, L75, L76 and L80, which are north and east of the lock;
  - its one L85 arrival (604 `level_71__r13c7 <- in_L85_80_0 -> exit:out_teleporter_16_304`) leaves again by the south
    door;
  - no leg crosses `lock@112,192`;
  - the witnesses are therefore the survey's steps 189 and 217 and the whole-game entries 38 and 39.

**The other kill-lock rooms on the survey** were identical ON vs OFF: L78 steps 196 and 198, L98 step 227, L99 step 228.

- 196 refuses on a lavatrap corridor, at base too.
- 228 refuses on the shake-band on-screen question, at base too.
- Neither is this lock's.
- The L78, L98 and L99 sweep legs were not swept (the brief says no full sweeps). A landing's sweep should include them.

## 8. What the brief got wrong (measured)

- **"Is the kill-lock right to wait on it … if the game's lock does not need it, that is a rules/model hand-over":**
  - the lock is right, so there is no hand-over;
  - `Lock.checkEnemies` and `Game.totalEnemies` count `LavaRunner`;
  - the fix is a solver verb, which is the spear through the wall.
- **"38:6 … waiting on [lavarunner@64,224]":** the lock counts **five** lavarunners. The refusal lists one because the
  turn's `live` set leaves out the bodies it already asked. With `KILLLOCK_LINE_STANCE=1`, all five are named.
- **"Survey step 189":** L71 is reached twice. **Step 217** (L71 → L80) is the same refusal, and the switch solves both.
- **"Every L71 sweep leg by KEY":**
  - all 29 are measured, and none can move, because no sweep leg crosses this lock (§7);
  - also, **`--mode=bare` cannot measure this switch**, because bare legs hold no items and so no spear;
  - a first bare start was aborted after 4 legs, and the run was redone in `--mode=inv`.
- **The game-witness tool (f1-refusal's `reqwitness.mjs`) is unsafe for any plan that equips**, because of the
  fresh-page slot order (§6). This affects any earlier witness of an equipping plan made with it unpatched.

## 9. Residue / hand-overs

- **To the planner: a landing decision.** It needs the user's SHA-bound OK. The landing would add
  `KILLLOCK_PINNED_SPEAR` to `docs/json/developer/procgen/seedling-bot.md`'s switch table. That doc was not edited here,
  so the procgenDocs pins were not run.
- **Budget:**
  - ON, both requests spend **2562** work against the budget of 2560;
  - the dashless pass solves in about 1600, and the full pass is cut by the deadline (`limit: budget`);
  - the anytime ladder keeps the dashless plan;
  - a landing's sweep should watch extra refusal work in the L78, L98 and L99 kill-lock rooms.
- **Not done:**
  - no whole-game walk (not asked);
  - no full sweep;
  - no re-measure with SIX on the page;
  - the request witnesses were run under the defaults, and node replays under SIX give the same answers
    (`measure/*-six-kps.txt`).
- **The witness tool's slot re-map** (`evidence/tools/reqwitness.mjs`, the `SLOTS` line) should go into whichever copy
  the planner standardises on.
- **Cleanup:**
  - the dev server this slice started (port 8000) was stopped by PID;
  - the survey view cache under `.cache/seedling-survey/` is gitignored and was left in place;
  - every scratch file is outside the tree.
