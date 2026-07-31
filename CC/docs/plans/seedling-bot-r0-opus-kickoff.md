# Region atlas Phase 8 — subtractive ladder, Rung 0 (Opus kickoff): the acceptance signal + the machinery

**Date:** 2026-07-31 (Fable design session; four user rulings taken).
**Parent:** `CC/docs/plans/seedling-bot-subtractive-plan.md` (the ladder, the
rulings, the recon facts — read it first, then
`docs/json/developer/procgen/seedling-bot.md`, then the v2 kickoff's §7–§14
as-built sections. §1–§6 of the v1/v2 kickoffs are historical briefs with
known errors; trust the as-builts and the doc.)

## 0. Mission in one paragraph

Build everything the subtractive ladder's first full playthrough (R1) needs,
and prove it on a witness mini-walk. Concretely: the tape format grows three
explicit fields (`noDamage`, `noHazards`, `grants`); `Bot.as` + `Player.as`
take the SIX batched AS3 changes in ONE pipeline build; `buildLevelWorld`
relaxes by ROLE so a no-collision walk can build most levels; pickups and
proximity-hazards get classified with census guards; `botStatus` reports the
14 item properties + the win statics (the ladder's acceptance signal); and a
driver-planned walk from boot to the sword's room (level 10) records exact,
with the grant observed in the game's own readout. **The JS side mirrors
every relaxation exactly — R1 must be exactly differentially verifiable end
to end, not a reconnaissance artifact.**

## 1. Settled rulings — do NOT re-litigate

1. **R1's crutch set** (user 2026-07-31): `noclip` + `noDamage` +
   `noHazards` + grant-on-room-entry, all tape-declared, all mirrored
   exactly in JS. Hazards are DISABLED, not routed around.
2. **The AS3 batch is one build, six changes** (user approved 4 explicitly;
   rulings 1+4 imply the other two): (a) deterministic dialogue auto-advance
   during dead frames; (b) item/win readout in `botStatus`; (c)
   `Bot.noDamage` guard in `Player.hit()`; (d) parameterised boot (honor the
   tape's `boot` block); (e) `Bot.noHazards`; (f) tape-driven grants.
3. **Removal order** for later rungs: cheapest-machinery-first under the
   completability invariant (plan doc §5) — R0 does not depend on it, but do
   not design seams that assume a different order.
4. **The item walk gates R1; grants fire on first entry to the item's
   level.** Real collection is a later rung; nothing in R0 models the pickup
   ceremony beyond avoiding it.
5. Standing arc rulings all carry: levels are INJECTED (`levelSource`);
   reuse stops at the verbatim semantics tables; transitions contract as
   shipped; tapes are whole regenerated artifacts (fixed-seed global LFSR);
   JS is never a load-bearing stratum — the recompiled game is the oracle.

## 2. Verified recon anchors (this session, source-verified — spot-check, don't re-derive)

- `Pickup.pick_up()` (`src/Pickups/Pickup.as:90`): special pickups set
  `Game.freezeObjects = true`, count `specialTimer` 150 down, spawn an NPC
  text, and unfreeze only when the text object is gone. `NPC.talk()`
  (`NPCs/NPC.as:185`) runs while frozen and dismisses on
  `Input.released(p.keys[6])` (V, keycode 86). Multi-page text (`~`
  separators) needs one release per page. **The bot never dispatches on dead
  frames → a walked-over special pickup deadlocks the tape.** Item pickups
  construct with `attract=false` (e.g. `Sword.as` ctor) — they do not chase
  the player; 8×8 hitboxes.
- `Player.hit()` (`Player.as:1345`): knockback (velocity impulse via
  `knockback()`, `Player.as:1457`) + `Game.shake` + `hits += d` + `die()` at
  `hitsMax`. No-op while frozen. The `bot` branch already guards
  `Player.as:1697/:1727` with `Bot.noclip` — same pattern for `noDamage`.
- Hazard consumers cluster after `getState()` (`Player.as` ~656–740):
  state→speed/friction selection (~516/585 for ice/darksuit), `onIce = _s ==
  22` (~700), the pit branch (`receiveInput = false`, ~718–737, world swap
  via `Game.fallthroughLevel`), `drown()` (~1396). Water speed couples to
  `Music.soundPosition("Swim")`.
- Items: 12 walk-over pickups at L10 (sword), L20 (shield), L30
  (torchpickup), L43 (wand), L49 (conch), L64 (ghostspear→`hasSpear`), L68
  (health), L74 (darkshield), L79 (darksuit), L89 (feather), L106
  (ghostsword), L109 (firewand). `darksword`: Witch (L12) `doneTalking()`,
  needs `hasWand`. `fire`: BobBoss drop (`bobboss1/2/3` in `Game.as:2068-70`
  — locate the level with a one-line extract query). Win = Seed
  (`Pickups/Seed.as` — `//GAME WON`): bloody → `Game.cutscene[1] = true` +
  `new Game(1, 64, 96)`; tree → `Game.menu = true` + credits.
- Chests OPEN on a player line-collide beneath them (`Chest.update`) and
  spawn a special SealPiece + consume seal-index RNG — a proximity hazard,
  not just scenery. NPC auto-talk (`keyNeeded == false`) and the 12
  `watcher` entities need the same classification (recon task below).
- Item properties are `Main` static setters (SAVE_FILE-backed;
  `games/seedling.json` `items[]` lists all 14 property names). All
  reachable from `Bot.as` (compiled in).

## 3. Design, concretely

### 3.1 Tape format v2 (`tapeFormat.js`)

Three new top-level fields, ALL REQUIRED (the no-silent-defaults rule):

```json
{ "tape_version": 2, "noclip": true, "noDamage": true, "noHazards": true,
  "grants": [ { "level": 10, "items": ["sword"] } ], ... }
```

- `tape_version: 2`; v1 tapes stay parseable (their new fields default
  REJECTED — a v1 tape declaring `grants` throws, a v2 tape omitting any
  flag throws). The eleven committed fixtures stay version 1 untouched.
- `grants[].items` use the `games/seedling.json` `flash_name` vocabulary;
  unknown names throw at parse. Semantics: applied by BOTH sides on the
  first observation tick whose `level` equals `grants[].level` (arrival
  tick, after the swap — pin the tick in the docblock as a shared
  contract). Grants are property writes ONLY (recommended; confirm in slice
  0): pickups stay in the world and join the avoid-volumes. Duplicate
  levels in `grants` throw; a grant for a level the tape never enters is a
  named FAIL at run end (a silent no-op is how a route regression hides).
- `boot` becomes honored by BOTH sides (see 3.2d): `parseTape` keeps
  validating shape, drops the `BUILD_SPAWN` equality throw, and the
  differential's first observation pins the real spawn (ctor half-tile
  offset transcribed as today). Keep `BUILD_SPAWN` exported as the default.

### 3.2 The AS3 batch (ONE build; `~/CC/seedling` branch `bot`; recipe = `~/CC/seedling_bot_build/build_bot.sh` header)

All flags live in `Bot`, parsed from the tape, default OFF; `Player.as`
edits are one-line guards reading them (the `Bot.noclip` precedent). Batch
discipline: get every change reviewed and compiled TOGETHER; budget ~10 min;
remember `FRESH=1` after define changes, `run-SWFRecomp.sh` not raw,
`DEMO_SWF` on deploy, mxmlc needs terminal returns outside try/catch, and no
EI callback may return `""` (the shim maps it to null).

- (a) **Auto-advance**: while the tick counter is gated on a dead frame AND
  `Game.talkingText`/an active text NPC exists, dispatch a V down on one
  dead frame and up on the next, on a FIXED dead-frame cadence (frame-
  deterministic ⇒ the frozen-frame count and hence the RNG stream are
  reproducible run to run). Counts dead frames as today; sticky
  `saw_auto_advance` in `botStatus` so a run that needed it says so. (R0
  routes avoid all ceremonies, so this ships dark — it exists for R3 and as
  the named safety if a census miss ever lets a ceremony fire.)
- (b) **Readout**: `botStatus` gains `items` (the 14 properties, read live),
  `cutscene` (`Game.cutscene[]`), `menu` (`Game.menu`). This is the
  acceptance signal: R1 asserts 13 item flags true from HERE, not from JS
  bookkeeping; R6 asserts the win statics. (BridgeGeneric configure was
  considered as a patch-free readout; rejected — the batch is already paid,
  and one control surface beats two.)
- (c) **`Bot.noDamage`**: guard the body of `Player.hit()` (return early
  before sound/shake/knockback/die). Do not guard `knockback()` itself —
  other callers (`Player.as:761`) are not enemy contact; recon them in
  slice 0 and guard the minimal set that keeps a relaxed walk
  position-pure.
- (d) **Parameterised boot**: honor `tape.boot` (`Bot.as` already parses
  `boot.level` and discards it; route it into the `new Game(...)` boot or
  re-boot path). Full-run tapes still boot `{0,80,128}`; the parameter
  exists for per-level fixtures and the v2 vacuity witnesses.
- (e) **`Bot.noHazards`**: coerce the CONSUMED terrain state to default(0)
  when it is in {1 water, 6 pit, 17 lava, 22 ice, 25 waterfall} — ONE choke
  point right where `getState()`'s result is consumed, so speed/friction/
  ice/pit/drown all neutralize together. The sticky resolver's STORED state
  keeps the raw value (both sides, identical rule). Slice 0 must enumerate
  every consumer of `state` and prove the choke point covers them (drown
  timers, `fallFromCeiling`, water sound triggers — anything missed is a
  divergence generator). Stairs (10) and ghost step (30) keep their real
  modelled speeds — noHazards flattens the DANGEROUS states only.
- (f) **Grants**: on the first frame in a level named by `grants`, write the
  listed `Main` setters (a fixed 14-entry name→setter table in `Bot.as`;
  tapes stay data). Report applied grants in `botStatus` (sticky list) so
  the harness can assert application from the game side.

### 3.3 JS mirrors (`seedlingDemo`)

- Engine: extend `playerPhysicsV2`/`tapeRunner` with the three flags —
  `noDamage` is a no-op at R0 (no enemies modelled; it exists so the tape
  schema is symmetric and the differential can carry it), `noHazards` is
  the same coerce rule at the same seam (the resolver still RESOLVES and
  stores raw state — assert that on the resolver's own answer, the
  brick-not-ground lesson), `grants` fold into an inventory mirror applied
  on the arrival tick. The v1 five and the eleven v2 fixtures must stay
  byte-identical (they are version-1 tapes; nothing about them changes).
- **`buildLevelWorld` relaxes by ROLE** (plan doc §7): entries gain
  `role: 'blocking'|'trigger'|'pickup'|'proximity-hazard'|'ignorable'`;
  the builder takes `roles: [...]` consulted by the caller and throws only
  on tags unclassified for a consulted role. Existing callers pass the full
  set (behavior unchanged — the 39 levelWorld tests must not move).
  Census guards WIDER than fixture levels: triggers (exists), pickups
  (`ENTITY_CLASSES` pickup tags must cover the 12 item tags everywhere they
  appear), proximity-hazards (chest/auto-talk NPC/watcher/special-pickup
  tags classified across all 116 levels). The R0 walk consults
  {trigger, pickup, proximity-hazard} — blocking stays unpaid until R2.
- **Driver**: `botDriverV2` gains a relaxed mode — A\* over ALL tiles and
  holes (no solid pruning; the level rect is the bound), avoid-volumes =
  live teleporter volumes (existing policy) + proximity-hazard rects +
  special-pickup rects, exempting a leg's named `exit`. The executor's
  throws carry over (wrong-level start, unplanned transition, and NEW:
  entering an avoid-volume, a grant that never fired). Cross-level legs
  stay caller-named.

### 3.4 The witness mini-walk (the rung's fixture)

`boot(0,80,128) → sword room (L10)` — pick the trigger chain from the level
graph (level 0 exits to 1, 12, 94, 89, 86, 13, 2; slice 0 maps the shortest
chain to 10), `noclip+noDamage+noHazards: true`, one grant `{level 10:
["sword"]}`. Record `--record --win --only=` on a FRESH page; deadline
scales with tape length. Assert: exact stream + transitions match; grant
applied at the pinned tick per `botStatus`; `items.hasSword` true at drain;
the other 13 properties FALSE (the negative that catches a grant firing
early); zero auto-advance events. Add one hand-authored HAZARD-CROSSING
fixture (a short tape over a water/pit tile with `noHazards: true` — L94's
lake row is adjacent to known ground) so the coerce rule is oracle-backed,
not just unit-tested; without it the noHazards mirror is a
verifier-shared-assumption.

## 4. Slices (commit each separately to main; JS-first where the stage allows)

0. **Recon + census** (no code): enumerate every `state` consumer for the
   choke-point proof; every `knockback` caller; NPC `keyNeeded` defaults +
   Watcher proximity behavior; chest/special-pickup tag census across the
   extract; BobBoss level; the L0→L10 trigger chain; grants-vs-persistence
   decision. (Do NOT spend time on the `Music.soundPosition` stub question —
   user ruling 2026-07-31: sound is left for LAST; water/swim is the final
   hazard re-armed and its recon happens then.) Deliverable: findings
   appended to this file.
1. **Tape format v2 + role-relaxed builder + JS mirrors** (pure JS; vitest;
   the 11 fixtures byte-identical; new unit strata for coerce/grants/roles;
   mutations that must bite: coerce dropped, grant tick shifted ±1, a
   consulted-role throw removed, avoid-volume policy dropped).
2. **The AS3 batch** — all six changes, one build, deployed beside the
   existing page (the v2-era build stays until R0 closes so the 11 fixtures
   can still be re-verified against it if anything smells).
3. **Oracles**: re-verify the 11 committed fixtures against the NEW build
   (all flags off ⇒ byte-identical streams expected — THE regression gate
   on the batch; any drift is a named failure to reconcile before
   proceeding). Then record the witness walk + the hazard fixture.
4. **Acceptance wiring + docs**: readout assertions in the verify script;
   the doc gains the R0 contracts; plan-doc checkboxes; memory topic.

## 5. Discipline + traps (standing ones apply; these are the live ones)

- **The batch is the rung's one expensive move** — nothing else may touch
  AS3; if slice 0 finds a seventh needed change, STOP and add it to the
  batch before building, not after.
- **Flags-off must be byte-inert.** Slice 3's re-verify of the 11 fixtures
  against the new build is the gate that says the batch changed nothing it
  did not declare. Run it BEFORE recording anything new.
- `--record` never compares first — ALWAYS `--only=`. Fresh page per tape.
  `--win` always (~25 fps vs ~0.5). Deadlines scale with tape length.
- Tapes are not editable (global RNG stream) — any change to a route means
  regenerating that tape and re-recording its oracle, whole.
- The grant is bot-side state; the JS inventory is a MIRROR. Never let a JS
  assertion about items substitute for the `botStatus` readout — the game
  is the oracle for the acceptance signal too.
- An unclassified tag found mid-walk is a rung boundary made visible:
  classify it with its `Game.as` construction site, never guess
  "ignorable".
- Concurrent-session git discipline: stage+commit atomically; never
  `git add -A` with background jobs running.

## 6. Open questions (ask the user only if blocking)

- Grants: property writes only vs + persistence clear — slice 0 recommends,
  user confirms only if the recommendation is "persistence too" (it changes
  saved-world state the real collection rung later re-earns).
- If the L0→L10 chain crosses a level whose proximity-hazard census turns
  up something unavoidable in-corridor, the witness item may switch to a
  nearer one (shield L20 / torchpickup L30 / the wand L43) — driver's
  choice, not a ruling.

## 7. Acceptance gates

- G1 (CI, vitest): all existing suites green with the 11 fixtures
  byte-identical; new unit strata for parse/coerce/grants/roles/avoid; the
  named mutations bite.
- G2 (local, `--win`): the 11 fixtures re-verified EXACT against the new
  build with flags off; the witness walk and the hazard fixture recorded
  and EXACT; `botStatus` readout asserts the grant, `hasSword`, the 13
  negatives, and zero auto-advance — all from the game's own reports.
