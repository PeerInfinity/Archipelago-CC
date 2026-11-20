# Slice G: the Seedling player refuses a custom set by name

Session `seedling-unserved-atlas-guard` (Opus), 2026-11-19/20, licensed by Robert's Q1 *"G + S1, then replan"* and
Q3 *"Stay empty, say why"*. Branch `seedling-unserved-atlas-guard`. The base is origin/main `3a1909b2dc`, merged
up to `03872f77c0` before gating.

## Summary for Robert

- **The hazard.** A Seedling set whose rooms are not the original game's could load as **eligible** and silently
  play the **original** rooms under the set's own rules. The study measured this with probe p5: one tree added to
  room 10, compiled as `seedling` with the vanilla map document. The load went `eligible` on the vanilla arm, and the
  delivered room 10 had no tree.
- **The fix.** These rules name a region atlas that this page does not serve: the `atlas_id` is not in
  `atlas_files.json`. The player now **refuses them by name**, on both runtimes (JS and wasm). The Flash panel
  **starts no game**, with or without a `flash_panel` block, and shows:

  > **This set can't be played yet**
  > these rules name a region atlas this page does not serve (atlas id `seedling-lab-2730489e` is not in
  > atlas_files.json) — a custom set: its rooms are not the original game's, and the player cannot deliver them
  > yet. If this is a preset you just regenerated, regenerate or serve its atlas.

- **What did not change.** Every committed Seedling preset gives the same verdict and arm as before, and the
  generated arm is untouched. Rules that name no atlas fetch nothing new.
- **What it is not.** It does not make a custom set playable; that is S3/S4. It ends when a set's own rooms can be
  carried to the game.

## The guard

| Where | What |
|---|---|
| `flashPanel/seedlingRandomizerEligibility.js` | `unservedAtlasRefusal({atlasId, served})`, checked first inside check `atlas`. Only the vanilla and atlas arms reach that check: a `generated` divert skips it. Also `unservedAtlasWhy(id)` (the sentence), `CUSTOM_SET_NOT_PLAYABLE`, `servedAtlasIds(index)`, and `servedRegionAtlas({atlasId, fetchIndex})`, the one reader of the served index. The input is `regionAtlas`. If it is absent, or has a blank id, nothing is asked. `served: null` (index unreadable) refuses too. |
| `flashPanel/seedlingRandomizerWiring.js` `loadSeedlingRandomizer` | **Both runtimes** (the `transport` argument, `js` or `wasm`). After the cheap call, if the slot's `region_atlas["<p>"].atlas_id` is set, it fetches `atlas_files.json` once and asks again. It refuses **before** the record set and map are fetched, so S1's label `map_document` is refused by this sentence, not by "map not reachable". The input is also passed to the assets-failure call and the full call. |
| `flashPanel/flashPanelUI.js` `_initializeAdapter` → `_customSetRefusal` / `_showCustomSetRefusal`, and again at the top of `_startSeedlingRandomizer` (bridge ready) | Before any transport is chosen, for rules with `flash_seedling` rooms (the loaded slot's) and no generated ones. The same predicate runs, and if `failed === 'atlas'`: no adapter and no iframe; the status, the stage and the log show the message; `_apLoadRefusal` = `atlas: <sentence>` (what the Playback Bot controllers read). A panel holding no game (this refusal, or "no game configured") re-initializes on a same-wiring rules load, so a lab set loaded after a non-Flash preset still shows it. **At bridge ready** the same question is asked again: a custom set there tears the game down and shows the message. This case is rules landing while a game is still booting. It is not re-mounted (`_mountedRoomsDiffer`, "it will read these"), so the init asked its question of the previous rules. The index URL is resolved against `document.baseURI`, as in the wiring. |

**Why the panel scopes to `flash_seedling` rooms.** The committed `seedling_playthrough_maze` names an unserved atlas
(`seedling-3d17c6c3`) but carries only maze rooms. It must not show the message.

**S1's ids** (confirmed by S1, `lab-set-seedling-identity`, cc lab-7) have the form `seedling-lab-<8 hex>`
(`stampAtlasIdentity(copy, 'seedling-lab')` after a rooms fingerprint in `tile_space.map_source`). Examples:
`seedling-lab-2730489e` (vanilla 116, empty overlay) and `seedling-lab-6fa4aad3` (with the vanilla overlay).
`region_atlas["1"]` is `{atlas_id, game: 'seedling', map_document: 'watch.html set editor'}`, there are 115
`flash_seedling` sidecars, and there is no `flash_panel`. The distinct base cannot equal a served id
(`seedling-9ff3df2a`, `seedling-ea1ef5ba`, `seedling-fixture-b656bf3b`), and S1 pins that.

## Proofs

**Measured first: the panel today (base `flashPanelUI.js` + wiring, the two new in-app rows, JS runtime):**
- With a `flash_panel` block (the p5 shape): **the JS game booted and ran** (status `ready`, adapter and iframe up).
  The load only logged `ap placement: not applicable — atlas: the atlas index lists no atlas "seedling-lab-2730489e"`.
- Without one (S1's shape): status `no game configured`, no game, **and no reason given**.
- At the tip, both rows pass: no adapter, 0 iframes, 0 embeds, the status and the stage read the message, and
  `_apLoadRefusal` = `atlas: <sentence>`.

**p5 (node, through the lab's own compile):**

| run | result |
|---|---|
| the study's probe, base | `eligible`, arm `vanilla`, 116 rooms, delivered room 10 without the tree |
| tip | `ineligible`, `failed: atlas`, the sentence; nothing delivered |
| **source MUTANT** (`if (unserved) return fail(unserved);` removed) | p5 `eligible`, arm `vanilla`, 116 rooms again. **7 rows red**: 4 eligibility rows, the p5 js + wasm rows, the unreadable-index row |

The committed row is `flashPanel/seedlingUnservedAtlasGuard.test.js`. It rebuilds p5 with `rulesJsonOf` +
`compileRegionAtlas`. The js and wasm loads are refused before the documents. A CONTROL load with `seedling` added
to the index is eligible on the vanilla arm, and its room 10 has no tree: that is the hazard itself. An unreadable
index is also refused.

**Eligibility rows** (`seedlingRandomizerEligibility.test.js`, slice G block):
- an unserved id is refused by name on the vanilla arm, the atlas arm and the JS cheap call;
- a served id gives `toEqual` today's verdict, for every served id;
- an absent id (six shapes) gives `toEqual` today's verdict;
- the generated arm is unchanged (`toEqual`, js and wasm);
- an earlier `transport` failure still outranks the guard;
- `servedRegionAtlas` does no fetch without an id.

**Two existing rows moved with the guard (deliberate):**
- `seedlingAtlasArm.test.js` "an atlas the index does not list…": now refused by the guard's sentence, with
  `eligibility.arm: null`, before the atlas arm is chosen. It used to be `loadSeedlingAtlas`'s own index refusal
  with arm `atlas`. That refusal stays, for a direct call.
- `mapDocumentPath.test.js` T4 row: its fetch stub now serves `atlas_files.json`. The preset's id is served, so the
  row still reaches the map document it is about.

**The 8 preset slot rows** (`seedling_atlas`, `_host`, `_location`, `seedling_er`, `seedling_playthrough` ×2,
`_sphere_room`, `_spiral_room`):
- Each runs the real `loadSeedlingRandomizer` on wasm and on js: 16 rows.
- Digest of (verdict, arm, failed, rooms): `0a2e8a2b8637b3cf25783a59d96054f3` at the base and at the tip.
- Whole dump including a why-md5 per row, with the tree path normalized: `ff93471f42f0b3fac1b9a7d1c38ec895`, identical
  at origin/main `03872f77c0` and at the merge.
- The result is 3 vanilla × 2 + 5 atlas × 2, all `eligible`.

**Gates:**

| gate | result |
|---|---|
| `regen-seedling.mjs --check` | every step OK (155.7 s) |
| acceptance (`batch-seedling-acceptance.mjs \| md5sum`) | `391322d681b7aa0229d94b3f6906d024`, unchanged |
| bounded vitest (⚖ 52): every test importing a touched file (`grep -a -l`), at the merge | 30 files, all pass |
| `generate-procgen-reference --check` / `check-procgen-docs` | regenerated for the doc edit; all match / ALL CHECKS PASSED; `procgenDocs/` vitest 9/9 files |
| `print-engine-closure` ∩ diff | ∅ (42 files, `engineMd5 bec369878feb67081187edca62baa951`) |
| gitlinks / presets / wasm / `vendor/seedling` / atlases / lab files | 0 / 0 / untouched |
| JSUT push `44668818490` @ `8e2444ec63` | success: 1378 files / 29141 tests, 0 failed (main `03872f77c0`: 1377 / 29125), so **+F 0, +T 16** (+1 file); slow battery 438/438 |
| `unittests` push `44668818555` @ `8e2444ec63` | success |
| TT dispatch `44668831503` @ `8e2444ec63` | success, all 9 jobs. **seedling-js 39/39**: 37 unchanged + the 2 new custom-set rows. **seedling-wasm 12/12**: unchanged, no row added. fast, fast (bundled boot), playback-bot, seedling-js-solver, apworld, ALTTP & regression: green |
| earlier TT `44664748232` @ `fc2bf47b39` | failure: seedling-js 38/39, the race above (fixed in `8e2444ec63`) |

**The CI red, and the fix (measured, then fixed).**
- TT run `44664748232` at `fc2bf47b39` was red on the seedling-js batch, 38/39: `custom-set-with-flash-panel` was
  red. It runs right after `same-wiring-switch-loads-new-rooms`, and on the same wiring the custom rules landed
  while that row's game was still booting.
- Reproduced locally with that pair and debug lines. The init's check saw the previous preset's served id; the
  booted original game's AP load then refused on the wiring's guard, and the game kept running.
- Fix `8e2444ec63`: the bridge-ready re-ask. Unit row: `flashPanelSameWiringRemount.test.js` "slice G — a CUSTOM
  SET … reaching bridge ready stops the game". It is red with the block mutated off (1 row, 9 others green).
- After the fix: the pair plus the without-row pass locally, the whole seedling-js batch is 39/39 locally, and TT at
  the tip is below.
- **Residual of this path:** in that race the original game *boots* and is then stopped at bridge ready. On wasm,
  that happens after a ▶ Start click. The AP load never runs, and the panel ends empty with the message.

## Residue

- **Roster:** +2 in-app rows in `seedling-js` (category `Seedling JS runtime`; about 2 s each):
  `seedling-js-runtime-custom-set-with-flash-panel-starts-no-game` and
  `seedling-js-runtime-custom-set-without-flash-panel-starts-no-game`.
- **No wasm in-app row.** The panel asks before choosing a transport, so the same code covers both. The wasm load
  itself is covered by the node rows.
- **Not covered:** rules carrying `flash_seedling` rooms with **no** `region_atlas` at all. The guard does not fire
  there (today's behaviour). S1 never emits that shape.
- **A panel with no game now re-initializes on every same-wiring rules load** (cheap: a settings read and the
  index fetch for Seedling rules). Any non-Flash preset does this, and it logs `no flash game configured` again each
  time.
- The worktree is left for the cleanup round. The dev server it used (port 8141) has been stopped.
