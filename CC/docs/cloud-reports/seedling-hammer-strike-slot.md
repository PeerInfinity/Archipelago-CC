# Seedling hammer-phase STRIKE-SLOT — the strike policy reads the selected slot (`STRIKE_SLOT`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-strike-slot` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `6d9f991739` (= `origin/main` at launch; `CHOOSER_PAIR` ON at size 3 there) |
| Head | W0 `ff2d8416`, M `f2f430b4`, I `2a83231a`, D `73da9e2b` + the evidence commits after it; this report is the last commit on the branch |
| Branch | `claude/seedling-strike-slot-policy-6t7wu5` (the harness's designated branch). Nothing pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-strike-slot-evidence/` (`tools/` the instruments, `census/` the census and ON radius, `m/` the design scratch) |
| Scope | No mid-run message reached this session; the scope is the brief's. No fidelity W36 branch was scratch-merged: CORPSEBUMP2's case reproduces on main without its key (§3), so every answer below is measured on this branch's own base |

## 2. The answer first

**The one thing to know first: no non-blade press on any measured workload is a body STRIKE. Every one is a
`planSwordDash` SCHEDULED press** (a dash planned for displacement), and `planSwordDash` gates on the inventory exactly
as `strikePolicyFor` does. So the fix had to close both: ON, `strikePolicyFor` builds no policy for a non-blade slot (and
a built one stands down), and `planSwordDash` refuses by name. A Fire or Wand press buys no displacement: removing those
presses costs 0 ticks on every measured workload.

| question | answer |
|---|---|
| Where does a strike-policy press happen with a non-blade selected? | Two places. **L40's latch chain** (`latch-boot`): `execCorpseWeigh` walks to corpse bump 2's stance with Fire selected; its one driven non-blade press (t1182 LWEIGH's arm, t1117 hammer-2's TA arm) is a scheduled dash press, run as a **Fire press** whose 5th dispatch reaches `iceturret@472,400`'s corpse (LWEIGH: then *"ALREADY on (30,24)"*, CORPSEBUMP2's refusal, reproduced on main). **Leg 867 (L43, from `in_L40_320_576`)**: the arrival has the **Wand** selected (slot 3 of `[0,1,3,2]`); 10 driven scheduled presses each fire a WandShot 7 t later, all in the anytime solver's dashed `full` pass, which is not the pass it chooses |
| the producer roster | one more: `apb-l32-fresh-fire-held` (L32 with the Fire held): 3 driven scheduled presses with Fire selected, each a Fire press that does nothing (row below) |
| r9 campaign / route survey | none: 26,582 and 446,481 policy presses, all `sword` / `ghostsword` |
| What did the model assume? | a sword dash (`planned: true`; `planSwordDash`'s preview prices the dash's knockback). The drive's `levelRun` (= `useItem`'s switch) ran the item's own press |
| The design | **(1) built**: gate on `primaryWeapon` (`pressIsBlade`: `ghostsword`; `sword` only while the Ghost Sword is not held). (2) pricing the item's press: not built — no measured press was wanted for its item's effect, and it buys no displacement. (3) re-selecting the blade: saves 12 t / 25 t on the latch arms but is an executor or drive change, out of bounds — handed over |
| ON, CORPSEBUMP2's arm (LWEIGH) | **refusal at bump 2 → runs on** to the strategy bound at `pushableblock@576,560` (`applied 4 strategies … [shove(pushableblockfire@576,576), weigh(wandlock@448,432), hold(wandlock@480,560), weigh(wandlock@800,400)]`), 3586 t, hitless — the same bound CORPSEBUMP2's rest read reaches, from the policy side |
| ON, hammer-2's TA arm | 4142 t both ways, hitless; exactly **one key** differs (t1117 `primary+up` → `up`); the corpse's tiles identical |
| ON, L40 (58 captured requests, CPAIR size 3 default) | 55/58 identical; 867:0, 867:1, 880:0 (all L43 with the Wand selected) move in **work only** (199 → 168, 66 → 52, 131 → 130); answer, ticks and plan identical |
| ON, survey / r9 | no mover (201/237 SOLVED, every step line equal; r9 `--check` green) |
| ON, the producer roster | **one committed tape moves**: `plan-seedling-encounters`' `apb-l32-fresh-fire-held` (L32, the Fire held from the server). OFF its solver walks press X three times with Fire selected (t840, t854 in `execBobBossEncounter`'s walk, t934 in `execReachPit`'s), all `planSwordDash` scheduled presses, all Fire presses that do nothing (the tree is burned by the `burn` verb's own press at t880 both ways). ON those three presses are gone: 1056 t both ways, the same equips, the same burn, level 30, hitless. `--check` reads DRIFT, so a flip re-records this one tape |
| Kills / ticks saved / refusals moved | 0 / 0 on the roster workloads; 1 refusal → longer chain (LWEIGH's arm, a hammer probe arm, not a roster default); 1 committed tape re-records (3 presses fewer, same length) |

## 3. W0 — base and census

| row | result |
|---|---|
| base | `git fetch origin main` → `6d9f991739`; branch reset onto it |
| bootstrap | `session_bootstrap.sh --seedling` → done (node v22.23.4). Its AP `pip` step failed on an interactive prompt under `/root/CC/seed` (not this tree), as in AXIS. Every non-wasm submodule initialised before the first gate |
| the L40 capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --capture-requests`, the 52 L40 keys (`l40-leg-keys.txt`, AXIS's list), this tree on :8000: 52 legs (42 done, 9 failed, 1 timeout; `capture-legs.txt`), **58 requests** (not committed, ~MB) |

**The instrument** (`tools/slot-loader.mjs` + `slot-register.mjs`, measurement only): a load hook makes
`strikePolicyFor` hand each policy it builds to a global, which wraps its `decide`. Every decision that adds `primary`
is counted with `run.progress('primaryWeapon')`; a non-blade one is a row with the policy's trace row (target, dash,
planned), a 12-frame stack and, for a DRIVEN press (no preview frame on the stack), the run's `presses` ledger rows of
that press tick (and its `wandShots`). `slot-replay.mjs` / `slot-batch.mjs` replay captured requests (`solveAnytime`,
one process each, adapted from AXIS); `slot-latch.mjs` solves L40's latch chain from the committed `latch-boot` under
LWEIGH's arm (CPAIR 3 + `LATCH_WEIGH_FIRST`, `TURRET_APPROACH` OFF, `turretSnapPricing` OFF, `orbitFreeAim` +
`strategyBoundDistinct` ON — CORPSEBUMP2's arm minus its own key) and hammer-2's TA arm; the survey runs its solves in
children, so the hook rides `NODE_OPTIONS`.

**The census** (`census/*-sum.txt`):

| workload | policies | presses | non-blade (driven / preview) |
|---|---|---|---|
| r9 campaign `--check` | 5,158 | 26,582 | 0 |
| route survey `--through=end` (237 steps) | 77,154 | 446,481 | 0 |
| L40 latch, LWEIGH's arm | 607 | 3,789 | 13 (1 / 12), all Fire, all `planned` |
| L40 latch, TA arm | 1,206 | 9,206 | 13 (1 / 12), all Fire, all `planned` |
| L40 captured requests (58) | 2,582 | 35,338 | 292 (10 / 282), all Wand, all `planned`, all leg 867 |

The driven rows:

| workload | tick | item | stance / walk | what the model assumed | what the game (model = `useItem`) did |
|---|---|---|---|---|---|
| latch LWEIGH | t1182 | Fire (slot 1 of `[0,1]`) | (487.97,440.02), `primary+up`, `execCorpseWeigh` → `walkTo` → corpse bump 2's stance | a scheduled sword dash | a Fire press: dispatches t1186–t1190, the 5th lists `iceturret@472,400`; the corpse glides on to (30,24), and bump 2's `runFire` refuses *"ALREADY on (30,24)"* (CORPSEBUMP2's p4g witness: the same press at the same tick, 0 px) |
| latch TA | t1117 | Fire | (487.05,440.72), `primary+up`, the same walk | a scheduled sword dash | a Fire press: t1121–t1125, the 5th lists the corpse, but its tiles are the same with and without it (`m/latch-ta-replays.txt`: (30,26)@965 → (30,25)@1025 → (30,24)@1159 both ways) |
| L40 req 867:0 (L43) | t830, 838, 850, 858, 870, 878, 1048, 1056 | Wand (slot 3 of `[0,1,3,2]`) | the leg's walks (`walkToUnder` / `solveSegmentUnder`) | scheduled sword dashes | a WandShot each, spawned 7 t later (`wand@43#830` …, `m/w867-wandshots.jsonl`) — in the `full` pass (1093 t), which loses to the `dashless` pass (1054 t) |
| L40 req 867:1 | t343, t351 | Wand | the same | the same | the same |

No row is a body strike (`target` is null on every one): the policy's strike half never fired on a non-blade slot.

## 4. M — the design check

| design | on the census ticks | latch LWEIGH | latch TA | L40 (58) | survey / r9 | verdict |
|---|---|---|---|---|---|---|
| (1) the policy offers nothing for a non-blade slot (+ `planSwordDash` refuses) | every non-blade press gone (ON census: 0 rows anywhere) | **passes bump 2**: 3586 t to the strategy bound at `pushableblock@576,560`, hitless | 4142 t, hitless; 1 key differs (t1117) | 55/58 identical, 3 work-only | identical | **BUILT** |
| (2) price the selected item's press | — | the press would have to be modelled as a bump of the corpse inside a walk (fidelity's executor-side rest read is that, for one executor) | the press moved nothing | a WandShot per press, wanted by nothing | — | **not built**: no measured press is wanted for its item's effect, and none buys displacement (TA 4142 t with and without it; 867's `full` pass 1093 t with and without its ten) |
| (3) re-select a blade before the walk | an equip costs **no tick** (`levelRun.equipNow` writes `Main.primary` at the reached tick; `execBurn`'s docblock); a scratch hook (`tools/m3-loader.mjs`) equips the arrival slot before each corpse-bump walk, and the weigh's own check re-selects Fire at the stance | **3561 t** to the same bound (−25), hitless | **4130 t** (−12), hitless; the dash is a real sword dash | not measured (867's Wand comes from the arrival, no executor equipped it) | — | **not built here, handed over**: it is either an executor change in `execCorpseWeigh` (fidelity's CORPSEBUMP2 edits the same loop) or an equip channel in `botDriverV2.drive` / `previewWalk` (out of bounds). It keeps the slot rule of (1) intact: (1) is the gate, (3) is a saving on top |

What each kills / saves / breaks: (1) kills the CORPSEBUMP2 refusal on LWEIGH's arm, saves nothing elsewhere, breaks
nothing measured. (3) saves 12–25 t on the latch arms and breaks nothing measured, but outside this slice's files.

Measurement files: `m/latch-*-on.txt` (ON solves), `m/latch-ta-off-vs-on.txt` (the key diff), `m/m3-*.txt` (design 3),
`m/latch-ta-replays.txt` / `m/latch-lweigh-m3-replay.txt` (model replays: hits, Fire presses, the corpse's tiles).

## 5. I — the switch, rows, mutants, the ON radius

- **The switch** (`strikeSlot.js`, a new family file): `STRIKE_SLOT` (`enabled: SEEDLING_STRIKE_SLOT === '1'`),
  `STRIKE_SLOT_DEFAULT = false`, `withStrikeSlot(enabled, fn)`, the instrument `STRIKE_SLOT_COUNTS {refused, stoodDown,
  dashRefused}` + `resetStrikeSlotCounts()`, and `pressIsBlade(weapon, inventory)`. `SOLVER_ENV_NAMES` has
  `SEEDLING_STRIKE_SLOT`.
- **Code**:
  - `solverBot.strikePolicyFor`: after the inventory gate, ON only, `slotIsBlade = () => pressIsBlade(primaryWeapon,
    inventory)`; false now → `null` (counted `refused`); true → handed to `createStrikePolicy`.
  - `strikePolicy.createStrikePolicy`: a new optional `slotIsBlade` (default `null`); `decide` asks it after the
    `hasSword` check and, false, drops any owed aim and returns the walk's keys (`stoodDown`). A policy built before an
    equip cannot press the new item.
  - `solverBot.planSwordDash`: after its no-sword refusal, ON only, refuses by name (*"the selected slot fires `fire`, not
    a blade …"*, `dashRefused`). ⚠ This is outside the two functions the brief named, but it is the same gate on the
    same press: without it ON would hand `strikePolicyFor` a plan for a slot it refuses (the preview and the drive would
    still agree — both undashed — but the plan's report would claim a dash nobody takes).
  - **OFF is byte-identical by construction**: OFF `slotIsBlade` is `null`, `createStrikePolicy` gets no new key, and
    `planSwordDash`'s new branch is short-circuited on the boolean.
- **Rows** (`hammerStrikeSlot.test.js`, 5 rows, ~0.3 s, no fixture beyond the atlas — L6's `bob@112,48` on its lane):
  1. ships OFF (default, env read, channel name; OFF a Fire selection still builds a policy, ON none);
  2. **the Fire-selected walk**: OFF the policy aims and presses at the bob at t11, 23, 35, 47, 59 and every press is a
     Fire press — five dispatches T+4..T+8, none touching the bob, no sword press at all; ON no policy, no `primary`, the
     same two contacts (t20, t42); the preview spends the drive's keys either way (⚖ 30(c));
  3. a built policy stands down once Fire is equipped (`stoodDown` 1); `planSwordDash` refuses by name ON;
  4. **a blade-selected walk = OFF**, key for key and trace for trace, the sword's hits landing;
  5. **the Ghost Sword** (slots `[4]`): `ghostsword` selected, ON = OFF; a `sword` reading while it is held (the
     pre-GHOSTSWORD model's) builds no policy ON; `pressIsBlade`'s table.
  - The game's answer pinned: the model's `useItem` (`levelRun.weaponForPress` → the `presses` ledger). The game's own
    witness of the same thing is CORPSEBUMP2's `corpsebump2-walk-press` (p4g, 0 px; on fidelity's branch, 461 KB, not
    on main), cited in the docblock and not copied (§9).
- **Mutants** (`tools/mutants.py`, `mutants.txt`):

| mutant | result |
|---|---|
| M1 gate back on the inventory (`slotIsBlade` never built) | **RED** (rows 1, 2, 3, 5) |
| M2 accept `sword` while the Ghost Sword is held | **RED** (row 5) |
| M3 a built policy never stands down | **RED** (row 3) |
| M4 `planSwordDash` ignores the slot | **RED** (row 3) |

- **The ON radius, by mover class:**

| workload | movers ON | class |
|---|---|---|
| L40, 58 captured requests (CPAIR size 3 default) | **3** (867:0, 867:1, 880:0) | **work only**: the `full` pass refuses its Wand "dashes" and spends less (`passes`: 867:0 full 134 → 103 work, 1093 t both); the chosen `dashless` answer is byte-identical |
| route survey, 237 steps | 0 | — |
| r9 campaign `--check` | 0 (green ON) | — |
| L40 latch, LWEIGH's arm (a probe arm) | 1 | **refusal → longer refusal**: bump 2 is made from the stance, the chain runs on to the strategy bound (3586 t, hitless) |
| L40 latch, TA arm | 1 | **one key** (t1117), same length, hitless |
| bounded set ON | 0 (619/619) | — |
| producer roster ON | **1** (`plan-seedling-encounters`, 96 others exit 0) | **re-record, inputs only**: `apb-l32-fresh-fire-held` loses its three walk Fire presses (t840, t854, t934); tick count, equips, the burn (t880, gone t925), level 30 and 0 hits unchanged (`producers/apb-l32-fresh-fire-held-off-vs-on.txt`; the ON tape `producers/apb-l32-fresh-fire-held.ON.json`). The producer's other ten tapes are byte-identical ON |
| identity block ON | **0** (equal to OFF row for row) | — |

No mover turns a solve into a refusal, adds a hit or adds a death.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52; `bounded-files.txt`: every test naming `strikePolicyFor` / `createStrikePolicy` / `planSwordDash` / `STRIKE_SLOT` / the env channel / the strategy switch, every non-slow hammer row, `fidelityL40Bk2b`, `entityBlocks`, the two census tests) | **44 files, 619 / 619** OFF (`bounded-off.txt`) and **619 / 619** with `SEEDLING_STRIKE_SLOT=1` (`bounded-on.txt`) |
| the new file | 5 / 5 |
| hammer `.slow` files (7: `hammerDashShape`, `hammerEscapeGenerated`, `hammerIceTurretStatic`, `hammerLatchWeigh`, `hammerSouthDoor`, `hammerSpinnerPress`, `hammerTurretApproach`; `vitest.slow.config.js`) | **7 files, 15 / 15** (`slow-hammer.txt`; OFF) |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`producer-off.txt`). A first run read 1 red, the battery's `TREE-MOVED` guard alone (this slice's evidence files changed mid-run; all 97 producers exited 0: `producer-off-treemoved.txt`) |
| `ci-producer-checks --jobs=4`, `SEEDLING_STRIKE_SLOT=1` | **96 green, 1 red by design**: `plan-seedling-encounters` DRIFT on `apb-l32-fresh-fire-held` (§5, the ON mover); the second red is `TREE-MOVED` from the slow battery's own output file landing mid-run (`producer-on-treemoved.txt`) |
| identity block | at the head: **every row equal to AXIS's published at-head block** (`seedling-hammer-axis-strikes-evidence/identity-after.txt`, ⚖ 32 A baseline by quotation), the six producer `--check` rows equal to the base worktree's and exit 0, `generated set` OK, reference ALL MATCH (`identity-head.txt`). The bare base worktree could not run the generator rows (no submodules there: empty md5s, `identity-base-bare-worktree.txt`). ON: equal to OFF row for row (`identity-on.txt`) |
| `census-seedling-solver-surface --check` | GREEN **371** after `--write` (`strikeSlot.js` joins the family table; `run:progress` sites 190 → 195: `primaryWeapon` 22 → 25 and `inventory` 54 → 56 in `solverBot.js`). First cut re-exported the switch through `solverView.js` and was refused by the door rule (a family file is imported directly) |
| `census-seedling-constants --check` | PASS (no new classified literal) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (`procgen/README.md` region, `procgenDocs/generated/docsIndex.js`); ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, :8000) | **ALL PASS** (416 PASS rows, the r9 campaign included; `wasm-ship.txt`) |
| `solverEnvChannel.test.js`, `strategySwitch.test.js` | green (in the bounded set) |
| docs | `seedling-bot.md` (the switch, OFF, what it does and what it measured); `seedling-bot-log.md` (`### Seedling hammer-phase STRIKE-SLOT — …`) |
| JSUT | run **41392509282** at `2a83231a` (the code commit; every later commit is docs, the regenerated docs index or evidence): suite **25,272 passed / 0 failed / 0 skipped**, **slow battery 365 / 365**. Run 41401170025 at `73da9e2b` was cancelled by the next push; run **41402897773** at `b94480af` (the docs commit) was still running its slow job when this report was committed — the planner should read it with `node scripts/procgen/ci-summary.mjs b94480af --wait` |

## 7. What the harvest A/B should expect

**OFF: no movers.** OFF reads one boolean in `strikePolicyFor` and one in `planSwordDash` and passes nothing new to
`createStrikePolicy`; every measured workload matches the base.

**ON** (`SEEDLING_STRIKE_SLOT=1`): on the sweep, the L43 legs whose arrival holds a non-blade slot (867, 880) should keep
their verdicts and ticks (the chosen pass is `dashless`), with less solver work; every other L40 leg should equal OFF.
**The ON sweep dispatch to run** (`seedling-divergence-sweep.yml`):

- `mode=inv`, `producer=solver`, `page_legs=1`, `solver_env=SEEDLING_STRIKE_SLOT=1`,
  `keys=` the 52 L40 keys of `seedling-hammer-strike-slot-evidence/l40-leg-keys.txt` joined with `|` — and the same
  dispatch without `solver_env` as its OFF control.
- If only a narrow arm is wanted: `keys=level_43__r3c8 <- in_L40_320_576 ~> level_43__r13c7 ~> level_43__r8c7 -> exit:out_teleporter_144_64|level_43__r8c7 <- in_L40_320_576 ~> level_43__r13c7 -> location:Level 043 - Totem of Lacste`.
- ⚠ A flip is a re-record of one committed tape: `plan-seedling-encounters` ON reads DRIFT on `apb-l32-fresh-fire-held`
  (three Fire presses fewer, same length); every other producer is green ON. That tape's game witness (if the flip is
  taken) is the r8/encounter page replay of the re-recorded tape.
- The latch chain is not a sweep leg: its game witness is `probe-seedling-l40latch.mjs` (fidelity's). With this switch
  ON, LWEIGH's arm makes bump 2 from the stance; that tape is new and has no game witness yet (§9).

## 8. What the brief got wrong (measured)

- **"the walk to bump-2's stance pressed X with Fire selected … X presses that the policy treats as sword strikes or
  dashes"**: true, but on every measured workload it is only the second: a **`planSwordDash` scheduled press**, never a
  body strike (`target` null, `planned` true on all 318 non-blade rows). So the fix direction "gate `strikePolicyFor` on
  `primaryWeapon`" is necessary but not sufficient: `planSwordDash` gates on the inventory too and had to get the same
  gate.
- **"any executor that walks with Fire … selected"**: there is a second source: the **arrival's** selected slot. Leg 867
  arrives on L43 with the Wand selected (the game's own `Main.primary`), and no executor equipped it.
- **CORPSEBUMP2's "hammer-2's solved arm ALSO presses X with Fire selected, out of the corpse's reach"**: the model's 5th
  dispatch of that press (t1125) does list the corpse among its hits; it just does not move it (the corpse's tiles are
  identical with and without the press). "Out of reach" is right in effect, not in the ledger.
- The brief anticipated "Fire, the spear, the wand: whatever the run models" — the census found Fire and the Wand only;
  no spear-selected walk on any workload.

## 9. Residue and hand-overs

- **Design (3), the 12–25 t saving**: re-selecting the blade before `execCorpseWeigh`'s walks (then Fire at the stance)
  is measured hitless and shorter on both latch arms. It is an `execCorpseWeigh` edit, the loop CORPSEBUMP2 also edits,
  so it belongs after that harvest (or as a drive/preview equip channel in `botDriverV2`, which is out of every hammer
  slice's bounds). With `STRIKE_SLOT` ON it composes: the walk would carry a blade and dash for real.
- **Leg 867's arrival slot**: a solve that arrives with a non-blade selected never dashes ON. Equipping the blade at the
  start of such a segment (an equip costs no tick) would give its `full` pass the sword dashes back; unmeasured.
- **No game witness for the ON latch tape** (LWEIGH's arm, bump 2 from the stance). CORPSEBUMP2's witness pins the OFF
  press; an ON witness would be `probe-seedling-l40latch.mjs` with this switch, the planner's or fidelity's to dispatch.
- **CORPSEBUMP2's fixture** (`corpsebump2-walk-press.json`, 461 KB) is on fidelity's branch only and over the size
  limit; the rows pin the model's `useItem` on L6 instead. Once it lands, a row can assert that with the switch ON its
  tick-1182 press is not made.
- **Composition with CORPSEBUMP2** (`corpseBumpRestRead`): independent. ON here there is no walk press to re-read; ON
  there, the rest read survives a press. Not measured together (no scratch-merge).
- **Ghost Sword dash pattern**: `strikePolicyFor` passes `hasSword` (true for either blade) as before; the ghost's own
  rect/pattern is the model's existing business, unchanged here.
- **The flip's re-record**: `apb-l32-fresh-fire-held` (above). Not re-recorded here (the switch ships OFF; no
  `--write`).
- **Bootstrap residue**: the AP `pip` step's interactive prompt (as AXIS).
- **The capture** (58 requests) is not committed; `l40-leg-keys.txt` and `capture-legs.txt` name it.
