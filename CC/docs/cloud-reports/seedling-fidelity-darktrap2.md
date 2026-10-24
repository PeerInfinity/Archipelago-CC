# Seedling fidelity DARKTRAP2 — the L65 "refutation" was the spear's slash gate, not the light death

Wave 11 (model coverage), planner `seedling-fidelity-planning-5`. Session `seedling-fidelity-darktrap2`.

| | |
|---|---|
| start | `20b2644232` (as briefed), fast-forwarded to **`015365d`** = `20b2644` + the user's "darkTrapLight back OFF" (`fidelity/darktrap-off`, which is not on main yet). The switch stays OFF in this head. |
| harness branch | `claude/seedling-darktrap-light-death-1pucbz` |
| commits | `35ab9f8` D1+D2 · `b1c0dda` D3 · `bab9993` D3 test fix · `d725ebb` records · `fa55b4a` survey family row · this report |
| verdicts | **D1 PASS · D2 PASS · D3 PASS** (L65 both walks, L63 witnessed at 0 px; L62/L101 unchanged and green). Nothing is flipped: three switches wait on the user's licence (below). |

**The one thing to know first.** The light death was never wrong. On the game, PUSHBLOCK's own two refuted tapes light
the pole and kill `darktrap@144,144` on exactly the model's ticks. Both walks left the game because the model let a
**sword press inside the spear's animation** slash and dash. The game gates that press. Fixing this is a general
player-press fidelity fix (`spearingWindow`), plus a smaller one (`fallBurnsPress`). Turn both on together with
`darkTrapLight`.

---

## W0 — bank at base (`015365d`, pristine worktree, port 9611)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9611 bash scripts/procgen/identity-block.sh .` | log md5 `2964699bb7528af28ec486fc5c825059`; maze `246dfbce…`, acceptance `76602ae8…`, pairs c3 `4937da80…` c6 `430573e9…` c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2 `006b0639…` s5 `7d4cb820…` s9 `49e23d85…`, pre-sword `e28c1e5d…`, post-sword `fb1a59e5…` |
| six `--check`s | in the block | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, campaign `b064c264` — all exit 0 |
| generated set | in the block it hit my own probe's box lock; re-run alone with the primary's venv | `OK` |
| reference | `generate-procgen-reference.mjs --check` | **4 differ AT BASE**: `registry.js`, `capabilities.js` and the two substrate-matrix regions. That is this container (the omsi-loops/cavernous submodules the generator reads are not initialised), not the tree. Every AFTER below holds the same 4 and no more. |
| surface / constants | the two `--check`s | **GREEN 234** · **PASS 5,488** |
| roster | `fixtures/tapes/index.json` | **266** |
| bounded vitest BEFORE | 61 files (below) | **61 files / 2,878 tests, all green**, md5 `d02d2086dcc18c80bff4afbb09b119ef`; tapeRunner **589** rows `73d9d6457056ce0d2ff757edb4d0892a` (`status\tfullName`, sorted, `\n`-joined) |

The 61 files are the brief's standing set plus every `rg -a` hit in `*.test.js` for
`slashInfo|spearing|darkTrap|DarkTrap|LightPole|lightpole|LIGHTPOLE|CONTACT_FIDELITY|withContactFidelity|SLASH_ANIM_TICKS|slashSet|previewWalk|deriveLightPole|execLightArm|combatVerbs|fallInPit|receiveInput`:
`seedlingCheckBinding activators arrowTrap bloodySeedL114 bobBoss bobSoldier botDriverV2 campaignChain combat
combatVerbs contactFidelity dangerMap decisionTrace dialogueAutoAdvance enemyDamage entityBlocks fidelityArrival
fidelityAxe fidelityCrusher fidelityDarkTrap fidelityDash fidelityKillLock fidelityLadder2 fidelityWallFlyer fireVerb
ghostMotion ghostSword iceTurret jsRuntimeDeclarations l60Kill levelRun observationTolerance placedTalk
playerPhysicsV2 presses pushables r5Shaft r8Acceptance rectInputs ropeSword seedlingCanCross shoveWeighParity solverBot
solverBotLethalPit solverDeadline solverReachPit spinner tapeEnvelope tapeIndexManifest tapeRunner wandVerb
watchGenOverlay watchManual watchOverlays watcherL114 arrivalCompositesLegs boxLock lintGateLabels oneSpelling
seedlingConstantsCensus seedlingSolverSurface`. AFTER adds `fidelityDarkTrap2` (new) and `surveyFamily`.

---

## D1 — measure on the game (PASS)

**The instrument.** A scratch probe replayed each tape on the game (p4f, headless, port 9610). Per sampled tick it read
`botStatus()` (player, `hits`, `receive_input`, `game_time`, and `persistence_cleared`) and `botMobiles()` (the
DarkTrap rows). A lit pole writes `Game.setPersistence(tag, !activate)`, so `persistence_cleared` containing `{65, 0}`
**is** `lightpole@128,168`'s `activate`. The model was replayed beside it per tick with `darkTrapLight` ON. My game
recordings of the two tapes match PUSHBLOCK's committed `*.game.json` at every tick (541 and 233).

**Step 146 (boot (128,16)).**

| tick | game | model |
|---|---|---|
| t48 | spear thrust (slot 3) | same |
| t50 | pole lit (tag 0 cleared) | pole lit, `hitsTimer` 25 |
| t51 | — | `startDying` t51 |
| t51, t53 | sword presses (slot 0) **do nothing**: `spearing` is still up | t51 slash, **t53 DASH** |
| t54 | y 137.008 | y 138.891 — **dy 1.88, the first divergence** |
| t81 | darktrap "die1" index 0 | (model on its own path) |
| t99–t117 | `receive_input` false: the player drifts into a pit; respawn at (136,24) on t118, room rebuilt, darktrap back at "" | never falls |

So the game DID kill the darktrap: "die1" from t81, exactly startDying + 30. It then lost the kill to a pit respawn
before "die1" ended (it would have been removed ≈ t123). That is PUSHBLOCK's *"still SET"*. The 2 hits PUSHBLOCK quoted
are the game's, later in L63 (`hits 2` at t541), and the model reproduces them once the presses are gated.

**Step 148 (boot (185,80)).** Thrust t131; the pole is lit at t133; sword presses at **t134 and t136** are gated in the
game. The model slashed at 134 and dashed at 136 → **dx −1.88 at t137**. On the game the darktrap plays "die1" from
t164 and is removed with tag 1 written at t206. The model gives the same ticks (startDying t134).

**Why.** `Player.as:410` — `sprSpear.add("spear", [0..7], 45, true)`, with `spearEnd()` (`spearing = false`) as its
wrap callback. 8 frames at 45 × `FP.elapsed` 0.0333 = 1.4985 per update wrap on update 6, so `spearing` holds from the
press tick T through T+5 (`input()` runs before `sprites()`). `set slashing` (`:781`) is gated by `!spearing`. The
model's gate was `swordWindow.pending?.weapon === 'spear'`: up for ONE tick (the thrust lands at T+1).

**The second gap (146 only).** With t51/t53 removed, the model reproduces the game through t230. At t227 the game is
in another pit fall (`receive_input` false). The tape's t230 sword press is lost there: `checkFallingInPit` →
`receiveInput = false` → `Player.input()` returns before `useItem`. `stepV2` already drops the MOVE keys for a fall in
flight. `levelRun`'s press path read `acting`, which did not, so the model dashed again (dy 1.71 at t231). With
51/53/230 removed, the model reproduces all 541 ticks.

**L63 (steps 145/180).** Reproduced in a scratch worktree that merged PUSHBLOCK's branch (the shove verb is not on this
base). The light arm's derivation chose stance (36,92) facing east. From there `spearRect` meets the pole's
bob-invariant core `[67,77]×[84,92]` by **0.5 px** in y. The walk settled at (37.08,92.86), and the executor's own
check refused (the rect from there starts at y 92.36, below the core). The thrust can reach the core: the fix is the
aim (D2), not reach.

- ⚠ **A hypothesis of mine, refuted on the game.** `get spearX():int` / `get spearY():int` read like truncation, which
  would have made the settled thrust hit. I built a switch for it, then measured a discriminating tape: L63, x = 35.45
  facing east, where an int origin's rect stops at the pole's edge (67, a strict overlap) and a float one reaches
  67.45. **The game lights the pole.** The model reproduces it only with the float origin. The switch was dropped
  before any commit, and the tape is kept as a witness: `darktrap2-l63-spear-origin-float`.

---

## D2 — fix (PASS; all OFF, byte-identical)

| change | where | what |
|---|---|---|
| `CONTACT_FIDELITY.spearingWindow` (OFF) | `contactFidelity.js`, `levelRun.js` (`spearEndsAt`, `spearingAt`) | The slash gate (press and release) reads `spearing` through press + `SPEAR_ANIM_TICKS`. A spear press inside a swing, a wand/fire window or its own window is gated (no thrust, the window is not restarted: `set spearing`, `Player.as:815`). |
| `combatVerbs.SPEAR_ANIM_FRAMES/RATE/TICKS` | `combatVerbs.js` | `animCompleteTicks(8, 45)` = **5**: the slash periods' own arithmetic |
| `slashInfo.spearingUntil` (optional field, present only ON) | `levelRun.slashInfoNow`; `solverBot.previewWalk`'s `gateAt`; `combatVerbs.slashPressForecast` | The preview and the forecast age the window like the wand/fire windows. Absent, the gate is the read tick's, as before. |
| `CONTACT_FIDELITY.fallBurnsPress` (OFF) | `levelRun.js` (`pressKeys`) | A press while `state.fall` is in flight at the tick's start is lost. The fall's edge tick still presses (`checkFallingInPit` runs after `super.update()`). |
| `LIGHT_ARM_CORE_MARGIN` = 2 | `solverBot.deriveLightPole` | Candidates whose thrust meets the core by ≥ 2 px on both axes sort first, then the bare overlap, then distance. Arrival drift (1.08 px here) can no longer take the aim off. The arm already READ the pole (a lit pole is waited out, never pressed off), and still does. |

**Byte-inertia, OFF:** bounded 62 files: every BEFORE row has the same status; tapeRunner 589 rows md5
`73d9d645…` unchanged. The only BEFORE→AFTER reds were the two censuses (re-written: one sentinel classified,
`spearRect` +1 site). The light-arm margin is inert OFF: the arm runs only when `darkTrapLight` builds a roster.

**JS arc (`seedling-js-planning-4`) — what it wires:** `slashInfo.spearingUntil` is a new OPTIONAL field.
`solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched. Its runtimes need nothing
for the model, but a JS runtime that mirrors `set slashing`/`set spearing` owes the same window. No new
`SolverRefusal.obstacle.kind`.

**Hammer arc:** nothing handed over. `spinnerFightForecast` builds its own `slash` objects without `spearingUntil`, so
it keeps the old gate. If a spinner fight ever follows a thrust within 5 ticks, that forecast owes the same ageing
(named, not touched).

---

## D3 — witnesses (PASS)

Recorded with `probe-seedling-darktrap-mobiles.mjs --record --fidelity=<switches>`. The new flag records its switches
in the witness, and `fidelityDarkTrap.test.js` replays each witness under them. Every row: the sample clock fits only
shift 0, the player is exact at every sampled tick, and every DarkTrap's presence, "die1" and index match.

| witness | what | samples | deaths (game = model) |
|---|---|---|---|
| `darktrap2-l65-step146-spear-gate` | PUSHBLOCK's refuted 146 tape, **unchanged**; `spearingWindow,fallBurnsPress` | 393 L65 cmp / 541 t | startDying t51, "die1" t81, no removal (pit respawn) |
| `darktrap2-l65-step148-spear-gate` | PUSHBLOCK's refuted 148 tape, unchanged; `spearingWindow` | 205 cmp / 233 t | t134 / t164 / removed t206 |
| `darktrap2-l65-step148-resolved` | survey 148 re-solved, switches ON (233 t) | 206 cmp | t134 / t164 / t206 |
| `darktrap2-l63-step145-light` | survey 145's walk through the L63 arm, from stance (41.15,88.45), to its later refusal (195 t) | 622 cmp | `darktrap@64,96` and `@80,64`: t43 / t73 / removed t115 |
| `darktrap2-l65-spear-window-t5` | the 148 walk, sword presses at thrust+5, +7 | 206 cmp | +5 gated, +7 a plain slash |
| `darktrap2-l65-spear-window-t6` | presses at +6, +8 | 198 cmp | +6 slash, +8 dash |
| `darktrap2-l65-spear-in-swing` | a sword press 3 ticks before the thrust | 190 cmp | the thrust is swallowed: the pole stays out, the darktrap lives |
| `darktrap2-l63-spear-origin-float` | x 35.45 facing east, one thrust | 600 cmp | lit: the origin is not truncated |
| evidence only: `seedling-fidelity-darktrap2-evidence/darktrap2-l65-step146-resolved.json` | survey 146 re-solved (539 t, to L68, 0 hits); it replays only on PUSHBLOCK's model (my base diverges at t177, PUSHBLOCK's push glide), so the harvest owes moving it into `fixtures/darktrap-witness/` | 123 cmp / 539 t | t51 / t81 / removed t123 |

L62 (`staticladder-l62-step115-light`) and L101 (`staticladder-l101-light-bob`) are unchanged and green, both OFF and
ON. Survey 115 re-solves, ON, to the **same 290-tick walk byte for byte**.

**Mutants** (predicted first; copy + restore, `cmp` clean after):

| mutant | predicted red | measured red |
|---|---|---|
| M1 `SPEAR_ANIM_TICKS` − 1 | "press + 5 still gated", `spear-window-t5` | those, **plus** the constant's pin, the two refuted-tape witnesses and the three D1 rows. The +5 press becomes a first slash, and its 20-tick `slashTimer` makes a later press a dash. My prediction was a subset. |
| M2 `SPEAR_ANIM_TICKS` + 1 | "press + 6 is open", `spear-window-t6` | those + the constant's pin |
| M3 no spear-press gate | `spear-in-swing` | exactly that |
| M4 `fallBurnsPress` a no-op | "146 needs both", `step146-spear-gate` | exactly those |

---

## The movers with the switches ON — the list for the user's flip

ON = the shipped defaults + `darkTrapLight,spearingWindow,fallBurnsPress`
(`SEEDLING_CONTACT_FIDELITY=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress`).

| surface | ON result |
|---|---|
| committed tapes (tapeRunner) | **589 rows, md5 `73d9d645…` = BEFORE.** No committed tape moves. |
| six producer `--check`s | **byte-identical**, all exit 0 (`405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`) |
| bounded vitest (62 files) | 2 reds, both "ships OFF" pins — the re-pins a flip owes: `fidelityDarkTrap.test.js` "the switch ships OFF…" and `fidelityDarkTrap2.test.js` "ship OFF…". Also `contactFidelity.test.js`'s `CONTACT_FIDELITY` toEqual (it skips under the env hook, so it is not counted red here, but it pins the defaults). Nothing else: the R8 bridge, r8Acceptance and every control are green. |
| `fidelityDarkTrap.test.js` row "OFF: the L62 walk is NOT reproduced" | stays a correct OFF control (it sets OFF explicitly) |

**Survey rows (local, `--through=end --route=full`; before = CI 38075646127 at wave 10, `darkTrapLight` ON).**
On this base alone (no PUSHBLOCK), ON:

| step | before | after (this head, ON) | after (+ PUSHBLOCK merged, ON) |
|---|---|---|---|
| 113 L62 | REFUSED LADDER (no Spear) | same | same |
| 115 L62 | SOLVED 290 | SOLVED 290 (the same walk) | SOLVED 290 |
| 145 L63 | REFUSED VERB-MISSING | same (needs the shove) | **REFUSED LADDER** — past the light arm (two darktraps die), now at `jellyfish@160,64`: BULB/chasers' region (was: "unclassified", the light-arm stance at PUSHBLOCK's head) |
| 146 L65 | REFUSED VERB-MISSING | same | **SOLVED 539** (game-witnessed) |
| 148 L65 | REFUSED VERB-MISSING | same | **SOLVED 233** (game-witnessed) |
| 180 L63 | REFUSED VERB-MISSING | same | REFUSED, unclassified — past the light, now the L63 chest's proximity hazard on its stance waypoint (`chest (224,80)`; the encounters/chest region) |
| 208 L101 | REFUSED LADDER (ghost-sword swing named) | same | same |

**CI dispatches for the planner** (cloud sessions get 403). The survey workflow has no switch input, so ON needs a
flip branch, i.e. the harvest head with the three defaults flipped:
1. `seedling-survey.yml` on that branch, `-f through=end -f route=full -f only=113,115,145,146,148,180,208 -f base_run=38075646127`.
   Expect the table's right column.
2. The same dispatch on the harvest head WITHOUT the flip. Expect no row to move against the harvest's own OFF survey
   (byte-inertia).
3. The JS arc's divergence sweep (solver + walker), on the flip branch, at least for the legs in the darktrap and
   spear rooms: L62 legs 535–559, L63 560–580, L65 583–588, L67 591, L68 592–593, L71 595–615, L101 752–754
   (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 841 legs). A leg moves ON only if its walk
   presses the sword within 5 ticks of a thrust, or presses mid-fall.

---

## The JS arc's pins that move

None at OFF. At a flip: the `CONTACT_FIDELITY` toEqual pin (`contactFidelity.test.js`) and the two "ships OFF" rows
above. `jsRuntimeDeclarations` is untouched.

## Deltas

- New `CONTACT_FIDELITY` keys: `spearingWindow`, `fallBurnsPress` (shared table: rows added, nothing reordered).
- New exports: `combatVerbs.SPEAR_ANIM_FRAMES/RATE/TICKS`, `solverBot.LIGHT_ARM_CORE_MARGIN`.
- New optional field: `run.slashInfo.spearingUntil` (ON only).
- `surveyFamily.FAMILY_RULES` + `LIGHT-ARM` (appended), with PUSHBLOCK's verbatim 145 refusal as its test.
- `probe-seedling-darktrap-mobiles.mjs --fidelity=<keys>` (the instruments index regenerated).
- Constants: one sentinel classified (`spearEndsAt = -1`), PASS 5,492. Surface: GREEN 234 (`spearRect` +1 site).

## What the brief got wrong (measured)

- *"The game does NOT kill it"* (`darktrap@144,144`, step 146). It does: lit at t50, "die1" from t81, the model's
  ticks. The kill is lost to a pit respawn at t118, which the GAME's player reached only because it did not dash at
  t53. PUSHBLOCK's "still SET" is the end state, not the light.
- *"The player takes 2 hits (dy 1.88 at t54)"*: the dy 1.88 at t54 is the model's dash. `hits` stays 0 through t120;
  the 2 hits come later, in L63.
- *"Step 148 … leaves the game at t137, three ticks after its own light-arm thrust"*: it is two ticks of SWORD presses
  after the thrust, the next leg's, not the arm's.
- *"The spear rect misses the pole's core"* (L63): from the settled position it does. The thrust can reach. The aim was
  0.5 px deep, and the int-origin explanation I tried first was refuted on the game.
- The brief's L65 premise, *"A pole that is already lit when the thrust lands goes OUT"*, is right, and the arm already
  honoured it (a lit pole is waited out). It is not what happened in either walk: both poles started dark (every
  persistence slot boots `true`, so `activate = !true`).

## Residue

- **Survey 145** now stops at `jellyfish@160,64` (BULB/chasers), and **180** at the L63 chest's proximity hazard on its
  stance waypoint (encounters/chest). Neither is the light.
- **`spear()` re-tests at T+1, T+3, T+5** (`spearDelayMax` 1, while `spearing`). The model fires once
  (PUSHBLOCK's `SPEAR_HIT_TICKS_UNMODELLED`). That is harmless for a pole, whose 25-tick `hitsTimer` blocks the
  re-tests after a hit. But a thrust whose T+1 rect misses and whose T+3 rect hits would toggle a pole in the game and
  not in the model. The arm aims at the core (T+1 hits), so it never relies on that.
- `LIGHTPOLE_PRESS_BOX` is the bob ENVELOPE, so the run's spear arm can toggle a pole on a fringe hit that the game's
  12 px phase rect misses. The arm aims at the core, so it is safe. Other spear walks near a pole (PUSHBLOCK's third
  L65 push "also reaches `lightpole@176,120`") would want the phase rect from `clock.now()`, as `stepDarkTrapsNow` has.
  Measured: in both refuted runs the game and the model agree that tag 2 is never written.
- The moonrock freeze span's release (`levelRun` ~12965) still passes `spearing: false`. That is right unless a thrust
  ends inside a moonrock freeze.
- The re-solved 146 witness waits for the harvest (it needs PUSHBLOCK's model).
- The reference `--check`'s 4 environment diffs (container submodules).

## Byte-inertia

OFF: every committed tape, producer and bounded row is unchanged (above). The records moved: the constants/surface
censuses, the instruments index, the docs index.

## Rows to BANK

- bounded set AFTER (OFF, at `fa55b4a`, 63 files = the 61 + `fidelityDarkTrap2` + `surveyFamily`): **2,906 tests, all
  green**, md5 `41fc9001f97e5d07cf82eca5d9aa4cf0`; tapeRunner 589 `73d9d6457056ce0d2ff757edb4d0892a`.
- ON: the same 589 md5; the six producers byte-identical; reds = the "ships OFF" pins only.
- witnesses: 8 new `fixtures/darktrap-witness/darktrap2-*` (names above), plus 1 evidence-only witness for the harvest.
- survey (merged, ON): 115 SOLVED 290 · 146 SOLVED 539 · 148 SOLVED 233 · 145/180 past the light.
- CI `JavaScript Unit Tests` at `fa55b4a`: run 38092438065, 19,489 passed / 0 failed; slow 253/253.

## CI

`node scripts/procgen/ci-vitest-summary.mjs fa55b4a` → run **38092438065 success**: the unfiltered suite **19,489
passed, 0 failed, 0 skipped**; the slow battery 253/253. (This report's own commit is docs-only; its run supersedes
that one.)
