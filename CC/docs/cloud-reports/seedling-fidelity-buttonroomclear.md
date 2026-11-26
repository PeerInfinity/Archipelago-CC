# Seedling fidelity BUTTONROOMCLEAR (wave 63): a ButtonRoom reached by another presser's publish runs its whole setter

**Verdict: PASS.** One new key, `publishedButtonRoomSetter`, ships OFF and is appended last.

I measured the game on 17 staged L38 shapes (p4g). In every shape where another presser publishes a TRUE into a
ButtonRoom's group, the game runs that ButtonRoom's whole setter:
- it clears the ButtonRoom's own tag;
- a cross-room one also writes its target, and that write is SEEN on the page's readout;
- a flip-1 one answers FALSE. Every responder ends the frame false, so a Lock or a Cover in the group **never opens**
  (the walk stayed blocked for 260 ticks), while a FallRock still falls.

The model with the key ON:
- replays 15/17 shapes at 0 px with the game's exact cleared set (L37 and L38);
- the 2 misses are the Button → Lock and Button → Cover **controls**, which have no ButtonRoom. There, ON rows equal OFF
  rows: the base model opens one update earlier than the game. That is a pre-existing lag, not this key's, and it is
  handed over below.

OFF is byte-inert:
- the acceptance md5 is the standing value at the base, head OFF, head ON and head ON + the last 4 keys;
- 294/294 tapes are identical OFF vs ON, both alone and composed;
- there are no fixture, golden or tape diffs.

**The census finds 0 reachable ButtonRooms in any real room.** That covers all 11 vanilla ButtonRooms, the delivered
set, the committed generated presets and a 1200-room generator sweep that placed 264 ButtonRooms (1444 rooms in all). So nothing a solver certifies in a real
room changes, and the keyed ON-arm sweep has **0 legs**.

| | |
|---|---|
| Start (base) | `6ff6b09df9c54d8afe1e716db2cd21eb34919d7b` (wave 62's tip, on wave 61 on main's W59) |
| Code head (last code commit) | `bb2e32592836e9985cc552858f37cb6c453ef128` (CI `JavaScript Unit Tests` push run 45745898019: **success**) |
| Commits | `39257385` (model, key, pins, rows, witness), `bb2e3259` (census + surface regen, D3 evidence), then this report |
| Harness branch | `claude/buttonroom-tag-clear-model-4074or` (local branch `seedling-fidelity-buttonroomclear`) |
| Keys / ON / `SOLVER_ENV_NAMES` | base **151 / 126 / 248**, head **152 / 126 / 249**. Measured by importing `contactFidelity.js` and `solverEnvChannel.js`; the env list is sorted, with no duplicates. |

## D1: the AS3, the game, and the model

### 1. The setter and its callers (`vendor/seedling/src`)

**`ButtonRoom.as`, in full:**
- **`check()` (`:40-50`):** `_active = !Game.checkPersistence(tag); activate = _active;`. A cleared own tag boots the
  ButtonRoom pressed and runs the setter at build.
- **`update()` (`:52-65`):** `activate = <overlap of Player/Enemy/Solid, not a Cover>` every frame. A false is ignored
  by the setter.
- **`set activate(a)` (`:67-98`):** the whole body is inside `if (a)` ("Can't be reset to false!!").
  - A sound plays on the false→true edge (`:71-72`).
  - `persist = _active`, negated when `flip` is set (`:74-78`).
  - **`room == -1` (`:79-90`):** `getClass(Activators)`, and `v[i].activate = persist` on every `v[i] != this` with
    `t == t`.
  - **otherwise (`:91-94`):** `Game.setPersistence(t, persist, room)`. That writes the slot **keyed on the TSET** in
    level `room`.
  - **`:96`**, outside the room branch: `Game.setPersistence(tag, !activate)`. That is the ButtonRoom's OWN tag
    cleared (`activate` is true here).

**Every caller** (re-measured: `grep -rn "\.activate *="` and `grep -rn "[^.]activate *= "` over `src/`):

| Caller | Cite | Can it reach a ButtonRoom with `true` in a real room? |
|---|---|---|
| `Button.set activate` → `activateAll(this, t, activate)` | `Button.as:42-61` | Yes. It runs every frame the Button is held (`Button.update` `:27-40`) and publishes `true` to every other `Activators` of `t`, a ButtonRoom included. |
| `RopeStart.set activate` | `RopeStart.as:79-91` | Yes. On a pull (`hit()` `:40-49`, from a sword hit) and on a pulled rope's `check()` (`:31-38`). |
| A `room == -1` flip-0 ButtonRoom's publish | `ButtonRoom.as:79-90` | Yes. Into a flip-1 or cross-room one. Into another flip-0 one it recurses: wave 62's hang. |
| A `room == -1` flip-1 ButtonRoom's publish | same | No. It publishes `false`, which a ButtonRoom ignores. |
| `Wand.removed` | `Pickups/Wand.as:55-70` (`n.activate = true` on every tset-0 member) | Yes, in a room with a wand and a group-0 ButtonRoom. The census finds none. |
| `FinalBoss` "dead" | `Enemies/FinalBoss.as:218` (`Button.activateAll(null, 0, true)`) | Only in L112 group 0, which holds no ButtonRoom. This is not a model publish (wave 62's note). |
| Own `update()` / `check()` | above | the direct press and the boot (the model already has both) |

The rest of the hits are self-assignments inside other classes: `LightPole`, `FallRockLarge`, `Lock.checkEnemies`,
`ShieldLock`, `RockLock`, `BossLock`. None publishes to another entity.

**The order: the one fact that decides the responders.**
- `World.getClass` walks the **update list** (`net/flashpunk/World.as:839-851`), and `addUpdate` **prepends**
  (`:937-951`). So `getClass` order is the **reverse** of the add order. (The brief says "`getClass` order = the add
  order"; it is the reverse.)
- `Game.loadlevel` adds by TYPE, one loop per class (`Game.as:2341-2419`), in this order:
  1. `button` (`:2341`)
  2. `buttonroom` (`:2342`)
  3. `arrowtrap`, `fallrock`, `fallrocklarge`, `rocklock`, `lock`, `pulser`, `cover`, `grasslock`, `shieldlock`,
     `wandlock`, `lightpole`
  4. `rope` (`:2419`)

  Only `crusher` (`:2300`) is added before the pressers.
- **So every responder the model has is BEFORE every ButtonRoom and Button in `getClass` order.**
  - A responder can never be "after the ButtonRoom in add order", so the brief's before/after variants have exactly one
    real order.
  - Within the `buttonroom` loop, the order is the reverse of the XML order.
  - The **touch responder** (`ShieldLock`) has `t = -2` (`ShieldLock.as:26`, `super(_x, _y, -2, …)`), so no group can
    publish into it. That lane does not arise.
- **Hence, within one frame,** a Button held in a group with a `room == -1` flip-1 ButtonRoom runs
  `activateAll(true)`. In order:
  1. every responder gets `true`;
  2. the ButtonRoom gets `true` and publishes `false` to all, the Button included. The Button's own setter then
     publishes `false` to all again.
  3. the outer loop goes on to the entries after the ButtonRoom: only other pressers (and a `Crusher`, which therefore
     ends `true`; no Crusher is in such a group anywhere).

  Every responder ends the frame **false**. Responders also update **before** the pressers, so at their own update
  they read the false the previous frame left. A setter that **acts** on the true (`FallRock.set activate` → `fall()`,
  `FallRock.as:111-118`) still fires.

### 2. The census (`-evidence/tools/census.mjs` → `d3/census.txt`)

**What it counts:** every group holding a ButtonRoom plus another publisher of a TRUE into that group: a Button, a
RopeStart, another `room == -1` flip-0 ButtonRoom, a `wand` (group 0), or a `finalboss` (group 0). It splits the
reached ButtonRoom by `room` and `flip` and lists the group's responders.

**Controls** (shown to find the shapes):
- wave 62's 17 shapes: 14 reachable ButtonRooms in 12 rooms;
- this wave's 17 shapes: 17 reachable ButtonRooms in 15 rooms. That is every shape except the two no-ButtonRoom
  controls `btn-lock` / `btn-cover`; `btn-brx0-then-brx1` and `btn-brx1-then-brx0` hold two each.

**The real rooms:**

| Set | Rooms | ButtonRooms | Reachable by another publisher |
|---|---|---|---|
| vanilla atlas | 116 | **11** | **0** |
| delivered (playthrough AP_1, p4g) | 116 | 11 | 0 |
| committed generated presets (5 sets) | 12 | 0 | 0 |
| generator sweep: `generateSeedlingLevel`, all 12 `GENERATE_BIOMES` × elements {default, `ropegate`, `holdgate`, `weighgate`, `guard`} × seeds 1–20, box-gate bounds `{obstacleTarget 6, triesPerStep 8, saturationK 3}` | 1200 (0 refused) | 264 (407 buttons/ropes) | 0 |
| **TOTAL (controls excluded)** | **1444** | | **0** |

**The 11 vanilla ButtonRooms**, each alone among its group's true-publishers:

| Level | Position | `t` | tag | flip | room |
|---|---|---|---|---|---|
| L20 | `buttonroom@192,16` | 0 | 4 | 0 | -1 |
| L38 | `buttonroom@208,224` | 1 | 3 | 0 | -1 |
| L38 | `buttonroom@32,48` | 8 | 4 | 1 | 39 |
| L38 | `buttonroom@144,128` | 2 | 0 | 0 | -1 |
| L38 | `buttonroom@144,288` | 4 | 5 | 1 | 37 |
| L40 | `buttonroom@160,128` | 1 | 1 | 0 | -1 |
| L40 | `buttonroom@272,208` | 0 | 7 | 0 | -1 |
| L40 | `buttonroom@880,768` | 3 | 12 | 0 | -1 |
| L61 | `buttonroom@176,40` | 1 | 1 | 1 | 63 |
| L63 | `buttonroom@32,64` | 0 | 0 | 1 | 62 |
| L107 | `buttonroom@288,176` | 0 | 1 | 0 | -1 |

**There is no vanilla headline.** No real room holds the shape. Every vanilla flip-1 ButtonRoom is a cross-room one,
so no vanilla group carries the flip-1 answer either.

### 3. The game (`-evidence/tools/br-witness.mjs` → `d3/witness-p4g.json` / `.log`)

**Method.** This is wave 62's: the vanilla L38 plus the shape's entities, all in group 6 (which L38 does not use),
loaded through `botLoadLevels` under its own `set_id` (level data; no game edit).
- One fresh page per shape. `botStatus` is sampled every 150 ms (the persistence readout for L37/L38, the tick, the
  level and the position), and `botDrain` (the per-tick stream) is read at the end.
- The rooms and tapes are `fidelityPublishedButtonRoom.BR_SHAPES` and `brTape`. The rows replay the same rooms and
  tapes.
- The tapes all boot at (144,192) and walk DOWN:
  - **walk:** across the on-walk presser (144,224) and the vanilla `buttonroom@144,288` (t 4, flip 1, room 37: it
    clears 38,5 and writes 37,4), through the south door to L37 at t 88;
  - **revisit:** then UP through `teleporter@288,0` back into L38, arriving at (144,288), and stands. That is a new
    `Game`, so the published-to ButtonRoom's `check()` runs;
  - **pull:** onto a rope (a Solid), the sword at t 62, then on;
  - **long:** 260 ticks.
- `errors: 4-5` per page is the logic-only channel's WebGPU noise (the device is lost at the first present, as
  asked); there is no `pageerror`.

**⚠ The AS3 confirms wave 62's table.** A flip-0 `room == -1` ButtonRoom reached by a true re-publishes true, so with
any other pass-through it recurses (pass + br0 ≥ 2: `btn-br0`, `br0-br0` hang). So the non-hanging published-to
ButtonRooms are exactly the **flip-1 local** ones and the **cross-room** ones, flip 0 or flip 1. A cross-room one
publishes nothing locally, so it cannot loop. No other shape reaches a ButtonRoom by publish without hanging.

The game's state per shape (the last sample; `drained` = the stream's rows; "cleared" = L37/L38 slots off):

| Shape (group 6) | Tape | Drained / tick | `dead_frames` | End | Cleared (37/38) | The game's state |
|---|---|---|---|---|---|---|
| `btn-br1`: Button on the walk, flip-1 off it | walk | 91 / 90 | 40 | L37 (296, 28.7) | 37,4 38,5 **38,10** | the published-to flip-1 ButtonRoom's own tag is cleared |
| `btn-brx1`: Button, cross-room flip 1 (room 37) | walk | 91 / 90 | 40 | L37 | 37,4 **37,6** 38,5 **38,10** | the cross-room write 37,6 ← false is **SEEN** in the readout (L37 is entered: the write is read back on the target level) |
| `btn-brx0-then-brx1`: Button, brx0 (XML 1st), brx1 (XML 2nd), one target slot | walk | 91 / 90 | 40 | L37 | 37,4 38,5 **38,10 38,11** | 37,6 **ends TRUE**: brx1 (later in the XML, earlier in `getClass`) writes false, then brx0 writes TRUE |
| `btn-brx1-then-brx0`: the same, XML swapped | walk | 91 / 90 | 40 | L37 | 37,4 **37,6** 38,5 38,10 38,11 | 37,6 ends false: brx0 first, brx1 last |
| `br0-br1`: flip-0 on the walk, flip-1 off it | walk | 91 / 90 | 40 | L37 | 37,4 38,5 **38,10** 38,11 | the flip-1 one published to clears 38,10 (38,11 is the pressed one) |
| `br0-brx1`: flip-0 pressed, cross-room flip 1 off it | walk | 91 / 90 | 40 | L37 | 37,4 **37,6** 38,5 **38,10** 38,11 | the cross-room write through a flip-0's publish |
| `pull-br1`: rope pulled by the sword, flip-1 off the walk | pull | 201 / 200 | 40 | L37 | 37,4 38,5 **38,10** 38,12 | the pull's true clears 38,10 (38,12 is the rope's own) |
| `ropeboot-br1`: rope tag 12 staged cleared, flip-1 off the walk | walk | 91 / 90 | 40 | L37 | 37,4 38,5 **38,10** 38,12 | the rope's `check()` → `hit()` publishes true AT BUILD: 38,10 is cleared before the first sample |
| `btn-br1-revisit` | revisit | 141 / 140 | 60 | L38 (152, 296) | 37,4 38,5 38,10 | re-entry: no change. `check()` boots the ButtonRoom pressed and re-runs its setter, which re-writes 38,10 false and publishes false (no responder) |
| `btn-brx1-revisit` | revisit | 141 / 140 | 60 | L38 | 37,4 37,6 38,5 38,10 | re-entry re-writes 37,6 false: no change |
| `br0-br1-revisit` | revisit | 141 / 140 | 60 | L38 | 37,4 38,5 38,10 38,11 | both boot pressed: the flip-0's `check()` true reaches the flip-1 again; no change |
| `btn-lock`: control, Button + Lock (t 6) below it | long | 261 / 260 | 40 | **L37** | 37,4 38,5 | the Lock fades open and the walk goes on. Its tag 13 is written back TRUE when the Button is released (`returnToNormal`) |
| `btn-br1-lock`: + a flip-1 off the walk | long | 261 / 260 | **20** | **L38 (152, 237)** | 38,10 | **the Lock NEVER opens**: the player stands on the Button for 230+ ticks, blocked |
| `btn-cover`: control, Button + Cover below it | long | 261 / 260 | 40 | L37 | 37,4 38,5 | the Cover opens |
| `btn-br1-cover` | long | 261 / 260 | 20 | **L38 (152, 237)** | 38,10 | **the Cover NEVER opens** |
| `btn-br1-rock`: + a FallRock (t 6, tag 14) | long | 261 / 260 | **222** | L37 | 37,4 38,5 38,10 **38,14** | the rock **falls** (its tag, and the 202-frame freeze in `dead_frames`): its setter acts on the true |
| `br0-br1-lock`: flip-0 pressed, flip-1 off it, Lock below | long | 261 / 260 | 20 | **L38 (152, 237)** | 38,10 38,11 | the flip-0 "latch" is answered false: **the Lock never opens** |

**Can this page's readout show a TRUE written into another room?** Only by ABSENCE. `persistence_cleared` lists the
false slots (`Bot.as:2011-2025`), and a slot that starts true and is written true does not change. So the TRUE was
made visible by order: in `btn-brx0-then-brx1` the slot 37,6 is first written false, then TRUE, and it is absent from
the readout. With the XML swapped it is present. Staging L37,6 cleared at boot was refused by the tape validator,
because no L37 entity reads tag 6. (`brx-btn`, the brief's cross-room witness, is wave 62's **directly pressed**
cross-room ButtonRoom. Its 38,10 is that press, not a publish: brief error, below.)

**The responder order (the related item):** measured by consequence, since the page has no Lock/Cover readout:
- **Lock** and **Cover**: never open, so the model, which opens them, is wrong. That is what licensed modelling it.
- **Fall rock**: falls, which the model already does.
- **Touch responder**: does not arise (`t = -2`).
- **Pulser** and **ArrowTrap**: not staged. They read `activate` at update exactly as the Lock does, and they are
  added after the ButtonRooms, so they end false. Modelled by the same change, unwitnessed.

### 4. The model's map (at the base)

- **The presses.** `activators.stepActivators`:
  1. `chestCoverFencepost`'s snapshot;
  2. `presserRecursionHang`'s early return;
  3. `pressedGroups` (every presser down → its `t`);
  4. **the `roomWritten` loop**: a ButtonRoom the Player's box or a moving solid overlaps → one `roomwrite`
     (`crossRoomWrites` + `localPublish`) per visit, and a flip-0 local one sets `state.latched`;
  5. the responder loop: `active = pressed.has(t) || latched.get(t)`.
- **The boot.** `createActivatorState` → `bootPress` (F6: a pressed-at-boot ButtonRoom is marked written and a flip-0
  one latches through `latchAtBuild`). Then `levelRun.buildActivatorState` → `bootPulledRopes` →
  `publishRopeGroup({atBuild})` → `latchAtBuild` (F7).
- **The publishes of a true:**
  - `pressedGroups` (a Button, a ButtonRoom);
  - the `roomWritten` loop's `latched.set`;
  - `latchAtBuild`;
  - `publishRopeGroup` (a pull → `latched.set`);
  - the wand's sweep (`levelRun`'s `Wand.removed` arm → `latched.set(WAND_PICKUP.tset)`).

  `pressedGroups` + `latched` are also read directly by the pulser and arrow-trap lanes (`stepPulsersNow`,
  `armedPulsersNow`, the arrow-trap step and forecasts). FallRocks are armed separately (`fallRocksArmedBy`, the rope
  and wand drops).
- **The ledger.** `levelRun.applyLockEvents`' `roomwrite` arm:
  - `roomWrites` (every write);
  - `pendingEarnedClears` (a false write; cashed into another level at once);
  - `unreadRoomWrites` (a cross-room false into a level that carries no reader of the tag);
  - `earnedClears` (derived from `roomWrites`' false rows).
- **The group index.** `levelWorld`'s `pressers` rows (`room`, `flip`, `persistTag`, `bootPressed`), in entity
  order.
- **The gap, at the base:**
  - a ButtonRoom reached by a publish writes nothing;
  - its tag stays set, so it boots unpressed next visit where the game boots it pressed;
  - its cross-room write and a flip-1 one's false answer are missed, so the model opens Locks and Covers that the game
    holds shut.

### 5. The change chosen (the measured behaviour, modelled)

**(A) The setter writes.** `stepActivators` runs, after the `roomWritten` loop, every OTHER ButtonRoom of a group a
TRUE is published into, through `publishedButtonRoomWrites`:
- **The sources:** this step's presses that publish true (a Button down; a local flip-0 ButtonRoom down). Also the
  queued publishes (`queuePublishedTrue`, `state.publishedTrue`): a rope pull (`publishRopeGroup`), the wand's sweep,
  and a build's `check()` (`latchAtBuild`: a pulled rope, a pressed-at-boot flip-0).
- **Each reached ButtonRoom** gives one `roomwrite`, the same event its own press gives (`crossRoomWrites` +
  `localPublish`, `publishedBy` naming the publisher):
  - it is emitted once per visit (`state.roomWritten`, the press's own ledger);
  - it is emitted in **`getClass` order**, the reverse of the XML order, so two writes to one slot land as the game's;
  - a local flip-0 one is skipped: its answer recurses, the `presserRecursionHang` family.
- **A TRUE `roomwrite` puts its slot back on.** The slot leaves `pendingEarnedClears`, `clearedByLevel` (the other
  level's memo is dropped) and `unreadRoomWrites`. The earlier false rows are marked `restoredBy`, which `earnedClears`
  skips. The mark is written at run time, so a reader outside the switch scope reads the same ledger.

**(B) The flip-1 answer.** In a group holding a local flip-1 ButtonRoom (`flipAnswerGroups`):
- a Button / flip-0 press does not press the group (`pressedGroups`);
- no publish latches it (the `roomWritten` loop, `latchAtBuild` — which also starts no fade — the rope pull, the
  wand);
- every lane reading `pressedGroups` + `latched` (locks, covers, pulsers, arrow traps) therefore sees it false;
- the rocks still fall: their arming is separate and unchanged.

**The next-visit boot** needs nothing new. The banked clear makes `bootPressed` true on re-entry, and F6's `bootPress`
already runs the pressed-at-boot setter. With (B), a pressed-at-boot flip-0 in a flip-answer group latches nothing
(the `br0-br1-revisit` arm).

**The STOP rule:**
- **Not stopped:** every case was measured, held in existing state, kept byte-identical OFF, and changes nothing in a
  vanilla room (census 0).
- **One case refuses by name instead of modelling** (an interim, named): a cross-room **flip-0** ButtonRoom whose tag
  the publish cleared boots pressed on the next visit. F6's `bootPress` refuses that shape ("a TRUE written over
  whatever level `room` holds now"). With the key ON, a run that re-enters such a room after a publish now reaches
  that standing refusal. OFF it boots unpressed, with the wrong ledger. It is not witnessed (no revisit tape stages
  it) and not in any real room.

## D2: the key

**`publishedButtonRoomSetter`** (`SEEDLING_PUBLISHED_BUTTON_ROOM_SETTER=0|1`) is the last key of
`CONTACT_FIDELITY_DEFAULTS`, after `presserRecursionHang`.
- Its doc block carries the cites, the measured witness, the ON shape, the named not-modelled items and the env line.
- `SOLVER_ENV_NAMES` gains the name in sorted place (before `SEEDLING_PULSER_FORECAST_PULSE`).

**OFF:**
- `pressedGroups` reads no new set; the `roomWritten` loop, `latchAtBuild`, `publishRopeGroup`, the wand arm and the
  `roomwrite` banking take their old branch;
- `state.publishedTrue` and `restoredBy` are never written;
- `flipAnswerGroups`' WeakMap fills only from ON paths.

The only OFF-visible edit is `pressedGroups`' loop, rewritten from a one-line `if` into a `for` with `continue` (same
result). The `earnedClears` loop gained one `if (r.restoredBy) continue;` that cannot fire OFF.

**Composition:**
- With `presserRecursionHang`, its early return stays first in `stepActivators`. My block runs after the
  `roomWritten` loop (after both of the base's keyed blocks).
- A flip-0 receiver is skipped, so the hang family is untouched. The row runs all 17 of wave 62's shapes with both
  keys ON = that key alone, and `btn-br0` still throws `PresserRecursionHang`.
- `fidelityPresserHang.test.js` is green with my env ON (the mover sweep).

**Key-order pins** (a grep of `presserRecursionHang` across `frontend/**` and `scripts/**`; no pin under `scripts/**`):
- 26 fast-tier tail arrays gain `'publishedButtonRoomSetter'`. That includes `fidelityFreezeSpanUpdates`'
  `slice(-5)` → `slice(-6)`, `fidelityNestedRockCeremony`'s `slice(-4)` → `slice(-5)`, and the Ceremony126 filter.
- `contactFidelity.test.js`: the defaults object and the env-skip list.
- `fidelityPresserHang`'s "appended last" `.at(-1)` row now pins its tail as `['publishedButtonRoomSetter']`.

**Rows** (`fidelityPublishedButtonRoom.test.js`, fast tier, **41 rows**; green with the env unset; the "OFF in this
process" row is skipped by design with the env ON):
- **The key:** OFF, last, the env name; OFF in this process.
- **The parts on built worlds:** `flipAnswerGroups` (local flip-1 only). `publishedButtonRoomWrites`: `getClass`
  order, once per visit, not the publisher, not a flip-0. ON, a Button press in a flip-answer group presses nothing,
  and a queued publish is drained by the step.
- **One row per witnessed shape (17):** ON = the game (0 px over every drained row, equal row count, the exact L37/L38
  cleared set). OFF's cleared set differs from the game (it misses the published-to write, or it opens the responder).
  For the two lag controls, ON's whole result = OFF's, and the base's level-differs lag is pinned.
- **The next-visit boot:** in the three revisit shapes the published-to ButtonRoom builds `bootPressed` ON and not
  OFF, and the re-entry adds nothing to the ledger.
- **Near misses** (ON = OFF, the whole result): a lone flip-1 pressed directly; a Button with a flip-1 in **another**
  group; a published **false** (flip-1 into flip-1); wave 62's `brx-btn` (a cross-room ButtonRoom pressed directly).
- **Composition:**
  - with `presserRecursionHang` (above);
  - with the base's last 4 OFF keys (`nestedRockCeremony`, `plainPickupInFreeze`, `chestCoverFencepost`,
    `presserRecursionHang`): five witnessed shapes still match the game;
  - `prox-l38-chest` with all five ON = the 4 alone.
- **Vanilla, ON = OFF (the whole `runTape` result)** for 11 tapes through the ButtonRoom rooms and the wand:
  `prox-l38-chest`, `prox-l38-reach-l39`, `r5-l38-fade-door`, `r5-l40-part0`, `r5-l40-join`, `l40button-l41-part0`,
  `axe-l61-reach-l63`, `r3-collect-shield`, `r5-l43-wand`, `r5-shaft`, `f7-l16-reentry`. All 294 tapes are in D3.

**Mutants** (`tools/mutants.py` → `d3/mutants.txt`; copy → break → run the file → restore; `git status` clean
after). Each was predicted, then observed:

| Mutant | Predicted | Red (of 41) |
|---|---|---|
| M1 reached ones in XML order | both two-on-one-slot shapes, the `getClass` unit row | **4**: those 3 **+ the last-4 composition row** (it holds `btn-brx0-then-brx1`; missed in the prediction) |
| M2 no flip-1 answer in `pressedGroups` | `btn-br1-lock`, `btn-br1-cover`, the composition row, the unit press row | **5**: those 4 **+ `br0-br1-lock`** (a HELD flip-0 is a press too, so the latch half alone does not hold it; missed in the prediction) |
| M3 a flip-0 press still latches a flip-answer group | `br0-br1-lock` only | 1: `br0-br1-lock` |
| M4 the rope pull is not queued | `pull-br1`, staged and composition | 2: as predicted |
| M5 a TRUE `roomwrite` does not restore the slot | `btn-brx0-then-brx1`, staged and composition | 2: as predicted |
| M6 cross-room ButtonRooms are not run | every brx shape, the revisit row, the `getClass` row, a composition row | 8: as predicted |
| M7 a build `check()` publish is not queued | `ropeboot-br1` only | 1: as predicted |

## D3: measurement

- **Byte-inertia, OFF.**
  - `git diff --name-only 6ff6b09d HEAD | grep -aE 'fixtures/|golden|tapes/'` is **empty**.
  - `batch-seedling-acceptance.mjs 2>/dev/null | md5sum` is `391322d681b7aa0229d94b3f6906d024` at **all four** points
    (`d3/acceptance-md5.txt`): the base (a detached worktree at `6ff6b09d`, with the submodules copied in; its first
    attempt without them printed nothing), the head OFF, the head ON, and the head ON with the last 4 OFF keys ON.
- **Every committed tape OFF vs ON** (`tools/tape-onoff.mjs`): **294/294 byte-identical**, and 294/294 with the last 4
  keys ON in both arms (`d3/tapes-onoff.txt`, `d3/tapes-onoff-last4.txt`).
- **The census's ON answer:** 0 reachable ButtonRooms, so ON changes no real room. The controls' ON answer is the
  witness table, through the rows.
- **Runtime probe** (`tools/runtime-probe.py` → `d3/runtime-probe.txt`):
  - a marker throw at **every** ON branch that changes something: a reached ButtonRoom's setter, the `pressedGroups`
    answer, the `latchAtBuild` answer, the press latch answer, the pull and wand latch answers, a TRUE `roomwrite`;
  - **0 fires**: 294/294 tapes identical with the probe in their ON arm, and the ON acceptance md5 with the probe is
    the standing value;
  - **positive control:** this slice's rows go 21 red with 9 probe messages, across six sites. The wand site does not
    fire: no row stages a wand group with a ButtonRoom. Restored; clean.
- **ON movers: none.**
  - I ran **145 fast-tier files** with `SEEDLING_PUBLISHED_BUTTON_ROOM_SETTER=1`: the gate list below plus every
    fast-tier test naming `buttonroom`, `roomwrite`, `crossRoomWrites`, `localPublish` or `latched`
    (case-insensitive). Result: **145/145 green**, 4620 passed and 2 skipped. The skips are env-skip rows by design,
    this file's "OFF in this process" among them.
  - **The 6 `.train.`/`.slow.` files** that name those words ran with the key ON, **one at a time**, under their own
    config (`--maxWorkers=1`). **All green:** `deriveLevelWorldLogic.latchSandwich.slow` (3), `hammerBk2Combat.train`
    (4), `hammerLatchWeigh.train` (2), `hammerPocketBurn.train` (4), `hammerSouthDoor.train` (4),
    `strategySwitchTable.slow` (4).
- **The witness replay** (`tools/replay-witness.mjs` → `d3/replay-on.txt`). ON against each committed stream:
  - **15/17 at 0 px** with equal rows and the game's cleared set;
  - `btn-lock` and `btn-cover` (no ButtonRoom) have ON rows = OFF rows. The model's Lock/Cover opens one update before
    the game's (first differing row 124 / 34), the base's lag;
  - OFF matches the game's cleared set on **none** of the 15 ButtonRoom shapes.
- **The named sweep:** the keyed ON-arm sweep has **0 legs**. No vanilla or delivered room holds a reachable
  ButtonRoom (census), so no seed-1 leg or survey step can move. Shards = min(10, 0) = **0**, ×1 per arm: nothing to
  dispatch.

## Gates

- **Bounded vitest** (`--maxWorkers=3`). The files are:
  - the brief's globs;
  - every `grep -a -l` file for `roomWritten`, `crossRoomWrites`, `localPublish`, `roomwrite`, `latched`, `bootPress`,
    the key and `presserRecursionHang` (every key-order pin);
  - the named gate files; fast tier only.
  - **Before**, at the base (a detached worktree at `6ff6b09d`, submodules copied): **107/107 files, 3532 passed.**
  - **After**, at `39257385` (+ this file), 108 files: 107/108. The red was `seedlingConstantsCensus`, 5 rows: the new
    `u >= 0` literal is unclassified and lines moved, as expected. After the regen below, `seedlingConstantsCensus` +
    `seedlingSolverSurface` are **60/60**. The 145-file ON sweep above ran at `bb2e3259`, after the regen.
- **`ci-producer-checks.mjs --jobs=3`:** 99 run, **0 red**, 1 skipped (the harness's browser-matrix skip).
- **`check-procgen-docs.mjs`:** ALL CHECKS PASSED. **`generate-procgen-reference.mjs --check`:** all 7 modules and
  5 regions match.
- **Constants census:** `--check` was RED on one new rule literal: `levelRun.js|applyLockEvents|h6d4dbb3a|0|0`, the
  `u >= 0` found-test. It is classified `structural` (a row added at the END of `seedling-constants-fields.csv`). Then
  `--write`, `--profile-rows`, `--write`, and `--check` **PASS** (7192 literals; 0 new, 0 vanished, 0 moved).
- **Solver surface:** `--check` RED (line moves), then `--write` (374 rows), then **GREEN**.
- **The six `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check`:** all green.
- **CI** (`JavaScript Unit Tests`, the push run at the last code head `bb2e32592836e9985cc552858f37cb6c453ef128`, run
  45745898019; it touched `docs/**`, a filtered path): **all four suite jobs success**. The unfiltered suite is **30273
  passed, 0 skipped, 0 failed**; the slow battery is **460 passed**.
  - The train tier does not run on a slice push. Dispatch `unittests_frontend.yml -f train_only=true` at
    `bb2e32592836e9985cc552858f37cb6c453ef128` (I cannot dispatch: 403).

## What the brief got wrong (measured)

- **"`getClass` order = the add order; `addUpdate` prepends."** These contradict each other. `getClass` walks the update
  list, which `addUpdate` prepends to, so it is the **reverse** add order (`World.as:839-951`).
- **"before and after the ButtonRoom in add order"** for the responders. `Game.loadlevel` adds by type, and every
  responder class's loop comes after the `button`/`buttonroom` loops (`Game.as:2341-2419`). So every responder is
  before every ButtonRoom in `getClass` order: one real order. Only a `Crusher` comes after, and none is in such a
  group.
- **"a touch responder"** in the group cannot be staged: `ShieldLock` is `t = -2`.
- **"`brx-btn` (a cross-room ButtonRoom, room 37) also cleared 38,10"** is wave 62's cross-room ButtonRoom on the
  **walk**, pressed directly, with the Button off the walk. Its 38,10 is the direct press, which the model already
  banks. The published-to cross-room shapes are new here (`btn-brx1`, `br0-brx1`, the two-on-one-slot pair), and their
  write is SEEN in the readout.
- **The related item's direction.** The brief says "responders after the ButtonRoom … see true, then false". It is the
  responders **before** it in `getClass` order (all of them) that take true then false. The consequence is bigger than
  a flicker: they never open.

## Hand-overs

- **Fidelity planner: a one-update Button → Lock / Cover lag in the BASE model.** In `btn-lock` and `btn-cover` (no
  ButtonRoom), the game's walk passes the opened Lock / Cover one tick later than the model's: the first differing row
  is 124 and 34. That holds OFF and ON alike, with the 126 default-ON keys. It is consistent with the update order
  (the Lock updates before the Button, which updates before the Player), giving the game a one-frame publish lag the
  model does not have. It is wave 63's control and not its key. The streams are in `d3/witness-p4g.json`.
- **Fidelity planner: a flip-1 or cross-room ButtonRoom pressed DIRECTLY still "presses" its group in the model.**
  `pressedGroups` adds every presser's `t`. The game:
  - a local flip-1 ButtonRoom publishes **false**;
  - a cross-room one publishes nothing locally.

  No vanilla group has a responder there (census: no reachable groups, and every vanilla flip-1 is cross-room with no
  `t` responders). It is unchanged here: the brief's near miss pins ON = OFF.
- **Sound cues.** With a flip-1 ButtonRoom in a Button's group, the Button's `_active` ends false inside its own
  setter, so `Button.update` re-fires the `Switch` cue (`Button.as:44`) on **every** held frame. The flip-1's own
  `Switch` plays once. `seedlingSoundCues` derives from the drawn frame, not modelled here.
- **The rope set false by the answer.** In `pull-br1` the flip-1's false sets the rope's `_active` false. So the rope
  renders unpulled with its shrunk hitbox, and a second sword hit re-pulls it (a sound, a re-write). Not modelled; no
  real room.
- **`FinalBoss`'s `activateAll(null, 0, true)`** is still not a model publish (wave 62). L112 has no ButtonRoom.
- **Not witnessed:** p4d (the brief's p4g default only); the wand sweep into a ButtonRoom (no wand room has one); the
  Pulser and ArrowTrap lanes (modelled with the Lock by the same AS3).

## Residue

- A cross-room **flip-0** ButtonRoom cleared by a publish, re-entered, reaches F6's standing refusal by name (D1 § 5),
  where the game re-writes TRUE into the target and plays on.
- Same-tick event order: the game writes a published-to ButtonRoom's slots inside the publisher's setter, before the
  publisher's own `:96`. The model emits the direct press's `roomwrite` first. The readout is a set, so it cannot tell;
  `roomWrites`' order within a tick is the model's.
- A queued build/pull/wand publish is banked at the level's next `stepActivators`, with that tick's `t`. The game
  writes inside the frame of the pull or the sweep, or at build. The readout samples cannot resolve a frame.
