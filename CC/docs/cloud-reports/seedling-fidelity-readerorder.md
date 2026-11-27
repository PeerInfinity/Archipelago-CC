# seedling-fidelity-readerorder: the reader-before-responder pairings, witnessed (planning-25, wave 64)

**Verdicts. (A) `PushableBlock*`: GAP. (B) `Spinner` / `WallFlyer`: GAP.** Both are game-witnessed on p4g in a staged
L38, and every control is 0 px. **No committed tape reaches either gap.** The reader probe finds 0 queries over 322
tapes, and the scratch arm that switches the read moves 0 tapes.

**The one thing to know first: the read alone does not close either pairing.** Three mechanisms stack, and the brief
named only the first:
1. **The reader's read.** A reader that updates before the responders reads the previous frame's `type`.
2. **The responder's occupancy guard on the same frame.** The responder updates after the readers, so its guard sees
   the readers where this frame left them. A block, spinner or flyer that read "open" and moved in therefore holds a
   resetting Lock open. The model's step judged occupancy one tick earlier, and its Lock counts no Enemy (spinner,
   wallflyer).
3. **A third, unnamed off-by-one: the Button publish lag for responders.** The game's Lock reacts to a mid-tape
   Player press or release one frame later than the model does. It is `pulserPublishLag`'s rule, and the model applies
   it to the Pulser only.

The read alone (arm ii) closes only A1 (an open). Arm v (read + lag + same-frame occupancy, a scratch) gives 0 px on
all 13 shapes.

| | |
|---|---|
| Start (base) | `6ff6b09df9c54d8afe1e716db2cd21eb34919d7b` (wave 62's tip, `claude/seedling-hang-dual-pressers-qvdl42`) |
| Head | the report commit on top of `5f42a8a6bc03ce6b0533e5a7c4947b25ae1969e6` (the evidence head) |
| Harness branch | `claude/seedling-fidelity-readerorder-jc2kuo` (local `seedling-fidelity-readerorder`) |
| Commits | `059589fa` (D2 census + staging), `673b2f75` (D3 witness + arms i/iii), `5f42a8a6` (D4 arms, sweep census, scratch tool), then this report |
| Page | `seedling_bot_ap_p4g` (the default), served by `scripts/serve-nocache.py 9798` (stopped by PID at the end) |

Evidence lives in `CC/docs/cloud-reports/seedling-fidelity-readerorder-evidence/`:
- `tools/`: `stage.mjs` (the shapes), `census.mjs`, `readerorder-witness.mjs`, `replay-arms.mjs`, `scratch.py`,
  `tape-arms.mjs`, `tape-arms-split.mjs` and `sweep-probe.mjs`;
- `d2/`: the census;
- `d3/`: the game streams and cuts. `witness-a1-open.json` is the first one-shape run, superseded by `witness-p4g.json`
  and identical on its cuts;
- `d4/`: the arms and the sweep.

## D1: the source (re-measured; vendor `vendor/seedling` @ccdf1897)

### The update order

`World.add` queues (`net/flashpunk/World.as:105-108`). `updateLists` adds the queue in order (`:895-920`).
`addUpdate` **prepends** (`:937-951`). So the update list runs in the reverse of `Game.loadlevel`'s add order:

| Add (`Game.as`) | Class | Updates |
|---|---|---|
| `:2416` | `Spinner` | 1st (of these) |
| `:2415` | `WallFlyer` | 2nd |
| `:2384`, `:2383`, `:2382` | `PushableBlockSpear`, `PushableBlockFire`, `PushableBlock` | before every responder |
| `:2377` | `Chest` (wave 61's reader) | |
| `:2367-2366`, `:2365`, `:2364`, `:2363-2362`, `:2361`, `:2360` | `MagicalLock`×2, `BossLock`, `WandLock`, `ShieldLock`×2, `GrassLock`, `Cover` | the responders |
| `:2357`, `:2356`, `:2355` | `Pulser`, `Lock`, `RockLock` | the responders |
| `:2342`, `:2341` | `ButtonRoom`, `Button` | after every responder; **their write is read next frame** |
| `:2276-2301` | the enemies, Crusher, … | after |
| `:2250` | `Player` | last |

The first measurement (`a1-open`) confirms the labelling. The model opens L after the step at the end of tick 101.
The game first shows L open at the hold-cut after 102 frames. So the model's step at the end of tick k is the game's
frame-(k+1) responder update, as `stepActivators`' docblock and wave 61 say.

### The readers: what each reads, and when

- **`PushableBlock`.** `update` (`Puzzlements/PushableBlock.as:96-111`) runs:
  - `input()` (`:35-89`), whose grid snaps ask `collideTypes(solids, gridPos…)` at `:60` and `:68`;
  - `moveX`/`moveY` (`Mobile.as:86-118`: `collideTypes(solids, …)` per 1 px step at `:90` and `:107`).

  `solids` is `Mobile.as:17` (`["Solid","Tree","Rock","Rope","ShieldBoss"]`) plus the ctor's `push("Enemy","Player")`
  (`:28`). A blocked axis resets the target (`:101-108`), so a pushed block retries each frame the player pushes.
- **`PushableBlockFire` and `…Spear`.** `update` (`PushableBlockFire.as:125-142`) runs `input()` (`:36-65`, snap at
  `:54`), then `moveX`/`moveY`. `hit()` (`:76-123`) returns while `v.length > 0` (`:78`). A Pulser therefore re-hits a
  blocked block every other frame (the model's `pulserPushes`: t2, 4, 6, …).
- **`Spinner`.** `update` (`Enemies/Spinner.as:66-95`) runs `Enemy.update` (`Enemies/Enemy.as:62-112`), then
  `Mobile.mobileUpdate`, then its own `moveX`/`moveY` (`:137-171`: `collideTypes(solids, …)` at `:141` and `:159`,
  reflecting the axis). `solids` is `Mobile`'s own list.
- **`WallFlyer`.** `update` (`Enemies/WallFlyer.as:53-77`) runs `Enemy.update`, then `moveX`/`moveY` (`:178-230`: a
  Solid stops it, `v = 0`). It also runs `decideMotion` (`:113-170`), which reads `collideTypes(["Solid","Tree"], …)`
  at `:118-121` for its trigger direction.
- **The solid types.** A `Lock` (`WandLock` and `GrassLock` extend it) and a `Cover` are `type = "Solid"` until their
  type is set to `""`.

### The responders: what can change within one frame

Each responder makes at most one transition per update. Both directions are possible for a group with a momentary
presser.

| Class | Open | Reset (close) | Hold |
|---|---|---|---|
| `Lock`, `WandLock`, `GrassLock` | `activationStep` (`Puzzlements/Lock.as:64-88`): on the update after `alpha` reaches 0, `turnOff` (`:90-98`) sets `type = ""` and clears persistence | not `activate`, and `!collideTypes(["Player","Enemy","Solid"])` (`hitables :23`): `returnToNormal` (`:100-107`) sets `type = "Solid"` and sets persistence back | not `activate` with a Player, **Enemy** or Solid in the box |
| `Cover` | the active update where `alpha <= 0` (`Cover.as:40-48`) | not `activate` and no Solid/Player in the box (`hitables :21`), or a Chest in it (`:49-67`) | a non-Chest Solid/Player in the box; **an Enemy does not hold it** |
| `Lock` with `t = -1` | `checkEnemies` (`:109-115`) only ever sets true | never | — |
| `ShieldLock`, `BossLock`, `MagicalLock` | yes | never: `activate` is never set false (the model's `KEY_RESPONDERS` note 2) | — |

`Button.update` (`Button.as:27-40`) writes the group through `activateAll` at the end of its own update, after every
responder's. So a Lock in frame k+1 reads what the Button saw at the end of frame k-1.

### The model's side (`levelRun.js` and `activators.js` at the base)

The main tick runs, in order:
- `stepSpinners(spinState, spinnerCtx())` (`levelRun.js:23030`);
- `stepWallFlyersNow()` (`:23138`, which builds its own `spinnerCtx()` at `:13404`);
- `stepPushables(pushState, pushableCtx())` (`:23142`);
- then the player, `ticksCompleted++` (`:25161`), and **`stepActivators`** at the tick's end (`:25176`).

The other callers of `stepActivators` are:
- `spanActivatorFrameNow` (`:4003`);
- `runFrozenTick` (`:15120`);
- `inventoryHoldFrameNow` (`:16784`).

`stepPushablesDeadFrameNow` (`:14778`) steps the blocks on dead frames with the same `pushableCtx`.

| Read | Where | What it returns | Against the game's frame |
|---|---|---|---|
| `pushableCtx` | `:6555`, `openActivatorIds` (`activators.js:1046-1050`) | the set after the latest step | **one step new for an open and for a reset** |
| `spinnerCtx` | `:6649`, `spinnerLockLag` ON: `openActivatorIdsBeforeLatestStep` (`activators.js:1066-1076`) | the current set minus a fade responder whose `held` equals its open step | right for a fresh **open** (L40RES); **one step new for a reset** |
| `openActivatorIdsBeforeStep` | `activators.js:1088-1090` | `state.openBefore`, written at the top of `stepActivators` (`:808`) only under `chestCoverFencepost` | the exact "before this frame's responder update" set, both directions |
| `stepActivators`' presses | `activators.js:822` (`pressedGroups(world, playerBox, …)`) and the latch loop `:868` | uses the **end-of-tick-k** player box at the step labelled frame k+1 | **one frame early for a moving player** (the game's Button wrote it from the end of frame k-1); right for a block, which the game's Button sees at frame k |
| `stepActivators`' occupancy | `occupied` (`:834-838`): the player box plus `movingSolids` (blocks, crushers, ice turrets, landed rocks) | readers where tick k left them; **no spinner, no wallflyer** | one step stale for a reader, which moves before the game's responder of the same frame; and missing `Lock`'s "Enemy" |

## D2: the census (`tools/census.mjs` → `d2/census.txt`, `census.json`)

### The method

A responder is any `world.activators` or `world.magicalLocks` row. It is classed by:
- **open:** whether it can open at all (it needs a presser);
- **reset:** a Lock-family or Cover row with `t >= 0` whose group holds a momentary presser (a `button`, or a
  `buttonroom {room -1, flip 1}`).

The reach is geometric, an upper bound, with no route asked:
- **(A)** a breadth-first walk of the block's cell, with every responder treated open. It never steps onto
  water/lava/pit. A player-pushed block needs a free stance behind it.
- **(B)** the spinner is simulated for 20000 ticks, and the wallflyer flown wall to wall 40 times. Each runs in two
  worlds: every responder closed ("meets": a reflection or a stop) and every responder open ("enters").

### The controls

All 13 of `stage.mjs`'s shapes are found. Each (A) control gives 1 pair, and the A2 ones are reset-capable. Each (B)
control gives 2 pairs: the seal lock and L, with L reset-capable. The first run found no (A) or B1 control, which
exposed a bug: `world.width` is in tiles. It was fixed and re-run.

### The results

| Source | Rooms with a reader and a responder | (A) pairs [reset-capable] | (B) pairs [reset-capable] |
|---|---|---|---|
| vanilla atlas (116 levels) | 7 | **42 [28]**: L39 21, L40 20, L41 1 | **38 [21]**: L18 2, L39 21, L40 15 |
| delivered (playthrough AP_1, p4g) | 7 | 42 [28] | 43 [23] (L40 20) |
| generated presets (`seedling_generated_{chestdoor,host,leaf,room,swim}`, 12 rooms) | 0 | 0 | 0 |
| generator sweep: `seedlingModel` skeleton records, kinds {empty, winding, branchy, bushy, loopy, open, rooms} × seeds 1..40 × {weighgate, holdgate, killgate, shortcut, none} = 986 rooms | 368 | 32 [32], all weighgate | 209 [0], all killgate (`t = -1`) |

### The vanilla instances

**L39 (the shaft).** Three fire blocks can reach every responder in the room:
- the blocks: `pushableblockfire@144,176`, `@208,80`, `@48,176`;
- the Covers: `cover@144,112` (t0), `@176,144` (t1), `@112,144` (t2);
- the WandLocks: `wandlock@48,160` (t1), `@144,64` (t3), `@144,48` (t4), `@144,32` (t5);
- all of them are on Button groups, so reset-capable.

Three spinners (`spinner@112,88`, `@224,112`, `@224,208`) reach the same 7 responders. That makes 21 + 21 pairs, every
one reset-capable.

**L40.** The fire blocks `@480,480` and `@576,576` can reach 10 responders. Three of them are reset-capable:
`wandlock@448,432` (t2), `@512,480` (t2) and `@800,400` (t5). The other seven are open only: `bosslock@480,352`,
`wandlock@176,80`, `@176,208`, `@208,128`, `@208,144`, `@208,160` and `@480,560`. They have no momentary presser.
The spinners `@192,128`, `@192,144`, `@192,160` and `@880,848` meet the t0, t1 and t3 wandlocks and the bosslock, all
open only.

**L41.** `pushableblockfire@112,144` against `cover@112,128` (t0, reset-capable).

**L18.** `spinner@48,96` and `@112,48` against the kill lock `lock@144,112` (`t = -1`, open only). That lock opens only
once every enemy is dead, so no live spinner can meet its open.

**Generated rooms.**
- **The weigh gate** puts the block on its own presser, with the door at least two cells from the button
  (`procgenCore/elements/strategyGate.js`, rule 3). Pushed off the button, the block is 32+ frames from the door when it
  resets. So it can reach the box but cannot meet the reset.
- **The kill gate's lock** is `t = -1`.

So the census's reachable rooms are vanilla L39, L40 and L41. The runtime probe in D4 says no committed route meets a
transition there: **no vanilla route is a headline**.

## D3: the game witness (`tools/readerorder-witness.mjs` → `d3/witness-p4g.json`, `.log`, `witness-p4g-b1r124.json`)

### The staging

Each shape is staged in the vanilla L38, stripped to its two teleporters and `lightalpha`, under its own `set_id`
(`…-ro-<shape>`) through `botLoadLevels`. That is level data, with no game edit, and every shape was mounted
(`botLevelSet`). Each run gets a fresh page.

- **The whole tape:** `botMobiles` and `botStatus` sampled in a tight loop got every tick (141/141 … 61/61). `botDrain`
  was read at the end. `hits` is 0 in every run.
- **Hold-cuts** (`cutTape(…, n, {hold: true})`) give the exact state after n frames, around each meeting.
- **The responder is always a tagged `Lock` (tag 20).** `turnOff` and `returnToNormal` write `setPersistence(tag, …)`
  on the transition, so `persistence_cleared` ∋ (38,20) **is** L's `type == ""`. A Cover's type cannot be read on the
  page, so no shape uses one.

### Choosing the meeting frame from the stream

The model chose each shape's timing. The stream then shows which frame is the meeting, and the first measurement
corrected the model in one place. The Player's first frame on or off a Button, against the game's L:

| Shape | Player on the button | L open (game) | Player off | L re-shut (game) |
|---|---|---|---|---|
| `a2-ctl` | 34 | **136 = on + 102** | 145 | **147 = off + 2** |
| model, same tape | | 135 (after step 134) = on + 101 | | 146 (after step 145) = off + 1 |

So for a Player who moves onto or off a Button mid-tape, the game's Lock is one frame later than the model's. It is
the Pulser's measured lag (`pulserPublishLag`, FIREPUSH), carried by no responder. With a boot press, the model has no
row-0 step, so it agrees: L opens at 102 in A1, B1 and B2. This decides which shape is the true reset-frame meeting:
- `a2-r149`: off 154, so the would-be reset is 156, the block's first move;
- `b1-r124`: off 130, so the would-be reset is 132, the spinner's first crossing. I added and witnessed this shape
  after the first run, for exactly this reason;
- `b2-flyer` resets on the Player leaving L's box, which is direct occupancy with no Button, so it carries no lag.

### The game's result per shape (quoted from the cuts; "L" is the game's type at that frame)

- **A1 `a1-open`** (a latched L; the block presses on it from t64). The block stops **one frame after L opens**:
  - cut 101: L shut, `PushableBlock(96,48)`, `Player(93.4,56)`;
  - cut 102: **L OPEN**, `PushableBlock(96,48)`;
  - cut 103: L OPEN, **`PushableBlock(96.5,48)`**, `Player(94.3,56)`.
- **A2 `a2-r149`** (a Pulser-driven fire block; the would-be reset frame 156 is the block's first move):
  - cut 155: L OPEN, `PushableBlockFire(176,48)`;
  - cut 156: L OPEN, **`PushableBlockFire(176.5,48)`**;
  - cut 157: L OPEN, `(177,48)`; cut 158: L OPEN, `(177.5,48)`.

  The block moves in on the stale "open" read, the guard then holds L open, and the block parks at 192 with L open for
  the rest of the tape (the parked-block case). `a2-reset` (R150) and `a2-r151` show the same stream. `a2-ctl` (R140)
  shows cut 156: L shut, `(176,48)`: the block is held by a long-shut L.
- **B1 `b1-r124`** (the spinner's first crossing, 132, is the would-be reset frame):
  - cut 131: L OPEN, `Spinner(152.707,220.326)`;
  - cut 132: L OPEN, **`Spinner(153.414,221.033)`**, in the box;
  - cut 133: L OPEN, `(154.121,221.740)`;
  - cut 134: L OPEN, `(154.828,222.447)`.

  The spinner crosses, and L (whose `hitables` hold "Enemy") stays open until it leaves. It re-shuts at 161.
  `b1-spinner` (R125) and `b1-occ` (R127) are the same in the game.
- **B2 `b2-flyer`** (the flyer's first crossing, 160, is the reset frame: the Player left L's box at 159):
  - cut 159: L OPEN, `WallFlyer(152,215)`;
  - cut 160: L OPEN, **`WallFlyer(152,219)`**;
  - cut 161: L OPEN, `(152,223)`; cut 162: L OPEN, `(152,227)`.

  The flyer flies through and on to y 315, and L re-shuts at 167. `b2-occ` (pause 11) is the same.
- **The controls** (no transition near the meeting):
  - `a1-ctl`: L is open from 102; the block first moves at 163 and enters L's box at 195 through a steadily open L;
  - `b1-ctl`: never pressed; the spinner reflects off a shut L, `Spinner(155.536,149.615)` at cut 31;
  - `b2-ctl`: never pressed; the flyer stops on a shut L, `WallFlyer(152,217)` from cut 18.

## D4: the model replay (`tools/replay-arms.mjs`; the Player from `botDrain`, the readers from the samples)

The comparison runs from t1, because a t0 `botMobiles` sample can be a pre-boot read: `a1-ctl`'s and `b1-r124`'s
carried no readers. L's type at game tick t is compared with the model's L after step t-1.

The arms:
- **i:** the shipped defaults;
- **iii:** `spinnerLockLag` OFF;
- **ii:** the readers read `openActivatorIdsBeforeStep`;
- **iv:** the responders' presses read the previous step's player box;
- **v:** ii + iv + occupancy. The Lock family's guard counts spinner and wallflyer boxes, and after the main tick's
  readers step, a reset the latest step made is undone when a reader now stands in the box (and a reader-only hold is
  reset when the reader has left).

Arms ii, iv and v are scratch, copy + restore (`tools/scratch.py`, listed below). Each cell is the worst px over the
stream, and the first divergent tick:

| Shape | i (shipped) | iii (lag OFF) | ii (read) | iv (press lag) | ii+iv | v |
|---|---|---|---|---|---|---|
| `a1-open` | **1.3 px, t102** (game block 96, model 96.5) | = i | **0** | = i | 0 | 0 |
| `a1-ctl` | 0 | 0 | 0 | 0 | 0 | 0 |
| `a2-r149` | **16 px, t156** (176.5 vs 176; end: game 192 + L open, model 176 + L shut) | = i | 16, **t156** | 16, t156 | 16, **t157** | **0** |
| `a2-reset` (R150) | 16 px, t156 | = i | 16, t157 | **0** | 0 | 0 |
| `a2-r151`, `a2-ctl` | 0 | 0 | 0 | 0 | 0 | 0 |
| `b1-r124` | **46.0 px, t132** (y 221.033 vs 220.326) | = i | 46.0, t132 | 46.0, t132 | 44.5, **t133** | **0** |
| `b1-spinner` (R125) | 47.4 px, t132 | = i | 46.0, t133 | 46.0, t133 | 22.6, t134 | 0 |
| `b1-occ` (R127) | 24.0 px, t134 | = i | 23.3, t135 | 23.3, t135 | 22.6, t136 | 0 |
| `b2-flyer` | **98 px, t160** (219 vs 217; end: game 315, model 217) | = i | 96, **t161** | = i | 96, t161 | **0** |
| `b2-occ` | 100 px, t161 | = i | 96, t162 | = i | 96, t162 | 0 |
| `b1-ctl`, `b2-ctl` | 0 | 0 | 0 | 0 | 0 | 0 |

A partial arm moves the first divergence one tick later. There the model's reader enters the box and is then stuck
inside a Lock the model already shut.

L's type under arm v differs at 1–2 single ticks per shape, at each corrected transition:
- `a2-r149`: t156;
- `b1-r124`: t132, t161;
- `b2-flyer`: t160, t167.

That is the stand-in's artefact: the correction lands inside tick t, after the row the comparison reads. A faithful key
(below) has no such tick. Arm iii equals arm i on all 13 shapes. No shape meets a fresh open on the (B) side; that half
is L40RES's, already game-witnessed.

### Per-pairing verdicts

**(A) `PushableBlock*`: GAP.**
- **The open direction (A1).** Δ 0.5 px on the block (1 px with the Player) from t102. The read alone (ii) closes it.
- **The reset direction (A2, `a2-r149`).** Δ 0.5 px at t156, then 16 px: the game's block parks in an open L, and the
  model's is held by a shut one. It takes read + press lag + same-frame occupancy (v). The read alone moves the
  divergence to t157 (the block enters, then sticks).

**(B) `Spinner` / `WallFlyer`: GAP.**
- **The reset direction** (`b2-flyer`, no press lag; `b1-r124`). Δ 2 px (flyer) / 0.71 px (spinner) at the first
  crossing, then 98 / 46 px. It takes read + same-frame Enemy occupancy (v); `b1-r124` also needs the press lag. With a
  Lock the read alone cannot work, because `Lock.hitables` holds "Enemy". With a Cover (hitables Solid/Player) the read
  alone should be enough. That is unwitnessed: a Cover's type is not readable on the page.

**The press lag (found here, a third gap, its own pairing):** game-witnessed on `a2-ctl` (open +1, re-shut +1). It is
closed by iv, and it alone closes `a2-reset`.

### The sketched keys (not implemented)

**The faithful form.** One structural key, `responderStepAfterReaders` (OFF). It moves the responder half of
`stepActivators` from the tick's end to the top of the next tick, after the spinners, wallflyers and blocks step and
before the player. That is the game's frame order. The step's presses read the publish of the step before, which is
the end-of-tick-k-1 box: the Button's lag. Its occupancy sees the readers where this tick left them. It would subsume:
- the read: the readers' `openActivators` become the set before their own frame's update, which is the current set at
  the top of the tick;
- the press lag;
- the same-frame occupancy.

`chestCoverFencepost`'s snapshot and the Spinner's half of `spinnerLockLag` become the plain current read.

**As separate keys, if the planner wants them apart:**

| Key | Read | Rows |
|---|---|---|
| `pushableReadsBeforeStep` | `pushableCtx` reads `openActivatorIdsBeforeStep`, with the snapshot written under this key too | `a1-open` 0 px; `a1-ctl` unmoved |
| `spinnerReadsBeforeStep` | `spinnerCtx` reads it (both directions; it subsumes the lag's open half) | `b2-flyer` / `b1-r124` need the next two too |
| `responderPublishLag` | Lock and Cover read a Button's player press from the previous step's box (`pulserPublishLag`'s rule). ⚠ Its latch half (a ButtonRoom) follows the source and is **unwitnessed**: every latch here was pressed at boot | `a2-ctl` (L 136/147), `a2-reset` 0 px |
| `lockEnemyOccupancy` | the Lock family's guard counts spinner and wallflyer boxes (`Lock.hitables`); a Cover's does not | `b2-occ`, `b1-occ` |
| `readerSameFrameOccupancy` | the guard judged where this frame's readers left them | `a2-r149`, `b1-r124`, `b2-flyer` |

The row set for any of these is the 13 shapes here. Their tapes come from `stage.mjs`, and their game streams are
`d3/*.json`.

### The sweep census (`tools/tape-arms.mjs` + `tape-arms-split.mjs` + `sweep-probe.mjs`, scratch applied)

The sweep ran over 322 committed tapes: every `fixtures/tapes/*.json` and `fixtures/**/*.tape.json`. One refuted tape
throws at the defaults, as it does unedited. The `__RO` baseline equals the untouched shipped run on 322/322.

**The read (arm ii): 0 tapes move.** The read probe logs a sub-step query whose answer differs between the shipped and
before-step sets, and it finds **0 queries over 322 tapes**. No committed tape's block, spinner or wallflyer meets an
open or reset of a responder on the transition frame.

**The occupancy (arm occ): 0 tapes move.**

**The press lag (arm iv; and ii+iv and v, the same 18): 18 tapes move, and every one is ledger-only.**
- **The stream** (`ticks`, `transitions`) is identical on all 18.
- **`lockWrites` / `earnedClears` move by a tick** on these 14:
  - `hammer-bw-l42-381-bombstand`, `l40button-l41-part0`, `l40button-l42-part0`;
  - `r2-walk-5-darkshield`, `r2-walk-full`, `r3-walk-5-darkshield`, `r3-walk-full`;
  - `r5-l40-part0`(+`-control`), `r5-l40-part5`(+`-control`);
  - `r8-d2`, `r8-d2-20`, `r9-solve-20`.
- **`pulserHits` / `pulsePushes` move** on `prox-l38-chest`, `prox-l38-reach-l39` and `r5-totem-entrance`(+`-control`).
  This is L38's latched pulser, the latch half (unwitnessed).

So a GAP flip moves no committed position. The read keys move nothing. The press-lag key moves those 18 ledgers' tick
values, so a pin on a lock-write tick would need re-recording.

**Survey legs: not counted.** The route survey is a regenerable cache (`.cache/seedling-survey/`,
`seedlingSurveyDir.js`) that is not in this container. `sweep-probe.mjs --dir=<survey views>` counts one. That is the
planner's: the sweep's shards are 0 for the read keys, by the tapes.

## What the brief got wrong (measured)

- **"Off by one in both directions" (A) is only half of it.** The open direction is a pure read gap, closed by the read
  alone. The reset direction is not: the game's responder of the same frame sees the block that read "open" and moved
  in, and holds (`a2-r149`, arm ii: t156 → t157).
- **(B)'s reset "is not lagged"** is true and witnessed, but switching the read does not close it on a Lock:
  `Lock.hitables` holds "Enemy", and the model's guard counts no spinner or wallflyer.
- **The frame table misses a third off-by-one, the Button publish lag for responders.** It is game-witnessed, and it
  changes which release frame is a "reset-frame meeting" (`a2-r149` and `b1-r124`, not the model's R150/R125).
- **"Stage (A2): a pushable pushed into a Cover/Lock on the frame it RESETS."** A player-pushed block cannot meet a
  Button-driven reset. The release and the contact fall together (a 4×5 player box behind a 16 px block, the 8×6
  button box), and the 2-frame Button→Lock latency lets the block in first. The shape needs a block that moves on its
  own: here, a `PushableBlockFire` driven by a latched `Pulser`.
- **`openActivatorIdsBeforeStep` is "the candidate both readers could use"** only once its snapshot is written. It is
  written only under `chestCoverFencepost` (`activators.js:808`), so a reader's key must write it too.
- **"(A1) … into a Cover/Lock":** every shape here uses a Lock, because a Cover's type is not observable on the page.

## Scratch edits (copy + restore, never committed)

`tools/scratch.py` makes 13 anchored edits in `frontend/modules/seedlingDemo/activators.js` and `levelRun.js`, all
gated on `globalThis.__RO`, which nothing shipped sets:
- **E1:** `openBefore` is written when `__RO` is set;
- **E2–E4:** the readers' `before` arm and the read probe in `pushableCtx` and `spinnerCtx`, plus `__RO.who` around the
  main tick's spinner and wallflyer steps;
- **E5:** `pressLag` in `pressedGroups` and the latch;
- **E6–E9:** `occ`, the Enemy guard and the after-readers correction.

The scratch was applied twice (arms ii/iv/ii+iv, then with E6–E9 for ii+occ, v and the sweep). It was restored each
time, and the tool checks `git diff --quiet` on both files: "scratch: restored; git diff clean". Arm i, re-run on the
restored tree, is byte-identical to `d4/arm-i.txt`.

`git diff --name-only 6ff6b09df9 HEAD`, before this report's commit (35 paths), lists only
`CC/docs/cloud-reports/seedling-fidelity-readerorder-evidence/`:
- `d2/census.json`, `d2/census.txt`;
- `d3/witness-a1-open.json`, `d3/witness-p4g-b1r124.json`, `d3/witness-p4g.json`, `d3/witness-p4g.log`;
- `d4/arm-{i,ii,iii,iv,ii+iv,ii+occ,v}.{json,txt}`, `d4/sweep-probe.{json,txt}`, `d4/sweep-timing.txt`,
  `d4/tape-arms{,-split}.{json,txt}`;
- `tools/{census,readerorder-witness,replay-arms,stage,sweep-probe,tape-arms,tape-arms-split}.mjs`, `tools/scratch.py`.

0 paths outside it. This report adds `CC/docs/cloud-reports/seedling-fidelity-readerorder.md`.

## Hand-overs

### Planner (fidelity)

- Two GAPs plus one new gap, all game-witnessed. The witnessed sweep is 0 tapes for the read and occupancy keys, and 18
  ledger-only tapes for the press lag.
- My recommendation is the single structural key `responderStepAfterReaders`, over three or five separate ones: arm v
  is that order, and it is 0 px everywhere.
- Before the latch half of the press lag ships, it needs one witness. A ButtonRoom latch pressed mid-tape should show
  L's open at on+102; L38's `prox-l38-chest` pulser pushes would move with it.

### Fidelity (later rows)

- A Cover under (B): the read alone should close it (no Enemy in `Cover.hitables`). Its type needs another observable:
  a Chest under it, or a block's stop.
- `Button.hitables` holds "Enemy", but `movingSolidsNow` has no spinner or wallflyer, so a spinner or flyer on a Button
  presses it in the game and not in the model. This is from source, unwitnessed, and the census reached none.

### Residue

- The census is a geometric upper bound (no route asked).
- The survey legs are not counted (no cache here).
- The editor (`watchEdit`) can probably author all of these shapes. Not checked: that is the lab arc's.

### HAMMER / JS arc

None.
