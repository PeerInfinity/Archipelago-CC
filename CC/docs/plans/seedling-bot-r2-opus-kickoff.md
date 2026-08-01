# Region atlas Phase 8 — subtractive ladder, Rung 2 (Opus kickoff): solids return

**Date:** 2026-08-01 (Fable design session; three user rulings below).
**Parents:** `CC/docs/plans/seedling-bot-subtractive-plan.md` (the ladder),
`CC/docs/plans/seedling-bot-r1-opus-kickoff.md` §8+ (the R1 as-built — the
route, the contacts/extraVolumes machinery, the rect lesson),
`CC/docs/plans/seedling-bot-r0-opus-kickoff.md` §8–§13 (the census, the
grants/readout/noHazards seams). Doc: `docs/json/developer/procgen/seedling-bot.md`.
Memory: `project_seedling_bot_r1.md` + the arc topic.

## 0. Mission in one paragraph

Turn `noclip` OFF and re-plan the full item walk over the game's REAL
geometry — walls, solid entities, pixelmasks — everywhere the walk goes.
Interactive blockers the bot cannot yet operate (locks, breakable rocks,
ropes, burnable trees) are despawned by TAPE-DRIVEN PERSISTENCE CLEARS (the
grant crutch widening as designed, every clear named and audited); pushable
blocks are routed around. Target claim: the same 11 items, from `botStatus`,
over a re-planned walk that is exactly differentially verified; anything a
solid seals that no crutch covers joins the blocked list with its rung
named. The R1 recordings freeze as milestone artifacts and the verify sweep
gains tiers.

## 1. Settled rulings — do NOT re-litigate

1. **(user 2026-08-01) Interactive blockers = tape-driven persistence
   clears, ONE new AS3 change** — `Bot.as` parses a `persistence` tape
   field and applies `Game.setPersistence(tag, false, level)` at start;
   tagged blockers then despawn from their own `check()` in both the game
   and the JS model. ~53 tagged blockers sit on the R1 route (locks ×36
   across five classes, breakablerock ×11, burnabletree ×5, rope ×1 — all
   verified despawn-on-cleared-persistence at source). R3 retires clears
   class by class as real item-use lands.
2. **(user 2026-08-01) Pushables: route around; escalate if sealed.** The
   10 pushable blocks on route (levels 22, 38, 39, 40, 63, 65) carry NO
   tags — they cannot be cleared. They are avoid-volumes. Slice 0 checks
   whether any mandatory corridor is sealed by one; a sealed corridor is a
   FINDING FOR THE USER (model pushing vs the item joins the blocked
   list), not a decision to make inline.
3. **(user 2026-08-01) Freeze R1 + tier the sweep.** The R1 headline and
   segment recordings are never re-recorded — they prove R1's claim
   permanently and stay in the FULL tier as replays. The verify script
   gains tiers: `--tier=fast` (small fixtures, minutes — the iteration
   loop) and full (chains + headlines — gate runs, ~an hour). R2 records
   its own headline.
4. Carried, unchanged: `noDamage` + the 4-name `noHazards` set + item
   grants stay ON (each is a later rung); pits stay live and modelled;
   sound is LAST; cheapest-machinery-first; the game is the only oracle;
   tapes are whole regenerated artifacts.
5. **The AS3 batch is ONE build.** Known content: the `persistence` field.
   If slice 0 finds a second need, it rides the SAME build, decided before
   compiling — never after (R0 §5 discipline; it caught the noHazards SET
   reshape in time and the value-vs-presence bug late).

## 2. Priced inputs (verified this session — spot-check, don't re-derive)

- **The census gap:** 106 distinct entity tags across the 47 route levels.
  Triggers/pickups/proximity-hazards/flags are already classified (R0);
  enemy-typed classes don't block the player (type `"Enemy"` is not in
  `Mobile.solids` — Phase 5a's oracle). What remains is roughly **50–60
  tags needing a `blocking` entry** (hitbox + offsets, each with its
  `Game.as` construction-site citation) **plus the pixelmask classes**.
- **Pixelmasks on route:** building1/2/4/5/6, opentree, snowhill,
  statue1/statue2, shieldstatue (verify which are Pixelmask vs rect at
  source), and `cliffsides` layers in route levels **12, 37, 83, 87, 89,
  95** (5 mask variants, `CliffSide.as:15-34`). Phase 5a proved both rect
  approximations unsafe for buildings, so R2 EXTRACTS the real masks.
- ⚠ **`lavaboss` is on a route level and IS in the player's solid list**
  (`Player.as:359`, pushed unconditionally). If it stands in the Dungeon 7
  corridor, whatever lies behind it is enemy-shaped blocking — check in
  slice 0, report, don't improvise.
- **Evidence is state-conditional** (the R1 L38/FallRock lesson): every
  `evidenced-inert` census entry was evidenced at R1's route + persistence
  state. The new route AND the new clears change both. Slice 0 re-verifies
  each inert entry against R2's route + cleared-persistence state instead
  of inheriting it.

## 3. Design, concretely

### 3.1 The blocking census pass

`ENTITY_CLASSES` grows `blocking` entries for the ~50–60 tags, chunked by
level group, each with hitbox args + the full ctor offset chain cited.
The transcription lessons all apply and all have bitten: a tag missing
while its twin is present (`stairsup`); an offset applied at one level of
a ctor chain but not the next (`Statue`/NPC); `setHitbox` from `render()`
not the ctor (`Statue`); hitbox from the sprite's frame size (NPCs);
truncated int origins (`Rekcahdam`); a column/index read against the
wrong table (three instances now). The census guard stays scoped: blocking
entries required for ROUTE levels, loud throw elsewhere.

### 3.2 Pixelmask extraction and the seam's retirement

A build-time script over the MIT assets in `~/CC/seedling` renders each
mask class's PNG(s) to 1-bpp bitmasks + offsets, committed (the extract
precedent — decision 7's gitignore constraint is RWK-only). Transcribe
FlashPunk's Hitbox-vs-Pixelmask collide (the per-pixel test over the
overlap region) into `levelWorld`. **The loud-throw seam retires CLASS BY
CLASS:** only a class with a committed mask stops throwing; everything
else still throws by name. Unit strata from hand-read mask rows; oracle
strata from wall-press fixtures against a building doorway and a cliffside
(the `statue-press` precedent — a press is the strongest mask claim, and
the doorway is precisely the geometry rect approximations get wrong).

### 3.3 The `persistence` tape field (the AS3 batch)

- Tape: `tape_version: 3`; `persistence: [{level, tag, note}]` — clears
  only, applied by `Bot.botStart` before the first live tick; `note` names
  the blocker class it despawns (audit surface, ignored by the game).
  Unknown/duplicate/negative-tag entries throw at parse. v1/v2 fixtures
  stay untouched and byte-identical (the R0 value-vs-presence lesson: the
  version check is on VALUE, both sides, and the AS3 mirrors `parseTape`'s
  normalisation exactly).
- JS: `levelWorld` takes the cleared set and omits exactly the entities
  whose class despawns via `check()` on cleared persistence — the SAME
  despawn rule, not a general "remove by tag" (a class that reads
  persistence differently must not be silently swept).
- ⚠ **Persistence is an endgame-load-bearing namespace** (R0 §8.9:
  `FinalDoor` reads L114 tag 0; `Moonrock` writes cross-level). The clear
  list is DERIVED from the route's named blockers and audited entry by
  entry; a clear for a (level, tag) no route blocker owns is a parse-time
  throw. Never clear wholesale.
- Byte-inertness gate on the new build: all 23 existing fixtures replay
  byte-identical with the field absent BEFORE anything new is recorded
  (R0 §11's two-run lesson; `FRESH=1` even for ABC-only changes).

### 3.4 Planning over real geometry

The v2 collision machinery re-arms: A\* over walkable tiles with
`plannerBlockerAt` (which now consults blocking entries + masks +
persistence state), the 45°-then-axis controller, the executor's throws.
Expect corridor-width work the R1 planner never met — waypoint
densification in 16-px passages is legitimate driver improvement;
re-planning around a THROW is still forbidden (refuse, never recover).
The component graph is rebuilt per persistence state: a cleared lock
merges components, so `(level, component)` ids must come from the
POST-clear geometry, and ends-meet assertions carry that state.

### 3.5 Route, claim, and the blocked list

Re-plan the same item order where geometry allows (sword → shield →
feather → conch → wand → darksword → torch → spear → health → darkshield →
darksuit, out via 71⇓82). Target: the same 11 items + `hitsMax == 4`,
`fire`/`ghostsword`/`firewand` still the published negatives. Slice 0's
feasibility pass walks the route level by level with solids armed +
clears applied and names every seal: pushable-sealed (ruling 2 →
escalate), lavaboss-sealed (enemy-shaped → report), geometry-sealed with
no crutch (report). **The claim is whatever survives, published exactly —
losing an item to a named solid is the ladder working, not failing.**

### 3.6 Tiers and the frozen milestone

`verify-seedling-bot-differential.mjs` gains `--tier=fast|full` (fast =
the pre-walk fixture roster, minutes; full = everything including the R1
chain and both headlines). The R1 recordings are FROZEN: never
re-recorded, still replayed in full-tier sweeps (they remain valid — the
new build must be byte-inert for tapes without the new field, which the
gate proves). R2's own segments split at arrival-tick boundaries chosen so
a re-route touches the fewest recordings (the R1 lesson: the L37 re-route
cost only 2 tapes because the roster was split well).

## 4. Slices (commit each separately; JS-first where the stage allows)

0. **Recon + feasibility** (no code): the exact blocking-gap tag list with
   citations; pixelmask class inventory (which are truly Pixelmask at
   source vs plain hitboxes);
   the per-level corridor feasibility pass (solids + clears) naming every
   seal — pushable seals and lavaboss verdicts INCLUDED; the clear-list
   derivation (blocker → level/tag table); re-verify evidenced-inert
   entries against the new state; finalize the batch content. Findings
   appended here. **Escalations (sealed corridors) go to the user NOW,
   not mid-implementation.**
1. **Masks**: extraction script + committed artifacts + the collide
   transcription + unit strata. Then record the mask-press oracles
   (doorway, cliffside) and reconcile EXACT.
2. **Blocking entries**, chunked with tests; the census guard widened to
   route levels.
3. **The AS3 batch** (one build): the `persistence` field; byte-inert gate
   over all 23 fixtures BEFORE any new recording.
4. **Collision fixtures**: small oracle recordings exercising the new
   geometry (a lock despawned by a clear; a press against a building
   doorway; a corridor thread) — record first, reconcile exact.
5. **The walk**: re-plan, segments + headline, `--tier` wiring, the
   acceptance leg updated (same readout claim + the clears audited in
   `botStatus` if the readout carries them, else asserted by effect).
6. **Docs + close-out**: the doc's R2 section, kickoff as-builts, plan-doc
   checkbox with the real claim, queue §5c, memory topics, backup verified
   at the far end.

## 5. Discipline + traps (standing ones apply; live ones here)

- The batch is ONE build; slice-0 finalizes its content BEFORE compiling.
  `FRESH=1` always (ABC-only changes are enough to need it).
- Byte-inertness before new recordings — non-negotiable, twice proven.
- `assertRect` everywhere a rect literal is born; a negative assertion
  needs a positive control beside it (the R1 rect lesson).
- Masks: never approximate with rects (Phase 5a); the throw retires only
  class by class; a mask artifact regen must be `--check`-gated like every
  other committed artifact.
- Persistence clears: derived, audited, never wholesale; FinalDoor/
  Moonrock tags are untouchable.
- Sweep budget: ~55 min full; use `--tier=fast` for iteration and batch
  recordings deliberately; the watch page's `side=js` overlays are the
  corridor-debugging surface.
- An index against the wrong table has bitten three times — resolve
  through the committed tables, always.
- Never `git add -A` with a recording running; stage+commit atomically.

## 6. Open questions (ask the user only if blocking)

- Sealed-corridor escalations from slice 0 (pushables, lavaboss, or
  uncrutched geometry) — bring the geometry and the options.
- Anything slice 0 wants to add to the AS3 batch.

## 7. Acceptance gates

- **G1 (CI, vitest):** all suites green; every frozen fixture
  byte-identical; new strata for masks/blocking/persistence/planner;
  mutations that must bite: a mask row flipped, a blocking hitbox offset
  dropped, a clear not applied JS-side, a clear applied to the wrong
  level, component ids computed pre-clear, ends-meet with a segment
  deleted. Record any that do not bite as bounded vacuities with
  witnesses.
- **G2 (local, `--win --tier=full`):** every frozen fixture replays EXACT
  against the new build (the byte-inertness gate); the mask-press and
  collision fixtures exact; the R2 segment chain a PARTITION of its
  headline; the acceptance readout asserting the surviving claim from the
  game's own reports, blocked list published.

## 8. Slice 0 — RECON, AS BUILT (2026-07-31)

No committed code. Everything below is source-verified against `~/CC/seedling`
branch `bot` at **`f95ff64`** (the commit the deployed wasm was built from),
the committed extract `flashPanel/atlases/seedling-map.json`, and — for the
mask semantics — **the SWFRecomp runtime that actually executes them**
(`~/CC/SWFRecomp-CC/SWFModernRuntime/src/avm2/avm2_bitmap.c`). Where §1–§7
was imprecise it is corrected here; §1–§7 is the brief, this section is the
record.

### 8.1 The instrument, and its positive control

Feasibility is answered at **one-pixel granularity**, not at tile centres.
`Mobile.moveX/moveY` step ONE PIXEL at a time and re-test `collideTypes`
after each, so the set a player can occupy is a 4-connected blob over
INTEGER positions. A tile-centre lattice — which is what the R1 planner
uses to author a route — over-blocks wherever a collider is smaller than a
cell (an 8×8 SpinningAxe, a 10×12 Hermit), and the first cut of this recon
reported seven seals that do not exist because of it.

The instrument is a scratch harness (not committed; slice 2 re-derives every
row of its table into `ENTITY_CLASSES` with citations and tests) that paints
a blocked-position bitmap per level, floods it, and builds the
`(level, blob)` graph over teleporters and pit edges.

**Its positive control is R1.** Run with `noclip` on and the same avoid
volumes, it must reproduce R1's published reachability — and it does:
all eleven R1 items REACHED, `ghostsword` and `firewand` BLOCKED (L98's
IceTurret disc covering its whole entrance room, R1 §8.6), `fire`'s room
reachable but combat-gated. A feasibility instrument that has never
reproduced a known answer is not evidence about an unknown one.

⚠ **Two bugs in the instrument, both of the shape this arc keeps finding:**

1. **`base.solids` already carries the classified ENTITY solids**, so
   painting it *and* the recon table double-counted — and the base copy is
   blind to the clears, which is how a cleared `breakablerock` went on
   sealing L3.
2. **Excluding `objectSolids` to fix (1) silently deleted every BRIDGE.** A
   type-29 tile is an `objectSolid` with **no entity behind it**
   (`levelWorld` sorts it there because a Bridge rewrites its own `type`),
   so a filter written as "skip the object solids" removes a thing no
   entity is responsible for. Three bridges are on the route — **L61
   (10,13) and (11,13), and L63 (2,9)** — and L63's is in the corridor to
   the health room. The fix keys on `cls !== null`. Same family as the rect
   literal: a filter that is right about the case you were thinking of.

### 8.2 ⛔ THE HEADLINE: with solids armed and the ruled crutches, 6 of 11 items survive

| item | room | verdict |
|---|---|---|
| sword | L10 | ✅ reached |
| shield | L20 | ✅ reached |
| feather | L89 | ✅ reached |
| darksword | L12 | ✅ reached |
| torch | L30 | ✅ reached |
| spear | L64 | ✅ reached |
| **conch** | L49 | ⛔ sealed in **L48** |
| **wand** | L43 | ⛔ sealed in **L38**, then again in **L39** |
| **health** | L68 | ⛔ sealed in **L63**, then again in **L65** |
| **darkshield** | L74 | ⛔ sealed in **L71** |
| **darksuit** | L79 | ⛔ sealed in **L71** |

Persistence clears are load-bearing and then some: without them the same
run reaches **38 of 116 levels and 3 items**; with them, **66 levels and 6**.

### 8.3 Every seal, named — each is ONE entity

The instrument answers the actionable form of the question directly: remove
one entity at a time and re-test the corridor. Each row is the complete set
of single removals that open it.

| level | the seal | what it costs | what would open it |
|---|---|---|---|
| **L38** | `cover@144,112` (`tset 0`) plugging the only link between the level's two halves (row 7 is solid but for column 9) | wand | hold `button@80,192` (`tset 0`) — which is across the room, so it needs `pushableblockfire@80,208` **pushed one tile up onto it** |
| **L39** | *no single entity* — the Dungeon-4 puzzle room: three `wandlock`s stacked in the 1-wide exit shaft (`tset 3/4/5`), three covers, six buttons, two pushable blocks | wand (again) | wand shots (item use) or a three-button hold |
| **L48** | `karlore@112,272`, an NPC standing in a 1-tile corridor — **whose own dialogue says so** ("Turn and come back in due time") | conch | `Karlore.added()` removes itself **iff `Player.hasFire`**. `tag = -1`, so no persistence clear can touch it |
| **L63** | the **bridge at (2,9)**; *no single entity* opens the west door | health | spearing the bridge (`Player.as:1098`, `genericHit` under `t == "Spear"`) |
| **L65** | `rock@192,96` **or** `pushableblockspear@176,128` — either alone opens it | health (again) | a plain `Rock` (no tag, not breakable) or a spear-thrown pushable |
| **L71** | `lock@112,160` (`tset 0`, `tag 3`) | darkshield **and** darksuit | hold `button@112,176` — **directly below it** |

Priced end to end, the options compose:

| configuration | items |
|---|---|
| A — ruled crutches only | **6** |
| B — A + `fire` granted (tape only, existing mechanism) | **7** (+conch) |
| C — A + L71's lock opened | **8** (+darkshield, +darksuit) |
| B + C | **9** (wand and health remain) |

### 8.4 ⚠ FOUR CORRECTIONS TO §1–§2, all of them load-bearing

**(a) `Lock.check()` has a THIRD condition the ruling's census missed.**
`Puzzlements/Lock.as:42` is
`if (tag >= 0 && tSet < 0 && !Game.checkPersistence(tag)) FP.world.remove(this)`.
A lock wired to a button group (`tSet >= 0`) does **not** despawn on a
cleared persistence — and `o.@tset` on a missing attribute is `int("") = 0`,
so the default is 0, *not* −1. Of the locks on route, **L20's `lock` (tset 0),
L71's `lock@112,160` (tset 0), L82's (tset 1) and 13 of the 14 `wandlock`s
do NOT despawn.** §1.1's "locks ×36 across five classes — all verified
despawn-on-cleared-persistence at source" is wrong for exactly these.
`ShieldLock` passes `-2` and so is safe (`ShieldLock.as:26`); `BossLock`,
`MagicalLock` and `RockLock` extend `Activators` directly and have no `tSet`
condition at all.

**(b) `rope` does not despawn — it SHRINKS.** `RopeStart.check()` calls
`hit()`, not `remove()`, and `hit()` runs `setHitbox(16, 16, 8, 8)` — so a
cleared rope turns from a horizontal span into a single 16×16 solid at its
start. Its span comes from `_xend`, read from the object's `<node>` child
(`Game.as:2201-2210`) — **and the extract does not record `<node>`
children** (`seedlingOgmo.js:199-208` keeps only `{type, x, y, attrs}`).
Three ropes exist in the whole game; the one on route is L39's, spanning
(96,384) → (192,384). Slice 2 either records nodes in the extract or
transcribes the three with their citation.

**(c) `chest` IS clearable, and it was not on the list.** `Chest.as:41`
removes it on cleared persistence exactly like the others. It matters: a
chest is both a 16×16 Solid and an avoid volume (its open-line hazard), and
L38's `chest@144,112` sits in the same 1-tile corridor as the cover.

**(d) `statue1`, `statue2` and `shieldstatue` are NOT pixelmasks.** §2 lists
them as classes to verify; they are plain `setHitbox` rects (`Statue`'s from
`render()`, per the existing `statue2` entry; `ShieldStatue.as:20`
`setHitbox(32,32)`). The real mask classes on route are
**`building2`, `building4`, `building5`, `building6`, `opentree`,
`snowhill`** plus `building`/`building1` (already classified) and the
`cliffsides` layer. `treelarge` is off-route.

### 8.5 The pixelmask semantics, from the runtime that executes them

Not from Flash's documentation — from `SWFRecomp`, which is what runs.

- **The dispatch is `Pixelmask.collideMask`, not `collideHitbox`.**
  `Entity.HITBOX` is `private const HITBOX:Mask = new Mask` (`Entity.as:515`)
  — a plain `Mask`, so `e._mask.collide(HITBOX)` selects `_check[Mask]`.
  The rect handed to `hitTest` is therefore the PLAYER ENTITY's own box
  (`other.parent.x - other.parent.originX`, `.width`, `.height`), not a
  hitbox's offsets. Same numbers for the player, different citation — and
  `levelWorld`'s existing comment cites the wrong one.
- **Assigning a Pixelmask REWRITES the parent's bounds.** `Hitbox.update()`
  sets `parent.originX/originY/width/height` from the mask, and
  `Mask.assignTo` calls it. That is why a `Building` that never calls
  `setHitbox` still passes `Entity.collideWith`'s bounding pre-test — the
  bbox is the mask's.
- **The per-pixel test truncates the player's box to integers, and the
  bounding pre-test does not.** `bd_hit_test` (`avm2_bitmap.c:1481-1489`)
  does `px = (int32_t) rx - tlx` — a C cast, i.e. truncation **toward
  zero**, not `floor` — then scans `[x_min, x_max) × [y_min, y_max)` clamped
  to the mask, returning true on the first pixel with `alpha >= threshold`
  (`Pixelmask.threshold = 1`, so any non-transparent pixel).
- **The `cliffsides` layer's THIRD COLUMN picks which of the five masks.**
  `Game.as:2013` is `new CliffSide(o.@x, o.@y, Math.floor(o.@tx / Tile.w))`.
  `levelWorld` currently destructures `[tx, ty]` and drops it — harmless
  while every cliffside was a bounding rect, wrong the moment the masks are
  real. This is the "index against the wrong table" family for the fourth
  time; slice 1 resolves the frame through a committed table.
- ⚠ **`OpenTree` assigns its mask in its FIRST `update()`, not its ctor**
  (`OpenTree.as:20-26`), with offset (−16,−16) against an entity Tree put at
  (x+16, y+16) — the two cancel, so the mask lands on the raw oel
  coordinates. Before that first update it carries `Tree`'s `setHitbox(32,
  32, 16, 16)`, which is the same bounding box; the difference is one tick
  of rect-instead-of-mask, the same family as the tile type flip
  `beforeTypeFlip` already models.
- **And the OpenTree mask is why this matters.** `OpenTreeMask.png` is
  32×32 and solid *except for a 10×12 doorway* at rows 20–31, columns
  11–20 — a walkable gap under the canopy. **L65's exit teleporter to the
  health room sits inside that doorway.** A bounding-rect approximation
  seals it; the real mask opens it. That is Phase 5a's "the sprite rect
  swallows a building's own doorway" arriving as a route-critical fact.

### 8.6 The clear list: 45 entries, zero collisions

Derived from the route's own named blockers, one row per (level, tag).
Every level's tagged entities were cross-checked against **every class that
READS persistence** — `teleporter` (whose `deactivated` is a function of
it), `fallrock`/`fallrocklarge` (whose ctor builds them FALLEN and LIVE when
cleared), `watcher`, `finaldoor`, `moonrock`, `bosstotem`, `lavaboss`,
`spinner` and the rest. **No clear on the route shares a tag with any of
them.** `FinalDoor`'s L114 tag 0 and every `Moonrock` tag are untouched, as
ruled.

⚠ **A clear can also turn a teleporter ON.** `Teleporter.checkDeactivated`
is `deactivated = tag >= 0 && (!checkPersistence(tag) == invert)`, and
`levelWorld` currently hardcodes `persistenceIsTrue = true` (line 1237). So
slice 2's `buildLevelWorld` must take the cleared set and recompute
`deactivated` — a clear does not only despawn things, it can open a door.

⚠ **And the crutch is the state the game itself produces.**
`Lock.turnOff()` (`Lock.as:88-97`) writes `Game.setPersistence(tag, false)`
when a lock opens. The tape-driven clear is not a foreign state — it is the
state a player reaches by solving the puzzle. Worth recording because it is
the strongest argument the crutch is honest.

### 8.7 Evidenced-inert, re-verified against R2's route AND cleared state

Per §2's L38/FallRock lesson, each `evidenced-inert` entry was re-checked
against the new state rather than inherited:

- **`fallrock` / `fallrocklarge` — still inert, and the reason is now a
  CONSTRAINT.** They are parked at `y = -16` with `type = ""` while
  persistence is TRUE. **A clear ARMS them** (the ctor reads
  `!checkPersistence(tag)` and builds them fallen, Solid and live). No clear
  in §8.6 targets a fallrock tag, and that is now a rule the derivation must
  keep, not a coincidence.
- **`bosstotem` — still inert.** It activates on
  `FP.world.classCount(Wand) <= 0`; R2 keeps grants as property writes, so
  L43's Wand pickup is never removed and the count is never 0. (Moot in
  practice — the wand room is unreachable this rung.)
- **`shieldlock` / `shieldlocknorm` — still priced unconditionally live**,
  and now also CLEARABLE (`tSet = -2 < 0`).
- **The Bridge debt is LIVE and route-critical.** R1 recorded a bridge as
  permanently Solid "because no attack key is pressed" — still true, and
  §8.1 found three of them on the route, one of which (L63 (2,9)) is a seal.
  The debt is no longer theoretical.
- **A new inventory-conditional blocker: `karlore`.** `Karlore.added()`
  removes itself iff `Player.hasFire`. Same shape as `ShieldLock`'s
  inventory-conditional volume, opposite sign, and it is the only despawn of
  that kind in the codebase (checked every `added()` override).
- **`IceTurret` is SOLID when the player is FAR** — `else if (!collide(
  "Player", x, y)) type = "Solid"` (`IceTurret.as:93-95`), the else-arm of
  the `d <= attackRange` test. Priced as an unconditional solid: it blocks
  precisely when you are not already inside the freeze disc the route
  avoids.
- **`Cover` is SOLID unless its button group is held** — `activationStep`'s
  else-arm calls `reset()` (`type = normType`) every tick.

### 8.8 The bill, counted

**69 distinct entity tags on the 47 route levels lack a `blocking` entry**
(not the ~93 §2 estimated, and not "50–60 plus masks"):

- **39 need a rect** — `barstool bed bombpusher bonetorch bonetorch2
  bosslock breakablerockghost burnabletree cover dungeonspire fallrock
  fallrocklarge forestchar hermit iceturret karlore lavaboss lavachain lock
  magicallock moonrockpile planttorch pulser pushableblock pushableblockfire
  pushableblockspear rock3 rock4 ruinedpillar sensei shieldlock
  shieldlocknorm shieldstatue spinningaxe statue1 totem treebare wandlock
  witch`
- **6 need a mask** — `building2 building4 building5 building6 opentree
  snowhill`
- **1 is special** — `rope` (needs its `<node>`)
- **23 are NOT solid** and need an entry saying so with its citation —
  the Enemy-typed classes (`type = "Enemy"` is in no solids list), plus
  `button` ("Button"), `buttonroom` ("ButtonRoom"), `pull` ("Pull"),
  `lightpole` ("LightPole"), `wire` ("Wire"), and `littlestones`,
  `lightray`, `shadow`, `whirlpool` (which never assign `type` at all).

Plus the `cliffsides` frame index (§8.5) and the five 16×16 cliffside masks.

⚠ **One latent extract hazard, recorded and NOT live.** `Game.as:2009-2015`
builds cliffsides with **no bounds guard**, while the `tiles` layer has one
— but `seedlingOgmo.js` applies its out-of-level filter to *every* tile
layer generically. A cliffside painted outside its level rectangle would be
built by the game and dropped by the extract. **Zero placements are affected
today** (checked all 116 `.oel` files), so this is a note, not a fix.

### 8.9 Batch content — UNCHANGED, pending §8.3's escalation

Nothing found here needs a second AS3 change. The `persistence` field is
still the whole batch. Every seal in §8.3 is opened (or not) on the JS side
or by the existing tape mechanisms; none of them wants a new `Bot` flag.

## 9. ⚖ THE SLICE-0 RULINGS (user, 2026-07-31)

§8.3's escalation put three trades to the user. All three answered:

1. **Model the Activators — YES.** Button/lock/cover groups become modelled
   GAME MECHANICS, not a crutch: press detection (`Button.update` collides
   `["Player","Enemy","Solid"]` at its own position and sets
   `activate = v.length > 0`, propagating to every `Activators` sharing its
   `t`), the alpha fade (`Lock.activationStep` decrements by 0.01/frame, so
   **100 ticks of standing on the button** before `turnOff()`; `Cover`'s is
   0.1/frame, so 10), and the `returnToNormal` guard — a lock cannot
   re-solidify while anything in `hitables` overlaps it. Nothing later has to
   retire this. **Buys darkshield + darksuit.**
   ⚠ It is NOT proven the bot can cross: the player must leave the button and
   overlap the lock **in the same tick** (the two volumes are disjoint by one
   pixel of `y`), and whether `Lock.update` runs before or after
   `Player.update` decides it. **That is an oracle question, and slice 4 owns
   it** — a `hold-the-button` fixture, recorded first and reconciled EXACT.
   If the game says no, L71 joins the blocked list and the claim is 6.
2. **`fire` stays BLOCKED.** Granting it (which would despawn `karlore` and
   unseal the conch) is declined so that R1's and R2's published blocked
   lists keep meaning the same thing, and so the grant crutch stays limited
   to items whose rooms the walk actually collects from. `conch` joins the
   blocked list as **"L48 `karlore@112,272`, gated on `Player.hasFire` — R5"**.
3. **Pushables → the blocked list, deferred to R3.** Modelling pushing buys
   nothing on its own: L38's cover leads into L39's wandlock puzzle (wand
   shots), and L65's alternative route needs L63's bridge speared first.
   Both `wand` and `health` are ITEM-USE gated, which is R3's subject.

### 9.1 The R2 target claim

**8 of the 13 non-combat items:** sword, shield, feather, darksword, torch,
spear, darkshield, darksuit — i.e. R1's eleven minus `conch`, `wand` and
`health`. `hitsMax` stays at its base 3 (health is blocked), which is itself
an assertion: R1's `hitsMax == 4` becomes R2's `hitsMax == 3`, and a run that
reported 4 would mean a grant fired that should not have.

**The blocked list, published with the rung that opens each:**

| item | seal | rung |
|---|---|---|
| `conch` | L48 `karlore@112,272`, despawns only on `Player.hasFire` | R5 (`fire` needs BobBoss) |
| `wand` | L38 `cover@144,112` needs `pushableblockfire@80,208` pushed onto `button@80,192`; then L39's three stacked `wandlock`s need wand shots | R3 (pushing + item use) |
| `health` | L63's bridge at (2,9) needs spearing; then L65 `rock@192,96` / `pushableblockspear@176,128` | R3 (item use) |
| `fire` | combat-gated by construction (BobBoss) | R5 |
| `ghostsword` | L98's IceTurret disc covers its whole entrance room | R5 |
| `firewand` | L108's darksuit-gated LavaTrap ferry | R5 |

### 9.2 Slices, as re-planned by the rulings

0. ✅ Recon (§8) and the rulings (§9).
1. **Masks** — the extraction script, the committed 1-bpp artifacts, the
   `collideMask` transcription (§8.5), the cliffside frame index, unit strata
   from hand-read rows.
2. **Blocking entries** — the 39 rects + 6 masks + `rope` + the 23
   not-solid entries (§8.8), chunked, each with its ctor offset chain cited.
3. **Activators** — buttons, locks, covers, wandlocks as a modelled
   subsystem, with the clear set feeding `deactivated` recomputation (§8.6).
4. **The AS3 batch** (one build): the `persistence` field; byte-inert gate
   over all 23 frozen fixtures BEFORE any new recording.
5. **Collision + Activators oracles** — a mask press against a building
   doorway, a cliffside press, a despawned-lock fixture, and **the
   hold-the-button fixture that decides §9.1's claim**. Record first,
   reconcile exact.
6. **The walk** — re-plan, segments + headline, `--tier` wiring, acceptance.
7. **Docs + close-out.**

## 10. Slices 1–5a — AS BUILT (2026-07-31)

### 10.1 Slice 1 — the pixelmasks became a model

`scripts/procgen/extract-seedling-masks.mjs` turns the seventeen MIT mask
PNGs into `seedlingDemo/seedlingPixelMasks.js`: a committed, import-free JS
module, `--check`-gated like every other artifact in this arc. The rows are
`#`/`.` strings rather than hex **because this artifact's correctness is
visual** — a reviewer can see `OpenTreeMask`'s doorway and cannot see it in
`ffffffe00007ffffff`. ~100 KB for something nobody could otherwise check.

`maskHitsBox` transcribes the chain that actually runs, and both halves are
cited because they disagree about rounding (§8.5). The `cliffsides` frame
index is resolved through `CLIFFSIDE_FRAME_MASKS` rather than an inline
array — the fourth time in this arc an index has been read against the
wrong table.

**The seam did not disappear, it moved earlier**: a `collider: 'pixelmask'`
entry with no committed `mask` now throws from `maskPlacement` at BUILD
time, naming the class rather than the fixture.

⚠ **The planner uses the real mask too, and that moved a committed route.**
`cross-level-leg` threads L94's cliffsides differently now. Re-recorded
against the game rather than accepted as a test update — and the model
matched the new recording exactly, which is the first oracle evidence the
mask transcription is right.

**Mutations:** five run. A mask row flipped, the frame index dropped and the
missing-mask throw removed all bit. Two did NOT, and both were real gaps:
`Math.trunc → Math.floor` (the two agree for non-negative input, and every
committed mask sits at x,y ≥ 0 — but a player at x = 0..1 has `box.x` of
−2..−1, and L94's cliffsides start at column 0), and dropping `+ cls.dx`
from `maskPlacement` (in every class the ctor offset and the mask offset
CANCEL, so all seventeen `dx`/`dy` are 0). Both are exercised directly now
and both bite on the re-run.

### 10.2 Slice 2 — the 69-tag blocking bill

39 rects, 6 pixelmasks, `rope`, and 23 `notSolid` entries. The FULL census
goes from 11 of 116 levels to **82**, and all 47 route levels build.

**The table checks itself against the game**: every entry declares the
`type` its constructor assigns, and a test requires `collider !== 'none'`
to agree with `PLAYER_SOLID_TYPES`. A hand-written "this does not block"
survives being wrong; a type the solids list can be asked about does not.

Four transcription errors the recon had, caught by re-deriving:

- `moonrockpile` is `setHitbox(spr.width, spr.height)` — **32×16**, two
  tiles wide. The sprite had to be measured.
- `statue1` and `statue2` are the same class with **different hitboxes**:
  `render()` switches on the frame, and frame 0 is `(48,32,24,16)` against
  frame 1's `(48,24,24,0)`.
- `totem` stacks its own (+8,+40) with NPC's (+8,+8); its own source
  comments on the trap. One offset gives a rect two tiles too high.
- `bombpusher` and `iceturret` are **enemies that are SOLID** — both extend
  `Enemy` and then overwrite the type. The rule that carries every other
  enemy on the route is false for exactly these two.

⚠ And one collider needed data the extract was dropping: a `RopeStart`
spans to its `<node>` child, and `seedlingOgmo.js` kept only
`{type, x, y, attrs}` — so a rope was a 16×16 stub instead of a 7-tile
wall. Nested nodes are recorded generically now; the atlas diff is exactly
the three ropes.

### 10.3 Slice 3 — Activators, and the crossing the game confirmed

`activators.js` models buttons, locks and covers in the game's own order:
`Button.update` republishes `activate` to its group EVERY tick (the flag is
not latched), then each responder fades or restores.

**Two float questions, neither answer the obvious one.** `Image.alpha`'s
setter CLAMPS to [0,1], and `Lock.activationStep` tests `alpha > 0` BEFORE
decrementing while `Cover.update` decrements and tests in the same tick —
so a lock opens on tick **101** and a cover on tick **11**, not 100 and 10.
Derived by running the fade, never by dividing.

⚠ **The restore is guarded by OCCUPANCY**, which is what makes the crossing
possible: L71's button `[116,124)×[181,187)` and its lock
`[112,128)×[160,176)` are DISJOINT, with y = 178 touching neither, so the
player must leave one and enter the other in a single tick — after which
the lock cannot re-close because they are inside it.

⚠⚠ **The model presses on the PLAYER only** while the game presses on
`["Player","Enemy","Solid"]`. Exact only while no static solid rests on a
button; checked over every level that builds, with a positive control
beside it.

### 10.4 Slice 4 — the AS3 batch, the gate, and the answer

One build, one change: `tape_version: 3` with `persistence: [{level, tag,
note}]`, applied by `botStart` **before the first world is built** —
every responder reads its flag in a constructor or in the `check()` a new
world runs on its first frame. `botStatus` gained a `persistence` readout
read back from the game's own array rather than echoed from the tape.

**✅ THE BYTE-INERTNESS GATE PASSED BEFORE ANYTHING NEW WAS RECORDED.** All
23 frozen fixtures replay byte-identical against the new build, including
the 14,963-tick R1 headline with its entire claim intact — 11 items,
`hitsMax == 4`, the blocked list still false, 47 levels, 78 crossings, and
all sixteen chain assertions.

Then the question §9.1 left open, put to the game:

| fixture | model | game |
|---|---|---|
| `l71-button-lock` — hold 101 ticks, then walk | y = 116.45 | **116.44999999999997** |
| `l71-lock-shut` — walk immediately | y = 178.500 | **178.5**, pinned on the south face |

**The pair is the point.** The first alone is satisfied by a lock that was
never shut; the second alone by a player who never moves. Together they say
the lock was real, the hold opened it, and the crossing works — so
**darkshield and darksuit are reachable and R2's claim is 8 items**. It is
also the first oracle evidence for the 101-tick fade, the clamped alpha and
the occupancy guard.

### 10.5 Slice 5a — the tiers, and the hole the tier opened

`--tier=fast` (18 tapes, ~4 min) / `--tier=full` (25, the default and the
gate). The split is on TICK COUNT read from each tape, not a name list that
would rot.

⚠ **Adding the tier immediately caused the failure it was most likely to
cause.** `r1AcceptanceFindings` returned an EMPTY list when a sweep replayed
none of the R1 tapes — exactly what `--tier=fast` does — so the run printed
`ALL CHECKS PASSED` without ever mentioning that R1's claim had not been
looked at. Both halves are a named SKIP now, carrying the command that
would assert them, and there is a vitest case for the replayed-nothing path
specifically.

## 11. WHAT IS NOT DONE, and what it needs

**The R2 walk itself is not built.** Everything it depends on is, and is
verified; the walk is the remaining work.

- **`synthesizeLegs` cannot yet plan a `noclip: false` walk.** `botDriverV2`
  hardcodes `noclip: Boolean(relax)`, so the relaxed path is always noclip.
  R2's walk needs a relax shape that keeps collision ON while carrying
  `noHazards`, `grants` and `persistence`.
- **The planner needs a HOLD primitive.** L71's crossing is "stand on
  (120,184) for 101 ticks, then walk north" — a leg step the leg vocabulary
  (`targets`, `exit`, `contacts`) has no word for. The executor has to
  verify it too, or a hold that silently ran 99 ticks would present as a
  collision divergence.
- **The route must be re-planned** over post-clear geometry, with
  `(level, component)` ids computed from the CLEARED world (a cleared lock
  merges components) — the recon instrument in slice 0 does this at pixel
  resolution and its conclusions are §8.2/§8.3, but the committed planner
  has not been moved over.
- **The recordings.** ~8 segments plus a headline, at ~55 min for a full
  sweep, with the segment boundaries chosen so a re-route touches the
  fewest tapes (the R1 lesson).
- **The acceptance readout** for the 8-item claim and `hitsMax == 3`.

Everything above is unblocked: the geometry, the masks, the census, the
Activators, the tape format, the build, the gate and the tiers are all in
and green.
