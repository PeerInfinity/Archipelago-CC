# Cloud report: rules-engine-nit-b (`deriveLevelWorldLogic` sound when reach is not monotone)

Branch `claude/derive-level-world-logic-monotone-loi6bo`. Base `origin/main` = **f96d6b6625** (later than 3c602f965d).
Code tip **74b57573ed** (the engine fix, its census premise, the re-derived table); evidence after it; this report last.
Evidence: `CC/docs/cloud-reports/rules-engine-nit-b-evidence/` (`tools/`, `runs/`).

## Answer table

| Question | Answer | Evidence |
|---|---|---|
| Semantics: can the pull gate (Dark Suit) be shed? | **NO, never in play.** So AP rules are upward-closed: S may be granted only when EVERY lattice point ⊇ S reaches. (i) The full-point prune is SOUND. (ii) The `covered` skip was the loose half. | § 1 (source lines) |
| D0 at base (designer's tool, verbatim) | **(a) 0 / (b) 0** on L77, L78, L80 and L108; fixture **(a) 11 / (b) 11** (the positive control). Re-run at the tip: the same. | `runs/d0-base*.txt`, `runs/d0-tip*.txt` |
| The fix | `learnLattice.pullUpSet`: a census that ROUTES a pull gated on an axis item, by name, plus an up-set guard. Every walk judges through it: rank, learner, latch sandwich, `deriveEntryLogic`. `distinctArrivals` does not dedupe in such worlds. A gate on an off-axis token is REFUSED by name. A world with no such pull is byte-identical. | § 2 |
| Synthetic rows (a disc wider than its tongue, a LANDING inside it) | **11 rows green.** The mutant (`upSetGuard: false`) is red on pair, chest, rank and learner. | `deriveLevelWorldLogic.pullUpSet.test.js` |
| pullDiscNit first row | **STAYS** (it is the sound answer). Header corrected. | § 2 |
| engineMd5 | `74ae60f575531492ed9eaec1839e1fe3` → **`6c8cd75145bdf58d2eed7d7cc9e6b512`**, 42 files → 42 | `--print-engine-closure` |
| Table verdict movers | **NONE.** Rows 99, regions 47, exclusions 6 and counts are byte-identical. Only `inputs.engineMd5` (and `measuredAt`) moved. All 900 probe element rows are identical base ↔ tip. | `runs/{base,tip}-derived.log` |
| Presets / seed 1 / route walks | **Unchanged.** `regen-seedling --write` moved no other tracked file. AP_1, `seedling_er`, the maze, the atlas, `_Spoiler.txt` and the sphere log are byte-identical (ADD 0 / DEL 0 / CHG 0). `--check` was OK on every step. No `preset_files.json` newline was left. | `runs/regen-*.log` |
| `seedling-derived-rules-expected.json` | **No re-pin needed.** The probe found every pinned count matching (0 drifts). | `runs/tip-derived.log` |
| Certifier | **1 / 16 / 0, OPEN_L63 only.** This holds for vanilla AND `--source=er --arms=new`, at base AND tip. Outputs are identical modulo sha and timing. | `runs/cert-*.log` |
| Cost: L40 (heaviest calib test) | base 446.2 s (50.4 % headroom) → tip **463.6 s (48.5 % headroom)** of 900 s. Well clear of the 25 % stop. | `runs/calib-*.log` |
| Calib flags | L78 and L80 really move: the guard probes there, by design, with no verdict move. L89 flagged at 181 → 325 ms. Solo re-measure: base 325–387 ms, tip 307–355 ms, so it is **noise** (its code path is identical, it has no pull). | `runs/calib-compare.txt`, `runs/l89-rerun.txt` |
| Train tier | **CI dispatch REFUSED for this session.** `gh` and the GitHub MCP tool both returned 403 "Resource not accessible by integration". All three train files ran locally, bounded, and passed. **The planner owes the dispatch**: `-f train_only=true` at 74b57573ed or later. | § 5 |
| JS unit tests on push (CI) | run **44979885643** at 74b57573ed: **success** | GitHub Actions |

## 1. Semantics (from `vendor/seedling/src`, read-only)

- The Dark Suit is a passive global save flag. The getter and setter are `Player.as:246-253` → `Main.hasDarkSuit` (`Main.as:169,196`, `SAVE_FILE.data`).
  - Set on pickup: `Pickups/DarkSuit.as:44`.
  - Read by the tongue: `Enemies/LavaTrap.as:64` (`if (Player.hasDarkSuit)` release, `else attached.die()`).
- Every `hasDarkSuit = false` is unreachable in play, or is not play:
  - `Player.as:1814-1919` sits in `extraInputs()`. That runs only `if (Preloader.sponsorVersion)` (`Player.as:1517`), and `sponsorVersion` is `const false` (`Preloader.as:15`).
  - `Bot.as:777` is the bot's injection seam.
  - `Main.clearSave` is a new game.
- So there is no sheddable gate, the "exists an inventory" semantics does not apply, and nothing here triggers the STOP.

## 2. The fix (engine closure: `learnLattice.js`, `deriveLevelWorldLogic.js`)

**The proof.** Split the lattice by PULL CLASS: which axis-gated pulls a point's inventory arms.
- Inside one class every pull acts identically. Under the static census (monotone rule kinds, no axis-armed trap), a step sequence legal at T is legal with the same result at every same-class T' ⊇ T. So reach is monotone WITHIN a class.
- Hence "every superset of S reaches" ⇔ "the class-minimal raises of S reach". A raise moves only the gates' items, the sub-axis.
- `pullUpSet(world, axis).probes(S)` lists those raises, S first. `good(S) = ∀ probe taken`, which is monotone by construction. So the rank walk's skip, the sandwich and the learner's marks are all sound on it.
- The full point has no raise, so the (i) prune is unchanged.

**Routing and refusals.**
- With no axis-gated pull, `pullUpSet` returns `null` and every walk is byte-identical (the rest of the game).
- `pullUpSet` asserts the static census (`assertMonotoneWorld`), its own premise, wherever a pull is routed. Before this the rank walk never ran it. It refuses none of the four pull worlds.
- A gate that clears on an off-axis token is refused by name.

**Other changes.**
- `distinctArrivals`: its dedupe rests on the same premise, so an axis-gated pull world is never deduped. This is the same guard as the `while_active` trap one.
- **Test-only switch:** `upSetGuard: false`, the mutant.

**The pullDiscNit row.**
- In the fixture (uncut disc) the full point misses r6c11, so `unreachable` is the correct upward-closed answer at every S. It is not a false prune.
- The fixture's 11 (b) pairs are the same pairs as its 11 (a) pairs. `guard-onoff.mjs --fixture` reports 0 moved.

**The designer's hole (exempt landings), pinned synthetically.**
- World: `AABBC`. (2,0) is the landing region's arrival, uncharged, inside the disc of trap (4,0). (3,0) is a Ghost Spear gate inside the disc.
- Brute-force truth: ∅ ✓, {Suit} ✗ (reeled, shut in), {Spear} ✓, {both} ✓.
- Results:

| Run | Pair A → landing | Landing chest from A |
|---|---|---|
| Guard on: rank and learner, native and scripted | `[[Ghost Spear]]` | `[[Ghost Spear]]` |
| Guard off (mutant) | `[[]]` (red) | `[[]]` (red) |

- Further rows:
  - census route: gate, sub-axis, probes;
  - off-axis refusal;
  - no pull, and a `True_` gate → no guard;
  - full-prune soundness: a walled (3,0) gives `unreachable`;
  - no dedupe.

## 3. Verdict movers

**None.**
- The table diff is `measuredAt` and `inputs.engineMd5` only.
- The probe's 900 element rows are identical base ↔ tip.
- The whole-game certifier outputs are identical (both arms).
- On all four pull worlds, `guard-onoff.mjs` shows 0 pairs and 0 targets moved with the guard on vs off.
- No designer review is owed for verdicts. The engine change itself is for tile-primitives-design-8 / the planner to slot. The rule is one engineMd5 mover at a time on this file and `mazeRoomEngine.js`; re-merge after pixel-pull-disc if that lands first.

## 4. Cost

**Table run (whole-game certifier, native, committed maze preset, `tools/table-run-counters.mjs`):**

| Measure | Base | Tip |
|---|---|---|
| Real engine searches (cache misses) | 12,580 | **12,597** (+17) |
| Lazy plan replans | 569 | **789** (+220: the reach memo is now on in the 4 pull worlds) |

**Per pull world (`deriveLevelWorldLogic`, guard off → on, `runs/guard-onoff-tip.txt`):**

| Level | `searched` | `states` | `engine.searches` | `engine.states` | `skipped` | guard refusals |
|---|---|---|---|---|---|---|
| L77 | 57 → 57 | 4235 → 4235 | 57 → 60 | 4235 → 5042 | 0 → 0 | 0 |
| L78 | 228 → 228 | 12044 → 12044 | 228 → 240 | 12044 → 14324 | 0 → 0 | 0 |
| L80 | 279 → 279 | 6581 → 6581 | 279 → 279 | unchanged | 0 → 0 | 0 |
| L108 | 10 → 10 | 112 → 112 | 10 → 7 | 112 → 68 (the memo) | 0 → 0 | 0 |

**Calib (same box, nproc 4, sequential):**
- File wall: 924.9 s → 980.4 s.
- Median reference ratio: 1.050.
- Absolute ms for the flagged levels and the heavy ones:

| Level | Base | Tip | Note |
|---|---|---|---|
| L78 | 1,255 | 3,409 | solo: 1,265–1,440 → 2,921–3,272 |
| L80 | 572 | 1,350 | solo: 679–770 → 1,303–1,420 |
| L77 | 323 | 412 | |
| L108 | 69 | 55 | |
| L89 | 181 | 325 | noise, see the answer table |
| L40 | 446,185 | 463,647 | normalised 0.990 |
| L16 | 240,319 | 263,534 | normalised 1.045 |

- `--compare … --moved=level_77,level_78,level_80,level_108` lists L78, L80 and L89. L78 and L80 are the explained movers.

## 5. Bounded vitest (every file listed)

**Default tier:** 55 files, 845 tests, all passed. The list is in `runs/vitest-default-files.txt`. It holds:
- every non-slow/train/calib `tileSpike/*.test.js` (incl. `learnLattice`, `pullDiscNit`, the new `pullUpSet`);
- every `mazeTile*.test.js`;
- every file that `git grep -la` finds importing the engine or reading the table: `mazeContent`, `mazeLatchButtons`, `mazeLevelWorld`, `mazeSidedOpeners`, `mazeThings`, `mazeWeaponFootprints`, `mazeLavaPulls`, `regionAtlasLevelWorld`, `derivedRuleOverride`, `derivedRuleTableFresh`, `derivedRulesProbe`, `refreshSeedlingDerivedRules`, `regenSeedling`, `seedlingErMode`, `seedlingErSource`, `wholeGameTools`;
- `seedlingMountKeyLevelSet`;
- T's 8: `mazeConvertedLink`, `mazeConvertedLoad`, `flashSeedlingAtlasKnob`, `seedlingAtlasArm`, `seedlingErDoorCensus`, `seedlingDivergenceLegs`, `mazeSeedlingLink`, `levelSetExporter`.

**Slow, each alone (`vitest.slow.config.js`):**

| File | Tests | Duration |
|---|---|---|
| `deriveLevelWorldLogic.slow.test.js` | 2/2 | 205 s |
| `deriveLevelWorldLogic.latchSandwich.slow.test.js` | 3/3 | 72 s |

**Train, each alone (`vitest.train.config.js`, local, bounded; the CI dispatch was refused, 403):**

| File | Tests | Duration |
|---|---|---|
| `deriveLevelWorldLogic.train.test.js` | 1/1 | 687 s |
| `deriveLevelWorldLogic.latchSandwich.train.test.js` | 2/2 | 418 s |
| `learnLattice.train.test.js` | 4/4 | 126 s |

## 6. Witnesses

No GAME witness was run or needed. No verdict moved, and the semantics question is decided by the AS3 source in § 1.
The synthetic world is an engine fixture, not level data.

## Tools (evidence dir)

- `tools/d0-monotone.mjs`: verbatim from the brief.
- `tools/guard-onoff.mjs`: guard on/off per pull world, with counters.
- `tools/table-run-counters.mjs`: the whole-game certifier's real searches.
