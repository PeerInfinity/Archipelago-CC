# seedling-engine-prep-r1 — the residues (cloud report)

- **Started from:** `origin/main` at `ef6be46826`, the SHA the brief expected.
- **Harness branch:** `claude/seedling-engine-prep-r1-18gost`. The harness designated it, and every push went there. Nothing was pushed to `main`.
- **Head:** the commit that carries this report, one after `712d7e8`.
- **Verdicts:**

  | D | verdict |
  |---|---|
  | D1 | PASS |
  | D2 | PASS |
  | D3 | PASS for `watch.html`, after a measured rework; the other pages are named as not wired |
  | D4 | PASS |
  | D5 | PASS |

| step | commit |
|---|---|
| D2, `--tier=full` (the code) | `e83441d` |
| D1, the anchor row reads the defaults | `1c48299` |
| D4, the `--help` write door | `fe78bdb` |
| D3, a module bootstrap (**superseded**) | `33185cd` |
| D5, records part 1 (Q17, the anchor, the page, the `true` form) | `176834a` |
| D2, the measurement and its guard | `a53ef68` |
| D5, records part 2 (the full-tier witness) | `98d4ccb` |
| D3, rework: a classic script before the untouched module boot | `3cf4034` |
| D5, records part 3 (the page paragraph as shipped) | `712d7e8` |

D2 is two commits because the measurement had to be taken at a committed head with a clean tree. The run used a detached worktree at `e83441d`, so the other D's could be edited meanwhile; the JSON records `head: e83441d…`, `treeClean: true`. Between those two commits the new code's `--check` asked for a file that did not exist yet. The guard rows that need it landed with the file, in `a53ef68`, so no committed head has a red guard.

## Byte-neutrality (no override)

| check | result |
|---|---|
| `profileMd5()` | `be8b983bc252c0ac33effa9ede59bc6e`, `compiled-in default` |
| `npx vitest run frontend/modules/seedlingDemo/tapeRunner.test.js` | **365 passed** |
| `census-seedling-constants.mjs --check` | PASS, 4368 literals; the census is unchanged, and `profileBoot.js` carries no numeric literal |
| files touched (`git diff --stat origin/main..HEAD`) | 14. None is a simulation, solver, tape, expectation or fixture file, and none is one of C4's |

## D1 — the anchor row reads the defaults (PASS)

- `seedlingProfile.test.js`: the AS3 anchor row now compares `PROFILE_DEFAULTS[key]`. A new row beside it asserts that `PROFILE_DEFAULTS` deep-equals `PROFILE`, with the same key order, when no override is installed.
- The file goes from 21 to **22 passed**.
- **Mutant, predicted first, run in copies.** Each copy installs `{walkSpeed: 0.9}` before a dynamic import of the profile.

  | copy | predicted | observed |
  |---|---|---|
  | anchor reads `PROFILE_DEFAULTS` | anchor GREEN, agreement row RED | **anchor ✓, agreement ×** (1 failed, 1 passed) |
  | anchor reads `PROFILE` | anchor RED on `walkSpeed` | **anchor ×** (`walkSpeed: Player.as says 0.8, …`), agreement × |

  Both copies were deleted afterwards, and `git status` showed only the real edit.

## D2 — the full-tier witness (PASS)

- `witness-seedling-profile.mjs --tier=full` measures every committed tape and writes the sibling file `scripts/procgen/seedling-profile-witnesses-full.json`.
- The fast file, and every guard row that reads it, are unchanged.
- The control's declared divergers are now `tapeRunner.test.js`'s whole `EXPECTED_TO_DIVERGE`: `r5-l60-kill` plus `r5Chain.MODEL_EXEMPT_NAMES`. The fast tier holds none of the added three, so it is unaffected.
- `--tier=` refuses anything else by name: `--tier=bogus: only "fast" and "full" are measured`, exit 2.
- `--check` checks both files.
- **The run:** `node scripts/procgen/witness-seedling-profile.mjs --write --jobs=4 --tier=full`. It covered 154 tapes and 254 perturbed runs, with a **wall time of 1651 s (27.5 min)**, well under the 90-minute stop.
- **The control:** it was stable across two runs and threw nothing. It diverged from the expectations on exactly the 4 declared tapes (`r5-bobboss-arm`, `r5-bobboss-fire`, `r5-bobboss-fire-control`, `r5-l60-kill`).
- **The guard:** `seedlingProfileWitness.test.js` goes from 5 to **8 passed**. The three new rows cover:
  - the full file's exact key set, through `checkWitness`, with an in-memory deletion that must go RED;
  - its tier, that it is a superset of the fast tapes, and its control;
  - `--check` naming the full file.
- **Mutant** (`walkSpeed` deleted from the full JSON, restored by `cmp` against the worktree's copy):
  - predicted: the full file's key-set row and both `--check` rows RED;
  - observed: **3 RED**, exactly those, with the fast key-set rows green.

### The full-tier table

| | moves | corpus-blind |
|---|---|---|
| fast (A3, 102 tapes) | 58 | 69 |
| **full (154 tapes)** | **70** | **57** |
| full, physics (47) | 32 | 15 |
| full, rule (80) | 38 | 42 |

**No fast-moving key went blind.** 12 fast-blind keys woke:

| key | ulp moved/threw | ×1.1 or +1 moved/threw | tapes |
|---|---|---|---|
| `stairSpeed` | 10/0 | 3/7 | the r2–r4 spear, dark-shield, health and full walks, `r5-feather` |
| `slidingSpeed` | 1/0 | 0/1 | `r5-d5-conch` |
| `slidingFriction` | 0/0 | 0/1 | `r5-d5-conch` |
| `iceState` | 0/1 | 0/1 | `r5-d5-conch` |
| `bridgeState` | 0/8 | 0/8 | the r2–r4 spear, approach, health and full walks. The throw is `type 29 (Bridge) … not modelled` |
| `screenH` | 0/0 | 2/0 | `r5-l40-part5` and its control |
| `cameraSpeedDivisor` | 0/0 | 2/0 | `r5-l40-part5` and its control |
| `fpElapsed` | 0/0 | 0/2 | `r5-l40-part5` and its control. The throw is a press on a frozen tick |
| `xorMask` | 0/0 | 2/0 | `r6-owl-kill`, `r6-owl-control` |
| `hashC3` | 0/0 | 2/0 | `r6-owl-kill`, `r6-owl-control` |
| `hashC2` | 0/0 | 0/2 | `r6-owl-kill`, `r6-owl-control` (pod cell at tick 696) |
| `rockFrequency` | 0/0 | 0/2 | `r6-owl-kill`, `r6-owl-control`, the same throw as `hashC2` |

**Still blind on every committed tape (57):** `headPosX` `fpMaxElapsed` `waitAfterPressTicks` `bridgeTimerMax` `onScreenRadius` `ticksFromPressToWalkable` `screenW` `inventoryWidth` `inventoryOffsetX` `velocityEpsilon` `enemyPitTile` `enemyIframes` `killLockTset` `swordAnimRate` `swordAnimRateDash` `specialTimerMax` `pickupLineLength` `initialFramesThisCharacter` `npcLineLengthDefault` `talkRange` `grenadeFrequency` `rockStepsAhead` `rockRadius` `deathRocks` `rockScaleBase` `rockScaleSpan` `enemyCoinsBase` `enemyCoinsSpan` `fireHitFrameEnd` `fireForce` `fireDamage` `gameFps` `level0WorldWidth` `level0WorldHeight` `drownTimerMax` `descentMaxFall` `noBounceStates1` `noBounceStates2` `darkSwordDamage` `spearDamage` `slashReach` `spearLength` `spearThick` `enemyHitsMax` `enemyHitsTimer` `slashHitTicks` `lightpoleHitsTimerMax` `pushableFriction` `alphaFade` `bothRange` `bootSeed` `hashC1` `randomDivisor` `stateMax` `ceremonyFreezeFrames` `levelCount` `wandSpeed`.

### Prediction against result

The prediction was written at 03:33 UTC, before the run, to a scratch file. It came after a one-key smoke (`--only=rockFrequency --tier=full`), which had already shown `rockFrequency` waking, so that key is not counted as a prediction.

| prediction | result |
|---|---|
| the other 8 final-boss keys stay blind | **held** |
| `slashReach`, `spearLength` wake; `spearDamage`, `darkSwordDamage` wake on a kill tape; `spearThick` blind | **missed**: all 5 blind (only `spearThick` held) |
| bridges: `bridgeTimerMax`, `ticksFromPressToWalkable`, `waitAfterPressTicks`, `bridgeState` wake | **1 of 4**: `bridgeState` wakes, and only by throwing; the three timers stay blind |
| `stairSpeed`, `iceState`, `slidingSpeed`, `slidingFriction` wake | **held**, all 4 |
| `pushableFriction` wakes; `bothRange`, `alphaFade` blind | **missed** on `pushableFriction` (blind); the other two held |
| `fireDamage` wakes; `wandSpeed`, `fireForce`, `fireHitFrameEnd` blind | **missed** on `fireDamage`; the other three held |
| `enemyHitsMax`, `enemyIframes`, `slashHitTicks` wake | **missed**: all blind |
| camera, dialogue, clamps, RNG blind | **missed in part**: `screenH`, `cameraSpeedDivisor`, `fpElapsed`, `xorMask`, `hashC2` and `hashC3` woke; dialogue held |
| blind shrinks from 69 to 40–50 | **missed**: 57 |

**The lesson.** The campaign tapes' kills and weapons do not reach the stream through the damage and hit keys. What they reach is the terrain (stairs, ice, the bridge sentinel) and the RNG (the owl fight).

## D3 — the page's `?profile=` (PASS, reworked once)

### How the pages boot (measured)

- **`seedlingDemo/watch.html`:** one inline `<script type="module">` with `import { main } from './watchViewer.js'; main();`. The esbuild metafile says `watchViewer.js` reaches `seedlingProfile.js` (165 inputs).
- **`mazeRoom/lab.html`:** the same shape, `import { main } from './mazeLabView.js'`, and it reaches the profile too (161 inputs). **Not wired.**
- **The bundled boot:** esbuild over `frontend/init-bundled.js` with the build's options reads 649 inputs. It includes `seedlingProfile.js` and `profileOverrides.js`, imported via `flashPanel/seedlingSemantics.js` and `seedlingDemo/breakableRocks.js`. The bundle therefore evaluates the profile when it loads, with nothing able to set the global first. `watch.html` has no bundled boot. **Not wired, as the brief asked:** `bundle-frontend.js` and the entry list were not touched.

### What was built first, and why it was replaced (measured)

- **First form** (`33185cd`): a module `profileBoot.js` that fetched the file, set the global, and then dynamically imported `watchViewer.js` after a top-level `await`.
- Its unit rows were green, and a page probe with no `?profile=` matched the old page on status, detail, HUD and console.
- **`gates.mjs reach` then went red on `check-procgen-demos.mjs`:**
  - CAMPAIGN row: `isCampaign = null`;
  - **3 of 3** runs red on the new page;
  - **green** with `origin/main`'s `watch.html` swapped in (the control).
- **The cause:** `DOMContentLoaded` does not wait for a module's top-level `await`. `main()` therefore ran after the page reported itself loaded. The gate presses `#campaignRun` as soon as the static button is enabled, which then happens before its handler exists.
- **The lesson.** "No `?profile=` = today's boot" was true for what the page ends up showing and false for its timing. Only a gate that acts at load could see the difference.

### What shipped (`3cf4034`)

- `profileBoot.js` is a CLASSIC script. `watch.html` gains `<script src="./profileBoot.js"></script>` before its inline module, and **the inline module is byte-identical to `origin/main`'s**. The diff is 2 added lines.
- With `?profile=`, it does the following:
  1. fetches the file's text synchronously, repo-relative like `?tape=`;
  2. sets the global during parsing, so it is set before any module evaluates;
  3. while the page loads, reports an `error` in `#status`, naming the path;
  4. after `load`, imports the (already evaluated) profile, logs `[profile] …` announcements, and refuses a too-late install.
- **A failed fetch installs text the profile refuses.** The model's import then fails, so a `?profile=` URL never runs the defaults under a green status. The first cut of the classic form did exactly that on a 404, measured, and was fixed before commit.
- With no `?profile=`, it reads `location.search` and returns.
- `profileBoot.test.js`: **6 passed**.
- **Mutant** (the global-set line removed):
  - predicted: the install row and the refusal row RED;
  - observed: **2 RED**, exactly those.

### The page, measured (Playwright, `http://localhost:8690`)

| URL | `#status` | console | `__watch` |
|---|---|---|---|
| `origin/main` page vs this page, `?tape=…/collide-up-rock.json` | identical (`ok`, "… — 46 observations") | identical (one favicon 404 each) | identical modulo its `url` |
| `&profile=` `{"id":"r1-walk","walkSpeed":0.8000000000000002}` | `ok` | `[profile] profile: override:r1-walk (id r1-walk, md5 1f5db0f5…)`, `set walkSpeed=…`, `defaulted: 126 of 127 keys` | published |
| `&profile=` `{"walkSped":0.9}` | **bad**: `?profile=r1-probe-bad.json: ProfileOverrideError: profile override: unknown key "walkSped"; …` | pageerror | not published |
| `&profile=` a missing file | **bad**: `?profile=r1-probe-nope.json: cannot fetch http://localhost:8690/r1-probe-nope.json (HTTP 404)` | the error, then the refusal | not published |

The md5 `1f5db0f5…` equals A3's node-loader md5 for the same override. The probe files were untracked and deleted after each run.

### The gates the page change reaches

`node scripts/procgen/gates.mjs reach origin/main..HEAD --host=http://localhost:8690` at `3cf4034`: **22/26 green**. The 4 reds:

| gate | why it is not R1's (measured) |
|---|---|
| `check-preset-bundle-load.mjs`, `check-procgen-lab-hosting.mjs` | Environment. Every failing line is a 404 or `[jta-bridge] … hook not present` from `journey-to-ascension/`, `omsi-loops/` or `textAdventureEngine/`. Those three submodules are uninitialised in this clone (`git submodule status` shows `-`), because `session_bootstrap.sh --seedling` does not fetch them |
| `check-seedling-bot-differential.mjs` | A harness miss. It ignores `--host` and reads `SEEDLING_PORT` (default 8000), so it got `ERR_CONNECTION_REFUSED` on 8000. Re-run as `SEEDLING_PORT=8690 … --tier=fast`: **exit 0, 2355 PASS, `ALL CHECKS PASSED`**, at `a53ef68`. It drives the wasm game page, not `watch.html`. An unbounded full-tier run was cut at my 1200 s `timeout` with 706 PASS and 0 FAIL |
| `check-seedling-editor-refusal.mjs` | Red on `origin/main`'s page as well. With `origin/main`'s `watch.html` swapped in, the same 3 FAILs appear (`status=ok`, not the ladder refusal) |

The first reach run, at `a53ef68` with the superseded module bootstrap, was 21/26: those four plus the demos row above.

## D4 — the `--help` write door (PASS)

- **Measured before the fix:**
  - `node scripts/quicklaunch/generate-docs-index.mjs --help` printed `wrote frontend/modules/quickLaunch/generated/docsIndex.js (154 docs, 8 sections, 11 categories).`, exit 0;
  - the index's mtime moved from 03:30:15 to 03:34:35;
  - the md5 stayed `529e1b0a…` (byte-identical, but a write).
- **The fix:** it now calls `argvHelp(import.meta.url)` from `scripts/procgen/argvHelp.js` (the repo convention; the relative import works). Its docblock gains a `Run:` block, so the derived help names `--check` and `--help`.
- **Measured after:** `--help` prints the usage and exits 0, and the mtime does not move. `--check` still prints `OK … (154 docs, 8 sections, 11 categories)`, and the index md5 is unchanged.
- `generated.test.js` gains a row asserting three things: `--help` exits 0, its stdout starts `generate-docs-index.mjs — `, and the index's mtime is unchanged. The file has **34 passed**.
- **Mutant** (the guard line commented out):
  - predicted: that row alone RED;
  - observed: **1 RED**, `expected 'wrote frontend/…' to match /^generate-docs-index\.mjs — /`. The file was restored and `cmp`-checked.
- ⚠ The help text's last line says "`check-procgen-help.mjs` is the gate that says so". That gate scans `scripts/procgen/` only. For this file, the gate is the new `generated.test.js` row.

## D5 — records (PASS)

- `seedling-bot.md` § Gates: the ⚖ Q17 paragraph, in plain prose with no link.
- `seedling-constants.md` § The profile:
  - the anchor reading;
  - `watch.html?profile=` as shipped, what is not wired, and the superseded module form;
  - *The full tier* (the table and the woken keys);
  - the `true` form of `stampProfile`, dropped rather than owed, where the value form is described.
- `generate-procgen-reference.mjs` regenerated; `--check` gives `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- `generate-docs-index.mjs --check` gives `OK`, and no new doc was added.
- `witness-seedling-profile.mjs --check` passes for both files. `check-procgen-help.mjs --in-place --only=witness-seedling-profile.mjs` gives ALL PASS.
- **Bounded vitest** (the brief's list plus `profileBoot.test.js`): `npx vitest run …/seedlingProfile.test.js …/tapeRunner.test.js scripts/procgen/seedlingProfileWitness.test.js scripts/procgen/seedlingProfileLoader.test.js frontend/modules/quickLaunch frontend/modules/procgenDocs …/profileBoot.test.js` gives **20 files, 1006 passed, 54 s wall**.

## Mutants (predicted first; the tree was clean after each)

| mutant | predicted | observed |
|---|---|---|
| D1: `walkSpeed` 0.9 installed, anchor reads `PROFILE_DEFAULTS` (a copy) | anchor green, agreement red | as predicted |
| D1: the same, anchor reads `PROFILE` (a copy) | anchor red on `walkSpeed` | as predicted |
| D2: `walkSpeed` deleted from the full JSON | 3 red (full key set, both `--check`) | 3 red, exactly those |
| D3 (module form): the global never set | 2 red | 2 red |
| D3 (shipped form): the global never set | install and refusal rows red | 2 red, exactly those |
| D4: the `argvHelp` guard commented out | the `--help` row red | 1 red, exactly that |

## What the brief got wrong (measured)

1. **"A tiny bootstrap module … then dynamically imports the page's real entry; no `?profile=` = today's boot byte for byte."** This does not hold. A module bootstrap delays `main()` past `DOMContentLoaded`, and `check-procgen-demos.mjs` sees that deterministically (3/3). The honest form is a classic script before the unchanged module.
2. **"`--tier=full` ≈ 30 min at 4 jobs."** This one was right: 27.5 min, while I was also running unit tests and page probes.
3. **"Minus what `tapeRunner.test.js` declares `EXPECTED_TO_DIVERGE`, handled as the fast control does."** The fast control named only `r5-l60-kill` in a local constant. The full tier needed the three `r5-bobboss-*` tapes from `r5Chain.MODEL_EXEMPT_NAMES`, so the constant now reads the same source the test does.
4. **"Run the rows under `SEEDLING_PORT=8690`."** The editor, pages and demos gates take `--host=`. Only the differential reads `SEEDLING_PORT`, and `gates.mjs` does not pass it, so the differential goes red inside `gates.mjs … --host=…` on any port but 8000.

## Residue

- **`mazeRoom/lab.html`** reaches the profile and is not wired. The same two-line classic script would serve it, but its gates (`check-maze-lab.mjs` and others) were not run for such a change.
- **The bundled boot** evaluates the profile at bundle load. A `?profile=` there would need a classic script before `bundle.js` in `frontend/index.html`, which touches the main app's entry, outside R1.
- **`gates.mjs` does not forward `--host` to the differential as `SEEDLING_PORT`.** That red is a harness gap, not the change's.
- **`check-seedling-editor-refusal.mjs` is red on `origin/main`'s `watch.html` in this clone** (`status=ok` where a ladder refusal is expected). This was not investigated; it predates R1.
- The mechanisms for the woken keys are named from each throw's first message. Where a throw is shared (`rockFrequency` and `hashC2` fail on the same pod cell), the RNG reading is an inference.
- Not measured here: the unfiltered vitest suite (⚖ ruling 52) and CI at the pushed SHA.
