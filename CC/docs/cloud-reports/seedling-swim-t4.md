# Seedling swim T4: the feather biome and the one-sided lock (cloud report)

This slice is two non-solver rungs of the swim plan (§8.5):
- **R-g**, `post-feather` as a gen-room biome;
- **R-j**, the one-sided BossLock.

No solver-family or simulation file was touched, and no AS3, wasm or gitlink. No tape and no `campaign-frontier.json` moved.

| | |
|---|---|
| started from | `855532f672` (`origin/main`) |
| head | the commit that adds this report, on top of `e57296b` |
| branch (the harness's) | `claude/seedling-swim-t4-xmkftc` (the brief's `seedling-swim-t4` is refused by the harness) |
| commits | D1 `793e1ac` · D2 `ac8e6b3` · D3 `3d44c2a` · D4 `8dc9a4f` · D5 `e57296b` · report (this) |

**Verdicts:** D1 **PASS**, with a finding: a `post-feather` door can be seated past the fall. D2 **PASS**. D3 **PASS**. D4 **PASS, COMMITTED**: the STOP rule was measured and the delta is empty at every sphere. D5 **PASS**.

## W0 — banked on the clean tree (`855532f672`)

| row | command | result |
|---|---|---|
| 8 preset states | `make-seedling-spiral-room-preset.mjs --state=<s> --check` for `spiral sphere generated generated-leaf generated-host generated-swim atlas-host atlas-location` | 8 × exit 0, `OK: … matches a fresh build` |
| 14 shipped md5s | `md5sum frontend/presets/seedling*/*/*_rules.json` | see *Byte-inertia*; the two `seedling_playthrough` rows are `dbf79293…` (AP_1) and `59959e71…` (AP_1409…) |
| playthrough producer | `make-seedling-playthrough-rules.mjs --check` | exit 0 · `seedling-ae833c1e — 113 regions, 189 sub-regions, 624 exits, 41 locations, 312 one-way connections; 269 computed internal exit(s), 16 awaiting a hand-written rule` · `rules.json — 250 AP regions, 812 exits` |
| sphere order | `make-seedling-sphere-order.mjs --check` | exit 0 · `41 locations over 10 spheres` |
| campaign census | `census-seedling-campaign.mjs` | exit 0 · stdout md5 `88fa2333013aaabb84298f0f4fd5d72a` · `NO CHAIN ROOM MOVES` |
| r8/r9 | `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check` | 6 × exit 0 · stdout md5s `410f27c0… b470c14d… 17be7d70… 9a6a3192… 6cd35fe1… 2823a811…` (= T3's) |
| survey | `survey-seedling-route.mjs --derive-only` | exit 0 · stdout `27ff43dbb8e4d4e08c3dc741c5a02bc7` · `route.json` `1e08f9ad37c505a5ca8360a882cc6b96` (= T3's) |
| solver surface | `npx vitest run scripts/procgen/seedlingSolverSurface.test.js` | 1 file / 18 tests |
| bounded vitest | the brief's five paths | **9 files / 193 tests** |

## D1 — R-g: `post-feather` in the gen room (`793e1ac`), PASS with a finding

**What landed:**
- `GEN_ROOM_BIOMES['post-feather'] = POST_FEATHER_PALETTE` (`seedlingGenRoom.js`) and `'post-feather'` in `GEN_ROOM_BIOME_NAMES` (`seedlingGenRoomPayload.js`).
- The panel's select reads `GEN_ROOM_BIOME_NAMES` (`flashSeedlingGenLibrary.js:324`), so it offers the new biome with no further edit.

**Rows:** `seedlingGenRoomFeather.test.js` (4):
- the two spellings agree;
- `{biome: post-feather, elements: waterfallgate}` builds at re-roll 0;
- winding s11 with `require: hasFeather` seats a GOOD door;
- the FINDING, pinned by name: winding s9.

**Moved literal rows:**
- `seedlingGenRoomSwim`'s *"no biome but post-swim grants canSwim"* now reads `['post-swim', 'post-feather']`, because post-feather grants the swim too;
- `flashSeedlingGen`'s biome refusal text.

**Mutant (a), the palette line dropped.** Predicted: a module-load throw, by name. Measured: `Error: seedlingGenRoom: GEN_ROOM_BIOMES and GEN_ROOM_BIOME_NAMES disagree — one list, two spellings`, and the file red. Restored with md5 identical (`81fd4616…`).

### Seeds 1–12, 10×10

The call: `generateGenRoom({region_id:'fall', exits:[{}], size:10×10, rng drawing <seed>, params:{seedlingGen:{biome:'post-feather', elements:'waterfallgate', …}}})`. The test's own flood defines the terms:
- "dry side": the door's approach is reachable from the start with no UP step into or out of a waterfall tile;
- "gate holds": the goal is NOT reachable from the approach without climbing.

**Predicted:**
- all build, 1–2 of 12 seat a waterfall;
- the farthest-first picker seats a door past the fall at least once;
- `require` is met in at most 2 of 12.

**Measured, default skeleton:**
- all 12 build at re-roll 0 with **zero waterfalls**;
- all 12 `require: hasFeather` runs **refuse** after 8 re-rolls: `the-required-element-was-refused: the-door-has-no-south-approach`.

**Measured, `skeleton: 'winding'`:**

| seed | `require` | re-rolls (cause) | falls | door → approach | dry side | gate holds |
|---|---|---|---|---|---|---|
| 1 | — | 0 | 0 | 3,7 → 3,6 | yes | n/a |
| 1 | hasFeather | 2 (require) | 1 | 2,3 → 2,2 | yes | **yes** |
| 2 | — | 0 | 0 | 7,6 → 6,6 | yes | n/a |
| 2 | hasFeather | REFUSED: no draw met the directive in 8 | | | | |
| 3 | — | 0 | 0 | 2,1 → 1,1 | yes | n/a |
| 3 | hasFeather | 1 (require) | 1 | 3,4 → 3,3 | yes | **yes** |
| 4 | — | 1 (doors) | 0 | 5,2 → 5,1 | yes | n/a |
| 4 | hasFeather | REFUSED: no draw met the directive in 8 | | | | |
| 5 | — | 1 (doors) | 1 | 3,5 → 3,4 | **no** | **no** |
| 5 | hasFeather | 1 (require) | 1 | 3,5 → 3,4 | **no** | **no** ⚠ |
| 6 | — | 1 (doors) | 0 | 7,7 → 7,6 | yes | n/a |
| 6 | hasFeather | 6 (require) | 1 | 8,1 → 7,1 | **no** | **no** ⚠ |
| 7 | — | 4 (doors) | 0 | 7,5 → 7,4 | yes | n/a |
| 7 | hasFeather | THREW: `pit-patch` PhysicsV2Error (T2's pass-2 abort) | | | | |
| 8 | — | 1 (doors) | 0 | 4,1 → 3,1 | yes | n/a |
| 8 | hasFeather | 4 (require) | 1 | 7,7 → 7,6 | **no** | **no** ⚠ |
| 9 | — | 1 (doors) | 1 | 5,5 → 6,5 | **no** | **no** |
| 9 | hasFeather | 1 (require) | 1 | 5,5 → 6,5 | **no** | **no** ⚠ (pinned) |
| 10 | — | 2 (doors) | 1 | 5,7 → 5,6 | yes | **yes** |
| 10 | hasFeather | 2 (require) | 1 | 5,7 → 5,6 | yes | **yes** |
| 11 | — | 0 | 1 | 3,6 → 3,5 | yes | **yes** |
| 11 | hasFeather | 0 | 1 | 3,6 → 3,5 | yes | **yes** (pinned) |
| 12 | — | 1 (doors) | 0 | 3,5 → 3,4 | yes | n/a |
| 12 | hasFeather | THREW: `pit-patch` PhysicsV2Error | | | | |

**With `require: hasFeather`:**
- 8 of 12 are met, 2 refused and 2 threw;
- of the 8 met, **4 seat the door past the fall** (seeds 5, 6, 8 and 9): the arrival reaches the goal without the feather.

`require` grades start → goal, but a gen room is entered at its door. So a room can meet the directive while its seated door makes the gate gate nothing.

**Without `require`:** 4 of 12 seat a fall, and 2 of those 4 (seeds 5 and 9) seat the door past it.

**Cause.**
- A waterfall tile is not lethal, so `hazardCells` does not wall it.
- T1's `keepReachable.approachWalls` is a set of CELLS. It cannot express "no UP step here".

**Proposed fix, NOT built** (it is not one line and not byte-inert):
- Give `sealsAnApproach` a directed step predicate: no N step into or out of a type-25 tile unless the arrival's boot holds `hasFeather`, which an arrival never does, since the arrival rule is item-less.
- Feed it from `pickGenRoomDoors`.
- It touches `levelSetExits.pickDoorCells`, which every room shares. So it needs its own byte-inertia proof over the committed rooms, and it is the gen room owner's (T1's) call.

## D2 — R-j: the census (`ac8e6b3`), PASS

`scripts/procgen/census-seedling-bosslocks.mjs` is report-only, exit 0. Its pure half is `seedlingBossLockCensus.js` (`censusLocks`, `censusCounts`), its test is `seedlingBossLockCensus.test.js`, and `--json=` writes a file. The grid it reads is the generator's own: `make-seedling-playthrough-rules.mjs` gains an additive `playthroughGridFor` export.

**The game.**
- `BossLock.update` (`BossLock.as:58-90`) tests `Player.hasKey(keyType)` only against `collideLine("Player", …, y - originY + height + 1, …)` (`:62`), the one-pixel row BELOW the lock.
- Opened, `Game.setPersistence(tag, false)` (`:81`) and `check()` (`:43`) keep it open on every later entry, and all 14 placements have `tag >= 0`.
- So the exact crossing is one-way, south → north. North → south is never needed: whoever can reach the south side can open the lock from there.

**Predicted:** L30@64,32 disagrees and is LIVE; 3–5 of 14 disagree, about 2 LIVE; L66 (off-grid) claims no tile.

**Measured, on the v1 atlas (`seedling-ae833c1e`), verdicts per the census:**

| level | lock | tile | keyType | tag | N / S / E / W | rule (probe side / far side) | directions | far side's other way in | verdict |
|---|---|---|---|---|---|---|---|---|---|
| L12 | bosslock@416,240 | 26,15 | 0 | 4 | r0c37 / r0c19 / gated / wall | `Or(Swim, Red Key)` (r0c19 / r0c37) | both | `in_L34…`, `in_L37…`, `in_L83…`, r0c37↔r44c19 | DISAGREES, LIVE |
| L12 | bosslock@432,240 | 27,15 | 0 | 5 | r0c37 / r0c19 / wall / gated | (the same row) | both | (the same) | DISAGREES, LIVE |
| L12 | bosslock@80,656 | 5,41 | 1 | 3 | wall / r40c4 / **r0c19** / r40c4 | Green Key (r40c4 / r0c19, the far side is EAST) | both | 7 `in_*` + 3 internal | DISAGREES, LIVE |
| L12 | bosslock@112,192 | 7,12 | 4 | 11 | r0c19 / r13c6 / wall / wall | Yellow Key (r13c6 / r0c19) | both | 7 `in_*` + 3 internal | DISAGREES, LIVE |
| L12 | bosslock@32,864 | 2,54 | 4 | 12 | directional / r55c1 / wall / wall | none | — | — | NOT A SEPARATOR (the cave beyond; `CHARGED_DOORS` hand-rules it, charged from the south) |
| L19 | bosslock@48,32 | 3,2 | 0 | 1 | r1c1 / r3c3 / wall / wall | Red Key (r3c3 / r1c1) | both | `in_L20_192_48` | DISAGREES, LIVE |
| L30 | bosslock@64,32 | 4,2 | 1 | 0 | r0c4 / r2c10 / wall / wall | Green Key (r2c10 / r0c4) | both | `in_L22_96_192` | **DISAGREES, LIVE (T3's)** |
| L30 | bosslock@224,208 | 14,13 | 1 | 2 | r8c13 / r2c10 / wall / wall | Green Key (r2c10 / r8c13) | both | `in_L32_72_136` | DISAGREES, LIVE |
| L31 | bosslock@192,432 | 12,27 | 1 | 0 | r24c10 / r5c24 / wall / wall | Green Key (r5c24 / r24c10) | both | `in_L30_192_48` | DISAGREES, LIVE |
| L40 | bosslock@480,352 | 30,22 | 2 | 8 | r0c53 / r23c29 / wall / wall | Purple Key (r23c29 / r0c53) | both | `in_L41_0_160`, `in_L42_240_336` | DISAGREES, LIVE |
| L48 | bosslock@48,144 | 3,9 | 3 | 1 | r4c3 / r2c10 / wall / wall | Blue Key (r2c10 / r4c3) | both | r4c3↔r7c0 | DISAGREES, LIVE |
| L56 | bosslock@96,16 | 6,1 | 3 | 0 | wall / r2c6 / wall / wall | none | — | — | NOT A SEPARATOR |
| L66 | bosslock@72,64 | 4,4 | 4 | 0 | manual ×3 / r5c4 | none | — | — | NOT-SEALED (x=72 is off-grid; `entitySealedTiles` claims no whole tile) |
| L68 | bosslock@16,32 | 1,2 | 4 | 0 | r1c1 / r3c1 / wall / wall | `And(Yellow Key, Or(Wand, …))` (r3c1 / r1c1) | both | — | DISAGREES, INERT |

**Counts (v1):**
- **11 two-way rows the game does not honour**: 10 LIVE and 1 INERT;
- 2 non-separators;
- 1 off-grid lock.

"Far side's other way in" is a one-hop read: a boundary `in_*` exit bound to that sub-region, or another internal exit into it. It is not a reachability proof.

**The vitest row** pins the committed atlas. It pinned these counts at D2; D4 re-pinned it (below).

**`--shield`** (the ShieldLock rows are reported only; they are T3/S1's):
- `ShieldLock.update` probes `collide("Player", x - 1, y)` (`ShieldLock.as:32`): the player on the WEST side.
- On the committed atlas: **L12 shieldlocknorm@288,704 is two-way and LIVE** (its far side r44c19 has `in_L34_32_144`); L20 shieldlocknorm@176,16 and L71 shieldlock@288,256 are two-way and INERT.
- The first cut of `--shield` read AGREES by construction, because it tested the reverse for a `* Key` item. It was fixed in D5 (`LOCK_ITEM`), and the bosslock stdout is `cmp`-identical.

## D3 — R-j: `REFUTATION_LOG` entry 3 (`3d44c2a`), PASS

The entry at commit `3d44c2a`, verbatim (D4 appended its retirement, quoted after):

```js
Object.freeze({
    row: 'bosslock@64,32 in L30, ruled two-way Has(Green Key) by the gated arm '
        + '(level_30__r0c4 <-> level_30__r2c10)',
    refutedBy: 'survey-seedling-route --through=2.2 --only=29 with the Green Key staged '
        + '(swim T3, D4): REFUSED, four keylock stances at bosslock@64,32 and no corridor',
    observed: 'the lock opens only from the SOUTH. BossLock.update probes the ONE-PIXEL ROW '
        + 'BELOW it (`y - originY + height + 1`; the model\'s keyLine is {x0 66, x1 75, y 49}), '
        + 'but the route arrives from the NORTH. L22\'s teleporter@96,192 lands at L30@64,16, '
        + 'the one-tile pocket r0c4 north of the lock, whose only other exit is the teleporter '
        + 'back. The rule crosses r0c4 -> r2c10 AND r2c10 -> r0c4 on the key. The game honours '
        + 'only r2c10 -> r0c4, and once the lock is open its persistence tag keeps it open, so '
        + 'the other direction is never needed. It is one row of a class: '
        + 'census-seedling-bosslocks reads 11 of the 14 bosslocks as two-way rules the game '
        + 'does not honour (10 with a far side AP can reach another way).',
    cite: 'Puzzlements/BossLock.as:58-90 (the probe at :62, the persistence at :43,81) '
        + '+ Dungeon3/9.oel:454 (the lock) + Dungeon3/1.oel:216 (L22\'s teleporter into the '
        + 'pocket) + CC/docs/cloud-reports/seedling-swim-t3.md § D4 '
        + '+ CC/docs/cloud-reports/seedling-swim-t4.md § D2',
}),
```

D4 appended to `observed`: *"RETIRED by swim T4 D4: `bosslock`'s `probe: 'S'` is read as `enter` gates, so all 11 are one-way (r2c10 -> r0c4 here). The seed-1 sphere order and the 21-step route are byte-identical, and the through-2.2 route now reaches L30 from L31."*

**The overlay test** (+1 row):
- the entry is well-formed, and it cites the probe line and T3;
- since D4, *the refuted row is gone from the committed atlas*: L30's only row touching `r0c4` is `{from: r2c10, to: r0c4, bidirectional: false, Has(Green Key)}`.

⚠ **The generator stamps `REFUTATION_LOG` into the rules' provenance**, so D3 moved `seedling_playthrough/AP_1/AP_1_rules.json`: provenance only, +6 lines, `dbf79293` → `cf73932f`. The atlas and the campaign census (`88fa2333`) did not move.

## D4 — R-j: the directional derivation (`8dc9a4f`), PASS, COMMITTED

### The vocabulary

The first thing measured was what the analyzer could already say. `faces` are paid in both directions. `dirs` gate moving a way while on EITHER cell, so they also forbid LEAVING the lock sideways.

L12@80,656's far side is EAST. With `dirs {S, E, W: null}` the lock could be opened from the south and then not left eastwards. That is too strict, and it would seal the one thing the lock leads to.

So `regionAtlasAnalyzer.stepCost` gains one read, **`v.enter?.[dir]`**: a gate on ENTERING a cell moving `dir`, read from the entered cell only. Where it is absent, it is byte-inert: the starter atlas, `atlas-host` and `atlas-location` stay OK.

### The derivation

- `ENTITY_SEMANTICS.bosslock` gains `probe: 'S'`.
- `buildSeedlingRegionGrid(…, {directionalLocks: true})` turns a `probe` into `enter` gates on every entry except the step in FROM the probe side. For a bosslock that is `{E: null, S: null, W: null}`: entered only moving north.
- `make-seedling-playthrough-rules.mjs` passes the option by default; `--no-directional-locks` rebuilds the v1 rows.

### The measurement

The measurement came BEFORE the commit decision.

**Order:**
1. W0 bank.
2. The flag on: `make-seedling-playthrough-rules --directional-locks`.
3. `python -m world_generator frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json -o worlds/seedling_playthrough --game-name "Seedling Playthrough" --force --canonical-seed 1`.
4. `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 1`.
5. `make-seedling-sphere-order.mjs`.
6. Diff against the bank.

**The baseline reproduces:** `Generate.py` on the committed world gave a byte-identical sphere log, and `sphere-order --check` was OK. W0's rules also regenerate the committed world byte-identically, apart from a stale `atlas_ref`; see *Residue*.

| quantity | before (v1) | after (D4) |
|---|---|---|
| `seedling-sphere-order.json` (the 41-row ledger) | `03f215201a5a64c472fa5cc51c51ee98` | **`cmp`-identical** |
| sphere log `AP_1409…_sphere_log.jsonl` | `0d1341b8799cded236801cbe39ee2f50` | **`cmp`-identical** |
| ledger rows that moved | — | **none**: no location moved at any sphere, and the equipment order is unchanged |
| survey `--derive-only` stdout / `route.json` | `27ff43db…` / `1e08f9ad…` | **identical** |
| atlas id / md5 | `seedling-ae833c1e` / `1c4836d1…` | `seedling-0faa7fee` / `e5f12454…` (internal exits and `content_hash` only; locations, boundary exits and sub-regions are identical, checked) |
| internal exits / AP exits | 285 / 812 | 286 / 803 |
| AP_1 rules / AP_1409 rules md5 | `cf73932f…` (after D3) / `59959e71…` | `c4845373…` / `a4ea094e…` |

**`Rules.py` delta:**
- **Nine reverse entrances removed:**
  - L12 r0c19→r13c6 and r0c19→r40c4;
  - L19 r1c1→r3c3;
  - L30 r0c4→r2c10 and r8c13→r2c10;
  - L31 r24c10→r5c24;
  - L40 r0c53→r23c29;
  - L48 r4c3→r2c10;
  - L68 r1c1→r3c1.
- **One narrowed:** L12 r0c37→r0c19 goes from `HasAny('Progressive Swim', 'Red Key')` to `Has('Progressive Swim')`. That is 285 → 286 internal exits: the bidirectional Or row became two one-way rows.

**Informative, `--through=2.2`** (`--out=` scratch; not the gate). Stdout `7095eeed…` → `1172328c…`, and `through-2.2/route.json` `1f9a9b29…` → `dae52ec7…`:
- Leg 2.2 was `L29 → L22 → L30 (r0c4 > r2c10) → L32`. It is now **`L29 → L31 → L30 (r2c10) → L32`**: the route reaches L30 from the SOUTH, the side the lock opens from.
- Survey steps 27–28 change accordingly: L29 exits by `stairsdown@112,32 → L31`, then `L31 stairsup@160,384 → L30`.
- Leg 1.4's route is unchanged; only its forced-room list gains `level_20__r3c1`, because L19 can no longer be re-crossed north → south.
- This is the rules half of T3's step-29 wall. The survey re-run belongs to whoever owns the through-2.2 steps.

**THE STOP RULE.**
- **Rule:** STOP if any location at sphere ≤ 2.1 moves or `route.json`'s md5 moves; COMMIT if the delta is confined to spheres > 2.1.
- **Measured:** no location moved at ANY sphere, and `route.json` is identical.
- **Decision: COMMIT**, the recompiled world with the derivation ON by default.

**Committed with it:**
- the world (`Regions.py`, `Rules.py`, `_worldgen_sidecars.json`, whose `atlas_ref` went from the stale `7dc27a95` to `0faa7fee`);
- both playthrough presets;
- `atlas_files.json`.

**Re-pinned:**
- `seedlingAtlasDoorCensus.test.js` (id; 286 / 217 swim / 180 `Has(Swim)`);
- `levelSetExporter.test.js` (id, 286);
- `vanillaOverlay.test.js`'s atlas md5 (its guard: *"a row that started agreeing because the OTHER side moved"*; checked, only internal exits moved);
- `seedlingBossLockCensus.test.js` (AGREES 11 / NOT 2 / NOT-SEALED 1). Its reverse test is key-aware: L12's surviving reverse row pays the WATER, not the key, and a row pins that.

**New rows:**
- the analyzer's `enter` row: one-way, and a side entry walled;
- semantics `directionalLocks`: on gives L30's two locks `enter {E,S,W: null}`; off gives no `enter` anywhere.

**Gates after D4:**
- the world regenerated from the FINAL rules is **byte-identical** to the committed one;
- `sphere-order --check` is OK;
- **`npm test -- --mode=test-spoilers --game=seedling_playthrough --seed=1 --port=8560`: PASSED** (1/1);
- `check-sidecar-fields` ALL PASS (1419); `check-worldgen-package-sidecars` ALL CHECKS PASSED.

**Mutant (d), `v.enter?.[dir]` dropped from `stepCost`.**
- Predicted: the analyzer's `enter` row reds; `--check` reports both files differ; the rows that read the COMMITTED atlas stay green.
- Measured: exactly that. 1 red (`crossings > enter makes a gated cell one-way`) and 81 green; `ERROR: … seedling-playthrough.json differs` and `ERROR: … AP_1_rules.json differs`.
- Restored with md5 identical (`aabc7fba…`).

## D5 — records (`e57296b`), PASS

- **`seedling-bot-log.md`:** § *Seedling substrate T4-swim — the feather biome and the one-sided lock*, directly after § T3-swim.
- **`flash.md`:**
  - one sentence in § *The atlas knob and the swim census*: key gates are one-way, and the census;
  - `post-feather` in the payload's biome list;
  - the approach finding in § *Door and approach rules*.
- **`seedling-bot.md`:** see *What the brief got wrong*, item 4. It gains a third transcription lesson, *a blocker whose trigger reads only one side*, and the heading changes "Two" → "Three" (no anchor links to it; grepped).
- **The reference:** regenerated (`generate-procgen-reference.mjs`: 292 instruments, 26 documents); `check-procgen-docs.mjs` → `ALL CHECKS PASSED`.
- **The census JSON:** `CC/docs/cloud-reports/seedling-swim-t4-bosslocks.json` (md5 `908330006f4b789f95ab79fa4d63e970`) holds three blocks: `before_v1` (from the banked v1 atlas), `after_d4`, and `shieldlocks_after_d4_report_only`.

**Bounded vitest:**

| set | BEFORE | AFTER |
|---|---|---|
| the brief's five paths | 9 files / 193 | **10 / 200**: +`seedlingGenRoomFeather` (4), +1 each in overlay, analyzer and semantics |
| every test file reading the playthrough artifacts, the semantics or the analyzer (43 files, `grep -l`) | — | **43 / 1705 passed** (D4's commit message says 1706; the measured number is 1705) |
| docs, help, census, gen-room neighbours (`procgenDocs`, `checkProcgenHelp`, `seedlingBossLockCensus`, `flashSeedlingGen`, `watchGenerate`, `procgenWaterfallGate`, `procgenWaterGate`) | — | 15 / 715 |

No unfiltered run was made (⚖ ruling 52).

## What the brief got wrong (measured)

1. **The branch.** The brief named `seedling-swim-t4`; the harness pins `claude/seedling-swim-t4-xmkftc`.
2. **"Predict: L30 and how many others."** The census found 11 two-way rows, 10 of them LIVE, far more than the 3–5 predicted. One far side (L12@80,656) is EAST, not north, so a north/south-only read would have missed it.
3. **"Give `bosslock` a `face`."** A face in this analyzer is paid in BOTH directions, and `dirs` also forbid leaving. Neither can say "entered only from the south" without walling L12@80,656's sideways exit. The honest vocabulary is a new `enter` gate, one read in `stepCost`, inert where absent.
4. **"`seedling-bot.md` … where the rules v1 permissiveness bounds are described."** Neither `seedling-bot.md` nor `flash.md` describes rules v1 or its bounds (`grep -i "rules v1\|permissiv\|REFUTATION"` finds them only in the log). The sentences went where the atlas internal exits (`flash.md`) and transcription lessons (`seedling-bot.md`) are described.
5. **D3 "lands regardless of D4".** It does, but it is not byte-inert. `REFUTATION_LOG` is stamped into the preset's provenance, so the entry alone moves `AP_1_rules.json`.
6. **The STOP rule's risk.** The feared move never came: the sphere order is byte-identical. L30's Torchpickup (sphere 1.5) sits in r2c10, which AP reaches from L28/L31 anyway.
7. **"Measure `generateGenRoom` … over seeds 1–12".** On the default skeleton, no fall is ever seated (0/12) and `require` never meets (0/12). The measurement needed a `winding` arm, T2's certified shape, to say anything.

## Residue

- **The directed approach flood** for `post-feather` rooms. See D1: 4 of 8 met rooms seat the door past the fall. It is proposed, not built, and it is T1's (`levelSetExits.pickDoorCells`, shared by every room).
- **The ShieldLock rows** (WEST probe): L12 shieldlocknorm@288,704 is two-way and LIVE; L20 and L71 are INERT. They are reported, not widened. The same `probe: 'W'` would express them. `shieldlocknorm` rows are T3's/S1's, and the L20 lock already carries `GROUPED_LOCK_EXCEPTIONS`' ruling.
- **`census-seedling-campaign --check-frontier`'s `sources` row was ALREADY STALE at W0.** `campaign-frontier.json` pins `AP_1_rules.json` at `602b318b…`, while `origin/main`'s file is `dbf79293…`. D3 and D4 move the derived value (now `c4845373…`), not the verdict (FAIL at W0, FAIL now). A `--write-frontier` is a frontier move and was not this slice's.
- **The committed world's sidecars carried a stale `atlas_ref`** (`seedling-7dc27a95`, versus the atlas `ae833c1e`) at W0: 250 lines, the only difference between W0's rules regenerated and the committed world. D4's regeneration made it current (`0faa7fee`).
- **The survey's through-2.2 steps 27–30 are not re-run** against the new route (L29 → L31 → L30). T3's staged `L30@64,16` grant row now names an arrival the route no longer takes.
- **L66@72,64** (off-grid) claims no tile, so the lock is invisible to the analyzer. With the lock between (4,4) and (5,4) half-covered, the tiles read walkable ("the permissive direction", `entitySealedTiles`). L66 holds no route location.
- **Scratch:** the D1 measurement script and the v1-census script lived in the session scratchpad, not the tree.

## Byte-inertia

| artifact | W0 | after |
|---|---|---|
| 8 preset `--check`s | 8 × exit 0 | 8 × exit 0 |
| 14 shipped md5s | (below) | **12 identical**; the 2 `seedling_playthrough` rows move **by design** (D3 provenance, then the D4 world): AP_1 `dbf79293…` → `c4845373…`, AP_1409 `59959e71…` → `a4ea094e…` |
| `make-seedling-playthrough-rules --check` | OK | OK (on the new committed files) |
| `make-seedling-sphere-order --check` | OK, `03f21520…` | OK, **`cmp`-identical** |
| `census-seedling-campaign` stdout | `88fa2333…`, `NO CHAIN ROOM MOVES` | **`88fa2333…`**, `NO CHAIN ROOM MOVES` (after D3, and again after D4) |
| r8/r9 `--check` × 6 | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811` | **identical**, all exit 0 |
| survey `--derive-only` stdout / `route.json` | `27ff43db…` / `1e08f9ad…` | **identical** |
| `seedlingSolverSurface.test.js` | 18/18 | 18/18 |
| solver-family / simulation files, `fixtures/`, `campaign-frontier.json`, AS3, wasm, gitlinks | — | **0 files differ** from `origin/main` (`git diff --name-only`) |

The 12 unmoved md5s:

```
f8ae9918dc043e329e1e5f5a737ec596  seedling/AP_14089154938208861744
2e3f74e1d0f4a58bb91ba276586a7195  seedling_atlas/AP_1
431fa72dae53241a7c291c59ac15d550  seedling_atlas_host/AP_1
279c9bb643d55eb74f9581ea932071b8  seedling_atlas_location/AP_1
5a2083326d24ffd1534b1197c93ee1a5  seedling_atlas_maze/AP_1
fa6a786d510243e124a73322f772554c  seedling_atlas_sphere/AP_1
edebfa1f00215b7846022c5b538820a5  seedling_generated_host/AP_1
f7db7bed32a5fb33129c0d55938704bc  seedling_generated_leaf/AP_1
28efab1877d266057bb3da0d8911207d  seedling_generated_room/AP_1
b6f77113184802e75feb7b25abec167c  seedling_generated_swim/AP_1
443e3ca23f86a872811bff5f7ef3ca15  seedling_sphere_room/AP_1
cb8e53849d9e9a3c1025851cedf79e61  seedling_spiral_room/AP_1
```
