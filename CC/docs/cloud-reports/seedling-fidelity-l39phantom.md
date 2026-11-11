# Seedling fidelity L39PHANTOM — a spinner a Pulser killed stops being priced at its placement (wave 38)

Planner `seedling-fidelity-planning-19`, wave 38. ⚖ GO 2026-11-09 (*"L39 + Fire arm now (Recommended)"*; *"Both, fidelity
first"* on the WALLS-CENSUS-2 hand-over). Sibling slice FIRESPINNER ran in parallel in `levelRun.js`; this slice touched
none of it.

## 1. Start, head, branch

| | |
|---|---|
| start SHA | `2d1283375e` (= `origin/main`, "train: cloud-wait-watcher b2dae2a4bf"); 116 default-ON keys of 127 |
| harness branch | `claude/seedling-fidelity-wave-38-fazhgj` (the brief's `seedling-fidelity-l39phantom`) |
| commits | D0 `d8ccff7e` (witness) · D1 `536761e7` (key OFF + rows + surface/reference) · D0 fix `2671b3e1` (box-lock declaration) · this report (docs) |
| port | 9779 (`serve-nocache.py`, killed by PID at the end) |
| node | v22.23.4; `session_bootstrap.sh --seedling` → READY |

## 2. The answer first

**The one thing to know first:** the phantom is real, and the Pulser kill that makes it is now game-witnessed. In the
committed step-66 tape on p4g, `pulser@64,96` kills `spinner@112,88` at **t1267** on both sides, with the hits, the timer
and the fade equal at 0 px. **`spinnerRosterGone` ON turns the census leg's 640 rung from 20/45 into 44/45 phases** (2,560:
39/45 → 44/45). Every landed plan in both arms bills **0 hits**. The leg goes from FAILED to DONE on the page, on its first
request. The key ships **OFF**. Flipping it needs a licence and one re-record: the L39SHAFT solver witness
`l39shaft-solver-step66` is the OFF plan (3,496 t), and ON plans 2,740 t.

| D | verdict |
|---|---|
| W0 | **PASS**: the phantom reproduced at the base on the page and in node, at the census's own numbers |
| D0 | **PASS** (one named fencepost): the game kills `spinner@112,88` by Pulse on the model's tick, 0 px; the model's roster lists the corpse **one read** past the game's removal |
| D1 | **PASS**: `spinnerRosterGone` (OFF, byte-identical; 9 rows; 3 mutants red) |
| D2 | **MEASURED, STOP for licence**: 1 bounded red ON (`fidelityL39Shaft` D2, a re-record); survey verdicts unchanged, 4 L39 rows shorter, 0 hits |

## 3. W0

- **Page (p4g, inv, `--page-legs=1 --leg-budget-ms=240000 --capture-requests`, legs file
  `seedling-fidelity-l39phantom-evidence/legs-l39shaft.jsonl` = WALLS-CENSUS-2's `input/legs-l39shaft.jsonl`)**, at
  the base: seam 5226, **end `failed`**. Request 0 (640) ran out of budget (dashless 641 units, deadline
  `crusher-fork`). Request 1 (2,560) **refused** with *"the combat ladder is EXHAUSTED. The corridor passes through danger at
  (123.9,100.2) — enemy:spinner@112,88 (a static "Enemy" body at its placement (this room is stepped, so this class is
  unbridged and does not move), priced "stepped" by `contactPricing`)"* (`m/page-off.json`).
- **Node seam census** (`replay-seedling-solve-request.mjs --seam-time-sweep=-22..22`, i.e. seam 5204–5248, one hammer
  cycle; `m/census-off-i*.jsonl`): **640 lands 20/45** (the dashless pass plans at those 20; 21 budget refusals and 4
  others). **2,560 lands 39/45**, with phantom refusals at 5226 and 5233. These are WALLS-CENSUS-2's numbers exactly,
  shifted one period (its 5181/5188/5185 = my 5226/5233/5230).
- **AS3** (`vendor/seedling/src`):
  - `Pulser.hit` (`Puzzlements/Pulser.as:87-116`) collects "Player", "Solid" and "Enemy" in a 44×44 square. For each
    within `radiusHit` 22, an `Enemy` gets `hit(force 6, pulser point, damage 1, "Pulse")` (`:108-111`).
  - `Enemy.hit` (`Enemies/Enemy.as:141-181`) is gated by `hitsTimer <= 0` (30 after a hit), `!Game.freezeObjects` and
    `canHit`. "Pulse" is not "Fire", so it does `hits += 1`. At `hitsMax` 3 it calls `startDeath` → `destroy = true`.
  - `Mobile.death` (`Mobile.as:60-71`): `alpha -= 0.1` a tick, `FP.world.remove` at `alpha <= 0`.
  - ⚠ `Spinner.update` (`Enemies/Spinner.as:66-76`) swings the hammer after `super.update()` **with no `destroy` test**.
    A fading spinner is still harmful until its removal.
  - So **a Pulse kills a spinner in three pulses, and it fades for 11 updates**.
- Identity block (`identity-block.sh`, base worktree vs head; `m/identity-block-{base,head}.txt`): **every md5 row
  identical**. Acceptance batch `abb206c88de25e7ba1874510d493ce85` = main's; maze `57e07d21…`; the six producer `--check`s
  exit 0 (r8-battery `7486f32e…`, r8-d2-chain `93f75467…`, r8-l18 `88e33db7…`, r8-tail `35456fbc…`, r9-l3 `6cd35fe1…`,
  r9-campaign `be9c19c8…`). The two lines that differ are environmental, at the base worktree: no venv for the "generated
  set" row, and its reference check reading symlinked submodules. At the head both are OK / "ALL 7 GENERATED MODULES AND 5
  MARKDOWN REGIONS MATCH".

## 4. D0 — the game witness (before any model change)

`scripts/procgen/probe-seedling-l39-pulser-kill.mjs` (new; takes the box lock inside `main`, declared in `boxLock.test.js`;
module `fidelityL39Phantom.js`) plays the committed `l39shaft-solver-step66` witness's tape on a fresh p4g page. It runs
headless on the logic-only channel, with the delivered set mounted via `botLoadLevels`. On every tick of t1180–1300 it
reads `botMobiles`' `Spinner` rows (`x, y, hits, hits_timer, destroy, alpha`). The model replays the same tape on the same
set (defaults). Recorded: `fixtures/l39shaft-witness/l39phantom-pulser-kill.json` (121 ticks, 19.9 KB).

```
PASS: the model's pulserEnemyKills names pulser@64,96 → spinner@112,88 — {"t":1267,"level":39,"pulser":"pulser@64,96","enemy":"spinner@112,88"}
PASS: the game was sampled on every tick of the window (121) — 121
PASS: the game reproduces the model at 0 px (every spinner's x, y, hits, hitsTimer, destroy, alpha) on all 121 sampled tick(s) but the named removal fencepost
PASS: the kill: destroy goes up on the same tick on both sides — game {"destroyAt":1267,"lastListed":1277,"goneAt":1278} model {"destroyAt":1267,"lastListed":1278,"goneAt":1279}
PASS: the removal fencepost (`isRemovePendingFencepost`) is exactly one observation, the game's first gone tick — fencepost ticks [1278]
ALL CHECKS PASSED
```

- **The kill agrees.** At t1267 both sides have the spinner at (97.93258031058878, 105.59330995749349) with `hits 3`,
  `hitsTimer 30`, `destroy` up. The fade's alpha matches bit for bit (0.9, 0.8, 0.7000000000000001 … 1.3877787807814457e-16
  at t1277). The other two spinners also match at 0 px through the window. The model replay of the whole tape
  (`evidence/tools/l39-deaths.mjs`) also names who killed the other two: `spinner@224,112` by Sword press (t1677) and
  `spinner@224,208` by Sword press (t3290). The game's spinner count drops on the same three ticks (1267, 1678, 3291).
- **⚠ The one disagreement, NAMED and not fixed.** The game's world drops the corpse at the end of the alpha-zero update.
  Its t1278 read has 2 spinner rows; the model's has 3 (the corpse, alpha −0.0999…). `stepSpinner` sets `removePending` on
  that step and `removed` at the top of the next. F5 already stamps the *removal ledger* at the alpha-zero step
  (`assertSpinnerRemovalIsDeclared`); the roster read was not moved. Nothing is stepped for the corpse on the next tick, so
  it is a **read** fencepost, not a contact. It is not the danger map's static arm: the corpse is IN the roster, so the key
  skips it either way. It could reach the live arm at horizon 0 for one observation (`spinnerDanger` reads the roster).
  That is `spinner.js`, outside this wave's region, so it is pinned by `isRemovePendingFencepost` (a fix reds the row) and
  listed in residue.
- **"Does the body stop hitting?"** By the AS3, no: it is harmful through its fade, and the model's live arm prices it there
  (D1 row "in the death fade"). This tape never brings the player into its reach during the fade, so the game witness shows
  position, hits and removal, **not** a contact.

## 5. D1 — `spinnerRosterGone` (OFF, byte-identical)

**Change** (`dangerMap.js`, `spinnersTheRunSteps(run, world)`): with the key ON and the roster read an array, every id in
`world.spinners` joins the skip set. `world.spinners` is the roster the visit was built with: `createSpinnerState`'s source,
`check()` applied by `buildLevelWorld`. Live spinners are already in it, so this adds exactly the ones the run lost. Both
call sites pass their own `world` (`staticEnemyDanger` ≈ l.1486, `dangerVolumes` ≈ l.1825; both price `run.level`). Key
`spinnerRosterGone: false`, appended **last** in `CONTACT_FIDELITY_DEFAULTS` with its doc block. Env lines
`SEEDLING_SPINNER_ROSTER_GONE=0|1`, added to `SOLVER_ENV_NAMES`.

**Boundary cases (predicted first, each a row in `fidelityL39Phantom.test.js`, 9 rows):**

| case | prediction | row |
|---|---|---|
| after the removal (t1290), no press row | OFF prices it at its placement in **both** call sites (why: *"a static "Enemy" body at its placement"*); ON in neither; ON `dangerVolumes` = OFF minus exactly that id | ✅ |
| before the kill (t1200) | every spinner is in the roster ⇒ ON = OFF byte for byte | ✅ |
| not yet spawned / woken | **no such state**: the roster is built whole at the visit's first read (`activeOffScreen = true`, `Spinner.as:44`; `createSpinnerState` builds every `world.spinners`), so "absent" never means "not yet". Covered by the t1200 row | ✅ |
| in the death fade (t1270) | still in the roster ⇒ static arm skips it in both arms (as OFF); live arm `spinnerDanger` prices it in both | ✅ |
| a run with no roster read (`spinnerBodies` not an array) | ON prices exactly as OFF (both call sites) | ✅ |
| a world with no `spinners` list | ON prices exactly as OFF | ✅ |
| a room the run does not step spinners in | only L18, L39, L40 and L92 have spinners (atlas census); every other room has an empty `world.spinners`, so it is identical **by construction** | (argument + the two rows above) |
| a spinner whose tag a clear removed | in neither `world.spinners` nor the census (`clearedAwayByTag`: spinner is `despawn`) ⇒ unchanged | (argument) |

**Mutants** (copy + restore; `cmp` confirmed the restore):
- M1, drop the `Array.isArray(roster)` guard: predicted the "no roster read" row reds. **Red: 1, that row.**
- M2, `dangerVolumes` calls `spinnersTheRunSteps(run)`: predicted "after the removal" reds on its `dangerVolumes` half.
  **Red: 1, that row.**
- M3, drop the `CONTACT_FIDELITY.spinnerRosterGone &&` gate: predicted "after the removal" reds on its OFF half. **Red: 3**:
  that row plus "no roster read" and "no spinner list", which share `phantomRect` (it reads the OFF arm, which then returns
  no rect). That is one more consequence of the same mutant, not a second defect; the prediction undercounted by 2.

**Pins moved by an appended key (re-pinned, the usual newest-key rows):**
- `contactFidelity.test.js`: the defaults literal gains `spinnerRosterGone: false`, and the env skip-list gains the new env
  name.
- `fidelityRockGone.test.js`: its `.at(-1)` row now says `rockGoneFencepost` is followed only by `spinnerRosterGone`.
- `fidelityFrozenPress.test.js` and `fidelityCeremony126.test.js`: the trailing-key allowance gains it.
- `boxLock.test.js`: the new probe is declared a conditional taker, next to `probe-seedling-l39-shaft.mjs`.

**Records:** surface census `--write` (one row moved: the `CONTACT_FIDELITY` import's `dangerMap.js` sites 7 → 8, 189 → 190;
371 rows). `generate-procgen-reference.mjs` regenerated `instruments.js` (browser rows 144 → 145, the D0 probe),
`docsIndex.js`, and the README/architecture count regions. `seedling-bot.md` gained a paragraph after L25APITEM's, and
`seedling-bot-log.md` an entry. No new run state ⇒ no `stateDigestParts` or `DIGEST_EXEMPT` question: the key reads two
existing things (`run.entities('spinnerBodies')`, `world.spinners`), and the read creates nothing (DIGESTREAD's law holds:
`levelRunDigestRead` is in the bounded set, green).

## 6. D2 — the key ON, measured

### The census leg, 45 phases × 2 budgets (`m/census-*.jsonl`, `m/hits.jsonl`)

| arm | 640 lands | 2,560 lands | dashless plans | refusals | billed hits per landed plan |
|---|---|---|---|---|---|
| OFF (base defaults) | **20/45** | **39/45** | 20/45 | 640: 21 budget + 4 (5221–5223, 5230); 2,560: phantom ×2 (5226, 5233) + 4 (5222, 5230–5232) | 0 on all 20 / 39 |
| ON (`SEEDLING_SPINNER_ROSTER_GONE=1`) | **44/45** | **44/45** | 44/45, at 529–586 units | 5230 only: the live `spinner@224,112` (640: *"kill (spinner@224,112) by press: every key set … lands the player box on a body's 7x7 rect or on the 13 px hammer line"*; 2,560: its body at the `pushableblockfire@48,176` park, route step 3/7) | 0 on all 44 / 44 |

- No phase that lands OFF fails ON, and no hitless plan turns hit-taking (`m/hits.jsonl`: 180 fresh-process solves, each
  printing `billedHitsOf(plan)`).
- The phase left is WALLS-CENSUS-2's 5185 = cause (B), hammer's: a park walk meeting a billiard mid-walk. Out of scope.

### The page leg (the honest L39 A/B; `m/page-{off,on}.json`)

`--contact-fidelity=<the base's 116 default-ON keys>,spinnerRosterGone` (`evidence/contact-fidelity-on.txt`, built fresh
from `CONTACT_FIDELITY_DEFAULTS` at the base):

| arm | end | requests | room hits |
|---|---|---|---|
| OFF (W0, seam 5226) | **failed** | 640 budget → 2,560 refused on the phantom | 0 (268 samples) |
| ON (seam 5219) | **done** | 640: the dashless plan played (*"a later pass ran out of 640 work units … playing the dashless pass's plan"*) | **0** (7,705 samples) |

⚠ **Residue on the ON page run:** *"the game left the plan at tick 2212: expected (101.397,149.839), game
(104.014,152.525)"*. The game sat one tick longer at (104.01,152.53) and then followed the same path. The leg re-solved and
landed. The key changes no run model (it is a danger-map read), so this one-tick slip is a pre-existing model/game timing gap.
The OFF arm never reached it because OFF never played a plan this far. It is not attributed here (see §10).

### The bounded set (`grep -a` hits included: 116 files)

| run | files | tests | red |
|---|---|---|---|
| head, key OFF | 116/116 | 2,749/2,749 | none, after the `boxLock` declaration (the one red before it was the new probe, mine, fixed in `2671b3e1`) |
| head, key ON (`SEEDLING_SPINNER_ROSTER_GONE=1`) | 115/116 | 2,746 + 2 skipped (the env-skipped default rows) | **`fidelityL39Shaft.test.js` › L39SHAFT D2 › "the solver, keys ON, plans exactly the recorded tape from the same boot"**: `expected 2740 to be 3496` |
| train tier ON (`hammerSpinnerPress.train`, `hammerGhostKillRung.train`: the `.train.` files on my names), `-c vitest.train.config.js` | 2/2 | 9/9 | none |
| slow `fidelityL32ArenaPrefix.slow` ON, `-c vitest.slow.config.js` | 1/1 | 5/5 | none |

The set is the brief's header list, plus `fidelityL39Phantom`, `fidelityFrozenPress`, `fidelityCeremony126`,
`fidelityRockGone`, `solverEnvChannel` and `levelRunDigestRead`, plus every `.test.js` that `grep -a` finds for
`spinnersTheRunSteps|spinnerBodies|spinnerPressHits|stepPulsersNow|dangerMap` (53). `apReportBosses` has no test file
(module only).

The ON red is a re-record, not a defect: `l39shaft-solver-step66`'s tape IS the OFF solver plan (= survey step 65 OFF, 3,496
t). ON, the same request plans 2,740 t, hitless, because the corpse no longer blocks the final walk to the totem. ⇒ **the flip
owes a re-record of `l39shaft-solver-step66` on p4g** (`probe-seedling-l39-shaft.mjs --tape=<the ON step-65 walk view>
--name=l39shaft-solver-step66 --on=l39ShaftPress,spinnerRosterGone --set=delivered --record`). After it, D0's witness tape
(which replays that fixture's tape) and its window must be re-chosen.

### Movers: the radius

- **Rooms:** only **L18** (2 spinners), **L39** (3, a Pulser), **L40** (5, a Pulser, a bomb pusher) and **L92** (1) have
  spinners (atlas census of `seedling-map.json`). Every other room is byte-identical by construction.
- **Spinner killers by room:**
  - Pulser: L39, L40.
  - Bomb: L40 (bomb pusher).
  - Dark hit / ghost swing / water / lava / pit: any of the four rooms, if the inventory or terrain allows.
- **Local survey ON vs OFF** (`--through=end --route=full --only=` the 11 spinner-room steps; `m/survey-{off,on}.txt`):

| step | level | OFF | ON |
|---|---|---|---|
| 27 | L18 | SOLVED 467 t, 0 hits | = |
| **65** | L39 (Totem 72,40) | SOLVED **3,496** t, 26 dec, 0 hits | SOLVED **2,740** t, 25 dec, 0 hits |
| 66 | L40 | REFUSED (BK2 stance, ladder) | = (refusal text identical) |
| 86 | L92 | SOLVED 395 t | = |
| **95** | L39 | SOLVED **3,376** t, 0 hits | SOLVED **2,624** t, 0 hits |
| 96 | L40 | REFUSED (Totem 64,144 stance) | = (identical) |
| 98 | L40 | SOLVED 70 t | = |
| **136** | L39 | SOLVED **3,376** t | SOLVED **2,624** t, 0 hits |
| 137 | L40 | SOLVED 172 t | = |
| **149** | L39 | SOLVED **3,253** t | SOLVED **2,626** t, 0 hits |
| 150 | L40 | SOLVED 172 t | = |

  Verdicts: 9 SOLVED / 2 REFUSED in both arms. No row turned hit-taking.
- **Sweep legs at my base** (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 927 legs): 55 are in
  spinner rooms (L40 48, L39 3, L18 2, L92 2). Their keys are in `evidence/spinner-room-keys.txt`, `|`-joined. As
  WALLS-CENSUS-2 found, **none crosses the L39 shaft from L38**, so the page run above is the only honest L39 A/B.

## 7. The CI dispatches the planner should run

1. **Survey A/B** on this branch (`claude/seedling-fidelity-wave-38-fazhgj` @ its head):
   - control: `seedling-survey.yml -f through=end -f route=full`;
   - ON: the same with the key ON (the workflow's contact input, or a one-line default flip on a scratch branch).
   - Expected: only L39 rows shorten (65/95/136/149 at this base's numbering), no verdict moves.
2. **Divergence sweep** (≤ 10 shards):
   - `seedling-divergence-sweep.yml -f keys="$(cat CC/docs/cloud-reports/seedling-fidelity-l39phantom-evidence/spinner-room-keys.txt)" -f contact_fidelity="$(cat CC/docs/cloud-reports/seedling-fidelity-l39phantom-evidence/contact-fidelity-on.txt)" -f capture_requests=true`;
   - control: the same `keys` with `contact_fidelity` = the file minus `,spinnerRosterGone`.
   - ⚠ Rebuild the ON list from the defaults at whatever base the planner runs it on: the file is THIS base's 116 + the key.
3. **`seedling-probe.yml -f battery=standard`** on this branch. The key is OFF, so it should equal main. The battery's L40
   rows also run with the key ON only if the workflow takes a contact input.
4. **The L39 page A/B** (not in any committed leg list):
   - `probe-seedling-divergence-sweep.mjs --legs=CC/docs/cloud-reports/seedling-fidelity-l39phantom-evidence/legs-l39shaft.jsonl --mode=inv --page-legs=1 --leg-budget-ms=240000 --capture-requests=<f>`, OFF vs `--contact-fidelity=<ON list>`;
   - ×2 at least: the row is ONE seam sample, so read the census above for the rate.

## 8. JS arc, hammer, and pins

- **JS arc:** nothing to wire. There is no new staging/result field and no new refusal kind. The worker env channel carries
  `SEEDLING_SPINNER_ROSTER_GONE` (in `SOLVER_ENV_NAMES`). `jsRuntimeTape` / `NO_TAPE_CHAIN` were not run (an OFF key does
  not move them, per the brief).
- **Hammer:** no hammer file touched. L39 (B), the departure wait after a mid-walk billiard refusal, is the one phase left
  ON (5230). L39 (C), the Fire-on-Spinner arm, is FIRESPINNER's. With the key ON, the 640 rung no longer climbs the
  forced-hit / `crusher-fork` path at 21 phases (they now plan dashless). The L4 dash-upgrade margin is untouched: L4 has
  no spinners, so it is byte-identical by construction.
- **Pins that move at a flip:** `fidelityL39Shaft.test.js` D2 (re-record above). Nothing hammer-owned reds ON in the set I ran.

## 9. What the brief got wrong (measured)

- **"The Pulser→spinner kill is NOT game-witnessed."** Half true. The committed p4g witness `l39shaft-solver-step66`
  (fidelity L39SHAFT) already contained it: its spinner count drops at t1267 on the model's Pulse-kill tick, and its 0 px
  fold proves the positions up to that tick. What nobody had recorded was the hits, timer, fade and removal; D0 adds those.
- **"a spinner not yet spawned or woken in the roster":** no such state exists for a `Spinner` (`activeOffScreen`; the
  roster is built whole).
- **"a spinner in its death fade (still in the roster, and is it harmful there?)":** yes, harmful (the hammer has no
  `destroy` test), and still in the roster. The real edge is one read later: the model lists the corpse **one observation
  past** the game's removal (D0's fencepost).
- **"the 640-unit request lands at 20/45 and the 2,560 retry at 39/45; removed, both 44/45":** confirmed exactly (one period
  later in seam time).

## 10. Residue

1. **The `removePending` read fencepost** (`spinner.js` / the `spinnerBodies` read): the model's roster lists a faded-out
   corpse one read past the game. It is pinned by name. A fix would move the live arm's horizon-0 read for one tick per
   spinner death, so it needs its own slice with its own movers (and the F5 ledger stamp already accounts for it).
2. **The ON page run's one-tick slip at t2212** (L39, near (104,152), before the shaft): unattributed. The captured requests
   to reproduce it are not committed (1 MB); the command in §7.4 re-captures them.
3. **Hammer L39 (B)** for the 1/45 phase left; **FIRESPINNER (C)**.

## 11. Byte-inertia, rows to BANK

- OFF: byte-identical (the key gates the only new branch). Identity block md5 rows identical base → head; acceptance
  `abb206c88de25e7ba1874510d493ce85`; constants census `--check` PASS (7,075 literals, 0 drift); surface census `--check`
  green after the one `--write` row; `check-procgen-reference` / `check-procgen-help` ALL PASS; no committed tape moved.
- **BANK:**
  - `fixtures/l39shaft-witness/l39phantom-pulser-kill.json` and `probe-seedling-l39-pulser-kill.mjs` (the D0 witness);
  - `fidelityL39Phantom.test.js` (9 rows);
  - the census numbers above (OFF 20/45 · 39/45 → ON 44/45 · 44/45, 0 hits);
  - trap candidates: (1) the press ledger is one killer's receipt, and the roster is the run's verdict; (2) a spinner's
    roster read lists its corpse one read past the game's world.
- CI at `2671b3e1` (the last code head), run `42727795231`: **vitest suite 26,122/26,122 passed, slow battery 431/431**. The run concluded `failure` on ONE job: `Browser gate shard — seedling-editor-world +14` → `## CI-GATE | gate: seedling-editor-boot | 33/0 | exit=1` (*"page.waitForFunction: Timeout 60000ms exceeded"* at `check-seedling-editor-boot.mjs:422`, the "WHERE THE PLAYER STARTS" section, after 33 PASS). This slice touches no editor code; **locally at `2671b3e1` the same gate prints ALL CHECKS PASSED** (port 9779). Read as a CI load timeout; the planner should re-run that shard (or `seedling-gates`) at the harvest rather than add an expected-red row.
