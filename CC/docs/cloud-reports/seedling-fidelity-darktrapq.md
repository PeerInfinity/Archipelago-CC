# Seedling fidelity DARKTRAPQ — the L62/L63 darktraps are crossed by the two cross-room buttons, not the Spear

Wave 18 (model coverage), planner `seedling-fidelity-planning-8`. Session `seedling-fidelity-darktrapq`. **MEASURE-ONLY.**

| | |
|---|---|
| start | **`d1fbfeffc2`** (= main, wave 17 harvested OFF), as briefed |
| harness branch | `claude/darktrap-crossing-l62-djqlsm` |
| commits | `60db92ad` D1 evidence · D2 (this report + the evidence's last rows) |
| verdicts | **D1 PASS · D2 PASS — verdict (b) with a twist: crossable WITHOUT the Spear, but not in the room as staged.** The crossing needs a press made in ANOTHER room first. That is a RULES gap of the EVENT kind (no item is owed), exactly like the existing `flag:L39:8`. The solver already executes both presses. |
| tracked change | **none** (`git diff d1fbfeffc2 --stat -- . ':!CC/docs/cloud-reports'` is empty) |

**The one thing to know first.** Seedling has four cross-room `ButtonRoom`s (`ButtonRoom.as:93`, `setPersistence(t, persist, room)`).
The rules arc models the two in L38. **The other two are the whole L62/L63 cluster:**

* **L63 `buttonroom@32,64`** {room 62, tset 0, flip 1} writes **`{62,0}`**, the tag of **L62 `lightpole@120,200`**. The pole then
  boots lit (`LightPole`: `activate = !Game.checkPersistence(tag)`), and `darktrap@112,208` dies on entry.
* **L61 `buttonroom@176,40`** {room 63, tset 1, flip 1} writes **`{63,1}`**, the tag of **L63 `lightpole@64,88`**. That pole kills
  **both** `darktrap@64,96` and `darktrap@80,64`.

Both buttons stand in Spear-free regions (L63 `r0c1`'s left column; L61 `r0c10`), and those regions reach L62's bottom by `True_`
teleporters. So Dungeon 6 is designed to be crossed without the Spear: the Spear itself lies past `darktrap@112,208`, in L64.
Staged with the button's write, **all 12 sweep legs and survey step 106 solve in node and replay on the game at 0 px with 0 hits.**
Staged without it, nothing in the room crosses. Contact is blocked, the dash is blocked, and so is every other light source. The
rules give `level_62` one region and `True_` exits, so the route never presses the buttons, and every leg is staged without the write.

---

## W0 — bank (`d1fbfeffc2`, this tree, port 9687)

W0_TABLE

Because nothing tracked changes, every row above is also the AFTER. Byte-inertia is the empty tracked diff.

---

## D1 — the game (PASS)

**Instrument.** A scratch probe, `seedling-fidelity-darktrapq-evidence/gamerun.mjs.txt`. It holds the box lock (`kind:
browser`) and asserts the logic-only channel. It runs a tape on `seedling_bot_ap_p4f` (headless) and polls `botMobiles()` +
`botStatus()` (player, `hits`, `persistence_cleared`, every DarkTrap's anim). It replays the same tape in the model at the
**defaults** (`createTapeStepper`, `darkTrapLight` ON) and compares the player at every sampled tick. The tapes were authored
closed-loop against the model (`author.mjs.txt`), or are the solver's own `twoPassSolve` answers (`solveleg.mjs.txt`,
`solvestep.mjs.txt`). Staging is the sweep row's own: `arrive`, `seam` (items, `hits_max` 3, `time`), and `granted` → persistence.
The items are Sword, Shield, Fire, Torch ("Light") and Swim, with no Spear.

### The geometry (the atlas, `buildLevelWorld`)

L62's top (the arrival from L64 at (112,80) and the (112,64) teleporter) joins the bottom (teleporters (48|96,304) → L61 and
(192|240,304) → L63) through ONE tile chain: column 7–8, rows 9–14, then (7,14) → row 15. The trap's 16×16 box (`SandTrap`:
`setHitbox(16,16,8,8)` at (120,216)) sits exactly on tile (7,13). Row 14 holds only (7,14), and its neighbours (6,13)/(8,14) are
pits. The player's box is 4×5 (`normalHitbox (2,2,4,5)`), and its pit test is a point (`nearestToPoint("Tile", x, y+1)`). To get
from (8,13) to (7,14) without overlapping the trap, it would have to move more than 2 px in x and 3 px in y in one tick, past the
pit corner. The walk speed is 0.5–1.5 px/tick. In L63 the same holds at both traps: each trap's tile meets a Body Wall corner
with zero gap ((80,80) for `@80,64`, (80,112) for `@64,96`).

### The attempts (each a tape + outcome; `seedling-fidelity-darktrapq-evidence/<name>.json`, index in `index.json`)

| # | attempt | game outcome | model (defaults) |
|---|---|---|---|
| W1 `a2` | L62, unlit, walk down into the trap | hit t209 (knocked up 3 px), **frozen**: `Player.input` moves only `if (hitsTimer <= 0)` (20 t). Hit 2 at t232. The third contact kills: respawn at (120,88), t257 | **0 px over 321 sampled ticks** |
| W1b `w1b` | L63, unlit, walk right into `darktrap@80,64` | hits at ~t54 and ~t85, frozen each time. The third kills (respawn by t120). Never past the trap | refuses at t54: the hit's `Game.shake` puts `jellyfish@160,64`'s on-screen test in the cosmetic band (⚖ not modelled). Game-only evidence past t53 |
| W1c `w1c` | L62, unlit, sword DASH into the trap (the best of 72 press timings searched in the model, `dashsearch.mjs.txt`) | reaches y 208.46, 2.5 px into the box (it must reach ≥ 226), and is frozen there through the i-frames. Hit 2 at t232, killed at t~258. **The dash adds speed before the hit, and knockback is ADDED to v, away from the trap** | **0 px over 301** |
| — | another light source in L62 | none reaches the trap. `DarkTrap.update` takes a `Light` within `radiusMin` that is not a `PlayerLight` (the "Light" item is `hasTorch` → `PlayerLight`, `Player.as:495`) and not dark. L62's lights are `planttorch@120,152` (≈61 px), the torches/bonetorch (≥ 80 px), `orb@216,280`, and the pole. Fire passes `"Fire"` to `genericHit`, and `DarkTrap.hit()` is empty. No `Grenade` in L62 | (AS3 read) |
| W3 `w3` | L62 booted with **`{62,0}`** cleared, top → (192,304) | pole lit at the build. The trap plays "die1" by t40, is removed by t80 (`{62,1}` written), and the walk crosses with **0 hits** to L63 at t396 | **0 px over 427** |
| W2 `w2` | L63 from (16,16): press **`buttonroom@32,64`** → (16,0) → L62 → up to L64 | the press at t55 writes **`{62,0}`** (and its own `{63,0}`). On L62 entry (t144) the trap dies (die1 t180, removed by t217). L64 at t~565, **0 hits, no Spear** | **0 px over 583** |
| W4 `w4` | L61 from (168,24): press **`buttonroom@176,40`** → (224,48) → L63 left column → through both trap cells → (64,0) → L62 | the press at t35 writes **`{63,1}`** (and its own `{61,1}`). On L63 entry both traps die at once (die1 t144, removed by t175: `{63,2}`, `{63,8}`). Passing L63's button at t130 also writes `{62,0}`. **0 hits** | **0 px over 364** |
| W5 `w5` | L63 booted with `{63,1}`, column 4 (64,16) → left column → (16,0) → L62 (legs 574–576's direction) | both traps die. **0 hits** | **0 px over 296** |
| `s106-lit` | survey step 106's staging + `{62,0}`, re-solved by `twoPassSolve` (269 t) | L64 with 0 hits | **0 px over 270** |
| `leg<N>-62_0` ×7 / `leg<N>-63_1` ×5 | every one of the 12 sweep legs' staging + the button's write, re-solved | each reaches its exit's level, **0 hits** (table below) | **0 px, all 12** |
| `ev62` / `ev63` | the solver's EXISTING cross-room arm (`execClearTag` → `execCrossRoomPress`, CROSSROOM D3) handed a `clear-tag` goal per button | `{62,0}` written at t22 (84 t, from L63 (16,48)); `{63,1}` at t19 (42 t, from L61 (208,48)) | **0 px** (85 / 43); the model's ledger ticks 21 / 18 |

**Mutants (predicted first).**
- **M1** (switch only, no edit): `darkTrapLight` OFF for the model replay of the recorded tapes. *Predicted:* the model takes a
  contact hit where the game walks through the dead trap. *Measured:* the first divergence is a model `hits 1` at the trap.
  W3 diverges at t209, W2 at t308, W4 at t215, step 106 at t90, leg 560 at t167. W5 and leg 576 then refuse on the shake band at
  t54/t39. The defaults: 0 px. (`mutant.mjs.txt`)
- **M2** M2_ROW

---

## D2 — the verdict (PASS): crossable without the Spear → a rules EVENT gap (no item), plus a model sub-order sentence

### The 12 legs (sweep 38926058850), as staged and with the write staged

| leg (match by KEY) | refuses at | as staged (node `twoPassSolve`) | + the write | game, + the write |
|---|---|---|---|---|
| 539 `level_62 <- in_L61_112_0 -> exit:out_teleporter_112_64` | `darktrap@112,208` | REFUSED (same text as the sweep) | `{62,0}`: SOLVED 269 t | L64, 0 hits, 0 px |
| 544 `level_62 <- in_L61_160_0 -> exit:out_teleporter_112_64` | `@112,208` | REFUSED | SOLVED 222 t | L64, 0 px |
| 549 `level_62 <- in_L63_16_0 -> exit:out_teleporter_112_64` | `@112,208` | REFUSED | SOLVED 266 t | L64, 0 px |
| 557 `level_62 <- in_L64_32_96 -> exit:out_teleporter_48_304` | `@112,208` | REFUSED | SOLVED 263 t | L61, 0 px |
| 558 `level_62 <- in_L64_32_96 -> exit:out_teleporter_96_304` | `@112,208` | REFUSED | SOLVED 237 t | L61, 0 px |
| 560 `level_62 <- in_L64_32_96 -> exit:out_teleporter_192_304` | `@112,208` | REFUSED | SOLVED 258 t | L63, 0 px |
| 561 `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304` | `@112,208` | REFUSED | SOLVED 282 t | L63, 0 px |
| 565 `level_63__r0c1 <- in_L61_224_96 -> exit:out_teleporter_64_0` | `darktrap@64,96` | REFUSED | `{63,1}`: SOLVED 162 t | L62, 0 px |
| 569 `level_63__r0c1 <- in_L61_224_48 -> exit:out_teleporter_64_0` | `@64,96` | REFUSED | SOLVED 198 t | L62, 0 px |
| 574 `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_0_48` | `darktrap@80,64` ("hold stance (buttonroom@32,64)") | REFUSED | SOLVED 219 t | L61, 0 px |
| 575 `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_0_96` | `@80,64` | REFUSED | SOLVED 163 t | L61, 0 px |
| 576 `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_16_0` | `@80,64` ("hold stance") | REFUSED | SOLVED 235 t | L62, 0 px |

The node solves are `twoPassSolve` without the page's anytime budgets. They say "the model can"; they are not a sweep row
(the sweep's request carries `seam.time` and the worker's budgets).

### (b) — the mechanism, the witnesses, and who refuses it

- **Mechanism.** A pole's light comes from its PERSISTENCE (`LightPole()`: `activate = !Game.checkPersistence(tag)`). A cross-room
  `ButtonRoom` press writes that tag false (`flip 1`), and the pole boots lit on the next entry. `DarkTrap.update` then starts
  dying on the first tick (`deathCounter` 30 → "die1" → `FP.world.remove`, which writes its own tag: `SandTrap.removed()`).
- **Witness tapes / ticks / positions.** L62: `w2` (press t55 at (41.95,~70), entry t144 at (200,296), trap removed by t217,
  crossing (7,13) at t~315, L64 t~565). L63: `w4` (press t35 at (185.95,48.56), entry t102 at (24,56), both traps removed by
  t175, crossing (4,6) at t~216 and (5,4) at t~276). Both 0 px against the model.
- **The model already models every tick of it.** It banks cross-room writes (`levelRun`'s CROSSROOM D2 `crossRoomWritersOnto` →
  `pendingEarnedClears` → `applyEarnedClears`). It lights the pole from persistence and kills the trap (`darkTrapLight`, ON). Its
  solver presses the button when asked (`execCrossRoomPress`). **Nothing in the model refuses the crossing once the write exists.**
- **What refuses is the STAGING, and behind it the ROUTE.** Each leg is staged from the route's `granted` list, which carries
  events like `L39 flag 8: wandlock@144,592 cleared`. No event exists for these two writes, so no leg and no survey step carries
  them, and the in-room ladder rightly finds nothing.

### The hand-over to the RULES arc (no item is owed; two EVENTS are)

Model it on `flag:L39:8` (`Locations.py`'s event with `action: {verb: "press", item: null, presser: {...}}`, and the exit's
`Has(<event>)`):

| event (flag = what the PRESS writes) | presser (region) | obstacle it clears | the exits it gates (each `Or(Has(event), Has("Ghost Spear"))`) |
|---|---|---|---|
| **`flag:L62:0`**: "L62 flag 0: lightpole@120,200 lit" | L63 `buttonroom@32,64` {room 62, tset 0, flip 1}, in **`level_63__r0c1`** (the left column: (16,0), (0,48), (0,96), the button at tile (2,4)) | `darktrap@112,208` (its own tag is `{62,1}`, written at its removal) | **split `level_62`** into **top** = {arrival (112,80) from L64, `-> level_64`} and **bottom** = {`-> level_61__r0c7`, `-> level_61__r0c10`, `-> level_63__r0c1`, `-> level_63__r0c1 #2`}. Gate top↔bottom (both directions) on the event. The bottom's exits stay `True_` from the bottom. |
| **`flag:L63:1`**: "L63 flag 1: lightpole@64,88 lit" | L61 `buttonroom@176,40` {room 63, tset 1, flip 1}, in **`level_61__r0c10`** | `darktrap@64,96` (tag 8) and `darktrap@80,64` (tag 2) | **split `level_63__r0c1`** into **left** = {(16,0)→L62 (192,288), (0,48), (0,96), arrivals (16,48)/(16,96) from L61, the button} and **column 4** = {(64,0) ↔ L62 (240,288)}. Gate left↔col 4 on the event. |

Why the Spear is the other disjunct: the in-room light arm (`Player.genericHit`, `t == "Spear"`) still lights the pole. Both
pressers are reachable `True_` from the L61 hub, so the logic stays satisfiable with no new item. **The fix is a ROUTE ORDER the
logic has to state, or the route survey will never take it.** The CROSSROOM docblock (`fidelityCrossRoom.js`) counts "the game's
four cross-room buttons" and witnesses the two in L38. These are the other two.

- ⚠ The event's `tag` must be the POLE's (`{62,0}` / `{63,1}`). `execCrossRoomPress` refuses unless `presser.room === flag.level
  && presser.t === flag.tag && presser.flip`. The darktrap's own tag is the consequence, not the press.
- The goal shape that solves today (measured, `ev62`/`ev63`): `{kind: 'clear-tag', tag: {level: 62, tag: 0}, at: {x: 120, y: 200},
  obstacle: 'lightpole@120,200', presser: {level: 63, class: 'buttonroom', x: 32, y: 64}}`, and the same for `{63,1}` with
  `lightpole@64,88` and the L61 presser. This is the survey's `clearTagGoal` shape.

### The model sub-order sentence (a brief for a later model slice: diagnostics only, no behaviour)

`solverBot.deriveLightPole` (`solverBot.js:17439`, the sentence at `:17458`) refuses with *"only a `"Spear"` hit lights a pole … ⇒ the Spear is a SUB-ORDER
the route owes"*. That is half true: `levelRun`'s own `crossRoomWritersOnto(level, pole.tag)` names a second writer. The sentence
(and, optionally, a new field on the light arm's refusal, e.g. `obstacle.subOrders: [{kind: 'item', item: 'hasSpear'},
{kind: 'cross-room-press', presser: {level: 63, class: 'buttonroom', x: 32, y: 64}, writes: {level: 62, tag: 0}}]`) should list
both, so a refusal points the route at the press. **Not built (measure-only).** If built, it is an OPTIONAL refusal field
for the JS arc to wire. No behaviour moves, so no survey row moves on it alone.

### L63's `darktrap@80,64` (and `@64,96`)

These are the same class and the same verdict. The light is L63's pole (tag 1), lit by **L61's** button (the L63 button lights
L62, not L63). The brief's "(buttonroom stance)" on 574/576 is the solver walking over L63's own button on the way to the
left-column exits. That press does not help L63.

---

## The survey/sweep rows this moves (before → after), and the dispatches

**Nothing moves from this slice** (no tracked change). What moves once the rules arc lands the two events, as measured in node
and on the game:

| row | before (CI) | after (with the event's write staged) |
|---|---|---|
| survey step 106 (L62 (48,288) → (112,64) → L64, the Ghost Spear's room) | REFUSED, LADDER, `darktrap@112,208` | **SOLVED 269 t**, 0 px on the game. The route gains one event step before it (L61 → L63 left column, press `buttonroom@32,64`, → L62), so step ids shift: compare by (level, goal, boot). |
| sweep legs 539 544 549 557 558 560 561 | failed, `darktrap@112,208` | SOLVED (222–282 t) |
| sweep legs 565 569 574 575 576 | failed, `darktrap@64,96` / `@80,64` | SOLVED (162–235 t) |
| sweep legs 541, 551 (bonetorch pit start), 554, 573 (deadline) | failed | **not this cluster**: unaffected |

**Dispatches for the planner** (cloud sessions get 403), on the rules arc's head once the events are in:
1. `seedling-survey.yml` on that branch, `-f through=end -f route=full -f base_run=38926053841`. Expect the step-106 row
   (match by level 62, goal reach-exit (112,64), boot (48,288)) to go REFUSED → SOLVED, and two new event rows (L63 `clear-tag
   {62,0}`, L61 `clear-tag {63,1}`) to SOLVE.
2. `seedling-divergence-sweep.yml` on that branch at the defaults (no `contact_fidelity` input), compared to 38926058850 BY KEY.
   Expect the 12 keys above failed → done or crossed. If the leg roster changes with the region split, re-derive with
   `node scripts/procgen/seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks` and match by key.
3. Optional, confirming this slice's staging on CI before the rules land: none is needed. The 14 witnesses above ran on the game.

---

## The JS arc / the hammer arc

- **JS arc (`seedling-js-planning-6`):** no pin moves and nothing to wire from this slice. If the sub-order field is built later,
  it is an OPTIONAL `SolverRefusal.obstacle` field. One observation for the leg derivation: legs **557/558/560/561** (arrival from
  L64, no Spear, `darktrap@112,208` alive) stage a state the game cannot reach. The only way to the top of L62 is through the trap,
  so a Spear-less arrival there implies the pole is lit (`{62,0}`) or the trap removed (`{62,1}`). With the rules' event in
  `granted`, the derivation stages it by itself.
- **Hammer arc:** nothing handed over. No hammer region is involved (`deriveLightPole` and `levelRun`'s cross-room ledger are
  outside its list).

## Deltas

- No tracked file changes. Evidence only: `CC/docs/cloud-reports/seedling-fidelity-darktrapq-evidence/` (24 witness digests
  with their tapes, `index.json`, the sweep's failed L62/L63 rows, and the scratch instruments as `*.txt`).

## What the brief got wrong (measured)

1. **"12 failing legs in L62/L63 refuse at `darktrap@112,208` (L62)."** Seven do. Five are in L63: two at `darktrap@64,96`
   (565, 569) and three at `darktrap@80,64` (574, 575, 576). Four more failing legs in the same regions are a different cause:
   541/551 (A* start on a pit, `solid:bonetorch`) and 554/573 (the anytime deadline).
2. **"The LOGIC says no Spear is needed."** That is true, but the logic is incomplete. The crossing needs an EVENT (a cross-room
   press) that the rules do not state, and without it the route never makes the press. "No Spear" ≠ "nothing".
3. **"Only a 'Spear' hit lights a pole"** (the refusal text, quoted as the game's rule). That is the IN-ROOM rule. A pole is
   also lit by its persistence tag, and two cross-room buttons write exactly these two poles' tags.
4. **"L63's `level_63__r0c1 -> level_62` through `darktrap@80,64` (buttonroom stance)."** The stance is L63's own button,
   which lights **L62**. L63's traps are lit by **L61's** button.
5. The brief listed "a contact hit taken through the trap" and "a path the tile planner misses" as candidate routes. Both are
   refuted on the game (W1/W1b/W1c; the zero-gap corners). The tile planner's "different connected components" claim is the
   game's geometry.

## Residue

- Survey step 107 (L64, "a sword press at tick 43 would fire on a FROZEN tick") is another refusal on the same detour. It is
  not this cluster, and nothing was measured here.
- The model-side sub-order sentence (above) is not built.
- W1b is game-only past t53 (the shake band). The contact class is witnessed at 0 px in L62 (W1, W1c).

## Byte-inertia

`git diff d1fbfeffc2 -- . ':!CC/docs/cloud-reports'` is empty. The W0 bank is therefore also the AFTER.

## Rows to BANK

- **Trap candidate:** "a darktrap refusal that says 'the Spear is a SUB-ORDER' while a cross-room `ButtonRoom` writes the
  pole's tag": check `crossRoomWritersOnto(level, pole.tag)` before naming an item.
- **Fact:** the four cross-room buttons are L38 `@144,288` (→ {37,4}), L38 `@32,48` (→ {39,8}), **L61 `@176,40` (→ {63,1})**
  and **L63 `@32,64` (→ {62,0})**. Only the first two had rules events at `d1fbfeffc2`.
- **Fact:** `Player.input` ignores movement keys while `hitsTimer > 0` (20 t), and contact knockback (force 3) is added to `v`
  away from the body. A 16×16 static contact body on a one-tile chain is uncrossable by contact at any walk or dash timing (W1,
  W1c: 0 px).
