# Seedling Constants Census

Every numeric literal in Seedling's JS simulation — the static import closure of `frontend/modules/seedlingDemo/levelRun.js` — is one row of a generated census, `scripts/procgen/seedling-constants-census.csv`, and every row carries a REVIEWED class (`physics`, `rule`, `cosmetic`, `structural`) joined from `scripts/procgen/seedling-constants-fields.csv`. It was the first step of giving the simulation a single physics profile: the census said which numbers a profile would have to own, the profile now owns them (§ *The profile* below), and a vitest gate keeps the classification from rotting as the simulation changes.

## What it is, and what it is not

The census is READ-ONLY over the simulation. It moves no constant, edits no simulation or solver file, and touches no tape or expectation. The profile — the `physics` and `rule` constants gathered into one object — is `frontend/modules/seedlingDemo/seedlingProfile.js`, built from this classification; the census now classifies the profile's literals, and the candidate list at the end of this page names what is still outside it.

Three files and one test:

- `scripts/procgen/seedlingConstantsCensus.js` — the pure logic: the closure, the rows, the keys, the join, the drift verdict, and the tables rendered at the end of this page.
- `scripts/procgen/census-seedling-constants.mjs` — the command. With no flag it prints the class × position table; `--write` regenerates the census CSV and this page's CENSUS region; `--check` exits 1 on drift; `--profile-rows` regenerates the fields table's rows for the profile.
- `scripts/procgen/seedling-constants-fields.csv` — the reviewed classification, hand-edited.
- `scripts/procgen/seedlingConstantsCensus.test.js` — the gate, in the default vitest tier.

## The closure and the three positions

The simulation is every file reached from `levelRun.js` by `import … from './x'` or `export … from './x'` with a relative specifier; dynamic `import()` and bare specifiers are not followed. Today that is 46 files in `frontend/modules/seedlingDemo/` plus `frontend/modules/flashPanel/seedlingSemantics.js`. Every `NumericLiteral` node in them is one row, in one position:

- **scalar** — the whole initialiser of a top-level `const NAME = <number>` (or `= -<number>`), `NAME` matching `^[A-Z][A-Z0-9_]*$`. These are the names a profile would import.
- **table** — anywhere inside the initialiser of any other top-level `const` whose initialiser is not a function: frozen objects, arrays, `new Set([...])`, arithmetic over other constants, and the methods nested inside those objects.
- **inline** — everything else: literals in function bodies, in `let`s, in function-valued consts.

A unary minus is folded into the literal, so `-1` is one row spelled `-1`. The literal column keeps the source spelling (`0.0333`, `0x48000000`), never a re-printed float.

## The key

`<file>|<function>|h<8 hex>|<literal>|<ordinal>`

- `function` is the innermost NAMED function frame (`createLevelRun`, `Class.method`, the const an arrow is assigned to); anonymous callbacks are attributed to the named frame around them, and module-level code is `(module)`.
- The 8 hex digits are the md5 of the literal's UNIT with comments stripped and whitespace normalised (runs collapsed, and dropped wherever they touch punctuation, so `f( 3 )` and `f(3)` agree). The unit is the literal's statement, with every nested block or statement that does not hold the literal replaced by `{…}` — so an edit inside an `if`'s body moves no key in its test. In a table the unit is the innermost `key: value` property, prefixed by the property path from the table's name (`HITBOX.originY: originY:2`), so editing one entry of a large table does not re-key its neighbours.
- `ordinal` numbers the rows that agree on everything before it, in source order.

The LINE is a column, never part of the key: inserting lines moves no key (the gate proves it on a temp copy). The reason the key carries the statement at all is the trap the precedent census hit: a value cannot tell you its kind — the same `16` is a tile size in one statement and a frame count in another — and a `(file, literal)` key would cover every occurrence at once.

## The classes and kinds

| class | means | examples |
|---|---|---|
| `physics` | a magnitude the motion or collision arithmetic consumes | speeds, friction, acceleration, hitbox sizes and origins, tile size, knockback force, the 0.0333 frame-time clamp |
| `rule` | a game rule in numbers | hit counts, damage, invulnerability frames, timers and cadences that gate events, state and tile ids the rules branch on, RNG constants |
| `cosmetic` | presentation only; no simulation outcome depends on it | sprite frames nothing reads back, alpha fades, sound, text layout |
| `structural` | the program's own bookkeeping | array indices, loop bounds, `+1`/`-1` index arithmetic, version numbers, format and parser limits, 0/1 as booleans or identities |
| `unclassified` | no reviewed target reaches the row | — the gate allows none |

Every `physics` and `rule` row also carries a `kind`: `magnitude` (a quantity), `count` (how many), `bound` (a limit, clamp, threshold or radius), `sign` (a direction or ±1), `sentinel` (an id or marker value), or `derivation` (a literal inside arithmetic over named constants — its note names the sources). `cosmetic` and `structural` rows carry none.

⚠ In this engine an animation frame count often GATES gameplay: a hit lands on a sprite frame, an animation callback fires a kill. Such a literal is `rule` (or `physics`), not `cosmetic`. Where a classification is a judgement call, its note starts `REVIEW:`; the count of those is in the tables below.

## The reviewed table and how to classify a new literal

`seedling-constants-fields.csv` has the columns `target,class,kind,as3,note`. A target is either:

- a SELECTOR `file|enclosing|function` or `file|enclosing|function|literal`, where `enclosing` is the top-level declaration the literal sits in (the table's name for a table row) and `function` is as in the key; `*` appears only as a file-wide default `file|*|*`; or
- an exact KEY from the census, for a single row.

The most specific target wins: an exact key, then a four-part selector, then a three-part one, then a file default. Two targets equally specific on one row is a red gate row, never resolved by file order, and a target that reaches no row is also red — dead rows do not accumulate.

To classify a new literal after the gate names it:

1. Read the statement the key's hash was taken over (the census row's `context` column shows its first 90 characters) and the doc comment above it. Do not class by value.
2. If its group (`file|enclosing|function`) already has a row with the right class, nothing is needed beyond step 3. Otherwise add a selector for the group, or an exact-key row when the group mixes classes.
3. Run `node scripts/procgen/census-seedling-constants.mjs --write` and commit the census CSV, this page and the fields file together.

## The gate

`seedlingConstantsCensus.test.js` runs `--check`'s own function (`checkCensus`) over the tree. It is RED on:

- a NEW key whose class is `physics`, `rule` or `unclassified`;
- a committed `physics` or `rule` key that is gone from the source — it must be RETIRED by a `--write` whose commit says why;
- a key present on both sides whose reviewed columns (class, kind, note, as3) disagree — the committed census is stale;
- this page's CENSUS region differing from a render of the COMMITTED census (and of the source's top-level facts: the duplicated names and derived constants).

A new or vanished `cosmetic` or `structural` literal is GREEN and is reported as drift, as is a moved line; the next `--write` records it. The region renders the committed rows rather than fresh ones for exactly that reason: rendered fresh, every new cosmetic literal would move the counts and turn the page red. The test also proves the key line-independent, self-tests the positions on synthetic sources, and runs three mutants on temp copies of the closure (a new physics scalar is red by key, a new literal in a cosmetic table is green, a deleted physics statement must be retired).

The `as3` column is read from `vendor/seedling/src` when the submodule is initialised: a named scalar is anchored automatically when its trailing comment or its name names an AS3 `const`/`var` of EQUAL value (`WALK_SPEED = 0.8; // dMS` → `Player.as:dMS`), and the fields file can give any row an anchor by hand. Without the submodule the as3 column is not compared and the anchor row of the test skips by name; the region needs no AS3 source, since the committed rows carry their anchors.

## The profile

`frontend/modules/seedlingDemo/seedlingProfile.js` is the ONE registry of the simulation's physics and rule constants: RWK's profile convention, with overrides (§ *Overrides* below). It holds every named top-level scalar the census classed `physics` or `rule`, and the literals of the player's own small tables in `playerPhysicsV1.js` and `playerPhysicsV2.js` (`HITBOX`, `TILE`, `SPAWN_OFFSET`, `LEVEL0_WORLD`, the waterfall divisor in `MOVE_SPEEDS`, the inset in `CHECK_OFFSET_Y`, `NO_BOUNCE_STATES`). The entity tables stay in their modules. A derived constant (`CLAMP`, `CHECK_OFFSET_Y`, `TICKS_PER_TILE`, `KILL_CADENCE_FLOOR` …) stays derived in its module, now from profile fields: a derived value is computed in code and never stored.

Every declaring module still exports its old name, now read from the profile (`export const WALK_SPEED = PROFILE.walkSpeed; // dMS`). Every default is the literal the module used to spell, and no arithmetic moved, so every committed tape, expectation and solve is byte-identical across the move.

**The key.** A key is the declaring name in camelCase: `WALK_SPEED` → `walkSpeed`. A table field `HITBOX.originY` becomes `hitboxOriginY`, and an array element `NO_BOUNCE_STATES[1]` becomes `noBounceStates1`. A literal inside a derivation is named for its role (`moveSpeeds25Divisor`, `checkOffsetYInset`). A name declared in several files is ONE key (`SLIDING_SPEED`, `WATER_STATE`, `RIGHT` …). So is a pair whose keys would collide and whose value and AS3 source agree: `HITBOX_ORIGIN_X` in `levelWorld.js` and `HITBOX.originX`, and `TILE_W` in `wandShot.js` and `TILE.w`. `PROFILE` is flat and holds numbers only, at their source spelling (`0x48000000`).

**The metadata.** `PROFILE_FIELDS` has one record per key, in `PROFILE`'s order:

- `class` and `kind`, as in the census;
- `as3`, the anchor `File.as:name`;
- `as3Match`, when the anchor's literal is not a numeric `const`/`var` declaration: `arg:<n>` (a constructor call's n-th argument), `param` (a parameter default) or `after:<text>` (the number after the one occurrence of the text);
- `source`, the declaration the value came from, and `alsoIn`, the others that now read it;
- `review` and `note`. `review` is true exactly when the note starts `REVIEW:`.

**The dump and the md5.** `profileDump()` is RWK's text shape: braces, then one `"<key>": <value>` line per field in `PROFILE_FIELDS` order. Each value is printed as its shortest round-trip double, which is exact, so the dump is JSON and parses back to `PROFILE`. `profileMd5()` is the md5 of the dump, and it is the profile's identity. `PROFILE_ID` (`seedling-js-2026`) is only a name. `seedlingProfile.test.js` pins the md5 as a literal: a change there is a physics change, not a re-record. The md5 comes from `seedlingDemo/md5.js`, a dependency-free RFC 1321 digest, so it runs in a page as well as under node.

**The stamp.** `profileStamp()` is `{id, md5}`, the shape of a v13 tape's model-only `profile` field (`tapeEnvelope.validateProfile`).

- `runTape`'s result carries it as `profile`. The observation stream does not: `runTapeToStream` still returns exactly `{ticks, transitions}`.
- Emitted tapes stay unstamped by default. `buildStagedTape({ …, stampProfile: profileStamp() })` opts one in, which makes it a v13 tape that also spells `despawn: []`, the v10 list that version requires. The value form is the API. A `stampProfile: true` form was left open by A2 and is dropped, not owed: it would import `profileStamp` into a family file through that door, where the solver-surface table lives.
- The v1–v5 emitters (`buildTape`, `synthesizeLegs`) do not stamp. A v13 tape must carry the fields of the versions below it, and those emitters do not write them.

**How a new constant joins.**

1. Add the key to `PROFILE` at its source spelling.
2. Add its record to `PROFILE_FIELDS`: class, kind, the AS3 anchor when there is one, and `as3Match` when the literal is not a plain declaration.
3. Make the declaring module read it (`NAME = PROFILE.key`).
4. Run `node scripts/procgen/census-seedling-constants.mjs --profile-rows`, then `--write`, and commit the profile, the fields table, the census and this page together.
5. Update the md5 pin in `seedlingProfile.test.js` in the same commit. Say in that commit that it is a physics change.

Three gates hold the profile together:

- `seedlingConstantsCensus.test.js` (v) and `--check` are red when the census's class, kind or as3 for a profile literal disagrees with `PROFILE_FIELDS`, or when the fields rows are not what `--profile-rows` generates.
- `seedlingProfile.test.js`'s anchor row (it skips by name without `vendor/seedling`) resolves every anchor to its AS3 literal and asserts it equals the default, read from `PROFILE_DEFAULTS`. It reads the defaults rather than `PROFILE` because an override installed in a test process would otherwise be compared to the AS3 in their place. A row beside it asserts that `PROFILE_DEFAULTS` deep-equals `PROFILE` with no override, so the two readings agree today. All 63 anchors resolve today, and an anchor that stops resolving is red.

### Overrides

`PROFILE` is the compiled-in defaults with an override applied, which is RWK's semantics. The literals in `seedlingProfile.js` are the defaults, exported as `PROFILE_DEFAULTS`. An override is data, never an edit to them.

- **Where it comes from.** `globalThis.__SEEDLING_PROFILE__`, read ONCE, when `seedlingProfile.js` evaluates. `undefined` means no override, and then `PROFILE` IS `PROFILE_DEFAULTS` (the same frozen object) and the md5 stays `be8b983b…`. An object is the override. A string is its JSON text. The module stays dependency-free and browser-safe: it reads no file and no environment.
- **Process-wide at load (⚖ Q2).** The 28 modules that read the profile copy their constants out at their own evaluation (`WALK_SPEED = PROFILE.walkSpeed`). An override therefore has to be installed before the first import of any of them. Setting it later changes nothing.
- **The shape.** A flat object: profile keys to finite numbers. Two keys are not numbers:
  - `id` is a non-empty string, the profile's name. It is what `profileStamp()` and a v13 tape's `profile.id` carry. Without one, the default name stays; the md5 is the identity, and it moves anyway.
  - `flags` is reserved for formula switches, where flag 0 is the original path. `PROFILE_FLAGS` is empty because no flag exists yet, so every flag key is refused.
- **Refused by name** (`profileOverrides.js`, `ProfileOverrideError`):
  - an unknown key (the message lists the known keys);
  - a duplicate key, found in the JSON text, because `JSON.parse` would silently keep the last one;
  - a nested value;
  - a non-number or non-finite value;
  - an unknown flag;
  - a bad `id`.
  A refusal fails the import itself.
- **Provenance and reporting.**
  - `PROFILE_SOURCE` is `compiled-in default`, `override:<id>` or `override:inline`.
  - `PROFILE_OVERRIDES` holds every key the override SET. A set equal to its default still counts, because RWK announces every set; the md5 says whether the profile actually moved.
  - `PROFILE_DEFAULTED` is the count of keys left at default, and `profileDefaultedKeys()` lists them.
  - `profileAnnouncements()` gives the lines a runner prints: the provenance, one `set <key>=<value>` per set, and the defaulted count.
  - `profileDump()`, `profileMd5()` and `profileStamp()` describe the LIVE profile.
- **Node.** `scripts/procgen/seedlingProfileLoader.mjs`:
  - `installProfileFromEnv()` reads `--profile=<path>` or `SEEDLING_PROFILE`, sets the global to the file's text, and imports the profile itself, so a refusal names the file;
  - an install that comes after the profile module already evaluated is refused ("installed TOO LATE");
  - the model is imported dynamically after the install. A static `import` is hoisted above any call.
  - `scripts/procgen/run-seedling-tape.mjs <tape> [--profile=<path>] [--expect]` is the worked example. It prints the stream md5 and the live stamp.
- **The page: `watch.html?profile=<path>`.** The path is repo-relative, like `?tape=`. `seedlingDemo/profileBoot.js` is a CLASSIC script loaded before the page's inline module, and that module is unchanged (`import { main } from './watchViewer.js'`). A classic script runs while the document parses and every module runs after, so the fetch is synchronous and the global is set before the first module evaluates.
  - **What it does.** It fetches the file's text and sets the global. After load, it logs the announcements to the console, each prefixed `[profile]`, and refuses an install that came too late.
  - **A refusal** fails the model's import, and `#status` turns red, naming the `?profile=` path.
  - **A failed fetch** installs text the profile refuses. The page then never runs the defaults under a URL that asked for a profile, and `#status` shows the fetch error.
  - **With no `?profile=`**, it reads `location.search` and returns. Measured on `?tape=collide-up-rock`, the old and new page have identical status, detail, HUD and console, and `__watch` differs only in its URL.
  - `profileBoot.test.js` covers the logic.
  - ⛔ **A module bootstrap was built first and measured wrong.** It dynamically imported the entry after a top-level `await`. `DOMContentLoaded` does not wait for that `await`, so `main()` ran after the page reported itself loaded, and `check-procgen-demos.mjs`'s CAMPAIGN row went red 3 times out of 3.
  - **Not wired:** `mazeRoom/lab.html` also reaches the profile, through `mazeLabView.js`. So does the main app, through `flashPanel/seedlingSemantics.js`. On the bundled boot (`?bundled=true`), `frontend/dist/bundle.js` evaluates the profile when the bundle loads, and nothing loads this script first. `watch.html` has no bundled boot.

### The witness

`scripts/procgen/witness-seedling-profile.mjs` answers, per key, whether perturbing that key moves any committed replay. It restates RWK's `check_profile_live.py`. It is a one-off measurement recorded as data (⚖ Q3), in `scripts/procgen/seedling-profile-witnesses.json`, and not a per-push gate.

**The method.**

- The replay is the JS model over the FAST tier: every tape of at most 600 ticks, which is 102 tapes today. The full tier is below.
- Each run is a child process that installs its override before importing the model. It runs every tape through `runTapeToStream` with the real level geometry.
- A CONTROL runs first, twice, with no override. It must be stable, throw nothing, and differ from the committed expectations only where `tapeRunner.test.js` declares it (`r5-l60-kill`).
- Per key, two magnitudes are tried:
  - `ulp`: the next double above the default;
  - `pct10`: the default × 1.1, or +1 for an integer default.
- A tape MOVES when its stream md5 differs from the control's, or when the run throws.
- A key is `corpus-blind` only when neither magnitude moves any tape.

`seedlingProfileWitness.test.js` checks that the record still names exactly `PROFILE`'s keys. A new key without a row is red with "run the witness". The test never re-measures.

**The measurement** (at `bbdbe7d`, 4 jobs, 328 s): 58 keys move and 69 are corpus-blind.

| class | moves | corpus-blind |
|---|---|---|
| physics | 28 | 19 |
| rule | 30 | 50 |

Of the 58 that move:

- 42 move an observation stream, 22 of them at +1 ULP.
- 16 move ONLY by making the model throw. For these, a guard refuses the perturbed value (a non-integer direction, frame count or tag), or a sentinel change sends the run into a state its tape does not declare. The keys are `tagsPerLevel`, `coverAlphaRate`, `treeGrowFrameRate`, `treeGrowFrames`, `lavaState`, `initialDirection`, `directionRight`/`Up`/`Left`/`Down`, `right`/`up`/`left`/`down`, `loadDeadFrames` and `coercedTerrainState`.

Such a key is witnessed as READ, not as a value a replay checks.

**The corpus-blind keys:**

- physics: `headPosX`, `fpMaxElapsed`, `fpElapsed`, `velocityEpsilon`, `rockScaleBase`, `rockScaleSpan`, `fireForce`, `stairSpeed`, `slidingSpeed`, `slidingFriction`, `level0WorldWidth`, `level0WorldHeight`, `descentMaxFall`, `slashReach`, `spearLength`, `spearThick`, `pushableFriction`, `bothRange`, `wandSpeed`.
- rule: `waitAfterPressTicks`, `bridgeTimerMax`, `bridgeState`, `onScreenRadius`, `ticksFromPressToWalkable`, `screenW`, `screenH`, `cameraSpeedDivisor`, `inventoryWidth`, `inventoryOffsetX`, `enemyPitTile`, `enemyIframes`, `killLockTset`, `swordAnimRate`, `swordAnimRateDash`, `specialTimerMax`, `pickupLineLength`, `initialFramesThisCharacter`, `npcLineLengthDefault`, `talkRange`, `rockFrequency`, `grenadeFrequency`, `rockStepsAhead`, `rockRadius`, `deathRocks`, `enemyCoinsBase`, `enemyCoinsSpan`, `fireHitFrameEnd`, `fireDamage`, `gameFps`, `iceState`, `drownTimerMax`, `noBounceStates1`, `noBounceStates2`, `darkSwordDamage`, `spearDamage`, `enemyHitsMax`, `enemyHitsTimer`, `slashHitTicks`, `lightpoleHitsTimerMax`, `alphaFade`, `xorMask`, `bootSeed`, `hashC1`, `hashC2`, `hashC3`, `randomDivisor`, `stateMax`, `ceremonyFreezeFrames`, `levelCount`.

The mechanisms below are INFERRED from each key's module and the fast tier's tape names. They are not measured per key, and they follow RWK's three:

- **No fixture carries the body.** The final boss (`rock*`, `grenadeFrequency`, `deathRocks`, `enemyCoins*`), the totem head, the spear and dark sword, the fire pushable, lightpoles, bridges, ice and stairs.
- **The stream cannot see it.** The stream carries the player's `x`, `y` and level only. That rules out the camera and screen bounds, dialogue layout and timing, enemy hit points and invulnerability, and sword animation rates, except where they change the player's path.
- **The path is never taken.** The frame-time clamps (the model's step is below them), the friction dead zone, level 0's edge clamp, the maximum fall speed, the drown timer, the water and lava no-bounce states, and the RNG constants (no fast tape consumes a draw that the stream shows).

**What a blind key means for a tape-based gate.** A wrong value in a blind key passes every fast-tier replay. Of the 69 blind keys, 34 carry an AS3 anchor. For those keys, the anchor row in `seedlingProfile.test.js` is the only thing that holds the value.

**The full tier.** `--tier=full` measures every committed tape and records into a sibling file, `scripts/procgen/seedling-profile-witnesses-full.json`, so the fast record and its rows above are unchanged. The control's declared divergers are `tapeRunner.test.js`'s whole `EXPECTED_TO_DIVERGE`: `r5-l60-kill` plus the three `r5-bobboss-*` tapes. The guard requires the full file to name every key as well, and `--check` checks both files.

The measurement was taken at `e83441d` with a clean tree, 154 tapes, 4 jobs and 1651 s. **70 keys move and 57 are corpus-blind.**

| class | moves | corpus-blind |
|---|---|---|
| physics | 32 | 15 |
| rule | 38 | 42 |

No key that moves on the fast tier is blind on the full one. The campaign tapes woke 12 fast-blind keys:

| keys | what they move | tapes |
|---|---|---|
| `stairSpeed` | streams at +1 ULP (10 tapes); at ×1.1, 3 move and 7 throw | the r2–r4 spear, dark-shield, health and full walks, and `r5-feather` |
| `slidingSpeed` | a stream at +1 ULP; a throw at ×1.1 | `r5-d5-conch` |
| `slidingFriction`, `iceState` | throws only | `r5-d5-conch` |
| `bridgeState` | throws only: the changed sentinel leaves a Bridge tile unmodelled | 8 tapes: the r2–r4 spear, approach, health and full walks |
| `screenH`, `cameraSpeedDivisor` | streams at ×1.1 | `r5-l40-part5` and its control |
| `fpElapsed` | throws at ×1.1 | `r5-l40-part5` and its control |
| `xorMask`, `hashC3` | streams at ×1.1 | `r6-owl-kill` and `r6-owl-control` |
| `hashC2`, `rockFrequency` | throws at ×1.1, both the same one (the player inside a pod's cell at tick 696) | `r6-owl-kill` and `r6-owl-control` |

For the camera, clamp and RNG keys, "no fast tape takes the path" was right. For the ice and stairs keys, "no fixture carries the body" was right. `rockFrequency` wakes in the owl fight, not the final boss. It throws exactly where `hashC2` does, so the inference is that it changes the RNG draws there. That is inferred, not measured. The other eight final-boss keys stay blind, and so do all of these:

- the spear and dark-sword keys;
- the bridge timers;
- the fire pushable;
- the wand and fire keys;
- enemy hit points and invulnerability;
- dialogue;
- the rest of the camera and the RNG.

57 keys are blind on every committed tape.

## The entity records

The profile holds the simulation's flat scalars. The per-entity tables (`ENEMY_CLASSES`, `PUZZLEMENT_HAZARDS`, `CHASERS`, `SPINNER`, `CRUSHER`, `ARROW_TRAP`, `FALL_ROCK`, `PULSER`, `ICE_TURRET`, `ENEMY_DAMAGE_DEFAULTS` and their companions) stay in their declaring modules and get the profile's machinery through `frontend/modules/seedlingDemo/entityRecords.js` (behaviour-parameters P1).

**What a record is.** A declaring module wraps its table where it declares it: `export const CHASERS = defineRecord('chasers', {…}, { doc: ['src'], src: 'chasers.js' })`. `defineRecord` returns THE SAME OBJECT it was given, deep-frozen, so every reader keeps its object; the wrapper is a declaration, and no value or arithmetic moves. A record is not flat: a leaf may be a finite number, a boolean, a string or `null`, inside arrays and plain objects. A function, `undefined`, `NaN`, `±Infinity`, any other object, a cycle, a key holding `.`, `[` or `]`, a record name registered twice and a stale `doc` name are all refused by name with the dotted path (`EntityRecordError`). `ENTITY_RECORD_MODULES` lists the declaring modules, and `entityRecords.test.js` holds that list to the files that call `defineRecord`.

**Doc and content.** A key named in `doc` (at any depth: `src` covers `ctor.src`) holds PROSE — an AS3 anchor, a why, a threat description — and must hold a string. Prose is left out of the dump, the md5 and the witness, so rewording it moves nothing. Every other string is CONTENT: a game id (`type: 'Solid'`, `as3`), a rule the model keys on (`hitables`, `aggro.kind`, `timing`), and it is part of the identity.

**The dump and the md5.** A path is the record's name, then `.key` per object step and `[i]` per array step: `enemyClasses.bob.aggro.range`, `spinner.solids[0]`, `crusherDirections[2].dx`. `entitiesDump()` prints one `"<path>": <JSON leaf>` line per non-doc leaf (an empty array or object is one leaf), for every registered record IN NAME ORDER — never registration order, which is import order — inside braces with a final newline, so it is JSON. `entitiesMd5()` is its md5 and the records' identity; `entityRecords.test.js` pins it as a literal, and a change there is an entity-record change. `entitiesStamp()` is `{md5, records}`, and `runTape`'s RESULT carries it as `entities`, beside `profile`. The stream, every emitted tape and the envelope keep their shape: a tape's `profile` is exactly `{id, md5}` (`tapeEnvelope.validateProfile`), so a second identity is not a tape field.

**Overrides.** `globalThis.__SEEDLING_ENTITY_RECORDS__`, read ONCE when `entityRecords.js` evaluates: a FLAT object keyed by path (`{"spinner.moveSpeed": 1.1}`), or its JSON text. A value is a finite number, a boolean or a string.

- **Refused at load, by name:** a duplicate key in the text, a nested value, a non-finite number, any other type, a key that is not a path.
- **Refused when the record registers, by name:** an unknown path, a doc key, a type change (a string into a number leaf …).
- **Applied at registration, before the freeze.** The object returned is the same object, written in place, except along a path through a node that was already frozen, which is copied rather than written.
- **Unused, not refused (⚖).** A path whose record never registers is reported by `entitiesAnnouncements()` as `unused`. Registration is import order, and a page or a test need not import every declaring module; a refusal there would make an override's validity depend on what else the process loaded. `entitiesUnused()` lets a runner insist.
- **Node.** `scripts/procgen/seedlingProfileLoader.mjs`'s `installEntityRecordsFromEnv()` reads `--entities=<path>` or `SEEDLING_ENTITY_RECORDS`, installs the text, imports every `ENTITY_RECORD_MODULES` module so a wrong path is refused with the FILE named, and refuses an unused path. As with the profile, it must run before the first import of the model. Run as a command, the loader prints both sets of announcements.

**The witness.** `scripts/procgen/witness-seedling-entities.mjs` is the profile witness's sibling and reuses its harness (`runChild`, `pool`, `tierTapes`, `checkWitness`): the same FAST tier, the same control, the same `ulp` and `pct10`, over every NON-doc NUMBER leaf of every registered record, into `scripts/procgen/seedling-entity-witnesses.json`. Its summary counts per record. Strings, booleans and nulls are content too, but have no ULP, so they are outside it by construction. `seedlingEntityWitness.test.js` checks that the record names exactly today's number leaves and today's `entitiesMd5()`; it never re-measures.

**The measurement** (at `163a45e`, clean tree, the fast tier's 102 tapes, 4 jobs, 1304 s): **51 leaves move and 401 are corpus-blind.**

| record | moves | corpus-blind |
|---|---|---|
| `arrow` | 1 | 7 |
| `arrowEnemyHit` | 0 | 7 |
| `arrowKillPlan` | 0 | 10 |
| `arrowTrap` | 3 | 10 |
| `blastDamage` | 0 | 4 |
| `blastPlan` | 0 | 4 |
| `chasers` | 2 | 6 |
| `crusher` | 0 | 11 |
| `crusherDirections` | 0 | 8 |
| `enemyClasses` | 20 | 220 |
| `enemyDamageDefaults` | 2 | 5 |
| `enemyTerrainDestroys` | 0 | 2 |
| `fallRock` | 3 | 8 |
| `hammerBilling` | 1 | 3 |
| `iceTurret` | 0 | 31 |
| `iceTurretBlast` | 0 | 9 |
| `playerDamagePaths` | 0 | 4 |
| `playerSnap` | 0 | 2 |
| `pulser` | 0 | 19 |
| `puzzlementHazards` | 7 | 20 |
| `spinner` | 12 | 9 |
| `spinnerCtorRng` | 0 | 2 |

- 3 leaves move a stream at +1 ULP: `fallRock.cameraTimerMax`, `fallRock.waitToFallTimerMax`, `spinner.hitsMax`. `spinner.moveSpeed` is not one of them: 1 ULP is absorbed, and ×1.1 moves five tapes (`r5-press-glide`, `r5-press-repeat`, `r8-hammer-control`, `r8-solve-18`, `r9-solve-18`).
- 17 move ONLY by making the model throw — 14 of them `ctor` offsets (inferred: a non-integer or shifted spawn offset lands a body where a guard refuses it). These leaves are witnessed as READ, not as values a replay checks: `arrowTrap.shootTimerMax`, `chasers.bob.dieAnim.frames`, `enemyClasses.bombpusher.ctor.dx`, `enemyClasses.bombpusher.ctor.dy`, `enemyClasses.bosstotem.ctor.dx`, `enemyClasses.bosstotem.ctor.dy`, `enemyClasses.iceturret.ctor.dx`, `enemyClasses.iceturret.ctor.dy`, `enemyClasses.sandtrap.speed`, `enemyClasses.shieldboss.ctor.dx`, `enemyClasses.shieldboss.ctor.dy`, `puzzlementHazards.lavachain.ctor.dx`, `puzzlementHazards.lavachain.ctor.dy`, `puzzlementHazards.pulser.ctor.dx`, `puzzlementHazards.pulser.ctor.dy`, `puzzlementHazards.spinningaxe.ctor.dx`, `puzzlementHazards.spinningaxe.ctor.dy`.
- Every `iceTurret`, `iceTurretBlast`, `pulser`, `crusher`, `blast*` and `playerDamagePaths` number is blind: no fast-tier tape meets those bodies. Most of `enemyClasses` is blind for the same reason and — inferred, not measured per leaf — because its pricing and envelope fields (`threatPad`, `aggro.range` of a class no fast tape wakes) are read by the solver, not the replay.
- ⛔ **Two records never share a node** (⚖ Q13, 2026-09-30). `defineRecord` refuses an object or array another record already holds, naming both paths, because a shared node was overridden asymmetrically: `ARROW_TRAP.ctor` used to BE `PUZZLEMENT_HAZARDS.arrowtrap.ctor`, so an override through the first-registered path wrote both records while the other path reached only a copy. `ARROW_TRAP.ctor` is now its own value-identical literal, held equal to the combat row by `entityRecords.agreement.test.js`. The witness did not move: `puzzlementHazards.arrowtrap.ctor.dy` still moves one tape (`r8-solve-5`) because `levelWorld.js` reads the combat row directly for the entity point, and both `arrowTrap.ctor` leaves stay corpus-blind (re-measured on the four leaves, 2026-09-30). A caller that means "the arrow trap's offset" must still know which record the code it cares about reads.

**The tile types by name (⚖ Q11).** `flashPanel/seedlingSemantics.js`'s `TILE_TYPE_IDS` is the one name ↔ int table for Seedling's tile types (`ground: 0`, `water: 1`, … `pit: 6`, `cave: 13`, `lava: 17`, … `rockWallFloor: 37`). The int is the `t` a Tile is constructed with; the name is `TILE_TYPE_NAMES`' entry at that index, from the comment block at `Scenery/Tile.as:32-69`, in camelCase. `seedlingSemantics.test.js` holds the two tables together; holds the profile's `*State` keys to their names (`lavaState === TILE_TYPE_IDS.lava` …; the profile keys stay, because the witness names them); and holds every tile-keyed table (`TILE_TYPE_SEMANTICS`, `MODELLED_TILE_TYPES`, `HAZARD_STATES`, `DESTROYING_TILE_TYPES`, `ENEMY_TERRAIN_DESTROYS`, `ICE_TURRET.fatalTiles`, `SPINNER.terrain`, `FINAL_BOSS.lavaT`) to a named id. The records that held a bare tile id read the name (`ENEMY_TERRAIN_DESTROYS`, `ICE_TURRET.fatalTiles`, `SPINNER.terrain`'s keys, `ENEMY_CLASSES.bulb.navMeshEdit.becomes`), and `ENEMY_DAMAGE_DEFAULTS.maxForce` reads `NO_FORCE_CAP`. The inline sentinels inside the simulation's functions are the simulation and stay literals.

**How a new table joins.**

1. Wrap its declaration in `defineRecord('<name>', {…}, { doc: [<prose keys>], src: '<file>' })` — same literal, same export name — and import `defineRecord` from `./entityRecords.js`. Name its prose keys in `doc`; every other string is content.
2. Add its module to `ENTITY_RECORD_MODULES` if it is new there.
3. Update the md5 pin in `entityRecords.test.js`, and say in the commit that it is an entity-record change.
4. Run the witness (`node scripts/procgen/witness-seedling-entities.mjs --write --jobs=4`) and commit its JSON.
5. Run `node scripts/procgen/census-seedling-constants.mjs --write` (the import line moves the census's line column) and `--check`.

## The census

The region below is rendered by `--write`; do not edit it by hand.

<!-- CENSUS:seedling-constants BEGIN — by scripts/procgen/census-seedling-constants.mjs --write; do not edit; regenerate -->

**58 files, 4977 literals.** Class × position:

| class | scalar | table | inline | total |
|---|---|---|---|---|
| physics | 5 | 1283 | 351 | 1639 |
| rule | 6 | 937 | 447 | 1390 |
| cosmetic | 0 | 49 | 14 | 63 |
| structural | 10 | 312 | 1563 | 1885 |
| unclassified | 0 | 0 | 0 | 0 |
| total | 21 | 2581 | 2375 | 4977 |

Class × kind (physics and rule rows only):

| class | magnitude | count | bound | sign | sentinel | derivation | total |
|---|---|---|---|---|---|---|---|
| physics | 1376 | 0 | 90 | 118 | 4 | 51 | 1639 |
| rule | 411 | 123 | 218 | 22 | 529 | 87 | 1390 |

Rows whose note starts `REVIEW:`: **103**.

### The 0 names declared in more than one file

None: a name declared in several files now reads one profile key (the table below).

### The profile: 138 keys in `seedlingDemo/seedlingProfile.js`

**51 physics**, **87 rule**; 72 with an AS3 anchor. 135 top-level names alias a key, and 154 top-level declarations read one. "Read by" is every such declaration.

| key | value | class | kind | AS3 | read by |
|---|---|---|---|---|---|
| `seedlingTileSize` | 16 | physics | magnitude | Scenery/Tile.as:w | flashPanel/seedlingSemantics.js `SEEDLING_TILE_SIZE` |
| `headPosX` | 0 | physics | magnitude |  | bossTotemFight.js `HEAD_POS_X` |
| `tagsPerLevel` | 30 | rule | count | Game.as:tagsPerLevel | breakableRocks.js `TAGS_PER_LEVEL` |
| `fpMaxElapsed` | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED | breakableRocks.js `FP_MAX_ELAPSED`; pulser.js `FP_MAX_ELAPSED` |
| `waitAfterPressTicks` | 20 | rule | magnitude |  | breakableRocks.js `WAIT_AFTER_PRESS_TICKS` |
| `bridgeTimerMax` | 60 | rule | magnitude | Scenery/Tile.as:bridgeOpeningTimerMax | bridges.js `BRIDGE_TIMER_MAX` |
| `bridgeState` | 29 | rule | sentinel |  | levelWorld.js `BRIDGE_STATE`; bridges.js `BRIDGE_STATE` |
| `onScreenRadius` | 64 | rule | bound |  | bridges.js `ON_SCREEN_RADIUS` |
| `ticksFromPressToWalkable` | 60 | rule | magnitude |  | bridges.js `TICKS_FROM_PRESS_TO_WALKABLE` |
| `screenW` | 160 | rule | bound |  | camera.js `SCREEN_W` |
| `screenH` | 160 | rule | bound |  | camera.js `SCREEN_H` |
| `cameraSpeedDivisor` | 10 | rule | magnitude | Game.as:cameraSpeedDivisorDef | camera.js `CAMERA_SPEED_DIVISOR` |
| `inventoryWidth` | 66 | rule | magnitude |  | camera.js `INVENTORY_WIDTH` |
| `inventoryOffsetX` | -70 | rule | magnitude |  | camera.js `INVENTORY_OFFSET_X` |
| `fpElapsed` | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED | chasers.js `FP_ELAPSED` |
| `friction` | 0.25 | physics | magnitude | Mobile.as:DEFAULT_FRICTION | chasers.js `FRICTION` |
| `velocityEpsilon` | 0.05 | physics | bound |  | chasers.js `VELOCITY_EPSILON` |
| `enemyPitTile` | 6 | rule | sentinel |  | chasers.js `ENEMY_PIT_TILE` |
| `puncherDieAnimFrames` | 10 | rule | count |  | chasers.js `PUNCHER_DIE_ANIM` |
| `puncherDieAnimRate` | 10 | rule | magnitude | Enemies/Puncher.as:add | chasers.js `PUNCHER_DIE_ANIM` |
| `puncherAttackAnimFrames` | 4 | rule | count |  | chasers.js `PUNCHER_ATTACK_ANIM` |
| `puncherAttackAnimRate` | 12 | rule | magnitude | Enemies/Puncher.as:attackAnimSpeed | chasers.js `PUNCHER_ATTACK_ANIM` |
| `puncherPunchForce` | 5 | physics | magnitude | Enemies/Puncher.as:punchForce | chasers.js `PUNCHER_PUNCH_FORCE` |
| `puncherPunchReach` | 8 | physics | magnitude | Enemies/Puncher.as:r | chasers.js `PUNCHER_PUNCH_REACH` |
| `enemyIframes` | 30 | rule | magnitude | Enemies/Enemy.as:hitsTimerMax | combat.js `ENEMY_IFRAMES` |
| `slashTimerMax` | 20 | rule | magnitude | Player.as:slashTimerMax | combat.js `SLASH_TIMER_MAX` |
| `killLockTset` | -1 | rule | sentinel |  | combat.js `KILL_LOCK_TSET` |
| `puncherRunRange` | 80 | physics | bound | Enemies/Puncher.as:runRange | combat.js `PUNCHER_RUN_RANGE` |
| `puncherAttackRange` | 10 | rule | bound | Enemies/Puncher.as:attackRange | combat.js `PUNCHER_ATTACK_RANGE` |
| `swordForce` | 5 | physics | magnitude | Player.as:swordForce | combatVerbs.js `SWORD_FORCE` |
| `slashDashForce` | 2 | physics | magnitude |  | combatVerbs.js `SLASH_DASH_FORCE` |
| `swordAnimRate` | 30 | rule | magnitude | Player.as:swordSpeed | combatVerbs.js `SWORD_ANIM_RATE` |
| `swordAnimRateDash` | 20 | rule | magnitude | Player.as:swordSpeedDash | combatVerbs.js `SWORD_ANIM_RATE_DASH` |
| `specialTimerMax` | 150 | rule | magnitude | Pickups/Pickup.as:specialTimerMax | dialogue.js `SPECIAL_TIMER_MAX` |
| `pickupTextSpeed` | 6 | rule | magnitude | Pickups/Pickup.as:DEF_TEXT_SPEED | dialogue.js `PICKUP_TEXT_SPEED` |
| `pickupLineLength` | 32 | rule | bound |  | dialogue.js `PICKUP_LINE_LENGTH` |
| `initialFramesThisCharacter` | 0 | rule | magnitude | Game.as:framesThisCharacter | dialogue.js `INITIAL_FRAMES_THIS_CHARACTER` |
| `npcLineLengthDefault` | 28 | rule | bound | NPCs/NPC.as:_lineLength | dialogue.js `NPC_LINE_LENGTH_DEFAULT` |
| `talkRange` | 24 | rule | bound | NPCs/NPC.as:talkRange | endingChain.js `TALK_RANGE` |
| `coverAlphaRate` | 0.005 | rule | magnitude | Pickups/Seed.as:coverAlphaRate | endingChain.js `COVER_ALPHA_RATE` |
| `treeGrowFrameRate` | 3.5 | rule | magnitude |  | endingChain.js `TREE_GROW_FRAME_RATE` |
| `treeGrowFrames` | 16 | rule | count |  | endingChain.js `TREE_GROW_FRAMES` |
| `fpElapsedClamped` | 0.0333 | physics | magnitude | net/flashpunk/Engine.as:MAX_ELAPSED | shieldBossFight.js `FP_ELAPSED_CLAMPED`; finalBossFight.js `FP_ELAPSED_CLAMPED`; r6AnimClock.js `FP_ELAPSED_CLAMPED` |
| `rockFrequency` | 6 | rule | magnitude | Enemies/FinalBoss.as:rockFrequency | finalBossRng.js `ROCK_FREQUENCY` |
| `grenadeFrequency` | 40 | rule | magnitude | Enemies/FinalBoss.as:grenadeFrequency | finalBossRng.js `GRENADE_FREQUENCY` |
| `rockStepsAhead` | -15 | rule | magnitude | Enemies/FinalBoss.as:stepsAhead | finalBossRng.js `ROCK_STEPS_AHEAD` |
| `rockRadius` | 20 | rule | bound | Enemies/FinalBoss.as:radius | finalBossRng.js `ROCK_RADIUS` |
| `deathRocks` | 5 | rule | count |  | finalBossRng.js `DEATH_ROCKS` |
| `rockScaleBase` | 0.25 | physics | magnitude |  | finalBossRng.js `ROCK_SCALE_BASE` |
| `rockScaleSpan` | 0.5 | physics | magnitude |  | finalBossRng.js `ROCK_SCALE_SPAN` |
| `enemyCoinsBase` | 4 | rule | magnitude |  | finalBossRng.js `ENEMY_COINS_BASE` |
| `enemyCoinsSpan` | 4 | rule | magnitude |  | finalBossRng.js `ENEMY_COINS_SPAN` |
| `fireHitFrameStart` | 3 | rule | bound | Player.as:fireHitFrameStart | fireVerb.js `FIRE_HIT_FRAME_START` |
| `fireHitFrameEnd` | 6 | rule | bound | Player.as:fireHitFrameEnd | fireVerb.js `FIRE_HIT_FRAME_END` |
| `fireForce` | 0.325 | physics | magnitude | Player.as:fireForce | fireVerb.js `FIRE_FORCE` |
| `fireDamage` | 0 | rule | magnitude | Player.as:fireDamage | fireVerb.js `FIRE_DAMAGE` |
| `gameFps` | 60 | rule | magnitude | Main.as:FPS | gameClock.js `GAME_FPS` |
| `hitboxOriginX` | 2 | physics | magnitude | Player.as:normalHitbox | levelWorld.js `HITBOX_ORIGIN_X`; playerPhysicsV1.js `HITBOX` |
| `hitboxOriginY` | 2 | physics | magnitude | Player.as:normalHitbox | levelWorld.js `HITBOX_ORIGIN_Y`; playerPhysicsV1.js `HITBOX` |
| `waterState` | 1 | rule | sentinel |  | levelWorld.js `WATER_STATE`; playerPhysicsV2.js `WATER_STATE` |
| `lavaState` | 17 | rule | sentinel |  | levelWorld.js `LAVA_STATE`; playerPhysicsV2.js `LAVA_STATE` |
| `waterfallState` | 25 | rule | sentinel |  | levelWorld.js `WATERFALL_STATE`; playerPhysicsV2.js `WATERFALL_STATE` |
| `defaultFriction` | 0.25 | physics | magnitude | Mobile.as:DEFAULT_FRICTION | playerPhysicsV1.js `DEFAULT_FRICTION` |
| `waterFriction` | 0.5 | physics | magnitude | Mobile.as:WATER_FRICTION | playerPhysicsV1.js `WATER_FRICTION` |
| `walkSpeed` | 0.8 | physics | magnitude | Player.as:dMS | playerPhysicsV1.js `WALK_SPEED` |
| `stairSpeed` | 0.4 | physics | magnitude | Player.as:dMSstair | playerPhysicsV1.js `STAIR_SPEED` |
| `waterSpeed` | 0.45 | physics | magnitude | Player.as:dMSwater | playerPhysicsV1.js `WATER_SPEED` |
| `slidingSpeed` | 1 | physics | magnitude | Player.as:slidingSpeed | playerPhysicsV1.js `SLIDING_SPEED`; playerPhysicsV2.js `SLIDING_SPEED` |
| `slidingFriction` | 0.025 | physics | magnitude | Player.as:slidingFriction | playerPhysicsV1.js `SLIDING_FRICTION`; playerPhysicsV2.js `SLIDING_FRICTION` |
| `moveSpeeds25Divisor` | 2 | physics | derivation | Player.as:moveSpeeds | playerPhysicsV1.js `MOVE_SPEEDS` |
| `hitboxWidth` | 4 | physics | magnitude | Player.as:normalHitbox | playerPhysicsV1.js `HITBOX` |
| `hitboxHeight` | 5 | physics | magnitude | Player.as:normalHitbox | playerPhysicsV1.js `HITBOX` |
| `tileW` | 16 | physics | magnitude | Scenery/Tile.as:w | wandShot.js `TILE_W`; playerPhysicsV1.js `TILE` |
| `tileH` | 16 | physics | magnitude | Scenery/Tile.as:h | playerPhysicsV1.js `TILE` |
| `spawnOffsetXDivisor` | 2 | physics | derivation |  | playerPhysicsV1.js `SPAWN_OFFSET` |
| `spawnOffsetYDivisor` | 2 | physics | derivation |  | playerPhysicsV1.js `SPAWN_OFFSET` |
| `level0WorldWidth` | 320 | physics | bound |  | playerPhysicsV1.js `LEVEL0_WORLD` |
| `level0WorldHeight` | 320 | physics | bound |  | playerPhysicsV1.js `LEVEL0_WORLD` |
| `checkOffsetYInset` | 2 | physics | derivation | Player.as:checkOffsetY | playerPhysicsV1.js `CHECK_OFFSET_Y` |
| `initialTerrainState` | 0 | rule | sentinel | Player.as:_state | playerPhysicsV2.js `INITIAL_TERRAIN_STATE` |
| `pitState` | 6 | rule | sentinel |  | playerPhysicsV2.js `PIT_STATE` |
| `iceState` | 22 | rule | sentinel |  | playerPhysicsV2.js `ICE_STATE` |
| `initialDirection` | 3 | rule | sentinel | Player.as:direction | playerPhysicsV2.js `INITIAL_DIRECTION` |
| `directionRight` | 0 | rule | sentinel |  | playerPhysicsV2.js `DIRECTION_RIGHT` |
| `directionUp` | 1 | rule | sentinel |  | playerPhysicsV2.js `DIRECTION_UP` |
| `directionLeft` | 2 | rule | sentinel |  | playerPhysicsV2.js `DIRECTION_LEFT` |
| `directionDown` | 3 | rule | sentinel |  | playerPhysicsV2.js `DIRECTION_DOWN` |
| `waterfallAcceleration` | 0.8 | physics | magnitude | Player.as:waterfallAcceleration | playerPhysicsV2.js `WATERFALL_ACCELERATION` |
| `drownTimerMax` | 10 | rule | magnitude | Player.as:drownTimerMax | playerPhysicsV2.js `DROWN_TIMER_MAX` |
| `fallAlphaSpeed` | 0.05 | rule | magnitude | Player.as:fallAlphaSpeed | playerPhysicsV2.js `FALL_ALPHA_SPEED` |
| `fallAlphaStart` | 1 | rule | magnitude |  | playerPhysicsV2.js `FALL_ALPHA_START` |
| `fallLerpDivisor` | 10 | physics | magnitude |  | playerPhysicsV2.js `FALL_LERP_DIVISOR` |
| `descentDrop` | 83 | physics | magnitude |  | playerPhysicsV2.js `DESCENT_DROP` |
| `descentGravity` | 0.1 | physics | magnitude |  | playerPhysicsV2.js `DESCENT_GRAVITY` |
| `descentMaxFall` | 5 | physics | bound |  | playerPhysicsV2.js `DESCENT_MAX_FALL` |
| `bounceVelocity` | -2 | physics | magnitude |  | playerPhysicsV2.js `BOUNCE_VELOCITY` |
| `noBounceStates0` | 6 | rule | sentinel |  | playerPhysicsV2.js `NO_BOUNCE_STATES` |
| `noBounceStates1` | 1 | rule | sentinel |  | playerPhysicsV2.js `NO_BOUNCE_STATES` |
| `noBounceStates2` | 17 | rule | sentinel |  | playerPhysicsV2.js `NO_BOUNCE_STATES` |
| `darkShieldDamage` | 0.5 | rule | magnitude | Player.as:darkShieldDamage | bobBossFight.js `DARK_SHIELD_DAMAGE` |
| `darkSuitForce` | 1 | physics | magnitude | Player.as:darkSuitForce | playerDamage.js `DARK_SUIT_FORCE` |
| `darkSuitDamage` | 1 | rule | magnitude | Player.as:darkSuitDamage | playerDamage.js `DARK_SUIT_DAMAGE` |
| `swordDamage` | 1 | rule | magnitude | Player.as:swordDamage | presses.js `SWORD_DAMAGE` |
| `darkSwordDamage` | 2 | rule | magnitude | Player.as:darkSwordDamage | presses.js `DARK_SWORD_DAMAGE` |
| `spearDamage` | 2 | rule | magnitude | Player.as:spearDamage | presses.js `SPEAR_DAMAGE` |
| `slashReach` | 16 | physics | bound |  | presses.js `SLASH_REACH` |
| `spearLength` | 32 | physics | magnitude | Player.as:length | presses.js `SPEAR_LENGTH` |
| `spearThick` | 5 | physics | magnitude | Player.as:thick | presses.js `SPEAR_THICK` |
| `enemyHitsMax` | 3 | rule | count | Enemies/Enemy.as:hitsMax | presses.js `ENEMY_HITS_MAX` |
| `enemyHitsTimer` | 30 | rule | magnitude | Enemies/Enemy.as:hitsTimerMax | presses.js `ENEMY_HITS_TIMER` |
| `slashHitTicks` | 5 | rule | count |  | presses.js `SLASH_HIT_TICKS` |
| `lightpoleHitsTimerMax` | 25 | rule | magnitude | Scenery/LightPole.as:hitsTimerMax | presses.js `LIGHTPOLE_HITS_TIMER_MAX` |
| `right` | 0 | rule | sentinel |  | pushables.js `RIGHT`; presses.js `RIGHT` |
| `up` | 1 | rule | sentinel |  | pushables.js `UP`; presses.js `UP` |
| `left` | 2 | rule | sentinel |  | pushables.js `LEFT`; presses.js `LEFT` |
| `down` | 3 | rule | sentinel |  | pushables.js `DOWN`; presses.js `DOWN` |
| `tile` | 16 | physics | magnitude | Scenery/Tile.as:w | pushables.js `TILE` |
| `pushableSpeed` | 0.5 | physics | magnitude | Puzzlements/PushableBlockFire.as:moveSpeed | pushables.js `PUSHABLE_SPEED` |
| `pushableFriction` | 0.25 | physics | magnitude | Mobile.as:DEFAULT_FRICTION | pushables.js `PUSHABLE_FRICTION` |
| `alphaFade` | 0.1 | rule | magnitude |  | pushables.js `ALPHA_FADE` |
| `bothRange` | 0.1 | physics | bound | Puzzlements/PushableBlockFire.as:bothRange | pushables.js `BOTH_RANGE` |
| `bootPreswapFrames` | 1 | rule | magnitude |  | r7Acceptance.js `BOOT_PRESWAP_FRAMES` |
| `xorMask` | 0x48000000 | rule | magnitude |  | rng.js `XOR_MASK` |
| `bootSeed` | 1486967168 | rule | magnitude |  | rng.js `BOOT_SEED` |
| `hashC1` | 1376312589 | rule | magnitude |  | rng.js `HASH_C1` |
| `hashC2` | 789221 | rule | magnitude |  | rng.js `HASH_C2` |
| `hashC3` | 15731 | rule | magnitude |  | rng.js `HASH_C3` |
| `randomDivisor` | 2147483648 | rule | magnitude |  | rng.js `RANDOM_DIVISOR` |
| `stateMax` | 2147483647 | rule | bound |  | rng.js `STATE_MAX` |
| `swimLengthFrames` | 47 | rule | magnitude |  | swimSoundClock.js `SWIM_LENGTH_FRAMES` |
| `swimBoostBelowSeconds` | 0.1 | physics | bound |  | swimSoundClock.js `SWIM_BOOST_BELOW_SECONDS` |
| `swimBoostSpeed` | 0.25 | physics | magnitude |  | swimSoundClock.js `SWIM_BOOST_SPEED` |
| `loadDeadFrames` | 20 | rule | magnitude |  | swimSoundClock.js `LOAD_DEAD_FRAMES` |
| `ceremonyFreezeFrames` | 150 | rule | magnitude | Pickups/Pickup.as:specialTimerMax | swimSoundClock.js `CEREMONY_FREEZE_FRAMES` |
| `pinFrameRate` | 60 | rule | magnitude | Main.as:FPS | tapeFormat.js `PIN_FRAME_RATE` |
| `coercedTerrainState` | 0 | rule | sentinel |  | tapeFormat.js `COERCED_TERRAIN_STATE` |
| `levelCount` | 116 | rule | count |  | tapeFormat.js `LEVEL_COUNT` |
| `wandSpeed` | 3 | physics | magnitude | Player.as:wandSpeed | wandVerb.js `WAND_SPEED` |

### The 36 derived or aliased top-level constants

| name | file | initialiser |
|---|---|---|
| `PIT_STATE` | seedlingDemo/levelWorld.js | `HAZARD_STATES.pit` |
| `TILE_SIZE` | seedlingDemo/levelWorld.js | `SEEDLING_TILE_SIZE` |
| `NPC_LINE_LENGTH` | seedlingDemo/endingChain.js | `NPC_LINE_LENGTH_DEFAULT` |
| `BLOODY_SEED_TEXT` | seedlingDemo/endingChain.js | `'The seed, covered in the blood of the Watcher, seems ' + 'almost to cower fr...` |
| `BEAM_TIME_MAX` | seedlingDemo/moonrock.js | `MOONROCK.fps * MOONROCK.beamSeconds` |
| `TICKS_PER_TILE` | seedlingDemo/pushables.js | `TILE / PUSHABLE_SPEED` |
| `SLASH_REACH_DASH` | seedlingDemo/presses.js | `SLASH_REACH * SLASH_SCALE_DASH.x` |
| `FIRE_PRESS_CADENCE` | seedlingDemo/fireVerb.js | `FIRE_WINDOW.endTick + 1` |
| `FIRE_RADIUS` | seedlingDemo/fireVerb.js | `FIRE_SPRITE.w / 2` |
| `WAIT_AFTER_PRESS_TICKS` | seedlingDemo/burnableTree.js | `HIT_TO_GONE_TICKS + 12` |
| `TILE` | seedlingDemo/spinner.js | `TILE_SIZE` |
| `TILE` | seedlingDemo/crusher.js | `TILE_SIZE` |
| `SHIELD_BOSS_DIE_UPDATES` | seedlingDemo/shieldBossFight.js | `SHIELD_BOSS_ANIM_UPDATES.die` |
| `SHIELD_BOSS_WINDOW_UPDATES` | seedlingDemo/shieldBossFight.js | `SHIELD_BOSS_ANIM_UPDATES.movedShield` |
| `FORM_TELEPORT_AT` | seedlingDemo/bobBoss.js | `FORM_TRANSITION_FRAMES / 3` |
| `BASE_SPIN_RATE` | seedlingDemo/bobBossFight.js | `Math.PI / 10` |
| `TRANSITION_PIN` | seedlingDemo/bobBossFight.js | `ARENA.transitionTo` |
| `BOB_BOSS_ROCK_DEAD_FRAMES` | seedlingDemo/bobBossFight.js | `rockSchedule().bossSpawnsAt` |
| `OWL_LEVEL_BUILD_DRAWS` | seedlingDemo/finalBossRng.js | `OWL_LEVEL_BUILD_SITES.length` |
| `TILE` | seedlingDemo/iceTurret.js | `TILE_SIZE` |
| `WAND_SPAWN_REACH` | seedlingDemo/wandVerb.js | `WAND_SPRITE.w` |
| `WAND_PRESS_CADENCE` | seedlingDemo/wandVerb.js | `WAND_WINDOW.endTick + 1` |
| `MAGICAL_LOCK_CALLBACK_TICK_OFFSET` | seedlingDemo/magicalLock.js | `MAGICAL_LOCK_DESTROY_UPDATES - 1` |
| `MAGICAL_LOCK_OPEN_TICK_OFFSET` | seedlingDemo/magicalLock.js | `MAGICAL_LOCK_DESTROY_UPDATES` |
| `INVENTORY_TERM` | seedlingDemo/camera.js | `INVENTORY_WIDTH / 2 + INVENTORY_OFFSET_X / 2` |
| `KILL_CADENCE_FLOOR` | seedlingDemo/combat.js | `SLASH_TIMER_MAX + 1` |
| `MAX_HALF_WIDTH` | seedlingDemo/deadFrameBand.js | `CEREMONY_DEAD_FRAMES.pickup / 2` |
| `TILE` | seedlingDemo/wallFlyer.js | `TILE_SIZE` |
| `KILL_PRESS_CADENCE` | seedlingDemo/combatVerbs.js | `ENEMY_IFRAMES + 1` |
| `DASH_CHAIN_MAX` | seedlingDemo/combatVerbs.js | `DASH_CHAIN.max` |
| `ORDINARY_SWING_PERIOD` | seedlingDemo/combatVerbs.js | `SLASH_TIMER_MAX` |
| `PULL_W` | seedlingDemo/pull.js | `TILE_SIZE` |
| `PULL_H` | seedlingDemo/pull.js | `TILE_SIZE` |
| `CHECK_OFFSET_Y` | seedlingDemo/playerPhysicsV1.js | `-HITBOX.originY + HITBOX.height - PROFILE.checkOffsetYInset` |
| `DAY_LENGTH_FRAMES` | seedlingDemo/gameClock.js | `160 * GAME_FPS` |
| `PAGE_BOOT_TIME` | seedlingDemo/gameClock.js | `DAY_LENGTH_FRAMES / 2` |

### The profile candidates outside the profile

**11 named scalars** are `physics` or `rule` (11 with an AS3 anchor), and **138 small tables** (at most 16 literals) hold at least one (86 with an AS3 reference).

| name | file | value | class | kind | AS3 |
|---|---|---|---|---|---|
| `BOSS_IFRAMES` | seedlingDemo/bobBoss.js | 30 | rule | bound | Enemies/Enemy.as:hitsTimerMax |
| `FORM_TRANSITION_FRAMES` | seedlingDemo/bobBoss.js | 120 | rule | bound | Enemies/BobBoss.as:nextBossTimerMax |
| `FORMING_FRAMES` | seedlingDemo/bobBoss.js | 60 | rule | bound | Enemies/BobBoss.as:formingTimerMax |
| `BOSS_TEXT_SPEED` | seedlingDemo/bobBoss.js | 6 | rule | magnitude | NPCs/BobBossNPC.as:_talkingSpeed |
| `BOSS_LINE_LENGTH` | seedlingDemo/bobBoss.js | 28 | rule | magnitude | NPCs/NPC.as:lineLength |
| `PLAIN_SWORD_DAMAGE` | seedlingDemo/bobBoss.js | 1 | rule | magnitude | Player.as:swordDamage |
| `RUN_RANGE` | seedlingDemo/bobBossFight.js | 80 | physics | bound | Enemies/BobSoldier.as:runRange |
| `WEAPON_LENGTH` | seedlingDemo/bobBossFight.js | 24 | physics | magnitude | Enemies/BobBoss.as:weaponLength |
| `DEATH_LIFT` | seedlingDemo/bobBossFight.js | 1.2 | physics | magnitude | Enemies/BobBoss.as:death |
| `SHIELD_FORCE` | seedlingDemo/bobBossFight.js | 5 | physics | magnitude | Player.as:shieldForce |
| `NO_FORCE_CAP` | seedlingDemo/enemyDamage.js | -1 | physics | sentinel | Enemies/Enemy.as:maxForce |

| table | file | literals | physics/rule | classes | kinds | AS3 |
|---|---|---|---|---|---|---|
| `MAGICAL_LOCK_TYPE_BY_TAG` | seedlingDemo/levelWorld.js | 2 | 2 | rule | sentinel | Game.as:2148-2149 |
| `UNMODELLED_REASON` | seedlingDemo/levelWorld.js | 1 | 1 | rule | sentinel |  |
| `LIGHTPOLE_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude |  |
| `WATCHER_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude | Player.as:1112-1115 Watcher.as:49 NPC.as:47 |
| `SPINNER_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude |  |
| `FINAL_BOSS_PRESS_BOX` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude | FinalBoss.as:52 |
| `FORCED_TSET` | seedlingDemo/levelWorld.js | 3 | 3 | rule | sentinel | Puzzlements/ShieldLock.as:26 Game.as:2144-2145 BossLock.as:31 Game.as:2199 |
| `FORCED_TAG` | seedlingDemo/levelWorld.js | 5 | 5 | rule | sentinel | Scenery/MoonrockPile.as:23 NPCs/Statue.as:20 Stairs.as:20 |
| `UNTOUCHABLE_CLEARS` | seedlingDemo/levelWorld.js | 2 | 2 | rule | sentinel | FinalDoor.as:50 |
| `CLIFFSIDE_CLASS` | seedlingDemo/levelWorld.js | 6 | 6 | physics | magnitude | Game.as:2009-2015 |
| `PICKUP_CEREMONY_BY_KEYTYPE` | seedlingDemo/dialogue.js | 1 | 1 | rule | sentinel |  |
| `PLACED_NPC_TALK` | seedlingDemo/dialogue.js | 2 | 2 | rule | bound | NPCs/NPC.as Player.as:59 NPC.as:205 NPCs/Watcher.as:46 NPC.as:41 NPC.as:46 NPCs/Statue.as:20 Game.as:2265-2282 |
| `WATCHER` | seedlingDemo/endingChain.js | 10 | 10 | physics/rule | bound/count/magnitude | NPCs/Watcher.as:hitsTimerMax |
| `WATCHER_FLAG` | seedlingDemo/endingChain.js | 2 | 2 | rule | sentinel | Scenery/FinalDoor.as FinalDoor.as:50 |
| `FINAL_DOOR` | seedlingDemo/endingChain.js | 9 | 9 | physics/rule | bound/count/magnitude |  |
| `SEED_ARMS` | seedlingDemo/endingChain.js | 3 | 3 | rule | magnitude/sentinel | Game.as:2194 |
| `SEED_CEREMONY_FRAMES` | seedlingDemo/endingChain.js | 2 | 2 | rule | count/magnitude | Game.as:956 |
| `SEED_BOX` | seedlingDemo/endingChain.js | 4 | 4 | physics | magnitude | Pickups/Seed.as:36 |
| `CUTSCENE_1_WALK` | seedlingDemo/endingChain.js | 2 | 2 | physics | bound/magnitude | Game.as:955-960 |
| `ORACLE` | seedlingDemo/endingChain.js | 2 | 2 | physics | magnitude | NPCs/Oracle.as:94-121 |
| `CREDITS` | seedlingDemo/endingChain.js | 2 | 2 | rule | sentinel |  |
| `RESPONDERS` | seedlingDemo/activators.js | 6 | 6 | rule | magnitude | RockLock.as:40-47 |
| `WEST_PROBE` | seedlingDemo/activators.js | 2 | 2 | physics | sign | Puzzlements/ShieldLock.as:30-41 ShieldLock.as:26 Puzzlements/ShieldLock.as:32 |
| `KEY_RESPONDERS` | seedlingDemo/activators.js | 2 | 2 | rule | magnitude | Puzzlements/BossLock.as:59-88 |
| `FALL_RESPONDER_ROOMS` | seedlingDemo/activators.js | 6 | 6 | rule | sentinel |  |
| `FALL_ROCK` | seedlingDemo/fallRock.js | 11 | 11 | physics/rule | magnitude | Scenery/FallRock.as:fallRate Scenery/FallRock.as:waitToFallTimerMax Scenery/FallRock.as:cameraTimerMax |
| `PLAYER_SNAP` | seedlingDemo/fallRock.js | 2 | 2 | physics | magnitude | Player.as:295 |
| `MOONROCK` | seedlingDemo/moonrock.js | 11 | 11 | physics/rule | magnitude/sentinel | Main.as:FPS Scenery/Moonrock.as:fallRate Scenery/Moonrock.as:cameraTimerMax |
| `DESTROYING_TILE_TYPES` | seedlingDemo/pushables.js | 3 | 3 | rule | sentinel |  |
| `PUSH_STEP` | seedlingDemo/pushables.js | 8 | 8 | physics | sign | Player.as:1103 |
| `SPEAR_HIT_TICKS_UNMODELLED` | seedlingDemo/presses.js | 3 | 3 | rule | magnitude |  |
| `FIRE_SPRITE` | seedlingDemo/fireVerb.js | 6 | 6 | physics/rule | count/magnitude | Player.as:53 |
| `FIRE_PRESS_CADENCE` | seedlingDemo/fireVerb.js | 1 | 1 | rule | derivation |  |
| `FIRE_RADIUS` | seedlingDemo/fireVerb.js | 1 | 1 | physics | derivation |  |
| `FIRE_ON_ENEMY` | seedlingDemo/fireVerb.js | 1 | 1 | rule | magnitude |  |
| `BREAK_ANIM` | seedlingDemo/breakableRocks.js | 2 | 2 | rule | count/magnitude | BreakableRock.as:40 |
| `BURN_ANIM` | seedlingDemo/burnableTree.js | 2 | 2 | rule | count/magnitude |  |
| `BURN_SPRITE` | seedlingDemo/burnableTree.js | 2 | 2 | physics | magnitude |  |
| `WAIT_AFTER_PRESS_TICKS` | seedlingDemo/burnableTree.js | 1 | 1 | rule | derivation |  |
| `SPINNER_CTOR_RNG` | seedlingDemo/spinner.js | 2 | 2 | rule | count | Enemy.as:30 Enemy.as:35 Spinner.as:24 FP.as:404-422 |
| `HAMMER_BILLING` | seedlingDemo/spinner.js | 2 | 2 | physics/rule | magnitude | Spinner.as:72-76 Player.as |
| `CHASERS` | seedlingDemo/chasers.js | 10 | 10 | physics/rule | count/magnitude |  |
| `CRUSHER` | seedlingDemo/crusher.js | 9 | 8 | physics/rule | bound/magnitude | Puzzlements/Crusher.as:intDist Puzzlements/Crusher.as:speed Puzzlements/Crusher.as:damage Puzzlements/Crusher.as:force Puzzlements/Crusher.as:spinRate |
| `DIRECTIONS` | seedlingDemo/crusher.js | 8 | 8 | physics | sign | Puzzlements/Crusher.as:directions |
| `CEREMONY_RULE` | seedlingDemo/crusher.js | 1 | 1 | rule | magnitude |  |
| `PLAYER_DAMAGE_PATHS` | seedlingDemo/crusher.js | 4 | 4 | rule | sentinel | LavaTrap.as:72 Player.as:1379 |
| `BOSS_TOTEM` | seedlingDemo/bossTotem.js | 14 | 14 | physics/rule | count/derivation/magnitude | Enemies/BossTotem.as:setHitbox Enemies/BossTotem.as:rumblingTimeMax Enemies/BossTotem.as:activationRate Enemies/BossTotem.as:n Enemies/BossTotem.as:activationRestTimeMax Enemies/BossTotem.as:waitAtTopTimeMax Enemies/BossTotem.as:playerPosSet Enemies/BossTotem.as:hitsMax Enemies/BossTotem.as:hitsTimerMax |
| `WAND_PICKUP` | seedlingDemo/bossTotem.js | 10 | 10 | physics/rule | derivation/magnitude/sentinel | Pickups/Wand.as:setHitbox Pickups/Wand.as:alphaRate Pickups/Wand.as:tset Pickups/Pickup.as:specialTimerMax |
| `DEF_HEAD_POS` | seedlingDemo/bossTotemFight.js | 2 | 2 | physics | magnitude | Enemies/BossTotem.as:defHeadPos |
| `BOSS_TOTEM_BODY` | seedlingDemo/bossTotemFight.js | 7 | 7 | physics/rule | magnitude | Enemies/BossTotem.as:setHitbox Enemies/Enemy.as:hitPlayer Enemies/BossTotem.as:hitsTimerMax |
| `BOSS_TOTEM_KILL` | seedlingDemo/bossTotemFight.js | 4 | 4 | rule | count/magnitude | Enemies/BossTotem.as:hitsMax Enemies/BossTotem.as:hitsTimerMax |
| `BOSS_TOTEM_SHOT` | seedlingDemo/bossTotemFight.js | 13 | 13 | physics/rule | bound/derivation/magnitude | Projectiles/BossTotemShot.as:setHitbox |
| `BOSS_TOTEM_DEATH_BLAST` | seedlingDemo/bossTotemFight.js | 5 | 5 | physics/rule | derivation/magnitude | Projectiles/Explosion.as:radiusCoeff |
| `BOSS_TOTEM_WHITE_OUT` | seedlingDemo/bossTotemFight.js | 3 | 3 | rule | magnitude/sentinel | Enemies/BossTotem.as:rumblingTimeMax |
| `SHIELD_BOSS` | seedlingDemo/shieldBossFight.js | 15 | 14 | physics/rule | bound/count/derivation/magnitude | Enemies/ShieldBoss.as:setHitbox Enemies/Enemy.as:hitsMax Enemies/Enemy.as:hitsTimerMax Enemies/ShieldBoss.as:swingTimeMax Enemies/ShieldBoss.as:swingForce |
| `BOSS_KEY` | seedlingDemo/shieldBossFight.js | 7 | 7 | physics/rule | derivation/magnitude | Pickups/BossKey.as:setHitbox Pickups/Pickup.as:specialTimerMax |
| `ARENA` | seedlingDemo/bobBoss.js | 11 | 11 | rule | magnitude | Enemies/BobBoss.as:BobBoss |
| `ROCK` | seedlingDemo/bobBoss.js | 11 | 11 | physics/rule | magnitude | Scenery/FallRockLarge.as:fallTo Scenery/FallRockLarge.as:fallRate |
| `FORM_TELEPORT_AT` | seedlingDemo/bobBoss.js | 1 | 1 | rule | derivation | Enemies/BobBoss.as:nextBossTimerMax |
| `BOB_BOSS_FORMS` | seedlingDemo/bobBoss.js | 9 | 9 | rule | count | Enemies/BobBoss.as:hitsMax |
| `FIRE` | seedlingDemo/bobBoss.js | 6 | 6 | rule | magnitude/sentinel | Pickups/Fire.as:tag Pickups/Fire.as:Fire |
| `BURNABLE_TREE` | seedlingDemo/bobBoss.js | 10 | 10 | rule | derivation/magnitude | Scenery/BurnableTree.as:burn |
| `BOB_BOSS_LEDGER` | seedlingDemo/bobBoss.js | 2 | 2 | rule | sentinel |  |
| `BASE_SPIN_RATE` | seedlingDemo/bobBossFight.js | 1 | 1 | physics | magnitude | Enemies/BobSoldier.as:swordSpinRate |
| `BOB_BOSS_BOX` | seedlingDemo/bobBossFight.js | 4 | 4 | physics | magnitude | Enemies/BobBoss.as:setHitbox |
| `FINAL_BOSS_ANIMS` | seedlingDemo/finalBossFight.js | 8 | 4 | rule | count/magnitude | FinalBoss.as:47-50 |
| `ROCKFALL_BREAK_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude | Scenery/RockFall.as Scenery/Pod.as Enemies/Grenade.as |
| `POD_OPEN_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude |  |
| `GRENADE_EXPLODE_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude |  |
| `GRENADE_HIT_UPDATES` | seedlingDemo/finalBossFight.js | 2 | 2 | rule | count/magnitude |  |
| `ROCK_FALL` | seedlingDemo/finalBossFight.js | 5 | 5 | physics/rule | magnitude | Scenery/RockFall.as:fallHeight Scenery/RockFall.as:g Scenery/RockFall.as:startingSpeed Scenery/RockFall.as:force Scenery/RockFall.as:damage |
| `GRENADE` | seedlingDemo/finalBossFight.js | 8 | 8 | physics/rule | bound/magnitude | Enemies/Grenade.as:hitRadius Enemies/Grenade.as:force |
| `OWL_DRAW_SITES` | seedlingDemo/finalBossRng.js | 7 | 7 | rule | count |  |
| `ICE_TURRET_BLAST` | seedlingDemo/iceTurretBlast.js | 9 | 9 | physics/rule | count/magnitude | Enemies/IceTurret.as:shotSpeed Enemies/IceTurret.as:distBtwnShots |
| `FREEZE_SPAN` | seedlingDemo/iceTurretBlast.js | 1 | 1 | rule | derivation |  |
| `BLAST_DAMAGE` | seedlingDemo/iceTurretBlast.js | 4 | 4 | physics/rule | magnitude |  |
| `BLAST_PLAN` | seedlingDemo/iceTurretBlast.js | 3 | 3 | rule | magnitude |  |
| `TURRET_SPIT` | seedlingDemo/turret.js | 9 | 9 | physics/rule | bound/magnitude | Projectiles/TurretSpit.as:setHitbox Projectiles/TurretSpit.as:f Mobile.as:friction Enemies/Turret.as:shotSpeed Projectiles/TurretSpit.as:onScreen Player.as:hit |
| `WAND_SPRITE` | seedlingDemo/wandVerb.js | 11 | 3 | physics/rule | count/magnitude | Player.as:48-51 |
| `FIRE_WAND_SPRITE` | seedlingDemo/wandVerb.js | 11 | 2 | rule | count/magnitude |  |
| `WAND_PRESS_CADENCE` | seedlingDemo/wandVerb.js | 1 | 1 | rule | derivation |  |
| `WAND_FACING_RULE` | seedlingDemo/wandVerb.js | 1 | 1 | rule | magnitude |  |
| `WAND_DIRECTIONS` | seedlingDemo/wandVerb.js | 5 | 5 | physics/rule | derivation/sentinel |  |
| `WAND_SHOT_ANIMS` | seedlingDemo/wandShot.js | 10 | 2 | rule | count/magnitude |  |
| `WAND_SHOT_DEATH` | seedlingDemo/wandShot.js | 2 | 2 | rule | derivation |  |
| `WAND_SHOT_CULL` | seedlingDemo/wandShot.js | 3 | 3 | physics/rule | derivation/magnitude |  |
| `WAND_SHOT_GRAZE` | seedlingDemo/wandShot.js | 4 | 4 | physics | sign |  |
| `WAND_SHOT_PLAN` | seedlingDemo/wandShot.js | 1 | 1 | physics | magnitude |  |
| `MAGICAL_LOCK_TYPES` | seedlingDemo/magicalLock.js | 2 | 2 | rule | sentinel | Game.as:2148-2149 |
| `WAND_SHOT_TYPES` | seedlingDemo/magicalLock.js | 2 | 2 | rule | sentinel | Projectiles/WandShot.as:29 |
| `MAGICAL_LOCK_GEOMETRY` | seedlingDemo/magicalLock.js | 6 | 6 | physics | magnitude |  |
| `MAGICAL_LOCK_DESTROY_ANIM` | seedlingDemo/magicalLock.js | 9 | 2 | rule | count/magnitude |  |
| `MAGICAL_LOCK_CALLBACK_TICK_OFFSET` | seedlingDemo/magicalLock.js | 1 | 1 | rule | derivation |  |
| `MAGICAL_LOCK_MATRIX` | seedlingDemo/magicalLock.js | 8 | 8 | rule | sentinel |  |
| `INVENTORY_TERM` | seedlingDemo/camera.js | 2 | 2 | rule | derivation |  |
| `SHAKE_WRITERS` | seedlingDemo/camera.js | 4 | 4 | rule | magnitude |  |
| `RANDOM_RANGE` | seedlingDemo/camera.js | 2 | 2 | rule | bound |  |
| `CAMERA_DEAD_ZONE_RESIDUE` | seedlingDemo/camera.js | 2 | 2 | rule | bound |  |
| `PLAYER_DAMAGE` | seedlingDemo/playerDamage.js | 5 | 4 | rule | count/magnitude | Player.as:hitsTimerMax Player.as:hitsTimerInt |
| `KNOCKBACK_COMPARATORS` | seedlingDemo/playerDamage.js | 1 | 1 | physics | bound | Player.as:1500 |
| `KILL_CADENCE_FLOOR` | seedlingDemo/combat.js | 1 | 1 | rule | derivation |  |
| `ENEMY_DAMAGE_DEFAULTS` | seedlingDemo/enemyDamage.js | 6 | 3 | rule | count/magnitude | Enemies/Enemy.as:damage Enemies/Enemy.as:hitsMax Enemies/Enemy.as:hitsTimerMax |
| `MOBILE_DEATH_FADE` | seedlingDemo/enemyDamage.js | 3 | 3 | rule | magnitude | Image.as:157 |
| `PIT_FADE` | seedlingDemo/enemyDamage.js | 3 | 3 | rule | magnitude | Enemies/Enemy.as:fallAlphaSpeed |
| `STATIC_ARROW_DEATH` | seedlingDemo/enemyDamage.js | 2 | 2 | rule | count/magnitude | Arrow.as:51-53 |
| `SLASH_SPRITES` | seedlingDemo/combatVerbs.js | 6 | 6 | physics | magnitude | Player.as:41-45 |
| `SLASH_SCALE_NORMAL` | seedlingDemo/combatVerbs.js | 2 | 2 | physics | magnitude | Player.as:1258-1265 |
| `SLASH_SCALE_DASH` | seedlingDemo/combatVerbs.js | 2 | 2 | physics | magnitude |  |
| `SWORD_DAMAGE` | seedlingDemo/combatVerbs.js | 3 | 3 | rule | magnitude |  |
| `KILL_PRESS_CADENCE` | seedlingDemo/combatVerbs.js | 1 | 1 | rule | derivation |  |
| `SLASH_ANIM_TICKS_GAME` | seedlingDemo/combatVerbs.js | 2 | 2 | rule | count |  |
| `SLASH_ANIM_TICKS_LEGACY` | seedlingDemo/combatVerbs.js | 2 | 2 | rule | count |  |
| `CHEST` | seedlingDemo/chest.js | 9 | 9 | physics/rule | count/magnitude | Chest.as:openTimerMax Chest.as:m |
| `SEAL_DRAW` | seedlingDemo/chest.js | 6 | 5 | rule | count/derivation | SealController.as:SEALS |
| `SEAL_PIECE` | seedlingDemo/sealCeremony.js | 10 | 10 | physics/rule | bound/magnitude | Pickups/Pickup.as:attractDistance Pickups/Pickup.as:motionDampener Pickups/Pickup.as:minAttraction Pickups/Pickup.as:minSpeedToPlayer Pickups/Pickup.as:specialTimerMax Mobile.as:DEFAULT_FRICTION |
| `SEAL_CONTROLLER` | seedlingDemo/sealCeremony.js | 2 | 2 | rule | magnitude | SealController.as:waitTime SealController.as:alphaSteps |
| `CEREMONY_DEAD_FRAMES` | seedlingDemo/sealCeremony.js | 1 | 1 | rule | magnitude | Pickups/Pickup.as:specialTimerMax |
| `ARROW_TRAP` | seedlingDemo/arrowTrap.js | 13 | 13 | physics/rule | derivation/magnitude | Puzzlements/ArrowTrap.as:shootTimerMax Puzzlements/ArrowTrap.as:shootTimer |
| `ARROW` | seedlingDemo/arrowTrap.js | 8 | 6 | physics | magnitude | Projectiles/Arrow.as:setHitbox |
| `ARROW_ENEMY_HIT` | seedlingDemo/arrowTrap.js | 7 | 7 | physics/rule | count/derivation/magnitude | Enemies/Enemy.as:hitsMax Enemies/Enemy.as:hitsTimerMax |
| `ARROW_PLAYER_ARM` | seedlingDemo/arrowTrap.js | 2 | 2 | physics/rule | magnitude | Arrow.as:51 |
| `ARROW_KILL_PLAN` | seedlingDemo/arrowTrap.js | 10 | 9 | rule | derivation/magnitude |  |
| `BUILD_SPAWN` | seedlingDemo/tapeFormat.js | 3 | 3 | physics/rule | magnitude/sentinel | Main.as:51 Bot.as |
| `KEY_CODES` | seedlingDemo/tapeFormat.js | 8 | 8 | rule | sentinel | Player.as:59 Key.as |
| `HAZARD_STATES` | seedlingDemo/tapeFormat.js | 5 | 5 | rule | sentinel |  |
| `ITEM_PROPERTIES` | seedlingDemo/tapeFormat.js | 2 | 2 | rule | count/magnitude | Player.as:hitsMaxDef |
| `INVENTORY_ITEM_IDS` | seedlingDemo/tapeFormat.js | 6 | 6 | rule | sentinel | Inventory.as:277-318 |
| `SAVE_SLOTS` | seedlingDemo/tapeFormat.js | 3 | 3 | rule | count | Player.as:totemParts Player.as:totalKeys SealController.as:SEALS |
| `BLACK_COVER` | seedlingDemo/gameClock.js | 2 | 2 | rule | magnitude | Game.as:blackCover Game.as:blackCoverRate |
| `LOAD_FADE_FRAMES` | seedlingDemo/gameClock.js | 7 | 1 | rule | bound | Game.as:blackCover |
| `PICKUP_HELP_DEAD_FRAMES` | seedlingDemo/gameClock.js | 1 | 1 | rule | magnitude | Pickups/Sword.as:42-49 Inventory.as:174 Game.as:961 |
| `TIME_RATE` | seedlingDemo/gameClock.js | 1 | 1 | rule | magnitude | Game.as:timeRate |
| `DAY_LENGTH_FRAMES` | seedlingDemo/gameClock.js | 1 | 1 | rule | derivation | Game.as:dayLength |
| `PAGE_BOOT_TIME` | seedlingDemo/gameClock.js | 1 | 1 | rule | derivation | Main.as:158 Main.as:51 |
| `TILE_TYPE_SEMANTICS` | flashPanel/seedlingSemantics.js | 8 | 8 | rule | sentinel |  |
| `SEEDLING_PLAYER_BOX` | flashPanel/seedlingSemantics.js | 2 | 2 | physics | magnitude | Player.as:normalHitbox |
| `CLIFFSIDE_FRAME_FACES` | flashPanel/seedlingSemantics.js | 4 | 4 | rule | sentinel | Game.as:2084-2089 Scenery/CliffSide.as:15-34 |
| `DIRECTIONS` | flashPanel/seedlingSemantics.js | 8 | 8 | rule | sign |  |

<!-- CENSUS:seedling-constants END -->
