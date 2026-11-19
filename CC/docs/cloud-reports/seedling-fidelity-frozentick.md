# seedling-fidelity-frozentick — what runs under the freeze runs on the model's frozen frames too (wave 53)

⚖ GO: Robert 2026-11-18 (planning-22's session), *"W53: frozen-tick gaps (Recommended)"*, plus the launch GO for this
brief. Scope: ONE new `contactFidelity` key, default OFF, and one ON-branch change inside wave 51's `pickupTickFreeze`
(the beam tower on a texted pickup's T). No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-22` |
| Base | `54a27ec910da4ae16a697c2444e67db0991e2b27` (the W51+W52 harvest, TRAIN 159; 143 keys, 126 ON, the last five `darkSuitBossRetaliation`, `owlContactInStep`, `turretSuitRetaliation`, `pickupTickFreeze`, `dialogueFrameFreeze`, all OFF: measured) |
| Harness branch | `claude/frozen-tick-fidelity-gaps-px1t9a` (local branch `seedling-fidelity-frozentick`) |
| Commits | D2 `0c3f3b46` (the code, the key, the rows) · `6637adae` (the doc block; **the last CODE commit**) · evidence `6015548b`, `f0cfdfa4`, `23b1dcff`, `7218be1f`, `d1b174ab` · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; ON moves no measured route answer: 0 ON movers in vitest (183 files), train (29 files), the survey (48 steps) and 294 tapes; the keyed sweep is 209 legs, the planner's) |

**The one thing to know first:** the brief's pushable premise is inverted. A `PushableBlock*` has NO freeze gate (it overrides `Mobile.update`
without `mobileUpdate`), so the model's main-tick step on a frozen tick was already right; what it missed is the DEAD
frames it collapses, where a gliding block glides on. For the chasers the gap is real but narrower than "every freeze":
a pickup's ceremony, a seal piece and the inventory hold already step them (`ceremonyShove`). What was missing is the
dialogue, Watcher and falling-rock frames, and more than `hitUpdate`: the fade, the terrain switch, the pit descent, and
the Puncher's and Jellyfish's chase blocks (no freeze test in either class). Nothing shipped moves ON: L12's Puncher is
out of the Witch's range, and no survey step or tape puts a chaser inside its i-frames, or a block mid-glide, at a
freeze's start.

## D1 — the AS3 and the model, per gap

### What the freeze gates (the AS3)

- **`Mobile.mobileUpdate`** (`Mobile.as:31-46`): `if (!destroy) { if (!Game.freezeObjects) { friction(); input();
  moveX(v.x); moveY(v.y); } layering(); } death();`. Only the move is gated; `death()` (the 0.1 alpha fade and the
  removal, `:60-70`) is not.
- **`Enemy.update`** (`Enemies/Enemy.as:62-111`), none of it tests the flag: the off-screen return (`:64-67`); the
  terrain switch (`:68-91`: water/lava `destroy`, the pit latch); the pit descent (`:92-102`: lerp, spin, alpha, instead
  of `super.update()`); else `super.update()` (`mobileUpdate`), then `if (!destroy) { hitUpdate(); hitPlayer(); }`.
  - `hitUpdate()` (`:223-241`): the colour flash and `hitsTimer--`. **The drain runs on every frozen frame.**
  - `hitPlayer()` (`:211-221`): `p.hit(…)`, which `Player.hit` refuses under the flag (`Player.as:1382`).
  - `Enemy.hit` (`:141-181`) refuses under the flag (`:147`): no new i-frames are opened during a freeze.
- **The chaser classes' own blocks** (below `super.update()`):

| class | freeze test | what runs under the freeze | model (`chasers.js`) |
|---|---|---|---|
| `Bob` (`Bob.as:49-82`) | `if (destroy \|\| "die" \|\| Game.freezeObjects) return;` (`:52`) | the `Enemy` chain only | `freezesOnGameFreeze: true` |
| `BobSoldier` (`BobSoldier.as:73-87`) | `if (Game.freezeObjects) return;` (`:76`) | the `Enemy` chain only | `true` |
| `Bulb` (`Bulb.as:35-63`) | none of its own; `super.update()` is Bob's | the `Enemy` chain; a "drop"/"die" Bulb's slide is `mobileUpdate` (gated) | `true` |
| `Puncher` (`Puncher.as:53-119`) | **none** | the chase block (`v` re-aimed, `direction`, the sprite) and the attack decision; the "attack" anim's `attackPlayer` is refused by `Player.hit` | `false` |
| `Jellyfish` (`Jellyfish.as:45-75`) | **none** | the chase block (`v` re-aimed) | `false` |
| `LavaRunner` (`LavaRunner.as:46-96`) | `if (Game.freezeObjects) return;` FIRST (`:48`) | nothing (the graphic only) | `freezeSkipsUpdate` |
| `Flyer` (`Flyer.as:48-76`) | `if (Game.freezeObjects) return;` FIRST (`:50`) | nothing (the graphic only) | `freezeSkipsUpdate` |

  Every class's graphic (its Spritemap: "die", "attack", "fall") runs outside `update()` (`World.update`), so outside
  the freeze too.
- **The pushable blocks** (`Puzzlements/PushableBlock.as:96-111`, `PushableBlockFire.as:125-142`; `PushableBlockSpear`
  extends `PushableBlockFire`): `update()` is `friction(); input(); moveX; moveY; layering(); death();`. It OVERRIDES
  `Mobile.update` and never calls `mobileUpdate`, so **nothing in it is gated**: a block glides (and is pushed by a
  frozen player whose `v` is still set) through every frozen frame. `pushables.js:48-54` already says so.

### D1.1 — every freeze source, and the model's frozen path

Writers of `Game.freezeObjects = true` (`grep` over `vendor/seedling/src`): `NPC.as:195`, `Pickup.as:95`, `Seed.as:110`,
`SealController.as:46`, `Moonrock.as:72`, `FallRock.as:107`, `FallRockLarge.as:141`, `BobBossNPC.as:31`, `Help.as:103`,
`Inventory.as:185` (and `set open`, `:153`), `FinalBoss.as:92`, `Game.as:959` (the opening wind scene) and `Game.as:1325`
(the credits menu). The "Lights intro" is an NPC dialogue (`lightBoss.js`). The tree cutscene is NOT a freeze (the
model's own R6 6d note: `Game.as:961`'s arm lowers the flag every frame; the player is held by `p.active = false`).

Order matters, because `Game.update`'s tail lowers the flag on a dialogue frame (`!canInventory()` →
`inventory.open = false`, `Game.as:1044-1050`), so a family is frozen there only if it updates AFTER the raiser.
`Game.loadlevel` adds bob/bobsoldier `:2276-2277`, LightBossController `:2282`, LavaBoss `:2283`, FinalBoss `:2284`,
flyer/jellyfish/lavarunner/bulb `:2285-2288`, puncher `:2301`, Button `:2341`, FallRock `:2353`, Moonrock `:2368`,
pushables `:2382-2384`, the texted NPCs `:2389-2406`; `addUpdate` prepends (`World.as:937-947`).

| source | model path | what the model steps there (base) | chasers: game | chasers: ON |
|---|---|---|---|---|
| placed talker (`NPC.talk`, middle frames) | `return runFrozenTick(…, 'a placed NPC's dialogue')`, a live tick | the main-tick slots above the arm (spits … pushables … shooters), then `runFrozenTick`: beam towers (frozen), activators, camera, render, `shieldBump`, the slash timer, the player's i-frames. **No chaser.** | the NPC (`:2389+`) updates before every chaser: **frozen**, `hitUpdate` drains | **stepped frozen** |
| Watcher (the same `talk()`) | `runFrozenTick(…, 'a Watcher's dialogue')` | the same | frozen | **stepped frozen** |
| button-dropped rock, frame A (`FallRock.fall`) | `runFrozenTick(…, 'a button-dropped fallrock')`, then `resolveButtonFalls` → `dropRocksTogether` (the span, collapsed) | frame A as above; the span: the rocks, the drills' graphic, the boss totems. **No chaser.** | Button `:2341` / FallRock `:2353` update before every chaser: frozen on frame A and every span frame; the release frame (the rock lowers the flag first) is unfrozen | **frame A + every span frame but the release frame, frozen** (the release frame: named, below) |
| rope-dropped rock (`dropRock`, L28, L39) | the span collapsed inside the cutting tick | the rock, the drills (`drillTimedPass`), the activators (`fallRockHoldsButton`). **No chaser.** | frozen through the span | **every span frame but the release frame, frozen** |
| the wand's rocks (L43) | `dropRocksTogether` after the wand's ceremony | as above | frozen | stepped (vacuous: L43 holds no chaser) |
| a placed pickup, texted (`Pickup.pick_up`) | T (detection), the next tick's 149-frame lump (`stepCeremonyLumpNow`), the dialogue frames (`runFrozenTick`), the release frame | chasers stepped frozen on every one (`ceremonyShove`, ON since wave 16) | frozen | unchanged (already stepped) |
| a placed pickup, text-less | T; phase A is a LUMP | no chaser; `assertNoCeremonyBesideLiveChaser` refuses an i-framed or dying chaser by name | frozen | unchanged (refused, as before) |
| a chest's seal piece (`SealController`) | `stepSealLumpNow` (330 frames) | chasers stepped (`ceremonyShove`) | frozen | unchanged |
| the inventory hold (`Inventory.open`) | `inventoryHoldNow` (frames stepped) | chasers stepped (`stepCeremonyDeadFrameNow`) | frozen | unchanged |
| the final door (`SealController`, runtime add) | `runFrozenTick(…, 'the final door's seal ceremony')` | no chaser | frozen when the flag persists | **not changed**: no placed chaser in a final-door room (census); named |
| the moonrock (`Moonrock.update :72`) | `runFrozenTick(…, mr.why)` | no chaser | frozen (`:2368` updates first) | **not changed**: no chaser in a moonrock room; named |
| the Lights intro (L69) | `runFrozenTick(…, 'the Lights intro')` | no chaser | bob/bobsoldier frozen; flyer…puncher update BEFORE the controller (`:2282`) | **not changed**: order splits the classes; L69 holds no placed chaser; named |
| the Owl intro (`FinalBoss :92`) | `runFrozenTick(…, 'the Owl's intro')` | no chaser | split as the Lights (`:2284`) | **not changed**: no placed chaser; named |
| the BobBoss arena / the lava arena (`BobBossNPC`, `FallRockLarge`) | `runFrozenTick(…, bb.why / lr.why)` + their dead frames | no chaser | the lava arena's runners are RUNTIME adds (update first), and LavaRunner returns above everything when frozen | **not changed**: named hand-over |
| the wand's approach fade | `spendFrozen(fade)`, a lump | nothing | frozen | vacuous (L43: no chaser) |
| `Help` (`Help.as:103`) | the deferred dead frames (`R9 12e‴ (iii)`) | nothing | frozen | not changed (L10's sword room: no chaser) |
| the opening wind scene, the credits menu | refused by name at the boot / after the credits | — | — | — |
| the tree cutscene | `runFrozenTick(…, 'the tree cutscene')` but **not a freeze** | — | UNFROZEN | **not changed**: stepping them frozen there would be wrong; L115 holds no chaser |

### D1.2 — chasers: the consequence, and where it reaches

- **What the model missed** on a dialogue/rock frozen tick: the `hitsTimer` drain (the i-frame window, and the colour
  flash), `Mobile.death`'s fade (and with it the removal and the kill-lock ledger), the terrain switch and the pit
  descent, and the Puncher's and the Jellyfish's chase blocks (their `v`, `direction`, the attack decision).
- **The observable** (staged, `fidelityFrozenTick.test.js`):
  - L88, a suited player's contact gives `bob@60,112` 30 i-frames at t1; the dialogue is frozen t4..t34. OFF the
    timer stands at 28 through all 31 frozen ticks and lapses at t62; ON it drains one per frozen tick and is 0 at the
    close. Walking back into the bob after the dialogue: **OFF no second hit, ON hits at t46 and t76.** So yes: a
    frozen tick shortens the game's invulnerability window, and the model, OFF, delays the next hit.
  - L29's `button@112,128`: the bob leaves the rock's frozen tick with **26 i-frames OFF, 0 ON** (frame A plus the
    span's dead frames drain it).
  - A Puncher's `v` is re-aimed on every frozen frame ON (L88, L114's Watcher), and its path after the dialogue moves.
- **Where it reaches in the shipped game** (`d1/rooms.json`: every atlas level with a chaser or a pushable, and every
  freeze source in it):
  - **A chaser beside a texted dialogue: L12 only** (`puncher@416,256`, the Witch `@416,384` and `introchar@560,608`).
    From the Witch's circle the Puncher is out of its range and gets no `hitsTimer` without a hit: the shipped L12
    dialogue is **ON = OFF** (row). It can matter only if a route strikes the Puncher (30 i-frames) and talks within
    30 ticks with the Puncher chasing into range. L103's watcher is text-less (wave 52), so its `flyer` sees no freeze.
  - **A chaser beside a button-dropped rock: L74** (`button@288,128` → `fallrock@288,144`; `bulb@48,112` and three
    lavarunners; the runners freeze whole, so only the Bulb's `Enemy` chain moves). L29's rock room holds no chaser.
  - **A chaser beside a rope-dropped rock: L28** (`bobsoldier@264,168`, `rope@160,64` → `fallrock@112,240`).
  - **Can it matter there?** Only for a chaser inside its i-frames (or dying, or in a pit) when the freeze starts. The
    survey and the committed tapes (D3) put none there.

### D1.3 — the beam tower on T

- **Wave 52's skip applies as is.** On a texted pickup's T the predicate (`pickupFreezesFamilyNow('beamtower', {lump:
  false})`) is true only for a texted start, and a texted start always returns through `runFrozenTick(…, 'a pickup
  ceremony')` that tick (the ceremony is not finishing on T), whose frozen step is the frame's one update. The main
  slot now skips. Row: `[true, true]` → `[true]` (wave 51's row re-pinned; my row; mutant 4).
- **Wave 51's text-less release frame:** stepped ONCE (the main slot, unfrozen; a text-less ceremony finishes on T and
  falls through to the live step, no `runFrozenTick`). Correct.
- **The ceremony's dead frames:** the tower is NOT stepped through the 149-frame lump at all (wave 51's hand-over, "the
  lump-less families' dead frames"). Not twice.
- **⚠ NEW, measured, beyond this licence:** on every LATER tick of a texted pickup's ceremony (its dialogue frames,
  `ceremony !== null`) the tower is stepped TWICE, OFF and ON: the main slot steps it frozen (`frozen: ceremony !==
  null`), then `runFrozenTick` again. `d1/tower-ceremony-frames.txt`: `t2F:[true,true] … t8F:[true,true]` under every
  key setting. Vacuous today (no shipped tower room holds a special pickup). Hand-over.
- **The fall-rock frozen tick:** the button-fall branch (`levelRun.js` ≈`:22795`) returns ABOVE the tower slot
  (≈`:22967`), and its `runFrozenTick` steps the tower once, frozen: **one step, correct** (vacuous: L29 and L74, the
  button rooms, hold no tower). A rock's collapsed span steps no tower (its dead frames: the lump-less families' gap).
- **The wand's approach fade** steps no family. Correct for the tower (vacuous: L43 holds none).

### D1.4 — pushables

**The brief's premise is wrong, measured:** a pushable's move is NOT `Mobile`-gated (above). So the model stepping them
in the main tick on a frozen TICK is right, and has been. The real gap is the other way: the DEAD frames the model
collapses never step them, and in the game a gliding block glides on through them.

| freeze source | dead frames collapsed | model base | ON |
|---|---|---|---|
| dialogue / Watcher / Lights / Owl / door / moonrock frozen ticks | none (live ticks) | stepped in the main slot | unchanged |
| a texted pickup | 149 (lump) + the release frame | not stepped | stepped (`stepCeremonyDeadFrameNow`) |
| a text-less pickup | 150 (F+1..F+150) | not stepped | stepped 150 at the detection |
| a chest's seal piece | 330 | not stepped | stepped |
| the inventory hold | its frames | not stepped (not even in `inventoryHoldCensus`) | stepped |
| a rock's span (button, rope, wand) | the span | not stepped | stepped on every frame, the release frame included (no gate) |
| the wand's approach fade | the fade | not stepped | stepped |
| a runtime seed, DarkSword, BobBoss Fire | 150 | not stepped | **not changed** (no pushable room holds one); named |

Census (`d1/rooms.json`): pushables share a room with a text-less pickup in L39, L40, L41 (totem parts, L40's boss
key); with a texted pickup in L67 (boss key 0) and L40; with a chest in L15, L25, L38, L63; with a rope-dropped rock in
L39. It matters only when a block is mid-glide (or the player stands pushing it) at the freeze's start.

### D1.5 — the change chosen

- **Chasers:** no new path. `runFrozenTick` gets `{ chasers }` from its three callers whose raiser updates before every
  chaser (the talker, the Watcher, the button-dropped rock), and ON runs `stepChasersFrozenNow()`: `stepChasersNow()`
  with `ceremony` held to a sentinel (`FROZEN_TICK_FREEZE`), exactly as the inventory hold and the seal lump hold
  theirs, so every reader of `ceremony !== null` in the chaser step sees the flag. The same call runs on every frozen
  frame of `dropRock`'s and `dropRocksTogether`'s spans.
- **Pushables:** `stepPushablesDeadFrameNow()` (ON only) at the top of `stepCeremonyDeadFrameNow` (so the ceremony lump,
  the seal lump, the release frame and the inventory hold), on every span frame (before the rock: `:2382` vs
  `:2353`), 150× at a text-less pickup's detection, and per frame of the wand's fade.
- **The tower:** the main slot's skip on a texted T, inside `pickupTickFreeze`'s ON branch.
- What it does to:
  - **`spitForecastNow` and the hammer forecasts:** untouched (no forecast steps `runFrozenTick` or a span). The
    chaser forecast never drains i-frames through a dialogue or a rock's span: hand-over to hammer.
  - **Wave 50's turret slot:** untouched (the turret slot is above the arms; nothing new bills a contact: under the
    sentinel `applyPlayerHit` is `frozen`).
  - **Wave 52's predicate:** unchanged (no line of `dialogueFreezeAheadNow` / `predictDialogueFrameFrozen` /
    `assertDialogueFreezeAheadHeld` moved; the tower slot asks it first, as before).
- **STOP rule: not triggered.** Every path reads state the model holds there (the chaser and block rosters, the
  player's box and `v`). OFF, no new line runs (`chasers &&` and `CONTACT_FIDELITY.frozenTickUngated` guard each).

## D2 — the key and the amendment

`CONTACT_FIDELITY.frozenTickUngated` is **OFF**, appended LAST (144 keys, 126 ON). Env `SEEDLING_FROZEN_TICK_UNGATED=0|1`,
in `SOLVER_ENV_NAMES` after `SEEDLING_FROZEN_PRESS_FORECAST` (a node import of `solverEnvChannel.js`: 232 names, sorted,
duplicate-free). Its doc block (`contactFidelity.js`), in brief:

> fidelity FROZENTICK D2 (wave 53) — WHAT RUNS UNDER `Game.freezeObjects` RUNS ON THE MODEL'S FROZEN FRAMES TOO. … The
> model returned above `stepChasersNow` on those frozen ticks (`runFrozenTick`) and stepped no chaser through a falling
> rock's collapsed span … ON: `runFrozenTick` runs the chasers' frozen update … on a placed talker's or watcher's frozen
> frame, a button-dropped rock's frozen frame …; and every frozen frame of a rock's span … And the PUSHABLE BLOCKS …
> no freeze gate … ON it also steps them on each collapsed dead frame it steps … The Lights intro, the Owl intro and the
> two arenas are untouched … and the tree cutscene is not a freeze. OFF: byte-identical.

**`pickupTickFreeze` amendment** (its doc block gains a ⛓ FROZENTICK paragraph): on a texted T the main slot skips the
tower; `runFrozenTick`'s frozen step is the frame's one update. Wave 51's row re-pinned `[true, true]` → `[true]`.

**How it composes:** each of `dialogueFrameFreeze`, `pickupTickFreeze` and `turretSuitRetaliation` touches the families
above the arms; this key touches the chasers below them and the collapsed frames. Row: the dialogue bob row with all four
ON = this key ON alone (the whole result). With `ceremonyShove` OFF, a texted pickup's lump is not stepped, so its blocks
are not either (named).

**Key-order pins re-pinned:** the 18 tail lists ending `'dialogueFrameFreeze']` (`Ceremony126`, `CorridorBody`,
`DarkSuitBosses`, `DarkSuitStatic`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `FrozenPress` (`W39`),
`L39Hit`, `L39Phantom`, `OwlSuit`, `PickupFreeze`, `RockButton`, `RockFire`, `RockGone`, `TurretSuit`, `WallFlyerCorpse`);
`fidelityDialogueFreeze`'s `.at(-1)` → a tail of `['frozenTickUngated']`; `contactFidelity.test.js` (the defaults row,
the env guard). `fidelityFencepost`'s SOURCE-SHAPE pin: untouched (nothing added near `spinnersSteppedThisTick`).

### Rows (`fidelityFrozenTick.test.js`, fast tier, 10 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| talker (L88, `bob@60,112`, suited) | `hitsTimer` 28 on all 31 frozen ticks (t4..t34); hits `[t1]` | 27, 26, … 0 (one per frozen tick); positions equal; hits `[t1, t46, t76]` |
| composition (the talker row) | — | all four keys ON = this key ON alone |
| Puncher (L88, `puncher@88,112`) | `v` held on the frozen ticks | `v` re-aimed every frame, position held, the path after differs |
| Watcher (L114, `puncher@40,120`) | `v` held through 200+ frozen ticks | the chase block runs on every one; positions equal |
| button-dropped rock (L29, `bob@112,150`, suited) | the bob leaves the frozen tick with 26 i-frames | 0 |
| pushable through a text-less pickup (L88, `bosskey keyType 1` touched mid-glide, t21) | the glide resumes after the lump (81.5 → 88.5 fourteen ticks later) | already at rest (88.5) on the collecting tick |
| the tower on a texted T (L29) | `[false, true]` | `pickupTickFreeze` ON `[true]` (and with this key too) |
| no freeze (L88, the bob and the Puncher, no X) | — | **ON = OFF**, the whole result |
| L12 as shipped (the Witch's dialogue) | — | **ON = OFF**, the whole result |

**Mutants** (copy + restore; `grep -c MUTANT` → 0 after each; `d2/mutant*.txt`; run over this file and
`fidelityPickupFreeze.test.js`, 21 rows):
1. **No chaser step in `runFrozenTick`.** Predicted: the talker, Puncher and Watcher rows red (3); the rock row stays
   green (its span drains anyway), the composition row stays green (both sides change alike). Measured: **exactly those
   3**.
2. **No chaser step in the spans.** Predicted: the rock row alone. Measured: **exactly that** (`[26, 25]` vs `[26, 0]`:
   frame A drains one).
3. **No block steps through the text-less lump.** Predicted: the pushable row alone. Measured: **exactly that**.
4. **The tower's double step restored.** Predicted: my tower row and wave 51's re-pinned row. Measured: **exactly those
   2** (`[true, true]` vs `[true]`).

⚠ **Not game-witnessed:** every ON row. The pieces are the AS3 lines above, the families' transcriptions, and
`ceremonyShove`'s four p4f witnesses, which already pin the same frozen chaser update frame for frame on a pickup's
dead frames (`fidelityCeremonyShove.test.js`).

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only 54a27ec910 HEAD | grep -aE 'fixtures/|golden|tapes/'` is EMPTY.
  `batch-seedling-acceptance.mjs | md5sum` is the standing `391322d681b7aa0229d94b3f6906d024` at all five: the base, the
  head OFF, the head with this key ON, the head with `pickupTickFreeze` ON, and the head with this key,
  `pickupTickFreeze`, `dialogueFrameFreeze` and `turretSuitRetaliation` all ON (`d3/acceptance-*.md5`).
- **Committed tapes:** all **294** replay byte-identical ON vs OFF, for this key (`d3/tapes-onoff.txt`) and for
  `pickupTickFreeze` (`d3/tapes-onoff-pickupTickFreeze.txt`), with `tools/tape-onoff.mjs` (wave 52's, keyed by `KEY`).
- **The census.** Method: the room census (`d1/rooms.json`) names every room where ON can step something: a chaser
  beside a texted dialogue (L12), a button-dropped rock (L74) or a rope-dropped rock (L28); a pushable beside a dead
  span (L15, L25, L38, L63: a chest; L39: a rope rock and a totem part; L40, L41: text-less pickups; L67: a boss key).
  The legs (`seedling-divergence-legs.mjs`, 924) and the survey's 250 steps were filtered by level.

| set | count |
|---|---|
| legs in a reached room (`d3/leg-census.txt`, `d3/reached_legs.json`) | **209** (L12 90, L15 4, L25 7, L28 8, L38 8, L39 3, L40 50, L41 2, L63 29, L67 2, L74 6) |
| survey steps in a reached room | **48** (L12 ×18, L15 ×2, L25, L38 ×7, L39 ×6, L40 ×7, L41, L63 ×4, L67, L74; no L28 step) |

- **Survey** (`--through=end --only=<the 48>`, OFF vs `SEEDLING_FROZEN_TICK_UNGATED=1`; `d3/survey-{off,on}.*`): every
  step line equal; the rows JSON equal once the wall-clock `ms` fields are stripped. 44 SOLVED, **all with 0 hits**; 4 L40
  steps (66, 96, 134, 149) REFUSED, the same reason both ways (pre-existing: a spinner corridor, two ladder-routed
  stances, the keylock stance). So every hitless leg stays hitless ON. ON answers: none moves.
- **Vitest ON** (the gate set, 183 files, `--maxWorkers=3`): 183/183, 4913 passed, 2 skipped (the env-guarded "ships
  OFF" rows: this file's and `contactFidelity.test.js`'s). **0 ON movers** (`d3/vitest-on.txt`).
- **Train ON** (`vitest.train.config.js`, the 29 `.train.` files naming a reached room: `d3/train-files.txt`): 29/29
  files, 96/96 tests, 9559 s. **0 ON movers** (`d3/train-on.txt`).
- **Why ON moves nothing measured:** no route step meets a dialogue or a rock with a chaser in its i-frames (the only
  dialogue room, L12, keeps its Puncher out of range), and none collects a pickup, opens a chest or drops a rock while a
  block glides.

### The named sweeps (for the planner)

- **`frozenTickUngated`:** the **209** legs in `d3/reached_legs.json`. Shards = min(10, 209) = **10**, ×1 per arm, OFF
  and `SEEDLING_FROZEN_TICK_UNGATED=1`. Expectation: no mover. Measure the flip gate anyway: a leg hitless OFF must stay
  hitless ON (the survey's 44 do).
- **`pickupTickFreeze`'s delta from this slice:** **0 legs**. The amendment changes only a texted pickup's T in a room
  with a beam tower, and no shipped tower room (L103, 104, 105, 107, 108) holds a special pickup. Its own 57-leg sweep
  (wave 51) is unchanged.

## Gates

- **Bounded vitest BEFORE** (a worktree at the base, submodules symlinked; the 182 gate files, the new test absent):
  **182/182 files, 4904 passed** (`d3/vitest-before.txt`, `d2/gate-files-before.txt`).
- **AFTER** (the head, OFF; 183 files): **183/183, 4915 passed** (`d3/vitest-after.txt`, `d2/gate-files-after.txt`).
  The set: `contactFidelity*`, `playerDamage*`, `levelRun*`, `fidelityPickupFreeze*`, `fidelityDialogueFreeze*`,
  `fidelityTurret*`, `fidelityDarkSuit*`, `fidelityOwlSuit*`, `oneSpelling`, every file `grep -a -l` finds for
  `runFrozenTick`, `stepChasersNow`, `hitUpdate`, `hitsTimer`, `pushable`, `beamTower`, `BeamTower`, `pickupTickFreeze`,
  `dialogueFrameFreeze`, `frozenTickUngated` (the key-order pins among them), and `r8Acceptance`, `tapeEnvelope`,
  `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface`.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, a browser arm in CI).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match. Constants census `--check` PASS after `--write` (6 new + 1 vanished cosmetic/structural, line moves; no rule row
  re-keyed); `--profile-rows` left `seedling-constants-fields.csv` byte-identical. Solver surface `--check` GREEN (374
  rows) after `--write` (line numbers only). The first census test run caught the stale census before `--write`.
- **CI** `JavaScript Unit Tests` at the code head `6637adae` (run 44429070031): **success**, suite 28789 passed, 0
  skipped, 0 failed (3 shards); slow battery 438/438. Later commits are evidence/docs only.
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/frozen-tick-fidelity-gaps-px1t9a -f train_only=true`

## What the brief got wrong (measured)

1. **"Pushable blocks … In the game, their move is `Mobile`-gated (frozen)."** It is not: `PushableBlock.update` and
   `PushableBlockFire.update` override `Mobile.update` without `mobileUpdate` (`PushableBlock.as:96-111`). The model's
   main-tick step on a frozen tick is right; the gap is the collapsed dead frames (D1.4).
2. **"`hitUpdate` … is NOT stepped. That applies to every freeze."** Not every: a pickup's ceremony (T, the lump, the
   dialogue frames), a seal piece and the inventory hold already step the chasers (`ceremonyShove`, ON). The gap is the
   dialogue, Watcher and rock frames. And it is more than `hitUpdate`: the fade, the terrain switch, the pit descent,
   and the Puncher's and Jellyfish's chase blocks.
3. **"The tree … freeze."** The tree cutscene is not a freeze (the model's own R6 6d note); stepping chasers frozen
   there would be wrong.
4. **"The shipped dialogue case is L12's puncher."** It shares the room, but from the Witch's circle it is out of range
   and holds no i-frames: shipped L12 is ON = OFF (row).

## Hand-overs

- **To the planner:** the keyed sweep (D3); the `train_only` dispatch at my head
  (`gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/frozen-tick-fidelity-gaps-px1t9a -f train_only=true`);
  at harvest, `SOLVER_ENV_NAMES`: my entry sits after `SEEDLING_FROZEN_PRESS_FORECAST`.
- **To fidelity (later), beyond this licence:**
  - **The beam tower is stepped twice on every later frame of a texted pickup's ceremony** (OFF and ON;
    `d1/tower-ceremony-frames.txt`): the main slot steps it frozen, then `runFrozenTick` again. The same skip fixes it.
  - **A rock span's release frame:** the rock lowers the flag before the chasers update, so they take one UNFROZEN
    update there; the model steps the player only (`pendingFreeSteps`).
  - **The Lights intro, the Owl intro, the final door, the moonrock, the two arenas:** not wired (their raisers sit
    between the chaser classes in the add order, or their bodies are runtime adds). No placed chaser in those rooms.
  - **Runtime pickups** (seed, DarkSword, Fire): their 150 dead frames step no block (no pushable room holds one).
  - **`inventoryHoldCensus`** has no `pushables` row at all; ON steps them, OFF the hold neither steps nor refuses.
- **To hammer:** the chaser forecast never drains i-frames (or fades a corpse) through a dialogue or a rock's span, and
  never re-aims a Puncher's or Jellyfish's `v` there. With this key ON the live run does (row: the bob's next hit t46).

## Residue

- Every ON row is staged and model-derived, not game-witnessed.
- The reached legs were not replayed in node; the leg runner is the browser sweep.
- Evidence: `seedling-fidelity-frozentick-evidence/`:
  - `tools/`: `rooms.mjs` (the room census), `stage.mjs` (the staging probe), `tower-ceremony.mjs`, `tape-onoff.mjs`;
  - `d1/`: `rooms.json`, `tower-ceremony-frames.txt`;
  - `d2/`: the gate file lists and the four mutants;
  - `d3/`: the acceptance md5s, the leg census and the 209 legs, the survey OFF/ON, the tapes OFF/ON (both keys), vitest BEFORE/AFTER/ON, the train files and train ON, the producer line.
