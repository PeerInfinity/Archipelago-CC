# seedling-js-help-dismiss-press — does the item fire on the tick a press dismisses the sword Help?

**Answer: the GAME SWINGS on that tick, for C and for X. The model is right.** This is branch 1 (re-pin), plus two
known gaps the witness turned up. I pinned those as named rows and did not fix them, because neither is in this
slice's licence.

- Base: `origin/main` = `ffff2a5b4c78682ba3b603c7292fcce553c7feda`. Harness branch:
  `claude/seedling-help-dismiss-press-o9h3qh` (the session pins it; it is not `seedling-js-help-dismiss-press`).
- Submodules as bootstrapped: `vendor/seedling` @ `ccdf189`, `flashPanel/wasm` @ `9968c7d`. Page:
  `seedling_bot_ap_p4g`, headless logic-only, `scripts/serve-nocache.py 8000`.
- Bootstrap: `session_bootstrap.sh --all` → READY. pip's step FAILED (`/root/CC/pip.log`) and nothing here needed it.

## Robert's remark: was it already measured?

**No.** The existing witness, `fixtures/secondary-use-witness/secuse-l73-622-xc.json` (SECUSE W0, seedling-js-xc-model),
is leg 622: L73 arriving from L74, `up` held, and on t0 nothing / X / C / X+C. That measures the **X+C same-tick
trick**, and there is no Help anywhere in it. No fixture pressed on the tick a press **dismisses the sword Help**, so I
recorded a new one.

## The model's +19, for X and for C (re-verified at the base)

The notDismissed base is `r8-solve-10` with its X on the Help tick removed. The Help is up at **t70**.

| arm | model `deadFramesOwed` OFF / ON | model `slashPresses` (ON) |
|---|---|---|
| none | 171 / 171 | 72 slash, 78 dash |
| C @70 | 170 / **190** | **70 slash, 72 dash**, 78 dash |
| X @70 | 190 / 190 | 70 slash, 72 dash, 78 dash |
| C @69 | 171 / 191 | 69 slash, 72 dash, 78 dash |

- **js-16's reading is confirmed.** C under ON reaches no dialogue or ceremony path. `cPressed` (`levelRun.js:22836`)
  feeds only `pressSlots` → `slashSet` (`:22897`). `drainPickupHelp` (`:3725`, called at `:21191`) reads only the
  edge, and only for the −1.
- **The +19 = −1 + 20.**
  - The press on t70 **swings** (`seam.primary` = `seam.secondary` = 0, the sword).
  - `slashTimer = 20` then turns the walk's own X at t72 into a **dash** (`Player.as:784-791`).
  - The dash carries the player out of L10 on the final tick, t83. So `deadFrameSpans` gains `load 20 "level 11
    build"`, and the Help's frame goes.
- X does exactly the same thing at the defaults. The test comment *"X … re-advances the ceremony's pages"* was a
  mis-attribution, and I fixed it (below).

## AS3 citations (`vendor/seedling/src` @ ccdf189)

- **Who adds the Help, and when.** `Pickups/Sword.as:42-49`: `removed()` sets `Player.hasSword = true` and runs
  `FP.world.add(new Help(3))`. It runs from `World.updateLists` (`net/flashpunk/World.as:895-925`): first the removes
  call `removed()`, then the adds call `addUpdate`.
- **Update order.** `addUpdate` **prepends** (`World.as:937-947`). `World.update` walks from `_updateFirst`
  (`:47-61`). So the Help, added after the Player, **updates before the Player**.
- **Frame shape.** `Engine.update` is `world.update(); world.updateLists();` (`Engine.as:68-77`), and `Input.update()`
  clears edges after it (`:168-173`). `Main.update` calls `Bot.update()` first (`Main.as:79`). The Bot dispatches a
  tick's keys only on a frame whose gate is live: `blackCover > 0 || Game.freezeObjects` → dead frame, no dispatch
  (`Bot.as:3201-3206`).
- **The press frame.** `NPCs/Help.as:87-110`:
  - `Input.pressed` over `keys[3] = [X, C]` (`:23`) sets `remove`.
  - `Game.freezeObjects = true`, then, because `remove` is set and the Help's frame is 3, not 1, it is set **false in
    the same update** (`:103-109`).
  - The removal itself is a fade (`alpha -= 0.1` per frame, `FP.world.remove` at alpha ≤ 0). The freeze is off at once.
- **The Player that frame.** `Mobile.mobileUpdate` (`Mobile.as:31-44`) runs `input()` because `!Game.freezeObjects`.
  `Player.input` (`Player.as:1515-1568`) ends with `Input.pressed(keys[4]) → useItem(Main.primary)` and
  `Input.pressed(keys[5]) → useItem(Main.secondary)`, on the same still-live edge.
  - `useItem` case 0 → `slashing = true` (`:1579-1585`).
  - The setter's gate, `(hasSword || hasGhostSword) && …` (`:782`), passes: `hasSword` was set at the end of an
    earlier frame.
  - `slash()` runs in `Player.update` **before** `super.update()` (`:560-575`; `Bot.slashTests++` at `:905`). So the
    first dispatch is on the next frame.
- **`Game.talking`** plays no part on this frame: the ceremony's text NPC closed on an earlier frame
  (`pickupRemoval.js`'s F / F+1).
- **One tick early (the tick `removed()` fires):** `Player.hasSword` is still false when `input()` runs, because
  `removed()` lands at the end of the following frame (`pickupRemoval.js`, measured by ENCOUNTERS2). So
  `set slashing`'s gate refuses the swing.
- **The harness's own X.** `Bot.autoAdvance` (`Bot.as:3428`, `dispatchKey(KEY_PRIMARY, true)` at `:3495`) dismisses a
  Help that no tape pressed through, using **X**, which is the sword. Because the Help updates first, the Player sees
  that X on the same frame.

## The witness

`frontend/modules/seedlingDemo/fixtures/secondary-use-witness/help-dismiss-r8-solve-10.json`
(`probe-seedling-secondary-use.mjs --arms=… --record --name=help-dismiss-r8-solve-10`). Each arm has rows t0..t83
(84 per arm, complete). Each row holds level, x/y, vx/vy, hits, `anim`/`frame`, `dead_frames`, `slash_tests` and
`slash_hits` (`botStatus().slash`), and the edge echo `edge_t`/`pressed`.

Row convention: row t = after the frame that dispatched tick t−1. A press on tick p shows its first sword dispatch on
row p+2.

| arm | edge reaches `Input` | final `dead_frames` | first `slash_tests` row | trajectory |
|---|---|---|---|---|
| (a) none | — | 171 (two Help frames) | **72** | = (b) except the sprite `frame` phase |
| (b) C @70 | yes, `secondary` on edge t70 | **170** (dismissed) | **72**: swings on t70 | = the model's ON swing trajectory, row for row |
| (c) X @70 | yes, `primary` on edge t70 | **170** | **72**: swings on t70 | = (b) exactly |
| (d) C @69 | yes, `secondary` on edge t69 | 171 (not dismissed) | 72: **no** swing on t69 (row 71 = 0) | = (a) |

Readout:

- **(b) and (c): the game swings on the dismiss tick.** Its trajectory is the model's "slash at 70 → dash at 72 → exit
  at t83" stream to the row.
- **(a):** the game swings here too, through `Bot.autoAdvance`'s X on the dead frame. It lands at the same frame offset,
  so every row matches (b), except the walk sprite's `frame`. `World.as:58` advances graphics on the extra dead frame
  as well.
- **(d):** no swing on t69, because `hasSword` is not set yet.

The final row keeps the probe's FIRST poll, so the L11 build at t83 is not in its `dead_frames` yet. The oracle's t83
walk carries game 190 = model 190 for the committed (dash) walk.

## Branch taken: 1 (the game swings, so the model is right) — and two known gaps, pinned

1. **(b) and (c): the model is right, ON and OFF.** No levelRun gate.
2. **KNOWN GAP (harness): (a) none.** The model has no autoAdvance X, so its no-press walk keeps the t72 press a slash
   and leaves the game's rows at t73. This holds in both modes and at the base, so it is not a secondaryUse question.
   The dead-frame count the witness can see still agrees (171). It matters to any test that treats the not-dismissed
   base as a game walk: the game never runs a not-dismissed sword Help without a sword swing.
3. **KNOWN GAP: (d) C on the tick `removed()` fires.** The model ON swings on t69, and the game does not. This is the
   press-gate half of `PICKUP_REMOVED_NEXT_FRAME`'s documented gap (`pickupRemoval.js`: the model grants `hasSword` a
   frame early). That switch ON moves the grant to t71 and refuses the t70 swing, which (b) and (c) contradict, so it
   is not the fix either.
   - The right fix is a press gate that reads `hasSword` as of the frame's `input()`, for X and C alike.
   - Gating C alone under secondaryUse would invent an X/C asymmetry the game doesn't have.
   - Fixing it for X would move OFF.
   - So I **STOPPED** here and pinned the gap so that the fix will turn the row red.

## Files and pins (each with its mutant)

**`scripts/procgen/probe-seedling-secondary-use.mjs`**
- `baseTape` takes a `fixtures/tapes` base.
- Rows carry `anim`/`frame`/`dead_frames`/`slash_tests`/`slash_hits`/`edge_t`/`pressed`.
- An arm with a missed row is re-run (up to 4 times) and never recorded with a gap. This was a real hit: the first
  recording lost row 82 of `c-help`.
- Flags are unchanged. `generate-procgen-reference.mjs --check` → **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS
  MATCH**.

**`fixtures/secondary-use-witness/help-dismiss-r8-solve-10.json`**: the witness (new).

**`helpFrame.test.js`**
- The comment attribution is fixed in both places.
- The `⛓⛓ adding ONE C press` row and the held-through row's edge half now assert three things, in both modes:
  - the constructed tapes' inputs equal the witness arms;
  - `deadAtFinalRow(model)` equals the witness's final `dead_frames` (none 171, c-help 170, c-early 171);
  - the game's own rule holds on the witness (c-help = none − 1, c-early = none).
- The raw `control − 1` / `control` arithmetic stays, for OFF only.
- Mutants:
  - drop the final-tick build subtraction → **2 red ON** (190 ≠ 170), measured;
  - C not dismissing → 171 ≠ 170;
  - early press dismissing → 170 ≠ 171.

**`fidelityHelpDismissPress.test.js`** (new, 11 rows)
- The witness's shape and edge echo. Dismissal on the dead frames. The swing on row HELP_TICK + 2 for C and X.
- (a) = (b) except `frame`, both ways, so a sprite-phase pin can't hide.
- (d) has no dispatch on row HELP_TICK + 1.
- Model vs witness, ON:
  - C @70: 0 row mismatches, `slashPresses[0]` = t70 slash, +2 = the game's first dispatch row, `deadAtFinalRow` = 170;
  - X @70: the same in both modes;
  - the two KNOWN-GAP rows above.
- Mutants:
  - **M2**, a model that gates the dismiss-tick press (= C read as nothing, i.e. `run('c-help', false)`) → **1 red**,
    measured;
  - a game that did not swing would make the c-help rows the model-none rows → the ON match row goes red;
  - fixing either gap turns its KNOWN-GAP row red, on purpose.

No `vendor/seedling`, wasm, solver, `levelRun` or `contactFidelity.js` edit. **`secondaryUse` stays OFF.**

## OFF identity: before = after

- **No model source changed.** `git diff --stat origin/main` touches only the probe, the fixture and the two test
  files.
- `jsRuntimeTape.test.js` is green with `NO_TAPE_CHAIN = { chain: '0852da9e5639860e8b2d4ccbeda5', rows: 224 }`
  unchanged. `levelRunStateDigest.test.js` and `levelRunDigestRead.test.js` are green: **35/35** across the three,
  OFF.
- "Set digests": as rope-art reported, I found no row by that name. The shipped-defaults row
  (`contactFidelity.test.js`) is green OFF.

## Bounded counts (11 files)

The files: `contactFidelity`, `contactFidelityHook`, `fidelityInventoryMenu`, `helpFrame`, `fidelitySecondaryUse`,
`fidelityHelpDismissPress`, `fidelityForcedHit`, `fidelityForcedHitWitness`, `jsRuntimeForcedHit`, `fidelityArrowLane`
(the xc rows) and `scripts/procgen/boxLock.test.js`.

- **OFF: 303/303 passed.**
- **`SEEDLING_SECONDARY_USE=1`: 298/303**, with 5 red, **all of them already red at the base**. Measured with my diff
  stashed: 7 red at the base, and the 2 extra were the two helpFrame rows this slice fixes. The 5:
  - `contactFidelity.test.js` › *the shipped defaults: all three ON*: the ships-OFF row, which moves at the flip;
  - `fidelityForcedHit.test.js` › leg 622 depth-2 proof (`proven: false, nodes 1332`), the two D2 budget rows, and the
    D2 leg-622 ON solve: C widens the held-set alphabet.
- ⚠ **This differs from the brief's prediction.** **`fidelityInventoryMenu` is GREEN ON.** The ships-OFF row that goes
  red ON is `contactFidelity.test.js`'s, and the forcedHit rows are a second family p17's flip will have to re-pin or
  re-derive.

## STOPPED / not done

- Gap (d): no gate was written. It needs a press gate that reads `hasSword` per frame for both keys, which is OFF-moving
  and belongs to `PICKUP_REMOVED_NEXT_FRAME`'s owner.
- Gap (a): the model has no autoAdvance-X swing. That is harness behavior on every not-dismissed sword Help.
- No push to main.
