# seedling-engine-prep-a2 — the physics profile registry (cloud report)

- **Started from:** `origin/main` at `f9cd949dbb`. The brief expected `91b29e40de` or later. The seven commits in between are concept-library T2 (the text adventure) and a procgenCore test, and none of them touches a census path. W0 was measured at `f9cd949`.
- **Harness branch:** `claude/physics-profile-registry-vt0dhf`. The harness designated it; nothing was pushed to `main`.
- **Commits:**

  | step | commit |
  |---|---|
  | D1 | `7f58f14` |
  | D2 | `8df36cd` |
  | D3 | `f882970` |
  | D4 | `7112a52` |
  | D5 | `23943c0` |
  | D7 docs | `9e4ebfa` |
  | this report | the one commit after `9e4ebfa` |

  D6 is a measurement and has no commit.

## W0 — the identities, banked before any edit

| row | command | result |
|---|---|---|
| (a) fixture identity | scratch `identity.mjs`, not committed. It writes one line per committed tape (`name, md5(file), md5(JSON(parseTape)), md5(serializeTape(parseTape)), md5(JSON(gameVisibleTape(parseTape)))`) and one per expectation (`name, md5(file), md5(JSON(parseObservationStream))`). `fixtures/tapes/index.json` is not a tape and is excluded | **308 lines** (154 tapes + 154 expectations), file md5 **`fa86b6e1e6557cd282076bcb346b8632`** |
| (a′) run identity (added) | the same script, per tape: `md5(JSON {ticks, transitions})` and `md5(JSON runTape result minus profile)`, with `atlasLevelSource()` | **154 lines**, 0 ERR, md5 **`1bcb066a161c01764bb2ac8ea61af925`** |
| (b) vitest | `npx vitest run …/tapeRunner.test.js …/botDriverV2.test.js …/solverBot.test.js` | **3 files, 594 passed**, 69.9 s |
| (c) solve `--check`s | the ten routes of `measure-seedling-solver-surface.mjs`'s `ROUTES`, each `--check` | all **rc=0**: the seven `solve-seedling-*` print `all checks green`; `regenerate-r2`/`-r3` print `0 tape(s) differ from disk`; `regenerate-r4` prints 7 `same` lines |
| (d) census | `node scripts/procgen/census-seedling-constants.mjs` | 48 files, 4185 literals. **physics 1505, rule 1191** (the brief's 1,189 is A1's figure; main's committed census says 1191), structural 1438, cosmetic 51, unclassified 0. `--check` PASS |
| (e) smoke | `SEEDLING_PORT=8640 node scripts/procgen/check-seedling-bot-differential.mjs --tier=fast --only=friction-stop` | `CHANNEL: headless logic-only`, `ALL CHECKS PASSED` |

## Per D

### D1 — the registry module (PASS)

- `frontend/modules/seedlingDemo/seedlingProfile.js` exports:
  - `PROFILE`: frozen and flat, numbers only, 127 keys, each value at its source spelling;
  - `PROFILE_FIELDS`: 127 frozen records `{key, class, kind, as3, as3Match?, source, alsoIn?, review, note}` in `PROFILE`'s order, holding strings and booleans only, so the census sees each value once;
  - `PROFILE_ID = 'seedling-js-2026'`;
  - `profileDump()`, `profileMd5()` and `profileStamp()`.
- The module imports only `md5.js`, and neither file touches `fs` or `process`.
- `md5.js` is a dependency-free RFC 1321 digest. Its K table is written out as literals, not computed, because `Math.sin` is not required to be correctly rounded.
- `md5.test.js` (5 rows) passes:
  - `''`, `'abc'` and the quick-brown-fox vector match both `node:crypto` and the published digests;
  - a 1,000-byte string matches `node:crypto`;
  - every length from 0 to 130 matches, which covers every padding boundary;
  - a UTF-8 string matches.
- `seedlingProfile.test.js` (9 rows at D1) checks:
  - the keys are finite numbers, unique, and covered exactly once by `PROFILE_FIELDS`;
  - the camelCase naming rule;
  - the dump round-trips through `JSON.parse` with `Object.is` on every value;
  - shortest-double printing;
  - **the md5 is pinned as a literal** with the comment "a change here is a PHYSICS change";
  - a 1-ULP change moves the md5;
  - the stamp passes `tapeEnvelope.validateProfile`.

### D2 — the modules read the registry (PASS)

- 128 declarations in **28 files** became `NAME = PROFILE.<key>;` with their comments kept. The edit was a regex rewrite, asserted to hit exactly one line per name.
- The player's tables read profile fields: `HITBOX`, `TILE`, `SPAWN_OFFSET` (`TILE.w / PROFILE.spawnOffsetXDivisor`), `LEVEL0_WORLD`, `MOVE_SPEEDS[25]` (`WATER_SPEED / PROFILE.moveSpeeds25Divisor`), `CHECK_OFFSET_Y` (`… - PROFILE.checkOffsetYInset`) and `NO_BOUNCE_STATES`.
- Each file gained one import line. In `seedlingSemantics.js` it goes below the `//` header, and in `tapeFormat.js` a comment says why importing the profile keeps the module's charter.
- **Gate, all measured after the edit:**
  - identity file **`fa86b6e1…` byte-identical**;
  - run identity **`1bcb066a…` byte-identical**;
  - vitest **594/594**;
  - the ten `--check`s **rc=0** (r4: 7 `same`);
  - `node -e "import('./<f>')"` for each of the 28 files alone: 0 failures;
  - every export of the 28 modules against a `git archive HEAD` copy: **714 exports compared, 0 differ** (lists and values, including frozenness).

### D3 — the census learns the profile (PASS)

- `census-seedling-constants.mjs --profile-rows` regenerates the fields table's rows for `seedlingProfile.js` from `PROFILE_FIELDS`, one row per `PROFILE` literal.
- `--check` also reds on any census/`PROFILE_FIELDS` disagreement in class, kind or as3.
- Library changes in `seedlingConstantsCensus.js`:
  - `PROFILE_FILE`, `profileRows`, `profileFieldsRows`, `spliceProfileFields` and `profileDisagreements`;
  - `NAME = PROFILE.key` aliases are kept out of the derived list, so it stays at **28**;
  - a new region § lists the 127 keys, each with the top-level declarations that read it.
- The fields table:
  - **136 targets** reached only the moved literals and are deleted (dead targets are red);
  - `md5.js|*|*` is added as a file-wide structural default;
  - 127 generated exact-key rows are added.
- **Conservation.** Every row was predicted before `--write`, and every prediction held:

  | | before | retired | new | after |
  |---|---|---|---|---|
  | physics | 1505 | 55 | 47 | **1497** |
  | rule | 1191 | 88 | 80 | **1183** |
  | structural | 1438 | — | +189 (md5.js) | **1627** |
  | unclassified | 0 | | | **0** |

  - The **143** retired rows are the 128 scalars and the 15 player-table literals.
  - Physics and rule are each short by exactly **8**: the 16 declarations absorbed into keys another declaration already names. That is 16 = 143 − 127.
  - REVIEW rows stay at 105, and `--check` is **PASS**.
- `seedlingConstantsCensus.test.js` goes from 20 to **24 passed**:
  - mutants (a) and (c) are re-anchored, because their text `export const WATER_FRICTION = 0.5;` no longer exists. (c) now deletes the profile's `waterFriction: 0.5,` and must RETIRE that key;
  - (v) adds four profile rows, one of them the class-contradiction mutant.
- The help door: `check-procgen-help.mjs --only=census-seedling-constants.mjs` is ALL PASS.

### D4 — the AS3 anchor gate (PASS)

- A row in `seedlingProfile.test.js` that skips by name without `vendor/seedling`. For each anchored field it finds the literal and asserts `Number(literal) === PROFILE[key]`.
- The default search is a numeric `const`/`var` declaration. `as3Match` covers the other shapes:
  - `arg:<n>`: `normalHitbox = new Rectangle(2, 2, 4, 5)`, 4 keys;
  - `param`: `NPC(…, _lineLength:int=28)`;
  - `after:<text>`: `dMSwater/2` and `checkOffsetY = -originY + height - 2`.
- **All 63 anchors are checked numerically: 63 agree, 0 are unresolved.**
- The first prototype resolved 60. The other three are the `param` and `after:` cases above, which is why those forms were added.
- An anchor that stops resolving is red, not skipped.

### D5 — the runner records the profile (PASS, with a deviation)

- The stepper's done value, and therefore `runTape`'s result, gains `profile: profileStamp()`.
- `runTapeToStream` still returns `{ticks, transitions}`, and a row asserts exactly those two keys.
- The existing stepping-equals-`runTape` row still passes, and a new one checks the same equality with the profile present.
- **The emitted-tape opt-in lives on `buildStagedTape`, not on `buildTape`/`synthesizeLegs`,** and it takes the stamp itself (`stampProfile: profileStamp()`) rather than `true`. The reasons are under *What the brief got wrong*, item 1.
- Default: no `profile`, no `despawn`, `tape_version` 8, which are today's bytes. Opted in: a v13 tape that `parseTape` accepts, whose `profile` validates, and which `gameVisibleTape` strips.
- 5 new rows; runner/driver/solver vitest **599/599**.
- Identity after D5: **`fa86b6e1…` / `1bcb066a…`, unchanged.** The ten `--check`s are **rc=0** again, since `botDriverV1.js` changed.

### D6 — the wasm witness (PASS)

Both runs used `SEEDLING_PORT=8640 node scripts/procgen/check-seedling-bot-differential.mjs --tier=fast --only=…` at `23943c0`, after D2 and D5:

| `--only=` | CHANNEL | PASS | FAIL | verdict |
|---|---|---|---|---|
| `friction-stop` | headless logic-only | 28 | 0 | ALL CHECKS PASSED |
| `hazard-boot-pit,r5-l38-fade-door,r9-l0-sword-dash,r8-solve-2` | headless logic-only | 100 | 0 | ALL CHECKS PASSED |

### D7 — records (PASS)

- `seedling-constants.md` has a new § *The profile*, and the intro no longer calls the profile a later slice. The census region was re-rendered by `--write` in D3.
- `node scripts/procgen/generate-procgen-reference.mjs` changed the README word count, `docsIndex.js`, and `instruments.js` (which picked up `--profile-rows`). Its `--check` prints `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- `scripts/quicklaunch/generate-docs-index.mjs --check` is OK, and no new doc was added.
- Bounded vitest: `npx vitest run frontend/modules/seedlingDemo frontend/modules/procgenDocs scripts/procgen/seedlingConstantsCensus.test.js scripts/procgen/rerecordCampaign.test.js` gives **181 files, 6350 passed, rc=0, 218 s wall**.
- Also run:
  - C1's `census-seedling-solver-surface.mjs --check`: `GREEN: 240 rows match a fresh census`;
  - `seedlingSolverSurface.test.js`: 11/11;
  - `npm run build`: `Build complete!`, with no tracked file changed.

## The byte-inertia block

| gate | BEFORE (W0) | after D2 | after D5 |
|---|---|---|---|
| fixture identity (308 lines) md5 | `fa86b6e1e6557cd282076bcb346b8632` | `fa86b6e1e6557cd282076bcb346b8632` | `fa86b6e1e6557cd282076bcb346b8632` |
| runTape results (154) md5 | `1bcb066a161c01764bb2ac8ea61af925` | `1bcb066a161c01764bb2ac8ea61af925` | `1bcb066a161c01764bb2ac8ea61af925` |
| tapeRunner + botDriverV2 + solverBot | 594 passed | 594 passed | 599 passed (+5 new) |
| solve-seedling-r8-battery / -r8-d2 / -r8-d2-chain / -r8-l18 / -r8-tail / -r9-l3 / -r9-campaign `--check` | rc=0 ×7 | rc=0 ×7 | rc=0 ×7 |
| regenerate-r2 / -r3 / -r4 `--check` | 0 differ / 0 differ / 7 same | the same | the same |
| wasm smoke `friction-stop` | ALL CHECKS PASSED | — | ALL CHECKS PASSED (28 PASS) |
| wasm B1 families (4 tapes) | — | — | ALL CHECKS PASSED (100 PASS) |

## The profile

- **127 keys:**
  - **47 physics**: magnitude 36, bound 7, derivation 4;
  - **80 rule**: magnitude 42, sentinel 22, bound 10, count 6.
- **63 anchored**, all checked numerically by D4. 7 of them use `as3Match`.
- **4 `REVIEW:`** fields (⚖ Q12): `pickupLineLength`, `npcLineLengthDefault`, `bootPreswapFrames`, `swimLengthFrames`.
- **15 keys absorb 16 other declarations**, listed in `alsoIn`:
  - the brief's 12 duplicated names: `slidingSpeed`, `slidingFriction`, `waterState`, `lavaState`, `waterfallState`, `bridgeState`, `fpElapsedClamped` (×3), `fpMaxElapsed`, `right`, `up`, `left`, `down`;
  - **3 key collisions the brief did not list**. `HITBOX_ORIGIN_X`/`HITBOX_ORIGIN_Y` in `levelWorld.js` collide with `HITBOX.originX`/`originY`, all `Player.as:normalHitbox`, value 2. `TILE_W` in `wandShot.js` collides with `TILE.w`, both `Scenery/Tile.as:w`, value 16. Each pair has the same value, the same AS3 source and the same quantity, so each pair shares one key.
- **`profileMd5()` = `be8b983bc252c0ac33effa9ede59bc6e`**, `PROFILE_ID` = `seedling-js-2026`.

## Mutants (predicted first, each in a copy; tree clean after)

| mutant | predicted | observed |
|---|---|---|
| (a) `walkSpeed: 0.8` → `0.8000000000000002` (+1 ULP), in a copy of `frontend/` with `node_modules` and `vendor` linked | the md5 pin reds; the D4 anchor row reds (`Player.as:dMS`); the parse identity does not move; the runTape streams move | md5 pin **RED**, anchor row **RED**, identity `fa86b6e1…` **unchanged**, runTape results **128 of 154 moved** (file md5 `1cc3e875…`), `tapeRunner.test.js` **113 of 360 failed**. Named examples that moved: `collide-up-rock`, `cross-level-leg`, `diagonal-run`, `direction-flip`, `grant-sword-room`. **26 did not move**: 1 ULP of walk speed is absorbed on those routes (e.g. `straight-run`, `friction-stop`, `hazard-boot-pit`, the `r3-collect-*` four, `r5-swim-*`). They are candidates for A3's corpus-blind list *for this key at this magnitude*. |
| (b) the census fields row for `PROFILE.walkSpeed` re-classed `rule` | the agreement row reds, naming the key | RED, exactly `PROFILE.walkSpeed: class is "rule" in the census, "physics" in PROFILE_FIELDS`. It is a committed test row (in memory, `buildCensus(…, {fieldsText})`) |
| census (a) re-anchored: `SPEED_X = 0.37` after `WATER_FRICTION = PROFILE.waterFriction` | RED, one NEW key | RED, that key |
| census (c) re-anchored: delete `waterFriction: 0.5,` from the profile | RED, one RETIRED key | RED, that key |

## Files outside the brief's list that I touched, and why

- `frontend/modules/seedlingDemo/botDriverV1.js` is a family file. I changed the **body** of `buildStagedTape` only: a new parameter `stampProfile = null` and three lines. Its import lines are untouched, which is C2's territory, so a rebase will not conflict. No family file declares a physics/rule scalar, since the census's 28 declaring files include none of the 11, so no family declaration line changed.
- `frontend/modules/seedlingDemo/md5.js` and `md5.test.js` are the digest that D1 asks for.
- `scripts/procgen/seedlingConstantsCensus.test.js` needed its mutants re-anchored, because their anchor text moved (D3).
- `frontend/modules/procgenDocs/generated/*.js` and `docs/json/developer/procgen/README.md` are the reference generator's own output.

## What the brief got wrong (measured)

1. **The `stampProfile` opt on `buildTape`/`synthesizeLegs`.**
   - Those emit v1–v5 tapes, and a v13 tape must also declare what the versions below require. `parseTape` refuses `thread-the-gap`, `cross-level-leg` and `grant-sword-room` re-stamped to v13 with `despawn must be an array … on a tape_version 10 tape`.
   - `buildStagedTape`, the solve-side v8+ assembler, admits only `despawn: []`, so stamping it is honest. The opt therefore lives there.
   - The opt takes the stamp as a value because `true` would need `profileStamp` imported into `botDriverV1.js`, and that file's import lines belong to C2.
   - After C2 merges, a `true` form (and a `synthesizeLegs` route through `buildStagedTape`) is a two-line follow-up.
2. **"physics+rule COUNT is conserved."** It is conserved only modulo the collapses. Each class drops by exactly 8, the 16 absorbed declarations. Every retired row is accounted for (143 = 127 + 16).
3. **"12 names collapse."** 15 keys collapse, absorbing 16 declarations. The three extra are camelCase key collisions (`hitboxOriginX`/`Y`, `tileW`), found when the keys were generated.
4. **The fields-row target form `seedlingProfile.js|PROFILE.<key>|(module)` matches nothing.** A selector's second part is the ENCLOSING declaration, which is `PROFILE` for every row, and the literal alone is not unique. The rows are exact census keys, generated (`--profile-rows`) so that no hash is typed by hand.
5. **"128 rows … and the player's tables" are 143 guarded rows, not ~130.** Also, `NO_BOUNCE_STATES` (6, 1, 17) has the same values as `pitState`, `waterState` and `lavaState`, but it stays three keys of its own (`noBounceStates0..2`). Sharing keys would claim `Player.as:490`'s list is those states by identity, which is an A3 decision and not a declaration move.
6. **The rule total at main is 1191, not 1189.** 1189 is A1's number, before a later re-record.
7. **W0(a)'s "308 lines" holds only with `fixtures/tapes/index.json` excluded.** It is a JSON file in the tapes directory that is not a tape.

## Residue

- ⚠ **`scripts/quicklaunch/generate-docs-index.mjs --help` WRITES** `frontend/modules/quickLaunch/generated/docsIndex.js` instead of printing help. It was byte-identical here, so the tree did not move. It is a write door on `--help`, and unfixed because it is outside this slice.
- Not measured here: the unfiltered vitest suite (⚖ ruling 52) and CI at the pushed SHA.
- The `levelWorld.js` docblock above `HITBOX_ORIGIN_X` still says "transcribed rather than imported … dependency-free of the physics". That is still true, since the profile is not the physics, but it no longer describes where the 2 lives. It was left alone because D2 allows the declaration line only.
- A3 inherits:
  - the four `REVIEW:` fields;
  - the `NO_BOUNCE_STATES` identity question (item 5);
  - the corpus-blind list, which should come from a per-key witness. Mutant (a) shows one key moving 128 of 154 tapes at 1 ULP and 26 not moving;
  - the `true` form of `stampProfile` after C2.
