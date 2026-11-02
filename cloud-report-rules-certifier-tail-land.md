# cloud report — rules-certifier-tail-land

Branch `claude/rules-certifier-tail-regen-b41zvy`. ⚖ Robert 2026-11-02 "Yes, land it". The planner drops this file before landing.

## Merge
- Started from `origin/rules-certifier-tail` = 7e6fa31000.
- `git merge-base` BEFORE: `844045138652e39ff598dd8a1a5cf87bfc4957d5`. AFTER: `1e5b7efd9865aa39198a1d3396ca81bd554ef333` (= origin/main tip).
- 14 conflicts. Every generated output and pin took main's side and was then regenerated or re-recorded. `boxLock.test.js`
  was hand-unioned (main's two cloudberry rows plus `probe-seedling-certifier-tail.mjs`).
- `certifyPlaythroughMaze.js`: the merged tree matches main (2a5fce78 ≡ 5d7f4e620d).
- Real source carried from the branch, unedited: `make-seedling-playthrough-rules.mjs` (`chargeNecessaryApproaches`),
  `regionAtlasAnalyzer.js` (+ its test), the probe, and `seedlingPlaythroughNecessaryDoors.test.js`.
- The lethal-landings, waterfall-door and certifyLandingGates tests auto-merged and pass unedited.

## Commits (first-parent, over main)
1. `68ed8958` merge.
2. `13e16801` regen through the producers in order: rules (atlas) → partition → world_generator → Generate.py seed 1 (minimal-spoilers) → maze preset → vanilla overlay `--write`. `atlas_files.json` restamped. Atlas `07d995bd → ecbd44ee`; maze atlas `7ecee70c → 52d1d2cd`.
3. `4ffcd895` pins:
   - levelSetExporter and door census: atlas id → `ecbd44ee`;
   - vanillaOverlay: atlas md5 `51d2f8d1… → 4a96e1ec…`. The branch's overlay hunks were re-applied and are identical to
     the branch's base: 13 cannot-rules, 29 rules, 316 free exits, overlay `2ef0551f`, 16,334 B;
   - **OPEN_L3_L111 removed** from `deriveLevelWorldLogic.slow.test.js`. A comment there names the row and says why it closed;
   - `sphereOrderLevels.test.js` sphere 11.6: the cut now has no problem, and its mutant became a control (drop the Swim and the row reopens);
   - the slow tier was re-recorded by running it. problems = `[OPEN_L63]`. The skip census gained 2 rows:
     `level_111 → level_112__r2c2 (landing 18,11) | 1/2` and `level_111 → level_3__r0c4 (landing 18,11) | 1/2`. The
     branch's own +2 rows (L53→L54 9,14 and L89→L91 13,1) and its accepted −1 (L91→L89 Swim) hold.
4. `e31e3032` procgen reference: 526 instruments. Constants census `--write`: only 13 `seedlingSemantics.js` rows shifted
   one line (1191→1192). That file is untouched by this branch, so main's CSV was behind main.

## Diffs vs main
- **AP_1 rules.json** (and seed-1 `_rules.json`, the same set): exactly 3 exit rules move. The branch at its base produced the same three.
  - `level_3__r0c4 -> level_111`: And(rock) → And(And(rock), Has Swim).
  - `level_54__r1c8 -> level_53__r14c9`: True_ → Has Swim.
  - `level_91 -> level_89__r1c10`: True_ → Has Swim.
  - L49's charge, and the other 9 of the 13 charged doors, live in the atlas. In AP they were already paid by a landing gate
    or a sub-region entry, so no AP rule moves. Atlas exits changed: L0/240_0, L3/0_64, L49/32_128, L51 ×2, L54 ×2, L55/80_48,
    L56/0_112, L58 ×2, L89/160_304, L91/16_144.
- **Seed-1 sphere log + spoiler: byte-identical to main.** No sphere move.
- `Rules.py`: L3→L111 +Swim; new set_rule entries for L54→L53 and L91→L89.
- **Maze preset**:
  - same 3 exits;
  - `sphere_log` identical;
  - sidecars: `level_3__r0c4` `atlas_gate_1` clear_rule += Swim, and `level_91` `atlas_gate_0` gains cell (1,9);
  - `region_atlas` id restamped.
- `preset_files.json` / `apquest` dirt: none (Generate wrote no new preset files; tree clean).

## Gates
- Producers `--check`: playthrough-rules OK, subregion-partition OK, maze "byte-identical", vanilla-overlay OK (after `--write`).
- `generate-procgen-reference.mjs --check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH.
- Bounded vitest:
  - 90 files / 1634 tests passed. They cover every test that reads the playthrough atlas, AP_1, the maze preset, the
    partition, atlas_files or the overlay; every touched test; boxLock; noNewDocsReferences; checkProcgenHelp; seedlingConstantsCensus.
  - Divergence / leg-key tests: 72 files / 3223 passed.
  - Slow: `deriveLevelWorldLogic.slow.test.js` 3/3 (374 s).
- No edits to worlds/seedling, vendor, .github, submodule pointers, the solver or CONTACT_FIDELITY.

## Left for the planner
CI: JSUT/unittests on push; TT; the probe 8×; the whole-game certifier A/B; the survey A/B. design-2 reviews the certifier row-diff.
