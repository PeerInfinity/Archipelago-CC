# Content packs PL-1: the pack layers for the shared task shape, the world settings, and provenance (as built)

Slice PL-1 of the content-sets arc. Branch `content-packs-pl1`, based on origin/main `75e45c964d`. The design is
§ "Z — the final shared task shape" of the structure-options write-up (ruled Z1–Z6: "I agree with all of your
recommendations."), plus Z7 and Z8, which the user ruled while this slice ran and the planner relayed. The second
slice, PL-2, takes the resolver, the rule table and the gap report (Z.5 resolver, Z.6). None of them is built here.

## 1. What was built, by commit

| Commit | Part |
|---|---|
| `482b5cbb1e` | 1–2: `KNOWN_LAYERS` gains `structure`, `numbers` and `bindings` (`LOGIC_LAYERS`). `PACK_CONCEPT_KINDS` gains `task`, `stat`, `resource` and `boon`. `presents` takes two forms. The three readers are in `frontend/modules/packStructure/`. `ContentPackError` moves to its own file |
| `3bc6fd17dc` | 3–4: the provenance block, the loader check, the report script, and the backfill of the five packs. **One commit**, because the loader refuses every pack that has no block, so the check and the backfill cannot land apart |
| `b2f25635fb` | 5: the settings `exists`, `numbers` and `numbersMode`, the record, the read-back and the refusals |
| `c288bee3fe` | 3, follow-up: three more in-memory fixture stacks that the bounded run found |
| `21935ded77` | 6: docs, the generated reference, and the doc-link census (421 → 422) |

## 2. The manifests as built: one example per new layer

These are the fixture packs (`frontend/modules/packStructure/fixtures/packs/`), written from Z.2 and Z.4. No
committed pack carries these layers yet.

`structure` (`omsi/structure/manifest.json`). It holds all six of Y's forms: C1 `owner`/`max`, C2 `grows_with`,
C3 `when`, C4 `modifies`, C5 a task with no place (in `jta`), and C6 alternative `requires` sets.

```json
{
  "schema_version": 1,
  "_comment": "A TEST FIXTURE (packStructure.test.js): the Z.2 example, every C1–C6 form at least once.",
  "provenance": {
    "sources": {
      "z": { "type": "authored", "by": "the Z write-up's example (content-sets-structure-options, Z.2)" },
      "fill": { "type": "derived", "from": ["z"], "by": "R1@1" }
    },
    "default": "z",
    "groups": { "omsi:task/buy-": "fill" }
  },
  "entries": {
    "omsi:place/beginnersville": { "kind": "place" },
    "omsi:place/forest-path": { "kind": "place" },
    "omsi:resource/mana": { "kind": "resource" },
    "omsi:resource/gold": { "kind": "resource" },
    "omsi:resource/supplies": { "kind": "resource" },
    "omsi:stat/dex": { "kind": "stat" },
    "omsi:stat/per": { "kind": "stat" },
    "omsi:stat/wander": { "kind": "stat", "owner": "omsi:task/wander", "max": true },
    "omsi:resource/glasses": { "kind": "resource",
      "modifies": [ { "entry": "omsi:task/wander", "part": "results.omsi:stat/wander", "lasts": "loop" } ] },
    "omsi:task/wander": {
      "kind": "task", "place": "omsi:place/beginnersville", "time": "omsi:resource/mana",
      "results": [ { "stat": "omsi:stat/wander" }, { "stat": "omsi:stat/per", "when": "each" } ],
      "limit": true, "tags": ["check"]
    },
    "omsi:task/pick-locks": {
      "kind": "task",
      "place": "omsi:place/beginnersville",
      "time": "omsi:resource/mana",
      "requires": [
        [ { "stat": "omsi:stat/dex" }, { "stat": "omsi:stat/per" }, { "stat": "omsi:stat/wander" } ],
        [ { "resource": "omsi:resource/gold" } ]
      ],
      "results": [
        { "stat": "omsi:stat/dex", "when": "each" },
        { "resource": "omsi:resource/gold", "sign": "+", "when": "every_nth" }
      ],
      "limit": { "grows_with": "omsi:stat/wander" },
      "after": [ [ "omsi:task/wander" ] ],
      "tags": []
    },
    "omsi:task/buy-supplies": {
      "kind": "task", "place": "omsi:place/beginnersville", "time": "omsi:resource/mana",
      "requires": [ [ { "resource": "omsi:resource/gold", "consume": true } ] ],
      "results": [ { "resource": "omsi:resource/supplies", "sign": "+" } ],
      "limit": true
    },
    "omsi:task/start-journey": {
      "kind": "task", "place": "omsi:place/beginnersville", "time": "omsi:resource/mana",
      "requires": [ [ { "resource": "omsi:resource/supplies", "consume": true } ] ],
      "results": [ { "opens": "omsi:place/forest-path", "when": "last" } ],
      "limit": true, "after": [ [ "omsi:task/buy-supplies" ] ]
    }
  }
}
```

`numbers` (`omsi/numbers/manifest.json`). Under Z7 a set holds defaults only.

```json
{
  "schema_version": 1,
  "_comment": "A TEST FIXTURE (packStructure.test.js): the Z.4 numbers example. Under Z7 a set holds DEFAULTS only.",
  "provenance": {
    "sources": { "z": { "type": "authored", "by": "the Z write-up's example (content-sets-structure-options, Z.4)" } },
    "default": "z"
  },
  "sets": {
    "omsi": {
      "exists": "omsi",
      "economy": { "start_clock": 250 },
      "values": {
        "omsi:task/pick-locks": { "time": 400, "requires.omsi:stat/wander.min": 20,
                                  "limit": { "ratio": 1 }, "results.omsi:resource/gold": { "base": 10, "every": 10 } },
        "omsi:stat/wander": { "max": 100 },
        "omsi:resource/glasses": { "modifies.results.omsi:stat/wander": { "mult": 4 } }
      }
    },
    "action_nodes": { "exists": "omsi", "economy": { "loop_mana": 100 },
      "values": { "omsi:task/pick-locks": { "time": 30 } } }
  }
}
```

`bindings` (`jta/bindings/manifest.json`):

```json
{
  "schema_version": 1,
  "provenance": {
    "sources": { "z": { "type": "authored", "by": "the Z write-up's example (content-sets-structure-options, Z.4)" } },
    "default": "z"
  },
  "bindings": {
    "jta": { "jta:task/beg-for-food": { "id": 14, "type": "Normal", "skills_slots": [0], "hidden_by_default": false } }
  }
}
```

The field rules are the ones Z.2 and Z.4 give. Details this slice fixed (Z marked them "detail"):
- A structure key's namespace must be its pack's id, so packs added together cannot collide.
- Every id an entry names must be an entry of the stack, of the right kind (`createStructure`).
- A numbers set's value keys must belong to the pack its `exists` names. A value is a number, or a one-level object
  of numbers.
- A binding's key must be an entry of its own pack.
- A namespaced `presents` must match `<pack>:<kind>/<slug>`, and the kind must be the presenting concept's own
  (`task` presents a task).
- The one-presenter-per-pack rule and latest-pack-wins hold for both forms of `presents`. `assertPresents` skips the
  namespaced form, because the words never load the structure layer. `packStructure.assertPresentsStructure` checks
  it where both layers are loaded.
- ⛔ The words never read the new layers. `CONTENT_LAYERS` stays `['concepts', 'text']`, and
  `packStructure.test.js` pins that a content set over packs carrying every layer fetches only `concepts`.

## 3. Provenance: the block on each backfilled pack

The source counts (`node scripts/procgen/report-pack-provenance.mjs`, at the tip):

```
pack            layer      source             type      entries
seedling        art        seedling           game      222
seedling        art        font               model     1
seedling        sfx        seedling           game      38
seedling        music      seedling           game      18
archipelago     art        seedling-fork      game      1
archipelago     art        logo64             derived   1
archipelago     art        archipelago-icon   game      0
text-adventure  concepts   claude             model     4
text-adventure  text       claude             model     6
maze            concepts   claude             model     4
meta            concepts   r3                 model     15
meta            concepts   s1                 model     5
meta            text       r3                 model     2
meta            text       s1                 model     7
meta            text       s2                 model     2
meta            art        r4                 model     14
meta            art        r5                 model     3
meta            art        s2                 model     3
```

How each pack was recorded:
- **`seedling` and `archipelago`** are GENERATED. Their blocks come from `scripts/procgen/seedlingPackProvenance.js`,
  called by the extractors. Regenerated, and `extract-seedling-art-packs`, `-sfx-pack` and `-music-pack --check` are
  all OK. The game source names `PeerInfinity/Seedling` at the commit this repository's index pins for
  `vendor/seedling` (`ccdf189776…`), not the HEAD of a `--source` checkout. That way a copied checkout (the mutant
  tests use one) gives the same bytes. The font is its own source: `model`, `claude-opus-5-5`, from
  `e7288a431d`'s trailer, dated 2026-10-21. The 64×64 logo is `derived` from `data/icon.png` by
  `archipelagoLogoArt.mjs`. An authored art row with no source is refused by name.
- **`maze`, `text-adventure` and `meta`** are `model`, `claude-opus-5-5`. Every file's commit trailer names
  Claude Opus 5.5, including the 2026-09-30 code that the maze and text-adventure strings were moved from (the
  `note` names those commits). `approved` is on the S1 and S2 sources only, by "PeerInfinity (the repository
  owner)", dated 2026-11-14. That covers S1's words (Narrator, Placeholder, the three pieces of information, the
  Gate's `{item}` lines) and S2's words and shapes. R3, R4 and R5 carry none (the R3/R4 review is logged as open,
  and no approval of R5 is logged). The three `pack.json` credits said "Hand-made", which is untrue, and now say
  what the blocks say.

**`frontend/packs/archipelago/art/manifest.json`**

```json
{
  "sources": {
    "seedling-fork": {
      "type": "game",
      "name": "Seedling (the PeerInfinity fork's AP item pickup)",
      "repo": "PeerInfinity/Seedling",
      "commit": "ccdf189776471fa57be8c0568c6e881a2d5acc18",
      "files": [
        "assets/graphics/ArchipelagoLogo.png"
      ],
      "credit": "the Archipelago application icon, downscaled to 16x16 by the Seedling fork (src/Pickups/APItem.as:67-73)",
      "licence": "MIT",
      "extracted_by": "scripts/procgen/extract-seedling-art-packs.mjs --check"
    },
    "logo64": {
      "type": "derived",
      "from": [
        "archipelago-icon"
      ],
      "by": "scripts/procgen/archipelagoLogoArt.mjs",
      "licence": "MIT",
      "note": "data/icon.png (512x512) by an 8x8 box filter"
    },
    "archipelago-icon": {
      "type": "game",
      "name": "Archipelago (the application icon)",
      "path": "data/icon.png",
      "licence": "MIT"
    }
  },
  "default": "seedling-fork",
  "groups": {
    "archipelago:pickup/item-64": "logo64"
  }
}
```

**`frontend/packs/maze/concepts/manifest.json`**

```json
{
  "sources": {
    "claude": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-11",
      "note": "the names, colours and symbols were first written as code (frontend/modules/mazeRoom/mazeConcepts.js, 54032fb273, 2026-09-30, Co-Authored-By: Claude Opus 5.5) and moved here byte for byte by content sets R2 (3faae00e00, Co-Authored-By: Claude Opus 5.5), which wrote the descriptions. No approval of these words is recorded"
    }
  },
  "default": "claude"
}
```

**`frontend/packs/meta/art/manifest.json`**

```json
{
  "sources": {
    "r4": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-11",
      "note": "the meta theme's maze art, content sets R4 (8e5a91015e, Co-Authored-By: Claude Opus 5.5). The user's review of the R3/R4 words and art is logged as open, so no approval is recorded"
    },
    "r5": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-14",
      "note": "the Gate's, the sword's and the swim's shapes, content sets R5 (b2a2cea36f, Co-Authored-By: Claude Opus 5.5). No approval of these shapes is recorded"
    },
    "s2": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-14",
      "approved": {
        "by": "PeerInfinity (the repository owner)",
        "date": "2026-11-14"
      },
      "note": "content sets S2 (e8e7ce6cc0, Co-Authored-By: Claude Opus 5.5): the maze variants of the Narrator's and the Placeholder's lines, and their maze shapes and the sign's; the user approved S2's words and shapes on 2026-11-14"
    }
  },
  "default": "r4",
  "groups": {
    "meta:object/gate": "r5",
    "meta:object/sword": "r5",
    "meta:object/swim": "r5",
    "maze:object/sign": "s2",
    "meta:character/narrator": "s2",
    "meta:character/placeholder": "s2"
  }
}
```

**`frontend/packs/meta/concepts/manifest.json`**

```json
{
  "sources": {
    "r3": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-11",
      "note": "the meta theme, content sets R3 (841d5d27cb, Co-Authored-By: Claude Opus 5.5). The user's review of the R3/R4 words and art is logged as open, so no approval is recorded"
    },
    "s1": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-14",
      "approved": {
        "by": "PeerInfinity (the repository owner)",
        "date": "2026-11-14"
      },
      "note": "content sets S1 (56c87f0ab9 and e5ef790ff8, Co-Authored-By: Claude Opus 5.5): the Narrator, the Placeholder, the three pieces of information and the Gate's {item} lines; the user approved S1's words on 2026-11-14"
    }
  },
  "default": "r3"
}
```

**`frontend/packs/meta/text/manifest.json`**

```json
{
  "sources": {
    "r3": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-11",
      "note": "the meta theme, content sets R3 (841d5d27cb, Co-Authored-By: Claude Opus 5.5). The user's review of the R3/R4 words and art is logged as open, so no approval is recorded"
    },
    "s1": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-14",
      "approved": {
        "by": "PeerInfinity (the repository owner)",
        "date": "2026-11-14"
      },
      "note": "content sets S1 (56c87f0ab9 and e5ef790ff8, Co-Authored-By: Claude Opus 5.5): the Narrator, the Placeholder, the three pieces of information and the Gate's {item} lines; the user approved S1's words on 2026-11-14"
    },
    "s2": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-14",
      "approved": {
        "by": "PeerInfinity (the repository owner)",
        "date": "2026-11-14"
      },
      "note": "content sets S2 (e8e7ce6cc0, Co-Authored-By: Claude Opus 5.5): the maze variants of the Narrator's and the Placeholder's lines, and their maze shapes and the sign's; the user approved S2's words and shapes on 2026-11-14"
    }
  },
  "default": "r3",
  "groups": {
    "meta:concept/guardian/blocked": "s1",
    "meta:concept/guardian/passedWith": "s1",
    "meta:character/narrator/says": "s1",
    "meta:character/placeholder/says": "s1",
    "meta:info/checks/body": "s1",
    "meta:info/exits/body": "s1",
    "meta:info/rooms/body": "s1",
    "meta:character/narrator/says/maze": "s2",
    "meta:character/placeholder/says/maze": "s2"
  }
}
```

**`frontend/packs/seedling/art/manifest.json`**

```json
{
  "sources": {
    "seedling": {
      "type": "game",
      "name": "Seedling",
      "repo": "PeerInfinity/Seedling",
      "commit": "ccdf189776471fa57be8c0568c6e881a2d5acc18",
      "files": [
        "assets/graphics"
      ],
      "credit": "art by Connor Ullmann (vendor/seedling/README)",
      "licence": "Unlicense",
      "extracted_by": "scripts/procgen/extract-seedling-art-packs.mjs --check"
    },
    "font": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-10-21",
      "licence": "MIT",
      "note": "ORIGINAL glyphs (not 04B_03): the glyph table in scripts/procgen/make-seedling-font.mjs, first committed in e7288a431d (Co-Authored-By: Claude Opus 5.5); the sheet is that script's fontSheetBytes(), not a checkout file"
    }
  },
  "default": "seedling",
  "groups": {
    "seedling:font/default": "font"
  }
}
```

**`frontend/packs/seedling/music/manifest.json`**

```json
{
  "sources": {
    "seedling": {
      "type": "game",
      "name": "Seedling",
      "repo": "PeerInfinity/Seedling",
      "commit": "ccdf189776471fa57be8c0568c6e881a2d5acc18",
      "files": [
        "src/Music.as",
        "assets/sound"
      ],
      "credit": "music by Rekcahdam (vendor/seedling/README)",
      "licence": "Unlicense",
      "extracted_by": "scripts/procgen/extract-seedling-music-pack.mjs --check"
    }
  },
  "default": "seedling"
}
```

**`frontend/packs/seedling/sfx/manifest.json`**

```json
{
  "sources": {
    "seedling": {
      "type": "game",
      "name": "Seedling",
      "repo": "PeerInfinity/Seedling",
      "commit": "ccdf189776471fa57be8c0568c6e881a2d5acc18",
      "files": [
        "src/Music.as",
        "assets/sound"
      ],
      "credit": "sound effects by Rekcahdam (vendor/seedling/README)",
      "licence": "Unlicense",
      "extracted_by": "scripts/procgen/extract-seedling-sfx-pack.mjs --check"
    }
  },
  "default": "seedling"
}
```

**`frontend/packs/text-adventure/concepts/manifest.json`**

```json
{
  "sources": {
    "claude": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-11-10",
      "note": "written for this pack by content sets R1 (5a18d3916d, Co-Authored-By: Claude Opus 5.5). No approval of these words is recorded"
    }
  },
  "default": "claude"
}
```

**`frontend/packs/text-adventure/text/manifest.json`**

```json
{
  "sources": {
    "claude": {
      "type": "model",
      "model": "claude-opus-5-5",
      "date": "2026-09-30",
      "note": "first written as code (frontend/modules/textAdventureSubstrateWrapper/textAdventureConceptRealisations.js, 7bbf0491e1, Co-Authored-By: Claude Opus 5.5) and moved here byte for byte by content sets R1 (5a18d3916d). No approval of these words is recorded"
    }
  },
  "default": "claude"
}
```


## 4. Byte equality

| Instrument | Result |
|---|---|
| A scratch probe in this tree and in an export of `75e45c964d` (submodules copied): every `SHIPPED_PRESETS` entry generated headless through `prepareRunFromState` → `runPresetHeadless`, md5 of the `rules.json` | 25 presets, **0 differ**; 1 heavy preset skipped on both sides (as the slow tier skips it) |
| The same probe: every committed `rules.json` whose driver is `sphere-growth` or `top-down-sphere`, through `rebuildEnvelopeFromRulesJson` → `serializeEnvelope`, md5 per player | 25 worlds, **0 differ** (8 refuse the rebuild, identically on both sides) |
| `make-seedling-spiral-room-preset.mjs --state=concept-trial --check` / `--state=meta-trial --check` | both OK (a fresh build matches the committed preset) |
| `seedlingDerivedRuleTable.js --print-engine-closure`, base export and tip | **identical**: `engineMd5 bec369878feb67081187edca62baa951 (42 files)`, and no file of the diff is in it |
| `provenance.test.js` | no committed `rules.json` (all of them) contains any source note or model id |
| `worldSettings.test.js` | the concept trial world with `exists` and `numbersMode: assign` equals the committed preset once those two `procgen_metadata[p]` keys are removed |
| No preset file in the diff | `git diff --stat 75e45c964d -- frontend/presets` is empty |
| `ci-producer-checks.mjs` (every `plan-seedling-*`, `regenerate-*-tapes` and `regenerate-*-presets` `--check`), at the tip | `PRODUCER-DONE | 99 run | 0 red | 1 skipped | 0 known-red`; `git status --porcelain` empty afterwards |

Pack consumers: the Seedling JS runtime, the maze skin and tile art, the text adventure, and the lab art gates all
read through `loadPackStack`, and every committed pack passes the check. `artLibrary.test.js` did not move (the art
library is unchanged; meta's per-entry art sources are `groups`, not a new shape field). The TT dispatch's CI-GATE
lines are the browser evidence; they are quoted at the exact tip in the report back to the planner.

## 5. The settings (Z.5, Z8)

- `params.exists`, `params.numbers` and `params.numbersMode` reach `regionParams` through `assembleRegionParams`
  (`worldSettingsRegionParams`), and `procgen_metadata[p]` through the existing record (`recordedContentOf`), in the
  order `content`, `exists`, `numbers`, `numbersMode`. Each is written only when it is not the default:
  - `exists` is not written when it equals the mix's default packs, in order;
  - `numbers` is written when it names packs;
  - `numbersMode` is written only as `assign`.
- `rebuildRegionParams` reads all three back, validated by name, and a caller's own value wins. `--param exists=…`
  and `--param numbers=…` are lists on `sphere-step` and `topdown-step`.
- **Refusal by name.** `assertWorldNumbers` loads only the numbers layer of each pack `params.numbers` names. A pack
  with no set for the world's substrate over the world's `exists` (its own, or the defaults) is refused before
  anything is built. It runs in `prepareRunFromState`, `sphere-step`, `topdown-step` and the pipeline panel's
  `_loadWorldContent`. When no numbers pack is named, it reads nothing.
- **Z8, as the planner made it stable.**
  - An ABSENT `numbersMode` in a document always means `table`.
  - Generation writes `assign` whenever a world is generated in that mode: its own `params.numbersMode`, or else
    `assign` when every substrate in its mix declares `numbersWalk: true` on its registry entry.
  - No entry declares a walk in this slice, so nothing is written. A test pins that the real registry declares none.
  - Both halves are pinned with a fixture registry: absent means table; generation under walking substrates writes
    `assign`.
- **Z7.** Nothing here treats a numbers set as final. `createNumbers` merges a stack (later wins per value path) and
  answers values; the semantics are PL-2's.
- **A picker: cheap, and nothing to pick yet.** An `exists` or `numbers` row would follow the Content set row's
  pattern (`selectableContentPacks`, filtered to packs whose `pack.json` lists a `structure` or `numbers` layer), and
  `numbersMode` would be a two-value select: tens of lines. But no committed pack carries those layers, so the rows
  would be empty.

## 6. The loader refusals (measured messages)

- `content pack "p" layer "concepts" provenance: the manifest has no provenance block (every layer names its sources)`
- `content pack "p" layer "concepts" provenance key "p:place/a": src "nobody" is not a listed source (hand)`
- `content pack "p" layer "concepts" provenance: source "m": an "unrecorded" model needs its family`
- `content pack "p" layer "concepts" provenance: default "gone" is not a listed source`
- `pack structure: pack "p" structure manifest: entry "p:task/a": field "cost" is not one a task takes (kind, src, place, time, requires, results, limit, after, tags)`
- `pack structure: pack "p" entry "p:task/a": time names "p:resource/mana", which no pack in the stack holds`
- `pack numbers: pack "p" numbers manifest: set "maze": values "p:task/a": "cost" is not a value path (time, limit, max, requires.<id>.<field>, results.<id>, modifies.<part>)`
- `numbers names the pack "p", which has no set for the substrate(s) [maze] over the world's exists [maze] (its sets: omsi over p)`
- `world content: params.numbersMode "fixed" is not one of assign, table`

## 7. Tests

- New:
  - `frontend/modules/contentPacks/provenance.test.js`: the block; each type's required fields; resolution; the
    loader refusal; every committed pack and layer resolving; the report's counts; model ids from trailers;
    `approved` only on S1/S2; no provenance in any committed world; check 2.
  - `frontend/modules/packStructure/packStructure.test.js`: the fixture packs from disk; C1–C6; refusal by name; the
    words presenting structure; the words reading concepts only; numbers; bindings.
  - `frontend/modules/procgenPipeline/worldSettings.test.js`: the record, the read-back, Z8's two halves, the
    refusals, and a real generation.
- Moved:
  - `packConcepts.test.js`: the kinds list, and `src` on the field-coverage fixture, plus new `presents` refusals;
  - `contentRoles.test.js`: the namespaced `presents` skip;
  - `docLinks.test.js` and `docsRender.test.js`: census 421 → 422, one `same-doc` link;
  - in-memory fixture stacks wrapped in `contentPacks/testing/fixtureProvenance.js` in `contentPacks`, `packConcepts`,
    `contentRoles`, `textLibrary`, `worldContent`, `regionJobContent`, `mazeConceptArt`, `mazeTileArt`,
    `mazeThingOverlay`, `mazeContent`, `mazeThings` and `textAdventureContent`.
- Bounded local run: `npx vitest run` over the brief's gate list and every suite that loads packs, records or rebuilds content settings, or names the step CLIs (68 files found by `grep -a`), plus `contentPacks`, `packConcepts`, `textLibrary`, `artLibrary`, `procgenCore`, `mazeRoom`, `procgenDocs` and `packStructure`: **231 files, 6490 tests, all passed**, at `21935ded77`. The unfiltered suite number comes from CI (ruling 52).
- **Check 2's "checked set".** Each `extracted_by` script must parse `--check` and have its own `<name>.test.js`
  beside it that imports it. Those tests run the same drift function `--check` prints, and they are how the
  extractors' checks run in CI. `ci-producer-checks.mjs`'s globs do not cover the extractors, because that job has
  no `vendor/seedling`.

## 8. What the code overturned or refined

1. **Parts 3 and 4 are one commit** (see §1).
2. **Per-entry sources in the text and art layers are `groups`**, with the whole key as the prefix. Text rows are
   plain strings, and the art library's shape fields are closed (adding `src` there would move the art library,
   which the Seedling runtime shares).
3. **The Seedling art manifest's `authored` sheet field and its `generated_by` line are KEPT** beside the block.
   Z.7's "one mechanism replaces three" is a detail. Removing them would move `seedlingFont.test.js` and the
   manifest rows the runtime reads. The block now carries the same facts (the font and the logo are their own
   sources).
4. **The Seedling game source names repo + commit, not a path.** `seedlingSource.js` says provenance names the
   repository, never a path.
5. **The words stack does not yet add a non-default `exists` pack's own concepts and text underneath** (Z.5's
   words default). Both readers of that stack are the resolver's, so it moves to PL-2. With `exists` absent (every
   world today), nothing differs.
6. **Z7 and Z8 arrived mid-slice.** Z8's default is held stable as the planner ruled (§5): `numbersMode` and the
   registry field `numbersWalk` are new names (Z called the key name a detail).
7. **Defects my own tests found:** the field-coverage pin found that no fixture stat used `modifies` (a fixture gap,
   fixed). The bounded run found three in-memory fixture stacks my first sweep missed (fixed in `c288bee3fe`). No
   code defect.

## 9. Landing

`actionnodes-an1` lands first. This branch re-merges main once after it lands, on the planner's word, and
re-measures the doc-link census then. Gitlinks in the diff: 0.
