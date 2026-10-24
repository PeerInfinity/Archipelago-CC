# Region atlas Phase 8 — subtractive ladder, Rung 3 (Opus kickoff): interactions + real collection

**Date:** 2026-08-01 (Fable design session; three user rulings below).
**Parents:** `CC/docs/plans/seedling-bot-subtractive-plan.md`,
the R0/R1/R2 kickoffs' as-built sections (R2's hold the HOLD contract, the
lock-despawn corrections, the l71 fixture-pair pattern, the span-budget
finding). Doc: `docs/json/developer/procgen/seedling-bot.md`. Memory:
`project_seedling_bot_r2.md`, `project_seedling_bot_r1.md`, the arc topic.

## 0. Mission in one paragraph

Retire both crutches class by class by making the bot OPERATE the game:
real walk-over collection (the ceremony and `Bot.autoAdvance` firing live
for the first time), talk seals (karlore, the Witch → darksword), slash
and spear (breakable rocks, ropes, the bridge), touch-locks (ShieldLock's
position-snap ceremony), pushing, and wand-shot activators — restoring
wand, conch and health for a **target claim of 11 items REAL-collected and
REAL-opened** (`hitsMax == 4` returns as a positive), with named exceptions
only where the opener is enemy-shaped (kill-all-enemies locks stay cleared
until R5). Raw tapes remain the format: the span ceiling gets MEASURED and
`botLoadTape` gets CHUNKED. One rung, ordered slices, the walk re-recorded
once at the end.

## 1. Settled rulings — do NOT re-litigate

1. **(user 2026-08-01) One kickoff, ordered slices** — mechanics land
   cheapest-first, each with its own fixtures; the claim ratchets; the
   full walk re-records once at rung close.
2. **(user 2026-08-01) Raw tapes + chunked load.** Measure the span
   ceiling with a synthetic sweep FIRST (the R2 failure was
   `heap_alloc` at BOOT — a too-big tape is a dead run, not a slow one);
   chunked `botLoadTape` rides the AS3 batch; keep the driver's span
   economy (`allowGrazes`). The directive-tape transition is its own arc
   between R4 and R5 — do not pilot it here.
3. **(user 2026-08-01) Target 11 real, named exceptions.** Grants retire
   per item as its real collection lands; clears retire per class as the
   real opener lands; a clear survives ONLY where its opener belongs to a
   later rung (each named with its rung — the known one: base-`Lock` with
   `tSet == -1` opens on `totalEnemies() == 0`, which is R5). Slice-0
   feasibility can still shrink the target — shrinkage ESCALATES.
4. Carried: `noDamage` + the 4-name `noHazards` set stay ON (R4/R5); pits
   live; sound LAST; frozen fixtures stay byte-identical; `--tier=fast`
   for iteration with the bounded-sweep lesson honoured; the game is the
   only oracle; tapes are whole regenerated artifacts.

## 2. The mechanic taxonomy (recon this session, source-verified)

- **Collection ceremony:** walk-over → `Game.freezeObjects` (~150 frozen
  frames) → NPC text → dismissed by `Input.released` on X during frozen
  frames — which is `Bot.autoAdvance`'s job, compiled since R0 and **never
  yet fired live** (`saw_auto_advance == 0` is asserted everywhere). The
  `Help` popups are already suppressed (`Inventory.help = false`, R1).
  `removed()` does the three-part effect: property + `setPersistence` +
  the suppressed Help. Ceremony frames are DEAD frames — the observation
  stream pauses; determinism holds because the cadence is frame-counted.
- **Talk seals:** karlore (L48, blocks as a Solid NPC until talked
  through; persistence-despawns after) and the Witch (L12,
  `doneTalking()` spawns DarkSword at the player **iff `hasWand`** — a
  REAL ordering constraint now: wand before witch). Talk initiation is an
  X release in `talkRange` (24 px) on a LIVE frame; the pages then run
  under auto-advance in frozen frames.
- **Slash / spear:** X press → the `slashing` setter (`slashTimer` 20
  opens the double-press dash — do NOT double-press unless dashing is
  wanted); hits route through `genericHit`. Plain BreakableRock: Sword OR
  Spear. `breakablerockghost`: verify its weapon at source. The bridge
  (t=29) opens off a spear hit via `bridgeOpeningTimer` — **recon its
  full cycle before modelling: opening may be a WINDOW, not a latch.**
- **Touch-locks:** `ShieldLock.update` — collide while holding the right
  shield → snaps `p.y`, sets `receiveInput = false`, runs the ~100-tick
  activation fade, `turnOff()` restores input + writes persistence. A
  position-writing input-window ceremony: model exactly; the driver emits
  no spans in the window and the runner asserts none (the transport-window
  rule again).
- **Activator locks (`tSet >= 0`):** the button system. Stand-on buttons
  are R2-done (HOLD). **Wand-buttons are pressed by wand PROJECTILES** —
  `WandLock` itself is only a skin over base `Lock`. Shot modelling is
  internal to the JS engine (the differential still compares only player
  observations + transitions; the effect is verified by walking through
  the opened lock, with a shut-before positive control — the l71 pattern).
- **Kill-enemy locks (`tSet == -1`):** NAMED EXCEPTION, stay cleared,
  retire at R5.
- **Pushing:** `PushableBlock` is a Mobile moved by player contact, no
  persistence, positions reset per load — deterministic, modellable.

## 3. Design constraints

- **Swings and shots must not touch enemies.** `genericHit` hits type
  `"Enemy"`; a kill consumes RNG (coin drops), spawns attracting coins,
  and decrements `totalEnemies()` — which can OPEN a kill-lock early and
  silently change gating. Enemies are unmodelled until R5, so the policy
  is structural: **swing/shoot only in rooms whose census shows zero
  enemy entities**, and slice 0 verifies every needed swing/shot site is
  in one. A needed opener inside an enemy room ESCALATES (defer that
  opener vs an R5 pull-forward is the user's trade).
- **Ceremony probe BEFORE the batch.** Record a minimal real-collection
  fixture against the EXISTING build first — it is auto-advance's first
  live fire, and if the cadence or the gate has a defect, the fix rides
  the one AS3 batch instead of forcing a second build.
- **The batch is ONE build:** chunked `botLoadTape` + whatever the probe
  and slice 0 add, finalized before compiling; `FRESH=1`; the
  byte-inertness gate over every frozen fixture BEFORE anything new is
  recorded.
- **Every "opened" claim is a PAIR** (the l71 pattern): the open recording
  plus a shut-before control, because the open alone is satisfiable by a
  blocker that was never there.
- **The crutch ledger is part of the claim:** at rung close the tape's
  `grants` are EMPTY for every collected item (the readout's
  `grants_applied` proves it) and the `persistence` clears are exactly
  the named-exception set. An acceptance check distinguishes
  real-collected (the game's own persistence array, read back as R2 did)
  from granted.
- **Route order is load-bearing again:** wand before the Witch; spear
  before the bridge; shields before their locks. The planner's task list
  carries the dependency order; the executor's throws keep it honest.

## 4. Slices

0. **Span ceiling + probes + recon** (mostly no code): the synthetic
   span-ceiling sweep; the ceremony probe fixture (existing build); the
   per-opener recon — bridge cycle semantics, `breakablerockghost`'s
   weapon, `MagicalLock`'s own check (Wand OR FireWand — verify the OR at
   source), L38 `cover`'s activator wiring (⚠ if its button needs a wand
   shot and wand is behind it, that is CIRCULAR — escalate), the
   wand-button inventory on route, the enemy-room census for every swing/
   shot site, and the kill-lock (`tSet == -1`) inventory (the named
   exceptions list, priced). Feasibility verdicts and escalations to the
   user NOW.
1. **The AS3 batch** + byte-inertness gate.
2. **Ceremony collection** (JS model + fixtures; sword-for-real first;
   `saw_auto_advance` becomes a POSITIVE assertion with a pinned count;
   grants retire per collected item).
3. **Talk seals** (karlore; witch → darksword chain, wand-first order).
4. **Slash/spear + breakables + the bridge** (enemy-free-room policy
   enforced by the planner; pair fixtures per opener class).
5. **Touch-locks + pushing** (the ShieldLock input-window ceremony; block
   pushes with post-push component updates).
6. **Wand-shot activators** (the projectile model — last, most novel).
7. **The walk**: re-plan with real ordering, segments + headline
   (boundaries at once-visited hubs, minimal re-record blast radius),
   acceptance for the ruled claim (11 real + `hitsMax == 4` positive +
   exceptions named + ledger checks + pinned counts).
8. **Docs + close-out**: doc R3 section, kickoff as-builts, plan-doc
   checkbox with the real claim, queue §5c, memory topics, far-end backup
   verification.

## 5. Discipline + traps (standing ones apply; live ones here)

- Read the branch BODIES, not the predicate — five instances now. Census
  claims are per-INSTANCE with counts, never "all" (the Lock.check
  lesson).
- Recon instruments PROPOSE, the shipped planner CONFIRMS (two data
  points say instruments err toward false seals); reachability recon runs
  at movement granularity with R2's published reachability as the
  known-answer control.
- No spans inside any input-refused window (transports, touch-lock
  ceremonies, collection freezes) — driver emits none, runner asserts
  none, both loud.
- `assertRect` at every rect birth; negatives need positive controls;
  every opened-blocker claim is a pair.
- Recording: `--record --only=` always, `--win` always, fresh page per
  tape, deadlines scale with tape length, batch recordings (full sweep
  ~55+ min and growing — keep `--tier=fast` honest about what it
  bounded).
- Zero AS3 outside the one batch; anything found later is a finding to
  report. Never `git add -A` with a recording running; stage+commit
  atomically; commit each slice to main; push when green.

## 6. Open questions (ask the user only if blocking)

- Slice-0 escalations: circular activator dependencies, a needed opener
  inside an enemy room, bridge-window semantics that resist exact
  modelling, or a span ceiling low enough to force re-segmentation.

## 7. Acceptance gates

- **G1 (CI, vitest):** all suites green; every frozen fixture
  byte-identical; new strata per mechanic (ceremony timing, talk flow,
  slash arc + genericHit, touch-lock window, push motion, projectile
  flight); mutations that must bite, minimum: auto-advance cadence ±1,
  a swing one pixel out of arc, the wand-shot missing its button, a
  touch-lock span emitted inside the window, a push mis-stepped, grants
  non-empty for a collected item, a clear surviving outside the named
  set. Record non-biting mutations as bounded vacuities with witnesses.
- **G2 (local, `--win --tier=full`):** frozen fixtures EXACT against the
  new build; every mechanic's pair fixtures EXACT; the R3 chain a
  PARTITION of its headline; acceptance asserting the ruled claim from
  the game's own reports — items, `hitsMax == 4`, the persistence array,
  the empty-grants ledger, the named-exception clears, pinned counts.

## 8. Slice 0 — RECON, AS BUILT (2026-08-01)

Source-verified against `~/CC/seedling` branch `bot`, the committed extract
and the live build. **The rung's target does not survive it**, and §9 holds
the user's rulings.

### 8.1 The instruments, and the geometry they share

R2's `(level, component)` graph moved out of `plan-seedling-r2-route.mjs`
into **`scripts/procgen/seedlingRouteGraph.mjs`**, because R3's question is
R2's geometry under a *different clear list* and a second transcription of
it would carry none of R2's four corrections. `levelRun.js` is the
precedent: two copies would be wrong together. The refactor is proven inert
the only way that counts — `--write` then a clean `git diff` on the
committed `r2-route.json`, re-run after the cache change as well.

The cache is what makes the sweeps affordable: it keys on **the level AND
its own cleared tags**, so two runs differing by one clear share 115 of 116
floods. Keying on the level alone would hand a run the previous run's
geometry, and every answer after the first would be a fact about a map
nobody planned over.

**`recon-seedling-r3.mjs`** (`--control`, `--necessity`, `--minimal`,
`--keys`, `--clears=`). ⚠ **Its known-answer control failed on the first
run and was right to**: it called the graph broken for collapsing a
chained-fall PASS-THROUGH into its arrival node. L84 is R2's leg 39 — zero
targets, straight out through the pit at (2,2) — and never becomes a
`(level, component)` at all. The control now subtracts the levels the graph
itself names as pass-throughs, and additionally pins R2's one published
hold edge, whose absence is what "Dungeon 7 is sealed" would look like.

### 8.2 ⛔ THE HEADLINE: three of the four target items are not R3-shaped

| item | what actually seals it | rung |
|---|---|---|
| `conch` | **`Karlore.added()` removes him only on `Player.hasFire`.** `doneTalking()` calls `unlockMedal` and nothing else, and his tag is −1 so no clear reaches him — **talking does not despawn him.** §2's "talk seal → karlore" is wrong at source | R5 |
| `wand` | `Wand.update` gates the entire pickup on `Player.hasAllTotemParts()` (`Wand.as:78`, `doBossActions` is a hardcoded `true`) — 5 `totempart` pickups in L39/L40/L41/L42, and L40 alone holds 22 enemies. Collecting it then flips `BossTotem` live (`classCount(Wand) <= 0`, `BossTotem.as:287`) | R5 |
| `darksword` | `Witch.doneTalking()` requires `Main.hasWand`, and **no `darksword` placement exists anywhere in the extract** — she is its only source. R2's recorded anomaly pays itself back: retiring the grant COSTS R2 an item | R5 |
| `health` | L63's bridge and L65's `rock@192,96` are both inside enemy rooms (L63: 2 jellyfish + grenade + 4 darktraps; L65: `bob@208,80`, **16 px** from the rock). L68 also holds `magicallock@16,32` beside `health@16,16` | R4/R5 |

**So the honest claim is 7 items, not 11** — sword, shield, feather, torch,
spear, darkshield, darksuit — with `hitsMax == 3`. The rung's headline stops
being "more items" and becomes **the same map with the crutches off**.

### 8.3 The retirement bill: 8 clears, not 25

R2's clear list is **offered per LEVEL, not per need** —
`persistenceClearsFor` hands over every clearable tag in every level the
route enters — so "retire 25 blockers" was never the bill.

⚠ **Necessity is not the bill either.** A one-out sweep says 7 clears are
individually load-bearing, and *those 7 alone reach 3 of the 7 rooms*: two
clears in a doorway wide enough for either each answer "not required", and
then both come off and the door shuts. The bill is an **irredundant** set,
computed by removing clears one at a time and keeping each removal only
while every room stays reachable.

**17 of R2's 25 retire by DELETION.** The walk never needed them. The
surviving 8, by opener:

| clear | opener | verdict |
|---|---|---|
| L71 tag 2 `shieldlock@288,256` | touch while holding the dark shield | **R3 — the one real opening** |
| L12 tag 3 `bosslock@80,656` (keyType 1) | `BossKey` @ L29 | key room reachable ONLY through a bosslock clear — **circular** |
| L12 tag 5 `bosslock@432,240` (keyType 0) | `BossKey` @ L19 | L19 unreachable under EVERY clear list |
| L12 tag 12 `bosslock@32,864` (keyType 4) | `BossKey` @ L67 | L67 unreachable under EVERY clear list |
| L12 tag 7 `magicallock@32,864` | a wand shot (`WandShot.checkEntity` → `MagicalLock.hit`) | R5 — no wand |
| L24 tag 0 `burnabletree@32,128` | fire | R5 |
| L60 tag 0 `lock@128,80` (`tSet == -1`) | `totalEnemies() == 0` | R5, as ruled |
| L71 tag 0 `lock@112,192` (`tSet == -1`) | `totalEnemies() == 0` | R5, as ruled |

⚠ **Three outcomes, not two**, and the first cut of the `--keys` report
collapsed them and mislabelled a fact: "unreachable without the lock" is
only *circular* if the room was reachable **with** it. L19 and L67 are
unreachable under every clear list, which is a different seal needing a
different name — and calling that circular would send the next slice
hunting a lock that is not the problem.

### 8.4 ⛔ Two defects in the shipped-dark auto-advance, found by reading

Both ride the one AS3 batch, which is exactly why the probe runs first.

1. **Real sword collection cannot complete on the existing build.**
   `Sword.removed()` adds `new Help(3)` — and **`Help` is not gated by
   `Inventory.help`**; only `Inventory.as:158`'s own popup is, so R1's line
   does not reach it. `Help.update` holds `Game.freezeObjects` until
   `Input.pressed(Key.X)`, while `autoAdvance` returns early because it
   gates on `Game.talking` and a `Help` is not an NPC. It is R1's
   inventory-tutorial deadlock again, one class over.
2. **`autoAdvance` can strand X DOWN.** Phase 0 dispatches KEY_DOWN, phase 1
   KEY_UP. For an NPC that is balanced, because the *release* is the edge
   that ends the freeze. For a `Help` the *press* is — so the next frame is
   live, `autoAdvancePhase` resets to 0, and no KEY_UP is ever dispatched.
   The fix is a `pendingRelease` the live path drains before it records.

Also live-fire only: **`TorchPickup.removed()` and `HealthPickup.removed()`
call `Main.unlockMedal`**, which reaches the Newgrounds `API`. A grant never
ran `removed()`, so that call has never executed in the recompiled runtime.
`probe-seedling-ceremony.mjs --pickup=torch` is its own probe.

### 8.5 The tape budget has TWO ceilings, and neither subsumes the other

`probe-seedling-span-ceiling.mjs`, fresh page per load, `botLoadTape` only —
the probe needs no frames, so it runs on the local software-WebGPU browser.

- **Span ceiling: loads at 2078, fails at 2132** (synthetic 36-byte spans,
  76 KB vs 78 KB). R2's headline is 853.
- **Byte ceiling: a 853-span tape survives to 95 KB and dies by 159 KB** —
  well past the 78 KB the span sweep died at.

⚠ So bytes are not what killed the span sweep, and spans are not the only
limit: **two independent ceilings, ~2100 spans and ~95–159 KB.** A real span
costs ~74 bytes against this probe's ~36, which is why they happen to bind
at about the same tape — a real 2078-span tape would be ~154 KB, right in
the byte band. **Budget against both.** R2's 853 spans / 63 KB has ~2.4x
span headroom and ~1.5x byte headroom, so chunked `botLoadTape` is a
question about how much R3's route grows, not a foregone conclusion.

### 8.6 The mechanics R3 actually needs — and the ones it does not

Retiring the bill in §8.3 needs the **ceremony** (7 pickups), **one
touch-lock**, and nothing else. Specifically **not**:

- **No spear, no wand, and therefore no equip primitive.** ⚠ `useItem` reads
  `Inventory.getItem(Main.primary)` (`Player.as:1543`), and `Main.primary`
  defaults to 0 — which is the sword, because `addItemsFromSave` pushes it
  first. So a slash is a bare X press. **Anything else is not**: selecting a
  weapon means opening the inventory, whose `open` setter *is*
  `Game.freezeObjects = true`, and frozen frames are dead frames no tape
  span can reach. A spear or a wand needs an in-game selection driver in the
  batch — deferred to the rung that first needs one.
- **No talk seals.** Both candidates are R5 (§8.2).
- **No pushing.** No `pushableblock` appears in the bill.
- **No slash, even.** All 5 `breakablerock` clears are among the 17 that
  retire by deletion — including L30's, so the enemy-room question that
  §5 flagged never has to be answered at this rung.

⚠ Recorded because it will matter at R4: **`BobSoldier` CHASES**
(`runRange = 80`, `playerActions` steers `v` at the player every tick), so
"the enemy is 144 px away" is a fact about the spawn and not about the swing.
It still cannot interfere — `"Enemy"` is absent from `Mobile.solids`, and
both its damage paths end at `Player.hit()`, which is what `noDamage`
guards — but a swing beside one would put it in the slash rect, and
`Enemy.hit` on death draws `Math.random()` into the runtime's one global
LFSR and adds `Coin` entities the model does not know exist.

### 8.7 ⛔ THE CEREMONY PROBE, and what it inverted

`probe-seedling-ceremony.mjs` boots into L10, walks north onto
`sword@48,48`, and watches. Hand-authored rather than driver-synthesized,
because the driver treats every pickup as an AVOID volume and asking it to
plan INTO one is asking it to refuse.

**Run 1 (no X presses) — the tape finished, and the sword was NOT
collected.** Not the predicted deadlock, and the shape is the finding:

```
tick=24/70 dead=20  ... L10 (56,62)     <- contact; freeze begins
tick=24/70 dead=169 ... L10 (56,62)     <- 149 frozen frames = specialTimer
tick=70/70 dead=169 ... L10 (56,62)     <- 46 TICKS CONSUMED, player never moved
FINISHED. hasSword=false, saw_auto_advance=0
```

⚠ **THE BOT CONSUMED 46 TAPE TICKS AGAINST A FROZEN GAME.** The dead-frame
gate samples `Game.freezeObjects` once, at the top of `Main.update` — but
the flag is a sticky static with several writers per frame and no global
reset, so during the dialogue phase it is TRUE when `Mobile.mobileUpdate`
reads it and FALSE by the time the next frame's gate does. The specialTimer
phase has one writer and gates correctly (149 clean dead frames); the
dialogue phase does not. No fixture has ever entered a ceremony, so nothing
on the ladder could have seen this.

**Run 2 (`--x=8`) — the tape pressed X on its own ticks, and the sword was
REALLY COLLECTED.** `hasSword=true`, `saw_auto_advance=0`.

**⇒ THE CEREMONY IS DRIVABLE FROM THE TAPE, WITH NO AS3 AT ALL.** Because
the bot is ticking, its spans reach the game; and `NPC.talk()` reads
`Input.released(p.keys[6])` from the NPC's OWN update, which is not inside
`Mobile.mobileUpdate`'s frozen block. §4's slice 2 had this backwards:
`saw_auto_advance` does not become a positive assertion with a pinned
count. **It stays ZERO, and the tape does the work** — which is the
doctrine anyway (behaviour lives in tapes and in JS; the interpreter is
compiled in once per rung).

**Then run 2 deadlocked, exactly as §8.4 predicted:**

```
tick=62/81 dead=194 ... hasSword=true   <- pinned, dead_frames climbing
```

The freeze after `removed()` is the `Help(3)`, and it has ONE writer, so the
gate behaves correctly and the tick counter stops — which means the tape's
remaining X presses can never be dispatched. `autoAdvance` cannot help
(`Game.talking` is false for a `Help`). **No tape can ever dismiss it.**

### 8.8 The AS3 batch, and what it does NOT contain

Two changes, both small, both named by the probe:

1. **`autoAdvance` gets its real job: the `Help`.** Extend its gate from
   `Game.talking` to also fire when `FP.world.classFirst(Help) != null`.
   This keeps a clean division that survives the rung: **the tape drives
   every dialogue; `autoAdvance` handles only the freeze no tape can
   reach.** `saw_auto_advance` stays a meaningful signal — non-zero means
   a `Help` fired, and at R3 that is exactly once, for the sword.
2. **The stranded-X fix.** `autoAdvance` dispatches KEY_DOWN on phase 0 and
   KEY_UP on phase 1. A `Help` is dismissed by the PRESS, so the following
   frame is live, `autoAdvancePhase` resets, and the KEY_UP is never sent —
   leaving X held for the rest of the run. A `pendingRelease` the live path
   drains before it records.

**NOT in the batch: chunked `botLoadTape`.** §1.2 ruled it in on the
premise that the ceiling be measured first; §8.5 measured it, and R2's
headline has ~2.4x span and ~1.5x byte headroom against two independent
ceilings. Chunking a string that is then concatenated back would not even
address the failure. The protection R3 ships instead is a **budget assertion
on the JS side** that refuses to emit a tape past the measured band, naming
both ceilings — no build, and it fails at synthesis rather than at a
recording deadline.

**NOT in the batch: the dead-frame gate fix.** The mid-frame sampling in
§8.7 is what makes tape-driven collection possible, and the ticks it
consumes are frame-counted and therefore deterministic. Changing it would
close the door the rung walks through. It is recorded as a KNOWN
IMPRECISION with a name: the gate answers "was the flag set at the top of
this frame", not "did the player move", and the two differ for exactly the
frames a dialogue is open. The JS model must reproduce the tick consumption
exactly, and the recordings are the oracle for it.

## 9. ⚖ THE SLICE-0 RULINGS (user, 2026-08-01)

1. **Target: 7 items, real.** sword, shield, feather, torch, spear,
   darkshield, darksuit REAL-collected, `hitsMax == 3`. `wand`, `conch`,
   `darksword` and `health` are each named with their rung (all R5). The
   headline stops being "more items" and becomes **the same map with the
   crutches off** — grants EMPTY, clears reduced to the named-exception set.
2. **Build only what R3 retires.** Ceremony collection and the one
   touch-lock. Talk seals, spear, wand shots, pushing and the equip
   primitive all drop to the rung that first needs one.
3. **L30's rock: the question dissolved.** It is one of the 17 clears the
   walk never needed, so the enemy-free-room policy is never tested there.
   (The user's challenge was right to press on it, and pressing found the
   better answer: `BobSoldier` CHASES — `runRange` 80 — so the 144 px was
   the spawn gap, not the swing gap. It still could not interfere: `"Enemy"`
   is absent from `Mobile.solids` and both its damage paths end at
   `Player.hit()`, which `noDamage` guards.)

## 10. Slices 1–2 — AS BUILT (2026-08-01)

### 10.1 Slice 1 — the AS3 batch, and the gate

**Three changes, one build, `FRESH=1`.** All named by the §8.7 probe:

1. `autoAdvance` fires for a `Help` as well as for `Game.talking`.
2. `autoAdvanceHeld` — the live path drains a press that a `Help` consumed,
   so X is never left down (and X is `useItem(Main.primary)`).
3. `botStatus.persistence_cleared` — every flag currently off, **scanned
   from `Main.levelPersistence` rather than echoed from the tape**. R3
   retires the clear crutch, so flags now go false because the PLAYER did
   something, and the ledger claim is exactly the difference between that
   list and the declared one. No tape field, so no version bump and no new
   place for two consumers to disagree.

**✅ THE BYTE-INERTNESS GATE PASSED BEFORE ANYTHING NEW WAS RECORDED:
298 checks, ZERO failures.** All 34 frozen fixtures byte-identical against
the new build — R1's 14,963-tick headline with its eleven-item claim, R2's
10,136-tick headline with its eight, every chain assertion, the live driver
task, and `saw_auto_advance = 0` on every single tape.

**Chunked `botLoadTape` came OUT of the batch**, on its own ruling's terms:
§8.5 measured the ceiling first and found TWO, ~2100 spans and ~95–159 KB,
with R2's headline at 2.4x span and 1.5x byte headroom. Concatenating
chunks rebuilds the same string, so it would not address the allocation
that fails. `tapeFormat.assertTapeWithinRuntimeBudget` replaced it, enforced
in `synthesizeLegs` so a plan fails while the planner is still cheap; three
mutations red in milliseconds. ⚠ Its span test CAPS the tape it builds —
the first mutation run (`spans: 999999`) spent twenty minutes constructing
a million-span tape and had to be killed. A mutation that hangs is not one
that bites.

### 10.2 Slice 2 — the ceremony, and three things only the game knew

`dialogue.js` transcribes `Pickup`/`NPC`/`Game`'s text machinery; 13
hand-counted cases are the second stratum. `levelRun` runs it.
`r3-collect-sword` is the first tape on the ladder with EMPTY grants and a
true item property, and the model matches the recording **byte for byte,
all 76 observations**. vitest 599/599 across 14 files.

| what the oracle settled | the model's state before it |
|---|---|
| contact at observation 23, frozen 24..57 — **34 ticks** | predicted 34, last frozen tick 57, from the AS3 alone |
| **velocity SURVIVES a freeze** — 61.65 → 61.00 → 60.60 → 60.45 after the ceremony, then friction | implied by "do not step", and confirmed |
| ⚠ **the COMPLETING frame is not frozen** | wrong, and it was the ONLY divergence |

The completing-frame rule is the one worth carrying: `World.addUpdate`
PREPENDS and the temporary NPC is added LAST, so it updates BEFORE the
player — `talking = false` has already cleared `Game.freezeObjects` by the
time `mobileUpdate` reads it, and the player moves on that very tick.
Counting it as frozen made every ceremony one tick long.

⚠ **Press spacing is load-bearing.** `slashTimer` is 20 and the sword's own
text says "double tap to dash": a press landing after the ceremony reaches
`useItem(Main.primary)`, so one stray press is a swing and two within
twenty ticks is a DASH that moves the player. The fixture spaces them
EIGHT apart, leaving exactly one stray — which the recording confirms moved
nothing.

⚠ An unpriced pickup THROWS rather than costing the tape an unknown number
of ticks. `text: ''` is a REAL case with no dialogue at all (a totem part, a
non-zero boss key), not a gap in the table.

## 11. WHAT IS NOT DONE, and what it needs

Slices 3–8. Everything they depend on is in and green.

- **The ShieldLock touch** — R3's ONE real opener (`L71 tag 2
  shieldlock@288,256`, which seals darksuit). `ShieldLock.update` collides
  at `x - 1`, requires `Player.hasDarkShield` (`shieldlock` is `_type 1`;
  `shieldlocknorm` is 0), snaps `p.y = y - originY + 7`, sets
  `receiveInput = false`, runs the ~100-tick fade, then `turnOff()` restores
  input and writes persistence. **A position-writing input-refused window:
  the driver emits no spans inside it and the runner asserts none.** Needs
  the l71 PAIR — the open plus a shut-before control.
- **Six more collection fixtures**, one per remaining item. The ceremony
  model is done; these are route authoring plus recordings.
- **The R3 route.** `recon-seedling-r3.mjs --minimal` gives the 8-clear
  bill; the shipped planner must CONFIRM it, and must narrow "reached" from
  "a component of the level" to "the pickup's own tile" — R2 could stop at
  the door because entering the room WAS collection.
- **The walk**, its segments, and the acceptance readout: 7 items and
  `hitsMax == 3` from `botStatus`, `grants` empty, `persistence` exactly the
  named exceptions, and `persistence_cleared` showing the seven item tags
  the PLAYER turned off.
- **Docs + close-out.**

## 12. Slices 3–7 — AS BUILT, and the RUNG CLOSES (2026-08-01)

**The claim, from the game's own `botStatus` over a 53-leg / 32-level /
12,122-tick walk: SIX items REAL-COLLECTED with `hitsMax == 3`** — sword,
feather, torch, spear, darkshield, darksuit — with **`grants` EMPTY** and
the persistence flags that are OFF equal to *exactly* the ten declared
exceptions + the one `L71 shieldlock@288,256` earned by being TOUCHED + the
six the pickups' own `removed()` wrote. Six segments —
641 + 1473 + 1964 + 3707 + 2162 + 2175 — **partition the headline exactly**.
vitest 697/697; fixture roster 50; every frozen fixture byte-identical.

### 12.1 Slice 3 — the touch lock, and the tick the ORACLE moved

`ShieldLock.update` transcribed whole: the collide at `x - 1` (whose rect is
the `lock-snap` avoid volume already priced — one geometry, two questions),
`hasDarkShield` for `shieldlock` and `hasShield` for `shieldlocknorm`, the
`p.y = y - originY + 7` snap, `receiveInput = false`, the ordinary 0.01
`Lock` fade to its 101st tick, then `turnOff()`.

Three ways it is NOT the button lock: `activate` **LATCHES** (`tSet` is
forced to −2, so nothing republishes it); the window refuses the **KEYS**,
not the tick (`receiveInput` gates `Player.input()` alone, so friction and
both sweeps still run); and `turnOff()` restores input only **`if (p)`** —
unreachable at walking speed (subtractive friction coasts under 2 px against
a 5 px margin) but wide open on ice, which is why the guard exists.

⛔ **THE ORACLE CORRECTED THE UPDATE ORDER ON THE FIRST RECORDING.**
`Game.loadlevel` adds the Player at `Game.as:2040` and every puzzle entity
in the loop BELOW it, and `World.add` → `addUpdate` **PREPENDS** — so a Lock
updates **before** the player. §10's docblock (inherited from R2) said the
opposite, and no recording could tell: the player is stationary for the
whole of `l71-button-lock`. It changes nothing about the activator STATE
(the same object either way) and everything about the SIDE EFFECT: `p.y` is
written at the top of tick N+1. The model applied it at N; the game said
observation 19 is y 264, not 263. The mutation that re-introduces it now
bites in vitest.

**The pair is ONE FIELD APART.** `l71-shieldlock-open` and
`l71-shieldlock-shut` are the same tape with `grants` emptied: y 263 and
level 76 against y 264 and pinned at x 285.95 for all 140 ticks.

Ten mutations run, nine bite; the tenth (`turnOff` finding no player) is a
bounded vacuity with its arithmetic witness in the suite.

### 12.2 Slice 4 — the other six, EXACT on the first recording

One tape per remaining item, each booting 24 px south of its pickup and
paging the ceremony through with four X releases spaced eight apart. **All
six reconciled on the first recording**, which is what turns slice 2's
ceremony model from fitted into transcribed: one data point is satisfied by
a constant, seven are not.

The press schedule is READ OFF THE MODEL (`levelRun.inCeremony`) rather than
counted by hand seven times; the recording is still what decides whether the
answer was right, and it is sensitive in both directions because the
ceremony's end tick is where the player starts drifting again.

### 12.3 Slice 5 — the route, and TWO findings that changed the claim

**`collect` is a verb, not a tolerance.** Three things had to be true:

1. **The planner is kept OUT and the executor let IN.** Exempting the pickup
   leg-wide let A* route STRAIGHT THROUGH L89's feather on the way to its
   own approach cell — the ceremony fired mid-drive and the waypoint was
   never reached. A 1,500-tick stall for a route one waypoint from correct.
2. **The approach cell needs CLEARANCE.** The controller overshoots before
   braking back, and clipping a pickup starts its ceremony a waypoint early
   — which freezes the player, and `hasArrived` needs them STOPPED while a
   freeze PRESERVES velocity. L64's ghostspear found it one third of a pixel
   into a 12×4 volume.
3. **A collected pickup must stop being an obstacle.** `run.takenPickups` is
   live state the planner reads, exactly like `openActivators`.

**The map changes halfway, because the player changes it.** `Lock.turnOff()`
writes `setPersistence(2, false)` and `Lock.check()` removes the lock on the
next `Game` — so the tour runs over TWO graphs, and `levelRun` banks the
earned tag and cashes it in the transition path. The route goes east through
the lock to darksuit and comes BACK through the same corridor to L71's pit;
without this the return leg meets a wall the game does not have.

⛔ **THE NARROWING TOOK `shield`.** "Reached" is the PICKUP'S OWN TILE now,
not a component of the level. L20's shield is in the level's other
component, behind `lock@32,80` (tset 0, so no clear despawns it) whose only
presser `buttonroom@192,16` is adjacent to NO walkable component — walled in
behind `shieldlocknorm@176,16`, which needs `Player.hasShield`. The other
entrance is L19's stairs, and L19 is `Dungeon2_Boss`. **No clear list on the
map unseals it**, checked one at a time over all 72 offered clears and all
together. `plan-seedling-r3-route.mjs --survey` is the table.

⛔ **THE CLEAR BILL: the recon said 8, the SHIPPED PLANNER said 10.**

| clear | who demanded it |
|---|---|
| `L30 tag 0` `bosslock@64,32` | the NARROWING — the recon asked at LEVEL granularity |
| `L3 tag 0` `breakablerock@96,112` | the driver's own A* — no path at any clearance |
| `L11 tag 0` `chest@32,48` | the CONTROLLER — the overshoot clips its avoid volume |

The instrument was not buggy; it answered the question it was asked.
**A reachability graph and a walk are different questions.**

⚖ **User ruling (2026-08-01):** keep the torch (6 items, 10 clears) rather
than drop it — the rule for a surviving clear is about the OPENER's rung
(a BossKey is R4), not about where the door sits.

### 12.4 Slice 6 — the walk, and the LEDGER

`r3Acceptance.js` asserts, from the game's own arrays: the six booleans,
`hitsMax == 3` as a NEGATIVE, the blocked list still false, **`grants`
empty**, and — the one with teeth — **`persistence_cleared` as an EXACT SET
in both directions**. `Bot.persistenceClearedAll()` scans
`Main.levelPersistence` rather than echoing the tape, so an exact-set claim
over it is the only thing that distinguishes "the player did this" from
"the tape did". `r3Acceptance.test.js` mutates every input — including
removing each pickup's own flag one at a time, which IS the "granted, not
collected" failure — 19 cases in CI.

The chain asserts each segment ends where the next boots, ends holding
exactly what the next inherits (a segment's single boot-level grant IS that
inheritance; the headline has none), and that the six are a **PARTITION**.

### 12.5 A blind spot in the readout, REPORTED not fixed

`saw_auto_advance` increments on **phase 1** of the cadence — the RELEASE. A
`Help` is dismissed by `Input.pressed`, so its freeze ends on phase 0, the
next frame is live, the phase resets, and the counter never increments. The
sword's `Help(3)` IS auto-advanced on every run that collects it (about two
extra dead frames is the witness) and the readout still says 0. §8.8 and
`Bot.as`'s own docblock both claim the opposite, two lines above the code
that contradicts them. Harmless — the model reproduces every tape exactly —
but the counter means "no NPC dialogue was auto-advanced", not "no
auto-advance fired". Fixing it is AS3, so it waits for the next batch.
