# Seedling fidelity L32ROCK (wave 35) — the model never reported L32's {32,1} clear

Session `seedling-fidelity-l32rock`, planner `seedling-fidelity-planning-16`.

- **Start SHA:** `9dadbdfc4b` (main; 102 ON of 113).
- **Harness branch:** `claude/seedling-fidelity-wave-35-f58fnm` (the harness's own branch, not `seedling-fidelity-l32rock`).
- **Head:** the commit that carries this report.
- **Evidence:** `seedling-fidelity-l32rock-evidence/`. Scripts are in `tools/`.

## Summary

| D | verdict | one line |
|---|---|---|
| W0 | done | {32,1} is `fallrocklarge@64,128`. `FallRockLarge.fall()` writes it on the arm frame. The model **stepped** the arm but **never banked** the write. The fix belongs in `levelRun`; `liveClears` is correct. |
| D1 | **PASS** | `CONTACT_FIDELITY.bobArenaRockClear` (OFF, byte-identical). ON, the arm banks {32,1} the way L82's arena rock does. Game = model on p4g on three boots: t9, t2 and t13. |
| D2 | **PASS** | ON moves no plan, no position, no survey row and no sweep end. What moves is the reported clear set: +{32,1}. That set feeds `earnedClears`, `liveClears`, the JS runtime's check stream and the next staging's carried persistence. |
| D3 | **PASS (3 owed re-pins)** | Whole bounded set ON: 3 reds, all pins of the old unbanked set (listed below). Producers 97/0 red, six `--check`s equal, slow pair green. |

The one thing to know first: the gap was the **record**, not the event. The run already stepped the arm, the freeze, the 174
dead frames and the landing (`bobBossEvents` `rock-armed`). It only skipped the clear ledgers, which L82's rock already
writes. With the key ON, `{32,1}` joins every clear set (`liveClears`, `earnedClears`, the JS check stream, the carried
persistence), and the game holds it too.

## W0

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0; server `serve-nocache.py 9767` |
| the gap, reproduced | `SEEDLING_PORT=9767 node scripts/procgen/probe-seedling-encounter-ticks.mjs --tape=apb-l32-fresh-no-fire` | `{32:1} game t9 (prev sample t8) / model never; {32:3} game t778 / model t778; {32:4} game t839 / model t839` (= CI 40579343337) — `evidence/probe-off-apb-l32-fresh-no-fire.log` |
| identity block BEFORE | `SEEDLING_PORT=9767 bash scripts/procgen/identity-block.sh .` at `9dadbdfc4b` | file md5 **`590b0b88`** (= the published L100/L12DOORS value). Producers: battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · campaign `be9c19c8`, all exit 0. Reference "4 DIFFER" (`bulletml-dodge` not initialised) — `evidence/identity-base.txt` |
| survey full OFF | `survey-seedling-route.mjs --through=end --route=full --timeout=1500` | **203 SOLVED / 37 REFUSED**; **0 of 240 rows differ** from CI `40811598699` (verdict, ticks, refusal, goals) |
| roster | `fixtures/tapes/index.json` | 293, unchanged |

**What clears {32,1}.** L32's record holds `fallrocklarge@64,128 {tag:1, bossrock:1, thirdboss:1}`. In `vendor/seedling/src/Scenery/FallRockLarge.as`:
- `update()` (`:71-80`): a `bossRock` whose nearest Player is not `fallFromCeiling` and stands at `p.y < fallTo - sprRock.height/2 - 8` sets `activate = true`. Here `fallTo` = 128 + 16 = 144, so the line is y < 120.
- `set activate` (`:145-152`) calls `fall()` once (`_active` latches).
- `fall()` (`:137-143`) runs `Game.setPersistence(tag, false)` first, on that frame.

The ctor (`:50-56`) builds a rock whose tag is already cleared as fallen, with `_active = true`, so it never re-arms. So {32,1} clears on **every** L32 build where it is still held, on the first frame the player rises above y 120 without falling from the ceiling, **whatever the boot**: the fresh encounter at t9, a live arrival at t2, the R5 arm tape at t13. It is not the boss, not the dialogue, and not boot-specific.

**Does the model step it?** Yes. `levelRun.stepBobBossArenaNow` arms on `bobBossRockArms(state.y, {fallFromCeiling})`. It writes `bobRocksFallen`, logs `rock-armed` with `flag: {32,1,false}`, spends `BOB_BOSS_ROCK_DEAD_FRAMES` (174) and lands the rock (`apb-l32-fresh-no-fire`: `rock-armed` at ticksCompleted 8, `rock-landed` at 9). What it did not do is write a clear ledger. `liveClears` (`jsRuntimeCore.js:233`, js's) reads five feeds: `earnedClears`, `bankedClears`, `appliedTimedClears`, out-of-band `spinnerWrites` and `scratchClears`. A `bobBossEvents` row is in none of them. L82's arena rock (`stepLavaArenaRockNow`) writes `rockFlags` + `pendingEarnedClears` on its arm; L32's did not. **The fix belongs in `levelRun` (this slice's); `liveClears` reads the ledgers correctly — no hand-over.**

## D1 — `bobArenaRockClear` (OFF, byte-identical)

**Change** (`levelRun.js`, the arm branch of `stepBobBossArenaNow`, a 10-line local hunk). ON, with `a.persistTag >= 0`:
`rockFlags.set(ledgerKey(flag), {...flag, id: a.rockId, level, by: 'fallrocklarge', t: ticksCompleted + 1})` and
`pendingEarnedClears[flag.level].add(flag.tag)`, where `flag = outOfBandFlagFor(level, a.persistTag)`. This is L82's banking
line for line. It is keyed on the arena rock row (`world.fallRocks` `thirdBoss`), not on level 32: the mechanism is
`FallRockLarge.fall()`, and both of the game's two `bossrock` rocks now bank. Key + env `SEEDLING_BOB_ARENA_ROCK_CLEAR=0|1`
appended at the END of the defaults (`contactFidelity.js`); `contactFidelity.test.js`'s defaults row +1 (OFF).

**Digest rule:** no new per-visit map. Both ledgers already exist and already sit in `stateDigestParts`' `persist`. ON, a
run's digest gains the clear after the arm, which is correct: an escape asked after the arm now sees the clear the game holds.

**Re-entry.** `applyEarnedClears(32)` on the next build hands `buildLevelWorld` the cleared tag. That build already admits the
arena rock (`arenaRockOf` → `fallenAtBuild`, ENCOUNTERS D2), and `bobArenaNow` reads
`bobRocksFallen.has(level) || rock.fallenAtBuild`, so the arena is the same one as before. Measured: positions are
byte-equal on all 293 roster tapes ON vs OFF (`evidence/l32tapes-{off,on}.txt`, `tools/l32tapes.mjs`). The 9 tapes whose
rock arms gain `{32,1}` in their clears, each at the arm tick + 1: `apb-l32-fresh-fire-held` 9, `apb-l32-fresh-no-fire` 9,
`enc-l32-live-arrival` 2, `r1-dark-shield-bobboss` 9, `r5-bobboss-arm` 13, `r5-bobboss-fire-control` 13, `r5-bobboss-fire` 13,
`r9-solve-32` 9, `swim-u5-bobboss-encounter` 9. `apb-l32-both-reported` (rock fallen at build) arms nothing and banks nothing,
as in the game.

**Witness (game, p4g, default build, headless, port 9767).** The model side used the key ON via env; the game is unchanged:

| tape (boot) | command | game first {32,1} (prev sample) | model ON |
|---|---|---|---|
| `apb-l32-fresh-no-fire` (fresh encounter) | `SEEDLING_BOB_ARENA_ROCK_CLEAR=1 SEEDLING_PORT=9767 node scripts/procgen/probe-seedling-encounter-ticks.mjs --tape=apb-l32-fresh-no-fire` | **t9** (t8) | **t9** |
| `enc-l32-live-arrival` (a live arrival) | same, `--tape=enc-l32-live-arrival` | **t2** (t1) | **t2** |
| `r5-bobboss-arm` (R5 arm tape) | same, `--tape=r5-bobboss-arm` | **t13** (t12) | **t13** |

{32,3} and {32,4} stay equal (t778/t839; t771/t832) — `evidence/probe-on-*.txt`. ⚠ Each run printed *"shifts that fit every
player x/y: []"*. The clear ticks are read on the tape's own tick index, as js's CI run did, so the clear comparison does not
depend on that calibration line. I did not chase it further (residue).

**Test:** `fidelityL32Rock.test.js` (4 rows):
1. ON, {32,1} at the game's t9 with `earnedClears` `by: fallrocklarge, t: 9`, and `rock-armed` one tick earlier.
2. OFF, the residue: never reported, though the arm is stepped.
3. ON = OFF positions and R4 ticks.
4. A rock built fallen banks nothing.

**Mutants** (predicted first, copy + restore, md5 verified):
1. Stamp `t: ticksCompleted` → predicted: row 1 reds on `earnedClears.t` (8 ≠ 9) while `liveClears`' first tick stays 9. **Killed exactly so.**
2. Drop the switch guard → predicted: the OFF row reds. **Killed.**

⚠ Mutant 2 ran for ~15 s while the base identity block and the defaults bounded vitest were running in this tree. The
identity block's md5 came out equal to the published value. The defaults bounded vitest was re-run clean afterwards
(AFTER below), so no number in this report comes from the contaminated window.

## D2 — what reads clears, with the key ON (measured)

| reader | moves? | measurement |
|---|---|---|
| solver L32 `encounter` goal (`execBobBossEncounter`) | **no** | It reads `bobBossEvents` (`rock-armed`, `boss-killed`, `fire-removed`) and the R4 slots, not tag 1. Survey steps 39/40/41 byte-equal ON vs OFF; step 40 still fights, then REFUSES at the burn (*"the arena's exit (burnabletree@64,0) burns only with Fire … this run holds none"* — correct under ⚖ 2026-10-20) |
| `arenaPrefixFor` (solverBot.js:2858) | **no** | It reads the arena entity's `armed` and `apKilledHeld`. `fidelityL32ArenaPrefix.slow` green ON (with `fidelityL40Bk2.slow`: 2/2, 6/6) |
| `clear-tag` goals | **no** | No route goal names {32,1}. `execClearTag`'s `written` reads `earnedClears` for its own goal's flag only |
| `apReportSlotHeldNow` | **no** | It throws for any slot but {32,3} {32,4} {12,1}. Tag 1 is never asked |
| `persistenceClearsFor` (offered/refused) | **no** | Only the recon scripts read it. Admission is `buildLevelWorld`, which admits {32,1} (`fallenAtBuild`) |
| `director.jsLiveEnvelope` (earned ∪ banked ∪ …) | **yes, by design** | A chained window after an L32 arm now carries {32,1}, as the game's `persistence_cleared` does. The re-entry builds the rock fallen, the same arena `bobRocksFallen` built |
| JS runtime `reportClears` / `persistenceCleared` (jsRuntimeCore.js:845/868, js's) | **yes, by design** | The page emits one more check (`32:1`) on the arm frame, before 32:3/32:4, and carries it into later stagings. The game's own cleared table holds it too. `jsRuntimeEncounterLegWalk.test.js:172` pins the old pair (below) |
| `jsRuntimeDeclarations`, `jsRuntimeAtlas`, `fidelityApFlip` (read-only) | **no** | Green ON |
| survey (full) | **no** | ON **203 / 37**, **0 of 240 rows differ** from OFF |
| keyed sweep, L32 legs (local, p4g inv/solver, `--contact-fidelity=<102 defaults>[,bobArenaRockClear]`) | **no** | Legs 324 (L30→L32), 330/331/332 (L32 exits), 333 (Bob Boss): **done** both arms, same plan ticks (5/8/966/142/818) and verbs. 334 (Times): **unresolved** both (*"a location the vanilla arm's map did NOT bind"*). The diffs are clock/seam fields and the plan's `contactFidelity` stamp only — `evidence/sweep-l32-{off,on}.jsonl` |
| wasm logical-links B (`--only=B`, p4g; ON by a temporary default flip, restored, md5 verified) | **no** | Both arms: B passes L32 Bob Boss (leg 51, 818 t), ends *budget exhausted* at sphere 6.4 (18/48), the same checks list (md5 equal), 80 legs / 78 done / 0 divergences. The same FAIL row in both (the restart held-arrival row, a base behaviour on this box). Legs 32 and 35 (L18/L19, **before** L32) differ in ticks 467→410 and 183→185, and continuations 21→17: seam noise, since nothing the key touches runs before the arm. Every leg from L32 on is tick-equal — `evidence/logical-links-B-*` |

## D3 — flip readiness (the whole bounded set, key ON)

The bounded set has 161 files. It is the brief's list, plus every `git grep -al` hit for
`liveClears|earnedClears|bankedClears|bobBoss|BobBoss|arenaPrefixFor|bobBossRockArms|rockFlags|fallrocklarge|FallRockLarge|stepBobBossArenaNow|apReportBosses|persistence_cleared`
in `*.test.js`/`*.test.mjs`, plus `tapeRunner`, `levelRunDigestRead`, the surface/constants tests, the new
`fidelityL32Rock`, and the slow pair. There is no `apReportBosses.test.js`; `fidelityApBosses` and `fidelityApFlip`
cover that name.

| gate | command | result |
|---|---|---|
| bounded vitest ON | `SEEDLING_BOB_ARENA_ROCK_CLEAR=1 npx vitest run --maxWorkers=3 <161 files>` | **158 / 161 files, 5,104 / 5,107** — the 3 reds below |
| slow pair ON | `SEEDLING_BOB_ARENA_ROCK_CLEAR=1 npx vitest run -c vitest.slow.config.js fidelityL32ArenaPrefix.slow fidelityL40Bk2.slow` | 2 / 2, 6 / 6 |
| producers ON | `SEEDLING_BOB_ARENA_ROCK_CLEAR=1 node scripts/procgen/ci-producer-checks.mjs --jobs=3` | **97 run, 0 red**, 1 skipped, 0 known-red |
| six @ci-box `--check`s + identity ON | `SEEDLING_BOB_ARENA_ROCK_CLEAR=1 SEEDLING_PORT=9767 bash scripts/procgen/identity-block.sh .` | every row = BEFORE, all six producer md5s equal, exit 0 — `evidence/identity-on.txt` |
| roster positions ON | `tools/l32tapes.mjs` over all 293 | byte-equal; 0 errors |

**The three ON reds, attributed (all are pins of the old, unbanked set — re-pins owed at a flip, none a regression):**
1. `contactFidelity.test.js:113`, *"the shipped defaults"*: the live object vs the defaults row (`bobArenaRockClear` true vs false). At a flip, the defaults row flips.
2. `fidelityApBosses.test.js:175`: `run.earnedClears` for L32 is `[0, 1, 3, 4]`, not `[0, 3, 4]`. The row pins this very gap (*"{32,1} (the rock's arm) is a `bobBossEvents` row and not an `earnedClears` one — as OFF, unchanged"*). At a flip: `[0, 1, 3, 4]` and that comment.
3. `jsRuntimeEncounterLegWalk.test.js:172` (**JS arc's**): the host hears `['32:1', '32:3', '32:4']`, not `['32:3', '32:4']`. At a flip, the JS arc re-pins. The game's check binding reads the same three clears.

## Movers (before → after) and the dispatches to confirm them

**Survey:** none (ON 203/37 = OFF 203/37 = CI `40811598699`, 0/240 rows). **Sweep:** none on the L32 legs (local). **Probes:**
logical-links B unchanged past L32. The encounter-ticks probe moves from *"{32:1} … model never"* to *"model t9"*. That is
the target, ON only.

Dispatches for the planner (I cannot dispatch; 403):
1. **Survey A/B:** `seedling-survey.yml` on `claude/seedling-fidelity-wave-35-f58fnm`, `--through=end --route=full`, once at the head (OFF; expect 203/37, 0 rows vs `40811598699`). The ON arm needs a code flip: this workflow has no contact input. My local ON run is the measurement until then.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` on the branch, `capture_requests=true`, `keys=` the six keys in `evidence/l32-keys.txt`, i.e. legs 324, 330–334 at `9dadbdfc4b`. Run it twice with `contact_fidelity=<the 102 default-ON keys>,bobArenaRockClear` and twice with `contact_fidelity=<the 102>` (lists in `evidence/contact-{on,off}-keys.txt`). Expect the same ends in all four.
3. **Probes:** `seedling-probe.yml battery=standard` on the branch (default OFF: expect = main). `seedling-probe.yml probes=probe-seedling-encounter-ticks.mjs args=--tape=apb-l32-fresh-no-fire` (OFF: *"model never"*, the residue). The probe workflow has no contact input either, so the ON witness is the local table above until a flip.
4. **CI vitest** at the head: `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`.

## The JS arc: pins that move and what to wire

- Nothing to wire: no new field, no new `SolverRefusal.obstacle.kind`, no signature change. `liveClears` reports the new row through `earnedClears`/`bankedClears` unchanged.
- At a flip: `jsRuntimeEncounterLegWalk.test.js:172` → `['32:1', '32:3', '32:4']`. The page's `reportClears` will emit a `32:1` check on the arm frame and carry it into later stagings (`persistenceCleared`). The seedling check binding sees `32:1` from the game today; it is not a location, so the check→location map should ignore it as it ignores other non-location slots. Worth one look from the JS arc.

## Handed to the hammer arc

Nothing. No hammer-owned function was touched. The escape cache keys on `stateDigest`; ON, the digest includes the new
clear through the existing `persist` part, so no new field is uncovered.

## Byte-inertia (key OFF, the defaults)

- **Identity block AFTER:** every row = BEFORE (`evidence/identity-head.txt`), all six producer md5s equal, exit 0. The reference line moved "4 DIFFER" → "2 DIFFER". After `bulletml-dodge` was initialised (a clone, no gitlink change), the docs index regenerated for this slice's own docs, and the check reads **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE**.
- **Bounded vitest AFTER** (defaults, re-run clean): **161 / 161 files, 5,107 / 5,107**; slow pair 2 / 2 (6 / 6). The BEFORE run (at defaults, with the code gated) had 2 reds, both explained:
  - `seedlingAtlasArm`: the uninitialised `bulletml-dodge` submodule, environmental.
  - `seedlingConstantsCensus` (b): this slice's two new literals, before the census `--write`.
- **Survey OFF** = CI `40811598699`, 0 / 240 rows.
- **Committed tapes:** none moved; roster 293; no tapeRunner pair moves (positions are byte-equal ON too).
- **Surface:** `--write` gave line moves only (55/55), then GREEN 363. **Constants:** `--write` gave the 2 new structural literals plus line moves, then PASS 7,001.
- **Shared tables:** untouched. `contactFidelity.js` gained one key at the END of the defaults.

## Deltas

- Docs: a `seedling-bot.md` paragraph and a `seedling-bot-log.md` entry, with trap candidates. Reference regenerated (`docsIndex.js`, `README.md` region).
- No new box-taking instrument (`tools/*.mjs` are evidence scratch, not enrolled), so no `boxLock` row.

## What the brief got wrong (measured)

- *"whether it clears on EVERY L32 entry or only on some boots"*: it clears on every build where {32,1} is still held, once the player is above y 120 and not falling from the ceiling. The game witnesses are three different boots (t9, t2, t13). The boot only moves the tick.
- The brief places `liveClears` at `jsRuntimeCore.js` (~233). True, but the file is `frontend/modules/seedlingDemo/jsRuntimeCore.js`, not `flashPanel/`.
- The base checkout command names branch `seedling-fidelity-l32rock`. The harness branch was already at `9dadbdfc4b` and that is the branch pushed.

## Residue

- `probe-seedling-encounter-ticks` prints *"shifts that fit every player x/y: []"* on all three tapes, in both arms; it predates this slice. The clear rows read the tape tick directly.
- Survey step 40 still refuses, correctly, at the burn (the Fire is the host's item, ⚖ 2026-10-20). Sweep leg 334 is unresolved (vanilla map binding), neither this slice's.

## Rows to BANK

- `fidelityL32Rock.test.js` (4 rows); `evidence/` (probe readouts ON/OFF, identity ×3, roster ON/OFF, sweep L32 ON/OFF, logical-links B ON/OFF).
- At a flip (⚖ the user's licence; measured movers: none on survey/sweep/probes/tapes): `contactFidelity.test.js`'s defaults row → `bobArenaRockClear: true`; `fidelityApBosses.test.js:175` → `[0, 1, 3, 4]` with its comment rewritten; JS re-pins `jsRuntimeEncounterLegWalk.test.js:172`.
