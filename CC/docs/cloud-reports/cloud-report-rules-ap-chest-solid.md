# Cloud report: rules-ap-chest-solid

AP chests are now SOLID and open only from below, in the host's delivery (`kind="chest"`) and in the rules. An opened chest
is now EXACT as well: it stays open, as a minted "chest opened" latch event (§ Latch, the continuation). The rules change is general
and derived from `APChest.as`/`Chest.as` and the level data. It contains no level literal. **Against main, every route is equal
or STRICTER**, and the movers are on L11, L25 and L38 only. No location changes integer sphere at seed 1. engineMd5 is
unchanged, and closure ∩ diff = ∅. The certifier is 1/13/0 on both arms, with OPEN_L63 the only problem.

The continuation (⚖ Robert: ER re-draw → "Accept the new draw"; the far side after an opening → "Make it exact") is in § Latch.
It also covers § CI reds at 3574bda127 (4 tests), § Survey step 35 (L26), pin (B) and mutant (C). The first pass's sections below
are kept, and where the latch moved a number, § Latch gives the current one.

First-pass deviations, for the record: (1) the ER re-draw is now ruled accepted; (2) the certifier's ACCEPTED count goes
from 16 to 13 at L63, a chest level outside the four, with no route moved; (3) I re-recorded `fidelityL25ApItem`'s oracle on the
p4g game instead of only reporting its red.

- Base: `git rev-parse origin/main` = `f9010498152183593cc700d51cf813a740d29bb0` (train: rules-spinner-alias-guards).
- Branch: `claude/ap-chests-solid-below-gjlzor`. First pass: `2a4dd25a` host, `d2592a8d` rule, `d6107fc9` re-records,
  `6b6399fc` + `fac04135` evidence, `3574bda1` report. Continuation: the latch rule, its re-records and evidence, then this report
  edit as the last commit. ⚠ The first report commit is already pushed, so amending it would need a force-push (forbidden here).
  The report therefore has one edit commit on top, which is the last commit.
- Evidence: `CC/docs/cloud-reports/rules-ap-chest-solid-evidence/` (tools in `tools/`, logs in `runs/`, key walks in
  `keywalk/`, route walks in `routes/`).

## Answer table

| question | answer | where |
|---|---|---|
| Host emits `kind: 'chest'` for a chest row, order `tag`,`look`,`kind` | YES. Rewriter and `apChestDelivery` share one helper | `apPlacementRewriter.apItemAttrs` |
| p4g still plays the delivered L25 chest as an overlap pickup with the new bytes | **GAME YES** (p4g): `probe-seedling-l25-apitem.mjs --record`, 4 arms ALL CHECKS PASSED, take on tick 48, 109 obs, 0 px, 0 hits; only the delivered set id moves (`6d7e278d` → `93f13131`) | `fixtures/l25apitem-witness/oracle.json` |
| p4h builds `APChest` from it and opens it only from below | **UNWITNESSED here**. The p4h page is not in this container (only `seedling_bot_ap_p4d`/`p4g`). Brief: witnessed at `seedling_bot_ap_p4h` `p4h-rc1` @ea8f2f3357 | source below |
| Rules: the chest is a Solid that opens only from its probe line | YES. Overlay `chest` = `{kind: 'directional', probe: 'S', pocketReentry: true}` | § How the open side is derived |
| Movers only on L11/L25/L38/L80, every one stricter | Routes: **8 move, all stricter, on L11/L25/L38 only**. L80: sub-regions re-key, no route moves. **L63 also re-keys** (no route moves) | § Rows and routes |
| Seed-1 sphere moves | **None** (89/89 locations in the same sphere). The sphere log moves only sub-region names; the spoiler reorders two lines inside one sphere | § Sphere and spoiler |
| ER: keep the committed draw if it stays beatable | The committed draw **stays beatable** (90 spheres, mode checks pass). The **producer re-draws anyway**: its draw is a function of the compiled binding | § ER |
| Certifier `--arms=new` vanilla / `--source=er` | **1 / 13 / 0** on both (base 1/16/0). The problem row is still OPEN_L63's. The 3 accepted rows that go are L63's chest sub-region. **No model-lag rows** appear at L11/L25/L38/L80 | § Certifier |
| engineMd5 base / tip | `74ae60f575531492ed9eaec1839e1fe3` / `74ae60f575531492ed9eaec1839e1fe3`, 42 files, identical closure lists | § engineMd5 |
| `regen-seedling.mjs --check` | 10/10 OK (re-run with every submodule present) | `regen-check-tip.txt` |
| Derived table | Re-derived locally, a fixed point. 99 rows / 6 excluded → 98 / 4. **VERDICT MOVES** (all `True_` rows): listed for `tile-primitives-design-8` | § Table |

## Latch (the continuation: ⚖ "Make it exact")

**1. Source first** (Seedling `p4h-as3` @169247c4c4, `src/Pickups/APChest.as`; the pinned `vendor/seedling` @ccdf189
`src/Chest.as` for the vanilla line numbers):
- (a) Opening: `APChest.as:89` `type = "";` (vanilla `Chest.as:77`). The fade then removes it at `:104` (`timerStep`).
- (b) Persistence: `APChest.as:92` `Game.setPersistence(tag, false)` (vanilla `Chest.as:89`). `check()` at `APChest.as:66-68`
  (`if (tag >= 0 && !Game.checkPersistence(tag)) FP.world.remove(this);`, vanilla `Chest.as:41-43`) removes an opened chest on
  every later entry. **The opened state PERSISTS** across leaving and re-entering, for every `tag >= 0` (all 16 map chests carry one).
  So a persisting latch is allowed, and it is used only where `persists` holds.

**2. Shape**: BossLock's lock-event path, with no new geometry and no new rule kind. The transcription row `chest` gains
`persistAttr: 'tag'` (`seedlingSemantics.js`), so `entitySemantics` reads `persists` off the placement's tag as for BossLock/ShieldLock.
The grid cell is `latch`ed, the analyzer prices a closed-side entry as "the latched cell was opened" (RULES (A)), and the rules mint
it as a lock event (`playthroughLockEvents` → `deriveLockEvents`) with the opener's sub-region as its place. Two producer-side
supports: `FLAG_ACTIONS.chest` (`arrivalSolid.js`, the event's action text), and the lock-event rule of an opener whose step costs
nothing is `True_` (`make-seedling-playthrough-rules.mjs`; before, it refused). No BossLock opener is free, so no BossLock row moves.

**3. Mint only where needed.** The latch is set in the same pass that re-opens pocket sides (`buildSeedlingRegionGrid`,
`pocketReentry`). For each walled entry from a standable neighbour, a side with no landing is re-opened (the first-pass rule),
and a side that reaches a landing (the same `sideHasArrival` flood) latches the cell, but only if the row `persists`. So L40's
alcove chest is never latched. The rules then mint an event only where the latch projection moves a row. **3 events are minted**:
`L11 flag 0: chest@32,48 cleared` (in `level_11__r4c2`), `L25 flag 0: chest@96,96 cleared` (in `level_25__r7c6`) and
`L38 flag 1: chest@144,112 cleared` (in `level_38__r8c9`). The other latched cells (L12, L15, L17, L36, L71, L80, L90) mint nothing,
because no row moves there.

**4. Condition**: each event's rule is the opener's step into the cell, i.e. reaching the probe cell. That is `True_` for all
three, since each probe side is reached free inside its sub-region. The Cover over L38's chest is ruled OPEN, so `APChest.as:75`'s
"no other Solid overlapping" adds no item. The gates it prices are:
- `level_11__r0c2 -> level_11__r4c2`: `Or(Has(Progressive Swim), Has(L11 event))`
- `level_25__r2c7 -> level_25__r7c6`: `Has(L25 event)`
- `level_38__r0c9 -> level_38__r8c9`: `Has(L38 event)`

**The maze binds the event** with no engine change. A latched directional cell with no occupancy rule now takes the always-open
gate obstacle (`regionAtlasMazeProjection.js`, `builder.gate(x, y, {rule: 'True_'})`). `bindWorldEvents` hangs the event on it
(mode 'latch', side = the probe sub-region), and `levelWorldEntryGates` prices the closed side `Has(<event>)`, exactly as for a
BossLock. Without this, the certifier read 8/13/0 (`… which the maze world cannot produce (its chest is not in the maze world)`
×7). With it, the certifier reads 1/13/0.

**5. Direction, against main and against my previous tip** (route walk, `routes/latch/`; key walks, `keywalk/latch-vs-f9010498/` and
`keywalk/latch-vs-3574bda1/`):

| arrival → goal | main f9010498 | previous tip 3574bda1 | now |
|---|---|---|---|
| L3 → L11 `exit -> L10`, `Level 011 - Chest` | FREE | Swim | **Swim or L11 event** |
| L22 → L25 `exit -> L28`, `Level 025 - Chest` | FREE | none | **L25 event** |
| L26 → L25 `exit -> L28`, `Level 025 - Chest` | Spear / Shield / Sword | none | **(Spear / Shield / Sword) AND L25 event** |
| L39 → L38 `exit -> L37`, `Level 038 - Chest` | FREE | none | **L38 event** |
| L10 → L11, L28 → L25, L37 → L38 → the event locations | (new) | (new) | FREE |
| L3 → L11, L22/L26 → L25, L39 → L38 → the event locations | (new) | (new) | the event itself (the same price as the row) |

Against **main**, every existing row is EQUAL OR STRICTER (FREE → an event that has to be earned on the probe side). The only new rows are the
three event locations. Against **my previous tip** they loosen, as ruled. Totals: 15 route rows move in `seedling_playthrough`,
the seed-1 preset and the maze (`*-vs-main.txt`, `*-vs-tip1.txt`), and 15 in ER against the previous tip (436 against main: the accepted
re-draw). Key walk against the previous tip: playthrough and seed 1 move only L11/L25/L38 (the event locations, the gate rules, items).
The maze also moves payload on L12/L15/L71/L80: those latched cells take the always-open gate, with no event bound, so their entries
stay walled and no route moves. No LOOSER-than-main row.

**6. Evidence.**
- **Table** (REGEN_RECIPE: `regen --write`, `probe-seedling-derived-rules.mjs --shards=2`, install, `regen --write`, the probe
  again): a fixed point, 94 rows / 45 regions / 4 excluded. Against my previous tip (`runs/latch/derived-table-diff-vs-tip1.txt`):
  **ROW DEL** `level_25__r7c6|@Level 025 - Chest`, `level_25__r7c6 -> level_28__r0c6`, `level_38__r8c9|@Level 038 - Chest` and
  `level_38__r8c9 -> level_37__r0c18`, all `True_`. Their sub-regions now hold a minted event, so each element is a
  sharedBinding (rules-4 ruling (a)) and leaves the table; its composed rule stands. Against main (`…-vs-main.txt`): 99/6 → 94/4. The 7
  first-pass renames and drops remain, with no row ADDed for L25 r7c6 or L38 r8c9. No rule loosens.
- **Seed 1** (`runs/latch/seed1-sphere-moves.txt`): no location changes integer sphere, against main or against my previous tip.
  The three events enter at 0.1, 3.4 and 5.3. Inside those spheres the later sub-steps shift by one (`Level 011 - Chest` 0.2 → 0.3,
  `Level 025 - Chest` 3.7 → 3.8, `Level 038 - Chest` 5.5 → 5.6, `Level 010 - Sword` 0.1 → 0.2, …). The spoiler gains the three event
  lines (`L11 flag 0: chest@32,48 cleared: …` etc.).
- **Certifier** (`cert-tip-*.txt`): vanilla `1 / 13 / 0`, 104 skip, 851 lines, ALL CHECKS PASSED. ER `1 / 13 / 0`, 105 skip, 852 lines,
  `PASS: the ER arm matches … (1 / 13 / 0)`. The only problem is OPEN_L63's row.
- **engineMd5** `74ae60f575531492ed9eaec1839e1fe3` (42 files), re-measured at the continuation's tip. The closure list is identical, and
  (diff from base + untracked) ∩ closure = **0 files**. `regionAtlasMazeProjection.js` is not in the closure.
- `regen-seedling.mjs --check` every step OK. `refresh-seedling-derived-rules.mjs --check` OK, `census-seedling-constants --check` PASS,
  `generate-procgen-reference --check` all match.

**7. Pin (B)**: `scripts/procgen/seedlingChestPullLines.test.js` (4 rows), named in `docs/json/developer/procgen/maze.md` § Pulls.
For every LavaTrap of the playthrough map and every tile of its UNCUT disc, the trap→tile line (`pullLineClear`, the disc's
own test) crosses no AP chest tile. The chests are read off the overlay (a `probe` row with no condition, placed by its hitbox), so a level
edit reds it. The pin covers both the shut and the opened chest, because no line touches a chest cell either way. The rows also
assert that the producer's disc equals the chest-as-Solid disc tile for tile, and a mutant (a chest planted on a line) is caught.
No level literal.

**8. Mutant (C)**: the "pocket doors stripped" row now catches 1 problem row, not 2. One is enough: the other door's loosening
is still caught in the same row, as its landing line `level_38__r0c9->level_39__r25c9<@9,1` moving from the clean world's
`[[press]]` to `[[]]`. That is asserted against the unmutated compile (`sphereOrderLevels.test.js`), so stripping either gate reds the row.

### CI reds at 3574bda127 (run 45062565988): the 4 tests my list missed, each fixed with its reason

- `fidelityBobIframe.test.js` ("both recordings name the build, the set and every tick"): the fixtures named the delivered set
  `6d7e278d`, and the new bytes make it `93f13131`. Re-recorded by its own recipe, `probe-seedling-bobiframe.mjs --host=http://localhost:8000
  --record` on `seedling_bot_ap_p4g` (box lock, dev server 8000): **ALL PASS**, both tapes sampled on every tick (1226/1226,
  1222/1222), the ON model 0 px. Only the `delivered_set` line of each fixture moves (`runs/latch/bobiframe-record-p4g.txt`).
- `seedlingDarkTrapGateCensus.test.js` (L63 sub-regions), `seedlingDivergenceLineCarry.test.js` and `seedlingDivergenceEdgeEvents.test.js`
  (the L65 → L63 chest leg): the L63 rename, where `r5c14` is gone and the chest leg is `level_63__r6c15 <- in_L65_128_0 ~> …`. Names
  only, with no semantic change.
- The bounded list is widened with every test that reads the delivered set (`l25Sets`, `rewriteRecordSet`, `seedling-ap-record`,
  `bobiframe`, `f2Preset`), the divergence leg list (`seedlingDivergence*`, `seedling-divergence-legs`), the dark-trap census, the
  surveys and the maze preset: **242 files, 4955 tests, all pass** (`runs/latch/vitest-list-default.txt`). Slow tier, widened to
  every slow test naming seedling, divergence or a survey: **21 files, 261 tests, all pass** after one re-pin
  (`deriveLevelWorldLogic.slow`: L25's event row at L28's landing [own event] and L38's axis 4/8 → 8/16, skip rows 103 → 104).

- **CI red at f884bf87c4** (run 45070831310): `seedlingCompositeMap.test.js` "locationTiles places … items and events" got
  `{ item: 48, event: 41 }` where 38 was pinned. The 3 are the minted chest latch events (L11 flag 0, L25 flag 0, L38 flag 1). Each
  chest stands in its own level, so none is residue. Re-pinned with a ⛓ comment. The list is widened again with every test that counts
  playthrough events or locations, or reads a seedling preset or atlas: 106 more files, **2915 tests, all pass**
  (`runs/latch/vitest-list-widened-events.txt`).

### Survey step 35 (runs 45063427840 / 45063430393): L26 `teleporter@144,208 → L28` refused

**(b): the solver lacks the strategy (it exists, switched off). The rules are not looser.** The route now goes L25 → L26 → L28 because L25's
chest and L28 door cost the chest's event from L22's side. That makes the route cross L26's `level_26__r2c4 -> level_26__r13c8`,
which the old route never exercised. Its rule is `Or(Has(Progressive Shield, 2), Has(Ghost Spear), Has(Progressive Sword), Has(Wand))`,
the encounter lock `rocklock@112,208` (tile (7,13), `tset: "-1"`, `tag: "0"`) priced at the arms that kill L26's two punchers (rules
`rules-l26-rocklock-pocket`). The game: `RockLock.as:49-66` sets `if (tSet == -1 && totalEnemies() == 0) activate = true;`, and while
`activate` holds, `type = ""` (the same test as `Lock.as:109-115`). So the row is the game's. `rock2@128,192` (8,12) is a wall the path does
not need. The solver: `solverBot.js:787` gives `'solid:rocklock'` a strategy only under `ROCKLOCK_KILL` (`:3288`
`ROCKLOCK_KILL = { enabled: …SEEDLING_ROCKLOCK_KILL === '1' }`, `:3289` `ROCKLOCK_KILL_DEFAULT = false`; `:3264-3287` names exactly
L26's rocklock). Off, it has no row, so the planner sees `solid:rocklock` as an untraversable obstacle ("no walkable tile path"). The
fix is the solver's switch, which is outside this slice. I did not wire it. With the latch, the L22 side of L25 still costs the chest's event,
so the route still takes L26. **Not verified here:** the END survey's "+3-shifted REFUSED rows, nothing else new". I cannot read CI
artifacts from this container, and I did not run the survey locally.

## Step 35 (designer, tile-primitives-design-8): L26 `level_26__r2c4 -> level_26__r13c8`

> **⚠ FOR LANDING: at this tip, seed 1 and ER both DEPEND on this edge, and at main neither does.** The edge's rule,
> `Or(Shield×2, Ghost Spear, Sword, Wand)`, is a pre-existing no-hit SUSPECT. hammer-13 ran with `ROCKLOCK_KILL` +
> `KILLLOCK_CLEAR_WRITE` + `FADE_MOVE` on, and no stance kills `puncher@80,168` / `puncher@32,208` from the arrival (8,2) without a hit.
> So **the no-hit witness (or a re-pricing of this row) has to come BEFORE this slice lands.**

**(a) Why step 35 newly appears.** The route list is derived with no game run
(`survey-seedling-route.mjs --through=4.2 --derive-only`, at the tip and in a main worktree; `runs/step35/route-derive-*.txt`):
- **main**: step 33 L22 → L25, then **step 34 L25 visit 1: `collect-placement(Level 025 - Chest (sphere 3.2))` then
  `reach-exit(… → L22)`**. The chest is taken from L22's side, through the chest that was free from every side.
- **tip**: step 33 L22 → L25, step 34 L25 → L26 (`teleporter@0,96`, which lands at L26 (128,32) = tile **(8,2)**, `level_26__r2c4`),
  **step 35 L26 → L28** (`teleporter@144,208`), step 36 L28 → L25 (landing in the chest's probe side r7c6), step 37 L25 visit 2:
  `collect-placement(Level 025 - Chest (sphere 3.2))`. From L22's side the chest and L28's door cost L25's latch event, which is
  earned only in r7c6. So the leg toward **`Level 025 - Chest`** goes round by L26 and L28, and that pulls in the L26 arrival (8,2) and
  its crossing to r13c8. That is the planner's "+3".

**(b) Does any seed-1 sphere depend on this edge alone?** Throwaway: the exit removed from a copy, then the mode's own sphere walk
(`tools/edge-dependence.mjs`, `entranceShuffleSteps.beatability`; `runs/step35/edge-dependence.txt`):

| preset | main f9010498, without the edge | tip, without the edge |
|---|---|---|
| seed 1 `AP_14089154938208861744` | beatable, 90 spheres, **0 moves** | **NOT beatable**: `Level 025 - Chest`, `L25 flag 0: chest@96,96 cleared`, `L28 flag 0: rope@160,64 cleared` never collected (L26 flag 0 3.5 → 3.4, Shield 3.7 → 3.5, Boss Key 1 3.9 → 3.6) |
| `seedling_playthrough/AP_1` | beatable, 0 moves | **NOT beatable**, the same 3 |
| `seedling_er/AP_1` (each tree's own draw) | beatable, 0 moves | **NOT beatable**: 83 locations, the goal The Seed never collected |

So yes: **at the tip this edge is the only way into `level_26__r13c8`, and so into L28's r0c6 and L25's chest pocket r7c6**. L28's
other doors (from L27 into r11c4, from L30 into r1c18) do not reach r0c6 in the walk. At main the edge carries nothing on its own.
The cause is the latch: L25's L22 side now costs an event that is earned only behind L28. The row itself is unchanged against main.

**(c)** The train-tier pin is folded in: `deriveLevelWorldLogic.fixture.js` `SAMPLE` names `level_38__r0c9` + `level_38__r8c9`.
`deriveLevelWorldLogic.train` + `latchSandwich.train` + `learnLattice.train`: 3 files, 7 tests pass. **Scripted and native AGREE on
every L11/L25/L38 sub-region** (24 lines each, identical, 0 problems). No other `*.train.test.js` names a moved region or a chest
event (grep).

## The host change

- `frontend/modules/seedlingDemo/apPlacementRewriter.js`: new `apItemAttrs(tag, look, vanillaType)`, `AP_CHEST_KIND = 'chest'` and
  `AP_CHEST_VANILLA_TYPE = 'chest'`. `rewriteRecordSet` writes `attrs: apItemAttrs(entry.tag, entry.look, old.type)`. The
  replaced entity's type decides. The value is the literal `chest`, and the key order is `tag`, `look`, `kind`.
- `frontend/modules/seedlingDemo/apChestDelivery.js`: the model-side element uses the same helper, so it carries `kind: 'chest'`.
- Unit rows (`apPlacementRewriter.test.js`): the key order is asserted on every rewritten location (`['tag','look','kind']` for
  a chest, `['tag','look']` otherwise). A new row checks that every one of the 16 ledger chests carries `kind="chest"` and that
  no other row does, and that the emitted OEL holds `tag="…" look="…" kind="chest"` in that order (through `rewriteRecordSet`).
  A further row covers `apItemAttrs` alone. `fidelityL25ApItem.test.js`'s D1 room row now expects `kind: 'chest'`.
- The delivered set's bytes change, so its id moves too: the L25 probe's delivered set goes from `seedling-ap-record-6d7e278d`
  to `93f13131`. Re-recorded on the game, see Stops (3).

The game source, from PeerInfinity/Seedling `p4h-as3` @169247c4c4, commit `0451516252`. I fetched it into the vendor
submodule's object store only; no pointer moved:
- `Game.as` apitem loop: `if (String(o.@kind) == "chest") add(new APChest(o.@x, o.@y, o.@tag)); else add(new APItem(…))`.
- `Pickups/APChest.as:57` **`type = "Solid";`**, `:58` `setHitbox(16, 16, 8, 8);`.
- `:75` `if (!collide("Solid", x, y) && FP.world.collideLine("Player", x - originX + m, y - originY + height + 1, x - originX + width - 2 * m, y - originY + height + 1)) open();`
  This is the same line as `Chest.as:62-63`.
- `:89` `type = "";` and `:92` `Game.setPersistence(tag, false)` at the frame it opens. `:66-68` `check()` removes it on a
  later entry once the slot is cleared. There is no checkBySeal, no SealPiece and no Rng draw.
- `Puzzlements/Cover.as:58` `if (c is Chest || c is APChest) reset();`.

## How the open side is derived

The chest reuses the existing one-sided-Solid primitive, the BossLock's `probe` (designer term 4). It adds no new geometry:

- `seedlingPlaythroughOverlay.js` `PLAYTHROUGH_ENTITY_OVERLAY.chest` is `{kind: 'directional', probe: 'S', pocketReentry: true}`
  with no condition, and it is not `persists`. Cite: `APChest.as:57-58,75,89` = `Chest.as:29-30,62-63,77`.
- `probe: 'S'` is what `Chest.as:63` says: the trigger line is one pixel under the bottom edge. In `buildSeedlingRegionGrid` (under
  `directionalLocks`, as the producers run) the chest's claimed tiles get `enter: {E: null, S: null, W: null}`. Only the
  step NORTH from the cell below enters; that is the stance on the probe line. Leaving is free. The open side is
  therefore the cell below each chest tile (the census's "open side" column, all 16 confirmed: (x, y+1)).
- **`pocketReentry`** is new, in `seedlingSemantics.js`, and only for a probe row that is not `persists`. A walled entry is let back in
  for free when its side holds none of the level's `arrivalTiles`: a flood from that neighbour, gates and all, never
  through the cell, reaches no landing. The reasoning: whoever stands there came through the chest, which they could only do
  by opening it from below, and it is a passage once open (`APChest.as:89`). This is the re-closing locks' `farSideHasArrival`
  rule, applied to a lock that never re-closes. With no `arrivalTiles`, every side stays walled. It fires at L40. Its fire
  alcove r48c54 sits above the chest and no landing enters it, so the walk back down through the opened chest is free.
  Without it the first run deleted `level_40__r48c54 -> level_40__r26c13` and the certifier raised 6 new L40 problems.
- **Far side with a landing** (L11's L3 side, L25's L22/L26 side, L38's L39 side): in the first pass this stayed walled even after an
  opening on an earlier visit, which is stricter than the game. **Superseded by § Latch**: it now costs the chest's minted lock event.
- **Cover gate** (L38 (9,7)): `APChest.as:75` opens only while no other Solid overlaps it. The cover over L38's chest is ruled
  `OPEN` (choreography, `Cover.as:20,34,48`, activated by its tset), so under the puzzle policy the gate adds no price. It is named,
  not modelled.
- **Maze** (designer term 4): the maze projection compiles the probe cell to its existing `entry_gates` rows (`{x, y, dir,
  gate: null}` on the three walled directions). Examples: L11 `(2,3) E/S/W`, L15 `(9,6) E/S`. Rooms with entry gates go from 41 to 48.
  The open side is a one-sided cell edge, not a `struck_from` stance.
- **One source of solids** (designer term 1): the chest's cell is in the same producer grid that `pullLineClear` and rule T read.
  It is a `directional` cell, not `wall`, so it does not cut a pull line, per the producer's stated policy ("A gated solid … is not a wall:
  the disc is the cleared state's"). Measured both ways in § Pull discs: no disc changes either way.

## Rows and routes per preset

Route walk (`tools/routeWalk.py --diff`). It folds sub-region names, so a split is not a move, and gives the minimal item sets per
arrival → goal. All 8 rows are the same in `seedling_playthrough/AP_1`, the seed-1 preset and `seedling_playthrough_maze/AP_1`,
and also in ER under the committed draw (`routes/seedling_er-committed-draw.txt`):

| arrival → goal | base | tip | census row |
|---|---|---|---|
| L3 → L11 `exit level_11 -> level_10` | FREE | Progressive Swim | L11 FIRES (L3's door cut off from the open side). The way round the chest is the side water |
| L3 → L11 `Level 011 - Chest` | FREE | Progressive Swim | L11 |
| L22 → L25 `exit level_25 -> level_28` | FREE | none (unreachable) | L25 FIRES |
| L22 → L25 `Level 025 - Chest` | FREE | none | L25 |
| L26 → L25 `exit level_25 -> level_28` | Ghost Spear / Shield / Sword | none | L25 |
| L26 → L25 `Level 025 - Chest` | Ghost Spear / Shield / Sword | none | L25 |
| L39 → L38 `exit level_38 -> level_37` | FREE | none | L38 FIRES (L39's door cut off) |
| L39 → L38 `Level 038 - Chest` | FREE | none | L38 |

- **L80** (census FIRES: also reached from the left cell): its one-tile chest sub-region r8c1 goes, and the chest is bound in
  r6c5 beside its open side. The price is the same Dark Suit + arm (route walk: no move; `certifyLavaPulls` line
  `level_80__r6c5@Level 080 - Chest<level_80__r16c1` = the same four sets).
- **L63** (census "no change"): this is outside the four. Its one-tile chest sub-region r5c14 goes, and the chest is bound in r6c15
  through its Dark Suit stance (14,6). AP_1 changes the location rule from True_ in r5c14 to `Has(Dark Suit)` in r6c15. Route walk: no move.
- Python key walk (`tools/keywalk.py`, ADD/DEL/CHG per JSON path, grouped by the levels a path names; full rows in `keywalk/`).
  Leaving out the `atlas_ref`-only CHG rows (the atlas id, on every sidecar):
  - `seedling_playthrough/AP_1` (961 paths): L11, L25, L38, L63, L80, and the neighbours' exits into the renamed sub-regions
    (L3/L10 → L11, L28 → L25, L37/L39 → L38).
  - seed 1 (943 paths): the same levels.
  - `seedling_playthrough_maze/AP_1` (2228 paths): the same, plus `entry_gates` ADDs on L12/L15/L17/L36/L71/L90 (each chest's
    one-sided edge in the payload; L12's CHGs are the shifted indices of its gate list) and 2 maze `sphere_log` region-name CHGs (L15, L71).
  - `seedling_er/AP_1` (1812 paths): the same levels, plus the re-drawn stairs pairs (§ ER).
- Every changed path in a named level comes from the chest (splits, re-binds, payload gates). Nothing moves in a level
  without a chest, except neighbour exits that name a renamed sub-region.

## Sphere and spoiler diffs (seed 1, `AP_14089154938208861744`)

The sphere log changes only `new_accessible_regions` names, on lines 2, 12, 29 and 78: `level_11` → `level_11__r0c2`,
`level_11__r4c2`; `+level_25__r7c6`; `level_38` → `level_38__r0c9`, `level_38__r8c9`; `-level_63__r5c14`; `-level_80__r8c1`.
Per-location sphere, base → tip: 89 locations, **0 moved** (L11 chest 0.2, L25 3.7, L38 5.5, L63 13.3, L80 13.4, unchanged). That is
a name-only change, so not a sphere move. The spoiler diff, verbatim (`runs/seed1-spoiler-sphere.diff`):

```
@@ -60,8 +60,8 @@
 Level 036 - Chest: Seal
-Level 038 - Chest: Seal
 L39 flag 8: wandlock@144,592 cleared: L39 flag 8: wandlock@144,592 cleared
+Level 038 - Chest: Seal
@@ -86,8 +86,8 @@
 L62 flag 0: lightpole@120,200 cleared: L62 flag 0: lightpole@120,200 cleared
-Level 063 - Chest: Seal
 L63 flag 7: lightpole@112,272 cleared: L63 flag 7: lightpole@112,272 cleared
+Level 063 - Chest: Seal
```

Both are reorders inside one sphere. The `.archipelago` changes 41595 → 41651 B.

## ER

- The producer (`make-seedling-er-preset.mjs`, seed 1) **re-draws**. Placements 0–11 are the same; 12–49 differ. The L11 stairs pair
  is now drawn vanilla (`level_10 <-> level_11`), where it was `level_11 <-> level_99`. The tree's draw is accepted at
  attempt 0. The draw is a function of the compiled binding (exit names and their regions), and L11's stairs exit is now
  `level_11__r4c2 -> level_10`.
- **The committed draw stays beatable** (`tools/er-replay-committed-draw.mjs`, `er-committed-draw-tip.txt`). Its 50 placements
  map to the tree's doorways and are applied over the tip atlas with the mode's own `applyPlacements`, compile hook,
  `beatability` and `hooks.checks`: landing-set problems 0, **beatable, 90 spheres, checks pass**. Under it the routes move
  exactly as in the playthrough (8, stricter).
- I committed the producer's re-draw, because the producer cannot pin a draw: the committed preset must be the producer's output, or
  `regen --check` and the ER certifier refuse. Keeping the committed draw needs a producer change (a placement pin), which
  the planner should rule on.

## Certifier (`probe-seedling-whole-game-certify.mjs --arms=new`, local node, 4 shards)

| arm | base (f9010498) | tip |
|---|---|---|
| vanilla | `ARM new: 1 problems (derived-true/atlas-false 1, …) / 16 accepted / 0 threw; 100 row(s) skip unadmitted landing points; clean 114/115; 845 lines` | `… 1 problems / 13 accepted / 0 threw; 103 row(s) skip …; clean 114/115; 848 lines`, ALL CHECKS PASSED |
| `--source=er` | `1 / 16 / 0`, 100 skip, 846 lines, matches its expected file | `1 / 13 / 0`, 104 skip, 849 lines. Before the re-record it read `FAIL … accepted: expected 16, measured 13`. After it: `PASS: the ER arm matches … (1 / 13 / 0)`, ALL CHECKS PASSED (`runs/cert-tip-er-repinned.txt`) |

- The problem row is the same on both: `level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,L63 flag 7: …]: derived true, atlas false` (OPEN_L63).
- Accepted rows that GO (vanilla and ER alike): `level_63__r6c9 → level_63__r5c14` ×3 (`Ghost Spear` / `Progressive Swim` /
  `no AP crossing …`). Renamed: `level_63__r5c14 @ Level 063 - Chest` → `level_63__r6c15 @ …` ×3. L63's chest cell is no longer a
  sub-region, so the crossing into it is gone.
- **Model-lag rows: none.** The brief expected maze-looser rows at L11/L25/L38/L80 while `levelWorld` lags. None appear,
  because the maze reads the same grid (`entry_gates`), so it is as strict as the rules.
- Skip rows 100 → 103: L38's upper half r0c9 is entered only from r8c9 and from L39's landing (9,1). Its press, the press's
  [own event] and its door into L39's pocket are priced from that landing and skipped by name (`deriveLevelWorldLogic.slow.test.js`).
- On the way (fixed, not shipped): the first rule had no `pocketReentry` and raised 6 problems at L40
  (`level_40__r26c13 → level_40__r0c53 … derived false, atlas true`, …). That came from walling the walk back down out of the fire alcove.

## `--check` lines

`regen-seedling.mjs --check` at the tip (`regen-check-tip.txt`): rules OK · partition OK · world OK · template OK · host-settings OK
· seed1 OK (4 files + the seedling_playthrough row) · maze OK · er OK · sphere-order OK · census OK (2 SKIP rows) → **every step OK**.
Also: `refresh-seedling-derived-rules.mjs --check` → `OK: the committed derived-rule table is fresh and on count`.
`census-seedling-constants.mjs --check` → PASS, 0 drift. `generate-procgen-reference.mjs --check` →
`ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`. `make-seedling-vanilla-overlay.mjs --check` (inside its test) OK.

## Derived-rule table, before and after (REGEN_RECIPE; designer review owed, `tile-primitives-design-8`)

Procedure: the committed table names `level_10|level_10 -> level_11`, which the L11 split renames, so the rules step refuses.
I compiled once with a **throwaway** `partial` switch on `applyDerivedRuleTable` (an env var, reverted; `seedlingDerivedRuleTable.js`
is not in the engine closure). Then I re-derived with `probe-seedling-derived-rules.mjs --shards=2`, installed the table, ran
`regen --write` with no switch, and re-derived again. The second table is **byte-identical: a fixed point**. `measuredAt` is set
to `2a4dd25af9`, the commit the measurement ran on; CI would write its own SHA.

Counts 99 rows / 47 regions / 6 excluded → 98 / 47 / 4. Inputs: payloadMd5 `e705ea93…` → `89c51069…`; engineMd5 and
witnessMd5 unchanged. **VERDICT MOVES**, each derived from the split (every rule is `True_`):

| verdict | element | derivation |
|---|---|---|
| DEL | `level_10|level_10 -> level_11`, ADD `level_10|level_10 -> level_11__r4c2` | rename: L10's stairs land under the chest (r4c2) |
| DEL | `level_11|@Level 011 - Chest`, `level_11|level_11 -> level_10`, `level_11|level_11 -> level_3__r8c6` | L11 is two sub-regions; their elements are not exact (internal-only / walk-in), so the composed rule stands |
| DEL+ADD | `level_28__r0c6 -> level_25__r2c7` → `-> level_25__r7c6`; ADD `level_25__r7c6|@Level 025 - Chest`, `level_25__r7c6 -> level_28__r0c6` | L28's door lands in the new chest pocket r7c6 |
| DEL+ADD | `level_38|@Level 038 - Chest`, `level_38 -> level_37__r0c18` → the same under `level_38__r8c9` | L38's lower half |
| EXCL DEL | `level_38|@L39 flag 8: …`, `level_38|level_38 -> level_39__r25c9` | their region `level_38` no longer exists. The elements are now in r0c9, which is not exact (entered only internally or from L39's landing) |

No row becomes looser. Every removed row was `True_` and now takes its composed rule.

## engineMd5

`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`, run from a base worktree (origin/main f9010498, with
`frontend/modules/shared` at its pointer 71b77de) and from the tip tree (every submodule initialized, no pointer moved):
`engineMd5 74ae60f575531492ed9eaec1839e1fe3 (42 files)` at both, and the 42-file lists are identical (`runs/engine-closure-*.txt`).
No touched file is in the closure (diff ∩ closure = ∅). So there is no engineMd5 mover, and no perf or L40-against-900 s owed
(designer term 3).

## Pull discs (designer term 1) and the pull-disc tree (designer term 2)

`tools/pull-discs.mjs` gives every LavaTrap disc as the producer cuts it, and again with every chest tile added to the line test's
solids (the shut-chest reading):
- **main, base and tip**: identical. **L80** trap (5,6): disc 12, yields 0. Trap (2,14): disc 11, yields 0. With the chest (1,8)
  as Solid: **cut []** for both, so yields/pass/class are unchanged. Both traps are ≥ 4 tiles from the chest, and the 32 px disc's lines
  never cross (1,8). No other trap level has a chest (L77, L78, L108: none).
- **origin/tile-pixel-pull-disc @a0549448bd**, in a separate read-only worktree with this slice's overlay and semantics diff applied as a
  throwaway (it applies cleanly). L80 discs are 20 and 18 tiles there, identical with and without the change, and **cut []** with
  the chest as Solid. Routes, from that tree's rules and maze producers with the same partial bootstrap: **the same 8 stricter
  rows** as on main (`routes/pd-seedling_playthrough.txt` equals `routes/seedling_playthrough.txt`; maze likewise).

## Readers that find a chest location's apitem in `botMobiles` (`cls: "Pickups::APItem"`)

On p4h an `APChest` is an `Entity`, not a `Mobile`, so these lose the row (none edited here; js-22's p4h integration owns them):
1. `scripts/procgen/check-seedling-ap-placement.mjs` (SUBJECTS rows, `:766` "rewritten holds an APItem"; header `:38` names
   `chest@L40 → Pickups::APItem@888,824`). Every chest location in a warp room is asserted as an APItem. **Must move** to
   `botActivators().chests` for chest rows when p4h is the default. A probe, not runtime.
2. `scripts/procgen/probe-seedling-l25-apitem.mjs` + `fidelityL25ApItem.test.js` (`{25,0}` cleared on OVERLAP from the
   north-east). The brief notes that the four arms **invert on p4h**. Green on p4g.
3. `frontend/modules/seedlingDemo/wasmPlayback.js` `adoptionRefusal` (`INERT_MOBILES`, `:313-330`): a non-inert mobile class in
   the room refuses adoption ('mobiles'). Today a chest room's `Pickups::APItem` row is such a refusal. On p4h that row is gone,
   so adoption may start succeeding in chest rooms. Runtime, not capability-gated. **Behaviour moves on p4h**, and needs a decision.
4. `frontend/modules/flashPanel/seedlingRandomizerWiring.js` `readWorld` (`:490`) and `seedlingWasmPlayback.js` (`:737`) read
   `botMobiles` only for the Player row and the roster size, so they are not affected beyond the size.
5. Not chest readers (checked): `probe-seedling-f2-apitem.mjs` / `fidelityF2` (generated presets, no `kind`);
   `seedlingGeneratedSet.js` / `seedlingGenRegionRoundTrip.js` (generated rooms write `{tag, look}`, so they stay APItem); every other
   `botMobiles` probe in `scripts/procgen/` (enemies, blocks, the player).

## Bounded vitest (no unfiltered run)

The list is every test file that reads the delivered set, the rewriter, the overlay or semantics, a moved preset, the playthrough atlas,
the partition, the derived table or its expected file, the ER expected file, `atlas_files.json`, the frontier or the L25 witness, plus
the brief's named files (`runs/vitest-list-default.txt`, 206 files; `runs/vitest-list-slow.txt`, 6 files). It includes the
rewriter's and `apChestDelivery`'s tests, `seedlingMountKeyLevelSet`, `seedlingDivergenceLegs`, `deriveLevelWorldLogic` (+ `.slow`),
`derivedRulesProbe`, `refreshSeedlingDerivedRules`, `derivedRuleTableFresh` and `fidelityL25ApItem`.
- Default tier: **206 files, 4224 tests, all pass** (`runs/vitest-bounded-default.txt`).
- Slow tier (`vitest.slow.config.js`): **6 files, 82 tests, all pass**. The first run failed `deriveLevelWorldLogic.slow` (the L63
  rename and L38's 3 skip rows, re-recorded) and `omsiTestPresetProducers.slow`. The omsi failure was my setup: the brief's
  submodules were not initialized yet. After `git submodule update --init …` (no pointer moved) it passes.
- First pass at the tip: 29 files / 53 tests red. Every one was a pin on the moved atlas, presets or region names, re-recorded below.
  None was a semantic regression after `pocketReentry`.

## Every pin re-recorded, and why

By recipe: atlas `seedling-playthrough.json` (id `b856f0fc` → `402c4685`, md5 `5c3dd651…` → `853cae84…`), partition, the world
package, the template, all four presets, the sphere order, the derived table, `seedling-constants-census.csv` + its doc region
(`--write`: my new `DELTA` literals), the vanilla overlay fixture (`--write`: `5897516c` → `ff57646b`; L63/L80 chests now lift
`Has(Dark Suit)` and the K arm, **stricter**), and the divergence door-leg keys (its `rerecord` recipe: 827 → 817; 19 one-region legs
through a chest go, 9 within-sub-region legs come; named in the fixture).

By hand, as the k-pursuit precedent did: `campaign-frontier.json` source md5 for AP_1 (`51023885…` → `8843c8e9…`, never
`--write-frontier`), `atlas_files.json` and the atlas-id pins (`levelSetExporter`, `seedlingAtlasDoorCensus`, `watchSetIdentity`'s
comment), and the mount keys (`seedlingMountKeyLevelSet`, measured with its own `seedlingMountKey`: seedling_er `659b0854…`,
seedling_playthrough `a42c3909…`, seed 1 `5d9153df…`; the other five hold).

Measured counts:
- `seedling-derived-rules-expected.json`: 18 leaves, from the local probe; each block's `$comment` names them. Certifier accepted
  16 → 13. Labels and route-A counts move by the split.
- `seedling-er-whole-game-certify-expected.json`: accepted 16 → 13, the same L63 lines.
- The L25 oracle: re-recorded on p4g, see Stops (3).

Test pins, each with a `⛓ rules-ap-chest-solid` comment saying why. They are count, name or id moves of the split:
- `flashSeedlingAtlasKnob` zones 191 → 194; `seedlingAtlasArm` 306 → 307; `seedlingAtlasDoorCensus` [115, 62, 254, 489, 208],
  swim levels 23 → 24, uncertified 18 → 19, Swim rows 166 → 167, K rows 75 → 73; `levelSetExporter` 60 → 62.
- `mazeConverted*` / `mazeSeedlingLink` 190 → 191 room-less, holders 59 → 61, `entry_gates` rooms 41 → 48; `mazeInputOutputSplit`
  19 → 20 (L11).
- `vanillaOverlay` 16,007 → 16,702 B, 30 → 32 rules, guarded 12 → 14, free locations 36 → 34; `seedlingErMode` 'placed' refusals
  {9, 6} → {4, 5}.
- Renames: `jsRuntimeVerbs`, `mazeSeedlingSprites`, `mazeLatchArt`, `mazeLinks`, `seedlingLogicalLinks`, `seedlingPlaythroughObstacleEvents`
  (L38 side `level_38__r0c9`), `seedlingPlaythroughLocationCrossing` (+ L63/L80 rebinds), `certifyLavaPulls` (9 → 8), `certifyPocketTalk`,
  `deriveLevelWorldLogic`.
- `seedlingNoHitDirectionalGates`: + one sub-region per one-sided Solid, read off the overlay, L25.
- `seedlingPlaythroughLogicalLinks`: the one-way free row through a one-sided Solid is a legitimate ruleless row, read off the overlay
  (L11, L25, L38). `regionAtlasLevelWorld`: a location on an unowned crossing cell is owned by its binding (`boundAt`), L15 (9,6).
- `sphereOrderLevels` / `certifyEventLocations` (L38/L39/L40 sets): + L37, since L38's lower half is entered only from it. Without it
  the certifier prices the upper half from no arrival, a partial-world framing row.
- **Weaker mutant (say so):** the "pocket doors stripped" mutant now catches 1 row instead of 2. The way into L39's pocket is
  priced from L39's landing, a row the certifier does not judge. The way back is still caught.
- New unit rows: `seedlingPlaythroughOverlay.test.js` (the chest row) and `seedlingSemantics.test.js` (probe S on L11; L40's alcove
  re-opened only without a landing in it; walled with no `arrivalTiles`; a BossLock never takes the path).

## The census (`tools/census-seedling-chest-open-side.mjs`, copied from `claude/rules-chest-open-side-a85wp3` into the evidence dir only)

At base it reproduces the earlier slice's table: **FIRES at L11, L25, L38, L80**, 16 of 16 chests delivered as apitems
(`census-base.txt`). At the tip its "today" grid already holds the rule, so its FIRES column means nothing there
(`runs/census-tip-raw.txt`, kept only for completeness). The route walk above is the tip's measurement. No gate runs the census, so
it is not in `scripts/procgen/`.

## Stops and deviations (for the planner)

1. **ER draw moved** (brief: "keep the committed draw if it stays beatable, else STOP"). It stays beatable, but the producer re-draws.
   Committed: the producer's draw (beatable, accepted at attempt 0). To keep the old draw, the ER producer needs a placement
   pin. That is a ruling, not a recipe.
2. **A certifier move beyond model-lag rows**: accepted 16 → 13, all at L63's chest. L63 is also a key-walk mover outside the four
   levels, though no route moves. The cause is general: a chest cell is now a one-sided crossing, never a sub-region, so the chests
   that were one-tile sub-regions (L63 r5c14, L80 r8c1) re-bind beside their open side.
3. **`fidelityL25ApItem` red → re-recorded on the game.** The brief said to report rather than edit if it reds. It reddened only on the
   delivered set's id, because the bytes moved with `kind`, and on the D1 attrs row. I re-ran the probe's own `--record` on
   `seedling_bot_ap_p4g` (box lock, dev server 8000): 4 of 4 arms, the same tick, take and 0 px. Only the set id moved in the oracle. Its four
   arms still hold the p4g semantics.
4. No LOOSER row, no engine-closure change, no level literal (the 3 L11/L25/L38 lists in the tests are measured pins, read off the overlay).
5. (First pass) A far side with a landing stayed walled after an earlier opening. Now exact: § Latch.

## What I did not run

- The p4h game (no p4h page in this container).
- CI: the planner dispatches `train_only` and the full battery.
- The train and calib tiers, `npm test` browser batches, `Generate.py` outside the chain, and the unfiltered vitest.

The bootstrap reached READY. No submodule pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling` (objects only), or
`.github/` changed.
