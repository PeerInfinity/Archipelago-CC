# seedling-fidelity-plainspan — a plain pickup (`APItem`) taken on a freeze's frame (wave 59)

⚖ GO: Robert 2026-11-24 (planning-24's session), *"Plain pickups in a rock span (Recommended)"*, plus the launch GO for
this brief. Scope: ONE new `contactFidelity` key, default OFF. No flip, no default change, and no change to any existing
key's ON branch.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-24` |
| Base | `0f570abbcac029a452e12cbdecc4d9953752dd5a` (the W57 harvest). Measured there with node imports: **148 keys, 126 ON**, the last ten as the brief lists them; `SOLVER_ENV_NAMES` **240**, sorted, no duplicates |
| Harness branch | `claude/plain-pickups-rock-freeze-xe5hny` (local `seedling-fidelity-plainspan`). ⚠ I pushed the same commit by mistake to `claude/seedling-fidelity-plainspan` first. The proxy refused the delete (`remote end hung up`), so that ref still exists and points at `ec037862`. It is safe to delete; nothing is built on it |
| Commits | D2 `ec03786249f847fa9b36cf285203b946c115fc71` (the code, the key, the pins, the rows, the census and surface regen: **the last CODE commit**) · evidence and this report (the head) |
| Verdict | **PASS, with the brief's premise corrected (measured).** A single `APItem` under the player on a freeze's first frame is ALREADY taken on the game's tick by the solver's call. The key models the cases that call misses: a second apitem under the same box (frame A, the pull, a ceremony's T, the union), the wand's landing snap, and a deferred release step. OFF is byte-identical. The acceptance md5 is the standing value at all four settings, and 294/294 tapes give ON = OFF. **0 legs** can move ON: the delivered set has no apitem within reach of a freeze |

**The one thing to know first:** the solver's contact call is already exact for ONE plain pickup in a span or a
ceremony.
- It tests the pre-tick box (post-(F−1)) on tick F (`solverBot.apItemTakenOnTick`).
- No freeze this model collapses moves the player's box between F−1 and the end of the span or of phase A.
- So a button's frame A, a rope's pull and a ceremony's T each take a lone apitem on the game's tick, with the same
  bank `t` (measured below).
- The real gaps are three:
  - the call's **one-a-tick** rule: the game takes EVERY apitem under that box on F;
  - the call's **`inCeremony` exclusion**;
  - the two places where the model moves the box at a different point than the game does: **the wand's snap** and
    **the deferred release step**.
- ⚠ **On the delivered set nothing reaches any of this.** `SEEDLING_SET_PATCHES` removes L29's, L74's and L39's rocks
  (and L29's and L74's buttons). No placed special pickup remains once the delivery rewrites them. L43's wand is itself
  an `APItem`, so its rocks never fall.

## D1 — the AS3 and the model

### D1.1 — frame by frame

**The AS3:**
- `Pickup.update` (`Pickups/Pickup.as:50-88`):
  - not special, so the `else` arm runs every frame;
  - `nearestToPoint("Player")`, then `if (player && !player.fallFromCeiling)`;
  - no attraction: `APItem` passes `_attract = false` (`APItem.as:114`) and `v = null`, so it never moves;
  - **`collide("Player", x, y)` → `pick_up()`** (`:78-84`), outside `Mobile.mobileUpdate`'s freeze gate (which only
    `super.update()` reaches, `:86`).
- `pick_up()` (`:90-124`): `special` is false, so it is `removeSelf()` (`:120-123`) → `FP.world.remove(this)` (`:126-129`).
  No flag, no timer.
- `APItem` (`Pickups/APItem.as`):
  - the box is `super(_x + 8, _y + 8, …)` with `setHitbox(8, 8, 4, 4)` (`:114-115`): `[x+4, x+12) × [y+4, y+12)` in `.oel`
    coordinates, the model's `apItem` class row (`world.apItems[].rect`);
  - `removed()` runs `if (doActions) Game.setPersistence(tag, false)` (`:127-133`);
  - `setPersistence` (`Game.as:1902-1910`) writes the slot and the check report:
    `pendingCheck = "<++seq>|<level>|<tag>|0"`.
- **The add order** (`Game.loadlevel`; `addUpdate` prepends): the player at `:2250`, then `apitem` at `:2330` (first of
  the pickups), …, `button` `:2341`, …, `pull` `:2352`, `fallrock` `:2353`. Every apitem updates **before** the player
  and **after** the button and the rock, so on frame F it tests the **post-(F−1)** box. Each apitem entity runs its own
  collide, so **every** apitem under that box is taken on F.
- `FallRock` (`Scenery/FallRock.as:51-118`): `fall()` (`:103-109`) does the persistence write, `trigger` and
  `freezeObjects = true`. The span follows. The landing snaps an overlapping player to the rock's top on every frame
  from the landing (`:54-60`). R (`:92-97`) lowers the flag.

**The frame tables.** F is the freeze's first frame. "Box" means the box the apitems test.

| source | frame | the player's box | what the game takes | the model (OFF) |
|---|---|---|---|---|
| button (L29 staged) | A (tape tick 24) | post-(A−1); the press is `Button.update`, before the player | **every** apitem under it, on A; each writes its slot + `pendingCheck` on A | the solver's call at tick 24, pre box: the FIRST one, bank t 25 ✔. A second: tick 25 (bank t 26, after the 172 dead frames), **if** the release step's box still overlaps it, **never** if it does not |
| button | A+1..R (span) | unchanged (frozen; the snap is refused by the model, `resolveButtonFalls`) | nothing new | — |
| button | R+1 | post-R (the release step, `buttonFallReleaseStep`, inside tick 24) | what the step moved onto | tick 25, pre = post-R ✔ |
| rope (L28, `rockbutton-l28-livefall`) | P (tape tick 155) | post-(P−1); the pull is inside `Player.update`, after the apitems | every apitem under it, on P | first: tick 155 (bank t 156) ✔; a second: tick 156 (bank t 157, after 181 dead frames) |
| rope | span, R+1 | unchanged; R's step is the pull tick's own step | — | ✔ (the snap is refused, `publishRopeGroup`) |
| ceremony (feather, L29 staged, no button) | T (tick 24) | post-(T−1); `pick_up` moves the PICKUP, never the player | every apitem under it, on T | first: tick 24 (bank t 25) ✔; a second: **not until the ceremony ends** (`pre.inCeremony` on every tick to the finishing tick): tick 47 (bank t 48) |
| ceremony | phase A, dialogue, C | unchanged (frozen: the pickup raises the flag before the player) | nothing new | — |
| ceremony | R+1 | post-R (the finishing tick's fall-through step) | what R moved onto | the next tick, pre = post-R ✔ |
| union (`nestedRockCeremony` ON) | A = T | as the ceremony | as the ceremony | as the ceremony |
| wand (L43, `r5-l43-wand`) | the drop at the wand ceremony's end (tick 108), then the landing | **the snap** (`FallRock.as:54-60`) moves the box to the rock's top from the landing frame | an apitem under the snapped box, on the landing frame (inside tick 108) | the solver asks the snapped box only at tick 109 (bank t 110): **a tick late** |
| wand | R, R+1 | the DEFERRED release step (`pendingFreeSteps`) runs at the top of tick 108's step, then the main step | R+1 (tick 108's observed frame) tests the post-R box | the call at tick 109 tests post-108 (both steps): a tick late |

**Is there a source where the box MOVES during the span so that a later span frame takes it?** Only the landing snap.
- The rope's and the button's snaps are refused by name.
- The wand's is applied, and is the third row of the wand (staged; L43's own rocks land on no stance).
- Every release step moves the box on R, and R+1 is tested in the next observation: the next tick, or (deferred) the
  same tick's main step.

`inCeremony` during a collapsed rock span is **false**. A rock span never sets `ceremony`, and the per-tick `C` column
of `d1/staged.txt` is empty through it.

**Measured on the model at the base** (`tools/plain-l29.mjs`, `plain-rope.mjs`, `plain-wand.mjs`; `d1/staged.txt`):
- One apitem at `@112,128` is taken at tick 23. At `@112,127` (the frame-A box) it is taken at **24**, the frame-A
  tick. At `@112,126` (only the release step's box) it is taken at 25 = R+1.
- With a feather on the same cell, the apitem is taken at 24 = T, both with and without the button, and with the union.

### D1.2 — the model's map

- **The contact:** `solverBot.apItemTakenOnTick(apItems, pre, post)` (`:9329`, hammer's, read only).
  - It uses the pre box and takes the first in `.oel` order.
  - It returns `null` on `pre.inCeremony` or on a level, death or transition change.
  - It is called by the solver's segment view after each `advance` (`:29509`), which filters `open` by its OWN
    `apItemsTaken`. The view then calls `inner.takeApItem`.
  - `replayOntoFork` (`:28966`) re-tells the segment's takes.
- **The run:**
  - `takeApItem` (`levelRun.js` ~`:22830`) banks a told take: `apItemFlags` (`"level:tag" → {id, level, tag, t}`), with
    `t = ticksCompleted` after the tick, plus `pendingEarnedClears`;
  - a second report is a no-op;
  - `earnedClears` reads `apItemFlags`;
  - the world's `apItems` (`levelWorld.js:4890`) is never mutated during a visit.
- **The spans:**
  - `dropRock` (rope, `:4011`): one collapsed span in the pull tick; the release step is the pull tick's own step.
  - The frame-A branch (`:23170`ff): `runFrozenTick`, then `resolveButtonFalls` (`dropRocksTogether`), then the
    `buttonFallReleaseStep` step, all in tick A.
  - `dropRocksTogether` (`:4087`): `pendingFreeSteps += 1` for the wand. That is the deferred step, run at the top of the
    NEXT step block (`:24855`), which on the wand's drop is still inside tick 108.
  - The wand's snap: `state.y = dropped.snapY` (`:24259`).
- **The ceremony:**
  - the starts (`:23790-23940`: the runtime Seed, DarkSword and Fire, then `pickupUnderfoot`);
  - `spendCeremonyPhaseA`, the lumps, and the dialogue ticks (`pre.inCeremony` true);
  - the finishing tick.

### D1.3 — the change chosen

**`takePlainPickupsInFreezeNow(box, why)`** (`levelRun.js:16185`): an `APItem` contact INSIDE the run, at the frames
the game takes apitems on and the solver's call cannot see.
- With the key ON it takes every open apitem whose rect overlaps `box`, in `.oel` order.
- It banks each one exactly as `takeApItem` does (`apItemFlags`, `pendingEarnedClears`), with
  **`t = ticksCompleted + 1`**. That is the `t` a solver report of the same tick carries: every site runs before the
  tick's increment, which the mutant M2 pins.
- It records `{id, level, tag, t, why, banked}` in `plainFreezeTakes` (a new getter, empty OFF).
- It skips an apitem already banked (told or taken here). A `tag -1` apitem is tracked per visit by
  `transitions.length`.
- The five sites:
  1. `'frame A'`: the frame-A branch, above `runFrozenTick` (`:23181`), with the pre box.
  2. `'the pull'`: `dropRock` once the rock is published (`:4015`), with the pre box.
  3. `'a ceremony\'s T'`: below the starts, above `startNestedRockSpanNow` (`:23948`). It runs when a ceremony started
     on this tick, with the box its detection tested. This covers the union, the runtime ceremonies and the placed one.
  4. `'the wand\'s snap'`: after `state.y = dropped.snapY` (`:24261`).
  5. `'the deferred step'`: after each `pendingFreeSteps` step (`:24868`), the post-R box that R+1 tests.

**No double take.**
- A solver report of a take the run already made hits `takeApItem`'s existing no-op and returns the run's record and
  `t` (row 2).
- The solver's own segment ledger (`apItemsTaken`) does NOT see a run-side take. It records the later tick it meets a
  second apitem at, or never. That is a **hand-over to hammer** (below). The run's bank is right either way.

**What it does to waves 51–57's predicates and keys:**
- No existing key's ON line moved. The new lines are a call each, inert OFF.
- `nestedRockCeremony`: its union falls through as the ceremony's T, and site 3 takes the apitems there. Row 5
  measures it, OFF of this key and ON.
- `freezeSpanUpdates`'s frame-A refusal asks only `pickupUnderfoot` (special pickups). Apitems are not in it, so
  composing both is not refused (row 9).
- `pickupTickFreeze`, `dialogueFrameFreeze`, `freezeReleaseTick`, `freezeEdgeFrames` and `frozenTickUngated` move
  bodies, not the box an apitem tests. Row 9 gives the same takes with all seven ON.
- **The keys it needs ON to be exact: none.** The release steps it tests after are the default-ON
  `buttonFallReleaseStep` (button) and the deferred step (wand), and both are modelled where they run.

**STOP rule:** not triggered.
- Every case has the state at the point it needs it: the world's apitems, the box and the bank.
- Coins: `Coin` is a plain Pickup with `Math.random` velocities, and its take only removes it and plays a sound. The
  only `coins` reads in the AS3 are spawn counts (`Chest.as:22,80`, `Enemy.as:30,124`, `Spinner.as:24`,
  `WallFlyer.as:20`). **No gameplay read**, so it is not modelled, per the ruling.

## D2 — the key

`CONTACT_FIDELITY.plainPickupInFreeze` (`contactFidelity.js:2401`):
- It is **OFF** and appended LAST: **149 keys, 126 ON** (node import).
- Its env is `SEEDLING_PLAIN_PICKUP_IN_FREEZE=0|1`.
- Its `SOLVER_ENV_NAMES` entry sits between `SEEDLING_PIXEL_MASK_SIGHT_LINES` and `SEEDLING_PRESS_ESCAPE_EXACT`. A node
  import of `solverEnvChannel.js` gives **241**, sorted, no duplicates.

Its doc block, in brief:

> fidelity PLAINSPAN D2 (wave 59) — A PLAIN PICKUP (`Pickups/APItem`) TAKEN ON A FRAME THE SOLVER'S CONTACT CALL DOES NOT
> SEE … EVERY apitem under that box is taken on that frame … a SINGLE apitem … is already taken on the game's tick …
> What the call misses: (1) the SECOND and later apitems … (2) the wand's fallrocks' landing snap … (3) a DEFERRED
> release step … Not modelled, named: coins …; the one-a-tick rule on LIVE ticks …; the wand's approach fade … OFF:
> byte-identical.

**Key-order pins** (found by grep for `'nestedRockCeremony']` and `nestedRockCeremony` across the tests and
`scripts/**`; the scripts have none):
- the 23 tail lists now end `'nestedRockCeremony', 'plainPickupInFreeze']`;
- `contactFidelity.test.js`: the defaults row and the env guard;
- `fidelityFreezeSpanUpdates.test.js`: `slice(-3)`;
- `fidelityNestedRockCeremony.test.js`: `.at(-1)` → `slice(-2)`.

`fidelityFencepost`'s SOURCE-SHAPE pin is untouched: no line sits between `spinnersSteppedThisTick = null` and the
arrow, or after it. The one-spelling law is green: the test imports `apItemTakenOnTick` from `./solverBot.js`, as F2's
does.

### Rows (`fidelityPlainPickupInFreeze.test.js`, fast tier, 10 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| frame A, one apitem `@112,127` | solver tick 24, bank t 25; rock t25 172 | run takes t25 `frame A`; the solver's report = the run's record; bank and stream = OFF (**no double take**) |
| frame A, a second `@110,127` | bank `[25, 26]` (the second after the span) | bank `[25, 25]`; stream and falls = OFF |
| ceremony T (feather, no button), a second | bank `[25, 48]` (after the ceremony) | `[25, 25]`, both `a ceremony's T`; stream and starts = OFF |
| the union (`nestedRockCeremony` ON) | rock `{t24, 0 dead}`, bank `[25, 48]` | `[25, 25]` |
| rope pull (`rockbutton-l28-livefall`) | one: `[156]` either way. Two: `[156, 157]` | `[156, 156]`, both `the pull` |
| wand, deferred step (`apitem@144,226`) | `[110]` | `[109]` `the deferred step`; stream = OFF |
| wand, snap (`fallrock@144,210` tset 0 + `apitem@144,200`) | `[110]` | `[109]` `the wand's snap`; stream = OFF |
| composition (the seven: `nestedRockCeremony`, `freezeSpanUpdates`, `freezeReleaseTick`, `freezeEdgeFrames`, `frozenTickUngated`, `pickupTickFreeze`, `dialogueFrameFreeze`) | T: `[25, 48]` | frame A, T and the pull: the same ON takes as solo |
| no freeze (an apitem on a live tick; the button alone; the wand walk alone) | — | **ON = OFF, the whole result** (alone and under the seven) |

**Mutants.** Each was applied to `levelRun.js` at `ec037862`, run over 4 files and 45 rows
(`fidelityPlainPickupInFreeze`, `fidelityNestedRockCeremony`, `fidelityRockButton`, `fidelityF7`), then restored with
`git checkout`. After each, the `MUTANT` count was 0 and the file equalled the commit (`d2/mutant-M*.txt`,
`d2/mutants-predicted.txt`). **All four measured exactly as predicted:**
1. **Take only the first apitem** (a `break`). Predicted: the five second-apitem rows. Measured: **those 5**.
2. **Bank `t = ticksCompleted`** (no +1). Predicted: the 8 ON-take rows. Measured: **those 8**.
3. **Drop the T site.** Predicted: T, the union and composition. Measured: **those 3**.
4. **The deferred site tests the pre-step box.** Predicted: the deferred-step row. Measured: **that 1**.

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only 0f570abb ec037862 | grep -aE 'fixtures/|golden|tapes/'` is EMPTY
  (`d3/byte-inertia.txt`).
- **Acceptance.** `batch-seedling-acceptance.mjs | md5sum` gives the standing **`391322d681b7aa0229d94b3f6906d024`** at
  all four settings (`d3/acceptance-*.md5`):
  - the base;
  - the head OFF;
  - the head with this key ON;
  - the head with this key plus `nestedRockCeremony`, `freezeSpanUpdates`, `freezeReleaseTick`, `freezeEdgeFrames`,
    `frozenTickUngated`, `pickupTickFreeze`, `dialogueFrameFreeze`, `turretSuitRetaliation` and `owlContactInStep` ON.

  The two ON runs carried the census probe.
- **Committed tapes.** All **294** replay byte-identical ON vs OFF, and again with the nine ON on both sides
  (`d3/tapes-onoff.txt`, `tools/tape-onoff-probe.mjs`).
- **The census, by method:**
  - **The delivered set** (`tools/delivered-rooms.mjs` → `d1/delivered-rooms.json`): the randomizer's own pipeline
    (`fidelityL25ApItem.l25Sets`: `vanillaRecordSet` with `SEEDLING_SET_PATCHES` → `buildPlacementTable` →
    `rewriteRecordSet`). It holds 39 apitems in 116 rooms. Its rock rooms are only:
    - **L28**: the rope, `fallrock@112,240` and a tset-0 button that drops nothing. No apitem.
    - **L32**: `fallrocklarge`. No apitem.
    - **L43**: two tset-0 rocks and `apitem@144,224`, which is the wand's location. The wand is an `APItem` here, so no
      wand ceremony runs, `Wand.removed()` never fires and **its rocks never fall**.
    - **L82**: `fallrocklarge`, and a tset-1 button. No apitem.

    L29's, L74's and L39's rocks (and L29's and L74's buttons) are patched OUT (`seedlingSetPatches.js` 4–8).
  - **Delivered ceremonies** (`tools/delivered-ceremonies.mjs` → `d1/delivered-ceremonies.json`): **no placed special
    pickup remains** in the delivered set. What is left are the runtime ceremonies' hosts: the Witch (L12; the nearest
    apitem is 288 px off), the totem (L43) and the bosses. No apitem is within reach of a ceremony's stance.
  - **The survey** stages the patched vanilla set with only the chests as apitems (`apChestItem`), so it sees chest
    apitems and nothing else (`tools/survey-rooms.mjs` → `d1/survey-rooms.json`).
    - The rooms holding a chest beside a source or a special are L15, L38, L40 and L71. Their buttons drop no rock
      (none of those rooms has a fallrock), and L40's nearest special is 365 px from its chest.
    - It cannot see the delivered set's rewritten pickups, keys, totem parts or seed, which the census above covers.
  - **Legs** (`seedling-divergence-legs.mjs`: **915**; `d3/leg-census.txt`): L28 8, L32 5, L43 52, L82 4. **0** can reach
    an ON site with an apitem under the box.
  - **Runtime probe** (`d3/census-probe.txt`): a temporary line at `takePlainPickupsInFreezeNow`, copied in and then
    restored (diff-clean). **0 hits** everywhere:
    - tapes: **77 asks, 0 hits** (alone and with the nine);
    - acceptance batch ON: **684 asks, 0 hits** (the same with the nine). All of them are `a ceremony's T` in the
      generated worlds, with no apitem in the room.
- **Vitest ON** (the 52 gate files, `--maxWorkers=3`, `SEEDLING_PLAIN_PICKUP_IN_FREEZE=1`; `d3/vitest-on.txt`): **52/52
  files, 1448 passed, 1 skipped** (an env-guarded "ships OFF" row). **0 ON movers.**
- **Train ON** (`vitest.train.config.js`, one file at a time, `SEEDLING_PLAIN_PICKUP_IN_FREEZE=1`; `d3/train-on.txt`):
  wave 57's 13 `.train.` files. My grep for apitems, the key, L28/L43 and the two tapes added none. **13/13 files, 51
  tests passed ON, 0 movers.** The first loop hit its background limit after 12 files, so `hammerWallFlyerDrillKill`
  was re-run alone: 5/5.
- **GAME WITNESS: not recorded.**
  - No shipped room has the shape, so a witness needs a custom level set: L29 with its rock and button restored and two
    apitems at `@112,127` and `@110,127`.
  - I did not build that set in this container.
  - Predicted on p4g: on the press frame A (the frame after the post-t23 box), the game writes **both** slots; the model
    banks t 25 for both, and `pendingCheck` takes two seq bumps in that one frame.
  - ⚠ The bridge reports `pendingCheck` only when it CHANGES per poll (`Game.as:595-600` cites `BridgeGeneric.as:201`,
    not in this repo). Whether the host sees **both** checks of one frame is the bridge's poll rate. That is worth the
    witness on its own (hand-over).
  - Probe for the planner: mount the staged set as `wasmWalkTape` does, drive `tools/plain-l29.mjs`'s walk (up from
    (112,160)), and read `Main.levelPersistence[29]` for tags 7 and 9, plus every `pendingCheck` change, per frame,
    around A.
- **The named sweep:** `plainPickupInFreeze`, **0 legs**. No delivered or survey room puts an apitem within reach of
  any ON site, and the probe made 0 takes over the tapes and the acceptance batch. Shards = min(10, 0) = 0. The flip gate
  is vacuous on shipped content. Belt and braces: the 69 legs in the freeze rooms (L28 8, L32 5, L43 52, L82 4), shards
  10, ×1 per arm (OFF, and `SEEDLING_PLAIN_PICKUP_IN_FREEZE=1`).

## Gates

- **Bounded vitest BEFORE** (the untouched base, 51 files, `d2/gate-files.txt`): **51/51, 1438 passed**
  (`d3/vitest-before.txt`).
- **AFTER** (`ec037862`, OFF, 52 files, `d2/gate-files-after.txt`): **52/52, 1449 passed** (`d3/vitest-after.txt`).
  - A first AFTER run had one red: my own pin edit in `fidelityFreezeSpanUpdates.test.js` (`slice(-2)` against three
    names). It was fixed before the commit.
  - The set:
    - the brief's globs;
    - every test file `grep -a -l` finds for the brief's names and the key;
    - every key-order pin file;
    - `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus` and
      `seedlingSolverSurface`.
- Constants census:
  - `--check` was green (6 new cosmetic, 976 moves);
  - `--write` gave 0 drift;
  - `--profile-rows` left `seedling-constants-fields.csv` byte-identical;
  - `--check` PASS.
- Solver surface: `--check` RED on line numbers only; after `--write`, GREEN (374 rows).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red, 1 skipped, 0 known-red** (`d3/producer-checks.txt`).
- The six `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check`: `d3/solve-checks.txt`
  : **all six green**.
- **CI:** `JavaScript Unit Tests` run 45327676431 at the code head `ec037862`: **success**. The suite was 30052 passed,
  0 skipped and 0 failed (3 shards), and the slow battery 446/446. Later commits are evidence and docs only.
- **Owed by the planner (I cannot dispatch):**
  `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/plain-pickups-rock-freeze-xe5hny -f train_only=true`

## What the brief got wrong (measured)

1. **"A take the game makes inside a span or ceremony is reported late or never."** For ONE apitem it is not.
   - The solver's call tests the pre box. No collapsed freeze moves the box from F−1, so the lone apitem is taken on F
     (frame A tick 24, the pull tick 155, T tick 24) with the run's bank `t` equal to the game's tick.
   - Late or never applies only to the second and later apitems under that box, the wand's snap, and the deferred step.
2. **"Stage … L29's button room with its pickups rewritten to APItems the way the delivery does."** The delivery does
   not ship L29's rock or button: `SEEDLING_SET_PATCHES` removes both, and L74's and L39's rocks too. The staged L29 is
   therefore a model fixture, not a delivered room.
3. **"In a delivered rock room, the feather-style ceremony … is a plain take instead."** True of the item. But the only
   delivered rock room with an apitem is L43, and there the plain take REMOVES the freeze source: the wand's
   `removed()` is what drops the rocks.
4. **"A rope's P … the wand's snap"** as plain-pickup sources. The rope's P is exact for one apitem. The wand's snap IS
   a source, but only staged (no L43 rock lands on its stance), and on the delivered set the wand ceremony does not exist.

## Hand-overs

- **To the planner:**
  - the `train_only` dispatch at my head;
  - the sweep: 0 legs (optionally the 69 freeze-room legs);
  - at harvest, `SOLVER_ENV_NAMES`: my entry sits between `SEEDLING_PIXEL_MASK_SIGHT_LINES` and
    `SEEDLING_PRESS_ESCAPE_EXACT`;
  - the stray `claude/seedling-fidelity-plainspan` ref (above);
  - the witness plan.
- **To hammer (`seedling-hammer-phase-planning-14`; `solverBot.js` is yours):** the segment view's `open` filter
  (`:29508`) uses its own `apItemsTaken`. With this key ON, an apitem the run took itself is still `open` to it.
  - When it is met later, the view reports it (a harmless no-op on the run) and records `apItemsTaken` at the LATER
    tick. The segment's take list is then wrong by a tick or a span, and `replayOntoFork` re-tells it there (also a
    no-op).
  - Suggested change: also skip an apitem the run has banked (`run.plainFreezeTakes`, or `earnedClears` by `apitem@`),
    and list run-side takes in the segment's ledger with their `t`.
  - The rows that show it: `fidelityPlainPickupInFreeze.test.js`, the T row (the solver's own report of the second
    apitem is at tick 47 while the run banked t 25), and the frame-A and rope second-apitem rows.
- **To the JS arc / F2 (the page's `jsRuntimeCore.apItemContact`, `:791`, and `apItemTakenOnTick`):**
  - **One apitem a tick on LIVE ticks** is a general divergence. The game takes every apitem under the box on one
    frame, and the page and the call take one, so the second is late, or never if the box moves off.
  - Not a freeze's, so not this key's. Measured only in the freeze rows.
  - Also the bridge's single-slot `pendingCheck`: two `setPersistence` writes in one frame (the rock's `fall()` and an
    apitem on frame A, or two apitems) leave only the last string. Whether the host sees both is the bridge's poll
    rate (unverified here).
- **To fidelity (later):** the wand's approach fade (`Wand.update`, 99 frozen frames on approach) with apitems under the
  box. It is not a site, and it is vanilla-only (the delivered wand is an apitem).

## Residue

- Every ON row is staged, and no row is game-witnessed.
- Coins are not modelled (cosmetic, no gameplay read).
- Evidence: `seedling-fidelity-plainspan-evidence/`:
  - `tools/`:
    - `plain-l29.mjs` (L29 staged, per tick, the solver's call, the run's takes);
    - `plain-rope.mjs` (the L28 tape);
    - `plain-wand.mjs` (the L43 tape);
    - `delivered-rooms.mjs`, `delivered-ceremonies.mjs`, `survey-rooms.mjs` (the census);
    - `tape-onoff-probe.mjs`;
  - `d1/`: the census JSONs, `staged.txt`;
  - `d2/`: the gate lists, the mutants and their predictions;
  - `d3/`: the md5s, byte-inertia, the tapes, the probe, the leg census, vitest BEFORE/AFTER/ON, the train files and
    train ON.
