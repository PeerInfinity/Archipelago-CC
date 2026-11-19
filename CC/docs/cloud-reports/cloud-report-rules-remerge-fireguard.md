# cloud-report — rules-remerge-fireguard

Branch `claude/rules-remerge-fireguard-ljknrc`. SOURCE `origin/claude/rules-fire-arm-chaser-guard-5o1nn3` =
`c98789a2479ec936401e2c921e7e211aab3d4461` (`git rev-parse HEAD` after `checkout -B`). `origin/main` =
`756d28a19659beb5ff4e9ea07e53ad48e50df68a` (train 135, L99's sided kill-lock). Merge base `c1927ba307`.
This is a mechanical re-merge: no rule logic, producer, solver, `levelRun`, `CONTACT_FIDELITY` or level data changed beyond what
the source branch already carried. No submodule pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling` or `.github/`
was touched. Evidence: `CC/docs/cloud-reports/rules-remerge-fireguard-evidence/` (`runs/`, `tools/keywalk.py`).

## Answer

| question | answer | evidence |
|---|---|---|
| Merge resolves with both sides' intent | **YES**. 17 conflicts: 12 generated files took main's side in the merge commit and were regenerated; 4 hand-written files kept both sides; `architecture.md` took main's side and was regenerated | `59323db7` |
| Every producer `--check` green after the regen | **YES**: rules, partition, maze, seedling_er, sphere order (**unchanged**), worldgen freshness PASS, procgen reference (7 modules + 5 regions) | `runs/check-*.log`, `runs/worldgen-freshness.log` |
| Atlas | `seedling-2ac275e8` → **`seedling-630fbc4c`**, md5 `28dc5dc7` → **`26bec328`**, internal exits **317 → 316** (as briefed) | `runs/keywalk-atlas.txt` |
| AP_1 rows: exactly the branch's movers | **YES, exactly 3 DEL, all `Has(Fire)`**: `level_73__r0c4 -> level_73__r3c7`, `level_73__r3c7 -> level_73__r0c4` → `Or(Dark Suit, Progressive Sword, Ghost Spear)`; `level_100__r4c10 -> level_100__r2c3` → `Or(Progressive Sword, Ghost Spear)`. All other changes are id restamps (266 `atlas_ref`, `region_atlas`/`provenance` atlas_id) plus `provenance.set_patches += "l73-lavarunner-moved"` | `runs/keywalk-ap1.txt` |
| `seedling_er` | Same 3 Fire DELs and the same restamps; **no placement moves** (50 placements, 48 exits moved, draws 1, source atlas 630fbc4c) | `runs/keywalk-er.txt`, `runs/check-make-seedling-er-preset.log` |
| Maze | Only L73 and L100: the same 3 Fire DELs; `action_lib.fire` deleted in `level_73__r0c4` and `level_100__r2c3`; `rock_4_3`/`rock_8_9` → `rock_sword_spear` (12 changes in total) | `runs/keywalk-maze.txt` |
| Seed 1 | `_sphere_log.jsonl` and `_Spoiler.txt` **byte-identical to main**. `_rules.json` moves only on the 3 rows (`item_names` loses `Fire`) plus restamps. `.archipelago` also moves. `preset_files.json` (newline only) reverted | `runs/keywalk-seed1.txt`, `git diff --quiet origin/main -- <sphere log> <spoiler>` |
| Derived-rule table | **No row moves**: 108 rows / 51 regions / 6 excluded, deep-equal to main's. CERT **1/16/0** (the one problem is `level_63__r6c9 → level_63__r0c1`, explained path-vs-edge). Every pinned count PASSes. `payloadMd5` `4b4fd1b6` → **`c03264c5`**, `measuredAt` `70852378c2`. Committed (inputs only) | `runs/derived-rules.log`, `f348af03` |
| engineMd5 | **`bec369878feb67081187edca62baa951`** (42 files), unchanged | `runs/engine-closure.txt` |
| Campaign frontier | Only `sources` failed. AP_1 md5 `858fa745` → **`8c3cdc8a`**, patched by hand. Then **15 pass / 0 fail** (no `--write-frontier`) | `runs/check-frontier.log`, `38cc600b` |
| Bounded vitest | **14 files, 285 tests, all pass** | `runs/vitest-bounded.log` |
| Census report moved | `cloud-report-rules-landing-contact-census.md` → `CC/docs/cloud-reports/` (`git mv`). Its paths were already repo-relative and no file links to it. Other root reports were left in place | `16d63b20` |
| Any STOP | **None.** No unexpected row moved, every mover moved, and no seed-1 sphere moved | the walks above |

No game witness was run. The slice changes no logic, and the source branch's GAME verdicts (L73 ×2 GAME NO with Fire, Sword GAME YES;
L100 accepted by Robert) carry over unchanged, because the movers are byte-for-byte the same rows.

## Conflict resolution (merge `59323db7`)

- **Generated, main's side, then regenerated** (12 + 1): `atlas_files.json`, `seedling-playthrough.json`,
  `seedling-subregion-partition.json`, `procgenDocs/generated/instruments.js`, the four preset `AP_1`/seed-1 files plus
  `.archipelago`, `worlds/seedling_playthrough/_worldgen_{region_atlas,rules,sidecars}.json`, and the counts region of
  `architecture.md`.
- **`make-seedling-playthrough-rules.mjs` imports**: both kept. `FCG` (the guard, from the branch) and `modelFloodPoints`
  (from L99's slice, main).
- **Test pins** (`levelSetExporter.test.js`, `vanillaOverlay.test.js`, `seedlingAtlasDoorCensus.test.js`): both slices' comments
  kept, chained `… 316 -> 317 (L99) -> 316 (chaser guard)`. The merge commit carried main's values. `026cff5a` re-pinned them
  from the producers' output: atlas `630fbc4c`, internal exits 316, md5 `26bec328054eda2ae6a90409a405cbc1`.

## Commits

1. `59323db7` the merge
2. `70852378` re-record by recipe (rules → partition → maze → ER → sphere `--check` → world_generator `--canonical-seed 1` +
   freshness → `Generate.py` seed 1, minimal-spoilers → `atlas_files.json` → `generate-procgen-reference.mjs`)
3. `026cff5a` the test pins
4. `38cc600b` the campaign frontier `sources` md5
5. `16d63b20` the census report move
6. `f348af03` the derived-rule table (inputs only)
7. `0c036291` the evidence
8. this report

## Bounded vitest (files listed explicitly)

`frontend/modules/seedlingDemo/{fidelityMoonrock,levelSetExporter,seedlingSetPatches,vanillaOverlay}.test.js`,
`scripts/procgen/{boxLock,seedlingAtlasDoorCensus,seedlingLandingContact,seedlingErMode,seedlingPlaythroughObstacleEvents}.test.js`, the guard module's own unit-test file (beside `seedlingFireChaserGuard.js`),
`frontend/modules/flashPanel/{atlasIndex,seedlingCompositeMap,seedlingObstacleEvents}.test.js`,
`frontend/modules/mazeRoom/mazeSeedlingLink.test.js`: 14 files, 285 tests pass. After the table copy,
`derivedRuleTableFresh` + `derivedRuleOverride`: 19 pass.

## For the planner

- The derived-rule table was measured locally (`GITHUB_SHA=70852378c2…`). Re-run it on CI per REGEN_RECIPE. A CI re-record
  should differ only in `measuredAt`.
- Whichever of this slice and the Wand re-merge lands second needs re-merging again. Expect conflicts in the same generated set,
  the same 3 pin files, and the frontier `sources` md5.
