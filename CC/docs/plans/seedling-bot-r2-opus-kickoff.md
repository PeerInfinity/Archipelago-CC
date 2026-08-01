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
