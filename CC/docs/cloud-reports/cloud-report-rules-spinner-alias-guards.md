# Cloud report — `rules-spinner-alias-guards`: guard the tag −1 alias slots `{N−1, 29}`

Base: `origin/main` = `f96d6b66254cd8c2dd08323a489d5d1f07525600`. Branch `claude/rules-spinner-alias-guards-xynki2`.
Evidence: `CC/docs/cloud-reports/rules-spinner-alias-guards-evidence/` (tools, run logs, the two out-of-scope patches).
Byte-neutral: no rule, preset, atlas, table, generated-world or engine-closure byte moved (§2, §3).

## Answer table

| guard | file(s) | mutant (unit test) | result |
|---|---|---|---|
| **derivation** | `frontend/modules/seedlingDemo/outOfBandAliases.js` (`aliasTargetsOf`, `aliasWritersOf`, `aliasCollisionsOf`, `aliasReservedFor`) | vanilla map; L18 with its spinners removed; L18 spinners with `@tag` absent / `tag="4"`; a level-0 writer; a `fire tag="-1"` added to L33 | vanilla = **exactly `{17:{29}, 91:{29}}`** from 5 named writers (L18 `spinner@48,96`, `spinner@112,48`; L92 `spinner@224,64`, `breakablerock@176,48`, `breakablerock@256,112`); spinner-less L18 → only `{91:{29}}`; absent / in-band tag → no target; level 0 → none, no throw; the `fire` → `{32,29}` |
| derivation: classes read, not re-listed | `ALIAS_WRITER_TYPES` = `levelWorld.OUT_OF_BAND_WRITER_CLASSES` + every `OUT_OF_BAND_WRITERS` class not mapped there, under its loader element name | the pin reads `vendor/seedling/src/Game.as`: every `xml.objects[0].<el>` loader that builds a ledger class must map to it | PASS. It found one gap: `fire` (`Game.as` `new Fire(o.@x, o.@y, o.@tag)`) has no engine row, so a map-placed `fire tag="-1"` was invisible to the engine's table. It is covered here through the ledger, with no second edit |
| **(a) allocator, existing map** | `apPlacementRewriter.js` (`buildPlacementTable` → `placementTagId(record, [...allocated, ...aliasReservedFor])`); `seedlingRandomizerWiring.js` (the atlas arm's P4E `allocateTag`, wrapped the same way; `AP_ATLAS_MODULE_PATHS.outOfBandAliases`) | L17 crowded to tags 0..28: `placementTagId` alone returns **29**, and with the reservation it **refuses**. Rewriter: L19 crowded to 0..28 plus a `spinner tag="-1"` in L20 → **refuses**; the same crowding with no writer → allocates 29 (legitimate) | PASS |
| **(a) generated level, built before its successor** | `levelSetValidator.validateLevelSet`: an END-OF-BUILD refusal by name (designer ruling; **no** standing slot-29 reservation) | a 2-room set: `apitem tag=29` in room 0 + `spinner tag=-1@48,96` in room 1 → one error naming `apitem@16,16 in L0`, `spinner@48,96 (L1, Spinner)` and `Main.as:222`. Controls: writer in band, no writer, owner at slot 28 → no alias error | PASS. **It fires on no measured fixture** (§2), so no reservation was needed and the STOP did not trigger |
| **(b) rules producer** | `flashPanel/seedlingObstacleEvents.refuseAliasedEvents(events, writers)` (pure, writers injected); called in `make-seedling-playthrough-rules.mjs` `compilePlaythroughRules` over `[...layer.events, ...ropes.events]`, so every minted kind is covered (obstacle, lock, button, pole, talk, rope) and the ER compile too | synthetic event `flag:L17:29` → throws, naming `spinner@48,96 (L18, Spinner), spinner@112,48 (L18, Spinner)` and citing `Main.as:222`; the same event on a map whose L18 has no spinners → passes; the committed playthrough's flag events → pass; `writers` missing → refused by name | PASS. `--check` OK on AP_1 + the atlas |
| out of scope (2) | `jsRuntimeCore.reportClears` → call address | `evidence/js-runtime-report-call-address.patch` (+ test) | NOT APPLIED. Applies to the base, and its test passes in scratch (§4.1) |
| out of scope (3) | `levelWorld.tagOf` absent `@tag` | `evidence/levelworld-tagof-absent-tag.patch` (+ Game.as pin test) | NOT APPLIED. Applies to the base, its test passes in scratch, and the measured divergence is **0 placements** (§4.2) |

GAME verdicts: no new game witness was needed. The mechanism is **GAME YES** from the predecessor's wasm run
(`rules-spinner-tag-alias` `w1-l18-spinner-press.json`: two L18 Spinner deaths write `{17,29}`). Every guard here is
derived from that mechanism's source lines: `Main.as:222` `levelPersistence[i*30+j]` with no bounds check, and
`Game.as:1902-1904`. No level or tag literal appears outside a test expectation.

## 1. What the derivation reads, and why "explicit tag only"

- Writers: `OUT_OF_BAND_WRITER_CLASSES` (levelWorld F6) plus the ledger (`OUT_OF_BAND_WRITERS`). The lower-cased name
  is the loader's own spelling, and the Game.as pin holds it to the loader.
- Tag: the engine's `tagOf`, counted only when `@tag` is present, which is `levelWorld.outOfBandWritersOnto`'s rule.
  The reason: `o.@tag` on a missing attribute is `int("")` = 0 in the loader, an in-band write.
- Landing: `outOfBandFlagForWriter`, which refuses an unclassified class.
- Re-run of the predecessor's `tools/census.py` on this base (`census.md`): the same 5 writer rows. Rules events are
  now **41** (were 40), the highest event tag is 12, the highest map tag is 24, and no alias slot is owned or named.

## 2. Byte identity (per preset and fixture)

`tools/byte-identity.mjs <root>`, run on a worktree at the base and on the tip. The full outputs are
`runs/byte-identity-{base,tip}.txt`. The diff (`runs/byte-identity.diff`) is the tip's two `aliases:` lines only:

| artifact | base = tip |
|---|---|
| `assembleGeneratedSeedlingSet` set + table + report: `seedling_generated_{chestdoor,host,leaf,room,swim}` | identical md5s (e.g. room `22b6a773…`, swim `ff95b924…`) |
| the same on the 12 non-generated seedling presets | refused identically by name (no `flash_seedling_gen` sidecar) |
| `validateLevelSet(fixtures/seedling-vanilla-set.json)` | ok, 0 errors, warnings md5 identical |
| `buildPlacementTable` canonical (vanilla 116 + AP_1 placement), entries | `7e1354d3…`; allocated tags `19:3,29:1,40:14,55:0,67:0,39:5,40:20,40:25,41:3,42:0,115:0` |
| `rewriteRecordSet` delivered vanilla set | `791a15a7…` |
| atlas check table with the P4E allocator (alias wrap replayed at the tip): playthrough ×2, ER, atlas, atlas_location, … | identical (playthrough/ER: 30 entries, 11 retags, `5b0087d1…` / `b854077b…`) |

Producer checks (all at the tip):
- `node scripts/procgen/regen-seedling.mjs --check`: **every step OK** (rules, partition, world, template,
  host-settings, seed1, maze, er, sphere-order, census).
- `make-seedling-playthrough-rules.mjs --check`: the atlas and `AP_1_rules.json` match a fresh build.
- `stamp-seedling-vanilla-set.mjs --check`: set id unchanged (`seedling-vanilla-02408e1d`).
- `refresh-seedling-derived-rules.mjs --check`: fresh and on count (rows 99, regions 47, excluded 6; payload, engine
  and witness md5 match).

## 3. Engine closure

`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`: **engineMd5 `74ae60f575531492ed9eaec1839e1fe3`
(42 files), at the base and at the tip**. diff ∩ closure = ∅: none of the 7 changed or added files is among the 42
(`runs/engine-closure-tip.txt`). Both proposed patches also touch files outside the closure.

Certifier `probe-seedling-whole-game-certify.mjs --shards=2 --arms=new` (headless, logic-only):
- **vanilla: 1 problem / 16 accepted / 0 threw.** The problem is `level_63__r6c9 → level_63__r0c1` holding
  `[Ghost Spear, L63 flag 7: lightpole@112,272 cleared]` (OPEN_L63 only). Clean 114/115. `runs/certify-vanilla.log`.
- **`--source=er`: 1 / 16 / 0, the same single OPEN_L63 row.** 48 departures moved, 16 table rows skipped by name.
  `runs/certify-er.log`.

## 4. Out of scope: proposed diffs (not applied)

### 4.1 `jsRuntimeCore.reportClears` reports the CALL's address — `js-runtime-report-call-address.patch`

- Divergence (measured by the predecessor on `r8-l18-spinner-press`): wasm `pendingCheck` = `1|18|-1|0`, `2|18|-1|0`
  (one report per call, at the call's address, `Game.as:1906-1907`). The JS page posts `|17|29|0` once (the slot,
  deduplicated).
- Patch: a new `liveReports(run)` gives one report per out-of-band `spinnerWrites` row at `{row.level, −1}`, and
  every other clear once at its slot. `reportClears` iterates it, keyed by `key`. `liveClears` (the TABLE) is unchanged.
- Test (`jsRuntimeReportAddress.test.js`, in the patch): the L18 rows → `['18|-1', '18|-1', '18|0']`, while
  `liveClears` still holds `{17,29}`. It applied with `patch -p1` to the base worktree and the test passed (2/2).
  Owner: JS substrate arc.

### 4.2 `tagOf` reads an absent `@tag` as the loader does — `levelworld-tagof-absent-tag.patch`

- Patch: `LOADER_RAW_TAG`, the 56 loader elements whose `Game.as` line passes `o.@tag` raw to an `int`, so absent is
  `int("")` = 0. `tagOf` returns 0 for those and −1 otherwise (`optionalTag` ×3, the teleporter's `String==""` form,
  and the 79 loaders that pass no `@tag`). `FORCED_TAG` is still read first.
- Test (in the patch): the set equals what a parse of `Game.as` derives, plus spot rows (`lock {}` → 0,
  `bosskey {}` → −1, `teleporter {}` → −1, `moonrockpile` forced). It applied to the base and passed (2/2).
- **Measured divergence: 0** (`tools/absent-tag-census.mjs` → `absent-tag-census.md`). That covers the vanilla map
  (116 rooms) and every generated preset's delivered set (`chestdoor` 3, `host` 2, `leaf` 2, `room` 3, `swim` 2): no
  placement of a raw-`o.@tag` element omits its tag. So the patch moves nothing today. It is latent for a future
  generated or edited room. Owner: fidelity arc.

## 5. Findings and limits

- **`fire` is missing from `OUT_OF_BAND_WRITER_CLASSES`** (levelWorld; engine, not edited). `Game.as` loads
  `<fire>` with `o.@tag`, and `Fire.removed()` writes under `doActions`. The alias derivation covers it through the
  ledger. `levelWorld.outOfBandWritersOnto` (the build's provenance check) does not. No map or generated room places
  a `fire` today. Owner: fidelity.
- **Call sites not changed, and why.** `seedlingGenRoom.js:1150` and the 4 `procgenSeedling.js` sites (1960, 2273,
  2676, 3959) build a level before its successor exists, so the end-of-build refusal (`validateLevelSet`, which
  `seedlingGeneratedSet` refuses on) covers them, per the ruling. `check-seedling-ap-placement.mjs:1614` is a
  browser check script on a vanilla key room, not a producer.
- The validator sees only rooms it can read. `embed` rooms are already warned as unchecked. For `xml` rooms the
  refusal names the owner as `<el>@?,?` (the regex index carries no coordinates); `record` rooms are named exactly.
- The rewriter's `vanilla`-tag branch keeps a tag the data already holds. A vanilla tag at an alias slot would show
  up as a validator error on the delivered set, not as a reallocation.
- Nit: when the reservation is what exhausts a crowded level, `placementTagId`'s refusal reads "uses all 30
  persistence tags". The listed set includes the reserved 29, so the message is accurate, but it does not say why 29
  is taken.

## 6. Tests run (bounded; never unfiltered)

- `npx vitest run <97 files>`: **97 files / 2237 tests passed**. A second sweep that matches imports by any path
  found 5 more importers (`flashPanelSameWiringRemount`, `seedlingRegionBinding`, `certifyPocketTalk`,
  `contentIdentity`, `probeSeedlingErRetarget`): **5 / 113 passed**. The list is `runs/vitest-files.txt` and the
  summary `runs/vitest-summary.txt`. Together they cover:
  - the new tests;
  - `outOfBandLedger`, `seedlingObstacleEvents`, `seedlingKillLocks`, `procgenPalette`, `flashSeedlingGen`,
    `procgenSeedlingAreas`;
  - every test importing a touched file (rewriter, validator, wiring, obstacle events, ledger, the producer);
  - the derived-count readers (`seedling-derived-rules-expected.json`);
  - `seedlingDivergenceLegs.test.js` and `seedlingMountKeyLevelSet.test.js`.
- Slow tier: `npx vitest run --config vitest.slow.config.js
  frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.slow.test.js` → **2/2 passed** (171 s,
  `runs/vitest-slow-deriveLevelWorldLogic.txt`).
- No procgen doc was touched, so the procgen docs census was not run.

## Provenance

- Setup: `session_bootstrap.sh --seedling` READY; the six submodules initialised; `minimal-spoilers`; no submodule
  pointer moved. No dev server or box lock was needed (no wasm probe this slice).
- The base worktree (scratch, not committed) symlinked `frontend/modules/shared` and `vendor/seedling` to the
  primary's (same pinned commits). Both proposed patches were applied there only after the base byte-identity run.
