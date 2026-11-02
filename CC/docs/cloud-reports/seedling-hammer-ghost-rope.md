# Seedling hammer-phase GHOSTROPE — the PULL rung cuts a rope with the Ghost Sword

Session `seedling-hammer-ghost-rope` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. No mid-run scope
message arrived; the scope is the brief's.

## 1. SHAs

| | |
|---|---|
| start (origin/main) | `844045138652e39ff598dd8a1a5cf87bfc4957d5` |
| branch | `claude/seedling-ghostrope-slice-x8g4qz` |
| W0 | `fed347cb` (game witness) |
| I | `46fc0252` (switch, solver, rows, fixtures) |
| D | `b15a900e`, `dde73866` (docs, evidence, boxLock roster, references) |
| head | this report's commit (on top of `dde73866`) |

## 2. The answers

| Question | Answer |
|---|---|
| Does the Ghost Sword cut a rope in the game? | **Yes.** Witnessed on p4g headless: cut from 15.1 and 23.1 px, not from 27.1 px; the plain sword does not cut from 23.1 px. `{16,0}` is written at t3 (the model's pull is t2, +1). Game = model at 0 px on every tick. |
| Did model and game agree before the fix? | **Yes, in the run.** `levelRun` already models a ghost swing pulling a `RopeStart` (`GHOST_PRESS_ARMS.RopeStart`). The gap is the **solver only**: three gates asked for `primaryWeapon === 'sword'`. |
| Does the endgame ropegate room solve after the fix, game-modelled? | **Yes, ON** (`SEEDLING_GHOST_ROPE_CUT=1`). The lab's ENDGAME `ropegate` rooms, seeds 1–3: OFF all REFUSED at the PULL rung; ON all SOLVED (`pull` with the ghost sword, then `collect`; 144 / 125 / 120 t). Each tape replays in the model with the rope pulled and 0 hits. The generated rooms cannot load on the game page, so the game witness is L16 instead: the solver's own ON `rope` plan there plays on the game exactly as planned. |
| Do my answers depend on the CHOOSER_PAIR flip? | **No.** No L40 or chooser decision is involved. A ghost-sword rope room has no chooser pair, and producers and the identity block are unmoved either way. I did not re-measure with `SEEDLING_CHOOSER_PAIR=1` because no row here reaches it. |

**The one thing to know first:** the Ghost Sword cuts ropes in the game, and the run already knew it. The PULL rung and
the `rope` verb simply never asked a `ghostsword` primary. Pricing that ask honestly took three things the sword never
needed, each measured: the wider rect (it can toggle a LightPole the sword can't reach), the press's own dash (the
player slides about 5 px during the seven tests), and a facing that flips on the diagonal under the aim tap.

## 3. W0

- **Identity block** at the start content (W0 commit, solver untouched): `evidence/identity-block-before.txt`.
  The reference row read "2 DIFFER" at W0 because W0 added a new probe and the instruments index is regenerated in I.
- **Producers** `ci-producer-checks --jobs=4` at the start content: 97 run, every producer exit 0. The battery's single
  "red" was its TREE-MOVED guard, tripped by my own W0 files being written into the tree while it ran (my ordering
  mistake, not a producer). `evidence/producers-before.txt`.
- **The AS3** (`vendor/seedling/src/Player.as`):
  - `update()` calls `slash()` only `if (hasSword)` (`:560`). The endgame bag holds both flags, and the slot holds item 4
    alone (the ghost sword replaced the sword).
  - `getSlashRect` (`:931`): `h = hasGhostSword ? width*2 : height`, so the rect is 24 along and 48 across.
  - `slash()` reach is `distanceRectPoint <= width*scaleX`, which is 24.
  - The line test is waived by `|| hasGhostSword || … || type == "Rope"` (`:917`).
  - `genericHit` → `RopeStart.hit()` (`:1095`) takes no `t`, so the hit type "Spear" is irrelevant to a rope.
- **The wasm witness** (`scripts/procgen/probe-seedling-ghost-rope.mjs`, `frontend/modules/seedlingDemo/ghostRopeWitness.js`,
  `fixtures/ghost-rope-witness/`). L16's `rope@32,16`, r9-solve-16's staging; each tape is one face tap up, one press,
  and an idle tail:

  | witness | bag | first test from (d) | game cut | model |
  |---|---|---|---|---|
  | `ghostrope-l16-near` | sword + ghost | (80,47.1), 15.1 px | t3 | pull t2 |
  | `ghostrope-l16-reach` | sword + ghost | (80,55.1), 23.1 px | t3 | pull t2 |
  | `ghostrope-l16-reach-sword` | sword | (80,55.1), 23.1 px | none | none |
  | `ghostrope-l16-out` | sword + ghost | (80,59.1), 27.1 px | none | none |
  | `ghostrope-l16-verb-plan` (the solver's ON plan) | sword + ghost | (80,47.1) | t5 | pull t4 |

  0 px on all 73 sampled ticks, no hits.
- **What the model believed:** the run cuts with a ghost swing (`levelRun.applyThrust` ghost arm → `pullRope`). The
  solver did not ask it:
  1. The PULL rung's weapon branch: `weapon !== 'sword'`. With `ropeCutAnyWeapon` (ON) that went to `resolveRopeCut`,
     whose `ropeCutWeapons` skips the sword while `hasGhostSword` is up and has no ghost row.
  2. The rung's later-lane probe: `primaryWeapon === 'sword'`.
  3. The `rope` verb (`resolveRopeStrategy`): the same gates.
- **Related switches:**
  - `SEEDLING_GHOSTSWORD` (ON): models the ghost press. It already pulls ropes in the run.
  - `SEEDLING_GHOSTMOTION` (ON): the ghost swing's 7/6 release clock and its dash.
  - `SEEDLING_ROPE_CUT_VERB` (ON): the `rope` verb.
  - `SEEDLING_ROPE_CUT_ANY_WEAPON` (ON): spear and fire cuts, plus a held sword selected by `equip`. It skips the sword
    when the ghost is held, and has no ghost row.
  - `SEEDLING_GHOST_SPINNER_PRESS` and `SEEDLING_GHOST_KILL_RUNG` (both ON): spinner press kills only. They do nothing
    for a rope.
- **The refusal, reproduced:** `seedlingSeam` with `ENDGAME_PALETTE.items`, a 10x10 `empty` skeleton and
  `elements=ropegate`, capturing the certification solve's own record through `wrapOracle`
  (`evidence/capture-endgame-fixtures.mjs`). All three seeds refuse in the PULL rung:
  *"pull: rope@32,96 silences [arrowtrap@48,16] (group t=32), but the run's `primary` slot fires `ghostsword` and no
  slot holds a Sword, Fire or Spear"* (seed 1). Fixtures: `fixtures/ghost-rope/endgame-ropegate-s{1,2,3}.json`, about
  2.5 KB each, uncut.

## 4. M — design

The game cuts, so the honest answer is an arm, not a named refusal.

| Option | What | Verdict |
|---|---|---|
| (1) the rung asks the cut with the weapon the slot holds, priced with the ghost's own press | `deriveSwingStance` / `execPull` take a `press` (`ROPE_SWING_PRESS`: reach, rect, tests); null = the sword's, so every OFF caller is byte-identical | **chosen** |
| (2) a separate ghost-rope arm | a second stance derivation and executor beside `execPull` | rejected: duplicates the aim/press/latch post-condition the rung already owns, and two writers of one cut |
| price with the sword's rect (the `break` verb's precedent: the sword's stance set is a subset) | sound for the rope rect itself | rejected: the ghost's 48-wide rect also reaches what the sword's does (see below), and the brief asks for the ghost's own price |

Scratch measurements on a hand-built 20x15 rope room with a `LightPole` (tag 2). Each one changed the design:

1. **The wider rect matters.** Pole at tile (2,13): from (24,184) facing down, the ghost rect's audit holds
   `RopeStart@16,192` and `LightPole@32,208` (pole box 35–45 × 200–216, d 19.4 ≤ 24), while the sword's holds only the
   rope. So the stance is admitted off `GHOST_ROPE_STRAY_ARMS` (LightPole; plus every `GHOST_PRESS_ARMS` row marked
   `refused`: bridge Tile, PushableBlockSpear, which `levelRun` throws on).
2. **The press dashes.** The first stance-only version still toggled the pole: the press at (20,173) slid to y 179 by
   the seventh test (`presses` ledger). The audit is now swept along the facing by `DASH_DISPLACEMENT.total` (9 px), and
   the press waits for rest first.
3. **The facing flips on the diagonal.** At stance (60,172) the aim tap moved the player to (59.2,172) and
   `facingToward` turned LEFT → DOWN, onto the pole. So the facing is fixed at the first ask, and the press-time stray
   check uses it. The derivation adds 4 px slack (arrival, aim and settle measured about 2 px off).

Pole sweep (12 positions, `ON` vs the sword-rect mutant) is in the session log. With the pole at (3,13): ON
cuts from (20,172), 20 px off the rope, which is beyond the sword's 16, pressed by the verb at t103, and the replay
toggles no pole. The mutant stands at (24,184).

## 5. I — the fix

- **Switch:** `frontend/modules/seedlingDemo/ghostRopeCut.js`, `GHOST_ROPE_CUT` **OFF** (`SEEDLING_GHOST_ROPE_CUT=1`,
  `withGhostRopeCut`). Its `SOLVER_ENV_NAMES` line is added (sorted, rewrapped). The docblock quotes the user's ruling.
  It is a solver-family file, so it imports its simulation symbols through `solverView.js`. The door gains
  `GHOST_PRESS_ARMS` and `GHOST_SLASH_ANIM_TICKS`; both table rows are classified `seedling` / `constant`.
- **`solverBot.js`, all ON-only:**
  - `ghostRopeSwing(run)`: the priced ghost swing with `stray`.
  - `swingReaches`, `breakStanceCandidates` and `deriveSwingStance` take a `press`.
  - `execPull` prices with it; a ghost press is made at rest with a fixed facing, re-asks `stray` exactly, and bounds
    by seven tests.
  - The PULL rung's weapon branch and its later-lane gate admit the ghost swing, as does the `rope` verb (an order
    carries `swing`).
  - `ropeCutWeapons` lists a held ghost slot in the sword's place (never the plain sword).
  - `resolveRopeCut`, `ropeCutOrder` and `execRopeCutOnce` treat it as a swing.
  - OFF: every new branch keys on a null `press` / `ghostSwing`, and the refusal texts keep the old spelling
    (`SLASH_REACH (16 px)`).
- **Rows** (`hammerGhostRope.test.js`, 13):
  - the game recordings pinned (facts table), and the solver's ON plan equal to the recorded tape;
  - the press table between the witnessed distances;
  - ships OFF, plus `ropeSwingFor` (OFF null; ON ghost, never sword; ghost-without-sword null);
  - fixtures s1–3: OFF refused naming `ghostsword`; ON `pull`(ghostsword) + `collect`, no equip, replay pulls the rope
    with 0 hits;
  - a SWORD bag ON = OFF (byte-identical solve, `ms` aside);
  - a NO-ROPE room ON = OFF;
  - the pole geometry (ghost rect reaches, sword's doesn't);
  - the pole room ON: stance (20,172), d in (16, 24], no pole toggled; OFF refused;
  - L16 verb: OFF refused, ON `arm: 'verb'`, `weapon: 'ghostsword'`.
- **Mutants** (temporary env knobs, removed):

  | mutant | red rows |
  |---|---|
  | the plain sword's row in the ghost's place (`{...ghost, ...ROPE_SWING_PRESS.sword}`) | 5 (s1, s2, s3, pole room, L16 verb) |
  | the ghost priced with the sword's rect and reach | 2 (pole room; L16 verb — its live position is in reach of the ghost only, after the settle) |
  | the arm dropped (`ghostRopeSwing` → null) | 5 |

- **ON radius, by mover class:**
  - *Intended:* the three ENDGAME ropegate fixtures (REFUSED → SOLVED); L16 with the endgame pair (the verb cuts).
  - *Partial:* L16's full crossing from the L15 arrival with the ghost pair now passes the lanes and stops at
    `lock@320,112` (the sword route's next step is `weigh`) — a different obstacle, out of scope.
  - *None elsewhere:* producers 97 run / 0 red ON; identity block ON identical to OFF on every digest row (r9 campaign
    included); the route survey cannot move (`--through=end`: the ghost sword arrives at step 222, L106; the last
    rope-room step is 148, L39).

## 6. D — gates

| Gate | Result |
|---|---|
| bounded vitest by path (209 files: every test naming rope / ROPE_CUT / PULL / pull rung / ghost / GHOSTSWORD / ropegate, the hammer rows, solverEnvChannel) | default tier 198 files: 5705 / 5706 on the battery run. The one red was `boxLock.test.js` naming my new probe (an import-door-guarded taker not on the declared list). Fixed in `dde73866`; 26/26 after, and green at the start SHA. |
| slow battery (11 `.slow` files, the hammer slow rows among them) | **11 / 11 files, 106 / 106 tests** |
| `ci-producer-checks --jobs=4` | defaults 97 run / 0 red; `SEEDLING_GHOST_ROPE_CUT=1` 97 run / 0 red |
| `identity-block.sh` | after = before on every digest row (OFF and ON). The reference row was stale only from my own docs edits, and was regenerated in `dde73866`. |
| `census-seedling-solver-surface --check` | `--write` (lines moved, the door rows); 2 new rows classified; GREEN 367 rows |
| `census-seedling-constants --check` | PASS (7038 literals, 0 drift) |
| `generate-procgen-reference` → `--check` | ALL 7 MODULES AND 5 REGIONS MATCH |
| `generate-docs-index --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless) | ALL PASS |
| `check-procgen-help` | ALL PASS (522 instruments) |
| `solverEnvChannel.test.js` | green |
| JSUT | run at `dde73866`: see § 6a |

### 6a. JSUT

JSUT for `dde73866` was still running when this report was committed; the planner reads it with `node scripts/procgen/ci-summary.mjs dde73866522d4aa922506c9cb7c96fbde7073f85`. The local slow battery (11 files, 106 tests) is green. If CI answers before the session ends, a follow-up commit records it here.

## 7. What the harvest A/B should expect

- **OFF: no movers.** OFF is byte-identical by construction (null `press`), and measured: producers, the identity
  block, and the bounded set.
- **ON:** only rooms where a `ghostsword` primary meets a rope move. The atlas route never holds the ghost sword in a
  rope room (L16 / L28 / L39 are all visited before L106), so the route survey and the divergence legs on the route
  should be unmoved. Generated ENDGAME rooms with `ropegate` move from REFUSED to SOLVED.
- **Game witness to dispatch** (I cannot `workflow_dispatch` from the cloud): the L16 cut is witnessed here. A
  sweep/survey A/B with `solver_env=SEEDLING_GHOST_ROPE_CUT=1` is expected to show no route-leg movers. The endgame
  ropegate rooms are generated, so their witness is the lab page with `?elements=ropegate` (endgame preset) and
  `?seedlingSolverEnv=SEEDLING_GHOST_ROPE_CUT=1`.

## 8. What the brief got wrong (measured)

- *"The PULL rung does not cut the rope when the primary slot holds the Ghost Sword"* is right, but it is not one gate:
  it is three (the weapon branch, the later-lane probe, the `rope` verb), plus `ropeCutWeapons`' missing ghost row.
- The run's model was not the problem. `levelRun` already cuts a rope with a ghost swing, and the game agrees.
- "Price with the Ghost Sword's own rect/reach" is necessary but not sufficient. The press's dash and the
  diagonal-facing flip had to be modelled too, or the walk toggles a pole the plan never priced.

## 9. Residue and hand-overs

- **The lab generator (hand-over, not edited):** `ELEMENT_TABLE.ropegate.needs: ['hasSword']` is honest. An endgame bag
  holds `hasSword` (the ghost sword needs it: `slash()` is `if (hasSword)`), and ON the solver now certifies those rooms.
  Nothing to change there, except that until the switch flips, endgame `ropegate` rooms stay refused by the solver.
- **L16's full crossing with the ghost pair** refuses at `lock@320,112` after the lanes (the weigh step). Not
  investigated; outside this slice.
- **The walk's own strikes** (the strike policy and the dash windows, the SLASHRECT / AXIS territory) can pull the rope,
  and can toggle a nearby LightPole, in passing with the ghost sword. Measured in the pole sweep: poles at (2,10) and
  (1,10) were toggled by the approach's strikes, ON and in the mutant alike. That is a real game event and the run
  models it, but no plan prices it. Hand-over to the strike-scan slices.
- **The stray audit uses census rects for pushables** (`auditPress` with no live `pushables`). A PushableBlockSpear
  that has moved is audited where it was built; the press-time check would then miss it and `levelRun` would throw by
  name. No measured case.
- **Conservative margins:** the 9 px dash sweep and the 4 px derivation slack can only remove stances. In the pole room
  they rejected (24,184) even with the pole at (3,13), where the exact ghost rect would not touch it.
