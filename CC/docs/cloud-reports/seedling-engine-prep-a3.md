# seedling-engine-prep-a3 — profile overrides and the witness (cloud report)

- **Started from:** `origin/main` at `cdbf8fe980`, which is the SHA the brief expected.
- **Harness branch:** `claude/seedling-profile-witness-639wqc`. The harness designated it, and every push went there. Nothing was pushed to `main`.
- **Head:** the commit that carries this report, one after `6c7c87d`.
- **Commits:**

  | step | commit |
  |---|---|
  | D1, the loader | `0a318a8` |
  | D2, the node runner | `bd8b0a9` |
  | D3, the witness script | `bbdbe7d` |
  | D3, the measurement (JSON) | `4c7cb9c` |
  | D4, the guard | `63aa564` |
  | D5, the doc and reference | `6c7c87d` |
  | this report | the next commit |

  D3 is two commits so that the measurement could be taken at a committed head with a clean tree (`head` = `bbdbe7d`, `treeClean: true` in the JSON).

## W0 — banked before any edit

| row | command | result |
|---|---|---|
| identity | scratch `identity.mjs`, rewritten and not committed. One line per tape: `name, md5(file), md5(JSON parseTape), md5(serializeTape), md5(JSON gameVisibleTape)`. One line per expectation: `name, md5(file), md5(JSON parseObservationStream)`. `index.json` is excluded | **308 lines**, md5 `c3c9cc898df2f3a0494c93cbb5e39039` |
| runTape | the same script: per tape, `md5(JSON{ticks,transitions})` and `md5(JSON runTape minus profile)`, with `atlasLevelSource()` | **154 lines**, 0 ERR, md5 `f7e93b118786332e517c08b901d05c4f`. The run takes 16 s |
| `profileMd5()` | | `be8b983bc252c0ac33effa9ede59bc6e` |
| vitest | `npx vitest run …/seedlingProfile.test.js …/tapeRunner.test.js` | **2 files, 375 passed**, 52.9 s |
| solves | each `solve-seedling-*.mjs --check`, md5 of stdout with wall times normalised | all rc=0, `all checks green`: r8-battery `410f27c0…`, r8-d2 `f2cfe3f9…`, r8-d2-chain `b470c14d…`, r8-l18 `17be7d70…`, r8-tail `9a6a3192…`, r9-l3 `6cd35fe1…`, r9-campaign `2823a811…`. **All seven equal the brief's md5s** |
| census | `census-seedling-constants.mjs --check` | PASS, 4358 literals, 50 files |

⚠ The identity and runTape md5s differ from A2's `fa86b6e1…` / `1bcb066a…`. A2's script was not committed, so its line format cannot be reproduced; mine is a rewrite, as the brief asked. The claim here is before = after under ONE script, which is what inertia needs.

## Per D

### D1 — the loader (PASS)

- `frontend/modules/seedlingDemo/profileOverrides.js` (new, dependency-free, browser-safe) provides `applyOverrides(defaults, override, {defaultId, knownFlags})`, `duplicateKeys(text)`, `ProfileOverrideError`, `PROFILE_GLOBAL` and `DEFAULT_SOURCE`.
- In `seedlingProfile.js` the table is now `export const PROFILE = load(Object.freeze({…A2's literals, unchanged…}))`. `load` applies `globalThis.__SEEDLING_PROFILE__`.
- The declarator name `PROFILE` and every property path are kept, so **no census key moved**. The census keys table rows by declarator name plus property path, and a wrapping call adds nothing to that key.
- New exports:
  - `PROFILE_DEFAULTS` and `PROFILE_DEFAULT_ID`;
  - `PROFILE_FLAGS`, the reserved flags section, empty;
  - `PROFILE_SOURCE`, `PROFILE_OVERRIDES`, `PROFILE_FLAGS_SET` and `PROFILE_DEFAULTED` (a count);
  - `profileDefaultedKeys()` and `profileAnnouncements()`.
- `PROFILE_ID` is the override's `id`, and otherwise the default id.
- **Decided and pinned: a no-op override is a SET.** For `{walkSpeed: 0.8}`:
  - the md5 is unchanged;
  - `PROFILE_OVERRIDES` is `{walkSpeed: 0.8}`, so 1 set, and 126 keys are defaulted;
  - the announcement says `set walkSpeed=0.8`;
  - `PROFILE` is a new object equal to the defaults.

  RWK announces every set, and the md5 is the measure of whether the profile moved.
- **Refused by name:**
  - an unknown key, with the known list;
  - a duplicate key, scanned in the TEXT;
  - a nested value;
  - a string, boolean or null value;
  - NaN or ±Infinity;
  - any flag (`(none — no flag exists yet)`);
  - a bad `id`;
  - a non-object;
  - text that is not JSON.

  The refusal fails the import.
- `seedlingProfile.test.js` goes from 10 to **21 passed**. Each load-time row runs in a fresh module registry: `vi.resetModules()`, then set the global, then dynamic `import()`. The rows cover:
  - **no override: `PROFILE === PROFILE_DEFAULTS`, every value `Object.is`, md5 `be8b983b…`**;
  - an override moves `PROFILE.walkSpeed` AND `playerPhysicsV1.WALK_SPEED`;
  - the md5 differs and the stamp validates;
  - the provenance strings;
  - the no-op row;
  - every refusal.
- **Census:** the loader's own literals are **10 new literals**, all JSON-scanner indices. They take **1 fields row**: `profileOverrides.js|*|*,structural`. `--profile-rows` and `--write` bring it to 4368 literals, 51 files, structural 1637, and `--check` is PASS. `seedlingConstantsCensus.test.js` has 24/24 passing.

### D2 — a runner takes a profile (PASS)

- `scripts/procgen/seedlingProfileLoader.mjs` provides `installProfileFromEnv()`:
  - it reads `--profile=` or `SEEDLING_PROFILE`, sets the global to the file TEXT, and imports the profile itself, so a refusal is `<file>: profile override: …`;
  - an install that comes after the profile module has evaluated is refused as `installed TOO LATE`.

  Run as a command, it validates a file and prints the announcements.
- `scripts/procgen/run-seedling-tape.mjs <tape> [--profile=] [--expect]` is the worked example. There was no node face of `tapeRunner`.
- Measured on `collide-up-rock`:
  - default: stream md5 `a75f81ab…`, `expectation: same`;
  - `{"walkSpeed": 0.8000000000000002}`: stream md5 `91d27ba8…`, profile md5 `1f5db0f5…`, `expectation: moved (tick 44 differs: … y=130.05 … got 130.04999999999998)`.
- `seedlingProfileLoader.test.js` has **4/4** rows, each a child process:
  - moved and default md5s, by flag and by env;
  - the no-op;
  - a refusal naming the file;
  - the too-late refusal.
- Both new instruments pass `check-procgen-help.mjs --in-place --only=<f>`, which checks the help and import doors.

### D3 — the witness (PASS)

- `scripts/procgen/witness-seedling-profile.mjs` supports `--write`, `--only=`, `--check`, `--jobs=` and `--tier=fast`. The fast tier is `tick_count ≤ 600`, the differential's `FAST_TIER_MAX_TICKS`, and it is **102 tapes**.
- The control runs twice and has to hold three things before any key is perturbed:
  - it is stable;
  - it throws on 0 tapes;
  - it diverges from the expectations only on `r5-l60-kill`, which `tapeRunner.test.js` declares.
- "Moved" means the stream md5 differs from the CONTROL's, or the run threw.
- The run: `node scripts/procgen/witness-seedling-profile.mjs --write --jobs=4` at `bbdbe7d`, clean tree. **254 perturbed runs, 328 s wall.**

### D4 — the guard (PASS)

- `scripts/procgen/seedlingProfileWitness.test.js` has **5/5** rows:
  - exact key set, where a missing row gives "run the witness";
  - verdicts valid and following from their counts;
  - the control is 0;
  - `--check` agrees;
  - in-memory mutants.
- It never re-measures.

### D5 — records (PASS)

- `seedling-constants.md` § *The profile* gains *Overrides* and *The witness*. The intro no longer says "without overrides".
- `generate-procgen-reference.mjs` regenerated the README, `docsIndex.js` and `instruments.js`; its `--check` prints `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- `generate-docs-index.mjs --check` is OK, and no new doc was added.
- Bounded vitest: `npx vitest run …/seedlingProfile.test.js …/tapeRunner.test.js …/tapeFormat.test.js scripts/procgen/seedlingProfileWitness.test.js scripts/procgen/seedlingConstantsCensus.test.js scripts/procgen/seedlingProfileLoader.test.js frontend/modules/procgenDocs` gives **14 files, 1055 passed, 50.7 s wall**.

## The byte-inertia block (no override)

| gate | BEFORE (W0, `cdbf8fe`) | after D1 (`0a318a8`) | final (`6c7c87d`) |
|---|---|---|---|
| identity (308 lines) | `c3c9cc89…` | `c3c9cc89…` (cmp identical) | `c3c9cc89…` (cmp identical) |
| runTape (154) | `f7e93b11…` | `f7e93b11…` | `f7e93b11…` |
| `profileMd5()` | `be8b983b…` | `be8b983b…` | `be8b983b…` |
| 7 solve `--check` md5s | `410f27c0` `f2cfe3f9` `b470c14d` `17be7d70` `9a6a3192` `6cd35fe1` `2823a811` | the same 7 | the same 7 |
| census `--check` | PASS (4358) | PASS (4368, +10 structural, 0 keys moved) | PASS |

## The witness table

**Verdicts:** 58 keys `moves` and 69 are `corpus-blind`.

| class | moves | corpus-blind |
|---|---|---|
| physics (47) | 28 | 19 |
| rule (80) | 30 | 50 |

Of the 58 that move:

- **42 move a stream.** 22 of those move at +1 ULP: `seedlingTileSize`, `slashTimerMax`, `slashDashForce`, `pickupTextSpeed`, `fireHitFrameStart`, `waterState`, `waterfallState`, `defaultFriction`, `waterFriction`, `walkSpeed`, `waterSpeed`, `hitboxWidth`, `pitState`, `fallLerpDivisor`, `descentDrop`, `descentGravity`, `bounceVelocity`, `noBounceStates0`, `tile`, `swimBoostBelowSeconds`, `swimBoostSpeed`, `pinFrameRate`.
- **16 move ONLY by throwing.** They are witnessed as read, not as a value any replay checks:

  | keys | why they throw |
  |---|---|
  | `directionRight`/`Up`/`Left`/`Down`, `right`/`up`/`left`/`down`, `initialDirection` | `slashRect: direction … is not 0..3` |
  | `tagsPerLevel` | `ledgerKey: expects {level, tag} integers` |
  | `loadDeadFrames` | `stepChannel: frames must be a non-negative integer` |
  | `treeGrowFrames` | `animCallbackUpdate: … did not wrap` |
  | `coverAlphaRate`, `treeGrowFrameRate` | `r6-seed-credits` asks for a tick after the CREDITS reboot |
  | `lavaState` | +1 makes a tile Lava on a tape that does not pin `sound` |
  | `coercedTerrainState` | the player "entered Water" on a tape that does not declare it |

**Corpus-blind keys and inferred mechanisms.** These mechanisms are inferred from each key's module and the fast tier's tape names, not measured one by one:

- **No fixture carries the body:**
  - the final boss: `rockFrequency`, `grenadeFrequency`, `rockStepsAhead`, `rockRadius`, `deathRocks`, `rockScaleBase`, `rockScaleSpan`, `enemyCoinsBase`, `enemyCoinsSpan`;
  - `headPosX` (the totem);
  - the spear and dark sword: `spearLength`, `spearThick`, `spearDamage`, `darkSwordDamage`, `slashReach`;
  - the fire pushable: `pushableFriction`, `bothRange`, `alphaFade`;
  - `lightpoleHitsTimerMax`;
  - bridges: `bridgeTimerMax`, `bridgeState`, `ticksFromPressToWalkable`, `waitAfterPressTicks`;
  - ice and stairs: `iceState`, `slidingSpeed`, `slidingFriction`, `stairSpeed`;
  - `wandSpeed`, `fireForce`, `fireDamage`, `fireHitFrameEnd`.
- **The stream cannot see it.** The stream is the player's x, y and level:
  - the camera: `screenW`, `screenH`, `cameraSpeedDivisor`, `inventoryWidth`, `inventoryOffsetX`, `onScreenRadius`;
  - dialogue: `pickupLineLength`, `npcLineLengthDefault`, `initialFramesThisCharacter`, `specialTimerMax`, `ceremonyFreezeFrames`, `talkRange`;
  - enemy state: `enemyHitsMax`, `enemyHitsTimer`, `enemyIframes`, `slashHitTicks`, `swordAnimRate`, `swordAnimRateDash`, `killLockTset`, `enemyPitTile`.
- **The path is never taken:**
  - the frame-time clamps `fpMaxElapsed` and `fpElapsed`;
  - `velocityEpsilon`;
  - `level0WorldWidth` and `level0WorldHeight`;
  - `descentMaxFall` and `drownTimerMax`;
  - `noBounceStates1` and `noBounceStates2`;
  - the RNG: `xorMask`, `bootSeed`, `hashC1`–`hashC3`, `randomDivisor`, `stateMax`;
  - `gameFps` and `levelCount`.

**34 of the 69 blind keys carry an AS3 anchor.** For them, `seedlingProfile.test.js`'s anchor row is the only gate holding the value.

**Cost.** 4 jobs, 328 s. The brief estimated 30–40 min; a child runs the whole fast tier in about 2 s after a 1–2 s load.

## Predictions against results

| prediction (written before the run) | result |
|---|---|
| `walkSpeed` moves at 1 ULP | **held**: 63 tapes at ULP and 95 (+6 threw) at ×1.1 |
| sentinels throw or move many | **held, split**: the direction codes throw on 9–16 tapes; `waterState`/`waterfallState` move 7/4; `pitState` moves 2 and throws 12; `iceState` and `noBounceStates1`/`2` are **blind** |
| final boss, ending and `bootPreswapFrames` are blind | boss **held** (all blind). The ending **missed**: `coverAlphaRate`, `treeGrow*` and `fpElapsedClamped` reach `r6-seed-credits` (520 ticks, so in the fast tier). `bootPreswapFrames` **missed**: +1 moves 1 tape |
| `swimLengthFrames` moves at +1 iff a fast swim tape outlasts 47 frames | **held**: ×/+1 moves 5 tapes; ULP throws 7 (`createPinnedChannel: lengthFrames must be a positive integer`) |
| 45–65 of 127 blind | **missed high: 69** (RWK's rate was 185/332 = 56%; here 54%) |
| (smoke) `rockFrequency` blind | held |

## Mutants (predicted first; the tree was clean after each)

| mutant | predicted | observed |
|---|---|---|
| (a) the loader's unknown-key refusal disabled (`continue;`), in the file, restored from a copy | the unknown-key unit row and the import-fails row RED | **2 RED**, exactly those; restored, md5 re-checked |
| (b) `walkSpeed` deleted from the witness JSON | D4 row 1 (names every key) and the `--check` row RED | **3 RED**: those two, plus the in-memory mutant row, which destructures the deleted row. The message is `PROFILE.walkSpeed has no witness row — run the witness (…--write)` |
| (c) `mutantKey: 1` added to `PROFILE` with no witness row | D4 row 1 and `--check` RED, "run the witness" | **2 RED**, `PROFILE.mutantKey has no witness row — run the witness` |

## What the brief got wrong (measured)

1. **"The control must be 0 moved" against the committed expectation cannot hold.** The unperturbed model already diverges on `r5-l60-kill`, which is in the fast tier and declared in `tapeRunner.test.js`'s `EXPECTED_TO_DIVERGE`. The witness therefore compares each perturbed stream to the CONTROL's stream. For the 101 matching tapes that is identical to comparing against the expectation, and it keeps the diverger informative. The control is asserted stable (two runs), throw-free, and diverging only where declared.
2. **The cost estimate.** It was 2 h serial and 30–40 min at 4 jobs; the measured cost is **328 s at 4 jobs**.
3. **"+1 ULP" on integer-valued keys is mostly a TYPE probe, not a magnitude.** Guards refuse `47.00000000000001` frames or `1.0000000000000002` as a direction. That is why 16 keys move only by throwing. The verdict follows the brief (a throw is a move), but the JSON keeps `moved` and `threw` apart, and the doc names these keys.
4. **"A2's identity file `fa86b6e1…`" is not reproducible.** Its line format was never committed. Inertia is shown with a rewritten script, identical before and after.
5. **The census at `cdbf8fe` is 4358 literals in 50 files,** not A2's 4185 in 48. Later commits grew the closure.

## Residue

- **The page's `?profile=`.** The model modules are imported statically by the pages, so the global would have to be set by a bootstrap with top-level `await`, or by a dynamic-import entry, before them. This is a coordinator's design question, and nothing in the browser sets the global today.
- **Flags.** `PROFILE_FLAGS` is empty and reserved, and every flag key is refused. The first flag needs a record `{flag, note}` there, plus the branch in the module that reads it.
- **The blind list is fast-tier only.** A `--tier=full` witness (about 30 min at 4 jobs, by extrapolation) would shrink it, for example the boss keys under the campaign tapes. `--tier=` refuses anything but `fast` today, by name.
- The mechanism column is inferred, not measured per key.
- `seedlingProfile.test.js`'s AS3 anchor row still compares `PROFILE[key]`. With no override that is the defaults. Under an installed override in a test process it would compare the override, and `PROFILE_DEFAULTS` would be the stricter reading. It was left as A2 wrote it.
- Not measured here: the unfiltered vitest suite (⚖ ruling 52) and CI at the pushed SHA.
