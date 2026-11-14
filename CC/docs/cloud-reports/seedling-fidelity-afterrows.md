# Seedling fidelity AFTERROWS — fidelity's L40-flip BEFORE pins, each with an AFTER at the shipped defaults

Planner `seedling-fidelity-planning-19`, wave 41 (⚖ user 2026-11-12, *"AFTER rows at L40 defaults (Recommended)"*).
Session `seedling-fidelity-afterrows`, port 9786.

| | |
|---|---|
| Start SHA | `737a451f50` (= `origin/main`, train 96; 122 default-ON keys of 133) |
| Head | the commit that adds this report (docs-only) on top of `ce9e49f6`, the last test-changing head |
| Harness branch | `claude/seedling-fidelity-wave-41-a5hyiw` |
| Verdicts | **W0 PASS · D1 PASS (16 AFTER rows + 9 controls, 7 new game witnesses; 6 BEFORE properties not covered at the defaults, named) · D2 PASS (byte-inert; see § D2)** |

## 1. The one thing to know first

**The L40 flip set moved more than "a refusal moved".** At the shipped defaults, both chains whose BEFORE witness was a
*refused prefix* now **SOLVE Boss Key 2**, hitless on the game: the pocket boot in 4692 t and the latch boot in 4144 t.
Leg 368 at seam 5290 now plans **1714 t with no hit** (BEFORE: 1567 t, with the t1222 hammer hit). L30's both-OFF and
WAIT-alone arms solve hitless too. **No row lost a solve, and no AFTER plan takes a hit.** What moved out of reach are
six BEFORE *properties*: the refusals and the mechanisms those refusals exercised. Each is named in § 4 with its control,
if one exists.

Five flip switches explain every mover I could attribute (each measured as the shipped defaults minus that one switch,
and in all cases against the twelve together):

| Switch OFF alone | gives back the BEFORE of |
|---|---|
| `CHASER_STAGED_HUNT` | L30KEYLOCK both-OFF and WAIT-alone (all three verdicts); L40BK2B OFF and ON (no hitless orbit candidate; the orbit kill at t125 = `l40bk2b-orbit-free`, key for key) |
| `BOMB_PHASE_WAIT` | L40BK2 D2: all three leg-368 pins (1567 t `abf1e13c3bf7` with the t1222 hit; D2's bomb-pusher refusal; 1555 t `2c4b20d9853c` at 5280, ON = OFF) |
| `CHOOSER_CUT` | L40BK2 D1 pocket: the refused prefix `l40bk2-pocket-chain` (2650 t), input for input, equips and refusal text |
| `LATCH_WEIGH_FIRST` (or `TURRET_APPROACH`) | L40LATCH: hold tick 93 MOVED; D1a's EXHAUSTED hold + TIME refusal; the 271 t `l40latch-orbit-chain` prefix, key for key. L40RES step 93 OFF arm: STANCE_REENTRY |
| none found | LAPSECOST mutant / FORCEDHITXC leg 403 (each of the 12 alone); L40BK2 D1 door-shut chain (each of the 12 alone); L40RES ON arm (4 sets) |

## 2. W0

| Bank | Command | Value |
|---|---|---|
| Bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` (node v22.23.4) |
| CI at the base | `ci-vitest-summary.mjs 737a451f50` | run `43120028690`: **26,992 passed / 0 failed**; slow 436 / 436 |
| Acceptance batch (head) | `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null \| md5sum` | **`391322d681b7aa0229d94b3f6906d024`** (= the standing value) |
| Census of wrapped rows | `grep -a 'withL40Flip(' ` over the nine files | **16 call sites** (the counts of 2 in the two `.train.` files include a title string; 1 call each) — table § 3 |

## 3. Census and the report table (every wrapped row)

"Holds?" = does the BEFORE row's PROPERTY hold at the shipped defaults. Hits are the model's, and the game's where a
fixture is named. All AFTER values were measured at `737a451f50`, through the row's own request, with only the
`withL40Flip(false)` wrap removed (each row's own `withContactFidelity` keys are kept).

| # | File : BEFORE row | BEFORE value | AFTER value | Holds? | Hits | New fixture (bytes, md5) | Lost solves |
|---|---|---|---|---|---|---|---|
| 1 | `fidelityForcedHitXc` : leg 403, ON refuses as OFF | both refuse (dashless, DETOUR budget); forced-hit nodes 1 / **37** (the continuation leaves by the arrival door) | both refuse with one text: dashless `bait` rung (bob@208,448 already gone), work 113; forced-hit nodes **1 / 1** | ON = OFF **yes**; the continuation **NOT exercised** | — | — | none |
| 2 | `fidelityLapseCost` : MUTANT (companion off) | refused, pass 0 `detour`/`budget` | refused: pass 0 a plain refusal at work 113 (the `bait` text), pass 1 `kill-chaser`/`budget`; companion ON still solves (776 t) | mutant still discriminates **yes**; "at the DETOUR rung" **no** | — | — | none |
| 3 | `fidelityL30KeyLock` : both OFF (224,80) | REFUSED (survey text), 2 hits, keys = `l30keylock-pit224-before` (212 t) | **SOLVED 318 t**, kill (chaser) → keylock → teleporter | refusal **no** (control: −CSH **yes**) | 0 / game 0 | `bomb-witness/afterrows-l30-pit224-off.json` 40,644 B `9329283b63f8c24e7e49728e9c1f47f4` | none (gain) |
| 4 | `fidelityL30KeyLock` : WAIT alone | (224) 309 t hitless; (240) EXHAUSTED before a tick | (224) **318 t** = row 3's plan key for key; (240) **SOLVED 310 t** | **no** (control: −CSH **yes**) | 0 / game 0 | `bomb-witness/afterrows-l30-pit240-wait.json` 40,434 B `2ac3e57113be38b796a6c0e5c0b87d4c` | none (+1 solve at 240) |
| 5 | `fidelityL40Bk2` : D1 ON, chain → press kill | refused, `… -> kill (spinner@880,848) by press: the player died at t767` | refused **before a tick**: no REACHABLE stance inside `buttonroom@880,768` | **no** (no control in 12) | — | — | none |
| 6 | `fidelityL40Bk2` : D2 OFF seam 5290 | 1567 t `abf1e13c3bf7`, hit t1222 (spinner@192,144) | **1714 t `b142543aace2`, no hit** | the hit **no** (control: −BPW **yes**) | 0 / game 0 (to t1702) | `bomb-witness/afterrows-l40-368-s5290.json` 244,776 B `c369799dbfc3845bd4133366d9dc82ac` | none (gain: hitless) |
| 7 | `fidelityL40Bk2` : D2 ON seam 5290 | refused (the bomb-pusher hold), no hit plan | **1714 t, same plan, no hit** | D2's refusal **not exercised** (control: −BPW **yes**) | 0 | (row 6's) | none (+1 solve) |
| 8 | `fidelityL40Bk2` : D2 seam 5280, ON = OFF | 1555 t `2c4b20d9853c`, hitless, ON = OFF | **1714 t `b142543aace2`**, hitless, ON = OFF | **yes** (control: −BPW keeps 1555) | 0 | (row 6's) | none (⚠ +159 t) |
| 9 | `fidelityL40Bk2.train` : pocket refused prefix = `l40bk2-pocket-chain` | refused at 2650 t | **SOLVED 4692 t**, Boss Key 2 | refused prefix **no** (control: −CCUT **yes**, 2650 t key for key) | 0 / game 0 | `l40bk2-witness/l40bk2-pocket-shipped.json` 1,580,837 B `29fe2433dbb1fabff808c5ddad3374bd` | none (+1 solve) |
| 10 | `fidelityL40Bk2b` : OFF, no hitless orbit candidate | `orbit arm: no orbit kill … is hitless (20 of 20)` | bobsoldier@880,832 **removed at t112**, hitless; then the chest's proximity (staging artifact) | **no** (control: −CSH **yes**) | 0 / game 0 | `l40bk2b-witness/l40bk2b-plain-shipped.json` 43,993 B `d258c8dba6284f4f61e2b77cb28b872d` | none (gain) |
| 11 | `fidelityL40Bk2b` : ON, orbit kill = `l40bk2b-orbit-free` | removed t125, keys = the recording | **removed t112**, keys = the new recording | **no** (control: −CSH **yes**: t125, the same keys) | 0 / game 0 | `l40bk2b-witness/l40bk2b-free-shipped.json` 44,127 B `4dc52f71ab4a8f05dd739feb00c76823` | none |
| 12 | `fidelityL40Latch` : OFF, hold tick 93 MOVED | `hold: hold tick 93 of 131 MOVED` | refused **before a tick** at the iceturret approach staging (488,579), on bobsoldier@880,832's sword | **no** (control: −LWF **yes**) | — | — | none |
| 13 | `fidelityL40Latch.train` : holdWaitPriced alone | hold EXHAUSTED; TIME refuses the tail; WAIT hit t93; 0 t | the row 12 refusal, byte for byte (holdWaitPriced **inert**); the chaser arm still: every still stance hit (WAIT t93); 0 t | "no still stance kills" **yes**; hold/TIME **no** (control: −LWF **yes**) | — | — | none |
| 14 | `fidelityL40Latch.train` : both ON, refused prefix = `l40latch-orbit-chain` | refused at 271 t | **SOLVED 4144 t**, Boss Key 2; BobSoldier gone t184 | refused prefix **no** (control: −LWF **yes**, 271 t key for key) | 0 / game 0 | `l40latch-witness/l40latch-orbit-shipped.json` 1,309,033 B `1f88108b25e55692c126a04685fc7422` | none (+1 solve) |
| 15 | `fidelityL40Res` : step 93 OFF, STANCE_REENTRY | STANCE_REENTRY at the west door | refused **before a tick** inside `buttonroom@880,768` | **no** (control: −LWF **yes**) | — | — | none |
| 16 | `fidelityL40Res` : step 93 ON, chest → press kill | `… -> kill (spinner@880,848) by press: the player died at t767` | as row 15 (the same refusal in both arms) | **no** (no control in 4 sets) | — | — | none |

Legend: CSH `CHASER_STAGED_HUNT`, BPW `BOMB_PHASE_WAIT`, LWF `LATCH_WEIGH_FIRST`, CCUT `CHOOSER_CUT`.

**Coverage not reachable at or one switch from the defaults** (the planner's list for the user):
1. FORCEDHITXC's continuation that leaves by the ARRIVAL door (row 1).
2. LAPSECOST's mutant refusing at the DETOUR rung's budget (row 2). The companion's effect itself is still pinned.
3. L40BK2 D1's walk of the south door's links from the door-shut arrival (row 5).
4. L40BK2 D2's refusal of an uncertified dashed plan (row 7). Pinned under −BPW only.
5. L40RES's `stanceReentryNextDoor` pass to the chest (row 16).
6. The refused-prefix shape of the pocket chain (row 9): pinned only under −CCUT. At the defaults the chain is a SOLVE, and that solve is witnessed.

As the comments in rows 5, 15 and 16 say, the shipped route never reaches the door-shut state (the walk carries the
door). Rows 5, 9, 15 and 16 are covered at the defaults by the two SOLVES (rows 9 and 14), which are game witnesses.

## 4. D1 — the AFTER rows (PASS)

**Change.** New rows only, beside each BEFORE row, which is untouched:
- `fidelityForcedHitXc` +1
- `fidelityLapseCost` +1
- `fidelityL30KeyLock` +4 (2 AFTER, 2 controls)
- `fidelityL40Bk2` +6 (D1 AFTER; D2 AFTER, control, witness; pocket recording + model)
- `fidelityL40Bk2.train` +2 (AFTER, control)
- `fidelityL40Bk2b` +3 (2 AFTER, 1 control)
- `fidelityL40Latch` +4 (AFTER, control, recording + model)
- `fidelityL40Latch.train` +3 (2 AFTER, 1 control)
- `fidelityL40Res` +2 (AFTER, control)

Test-helper additions (no model or solver module):
- `fidelityL40Bk2.js`: `l40Bk2PocketShippedTape`, `l40Bk2PocketShippedChecks`, witness `l40bk2-pocket-shipped`.
- `fidelityL40Latch.js`: `l40LatchOrbitShippedTape`, `l40LatchOrbitShippedChecks`, witness `l40latch-orbit-shipped`.
- `fidelityL40Bk2b.js`: `l40Bk2bShippedArmTape`, witnesses `l40bk2b-free-shipped` and `l40bk2b-plain-shipped`.
- New `fidelityAfterRows.js`: `afterWitness`, `afterWitnessReplay` and `sortedInputs`. The bombpusher probe's recorded
  tape re-orders the input spans, so the rows compare inputs as a sorted set.

**Game witnesses.** All on p4g, headless, at port 9786, at the shipped defaults:

| Fixture | Recorded by | Game result |
|---|---|---|
| `l40latch-orbit-shipped` | `probe-seedling-l40latch.mjs --only=l40latch-orbit-shipped --record` | 4141 sampled ticks; 0 px player, blocks, chasers and turrets; 0 hits; BobSoldier gone t184; ends at (663.6, 529.0) |
| `l40bk2-pocket-shipped` | `probe-seedling-l40bk2.mjs --only=l40bk2-pocket-shipped --record` | 4684 sampled ticks; 0 px; 0 hits; ends at (663.5, 530.2) |
| `l40bk2b-free-shipped`, `l40bk2b-plain-shipped` | `probe-seedling-l40bk2b.mjs --only=… --record` | 118 / 118 ticks each; 0 px; 0 hits; gone t112 |
| `afterrows-l30-pit224-off` (317 samples), `afterrows-l30-pit240-wait` (309) | `probe-seedling-bombpusher.mjs --file=<tape> --upto=<n> --record --name=<n>` | PASS; game hits [] and model [] |
| `afterrows-l40-368-s5290` | the same probe, with `--upto=1702` | PASS ≤ t1702 (1693 samples) |

For the bombpusher-probe fixtures, the probe writes the scratch tape path into `source`. Each `source` was rewritten to
name its derivation and this report.

**A named model gap (not fixed — no model change in this slice).** In leg 368's AFTER plan, from **t1703** the model's
`bombpusher@112,128` launches its last Bomb **3 ticks before the game's**. The model has a Bomb row at t1703 and the
game's appears at t1706. The velocity differs: game (−1.948, 0.003), model (−1.835, 0). The lobber anim is `shoot` in
the model and `sit` in the game for t1710–t1714. The player agrees on every sampled tick through t1714, and neither side
takes a hit. The probe therefore refused to record the whole plan. The witness is recorded through t1702 and the row
says so. This is the plan's last 12 ticks, around the Totem Part collect: a bombpusher shot-clock question for a
fidelity follow-up (planner routes; witness first).

**Mutants**, each predicted first and made by copy + restore:
- **M1:** L30's first control with `withChaserStagedHunt(true)`. Predicted red: it solves 318, so there is no refusal.
  **Red** (control row).
- **M3:** `afterrows-l30-pit224-off.json` sample 150 x += 1/1024. Predicted: the both-OFF AFTER row reds on `parted`.
  **Red** (that row). The WAIT-alone row reads only the witness's inputs, so it stayed green, as predicted.

The tree was restored and `git status` was clean.

## 5. D2 — the whole bounded set and the train/slow files (byte-inertia)

| Gate | Value |
|---|---|
| Bounded vitest AFTER (head): the brief's list + the nine files + every `grep -a withL40Flip` hit (default tier) + every importer of the three changed helpers + surface/constants | **105 files, 2,285 / 2,285 passed** (`--maxWorkers=2`, 945 s) |
| Train/slow, one file at a time (the two fidelity train files + every train/slow file importing a changed helper) | all green: `fidelityL40Bk2.train` 2/2 (and 3/3 with the CHOOSER_CUT control, re-run), `fidelityL40Latch.train` 5/5, `fidelityCorpseBump2.train` 3/3, `hammerBk2Combat.train` 4/4, `hammerIceTurretStatic.train` 2/2, `hammerLatchWeigh.train` 2/2, `hammerPocketBurn.train` 4/4, `hammerSouthDoor.train` 4/4, `hammerStagedHuntScanMemo.train` 1/1, `hammerTurretApproach.train` 3/3; `strategySwitchApproach.slow` 1/1 |
| Acceptance md5 | `391322d681b7aa0229d94b3f6906d024` (= standing) |
| Producer `--check`s | `ci-producer-checks.mjs --jobs=2`: **99 run, 0 red, 1 skipped, 0 known-red**; tree clean after |
| Branch CI `JavaScript Unit Tests` at the last head | `ci-vitest-summary.mjs ce9e49f6` (the last test-changing head; the report/log commit after it is docs-only): run `43140239824`, **27,013 passed / 0 failed** (= the base's 26,992 + this slice's 21 default-tier rows); slow 436 / 436 |

Byte-inertia: no module that ships changed. The three helper modules I touched are imported only by tests and by the
three `probe-seedling-l40*` instruments (measured by `grep -a` over `frontend/` and `scripts/`), and their existing
exports are unchanged. No tape in `fixtures/tapes/`, no tape index, no roster pin, no golden and no committed fixture
moved: every fixture is NEW.

## 6. Survey / sweep rows this moves, and dispatches

**None.** This slice changes nothing that ships: rows and fixtures only (⚖ 2026-11-11 sweep economy). The census:
0 source modules of the solver, model, walker or runtime changed. The sweep and the survey cannot see a test row, so
**no dispatch is named**. The evidence is the seven game witnesses and the 16-row table. Seed CI: the branch's push run
(§ 5).

## 7. Hand-overs and notes for the planner

- **To the JS / fidelity planner:** the bombpusher shot-clock gap at leg 368's AFTER plan, t1703 (§ 4).
- **A trap for whoever re-records the BEFORE witnesses.** The BEFORE witness builders run at the *current* defaults:
  - `l40Bk2PocketTape` and `l40LatchOrbitTape` THROW now ("SOLVED — the witness is the refused prefix").
  - `l40Bk2bFreeTape` now builds the t112 kill, not the t125 one.
  - So `probe-seedling-l40bk2*/l40latch.mjs --record` without `--only` would throw, or overwrite a BEFORE fixture with
    the shipped plan.
  - Re-record a BEFORE witness only under `withL40Flip(false)`, or with `--from-fixture`. (`l40Bk2bLatchFreeTape` was
    not measured.)
- **Hammer:** nothing handed over. No hammer pin moved; the hammer files that import a changed helper are in § 5's
  train/slow row.
- **Leg 368 at 5280:** the shipped plan is 159 t longer than the BEFORE (1714 vs 1555), still hitless. Not a lost solve;
  named.

## 8. What the brief got wrong (measured)

- *"the AFTER row needs a NEW game recording … of the shipped solve"*: right. But the brief expected refused prefixes
  ("the solve's refused prefix is the recorded tape"); at the defaults both chains SOLVE outright.
- The brief quotes two acceptance md5s: `abb206c8…` (older bases) and the standing `391322d6…`. At this base the head
  measures `391322d6…`.
- The census: the `.train.` files each hold ONE `withL40Flip(` call; a naive count of 2 includes the row title.

## 9. Residue and rows to BANK

- Bank: the 7 fixtures (md5s in § 3); the 16-row table; the four-switch attribution (§ 1).
- Residue: the six coverage items in § 3; the t1703 bombpusher gap; scratch measurement tools were not committed
  (session-only).
