# Seedling swim U2: the lane entry (R-h′) · `keylock: undefined` · the staged-grant derivation · the through-2.2 survey

**Slice:** `seedling-swim-u2`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §14). It ran in parallel with `seedling-swim-u3`, which owns the kill rung, `levelRun.js` and the generator's element heads. This slice touched none of those regions.

| | |
|---|---|
| Started from | `origin/main` @ `a8225ce975` (the brief's expected SHA; the harness branch already sat on it) |
| Harness branch | `claude/seedling-swim-u2-lane-entry-8jg9oy` |
| Commits | D1 `b79f9d19` · D2 `4e677318` · D3 `b6fe6ec4` · D4 `3591750a` (survey JSON) · D5 `73efc533` · this report |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduces U1's. The W0 survey rows are U1's § D4 rows verbatim (24/27/28 REFUSED, 29 SOLVED 210). |
| D1 | **PASS** | The measurement: x leaves the 0.05 grid at t=14, the 2nd tick of a `right+up` hold. The shape shipped is (a), an axis-aligned stance walk. **Step 27 SOLVES from the route's arrival in 383 t.** It also fixed a latent U1 order bug in `skirtAlignment`. |
| D2 | **PASS** | The refusal reads `keylock: bosslock@… needs a key`. |
| D3 | **PASS** | The grant is derived from the route's earlier pickups. Steps 22/23 did not move (48/229). The default mode md5s are identical. |
| D4 | **PASS** | **7/9.** Predicted 8/9-or-7/9 with 24 a named refusal. Step 24 came back TIMEOUT at 180 s; unbounded, it REFUSES by the predicted name (`puncher@416,256`) at 347.7 s. |
| D5 | **PASS** | Log § U2-swim, a bot-page sentence, the reference and docs index regenerated, surface GREEN 184, bounded vitest green. |

**The one thing to know first.** L29's lane was never out of reach. The route's own walk knocked x off the grid. `applyFriction` is exact on one axis and irrational on a diagonal. The string-pulled walk to the stance held `right+up` from t=13, so from t=14 on x carried an irrational fraction, which no x-only input can remove. The fix is an axis-aligned walk to the stance, used by `skirt` only. With it the route arrives on the grid, the x-only alignment lands exactly on 126, and step 27 solves.

## W0: the banked rows

All were measured on the clean tree `a8225ce975`.

| Row | Result |
|---|---|
| `census-seedling-campaign.mjs` | exit 0, `NO CHAIN ROOM MOVES`, md5 `88fa2333013aaabb84298f0f4fd5d72a` |
| six r8/r9 `--check`s | all exit 0: `410f27c0` `b470c14d` `17be7d70` `9a6a3192` `6cd35fe1` `2823a811` |
| survey `--derive-only` / `route.json` | `27ff43dbb8e4d4e08c3dc741c5a02bc7` / `1e08f9ad37c505a5ca8360a882cc6b96` |
| through-2.2 derive / route | `1172328c2090c1d43eabe10bce74430a` / `dae52ec7bc2fc6b4a158833911ebcf7e` |
| solver surface `--check` | GREEN, 184 |
| `census-seedling-constants --check` | PASS |
| identity block (`SEEDLING_PORT=8820`), stdout md5 | `1d0f29aa5ece6a139304b06540caebd8`. Every row matches U1's published values: maze `246dfbce…` … post-sword s1 `9219ff91…`, generated set OK, reference ALL MATCH |
| bounded vitest BEFORE (the brief's five paths), in a pristine worktree at `a8225ce975` | 8 files / 211 tests, green |
| survey `--through=2.2 --only=24,27,28,29 --out=/tmp/w0.json` (pristine worktree) | 24 REFUSED on `shieldlocknorm@288,704 needs Player.hasShield` · 27 REFUSED on `skirt … (x=125.97137961649308, vx=0) EXACTLY onto x=126` · 28 REFUSED `keylock: undefined needs a key` · **29 SOLVED 210** |
| baseline for D3, `--only=22,23` (pristine worktree, no grants) | 22 SOLVED **48**, 23 SOLVED **229** |

⚠ **Timing.** The main tree's identity-block row finished at 20:10:59, before my first edit landed, and its values equal U1's table. A second copy that I ran in a bare `git worktree` is **invalid**: every row printed `d41d8cd9…`, the md5 of empty input, because the worktree has no submodules. I did not use it. The worktree's `--check`s, vitest and survey rows are valid, since they need no submodule.

## D1: R-h′, the lane entry (`b79f9d19`)

**The measurement.** I replayed the route's step-27 walk in the model (`r8-solve-11` staged at L29 (16,224), which boots at (24,232)) and printed x's fraction per tick.

- x is on the 0.05 grid through t=13. The early holds are `right`, `left`, `right+primary` (the sword dash along x), none, and at t=13 `right+up` (x=40.249999999999986, on the grid at float precision).
- **x leaves the grid at t=14**, the second tick of the `right+up` hold: x = 41.67322330470335, v = (1.4232233047033631, −1.4232233047033631). At t=13 the velocity was (0.8, −0.8). Friction first scales that diagonal by (|v|−0.25)/|v|, then the input adds 0.8 per axis.
- The old walk reached the stance at t=95 on x = 125.97137961649308, U1's number exactly.

The brief's claim holds: a walk that never holds two axes keeps an integral arrival x on the grid.

**The shape shipped: (a).**
- **`botDriverV2.holdOneAxis(held, state, target)`.** It never holds a second axis while the first still has velocity; it drops the keys on the axis at rest. From rest, a two-axis choice keeps the axis with the farther remaining distance. Other keys pass through.
- **`drive({axisAligned})`** applies it after the strike policy. `solverBot.previewWalk({axisAligned})` applies it at the same point, so ruling 30(c)'s preview = drive equality holds.
- **`planWaypoints({manhattan})`** returns the 4-connected A\* path's corners, with no string-pull.
- **`walkTo({axisAligned})`** plans Manhattan and walks with **no sword dash and no opportunistic strike**, because either would press keys that add the second axis. It is asked only by a resolution carrying `approach: 'axis-aligned'`, and only `resolveSkirtStrategy` returns that.
- `SKIRT_ALIGN_DEPTH` is unchanged (16).
- ⛔ **A U1 defect it surfaced.** `skirtAlignment`'s x-only step composed `applyFriction(applyInput(v))`. The step is friction FIRST (`playerPhysicsV1.js`: `v = applyFriction(v, f)` above `applyInput`). U1 never found a sequence in L29, so its search → run compare never ran. The first sequence my change found was run and disagreed: searched vx 0, run vx `0.1000000000000001`. The order is fixed. U1's "8 ticks from 125.5" offline figure came from the same mis-ordered step.

**The numbers.**

| | U1 (diagonal walk) | U2 (axis-aligned) |
|---|---|---|
| walk to the stance | 95 t, arrives x=125.97137961649308 | **215 t**, arrives x=126.00000000000001 (the grid plus float drift), y=151.7 |
| align | none found (refused) | **10 t** `[right - - left right right - - - -]`, landing exactly on x=126 (125.9 + 0.1000000000000001) |
| pass | — | 28 t (t=226–253; U1's boot-on-lane pass was 28 t too) |
| step 27 | REFUSED | **SOLVED 383 t** |

The diagonal-free walk to the stance is **120 t longer** (215 vs 95).

**Step 27's ticks, predicted vs measured.** ⚠ Honestly: the scratch probe gave 383 before I had written a number down, so D1 has no independent prediction. The D4 survey row was then predicted at 383 and measured 383. The components are the ones above; the skirt record reads `from: 215, ticks: 38`.

**Unit rows** (`solverSkirt.test.js`, 4 rows):
- the route row SOLVES in 383 t: `records[0]` is the skirt (`from 215, ticks 38, rocksStanding [fallrock@112,112]`), then `collect bosskey@112,64`, then `reach-exit → 31 @ t=383`; `keys [1]`, `rockFalls []`, `playerHits []`;
- over t = 1…253, no tick holds an x key and a y key together, and no tick has vx ≠ 0 and vy ≠ 0 together;
- the stance x is a multiple of 0.05 (within 1e-9), and x is exactly 126 after the align;
- a `holdOneAxis` row;
- U1's boot-on-lane row is unchanged (150 t).

**Mutant (a)**, `approach: 'axis-aligned'` → `null`. Predicted: the route row reds with U1's text, byte-identical. Measured: 1 failed / 3 passed. The error text is *"skirt (button@112,128, east lane x=126): no x-input sequence of at most 16 ticks takes the stance state (x=125.97137961649308, vx=0) EXACTLY onto x=126 at rest — the lane admits that one x and the model keeps sub-pixel remainders."* Restored md5-identical (`ff799f94…`).

The `hold` buttons (L4, L5) are untouched. The identity block, the campaign census and the six `--check`s are identical (below).

## D2: `keylock: undefined` (`4e677318`)

The branch the brief calls "held-key" is the key-**not**-held one (`held: false`). It returned without `lock`, so `execKeylock` printed `${resolved.lock}` = `undefined`. The branch now carries `lock: obstacle.id` and `keyType`. The text row is in `procgenPostSword.test.js` (`key-keylock-pair`): `keylock: bosslock@64,80 needs a key this run does not hold`, and it does not match `undefined needs a key`. The kill rung's `resolved.lock` reads are a different object (U3's region), and I left them alone.

## D3: the staged-grant derivation (`b6fe6ec4`)

`STAGED_SAVE_GRANTS` (one hand row) is gone. Under `--through` only, `surveyGrants.deriveStagedGrant` builds each staged step's grant from the route's pickups at earlier steps, as follows.
- It maps AP name → `games/seedling.json` `ap_items` flash name. A `!`-progressive name counts its copies through `progressive_items`.
- `key<N>` → `save.keys[N]`, the v6 save block.
- An item → `items[].property` → `seam.items.<property>`, the v8 block. This is the door the latch's own `hasSword` uses and the watch page's form writes to; `grants` is a tape crutch and was not used.
- An item the latch already holds is `latched` and not written. The Sword must be one of them, asserted: the latch is post-sword.
- A non-boolean item (`health`) refuses by name.

Each row records `boot.saveGrant = {keys, items, latched, from: [{step, item, grants}]}`.

| staged steps | grants written | latched | source steps |
|---|---|---|---|
| 12–19 | — | `hasSword` | 10 (Sword) |
| 22–27 | `save.keys [0]`, `seam.items.hasShield` | `hasSword` | 10, 20 (Red Key), 21 (Shield) |
| 28–30 | `save.keys [0, 1]`, `seam.items.hasShield` | `hasSword` | 10, 20, 21, 27 (Green Key) |

Step 30's own Fire is never granted, because it is that step's own pickup. Unit rows: `surveyGrants.test.js` (6) against the real tables.

**The 22/23 check.** Without grants, 22 SOLVED 48 and 23 SOLVED 229 (pristine worktree). With key 0 and the shield granted they are still 48 and 229, with the same decisions and 0 re-plans. **They did not move.**

**Default mode**, after D3: `--derive-only` `27ff43db…` / `route.json` `1e08f9ad…`; through-2.2 derive `1172328c…` / route `dae52ec7…`. All four are identical.

## D4: the survey re-run

Command: `--through=2.2 --only=22,23,24,25,26,27,28,29,30 --timeout=180 --out=CC/docs/cloud-reports/seedling-swim-u2-survey.json` (md5 `808e3a784f6b36d972e54fba501baa17`).

| step | room | predicted | measured (verbatim) |
|---|---|---|---|
| 22 | L13 | SOLVED 48, unmoved | **SOLVED 48 ticks**, 1 decision, 0 re-plans, 0 hits, 1 pass |
| 23 | L0 | SOLVED 229, unmoved | **SOLVED 229 ticks**, 2 decisions, 0 re-plans, 0 hits, 1 pass |
| 24 | L12 | past the shield, then REFUSED on `puncher@416,256` (R-o) | **TIMEOUT** at the 180 s bound. Unbounded (scratch probe, same staging + grants): **REFUSED after 347.7 s**, 1876 walked ticks — `reach-pit (36,43)->L21 -> keylock stance (bosslock@416,240): the combat ladder is EXHAUSTED. The corridor passes through danger at (431.6,263.8) — enemy:puncher@416,256 (a static "Enemy" body …)`. So it is past the shield lock, at the Red Key's lock, and refused by the predicted name. |
| 25 | L21 | SOLVED 26 | **SOLVED 26 ticks**, 1 decision, 0 re-plans, 0 hits, 1 pass |
| 26 | L22 | SOLVED 89 | **SOLVED 89 ticks**, 1 decision, 0 re-plans, 0 hits, 1 pass |
| 27 | L29 | SOLVED 383 | **SOLVED 383 ticks**, 4 decisions, 0 re-plans, 0 hits, 1 pass |
| 28 | L31 | SOLVED, ~250 t (a guess) | **SOLVED 336 ticks**, 2 decisions, 0 re-plans, 0 hits, 1 pass; earned clear `{31,0}` (the Green Key's lock) |
| 29 | L30 | SOLVED 210 | **SOLVED 210 ticks**, 2 decisions, 0 re-plans, 0 hits, 1 pass (unmoved by the wider grant) |
| 30 | L32 | REFUSED at the macro layer (R-f) | REFUSED — `collect-placement (64,128) resolves to NOTHING in level 32 — no chest and no pickup stands there. A goal about an absent thing is a macro-layer error …` |

Every SOLVED row replays with 0 hits and 0 deaths and ends in the next room of the route.

## HEADLINE: 7/9

Step 24 is the only row that lands differently from its prediction, and only in form: it is a TIMEOUT, not a named refusal inside the 180 s bound. The name, measured without the bound, is the predicted one.

## The surface table delta

184 → 184 rows, `--check` GREEN after `--write`. The only drift was site counts: `run:state` 258→259, `state:vx` 14→17, `state:vy` 10→13, `state:x` 114→115, `state:y` 120→121, all in `botDriverV2.js` (`holdOneAxis` and `drive`'s call). No new member, family or kind. `census-seedling-constants --check` PASS (0 new constants: the policy is a filter, not a number).

## What the brief got wrong (measured)

1. **"the held-key branch that returns without `lock`".** It is the key-NOT-held branch (`held: false`).
2. **W0: "the four refusals verbatim = U1's".** Of the four W0 rows, three are refusals; step 29 SOLVES in 210 t (as in U1's own D4).
3. **"a 1-D search from 125.5 finds an 8-tick answer"** (U1 § D2, quoted as a premise). That search used the mis-ordered step (input before friction). The order is fixed in D1, and the U1 number should not be reused.
4. **D1 (a), "in practice from the room's arrival, whose x is integral".** True, but the arrival is only integral to float precision in effect. The axis-aligned walk arrives at 126.00000000000001, not 126. It was the exact-replay alignment search that found a float-exact landing (125.9 + 0.1000000000000001 = 126). The grid argument is necessary but not by itself sufficient; the search closes the last ULP.
5. **D4, "24: … SOLVED or the puncher refusal by name".** Neither, within the brief's own `--timeout=180`: the refusal takes 347.7 s.
6. **Games file path.** It is `frontend/modules/flashPanel/games/seedling.json`, not `games/seedling.json`.

## Residue

- **R-o, L12's puncher.** `bosslock@416,240`'s keylock stance is EXHAUSTED on `puncher@416,256`, a static Enemy body: KILL refuses a static body's own death (§11.4), and BAIT has no live body. That is a room finding; no puncher arm was built. The solve also costs 347.7 s, which makes it a survey TIMEOUT at 180.
- **A text defect in the AVOID rung.** Step 24's avoid line reads *"A\* goal tile (26,16) … is not walkable: danger undefined at (undefined,undefined)"*. It is the same family as D2's `undefined`, in a region I was not given (the ladder), so I left it.
- **The approach costs ticks.** The axis-aligned walk is 120 t longer to L29's stance than the diagonal one, and it takes no dash and no opportunistic strike. It is used only by `skirt` (L29, L74).
- **R-f, step 30.** `collect-placement (64,128)` in L32 is a boss drop, not a placed entity: a macro-layer question, unchanged.
- **Scratch instruments** in the session scratchpad: the step probe (stages any survey step, logs x per tick, optional grants), the bank script, the W0 worktree runs.

## Byte-inertia

| Artifact | W0 (`a8225ce975`) | after D1 (+D2, see note) | final (`73efc533`) |
|---|---|---|---|
| identity block (21 rows), stdout md5 | `1d0f29aa…` | `diff`-identical | `diff`-identical |
| `census-seedling-campaign` | `88fa2333…`, exit 0, `NO CHAIN ROOM MOVES` | identical | identical |
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical | identical |
| survey `--derive-only` / `route.json` | `27ff43db…` / `1e08f9ad…` | identical | identical (also measured after D3) |
| through-2.2 derive / route | `1172328c…` / `dae52ec7…` | identical | identical (also measured after D3) |
| `fixtures/**`, `campaign-frontier.json` vs `origin/main` | 0 files | 0 files | 0 files |
| solver surface | GREEN 184 | RED 5 (site counts, before `--write`) → GREEN 184 | GREEN 184 |
| bounded vitest (the brief's five paths) | 8 files / 211 | — | 8 files / 212 (+ `surveyGrants`, `procgenPostSword`: 10 / 231) |

⚠ **Note on the D1 bank.** D2's one-line text edit landed while the D1 bank was running, so the "after D1" column is D1+D2. The final column is a full bank on the finished tree, and every row there is `diff`-identical to W0.
