# Seedling real-game bot — the SUBTRACTIVE ladder (re-plan, 2026-07-31)

**Status:** design ruled (Fable session 2026-07-31, four user rulings below).
Implementation started 2026-07-31; both docs became tracked at
`CC/docs/plans/` at that point, per the v1/v2 precedent. The rung-0 Opus
kickoff is `CC/docs/plans/seedling-bot-r0-opus-kickoff.md`.

**Read first:** `docs/json/developer/procgen/seedling-bot.md` (the as-built
v1+v2 system — every contract below builds on it), then
`CC/docs/plans/seedling-bot-v2-opus-kickoff.md` §7–§14. Parent plan:
`CC/docs/plans/region-atlas-plan.md` §Phase 8.

## 1. The correction that prompted this re-plan

The recorded ladder was **additive** — v2 collision → v3 item-gated terrain →
v4 puzzles → v5 enemies — with a beatable game appearing only at the very end.
That was never the intended plan. The intended one, now ruled:

> Disable collision with enemies and obstacles so the whole map is freely
> walkable. Generate a playthrough that walks the whole game reaching all the
> items. Then reintroduce ONE obstacle type, teach the bot to get past it, and
> repeat until the full game with all obstacles and enemies is beatable.

**Subtractive, not additive.** End-to-end coverage exists from the first rung;
every later rung REMOVES a crutch rather than adding a capability; every rung
is a full playthrough; progress is measured in "what still blocks us", not in
features built. The v3/v4/v5 labels in the plan doc are restructured
accordingly (they survive as the *skills* some rungs teach, not as the ladder).

**v1 and v2 are not wasted.** v2's collision, A\*, transitions and the
exact-differential harness are exactly what rungs R2+ re-enable and verify
against. The ordering changes; the machinery does not.

## 2. Settled facts — carried in, do not re-derive

(Full detail in the memory topic and the v2 kickoff; one line each here.)

- **RNG is a non-issue for determinism.** The recompiled runtime's
  `Math.random()` is a fixed-seed LFSR (seeded from `MOCK_DATE_TIME`,
  hard-defaulted); every load replays the identical sequence. But it is ONE
  global stream, so **tapes are deterministic yet not editable** — regenerate
  whole artifacts, never patch. No RNG rung is needed.
- **The 3-of-116 class-table figure constrains the JS differential, not the
  game.** `Bot.as` never consults `levelWorld`. A relaxed-walk planner needs
  tile typing (complete, census-guarded across all 116 levels), triggers
  (complete — 280, census-guarded), and pickups (small new classification) —
  not the ~115 collider tags.
- **Available today with zero AS3 edits:** the per-tape `noclip` flag;
  teleport to any level; direct item property writes.
- **noclip does not bypass terrain typing or its effects:** water drowns
  without `canSwim` (`Player.as:1444`), a pit sets `receiveInput = false` and
  transports the player (`Game.fallthroughLevel`), ice rewrites speed and
  friction, water speed couples to sound state.
- **The level graph is almost ungated:** 1 of 280 triggers is tagged; ~100 of
  116 levels reachable from level 0 ignoring geometry.

## 3. New recon facts (this session, source-verified)

- **Item collection has a tape-contract gap.** "Special" pickups freeze the
  game (`Game.freezeObjects = true`, ~150 frozen frames) and then show an NPC
  dialogue dismissed only by `Input.released` **during frozen frames**
  (`NPC.talk()` runs while frozen; `Pickup.pick_up()` waits on the text
  object). The bot dispatches edges only on live ticks — a walked-over pickup
  deadlocks every tape. Any fix must be **in-game and frame-deterministic**:
  harness-timed dismissal would vary the frozen-frame count run to run and
  shift the global RNG stream, breaking recording reproducibility.
- **The item census (all 14, located):** 12 walk-over pickups in the extract —
  sword L10, torchpickup L30 (→`hasTorch`), wand L43, conch L49 (→`canSwim`),
  ghostspear L64 (→`hasSpear`), health L68, darkshield L74, darksuit L79,
  shield L20, feather L89, ghostsword L106, firewand L109. Plus:
  **darksword** — granted by the Witch NPC (L12) via `doneTalking()`,
  condition `hasWand && !hasDarkSword` (the ONE true item→item dependency);
  **fire** — dropped by BobBoss — the ONLY combat-gated item. ⚠ **RESOLVED at
  R0: no `.oel` carries a `bobboss1/2/3` tag at all**, so `Game.as:2068-2070`
  never fires; the only live construction is `Scenery/FallRockLarge.as:117`,
  from the fallrocklarge with `bossrock && thirdboss` — **level 32**.
- **The win condition is the Seed** (`Pickups/Seed.as` — the literal
  `//GAME WON` comment). FinalBoss (entity in L112) dies → the Watcher
  spawns the Seed → collecting it runs `drawCover` and swaps worlds: bloody
  path sets `Game.cutscene[1] = true` → `new Game(1, 64, 96)`; tree path sets
  `Game.menu = true` + credits + medal. Both endings are observable from
  public statics (`Game.cutscene[]`, `Game.menu`).
- **Enemy contact is a position event, not just damage:** `Player.hit()`
  (`Player.as:1345`) applies a velocity knockback + screen shake + `hits`,
  and `die()` at max. Even a survivable graze diverges the differential. It
  is a no-op while frozen, and the `bot` branch already carries the
  `Bot.noclip` guard pattern inside Player's move overrides
  (`Player.as:1697/:1727`) — a `Bot.noDamage` guard is the same shape.
- **Proximity side-effects beyond pickups exist and must be classified:**
  chests OPEN when the player line-collides beneath them (`Chest.update` —
  spawns a special SealPiece, consumes gameplay RNG for the seal index); NPCs
  can open dialogue on proximity (`talk()` fires on `hitKey || !keyNeeded`);
  Watchers need the same check. ⚠ **RESOLVED at R0: there are ELEVEN watchers,
  not twelve, `keyNeeded` is assigned in exactly ONE place in the codebase
  (`Watcher.as:46`), and all eleven carry `tag >= 0` — so all eleven auto-talk
  and every other NPC needs the key.** A relaxed walk must
  route around these volumes exactly as the v2 driver routes around live
  teleporter volumes.
- **Hazard handling funnels through one place:** the post-`getState()` block
  in `Player.as` (~656–740: state assignment, `onIce`, the pit branch) plus
  `drown()`. A single coerce-point guard is feasible — see R1's contract.

## 4. THE RULINGS (user, 2026-07-31)

1. **Rung 1 relaxes: noclip + noDamage + noHazards + grant-on-room-entry —
   and the JS engine models ALL of it exactly.** Hazards are disabled via a
   new AS3 flag (not routed around), and the JS side mirrors the disabled
   behavior so the exact differential holds end-to-end. (Claude had
   recommended routing around live hazards; the user chose disabling them
   with a matching JS model — strictly better coverage at the cost of one
   more Player.as guard.)
2. **The AS3 batch** (first edit since v1; ONE pipeline run): dialogue
   auto-advance during dead frames; item/win-state readout in `botStatus`;
   `Bot.noDamage`; the parameterised boot; plus — implied by rulings 1 and
   4 — `Bot.noHazards` and the tape-driven grant mechanism. Six changes, one
   build. All are Bot-flag-pattern edits; none touches game logic when its
   flag is off.
3. **Removal order: cheapest-machinery-first**, under the invariant that
   after each rung the full item walk is still completable with the
   mechanics modelled so far — the crutch is replaced by a skill, never by a
   gap.
4. **The item walk gates; items are GRANTED ON REACHING THEIR ROOM, for
   now.** The bot auto-grants an item's property when the player first
   enters the level that holds it — the walk must still physically reach all
   13 rooms, but pickup-interaction modelling is deferred. Anything else
   that unlocks from an in-game event is either walked (trigger the event)
   or bot-granted automatically, decided per case and reported loudly. A
   later rung retires the grant crutch by collecting for real (walk-over +
   ceremony + the Witch dialogue). ⚠ This amends the session brief's
   "collected, not granted" line — the user's ruling is reach-the-room
   proximity grants *for now*, with real collection as its own rung; the
   "no blanket boot-time grants" spirit stands.

## 5. The ladder

Every rung: (a) regenerates the full-playthrough tape(s) from scratch (RNG
brittleness), (b) re-records oracles `--record --win --only=`, (c) keeps the
exact differential green on everything modelled, (d) updates the honest
"what still blocks us" list, which IS the progress metric.

- **R0 — the acceptance signal + the machinery rung. ✅ SHIPPED 2026-07-31**
  (as-built: kickoff §8–§13; 14 fixtures / 1550 ticks EXACT).
  The AS3 batch (one build); tape format v2 (`noDamage`, `noHazards`,
  `grants[]` — explicit, no defaults); the role-relaxed `buildLevelWorld`;
  the pickup/proximity-hazard classification; the item/win readout; a
  witness mini-walk (boot → sword room L10, grant observed, exact
  differential). Rung 0 exists because *a completion run without a terminal
  assertion is a demo, not a result* — the win/items readout is the
  acceptance signal every later rung asserts against. (The full win flags
  can only fire at the ladder's top; R0 proves the plumbing: readout fields
  present, false at boot, item flags flip on grant.)
- **R1 — the relaxed full walk, PITS LIVE. ✅ COMPLETE 2026-07-31**
  (kickoff `seedling-bot-r1-opus-kickoff.md`: §8 the recon, §9 the scope
  ruling, §11 the walk as built). **The claim: 10 item booleans true +
  `hitsMax == 4` — ELEVEN of the thirteen non-combat items — read from the
  game's own `botStatus` over a 79-leg, 47-level, 14,963-tick walk with four
  pit falls, recorded EXACT.** Blocked and published: `fire`, `ghostsword`,
  `firewand`, all three enemy-shaped, all three R5. Pits
  are NOT coerced: R1 tapes declare
  `noHazards: ["water","lava","ice","waterfall"]` and **pit transport is
  modelled exactly** — edge inside the state setter on a RAW change while
  `onGround`, 20 fall-out ticks of a one-tenth lerp toward the pit tile's
  centre, the deferred swap to the level's `control.fallthrough`, and a
  fall-from-ceiling descent that is always exactly 83 px and 41 ticks. Pit
  tiles are planner-forbidden floor except as a leg's named
  `exit: {pit: …}`. Two oracle recordings reconcile bit for bit.
  ⚠ **Two corrections to the design above, both from the recon:** the
  landing polarity is INVERTED (pit/water/lava LAND, an ordinary floor
  BOUNCES once for 39 ticks — you cannot bounce on a hole), and **L84 is a
  PASS-THROUGH**: the 83→84 arrival lands in the centre of a 3×3 block of
  pits, so the player never touches free floor there and the fall chains
  automatically. A level-graph router calls the cluster unreachable without
  that; routing had to become a `(level, component)` search.
  ✅ **The L79 lavatrap checkpoint PASSES** — 71→80→79 clears both r=33
  tongue discs comfortably.
  ⛔ **But R1's claim is 11 of 13, for reasons the checkpoint did not
  predict, and the user RULED minimum code changes + an honest blocked
  list rather than a fourth crutch.** `ghostsword` (L106) and `firewand`
  (L109) are blocked: L98's IceTurret has `attackRange = 128`, its disc
  covers the whole of Dungeon 8's only entrance room — arrival at 64 px,
  the sole door out at 80 px — and `IceTurretBlast` calls `Player.freeze`,
  which neither `noclip` nor `noDamage` reaches; and L108, past it, is a
  darksuit-gated LavaTrap FERRY over 153 lethal pit tiles (three traps
  spaced exactly `chompRange` apart that haul the player across and release
  instead of killing when `hasDarkSuit`). With `fire` that is three blocked
  items and **all three are ENEMY-shaped, so all three land at R5** —
  which is the plan for eventual completability the ruling asked for.
  `Bot.noEnemyEffects` was DECLINED on the record, with its price.
  ⚠ Two blockers that were NOT enemies got fixed instead: the priced
  volumes (ten classes, three of them an evidenced INERT) and **the Bridge
  timer** — `bridgeOpeningTimer` only ever decrements from a SPEAR hit
  (`Player.as:1098`), so on a bot boot a Bridge is permanently Solid, which
  unblocked levels 61 and 63 and with them ghostspear and health.
  Relaxed census 82 → **115 of 116**.
  ⚠ **Four more findings from the walk itself (slice 4), none predicted:**
  (a) routing had to become a `(level, component)` search for real — the
  scratch emitter's `NO PATH` was a spread overwriting the node id with the
  destination LEVEL; (b) **two arrivals cannot be stood on and must be
  DECLARED** (L3's own return trigger — the v2 latch witness, free — and
  L38's arrival `buttonroom`), with an undeclared or stale declaration a
  named failure; (c) **that buttonroom press changes PERSISTENCE**, arming
  L37's FallRock, which invalidates slice 3's "fallrock is inert" premise in
  one level and is priced as an `extraVolumes` entry from the causing leg
  onward; (d) a **second trigger standing on a pit tile** (L43's exit to
  L37, beside the known L100), refused by name, which re-routed the walk out
  of L43 by its stairs.
  ⛔ **And ONE AS3 line was required after all, ruled by the user:**
  `Inventory.update` raises a tutorial that holds `Game.freezeObjects` as
  soon as `items.length >= 2` or `canSwim || hasFeather` — frozen frames are
  dead frames, so no tape span can ever reach the release, and
  `Bot.autoAdvance` gates on `Game.talking`, which a `Help` never sets. R0
  never saw it because its fixture grants exactly one item. `Bot.botStart`
  now sets `Inventory.help = false`, gating both ceremonies at their source,
  exactly as the game's OWN debug warps do (`Player.as:1875` and four more).
  It suppresses a UI tutorial and nothing else, and R3 needs it too, so
  unlike `noEnemyEffects` it is not a crutch a later rung must retire.
- **R2 — solids come back** (noclip off). **RULED (user 2026-08-01) +
  kickoff ready: `seedling-bot-r2-opus-kickoff.md`.** v2's collision
  machinery re-armed everywhere the walk goes; cost = the blocking-role
  classification for the ~93 unclassified tags in walked levels +
  **pixelmask extraction** (MIT, committed artifacts + the transcribed
  Hitbox-vs-Pixelmask collide; the loud-throw seam retires CLASS BY CLASS —
  rect approximations stay banned per Phase 5a). Interactive blockers =
  **tape-driven persistence clears** (`tape_version: 3`,
  `persistence: [{level, tag, note}]`, ONE new AS3 change — `Bot.botStart`
  applies `Game.setPersistence`; ~53 tagged blockers on route despawn via
  their own `check()`; the clear list is derived + audited, FinalDoor/
  Moonrock tags untouchable). **Pushables (10 on route, NO tags) are routed
  around; a sealed corridor escalates to the user.** The R1 recordings
  FREEZE as milestone artifacts (never re-recorded, still replayed) and
  the verify sweep gains `--tier=fast|full`. Target claim: the same 11
  items; anything a solid seals that no crutch covers joins the blocked
  list with its rung named — losing an item to a named solid is the ladder
  working. ⚠ `lavaboss` is on a route level and IS in the player's solid
  list — slice 0 verdict required.

  **✅ COMPLETE 2026-08-01 — 8 items with the solids back, from the game's
  own `botStatus`, over a 55-leg / 31-level / 3-fall / 10,136-tick walk.**
  As-built: kickoff §8 (recon), §9 (rulings), §10 (slices 1–5a), §12 (the
  walk).

  - **The slice-0 verdict, at one-pixel resolution with an R1 positive
    control:** with solids armed and the ruled crutches, **6 of the 11
    items survive**, and each of the five seals is ONE named entity — L71
    `lock@112,160`, L48 `karlore@112,272`, L38 `cover@144,112` (then L39's
    wandlocks), L63's bridge at (2,9) (then L65 `rock@192,96`). `lavaboss`
    seals nothing: L82 is the terminal leg and the boss sits 230 px from
    the arrival.
  - **User rulings 2026-07-31:** Activators modelled (game mechanics, not
    a crutch) → **+darkshield +darksuit**; `fire` stays blocked so R1's and
    R2's blocked lists keep meaning the same thing → conch stays sealed;
    pushing deferred to R3 (it buys nothing alone — both wand and health
    are item-USE gated behind theirs). **Target claim: 8 items,
    `hitsMax == 3`.**
  - **Shipped:** the 17 committed pixelmasks + the two-half collide
    transcription + the cliffside frame index; the 69-tag blocking census
    (full census 11 → 82 levels, and the table now checks itself against
    `PLAYER_SOLID_TYPES`); the Activators state machine (lock opens on 101,
    cover on 11 — the clamped-alpha knife-edge); tape v3 + the ONE AS3
    change; **the byte-inertness gate PASSED** (23 fixtures byte-identical,
    R1's headline claim intact); `--tier=fast|full`; and the
    `l71-button-lock` / `l71-lock-shut` oracle pair, where the game agreed
    with the model to the float (116.44999999999997 vs a predicted 116.45).
  - **The walk (slice 6), and the claim it delivered:** `noclip` became a
    DECLARED field of `relax` rather than a derived one; the leg vocabulary
    gained a **HOLD** (`{x, y, hold: {ticks, presser}}`) which the executor
    verifies tick by tick from the run's own state and then by EFFECT, with
    a positive control — the group must be SHUT when it starts. The route
    was re-planned over post-clear geometry with derived HOLD EDGES, six
    segments recorded (split at legs 12/14/25/37/45) summing to exactly the
    headline, and the readout asserts the claim from the game's reports
    with all 25 mutations red in CI. **8 items + `hitsMax == 3`**, the
    latter proved by a NEGATIVE and checked on its own.
  - ⚠ **The game answered the 101-tick fade directly.**
    `l71-hold-101-shut` and `l71-hold-102-open` differ in exactly one field
    — `tick_count` — and the game reports **178.5** against **177.1**.
  - ⛔ **Two forced constructor values the `.oel` cannot reach, both wrong
    twice over, both already cited in the file that got them wrong:**
    `ShieldLock` forces `tSet = -2` (so a shieldlock joined group 0 AND
    stopped despawning on its own clear), and `MoonrockPile` forces
    `tag = 0` (so the model built a 32×16 Solid the game removes on a fresh
    boot — on level 2's arrival tile, the third level of the walk).
  - ⛔ **THE RUNTIME HAS A TAPE BUDGET, and the axis is INPUT SPANS.** R2's
    first answer to the controller's overshoot cost 30% more ticks and 4.7×
    the spans, and the game then could not load the headline at all
    (`heap_alloc(72671) failed`, 2,569 spans, 185 KB, failing at boot,
    twice). `allowGrazes` — a blocked sweep is a defect only if the drive
    then fails to ARRIVE — gives the same walk in 853 spans and 63 KB.
  - **Three planner knobs, each named by a failure**, each defaulting to
    R1's behaviour so the 23 frozen recordings stay byte-identical:
    `lattice: 8` (a 16 px torch half a tile off in a 2-tile corridor clipped
    all four tile centres and reported the SPEAR unreachable),
    `nodeMargin: 2` on a descending ladder, `triggerMargin: 4` which does
    not descend.
  - ⚠ **`darksword` is collected and `wand` is not, which the GAME would
    not allow** — the Witch grants it under `hasWand && !hasDarkSword`. The
    grant crutch is a property write on room entry and does not consult
    her. First place on the ladder where a grant asserts something the
    game's own logic would refuse; R3 retires it for exactly this class.
  - ⚠ **Corrections to this entry's own brief, found at slice 0:**
    `Lock.check()` needs `tSet < 0` and `int("")` is 0, so three route
    locks and 13 of 14 wandlocks do NOT despawn; a rope SHRINKS rather than
    despawning (and its span lives in a `<node>` the extract was dropping);
    `chest` IS clearable and was missing from the list; the statues are
    plain hitboxes, not pixelmasks. The route bill is **69** tags, not ~93.
- **R3 — interactions + real collection. ✅ CLOSED 2026-08-01.** The claim,
  from the game's own `botStatus` over a **53-leg / 32-level / 12,122-tick**
  walk: **SIX items REAL-COLLECTED with `hitsMax == 3`** — sword, feather,
  torch, spear, darkshield, darksuit — with **`grants` EMPTY** and the
  persistence flags that are OFF equal to *exactly* the ten declared
  exceptions + the one `L71 shieldlock@288,256` earned by being TOUCHED +
  the six the pickups' own `removed()` wrote. Six segments partition the
  headline tick for tick (641 + 1473 + 1964 + 3707 + 2162 + 2175 = 12,122).
  ⚠ **The target shrank twice and both are findings**: slice 0 found
  `conch`/`wand`/`darksword` are not R3-shaped at SOURCE (and `darksword`
  leaves R2's claim, which only had it by way of a grant the game's own
  logic refuses); slice 5's narrowing — "reached" is the PICKUP'S OWN TILE,
  not a component of the level — took `shield` as well, because L20's is
  behind a lock whose only presser is walled in behind a lock that needs
  the shield, and the other entrance is the Dungeon 2 boss room. ⚠ **The
  clear bill is TEN, not the recon's eight**: the narrowing put `L30 tag 0`
  back, the driver's own A* put `L3 tag 0` back, and the CONTROLLER's
  overshoot put `L11 tag 0` back. A reachability graph and a walk are
  different questions. Full as-built in the kickoff and
  `docs/json/developer/procgen/seedling-bot.md` §R3.
- **R3, as briefed (superseded by the line above):** ONE kickoff, ordered
  slices (not the R3a/b/c split); raw tapes + CHUNKED `botLoadTape` (span
  ceiling measured first; the directive-tape transition is its own arc
  between R4 and R5); **target 11 items REAL-collected and REAL-opened**
  (`hitsMax == 4` returns as a positive) with named exceptions only where
  the opener is enemy-shaped. Slice order: ceremony collection
  (`Bot.autoAdvance`'s FIRST live fire — probe against the existing build
  BEFORE the batch) → talk seals (karlore; the Witch needs `hasWand` HELD,
  so wand-before-witch is a real ordering constraint again) → slash/spear
  + breakables + the bridge → touch-locks (ShieldLock's position-snap
  input-window ceremony) + pushing → wand-shot activators (projectile
  model, most novel, last). ⚠ Taxonomy correction from recon: `WandLock`
  is only a SKIN over base `Lock` — base locks open via activators
  (`tSet >= 0`, buttons; wand-buttons are pressed by wand PROJECTILES) or
  via `totalEnemies() == 0` (`tSet == -1`) — **kill-enemy locks are
  R5-shaped and stay cleared as named exceptions**. Swings/shots only in
  enemy-free rooms (a hit consumes RNG, spawns attracting coins, and
  decrements `totalEnemies()` — silently opening kill-locks); every
  opened-blocker claim is a PAIR (the l71 pattern).
- **R4 — the remaining hazards come back. ✅ COMPLETE 2026-08-02**
  (kickoff `seedling-bot-r4-opus-kickoff.md`; as-built:
  `docs/json/developer/procgen/seedling-bot.md` §"R4: the hazards come
  back"). **The claim: FIVE items real-collected — four booleans plus
  `hitsMax == 4` asserted as a POSITIVE — over a 41-leg, 25-level,
  10,052-tick walk, with `grants` EMPTY, `saw_auto_advance == 1`, and the
  persistence flags that are off equal to exactly eight declared + TWO
  EARNED + the five the pickups wrote.** `noHazards` is
  `["water", "waterfall"]`: **lava and ice are LIVE.**
  The plan above said "per hazard, cheapest first"; what shipped is lava and
  ice together, because ice costs nothing at all — floor policy included —
  and the two coercions that remain turned out to be ONE CHAIN rather than
  two steps (below).
  ⚠ **THE HEADLINE IS `health`, and it overturns §8.5's permanent seal.**
  Three rungs called L68 sealed on one sentence — *"but a push is not a
  removal"* — and a push onto a PIT is a removal
  (`PushableBlockFire.input()`). `recon-seedling-pushes.mjs` swept MULTI-push
  states at pitch 8, 4 and 2 and found three levels breach; the game
  confirmed the L65 chain to the pixel over 440 ticks
  (`probe-seedling-l65-breach.mjs`, a pair one field apart). The route
  realizes all three: L67 one push → the keyType-4 boss key, L63 one push →
  the L65 door, L65 three pushes (including **UP at reach 2** and **reach 2
  through a solid**, neither ever exercised before) → health's own room.
  ⛔ **Two of this plan's own rulings were overturned BY THE ROUTE**, both
  made from true premises:
  (a) **`noHazards: ["water"]` is not an R4 state either.** A waterfall
  cannot DROWN you and the R3 walk really stands on one — and neither says it
  can be CLIMBED. `Player.input()` adds `v.y += 0.8` unless
  `hasFeather && v.y < 0`, and the shipped physics says a featherless player
  holding UP on level 0's band for 400 ticks reaches y = 125.98 and stalls,
  fourteen pixels short. That band is the ONLY connection between the half
  the game boots in and the half everything else is behind: delete its doors
  and the reachable map is 12 nodes and one item. So waterfall needs the
  feather and the feather is behind the waterfall — the same circular shape
  water has, one item along.
  (b) **The claim is FIVE items, not six: `darkshield` LEFT.** Armed lava
  leaves two TERMINAL branches and a walk can only end in one. L74 sits
  inside `{71:0, 72, 73, 74, 75, 80}`, entered only through L71's button lock
  (walkable northward alone), and armed lava closes both of R3's exits —
  swept over every single clear the map offers for those eleven levels, one
  at a time and all at once. L68 is terminal for its own reason: the return
  into L63 arrives on the far side of a block the level rebuilt. The rung
  takes the one it is FOR.
  ✅ New mechanics: the **BossLock** — a THIRD way a responder opens (a
  save-file key and a one-pixel `collideLine` row; opens on tick **80**, and
  `activate` latches BY ABSENCE); the **`keylock`** and **`equip`** leg
  verbs; **`climbsArmedWaterfall`**, the ladder's only DIRECTED edge rule;
  and the census's THIRD volume shape, a `line` of integer probes — a rect
  enclosing them moved R3's committed L12 route.
  ⚠ Two EARNED clears, not one, and the second is not an errand:
  `lightpole@176,120` is toggled by the third L65 push, which no stance in
  that row can avoid. Its ledger entry derives from the pole's FINAL STATE,
  never from a count of hits.
  ⚠ **The byte budget, MEASURED at synthesis: 1,130 spans / 79.1 KB against
  1,800 / 90 KB.** §11.4 priced the rung at ~95 KB; the route is shorter than
  the one that was priced. No span diet, no chunk-parse AS3 batch, no
  claim-shape change.
  ⚠ **The BRIDGE mechanic ships with unit witnesses and no live one.** The
  R4 route does not need L63's bridge — the push opens the door directly and
  there is no return trip — so `bridges.js` and the `spear: {bridge}` verb
  are pinned against `probe-seedling-bridge.mjs`'s measured numbers and by no
  recording. Said here rather than left to be discovered.
  ⚠ **The two remaining coercions are ONE CHAIN**: BobBoss → fire → the
  conch → `canSwim` → water; and the feather (behind the waterfall) is what
  waterfall needs. One combat encounter retires three items and one
  coercion. Sound stays last, as ruled.
- **R5 — enemies come back** (noDamage off). Avoid where possible (their
  paths are LFSR-deterministic per boot), kill where required; **fire** from
  BobBoss joins the item set → 14/14.
- **R6 — bosses + the ending.** The 7 `boss_locations`, FinalBoss,
  hand-authored fight tapes, the Seed, and the terminal win assertion firing
  for real. Zero crutches left = the real-game beatability proof.

## 6. Verification doctrine per rung

- **The exact differential is the norm, and rung 1 satisfies it fully.**
  With sweeps off and hazards coerced, the JS side needs no colliders — only
  tile typing, triggers, pickups, and the grant/flag mirrors. Rung 1 is NOT
  a reconnaissance artifact and must not be described as one.
- **The exactness boundary is named, never implied.** If a later rung meets
  a segment that genuinely cannot be exactly modelled (the known candidate:
  swim speed couples to `Music.soundPosition("Swim")`), that segment becomes
  a NAMED witnessed-not-exact span (arrival asserted from the game's own
  observations), listed the way the five bounded vacuities are listed. ⚠
  Recon flag first: if the recompiled runtime stubs sound position to a
  constant, swim is exactly modellable and the boundary never opens.
- **Quantitative pins everywhere** (observation + transition counts, item
  readout), because every positional assertion is satisfiable by a bot that
  teleports.
- **The synthesized-fixture property carries:** "the driver still emits this
  tape" converts geometry/model errors into reds even along routes that
  avoid the defect.
- **Bounded-vacuity discipline carries:** every rung records what its
  fixtures cannot see, with concrete witnesses, rather than letting a green
  mutation table imply coverage.

## 7. The role-relaxed builder (engineering ruling, this session)

`buildLevelWorld`'s all-or-nothing census is the wrong shape for a walk that
does not consult colliders. **Relax by ROLE**: `ENTITY_CLASSES` entries gain a
role — `blocking` / `trigger` / `pickup` / `proximity-hazard` (freezes,
teleports, or consumes gameplay RNG on approach: chests, auto-talk NPCs,
Watchers…) / `ignorable` — and the builder takes the set of roles the caller
consults, throwing only on tags unclassified FOR A CONSULTED ROLE.
"Ignorable" is an explicit classification with the `Game.as` construction
site cited, never a default. Census guards stay WIDER than fixture levels
where the property defines a graph the walk trusts: triggers (exists),
pickups and proximity-hazards (new — a missed freeze-source is not a loud
throw, it is a mid-walk deadlock or a shifted RNG stream). The honest cost of
R1 is therefore a **proximity-behavior pass over the ~115 tags** — far
cheaper per tag than collision semantics, and it is the census that makes
"the walk avoids every side-effect volume" a checked claim instead of hope.

## 8. Open recon flags (for the R0/R1 kickoffs, none blocking design)

- Does the recompiled runtime stub `Music.soundPosition`? (Decides the swim
  exactness boundary. **DEFERRED to the water step of R4 — user 2026-07-31:
  sound is last**; no earlier rung should spend time on it.)
- Which level holds `bobboss1/2/3`; endgame plumbing details (Watcher/Seed
  spawn chain, whether FinalBoss needs cutscene state to spawn).
- Which NPCs have `keyNeeded == false` (auto-talk on proximity); Watcher
  proximity behavior.
- The grants contract detail: property writes only (recommended — pickups
  stay in the world and join the avoid-volumes) vs also clearing persistence
  tags (despawns the pickup). R0 decides with the source in hand.
- Full-map reachability survey over triggers + grants (which of the ~100
  reachable levels the item walk actually crosses; the rest stay unvisited
  and say so).

## 9. Relationship to the old plan

`region-atlas-plan.md` §Phase 8's v3/v4/v5 checklist is restructured to this
ladder (edit made alongside this doc). The class-table sizing in the v2
kickoff §13 still prices R2's blocking pass; the "gated on entity semantics"
conclusion survives but now applies to R2+, not to the next rung — R0/R1
escape it by role relaxation. The five bounded vacuities' witnesses become
reachable at R1 (grant + param-boot + role-built levels) instead of waiting
for v3.
