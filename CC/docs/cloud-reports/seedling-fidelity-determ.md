# seedling-fidelity-determ — the determinism bundle: L69's flier ordinal, L82's solve, G9's F1–F3

| | |
|---|---|
| Session | `seedling-fidelity-determ` (wave 33, planner `seedling-fidelity-planning-15`) |
| Start SHA | `6f5916203e` (= main 6f5916203e, as briefed; 92 default-ON keys, counted from `CONTACT_FIDELITY_DEFAULTS`) |
| Harness branch | `claude/seedling-fidelity-determ-6j2ep2` |
| Commits | (a) `ec18e530` · (b) `96b94b00` · (c) `508677fd` + `0a2a1301` (OFF rows pinned) · records `9ddac2a8`, `69ba2272` (constants/surface) · bot log + this report (the last commit) |
| Server | `serve-nocache.py 9753`, PID 843; wasm p4g (the default build) |
| Switches | `CONTACT_FIDELITY.coverHeldFade` (F1), `CONTACT_FIDELITY.lockRecloseLag` (F2): both **OFF**, byte-identical OFF; `SEEDLING_COVER_HELD_FADE=0\|1`, `SEEDLING_LOCK_RECLOSE_LAG=0\|1`. (a) has no switch. |
| Verdicts | **W0 PASS · (a) PASS · (b) PASS (the solver is deterministic: the variance is the JS arc's arrival staging, handed over) · (c) F1 PASS (unreachable on every committed tape), F2 PASS (6 tape frames, alpha only), F3 PASS (named no-op) · Movers: (a) none; (c) STOP for the flip licence with the list below** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-determ-evidence/` |
| CI | at `ca3e0581` (the report commit): 3 reds, all the docs index the bot-log heading moves (`generated.test.js` docsIndex/README, `docsRender.test.js` 1200→1201 and 709→710, the headless reference gate). Fixed by regenerating `docsIndex.js` and the README region in the follow-up commit. Read CI at the branch head |
| CI at the code head `69ba2272` | run `40555583569`: vitest shards 1/3 + 2/3 **success**, slow battery **success**, producer `--check`s, headless gates ×2 and browser gates (ap-placement, wasm-ship, editor-world) **success**. Shard 3/3 **failed on runner loss** (*"The hosted runner lost communication with the server"*, no test output, 56 min). At `96b94b00` the same shard ran: 6 reds, all the constants census (the records commit had not landed yet), fixed at `9ddac2a8`/`69ba2272` and green locally (`seedlingConstantsCensus` + `seedlingSolverSurface` 60/60). The report commit is docs-only; its push re-runs the suite on the same code (read it at the branch head). |

## The one thing to know first

- **L82 is not a solver problem.** The keyed ×2 captured nine L82 requests, and each one answers ONE plan. That holds
  over 8 solves in one process and over 8 fresh processes.
- Run 1's and run 2's requests for leg 631 answer the SAME plan (`d9e8ee425267`, 1,075 t), although their seam clocks
  differ (5800 vs 5713).
- Run 2's divergence at t=0 is the harness's arrival. The host jump left the game at the L96 landing (144,16), while
  the JS runtime's run (the request's staging and live row) stood at (152,176)/(160,184). Run 1's game stood at
  (152,176) too.
- This is the JS arc's code (`seedlingRoomPlay.jumpSettled`, `seedlingWasmPlayback.js`'s `force-re-arrival`), and it
  is handed over below.

## W0 — the base

**Banks** (head with both keys OFF; (a) is the only default-path change and is measured as its own row):

| row | value |
|---|---|
| identity (`identity-block.sh .`, `evidence/identity-head.txt`) | maze `57e07d21` · acceptance `cf54cdf7` · c3 `31dc4572` · c6 `40d0a4c4` · c4 `c9bdd11e` · ENEMY `87e86da9` · guard `a6d18d49` · AREA `02b22525` · killgate `7c15ed57`/`47116405`/`4d3bbf17` · levels `e28c1e5d`/`fb1a59e5` · generated set OK |
| six `--check`s (head) | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8` — **all exit 0** |
| identity at the pristine base | measured on a pristine copy of `6f5916203e` (`evidence/identity-base.txt`): **every row equal to head**, the six producer md5s and exits and the reference line included. The one exception is "generated set": blank in the copy (no `.git`, an environmental row), `OK` at head |
| reference `--check` | locally **4 regions DIFFER at the base and at head alike** (the substrate capability rows, `registry.js`' `registeredBy`): this box's environment, since CI's reference gate is green at `69ba2272`. The bot-log entry moves the docs index (`docsIndex.js` and the README region: one heading, the word count). It is regenerated in the report's own follow-up commit, and only those two targets are taken from the generator, because the env-dependent regions are not this slice's |
| every producer `--check` (`ci-producer-checks.mjs`, after (a)) | **94 run, 0 red**, 1 skipped by name (`r7-ends-meet`, browser) (`evidence/producers-a-head.txt`) |
| surface / constants / entities / profile | surface RED (line moves only: the new `contactFidelity.js` import in `activators.js`) → `--write` → GREEN **357** · constants RED 5 (the retired `flierSeq` target, the moved `maxForce: -1` row, two new `0.1` discriminators) → classified, `--write` → PASS **6,972** · entities PASS 566 · profile PASS 138 |
| tapeRunner rows | 637 rows, md5 of the sorted verbose lines `1e403567c926becbc4eb094e78ff66fd` OFF = ON, 0 non-pass (my derivation, not comparable to an older report's md5) |
| bounded vitest (defaults) | **104 files, 2,872 / 2,872** (`evidence/vitest-files.txt`): the brief's list (`apReportBosses` has no test of its own, so `fidelityApFlip` stands in), the L69/L82 tests (`fidelityLights`, `fidelityLightsArr`, `jsRuntimeLightsWiring`, `fidelityKingOfFire`, `jsRuntimeBossWiring`, `levelRun*`, `levelRunDigestRead`), `seedlingResponderFade`, `seedlingSolidsSkin`, `activators`, `fidelityDeterm`, and every test naming `stepActivators`, `openActivatorIds`, `activatorsNow`, `createActivatorState`, `lightBoss`, `createLightBossFlier`, `stepResponder`. Plus `seedlingConstantsCensus` + `seedlingSolverSurface` (60/60) and the slow `fidelityLights` (5/5) and `fidelityL32ArenaPrefix` (5/5) |

## (a) L69 `flierSeq` — PASS (no switch)

**Measurement.** `lightBoss.js:258` `let flierSeq = 0` was module level. The new row replays
`lights-witness/lights-solve-sword` twice in one process and compares `stateDigest` every tick. At the base it is red
at tick index 43, the first spawn (mutant M0 below). The solver also built its forks as fresh runs, so a fork's fliers
were numbered after its parent's.

**Change** (`ec18e530`): `createLightBossFlier(x, y, fid, seq = fid + 1)`. The controller passes `fight.bodies.length + 1`.
`bodies` keeps every flier ever spawned, so the ordinal never repeats inside a fight. No new field, so no new digest
row: `seq` was already in `lightsFights` (IN `visit`).

**The fork question.** The game's flier ids are the run's. `cloneLightsFight` copies `bodies` (with their `seq`) and
re-resolves `fliers` through them, so a fork carries the same ordinal and would continue it. In practice nothing
continues it, because the controller spawns all `flierNumber` fliers once (`madeFliers`). This is tested: a clone after
a removal keeps seqs `[1,2,4,5,6]`, and its fliers resolve to its own bodies.

**Same commit:** js's KNOWN-DEFECT pin is flipped. `seedlingBossSkin.test.js` loses the `L69-lights-kill` row's
`digestAcrossRuns: false` and the `.not.toBe` branch, and the digest is compared like every other tape (green).

**Rows** (`fidelityDeterm.test.js` §(a)): two fights in one process give 1..6 each; a clone keeps its ordinal;
`lights-solve-sword` twice in one process has an equal `stateDigest` every tick.

**Mutant** (copy + restore; restores the module counter). Predicted: rows 1 and 3 red. Observed: **all 3 red**. Row 2
also hard-codes `[1,2,4,5,6]`, which a module counter fails as soon as an earlier row has spawned. The prediction
missed it; the row is order-sensitive under the mutant, and that is the defect it pins.

**Byte-identity.** The first L69 run in any process numbers 1..6 exactly as before:
- every producer `--check` is rc 0 (94);
- `fidelityLights.slow` (five solves in one process) is 5/5 key for key;
- survey step 170 (L69) has the same row md5 at base and head (`85972c0c…`, timings stripped);
- no tape moves.

## (b) L82's solve — PASS (deterministic; the divergence handed to the JS arc)

**W0** (`evidence/b-*.txt`, the captured requests of 40536788606 / 40536803626 at `7266baa10d`; legs 629–632 there,
**633–636 at this base**). Nine requests: 4 from run 1, and 5 from run 2 (leg 631 has two: the diverged play and the
recovery).

| replay | result |
|---|---|
| 8 fresh processes each (`replay-seedling-solve-request.mjs --n=8`) | 1 distinct answer, 1 distinct trace, every request |
| 8 solves in ONE process each (`b-inproc.mjs`) | 1 distinct answer every request |
| captured `source` vs `atlasLevelSource()` | identical answers (so the committed row can drop the 662 kB source) |
| run 1 vs run 2, by leg | 629 `2ddafa29` 1,079 t · 630 `553bfdb3` 870 t · 631 `d9e8ee42` 1,075 t (both of run 2's too) · 632 `10c74841` 865 t: **equal across runs**, at seam clocks that differ by up to 87 t |

**Where the variance is.** The captured requests are identical between the runs except `staging.seam.time`. In both
runs, staging boots (152,176) and the live row is (160,184), and the staging reproduces the page's live digest (row
"self-consistent"). The rows differ in `landed`, the host jump's end (`jumpSettled`, 2 jumps in every run):

- run 1, leg 631: the game ended the jump at **(152,176)**, the staging's spot, and the tape played on plan;
- run 2, leg 631: the game ended at **(144,16)**, the L96 teleporter's own landing (`teleporter@32,64` `playerx 144,
  playery 16`), and tape 1's frame 0 read the game at (152,24) against the plan's (160,184). The recovery re-arrived,
  and the second tape played on plan.

So the JS runtime's run and the game disagreed about where the player stood when the tape started. The solve did not
vary. **What moves the player from (144,16) to (152,176) in L82** (the pit arrival also lands at (152,176)) is not
derived here. It is the next question for the JS arc's arrival work, and it is a race against the harness's 3 s
`gameAt` poll.

**D.** There is nothing to fix in the fidelity arc's files. The new row (`fidelityDeterm.test.js` §(b), fixture
`fixtures/determ/l82-leg631-run2-request.json`, 2.7 kB): the diverging request solved twice in one process gives an
equal plan (`d9e8ee425267`, 1,075 t, work 174, ending in L96) and an equal `stateDigest` every tick. Its staging
reproduces the captured live digest.

## (c) G9's F1–F3 — the responder fades' model side

**F1 `coverHeldFade` (OFF).** `Cover.update`'s inactive arm collides `["Solid","Player"]`. A hit that is not a `Chest`
keeps type AND alpha; no hit resets. Cover has no `alpha = 1` line of its own. The model ran the Lock's
`if (!s.open) s.alpha = 1`. ON skips that line for a cover, so an occupied released cover keeps its alpha and a re-press
resumes. The Chest arm is not carried: L38's one chest under a cover fills the cell (both 16×16 at the same origin), so
nothing else can overlap it while it is closed, and an opened chest is `type = ""` (`Chest.as:77`). **Reach:** an
occupant inside a still-Solid cover. The anchor census finds 0 such ticks on the 42 opening tapes, and no committed
tape or staging reaches the branch, so there is no p4g witness (named, not skipped). The unit row matches
`stepResponder`'s count (< 10).

**F2 `lockRecloseLag` (OFF).** In `Lock.activationStep`'s inactive arm, `if (type == normType) alpha = 1` runs BEFORE
`returnToNormal()`. On the re-close step the type is still "", so alpha stays 0, and the next step restores it. If the
group is active on that next step, `alpha > 0` is false and `turnOff()` re-opens at once. ON:
- the re-close keeps alpha 0 (plain fade locks only: `writesPersistence`, so a touch or key responder is untouched);
- the lag re-open is the existing `turnOff` arm, with its `lockopen` event;
- `openActivatorIdsBeforeLatestStep` (spinnerLockLag's reader) counts that turnOff as the latest step's, through a
  one-step `lagReopen` mark that is written only ON.

**The six tape frames** (re-derived with `evidence/c-lag-frames.mjs`): `l71-button-lock` t126,
`r2-walk-5-darkshield` t1445, `r2-walk-full` t7738, `r3-walk-5-darkshield` t1445, `r3-walk-full` t9213 (all
`lock@112,160`), and `r5-shaft` t2261 (`wandlock@48,160`). In **none** is the lock pressed on the next step (held 0), so
F2 ON moves the alpha on those six ticks and nothing else.

**F3 (no key: a named no-op).** After the open, `BossLock.update` keeps `alpha -= 0.05; scale += 0.05` while
`activate` holds (it latches). Its readers:
- `:77` `alpha <= 0 && type != ""` is false once open;
- `render` (`:95-96`) clamps `Image.alpha` and restores alpha/scale to 1 at `:125`;
- the keyType 4 night pass is `alpha * 0.2`, clamped;
- the `myKey` lines read `keyTimer`;
- the hitbox is `setHitbox`, not scaled.

Nothing in the game reads the private values. The model's pinned 0 is the drawn value. A row asserts the skin's private
alpha < 0 and scale > 2 with drawn alpha 0.

**Anchor census** (`seedlingResponderFade.test.js` §2, `evidence/c-census.txt`):

| arm | ticks | opens | equal | lock re-close lag | cover held | kill-lock fade | drift |
|---|---|---|---|---|---|---|---|
| OFF | 172,786 | 76 | 172,680 | **6** | 0 | 100 | 0 |
| both ON | 172,786 | 76 | 172,686 | **0** | 0 | 100 | 0 |

**Mutants** (predicted first, copy + restore; each exactly as predicted):

| mutant | predicted | observed |
|---|---|---|
| M1 F1's gate forced false | the F1 ON row red only | 1 failed: that row |
| M2 F2 always restores alpha 1 | the "F2 ON alpha 0" row red; "released again" green | 1 failed: that row |
| M3 `lagReopen` dropped from the reader | the "F2 ON alpha 0" row red (its spinnerLockLag assertion) | 1 failed: that row |

**Fields reshaped:** none renamed. The activator state gains `lagReopen` (ON only, one step), which is read by
`openActivatorIdsBeforeLatestStep`. `activatorStates` is already IN `visit`, so no digest row is owed.
`seedlingSkinRenderer`, `seedlingResponderFade`, `seedlingSolidsSkin` and `activators` are green at the defaults.

## Movers — the survey/sweep rows (before → after)

- **(a)** Survey step 170 (L69) is equal (row md5). Every producer `--check` and tape is unchanged. The sweep's L69
  legs ran in a page worker whose earlier solves advanced the old counter, so their digests depended on the worker's
  history. They should now repeat exactly; a row may move once relative to an older sweep.
- **(c) both ON:**
  - survey, 25 steps in every responder room plus L69/L82 (29, 39, 41, 48, 54, 65, 66, 75, 93, 94, 96, 106, 134, 135,
    147, 148, 170, 176, 180, 188, 189, 207, 209, 210, 232): **0 rows move**, 23/25 SOLVED in both arms
    (`evidence/survey-25-*.txt`);
  - every producer `--check` rc 0 (94; `evidence/producers-c-on.txt`; the one `TREE-MOVED` row is my own records
    commit mid-run);
  - tapeRunner 637 rows equal;
  - arrival-composites probe at head (p4g, local): ALL CHECKS PASSED (95 PASS).
- **Bounded vitest, both ON:** 4 red → 2 after the fix (`evidence/vitest-on-summary.txt`):
  - `contactFidelity.test.js` "the shipped defaults: all three ON" (the defaults pin; expected);
  - **`activators.test.js` "and releasing the button re-solidifies it — but only once clear"**: this STUB re-presses
    on the step after the re-close and asserts 100 more steps stay shut ("the fade RESETS … because the else-arm
    restores alpha to 1"). That is the model's old answer; the game re-opens on that step. A flip owes this row's
    re-pin;
  - my two OFF rows read the process default, so they are now pinned OFF (`0a2a1301`).

**CI dispatches for the planner** (I cannot dispatch):

1. Keyed sweep ×2, defaults, `capture_requests: true` (`seedling-divergence-sweep.yml`, branch
   `claude/seedling-fidelity-determ-6j2ep2`): `keys=level_69 <- in_pit_L70_3_8 -> exit:out_lightbosscontroller_72_72|level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights|level_82 <- in_pit_L71_10_17 -> exit:out_teleporter_144_0|level_82 <- in_pit_L71_10_17 -> location:Level 082 - King of Fire|level_82 <- in_L96_32_64 -> exit:out_teleporter_144_0|level_82 <- in_L96_32_64 -> location:Level 082 - King of Fire`
   (legs 576, 577, 633–636 at this base). Expectation: the L69 rows repeat across the two runs. The L82 t=0 recovery
   can still appear, because it is the arrival staging and not fixed here.
2. The same keys ×2 with `contact_fidelity=<the 92 default-ON keys>,coverHeldFade,lockRecloseLag` (the 92 are
   `Object.entries(CONTACT_FIDELITY_DEFAULTS).filter(([,v]) => v)`; every unlisted key goes OFF), plus the responder
   rooms' legs (`region` level_20/30/38/39/41/48/71/110 in `seedling-divergence-legs.mjs --blocks` at this base).
3. `seedling-probe.yml -f battery=standard` on the branch. Only arrival-composites was run locally.
4. Survey A/B is not needed for (a). For (c), only if the planner wants the full route beyond the 25 steps:
   `seedling-survey.yml` at the branch, defaults vs `SEEDLING_COVER_HELD_FADE=1 SEEDLING_LOCK_RECLOSE_LAG=1`.

## The JS arc — pins that move + what it must wire

- **Moved (in my commit, as the brief asked):** `seedlingBossSkin.test.js` `L69-lights-kill` compares the digest
  across runs. The KNOWN-DEFECT marker is gone.
- **Handed over (L82):** the arrival staging race. Read `landed` against `request.live.row`. In run 2 of 40536803626,
  leg 631 has `landed` (144,16) with live (160,184). A guard that refuses to ship tape 1 while
  `readState()`'s position ≠ the live run's would turn the silent t=0 divergence into a named wait. What moves the
  L82 player from the L96 landing to (152,176) is unexplained; the pit arrival from L71 lands there too.
- Nothing to wire for (c): no new staging/result field, no new refusal kind.

## Hammer arc

Nothing handed over. No hunk touches the hammer arc's region. `openActivatorIdsBeforeLatestStep` is fidelity L40RES's
reader in `activators.js`.

## What the brief got wrong (measured)

- **"L82's solve is not deterministic."** The solve is. The run-to-run flip is the arrival staging. This was measured
  over 9 captured requests × (8 in one process + 8 fresh), plus the cross-run equality.
- **Leg ids:** the brief's 633–636 for the L82 legs match this base (629–632 at `7266baa10d`, as it said).
- **F1's reach:** "a re-press opens in ≈5–6 steps vs 10" is right for the class, but no route reaches it. A cover is
  Solid while it fades, so an occupant inside a closed, faded cover needs an overlap that the census, every committed
  tape and the survey's responder steps never produce.
- **The Cover residue:** the chest half of `Cover.update` (a Chest overlap resets even with an occupant) is unreachable
  by geometry, as above. `SOLIDS_PENDING`'s "unlisted Solid" residue is the skin's and is unchanged.

## Residue

- F1's game witness: none possible on any committed tape or route staging. It would need a hand-made staging (a block
  or crusher inside a fading cover).
- F2's behavioural half (re-press on the lag step) has no tape or route instance. The six frames are alpha only.
- The survey A/B covers 25 steps locally, not the full route.

## Byte-inertia

Both keys OFF: every hunk is gated (`coverHeld`, `lag`, and the `lagReopen` write and read), so the identity block,
the producer `--check`s, the tapeRunner rows and the bounded set are unchanged. The (a) default-path change is
byte-inert for every first L69 run in a process, measured as above.

## Rows to BANK

- `fidelityDeterm.test.js` (12 rows): (a) ×3, (b) ×2, (c) ×7 (F1 OFF/ON ×3, F2 OFF/ON ×3, F3 no-op).
- `seedlingBossSkin.test.js` §5 `L69-lights-kill`: digest equal across runs.
- Defaults pin: `coverHeldFade: false`, `lockRecloseLag: false` (`contactFidelity.test.js`).
- Constants: 6,972 rows; surface 357.
