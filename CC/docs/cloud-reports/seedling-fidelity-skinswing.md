# Seedling fidelity SKINSWING — does the game land the two art-stands' swings? (a WITNESS slice)

| | |
|---|---|
| Session | `seedling-fidelity-skinswing` (planner `seedling-fidelity-planning-10`, wave 26) |
| Start SHA | `3ac4f7751d` (main) |
| Code head | `9e5901c8` (the report and the regenerated reference index are the commits after it) |
| Harness branch | `claude/seedling-fidelity-skinswing-bn1shn` (the harness's branch, checked out at `3ac4f7751d`; nothing pushed elsewhere) |
| Port | 9719 |
| Verdicts | **W0 PASS · D1 PASS — verdict (a): the game matches `pixelMaskSightLines` ON (0 px, both stands, 300 ticks) · one NEW model gap found on the re-site search (not the line; pinned, handed over)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-skinswing-evidence/` |

## The one thing to know first

**The game does not land those swings either. The model with the key ON is right, and the stands are mis-sited: both boots
put the player INSIDE a "Dark Stone" tile.** L71's boot [96,200] puts the player at (104,208) and L74's [80,100] at
(88,108). The player never moves in 300 ticks of FIGHT, on the game or in the model, and every swing line's FIRST sample
(the player's own point) is that solid tile. The brief's guess, "the line meets a wall near the boot", is close but wrong:
nothing stands *between* the player and the bodies. The player is standing in the wall. So js re-sites the stands and drops
the OFF pin. Here are two game-measured offers: **L74 (64,100)** reproduces at 0 px. **L71 (80,208)** meets every `want`
row, but it hits a different model gap (below).

## W0 (PASS)

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9719 bash scripts/procgen/identity-block.sh .` | 24 rows, byte-equal to the MASKS head's published block (`seedling-fidelity-masks-evidence/identity-head.txt`); file md5 `e484c3b22d5c5b3940b1112e458a8a1b` (`evidence/identity-head.txt`) |
| constants | `node scripts/procgen/census-seedling-constants.mjs --check` | PASS (6894 literals, 0 drift) |
| solver surface | `node scripts/procgen/census-seedling-solver-surface.mjs --check` | GREEN: 343 rows |
| help doors | `node scripts/procgen/check-procgen-help.mjs` (at `ba00f93d`, probe tracked) | ALL PASS, 462 instruments |
| procgen reference | `node scripts/procgen/generate-procgen-reference.mjs --check` | **red at the base too** (measured with my files moved out): `registry.js` `fields` 26 → 25, `capabilities.js` and the two capability matrices drop `noiz2sa`. The cause is that the `bulletml-dodge` submodule is not initialised in this checkout. That part was left as committed; only the rows my probe and my log entry move were regenerated |
| bounded vitest | `npx vitest run <72 files>` (`evidence/bounded-vitest-files.txt`; the brief's list + `fidelitySkinSwing`, `seedlingEnemySkin`, `fidelityMasks`, `fidelityBulb`, `fidelityDrill`) | 1925 / 1926 passed, 1 red: `boxLock.test.js`'s "takes conditionally" row, which named my new probe (an undeclared import-door taker). Fixed by declaring it: 26/26. `apReportBosses` has no test file on this base |

There was no separate BEFORE run. This slice changes no tracked source. Its only edits to existing files are one row in
`boxLock.test.js`'s declared list, the bot log, and the generated instruments index. The AFTER set is therefore the BEFORE
set plus the new rows.

## D1 — the game witnesses (PASS; p4g, headless logic-only)

`scripts/procgen/probe-seedling-skin-swing.mjs --record` → `frontend/modules/seedlingDemo/fixtures/skinswing-witness/`. These
fixtures sit outside the tape roster. Each witness is a staged tape: the stand's boot, `hasSword`, and the skin test's FIGHT
keys for 300 ticks. `fidelitySkinSwing.test.js` pins that this staged run **is** the stand's `createJsRuntime` boot, tick for
tick: the player and every chaser's id, position and hits, ON. On the game, every poll reads `botStatus` and `botMobiles`
(each chaser's position, `enemy.hits`, anim). The probe was played twice (the first play `evidence/probe-first-play.txt`,
the recording `evidence/probe-record.txt`), and the two game plays agree.

| witness | game | key ON | key OFF |
|---|---|---|---|
| `skinswing-l71-lavarunner` (L71 [96,200]) | player pinned at (104,208); 5 lavarunners; **0 hits, 0 'die' frames** in 300 t | **0 px** (300 ticks: player, positions, hits); every refusal that reaches the line names `tile:Dark Stone at (104, 208)` (183 refusals: 179 line, 4 `distanceRectPoint > 16`) | leaves at **t3**: `lavarunner@72,208` hits game 0 model 1 (910 rows); its tape run then hits L71's undeclared kill lock at t227 |
| `skinswing-l74-bulb` (L74 [80,100]) | player pinned at (88,108); bulb + 2 lavarunners; **0 hits, 0 'die'** | **0 px**; every line refusal names `tile:Dark Stone at (88, 108)` (108) | leaves at **t21**: `bulb@48,112` hits game 0 model 1 (658 rows) |
| `skinswing-l74-resite` (L74 (64,100)), an offer | lands (`bulb` t2, `lavarunner@24,56` t47, t77), kills, 'die' shown | **0 px** (298 ticks) | **0 px** (ON = OFF: the line is clear) |
| `skinswing-l71-resite` (L71 (80,208)), an offer | lands and kills (243 'die' body-ticks) | 0 px to t62, then **leaves at t63** | identical to ON (the line is clear; this is another gap) |

**Verdict (a).** The game matches ON. Per the brief this is js's edit: re-site both stands so a swing is clear, re-record the
goldens, and drop the OFF pin and the ON = 0-die row. The offers, checked against the skin test's own `want` rows with the
key ON (`evidence/want-check.txt`):

| stand | offer | ON 'die' frames | want rows |
|---|---|---|---|
| `bulb-L74` | **(64,100)** | 47 | walk ✓ drop ✓ die ✓ (tint ✓ mirror ✓, not required) |
| `lavarunner-L71` | **(80,208)** | 244 | walk ✓ die ✓ tint ✓ mirror ✓ |

L71's offer is a change detector of the renderer like every golden, so the t63 gap below does not stop it serving as a
skin stand. It does stop it serving as a fidelity claim.

**The new model gap: a body removed this tick still blocks (handed over; not this slice's region).** On every L71 kill site
I tried, (80,208), (72,208), (64,200), (64,192) and (80,216), ON and OFF diverge from the game identically, and always on a
tick where a dead body is removed. On that tick, a surviving lavarunner that updates later than the removed body is blocked
on the axis toward it in the game and moves in the model. Example (`skinswing-l71-resite`, t62 → t63): three bodies are
removed, and the game's `lavarunner@64,192` stays at y 203.303 while the model's moves to 204.467. One tick later the two
step alike, one tick apart. The mechanism, read in the source:

- `World.remove` (`net/flashpunk/World.as:118-124`) only queues the body in `_remove`.
- `updateLists` (`:895-911`) takes it out of the type lists after the frame.
- `LavaRunner.solids` carries "Enemy" (`Enemies/LavaRunner.as:43`; `Bob.as:39` too).

So a body removed mid-update stays a solid to the bodies that update after it that tick. The model sets `c.removed = true`
in `stepChaserEntity`'s fade (`levelRun.js` ~13135) and the bodies stepped after it skip it at once. The pinned row is
`fidelitySkinSwing.test.js`'s `skinswing-l71-resite` (the first divergence `t 63 lavarunner@64,192 …`, ON = OFF). A fix
should turn it red; re-pin it to 0 px then. It is witnessed on the game, but I did not model it: the chaser step is outside
a witness slice, and the fix would move tapes. **To the planner: a model slice, behind a new key, witness first: these
fixtures.**

## Mutants (each predicted first; copy + edit + run + restore; tree verified clean after)

| mutant | predicted | measured |
|---|---|---|
| m1 `levelRun.js:7350` the chaser `lineBlocker` never asked (`false && …`) | both stand rows red (the model lands what the game does not, L71 t3 / L74 t21) | as predicted: those 2 rows red (910 / 658 divergence rows), plus the L71 path-identity row (its ON run now kills and meets the kill lock) |
| m2 `compareSkinSwing` ignores a body's `hits` | the "OFF leaves at t3 / t21" rows red | as predicted: the first OFF divergence slips to t4 / t23 (position) |

## Movers

**None.** This slice adds no switch and no model edit, and no default changes. No tape, producer `--check`, route-survey step
or sweep leg can move. The re-site search (`evidence/resite-search.mjs`) is model-only scratch. **CI dispatches owed: none.**
The planner may optionally reproduce the witness itself on any box with the dev server:
`SEEDLING_PORT=<port> node scripts/procgen/probe-seedling-skin-swing.mjs` (no `--record`). It takes the box lock.

## The JS arc

- **Pins that move:** none on this branch. When js re-sites the stands:
  - `seedlingEnemySkin.test.js`'s TAPES rows `lavarunner-L71` / `bulb-L74` change their `at`, and their goldens are
    re-recorded (`UPDATE_SKIN_GOLDENS=1`).
  - The `fidelity: { pixelMaskSightLines: false }` pin goes, and so does the ON = 0-die `it.each` row.
  - `fidelitySkinSwing.test.js`'s first row reads the TAPES rows' `level/at/n/keys` **as text** and filters out the
    `resite` witnesses. After a re-site it will red on the two stand witnesses. Js re-points them in the same commit: either
    mark the original two as historical (the measured fact stays true of that boot) or swap the stand names onto the resite
    rows.
- **To wire:** nothing. No new staging or result field, no new refusal kind.

## Hammer arc

Nothing handed over.

## Deltas

- New: `frontend/modules/seedlingDemo/fidelitySkinSwing.js` (witnesses, tape, model sampler, comparator),
  `fidelitySkinSwing.test.js` (7 rows), `fixtures/skinswing-witness/` (4 recordings),
  `scripts/procgen/probe-seedling-skin-swing.mjs` (box lock, behind the import door; `--boot=L,x,y` for ad-hoc stands).
- `scripts/procgen/boxLock.test.js`: the probe added to the declared import-door list (a row appended).
- `frontend/modules/procgenDocs/generated/instruments.js`, `docsIndex.js`, and the `architecture.md` / `README.md` generated
  regions: regenerated for the new probe and the log entry only.
- `seedling-bot-log.md`: the SKINSWING entry with two trap candidates.

## What the brief got wrong (measured)

1. "the chaser line of sight … against the walls near [96,200] / [80,100]": the boots put the player **inside** a Dark Stone
   tile, and the line's first sample is the player's own point. The stands' 'walk' frames are the enemies'. The player never
   walks.
2. "A pinned row asserts ON = 0 die frames … nobody has asked the game": the OFF pin is not just unwitnessed. It is
   *contradicted* by the game, from t3 (L71) and t21 (L74).
3. `generate-procgen-reference.mjs --check` is red in this checkout before any change, because of the uninitialised
   `bulletml-dodge` submodule. That is not a slice defect.
4. The brief's local branch name `seedling-fidelity-skinswing`. I worked on the harness's `claude/…-bn1shn` at the same base SHA.
5. `apReportBosses` (in the bounded set) has no test file at this base, only `apReportBosses.js`.

## Residue

- The removal-tick blocking gap (above) is open, witnessed and pinned.
- `generate-procgen-reference.mjs --out=` also rewrites the markdown regions IN PLACE. Its `--out` moves only the modules.
  I reverted the two environment-caused regions by hand. Worth a line in its help.

## Byte-inertia

No tracked model or runtime source changed. The identity block is equal to the published values, constants and surface
checks are green, and both seedlingEnemySkin and fidelityMasks are green in the bounded set.

## Rows to BANK

- `fidelitySkinSwing.test.js` (7 rows): the stand ⇔ staged-tape identity ×2, the game witnesses ×2 (ON 0 px, OFF t3 / t21),
  the L74 resite (0 px both arms), and the L71 resite known-gap pin (t63).
- The verdict as a fact: **the game lands no FIGHT swing at L71 [96,200] or L74 [80,100]; the player spawns inside Dark Stone.**
