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

## 8. Slice 0 — RECON, AS BUILT (2026-07-31)

No code. Everything below is source-verified against `~/CC/seedling` branch
`bot` (the tree the batch lands on) and the committed extract
`flashPanel/atlases/seedling-map.json`. Where a §2 anchor was imprecise it is
corrected here; §2 is the brief, this section is the record.

### 8.1 The choke-point proof: terrain state has exactly ONE consumer file

The question §3.2(e) asked — *does one coerce point cover speed, friction,
ice, pit and drown?* — has a stronger answer than hoped.

**Nothing outside `Player.as` reads the player's terrain state or any field
derived from it.** `grep` for `.state`, `.inWater`, `.inLava`, `.onIce`,
`.onWaterfall` across all 209 files returns **zero** hits outside
`Player.as`. (`Enemy.getState()` and `LavaRunner`'s switch are a *different*
function on a different class. `getStatePos` is the unrelated ungated lookup
already recorded in the doc.)

Inside `Player.as`, `getState()` (`:656-668`) assigns `state = tile.t` and
the **setter** (`:685-716`) is where every consequence is computed:

| derived field | assigned | read by |
|---|---|---|
| `fallInPit` | `:697` (`_s == 6`) | `checkFallingInPit` `:718-745` (the `receiveInput = false` + `Game.fallthroughLevel` world swap); `Moonrock.as:126` (guard only) |
| `onIce` | `:700` (`_s == 22`) | `:516` (friction `slidingFriction` + `slidingSpeed`) |
| `onWaterfall` | `:701` (`_s == 25`) | `:1521` (the waterfall push) |
| `inWater` | `:702` (`_s == 1 \|\| _s == 25`) | `:524` (WATER_FRICTION + the swim-sound speed bonus at `:527`) |
| `inLava` | `:703` (`_s == 17`) | `:524`, same branch |
| `moveSpeed` | `:715` and `:523` | `input()` `:1489-1517` |
| `lastState` | `:689` | **nobody — dead** |
| `lastPosition` | `:712` | **nobody — the only two reads are commented out at `:1404-1405`** |

Plus three direct reads of `state` outside the setter:

- `:523` `moveSpeed = moveSpeeds[state]` — the live one. `onIce` is already
  coerce-derived, so this sits in the `else` and would otherwise re-apply the
  RAW water/lava speed after the setter had neutralised everything else.
  **This is the site a naive "guard the setter" patch misses.**
- `:1420` / `:1424` `checkDrowning()` — `state == 1 && !canSwim` and
  `state == 17 && !hasDarkSuit`. Must see the coerced value or the drown
  timer still runs to `die()`.
- `:662` the `Music.playSound("Splash")` comparison, and `:1633-1650`
  `states[state]` (the `"swim-"` sprite prefix). Both **cosmetic**; leave
  them on the RAW value, which is also the less invasive edit.

**So the shape is: keep `_state` RAW, add one private `effState` accessor,
and route exactly four sites through it** — the setter body (one local
`eff`, used by `:693/:700-703/:715`), `:523`, `:1420`, `:1424`. That
satisfies §3.2(e)'s "one choke point" and §3.3's "the resolver still
RESOLVES and stores raw state" simultaneously, and it is why the JS mirror
can keep asserting the resolver's own answer (the brick-not-ground lesson).

One thing the setter does that the coerce must NOT disturb: the
`if (_s != _state)` change gate and `_state = _s` stay on the raw value, so
change detection, `lastState` and the splash comparison are byte-identical
to vanilla with the flag off *and on*.

`onGround` gates the whole branch (`:691`). It is written in exactly one
place in the codebase — `Enemies/LavaTrap.as:61/66` — so outside a lavatrap
level it is permanently `true` and the `else` arm (`:707-710`) is dead.

### 8.2 Knockback: guarding `Player.hit()` is exactly the minimal set

`Player.knockback` has **two** callers:

- `:1363`, inside `hit()` — enemy/hazard contact. Covered by guarding the
  body of `hit()`, as §3.2(c) specifies.
- `:761`, inside the `slashing` setter — the sword **dash**, a player-
  initiated item use. Not contact. Leave it unguarded: the bot never
  presses X at this rung, and guarding it would silently change an R3
  mechanic.

(`:1669` is `o.knockback(...)` — the shield bump applying knockback to
*other* entities, not the player.)

⚠ But `hit()` is not the only path by which the game moves the player, and
`Bot.noDamage` as scoped does **not** make enemies harmless — see §8.7.

### 8.3 NPC `keyNeeded` and Watcher proximity

Census of `keyNeeded` across all 209 files: **`NPC.as:41` declares it
`true`, and `Watcher.as:46` is the only assignment anywhere.**

`NPC.talk()` (`:185-235`) auto-opens dialogue when
`inRange && (hitKey || !keyNeeded) && !Game.talking && !Game.inventory.open`,
with `inRange = FP.distance(x, y, p.x, p.y) <= talkRange` (24 px default;
`Statue` widens it to 32). So **every NPC except a Watcher is safe to walk
past** — they need a `V` release the bot never sends. They are still
`type = "Solid"` (blocking role), which noclip already handles.

Watchers are the exception, and the direction is counter-intuitive:
`keyNeeded = !Game.checkPersistence(tag)`. `Main.as:319-330` fills
`levelPersistence` with `true` on a fresh boot, so:

- **`tag >= 0` → `checkPersistence` true → `keyNeeded` FALSE → the Watcher
  AUTO-TALKS within 24 px** and freezes the game via `NPC.as:195`. A live
  proximity hazard.
- `tag == -1` → the index is `i*tagsPerLevel - 1`, `undefined`, coerced
  `false` → `keyNeeded` true **and** `Watcher.update` gates `super.update()`
  on the same `checkPersistence(tag)`, so `talk()` is never even called.
  Wholly inert.

The extract holds **11** watchers, not the 12 the brief carried — L12 tag=6,
L32 tag=2, L37 tag=2, L43 tag=6, L57 tag=1, L69 tag=1, L82 tag=2, L89 tag=1,
L94 tag=0, L103 tag=0, L114 tag=0. **All eleven have `tag >= 0`, so all
eleven auto-talk.** (L94's is inside a committed fixture level; the v2 routes
never came within 24 px of (152,128) — another "unobservable decays when the
driver gets better".)

`Watcher.doneTalking()` also calls `Game.setPersistence(tag, false)`, and
`Scenery/FinalDoor.as:50` reads `!Game.checkPersistence(0, 114)` as
"talked to the Watcher" — so a Watcher touch mutates endgame gating state.

### 8.4 The proximity census: what actually freezes, teleports or eats RNG

Enumerated by signature rather than by guess. `Game.freezeObjects = true`
has **13** sites; `FP.world = new Game(...)` has 12 live ones. Filtered to
what a *relaxed walk with no key presses* can trigger:

| source | tags | count / levels | trigger |
|---|---|---|---|
| `Pickups/Pickup.as:95` | the 12 item tags + `seed`, `bosskey`, `totempart` | 12 / 1 each, 5 / 5, 5 / 4 | walk-over → freeze + an NPC text needing a `V` **release** → **tape deadlock** |
| `Pickups/SealPiece.as:24` (`text = ""`) | spawned by `chest` | — | freeze, 150 frames, then self-resolves. No deadlock, but 150 frozen frames |
| `Chest.as:59-88` | `chest` | 16 / 16 | `collideLine("Player", …, y+height+1)` — a 1-px line **beneath** the chest, inset 2 px each side → spawns the SealPiece, calls `setPersistence`, and burns an **unbounded** `while` of `Math.random()` for the seal index |
| `NPCs/NPC.as:195` | `watcher` (tag ≥ 0) | 11 / 11 | within 24 px → freeze (see §8.3) |
| `Scenery/FallRock.as:107/59`, `FallRockLarge.as:134/67` | `fallrock`, `fallrocklarge` | 8 / 6, 2 / 2 | proximity → freeze **and** `p.y = …` |
| `Scenery/Moonrock.as:72/128` | `moonrock` | 1 / 1 (L0) | **inert on a fresh boot** — see below |

Every one of the 12 item pickups is `special = true` with non-empty `text`,
so §2's deadlock claim holds for all of them, not just the sword.
`Sword.removed()` additionally does `Player.hasSword = true`,
`Game.setPersistence(tag, false)` **and** `FP.world.add(new Help(3))` — the
three-part collection ceremony R3 has to model.

**Moonrock is inert, and the reason is worth pinning** because a careless
read says otherwise. `Moonrock.update()`'s distance test sets `canBeam`, not
`moonrockSet`; `Game.moonrockSet = true` happens only at `:118`, after the
rock falls, which needs `beam && canBeam`, and `beam` is `Main.beam`
(SAVE_FILE-backed, false on every load because the recompiled runtime never
persists). The ctor therefore leaves it at `y = -1000`, `type = ""`.
`ENTITY_CLASSES.moonrock` is correct as written. This matters concretely:
L0's moonrock is at (240,256) with a 48×48 hitbox, and the witness walk's
exit stairs are at (256,272) — *inside* that rect had it ever armed.

`lightalpha`, `daynight`, `control` and `droplet` are **not entities at
all**: `Game.as:1873/1875/2048/2056` read them as level FLAGS
(`lightAlpha`, a `hasOwnProperty` check, the pit-fallthrough parameters, and
the rain rect). Classifying `lightalpha` as a flag — with the citation, not
as a guessed "ignorable" — is what takes the role census past its single
biggest blocker: it appears in **98** of 116 levels.

### 8.5 BobBoss: level 32, and it is not placed from a level file

No `.oel` in the repo contains `bobboss1/2/3`, so `Game.as:2068-2070` never
fires. The only live construction is **`Scenery/FallRockLarge.as:117`** —
`new BobBoss(72, 72)` when a fallrocklarge with `bossrock && thirdboss`
lands. Two fallrocklarge exist: **L32 `bossrock=1 thirdboss=1`** and L82
`bossrock=1 thirdboss=0`. So the boss chain is **level 32**;
`BobBoss.as:190` respawns the next type in place and `:194` drops `Fire`
when type 2 dies. L32 is trigger-reachable (0→12→24→23→21→22→30→32).

### 8.6 The L0 → L10 chain, and the shape of the witness room

Shortest live-trigger chain, four hops:

```
L0  stairsdown oel(256,272) --> L2  arrive (56,40)
L2  teleporter oel(48,96)   --> L3  arrive (72,24)
L3  teleporter oel(96,128)  --> L11 arrive (40,24)
L11 stairsdown oel(32,80)   --> L10 arrive (56,40)
```

(arrival = `(playerx+8, playery+8)`, the ctor half-tile, per the shipped
contract.) Every hop is `tag = -1`, so none is the deactivated-on-fresh-boot
case.

What each level costs the ROLE census (roles the R0 walk consults:
trigger / pickup / proximity-hazard):

| level | size | already classified | NEW |
|---|---|---|---|
| L0 | 20×20 | all 15 tags | — |
| L2 | 7×7 | stairsup, teleporter, pole, torch | `dungeonspire` (Solid), `moonrockpile` (Solid), `lightalpha` (flag) |
| L3 | 9×9 | teleporter×4, breakablerock, torch, brickpole | `breakablerockghost` (= `BreakableRock`, blocking twin), `lightalpha` |
| L11 | 5×7 | stairsdown, teleporter, torch | **`chest` (PROXIMITY HAZARD)**, `lightalpha` |
| L10 | 7×7 | stairsup, tree×2, teleporter, orb×2 | **`sword` (PICKUP)**, `lightalpha` |

No level in the chain has holes, a Bridge tile (t=29), or a cliffsides
layer. L3 (32 cells) and L11 (10 cells) are substantially **Water**, which
is precisely what `noHazards` makes walkable — the chain is a real exercise
of the rung's own relaxation, not a route that avoids it.

Two geometry facts the route must respect, both computable now:

- **L11's chest at oel(32,48)** sits at world (40,56) with a 16×16 centred
  hitbox → rect [32,48)×[48,64), and its open-line runs at **y = 65,
  x ∈ [34,46]**. The straight run from the arrival (40,24) to the exit
  trigger [32,48)×[80,96) goes **straight through it**. The level is 80 px
  wide, so a detour exists — and this is the R0 walk earning its
  avoid-volume policy rather than being handed it.
- **L10's sword at oel(48,48)**: `super(_x+8, _y+8)` then
  `setHitbox(8,8,4,4)` → rect **[52,60)×[52,60)**. The arrival (56,40) puts
  the player's 4×5 box at [54,58)×[38,43) — clear by 9 px, so the grant can
  be observed at the arrival tick without the walk ever risking the pickup.

⚠ L3 holds **four** teleporters; the two-fire-on-one-tick throw is live
there in a way level 0's west pair already showed. That is a routing
constraint for slice 3, not a new seam.

### 8.7 ⚠ Findings that change what R1 can claim (report, do not act at R0)

Two came out of the census and both are load-bearing for the *next* rung.
Neither blocks R0 and neither is a seventh AS3 change; both belong in the R1
kickoff with the numbers attached.

**(a) `Bot.noDamage` does not make enemies harmless.** Guarding
`Player.hit()` covers damage and knockback. It does not cover the classes
that write the player's position or input state **directly**:

| site | tag | levels | what it does |
|---|---|---|---|
| `Enemies/LavaTrap.as:59-72` | `lavatrap` | 77, 78, 80, **108** | a rotating tongue `collideLine`s the player, then *drags* them (`attached.x/.y = …`) and calls `attached.die()`. `hitPlayer()` is overridden to `{}` — it never touches `hit()` at all |
| `Puzzlements/Whirlpool.as:66-71` | `whirlpool` | **46**, **50**, 54 | radial displacement of `player.x/.y` |
| `Projectiles/IceTurretBlast.as:52` | `iceturret` | **40**, **98** | `freeze(freezeTime)` on the player |
| `Puzzlements/ShieldLock.as:35-49` | `shieldlocknorm`, `shieldlock` | **12**, **20**, 71 | snaps `p.y` and sets `receiveInput = false` |
| `Scenery/FallRock(Large).as` | `fallrock`, `fallrocklarge` | **37**, **39**, **43**, 28, 29, 74, 32, 82 | freeze + `p.y = …` |
| `Scenery/Pod.as:70-71` | `pod` | 112 | snaps `p.x/.y` |
| `Enemies/BossTotem.as:284`, `BobBoss.as:219-227` | boss levels | 43, 32 | position + `receiveInput` |

Bolded levels are on the **shortest live-trigger chains to the item rooms** —
so an R1 walk following those chains meets several of these. The designed
answer is the `proximity-hazard` role plus avoid-volumes (LavaTrap's is a
disc of radius `max(tongueLengths)`, since the tongue sweeps); whether that
is always routable is an R1 question. **Recommendation: keep the batch at
six and let R1 decide between routing and a `Bot.noEnemyEffects` flag** —
adding a fourth crutch the user did not rule, one that R5 would then have to
retire, is not an implementation detail to slip into R0.

**(b) With hazards off, 2 of the 13 item rooms are UNREACHABLE, because
pits are not only a hazard — they are a TRANSPORT primitive.**

- Over the trigger graph alone (teleporters + stairs, ignoring geometry):
  **100 of 116** levels reachable from L0.
- **L74 (`darkshield`) and L79 (`darksuit`) are not among them.** Every
  inbound trigger to each comes from L73/L75/L78/L80, none of which is
  trigger-reachable either.
- Add the pit edges — the 12 `control` objects' `fallthrough` targets — and
  reachability goes to **114 of 116**, and both rooms open.

So R1's terminal assertion cannot be "13 item properties true" as written;
with `noHazards` coercing the pit state it is **11 of 13**, with darkshield
and darksuit named on the blocked list until R4 re-arms pits. That is
exactly the honest "what still blocks us" metric the ladder is measured in,
so it is a correction to R1's *claim*, not to its design.

### 8.8 ⚠ One batch amendment, decided here per §5 ("add it BEFORE building")

**`Bot.noHazards` ships as a SET of coerced terrain states, not a boolean.**
The ruling is unchanged — the R0 tapes declare the full ruled set
`{1 water, 6 pit, 17 lava, 22 ice, 25 waterfall}` and record exactly the
semantics §3.2(e) specifies. Only the *shape* of the flag widens, and it is
a handful of lines in a class that is already being edited.

Two independent reasons, and the second is decisive:

1. §8.7(b): the pit is the only route into the darkshield/darksuit cluster.
   A boolean forces "all hazards or none", so R1 cannot even *choose* to
   leave pits armed.
2. **R4 re-arms hazards ONE AT A TIME by design** ("pits, then lava, ice,
   and water/swim last"). A boolean cannot express a single rung of R4 — so
   shipping one guarantees a second ~10-minute pipeline run at R4 to change
   its type. The set costs nothing now and removes that.

Tape shape: `"noHazards": ["water","pit","lava","ice","waterfall"]` — NAMES,
not raw ints, so the tape says what it disables; both sides map through one
5-entry table asserted against the tile-type constants, unknown names throw,
and `[]` is "off" (still explicit, still no default). This is the same
data-in-tapes / table-in-`Bot.as` shape as the 14-entry grant table.

### 8.9 The grants decision: **property writes ONLY**, and the reason is not the one expected

§6's open question, resolved with the source in hand. `Sword.removed()`
shows real collection does three things — `Player.hasSword = true`,
`Game.setPersistence(tag, false)`, `new Help(3)`. The grant writes only the
first.

The argument I expected to make — "the item's tag collides with another
tagged entity in its level" — is **false**, and worth recording so nobody
re-derives it as a justification: checked all 12 item levels, no other
entity shares the item's tag in any of them. The real reasons:

1. **Persistence tags are a shared, cross-level, endgame-load-bearing
   namespace.** `Scenery/FinalDoor.as:50` reads
   `!Game.checkPersistence(0, 114)` — level 114's tag 0, the Watcher's text
   — as "talked to the Watcher"; `Scenery/Moonrock.as:135` writes level 2's
   tag 0 from level 0. Persistence is not per-entity bookkeeping, and a
   crutch should not write it.
2. **It buys nothing.** A pickup despawns from `check()`, and
   `Game.update` runs `check()` on a new `Game`'s **first frame, above the
   `blackCover` gate** (the same fact that pre-arms the teleporter latch).
   A grant applied on the arrival *tick* is already too late to despawn the
   pickup for that visit — so the pickup rect joins the avoid-volumes either
   way, which is what §3.3 assumed.
3. **It would make the crutch and the skill a dirty swap.** R3 retires the
   grant by collecting for real; if R0's grant had also cleared persistence,
   "crutch off" and "skill on" would not be the same state transition.

The 14 item properties are `Player` statics that delegate to `Main`
(`Player.as:102-108` etc.), all reachable from `Bot.as`. **One shape
correction for the readout:** 13 are booleans, but `health` is
`hitsMax` — an **int** with `op: "add"` over base 3 in
`games/seedling.json`. `botStatus.items` must report it as a number, and
R1's "13 true" assertion is really "12 booleans true + `hitsMax == 4`",
with `fire` the 14th left to R5.

### 8.10 Verdict on the batch: still SIX changes

Nothing found here needs a seventh. §8.8 reshapes change (e) before the
build rather than adding to it; §8.7 is reported to R1 rather than acted on.
The auto-advance's inputs are all public statics (`Game.freezeObjects`,
`Game.talking`, `Game.talkingText`, `Game.currentCharacter`), the readout's
are too (`Game.cutscene[]` is a public static Array of 4, `Game.menu` a
public static Boolean), and `Bot.as` already re-resolves `Main.level` every
frame — so (a), (b) and (f) need no new plumbing.

## 9. Slice 1 — AS BUILT (2026-07-31), in three commits

Split because the three pieces have different failure modes and each wanted
its own mutation table. All eleven committed fixtures stayed byte-identical
throughout; no expectation was touched.

### 9.1 Slice 1a — tape format v2 and the JS mirrors

`tapeFormat.js`, `playerPhysicsV2.js`, `levelRun.js`, `tapeRunner.js`,
`botDriverV1.buildTape`. vitest 4050 → 4091.

- **`noHazards` ships as a SET of hazard NAMES** (§8.8's amendment). The R0
  tapes declare all five, so the ruled semantics are exactly what got
  recorded.
- **The coerce keeps two values apart**, mirroring `Player.as` exactly:
  `terrain` is what the resolver resolved and what the sticky state stores;
  `effective` is what the physics consumes, and `assertModelledTerrain` runs
  on the effective one so a coerced hazard is legal terrain and an un-coerced
  one still throws by name.
- **Grants: two call sites and no third.** Construction (the boot level,
  observed at tick 0) and immediately after a world swap — because a swap
  lands at END of tick `t`, so "the run's level just became L" and
  "observation `t` reports level L" are the same instant. First entry only.
- **An unfired grant is a named failure at run end.** It moves no pixel, so
  the stream still matches its oracle and every downstream assertion passes
  — which is precisely how a routing regression would hide.

⚠ **Three shape decisions the eleven fixtures forced, each of which would
otherwise have rewritten them:**

1. **The v1 version check is on the VALUE, not on presence.** `parseTape` is
   idempotent by design and every consumer re-validates, so a parsed tape
   carries the three fields normalised — and re-parsing it must not throw.
   Getting this backwards turned 37 tests red on the first attempt, and the
   AS3 side then repeated the same mistake for real (§11).
2. **`serializeTape` writes the v2 fields only for a v2 tape**, so a v1 tape
   round-trips byte-identically even though `parseTape` normalised it.
3. **`buildTape` decides the emitted version from what the CALLER declares**,
   not from `TAPE_VERSION`. Reading the constant would have turned every
   driver-emitted tape into a v2 tape the day it bumped, and the committed
   fixtures are compared against what the driver emits TODAY — so the bump
   would have read as eleven fixture changes.

Mutations, all confirmed to bite: coerce dropped (6 tests), grant tick +1
(1), grant one tick late (1), re-grant on a revisit (2 — and only `hitsMax`
could reveal it, since a re-granted boolean is invisible), unfired-grant
check removed (1).

### 9.2 Slice 1b — `buildLevelWorld` relaxes BY ROLE; the 137-tag census

`levelWorld.js` + tests. vitest 4091 → 4104. Detail in the doc's "Roles"
section; what belongs here is the shape and the numbers.

Roles are `blocking` / `trigger` / `pickup` / `proximity-hazard`; an entry
LISTS the roles it answers for and the builder throws only for a role the
caller consults. Existing callers get all four, so nothing they see changed.

**Levels that build: 3/116 at v2 → 11/116 with all roles → 82/116 with the
cheap three.** The 11 figure is itself a finding: classifying the level
FLAGS, the fifteen pickups and the chest lifts the FULL census without
touching a single collider.

⚠ **A hazard whose volume nobody transcribed is `'unpriced'`, not omitted.**
Only `chest` and `watcher` carry a rect — the two the R0 walk can reach.
The other twelve throw when a consulted level contains one, carrying their
evidence in the message. Guessing a rect for a rotating LavaTrap tongue
would have been a model nobody derived; a loud throw is a rung boundary made
visible.

Mutations: consulted-role throw removed (3), unpriced hazard silently
skipped (2), chest volume shrunk to its own cell so the open-line row stops
being avoided (1).

### 9.3 Slice 1c — the relaxed driver

`botDriverV2.js`, `levelWorld.plannerBlockerAt`, `levelRun`, `tapeRunner`.
vitest 4104 → 4112.

`opts.relax` is ONE object deciding the plan, the run AND the emitted tape.
That is the point of it being one argument: a driver that planned around
water while emitting a tape which disables it produces a tape both the runner
and the game accept and neither walks the way the planner imagined.

⚠ **`avoidVolumes` defaults OFF for the v2 path, deliberately.** Level 94
holds a Watcher and `cross-level-leg` plans through level 94; turning the
volumes on there would re-route a committed oracle RECORDING, which is a
re-record rather than a test update.

⚠ **The runner had to learn the same census the driver plans with.** It built
worlds with the FULL census, so it refused to replay a relaxed tape crossing
level 2 — the driver could emit tapes the runner would not run. Both sides
now derive the census from `noclip`.

The executor's avoid-volume throw turns **nothing** red; recorded as a
bounded vacuity with its witness (a route whose smoothed segment clips a
volume the tile-centre test cleared), same shape and same verdict as v2's
executor hit-throw.

## 10. Slice 2 — the AS3 batch, AS BUILT (2026-07-31)

Fork `PeerInfinity/Seedling` branch `bot` — `b3c0c9b` the batch itself,
`a976a07` the version-1 check fix §11 forced, and **`a976a07` is the commit
the deployed wasm was built from**. All six changes landed as specified,
with two corrections found while writing them:

⚠ **The auto-advance key is X (88), not V.** §2 said `Input.released(p.keys[6])`
was "V, keycode 86". `Player.as:59` is
`[RIGHT, UP, LEFT, DOWN, X, C, X, V, I]` — index 6 is the SECOND `Key.X`,
the one the comment labels "Talk"; V is index 7 and opens the inventory,
which would freeze the game rather than unfreeze it. Dispatching V would
have shipped the feature silently dead, and since R0's routes avoid every
ceremony nothing would have noticed until R3.

⚠ **`atBootPosition()` is what keeps the v1 fixtures byte-inert.** `botStart`
re-boots only when the tape's block differs from where the build already is,
and `Main.playerPositionX/Y` are the right comparison because the `Game`
ctor writes them from its own constructor args (`Game.as:557-560`) — i.e.
"was this world built from these args", not "is the player standing there".

## 11. ⚠ The batch took TWO pipeline runs, and the gate is why

§5's "flags-off must be byte-inert; run it BEFORE recording anything new" is
not ceremony. The first build failed it outright: **all eleven committed
fixtures were rejected by `botLoadTape`.**

The cause was the AS3 mirroring slice 1a's *first* mistake rather than its
fix — the version-1 check was PRESENCE-based
(`if (t.noDamage != null ...) return error`) while `parseTape`'s is
VALUE-based. `parseTape` is idempotent by design, every consumer
re-validates, and the harness sends the PARSED (normalised) object over the
wire — so every v1 tape arrives carrying `noDamage: false`, `noHazards: []`,
`grants: []`. Two consumers reading one tape differently: the exact failure
the format exists to prevent, one version up.

**The diagnostic was in the failure pattern itself:** all eleven fixtures
failed while the LIVE DRIVER TASK passed. The driver's tape comes straight
from `buildTape` and never goes through `parseTape`, so it carried no v2
fields. Worth remembering — "everything failed except the one path that
builds its input differently" localises a parse defect immediately.

Second build: **81/81 checks, all eleven byte-identical, flags off.** The
batch is byte-inert exactly as declared.

## 12. Slice 3 — AS BUILT: three fixtures, all EXACT

14 fixtures / 1550 ticks / 1564 observations / 8 transition records, all
matching bit for bit. 102/102 checks under `--win`.

- **`grant-sword-room`** (376 ticks) — the witness. Five legs, boot → 2 → 3
  → 11 → the sword's room, crossings at 140/187/274/330 and the grant on the
  last. The game reports `hasSword` true, the other thirteen properties
  correct, `saw_auto_advance` 0 and the win statics false. It is only
  plannable because slice 1b relaxed the census (levels 2 and 3 hold
  `dungeonspire`, `moonrockpile`, `breakablerockghost` — no collider
  classification exists for any of them) and because `noHazards` makes
  levels 3 and 11, largely WATER, standable. Both avoid volumes are live and
  on the path: level 11's chest open-line runs directly between the arrival
  and the exit, and level 10's sword sits in the same 7×7 room as the goal.
- **`hazard-boot-pit`** (30 ticks) — the ONLY fixture exercising the
  parameterised boot, and the strongest coerce claim of the three. It boots
  straight into level 83 — a room the v2 rung could reach by NEITHER door —
  and walks onto a PIT. Without the coerce the game sets
  `receiveInput = false` and TRANSPORTS the player to level 84, so the claim
  is a level change that does not happen, carried by the observation stream
  directly rather than by a speed.
- **`hazard-walk-water`** (60 ticks) — hand-authored, level 0 row 8 into the
  water at column 9. Hand-authored on purpose: a synthesized tape would only
  prove the planner and the engine agree, while a held RIGHT proves the GAME
  agrees.

### Two test-side corrections the new fixtures forced

- **The v1-engine regression block keyed on `noclip`**, which was the same
  set as "the v1 rung" only until R0's relaxed tapes arrived.
  `grant-sword-room` went red there (the v1 engine has no transitions) and
  the two hazard tapes would have gone GREEN for a reason that proves
  nothing — the v1 engine stubs terrain to ground, which is exactly what the
  coerce produces, so it cannot tell a working coerce from a missing one.
  Pinned BY NAME now, with a guard that the five are still v1 tapes.
- **`substance()` now carries the relaxations.** The same key spans under a
  different hazard set is not the same tape.

### And one harness bug the recording found

The grants comparison was `JSON.stringify(a) === JSON.stringify(b)`. AS3's
JSON writer emits object keys in its own order (`{items, level, t}`) and JS
in insertion order (`{t, level, items}`), so identical data compared unequal.
Compared field by field now. A reminder that `JSON.stringify` equality across
two runtimes is a comparison of two serializers, not of two values.

## 13. Verdict against §7's gates

- **G1** — vitest **4119/4119**; the eleven old fixtures byte-identical;
  new strata for parse/coerce/grants/roles/avoid; eleven mutations run and
  every one bites, with the two that do not (the executor's avoid-volume
  throw, `noDamage` on the JS side) recorded as bounded vacuities with
  witnesses rather than left implied.
- **G2** — `--win`, **102/102**: the eleven re-verified EXACT against the new
  build with flags off, then the witness walk and both hazard fixtures
  recorded and EXACT, with `botStatus` asserting the grant, `hasSword`, the
  thirteen negatives, `hitsMax`, the win statics and zero auto-advance — all
  from the game's own reports.

**The rung is closed.** What R1 inherits, and what §8.7 says it must price
before being scoped, is in the doc's "What's next".
