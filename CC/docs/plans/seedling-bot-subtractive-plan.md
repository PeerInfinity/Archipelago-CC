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
  **fire** — dropped by BobBoss (`bobboss1/2/3` tags; level = one-line extract
  query) — the ONLY combat-gated item.
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
  Watchers (12 in the extract) need the same check. A relaxed walk must
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

- **R0 — the acceptance signal + the machinery rung** (kickoff written).
  The AS3 batch (one build); tape format v2 (`noDamage`, `noHazards`,
  `grants[]` — explicit, no defaults); the role-relaxed `buildLevelWorld`;
  the pickup/proximity-hazard classification; the item/win readout; a
  witness mini-walk (boot → sword room L10, grant observed, exact
  differential). Rung 0 exists because *a completion run without a terminal
  assertion is a demo, not a result* — the win/items readout is the
  acceptance signal every later rung asserts against. (The full win flags
  can only fire at the ladder's top; R0 proves the plumbing: readout fields
  present, false at boot, item flags flip on grant.)
- **R1 — the relaxed full walk.** One driver-planned task covering all 13
  non-combat items (wand before the Witch's room for darksword), crossing
  the level graph on real triggers, avoiding proximity-side-effect volumes.
  Terminal assertion: 13 item properties true, read from the game's own
  readout, plus pinned tick/transition counts. Exactly differentially
  verified end-to-end. Likely side profit: the walk crosses enough of the
  map to convert several of v2's five bounded vacuities into oracle-backed
  fixtures (level-83 stickiness hole, an arrival-on-trigger latch pair) —
  take them opportunistically, they are listed witnesses.
- **R2 — solids come back** (noclip off). v2's collision machinery re-armed
  everywhere the walk goes; cost = a blocking-role classification for tags
  in walked levels + **pixelmask extraction** (MIT; the loud-throw seam
  becomes real masks — the walk will cross buildings/cliffsides, so the
  bounding-rect throw stops being an option). Interactive blockers (locks,
  breakable rocks, ropes) are not yet modelled as interactions: they are
  neutralized by targeted persistence grants at the door (the grant crutch
  widens; each one is named in the blocked-list).
- **R3 — interactions + real collection.** Item USE lands (X-press swings,
  `genericHit`, persistence flips): breakable rocks/ropes (Sword OR Spear),
  then locks (keys/shield/wand/magical). Real walk-over collection retires
  the item grants (ceremony dead-frames + auto-advance + the Witch
  dialogue); the persistence grants from R2 retire class by class. May
  split into R3a (collection) / R3b (destructibles) / R3c (locks) —
  cheapest-first within the rung.
- **R4 — hazards come back** (noHazards off), per hazard, cheapest first:
  pits (deterministic transport — a transition-like event), then lava
  (darksuit), ice (friction rewrite), and **water/swim LAST** (user ruling
  2026-07-31: leave sound for last — the sound-stub recon and any
  sound-coupled modelling wait until water is the rung being armed). An
  item whose only real route needs a hazard not yet re-armed stays
  reported until its rung.
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
