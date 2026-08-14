# Seedling External Level Sets — Plan

**Date:** 2026-08-13 ·
**Status: PLANNING for phases 1–5b (no code). ⛓ PHASE 6 IS DONE
(2026-08-13) — it was independent of the rest. Design settled with the user
(2026-08-13).**

Direct consequence of the switch/door fix (`2a407a817`, as-built in
`docs/json/developer/procgen/seedling-bot.md` §"Every generated switch opened
every generated door"). That slice ended with a second, unfixed collision — a
generated lock's persistence `tag` is the GOAL's tag — and pricing the fix
turned out to require answering a much larger question first: **how does a
custom level ever get into the Seedling wasm at all, and where does its
persistence data live?**

---

## 1. The decisions already taken (user, 2026-08-13)

| decision | choice |
|---|---|
| transport | **ExternalInterface** push from the page |
| bundle contents | **level data AND metadata** — a set is self-describing |
| persistence table | **extend it** — this is in scope, not deferred |
| relationship to the original levels | **REPLACE, not append** |
| the vanilla levels | **also a manifest** — there is no privileged built-in path |
| tag allocator | whenever it fits; it is model-side and blocks nothing here |

⛔ These are settled. A later session may implement them differently only with
a new ruling, not by re-deciding in passing.

---

## 2. Why external loading, and why it matters more here than usual

The browser artifact is **not** an interpreter running a SWF. It is
**SWFRecomp AVM2 recompilation** — a ~23.8 MB wasm built ahead of time from the
SWF (`~/CC/SWFRecomp-CC/`; see the `project_seedling_integration` memory for
the lineage and the shipped EI work).

⇒ "compile the level data in" means re-running the whole
source → SWF → wasm toolchain, re-shipping ~23.8 MB, and re-clearing the perf
gate and the EI livetests **per level change**. An external bundle is a few KB
of XML fetched at runtime. The asymmetry is roughly four orders of magnitude,
per iteration, and it is the whole reason this plan exists.

---

## 3. What was MEASURED before any of this was designed

All citations are into `~/CC/seedling/src` (the AS3 source of the fork).

### 3.1 A room is already DATA, and the parse seam is three lines

```as3
[Embed(source = '../assets/levels/Dungeon2/2.oel', mimeType = "application/octet-stream")]
public static var Dungeon2_2:Class;                                    // Game.as:69
```

Rooms are embedded **OEL XML**, not behaviour classes. `loadlevel(_level:Class)`
(`Game.as:1920`) is **369 lines long, and `_level` appears in exactly two of
them** — the signature and `var file:ByteArray = new _level`. Everything after
`var xml:XML = new XML(str)` operates on `xml` alone.

⇒ the split is genuinely three lines, and no existing call site changes.

### 3.2 The persistence table's size and shape are hardcoded in three places

| fact | value | where |
|---|---|---|
| tags per level | **30** | `Game.as:525` — `public static const tagsPerLevel:int = 30` |
| level space | **116**, a compile-time `const` array of embedded assets | `Game.as:182-196` |
| the table | one flat `Array` of `levels.length * 30` booleans, all `true` | `Main.as:319-330` |
| index | `levelPersistence[i * tagsPerLevel + j]`, **no bounds check** | `Main.as:201-202` |
| polarity | `true` = still set; readers are `if (tag >= 0 && !checkPersistence(tag)) remove()` | e.g. `BreakableRock.as:50` |
| scope | `checkPersistence(tag, _l)` — the 2nd arg reads **another level's** slot | `Game.as:1843` |

Two consequences that decide this plan:

1. ⛔ **It is created ONCE, only `if (!SAVE_FILE.data.levelPersistence)`.** It
   lives in a SharedObject, so an existing save keeps its array forever. Only
   `SAVE_FILE.clear()` (`Main.as:206`) rebuilds it.
2. ⛔ **It is a plain `Array`, not a fixed `Vector`.** There is no RangeError to
   catch you: writes past the end silently extend it, and reads past the end
   return `undefined`, which the `:Boolean` return type coerces to **`false`** —
   which in this polarity means **cleared**. An out-of-range level therefore
   reads as *"every tagged entity already despawned"*.

⚠ That last point is a SOURCE READING, not a driven measurement, and it cannot
be driven today: a level is an entry in a compile-time `const` array, so the
real game cannot be pointed at an id outside it. It goes live the moment
external levels do.

⛓ The model in this repo defaults the OTHER way — `clearedByLevel` is a sparse
`Map` and `opts.cleared` is set only `if (clearedByLevel.has(n))`
(`levelRun.js:507, :641`), so an unknown level means *nothing cleared*. **Model
and game disagree, and the game's default is the unsafe one.**

### 3.3 Occupancy: 30 tags is not generous

Measured across all 120 `.oel` files: 79 use at least one tag; the busiest is
`Dungeon4/2.oel` with **23 distinct tags, highest value 24**. The vanilla game
comes within 5 slots of its own ceiling. Overflow does not error — `i * 30 + j`
with `j >= 30` writes into the **next level's** row, the same family as the
`tag = -1` out-of-band writes `outOfBandLedger.js` already models.

⇒ the `tset` allocator shipped in `2a407a817` (`tx * height + ty + 1`, which
reaches ~89 in a 10x10 room) **cannot serve `tag`**. The tag allocator must be
a small counter over `0..29` with an explicit refusal on exhaustion.

### 3.4 The transport already exists

`Bot.as` registers ~11 `ExternalInterface.addCallback`s (`Bot.as:732-751`,
including `botLoadTape`), and SWFRecomp shipped AVM2 EI
(`available`/`addCallback`/variadic `call`), gated on the page exposing
`window.__swfBridge`. A `botLoadLevels(bundle)` is the same shape as the
existing `botLoadTape`.

⚠ **UNMEASURED, and the first thing Phase 1 must settle:** EI string
marshalling cost and any practical size limit for a whole-set bundle. If it
does not take a bundle in one call, the manifest needs a chunking protocol —
which is a design change, not an implementation detail, so it is measured
BEFORE the schema is frozen.

### 3.5 What is keyed to level IDENTITY rather than to the table

The sweep: numeric `level ==` comparisons, literal `level =` assignments,
two-arg `checkPersistence`/`setPersistence`, `levels.length` uses, and arrays
parallel to `levels`.

| what | where | disposition |
|---|---|---|
| start level `= 0` | `Game.as:796` | → manifest |
| title rooms `[12, 37, 44, 87, 88, 89]` | `Game.as:449` (`menuLevels`) | → manifest |
| snow gradient `if (level == 45)` | `Game.as:908` | → manifest (or per-level flag) |
| music rule `level != 10` | `Game.as:1175, 1181` | → manifest |
| `levelMusics` | `Game.as:199` | → manifest; **parallel array, must match the set's length** |
| `setPersistence(0, false, 2)` | `Scenery/Moonrock.as:135` | cross-level WRITE — needs a symbolic name |
| `checkPersistence(0, 114)` | `Scenery/FinalDoor.as:50` | cross-level READ — needs a symbolic name |

⚠ **BOUNDED SWEEP.** This was found BY PATTERN. ~200 entity classes were not
read looking for room-specific behaviour, and the last two rows are exactly the
shape that hides from a grep — an entity class carrying a hard reference to a
room it does not own. **Phase 1 owes a by-name audit of the entity roster**, and
until it exists this table is "what the patterns found", not "all there is".

Also assuming the level count: **`Bot.as` bounds-checks ids against
`Game.levels.length` in three places** (`:965`, `:1577`, `:1852`). Ours to
change, but it must follow the table or the bot rejects valid ids.

---

## 4. The design

### 4.1 The level set is a manifest plus its rooms

One bundle, self-describing. A custom set is pushed over EI; the vanilla set is
the same shape built in (§4.3). Sketch — **the schema is frozen in Phase 2,
after §3.4's measurement, not here**:

```
{
  set_id:      "seedling-vanilla" | "procgen-2026-08-13-abc123",   // IDENTITY
  schema_version: 1,
  rooms: [ { id: 0, name: "OverWorld1", source: <oel string | embedded ref>, music: 0 }, … ],
  start:        { level: 0, x: …, y: … },
  menu_rooms:   [12, 37, 44, 87, 88, 89],
  named_rooms:  { watcherText: 114, moonrockTarget: 2 },   // §3.5's last two
  effects:      { snowGradient: [45] }
}
```

⛓ `source` is two-valued precisely because of §4.3's shape (c): a page-supplied
set carries XML text, the built-in vanilla set carries a reference to the
`[Embed]`ed asset, and **both resolve to XML before `loadLevelXML`, which has
one implementation.** The values above are the vanilla set's real ones — they
are §3.5's constants, which is what makes vanilla a set rather than a special
case.

`named_rooms` is the cure for `Moonrock.as:135` and `FinalDoor.as:50`: the
entity asks the manifest for *"the room the Watcher's text lives in"* instead of
naming 114. A set that defines neither simply has those entities behave as
"absent", **and must say so** rather than defaulting silently.

### 4.2 Replacement, and why it makes persistence SIMPLER

The mounted set is the ONE authority for the level table's length. So:

- the persistence table is sized from the **mounted set**, not from a compile-time constant;
- no id range is shared with the originals, so no collision question;
- every level in a custom set starts with all 30 tags free.

`Main.as:319`'s `if (!SAVE_FILE.data.levelPersistence)` becomes, in full:

> **if the save's `set_id` matches the mounted set — keep the table, and EXTEND
> it with `true` if it is short. If it does not match — rebuild it at the
> mounted set's size.**

⛔ **THE SAVE STAMP IS A PREREQUISITE, NOT A NICETY.** `SAVE_FILE.data` carries
`level`, `playerPositionX/Y`, `levelPersistence` and ~28 inventory booleans, and
**no level-set identity**. Load a save from set A under set B and the player
resumes at an index that means a different room, with a persistence table whose
rows describe different entities. Nothing errors; it quietly means something
else. A mismatch must force a fresh save and SAY SO — never reinterpret.

### 4.3 The vanilla set is a manifest too (⚖ user, 2026-08-13)

**There is no privileged built-in path.** The 116 original rooms are mounted as
a set — `set_id: "seedling-vanilla"` — through the same loader every custom set
uses, and the six constants in §3.5 become that manifest's fields rather than
literals in `Game.as`.

⛓ **THE POINT IS ANTI-ROT, and it is worth stating as the property being
bought:** a path exercised only by custom sets is a path that breaks silently
between the day it is written and the day someone uses it. Mounting vanilla
through it means **every boot of the ordinary game is a test of the level-set
loader**. That is why this is worth the extra indirection.

#### ⚠ The sub-fork it opens: where the vanilla ROOM DATA lives

Making vanilla a manifest does not by itself decide whether its OEL XML stays
`[Embed]`ed in the artifact. Three shapes:

| | vanilla room source | one loading path? | standalone artifact? | artifact size |
|---|---|---|---|---|
| (a) | the `[Embed]` Class, loaded as today | ✗ two arms, and the string arm is custom-only | ✓ | unchanged |
| (b) | stripped; the page must supply everything | ✓ literally one | ✗ **the wasm cannot boot alone** | smaller |
| (c) | the `[Embed]` Class, converted to XML through the SAME entry the page's strings use | ✓ one **loader**, two 3-line **resolvers** | ✓ | unchanged |

⚖ **TAKING (c)**, as the default a careful reader would pick — flagged here
because it is mine, not the user's, and it is cheap to overrule:

- it keeps the wasm **playable with no page**, which (b) gives up — and a
  standalone artifact is the thing every existing verify script and the public
  demo depend on;
- the rot risk it leaves is a **3-line resolver arm**, not the 366-line loader:
  `loadLevelXML` has exactly one implementation and vanilla exercises it on
  every boot;
- lazily converting one embedded `ByteArray` to a string at room-load time is
  **byte-for-byte the work `loadlevel` already does today** (`new _level` →
  `readUTFBytes`), so the cost is nil rather than 116 conversions at startup.

⛔ Honest residue: (c) is not literally "one path" — the embedded-asset arm
exists and only vanilla exercises it, while only custom sets exercise the string
arm. Each is three lines and both feed one consumer, so neither can drift far;
but *"the external path is the only path"* is true of (b) and only nearly true
of (c). Recorded so nobody later reads (c) as having bought (b)'s property.

### 4.4 The seams in the AS3

1. **Parse split** — `loadlevel(Class)` keeps its signature and becomes a
   3-line wrapper over a new `loadLevelXML(xml:XML)`. The 366-line body moves
   wholesale, unedited.
2. **Table indirection** — `levels[…]` is dereferenced in exactly two places
   (`Game.as:774`, `:798`); both go through the MOUNTED SET, which under §4.3
   is a manifest whether the rooms came from the page or from the embeds.
3. **Transport** — `botLoadLevels` beside `botLoadTape`, same shape.
4. **The vanilla manifest itself** — §3.5's six constants move out of `Game.as`
   into it. ⛔ This is the one seam that DELETES literals rather than adding
   beside them, so it lands last and alone.

### 4.5 ⛔ The cleanup policy: ADDITIVE ONLY

The model in this repo is a transcription of that AS3 source and cites it by
line: **1,847 `File.as:NNN` citations across 122 files** (measured
2026-08-13). Reflowing the original invalidates them **silently** — no test
fails, the citations simply stop pointing at what they claim, and the arc's
whole evidence standard rests on them being checkable. Every AS3 edit also costs
a full recompile plus re-verification.

⇒ **new functions appended, new fields at the end of declaration blocks,
existing bodies moved wholesale rather than edited.** The `loadlevel` split is
the one exception (it shifts 366 lines by one header) and therefore lands as
**its own commit**, so the citation shift is a single reviewable offset.

A genuine cleanup pass is a separate deliberate project with a
citation-rewriting script. It does not ride along with this feature.

---

### 4.6 Exit destinations become DATA, and the teleport API stops being needed

⚖ User, 2026-08-13: *"instead of the frontend using the teleport API to simulate
different exit destinations, we can change the data for the exit destinations
and skip the extra teleport."*

⛓ **THE TWO MECHANISMS ARE THE SAME LINE OF CODE**, which is what makes this a
deletion rather than a rewrite. `Teleporter.update()` (`Teleporter.as:88-95`):

```as3
FP.world = new Game(to, playerPos.x, playerPos.y);
Game.sign = sign;
```

and `flashPanel/games/seedling.json`'s `teleport` capability is
`new Game($level, $x, $y)` assigned to `net.flashpunk.FP.world` — **the same
constructor, the same assignment.** The frontend is re-doing, one beat late,
exactly what the teleporter already did.

So today a randomized exit costs **two world constructions**, and the wasted one
is not merely wasted:

- the player transiently exists in the vanilla destination, and `new Game` runs
  **every entity's `check()`** in that room. Those are not all pure —
  `TorchPickup.check` sets `doActions = false` and removes; `Teleporter` reads
  and `removeSelf` writes persistence; `Moonrock.as:135` writes ANOTHER level's
  slot. A room the player was never supposed to enter can leave state behind;
- it needs the frontend live and correct at every transition, which is a runtime
  dependency for what is really a static fact about the seed.

⇒ **Rewrite `to`, `playerx`, `playery` in the OEL data when the bundle is
built.** The game's own transition is then correct, the correction disappears,
and — worth stating plainly — **this needs NO AS3 change at all.** It is the
cheapest item in this plan and the only one that removes code.

#### ⚠ What must be rewritten WITH the destination

⛔ **`sign` is destination metadata and lives on the SOURCE teleporter.**
`Game.sign = sign` on the line below the transition, and the ctor comment says
it *"displays text in the room that this teleporter teleports to"*. Rewrite `to`
and leave `sign` and the new room announces the old room's name. It is a second
field carrying the same fact, and a rewrite that misses it is wrong in a way
only a human reading the screen would notice.

⚠ NOT affected, checked: `tag`/`invert` drive `checkDeactivated()` off
persistence and say nothing about the destination.

⛓ A side benefit worth not rediscovering: `watchEntrances.js` indexes entrances
by teleporter `to`, so a rewritten set's entrance index — and the "start
position comes from the level's ENTRANCES" feature built in Group B — follows
the randomization for free, with no special case.

#### The bound: this is STATIC, per set

The mapping has to be known when the bundle is built. That covers seeded
entrance randomization, which is what the teleport API is being used to simulate.
It does **not** cover anything that changes mid-run — an AP item that re-links
exits, or a server-side change after boot. ⇒ **the teleport capability is not
deleted, it is de-scoped**: it stops being the mechanism for static exit layout
and remains the mechanism for dynamic changes, if any are ever wanted. The
frontend still needs to KNOW the mapping for tracking and logic; it stops
needing to ACT on it.

⚠ Pairing and validity are the BUNDLE BUILDER's job, and their check belongs in
the Phase 2 schema: a set whose teleporter points past its own end, or whose
two-way pairing is inconsistent, must be refused at load. The game will not
check — `to` is passed to `new Game` unvalidated.

### 4.7 The toolchain, verified present 2026-08-13

Checked before planning further, because Phase 3 is unverifiable without it —
**every AS3 edit has to become a wasm before anything can be said about it.**

| step | where |
|---|---|
| the AS3 source | `~/CC/seedling`, branch **`bot`** @ `7514b96`, **clean** |
| AS3 → SWF | `~/CC/flex-sdk/bin/mxmlc` (playerglobal 11.1) |
| a working recipe | `~/CC/seedling_teleport_build/build_teleport.sh` — documents the flags, the NewgroundsAPI SWC, and the one-time `fix_embed_case.py` Windows→Linux `[Embed]` prep |
| SWF → wasm | `~/CC/SWFRecomp-CC/` (built artifact: `docs2/examples/avm2/seedling_teleport_ap/`, 31 MB, 2026-07-21) |

⚠ Two things that recipe implies and this plan has not settled:

1. It builds the **teleport variant** (patched `Main.as`, no preloader/splash).
   Whether Phase 3's verification uses that variant or a stock build is a
   choice, and the two boot differently.
2. **The AS3 work lands in a DIFFERENT REPO.** Commits go to `~/CC/seedling`
   on `bot`; pushing that branch is its own decision and is not covered by this
   repo's push-by-default rule.

---

## 5. Phases

- [ ] **Phase 1 — MEASURE, before any schema is frozen.**
  - [ ] EI bundle marshalling: cost and practical size limit for one call
        (§3.4). Decides whether chunking is in the schema.
  - [ ] By-name audit of the entity roster for room-specific behaviour, to
        close §3.5's bounded sweep.
  - [ ] Confirm the out-of-range read (§3.2) against the recompiled runtime
        rather than the AS3 semantics alone, if a harness can reach it.
- [ ] **Phase 2 — Freeze the manifest schema** (§4.1) against Phase 1's numbers.
      JSON Schema beside the other frontend schemas; a set that fails it is
      refused BY NAME at load.
- [ ] **Phase 3 — The AS3 seams** (§4.4), each its own commit: parse split;
      table indirection; `botLoadLevels`; `Bot.as`'s three bounds checks.
- [ ] **Phase 3b — Mount vanilla as a manifest** (§4.3, shape (c)): the
      embedded-asset resolver, the built-in `seedling-vanilla` manifest, and
      §3.5's six constants moving into it. ⛔ Lands ALONE — it is the only seam
      that deletes literals. **Its acceptance is that the ordinary game is
      byte-for-byte unchanged**: the committed tapes replay identically.
      ⛔⛔ **AND THE REPLAY MUST RUN IN THE BUILT ARTIFACT, THROUGH
      `botLoadTape` — NOT through the JS model.** The model in this repo does
      not execute one line of the AS3; it would replay every tape identically
      no matter what Phase 3b did to `Game.as`, so a model-side replay is an
      acceptance bar that CANNOT FAIL. (Caught 2026-08-13, in this document,
      before anyone ran it — the vacuity family, one more time.)
- [ ] **Phase 4 — Persistence + the save stamp** (§4.2). The `Main.as:319`
      rule, the `set_id` field, and the mismatch path that rebuilds loudly.
- [ ] **Phase 5 — The exporter**: emit a manifest from generated levels
      (`procgenSeedling` output → bundle), including the per-level metadata the
      manifest now owns.
- [ ] **Phase 5b — Exit destinations as data** (§4.6). Rewrite `to`, `playerx`,
      `playery` **and `sign`** in the bundle builder; add the pairing/range
      validation to the Phase 2 schema; de-scope `seedling.json`'s `teleport`
      capability to dynamic changes only. ⛓ **NO AS3 CHANGE** — pure data, and
      the only phase that removes a runtime dependency instead of adding one.
      Acceptance: a randomized set transitions with **one** `new Game` per exit
      (today it is two), and the destination room's sign text is the new
      destination's.
- [x] **Phase 6 — The tag allocator** — **DONE 2026-08-13**, see
      `procgen/seedling-bot.md` §"Every generated lock wrote the GOAL's
      persistence flag". Allocator is the RECORD (lowest free slot), not a
      counter and not the anchor; 12 of 24 post-sword levels shared a tag
      before, 0 after. ⚠ It also turned up a finding that is NOT this plan's:
      **the generator is not deterministic under load** — a solve over
      `wallClockMs` is converted from SUCCESS to a rejection
      (`procgenOracle:503`), so keeps flip under load. Recorded there; a fix is
      a design decision (tick-bounded budget) and is nobody's in passing.

Phases 1–2 gate 3–5b. Phase 6 was independent and is DONE.
⛓ **5b needs only the bundle builder** (Phase 5), not the AS3 seams, so it can
overtake Phase 3 if the manifest lands first.

---

## 6. Downstream, and why each needs the same stamp

Replacement invalidates these **silently**, which is the whole argument for
carrying `set_id` everywhere:

- **The AP mapping** (`frontend/modules/flashPanel/games/seedling.json`) — ~50
  locations, teleport coords, boss gating — is keyed to the original rooms.
  Under a replaced set it describes a game that is not loaded.
- **The model, the atlas and every committed tape** are about the original 116.
  A tape declares `boot.level` and `{level, tag}` clears; under a different set
  those are different rooms.
- **`tapeFormat.parsePersistence`** bounds `persistence[].level` to `0..115`
  while `boot.level` carries no bound — the measured residue that a generated
  level *can be booted by a tape and cannot be declared about by one*
  (`botDriverV1.js:393-417`). A set-aware bound is the natural fix, and it is a
  tape-format change guarding the real game's level space — **not one to make
  in passing**.
- **Teleporter `to`** values are data and travel with the set, but a set whose
  teleporters point past its own end needs validating at load; the game will
  not check.

The region atlas's `atlas_id` / `provenance` fields are the precedent to copy
rather than invent.

---

## 7. Open questions

1. Does EI take a whole bundle in one call? (Phase 1; decides the schema.)
2. Is there a third cross-level entity reference the pattern sweep missed?
   (Phase 1's audit.)
3. ~~Does the vanilla set ship AS a manifest?~~ ⚖ **DECIDED YES (user,
   2026-08-13)** — §4.3, Phase 3b. The sub-fork it opened (where vanilla's room
   DATA lives) is answered (c) on my recommendation, not the user's: embeds
   stay, the artifact stays standalone, and the residue is named in §4.3.
4. `TAGS_PER_LEVEL = 30` is defined twice in the model — `breakableRocks.js:60`
   and `tapeFormat.js:615`. Two constants that agree until one moves; worth
   collapsing while this area is open.
