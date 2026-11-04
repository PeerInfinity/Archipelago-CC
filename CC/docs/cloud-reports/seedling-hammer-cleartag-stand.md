# Seedling hammer-phase CLEARTAG-STAND — the clear-tag arm's keylock hold, priced at the defaults (`CLEARTAG_STAND`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-cleartag-stand` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `31ce3077a1` (= `origin/main` at launch) |
| Head | W0 `604058af`, I `a6598f3a`, M `23b903d1`, D `bfeb481d`; this report is the last commit on the branch |
| Branch | `claude/seedling-cleartag-stand-k8s9vm` (the harness's designated branch). Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-cleartag-stand-evidence/` (`w0/`, `m/`, `d/`, `i-*.txt`, instruments under `tools/`) |
| Scope | No mid-run message reached this session; the scope is the brief's. No fidelity W36 key is on this start SHA's defaults that the answers depend on: every answer is main's code at its defaults (`CHOOSER_PAIR` ON at size 3 included) |

## 2. The answer first

**The one thing to know first: ON fixes 4 of the 6 hit legs and turns the other 2 into refusals.** The clear-tag
arm's keylock stance walk now carries the hold as its tail, so the probe sees the punch. On the 2 L35 legs and the 2
`L95_624_80` legs the ladder then finds a hitless answer. On the 2 `L95_624_64` legs **no rung can answer**: the kill
rung's chaser arm finds no dwell stance whose wait is clean, and the forced-hit rung is refused by `coveredGoalRefusal`.
So a 2-hit pass becomes a named refusal (the sweep will read **pass → fail** there). That is the honest answer, because
the 2 hits were real and nothing priced them. But it is a regression in the sweep's pass count, and the planner must weigh it.

| question | answer |
|---|---|
| Does the defaults' L35/L95 hit reproduce? | Yes, on the page (OFF sweep, this head) and in node, tick for tick: legs 127/128 (L35), 160/161 (L95_624_64), 171/172 (L95_624_80) pass with **2 hits** each, all `punch` from `puncher@416,256`, `exact: true` |
| Where does each hit land? | In the keylock's **hold**: the first punch 23–37 ticks after the clear-tag arm's stance walk ends, with the player at the stance (x 428–446, y 258.0–258.1). No hit is on a walk tick |
| Which arm? | The **clear-tag** arm (`execClearTag` → `walkTo(goal, resolved.stance, …)` → `execKeylock`), on all 14 legs |
| Was the stand certified? | **No.** The walk's probe ran with `stand: null` (transit only); `keylockStandWalk` was never asked on this arm at the defaults (⚖ 30(c)) |
| Why do the other 8 legs take 0? | **Timing, not route.** All 14 legs walk the same last corridor (344,184) → (376,264) → (424\|440,264). On the 8 from L0/L33/L36/L88 the transit probe meets a punch at x≈401 (t249–676), so the ladder climbs and the kill rung clears the puncher before the hold. On the 6 from L35/L95 the transit passes between punches, the walk is adopted as is, and the puncher is still alive for the hold |
| The fix | `CLEARTAG_STAND` (OFF): the clear-tag site asks `clearTagStandWalk`. ON, that is `clearTagKeylockStand`, the one helper (`keylockStandWalk`'s tail for a `keylock` verb, `KEYLOCK_WAIT_PRICED` on), which `axisClearTagStand` also uses behind `AXIS_STRIKE` (unchanged). OFF it asks `axisClearTagStand`, exactly as before |
| Before → after (page sweep, the 14 legs) | OFF: 14 pass, 6 with roomHits max 2. ON: **12 pass, roomHits max 0**; 127/128 494/541 → 643/648 t, 171/172 672/675 → 700/750 t, the 8 others at OFF's ticks byte for byte; **160/161 fail** (refusal; 161 out of 640, then 2560, work units) |
| ON radius beyond L12 | **0 movers**: L40's 58 captured requests, the route survey's 237 steps, r9 `--check`, L30KEYLOCK's `--check`, the producer battery (97, 0 red) and the bounded set |

## 3. W0 — reproduce

| row | result |
|---|---|
| base | `31ce3077a1`; bootstrap `--seedling` done (node v22.23.4; the AP `pip` step FAILED, `/root/CC/pip.log`, as in AXIS-L12HITS; nothing here reads it); every non-wasm submodule initialised before the first gate |
| the leg list | `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`: **14** L12 bosslock legs (`w0/l12-keys.txt`) |
| page sweep OFF, this tree on :8000 (`tools/sweep.sh`: `--mode=inv --producer=solver --page-legs=1 --keys=<the 14> --capture-requests`) | 14/14 pass. 8 at roomHits max 0, ticks 771/777/836/842/864/872/444/447 (AXIS-L12HITS's OFF numbers). **6 at max 2**: 127 (t433, t474), 128 (t493, t520), 160, 161, 171, 172, all `exact: true` (`w0/page-sweep-off.jsonl`). ⚠ The I edit landed in the served tree while legs 128–172 ran; its OFF path is byte-identical (the site asks `axisClearTagStand`, `{}` with `AXIS_STRIKE` off), and the node replays below are at `31ce3077a1`'s code path |
| node replays (`tools/replay.mjs`, the worker's own dispatch + `replayTape` for the model's hits; `tools/walk-register.mjs` lists the answer's walks) | every leg answers the page's ticks; the 6 legs' hits are the page's ticks (`w0/replay-off.jsonl`) |

**Per hit** (`w0/replay-off.jsonl`, `w0/first-transit-probe-off.jsonl`):

| leg | arrival | the clear-tag keylock stance walk | its probe | the kill rung? | player hits (punch, `puncher@416,256`) |
|---|---|---|---|---|---|
| 127 (L35 → flag 4) | (112,112) | ends t409 at (423.9,264.2), `stand: null` | transit clean | no | **t433, t474** |
| 128 (L35 → flag 5) | (112,112) | ends t456 at (440.8,263.1) | clean | no | **t493, t520** |
| 160 (L95_64 → flag 4) | (16,352) | ends t547 | clean | no | **t575, t615** |
| 161 (L95_64 → flag 5) | (16,352) | ends t525 | clean | no | **t562, t589** |
| 171 (L95_80 → flag 4) | (16,368) | ends t587 | clean | no | **t610, t652** |
| 172 (L95_80 → flag 5) | (16,368) | ends t591 | clean | no | **t627, t654** |
| 105/106 (L0), 116/117 (L33), 138/139 (L36), 149/150 (L88) | — | ends t685–786 (t359/362 from L88) | **punched in transit** at x≈401 (t576 / 642 / 676 / 249) | yes: `-> keylock stance -> kill (puncher@416,256) stance` | none |

The certificate is the walk's probe (`probeCorridor`, `tools/probe-register.mjs`): every first probe of the keylock
stance walk on every leg has `stand: null`. The hold (110 ticks: `BossLock`'s 60-tick key timer, then its fade, +
slack) is driven by `execKeylock` after the walk and was never previewed.

## 4. M — the design check

| design | the 6 hit legs | the 8 clean legs | L30 keylock (`plan-seedling-l30keylock --check`) | L40 (58 req) / survey (237) / r9 | verdict |
|---|---|---|---|---|---|
| (1) **give the clear-tag arm `keylockStandWalk`'s tail** (`clearTagStandWalk` → `clearTagKeylockStand`) | 127/128/171/172 → **0 hits** (643/648/700/750 t); 160/161 → **refusal** (the ladder exhausted) | OFF's plan **byte for byte**, 0 hits | green ON (byte-identical tape) | 0 / 0 / green | **BUILT** (behind `CLEARTAG_STAND`, OFF) |
| (2) certify the hold as its own stand probe after the walk (`tools/design2-loader.mjs`: a zero-length `previewWalk` with the tail from where the walk arrived; a hit refuses `hold-hit`) | 127/128/160/161/172 → **refusal**; 171 → 0 hits (713 t) | unchanged | — | not run | **not built**: once the walk is driven no rung is left to climb, so a priced hold can only refuse. Strictly worse than (1) on 127/128/172 |
| (3) let the kill rung clear the puncher before the hold | — | — | — | — | **what (1) does.** With the tail the walk's probe meets the punch and the ladder's own kill rung runs first (`-> keylock stance -> kill (puncher@416,256) stance` on 127/128/172). A kill before every keylock hold, asked outside the ladder, would plan around the punch rather than model it (⚖ "model a game interaction; never plan around it"). On 160/161 the kill rung itself refuses (below), so (3) would not help them either |

**Why 160/161 refuse ON** (`MSG_LEN=6000` replay; `m/replay-design1-on.jsonl`): the ladder is exhausted. *avoid*: the
stance tile (26,16) lies in the live puncher's danger volume; *time*: the aim is 411 px away; *bait*: no stance in the
leash; *kill*: the press arm has no presser, and the **chaser arm's 17 reachable leash stances all have their WAIT hit**
at ticks 603–607 (and GUARD APPROACH has none either); *narrow*: dangerous too; *detour* and *forced-hit*: refused by
`coveredGoalRefusal`. 161 first stops on the anytime budget (640 units). With 4000 units (6×, diagnosis only) it ends
in the same exhaustion. The page agrees: 160 a refusal, 161 out of 640 then 2560 units on the held retry.

## 5. I — the switch, the rows, the mutants, the ON radius

- **The switch:** `solverBot.CLEARTAG_STAND` (`SEEDLING_CLEARTAG_STAND=1`, `withClearTagStand`, `CLEARTAG_STAND_DEFAULT
  = false`), its line in `solverEnvChannel.SOLVER_ENV_NAMES` (sorted after `SEEDLING_CHOOSER_PAIR_SIZE`, wrapped at 120).
- **One helper, two gates:** `clearTagKeylockStand(run, verb, resolved)` is ungated: `keylockStandWalk`'s tail for
  `keylock` when `KEYLOCK_WAIT_PRICED` is on, else `{}`. `axisClearTagStand` returns it under `AXIS_STRIKE` (the same
  answer as before for every input). The clear-tag site calls `clearTagStandWalk`, which returns
  `CLEARTAG_STAND ? clearTagKeylockStand(…) : axisClearTagStand(…)`. OFF is byte-identical: the site gets exactly
  `axisClearTagStand`'s answer. No new `kill` arm or rung (the kill the probe sends to is the existing ladder's), and no
  `strategySwitch.js` edit.
- **Rows** (`hammerClearTagStand.test.js`, 4, ~23 s): (1) ships OFF, and the page channel knows the name; (2) the site's
  options on L12's real `bosslock@416,240`: OFF `{}`, ON the 110-tick tail, AXIS's path unchanged, `kill` and
  `KEYLOCK_WAIT_PRICED` off → `{}`; (3) **L35 leg 127** OFF 494 t with hits `[[433, punch], [474, punch]]`, ON 643 t
  with 0, and the non-vacuity arm (ON with the tail's instrument off = OFF's plan and hits); (4) **L0 leg 105** ON =
  OFF byte for byte (771 t, 0 hits).
- **Fixtures** (`fixtures/hammer-cleartag-stand/`): legs 127 and 105, the page's captured requests with the atlas
  records cut to level 12 (**9.6 KB** each; `tools/cut-fixture.mjs`). Cut and uncut answer byte-identically, OFF and ON
  (`i-fixture-cut.txt`: 494 `91e93cad7d53` / 643 `7a2ec2b99461` / 771 `df49abb695af` both ways).
- **Mutants** (`tools/mutants.py`, a separate worktree; `i-mutants.txt`):

| mutant | result |
|---|---|
| M1 drop the tail (ON asks `axisClearTagStand`) | **RED** (rows 2, 3) |
| M2 the tail without the hold length (`stand: {keys}`) | **RED** (rows 2, 3) |
| M3 the switch ignored (the tail OFF too) | **RED** (rows 2, 3) |
| M4 every verb (the `keylock` gate dropped) | **RED** (row 2) |

- **The ON radius, by mover class:**

| workload | movers | class |
|---|---|---|
| the 14 L12 bosslock legs (node; the page sweep ON agrees leg for leg, `m/page-sweep-on.jsonl`) | **6** | **hits removed** (4): 127, 128, 171, 172, 2 → 0 (+149, +107, +28, +75 t). **pass → refusal** (2): 160, 161 (§4) |
| | 8 | none: OFF's plan byte for byte (105, 106, 116, 117, 138, 139, 149, 150) |
| L40, 58 captured requests (AXIS-L12HITS's 52 keys, captured OFF at this head; `m/l40-replay-{off,on}.jsonl`) | **0** (44 ok / 14 refused both ways; ticks, plan sha, work and message equal) | — |
| route survey `--through=end`, 237 steps (`m/survey-off-vs-on.txt`) | **0** (201 SOLVED / 36 REFUSED both ways, every row equal but `ms`) | — |
| r9 campaign `--check`, ON | green (`m/r9-on.txt`) | — |
| L30KEYLOCK `--check`, ON and OFF | green, byte-identical tape (`m/l30keylock-{on,off}.txt`) | — |
| producer battery ON | 97 run, 0 red (`d/producer-on.txt`) | — |
| bounded vitest set ON | 38 files, 754 passed / 5 skipped, as OFF | — |
| identity block ON | equal to OFF row for row (the solver rows; `d/identity-{off,on}.txt`) | — |

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52; `d/bounded-files.txt`: every non-slow test naming the clear-tag / keylock-tail machinery, `SOLVER_ENV_NAMES` or `strategySwitch`, + `seedlingSolverSurface.test.js`) | **38 files, 754 passed, 5 skipped, 0 failed** at the defaults (`d/bounded-off.txt`) and with `SEEDLING_CLEARTAG_STAND=1` (`d/bounded-on.txt`). `solverEnvChannel.test.js` and `strategySwitch.test.js` are in the set |
| the hammer `.slow` files (`vitest.slow.config.js`, all 9) | **8 passed, 1 skipped; 19 / 20 tests** (`d/slow-hammer.txt`). The skip is ESCAPE-EXACT's own `skipIf` (it needs fidelity's `forecastShieldBump` key) |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`d/producer-off.txt`). A first run read 1 red, the battery's `TREE-MOVED` guard: my own `seedling-bot.md` edit and evidence files landed mid-run, and every producer exited 0. Re-run on a still tree: 0 red |
| `ci-producer-checks --jobs=4`, `SEEDLING_CLEARTAG_STAND=1` | **97 run, 0 red**, 1 skipped (`d/producer-on.txt`) |
| identity block (`identity-block.sh .`) | rows 1–22 equal OFF, ON and to AXIS-L12HITS's recorded block (`seedling-hammer-axis-l12hits-evidence/d/identity-head.txt`). The one differing line is the `reference` row: the OFF pass ran before I regenerated the reference for a doc edit (`2 … DIFFER`), the ON pass after (`ALL … MATCH`); `check-procgen-reference` at the head: ALL CHECKS PASSED |
| `census-seedling-solver-surface --check` | GREEN, 371 rows match a fresh census; no `--write` needed, no new row to classify (`d/surface.txt`) |
| `census-seedling-constants --check` | PASS (`d/constants.txt`) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`, for the log entry); ALL CHECKS PASSED (`d/procgen-reference.txt`). A first run refused on the box lock (the L40 capture held it) |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, :8000) | **ALL PASS** (`d/wasm-ship.txt`) |
| docs | `seedling-bot.md` (the switch, OFF, and what it does: after AXIS-L12HITS's paragraph); `seedling-bot-log.md` (`### Seedling hammer-phase CLEARTAG-STAND — …`) |
| JSUT | run **41534153489** at `23b903d1` (M): **slow battery 372 / 372**; suite 25,389 passed / **1 failed** / 6 skipped. The red is `procgenDocs/generated.test.js` (`docsIndex.js` and the README region stale: the M commit edited `seedling-bot.md` without regenerating). `bfeb481d` (D) carries the regeneration; its run **41547406101** was still queued on CI at the time of writing. Read it, and this report's successor, with `node scripts/procgen/ci-summary.mjs <sha> --wait` |

## 7. What the harvest A/B should expect

**OFF: no movers.** `clearTagStandWalk` reads one boolean and then returns `axisClearTagStand`'s answer, which is
`{}` at the defaults. The walk is handed exactly what it was.

**ON:** 6 movers, all on the 14 L12 bosslock legs: 4 go 2 hits → 0 and 2 go pass → fail. Nothing else moves. The exact
ON sweep to dispatch (`seedling-divergence-sweep.yml`):

- `keys` = `level_12__r0c19 <- in_L0_304_176 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L0_304_176 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L33_32_64 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L33_32_64 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L35_32_64 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L35_32_64 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L36_32_128 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L36_32_128 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L88_96_304 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L88_96_304 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L95_624_80 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L95_624_80 -> location:L12 flag 5: bosslock@432,240 cleared` (also `w0/l12-keys.txt`)
- `solver_env` = `SEEDLING_CLEARTAG_STAND=1`
- expect: 12/14 pass with roomHits max 0, ticks 771 / 777 / 836 / 842 / **643 / 648** / 864 / 872 / 444 / 447 /
  — / — / **700 / 750**; legs `in_L95_624_64` flag 4 and flag 5 **fail** (refusal: the ladder exhausted; flag 5 by
  its work budget first). The page sweep of this head (`m/page-sweep-on.jsonl`) read exactly this.

Then the **full sweep** with `solver_env=SEEDLING_CLEARTAG_STAND=1` against an OFF run at the same SHA: expect these 6
movers and no other. Every clear-tag keylock on the route is in its reach (the switch acts only there), so the full sweep
is the radius I could not run here. Of the levels with a keylock I measured L12 (the 14 legs), L30 (L30KEYLOCK's
witness) and L40 (58 requests); the route survey reaches others in node.

## 8. What the brief got wrong (measured)

- **"The other 8 L12 bosslock legs … take 0 at the defaults. Find out why those route differently."** They do not
  route differently: all 14 walk the same last corridor to the same stance. The difference is the **puncher's punch
  phase** when the transit passes x≈401. On the 8 the transit is punched, so the kill runs first; on the 6 it is not.
- **"Rows: an L35 or L95 leg OFF takes 2 hits, ON takes 0."** True for L35 (the row uses leg 127) and for L95_624_80.
  It is **not true for L95_624_64**: ON refuses there.
- The brief's three designs are not three independent fixes. (3) is the mechanism (1) triggers, and (2) without a rung
  to climb can only refuse.

## 9. Residue and hand-overs

- **The L95_624_64 kill (a hand-over to whoever owns the kill rung):** ON, the honest answer there is a refusal. The
  chaser arm's 17 leash stances all have their wait punched (t603–607), GUARD APPROACH has none, and forced-hit is
  refused by `coveredGoalRefusal` (the stance tile is inside the live puncher's danger volume, so a priced 2-hit stand
  is never offered). Any of these would turn the 2 refusals back into passes: a kill stance whose wait the punch phase
  allows, a forced-hit rung that prices a hit in the HOLD rather than at the goal tile, or a different stance. Each is
  outside this slice's boundary (the ladder's rungs).
- **Flip guidance:** ON trades 4 uncertified 2-hit passes for 4 hitless ones, and 2 uncertified 2-hit passes for 2
  named refusals. Whether to flip with the 2 refusals, or after the hand-over above, is the planner's call.
- **Not covered here:** `hold` (`holdStandWalk`, fidelity's `holdWaitPriced`) has the same frontier-only shape on the
  clear-tag arm. It is fidelity's switch and file, so it was not touched; noted only.
- **The capture** (L12 ~0.5 MB, L40 ~6.9 MB) is not committed. The keys are in `w0/l12-keys.txt` and AXIS-L12HITS's
  `m/l40-leg-keys.txt`; the node replay answers are committed.
- **Bootstrap residue:** the AP `pip` step fails (`/root/CC/pip.log`), as before.
- **Worktrees:** the mutant worktree (`/tmp/claude-0/wt-mut`) was removed by name (`git worktree remove`).
