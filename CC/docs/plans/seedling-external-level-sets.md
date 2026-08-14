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
directions.** 151 classes read by name: the sweep missed **six more live
cross-level references in code** (two of them teleporters built at runtime, so
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
| `@to` | **3** — `<teleporter>`, `<stairsup>`, `<stairsdown>` | **228** teleporters + **52** stairs (26 up + 26 down) | any level |
| `@room` | 1 — `<buttonroom>` | 11 total, **4 cross-level** | 37, 39, 62, 63 |
| `@fallthrough` | 1 — **`<control>`** (`Game.as:2125-2129`) | **12 rooms** | 0, 17, 21, 30, 31, 43, 49, 57, 69, 82, 84, 85 |

**303 data-borne level references**, against 6 in code.

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
- `verify-seedling-bot-differential.mjs --win --tier=full` — **SWEEP_RESULT**
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
