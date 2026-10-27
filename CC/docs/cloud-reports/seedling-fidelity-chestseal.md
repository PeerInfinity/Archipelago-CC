# seedling-fidelity-chestseal — a chest `checkBySeal()` removed is not a wall, and its location is checked

| | |
|---|---|
| Session | `seedling-fidelity-chestseal` (wave 32, planner `seedling-fidelity-planning-14`) |
| Start SHA | `1e17f44738` (= main 1e17f44738, as briefed; 85 default-ON keys, counted from `CONTACT_FIDELITY_DEFAULTS`) |
| Harness branch | `claude/chestseal-solidity-aqycuw` |
| Commits | D1 `b5e9b7e1` · D2 `1c8086b6` · records `487d610c` · this report (the last commit) |
| Server | `serve-nocache.py 9741`, PID 708; wasm p4g, vendor/seedling `ccdf189776` |
| Switch | `CONTACT_FIDELITY.chestSealRemoval`, **OFF**, byte-identical OFF; `SEEDLING_CHEST_SEAL_REMOVAL=0\|1` |
| Verdicts | **W0 PASS · D1 PASS (game-witnessed) · D2 PASS · Movers STOP with the list (below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-chestseal-evidence/` |
| CI at the code head `487d610c` | run `40377646101` **success**: vitest (unfiltered) **23,058 / 23,058**, slow battery **269 / 269** (`ci-vitest-summary.mjs`). The report commit is docs-only. |

## The one thing to know first

- With all 16 seal parts, the game removes a chest before the player can move. There is no frame where the chest
  is a wall. The game also clears the chest's flag, which is the AP check, and it does this in the chest's
  CONSTRUCTOR, without opening it.
- Witnessed on p4g: the player walks straight through L15 `chest@144,96`'s cell into L16, and {15,1} is cleared.
- With the switch ON, the model matches that at 0 px. The solver then counts a `collect-placement` at such a chest
  as already met, with no verb.
- Locally that moves exactly six survey steps, all after the 16th Seal: three go to SOLVED, and three now stop on a
  later, different refusal.

## W0 — the base (PASS)

**The refusals, reproduced** (`survey-seedling-route.mjs --through=end --route=full`, full OFF run, 191/235 SOLVED =
baseline `40250392329`'s 191/44). ⚠ The brief's step ids (154/173/204/209, from rules-4's survey 40229077999) are not
this base's. Matched by (level, goal):

| brief | this base | level / goal | OFF refusal |
|---|---|---|---|
| 173 | **167** | L12 visit 13, reach-exit → L83 | `chest@320,816 NEVER OPENED in 400 ticks` |
| 204 | **198** | L12 visit 15, reach-exit → L83 | same |
| 209 | **203** | L80, collect-placement `Level 080 - Chest` | `chest@16,128 NEVER OPENED` |
| 154 (L38 @144,288) | — | **no L38 chest refusal exists at this base** | every L38 step SOLVES (48, 65, 93, 134, 147) |

The 16th Seal is delivered at step 150 (`saveGrant.from`: *"step 150, Seal, save.seal_parts ×16"*). Every chest step
after it runs with `hasAllSealParts`. Three more chest-goal refusals were the same cause under a different message:
- 193 (L63) and 212 (L98): *"chest stance: the re-planned corridor failed too"*;
- 171 (L71): *"chest stance -> kill lavarunner"*.

**What the game does** (read from source, then witnessed in D1):
- `Chest.as:25-36`: the ctor calls `checkBySeal()`.
- `:47-57`: `if (hasAllSealParts()) { if (tag >= 0) Game.setPersistence(tag, false); FP.world.remove(this); }`.
- In the ctor, `remove` is a no-op: `World.remove` returns when `e._world !== this` (`net/flashpunk/World.as:118-124`),
  and the chest is not yet added (`Game.as:2377`, `add(new Chest(…))`). So the ctor's effect is the **persistence
  write**.
- `Game.update`'s first frame runs `check()` on every entity (`Game.as:870-877`, before `super.update`, and also
  under the `blackCover`). `Chest.check()` removes a chest whose flag is now off (`:38-45`).
- An untagged chest is removed by `update`'s own `checkBySeal()` instead.
- `setPersistence` writes `pendingCheck = "<seq>|<level>|<tag>|0"` (`Game.as:1902-1909`). That is the AP check report,
  so **the location is checked by the save flag, on the chest room's first build after the 16th part**. AP does not
  derive it from the seal state.

**Banks** (head with the switch OFF = the base by construction: every ON arm is behind `CONTACT_FIDELITY.chestSealRemoval`
or `chestsSealRemoved()`, which is `false` OFF. Against L39SHAFT's published base, at the older `89da08f355`: every shared row is equal except c4, which is `c9bdd11e` here and `7e1497c4` there. Main moved between the two bases, and c4 is equal OFF and ON here. No pristine worktree was measured):

| row | value |
|---|---|
| identity (`identity-block.sh .`, `evidence/identity-off.txt`) | maze `57e07d21` · acceptance `cf54cdf7` · c3 `31dc4572` · c6 `40d0a4c4` · c4 `c9bdd11e` · ENEMY `f0bec576` · guard `a6d18d49` · AREA `02b22525` · killgate `7c15ed57`/`47116405`/`4d3bbf17` · levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | battery `da331da7` **exit 1** · d2-chain `8be1a293` **exit 1** · l18 `b8d8452a` **exit 1** · tail `35456fbc` exit 0 · r9-l3 `6cd35fe1` exit 0 · r9-campaign `e69370f6` **exit 1** — ⚠ **the base's, not this slice's**: see "What the brief got wrong" |
| generated set | not measurable on this box (venv playwright 1.56, pin 1.63) |
| reference | ALL 7 MODULES + 5 REGIONS MATCH (and again after regenerating for the new probe) |
| surface / constants / entities / profile | surface RED before `--write` (the new `run:chestsSealRemoved` read, unlisted) → GREEN **354** after the row was classified · constants PASS **6,955** · entities PASS 566 · profile PASS 138 |
| roster | 289 tapes (no tape added: the witnesses are fixtures, not roster tapes) |
| tapeRunner pairs | **635**, md5 `e164838673a48b38ce187093c363edb2`, 0 non-pass (`evidence/taperunner-pairs.txt`) |
| bounded vitest (defaults) | **128 files, 3,819 / 3,819** (`evidence/vitest-files.txt`, `vitest-off-summary.txt`): the brief's list (`apReportBosses` has no test of its own, so its importers stand in), `levelRunDigestRead`, `fidelityL1516`, `sealCeremony`, `seedlingSolverSurface`, and every test naming `openChests`, `chestOpens`, `stepChests`, `createChestState`, `bankedClears`, `checkBySeal`, `senseContacts`, `hasAllSealParts`, `resolveCollectStrategy`, `seal_parts` |

## D1 — the model (PASS, game-witnessed) — `chestSealRemoval`, OFF

**Change** (`b5e9b7e1`):
- `contactFidelity.js`: the key, its docblock and env line. `contactFidelity.test.js`: the defaults pin row
  `chestSealRemoval: false`.
- `levelRun.js` `chestsSealRemoved()`: `CONTACT_FIDELITY.chestSealRemoval && sealParts[15] !== -1`. It is the game's
  own predicate on the boot save.
- `openChestIdsNow` adds every chest of the level when it holds. This is the set every solid query and the solver
  read (`liveSolidOpts.openChests`, `run.entities('openChests')`), so it is not a wall from the build on.
- `stepChestsNow` handles the `chestgone`/`why: 'checkBySeal'` event `stepChests` already emitted: a tagged chest's
  write is banked in `pendingEarnedClears`, as `open()`'s is. `run.bankedClears` shows it from the visit's first tick,
  and the next build of the room despawns the chest by persistence.
- `chest.js` is unchanged (it already emitted the event).
- Getter: `run.chestsSealRemoved` (boolean).

**Digest.** No new run map. `chestStates` (`visit`) and `pendingEarnedClears` (`persist`) were already IN
`stateDigestParts`. The new predicate is a pure function of the boot save and a switch. `stateDigest` and
`stateDigestParts` were not edited. The getter creates nothing on read (`levelRunDigestRead` green both arms).

**Game witness** — `scripts/procgen/probe-seedling-chestseal.mjs`:
- Setup: new; takes the box lock (roster row in `boxLock.test.js`); p4g headless logic-only; port 9741.
- Staging: `r9-solve-15`'s, booted L15 (48,64). Inputs: L1516's `edge` (down 0–80, right 80–190, up 190–300).
- Record: `fixtures/chestseal-witness/` (`evidence/probe-chestseal.log`).

| tape | save | game | model ON | model OFF |
|---|---|---|---|---|
| `seal-edge` | `seal_parts` = all 16 | **no chest**: walks up through the cell into **L16 (40, 64.45)** at t300; `persistence_cleared` gains **{15,1}**; no `open()` | **0 px**, every tick | stops under the Solid at L15 (157.997, 114.343); first drift **t200** (game y 113.056, model 114.343); ends a level apart |
| `control-edge` | the source's own (1 part) | chest Solid, stops under it at L15 (157.997, 114.343), {15,1} still set | 0 px | 0 px |

`pendingCheck` read from `__swfBridge.stateLog` was **empty in both runs**. The bare bot page declares no bridge
properties; the host does that, so the page had nothing to report. I record that as it is and draw no conclusion
from it. The check-report evidence is the `persistence_cleared` readout plus the source: `setPersistence` writes
`pendingCheck` on the same line that writes the flag. A declared-property witness belongs to the host-play harness
(`check-seedling-ap-placement.mjs`, JS arc), named below.

## D2 — the solver (PASS)

**Change** (`1c8086b6`, `solverBot.js`):
- `collect-placement`: when the switch is ON, the resolved strategy is `chest` and `run.chestsSealRemoved`, push
  `{goal: 'collect-placement', strategy: 'chest', arm: 'seal-removed', chest: {id, x, y, persistTag}, level, why}` and
  `continue`. 0 ticks, no verb bound.
- `senseContacts`: when the switch is ON and `run.chestsSealRemoved`, add `proximity-hazard:chest@x,y` for every chest
  of the world.
  - Why: the world build (`levelWorld`) does not read the save, so each chest's probe line stays a static avoid
    volume.
  - Measured need: with D1 alone, 167/198 moved from NEVER OPENED to *"no corridor … Obstacle:
    proximity-hazard:chest (chest@320,816)"*. With this, they reach the next obstacle.
- The frontier's `solid:chest` strategy is unreachable for such a chest: it is no longer solid. `resolveChestStrategy`
  already returns null for an open chest.

**Rows** — `fidelityChestSeal.test.js`, 7 rows:
- D1: ships OFF; seal-edge ON = game final and nothing opened; seal-edge OFF is the gap (first drift t200); the
  control agrees in both arms; the run row (ON: in `openChests` before any tick and {15,1} banked after one; OFF:
  neither; one seal ON: neither).
- D2: ON gives `seal-removed` in 0 ticks; OFF throws on the chest verb.

**Mutants** (predicted first; copy + restore; `evidence/mutants.txt`):

| mutant | predicted red | measured |
|---|---|---|
| M1 `openChestIdsNow` drops `\|\| sealGone` | seal-edge ON, the run | exactly those 2 |
| M2 solver guard never matches | D2 ON | exactly that 1 |
| M3 no bank on `checkBySeal` | the run | exactly that 1 |

## Movers — STOP with the list

**Route survey, full route, local** (OFF `evidence/survey-off.tsv`, ON `survey-on.tsv`, diff `survey-diff.txt`).
**191 → 194 SOLVED.** Exactly 6 of 235 steps move. Every other step is identical in verdict, ticks and refusal text.

| step | level / goal | OFF | ON |
|---|---|---|---|
| 193 | L63 collect-placement `Level 063 - Chest` → exit L61 | REFUSED (chest stance corridor) | **SOLVED 5 t** |
| 203 | L80 collect-placement `Level 080 - Chest` → exit L71 | REFUSED (`chest@16,128 NEVER OPENED`) | **SOLVED 5 t** |
| 212 | L98 collect-placement `Level 098 - Chest` → stairs L99 | REFUSED (chest stance corridor) | **SOLVED 724 t** |
| 167 | L12 reach-exit → L83 | REFUSED (`chest@320,816 NEVER OPENED`) | REFUSED — **KEYLOCK-SEALED** `bosslock@112,192` (flag {12,11} held; the survey's own family: a route/save fact) |
| 198 | L12 reach-exit → L83 | same | same as 167 |
| 171 | L71 collect-placement `Level 071 - Chest` → exit L75 | REFUSED (chest stance → lavarunner press kill) | REFUSED — the chest is satisfied; the reach-exit hits the **same** lavarunner refusal (= step 202's, which is unmoved) |

The wave-31 baseline is `40250392329`, 191/44. Expected after a flip: **194 SOLVED / 41 REFUSED**.

**Bounded vitest with the switch ON** (`SEEDLING_CHEST_SEAL_REMOVAL=1`, the same 128 files; `vitest-on-summary.txt`):
3,817 passed / 1 failed / 1 skipped.
- The red is the defaults pin, `contactFidelity.test.js` "the shipped defaults". A flip re-pins it to
  `chestSealRemoval: true`.
- The skip is `fidelityChestSeal` "ships OFF", which skips under the env.
- Nothing else moves, including `r8Acceptance`, the roster pins, every `fidelity*` row and
  `jsRuntimeSolverEventGoal`.

**Identity block with the switch ON** (`evidence/identity-on.txt`): every row equals OFF, including the six producer
md5s and their exit codes. The only different line is the reference row: the ON run started after the new probe
existed and before the reference was regenerated. It is green now. **tapeRunner pairs ON** = OFF (635,
`e1648386…`).

**No committed tape or producer `--check` digest moves.** Every committed tape stages fewer than 16 seal parts. The
seal-16 states exist only in survey and sweep staging.

**Sweep legs in reach** (re-derived at this base with `seedling-divergence-legs.mjs --presets=seedling_playthrough
--blocks`, 918 legs):
- 256 legs are in the 16 chest rooms (`evidence/keys-room.txt`).
- **22** of them stage ≥ 16 Seals (`evidence/keys-full16.txt`): L71 ×12 (592, 597, 602, 607, 900–907), L98 ×6
  (738–743), L80 ×3 (639, 640, 908), L63 ×1 (897). These are the only legs the switch can move.
- I could not replay them in node: there were no captured requests on this box.

### The CI dispatches the planner should run (all on branch `claude/chestseal-solidity-aqycuw`)

1. **Survey A/B.** `seedling-survey.yml` (`through=end`, `route=full`) has **no switch input** (its inputs are `through route timeout shards only base_run costs_run`).
   - Arm A: dispatch it on this branch, as is.
   - Arm B: dispatch it on a throwaway branch whose only change is `chestSealRemoval: true` in `contactFidelity.js`.
   - Or locally: `SEEDLING_CHEST_SEAL_REMOVAL=1 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --out=…`, which is what this report measured.
   - Expected: A 191, B 194, with steps 167/171/193/198/203/212 as above.
   - Quick form: `-f only=167,171,193,198,203,212`.
2. **Keyed sweep ×2.** `seedling-divergence-sweep.yml`:
   - `keys=` the 256 chest-room keys (`evidence/keys-room.txt`, `|`-separated), or at least the 22 in `keys-full16.txt`;
   - `contact_fidelity=` A: unset; B: the contents of `evidence/arm-on.txt`;
   - `capture_requests=true`; each arm twice.
   - Expected: only the 22 seal-16 legs can move. Each of the 4 `location:… Chest` legs (740, 743, 897, 908) should
     go to `done` on the game if its request stages 16 seals.
3. **Probes.** `seedling-probe.yml battery=standard`. It has no switch input either (`battery probes args`), so arm B runs on the same throwaway branch as the survey's B. I expect no move, because no committed
   tape stages 16 seals, but `probe-seedling-wasm-arrival-composites` is the one the brief warns about.

## For the JS arc (read-only for me; what it must wire)

- **Nothing breaks unwired.** `jsRuntimeCore.js:777` already reboots on a seal delivery, and the runtime already
  removes the chest at build (§5.86/§5.88).
- Once a solve request stages 16 `seal_parts`, the solver ON answers a chest `location` goal with a record
  `{goal: 'collect-placement', strategy: 'chest', arm: 'seal-removed', chest: {id, x, y, persistTag}, level, why}` and
  `perTick` empty. A caller that verified a chest goal by `chestOpens` or the SealPiece ceremony must accept this arm.
  For this arm the AP check is the build's own `setPersistence(tag, false)`, not an open.
- **Getters:** `run.chestsSealRemoved` (boolean, constant per run), and `run.bankedClears ∋ {level, tag}` from the
  visit's first tick.
- **No new `SolverRefusal.obstacle.kind`, no staging/result field**, and no `solveSegment` contract change.
- Host-side witness owed: a declared-property run (`check-seedling-ap-placement.mjs` style) showing a
  `pendingCheck "…|<level>|<tag>|0"` on the chest room's first build with 16 seals. The bare page here declares
  no properties, so it could not show it.

## For rules-4 (the survey's L80 goal half)

The goal side should read, from the run:
- `run.chestsSealRemoved === true` (the switch ON and 16 parts in the boot save), **or**
- the solver record's `arm: 'seal-removed'`. The flag is in `run.bankedClears` from the first tick.

I did not edit the survey's goal shapes or the rules. With the switch ON, step 203 already SOLVES (0 t for the
chest + 5 t for the exit). Whether rules-4 also marks it `SKIPPED`/auto-checked is its call.

## Hammer arc

Nothing handed over. The change does not touch the escape, the press kill, `planWaypoints` or the digest. The new
state the escape could read is the chest's absence, which comes from the boot save and is already covered by
`chestStates` and `pendingEarnedClears`.

## What the brief got wrong (measured)

1. **The step ids.** 154/173/204/209 are not this base's ids. Here they are 167/198/203, and there are three more
   chest-goal refusals with the same cause (171, 193, 212). **No L38 chest refusal exists at `1e17f44738`.**
2. **"`chest.js` … leaves `c.solid` TRUE" is right, but the removal is not `update`'s alone.** The ctor's
   `checkBySeal()` is where the flag is written, and its `remove` is a no-op. `Chest.check()` does the removal for a
   tagged chest.
3. **The base's producer gates are red.** At `1e17f44738` the `--check`s of `solve-seedling-r8-battery`, `-r8-d2-chain`,
   `-r8-l18` and `-r9-campaign` exit 1, with my switch OFF.
   - The battery's one FAIL is `r8-solve-11 trace` DRIFT. Its derived trace adds `"why": "certified whole (fidelity
     L40BK2)"` and a `sword-dash` rejected row.
   - All four are green with `SEEDLING_DASH_SPINNER_FORECAST=0` (`evidence/producers-dsf0.txt`). So W31's
     `dashSpinnerForecast` default flip landed without these producers' traces/plans being re-recorded.
   - This is the planner's or the hammer arc's to route. I touched nothing there.
4. The default-ON count (85) and the 8 OFF keys are right.

## Residue

- **The seal count is read at boot only** (`sealParts`, `HAS_ALL_SEAL_PARTS`). A single run that banks the 16th part
  and then builds another chest room is not modelled. Unreached by any survey step or sweep leg: both stage per step.
- **167/198** now stop at KEYLOCK-SEALED `bosslock@112,192`, a route/save fact for the rules side.
- **171/202** stop at the L71 lavarunner press kill, which is the hammer arc's region.
- The `pendingCheck` witness on a declared-property page (above).

## Byte-inertia

OFF is byte-identical by construction: every new arm is behind the switch or a predicate that is `false` OFF.
Measured:
- identity block: OFF = ON on every row (against L39SHAFT's older base, all equal except c4, see W0);
- tapeRunner pairs: OFF = ON;
- bounded vitest at the defaults: 3,819 / 3,819;
- the six producer md5s are identical OFF and ON.

## Rows to BANK

- `fidelityChestSeal.test.js` (7). Defaults pin `chestSealRemoval: false`.
- The surface row `run:chestsSealRemoved` (physics / constant).
- `boxLock` roster: `probe-seedling-chestseal.mjs`.
- Witness fixtures `fixtures/chestseal-witness/` (2).
- A flip owes:
  - the defaults pin → `true`;
  - the "ships OFF" row → "ships ON";
  - the survey baseline 191 → 194;
  - the sweep A/B on the 22 seal-16 legs.
