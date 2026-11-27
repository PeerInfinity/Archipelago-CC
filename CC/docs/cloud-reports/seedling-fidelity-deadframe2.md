# seedling-fidelity-deadframe2: a seal piece's dead frames, the Pulser through every dead span, and a block on a FallRock's Button (planning-26, wave 69)

**Verdict: PASS.** Three new keys, all default OFF, each on a game-witnessed GAP: `freezeFramesStepResponders`,
`pulserDeadFrameUpdate` and `blockPressesFallRockButtonSameFrame`. OFF is byte-identical. The texted lump's clock needs no
wave: **the game's clock agrees with the model's 150** (its latched `save.time`), and the 149 is the bot's `dead_frames`
counter only.

**The one thing to know first: `pulserDeadFrameUpdate` is the first dead-frame key that moves the committed corpus.** It
moves 7 tapes, and a flip would re-record two model goldens and widen one staging row (§ The ON test sweep). Every move is a ledger only: `pulserHits` on all 7, plus `spinnerWrites[0]` on `r5-shaft-control`. No
stream, no `hits` and no acceptance md5 moves. That spinner write lands at t1207 ON and t1397 OFF, and the game writes it
at **t1643**, so both arms are wrong. The spinner's pulse-kill path is already 246 ticks off OFF, and the Pulser's
(witnessed) phase moves it further from the game. That is an unpinned ledger the game disagrees with in both arms
(hand-over below).

| | |
|---|---|
| Start (base) | `48824c3310442d26097108134d4c05e2a4363eaa` (wave 68's final tip, `claude/wandshot-enemy-bodies-vuzsvv`) |
| Head | the report commit on top of the last code commit, `c9938215` |
| Harness branch | `claude/seedling-deadframes-wave-66-pbki40` (local `seedling-fidelity-deadframe2`) |
| Page | `seedling_bot_ap_p4g`, `scripts/serve-nocache.py 9798` (stopped by PID at the end) |
| Key count | 157 → 160 keys (126 ON unchanged); the last three are `freezeFramesStepResponders`, `pulserDeadFrameUpdate`, `blockPressesFallRockButtonSameFrame`; `SOLVER_ENV_NAMES` 254 → 257 (sorted, unique) |

The evidence is in `CC/docs/cloud-reports/seedling-fidelity-deadframe2-evidence/`:
- `tools/`:
  - `census2-scratch.py`, `census2.mjs` and `census2-preload.mjs`: the D1 census. This is wave 66's, widened with a Pulser
    clone-step, the block–FallRock-Button overlaps and the lumps by texted/text-less. `--clock149` adds the 149-clock arm.
    Copy + restore;
  - `stage-deadframe2.mjs`, `witness-deadframe2.mjs` (wave 66's witness, which also times every ledger write) and
    `replay-deadframe2.mjs`: the D1 shapes, the game, and the model against it;
  - `tape-deadframe2.mjs` (wave 66's, re-keyed) and `tape-dump.mjs` (per-field hashes across two source states): every tape;
  - `probe2-scratch.py` and `probe2.mjs`: the ON branch's runtime counters (copy + restore);
  - `mutants.py`, `gateset.sh`: the mutants and the bounded vitest set.
- `d1/`: `census2-off.{json,txt}`, `clock149-{tapes,vitest}.txt`, `acceptance-md5-clock149.txt`.
- `d2/`: `witness-all.json` (the seven shapes), `witness-shaft-control.json` (`r5-shaft-control` on the vanilla set, every
  ledger write timed), and `witness-shaft{,-control}.txt`.
- `d3/`: `tape-*.json`, `acceptance-md5.txt`, `probe-*.txt`, `mutants.{json,txt}`, `gate-{before,after}.txt`, `sweep.txt`.

## D1: the census, the witnesses, the map

### 1. The census (`d1/census2-off.*`; 322 tapes, shipped defaults, before anything was staged)

At every span the model charges (`clock.spend`), the census steps a CLONE of the level's activator state once per frame
(wave 66's method). It also steps a clone of every Pulser, armed as the live tick arms it. It counts:
- the spans in a room with responders or Pulsers;
- the spans on which a responder or a Pulser would change;
- the Pulser's hit frames, and the hit frames with a target in its ring.

At every live tick's end it counts the enemy-on-presser and **block-on-FallRock-Button** overlaps, and it counts the lumps by text.

| Kind | Spans | Frames | With responders | A responder would change | With Pulsers | A Pulser active / would change | Pulser hit frames | …a target in the ring |
|---|---|---|---|---|---|---|---|---|
| pickup lump | 75 | 11,250 | 28 | **0** | 6 | 1 / 1 | 69 | 0 |
| seal piece | 13 | 4,303 | 8 | **0** | 7 | **4 / 4** | 606 | 0 |
| span: a rope's rock | 3 | 591 | 3 | **0** | 3 | **3 / 3** | 276 | 0 |
| span: a button's / the wand's rocks | 3 | 558 | 0 | 0 | 0 | — | 0 | 0 |
| door ceremony | 5 | 905 | 0 | 0 | 0 | — | 0 | 0 |
| moonrock | 2 | 902 | 0 | 0 | 0 | — | 0 | 0 |
| BobBoss rock | 10 | 1,740 | 0 | 0 | 0 | — | 0 | 0 |
| seed cover fade | 2 | 400 | 0 | 0 | 0 | — | 0 | 0 |
| wand approach fade | 3 | 297 | 0 | 0 | 0 | — | 0 | 0 |
| Help (sword) | 7 | 6 | 0 | 0 | 0 | — | 0 | 0 |
| LavaBoss rock | 0 | — | — | — | — | — | — | — |

- **Overlaps (live ticks):** spinner on a Button 305 and on a ButtonRoom 101 (wave 65's presses, unchanged). **A block on a
  FallRock's Button: 0.** An enemy on one: 0.
- **Lumps (placed pickups):** 49 texted and 14 text-less.
- **What this says:**
  - The responder gaps (other dead frames, block press) are **0 on the corpus**, so they needed staged witnesses.
  - **The Pulser gap is not 0:** 8 spans on 7 tapes run an active Pulser through dead frames. They are L38's
    `pulser@80,224` through its chest's seal piece and the totem-entrance lumps, and L39's `pulser@64,96` through the
    shaft's rope rock and a lump. None of its dead-frame hits has a target in the ring.

### 2. The witnesses (p4g; staged L38 through `botLoadLevels`, its own `set_id`, a fresh page per shape)

These follow waves 64–66's method. L is `lock@112,48` tag 20, read off `persistence_cleared`. A FallRock writes (38,22).
The Pulser shapes read the **player's** first pulse hit (`hits`, and the knockback in the drained stream): the
`PushableBlockFire` is not player-pushable, so a block cannot be walked into the ring. Compared at every tick against the
model: the player, every block, L (row t−1 OFF / row t with `responderStepAfterReaders` ON) and the rock's fall.

| Shape | Game | Model OFF | ON (its key) | Verdict |
|---|---|---|---|---|
| (a) `s-seal`: boot on a latch (`buttonroom@64,48`, L fades from the boot, open on frame 102), walk up into `chest@64,32` | seal piece meets the player at t11, dead 20 → 351; **L open at t12** | L opens at 102 (also with `deadFrameResponderStep` ON) | `freezeFramesStepResponders`: 0 px, L every tick, both `responderStepAfterReaders` arms | **GAP** |
| (b) `p-key`: `pulser@112,48` latched from the boot; walk right through a `bosskey keyType 1`'s lump (150) into the ring | first hit t56, second t112 | **17.4 px from t53** (hit early) | `pulserDeadFrameUpdate`: 0 px, both arms | **GAP** |
| (b) `p-span`: the same through a button rock's span (`button@64,48` → `fallrock@192,32`, 165) | hits t49, t109 | **26.5 px from t49** | 0 px, both arms | **GAP** |
| (b) `p-health-x`: a texted `health`, its dialogue dismissed by primary taps, then into the ring | dead 20 → 169 at t27, +1 at t35; hit t260 | **17.4 px from t257** | 0 px with **150** Pulser frames and none on the dialogue's ticks; 149 is 52 px off; 150 + a step per frozen tick (157) is 36 px off | **GAP** |
| `p-ctl`: no dead frames (control) | hits t53, t113 | 0 px | 0 px | control |
| `p-health`: the texted pickup, dialogue never dismissed (control: the player never reaches the ring) | 0 hits | 0 px | 0 px | control |
| (d) `b-rock`: push `pushableblock@64,48` right onto `button@96,48` (group 7) of `fallrock@192,32` | **rock falls at t60** (block at x 84.5), dead 20 → 185 at t61 | falls at 61 (armed at the tick's end) | `blockPressesFallRockButtonSameFrame`: falls at **60**, both arms | **GAP** |
| (b′) `r5-shaft-control` (committed tape, vanilla set, unstaged) | the spinner's pulse kill writes (39,4) at **t1643** | t1397 | t1207 | the Pulser's phase moves it; **both arms are wrong** (§ D3) |

**What the witnesses answer:**
1. **(a) The seal piece's 331 dead frames run the responders,** as a pickup's lump does (`Game.as:880-883`). The game's L
   opens on the first live tick after them, 90 ticks before the model.
2. **(b) The Pulser runs through every dead span.** It has no `freezeObjects` test (`Pulser.as:51-83`). The cycle is 51
   frames (`pulser.pulserCycle()`), so the phase shift is the dead frame count mod 51.
   - Its dead-frame hits are inert to the player and the enemies (`Player.as:1382`, `Enemy.as:147`), and none of the
     witnesses or the corpus has a fire block in its ring on a dead frame.
   - **A texted lump runs it 150 frames**, the same as a text-less one, and the dialogue's frozen ticks run it **none**. The
     `dead_frames` counter shows 149 + 1 (the +1 at t35 is the dialogue's close). Only 150 fits; 149 and 157 are measured
     off.
3. **(c) A block's glide across a lump next to a resetting Lock (the interleave): not staged; derived.**
   - `World.update` runs each entity once per frame in the update list, so the game interleaves the block's glide with
     the responders frame by frame. The model's `frozenTickUngated` steps the glide in its own loop before the dead
     responder queue is made, so the queue's solids are the blocks after the whole glide.
   - Closing it needs that loop interleaved with the queue, which means **editing `frozenTickUngated`'s ON branch: STOP**,
     named.
   - The census has no block gliding in a dead span next to a responder on the corpus.
4. **(d) A block on a FallRock's Button drops it in the block's own frame**, one tick before the model's tick-end read. It
   is the same order as wave 66's enemy press: the block updates before the Button.
   - The block itself glides through the span in the game (84.5 → 96.5). The model freezes it unless `frozenTickUngated`
     is ON.
   - With both keys ON, the model agrees with the game on every row but frame A's (row 60). There, the model's span is
     already resolved inside frame A's advance while the game samples frame A before its span. That is the existing
     placement of a button span, and the player's press has it too. Named, not changed.
5. **(e) The texted lump's clock.** The game's `dead_frames` counter jumps 149 (`p-health-x`, and wave 66's `d-health`).
   The game's *clock* is the model's 150. See § The 149-clock census.

**Kinds not staged, and why:**
- **A door ceremony:** it needs a boss-key door and its keys in the save. The census has 0 rooms with responders.
- **The moonrock and BobBoss's / LavaBoss's rocks:** boss rooms and their arenas, not stageable in the stripped L38. Their
  rooms hold no responders on the corpus.
- **The wand's approach fade:** it is L43's arrival gate (`r5Totem.L43_WAND_WINDOW`).
- **A seed's cover fade:** it ends in a reboot that rebuilds the world, so a responder's state there is unobservable.
- **A Help:** 0 or 1 frame (6 frames over 7 spans on the corpus). A witness needs L's opening to land on exactly that
  frame, behind a sword pickup's dialogue.
- All of these stay residue for `freezeFramesStepResponders`. Its doc names them.

### The 149-clock census (witness and census only: no key)

A copy + restore charges a texted pickup's phase A 149 frames on the model clock instead of 150 (`census2-scratch.py apply
--clock149`):
- **Tapes:** 50 of 322 move (`d1/clock149-tapes.txt`). All 50 move `deadFramesOwed` and `deadFrameSpans`, and 17 also move
  `gameTime`. No stream moves.
- **The acceptance md5:** unmoved (`391322d681b7aa0229d94b3f6906d024`).
- **Rows:** 17 rows in 6 files go red (`d1/clock149-vitest.txt`). Among them are `gameClock.test.js`'s **"THE FREE ORACLE —
  the game latched every one of these"** (4 chains: the model must reach the game's latched `save.time`) and its resumed-clock
  rows, plus `helpFrame`, `fidelityHelpDismissPress`, `fidelityNestedRockCeremony` and `fidelityIgfade` rows.
- **So the clock's 150 is the game's,** and a 149 clock would break game-witnessed rows. The 149 is the counter's (the bot
  does not count one of the lump's 150 updates as dead). The Pulser's measured 150 agrees. **No wave is owed.**

### 3. The map

**Every dead-frame path, at the head** (`levelRun.js`; "the queue" is `deadFrameResponderStep`'s):

| Path (charged at) | The game's responder / Pulser update | Responders: OFF / `deadFrameResponderStep` / `freezeFramesStepResponders` | Pulser: OFF / `pulserDeadFrameUpdate` |
|---|---|---|---|
| a placed pickup's phase A (`spendCeremonyPhaseA`, the placed-pickup branch) | every frame; a texted one's 150th is the frozen tick T | none / 150 or 149 + T, queued / — | none / **150** (texted too), queued at the site, run before the next advance's live step |
| the runtime Dark Sword / Fire / seed's phase A | the same | none / 149 (sword, fire) / — | none / 150 |
| a button's / the wand's rocks (`dropRocksTogether`) | every span frame | none / per frame, at once / — | none / the span, at the next advance |
| a rope's rock (`dropRock`) | every span frame | already stepped (`fallRockHoldsButton`) / — / — | none / the span |
| a seal piece (`stepSealPieceNow`, BEFORE the tick's live Pulser step) | 331 frames | none / not modelled / **331, on the queue** | none / 331, run right AFTER this advance's live step (`'after'`) |
| a door ceremony, the moonrock, BobBoss's / LavaBoss's rock, the wand's approach fade, a seed's cover fade, a Help | every frame | none / none / **not modelled (residue: unwitnessed, 0 on the corpus)** | none / its frames (derived: the same mechanism as the witnessed three) |
| an inventory hold | — | already stepped / — / — | refused in a room with a Pulser (`inventoryHoldRefusalNow`), unchanged |
| a frozen tick (`runFrozenTick`: frame A, a dialogue's ticks) | frame A: a world update (the source); a dialogue's tick: **none** (measured, `p-health-x`) | steps the responders (unchanged) | none / **none** (frame A undiscriminated: `p-span` agrees with and without a step) |

- **The queue orders, with `responderStepAfterReaders`:**
  - the seal piece's responder frames use the queue's own flushes: OFF, before the tick's own step; ON, at the next
    advance's top, before the readers;
  - the Pulser's dead frames run after the advance's live Pulser step that precedes them, and are armed as that step arms
    them: `pulserPublishLag`'s `pressedLast` OFF, `state.responderRead` ON. Both arms are witnessed.
- **Torn-down worlds:** a queue whose world a level change or a rebuild tore down is dropped, in both keys.
- **`armButtonFallRocks`'s press path:**
  - `fallRocksArmedBy(world, box, solids)`, with `movingSolidsNow()` = the pushables, a crusher and the ice turrets. It is
    called at the arrival frame, at every live tick's end (the post-move box, resolved next tick as frame A), at
    `runFrozenTick`'s end, at an inventory hold frame and in the span's refusal;
  - `enemyPressesFallRockButton` counts only the live spinner and wallflyer boxes (`armButtonFallRocksByEnemiesNow`), with
    no player box and no blocks;
  - **`blockPressesFallRockButtonSameFrame` adds `armButtonFallRocksByBlocksNow`:** the live pushables alone, at the top of
    the live tick right after the enemy arm (the blocks have stepped by then), resolved as frame A in this tick. A crusher
    and an ice turret stay on the tick-end read (unwitnessed).

## D2: the keys

### `freezeFramesStepResponders` (third-to-last)

- **Its doc block** carries `Game.as:880-883`, the `s-seal` witness, the queue and its two arms, and the residue kinds.
- **ON:** `levelRun.queueFreezeResponderFramesNow` builds the same record `queueDeadResponderFramesNow` builds: the box,
  the solids per frame and the enemies. It puts the seal piece's 331 frames on that queue without reading
  `deadFrameResponderStep`'s gate, so **that key's ON branch is untouched**. The existing flushes run it. Two spans in one
  tick are refused by name.
- **It needs no other key.** It is witnessed in both `responderStepAfterReaders` arms and composes with
  `deadFrameResponderStep`. Each has its own sites.
- **Its env lines:** `SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS=0|1`.

### `pulserDeadFrameUpdate` (second-to-last)

- **Its doc block** carries `Pulser.as:51-83`, the inert hits (`Player.as:1382`, `Enemy.as:147`), the three GAP witnesses,
  the counts and the sites.
- **ON:**
  - every dead span queues its frames (`queueDeadPulserFramesNow`): a pickup's 150, the runtime pickups' 150, both rock
    spans, a seal piece's 331, the door ceremony, the moonrock, both boss rocks, both fades and a Help;
  - `flushDeadPulserFramesNow` runs them around the advance's live step (`'before'` / `'after'`), through
    `stepPulsersFrozenNow`;
  - a dead-frame hit that reaches a fire block is **refused by name**, because the glide is not interleaved (none on the
    corpus or the batch);
  - the ledger `run.deadPulserFrames` is written ON only.
- **It needs `pulserPublishLag`** (ON by default): with it OFF even `p-ctl` is 37.6 px off. It composes with
  `deadFrameResponderStep` and both `responderStepAfterReaders` arms (rows).
- **Its env lines:** `SEEDLING_PULSER_DEAD_FRAME_UPDATE=0|1`.

### `blockPressesFallRockButtonSameFrame` (last)

- **Its doc block** carries the update order, `b-rock`, and the named glide and frame-A-row residue.
- **ON:** `armButtonFallRocksByBlocksNow` (above). The ledger `run.blockRockPresses` is written ON only.
- **It needs no other key.** With `frozenTickUngated` ON the block's glide matches too, except on frame A's row.
- **Its env lines:** `SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME=0|1`.

**OFF (all three): byte-identical.**
- `git diff --name-only 48824c33 HEAD | grep -aE 'fixtures/|golden|tapes/'` is empty.
- The acceptance md5 at head OFF is the standing value.
- No ledger is written (row).

### Rows

**`fidelityDeadFrame2.test.js`** (fast tier, 31 tests; the shapes ported into `fidelityDeadFrame2.js`, which reuses wave
66's staging; the game streams are read from `d2/`):
- **The key contract:** OFF, the last three in order after `wandShotEnemyBodies`, the env names, OFF in this process, and
  every witnessed tape = the ported shape's tape.
- **Every witness:**
  - OFF is the shipped result (per-shape table: worst px, first tick, L and the rock in the game vs the model);
  - its key ON is at 0 px with L and the rock agreeing every tick, in both `responderStepAfterReaders` arms. For
    `b-rock`, the rock falls on 60 and the block-press ledger is pinned; with `frozenTickUngated` ON the one differing
    row is 60;
  - the controls agree OFF and with every key ON.
- **Each key answers its own gap:** with one key alone, the agreeing shapes are exactly its own and the controls.
- **Counted:**
  - the Pulser runs 150 / 150 / 165;
  - the game's `dead_frames` jumps are [150], [149, 1], [165], [331], [165];
  - the seal piece queues 331 with a responder change;
  - OFF writes no ledger.
- **Composition:** all three keys with `deadFrameResponderStep` ON; with it and `responderStepAfterReaders` ON; and with
  the base's last OFF keys ON. The latter are `chestCoverFencepost`, `presserRecursionHang`, `publishedButtonRoomSetter`,
  `responderStepAfterReaders`, `deadFrameResponderStep`, `enemyPressesFallRockButton`, `wandShotTrapBodies`,
  `wandShotEnemyBodies` and `plainPickupInFreeze`. Every witness agrees in each. Wave 66's 18 shapes replay
  byte-identically with all three ON, in both arms.
- **The Pulser's tape movers:** the 7 move only `pulserHits` (plus `r5-shaft-control`'s `spinnerWrites`). The game's
  (39,4) at 1643 against OFF 1397 / ON 1207 is pinned as the named residue.

**`fidelityDeadFrame2.slow.test.js`** (slow tier): every committed tape, all three ON, alone and beside the base's last OFF
keys. The movers are exactly the 7, and only in those two ledgers.

**Wave 66's and wave 65's rows** (`fidelityDeadFrame.test.js`, `fidelityResponderOrder.test.js`) pass with all three ON (the sweep).

**Key-order pins:** 31 files append the three keys to their `… 'wandShotEnemyBodies']` lists. Also:
- `slice(-11)` → `(-14)` in `fidelityFreezeSpanUpdates`, and `slice(-10)` → `(-13)` in `fidelityNestedRockCeremony`;
- `fidelityWandEnemyBodies`' `.at(-1)` becomes an `indexOf` + its three followers;
- `contactFidelity.test.js`'s defaults table and its env skip list.

### Mutants (`d3/mutants.txt`; applied in a scratch worktree at the head and restored)

| Mutant | Predicted | Shown |
|---|---|---|
| M1 the Pulser queue is never flushed | the 3 Pulser GAP shapes' ON rows × 2 arms, each-key, counted, composition × 3, the two tape rows | **exactly those 13** |
| M2 a texted lump runs the Pulser 149 | `p-health-x`'s ON rows × 2, each-key, counted, composition × 3 | **exactly those 7** |
| M3 no `'after'` flush (a seal-site queue waits for the next advance) | nothing: no witness pairs a Pulser with a seal piece | **0 — a survivor, named:** the after-ordering is read from the update order (the seal piece updates before the Pulser), not witnessed. `prox-l38-chest` moves either way |
| M4 the block arm is never asked | `b-rock`'s ON rows × 2, each-key, composition × 3 | **exactly those 6** |
| M5 the seal piece queues nothing | `s-seal`'s ON rows × 2, each-key, the seal-counted row, composition × 3 | **exactly those 7** |
| M6 a frozen tick steps the Pulsers once | `p-health-x`'s ON rows × 2, each-key, composition × 3 | **exactly those 6** |

## D3: the ON measurement

- **Byte-inertia OFF:** the fixtures diff is empty, and the md5 at head OFF is the standing value.
- **The acceptance md5 (`d3/acceptance-md5.txt`):**

  | Run | md5 |
  |---|---|
  | base (before any edit) | `391322d681b7aa0229d94b3f6906d024` |
  | head OFF | `391322d681b7aa0229d94b3f6906d024` |
  | head `freezeFramesStepResponders` ON | `391322d681b7aa0229d94b3f6906d024` |
  | head `pulserDeadFrameUpdate` ON | `391322d681b7aa0229d94b3f6906d024` |
  | head `blockPressesFallRockButtonSameFrame` ON | `391322d681b7aa0229d94b3f6906d024` |
  | head all three ON | `391322d681b7aa0229d94b3f6906d024` |
  | head, the last OFF keys ON (control) | `d871cee754a7490a7003a7395028e531` = wave 65's ON value |
  | head all three + the last OFF keys ON | `d871cee754a7490a7003a7395028e531` |

  **No seed and no field moves under any of the three.**
- **Every committed tape OFF vs ON (`tape-deadframe2.mjs`, `d3/tape-*.json`), 322 tapes:**
  - `freezeFramesStepResponders` alone: 0 movers. `blockPressesFallRockButtonSameFrame` alone: 0;
  - `pulserDeadFrameUpdate` alone, all three, and all three beside the last OFF keys: **the same 7 movers:**

    | Tape | Moved | Tied to |
    |---|---|---|
    | `hammer-d-ghostwall-witness/hammer-d-l39-ghostwall.tape.json` | `pulserHits[0]` t192 → 199 | L39's `pulser@64,96` through the rope rock's 197-frame span (`p-span`'s mechanism) |
    | `r5-shaft.json` | `pulserHits[0]` t198 → 205 | the same span, and a lump |
    | `r5-shaft-control.json` | `pulserHits[0]` t198 → 205; **`spinnerWrites[0]` t1397 → 1207** (game 1643) | the same span; the spinner's pulse kill (below) |
    | `prox-l38-chest.json`, `prox-l38-reach-l39.json` | `pulserHits[58]` (t260 → 274) | L38's `pulser@80,224` through its chest's seal piece (331) |
    | `r5-totem-entrance{,-control}.json` | `pulserHits[78]` (t445 → 462) | the same Pulser through the seal piece |

  - **No stream, no `hits`, no other field moves.** Four of the seven are `noDamage`. On the other three (`hammer-d-l39-ghostwall`, both `prox-l38-*`) no shifted live hit reaches the player, and a pulse is inert on a dead frame.
  - **`spinnerWrites` is a finding, explained, not a STOP.** The spinner `spinner@224,112` dies to pulse hits. The game
    kills it at t1643, the model at t1397 OFF, so the model's spinner pulse-kill path was already 246 ticks off before
    this slice. ON shifts the Pulser's phase by the span (witnessed in `p-span`), and the kill lands at 1207, further from
    the game. Nothing pins the tick: no test names 1397 or 1643. Hand-over below.
- **The runtime probe at the ON branch (`d3/probe-*.txt`):**

  | Run | Seal responder queues (frames that changed one) | Pulser queues: seal / lump / rope | Run (rest past the tape's end) | Pulser dead frames | Dead-frame hits (inert) | Block FallRock presses |
  |---|---|---|---|---|---|---|
  | 322 tapes, all three ON | 8 (**0**) | 7 / 6 (totem parts) / 3 | 11 (5, the horizon) | 3,058 | 947 | **0** |
  | the same, with `deadFrameResponderStep` and `responderStepAfterReaders` ON | 8 (**0**) | 7 / 6 / 3 | 11 (5) | 3,058 | 951 | **0** |
  | the acceptance batch, in-process | 0 | 0 | 0 | 0 | 0 | 0 |

  No dead-frame hit reached a fire block (no refusal). The refuted `r8-solve-5` throws the same way in both arms. The
  batch's subprocesses are not counted.
- **The hit gate:**
  - no tape takes a hit ON that it doesn't OFF (`hits` is unmoved on every tape), and the batch md5 is unmoved;
  - on the staged witnesses, the Pulser's live hits land where the game's do only ON. The dead-frame hits are inert by
    the source (`!Game.freezeObjects`) and in the measurement;
  - **A Pulser that hits during a lump: it cannot** (Player.hit's freeze gate).
- **ON movers by file:row:** see § The ON test sweep.
- **The keyed ON-arm sweep, named for the planner:** `SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS=1
  SEEDLING_PULSER_DEAD_FRAME_UPDATE=1 SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME=1` over the route survey, shards =
  min(10, legs).
  - **The legs are not counted:** the survey cache (`.cache/seedling-survey/`) is not in this container, as in waves 64–66.
  - **The probe's best list:**
    - any leg through L38 after its chest (the seal piece with `pulser@80,224` latched) or through L39's shaft
      (`pulser@64,96` across the rope rock): `pulserDeadFrameUpdate` moves their Pulser phase;
    - any leg that collects a seal piece in a room whose responders are mid-fade (none on the corpus);
    - anything through a FallRock Button a block can reach (L29, L74).

### The ON test sweep

All three keys ON (`SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS=1 SEEDLING_PULSER_DEAD_FRAME_UPDATE=1
SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME=1`) over every seedlingDemo and `scripts/procgen` test file that names
the brief's families: **590 files** (`d3/sweep.txt`).
- **556 fast-tier files**, in 19 batches of 30 (`--maxWorkers=3`): HEAVY-FAST.
- **34 `.slow.`/`.train.` files**, one at a time under their own configs: HEAVY-RESULT.

**The ON movers, by file:row and class:**
- **OFF-contract, `pulserDeadFrameUpdate` (model goldens and a staging window that a flip would re-record), 4 rows:**
  - `seedlingSoundCues.test.js` "prox-l38-chest: the cue list per tick; it contains Puzzlements/Pulser.as:65". The cue
    golden is a model change detector (`UPDATE_SOUND_GOLDENS=1`). The Pulser's "Energy Pulse" cue moves with its phase
    through the seal piece (the tape mover `pulserHits[58]`);
  - `seedlingMachineSkin.test.js` "the L38-ring-wire run: every tick's machines": the golden machine ops (the ring's
    frame choice), a model record. It moves with the same phase;
  - `levelRun.test.js` "r5-shaft, walked up into its latched pulser after tick 2000: a pulserPlayerHits entry, through
    the query". The row stages a 2040-tick window around OFF's first player hit (t2034). ON's first hit is t2041 (the
    rope span's shift, the tape mover `pulserHits[0]` 198 → 205), so the window misses it. The tape is `noDamage`: the hit
    is ledger-only;
  - `levelRun.test.js` "every folded member was witnessed NON-TRIVIALLY by the rows above": it follows from the row above.
- **OFF-contract (the env channel), 3 rows, wave 66's:**
  - `dashOnlyWindow.test.js` "the default adds no field (today's request key list exactly)";
  - `dashOnlyWindow.test.js` "`stampHooks` is the service's one stamping door…";
  - `dashShape.test.js` "the defaults add no field…".
  - Any set `SEEDLING_*` switch is carried into the solve request. Wave 66 measured the same 3 with its own keys' env.
- **This slice's own rows, 2, fixed:** `fidelityDeadFrame2.test.js`' two tape rows took the process default as their OFF
  arm. They now name the three keys OFF (`c9938215`), and are green in both env states.
- **Not this slice, 1 row:** `standingValues.test.js` "a gate that sleeps past the deadline is KILLED…" (this container's
  process-group kill; wave 66 measured it failing with no env).
- **Game-witnessed: 0 rows. Solver re-plan: 0 rows.**

Wave 66's rows (`fidelityDeadFrame.test.js`, `.slow`) and wave 65's (`fidelityResponderOrder.test.js`) pass with all
three ON.

**Not run:** each key alone over the whole sweep. The four OFF-contract movers are all the Pulser's: they are
`pulserHits`-phase consequences, and the other two keys move no tape. With each key alone, every tape, the batch, the
probe and the seven witnesses are measured (above).

## Gates

All at the head with the three keys OFF.
- **Bounded vitest** (`tools/gateset.sh`: the brief's families, every `grep -a -l` file for `stepPushablesDeadFrameNow`,
  `armButtonFallRocks`, `stepActivators`, `deadFrameResponderStep`, the new key names and `wandShotEnemyBodies` (every
  key-order pin), and `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`,
  `seedlingConstantsCensus`, `seedlingSolverSurface` and `oneSpelling`):
  - before, at the base (a scratch worktree at `48824c33`): 62 files, **1896 passed**, 2 skipped. `seedlingSoundCues` was
    re-run after symlinking the worktree's `vendor/seedling`; its first failure was the missing submodule;
  - after, at the head: 63 files, **1932 passed, 0 failed** (the base's 62 plus `fidelityDeadFrame2.test.js`).
- **The slow row** `fidelityDeadFrame2.slow.test.js`: 2 passed (76 s).
- CI-PLACEHOLDER
- **The six solve `--check`s exit 0:** r8-battery, r8-d2-chain, r8-l18, r8-tail, r9-l3 and r9-campaign.
- **Checks that pass:**
  - `check-procgen-docs`: ALL CHECKS PASSED;
  - `generate-procgen-reference --check`: all 7 modules and 5 regions match;
  - **the constants census `--check`:** re-derived with `--write`, and `--profile-rows` left the fields table unchanged.
    The one new rule literal is the Help site's `frames - 1`, classified `derivation` by the existing `drainPickupHelp`
    row; the rest are line moves;
  - **`census-seedling-solver-surface --check`:** re-derived with `--write`, 374 rows. The run's `properties` go 259 → 261
    and `getter` 225 → 227: the two new read-only ledgers, `deadPulserFrames` and `blockRockPresses`.
- PRODUCER-PLACEHOLDER
- **Not run, by the brief:** `pytest`, the unfiltered local vitest (⚖ 52) and `standing-values --write`.

## What the brief got wrong (measured)

- **"The model clock charges 150, the game counts 149":** the game's *counter* counts 149; the game's *clock* is 150.
  `gameClock.test.js`'s free oracle (the game's latched `save.time`) is green at 150 and red at 149. The Pulser's
  measured 150 agrees. No wave is owed.
- **"`freezeFramesStepResponders`: the responders step on every other `freezeObjects` dead frame":** only the seal
  piece could be witnessed here. The other six kinds are named residue. Their rooms hold no responder on the corpus, and
  each needs a boss, an arena, a specific arrival or a one-frame alignment to stage. The key steps the seal piece only.
- **"The Pulser's pulse timer and its hits run on dead frames":** the timer, yes, by the frame counts measured. The hits
  fire but are inert to the player and the enemies under the freeze. A hit on a fire block would move it, and the key
  refuses that by name (the interleave). **And not on a dialogue's frozen ticks**, which the source alone would not
  predict (`Game.update` does not gate on `talking`). The measurement decides.
- **"A census count of 0 says the gap needs a staged witness":** true for the responders and the block. For the Pulser the
  census is **not** 0. The Pulser is the first dead-frame key that moves the corpus.
- **"The base's last 8 OFF keys (… `plainPickupInFreeze`)":** measured at the base, the last 8 OFF keys are
  `chestCoverFencepost` … `wandShotEnemyBodies`, and `plainPickupInFreeze` is the 9th from last. The composition rows
  turn all 9 ON.

## Hand-overs

### Planner (fidelity)

- **PASS.** Three keys are ready for a flip decision:
  - `freezeFramesStepResponders` and `blockPressesFallRockButtonSameFrame` re-record nothing (0 tape movers, 0 md5 moves,
    0 sweep rows);
  - **`pulserDeadFrameUpdate` moves 7 tapes' ledgers, and a flip re-records two model goldens:**
    `fixtures/sound-cue-goldens/` for `prox-l38-chest`, and `seedlingMachineSkin`'s L38-ring-wire machine ops. It also
    needs `levelRun.test.js`'s r5-shaft `pulserPlayerHits` staging window widened past t2041. No game-witnessed row moves.
    It also moves `r5-shaft-control`'s
    unpinned spinner-kill tick further from the game: 1207 ON vs the game's 1643, with OFF 1397 already wrong. A wave on
    the spinner's pulse-kill path (its hits / i-frames / knockback under the pulse) is owed before or with that flip. The
    game's per-tick spinner stream is reachable with `witness-deadframe2.mjs --tapes=r5-shaft-control`.
- CI: dispatch `unittests_frontend.yml -f train_only=true` at the head (I can't dispatch).
- The census tools (`census2-scratch.py`) count the Pulser too. Rerun them on a new corpus before trusting "0".

### HAMMER (`seedling-hammer-phase-planning-16`)

- None from this measurement: ON changes no solve, no acceptance seed and no stream.
- Read-only notes:
  - with `pulserDeadFrameUpdate` ON, a solver view taken between a dead span's site and the next advance sees the Pulser
    before its dead frames ran. The queue runs at the next advance, as wave 66's responder queue does;
  - **unverified here:** `pulserForecastPulse` (the spinner forecast steps the room's Pulsers, `levelRun.js:5760`) was not
    read for dead spans. If it forecasts across a lump without the span, it will disagree with the run once this key
    flips. That is the hammer's to check.

### JS arc

None.

### Residue

- **The other dead frames for the responders:** a door ceremony's, the moonrock's, BobBoss's and LavaBoss's rocks', the
  wand's approach fade's, a seed's cover fade's and a Help's. All are unwitnessed, and the census finds 0 rooms with
  responders on the corpus.
- **The interleave of a block's dead-frame glide with the dead responder steps:** derived, unwitnessed. Closing it is an
  edit of `frozenTickUngated`'s ON branch: **STOP, named**.
- **A span's rock as a Solid to the dead steps** (wave 66's M5): still a reading of the add order. Not staged here.
- **A button span's frame-A row:** with `frozenTickUngated` ON, the model's row A already carries the span's glide. This
  is the existing span placement, shared with the player's press.
- **The Pulser on a button rock's frame A** (a frozen tick): the source says it runs. `p-span` cannot tell, so the key
  steps none.
- **A dialogue's frozen ticks:** measured to run no Pulser update. Whether they run the responders (the model steps them)
  is unwitnessed.
- **A dead-frame pulse that reaches a fire block:** refused by name (the interleave). None on the corpus.
- **The spinner's pulse-kill tick on `r5-shaft-control`:** 246 ticks off OFF (hand-over above).
- **A crusher or an ice turret on a FallRock's Button:** still read at the tick's end (unwitnessed).
- **The survey legs:** not counted (no cache).
