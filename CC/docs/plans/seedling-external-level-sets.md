# Seedling External Level Sets — Plan

**Date:** 2026-08-13 ·
**Status: PLANNING — no code written. Design settled with the user
(2026-08-13); every phase below is unstarted.**

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

One bundle, self-describing, pushed over EI. Sketch — **the schema is frozen in
Phase 2, after §3.4's measurement, not here**:

```
{
  set_id:      "seedling-vanilla" | "procgen-2026-08-13-abc123",   // IDENTITY
  schema_version: 1,
  rooms: [ { id: 0, name: "OverWorld1", oel: "<xml …>", music: 0 }, … ],
  start:        { level: 0, x: …, y: … },
  menu_rooms:   [12, 37, 44, 87, 88, 89],
  named_rooms:  { watcherText: 114, moonrockTarget: 2 },   // §3.5's last two
  effects:      { snowGradient: [45] }
}
```

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

### 4.3 The three seams in the AS3

1. **Parse split** — `loadlevel(Class)` keeps its signature and becomes a
   3-line wrapper over a new `loadLevelXML(xml:XML)`. The 366-line body moves
   wholesale, unedited.
2. **Table indirection** — `levels[…]` is dereferenced in exactly two places
   (`Game.as:774`, `:798`); both go through a lookup that returns embedded
   Class or external XML.
3. **Transport** — `botLoadLevels` beside `botLoadTape`, same shape.

### 4.4 ⛔ The cleanup policy: ADDITIVE ONLY

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
- [ ] **Phase 3 — The AS3 seams** (§4.3), each its own commit: parse split;
      table indirection; `botLoadLevels`; `Bot.as`'s three bounds checks.
- [ ] **Phase 4 — Persistence + the save stamp** (§4.2). The `Main.as:319`
      rule, the `set_id` field, and the mismatch path that rebuilds loudly.
- [ ] **Phase 5 — The exporter**: emit a manifest from generated levels
      (`procgenSeedling` output → bundle), including the per-level metadata the
      manifest now owns.
- [ ] **Phase 6 — The tag allocator** (model-side, independent): a counter over
      `0..29`, a reserved list starting with `goalTag = 0`, hard refusal on
      exhaustion, and an assertion that no template's tag equals the goal's.
      Closes the collision `2a407a817` left open.

Phases 1–2 gate 3–5. Phase 6 is independent and may land at any time.

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
3. Does the vanilla set ship AS a manifest — i.e. do the embedded rooms become
   just another set, mounted by default? It is the cleaner shape and it makes
   the external path the ONLY path (so it cannot rot), but it puts the 116
   embedded assets behind the same indirection and is a bigger first cut.
   **Undecided.**
4. `TAGS_PER_LEVEL = 30` is defined twice in the model — `breakableRocks.js:60`
   and `tapeFormat.js:615`. Two constants that agree until one moves; worth
   collapsing while this area is open.
