# Seedling hammer-phase OPP — opportunistic strikes in every executor (`OPPORTUNISTIC_STRIKE`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-opportunistic-strike` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `12b0c124` (= `origin/main` at launch; the designated branch already sat there) |
| Head | code and docs `8798c9bc` (JSUT green on every job: run 40441812694); this report is the one commit after it |
| Branch | `claude/seedling-hammer-opportunistic-strike-z1z8s2` — the harness's designated branch. The brief named `seedling-hammer-opportunistic-strike`, but the session may push only to its designated branch. Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-opportunistic-strike-evidence/` (the instruments are under `tools/`) |
| Scope | No mid-run message changed the scope. The container restarted twice mid-slice; every measurement below was completed (chunked and resumed), none was dropped |

## 2. The answer first

**Which executors already strike opportunistically, and which do not** (`executor-census.md`):
- **Already strike:**
  - every walk built through `previewWalk` → `drive` (`strikePolicyFor`, the one construction site, ⚖ 30(b)/(c));
  - the chaser kill's dwell (`guardedChaserDwell`);
  - `execBreak`'s idle ticks;
  - `runDwell` and `runShove` when handed a policy (the weigh fades, the L39 shaft fade).
- **Do not:**
  - **the press kill** (`execKillByPressOnce`): its strike walk, refuge walk, the stand at the strike cell and the
    refuge wait drive their own ticks (`chooseHeld` → `stepToward` → `safeStep`), and its previews (`deriveStrike`'s
    `walkTo`, `deriveRefuge`'s candidates) carry no policy either;
  - **the axis-aligned walks** (`walkToUnder`'s `axisAligned`): strike-free ON PURPOSE (Swim U2 / fidelity PROXIMITY).
    In a level once skirted, an aim key adds back the axis the lane forbids;
  - holds (`runHold`), paced waits (`runPace`), latched waits, collects, scripted verbs and the boss policies. None was
    measured with a strikeable body in reach.
  - `orbitKillChaser` / `chaserOrbitKill` is **not on `main`**.

**The missed opportunities** (a strikeable body in sword reach while the driving executor consults no policy):

| workload | in reach, missed | where |
|---|---|---|
| step 67 (node, chest (880,816)) | **95 of 95** | all in the press kill, t651–t779, `bob@736,752` (+ `bob@736,800` from t712); the first contact lands at t660 |
| the 52 L40 legs (59 captured requests, replayed in node) | press kill **400** (`375:0` 122, `848:1` 278); axis-aligned walks **262** | the press kill: only the two x≈744 bobs; the walks: the L40 west bobs and punchers |
| L18, all 45 residues | 0 | no chaser is ever in reach |
| generated (post-sword `empty` seeds 30/2/5/9; `killgate` seeds 2/5/9) | 0 | the generated palette places no chaser (`free-roaming-bob` is excluded) |

**The treatment:** the press kill asks the policy on its walk and refuge ticks (ON only). It reuses
`strikePolicyFor`, so every cost the policy prices stays: the aim tick, ⚖ 53's talk circle, the Bulb veto, the dash
rules and the i-frame lapse. It adds three guards:
1. the policy is offered only bodies whose aim AND press land clear of the spinners (`oppStrikeOffer` →
   `oppStrikeLandsClear`: `safeStep`'s own test one and two ticks on);
2. no opportunistic aim on a tick the kill aims, presses, follows its escape or drives the fight, and the kill does not
   aim over an owed press;
3. the kill's own spinner aim waits while a press would DASH because of an opportunistic swing.

Its strike and refuge previews walk with a policy from the same site and the SAME offer, so the certified walk strikes
as the drive does (⚖ 30(c)).

**Measured effect (ON vs OFF):**

| workload | OFF | ON |
|---|---|---|
| step 67 | REFUSED t780: the press kill's death to `bob@736,752` (hits 660/749/780), 27 s | **no hit**; `bob@736,752` **killed** (hits t653/t683/t722); the spinner kill completes; REFUSED at the chest stance on `bobsoldier@880,832` (t771, 41 s) |
| 848/1 (Boss Key 2 from `in_L43_176_464` = PKC's 860), its seam | the press kill's death t822 | **both x≈744 bobs killed** (`bob@736,752` t670/721/751, `bob@736,800` t725/768/798); REFUSED at the burn stance on `bobsoldier@880,832` |
| 848/1 over one hammer period (45 seams) | **29 press-kill deaths**, 7 "every key set lands", 9 burn-stance refusals | **0 deaths**; 29 burn stance on `bobsoldier@880,832`, 9 "every key set lands", 4 burn stance on `spinner@816,848`, 3 burn stance on `bob@736,752` |
| 847/1 (from `in_L39_144_0` = PKC's 859), 45 seams | 0 deaths; burn stance on `bob@736,752` 16, `bob@736,800` 13, `bobsoldier@880,832` 13, "every key set" 3 | 0 deaths; `bob@736,752` **7**, `bob@736,800` **11**, `bobsoldier@880,832` **24**, "every key set" 3 |
| the L40 radius (59 requests, each at its own seam) | — | **57 identical**; 2 movers (`375/0`, `848/1`), each one link on to `bobsoldier@880,832` |
| L18 sweep (45 residues) | 45/45 SOLVE | 45/45 SOLVE, **identical rows** (wall times aside) |

**The user's L40 question:**
- **Do opportunistic strikes during the press kill or the walks kill either bob at x≈744?** Yes. The press kill does
  it, not the walks: on 848/1 (PKC's 860) ON kills **both** bobs, and at step 67 it kills `bob@736,752` and leaves
  `bob@736,800` at 2 of 3. The walks already struck. The bobs were never in reach of a walk on these workloads, and
  the L40 walks that do pass bobs are axis-aligned (strike-free on purpose).
- **Does that open the walk L40LATCH found blocked?** L40LATCH is **not on `main`** (no report, no
  `fixtures/l40latch-witness/`), so its own staging was not measurable here. On the closest workloads:
  - where the press kill runs before the blocked walk (848, step 67), the pair is gone or halved, and the burn and chest
    stances' walks then refuse on `bobsoldier@880,832` instead;
  - where the burn stance's corridor is asked BEFORE any press kill (847 = PKC's 859, the leg with the burn stance at
    seam 5933/5949), OPP cannot help. The bobs are not in reach, the walk preview already carries the policy, and the
    AVOID ladder still finds no corridor past the pair at 16 + 13 of 45 seams OFF and 7 + 11 ON.
- **What is left for the chooser slice:** hand-over (1) stands where the walk comes first. `chooseBodyToRemove` returns
  nothing for the pair (no single removal admits a corridor), and `CHOOSER_HIT_SOURCES` excludes chasers. OPP clears
  the pair only when the press kill happens to run beside it first.
  - On 847 the burn stance's walk needs the chooser to remove a chaser pair (two bodies) or the IceTurret/BobSoldier
    work behind it.
  - Everywhere OPP does clear the pair, the next blocker is `bobsoldier@880,832` — its sword at the chest and burn
    stances — which neither OPP nor PKC touches.

**Is the switch ready to flip?** **Ready in behaviour on every measured workload, with the same pins PKC needed.**
- It removes the press kill's chaser deaths (29 → 0 on 860's period) and adds none.
- It turns no solve into a refusal (L18 identical, 57/59 L40 requests identical, both movers one link later).
- OFF is byte-identical (§6).
- A flip still needs:
  - the planner's whole-route A/B (sweep and survey; the cloud gets a 403 on dispatch);
  - re-pinning the 7 unpinned ON movers in the bounded set to their ON answers: `fidelityL40Bk2` D1 ON, `fidelityL40Res`
    D2 ON, `hammerPressKillChasers` step 67, `hammerPressKillGuards` HO2 OFF/ON;
  - and the planner's decision on PKC: with OPP ON, PKC's step never swaps at step 67, and OPP + PKC = OPP there.

## 3. W0 — base, baselines, censuses

| row | result |
|---|---|
| base | `git fetch origin main` → `12b0c124`, the designated branch already there |
| bootstrap | `session_bootstrap.sh --seedling` → READY, node v22.22.0; six non-wasm submodules initialised; `requirements-headless.txt` installed |
| identity block (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; **all six producer `--check`s exit 0** (PKC's four base reds are gone); reference ALL MATCH. The `generated set` row could not take the box (the L40 capture held it) and is re-measured at the head (§6) |
| `ci-producer-checks --jobs=4` | **93 run, 0 red**, 1 skipped (`producer-w0.txt`) |
| bounded set (`bounded.txt`: every test naming `strikePolicyFor`, `createStrikePolicy`, `execKillByPress`, `runHold`, `MOVING_WAIT` or `orbitKill`, plus every hammer and L40 row; the `.slow` files run separately) | **35 files, 633 / 633** (`rows-before.txt`) |
| the L40 capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, the 52 L40 legs by KEY (PKC's list), this tree served on :8000: 52 legs, 59 requests. The Boss Key 2 legs' ids have SHIFTED: PKC's 859/860 are 847/848 here (`l40-bk2-legs.txt`); their captured seams are 5949 and 5261. The capture (59 × ~530 KB) is not committed |

**The executor census** is `executor-census.md`. Every `advance` site in `solverBot.js` (83) and `botDriverV2.js` was
mapped to its executor and read; the table is in §2.

**The missed-opportunity census** is `census-step67-off.txt`, `census-l40-off.txt` and `census-l18-off.txt`, with the
generated controls in §2. The instrument (`tools/opp-register.mjs` + `opp-loader.mjs`) is a load hook that wraps
`levelRun.createLevelRun`, so every run any solver builds is censused. On each tick it asks:
- whether a strikeable body is in reach (the policy's own `strikeCandidates`, owed empty);
- which executor frame drove the tick;
- whether a live decide site read `strikeBodies` on that tick.

## 4. M — the design check

`m-design.md` has the full table. In short:
- the press kill is **safe with the three guards** (§2) and BUILT;
- the axis-aligned walks are **not safe as the policy stands** (a grid-preserving strike would be a new policy row with
  its own measurement): hand-over;
- holds refuse a moved tick (an aim is a move) and live in `botDriverV2.js`: not touched;
- paced waits, collects and TIME-rung movers were never measured missing (the TIME rung's stall walks are already
  armed).

**Step 67, the three arms** (`m-step67-arms.txt`, `m-step67-final.txt`):

| arm | verdict | hits | wall |
|---|---|---|---|
| OFF | REFUSED t780, the press kill's death | 660 / 749 / 780 | 27 s |
| drive only (previews strike-free; a scratch lever, not shipped) | REFUSED t1420 at the chest stance | none | **387 s** |
| **drive + previews (shipped)** | REFUSED t771 at the chest stance (`bobsoldier@880,832`); the kill completes, `bob@736,752` dead | none | 41 s |
| shipped + `PRESS_KILL_CHASERS` ON | identical to the shipped arm (`m-step67-opp-plus-pkc.txt`) | none | 44 s |

The drive-only arm is the ⚖ 30(c) gap made visible: a drive that strikes off a strike-free certificate re-derives its
strike constantly.

**Preview = drive.** At step 67 the walk certified at t604 struck `bob@736,752` at 651/652 and 678/679 in its preview,
and the drive struck on exactly those ticks. The preview's next strike (698/699 on `bob@736,800`) was withheld by the
drive. The press kill's drive runs ahead of its preview (PKC's measured gap: 2.0 px at t651, 5.3 px at t696), and from
where the drive actually stood, that strike would have landed in the hammer. The walk certified at t718 struck at
720/721 and so did the drive. A first cut offered the preview's policy every body. The drive filtered and the preview
did not, so they parted at t696. That is why the offer is one function handed to both.

**The L40 radius and both legs' seam censuses** are in §2 (`radius-l40.txt`, `census-848-847.txt`,
`movers-on-chaserhits.jsonl`).

## 5. I — the switch, the rows, the mutants, the ON radius

- **The switch.** `pressKillCost.OPPORTUNISTIC_STRIKE` (`enabled: SEEDLING_OPPORTUNISTIC_STRIKE === '1'`),
  `OPPORTUNISTIC_STRIKE_DEFAULT = false`, `withOpportunisticStrike(enabled, fn)`, the instrument
  `OPPORTUNISTIC_STRIKE_COUNTS {asked, aimed, pressed, withheld, deferred, strikePreviews, refugePreviews}` and the trace
  `OPPORTUNISTIC_STRIKE_TRACE.sink`. All are re-exported through `solverView.js`, and the docblock carries the user's ⚖
  request. **OFF is byte-identical by construction**: the only new read is `OPPORTUNISTIC_STRIKE.enabled`, which builds
  `opp`; with `opp === null` every new branch is skipped, `deriveStrike`/`deriveRefuge` are called with
  `strikeFor: null` (their OFF path), and `previewWalk`'s `strikeOffer` is `null`. It is measured too (§6).
- **Code** (`solverBot.js` only, plus the switch):
  - `execKillByPressOnce`'s policy, offer, deferral and decide;
  - `oppStrikeOffer`, `oppStrikeLandsClear` and `oppStrikeRows`;
  - `previewWalk`'s opt-in `strikeOffer`;
  - `deriveStrike` / `deriveRefuge`'s opt-in `strikeFor`;
  - the strike record's `previewStrikes` and the kill record's `opportunistic` (both ON only).
- **Rows** (`hammerOpportunisticStrike.test.js`; the 1.9 KB `step67-boot.json`, so no cut was needed):
  1. **ships OFF**;
  2. **step 67, in one OFF/ON pair** (capped at t800 OFF and t760 ON):
     - OFF: the death t780, hits 660/749/780, no chaser hit, every counter 0, no trace;
     - ON: no hit; the bob's hits land in the model at t653/t683/t722 and it leaves the world; 3 aims, 3 presses; **no
       press of the run dashes** (`slashDashed` never rises), and the kill deferred its aim;
     - every strike preview and every refuge preview walked with a policy (`refugePreviews === REFUGE_ETA_CUT_COUNTS.previews`);
     - **ON with no body in reach = OFF**: asked on every walk tick to t650, nothing aimed, keys equal through t651 (the
       aim faces the bob below, the walk's own `down`), t652's `primary` is the first key that differs;
     - **preview = drive** (⚖ 30(c)), as in §4.
  - 2 / 2 in ~85–130 s.
- **Mutants** (`mutants.py`, `mutants.txt`: copy, edit, run, restore):

| mutant | result |
|---|---|
| M1 the drive asks no policy | **RED** (the hits return) |
| M2 the strike preview walks with no policy | **RED** (the strikes move) |
| M3 the refuge preview walks with no policy | **RED** (`refugePreviews` 0 ≠ 1044) |
| M4 the kill never defers its aim | **RED** (the hits move) |
| M5 the offer withholds nothing | **RED** |
| M6 the kill aims over an owed press | **GREEN — survives.** No measured workload reaches an owed press on a tick the kill is ready to aim: step 67, `375/0` and `848/1` answer identically with the guard removed (`m6-replay`). The guard prevents the owed press overriding the kill's aim key and a second press the next tick (a dash). It is reasoned, not witnessed |

- **ON radius, by mover class:**

| workload | movers ON | class |
|---|---|---|
| step 67 | 1 | **death → next link** (chest stance, `bobsoldier@880,832`); `bob@736,752` killed |
| L40, 59 requests | 2 (`375/0`, `848/1`) | **refusal → one link later** (`375/0`); **death → later refusal** (`848/1`, both bobs killed) |
| 848/1 over 45 seams | 29 of 45 leave the death; 2 more go to `safeStep`'s existing "every key set lands" (7 → 9) | death → later refusal |
| 847/1 over 45 seams | 11 re-name the burn stance's blocker (a bob → `bobsoldier@880,832`) | refusal → refusal, same stage |
| L18 sweep | 0 | — |
| generated controls | 0 | no chaser exists |
| bounded set ON (`rows-on.txt`) | **9 rows, 6 files** | every one pins the press kill's death on `bob@736,752` or the kill across it: `fidelityL40Bk2` D1 ON, `fidelityL40Res` D2 ON, `hammerPressKillChasers` step 67, `hammerPressKillGuards` HO2 OFF/ON, and the game witnesses `hammerGhostKillRung` ×2 / `hammerStrikeEtaFloor` ×2 |
| producer roster ON before the pin (`producer-on-before-pin.txt`) | **2 red**: `plan-seedling-hammer-g1-ghostkill`, `-sf-strikefloor` | the game-witnessed kills ACROSS the death leave the witness ON |

- **The two witnesses pinned OFF (PKC's precedent).** The G1/SF producers and their four rows now run under
  `withOpportunisticStrike(false, …)` beside their existing `withPressKillChasers(false, …)`. This is a harness pin, not
  a behaviour change. Both rows files pass ON (24/24, `rows-on-pinned-g1-sf.txt`) and both producers' `--check` exit 0
  ON. As with PKC, the two producers sit in `scripts/procgen`, outside the brief's in-scope list. They are the
  witnesses' fixtures.

No mover turns a solve into a refusal, and no mover adds a death.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path, OFF at the head (⚖ 52) | **36 files, 635 / 635** (633 + the new file's 2; `rows-final.txt`, after the G1/SF pin) |
| the new file | 2 / 2 |
| the hammer `.slow` files (`hammerDashShape.slow`, `hammerEscapeGenerated.slow`; `vitest.slow.config.js`) | **2 / 2** (`slow.txt`) |
| `ci-producer-checks --jobs=4`, defaults | **93 run, 0 red** (`producer-after-off.txt`). A first OFF run read `TREE-MOVED` (`producer-after-off-treemoved.txt`): its own output and this report appeared in the tree while it ran; all 93 producers exited 0 there too |
| `ci-producer-checks --jobs=4`, `SEEDLING_OPPORTUNISTIC_STRIKE=1` | **93 run, 0 red** after pinning G1/SF OFF (`producer-after-on.txt`); before the pin those two were the only reds (`producer-on-before-pin.txt`) |
| identity block at the head (OFF) vs W0 | **every row equal** to W0 (`identity-after.txt`). The `generated set` row now reads `OK` (W0 could not take the box). The reference row read DIFFER there because the log entry had been written after the last regeneration; regenerated before the push (ALL CHECKS PASSED) |
| identity block ON | **equal to OFF, row for row** (`identity-on.txt`) |
| `census-seedling-solver-surface --check` | GREEN **358** after `--write`: three rows classified (`OPPORTUNISTIC_STRIKE`, `_COUNTS`, `_TRACE`), counts moved for the new reads |
| `census-seedling-constants --check` | PASS after `--write`: the switch's counter zeros, classified structural |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (`procgenDocs/generated/docsIndex.js`, `procgen/README.md`'s region); ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless page on :8000) | **ALL PASS** (415 PASS rows, the r9-campaign included; `wasm-ship.txt`) |
| docs | `seedling-bot.md` (the switch, OFF; where strikes happen OFF and ON); `seedling-bot-log.md` (`### Seedling hammer-phase OPP — …`) |
| JSUT | run **40441812694** at `8798c9bc`: **suite 23,393 passed / 0 failed / 0 skipped; slow battery 269 / 269**; every job green (producers, both headless shards, the three browser shards). The earlier run 40424923437 at `ca3b77f6` was red on one cause, the procgen reference not regenerated after the `seedling-bot.md` edit (the headless gate and its vitest row); fixed in `c6d3bb78`. Its slow battery was already 269 / 269. Runs at `36a254a4` / `e3cfa89c` were cancelled by the next push |

## 7. What the planner's harvest A/B should expect

With the switch **OFF**: **no movers**. OFF reads one boolean, and the identity block, the producer roster, the L18
sweep, the bounded set and the 59 L40 requests all match the base (§6).

With it ON, the movers are the L40 press kill's chaser deaths beside the x≈744 bobs:
- the chest / Boss Key 2 chain: step 67 and leg 848 (= 860) move one link on, to `bobsoldier@880,832`. Leg 847
  (= 859) only re-names its burn-stance blocker on some seams. Step 93 (`stanceReentryNextDoor`, the same kill) was not
  run here and should move with step 67;
- the 9 bounded rows of §5 (four of them now pinned OFF).

The page's worker has no `process`, so the switch is OFF there whatever the env. A page-side A/B needs a settings hook
that this slice did not add.

## 8. What the brief got wrong (measured)

- **`orbitKillChaser` / `chaserOrbitKill` ("fidelity's orbit kill … it already calls `strike.decide`")** does not exist
  on `main`: no symbol anywhere in the tree at `12b0c124`.
- **L40LATCH is not on `main`** (no report, no `fixtures/l40latch-witness/`), so its staging and § D1b/§ D2 could not be
  read or replayed.
- **Legs "859/860"** are ids 847/848 at this base (the list shifted). They are addressed here by KEY. Their captured
  seams are 5949/5261, not PKC's 5933/5437.
- **"Where it may NOT exist … the dwell and refuge waits (`dwellUnsafeAt`, `deriveRefuge`'s walk and wait)":**
  - `dwellUnsafeAt` is a pricing closure inside `deriveStrike`, not an executor;
  - the dwell (the stand at the strike cell) and the refuge wait are the press kill's own walk branch (`held` empty
    once arrived), so the one change covers them.
- **"`runHold` … `MOVING_WAIT`, `planPacedWait`":** both executors live in `botDriverV2.js` (out of bounds), and neither
  was ever measured with a strikeable body in reach. `runHold` would refuse an aim (a moved tick) anyway.
- **"TIME-rung movers":** already armed (`strikePolicyFor` at every stall site), except where axis-aligned.
- **The walks are not uniformly armed.** The brief says a walk built through `previewWalk`/`drive` "already strikes
  whatever comes in reach". It does unless the walk is axis-aligned, and on L40 those walks miss 262 in-reach ticks by
  design.

## 9. Residue and hand-overs

- **To the chooser slice (hand-over (1)):** OPP clears the x≈744 pair only when the press kill runs beside it first
  (848, step 67). Where the burn stance's corridor is asked before any press kill (847 = 859), `chooseBodyToRemove`
  still needs to handle the chaser pair; `CHOOSER_HIT_SOURCES` excludes chasers and no single removal admits a
  corridor. ON, 847's blocker is still a bob on 18 of 45 seams.
- **To the IceTurret / BobSoldier work:** with OPP ON, every Boss Key 2 path that gets past the bobs stops at
  `bobsoldier@880,832` (the chest stance at step 67; the burn stance on 847/848). OPP does not touch it: a BobSoldier is
  a chaser, but these refusals are its sword line at the stance corridor, not a body in reach of the press kill. The
  IceTurret static arm was not reached on any workload here.
- **Axis-aligned walks (a new hand-over):** 262 missed ticks on the L40 legs. A grid-preserving strike (aim only along
  the held axis, or only at bodies the walk already faces) would be a new policy row, needing its own measurement
  against the skirted-lane rows (L29, survey step 57).
- **M6 survives** (§5): the guard against the kill aiming over an owed press is unwitnessed. A staging that reaches it
  would make it a row.
- **New refusal class ON**: 848's period gains 4 burn-stance refusals on `spinner@816,848` (the other spinner) and 2
  more "every key set lands". These are the spinner side, not a chaser.
- **The admission's preview** (`derivePressKill` → `deriveStrike(…, {continuation: true})`) is still strike-free. Only
  a strike that the continuation alone found is adopted from it (`fromContinuation`); the executor's own per-tick
  derivation carries the policy. Not measured to matter on any workload here.
- **The planner's dispatches** (403 from the cloud): the probe battery, TT, and the sweep / survey A/B with
  `SEEDLING_OPPORTUNISTIC_STRIKE=1` in the node half. `survey-seedling-route --merge` exits 1 on a BOOT-CHECK-FAIL alone.
- The L40 capture (59 requests, ~31 MB raw) is not committed; the planner's sweep recaptures.
