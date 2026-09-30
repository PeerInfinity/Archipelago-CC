# seedling-engine-prep-a1 — the Seedling constants census (cloud report)

- **Started from:** `origin/main` at `1c705497f1`, the SHA the brief expected.
- **Harness branch:** `claude/seedling-constants-census-eypz8i`. The harness designated it and refuses any other. Nothing was pushed to `main`.
- **Head before this report:** `1bf103b2ce`. The report is the one commit after it.
- **Commits:** D1 `ac73419`, D2 `c02d655` + `6f803db`, D3 `b07be08`, D4 `02e8896`, D5 `1bf103b`, D6 = this report.

## W0 — reproduce

Between the planner's `996080b006` and `1c705497f1`, the only change under the census paths is `frontend/modules/seedlingDemo/ropeSword.test.js` (+9/−2). That file is not in the closure, so the prediction was "all of §1 unchanged". Measured at `1c705497f1`, with `@babel/parser`, following the same closure rule:

| quantity | §1 | measured |
|---|---|---|
| files in the closure | 47 (46 + `seedlingSemantics.js`) | **47** (the same) |
| lines | 51,786 | **51,739** when trailing newlines are not counted; **51,786** with `split('\n').length`. The 47-line gap is one per file, a definition difference, not drift |
| NumericLiteral nodes | 4,171 | **4,171** |
| scalar / table / inline | 136 / 2,147 / 1,888 | **136 / 2,147 / 1,888** |
| inline, not in {0, 1, 2, −1} | 234 | **234** |
| scalar names: distinct / exported | 123 / 119 | **123 / 119** |
| names declared in more than one file | 12, values agree | **12**, all agree |
| derived or aliased constants | 28 | **28** (init is a BinaryExpression, MemberExpression, Identifier or UnaryExpression) |
| largest files | levelWorld 777, levelRun 435, combat 288, … | the same six, the same counts |
| AS3 named numeric declarations | 977 | **977** |

The table position was also run with an "uppercase names only" variant, which gives the same 2,147. Top-level `const`s with lowercase names therefore hold no literals. Excluding functions nested inside tables would give 2,114 / 1,921. §1 counts those nested functions as table, and so does this census.

## D1 — the dependency (PASS)

`npm install --save-dev --save-exact @babel/parser@7.28.5` → "up to date". `git diff` showed one line in `package.json` and one line in `package-lock.json`: the root `devDependencies` entry. Nothing was resolved anew.

## D2 — library and CLI (PASS)

- `scripts/procgen/seedlingConstantsCensus.js` holds the pure logic:
  - the closure, positions and keys;
  - the join to the reviewed table and the drift verdict (`diffCensus`);
  - scalar AS3 anchors;
  - the doc region renderer.
- `scripts/procgen/census-seedling-constants.mjs`:
  - with no flag, prints the summary;
  - `--write` writes the census CSV and the doc region;
  - `--check` exits 1 on red.
- It is not a `check-*.mjs`.
- It has an entry-point guard and calls `argvHelp`. `node scripts/procgen/check-procgen-help.mjs --only=census-seedling-constants.mjs` gives `PASS … HELP ok (124 ms) · IMPORT ok (102 ms)`, 0 on the import-door baseline.

Design decisions beyond the brief, each measured:

- **The key's unit is not always the whole statement.**
  - For an inline literal, nested blocks and statements that do not hold the literal are replaced by `{…}`. An edit to an `if` body therefore moves no key in its test (self-test (iv)).
  - For a table literal, the unit is the innermost `key: value` property, prefixed by its property path (for example `HITBOX.originY: originY:2`). Otherwise the 615-literal `ENTITY_CLASSES` table would be re-keyed wholesale by any edit to one entry.
  - Comments are stripped. Whitespace runs are collapsed and dropped beside punctuation.
- **The function column** is the innermost *named* frame (`createLevelRun`, `OwlDrawStream.jiggle`, the const an arrow is assigned to). Anonymous callbacks are attributed to their named parent.
- **Automatic AS3 anchors are for named scalars only.** Anchoring by same-line comment on table and inline rows was noisy, for example a `0` beside a comment that mentions `hitsTimer` anchored to `Enemy.as:hitsTimer`. The reviewed table's `as3` column supplies the rest. An `as3` of `-` suppresses a coincidental automatic anchor.
- **Parsing is memoised per source text.** A full rebuild takes about 190 ms warm, so the gate's mutant rebuilds are cheap.

## D3 — the reviewed classification (PASS)

`scripts/procgen/seedling-constants-fields.csv` has 1,577 targets:

- group selectors `file|enclosing|function[|literal]`;
- exact-key overrides;
- no file-wide globs were needed.

Six parallel review passes, one per file batch, each read every statement and wrote a fragment. The fragments were merged mechanically. A cross-batch pass then fixed one contradiction:

- `camera.js`'s `SHAKE_WRITERS` (5, 30, 60) were `rule`, but the same `Game.shake` writes in `fallRock`, `iceTurretBlast` and `playerDamage` were `cosmetic`.
- `camera.js` models shake precisely because it moves `onScreen` verdicts, and Owl-room shake costs jiggle RNG draws.
- So all shake writers are now `rule`, and those rows are marked `REVIEW:`.

Consistency checks that passed:

- All 12 duplicated names carry the same class and kind in every file.
- Every literal inside a derived constant is `derivation` and names its sources, except `MAX_HALF_WIDTH`'s `/2`, which is `structural` (it is sweep statistics in `deadFrameBand.js`).

Three wrong automatic anchors were found and suppressed with `-`. Each is a value coincidence with `Player.as:direction` (default 3) or `Game.as:blackCover` (1):

- `FALL_ALPHA_START`;
- `DIRECTION_DOWN`;
- `DOWN` in both `presses.js` and `pushables.js`.

`node scripts/procgen/census-seedling-constants.mjs --check` gives `4171 literals; green drift: 0 new + 0 vanished cosmetic/structural, 0 moved` → `PASS`.

## D4 — the generated census and its doc (PASS)

- `scripts/procgen/seedling-constants-census.csv` has 4,171 rows. Its columns are those in the brief plus `context`, the first 90 characters of the hashed unit, for reviewers.
- `docs/json/developer/procgen/seedling-constants.md` is prose plus a CENSUS region rendered by `--write`. It uses plain-prose pointers and has no markdown links. It is placed in `README_ORDER` after `seedling-bot-log.md`.
- `node scripts/procgen/generate-procgen-reference.mjs`, then `--check`, gives `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`. The generator touched:
  - `README.md` (index row);
  - `architecture.md` (instrument counts);
  - `generated/docsIndex.js`;
  - `generated/instruments.js`.

## D5 — the gate (PASS)

`npx vitest run scripts/procgen/seedlingConstantsCensus.test.js` gives **20 passed (20)** in 4.5 s. The rows:

- **(i)** the tree has no red item, and the doc region is the render of the committed census;
- **(ii)** zero unclassified; kinds appear exactly on physics and rule rows; every derivation has a note; no dead target; keys are unique;
- **(iii)** in a temp copy, blank lines are inserted above every `export` and line-leading `const` in `levelRun.js`, plus three lines at the top of `playerPhysicsV1.js`. The key list is identical and more than 400 rows report moved lines;
- **(iv)** synthetic self-tests.

The no-submodule path was measured on a temp copy without `vendor/`: `as3 null`, red 0, `docStale false`, unclassified 0. The anchor row skips by name.

### Mutants (predicted first, each in a temp copy; tree clean after)

| mutant | predicted | observed |
|---|---|---|
| (a) `export const SPEED_X = 0.37;` after `WATER_FRICTION` in `playerPhysicsV1.js` | RED, exactly one item: NEW, key `…/playerPhysicsV1.js\|(module)\|h<md5('SPEED_X=0.37')>\|0.37\|0` | RED, exactly that one item |
| (b) `99: { grass: false },` added to the cosmetic `TILE_COLUMN_VARIANTS` (`seedlingSemantics.js`) | GREEN, one new `cosmetic` drift row, doc not stale | GREEN as predicted. On the FIRST run the doc WAS stale, because the region printed source line numbers. Fixed by rendering file-only sites |
| (c) `WATER_FRICTION`'s statement deleted | RED, exactly one item: RETIRED, the committed physics key | RED, exactly that item |
| (d) a hand edit inside the doc region | stale | stale |

`git status --porcelain` after the runs showed only this slice's files.

## Class × position

| class | scalar | table | inline | total |
|---|---|---|---|---|
| physics | 43 | 1194 | 268 | 1505 |
| rule | 85 | 729 | 375 | 1189 |
| cosmetic | 0 | 43 | 8 | 51 |
| structural | 8 | 181 | 1237 | 1426 |
| unclassified | 0 | 0 | 0 | 0 |
| total | 136 | 2147 | 1888 | 4171 |

## Class × kind

| class | magnitude | count | bound | sign | sentinel | derivation |
|---|---|---|---|---|---|---|
| physics | 1267 | 0 | 87 | 108 | 4 | 39 |
| rule | 319 | 109 | 184 | 22 | 482 | 73 |

## REVIEW: rows — 105

The ten I am least sure of:

1. **All `Game.shake` writers and the Owl jiggle `shake / 2`** (`camera.js`, `fallRock.js`, `iceTurretBlast.js`, `playerDamage.js`, `bossTotemFight.js`, `finalBossRng.js`) are `rule`. Two reviewers disagreed, and one noted that the jiggle draws happen once per frame whatever the shake value. If shake only moves the view, these are `cosmetic`.
2. **`dialogue.js` text-wrap widths (32, 28, 34)** are `rule/bound`. The wrap sets page counts, which set ceremony length.
3. **`swimSoundClock.js SWIM_LENGTH_FRAMES = 47`** is `rule`. It is a sound length, but its replay re-arms the swim boost.
4. **`levelWorld.js` lavatrap hazard radius 33** is `rule/derivation`. Both `chompRange` and `max(tongueLengths)` are 32, so the source of the +1 is unclear.
5. **`levelWorld.js cliffSideClassFor` (0, 4, 4)** is `structural`. These frame codes pick the collision mask, so they could be `rule/sentinel`.
6. **`finalBossFight.js` walk, deadframe and pod opened/closed animations** are `cosmetic`, while every other animation in that file gates something.
7. **`pulser.js PULSER.anim.frames`** is `rule/count`, because only the array's length gates the wrap.
8. **`levelRun.js CAMERA_LOAD_SETTLE_TICKS = 20` and the `bossCameraTarget` −1/−1 reset** are `rule`, via camera → `onScreen`.
9. **Arrow `fadeStep`/`fadeTicks` (`arrowTrap.js`)** are `cosmetic`. This is wrong if anything counts live arrows.
10. **The six literals of `seedlingSemantics.js`'s `RANK`** have their class marked `REVIEW:`.

## The profile candidate list

- **128 named scalars** are `physics` (43) or `rule` (85); 115 distinct names. **62 have an AS3 anchor.**
- **133 small tables** (at most 16 literals) hold at least one `physics`/`rule` literal. **84 carry an AS3 reference**, from a row anchor or a `X.as` citation in their doc comment.
- The full list is the doc's generated region.

## What the brief got wrong (measured)

1. **"Committed census equals a fresh one" contradicts "a new cosmetic literal is GREEN."** Exact equality turns every new cosmetic literal red.
   - `--check` and row (i) therefore test for *no red item*.
   - Cosmetic/structural churn and moved lines are green drift, and the next `--write` records them.
2. **"RED on a stale rendered document" contradicts the same GREEN rule.** Any new literal moves the doc's counts.
   - The region renders the COMMITTED census, not the fresh one.
   - It must also carry no source line numbers; mutant (b) caught this.
3. **Lines: 51,786** is `split('\n').length`, which counts the empty string after each file's final newline. By `wc -l` the closure is 51,739.
4. **"Whitespace-normalised statement" is not enough for a line- and neighbour-stable key.**
   - Table literals need the property as their unit (see D2).
   - A plain whitespace collapse gives `g( 3)` and `g(3 )` different hashes. This was caught by self-test (iv) before any key was committed.
5. **"No markdown links … a test pins the corpus's link census."** Even a link-free document moves that pin.
   - The generated README index adds a row for it: `docLinks.test.js` and `docsRender.test.js`, 304 → 305 (`doc` 232 → 233). Both were bumped with a logged line, as their comments ask.
   - ⚠ B1 (`tape-envelope.md`) and C1 (`seedling-solver-surface.md`) each owe the same +1, and each also edits `README_ORDER`. The three branches will conflict on those lines at merge, and the pins will end at 307 / 235.
6. **The 977 AS3 declarations include loop counters** (`for (var i:int = 0 …`). Automatic anchoring filters out one-letter names, so none of them anchors a row.

## Residue

- Not measured here: the unfiltered vitest suite (⚖ ruling 52) and CI at the pushed SHA.
- Bounded runs that were measured:
  - `npx vitest run scripts/procgen/seedlingConstantsCensus.test.js frontend/modules/procgenDocs`: **504 passed (9 files)**;
  - `argvHelp`, `checkProcgenHelp`, `procgenHelpBaseline`, `lintGateLabels`, `gateRoster` tests: **84 passed (5 files)**;
  - `lint-gate-labels.mjs` reports nothing on the new files.
- `check-procgen-help.baseline.json`'s `counts.instruments` (270) is already stale on `main` (the reference counts 285 instruments). It was not rewritten here.
- The 105 `REVIEW:` rows are the judgement calls a human should confirm before the profile slice moves constants. Items 1 and 2 of the list above hold the most rows.
- The `context` column is a reviewer aid, not part of the key. It churns green whenever a statement's text changes.

## What enrolling the census as a `check-*.mjs` roster gate would owe

A `check-seedling-constants.mjs` would be a thin wrapper over `checkCensus()` with PASS/FAIL rows. It would owe:

1. a standing row in the derived gate roster and in `standing-values.json`, with its PASS/FAIL counts recorded by the coordinator (`--write` is not this slice's);
2. an entry in the instruments index (the reference generator picks it up automatically, and `generate-procgen-reference.mjs` must be re-run);
3. its import and `--help` doors inert. The same shape as `census-seedling-constants.mjs` already passes both;
4. a decision on the AS3-absent path. The `as3` comparison would be a SKIP row there, not a PASS.

The vitest file stays the gate either way. The roster row would add the census to the headless CI roll-up.
