# Seedling External Level Sets — Plan

**Date:** 2026-08-13 ·
**Status: PLANNING for phases 3–5b (no code). ⛓ PHASE 6 DONE (2026-08-13) —
independent of the rest. ⛓ PHASE 1 DONE (2026-08-13) — all three measurements
taken against the recompiled runtime; see §8. ⛓ PHASE 2 DONE (2026-08-13) —
the schema is FROZEN at `schema_version: 1`; see §9. Design settled with the
user (2026-08-13).**

⛓ **THE SCHEMA IS FROZEN — §9.** Phase 1 changed what it had to say, and all
three landed: a **chunking protocol** (§8.1), now split into a second document
so no authored set carries a delivery number; **three** level-index attributes
rather than one (§8.2b), all range-checked; and an out-of-range level as a
**hard error** rather than trust in the runtime (§8.3).

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
directions.** 151 classes read by name: the sweep missed **SEVEN more live
cross-level references in code** (the seventh found later, by Phase 3b — see
§8.2a) (two of them teleporters built at runtime, so
no data rewrite can reach them) and, more importantly, it missed that **level
indices also live in the LEVEL DATA** — three OEL attributes, **303**
instances. §4.6's rewrite list is a subset of what actually has to be
rewritten.

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

⚖ **TAKING (c) — RATIFIED BY THE USER 2026-08-13**, put to them explicitly at
the Phase 3 → 3b boundary because 3b is where the choice stops being cheap to
reverse. It began as a recommendation of mine rather than a ruling; it is now a
ruling, and (b)'s standalone-boot cost was the deciding factor. The reasoning
that earned it:

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
`playery` also ride on **`<stairsup>`/`<stairsdown>`** (52 instances, `Stairs
extends Teleporter`); **`@fallthrough`** carries a level index on 12 rooms, on
`<control>` elements that also carry **their own `@sign`** and an `@xOff`/
`@yOff` OFFSET rather than an absolute player position (`Game.as:2126-2129`) —
so the "rewrite `sign` with the destination" rule above applies to fallthroughs
too; and **`@room`** on `<buttonroom>` carries one on 4. ⛔ And **two teleporters are
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

⛔ **CORRECTED 2026-08-14 BY PHASE 5b — §15.1. The diagnosis above is right and
the rule it implies is not implementable, because `sign` is NOT a function of the
destination.** Measured over all 280 vanilla exits and all 12 fallthroughs: 8
signed transitions into 7 destination rooms, and **all 7 of those destinations
are ALSO entered by UNSIGNED exits**. If `sign` were a property of the room,
every entrance to room 13 would carry sign 1; one of three does. It is a property
of the TRANSITION — crossing INTO a region — so the implementable rule is
`sign(A→B) = region(B) when region(B) ≠ region(A), else 0`, with `region` an
INPUT. Vanilla names the region of 7 of its 116 rooms and says nothing about the
other 109, so there is no honest way to derive the map from the data.

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
   ⚖ **ASKED AND GRANTED 2026-08-13 for Phase 3's six commits** — `bot` pushed
   `7514b96..99c539c` (`PeerInfinity/Seedling`). ⛔ The rule itself is
   UNCHANGED and this grant does **not** generalise: it covered a named set of
   commits that were already written. A later slice asks again.

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
- [x] **Phase 2 — Freeze the manifest schema** (§4.1) against Phase 1's numbers.
      **DONE 2026-08-13, §9** — `1421523f8` (+ `0426eff9b` for §7 Q4). TWO
      schemas beside the other frontend schemas (the set, and a transport
      chunk), the authoritative validator, and the vanilla 116 committed as a
      fixture that validates clean. 53 tests, rejections first.
- [x] **Phase 3 — The AS3 seams** (§4.4), each its own commit: parse split;
      table indirection; `botLoadLevels`; `Bot.as`'s three bounds checks —
      **four**, see §10. **DONE 2026-08-13, §10**; five commits in
      `~/CC/seedling` on `bot`, ⛔ **not pushed** (§4.7 note 2).
- [x] **Phase 3b — Mount vanilla as a manifest** — **DONE 2026-08-13, §11.**
      Five commits in `~/CC/seedling` on `bot` (⛔ not pushed) + `022ad6ea3`
      here. Zero line shift (§11.1); the manifest gate found `new Array(45)`
      (§11.3); a seventh code-built room reference, whose arrival the frozen
      `roomRef` cannot carry (§11.4); both gates made to fail on purpose
      (§11.6). Original text follows.
      (§4.3, shape (c)): the
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
- [x] **Phase 4a — The moonrock widening** — **DONE 2026-08-14, §12.** ⚖ User
      ruling: widen `moonrock_target` to a `spawn` AND add the agreement rule.
      Split out of Phase 4 because it changes the content hash the save stamp
      keys on (`-367e679f` → `-02408e1d`), so it had to land first. Three
      commits here + `5129607` in `~/CC/seedling` (⛔ not pushed). It also
      found the extractor BROKEN since phase 3b (§12.3) and two persistence
      slots claimed by CODE (§12.4).
- [x] **Phase 4 — Persistence + the save stamp** (§4.2) — **DONE 2026-08-14,
      §13.** Two commits in `~/CC/seedling` (⛔ not pushed) + `8c15abbd1` here.
      ⛔ The rule could NOT live at `Main.as:319` (§13.1): a delivery arrives
      after boot, so it reconciles in `LevelSet`'s constructor instead. §4.2's
      "extend it with `true`" branch was unreachable as written and is replaced
      by the case that CAN happen (§13.2); a mismatch takes the whole save, not
      just the table (§13.4); an unstamped save is ADOPTED (§13.3); the
      receiver's capacity stopgap is gone (§13.6).
- [x] **Phase 5 — The exporter** — **DONE 2026-08-14, §14.** Five commits here,
      ⛓ **no AS3**. ⚖ User ruling: `named_rooms` requiredness is DERIVED from the
      room data (§14.1) — and the premise it was asked on was wrong, none of the
      six is dereferenced unconditionally, and `bloody_seed_ending`'s trigger is
      `<watcher>` not `<seed>` (the fourth "ask the consumer" in this arc). §5's
      own line was optimistic: the generator emits one room per call, all of them
      `level: 900`, as an Ogmo RECORD rather than OEL, with no exits (§14.2) —
      four findings about the GENERATOR. The round trip is 26/26 and its first
      version was vacuous (§14.4).
- [x] **Phase 5b — Exit destinations as data** (§4.6) — **DONE 2026-08-14,
      §15.** Six commits here, ⛓ **no AS3**. ⛔ The slice is EMIT as much as
      rewrite: §4.6 was written when vanilla was the only set, and a generated
      set has no exits to rewrite (§15.2). ⛔ §4.6's `sign` rule is WRONG as
      stated and is corrected above from the corpus (§15.1). The blocking number
      moved: **1/6 → 6/6 reachable**, and the round trip now WALKS the game
      through a door from the room data alone (§15.5). The sign half of the
      acceptance is asserted on the JS side and NOT driven, because no readout in
      this artifact can carry it — said out loud rather than faked (§15.5).
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
  ⛓ **MEASURED 2026-08-14 — see §6.1. It does NOT force more `named_rooms`, and
  the reason is a distinction worth keeping.**
- **The model, the atlas and every committed tape** are about the original 116.
  A tape declares `boot.level` and `{level, tag}` clears; under a different set
  those are different rooms.
- **`tapeFormat.parsePersistence`** bounds `persistence[].level` to `0..115`
  while `boot.level` carries no bound — the measured residue that a generated
  level *can be booted by a tape and cannot be declared about by one*
  ⚠ **STALE ON THE AS3 SIDE, as of Phase 3 — see §10.1's SEAM 4 and §14.4.**
  `Bot.as:1461` now bounds `boot.level` against `Game.levelCount()`, i.e. the
  MOUNTED set. The JS half below is still the vanilla 116 and still stands.
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

### 6.1 The AP-mapping residue — MEASURED 2026-08-14, and it is NOT `named_rooms`-shaped

Carried unmeasured through Phases 1–4 and **declined by five slices**, because
each correctly judged it outside its scope. Measured now, since Phase 5 is the
exporter and would otherwise emit sets against an unenumerated obligation.

**Denominator:** both artifacts read in full —
`flashPanel/games/seedling.json` (9,870 B) and `flashPanel/atlases/seedling.json`
(8,685 B). References found **by asking the consumer**, not by scanning key
names — which mattered, see the trap below.

| where | count | what it actually is |
|---|---|---|
| `region_coords` | **9** | a **debug teleport UI** (`flashPanelUI` dropdowns → `flashBridgeAdapter.teleportToRegion`) |
| `location_coords` | **11** | the same UI's item jump-list |
| atlas `map_ref` | **4** | region → level id (`0, 86, 2, 3`) |
| **total** | **24** | |

**Both tables are DERIVED, and both derivations were checked:**

- ⛔ **8 of the 9 `region_coords` are transcribed from `Player.as`'s debug-warp
  list — SEVEN of them from the block that is COMMENTED OUT in the game
  source.** `Rostef (30,64,128)` is *"Lighting the Path"*, `Lacste (40,400,432)`
  is *"Fall of the Totem"*, `Ghethis (113,64,80)` is *"Bloody"*, and so on; the
  names are `Message.as`'s seven `sign` titles. ⚠ `seedlingOgmo.js:20-25` claims
  these are copies of shipped exit data, citing two examples — **that
  generalisation is false: only 2 of 9 match any `(to, playerx, playery)` in the
  corpus** (`Owl's Nest`, `Gundernourd`). Two examples, one of each kind, and
  the comment generalised from the wrong one.
- **`location_coords` is exact and mechanical:** 11/11 name a level that really
  contains the right entity, `x` matches the entity **every time**, and `y`
  differs by **exactly one tile** — `+16` for ten, `−16` for `Conch` alone. It
  is "stand one tile off the item", not a hand-entered coordinate.

⇒ **NEITHER FORCES A `named_rooms` ENTRY.** `named_rooms` exists for references
**the game's own AS3 makes** that a replaced set cannot otherwise express — a
teleporter built at runtime, an ending destination. All 24 of these are the
**frontend describing the vanilla game to itself**, for a convenience UI and a
map. Under a replaced set they describe a game that is not loaded, but the cure
is to **regenerate or explicitly invalidate them per set** — both are derivable
from the set itself — not to widen a vocabulary the game reads.

⚖ ⇒ **This is a PHASE 5 obligation, not a schema one.** Whatever emits a set
must emit or invalidate these 24 alongside it; a set shipped with the vanilla
mapping still attached is a silent mismatch of exactly the kind §6 exists to
name. The `set_id` + content hash already built is the mechanism.

⚠ **THE TRAP, and it is the same one §8.2b found in the OEL data.** A scan for
keys named `level` finds **zero** in the atlas — its level ids are called
`map_ref`. `regionAtlasValidator.js:196` says it plainly: *"`map_ref` — a level
id"*. **A key-name scan answers "what is it called", never "what is it".** Ask
the consumer. That is now three times in this arc: `@fallthrough`/`@room` in the
OEL, and `map_ref` here.

## 7. Open questions

1. ~~Does EI take a whole bundle in one call?~~ ⚖ **ANSWERED NO — §8.1.** The
   vanilla bundle is 1,676,662 B of JSON and the runtime aborts above
   ~1.27–1.35 MB in one call. Chunk at ≤16 rooms (~240 KB), proven over 15
   consecutive calls. ⛔ **NINE chunks, not eight** — the "8" here was
   rooms-only arithmetic (116 ÷ 16). Measured against real data by Phase 3:
   **3 of the 9 chunks are BYTE-bound, not room-bound**, which is §9.1's
   rooms-AND-bytes rule showing up in the count.
2. ~~Is there a third cross-level entity reference the pattern sweep missed?~~
   ⚖ **ANSWERED — §8.2. There are six, plus a whole category the question did
   not anticipate: level indices carried in the OEL DATA.**
3. ~~Does the vanilla set ship AS a manifest?~~ ⚖ **DECIDED YES (user,
   2026-08-13)** — §4.3, Phase 3b. The sub-fork it opened (where vanilla's room
   DATA lives) is **also ruled now: (c), RATIFIED BY THE USER 2026-08-13** at
   the Phase 3 → 3b boundary, having started as a recommendation of mine.
   Embeds stay, the artifact stays standalone, and the residue is named in
   §4.3. ⇒ nothing in §4.3 is awaiting a ruling any more.
4. ~~`TAGS_PER_LEVEL = 30` is defined twice in the model.~~ ⚖ **DONE
   2026-08-13, `0426eff9b`.** `breakableRocks.js` is the canonical home
   (`procgenSeedling` and `outOfBandLedger` already imported from there);
   `tapeFormat` now imports and re-exports it. ⚠ `LEVEL_COUNT = 116` was
   deliberately NOT collapsed with the set size — §6 names that as a
   tape-format change guarding the real game's level space, "not one to make in
   passing". The mounted set can now supply a set-aware bound; taking it is its
   own decision.

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

#### (a) SEVEN live cross-level references in CODE that the pattern sweep missed

⛔ **THE SEVENTH WAS MISSED BY THIS AUDIT TOO, and the mechanism is worth more
than the row.** Phase 3b found `Scenery/Moonrock.as:134` (at `7514b96`):

```as3
FP.world.add(new Teleporter(stairs.x, stairs.y, 2, 48, 32));   // ← the seventh
Game.setPersistence(0, false, 2);                              // ← row 1's citation
```

A runtime-built teleporter with a hardcoded destination — **the identical shape
as rows 2 and 3 below**, one line above a line this audit *did* read, quote and
cite. It was not an unread file; the category was already defined and the text
was on screen. ⇒ **a line already cited for one reason stops being scanned for
others** — the finding shadows its own neighbourhood. When a hit lands, read the
lines *around* it as if they were untouched.

| # | where | what | why a grep could not see it |
|---|---|---|---|
| 1 | `Scenery/MoonrockPile.as:22` | `tag = 0;` — **hardcodes tag 0 and discards its own `_tag` parameter**, with **inverted** polarity (`if (tag>=0 && checkPersistence(tag)) remove()`, "false = there, true = not there"). It is the RECEIVER of `Moonrock.as:135`'s cross-level write. | carries no level number at all — the coupling is placement + a tag constant |
| 2 | `Enemies/LightBossController.as` `endState()` | `new Teleporter(x, y, **36**, 112, 96, true)` | a teleporter built **in code at runtime**, not a `level =` assignment |
| 3 | `Enemies/TentacleBeast.as` `createMouthEntrance()` | `new Teleporter(…, **58**, 56, 96)` | same |
| 4 | `Player.as:491` | `FP.world = new Game(**114**, 72, 128, false, 2)` — the dark-shrum death returns to the Watcher's room | constructor argument, not an assignment |
| 5 | `Pickups/Seed.as` | `FP.world = new Game(**1**, 64, 96, false)` — the bloody-seed ending | constructor argument |
| 6 | `Player.as:1827-1999` | **nine LIVE debug warps on keys 1–9**, each preceded by `Main.clearSave()`, to levels **2, 13, 12, 37, 45, 95, 12, 93, 110**. Only the `Key.E` block above them is commented out; these are not. The source's own comment reads *"For the love of god, please make sure you remove this."* | constructor arguments behind an input guard |
| **7** | `Scenery/Moonrock.as:134` | `new Teleporter(stairs.x, stairs.y, **2**, 48, 32)` — the stairs the moonrock unblocks | ⛔ **the line ABOVE a line this audit already cited** (row 1's `setPersistence(0,false,2)`); found by Phase 3b, not here |

⛔ **2, 3 and 7 are the ones that break §4.6.** That section rewrites exit
destinations **in the OEL data**; these three teleporters never appear in any
`.oel`, so no bundle rewrite can reach them. A replaced set must either keep
levels 36, 58 and 2 meaning what they mean, or these become `named_rooms`
entries like `Moonrock`/`FinalDoor`.

⛔ **7 CANNOT BE FULLY EXPRESSED BY THE FROZEN SCHEMA, and that is a real gap.**
Its destination now reads `moonrock_target`, but its **arrival position (48, 32)
stays a literal**: `named_rooms` entries are `roomRef` — `level` only, with
`additionalProperties: false` (§9). ⇒ **a custom set can move that room and
cannot say where in it the player lands.** The fix is to widen that ONE entry to
a `spawn` (`{level, x, y}`): backward-compatible, and it does not touch the
closed vocabulary the user ruled on — but it **changes the content hash**, so it
belongs with whoever next touches the save stamp. Recorded by Phase 3b rather
than taken, which was the right call on a frozen document.

⚠ **6 composes badly with §8.3.** A debug key wipes the save and jumps to level
110; under a 10-room custom set that index is out of range, and §8.3 says an
out-of-range level reads as *everything already cleared*, silently.

#### (b) The category the question did not anticipate: level indices in the DATA

`Game.as`'s loader reads exactly three OEL attributes that hold a **level
index**, and §4.6 names only the first:

| attribute | read sites in `Game.as` | instances in the corpus | values |
|---|---|---|---|
| `@to` | **3** — `<teleporter>`, `<stairsup>`, `<stairsdown>` | **228** teleporters + **52** stairs (26 up + 26 down) | any level |
| `@room` | 1 — `<buttonroom>` | 11 total, **4 cross-level** | 37, 39, 62, 63 |
| `@fallthrough` | 1 — **`<control>`** (`Game.as:2125-2129`) | **12 rooms** | 0, 17, 21, 30, 31, 43, 49, 57, 69, 82, 84, 85 |

**303 data-borne level references**, against **7** in code.

⛔ **CORRECTED 2026-08-13 by the Phase 2 session (`4b1d1b1d8`+), and the cause
is worth more than the numbers.** This table first read 221 teleporters / 50
stairs / "`@fallthrough` on the level root". Two errors:

1. **The counts were low because the glob was `*/*.oel`** — which silently skips
   the five `.oel` at `assets/levels/` root, **two of which are embedded**
   (`OverWorld.oel`, `Building1.oel`). ⚠ A sweep that names what it bounded can
   still be wrong about what it *reached*: the bound I declared was "the entity
   roster", and the miss was in the corpus glob, one directory level up.
   Re-counted over exactly the 116 embedded files by two independent methods
   (shell grep and a Python ElementTree walk) — both give 228/52.
2. **`@fallthrough` is on `<control>`, not the level root.** It travels with
   `@x`/`@y` **plus `@xOff`/`@yOff` (an OFFSET, summed at `:2126-2128` — not a
   `playerx`/`playery` absolute)** and its own `@sign`, read as
   `fallthroughSign = int(o.@sign) - 1`, the same `-1` convention `Teleporter`
   uses. ⇒ **§4.6's "rewrite `sign` with the destination" applies to
   fallthroughs too**, and the Phase 5b builder must look on `<control>`.

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
  entries, indexed by `sign` (stored as `_sign - 1`, so `sign="0"` = none).
  ⇒ a custom set cannot name a new region without touching `Message.as`. §4.6
  is right that `sign` must be rewritten with `to`; it does not say the value
  space is closed at seven.
  ⛔ **CORRECTED: `sign` rides on THREE element kinds, not one.** This bullet
  first reported "5 non-zero, values 3/4/5/5/7" from a **teleporter-only**
  census. Signs also ride `<stairsdown>` (one, `sign="1"`) and `<control>`
  fallthroughs (`sign` 2 and 6). The union of used values is
  **{1,2,3,4,5,6,7} — all seven entries of the closed table are exercised.**
  "Closed at seven" stands; "only five are used" did not, and a validator built
  on the smaller census would have refused legal vanilla data.
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

---

## 9. PHASE 2 — THE FROZEN SCHEMA (2026-08-13)

Landed in `1421523f8`; the §7 Q4 cleanup rode along in `0426eff9b`.

| what | where |
|---|---|
| the set document | `frontend/schema/seedling-level-set.schema.json` |
| one EI call | `frontend/schema/seedling-level-set-chunk.schema.json` |
| **the authority** | `frontend/modules/seedlingDemo/levelSetValidator.js` |
| 53 tests, rejections first | `frontend/modules/seedlingDemo/levelSetValidator.test.js` |
| the vanilla set + its reduced OEL | `frontend/modules/seedlingDemo/fixtures/seedling-vanilla-{set,room-refs}.json` |
| the extractor (independent parser) | `scripts/procgen/extract-seedling-vanilla-set.py` |

The `region-atlas.schema.json` + `regionAtlasValidator.js` split is copied
exactly, and the atlas's own description states the reason: **the schema is
DOCUMENTATION, the cross-reference rules are enforced authoritatively by the
module.** Almost every constraint §8 measured is the second kind. A set that
fails is refused **by name** and never coerced.

### 9.1 ⛔ TWO DOCUMENTS, because "bytes per call" is the wrong shape

⚖ **User, 2026-08-13, over the measuring session's objection — and the
objection was right.** §8.1 says the manifest needs a chunking protocol; it
does not follow that the *set* should carry one. What actually failed at 32
rooms was **repeated allocation in the arena** — the first call succeeded and a
later one died — and no per-call size can express that. So:

- the **set** document is transport-agnostic and carries no delivery number;
- a **chunk envelope** describes one EI call;
- `MAX_ROOMS_PER_CHUNK = 16` lives **beside the sender**, in the validator
  module, where the decision is made. Re-chunking edits no set.

Three additions from the measuring session, all taken:

1. ⛔ **Room `id` is AUTHORITATIVE, not chunk position.** A positional
   reassembly would absorb a delivery-order bug into a set shifted by one, and
   every `@to`/`@room`/`@fallthrough` would then point one room off **with
   nothing erroring**. `assembleLevelSetChunks` asserts the assembled ids are
   exactly `0..N-1`; `chunk_index` is pure bookkeeping.
2. ⛔ **A content hash, for the SAVE STAMP rather than for transport
   integrity.** §4.2's rule keys on `set_id`, which cannot detect an **edited
   set reusing its id** — the normal development case: regenerate a set, same
   id, different rooms, keep a persistence table whose rows describe entities
   that no longer exist at indices that now mean different rooms. `set_id` ends
   with the FNV-1a of the canonical document, so an edited set is a different
   set by construction, and a mismatch on either field forces a fresh save.
3. ⛔ **Mount only AFTER assembly.** A chunk that exceeds the arena kills the
   runtime mid-call, so an incremental mount leaves a **partial set mounted** —
   on which the game runs happily, every index past the end reading as already
   cleared (§8.3). Assemble → validate → mount, as one commit step.

Three refusals, also taken: no total-bytes declaration (bytes are not the
constraint, and putting them in the data re-imports the wrong model of the
failure where it will outlive everyone who knows better); no per-chunk hash
(the measured failure is an abort, not silent corruption, and a truncated chunk
already fails `JSON.parse`); no explicit terminator (`chunk_count` serves).

#### ⚠ 16 ROOMS ALONE IS NOT SAFE, AND IT BITES ON VANILLA

Measured here, prompted by the measuring session's caution that 16 is a *proxy*
for allocation volume on a corpus whose mean room is **11,946 B**:

| | bytes |
|---|---|
| vanilla's largest single room (`Dungeon4/2.oel`) | **135,847** |
| worst 16-room window **in set order** | **424,299** |
| the chunk size proven over 15 consecutive calls | 239,967 |
| the 32-room chunk that **ABORTED** | 404,224 |

⇒ a rooms-only bound would hand the runtime a call **larger than the one that
already aborted**, on the very corpus 16 was measured against. `planLevelSetChunks`
bounds on **rooms AND bytes, whichever binds first**, and a room larger than the
envelope is REPORTED rather than silently emitted. The test asserts that window
against the real per-room sizes the extractor records — not against the reduced
fixture XML, which would have been measuring the fixture instead of the game.
(Caught by the test failing: the first version asserted it against the reduced
form and got 7,813 B.)

### 9.2 What the validator enforces that JSON Schema cannot

Range-checked against the **mounted set** — every one of these is silent in the
game (§8.3): `start.level`, `menu_rooms[]`, all six `named_rooms`, `@to` on
`<teleporter>`/`<stairsup>`/`<stairsdown>`, `@fallthrough` on `<control>`, and
`@room` on `<buttonroom>`.

- **`sign` ∈ 0..7**, 0 = none, 1..7 indexing `Message.as`'s closed 7-entry
  table. Recorded as a bound, not widened.
- **tags ∈ 0..29**, and `<buttonroom>`'s **`tset` is checked against the TAG
  ceiling** when it targets another room, because `ButtonRoom.as:93` passes it
  as the tag THERE. A same-room `room="-1"` button is left alone — its tset is
  not a tag.
- **`named_rooms` is a CLOSED vocabulary, all six required** (⚖ user): the six
  code-built references no bundle rewrite can reach. Warp-shaped entries must
  carry `x`/`y`, so omitting them cannot silently fall back to the `Game`
  constructor's `(80, 128)`.
- **`music` ∈ -1..13.** `-1` is legal and means *the room's boss writes this at
  runtime* — confirmed from the data side: the seven statically `-1` rooms are
  exactly the seven boss rooms (19, 32, 43, 57, 69, 82, 112), which is §8.2c's
  list of seven mutators arriving independently.
- **Warnings, not refusals:** an unresolvable `embed` room is NAMED and counted
  (a set whose rooms could not be read must not look like one that passed); a
  one-way transition; a button that controls nothing; and (⚖ user) a set too
  small for the nine live debug warps, which reach level 110.

### 9.3 ⚠ THE RULE VANILLA CAUGHT — §4.3's anti-rot property, earning its keep

§8.2c says `FinalBoss` consumes `tag` **and** `tag+1` while the allocator
reserves one. The obvious validator rule is *"tag+1 must be free"*.

⛔ **That rule refuses vanilla.** `End/Boss.oel` is
`<finalboss tag="0"/>` beside `<rocklock tset="0" tag="1"/>` — the boss's second
clear is **what opens the rock lock**. `tag+1` is deliberately somebody else's.

⇒ the real constraint is only that **`tag+1` stays inside the room's own row**
(an error), with an unclaimed `tag+1` a *warning* — the boss clearing nothing.
The as-built in `procgen/seedling-bot.md` is right about the **generator**
hazard (an allocator handing `tag+1` to an unrelated entity is wrong); it does
not follow that the pairing is a defect in authored data.

⛓ **This is the whole argument for §4.3 in one example.** Making vanilla a set
like any other is not indirection for its own sake: a schema the real 116 cannot
satisfy is wrong, and building them as a fixture caught a rule that would have
broken the ordinary game on day one.

### 9.4 The fixture is produced by an INDEPENDENT parser

The extractor reads OEL with Python ElementTree; the validator reads it with a
regex (it is in the bundled browser graph). The committed fixtures are produced
by the first and consumed by the second, and the test asserts the regex parser
recovers the counts ElementTree measured — **228 / 52 / 12 / 11**. A verifier
sharing the generator's assumptions would have proved nothing about either.

⚠ **WHAT THE FIXTURE BOUNDS.** `seedling-vanilla-room-refs.json` is a REDUCED
OEL: every element bearing `@to`/`@fallthrough`/`@room`/`@tag`/`@tset`/`@sign`,
with the tile grid and untagged decoration dropped (37 KB rather than 1.38 MB).
It is a faithful projection of exactly the surface the validator reads **and of
nothing else** — it proves the real cross-reference graph validates; it does not
prove a room loads, and it is not a level. The real per-room byte sizes are
recorded separately for the same reason.

### 9.5 Mutation-checked, because a schema that accepts everything proves nothing

Five rules were disabled one at a time against the committed tests, tree clean
before and after:

| rule disabled | tests killed |
|---|---|
| spawn level range | 1 |
| `@to` range | 2 |
| assembled-id gap | 1 |
| `buttonroom` tset TAG ceiling | 1 |
| `named_rooms` closed vocabulary | 1 |

Control: 53/53. Every rejection asserts the reason it was refused **by name**,
so a rule that starts failing for the wrong cause fails here.

### 9.6 What Phase 2 did NOT do

- ⛔ **No AS3.** Phase 3 is the seams and it lands in `~/CC/seedling`. Nothing
  in this repo changed `Game.as`, and no build was run.
- **The schema is not wired to a loader.** Nothing calls `validateLevelSet` in
  production yet — Phase 3 (`botLoadLevels`) and Phase 4 (the save stamp) are
  its first callers. `levelSetSaveStamp`/`saveStampMatches` exist for Phase 4
  to use and are tested, but no save file carries a stamp today.
- **`seedling.json` and the region atlas were NOT audited.** §6 says both are
  keyed to the original rooms; whether the manifest must describe what *they*
  reference is unmeasured, and is the likeliest place `named_rooms` grows. It
  was named as unmeasured by the Phase 1 session and it still is.
- **Phase 5b's exit rewrite is validated, not implemented.** The pairing and
  range checks §4.6 asked for are in; rewriting `to`/`playerx`/`playery`/`sign`
  in a bundle is Phase 5b's own work — and it must look on `<control>` for
  fallthroughs, with the `@xOff`/`@yOff` offsets and their own `@sign`.

---

## 10. PHASE 3 — THE AS3 SEAMS (2026-08-13)

Six commits in `~/CC/seedling` on `bot`, on top of `7514b96`:

| commit | seam |
|---|---|
| `bc0c408` | 1 — the parse split, **alone** |
| `acba219` | 2 — the table behind the mounted set (+ new `src/LevelSet.as`) |
| `ba3b37b` | 3 — `botLoadLevels` / `botLevelSet` |
| `a6f6008` | 4 — all four level-id bounds |
| `6cf0a47` | the clamp's coherence follow-up |
| `99c539c` | a refusal names the value it conflicted with (found by §10.3) |

⛔ **NOT PUSHED.** §4.7 note 2 makes pushing `bot` an explicit user decision and
it has not been given.

### 10.0 ⛔ THE BUILD IS A PREREQUISITE, AND IT FAILED FIRST — on an UNCHANGED tree

Nothing here can be believed from the source, so the first thing built was the
**untouched tree**, before a line of AS3 was edited. Timings, quiet box
(`/proc/loadavg` 0.32, 8 cores):

| step | time |
|---|---|
| `build_bot.sh` (AS3 → SWF, 7,743,333 B) | **11.7 s** |
| `inject.py` (AP bridge → 9,730,706 B) | 0.2 s |
| `run-SWFRecomp.sh` (SWF → C; 705 classes, 3,811 methods, **0 verify failures**) | **5.7 s** |
| `build_wasm_avm2.sh` (C → wasm, 33,660,268 B) | **~19 min** |

⛔ **AND THE RESULT CRASHED THE TAB.** Through the same harness that boots the
shipped artifact, the rebuilt-unchanged-tree wasm reaches `__runtimeReady`,
takes the `#btn-start` click, and then the renderer process **dies** —
`page.evaluate: Target crashed` — before one `botStatus` callback registers. The
Aug-9 artifact boots to callbacks on the same harness, same page wrappers
(checked: the staged `game.html`/`swf_bridge_avm2.js` are byte-identical to the
templates they are generated from).

⚠ **THE CAUSE WAS MINE, AND IT IS THE ONE THE BUILD SCRIPT'S HEADER WARNS
ABOUT.** To save a cold build I seeded the new output directory with the Aug-9
`.o` cache (`cp -a`). `build_bot.sh` says it plainly: *"`FRESH=1` after any
define/struct-layout change: the `.o` cache keys on MTIME, not on flags."*
`SWFModernRuntime`'s sources moved between Aug 9 and today — `libswf/tag.h`,
`curve_flatten.h` and ~20 `.c` files are all newer than the control artifact —
so 62 of the 90 objects were compiled against headers that no longer describe
the structs the other 28 saw. The link succeeds; the page dies.

⇒ **the milestone earned its cost.** Found after the seams landed, the natural
reading would have been *"the seams crash the game"*. The Phase 3 artifact was
then built with **`FRESH=1`** and boots normally.

⇒ **the reusable rule, stated so the next session does not re-derive it:** an
`.o` cache is safe to reuse only when it was built against the CURRENT runtime
headers. Same-session incremental rebuilds are fine (this phase did one, and it
boots); a cache from an artifact days old is poison.

### 10.1 The four seams, and the line-number cost of each

**Seam 1 — the parse split** (`bc0c408`, alone). `loadlevel(_level:Class)` keeps
its signature and is three lines over a new `loadLevelXML(xml:XML)`. The body —
**364 lines**, `Game.as:1925-2288` — moved unedited, verified by comparing the
moved region byte-for-byte against the pre-edit file (md5 `bf588baa…` both
sides). §3.1's measurement held under the check the Phase 1 session asked for:
`_level`, `file` and `str` appear **only** at `:1920`, `:1922`, `:1923`, so
nothing below the signature depends on the caller having passed a `Class`, and
"moves wholesale" is a fact rather than a hope.

**Seam 2 — the table behind the mounted set** (`acba219`). `levels[…]` was
dereferenced at `Game.as:774` and `:798`; both now call `loadLevelIndex(int)`.
New file `src/LevelSet.as`; `Game.levelCount()` replaces `levels.length` as the
table's length.

**Seam 3 — the transport** (`ba3b37b`). `botLoadLevels` and `botLevelSet`, their
own callbacks on the `botMobiles`/`botSeam` precedent, so every existing
`botStatus` poller is byte-inert.

**Seam 4 — the bounds** (`a6f6008`). The plan said three; **it is four.** The
three that existed (`:965`, `:1577`, `:1852`) now ask `Game.levelCount()`; the
fourth had no check at all and is the one §8.3 drove.

#### ⚠ The line-number cost, declared — §4.5 is why this arc can be audited

Citations in the model, measured 2026-08-13 (`grep -rao 'Bot\.as:[0-9]\+'`):
**55** into `Bot.as`.

| file | rule | citations |
|---|---|---|
| `Game.as` | `NNN >= 1925` → **NNN + 19** | the seam-1 commit, alone |
| `Game.as` | seam 2 shifts **nothing** | — |
| `Bot.as` | `NNN < 752` unchanged | 9 |
| `Bot.as` | `752..1436` → **NNN + 9** | 17 |
| `Bot.as` | `NNN >= 1437` → **NNN + 29** | 29 |

⛓ **AND ONE READING OF §4.5 THAT TURNED OUT TO MATTER.** The policy says "new
fields at the END of declaration blocks". Taken literally, `Game.levelSetError`
belonged beside `tagsPerLevel` at `:524` — which would have shifted **every
citation below :524**, exactly as silently as the re-flow the policy forbids.
Appending at the end of the CLASS instead costs nothing and reads no worse.
⇒ **the property to protect is ZERO SHIFT, not the letter of the sentence.**
Seam 2's whole diff is three hunks, two of them same-length one-line
substitutions.

### 10.2 ⛔ THE OWNERSHIP SPLIT — the question this phase had to settle

`levelSetValidator.js` is JavaScript and cannot run inside the wasm.

⚖ **SETTLED: the two sides own DIFFERENT QUESTIONS, and the split is by
question rather than by rule.**

| | owns | examples |
|---|---|---|
| **sender** (`levelSetValidator.js`) | **is this set VALID** | level-index range on `@to`/`@fallthrough`/`@room`, the 30-tag ceiling, `ButtonRoom`'s tset-as-tag, the closed 7-entry sign table, `named_rooms` completeness, `music` range, the content hash |
| **receiver** (`LevelSet.acceptChunk`) | **did a whole, self-consistent delivery ARRIVE, and can this build SERVE it** | envelope shape, `schema_version`, one `set_id` per delivery, every `chunk_index` exactly once, dense room ids, `source.xml` present, the set fits the persistence table |
| **receiver** (`Game.loadLevelIndex` + `Bot`'s four bounds) | **is this INDEX in range where it is USED** | one comparison against `Game.levelCount()`, at four API boundaries and one choke point |

**Not one rule of the first row is re-implemented in AS3.** That is the whole
protection: two validators can only disagree about a rule they both hold, and
these rows hold none in common. The third row is not a validator — it is
strictly weaker than the first and implied by it, so a set the sender passed can
never trip it.

⛔ **THE ONE RULE BOTH SIDES DO HOLD IS ASSEMBLY, AND IT CANNOT BE AVOIDED:** the
sender assembles a batch it already has (`assembleLevelSetChunks` takes an
array); the receiver must assemble a **stream**, one EI call at a time, deciding
on each call whether the delivery is complete. So assembly is pinned to a
**shared fixture** — `fixtures/seedling-level-set-delivery-conformance.json`, 16
cases, 3 that must mount and 13 that must not — and both sides run against it:

- sender: `levelSetDelivery.test.js` (vitest, 21 tests);
- receiver: `probe-seedling-level-set-transport.mjs`, the same cases through the
  built artifact.

⛓ **THE VERDICT COMPARED IS "DOES A SET GET MOUNTED", AND ONLY THAT.** Reasons
are not compared — each side words its own, and a wording difference is harmless
where a verdict difference is the failure. Every case records
`would_mount_without_the_rule`: what a receiver lacking that one rule would do,
so the battery says out loud what makes each case able to fail. Neither half
proves parity alone.

⚠ **ONE DECLARED DIVERGENCE**, marked `receiver_only`: a room whose `source` is
an `embed` reference. The sender calls it valid and merely unchecked; this build
has no embedded-asset resolver until phase 3b, so it refuses the delivery. That
is *servable*, not *valid* — and the capacity refusal below is the same shape.

### 10.3 The probe, and what each arm would have to do to go red

⛔ **DRIVEN ON REAL-GPU WINDOWS CHROME, NOT WSL HEADLESS** (⚖ user). The arc
already had the number: `seedling-bot-replay-win.py`'s header and
`probe-seedling-r5-mobiles.mjs:96` both record **~0.5 fps headless against
~3.6 fps on the real-GPU rig**, and WSL's Chromium is SwiftShader. What I saw
before switching is consistent with it and is stated as what it is rather than
as an fps: over five seconds of a running tape the bot's `tick` never left 0.
⇒ every arm that waits for a world to be built would be waiting on a software
rasteriser, and any comparison of what a room BUILT would be a race against
machine load.
`seedling-level-set-win.py` is the dumb driver on `seedling-bot-replay-win.py`'s
precedent; every verdict stays in the `.mjs`. Adapter reported by the run:
**`intel / gen-9`**. 25 arms, **one fresh page each** (no stack cookie: after one
abort every later reading in a page is fiction), **all pass**.

| arm | result | what would make it red |
|---|---|---|
| 1. control, nothing delivered | `mounted: null`, `rooms: 116 = built_in`, `capacity: 116`, `error: ""` | a mount that happens without a delivery |
| 2a. `boot.level` 115 | `ok` | a bound that refuses valid levels |
| **2b. `boot.level` 116** | **`error:boot.level 116 is not a level (0..115)`** | §8.3's measured `ok` — this is the regression closed |
| **2c. 5-room set mounted** | `boot 4` → `ok`; **`boot 5` → `error:boot.level 5 is not a level (0..4)`** | a bound reading `Game.levels.length` instead of the mounted table — level 5 EXISTS in vanilla |
| 3. the 16 conformance cases | **16/16 verdicts match the sender** | any rule missing on the receiver; each case names what it would mount without it |
| **4. the real vanilla 116 as XML** | 1,385,826 B of OEL → **9 chunks**, 0 oversized, mounts as `seedling-vanilla-367e679f`, `rooms: 116` | the arena failing on RETENTION rather than on one call |
| 5a. rooms 0 and 5 (controls) | distinct rosters, **3 vs 4 mobiles** | identical fingerprints ⇒ 5b is abandoned, not passed |
| **5b. room 5 carrying room 0's XML** | booting level 5 builds **room 0's roster** | `loadLevelIndex` still reading the `[Embed]` array |
| 6. 117 rooms | `error:set has 117 rooms but the persistence table addresses 116` | a set mounting past the table, whose rows read as *already cleared* |

⛓ **ARM 4 IS NEW INFORMATION, not a re-run of §8.1.** §8.1 proved 15 chunks can
CROSS while nothing kept the rooms; the receiver now RETAINS the whole set in the
arena, and it survives. ⚠ Note the chunk count: **9, not the 8 §8.1 predicted** —
the sender's planner binds on rooms **and bytes**, and the byte bound adds a
chunk on real data. That is §9.1's "16 rooms alone is not safe" showing up in the
count.

⚠ **ONE DEFECT THIS PROBE FOUND IN MY OWN CODE.** The first build refused a
spliced delivery with `chunk.set_id "other-bbbbbbbb" disagrees with "null"` —
`resetStaging()` had already nulled the staged id, and AS3 evaluates the return
expression after the call. Right verdict, useless reason. Fixed by reading the
open delivery's values into locals first, and the fixture now carries
`receiver_reason_must_contain` for the two cases, so a refusal that stops naming
what conflicted fails the probe. Re-run on the rebuilt artifact: **27/27**, the
reasons now reading `disagrees with "conformance-aaaaaaaa"` and
`disagrees with 2`.

⚠ **AND A BUILD DATUM WORTH KEEPING.** That rebuild was INCREMENTAL over the
`.o` cache the FRESH build had just produced in the same session — an ABC-only
change — and it boots and passes every arm. The `project_seedling_bot_r1` memory
records the same shape failing once (`heap_alloc(711162896)` before the
callbacks registered), so the rule is *verify an incremental build, never trust
it*; what is reliably poison is a cache older than the current headers (§10.0).

### 10.4 What Phase 3 did NOT do, and what a set therefore still cannot do

- ⛔ **No phase 3b.** Vanilla's rooms are still `[Embed]`ed classes reached by
  the `LevelSet.mounted == null` arm, and §3.5's six constants are still
  literals in `Game.as`. Nothing here deleted a literal, deliberately.
- ⛔ **No phase 4.** `Main.as:319` still sizes the persistence table from
  `Game.levels.length` and the save carries no `set_id`. The receiver's capacity
  refusal is a **stopgap phase 4 removes**, not a design.
- ⚠ **A MOUNTED SET REPLACES ROOMS AND NOTHING ELSE.** `menuLevels`, `start`,
  `named_rooms`, `levelMusics`, the snow-gradient room and the music-exempt room
  are all still vanilla's literals ⇒ mount a set of fewer than 90 rooms and the
  TITLE SCREEN references rooms that do not exist. The backstop clamps and names
  each one; this build boots straight into play so it does not bite here, but a
  custom set is not *playable* until phase 3b.
- ⚠ **A mount does not reload the world the player is standing in.** Deliver
  before `botStart`.
- ⚠ **The JS half of the boot-level asymmetry is still open.**
  `tapeFormat.parsePersistence` bounds `persistence[].level` to `0..115` while
  `boot.level` carries no bound (§6). The AS3 half is closed; the JS half is a
  tape-format change guarding the real game's level space and is not one to make
  in passing.
- ⚠ **Nothing in production delivers a set.** `botLoadLevels`' only caller is the
  probe; the producer is phase 5.
- ⚠ **Still unmeasured, inherited from §9.6:** whether
  `flashPanel/games/seedling.json` and the region atlas force more `named_rooms`.

⛓ **ONE HAZARD THIS PHASE DEFUSED WITHOUT BEING ASKED TO.** §8.2a item 6 — the
nine live debug warps on keys 1–9, jumping to levels up to 110 after
`clearSave()` — was recorded as composing badly with §8.3: under a small custom
set those indices would read as *everything already cleared*, silently. They now
go through `loadLevelIndex`, so they clamp, name the refusal and move `level`
with the room that really loaded. ⚠ **UNTESTED, and not testable through a
tape:** `Bot.keyCodeFor` is a closed eight-name vocabulary with no digits in it
(`Bot.as:626`, by design). Driving it needs a real browser keypress, which no arm
here makes.

### 10.5 Gates

- `npx vitest run frontend/modules/seedlingDemo/` — **3775** (3754 + the 21 new
  sender-side conformance tests).
- `solve-seedling-r8-battery.mjs --check` md5 **unmoved** at
  `1fedb0ab35b7cd74accecf0345bdc893`.
- The eleven `check-seedling-editor-*.mjs` were **not** run: this phase touched
  no editor code, no procgen module and no page. What it was verified by instead
  is §10.3, in the built artifact.

---

## 11. PHASE 3b — VANILLA AS A MANIFEST (2026-08-13)

Five commits in `~/CC/seedling` on `bot`, on top of `99c539c`, plus one in
Archipelago-CC. ⛔ **NOT PUSHED** — §4.7 note 2 makes pushing `bot` an explicit
user decision, and the grant given for phase 3's six commits covered those and
does not generalise.

| commit | what |
|---|---|
| `3129d08` | `VanillaSet` + `LevelSet.active()`/accessors — **additive**, nothing deleted |
| `5aba06c` | **the deletion**: §3.5's eight sites in `Game.as` |
| `35aee24` | the six code-built room references — and a **seventh** nobody had found |
| `76c9b7d` | `botLevelSet` reports the manifest, so the deletion has a witness |
| `08a6ff0` | `new Array(45)` is forty-five empty slots — **found by the gate** |
| `022ad6ea3` (AP-CC) | `check-seedling-vanilla-manifest.mjs`; `SEEDLING_PAGE` on the differential |

### 11.1 ⛓ THE DELETION COST NOTHING — zero line shift, verified

§4.5 forbids reflowing `Game.as` because the model cites it by line (1,847
`File.as:NNN` citations across 122 files) and a shift invalidates them
**silently**. Phase 3 corrected the policy's reading to *zero shift* (§10.1).
This phase is the one that DELETES, and a deletion cannot append its way out —
so each site was replaced **in place at the same line count**: the 15-line music
literal by a 15-line docblock saying where the data went, seven one-line sites
by one line each, and the six entity-class cures likewise.

Verified rather than intended, from `git diff -U0` hunk headers:

```
@@ -199,15 +199,15 @@   @@ -449 +449 @@   @@ -774 +774 @@   @@ -796 +796 @@
@@ -908 +908 @@   @@ -1175 +1175 @@   @@ -1181 +1181 @@   @@ -1294 +1294 @@
Moonrock.as @@ -134,2 +134,2 @@   FinalDoor @@ -50 +50 @@   Player @@ -491 +491 @@
Seed @@ -73 +73 @@   LightBossController @@ -104 +104 @@   TentacleBeast @@ -213 +213 @@
```

The first size-changing hunk in `Game.as` is at `:2338`, inside the block phase
3 appended today; `Bot.as`'s are at `:3263+`, likewise. ⇒ **the offset table
this phase owes is EMPTY.** Every citation into the original source still points
at what it names. That is a better outcome than §4.5 anticipated, and it is
available to any future deletion that is willing to spend the removed lines on
saying where the data went.

### 11.2 What the manifest is, and what shape (c) actually looks like

`VanillaSet.as` holds §3.5's table as data: `MUSICS` (the `Game.as:199` literal,
**moved, not retyped**), `MENU_ROOMS`, `START_LEVEL`, `SNOW_GRADIENT_ROOMS`,
`MUSIC_EXEMPT_ROOMS`, `NAMED_ROOMS`. `LevelSet.active()` answers with the
delivered set or, when nothing was delivered, with `VanillaSet.build()` — so
`LevelSet.mounted == null` no longer means *no set*, it means *nothing was
delivered*, and the ordinary game walks the level-set loader on every boot.

⛔ **THE TWO RESOLVERS ARE THREE LINES APART AND `loadlevel` IS UNCHANGED.**
`LevelSet.embedFor(index)` says WHICH compiled-in `Class`; `Game.loadlevel(Class)`
— the original's own three lines, untouched since phase 3 — converts it; a
delivered room's `source.xml` reaches `loadLevelXML` directly. One loader, two
resolvers, exactly as §4.3 (c) describes.

⚠ **The built-in manifest's `source.embed` is a `Class`, not the schema's
asset-path string.** A path is what a Class is *before* mxmlc runs; this build
cannot resolve a path at all, which is why a DELIVERED set carrying `embed`
is still refused (the `receiver_only` divergence §10.2 declared is unchanged).
And the AS3 manifest carries **no room names** — the twin does; nothing in the
game reads them, position being identity.

⚖ **`levelMusics` was the predicted argument and it resolves as
seed-and-copy.** It cannot be frozen manifest data (seven boss classes assign it
at runtime, 14 sites) and it cannot stay a literal. So `LevelSet`'s CONSTRUCTOR
copies the manifest's per-room `music` into `Game.levelMusics` — exactly once
per set becoming real, for both arms, so a mount that forgot to seed cannot
exist; and a COPY, never an alias, or a boss fight would rewrite the set itself.
It is state initialised from data, and the readout reports both halves.

### 11.3 ⛔ THE GATE FOUND A DEFECT NO TAPE OR TEST COULD HAVE

First run of `check-seedling-vanilla-manifest.mjs` against the first 3b build:

```
FAIL: SNOW: hasSnowGradient picks out the twin's rooms — [] vs [45]
FAIL: MUSIC EXEMPT: isMusicExempt picks out the twin's rooms — [] vs [10]
```

**`new Array(45)` in AS3 is forty-five empty slots**, not `[45]`. `indexOf(45)`
was -1, every room's flag came out false, and Dungeon5's entrance had silently
lost its snow gradient while Dungeon1_8 had lost its music exemption. The
sibling literals are safe **by accident**: `new Array(12, 37, …)` and the
116-entry `MUSICS` have more than one argument.

⛓ **NEITHER A TAPE NOR A VITEST COULD HAVE SEEN IT.** A snow gradient is an
alpha multiplier and a music exemption picks a song; neither is a position, a
level or an entity, so neither appears in an observation stream. It was caught
only because the manifest is read back OUT of the wasm and compared with a
document produced independently from the OELs by a different parser. That is
§4.3's anti-rot argument paying for itself on the day it was written — the
second time in this arc, after §9.3.

⚠ **AND THE CHECKER'S FIRST VERSION FAILED SIX MORE, ALL OF THEM WRONG.** It
compared `named_rooms` with `JSON.stringify`; AS3 serialises keys in its own
order (`{y, x, level}`), so six correct values read as failures. **A checker bug
reads exactly like a defect in the thing under test**, and the only reason it
cost minutes rather than a rebuild is that each failure printed the values it
disagreed about. Now compared field by field.

### 11.4 A SEVENTH code-built room reference, and one the schema cannot express

`Scenery/Moonrock.as:134` — `new Teleporter(stairs.x, stairs.y, 2, 48, 32)`,
one line above the persistence write §3.5 already listed. A teleporter **built
at runtime with a hardcoded destination**, which is exactly the shape of §8.2a
rows 2 and 3, and it is in neither §3.5's pattern sweep nor §8.2's by-name audit
of 151 classes. Its level now reads `moonrock_target`.

⛔ **ITS ARRIVAL POSITION CANNOT BE EXPRESSED.** `moonrock_target` is a
`roomRef` in the frozen schema — `level` alone, `additionalProperties: false` —
so `(48, 32)` stays a literal in `Moonrock.as`. A custom set can move that room
and cannot say where in it the player lands. ⇒ **the fix is to widen that one
entry to a `spawn`**, which is backward-compatible and does not touch the closed
vocabulary the user ruled on. Not taken here: it is Phase 2's document and it
changes the content hash, so it belongs to phase 4 or a deliberate amendment.

### 11.5 ⚠ THREE OF THE EIGHT DELETED SITES CANNOT EXECUTE IN THIS ARTIFACT

`Main.as:50` sets `Game.menu = false` and `:51` boots `new Game(0, 80, 128)`.
So the title-screen path (`menuRoom`, `menuRoomCount`) and the new-game path
(`applyStart`, reached only when `level < 0`) are **dead in the bot build**, and
no tape can reach them either — `Bot` always boots an explicit level.

⇒ the readout was rebuilt to call the ACCESSORS rather than report `meta`, which
converts "the data survived the move" into "the code that reads it returns the
right answer". What remains unexercised is the one-line call-site substitution
in `Game.as` for those two paths, which is visible in the diff and nowhere else.
`applyStart` cannot be called from a readout at all — it mutates a `Game` — so
`start_level` exercises the getter it is built on. **Stated because a gate that
runs 153 tapes and 24 assertions looks like it covered everything.**

### 11.6 ⛔ BOTH GATES WERE MADE TO FAIL ON PURPOSE

§5's acceptance was written knowing this family: a model-side replay would pass
no matter what phase 3b did. So neither gate was trusted until it had been
observed going red. **One mutant build, two independent defects, no overlap:**

| mutation | what it breaks | which gate must go red |
|---|---|---|
| **M1** `MUSICS[100]` 12 → 7 | manifest data for a room **no tape enters** | the manifest gate, only |
| **M2** `embedFor(3)` → room 0's Class | the resolver for a room **14 tapes enter** | the tape sweep, only |

Measured, on the mutant artifact:

```
FAIL: MUSICS: the manifest equals the twin — index 100: 7 vs 12
FAIL: MUSICS: Game.levelMusics was SEEDED from it — index 100: 7 vs 12
   (the other 22 manifest assertions PASS — M2 does not disturb them)

FAIL: r7-act2-3: live game matches the committed oracle stream
      — tick 1 differs: expected (x=72, y=24.8, level=3), got (x=72, y=24)
PASS: diagonal-run, friction-stop  (level 0 only — the controls)
   (M1 reddens no tape at all)
```

⛓ **AND ONE DATUM THE DESIGN DID NOT ASK FOR.** `r7-act2-2` enters level 3 at
its FINAL tick and **passes** on the mutant: the wrong room's geometry had not
yet moved the player. Touching a broken room is not the same as playing in it,
which is worth knowing before reading any tape's level list as coverage.

### 11.7 The denominator, and what it does NOT cover

⚠ **153 tapes, `--tier=full`, every one of them** — the whole committed roster,
not a subset. Cost measured from the checkpoint history before choosing:
~150 minutes of serial browser replay, which is affordable in the background
and therefore not worth bounding.

⛔ **BUT THE ROSTER ENTERS ONLY 73 OF THE 116 ROOMS.** Measured over the
committed expectation streams: 43 rooms are entered by no tape at all (14, 15,
17, 25–28, 33–36, 52, 54–58, 66, 69, 70, 72, 73, 81, 86, 88, 90, 93, 96–111).
So a green sweep says *the resolver served 73 rooms correctly*, not *116*. The
manifest gate covers all 116 rooms' music and flags, and phase 3's arm 4 mounts
all 116 as XML — but nothing in this phase PLAYS the other 43. Stated because
"all 153 tapes pass" reads like total coverage and is not.

⛓ **AND "BYTE-FOR-BYTE UNCHANGED" IS NOT WHAT WAS VERIFIED.** §5's phrase is
stronger than what any gate here measures. What was measured is: **every
committed tape's observation stream is identical to its oracle recording**, tick
by tick, position by position, plus the manifest readout matching its twin. The
game's rendering, its audio, and the 43 unvisited rooms are outside that claim.

### 11.8 Gates

- `check-seedling-vanilla-manifest.mjs` — **24/24**, in the built artifact.
- `probe-seedling-level-set-transport.mjs` (phase 3's, re-run on this build) —
  **ALL ARMS PASS**, 25 arms, one fresh page each. The receiver did not regress,
  and arm 5b still shows a delivered set's XML is what loads.
- `verify-seedling-bot-differential.mjs --win --tier=full` — **153/153 tapes,
  3,541 checks, 0 failures, `ALL CHECKS PASSED`**, ~2h35m of serial replay on
  the real-GPU rig (`intel / gen-9`, 26–28 fps). Every tape's `live game matches
  the committed oracle stream`. The 43 `SKIP` lines are the roster's own
  declared abstentions (staged-chain custody, the R8 goal ledger) and are
  printed *because* an absence must be reported — none of them is this phase's.
  ⛓ **The expectations were recorded from a PRE-PHASE-3 artifact**, so a green
  sweep here clears phase 3's four seams and phase 3b's deletion together, which
  is a stronger claim than the baseline-vs-treatment comparison that was
  budgeted for. No baseline run was needed: attribution only costs anything when
  something is red.
- `npx vitest run frontend/modules/seedlingDemo/` — **3775**, unmoved from
  phase 3.
- `solve-seedling-r8-battery.mjs --check` md5 **unmoved** at
  `1fedb0ab35b7cd74accecf0345bdc893`.
- The eleven `check-seedling-editor-*.mjs` were **not** run: no editor code, no
  procgen module and no page changed. ⚠ Neither the vitest count nor the md5
  can move for an AS3-only change — they are here to show nothing ELSE moved,
  and they prove nothing about this phase.

### 11.9 What phase 3b did NOT do

- ⛔ **No phase 4.** `Main.as:319` still sizes the persistence table from
  `Game.levels.length`, the save still carries no `set_id`, and the receiver's
  capacity refusal is still the stopgap §10.4 named.
- ⛔ **A delivered set still cannot carry `embed`.** The resolver added here
  serves the built-in manifest's `Class` values; a wire `embed` is an asset path
  this build cannot resolve, and the sender/receiver divergence stays declared.
- ⚠ **`moonrock_target` cannot carry an arrival position** (§11.4) — the one
  schema change this phase found and did not make.
- ⚠ **The title screen and the new-game path are unexercised** (§11.5).
- ⚠ **Still unmeasured, inherited from §9.6 and §10.4:** whether
  `flashPanel/games/seedling.json` and the region atlas force more
  `named_rooms`. Phases 2, 3 and 3b have all now declined it; it did not block
  the manifest work.

---

## 12. PHASE 4a — THE MOONROCK WIDENING (2026-08-14)

⚠ **THIS IS NOT ALL OF PHASE 4.** The `Main.as:319` rule, the save stamp and the
mismatch path are still open; this is the schema amendment they are built on,
taken first because it changes the content hash the stamp keys on and doing it
after would mean re-deriving every stamp that existed by then.

⚖ **USER RULING 2026-08-14**, on a fork raised before implementing: widen the
entry **and** add the agreement rule (below). Three commits here plus one in
`~/CC/seedling` on `bot` (⛔ **not pushed** — §4.7 note 2, and the grants given
for phases 3 and 3b covered those and do not generalise).

| commit | what |
|---|---|
| `51ef1bec8` | the extractor could not regenerate the twin — §12.3 |
| `1ca09fa73` | `moonrock_target` is a `spawn`, and the stairs must agree |
| `48fbde35f` | the two persistence slots claimed by CODE, + probe arm 7 |
| `5129607` (seedling) | `VanillaSet` + `Moonrock.as:134`, zero line shift |

### 12.1 ⛓ §11.4's PREMISE WAS TRUE AND INCOMPLETE

§11.4 recorded that `Moonrock.as:134`'s `(48, 32)` "cannot be expressed". It
could not — by the manifest. It already **was** expressed, one line away, in the
room data:

```
OverWorld.oel:  <moonrock x="240" y="256" tag="0"/>
                <stairsdown x="256" y="272" to="2" playerx="48" playery="32" sign="0"/>
```

`Stairs extends Teleporter` and is built from the OEL as
`Stairs(x, y, up, flip, @to, @playerx, @playery, @sign)` (`Game.as:2261-2262`).
A landed moonrock **removes the stairs it collides with** and adds a plain
`Teleporter` in its place — so the three code literals were a verbatim copy of
the three attributes on the entity being destroyed, which the code already holds
in a local.

Measured across all 116 embedded rooms: **exactly one moonrock, overlapping
exactly one stairs, agreeing.** (`OverWorldN.oel` carries a *different* arrival —
`playery="16"` — for the same pair, and `OverWorldExtended/` exists too; neither
is referenced by any source file, so both are dead assets.) ⇒ every option on
the table was value-identical in vanilla, which is what made the tape sweep a
pure regression check rather than a re-recording.

⛔ **THE RULING MATTERED BECAUSE THE ALTERNATIVES WERE NOT COSMETIC.** Reading
the values off the `Stairs` instead would need no schema change at all and would
be automatically correct under phase 5b's exit rewrite — but it would leave
`moonrock_target` a required, closed-vocabulary entry that **nothing reads**,
which is precisely the silent-no-op the closed vocabulary exists to prevent. The
user took the third option: keep one authority, and make the duplication
*checked*.

### 12.2 The rule is a COLLISION, not a room match

`Moonrock.as:131` finds its victim with `collide("Teleporter", x, y)` — by
overlap. So the validator reproduces the overlap: 48×48 (`Moonrock.as:46`)
against 16×16 (`Teleporter.as:36`), both zero-origin, half-open on both sides.

⛔ **A ROOM-WIDE RULE WOULD REFUSE VANILLA.** Level 0's *other* `<stairsdown>`
goes to level 13 at (64, 128) and is nowhere near the rock. Confirmed by
mutation: degrading the overlap test to `return true` reddens 5 tests including
**`the VANILLA 116 validate clean`** — so the geometry is load-bearing on the
real corpus, not only on fixtures.

Warnings rather than refusals for the arrangements where the rock is simply not
a puzzle: a rock on nothing, a rock on a plain `<teleporter>` (`stairs is Stairs`
is false, so nothing is replaced), and a rock overlapping two candidates, where
`collide()` returns one and which is arbitrary.

### 12.3 ⛔ THE EXTRACTOR HAD BEEN BROKEN SINCE PHASE 3b — AND THE OBVIOUS REPAIR WAS A TRAP

`extract-seedling-vanilla-set.py` parses `levelMusics`, `menuLevels`, the snow
room, the exempt room and the start level **out of `Game.as`**. Phase 3b's
`5aba06c` deleted every one of them (§11.2, "moved, not retyped"). ⇒ the
extractor has exited with `EXTRACTION FAILED: could not find levelMusics` ever
since, and nobody noticed, because **nobody needed to regenerate the twin until
this phase did.** The retired-oracle family: a generator whose output is
committed stops being exercised by anything.

⛔ **AND POINTING IT AT `VanillaSet.as` — the obvious repair — WOULD HAVE MADE
THE MANIFEST GATE VACUOUS.** `check-seedling-vanilla-manifest.mjs` compares the
running wasm against a twin derived from somewhere else; feed the twin from
`VanillaSet.as` and it asserts `VanillaSet.as == VanillaSet.as`. The defect that
gate caught on its first run (§11.3, `new Array(45)`) would have sailed through,
because the twin would carry the same mistake.

⇒ **the constants are now read at `7514b96`** — the commit before this arc
touched them — via `git show`. The original literals can never move again, so
phase 3b's "moved, not retyped" becomes a **permanently enforced property**:
any divergence between the original and `VanillaSet.as` reddens the manifest
gate. Verified rather than asserted: regenerating at `7514b96` reproduces phase
2's fixture **byte for byte** (228/52/12/11 references, 1,385,826 raw OEL bytes),
the whole diff being the three intended lines.

Two things the same regeneration forced:

- **The reduced OEL now keeps `@x`/`@y`** on the elements it already selects.
  Geometry never *selects* an element — adding x/y to `REF_ATTRS` would select
  every tile and the "reduced" form would be the level.
- **`stamp-seedling-vanilla-set.mjs` exists**, because the extractor emits the
  set UNSTAMPED and **nothing in the repo stamped it** — phase 2 did it by hand,
  so re-running the extractor silently unstamped the fixture. The hash has one
  authority (`levelSetValidator.js`); a Python reimplementation would be two
  implementations of an identity function, the one place a divergence is
  invisible.

### 12.4 TWO PERSISTENCE SLOTS ARE CLAIMED BY CODE, AND NO TAG AUDIT CAN SEE THEM

Found by reading *around* the moonrock site — §4.5's "a finding shadows its
neighbourhood", now the fourth measured case in this arc.

Every tag rule in the validator reads `@tag` out of the room XML. These two are
not there at all:

| | slot | vanilla |
|---|---|---|
| `Moonrock.as:135` **writes** tag 0 in `moonrock_target`'s room; the consumer `MoonrockPile.as:22` hardcodes `tag = 0`, inverted polarity, **no `@tag` in any OEL** | room 2 | authors **nothing** at tag 0 — the pile holds it invisibly |
| `FinalDoor.as:50` **reads** tag 0 in `watcher_text`'s room | room 114 | authors `<watcher tag="0">` — the read is aimed at a real entity |

⇒ **the same slot is a hazard in one room and a requirement in the other**, which
is why neither can be a rule about tag 0 in general, and why a set can satisfy
every occupancy rule in the file and still collide. Both are warnings: both
arrangements are legal, they are simply ones nobody can see.

⚠ **The test for the first one raised it where the block did not expect it, and
the warning was right:** a `<moonrock tag="0">` in the *target* room really does
share the pile's slot. The fixture had put the rock and the pile in one room;
vanilla has them in 0 and 2.

### 12.5 The identity moved, and three places carry it

`seedling-vanilla-367e679f` → **`seedling-vanilla-02408e1d`**. It lives in the
fixture (`set_id` + `provenance.content_hash`) and in `VanillaSet.SET_ID`; the
transport probe reads it from the fixture rather than hardcoding it, and §10.3's
arm-4 row above records the OLD id as the measurement it was.

⚠ **The delivery conformance fixture was NOT regenerated**, deliberately: its 16
cases pin **assembly**, and `levelSetDelivery.test.js` never calls
`validateLevelSet` on them (§10.2's split — the receiver does not check
`named_rooms`). Their `moonrock_target: {level: 0}` entries are therefore
documents the sender would now refuse, which is why probe **arm 7a** asserts the
*new* arm's set is one the sender would actually emit before arm 7b believes
what the receiver did with it.

### 12.6 The line-number cost: EMPTY, again

`git diff -U0` hunk headers on the AS3 side: `Moonrock.as @@ -134 +134 @@`,
`VanillaSet.as @@ -63 +63 @@` and `@@ -131,2 +131,2 @@`. Every hunk is
length-preserving; **the offset table this phase owes is empty**, and every
`File.as:NNN` citation in the model still points at what it names.

### 12.7 ⛔ BOTH GATES WERE MADE TO FAIL ON PURPOSE, again

One mutant build, two defects, no overlap — phase 3b's standard (§11.6), and
this time each defect targets one of the two properties this phase adds.

| mutation | breaks | which gate must go red |
|---|---|---|
| **M1** `VanillaSet` `moonrock_target.x` 48 → 47 | the BUILT-IN manifest's arrival | the manifest gate, only |
| **M2** `LevelSet.active()` ignores `mounted` | a DELIVERED set being used at all | the transport probe, only |

Measured on the mutant artifact (`seedling_bot_ap_p4mut`):

```
FAIL: NAMED ROOMS: moonrock_target resolves to the twin's room and arrival — x 47 vs 48
   (the other 23 manifest assertions PASS — M2 disturbs nothing with no delivery)

FAIL: 2c. with a 5-room set mounted … — rooms=116 in=ok past=ok
FAIL: 5b. room 5's XML replaced by room 0's … — room 5's own roster
FAIL: 7b. a DELIVERED set says where the moonrock's teleporter lands
      — moonrock_target {"y":32,"x":47,"level":2} (want {"level":3,"x":96,"y":64})
   (M1 reddens no probe arm; 23 of 26 still pass)
```

⛓ **AND ARM 7b's FAILURE NAMES THE MECHANISM BY ITSELF.** It reports `x: 47` —
the built-in manifest's value **carrying M1's mutation** — which is direct
evidence the readout fell back to the built-in set rather than reading the
delivered one. A verdict that can only be produced by the defect it is looking
for is worth more than one that merely differs.

Diffing the clean and mutant assertion lists showed **exactly one line changed**
on the manifest gate, which is what "non-overlapping" has to mean to be a claim.

### 12.8 Gates

- `check-seedling-vanilla-manifest.mjs` — **24/24** in the built artifact
  (`seedling_bot_ap_p4`, `intel / gen-9`). `moonrock_target` now reads
  **level 2 at (48, 32)** as manifest data rather than as the (80, 128) default,
  which is the assertion this phase added.
- `probe-seedling-level-set-transport.mjs` — **ALL 26 ARMS PASS**, one fresh
  page each; 25 inherited from phase 3, plus arm 7 (a delivered set's arrival,
  `phase4-arrival-28a3c5c9` → `(3, 96, 64)`).
- `npx vitest run frontend/modules/seedlingDemo/` — **3790** (3775 + 15 new in
  `levelSetValidator.test.js`, which goes 53 → 68).
- `solve-seedling-r8-battery.mjs --check` md5 **unmoved** at
  `1fedb0ab35b7cd74accecf0345bdc893`.
- `verify-seedling-bot-differential.mjs --win --tier=full --only=` six tapes
  (`cross-level-leg`, `diagonal-run`, `friction-stop`, `pit-fall-83`,
  `pit-fall-chain-85`, `grant-sword-room`) — **ALL CHECKS PASSED**.
  ⚠ **A SMOKE TEST, NOT PHASE 3b's SWEEP, AND DELIBERATELY SO.** The AS3 delta
  is three lines and **value-identical in vanilla** — `namedX/namedY` return the
  48 and 32 the literals held — so a 153-tape run could not distinguish this
  build from its parent, and a 2h35m gate that cannot fail is the shape this arc
  keeps refusing. What the six do cover is that the REBUILD did not regress room
  transitions, pit-fall destinations and the physics controls.
- The eleven `check-seedling-editor-*.mjs` were **not** run: no editor code, no
  procgen module and no page changed (`levelSetValidator.js` still has no
  production caller — §9.6 — its callers are the gates above).

⚠ **THE DIFFERENTIAL REFUSED THE BUILD AT FIRST, AND IT WAS RIGHT TO.** Its
staging check asserts the payload inside a variant directory is always named
`seedling_bot_ap.js/.wasm` — true of phases 3/3b, false here, because
`build_wasm_avm2.sh <name>` names the payload after the BUILD. It printed a
named SKIP rather than sweeping nothing quietly, which is exactly the behaviour
its comment says it was written for. Worked around by staging a renamed copy;
the guard itself is fine and was left alone.

### 12.9 What phase 4a did NOT do

- ⛔ **PHASE 4 PROPER IS STILL OPEN.** `Main.as:319` still sizes the persistence
  table from `Game.levels.length`, the save still carries no `set_id`, and the
  receiver's capacity refusal is still the stopgap §10.4 named. This phase only
  moved the schema the stamp will key on.
- ⛓ **AND §4.2's RULE HAS AN UNREACHABLE BRANCH, measured here.** "Keep the
  table, and EXTEND it with `true` if it is short" can only run when the stamp
  MATCHES and the size CHANGED — but `saveStampMatches` compares `set_id` **and**
  `provenance.content_hash`, and `computeLevelSetContentHash` hashes the whole
  document minus `provenance`/`set_id`, `rooms` included. A matching stamp is an
  identical document, so the size cannot have moved. ⇒ either that branch is
  dead, or the hash does not cover what §4.2 assumed. It is the first: the next
  slice should make a short table under a matching stamp **name the
  inconsistency** (a truncated SharedObject, a table sized before a mount)
  rather than silently extending, or it is untriggerable code in the middle of
  the one rule that prevents silent corruption.
- ⚠ **`Moonrock.as:134` IS STILL EXERCISED BY NOTHING.** No tape triggers the
  moonrock puzzle — the three tapes whose text mentions "moonrock" only
  *describe* it — so what is verified is that the manifest carries (48, 32) and
  that a delivered manifest's arrival reaches the readout. The one-line call
  site that consumes them is visible in the diff and nowhere else. Same shape as
  §11.5, stated for the same reason.
- ⚠ **The delivery conformance fixture still carries level-only
  `moonrock_target` entries** (§12.5). Regenerating it would change what the
  receiver probe delivers for no gain, since those cases pin assembly.
- ⚠ **Still unmeasured, inherited from §9.6, §10.4 and §11.9:** whether
  `flashPanel/games/seedling.json` and the region atlas force more
  `named_rooms`. Four phases have now declined it.

---

## 13. PHASE 4 — PERSISTENCE + THE SAVE STAMP (2026-08-14)

Two commits in `~/CC/seedling` on `bot` on top of `5129607` (⛔ **not pushed** —
§4.7 note 2, ask again), plus `8c15abbd1` here.

| commit | what |
|---|---|
| `23a0208` (seedling) | the save belongs to a SET; the table is that set's size |
| `62f3988` (seedling) | no save at all is not a RESET — caught by writing the gate |
| `8c15abbd1` | `check-seedling-save-stamp.mjs`, and phase 3's capacity arm flips |

### 13.1 ⛔ THE RULE HAD TO RUN SOMEWHERE §4.2 DID NOT NAME

§4.2 says `Main.as:319`'s `if (!SAVE_FILE.data.levelPersistence)` *becomes* the
rule. Measured, that line cannot carry it:

`Main.begin()` opens the SharedObject, calls `startSave()`, then `printItems()`,
then `new Game(0, 80, 128)` (`Main.as:44-51`). **A delivery happens later — the
page has to boot before it can push a set.** So a rule that lives only at :319
sizes the table from whatever was active at BOOT, which is always the built-in
vanilla manifest, and the case the whole phase exists for — a set arriving with
a save already on disk — never reaches it.

⇒ **reconciliation lives in `LevelSet`'s CONSTRUCTOR**, beside
`seedRuntimeTables` and for its stated reason: a set becomes real exactly once,
there, whether it arrived over EI or was built from the embeds. Two call sites
could disagree about the rule; one cannot. `startSave()`'s first statement now
asks for the active set — which is what builds the built-in one and reconciles
against it — and `Main.as:319` is a docblock saying where the table went.

⚠ **AND THE ORDER IS LOAD-BEARING IN A SECOND WAY.** `printItems()` reads the
persistence table (`Main.as:135`) and runs immediately after `startSave()`, so
the table must exist by the time `startSave()` returns — it cannot be deferred
to the first room load. That is why the call is at the TOP of `startSave` and
not at :319 where the old block was.

### 13.2 The rule, in full — and what replaced the unreachable branch

| the save says | the table | what happens |
|---|---|---|
| nothing, and there is no table | — | **build and stamp.** Not a reset: this is every first boot |
| nothing, table FITS the set | `n * 30` | ⛓ **ADOPT** — stamp it, keep everything (§13.3) |
| nothing, table does not fit | other | fresh save |
| **the same `set_id`**, table fits | `n * 30` | ⛓ **KEEP IT ALL** — the ordinary path |
| **the same `set_id`**, table does NOT fit | other | ⛔ **NAME IT and rebuild** (below) |
| a different `set_id` | any | fresh save, naming both sets |

⛓ **THE COMPARISON IS `set_id` ALONE, AND THAT IS THE CONTENT HASH.** The sender
stamps every set `<base>-<FNV-1a of the canonical document>` and refuses one
whose id does not end in its own hash (§9.1 rule 2), so an edited set reusing its
name is already a different id by construction. The receiver does **not**
recompute the hash: that would be two implementations of one identity, which is
the one place a divergence is invisible, and §10.2's split says this side does
not re-implement the sender's rules.

⛔ **AND THAT IS WHY §4.2's "EXTEND IT WITH `true` IF IT IS SHORT" DOES NOT
EXIST.** A matching stamp means an identical document, so the room count cannot
have moved — the branch is unreachable as the plan wrote it (measured before
implementing, §12.9). What sits there instead is the case that *can* happen: a
stamp that matches over a table that cannot belong to that set, which means the
delivery is not what its id claims (a hand-rolled envelope that never went
through the sender) or the table was truncated. Extending it with `true` would
paper over the only evidence of the disagreement. It NAMES it and rebuilds.
**Driven — arm 6 of the new gate.**

### 13.3 ⛓ AN UNSTAMPED SAVE IS ADOPTED, NOT DESTROYED

Every save written before this phase was written under the compiled-in 116,
because no earlier build could size the table any other way. So an unstamped
save whose table FITS the set being mounted **is** that set's table, and it is
adopted with its progress intact. The alternative — treat unstamped as
mismatched — would wipe every existing player's game on the upgrade, which no
part of §4.2 asks for and which is invisible until it happens to someone.

⚠ **IT CANNOT ARISE BY ITSELF IN THIS ARTIFACT.** The runtime models
SharedObject in process and never writes a `.sol` (`avm2_amf.c:1907`), so no
save here can predate anything — the branch would have been shipped
unexercised. `botForgeSaveStamp` exists for exactly that: a lever whose name
says it forges a save state rather than reaching one by playing. Forging the
stamp to `""` over a live table and re-delivering the same set drives the branch
precisely.

⇒ ⚠ **and the same fact bounds the whole phase**: in THIS build a save never
outlives its page, so every mismatch this gate drives is one that happened
*within* a session. The cross-session case — the one a player would meet — is
the same code on a runtime that persists, and is not exercised here.

### 13.4 A mismatch takes the WHOLE save

§4.2's rule names `levelPersistence` and stops there. `SAVE_FILE.data` also
carries `level` and `playerPositionX/Y`, which are **exactly as set-relative**:
resuming at index 37 of a set that never had a room 37, or at (240, 256) in a
room whose geometry is different, is the same silent reinterpretation with no
rule attached to it. `freshSaveForLevelSet` clears the SharedObject, re-opens it
(following `clearSave()`'s own precedent rather than trusting an emulated
`SharedObject` to leave `data` usable), rebuilds the table at the mounted size,
stamps it, and re-runs `startSave()` — unless it is already inside it, which is
what the one boolean guard is for.

### 13.5 Two outcomes, two channels

`Main.levelSetReset` is its own field and **not** `Game.levelSetError`. That one
means *a delivery was REFUSED*, and the transport probe reads it as exactly
that; a reset is the opposite — the delivery was accepted and the save could not
come with it. Borrowing the channel would make a healthy mount read as a
refusal and would disarm the gate that checks refusals.

⚠ **AND A FIELD THAT CRIES WOLF GETS SKIPPED.** The first cut treated "no table
and no stamp" — the state of every first boot — as an unstamped save being
discarded, which put a reason string in the readout on every single launch.
Caught by writing the gate that reads it, before the build baked it in
(`62f3988`). `levelSetReset` now means something WAS thrown away, and arm 1d
asserts it is empty at boot.

### 13.6 The stopgap is gone

`LevelSet.acceptChunk`'s capacity refusal — `set has N rooms but the persistence
table addresses M` — is deleted, as §10.4 said phase 4 would. The `maxRooms`
parameter and `Bot.persistenceLevelCapacity` went with it rather than staying as
an input nobody reads. ⇒ **§10.2's declared `receiver_only` divergences drop from
two to one**: only an `embed`-sourced room is still servable-but-not-valid.

The transport probe's **arm 6 is kept and inverted**, not deleted: a rule that
stops applying deserves a witness that it stopped, and a deleted case leaves no
record that the delivery was ever refused.

### 13.7 The line-number cost: EMPTY, a third time

`git diff -U0` hunk headers. `Main.as` is cited **88** times, the highest at
**:319** — the block replaced in place, whose docblock now says where the table
went. Its two new statements ride on EXISTING lines (`:232`, `:337`) and its new
members are appended past the last citable line; the only hunks below are the
closing braces. `Bot.as` is cited **54** times, all at or below `:1466` in
original numbering (phase 3's table maps them), and every hunk here is at
`:3196` or beyond except the callback registration, which rides on an existing
line. `LevelSet.as` is cited **nowhere** — measured, not assumed — and is the
one file that took real edits.

⇒ **every `File.as:NNN` citation in the model still points at what it names.**

### 13.8 ⛔ THE GATE WAS MADE TO FAIL, AND THE FIRST ATTEMPT WAS NOT GOOD ENOUGH

Phase 3b's standard is one mutant build carrying two non-overlapping defects.
The obvious pair here was:

| mutation | breaks |
|---|---|
| **M1** the matching-stamp KEEP branch rebuilds instead of returning | "the same set keeps your progress" |
| **M2** `buildLevelPersistence` sizes from the compiled-in room count again | "the table follows the mounted set" |

Measured on that build: **8 of 20 save-stamp checks red, 1 of 26 transport arms
red** (arm 6, the capacity claim), and the manifest gate **24/24 GREEN** — a
clean negative control that phase 4's defects do not disturb phase 3b's.

⛔ **BUT M2 MASKED M1, SO THE PAIR PROVED LESS THAN IT LOOKED.** With the table
sized at 116 under a 5-room set, arm 3b failed through the *size* branch, not
the branch M1 broke — its reason read `matches, but its table holds 116
level(s)`. A defect whose failure is attributable to the other defect has not
been independently observed, and "the same set keeps your progress" is the one
claim here whose failure mode is silent data loss.

⇒ **a second build, M1 alone.** It reddens **exactly arms 3b and 3c and nothing
else** — 18 of 20 still pass, including 3a, the control that the tape really
cleared the slot:

```
FAIL: 3b … cleared=[] reset="save stamp "stamp-a-93e40d64" matches, but its
           table holds 5 level(s) and this set has 5 — the id is content-derived,
           so it cannot describe both"
```

⛓ **AND THE REASON IS VISIBLY NONSENSE, WHICH IS THE POINT.** "holds 5 and this
set has 5" is a disagreement between two equal numbers — exactly what a broken
KEEP branch falling through to the mismatch path produces, and a verdict only
that defect could write.

⚠ **ONE THING THE PAIR SHOWS THAT DISJOINTNESS WOULD HAVE HIDDEN:** M2 reddens
the save-stamp gate AND the transport probe, because arm 7 of the first and arm
6 of the second are the same claim measured from two directions. That overlap is
a property worth having, not a flaw in the mutation — the capacity claim has two
independent witnesses.

### 13.9 Gates

- `check-seedling-save-stamp.mjs` — **20/20**, first run, in the built artifact
  (`seedling_bot_ap_p4b`, `intel / gen-9`). Every branch of §4.2's rule driven,
  including the two that no gameplay can reach in this build.
- `probe-seedling-level-set-transport.mjs` — **ALL 26 ARMS PASS**, with arm 6
  inverted (a 117-room set now mounts and its table addresses 117).
- `check-seedling-vanilla-manifest.mjs` — **24/24**, unmoved.
- `npx vitest run frontend/modules/seedlingDemo/` — **3790**, unmoved from phase
  4a; nothing in the vitest graph changed (the phase's JS is two
  `scripts/procgen` files). ⚠ **The first run of it reported `1 failed`, and it
  was a MACHINE claim, not a code one** — it raced a 16-minute `emcc` build on
  the same box. Re-run twice on a quiet one (`/proc/loadavg` 1.87): 3790/3790,
  exit 0 both times. Recorded rather than quietly re-run, because "I ran it
  again and it was fine" is how a real intermittent gets buried.
- `solve-seedling-r8-battery.mjs --check` md5 **unmoved** at
  `1fedb0ab35b7cd74accecf0345bdc893`.
- The eleven `check-seedling-editor-*.mjs` were **not** run: no editor code, no
  procgen module and no page changed.

### 13.10 What phase 4 did NOT do

- ⚠ **THE CROSS-SESSION CASE IS UNEXERCISED, AND IT IS THE ONE A PLAYER MEETS.**
  This runtime models SharedObject in process and never writes a `.sol`
  (`avm2_amf.c:1907`), so every save here dies with its page. Every mismatch the
  gate drives happened *within* one session. The same code on a persisting
  runtime is what a real upgrade would run, and nothing here has run it.
- ⚠ **`botForgeSaveStamp` IS TEST SURFACE IN A SHIPPING BUILD.** It exists
  because two branches — adoption, and the stamp-matches-but-size-differs case —
  are otherwise unreachable here. It writes one field and nothing calls it.
- ⚠ **A MOUNT MID-PLAY STILL DOES NOT RELOAD THE WORLD** (§10.4). It now also
  throws the save away, so the player is standing in a room from the old set
  with a fresh save behind them. `botStart` after delivery remains the rule.
- ⚠ **Nothing in production delivers a set** — `botLoadLevels`' only callers are
  the probes. Phase 5 is the producer.
- ⚠ **Still unmeasured, inherited from §9.6, §10.4, §11.9 and §12.9:** whether
  `flashPanel/games/seedling.json` and the region atlas force more
  `named_rooms`. Five phases have now declined it.

---

## 14. PHASE 5 — THE EXPORTER (2026-08-14)

**A generated set now exists end to end**, which is what the whole arc was built
to enable. Five commits here, ⛓ **NO AS3** — every seam this needed was already
in the artifact. `2bb96666c` (the `named_rooms` ruling), `7ed059d03` (the OEL
writer), `aa527f8e6` (the exporter + CLI), `455447828` (the round trip),
`4823992d8` (the flag test the mutation gate demanded).

| what | where |
|---|---|
| record → OEL XML | `frontend/modules/seedlingDemo/procgenLevelOel.js` |
| rooms → a stamped set | `frontend/modules/seedlingDemo/levelSetExporter.js` |
| the CLI | `scripts/procgen/export-seedling-level-set.mjs` |
| **the round trip** | `scripts/procgen/check-seedling-generated-set.mjs` |

### 14.1 ⚖ THE RULING: `named_rooms` requiredness is DERIVED from the rooms

Phase 2 froze `named_rooms` as a closed vocabulary with **all six required**.
That was ruled when **vanilla was the only set in existence**. A generated set
has no Watcher, no moonrock and no Owl — and §4.1's *"a set defining neither
must **say so** rather than defaulting silently"* had no way to be said.

⛓ **MEASURED FIRST, AND THE PREMISE THE QUESTION WAS ASKED ON WAS WRONG.** The
brief said the AS3 dereferences the six unconditionally. **It does not.** Every
one of the six sits inside a single entity's own behaviour, and every one of
those entities is built **only** from an OEL element (`Game.as:2166-2287`) — so
the validator can already see whether a set can reach the name at all:

| entry | dereferenced at | trigger element |
|---|---|---|
| `moonrock_target` | `Scenery/Moonrock.as:134-135` | `<moonrock>` |
| `watcher_text` | `Scenery/FinalDoor.as:50` | `<finaldoor>` |
| `dark_shrum_death` | `Player.as:491` ← `NPCs/Oracle.as:107` | `<oracle>` |
| `bloody_seed_ending` | `Pickups/Seed.as:73` | **`<watcher>`** |
| `light_boss_exit` | `Enemies/LightBossController.as:104` | `<lightbosscontroller>` |
| `tentacle_beast_mouth` | `Enemies/TentacleBeast.as:213` | `<tentaclebeast>` |

⛔ **AND THE NAME-MATCHING GUESS IS WRONG FOR EXACTLY ONE OF THE SIX.**
`Game.as:2227` builds every OEL `<seed>` as `new Seed(o.@x, o.@y, false, …)` —
`bloody` is hardcoded **false** there — and `Seed.as:73` reads the manifest only
on the bloody arm. The one bloody Seed in the game is born at
`NPCs/Watcher.as:102` when the Watcher is killed. ⇒ `<watcher>`, not `<seed>`.
**That is the fourth time in this arc**, after `@fallthrough`, `@room` and
`map_ref`: a key-name scan answers what a thing is *called*, never what it *is*.
**Ask the consumer.**

⚖ **THE USER TOOK "derive requiredness from the room data"** over two
alternatives, both put to them: pointing unused entries at the start room (zero
code, but it writes six unverifiable claims into every generated set — §4.1's
"defaulting silently" wearing an in-range default's clothing), and an explicit
`{"unused": true}` marker (the most self-describing document, but `int(undefined)`
is **0**, a real room, so it would need an AS3 change to be safe).

The rule, in full — and it is checked in **both** directions, which is what makes
an omission a statement rather than a default:

> trigger present + entry missing → **ERROR**, naming the room that carries it
> trigger absent + entry supplied → **warning**, the entry is inert
> trigger **unverifiable** → neither claimed; reported as such

⛓ **THE THIRD LINE IS THE ONE VANILLA FORCED — §4.3's anti-rot property catching
a rule for the SECOND time in this arc** (§9.3 was the first). Validated without
`xmlByRoomId`, all 116 vanilla rooms are `embed`-sourced and unreadable, so *"no
room carries `<moonrock>`"* is true of what was **parsed** and false of the
**set**. An inert warning there fires on the ordinary game.

**Vanilla is unchanged and its content hash does not move**: all six triggers are
in the 116 (`<moonrock>` room 0, `<oracle>` 1, `<tentaclebeast>` 57,
`<lightbosscontroller>` 69, `<finaldoor>` 113, `<watcher>` in eleven rooms), so
vanilla still requires all six. `stats` now carries
`named_rooms_{present,omitted,unverifiable,required_missing}` — because an empty
findings list and a clean pass look identical otherwise.

### 14.2 ⛔ THE GENERATOR IS NOT MANIFEST-SHAPED, AND THAT IS FOUR FINDINGS

§5's line — *"emit a manifest from generated levels (`procgenSeedling` output →
bundle)"* — presumes the generator's output is already what a bundle wants.
Measured, it is not, and the shortfall is structural rather than cosmetic:

1. ⛔ **It emits ONE room per invocation and has no notion of a set.** `--count`
   is the obstacle target, not a level count.
2. ⛔ **Every record carries the same identity** — `level: 900`,
   `class: "Procgen900"`, `path: "procgen/900.oel"` (`SEEDLING_DEFAULTS`). Two
   records are indistinguishable; the manifest needs dense ids **and** names
   unique within the set. Both are **assigned** by the exporter.
3. ⛔ **It emits an Ogmo RECORD, not OEL XML** — geometry in **tiles**, because
   everything downstream of it in the PoC arc was the JS model, which reads
   records. A set's `rooms[].source.xml` is **OEL text in pixels**, because the
   receiver's one resolver ends in `Game.loadLevelXML`. ⇒ **the generated levels
   had never been expressible as a mountable room.** There is exactly one
   delivery callback into the artifact and nothing converted a record into one.
4. ⛔ **NO generated room has an exit.** No teleporter, no stairs, no
   `@fallthrough` — the palette places obstacles, not transitions. **A set of N
   generated rooms is N ISOLATED ROOMS.** Measured on the first real export:
   **1/6 reachable**. That is Phase 5b's work.

⇒ (1)–(4) are findings about the **generator**. What the exporter owes is
reported rather than defaulted: **`provenance.invented` travels IN the set** — a
list of every field no input determined, so a reader can tell a MEASURED value
from a CHOSEN one. `start` is **derived** from `summary.startCell` (tiles →
pixels) and is deliberately not on it. On the six-seed export the list is exactly
`menu_rooms, rooms[].music`.

`reachabilityOf` is a **report, not a validator rule**, and deliberately so: a
validator rule applies to vanilla too, and the 116 are reached by mechanisms this
walk cannot see (a boss that warps you, a debug key, `named_rooms`). §9.3 is this
arc's recorded case of a hardening rule that refuses the real game.

### 14.3 The OEL writer, and the round trip that is by VALUE

Written as the exact inverse of `scripts/procgen/seedlingOgmo.js` — the repo's
one OEL **reader**, in use since the atlas extract — so the pair is tested
against each other rather than against two hand-maintained descriptions of the
format.

**MEASURED over the full shipped corpus: `parse → render → parse`, 120/120 files,
1,722,138 B, value-identical. 0/120 byte-identical, which is the correct answer**
— `treelarge.oel` carries a raw `>` inside an attribute value and this writer
emits `&gt;`. Same value, different bytes; a byte comparison would have been
measuring the encoder's taste. ⚠ The committed reduced fixture contains **not one
`&`**, so the escaping surface is covered synthetically and by name rather than
left to a corpus that cannot reach it.

A tile outside the level rectangle is **refused, not dropped**: the game's loader
discards those silently (51 shipped levels rely on it, 520 placements), which
would leave a room without a tile the record says it contains.

### 14.4 ⛓ THE ROUND TRIP — and its own first version was VACUOUS

`check-seedling-generated-set.mjs`, **26/26** in `seedling_bot_ap_p4b` on
real-GPU Windows Chrome (`intel / gen-9`). Generate → export → validate → chunk
→ deliver → mount → **read the manifest back out of the artifact** and diff it
against what was emitted. Identity, table size, persistence length, musics (the
manifest **and** the live array the bosses write), menu rooms, start level, the
room flags and `named_rooms` all read back equal.

⚖ **The 2026-08-14 ruling, read back out of the game**: the artifact reports
`named_rooms: {}` for a generated set, with no `named_rooms is missing` refusal.
The empty manifest resolves to an empty readout rather than to six entries
defaulted somewhere in between.

⛔ **THE GATE'S FIRST VERSION PRINTED PASS FOR THE OPPOSITE OF WHAT HAPPENED.**
It carried a "§8.3 control" asserting *the game does NOT refuse a level past the
end*, read `botStatus.error` (empty) — and the refusal is the **tape load's**
return value. `botLoadTape` had answered
`error:boot.level 6 is not a level (0..5)` and `botStart` `error:no tape loaded`.
**Phase 3's SEAM 4 (§10.1) gave `boot.level` the bound it never had**, so §8.3's
silent-clear property is *no longer reachable through a tape at all*. ⚠ **§6's
third bullet still reads as current on this and is not** — it describes the
pre-Phase-3 state; §10.1 records the fix.
⇒ the arm now asserts what actually governs: **the refusal names THIS SET's
range** — `"0..5"` under a six-room set, not `"0..115"` — which is the only thing
that distinguishes a set-aware bound from the vanilla table, with the last real
room accepted as the control.

⚠ **AND THE ENTITY ROSTER IS NOT A FINGERPRINT.** Two runs gave **18 then 15**
mobiles: the arrow traps fire during the 3 s settle, so anything counted over
wall-clock compares how the runs were *scheduled*. Two rooms are booted instead
and the **goal pickup's position** is the witness — it does not move, and the
generator puts it somewhere different in every seed. Room 1 `(72, 88)`, room 3
`(104, 40)`, each its own record's goal under **one constant `+(8, 8)`** measured
from the first and asserted on the second. A delivery shifted by one room would
disagree there.

### 14.5 ⛔ ONE MUTANT, TWO NON-OVERLAPPING DEFECTS — and the gap it exposed

| defect | JS suite | round trip |
|---|---|---|
| **D1** `NAMED_ROOMS.bloody_seed_ending.trigger` `'watcher'` → `'seed'` | **4 red**, all four naming `bloody_seed_ending` | green |
| **D2** the exporter always writes `snow_gradient: true` | green | **1 red**: `snow [0,1,2,3,4,5]` |

Attribution read off each failure's **reason**, not off a count — Phase 4's first
pair looked strong at 8/20 and one mutation had masked the other. ⛓ Here D2 also
**moved the content hash** (`eb05baaf` → `791fc64d`, `snow_gradient` being inside
the hashed document) and `IDENTITY` still passed, because both sides recomputed
from the mutant; the flag readback caught it independently, so **the hash change
masked nothing**.

⛔ **BUT D2's ONE-GATE-NESS WAS A REAL GAP, NOT A PROPERTY.** The JS side was
blind to a generated room claiming vanilla room 45's snow behaviour, because
`validateLevelSet` accepts any boolean and the exporter's tests never looked.
Leaving that open because it made the pair look tidy would be backwards, so it is
closed (`4823992d8`) — and **post-fix D2 reds both gates**, which is the correct
state. ⇒ recorded rather than re-engineered: **with no AS3 change in this slice
there is no defect in code this phase owns that a complete JS suite cannot see.**
The round trip's unique value here is not catching defects in the JS — it is
proving the **artifact accepts** what the JS produces, and it was observed
failing for a real reason.

### 14.6 §6.1's obligation, discharged — ⚖ INVALIDATE, STAMPED

⚖ **User, 2026-08-14**, over regenerating the tables. `apMappingInvalidation`
emits a companion carrying the set's own `set_id` + `content_hash` and naming all
**24** vanilla level references — `region_coords` 9, `location_coords` 11, atlas
`map_ref` 4 — as not describing this set. It **refuses an unstamped set**,
because an unstamped companion could be matched to any set, which is the case the
content hash exists to close. Regeneration stays derivable later and does not
change this contract.

### 14.7 Gates

- `npx vitest run frontend/modules/seedlingDemo/` — **3833/3833** (3790 + 43:
  the validator 68→80, the OEL writer 12, the exporter 19), 393 s on a quiet
  box. ⚠ **AND THE FIRST RUN OF IT WAS RED FOR A REASON THAT WAS MINE.** It
  reported 3 failures — `r1Walk`, `r5Totem` L41 and the `r5-l42-part4` tape
  differential — because the round trip was running against the same box and
  load peaked at **22.8**. Solo on a quiet box those three files are 515/515,
  and the whole suite is clean. Every one of the three is a bot-walk or tape
  differential; none touches a level set. ⇒ the §5 warning about the generator
  under load applies to the SUITE as well, and "check what else is running
  before believing a red" earned its place again.
- `node scripts/procgen/check-seedling-generated-set.mjs` — **26/26**.
- `node scripts/procgen/check-seedling-vanilla-manifest.mjs` — **24/24**, run
  against the new rule.
- `node scripts/procgen/solve-seedling-r8-battery.mjs --check | md5sum` —
  `1fedb0ab35b7cd74accecf0345bdc893`.
- **Determinism**: three SEPARATE processes of the export CLI on seeds 1-6,
  byte-identical stdout, same hash `6aa0047a`. ⚠ **Captured on a quiet box** —
  `/proc/loadavg` between `0.16` and `0.52` for every measurement in this phase,
  and the CLI now prints it to stderr before it starts, because a set captured
  under load is a set that will not reproduce while looking completely normal.

### 14.8 What phase 5 did NOT do

- ⛔ **NO EXITS.** A generated set is N isolated rooms (§14.2 #4). Phase 5b.
- ⛔ **Nothing regenerates the 24 AP references** — they are invalidated, per the
  ruling. `location_coords` is exactly derivable; `region_coords` is transcribed
  from a **commented-out** debug-warp block, so regenerating it means inventing a
  convention vanilla never had.
- ⚠ **`tapeFormat.parsePersistence` still bounds `persistence[].level` to
  `0..115`**, the vanilla table, not the mounted set. §6's residue stands on the
  JS side even though the AS3 side is now set-aware (§14.4).
- ⚠ **No generated set has been PLAYED** — two rooms were booted and built, and
  nothing walked one. The solver's own certification is the PoC arc's, against
  the JS model, not against the artifact.
- ⚠ **`music` is 0 for every generated room and `menu_rooms` is `[0]`** — both
  listed in `provenance.invented` rather than chosen well. A generated set has no
  boss, so `-1` never arises.
- ⚠ **The exporter has no page arm.** `watchGenerate`'s GENERATE arm still cannot
  hand a level to a set; the CLI is the only producer.

---

## 15. PHASE 5b — EXIT DESTINATIONS AS DATA (2026-08-14)

**The arc's last slice, and the one that makes a generated set a game rather
than a pile of rooms.** Six commits here, ⛓ **NO AS3** — §5 said the phase needed
none and it needed none.

| what | where |
|---|---|
| the linker (emit + retarget + the sign rule) | `frontend/modules/seedlingDemo/levelSetExits.js` |
| 43 tests, three of them measurements of the GAME | `frontend/modules/seedlingDemo/levelSetExits.test.js` |
| the exporter's `link` option + `--exits`/`--regions` | `levelSetExporter.js`, `scripts/procgen/export-seedling-level-set.mjs` |
| the arrival-bounds rule | `levelSetValidator.js` |
| the walk, driven in the artifact | `scripts/procgen/check-seedling-generated-set.mjs` |
| the de-scope | `flashPanel/games/seedling.json`, `flashBridgeAdapter.js` |

**The blocking number moved: `reachabilityOf` 1/6 → 6/6.**

### 15.1 ⛔ §4.6's `sign` RULE IS WRONG, AND THE CORPUS IS WHAT SAYS SO

§4.6: *"`sign` is destination metadata and lives on the SOURCE teleporter…
Rewrite `to` and leave `sign` and the new room announces the old room's name."*
The diagnosis is right — a stale `sign` names the wrong room — and the rule it
implies, *rewrite `sign` with the destination*, cannot be implemented, because
`sign` is not a function of the destination. Measured over all 280 exits and all
12 fallthroughs of the vanilla 116:

- **8** transitions carry a non-zero sign, into **7** distinct destination rooms
- those 8 use **all seven** entries of `Message.as`'s closed table
- **no destination is entered with two different non-zero signs** — so a room's
  region, where it is stated at all, is unambiguous
- ⛔ **all 7 of those destinations are ALSO entered by UNSIGNED exits (7/7)**

If `sign` were a property of the destination, every entrance to room 13 would
carry sign 1. One of three does. It is a property of the **transition**: room 0
is outside Gundernourd and room 13 is inside, so that doorway announces; the
other two entrances come from rooms already inside the region and say nothing.

⇒ the rule that IS implementable, and the one built:

> `sign(A → B) = region(B)` when `region(B) ≠ region(A)` and `region(B) ≠ 0`,
> else `0` — and **`region` is an INPUT, never inferred.**

⛓ **THE REFUSAL TO INFER IS THE POINT.** Vanilla names the region of 7 of its 116
rooms and says nothing about the other 109, so any derivation would be invention.
With no region declared, every emitted or retargeted exit announces **nothing**,
and the count is REPORTED — because announcing the wrong region is worse than
announcing none, and carrying the source's old sign (what §4.6's rule does) is
worst of all: it names the room the player did not go to.

⚠ The storage convention is the off-by-one the launching session predicted:
`Teleporter`'s ctor stores `_sign - 1` and `Game.as:2148` does
`int(o.@sign) - 1`, so `0` means *absent* and 1..7 index the table. The bugs were
not there; they were in the model of what `sign` means.

### 15.2 ⛔ THE SLICE IS **EMIT** AS MUCH AS REWRITE — §4.6's framing, settled

§4.6 says "rewrite" throughout, and it was written when vanilla was the only set
in existence. Phase 5 then measured that **no generated room has an exit at all**
(§14.2 #4). Rewriting nothing produces nothing, so the blocking case needs
emission.

⇒ **Both, and they are one write seen twice.** The primitive is *"give this exit
a destination"* — `(to, playerx, playery, sign)` onto one exit in one room's
data. A vanilla-derived set has exits to point elsewhere (`retargetRoomXml` /
`retargetLevelSet`); a generated set has none, so it must be given them first
(`linkGeneratedRooms`). Neither is a superset of the other and neither alone
closes §5's acceptance.

The retarget arm is gated on the real cross-reference graph: **280/280 vanilla
exits retargeted under a permutation, every destination right, every sign right
under a declared region map, and 0 rooms whose non-exit bytes changed.** ⚠ A
retargeted set is **re-stamped**: it is a different set, and keeping the old
`set_id`/`content_hash` would let a save from the old layout be adopted under the
new one — the silent reinterpretation §9.1 put the hash inside the id to close.
The test also asserts the re-stamp does **not** alias the input set's
`provenance` object.

### 15.3 ⛓ ARRIVING ON THE RETURN PORTAL IS LEGAL, AND VANILLA DEPENDS ON IT

The obvious hazard of a two-way link is the warp loop: land on the portal that
sends you back and bounce forever. It does not happen, and the reason is a latch:

- `Teleporter.update()` warps only `if (collide(Player) && !playerTouching)`
- `Teleporter.check()` sets `playerTouching = true` on overlap
- `Game.update()` runs **every** entity's `check()` behind a `!checked` latch
  **before** `super.update()`

**MEASURED, not reasoned: vanilla lands the player on a return portal FOUR
times** — 11↔3, 88↔87, 97↔37 (`stairsup` onto `stairsdown`) and 107↔102 — and in
every case the portal landed on points straight back. **A validator rule refusing
it would have refused the real game**, which is §9.3's lesson for the third time
in this arc, and it was caught by asking vanilla before writing the rule rather
than after.

⇒ each arrival lands **ON** the destination's return door: it is what the game
itself does, it needs no second free cell, and it makes a two-way link symmetric
by construction. ⚠ It is also a DEPENDENCY on that latch — a change to the order
of `check()` and `update()` turns every two-way link in every generated set into
an infinite warp — so the round trip asserts it in the artifact (§15.5).

### 15.4 WHAT THE FLOOD PROVES, AND WHAT IT DOES NOT

`reachabilityOf` walks the **DATA**: a `to` exists and is in range. It cannot see
whether the player can stand on the thing carrying it, so on its own it would
report 6/6 for six rooms whose exits are sealed inside walls. Door cells are
chosen from a flood over each room's **real collision world** (`buildLevelWorld` +
`playerBoxAt`), from that room's own start, with every solid live — locks closed,
blocks unpushed, nothing cleared.

⛓ **The property that makes the SET traversable rather than merely connected:**
every door of a room comes out of one flood, so a player arriving at any door is
in the same component as all the others and can always leave again.

Three bounds, named because each is a real limit:

1. ⚠ **CONSERVATIVE, and that is a design consequence.** An exit reachable with
   no puzzle solved means a room's own obstacle does **not gate** its exit.
   Gating exits behind the room's puzzle is a level-design decision this slice
   does not make, and making it would need a solver run per candidate — which
   `procgenOracle:503` makes non-deterministic under load, trading a stated bound
   for a set that does not reproduce.
2. ⚠ **The flood is cell-centre, 4-connected.** Exact for this corpus (every
   generated solid is a tile-aligned 16x16 and the player's box is 4x5) and NOT
   exact for a room with off-grid geometry. A later palette that places a
   half-tile solid breaks the argument silently.
3. ⚠ **Two doors of one room are kept NON-ADJACENT**, and the first version was
   not — measured on the six-seed export, room 1's came out at (8,1) and (8,2).
   Cosmetically a two-portal corridor; substantively the `approach` cell handed
   back as the round trip's witness **was itself a door**, so a tape told to walk
   in from there would have warped before taking a step.

**The validator gained the rule §4.6 asked for and Phase 2 could not make**: an
arrival must land inside the destination room's rectangle (`Game.as:2040` passes
it to `new Player()` unchecked). ⛓ An ERROR rather than a warning **because
vanilla was asked first**: all 280 arrivals were measured against their
destination's real `<width>`/`<height>` and **0 land outside**.

### 15.5 THE TRANSITION, DRIVEN — AND THE HALF THE ARTIFACT CANNOT SEE

§5's first acceptance is now a driven fact rather than an assertion. A tape boots
at a door's `approach` cell, holds **one key**, and the game transitions from the
room data alone with nothing correcting it afterwards:

```
PASS: walking into room 2's door at (5, 3) reaches room 3 — level 3, tick 27
PASS: CONTROL: the same boot with no input stays put — level 2
PASS: LATCH: booting ON the portal does not warp — level 2
```

The control matters: without it, "the level is now 3" is equally consistent with
a boot that simply landed in 3. The latch arm is §15.3's mechanism, asserted in
the artifact rather than inferred from the source.

⛔ **AND THE SIGN IS NOT DRIVEN. THE FIRST VERSION OF THAT GATE READ A CHANNEL
THAT STRUCTURALLY CANNOT CARRY IT.** The announcement is a `Message` entity added
by `Game.begin()` when `sign >= 0`; `botMobiles` walks `Vector.<Mobile>` (plus
`Pod`) and **`Message extends Entity`**, and `botStatus` has no sign field. The
arm asserted a Message count and its CONTROL printed **PASS for "0 messages"** —
true of every arm ever run, including one that announced a region correctly. It
is deleted rather than green, the run prints what is not driven and why, and the
rule is asserted on the JS side against a transcription of `Teleporter`'s
`sign = _sign - 1`, `Game.sign` and `Message.as`'s closed table. Driving it needs
a new bot callback, which is an AS3 change and out of this slice's scope by §5.
**This is kickoff §4's "a gate can print PASS for the opposite of what happened",
and it is the second time in two phases.**

⚠ **The walk sampled 2 of 10 doors** — one fresh page per arm, so a full sweep is
one page per door. The run prints that, because a bounded sweep must name what it
bounded.

### 15.6 ⛔ ONE MUTANT, TWO DEFECTS — AND BOTH FOUND GAPS IN THE GATES

| defect | JS suite | round trip |
|---|---|---|
| **D1** `signForTransition` drops the same-region case | **3 red**, all naming the sign rule | **red**: `10 announced of 10` |
| **D2** door candidates drawn from the whole room interior instead of the walkable component | **1 red** → *(after the fix)* **3 red** | **GREEN** |

Attribution read off each failure's reason, not off a count. Both results were
findings about the gates rather than about the defects:

- ⛔ **D2 first reddened ONE test, and not the one it violates.** Every linked
  test room was fully **open**, so *"a door is in the room's walkable component"*
  was true of every cell and could not fail. Same shape as Phase 5's D2 and the
  same answer: closed rather than left tidy — each test room now carries a sealed
  pocket holding the cell farthest from the start by raw distance, which is
  exactly what such a mutant picks. **Post-fix D2 reds three**, including the
  component and approach-cell assertions.
- ⛔ **D2 leaving the round trip GREEN is the honest bound**, and it is why §15.5
  prints what it sampled. Placement is the JS suite's claim; that the game MOVES
  on the data is the round trip's.
- ⚠ **D1 exposed brittleness in the arm itself.** Under D1 a different door is
  "crossing", and that door's walk hops **twice** — the arrival lands on the
  return door and the key is still held — so the sharp assertion went red for the
  hop rather than for the defect. `WALK_TICKS` 60 → 45 holds the crossing arm to
  one hop in every run; **measured, not proven**, and the within-region arm still
  double-hops (0 → 1 → 2), which is why that one asserts only that the player
  left and stayed inside its region.

### 15.7 THE `teleport` CAPABILITY, DE-SCOPED — AND ITS PREMISE WAS HISTORICAL

⛔ **§4.6's opening premise does not describe the running system.** It says the
frontend uses the teleport API *"to simulate different exit destinations"*.
Measured: `teleport`'s live consumers are the **debug region/location jump UI**
and **`seedlingRegionGlue`'s arrival warp**. Nothing in this repo simulates exit
randomization with it, so *"a randomized exit costs two world constructions"* was
a property of a design that was never built. The slice's value is not that it
deletes that cost; it is that a generated set is **N isolated rooms** without it.

⛓ **AND THE STRUCTURAL ARGUMENT IS BETTER THAN THE COST ONE.**
`Teleporter.update()` writes the static `Game.sign` on the line **after** its own
`new Game`, and the `teleport` recipe does not touch `Game.sign` at all. So a
frontend-corrected exit announces the region of the room the player did **not** go
to, and there is nowhere in the capability to fix it. **Exits-as-data is not
merely cheaper; it is the only mechanism that can get the sign right.**

⚠ §4.6's stated harm is also not how it would fail. It says the wasted `new Game`
runs *"every entity's `check()`"* in the vanilla destination. It would not:
`check()` runs inside `Game.update()` behind the `!checked` latch, entities are
built in `begin()`, and `FP.world = …` defers the swap — so a world replaced
before the frame boundary is never begun and nothing in it is ever constructed.
The constructor's own side effects are `Main.printItems()` and `end()` (which
resets `fallthroughLevel`/`Sign`/`Offset`).

The de-scope is recorded where a future caller will read it — the adapter's own
docblock and a `_note` in the game config — rather than only in a plan.

### 15.8 Gates

- `npx vitest run frontend/modules/seedlingDemo/` — **3880/3880**, 109 files,
  **382.85 s** (3833 + 47: the linker 43, the exporter's `link` option 4).
  Load **1.97 at the start**, peaking ~12 during the run — the suite's own
  workers on 8 cores, with nothing else on the box. ⚠ Recorded because §14.7's
  three false reds happened at 22.8, and "which box ran this" is part of the
  number.
- `node scripts/procgen/check-seedling-generated-set.mjs --seeds=1-6` —
  **32/32** (26 + 5 new arms + the sender-side reachability check) in
  `seedling_bot_ap_p4b` on real-GPU Windows Chrome (`intel / gen-9`), load 0.46.
- `node scripts/procgen/check-seedling-vanilla-manifest.mjs` — **24/24**.
  ⚠ **AND IT WAS RED BEFORE THIS SLICE TOUCHED IT, FOR A REASON NOBODY OWNED**:
  the default page was still `seedling_bot_ap_3b` while Phase 4a moved the
  content hash (`-367e679f` → `-02408e1d`, §12), so a bare invocation reported
  two failures with nothing wrong in the tree. Default is now the current
  artifact; the older builds stay reachable through `SEEDLING_PAGE`.
- `node scripts/procgen/solve-seedling-r8-battery.mjs --check | md5sum` —
  `1fedb0ab35b7cd74accecf0345bdc893`, unchanged.
- The eleven `check-seedling-editor-*.mjs` — all OK.

### 15.9 What Phase 5b did NOT do

- ⛔ **The sign is not driven in the artifact** (§15.5). No readout can carry it;
  a `botSign` callback is an AS3 change.
- ⛔ **Exits are not GATED behind a room's own puzzle** (§15.4 bound 1). A
  generated set is now traversable and its rooms' obstacles are optional.
- ⛔ **Nothing randomizes vanilla.** The retarget arm is built and gated on the
  real 280-exit graph, and no caller in this repo asks it for a seed. That is the
  consumer §4.6 imagined and it still does not exist.
- ⚠ **`<control>` fallthroughs and `<buttonroom>` are RETARGETABLE but never
  EMITTED.** The linker places teleporters (or stairs, by option); a generated
  room still has no pit and no cross-room button. ⛔ And a `<control>` with no
  `@fallthrough` would set `fallthroughLevel` to **0** — a real room, not the
  `-1` that `Player.as:758`'s `> -1` guard treats as "no pit destination" —
  because `Game.as:2144` assigns an E4X attribute list straight into an `int`.
  ⚠ **INFERRED FROM THE COERCION, NOT DRIVEN**: it cannot arise in vanilla, where
  all 12 `<control>` elements carry `@fallthrough` (measured). An emitter that
  ever writes `<control>` must always write `@fallthrough`.
- ⚠ **`tapeFormat.parsePersistence` still bounds `persistence[].level` to
  `0..115`** — §6's residue, unchanged from §14.8.
- ⚠ **The save-stamp UPGRADE case is still unexercised** (§13): this runtime
  never writes a `.sol`, and the cross-session case is the one a player meets.
- ⚠ **No generated set has been PLAYED end to end.** Three transitions have been
  driven; nobody has walked a set from room 0 to room 5.
- ⚠ **The exporter still has no page arm** (§14.8): `watchGenerate`'s GENERATE
  arm cannot hand a level to a set, and the CLI is the only producer.

---

## 16. THE ARC, END TO END — for a reader picking this up cold

Every section above records one slice. This one records what the whole thing
does, because no single phase document says it and the next person to touch this
will need it before they need any of the rest.

### 16.1 What exists now that did not before

**Seedling's 116 levels were compiled into the artifact as `[Embed]` assets, and
its level table, persistence table and every room reference were literals in
`Game.as`. Now a level set is DATA, delivered at runtime, and the vanilla game is
one such set.** Concretely:

1. **A level set is a manifest plus its rooms** (§4.1), frozen at schema v1 (§9):
   `rooms[]` each carrying `source.xml` (OEL text) or `source.embed`, plus
   `start`, `menu_rooms`, `named_rooms`, `music`, room flags, and a `set_id`
   ending in the FNV-1a **content hash** of the document.
2. **The vanilla 116 are a manifest like any other** (§11) — built-in, not
   special-cased. That is what makes the format testable: a schema the real game
   cannot satisfy is wrong, and building vanilla as a fixture caught two rules
   that would have broken it (§9.3, §14.1) and one this slice nearly wrote
   (§15.3).
3. **A set crosses into the artifact in chunks** (§8.1, §9.1) — bounded on rooms
   AND bytes, assembled by room **id** rather than by arrival order, validated,
   and mounted only after assembly.
4. **The save carries the set's stamp** (§13). A mismatch on `set_id` or
   `content_hash` takes the whole save; an unstamped save is adopted.
5. **A set can be GENERATED** (§14): `procgenSeedling` → `procgenLevelOel` →
   `levelSetExporter` → validate → chunk → deliver → mount.
6. **Its rooms are CONNECTED** (§15): exits are data the game reads itself.

### 16.2 The four things a newcomer will get wrong

- ⛔ **The game does not check anything.** An out-of-range level boots with a live
  VM and reads its whole persistence row as *every tag already cleared* (§8.3).
  `levelSetValidator` is the only line of defence and it refuses **by name**.
- ⛔ **A key-name scan answers what a thing is CALLED, never what it IS.** Five
  times in this arc: `@fallthrough` rides `<control>` and not the level root;
  `<buttonroom>`'s `@room` is a cross-level persistence WRITE; the atlas's level
  ids are called `map_ref`; `bloody_seed_ending`'s trigger is `<watcher>`, not
  `<seed>`; and `sign` is not a property of the room it names. **Ask the
  consumer.**
- ⛔ **Ask vanilla before writing a rule.** Three rules in this arc would have
  refused the real game: `tag+1 must be free` (§9.3), *"no room carries
  `<moonrock>`"* on an embed-sourced set (§14.1), and *"an arrival must not land
  on a portal"* (§15.3). The 116 are committed as a fixture precisely so this
  costs one test rather than one release.
- ⛔ **Procgen is not deterministic under load, and neither is the suite.** A
  succeeded solve past `wallClockMs` becomes `BUDGET_EXHAUSTED`
  (`procgenOracle:503`), and Phase 5's first full-suite run was red at load 22.8
  on code that is clean at load 0.5. `cat /proc/loadavg` before believing a
  number.

### 16.3 Where the seams are

| you want to… | go to |
|---|---|
| change what a set may contain | `levelSetValidator.js` — the JSON Schemas are documentation, this is the authority |
| change how a set crosses | `planLevelSetChunks` / `assembleLevelSetChunks`, and §9.1 for why the bound is rooms AND bytes |
| change what the artifact does with a set | `~/CC/seedling` on `bot` — `LevelSet.as`, `Game.as`'s four seams (§10.1). **Every AS3 edit needs a rebuild to a wasm before anything can be said about it** (§4.7), and each push is asked separately |
| produce a set | `levelSetExporter.js` + `scripts/procgen/export-seedling-level-set.mjs` |
| change exits | `levelSetExits.js` (§15) |
| know whether it still works | the five gates in §15.8 |

### 16.4 What the arc deliberately did not do

- **Nothing regenerates the 24 vanilla AP references** — they are INVALIDATED per
  set, with a stamped companion (§14.6). `location_coords` is exactly derivable;
  `region_coords` is transcribed from a **commented-out** debug-warp block, so
  regenerating it means inventing a convention vanilla never had.
- **`named_rooms` is a closed vocabulary of six**, and a seventh code-built room
  reference already exists that the frozen `roomRef` cannot carry (§11.4).
- **`Message.as`'s sign table is closed at seven.** A set cannot name an eighth
  region without an AS3 change (§8.2c, §15.1).
- **Room GEOMETRY is hardcoded in five boss classes** (§8.2c). A generated room of
  a different size silently breaks them; the PoC's rooms are one screen.
- **Nine LIVE debug warps reach level 110** (`Player.as:1827-1999`). Under a small
  set they are out of range and boot as *everything already cleared*. A set author
  cannot control them, so it is a warning.

### 16.5 The one-line summary

**A Seedling level set is now a validated, stamped, chunked document that the
game mounts at runtime; vanilla is one of them; the repo can generate one; and as
of Phase 5b its rooms are connected by exits the game reads itself — proven by
walking the artifact through a door with one key press.**
