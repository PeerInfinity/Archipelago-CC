# Seedling HAMMER-PHASE WALLS-CENSUS-2 — the L39 spinner and the seed-2 L26 tree/rocklock (READ-ONLY)

Slice `seedling-hammer-walls-census-2` (Opus, cloud). Planner `seedling-hammer-phase-planning-3`. ⚖ The user, 2026-11-08,
"Census both (Recommended)": a read-only census of both walls, mapping each wall's cause and rough cost; the planner then
picks. **No solver, model, rules, generator, AS3, wasm, gitlink or preset change was made.** The branch carries this
report and its evidence directory only. No mid-run message was received; the scope is the brief.

## 1. Start, head, branch

| | |
|---|---|
| start SHA | **`bf8f616f5b`** (`origin/main`, "train: cloudberry-p7c 58b89af1d5"); the brief's `27b6678481` is an ancestor |
| head | the commit carrying this report (W0 `41be89a6`, M `2be099f3`) |
| branch | `claude/seedling-hammer-walls-census-uljpry` (the harness's name for `seedling-hammer-walls-census-2`). Nothing went to `main` |
| evidence | `CC/docs/cloud-reports/seedling-hammer-walls-census-2-evidence/` (`w0/`, `input/` the census legs, `m/` the measurements, `tools/` the scratch instruments) |

## 2. The answer first

**The one thing to know first:** neither wall is the hammer's search running out of budget. **L39 is a model pricing bug
(fidelity's `dangerMap.js`):** the room's Pulser kills `spinner@112,88`, and the danger map then prices the dead spinner
at its placement. Over one hammer cycle (45 phases), that phantom makes the dashless pass refuse at 25 phases. The
640-unit request then lands at only **20/45** phases, and the leg falls back on the 2,560 retry's full pass (**39/45**).
With the phantom removed (an in-memory candidate, not shipped), **both budgets land at 44/45**. **L26 is a rules bug:** the region edge `level_26__r13c8 -> level_26__r2c4` says
a sword opens `rocklock@112,208` from the L28 pocket. In the game it cannot: one of the two Punchers never comes within
its 80 px run range of the pocket, so `totalEnemies()` never reaches 0. That holds with any inventory: the leg refuses the
same way with vanilla's.

### L39 `spinner@224,112` (walk entry 18, "Level 039 - Totem Part 72,40")

| question | answer (measured) |
|---|---|
| which sweep leg | **None in the leg list.** Leg 367 (`level_39__r0c9 <- in_L40_480_912 -> location:…72,40`) arrives from L40 *above* the shaft and lands in 75 ticks. The walk enters from L38 *below* (`level_39__r25c9 <- in_L38_144_0`, staged `flag:L39:8`) and must solve the shaft. The census leg is 368's arrival + 367's goal (`input/legs-l39shaft.jsonl`) |
| does the page reproduce the walk | **Yes.** On the live wasm page (inv mode, seed 1's inventory at sphere 5.3) the leg makes **two requests**: 640 → refusal at the budget (dashless 641 units, deadline `crusher-fork`; full 1); 2,560 → **lands** (dashless refuses at 678, full solves at 1,143, 2,684 ticks). That is the re-measure's "landed only on the held retry". Node replay: 1 distinct answer over 2 runs per request, the same as the page's worker |
| pass vs spinner phase | Seam-time census over one hammer cycle (period **45**: t and t+45 give byte-identical answers). **640: lands at 20/45**, exactly the phases where the dashless pass plans (529–551 units). At the other 25 the dashless pass spends the budget (21, deadline `crusher-fork`) or refuses on the live spinner (4), and the full pass gets ~1–110 units. **2,560: lands at 39/45**: the same 20 by dashless, 19 more by the full pass. The captured seam (5224) is one of the 25. So the walk's "landed only on the held retry" is a 25-in-45 event, and its refusal is a 6-in-45 one |
| why it refuses | **Two causes.** (A) **the phantom**: `enemy:spinner@112,88`, "a static Enemy body at its placement", with the live roster `[empty]`. It refuses the dashless pass's final walk to the totem: with it removed, the dashless pass plans at 44/45 phases instead of 20/45 (an A/B: the candidate changes only that pricing). In the 2,560 full pass it is the refusal at t=5181 and 5188. (B) **the live `spinner@224,112`** meeting a shaft walk mid-walk: t=5185–5187 (its body, at the park of `pushableblockfire@48,176`, route step 3/7) and **t=5222, which is the walk probe's refusal to the coordinate** ("HAMMER at (188.9,198.5) at horizon 71") |
| where the work goes | 640: dashless `block-route` 357 + `walk` 209 + `crusher-fork` 75 = 641 (the forced-hit rung, climbed because of the phantom, hits the budget), full `walk` 1. 2,560: dashless 209 + 357 + 112 = 678 (refused on the phantom), full `walk` 194 + **`sword-dash` 568** + `block-route` 357 + `crusher-fork` 24 = 1,143 (solved) |
| is the spinner modelled exactly | Its **motion and hammer** are: the refusal names the exact 13 px `collideLine`, and fidelity L39SHAFT witnessed the billiards (not re-measured here). Its **death is not priced consistently.** `spinnersTheRunSteps` (`dangerMap.js:1379`) excludes a dead spinner only if it has a *landed press hit*. The Pulser kill (`stepPulsersNow`, `levelRun.js:9672`, `t: 'Pulse'`) writes no such row, so the corpse is priced at its placement (trap 157's "dead half", which U6 closed for press kills only) |
| a hitless plan in the game's terms | **Yes, once the phantom is gone:** the dashless pass then solves at 529–586 units, so 640 lands at **44/45** phases (now 20/45) and 2,560 at **44/45** (now 39/45). The one phase left (5185) is cause B, the live spinner's body at a park. The game's own answer there is to **wait for a spinner phase window**. The shaft's departure wait (`L39_SHAFT_WAIT_STEP` 16 / `MAX` 480) already does that, but only for refusals at **plan time**. At t=5222 the stance walk had spent **220 ticks** before it refused, so the wait never fired (`WAITTRACE`) |
| does an OFF switch answer it | **No, not the phantom.** Each OFF switch alone (`SEEDLING_<NAME>=1`; `tools/switch-scan.sh`, `m/switch-scan.txt`) on three captured cases (640@5224 phantom/budget, 2,560@5181 phantom, 2,560@5222 hammer): 20 of the 21 leave all three answers byte-identical (AXIS_STRIKE, CLEARTAG_STAND, CHASER_STAGED_HUNT, STANCE_BURN, PRESS_ESCAPE_EXACT, STRIKE_SLOT, APPROACH_DOOR, TURRET_APPROACH, LATCH_WEIGH_FIRST, FIFTH_ORDER, OPPORTUNISTIC_STRIKE, STAGED_HUNT_SCAN_MEMO, CLEARTAG_CHAIN, CHOOSER_CUT, DETOUR_VIA_BOUND, KEYLOCK_TURRET, FORECAST_SHIELD_BUMP, FINE_STANCE_WALK, CHASER_SPINNER_WALLS, DASH_SPINNER_FORECAST). **`HAMMER_FIGHT_FALLBACK` lands 2,560@5222** (PLAN, 1,630 units) and changes 5181's refusal (to `button@128,144`'s route stance); it does nothing for 640@5224. ⚖ It stays OFF (the user's ruling). The queued branch switches (376-BOMB, DRILL-EXIT-PASS, KILLLOCK_CHASER_REWIND, KNOCKBACK376, the wave-5 four) were **not** scanned: they live on unharvested branches. The phantom is in `dangerMap.js`, which no hammer switch owns |

### Seed-2 L26 tree/rocklock (entry 14, "Level 030 - Torchpickup", exit `level_26__r2c4 -> level_27`)

| question | answer (measured) |
|---|---|
| where the bot is | Tile (8,13), the **L28 door's arrival** `(128,208)` (leg 287's `arrive`), in region `level_26__r13c8`. That region is a 2-tile pocket: `rock2@128,192` and `pole@144,192` to the north, `tree@128,224` (32×32) to the south, `rocklock@112,208` to the west, and the L28 teleporter `(144,208)` |
| what the game requires | `rocklock@112,208` is `tset=-1 tag=0` (Dungeon3/5.oel). `RockLock.update` opens it when `(FP.world as Game).totalEnemies() == 0` (`RockLock.as:52`); `tag 0` then keeps it open for good. The room holds **two Punchers** (`Game.totalEnemies` counts `Puncher`). A Puncher runs at the player only within `runRange` 80, with no line-of-sight test (`Puncher.as:22,62-63`). **From the pocket the player gets no further west than x=130.5** (model, `left` held 300 ticks). `puncher@32,208` sits at (40,216), **90.5 px** away, and **never moves** (600 idle ticks). `puncher@80,168` parks at (105.5,206.5), behind the lock. So the room is never cleared from the pocket, with any weapon the pocket can swing (`tools/l26-pocket-idle.mjs`). The model's Puncher equals the game's tick for tick in the L53 witness (fidelity RULESREF D1) |
| seed 2's AP route there | Spheres 1–4: Progressive Sword, Health, Light, Fire, Progressive Swim, 4 Totem Shards, 3 Seals, and the events L0 1/4, L16 0, L24 0, L28 0, L39 8. **The rule `Or(Has(Progressive Shield, 2), HasAny(Ghost Spear, Progressive Sword, Wand))` holds with the Sword**, so the logic sends the bot through the pocket |
| is the logic right to send it | **No: a rules defect (name it for the rules arc).** `Rules.py:395-397` puts the same weapon rule on both directions of the lock. From `r2c4` the rule is honest (stand in the room, kill both Punchers, the lock fades and stays open). From `r13c8` it is a **seal while the lock is shut**: no inventory opens it. `seedling-rules-oneway-census.md` row 102 prices this lock as "the rules charge the kill per crossing", and that is false from the pocket side |
| missing strategy row (solver)? | **Also yes, but secondary.** `obstacleGateFor` (`solverBot.js:6218-6236`) already names the lock an ENCOUNTER gate: *"outside the model's activator roster, so the `kill` verb's kill-lock arm cannot be asked about it"*. The leg that IS possible in the game, `r2c4 <- in_L25_0_96 ~> r13c8 -> L28 door`, also refuses on the page with "No strategy row exists" (vanilla and seed-2 inventory alike). A row there would fix that direction, never the pocket |
| vanilla seed 1 | Its route enters `r2c4` from **L25** (`in_L25_0_96`, arrival (128,32)) and walks to the L27 door: leg 283 **lands in 286 ticks** (page, dashless 18 / full 104 units). It never needs `r13c8 -> r2c4`. Seed 2 reaches L26 from `level_28__r0c6`, where both paths to `level_27` are three region hops (`r0c6 -> L26 r13c8 -> r2c4 -> L27`, or `r0c6 -> L25 -> L26 r2c4 -> L27`), and the walk took the pocket |
| inventory dependence | **None:** the pocket leg refuses verbatim with seed-2's inventory and with vanilla's 2.2 inventory (page, two legs, `m/page-rows.jsonl`) |

### The recommendation (the planner brings it to the user)

| wall | cause by name | recommended fix | owner | rough cost |
|---|---|---|---|---|
| L39 (A) | **model**: a non-press spinner death is priced at the placement | `spinnersTheRunSteps`: in a room whose spinner roster the run tracks, a census spinner missing from the roster is gone (press, Pulser, bomb, dark hit, ghost swing). New `CONTACT_FIDELITY` key, OFF | **fidelity** (`dangerMap.js`) | ~10 lines + a test row; measured lands 640 at 44/45 phases (now 20/45) and 2,560 at 44/45 (now 39/45) |
| L39 (B) | **solver**: the departure wait retries plan-time refusals only | retry a park after a mid-walk billiard refusal: rewind (`ctx.rewind.to`), idle 16, re-derive the route, ask again. OFF switch under `rungGate` | **hammer** (inside fidelity's `l39shaft` executor in `solverBot.js`: their sign-off) | ~60–90 lines + a pin. Measured partial (§4): it fires, then meets a levelRun throw (C) and a stale route |
| L39 (C) | **model**: `FIRE_ARM_POLICY` calls Spinner "modelled" with no dispatch arm (a Fire press that reaches a spinner throws) | the Fire-on-Spinner arm (`hitSpinner`'s `t === 'Fire'` knockback already exists) | **fidelity** (`levelRun.js`) | small; surfaced only by B's candidate |
| L26 (R) | **rules**: the pocket→room edge is a seal priced as a kill | `level_26__r13c8 -> level_26__r2c4`: require the lock cleared (a new event `L26 flag 0: rocklock@112,208 cleared`, collected in `r2c4`), or no edge at all. `r2c4` keeps its L25 and L27 entrances, so no location is lost (by the region graph; the rules arc's `--blocks` measures it) | **rules** | one edge (+ one event), preset regeneration, the one-way census row 102 corrected |
| L26 (S) | **solver/model**: no kill-lock row for a `RockLock` (outside the activator roster) | a `rocklock` kill-lock row: kill the room's counted enemies, then the fade | **model (fidelity: RockLock into the activator roster)** + **hammer (the row)** | medium; needed only for `r2c4 -> r13c8 -> L28` (measured refusing), not for this stop |

**Recommend: L39 (A) first.** It is the smaller change, it turns a 20/45 first rung into 44/45 (and the 6/45 refusal
into 1/45), and it takes the leg off the 2,560 retry at all but one phase, before any hammer work. **Then L26 (R)** in the rules arc. It is small, it moves
seed 2 past 13/48 with no solver work, and the route then takes the L25 door that already lands in vanilla. L39 (B), (C)
and L26 (S) are the residue (§9).

## 3. W0

`w0/w0.md`. `session_bootstrap.sh --seedling` → READY ("pip headless: FAILED", not used); six non-wasm submodules
initialised before any gate; node v22.23.4; dev server `serve-nocache.py 9611` (PID 855). Seed 2 generated locally
(`AP_01043188731678011336`, the re-measure's id), copied to scratch, and the preset dir, the three `output/` files and the
`preset_files.json` edit were removed or reverted by name before any commit (`git status` clean).

## 4. M — the measurements

### The instruments (scratch, `tools/`; none ships, none edits a tracked source)

- **The page legs**: `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=… --capture-requests`
  on `input/legs-*.jsonl` (the live wasm page, p4f, under the box lock). The captured requests (`req-l39-b.jsonl` sha1
  `133c19e629e6`, 1.0 MB; `req-l26.jsonl` `cbe55eb97d1d`, 1.6 MB; `req-l26b.jsonl` `f3f113448e22`) are **not committed**:
  they are over the 20 KB fixture bound and cannot be cut while staying replayable. The command above re-captures them.
- **`lb-prof.mjs`** (LB's, copied unchanged): one request as the worker replays it, with each segment's work by site.
- **`trace-hook.mjs` + `trace-loader.mjs`**: a node `load` hook that rewrites modules **in memory** (never on disk):
  `SPINTRACE` (each time `staticEnemyDanger` prices a spinner placement: the live roster and the press ledger),
  `SPINROSTER`, `SPINKILL` (each `hitSpinner` that kills, with its call site), `WAITTRACE` (`l39ShaftWalk`'s catch).
  Two candidates are gated by env: `WC2_PHANTOM_FIX=1` (A) and `WC2_REWIND_WAIT=1` (B, `rewind-wait-patch.mjs`).
  Children inherit the hook through `NODE_OPTIONS=--import=…`.
- **`l26-pocket-idle.mjs`**: the captured L26 request in the model, N ticks idle or held, sampling the Punchers.
- **`switch-scan.sh`**: each OFF switch alone (`SEEDLING_<NAME>=1`) on three captured L39 cases.

### L39 — the census table (`m/seam-l39-*.txt`, `m/profiles.jsonl`)

| arm | 640 lands | 2,560 lands | dashless pass | refusals by cause |
|---|---|---|---|---|
| defaults (main) | **20/45** | **39/45** | plans at 20/45 (529–551 units); refuses at 25 (478–683) | 640: the budget ×21 (deadline `crusher-fork`), live `spinner@224,112` ×4 (5185, 5221–5223). 2,560: phantom ×2 (5181, 5188), live `spinner@224,112` ×4 (5185–5187, 5222) |
| (A) phantom removed | **44/45** (dashless plans at 529–586) | **44/45** | plans at 44/45 | 5185 only: the live `spinner@224,112` (the press kill at `button@128,144`'s route stance at 640; the park's body at 2,560) |

Census bounds: one replay per arrival game clock, `atSeamTime` (only `staging.seam.time` moves, so the hammer's phase
moves and the billiards' positions do not). This is the hammer-phase axis, not the full arrival-seam axis. The walk's own
mix (1 refusal in 4 runs) fits 6/45 at 2,560 without being a measure of it.

The phantom, traced (`WC2` hook, captured 2,560 request at its own seam 5224):
```
SPINKILL {"id":"spinner@112,88","t":"Pulse","damage":1,"x":97.93,"y":105.59,"at":"at stepPulsersNow (levelRun.js:9672:39)"}
SPINTRACE {"id":"spinner@112,88","level":39,"live":[],"press":{"spinner@224,208":"L.LL....","spinner@224,112":"L..LL...."}}
```
The other two spinners died by press (`applyThrust`, `levelRun.js:7296`) and have landed rows, so they are excluded.
`spinner@112,88` has none and is priced. In the 640 request the same spinner leaves the roster with no `hitSpinner` kill
logged (a path the wrapper did not see), and the result is the same: `SPINTRACE` with `live: []` and no press row.

The mid-walk refusal, traced (seam 5222):
```
WAITTRACE {"what":"… -> l39shaft (L39 shaft) -> button@160,144 route stance","billiard":true,"kind":"danger","id":"spinner@224,112","refusal":true,"ticksSpent":220,"waited":0}
```
Candidate B (`WC2_REWIND_WAIT=1`) at 5222: the rewind-and-wait fires (`REWINDWAIT {"at":289,"waited":16}`). The
dashless pass then refuses on a press kill (*"every key set … lands the player box on a body's 7x7 rect or on the 13 px
hammer line … There is no step out"*), and the full pass **throws**: *"levelRun: `FIRE_ARM_POLICY` calls Spinner modelled
and this dispatch has no arm for it"* (C). At 5185 it fires (`at 778`) and then refuses *"route step 2/7: fire: no live
pushable is s…"*: the park's route was derived before the wait and must be derived again after it. So B is real but
unfinished, and it needs C.

### L26 — the page legs (`m/page-rows.jsonl`)

| leg (arrival → goal) | inventory | end | the refusal / the plan |
|---|---|---|---|
| `r13c8 <- in_L28_0_96 -> L27 door` (the walk's) | seed 2, spheres 1–4 | **failed**, 824 ms | **verbatim the walk's**: "no corridor … Obstacle: solid:tree (tree@128,224); also on the frontier: rocklock@112,208, rock2@128,192. No strategy row exists … from tile (8,13) to (4,19)" |
| the same | vanilla 2.2 | **failed**, 1,056 ms | the same text |
| `r2c4 <- in_L25_0_96 -> L27 door` (leg 283, vanilla's) | vanilla 2.2 | **done**, 286 ticks | dashless 18 / full 104 units |
| `r2c4 <- in_L25_0_96 ~> r13c8 -> L28 door` | vanilla / seed 2 | **failed** (both) | "Obstacle: solid:rock2 (rock2@128,192); also on the frontier: rocklock@112,208, … No strategy row exists … from tile (8,2) to (9,13)" |

The pocket in the model (`tools/l26-pocket-idle.mjs` on the captured request):
```
start (136,216); chaser roster stepped
idle 600 t:   puncher@32,208 stays (40,216); puncher@80,168 → (105.5,206.5) by t200, then still; open activators []
hold left:    player x 130.5 (westmost); puncher@32,208 still (40,216)  → distance 90.5 > runRange 80
```

## 5. I — the switch, rows, mutants

**None: READ-ONLY.** No switch, row or pin was added. The two candidates exist only as in-memory rewrites in
`tools/trace-loader.mjs` / `tools/rewind-wait-patch.mjs`, for the measurements above. Their ON radius by mover class, as
the census sees it:
- **(A)** moves any leg in a room where a spinner dies by a source other than a landed press (a Pulser: L39, plus any
  room with a pulser and a spinner; a bomb; a dark shield/suit hit; a ghost swing, whose reach cut writes no press row).
  Measured here on L39 only. The harvest needs the sweep (below) to bound it.
- **(B)** moves only L39 (`l39shaft` legs), and only at phases where a park's walk meets a billiard mid-walk.

## 6. D — gates

No tracked source changed, so every gate below measures the base with this slice's report and evidence on disk (the
evidence files are where a repo-wide document gate could trip).

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52): `contentIdentity`, `entityBlocks`, `boxLock`, `solverEnvChannel`, `strategySwitch` | **5 files, 119/119** |
| `ci-producer-checks --jobs=4` (defaults; no switch exists to turn ON) | **98 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, by its own rule: needs the wasm game page) |
| identity block (`SEEDLING_PORT=9611 identity-block.sh .`) | **exit 0**; "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE" (`m/identity-block.txt`) |
| `census-seedling-solver-surface --check` | GREEN, 371 rows (no `--write`: no line moved) |
| `census-seedling-constants --check` | PASS, 7,072 literals, 0 drift |
| `check-procgen-reference` · `generate-docs-index --check` · `derive-seedling-tick0 --check` | ALL PASS · current (193 docs) · ALL PASS |
| `check-seedling-wasm-ship` headless (`--host=http://localhost:9611`) | **ALL PASS** |
| CI at the pushed SHAs | `unittests` run 42518383716 (W0) and 42519994301 (M): **success**. **JSUT did not trigger** (a docs-only push misses its paths), so there is **no JSUT run id and no slow-battery count** to quote. The slow and train files were not run locally either: no change reaches them. `seedling-bot.md` / `seedling-bot-log.md` are not edited: there is no switch to name |

## 7. The harvest A/B

OFF: **no movers** (nothing ships). For candidate (A), when fidelity builds it, the A/B worth running is the L39 leg at
both budgets plus every spinner room:
- the census leg `level_39__r25c9 <- in_L38_144_0 -> location:Level 039 - Totem Part 72,40` is **not in the committed leg
  list**. It can be passed as a legs file (`input/legs-l39shaft.jsonl`). The sweep workflow takes `keys` against its own
  list, so the in-list proxy is the arrival leg `level_39__r25c9 <- in_L38_144_0 -> exit:out_teleporter_144_624`, which
  does not cross the shaft. ⚠ So the honest A/B for L39 is a page run of `input/legs-l39shaft.jsonl` (this slice's
  command), OFF vs ON, and the whole-game walk at seed 1 (entry 18: on the first request, not the held retry).
- the sweep over spinner rooms: `contact_fidelity=<the new key>`, `keys=` the spinner-room legs.

For L26 (R), the rules arc's own preset regeneration and the seed-2 walk (A′): the stop at 13/48 should move.

## 8. What the brief got wrong (measured)

- **"which sweep leg(s) is it (ids shift: find by key)"**: no committed leg is the walk's. The list's L39 totem leg
  arrives from L40 above the shaft and lands in 75 ticks. The walk's leg starts at the L38 door and is door-to-location
  across two logical links (`r25c9 -> r2c11 -> r0c9`), which `seedling-divergence-legs` does not build (it builds link
  legs only for door-less rooms).
- **"the L39 spinner@224,112"** is half the wall. The dominant half is the phantom **`spinner@112,88`**, a different and
  dead spinner, which costs the 640 rung 24 of its 25 refused phases. `spinner@224,112` is the 4-in-45 tail at 2,560 and
  the 1-in-45 residue once the phantom is gone.
- **"No strategy row exists for this obstacle" (L26)**: true, but not the cause. The obstacle the planner names first
  (`tree@128,224`) is a permanent `Tree` (`hit()` is empty, `Tree.as:52`). The lock behind it cannot be opened from where
  the bot stands, whatever row exists. The cause is the rules edge that sent it there.
- **"which items does seed 2's AP route hold"**: they do not matter here (the vanilla inventory refuses identically).

## 9. Residue and hand-overs

- **To fidelity (signed by the planner):** (A) `spinnersTheRunSteps` (`dangerMap.js:1379`): exclude a census spinner
  absent from a tracked roster, behind a new OFF key; the census command and `tools/trace-loader.mjs` (`WC2_PHANTOM_FIX`)
  are its measurement. (C) `levelRun`'s `FIRE_ARM_POLICY` has no Spinner arm (a Fire press reaching a spinner throws).
  The Pulser→spinner kill itself (`stepPulsersNow`) was not game-witnessed here; the fix does not depend on it.
- **To the rules arc:** `Rules.py:395-397` (`level_26__r13c8 -> level_26__r2c4`) and the one-way census row 102. Evidence:
  the pocket legs above, `tools/l26-pocket-idle.mjs`, `Puncher.as:22,62`, `RockLock.as:52`.
- **To the hammer (later):** (B) the park retry, once (C) exists; (S) a `rocklock` kill-lock row, once fidelity puts
  `RockLock` in the activator roster. That row is needed only for the `r2c4 -> r13c8 -> L28` crossing.
- **Not measured:** the arrival-seam axis beyond the hammer phase (billiard positions); the JS runtime; the whole-game
  walk itself (a 20-minute page run per sample, not repeated here: the leg reproduced the walk's two-request shape and
  its probe refusal to the coordinate).
