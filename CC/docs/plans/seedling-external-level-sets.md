# Seedling External Level Sets — Plan

**Date:** 2026-08-13 ·
**Status: PLANNING for phases 2–5b (no code). ⛓ PHASE 6 DONE (2026-08-13) —
independent of the rest. ⛓ PHASE 1 DONE (2026-08-13) — all three measurements
taken against the recompiled runtime; see §8. Design settled with the user
(2026-08-13).**

⚖ **THE SCHEMA CAN NOW BE FROZEN**, and Phase 1 changed what it has to say:
it needs a **chunking protocol** (§8.1), it must carry **three** level-index
attributes rather than one (§8.2b), and it must treat an out-of-range level as
a hard error rather than trusting the runtime (§8.3).

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

⛓ **WRONG ON THE SECOND CLAUSE, AND THE READING IS NOW DRIVEN — see §8.3.** It
*can* be reached today, because `Bot.as` parses `bootLevel` and hands it to
`new Game` with no bounds check (`:1441`, `:1695`) while bounding
`persistence[].level` in the same parser (`:965`). Booted at level 116 in the
recompiled runtime the whole row reads `000…0` — everything already cleared —
with `load: ok`, `start: ok`, no error, and the VM still alive. Confirmed
against level-0 and level-115 controls.

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

⛓ **MEASURED 2026-08-13 — see §8.1. The answer is NO, and the reason is not
the one this section assumes.** A whole vanilla bundle aborts the runtime; the
limit is the AVM2 GC arena, not EI marshalling, and it is per-call rather than
cumulative. The schema needs chunking, at ≤16 rooms per call.

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

⛓ **DONE 2026-08-13 — see §8.2. The table above was incomplete in both
directions.** 151 classes read by name: the sweep missed **six more live
cross-level references in code** (two of them teleporters built at runtime, so
no data rewrite can reach them) and, more importantly, it missed that **level
indices also live in the LEVEL DATA** — three OEL attributes, 283 instances.
§4.6's rewrite list is a subset of what actually has to be rewritten.

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

⛔ **THE REWRITE LIST ABOVE IS A SUBSET — measured, §8.2b.** `to`/`playerx`/
`playery` also ride on **`<stairsup>`/`<stairsdown>`** (50 instances, `Stairs
extends Teleporter`); **`@fallthrough`** carries a level index on 12 rooms; and
**`@room`** on `<buttonroom>` carries one on 4. ⛔ And **two teleporters are
built in CODE, not data** — `LightBossController` → level 36, `TentacleBeast` →
level 58 — so **no data rewrite can reach them**; they need `named_rooms`
entries. "This needs NO AS3 change at all" holds only for the data-borne
exits.

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

1. ~~It builds the **teleport variant** (patched `Main.as`, no preloader/splash).
   Whether Phase 3's verification uses that variant or a stock build is a
   choice, and the two boot differently.~~ ⚖ **NOT A CHOICE — §8.** The teleport
   artifact contains **no `botLoadTape`**, so Phase 3b's acceptance cannot run
   on it. Verification uses a **bot** build; `seedling_bot_ap` is the one that
   exists (33.6 MB, 2026-08-09) and boots to registered callbacks in ~2.0 s.
2. **The AS3 work lands in a DIFFERENT REPO.** Commits go to `~/CC/seedling`
   on `bot`; pushing that branch is its own decision and is not covered by this
   repo's push-by-default rule.

---

## 5. Phases

- [x] **Phase 1 — MEASURE, before any schema is frozen. DONE 2026-08-13, §8.**
  - [x] EI bundle marshalling: cost and practical size limit for one call
        (§3.4). Decides whether chunking is in the schema. → **§8.1: chunking
        IS in the schema, ≤16 rooms/call.**
  - [x] By-name audit of the entity roster for room-specific behaviour, to
        close §3.5's bounded sweep. → **§8.2: 151 classes; 6 new code
        references and 3 DATA attributes the sweep could not see.**
  - [x] Confirm the out-of-range read (§3.2) against the recompiled runtime
        rather than the AS3 semantics alone, if a harness can reach it. →
        **§8.3: driven, confirmed, with controls.**
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
  in passing**. ⛓ **THE SAME ASYMMETRY EXISTS IN THE AS3, confirmed §8.3**:
  `Bot.as` bounds `persistence[].level` at `:965` and leaves `bootLevel`
  unbounded at `:1441`/`:1695`. It is one defect with two implementations, and
  §8.3 used it as the driver — fixing the JS side alone would leave the game
  bootable into a level that does not exist.
- **Teleporter `to`** values are data and travel with the set, but a set whose
  teleporters point past its own end needs validating at load; the game will
  not check.

The region atlas's `atlas_id` / `provenance` fields are the precedent to copy
rather than invent.

---

## 7. Open questions

1. ~~Does EI take a whole bundle in one call?~~ ⚖ **ANSWERED NO — §8.1.** The
   vanilla bundle is 1,676,662 B of JSON and the runtime aborts above
   ~1.27–1.35 MB in one call. Chunk at ≤16 rooms (~240 KB), proven over 15
   consecutive calls (8 are needed for 116 rooms).
2. ~~Is there a third cross-level entity reference the pattern sweep missed?~~
   ⚖ **ANSWERED — §8.2. There are six, plus a whole category the question did
   not anticipate: level indices carried in the OEL DATA.**
3. ~~Does the vanilla set ship AS a manifest?~~ ⚖ **DECIDED YES (user,
   2026-08-13)** — §4.3, Phase 3b. The sub-fork it opened (where vanilla's room
   DATA lives) is answered (c) on my recommendation, not the user's: embeds
   stay, the artifact stays standalone, and the residue is named in §4.3.
4. `TAGS_PER_LEVEL = 30` is defined twice in the model — `breakableRocks.js:60`
   and `tapeFormat.js:615`. Two constants that agree until one moves; worth
   collapsing while this area is open.

---

## 8. PHASE 1 — THE MEASUREMENTS (2026-08-13)

Taken on a quiet box (`/proc/loadavg` 0.10–0.27, 8 cores) against the REAL
recompiled artifact, not the model.

⛔ **THE ARTIFACT §4.7 NAMES IS THE WRONG ONE.** `seedling_teleport_ap`
(`docs2/examples/avm2/`, 31 MB, 2026-07-21) contains **no `botLoadTape`** —
`strings | grep -c '^botLoadTape$'` = 0. The build that carries `Bot.as`'s
control surface is `SWFRecomp/build_wasm_avm2/seedling_bot_ap/` (33.6 MB,
2026-08-09). ⇒ **§4.7's open question 1 is forced, not a choice**: Phase 3b's
acceptance runs the tapes "through `botLoadTape` in the built artifact", and
only a **bot** build has that entry point. All of §8 below used
`seedling_bot_ap`; it boots to registered callbacks in **~2.0 s**.

### 8.1 EI bundle marshalling — the schema needs CHUNKING

**The payload.** The vanilla set is **116 embedded rooms / 1,385,826 B** of OEL
XML (`Game.as:182-196`; four `.oel` files in the tree — `Island`,
`960x960Water`, `OverWorldN`, `Dungeon8/towerbase` — are **not** embedded, so
§3.3's "across all 120" denominator is 4 files wide). Every `.oel` is pure
ASCII, so UTF-8 bytes == characters. As one §4.1-shaped JSON bundle that is
**1,676,662 B (1.60 MB) — a 1.21× escaping inflation** over the raw XML.

**The path a bundle crosses**, read out of the shipped code — four copies
before a single room is parsed:

| step | where | cost |
|---|---|---|
| `lengthBytesUTF8(str)` | `ccall`, glue | full scan of the JS string |
| `stringToUTF8OnStack` → `stackAlloc` | glue | copy #1, onto the **8 MB shadow stack** (`build_wasm_avm2.sh:225`) |
| `strlen(arg)` | `avm2_external.c:388` | second full scan |
| `avm2_string_new(ctx, arg, len)` | `:388` | copy #2, into the AVM2 GC heap |
| `JSON.parse(json)` | `Bot.as:839` | the object graph |

**Measured, one fresh VM per point** (a ceiling cannot be measured after an
overflow: the build has **no stack cookie** — `checkStackCookie` /
`writeStackCookie` absent, ASSERTIONS off — and the first combined run proved
it, throwing `RuntimeError: memory access out of bounds` and leaving
`botStatus()` returning null, i.e. a dead VM, so every later datum in that page
was meaningless):

| arm | payload | result |
|---|---|---|
| valid tape, unpadded | 421 B | `"ok"` |
| tape + JSON-legal whitespace | up to **2,097,152 B** | `"ok"`, intact, VM alive |
| **real bundle, 64 rooms** | 1,100,682 B | parses (74 ms) |
| **real bundle, 80 rooms** | **1,264,992 B** | parses, 98 ms — **highest that survives** |
| **real bundle, 88 rooms** | **1,353,464 B** | **aborts** |
| **real bundle, 116 rooms** | 1,676,662 B | **aborts** |

⛓ **THE LIMIT IS NOT SIZE AND IT IS NOT EI.** 2 MB of *whitespace* crosses and
parses fine while 1.35 MB of *real structure* aborts — so the binding
constraint is the parsed object graph, not the bytes on the wire. The runtime
names its own cause:

```
[HEAP] Initialized: 0.5 GB reserved and committed
ERROR: heap_alloc(1203739) failed - out of memory
```

A 1.2 MB allocation failing inside a **0.5 GB** arena is an allocator/
fragmentation limit, not exhaustion — and at 88 rooms the *failing* allocation
is only 362,218 B, so parsing consumes a large multiple of the payload in the
arena. ⚠ Whether a GC pass between calls raises the ceiling is untested and is
a Phase 3 design question, not a Phase 1 fact.

**Cumulative total is NOT the limiter — which is what makes chunking viable:**

| chunk | calls | total parsed | result |
|---|---|---|---|
| 8 rooms (53,493 B) | 20 | 1,069,860 B | **survives**, 3.9 ms/call |
| 16 rooms (239,967 B) | 15 | 3,599,505 B | **survives**, 15.6 ms/call |
| 32 rooms (404,224 B) | 10 | 4,042,240 B | **aborts** (first call was fine) |

⇒ **DECISION FOR PHASE 2: the manifest carries a chunking protocol.** A safe
chunk is **≤16 rooms / ~240 KB per call**, demonstrated over 15 consecutive
calls — and 116 rooms needs only **8**, so the proven margin is ~2×. Whole-set
delivery in one call is off the table. ⚠ At 32 rooms the *first* call succeeds
and a later one dies, so a chunk size must be validated by REPETITION, never by
a single call.

### 8.2 The entity-roster audit — closing §3.5's bounded sweep

**What was read, by name:** all **144** classes under `src/Scenery` (42),
`src/Enemies` (30), `src/Puzzlements` (24), `src/Pickups` (21), `src/NPCs` (17)
and `src/Projectiles` (10), plus the **7** entity classes at `src/` root
(`Teleporter`, `Chest`, `Stairs`, `SealController`, `Message`, `PlayerLight`,
`DustParticle`) — **151 classes, ~15,100 lines.**

⚠ **WHAT THIS SWEEP BOUNDED, stated so the next reader does not have to guess.**
Five `src/` root files were NOT read line-by-line — `Game.as`, `Bot.as`,
`Main.as`, `Music.as`, `Inventory.as`, `Preloader.as`, `Splash.as`, `Rng.as`,
`QuickKong.as`, `Mobile.as`, `GetURL.as` — because they are not the *entity
roster* the debt was about. They were pattern-checked for `new Game(`,
`new Teleporter(`, two-arg persistence, `level ==`/`level =`, `levels.length`
and `levelMusics`; `Player.as` and `Splash.as` were the only hits and both were
then read in context (rows 4 and 6 below). `Game.as`/`Main.as`/`Bot.as` are
already itemised in §3.1–§3.5 and §8.3.

#### (a) Six live cross-level references in CODE that the pattern sweep missed

| # | where | what | why a grep could not see it |
|---|---|---|---|
| 1 | `Scenery/MoonrockPile.as:22` | `tag = 0;` — **hardcodes tag 0 and discards its own `_tag` parameter**, with **inverted** polarity (`if (tag>=0 && checkPersistence(tag)) remove()`, "false = there, true = not there"). It is the RECEIVER of `Moonrock.as:135`'s cross-level write. | carries no level number at all — the coupling is placement + a tag constant |
| 2 | `Enemies/LightBossController.as` `endState()` | `new Teleporter(x, y, **36**, 112, 96, true)` | a teleporter built **in code at runtime**, not a `level =` assignment |
| 3 | `Enemies/TentacleBeast.as` `createMouthEntrance()` | `new Teleporter(…, **58**, 56, 96)` | same |
| 4 | `Player.as:491` | `FP.world = new Game(**114**, 72, 128, false, 2)` — the dark-shrum death returns to the Watcher's room | constructor argument, not an assignment |
| 5 | `Pickups/Seed.as` | `FP.world = new Game(**1**, 64, 96, false)` — the bloody-seed ending | constructor argument |
| 6 | `Player.as:1827-1999` | **nine LIVE debug warps on keys 1–9**, each preceded by `Main.clearSave()`, to levels **2, 13, 12, 37, 45, 95, 12, 93, 110**. Only the `Key.E` block above them is commented out; these are not. The source's own comment reads *"For the love of god, please make sure you remove this."* | constructor arguments behind an input guard |

⛔ **2 and 3 are the ones that break §4.6.** That section rewrites exit
destinations **in the OEL data**; these two teleporters never appear in any
`.oel`, so no bundle rewrite can reach them. A replaced set must either keep
levels 36 and 58 meaning what they mean, or these become `named_rooms` entries
like `Moonrock`/`FinalDoor`.

⚠ **6 composes badly with §8.3.** A debug key wipes the save and jumps to level
110; under a 10-room custom set that index is out of range, and §8.3 says an
out-of-range level reads as *everything already cleared*, silently.

#### (b) The category the question did not anticipate: level indices in the DATA

`Game.as`'s loader reads exactly three OEL attributes that hold a **level
index**, and §4.6 names only the first:

| attribute | read sites in `Game.as` | instances in the corpus | values |
|---|---|---|---|
| `@to` | **3** — `<teleporter>`, `<stairsup>`, `<stairsdown>` | **221** teleporters + **50** stairs | any level |
| `@room` | 1 — `<buttonroom>` | 11 total, **4 cross-level** | 37, 39, 62, 63 |
| `@fallthrough` | 1 — level root | **12 rooms** | 0, 17, 21, 30, 31, 43, 49, 57, 69, 82, 84, 85 |

⛔ **§4.6 IS INCOMPLETE IN THREE WAYS**, all measured:
1. it names `<teleporter>` but **`<stairsup>`/`<stairsdown>` carry the same
   `to`/`playerx`/`playery` (50 instances)** — `Stairs extends Teleporter`;
2. it never mentions **`@fallthrough`** (12 rooms), the pit-fall destination
   (`Game.as:2125` → `Game.fallthroughLevel` → `Player.as:764`);
3. it never mentions **`@room`** on `<buttonroom>` — and that one is a
   cross-level **persistence WRITE**: `ButtonRoom.as` does
   `Game.setPersistence(t, persist, room)`, i.e. **it passes `tset` as the TAG
   in the target room**. The class comment says so outright: *"tset matches up
   with `tag` for objects in other rooms, not their tsets."* ⇒ `tset` and `tag`
   are separate namespaces **except** across rooms, where they are one — which
   the Phase 6 allocator must not violate (its `tset` allocator reaches ~89,
   far past the 30-tag ceiling).

#### (c) Other room-identity couplings worth a manifest field

- **`levelMusics` is MUTATED AT RUNTIME**, not static config: `BobBoss`,
  `BossTotem`, `FinalBoss`, `LavaBoss`, `ShieldBoss`, `TentacleBeast` and
  `LightBossController` all do `Game.levelMusics[(FP.world as Game).level] =
  Game.bossMusic` and reset it to `-1` on death. §3.5 lists it as a parallel
  array that must match the set's length — true, but it must also stay
  **writable**, so it cannot be frozen manifest data.
- **`sign` is an index into a fixed 7-element table**, not free text:
  `Message.as` holds `titles`, `subtitles` and two colour arrays of exactly 7
  entries, indexed by the teleporter's `sign` (`Teleporter` stores `_sign - 1`;
  measured: 80 teleporters carry `sign="0"` = none, and 5 carry 3/4/5/5/7).
  ⇒ a custom set cannot name a new region without touching `Message.as`. §4.6
  is right that `sign` must be rewritten with `to`; it does not say the value
  space is closed at seven.
- **`FinalBoss` consumes TWO consecutive tags** — `setPersistence(tag, false)`
  *and* `setPersistence(tag+1, false)` in `endAnim()`. The Phase 6 allocator
  hands out the lowest free slot per record; it does not know to reserve
  `tag+1`.
- **Hardcoded room GEOMETRY** in five classes, which a generated room of a
  different size silently breaks: `BossTotemShot.roomBottom = 384`
  (*"THE BOTTOM WALL OF THE ROOM TO DESTROY AT"*), `BossTotem.playerPosSet =
  (144,352)` and `maxYPosition = 352`, `LavaBoss` → `playerPosition = (152,176)`,
  `FinalBoss.podPositions` (four fixed points) and `new RockFall(120±4)`,
  `TentacleBeast.spawnRect = (16,96,176,96)`.
- **`Yeti.as`** writes `Game.setPersistence(1, false)` with the comment *"In
  order for this to work, the portal in DeadBoss.oel must have tag 1"* — a
  named-room coupling expressed purely as a tag literal.

### 8.3 The out-of-range persistence read — DRIVEN, and it is worse than §3.2 said

§3.2 called this undriveable "today". It is not: `Bot.as` parses
`bootLevel = int(t.boot.level)` (`:1441`) and passes it straight to
`new Game(bootLevel, …)` (`:1695`) **with no bounds check anywhere** — while
the very same parser bounds `persistence[].level` against `Game.levels.length`
(`:965`) and `tag` against `tagsPerLevel`. That asymmetry is the driver, and it
confirms §6's residue on the AS3 side too, not just in `tapeFormat`.

Boot a tape at each level, `seedling_bot_ap`, controls first:

| `boot.level` | `botLoadTape` | `botStart` | printed row | VM |
|---|---|---|---|---|
| 0 (control) | `ok` | `ok` | — | alive |
| 115 (control, last valid) | `ok` | `ok` | `111111111111111111111111111111` | alive |
| **116 (first invalid)** | `ok` | `ok` | **`000000000000000000000000000000`** | alive |
| **200** | `ok` | `ok` | **`000000000000000000000000000000`** | alive |

⇒ **CONFIRMED IN THE RECOMPILED RUNTIME.** An out-of-range level reads as
*every one of its 30 tags already cleared*, and the game **does not error, does
not crash, and reports itself healthy** — `botStatus()` answers normally at
level 200. It is silent in exactly the unsafe direction, and the model defaults
the opposite way (§3.2). The table's real size is also now a measured fact, not
a source one: the runtime prints `NO LEVEL PERSISTENCE: 3480` at boot (116 × 30).

⚠ **ONE TRAP FOUND WHILE MEASURING THIS, worth not re-finding.** The boot log
prints a row labelled `-1:` showing thirty **1**s, which looks like an
out-of-range read that contradicts the above. It is not: `Main.printItems`
reads `levelPersistence(Math.max(level, 0), i)` — **the printer clamps, so the
LABEL is the raw level and the DATA is the clamped one.** They disagree only
for negative levels; positive out-of-range levels are unclamped and the rows
above are genuine. A reader who trusted that line would have recorded a false
negative.
