# Cloud report — `rules-l40-bk2-commit`: the derived L40 Boss Key 2 rule, committed on main with R-A5, everything regenerated

## 1. Start, head, branch

| | |
|---|---|
| Session | `rules-l40-bk2-commit` (planner `seedling-rules-planning-6`), cloud, Opus |
| Base | `origin/main` = `fe98f37f22` (R-A5 is on it: `a69ceaf6`) |
| Branch | `claude/l40-bk2-rule-commit-1vnlyo` (the harness's designated branch) |
| License | ⚖ Robert 2026-11-12 "Yes: commit it, then SHA-bound ask (Recommended)" (BK2 6.8 → 7.3, 45 of 88 seed-1 rows) |
| Environment | `session_bootstrap.sh --seedling` READY; the six non-wasm submodules initialised (no pointer moved); `minimal-spoilers` |
| Scope messages | none arrived mid-run |

**Commits** (oldest first; this report is the last, separate commit):

| commit | what |
|---|---|
| `76f5a5c8` | the witness slice's evidence directory, unchanged (`CC/docs/cloud-reports/rules-l40-bk2-witness-evidence/`) |
| `487d6b34` | the rule: the witness patch, plus a one-line fit to R-A5, plus pins (`seedlingBlockCrossings`, `seedlingBlockPaths`) |
| `e2920ea3` | regenerated: AP_1, `worlds/seedling_playthrough`, seed 1, maze, `seedling_er`, sphere order |
| `cdfaef14` | re-pinned: `campaign-frontier.json` sources, the constants census |
| `6f90c1cb` | re-recorded: `seedling-derived-rules-expected.json` (2 pair counts) |

## 2. The answer first

| # | question | answer |
|---|---|---|
| 1 | Does the patch apply on today's main? | **Yes, cleanly** (`git apply --3way`, no conflict). |
| 2 | Does it fit R-A5's regions as written? | **No, one line short.** The producer refused L40 by name: `r32c36 -> r26c13: no stopper set and no Pulser shove opens the crossing`. See §3. |
| 3 | The fix | **General, one line, no level literal** (`activatorReachCost`, §3). |
| 4 | Gates it adds | Three, all `L40 flag 12: wandlock@480,560 cleared`, ANDed onto L40's column-36 crossings on R-A5's regions (§4). This is the shape the witness slice's §7 predicted. |
| 5 | Seed-1 sphere move | **The licensed one.** It is the same 45 of 88 locations as the witness table. BK2 6.8 → 7.3. Every row's sphere-number delta equals the witness's. Nothing becomes unreachable (88 → 88). The Seed 14.2 → 15.2 (§5). |
| 6 | Stops | **None hit.** No location is lost and the seed stays beatable. No row moves that the witness table does not explain. No level literal. No solver, levelRun, `CONTACT_FIDELITY`, `shared/`, tileSpike-engine or table-composition change. |
| 7 | Derived-rule table | **Not stale, and its verdicts do not move** (inputs `payloadMd5 073476d3…`, `engineMd5 3e333bfa…` are unchanged; the scratch probe's table "matches"). Two pair rows move label. That moves 2 counts in the expected file, re-recorded (§6). `REGEN_RECIPE` is not needed for the table bytes. The planner's CI probe confirms. |

## 3. The fit to R-A5 (why the patch alone refused, and the one-line fix)

Before R-A5, the flag-12 door (`wandlock@480,560`, cell (30,35)) was a free grouped lock in the rules' grid. The patch's activator walk put it back as a **latched** lock: its cell stands Solid until the walk holds the event, by the bare name `L40 flag 12: wandlock@480,560 cleared`.

R-A5 gates that same cell in the grid itself. It also gates the `r26c13 -> r23c29` door edge at (28,27)E. In both places R-A5 writes the condition `{event: …}`, and `conditionKey` spells that `event:L40 flag 12: …`. The walk's `covered(cellKeys[i])` checks keys against the held set, which held only the bare name. So the cell never opened, whatever was held. The activator `button@816,400` (cell 1551) was unreachable from every start (36,35), (36,37), (35,36), and the producer refused by name.

Debug print at the throw: `latched [flag 1, flag 7, flag 12]`, `acts [1551]`, `reach {"sets":[]}`. Grid keys seen were `event:L40 flag 12: wandlock@480,560 cleared` on (30,35) and `enter:event:L40 flag 12: …` on (28,27)E.

**Fix** (`frontend/modules/flashPanel/seedlingBlockPaths.js`, `activatorReachCost`). Holding a latched event also covers the grid's spelling of the same event:
```js
const has = new Set([...held, ...extra, ...extra.map((k) => keyOf({ event: k }))]);
```
The fix is general: it adds no level, entity or new key, and it covers only the event already held. The unit row `activatorReachCost: a cell the GRID gates on the same event …` pins it. Its mutant (the old line) reddens that row alone, which I measured.

## 4. The gates the rule adds (today's main, AP_1 exits, before → after)

| edge (level_40) | before (main `fe98f37f22`) | after |
|---|---|---|
| `r26c13 -> r32c36` | `Fire & (Progressive Sword \| Ghost Spear)` | `(Fire & (Progressive Sword \| Ghost Spear)) & L40 flag 12: wandlock@480,560 cleared` |
| `r26c13 -> r36c35` | `Fire & (Progressive Sword \| Ghost Spear)` | `(Fire & (Progressive Sword \| Ghost Spear)) & L40 flag 12: wandlock@480,560 cleared` |
| `r32c36 -> r26c13` | `Fire & (Progressive Sword \| Ghost Spear)` | `(Fire & (Progressive Sword \| Ghost Spear)) & L40 flag 12: wandlock@480,560 cleared` |

These are the only exit changes in AP_1, from a whole-file exit-by-exit diff. The atlas (`e3ae176e`) and the partition do not change. The hand-strengthened `And` acceptance (the witness's owed check) holds on R-A5's rows: `keepsPush` accepts `And(Fire, Or(Sword, Ghost Spear))`.

Each gate's `why`: "L40 pushableblockfire@576,576: no push of the player's from <side> opens it (beside it: the pushable at (36,35)); only pulser@592,576's shove does, and its group's activator is walked to (from (36,37)) only with L40 flag 12: wandlock@480,560 cleared".

The block producer's other notes are pinned in `seedlingBlockCrossings.test.js`:
- `r32c36 -> r36c35` is free beyond the push item.
- `r36c35 -> r32c36` and `r36c35 -> r26c13`: "entered only through the block's cell — nothing to price".
- L39 and L40's `pushableblockfire@480,480`: "borders 1 sub-region — no crossing".
- L63's one gate, L63's and L65's free rows, and L41/L67 "no stopper" are all unchanged.

## 5. Seed 1 (`Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 1`, minimal-spoilers)

| file | before | after |
|---|---|---|
| `AP_14089154938208861744.archipelago` md5 | `1182aabb26aefeae8b01942f188aacd8` | **`ddf45872bfdd75a2da046c5911092f1c`** |
| `…_sphere_log.jsonl` md5 | `455bb51efff4cf457f1f348b0f58d166` | `24a5ec43641955b4abdecb0b2647fc87` |
| `…_rules.json` / `…_Spoiler.txt` md5 | (moved) | `d074159e…` / `7f39286d…` |
| accessible locations | 88 | 88 (**0 newly unreachable**) |
| The Seed | 14.2 | 15.2 (beatable) |

**Every moved row** (45 of 88). The last column is the witness slice's row for the same location; its base was before R-A5, so its sub-indices differ. The names match one for one: the same 45 locations and no extra row. The sphere-number delta matches row by row: 29 rows +1 and 16 rows +0, with no row whose delta differs. BK2 is 6.8 → 7.3 in both.

| location | before (main) | after | witness slice (pre-R-A5 base) |
|---|---|---|---|
| Level 040 - Boss Key 2 | 6.8 | 7.3 | 6.8 → 7.3 |
| Level 040 - Chest | 6.9 | 6.8 | 6.9 → 6.8 |
| Level 040 - Totem Part 160,640 | 6.10 | 6.9 | 6.10 → 6.9 |
| Level 046 - Chest | 6.11 | 6.10 | 6.11 → 6.10 |
| Level 048 - Chest | 6.12 | 6.11 | 6.12 → 6.11 |
| Level 055 - Boss Key 3 | 6.13 | 6.12 | 6.13 → 6.12 |
| Level 089 - Feather | 6.14 | 6.13 | 6.14 → 6.13 |
| Level 090 - Chest | 6.15 | 6.14 | 6.15 → 6.14 |
| L40 flag 7: wandlock@208,128 cleared | 7.1 | 8.1 | 7.2 → 8.2 |
| L40 flag 8: bosslock@480,352 cleared | 7.2 | 8.2 | 7.3 → 8.3 |
| L48 flag 1: bosslock@48,144 cleared | 7.3 | 7.1 | 7.4 → 7.1 |
| L58 flag 1: yeti@56,56 cleared | 7.4 | 7.2 | 7.5 → 7.2 |
| Level 041 - Totem Part 240,144 | 7.5 | 8.6 | 7.7 → 8.8 |
| Level 042 - Totem Part 184,152 | 7.6 | 8.7 | 7.8 → 8.9 |
| Level 057 - Tentacled Beast | 7.7 | 7.4 | 7.9 → 7.4 |
| Level 064 - Ghostspear | 7.8 | 7.5 | 7.10 → 7.5 |
| L40 flag 1: wandlock@176,80 cleared | 8.1 | 9.3 | 7.1 → 8.1 |
| L63 flag 6: lightpole@48,272 cleared | 8.2 | 8.3 | 8.1 → 8.4 |
| L63 flag 7: lightpole@112,272 cleared | 8.3 | 8.4 | 8.2 → 8.5 |
| L65 flag 0: lightpole@128,168 cleared | 8.4 | 8.5 | 8.3 → 8.6 |
| Level 040 - Totem Part 64,144 | 8.5 | 9.4 | 7.6 → 8.7 |
| Level 067 - Boss Key 4 | 8.6 | 8.8 | 8.5 → 8.10 |
| Level 043 - Wand | 9.3 | 10.1 | 8.4 → 9.3 |
| Level 069 - Lights | 9.4 | 9.5 | 9.8 → 9.4 |
| L12 flag 7: magicallock@32,864 cleared | 10.1 | 11.1 | 9.3 → 10.1 |
| L68 flag 0: bosslock@16,32 cleared | 10.2 | 11.2 | 9.4 → 10.2 |
| Level 012 - Witch | 10.3 | 11.3 | 9.5 → 10.3 |
| Level 043 - Totem of Lacste | 10.4 | 11.4 | 9.6 → 10.4 |
| Level 068 - Health | 10.5 | 11.5 | 9.7 → 10.5 |
| Level 071 - Chest | 10.6 | 11.6 | 9.9 → 10.6 |
| Level 074 - Darkshield | 10.7 | 11.7 | 9.10 → 10.7 |
| L71 flag 2: shieldlock@288,256 cleared | 11.1 | 12.1 | 10.1 → 11.1 |
| Level 079 - Darksuit | 11.2 | 12.2 | 10.2 → 11.2 |
| L101 flag 0: lightpole@144,64 cleared | 12.1 | 13.1 | 11.1 → 12.1 |
| Level 063 - Chest | 12.2 | 13.2 | 11.2 → 12.2 |
| Level 080 - Chest | 12.3 | 13.3 | 11.3 → 12.3 |
| Level 082 - King of Fire | 12.4 | 13.4 | 11.4 → 12.4 |
| Level 098 - Chest | 12.5 | 13.5 | 11.5 → 12.5 |
| Level 106 - Ghostsword | 12.6 | 13.6 | 11.6 → 12.6 |
| L112 flag 1: rocklock@112,16 cleared | 13.1 | 14.1 | 12.1 → 13.1 |
| L114 flag 0: watcher@72,72 cleared | 13.2 | 14.2 | 12.2 → 13.2 |
| Level 109 - Firewand | 13.3 | 14.3 | 12.3 → 13.3 |
| Level 112 - Owl | 13.4 | 14.4 | 12.4 → 13.4 |
| L113 flag 0: finaldoor@112,0 cleared | 14.1 | 15.1 | 13.1 → 14.1 |
| Level 115 - The Seed | 14.2 | 15.2 | 13.2 → 14.2 |

**Why it moves** (as the witness said): flag 12 is collected at 6.1, so BK2 is reachable one sphere later. BK2 holds the Purple Key, which gates `L40 flag 8` and L40's north, so the tail shifts one sphere. The sphere order (`seedling-sphere-order.json`) goes from 15 to 16 spheres (md5 `ac997f95…` → `4a9b7e80…`).

## 6. `--blocks`, the derived-rule probe, and the maze certifier (scratch, local, `--shards=2`)

**`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, branch vs a control worktree at `fe98f37f22`.**
- Both have 936 legs with **identical keys**, so `divergence-door-leg-keys.json` holds.
- Legs with blocks > 0: 383 → 383.
- **`blocks` moves on 2 legs only**, both `level_40__r48c54 <- in_L39_144_0 / in_L43_176_464 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`: 29 → 30. The press now also gates BK2.
- `arrive.events` / `stagedEvents` move on 2 legs: both BK2 legs (`level_40__r32c36 <- in_L39_144_0 …` and `<- in_L43_176_464 …`) now stage `flag:L40:12` naturally. That is the door the witness showed the game needs, so DOOR-CARRY no longer has to carry it on these legs.
- Otherwise only `sphere`/`regionSphere` move (305/130 legs), from the tail shift.
- No real location becomes unreachable.

**`probe-seedling-derived-rules.mjs`.**

| | control (main) | slice |
|---|---|---|
| certifier | 1 / 16 / 0 | 1 / 16 / 0 |
| problem | `level_63__r6c9 → r0c1` (explained) | same |
| table | 116 rows / 53 regions / 6 excluded, "matches" | same, "matches" |
| pinned counts | ALL PASS | 2 drift → re-recorded → **ALL CHECKS PASSED** |

The 2 rows that move (derived-table **verdicts** do not move; these rows are not table rows):

| pair row | AP rule before → after | compare | label |
|---|---|---|---|
| `level_40__r26c13 → level_40__r32c36` | `Fire & weapon` → `… & flag 12` | equal → **looser** | derived → **path-vs-edge** |
| `level_40__r26c13 → level_40__r36c35` | `Fire & weapon` → `… & flag 12` | equal → **looser** | derived → **path-vs-edge** |

Net effect: `pair.path-vs-edge` 124 → 126 and `pair.derived` 202 → 200. The maze world still walks column 36 on Fire + a weapon, because its tile engine has no Pulser model. The maze is therefore looser than AP on exactly these two rows. That is a known label, and fixing it would be a tileSpike engine change, which is out of scope (named, not fixed).

**`probe-seedling-whole-game-certify.mjs --arms=new`** (the committed table applied):

| arm | problems / accepted / threw | clean levels | rows |
|---|---|---|---|
| vanilla (`--source=vanilla`) | **1 / 16 / 0** (no pin of its own; equals the derived probe's) | 114/115 | PROBLEM `level_63__r6c9 → level_63__r0c1` (derived true, atlas false); ACCEPTED the 16 as below |
| ER (`--source=er`) | **1 / 16 / 0**, "PASS: the ER arm matches `seedling-er-whole-game-certify-expected.json`" | 114/115 | the same PROBLEM and ACCEPTED rows |

The ACCEPTED rows, the same in both arms:
- `level_0__r2c13 → r1c6` (Swim)
- `level_39__r25c9 → r0c9` and `→ r2c11` (L39 flag 8)
- `level_57 @ Tentacled Beast` (Swim)
- `level_63__r5c14 @ Chest (from r6c9)` ×3
- `level_63__r6c9 → r10c2` ×2, `→ r5c14` ×3, `→ r6c15` ×3
- `level_82 @ King of Fire` (Dark Suit)

No L40 row is a problem in either arm.

**Rows that block or move for the planner's `REGEN_RECIPE`:**
- The table bytes should regenerate identical: its inputs did not move and the probe's table "matches".
- The only label moves are the two pair rows above, already re-recorded in the expected file.
- The tile-primitives designer review is owed only "if the table's VERDICTS move"; they do not.

## 7. Gates

| gate | result |
|---|---|
| bounded vitest: a guarded `rg -a -l` list of every test reading the atlas, AP_1, seed 1, the maze, `seedling_er`, the partition, the sphere order, the frontier or the leg keys; the block-path tests; `seedlingErDoorCensus`, `flashSeedlingAtlasKnob`, `boxLock`, the no-tracked-pointers guard, `checkProcgenHelp`, `lintGateLabels`; plus `seedlingConstantsCensus`, `derivedRuleTableFresh`, `derivedRuleOverride` | **118 files, 2016 tests passed** at the final tree. Before the re-pin: 115/116, and the only red was `seedlingBlockCrossings.test.js` (3 rows pinning the gate list, as the witness predicted). The `.slow`/`.train`/`.calib` matches (`deriveLevelWorldLogic.*`) are not run here: the train tier is CI's |
| freshness tests red by design | **none**: the derived-rule table is not stale (`derivedRuleTableFresh` green) |
| `census-seedling-constants.mjs --write`, then `seedlingConstantsCensus.test.js` | written (`seedlingBlockPaths`' new literals); test green |
| `generate-procgen-reference.mjs --check` | "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE" |
| producers `--check` | playthrough rules (atlas + AP_1), partition, maze, `seedling_er`, sphere order and vanilla overlay: all OK (`--check` of the rules: no table refusal) |
| `check-worldgen-package-freshness.py seedling_playthrough` | **PASS** (byte for byte; package by its recipe, `--apply-name-substitutions --canonical-seed 1`) |
| surveys (4.2) | route-only **29/29 SOLVE**, full **39/39 SOLVE** (`.cache/seedling-survey/`, local) |
| frontier | `census-seedling-campaign.mjs --write-frontier`: the `sources` block only (AP_1 `1c86560e` → `a622d893`, sphere order `ac997f95` → `4a9b7e80`); `--check-frontier` **17 pass / 0 fail** |
| Generate dirt | `preset_files.json` (trailing newline) reverted; `output/` is ignored |
| the banned docs-directory string | absent from every file this branch adds or changes (checked with `rg -a`) |

## 8. Residue

- No solver, levelRun, `CONTACT_FIDELITY`, `frontend/modules/shared/`, tileSpike, derived-table (bytes or composition), `worlds/seedling/`, `vendor/seedling`, `.github/` or submodule-pointer change.
- **Owed to CI** (the planner):
  - The suite at the tip.
  - The `REGEN_RECIPE` probe, expected byte-identical to main's committed table (its inputs did not move) and to the counts re-recorded in `6f90c1cb`.
  - The train tier, since the slice touches `seedlingBlockPaths`.
- My probes were local measurements, at the slice and at a main control.
