# Seedling fidelity SMALLGAPS: a freeze frame is not a tick, an icy waypoint is passed, a lava chain hits the player

| | |
|---|---|
| Session | `seedling-fidelity-smallgaps` (planner `seedling-fidelity-planning-7`, wave 16, model coverage) |
| Start SHA | `3a53894a9a` (main: wave 15 + hammer G1 + BW; not rebased) |
| Head | the commit carrying this report (code: D1 `afa2540` + `a7fb5ee`, D2 `4442244`, D3 `48a3dd8`; censuses `3b25cb7`; docs + evidence `dadd09d`) |
| Harness branch | `claude/seedling-fidelity-smallgaps-eshsq3` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (the chain; a STOP on the axe it exposed, handed over) — three new switches, all OFF and byte-inert; every flip is a licence with its movers listed below** |

## The one thing to know first

**G1's two instruments disagreed because the p4f chaser probe polled inside the freeze.** On one p4f run of leg 624's
tape the `Bot`'s own observations (`botDrain`) read **136, 135.2, 133.85**, with no stall. The probe's *first* poll at
tick 1 stood 20 dead frames into the 175-frame freeze (136); its *last* poll at tick 1 equals the `Bot`'s. So in tape
ticks a button freeze costs the player nothing: frame A is frozen, and the release frame takes the step before the next
observation. The model banked that step a tick late (`pendingFreeSteps`). Fixed behind `buttonFallReleaseStep`; the
probe now samples at the `Bot`'s point; the two wave-15 witnesses were re-recorded (one sample each). It holds
mid-room too (L29, game-witnessed).

## W0 — the bank at base (`3a53894a9a`)

| row | command | result |
|---|---|---|
| base | the harness branch at `3a53894a9a`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0; dev server `serve-nocache.py 9672` (pid 1559). The five non-wasm substrate submodules had to be initialised by hand for the reference row (as L74ARRIVAL found) |
| identity block | `SEEDLING_PORT=9672 bash scripts/procgen/identity-block.sh .` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` all exit 0; reference ALL 7 + 5 MATCH (`evidence/w0/identity-base.txt`) |
| — generated set | collided with my own probe's box lock inside the block; re-run alone | `OK` |
| surface / constants / entities / profile | each `--check` | GREEN **288** · PASS **5,846** · PASS 558 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`; md5 over sorted `status\tfullName` joined by `\n` | **611**, `75a3c41f0c91f6e71953e82d8259dc60`, 0 non-pass (my recipe; it matches BW's quoted `75a3c41f`) |
| bounded vitest BEFORE | 93 files: the brief's list + every non-slow test naming `pendingFreeSteps`, `buttonFall`, `armButtonFallRocks`, `firstTickInWorld`, `CONTACT_FIDELITY_KEYS/_DEFAULTS`, `hasArrived`, `driveStepHeld`, `previewWalk`, `chooseHeld`, the probe, `chaser-witness`, `fallRocksArmedBy`, `holdOneAxis`, `lavaChain`, `stepLavaChain`, `playerHits` + `solverBot*`/`botDriverV2*`/`jsRuntimeWalker*` + surface/constants (`evidence/w0/files-after.txt` minus the 2 new files; the 30 added late were run on a clean base worktree) | **2,379 / 2,379**, md5 `0b34145e3356b92b6af2c7db6273ebc5` |

## D1 — G1: the tape tick is the `Bot`'s, and a freeze frame is not one (PASS)

**The two instruments on the same tape** (`drivers/two-instruments.mjs`: one p4f run, every `botStatus` poll logged
with its dead-frame count, then `botDrain`; `evidence/d1/624-two.json`):

| tick | `Bot` obs (`botDrain`) | probe's FIRST poll (dead frames) | LAST poll (dead frames) | polls |
|---|---|---|---|---|
| 0 | (296, 136) | 136 (0) | 136 (20) | 109 |
| 1 | **(296, 135.2)** | **136 (20)** | 135.2 (195) | 853 |
| 2 | (296, 133.85) | 133.85 (195) | 133.85 (195) | 3 |

The game, quoted: `Main.update` is `Bot.update(); super.update();`, and `Bot.as:3201` returns on
`blackCover > 0 || Game.freezeObjects` before recording — so `obsY[t]` is read at the top of the first LIVE frame. The
L74 button's `fall()` freezes frame A (the `Button` updates before the Player); `FallRock.as:91-96` clears the flag on
the span's last frame, and the rock updates before the Player, so the player takes one step on that dead frame. Net, to
the tape: one step per tick, no stall. The model ran frame A as a frozen tick and banked the release step in
`pendingFreeSteps`, which lands at the start of the NEXT tick — the lag the BobBoss rock's oracle already measured
("obs 13 one 1.2 px step short") and fixed in-tick for that rock and the moonrock.

**The probe census** (`drivers/census.sh`, every committed chaser witness, `evidence/d1/probe-census-13-witnesses.json`):
excluding each tape's final tick (polled after `finished`), the first poll differs from the `Bot`'s observation on
exactly two witnesses, both L74ARRIVAL's: `l74arrival-624-on-plan` t1 and `l74arrival-door-l73` t5. Two others span
long freezes inside a tick (`leash-l74-629-on-plan-game` t278, 149 dead frames; `staticladder-k2-step190` t307, 331):
the player and every row of the probed class are equal first-vs-last there (only a pickup/NPC row differs).

**Change.**
- `levelRun.advance`'s `pendingButtonFalls` branch (my region; the ceremony lump is untouched):
  `CONTACT_FIDELITY.buttonFallReleaseStep` takes the banked step inside the frozen tick under its held keys (the BobBoss
  rock's form: `stepV2` with `stepOptsFor({beforeTypeFlip: false, …})`, a transition or death on it refused), and
  clears `firstTickInWorld` (the release frame is a whole world update). OFF: deferred, byte-identical.
  `SEEDLING_BUTTON_FALL_RELEASE_STEP=0|1`.
- `probe-seedling-chaser-mobiles.mjs` samples each tick at the `Bot`'s observation point: the LAST poll before the tick
  advances; the final tick keeps its first poll. Its camera map keeps the first sample (unmeasured past a dead span).

**Witnesses** (p4f headless, `--class=LavaRunner --player-hits --record`, both switches ON):
`l74arrival-624-on-plan` and `l74arrival-door-l73` re-recorded — tape and bodies unchanged, exactly one sample each moved
(t1 / t5: 136 → 135.2); LavaRunner 445 / 258 comparisons, worst 1.3e-15 / 0. Mid-room: `smallgaps-l29-button-walk`
(`fallRockButton.test.js`'s `walkNorth(120, 60)` on the game, recorded by `drivers/game.mjs` from `botDrain`; the probe
will not record a room with no row of its class): the game reads 140.85, 139.35, 138.1 at t10–t12.

| tape (vs the `Bot`'s observations) | OFF | `arrivalButtonArm` alone | release alone | both |
|---|---|---|---|---|
| leg 624 plan, booted on the button (332) | t2 | t1 | **0** | **0** |
| the L73 door arrival (131) | t6 | t5 | **0** | **0** |
| `l74leg624-postfall-reentry` (71) | 0 | 0 | 0 | 0 |
| L29 mid-room walk (61) | t11 | t11 | **0** | **0** |

`arrivalButtonArm` still decides WHICH tick is frozen (a press there is lost: `useItem` is inside the gated
`mobileUpdate`); it is unwitnessed by a press. **Test rows** (`fidelityL74Arrival.test.js`, 9 → 13): the witnesses at
the `Bot`'s ticks, release ON 0 px with the arm ON or OFF, the arm alone stands t1/t5, the defaults stand t2/t6, the
mid-room pair, and the 589 capture row (below).

**Mutants** (predicted, then made by copy + restore, `drivers/mutant.sh`):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | the step computed, not applied | the 2 "release ON 0 px" rows | **4 red**: those 2 + the 2 rows that assert release ON parts the 589 capture (with the step gone the model stalls at 136 again, matching the capture) — correct reds I did not predict |
| M2 | the step applied, `pendingFreeSteps` not decremented (a double step) | the 2 "release ON 0 px" rows | ✔ exactly those 2 |

**The boundary.** Every frozen-tick path that banks a release step was read: the BobBoss rock and the moonrock take it
in-tick already; `dropRocksTogether` banks it for the button (now switched) and for the WAND's drop, which runs inside
the pickup ceremony — CEREMONYSHOVE's lump, left alone; the rope's `dropRock` takes no release step at all (exact only
from a dead stop, as `fallRock.js` says) — residue.

## D2 — G2: an intermediate waypoint on ice is passed, not parked on (PASS)

**Measurement.** Replayed STRIKELAPSE's step-62 tape: terrain 22 (`hazard.onIce`), x 117.3–122.9 for t420–t712, v
±0.5–1.5, a lucky stop at t712. `chooseHeld`'s coast uses `DEFAULT_FRICTION`, but braking cannot fix it: on ice a
one-tick tap from rest coasts tens of px, so a ±1 px STOP is luck. The fix is the arrival, not the brake.

**Change.** `botDriverV2.waypointReached(state, wp, tolerance, intermediate)` — `hasArrived`, unless
`CONTACT_FIDELITY.waypointSlide` is ON, the waypoint is not the walk's last, and the player is on ice: then within
tolerance at any velocity. `drive` takes `intermediate` (default false); `solverBot`'s walk loop passes `!last`;
`previewWalk` asks the same predicate (⚖ 30(c), preview = drive). `CONTACT_FIDELITY` reaches `botDriverV2` through the
door (`solverView.js`). OFF: byte-identical. `SEEDLING_WAYPOINT_SLIDE=0|1`. **Not wired:** `synthesizeTapeV2` (the
committed producers, byte-identical even ON) and `jsRuntimeWalker` (the JS arc's).

**Witnesses** (p4f, `--class=Jellyfish --player-hits --record`, the survey's own step-62 walk with the switch ON):
`smallgaps-l45-62-slide-lapse` (strike lapse ON, 239 t) and `smallgaps-l45-62-slide` (lapse OFF, 249 t): every sample
0 px, no hit. **Rows** (`fidelityWaypointSlide.test.js`, 9): ships OFF; the predicate's three arms; L45 from (152,80)
OFF stalls 400 t on the ice (the G2 symptom) and ON crosses in 54 t, from (168,88) 231 → 65 t, preview = drive both
ways; the two witnesses.

| # | mutant | predicted | measured |
|---|---|---|---|
| M3 | `waypointReached` ignores `intermediate` | the "LAST waypoint needs the stop" row + the ON walk rows | **1 red**: the unit row only — the walks' last waypoint (120,40) is off the ice, so it still needs the stop |
| M4 | `previewWalk` keeps `hasArrived` | the two preview = drive rows ON | ✔ exactly those 2 |

**Every survey step that moves** (local, `--through=end --route=full`; `evidence/survey/survey-table.tsv`; head OFF
reproduces CI 38332251781's tally 169 / 51 / 1 / 1):

| step | level | OFF | ON | lapse ON, slide OFF | lapse ON, slide ON | game witness (ON) |
|---|---|---|---|---|---|---|
| 62 | 45 | 386 | **249** | 748 | **239** | 0 px, no hit |
| 63 | 46 | 298 | **208** | 298 | 208 | 0 px |
| 65 | 48 | 368 | **330** | 368 | 330 | 0 px |
| 84 | 46 | 1528 | **1352** | 1528 | 1352 | 0 px |
| 86 | 48 | 1060 | **681** | 1060 | 681 | 0 px |
| 89 | 51 | 459 | **378** | 459 | 378 | 0 px |

No verdict moves, lapse OFF or ON (216 other steps byte-equal). The ten ice rooms: L45–49, L51, L53, L54, L56, L93.

**Sweep legs** (the baseline has no `producer:walker` row — all 843 are `solver`, and the walker is not wired). The 34
legs in ice rooms, solved in node at each row's own `seamTime` (`drivers/ab.sh`, `evidence/d2/d2-{off,on}.jsonl`):
**5 move, all shorter, each game-witnessed at 0 px with no hit** (`evidence/d2/tape-*.json`):

| leg (by key) | baseline sweep | node OFF | node ON |
|---|---|---|---|
| 448 `level_45__r0c7 <- in_L44_64_0 -> exit:out_teleporter_112_0` | done (509 t) | 386 | **249** |
| 451 `level_45__r0c7 <- in_L46_240_464 -> exit:out_teleporter_112_304` | done (792) | 492 | **182** |
| 452 `level_46__r0c11 <- in_L45_112_0 -> exit:out_teleporter_176_0` | done (665) | 298 | **208** |
| 455 `level_46__r0c11 <- in_L47_240_464 -> exit:out_teleporter_240_464` | done (934) | 647 | **221** |
| 459 `level_47__r2c9 <- in_L48_112_304 -> exit:out_teleporter_240_464` | done (423) | 210 | **182** |

⚠ The sweep's own plans are longer than node's OFF answers (the page producer's budgets and passes are not my in-place
service's), so these are predictions; the dispatch below confirms them.

## D3 — G3: leg 633's attacker is `lavachain@80,80` (PASS; a STOP on the axe it exposed)

**The attacker.** The baseline row (38343649914): tape 1 hits at t75 (`hits` 1, the model's own `lavarunner@104,64`)
and t162 (`hits` 2, at (51.67,85.44), dx −4.72). L75 holds `lavachain@80,80` (dir 2: its arm is 32–80 × 86–90),
`lavachain@96,48`, `lavachain@96,32`, `spinningaxe@80,144`, `grenade@72,168` and two lavarunners. `LavaChain.reach`
(`LavaChain.as:76-93`) walks `hitables = ["Player", "Enemy"]` and hits the Player with `force` 5 from `getHitPos` = the
chain's own point (88,88) — a westward throw at that position. K2PREP (`stepLavaChainsNow`) transcribed only the
`"Enemy"` arm: *"the live run never bills a chain on the player — `dangerMap` prices it for the solver"*.

**Reproduced.** Leg 633 solved in node at the row's `seamTime` 5412 (`drivers/leg.mjs`): 449 t, `dodge`+`walk` — the
sweep's own first plan. Played on p4f (`drivers/game.mjs`): hits at t75, t162 (and later in L71). The model OFF parts at
t162 exactly as the sweep did.

**Change.** `CONTACT_FIDELITY.lavaChainPlayerHit`: every chain room steps its anim (with or without bodies), and an arm
touching the PRE-move player box on a reaching update bills `applyPlayerHit({source: 'lavachain', force 5, damage 1,
from: the chain's point, retaliate: null})` — `"Player"` before `"Enemy"`, as `reach` walks them. An unknown anim (a
skipped `Game.time`) touching the player is refused by name. OFF: byte-identical. `SEEDLING_LAVA_CHAIN_PLAYER_HIT=0|1`.

**Witness** `smallgaps-l75-633-chain` (p4f, `--class=LavaRunner --player-hits --record`, ON): **450 samples, every one
0 px, LavaRunner 807 comparisons worst 0**; the model bills t162 (`lavachain@80,80`) and t447 (`lavachain@96,48`). OFF
parts at t162. Rows: `fidelityLavaChainPlayer.test.js` (5). **M5** (the `applyPlayerHit` removed; predicted: the ON row
only) → ✔ exactly that row.

**Why the solver walked there.** The danger map does flag it: `hazardDanger` in transit names `lavachain@80,80` at t162
for the plan's box (`drivers/dm2.mjs`). The plan reached it only because its drive took the **unbilled** t75 lavarunner
hit and walked on from the knocked position. With `unbilledDamageGate` ON (chain OFF) the leg refuses at t75; it
cannot see t162. ON (chain), the leg refuses by name (the combat ladder, `lavachain@96,32`) instead of offering a plan
the game refutes.

**Survey step 163 (L75) moves:** SOLVED 434 → 476 t. The 434-t plan on the game: four chain hits (t124, 284, 354,
434), a knock into lava at t124 and a death reboot at t160 (the game's `hits` reset at (72,24)) — reproduced at **0 px
over all 435 ticks with the switch ON**. The other four reachable steps (161, 167, 169, 202) are byte-equal. Survey
step 163 by switch set (`evidence/d3/s163-*.json`):

| `unbilledDamageGate` | `lavaChainPlayerHit` | step 163 |
|---|---|---|
| OFF | OFF | SOLVED 434 (the game refutes it: chain hits, a death) |
| ON | OFF | SOLVED 434 (the gate cannot see the chain) |
| OFF | ON | SOLVED 476 (takes the t124 chain hit, dies, and meets the axe at t357 — below) |
| ON | ON | **REFUSED**: "UNBILLED DAMAGE … lavachain:lavachain@80,80 … died 1 time(s) … lava" — the only verdict the game agrees with |

**STOP — the axe (handed over).** The 476-t plan on the game takes a hit at **t357** at (76.49,167.58), thrown −5.85 px
in x, that the ON model does not bill. By geometry and elimination it is `spinningaxe@80,144`
(`SpinningAxe.hitPlayer`: force 5, a projected hit point that throws purely along x here); the live run never bills an
axe on the player either — only `dangerMap` prices it (`hazards.axeHitsPlayer`), and after the t160 reboot the danger
map keeps the disc, which does cover t353–358. Modelling it means moving the axe geometry (`axeLine`, `axeHitsPlayer`,
`collideLinePlayer` — today in `hazards.js`, a family file) into a simulation module that `levelRun` can import and
`hazards.js` re-exports (the `lavaChain.js` pattern), then a per-world axe update counter restarted at every rebuild.
That touches the AXE slice's files, so it is a slice of its own, not this one's tail.

**Also unexplained (handed to the walk executor's owner, LAPSECOST):** both 163 plans walk into the t124 chain arm,
which `hazardDanger` flags for the plan's own box (update 124, rect 32–80 × 86–90). The decision is the t53 `walk` row
(11 waypoints, a planned sword dash; `evidence/d3/s163-trace-off.json`); the plan is the same with `--dash=none`. My
rebuilt preview from t53 (without the run's dash-planned strike policy) parts from the drive at t77 and passes 0.7 px
south of the arm — so the certified corridor and the walked one differ somewhere in the walk executor's preview/probe.

## The survey/sweep rows this moves (before → after, by step/leg)

| switch | survey | sweep (by key; node at each row's `seamTime`) |
|---|---|---|
| `buttonFallReleaseStep` | none (steps 48, 162 byte-equal ON, with `arrivalButtonArm`) | no planning answer moves (624, 625, 626 identical with the release alone); the plays of 624/625/626 lose their t1–t2 parting on the page's ticks (predicted from the witnesses) |
| `waypointSlide` | 62, 63, 65, 84, 86, 89 shorter (above), no verdict | 448, 451, 452, 455, 459 shorter, 0 px on the game; the other 29 ice legs unchanged |
| `lavaChainPlayerHit` | 163: SOLVED 434 → 476 (with `unbilledDamageGate` too: → REFUSED) | 633: SOLVED 449 → REFUSED by name; the other 11 chain-room legs (618–621, 630–632, 642, 643, 751, 752) unchanged |

### Dispatches for the planner (branch `claude/seedling-fidelity-smallgaps-eshsq3`)

`<D>` = the ON defaults at base: `collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,fallRockPostFall,forecastSpeedByTerrain`.

1. **D1** `seedling-divergence-sweep.yml -f mode=inv -f producer=solver -f keys='level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_74 <- in_L73_64_0 -> exit:out_teleporter_288_144|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield' -f contact_fidelity=<D>,arrivalButtonArm,buttonFallReleaseStep`, and the same with `<D>,arrivalButtonArm` (wave 15's ON) as the control. Expect 626 done at 342 t with no t1–t2 parting; 624/625 refuse as in node.
2. **D2** the full sweep `-f contact_fidelity=<D>,waypointSlide` against `-f contact_fidelity=<D>` (or `-f keys=` the 34 ice legs, `evidence/d2/ice-legs.txt` → keys via `seedling-divergence-legs.mjs`). Expect 448/451/452/455/459 shorter and still done; nothing else.
3. **D3** `-f keys='level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224' -f contact_fidelity=<D>,lavaChainPlayerHit` and `…=<D>,lavaChainPlayerHit,unbilledDamageGate`. Expect a refusal by name (no game divergence at t162).
4. **Survey** (no `contact_fidelity` input): a measurement commit flipping the default, then `seedling-survey.yml -f through=end -f route=full -f only=62,63,65,84,86,89,163 -f base_run=38332251781`. Predicted as in the tables above.

## The JS arc's pins and what it must wire

- **Nothing breaks unwired.** `seedlingContactSettings.js` derives a page setting per key (`contactFidelityHook.test.js`
  gained rows for `buttonFallReleaseStep`, `waypointSlide`, `lavaChainPlayerHit` with no edit), and the sweep's
  `contact_fidelity=` reaches all three. No signature or contract changed (`solveSegment`, `twoPassSolve`,
  `PendingDeclaration`, `createRunForStaging`); no new staging/result field and no new `obstacle.kind`.
- **The walker (agreed region, your review):** `drive` gained an optional `intermediate` option and `waypointReached`
  is exported. **`jsRuntimeWalker` still asks `hasArrived`** for its waypoints (l.301, l.442): to walk as the solver
  does with the switch ON, it should ask `waypointReached(state, wp, WALK_TOLERANCE, <not the last>)`.
- **Your capture instrument samples inside dead spans.** `fixtures/contact-witness/589.json` reads t1 = (296, 136, vy 0)
  — 20 frames into the freeze — where the `Bot` observes 135.2. With `buttonFallReleaseStep` ON the model is the
  `Bot`'s and the capture parts at t1; `contactFidelity.test.js` names it (`CAPTURE_INSIDE_FREEZE`). The capture should
  take the last poll before the tick advances (or `botDrain`), as the probe now does.

## Handed to the hammer arc

Nothing. No hammer-owned function was touched.

## To other wave-16 slices

- **LAPSECOST**: the step-163 t124 crossing (above) is in the walk executor's preview/probe — a certified corridor the
  drive does not walk. `previewWalk`'s arrival line (two lines, `waypointReached`) is mine and textually small.
- **CEREMONYSHOVE**: the wand drop's deferred release step is inside your lump (`dropRocksTogether` from the ceremony
  branch); D1's rule (a dead frame is not a tick; the release step lands before the next observation) applies there too.

## Deltas (base → head)

- Code: `levelRun.js` (the release step in the button branch; the chain's `"Player"` arm in `stepLavaChainsNow`),
  `botDriverV2.js` (`waypointReached`, `drive`'s `intermediate`, `CONTACT_FIDELITY` through the door), `solverBot.js`
  (the walk loop's `intermediate: !last`, `previewWalk`'s predicate), `contactFidelity.js` (+3 switches, OFF, env hooks),
  `probe-seedling-chaser-mobiles.mjs` (the sample point).
- Tests: `fidelityL74Arrival.test.js` 9 → 13; `fidelityWaypointSlide.test.js` 9 (new); `fidelityLavaChainPlayer.test.js`
  5 (new); `contactFidelity.test.js` (the defaults pin +3 keys, its `skipIf` +3 env names, 589's all-ON row).
- Fixtures (`fixtures/chaser-witness/`, not the roster): `l74arrival-624-on-plan`, `l74arrival-door-l73` (re-recorded,
  one sample each), `smallgaps-l29-button-walk`, `smallgaps-l45-62-slide`, `smallgaps-l45-62-slide-lapse`,
  `smallgaps-l75-633-chain` (new).
- Censuses: surface `--write` (288 rows; `state:hazard` now also static; line moves); constants `--write` (5,851: 6 new,
  1 vanished, 311 moved). Docs: `seedling-bot.md` paragraph, `seedling-bot-log.md` § *Seedling fidelity SMALLGAPS*, the
  reference regenerated. Evidence: `CC/docs/cloud-reports/seedling-fidelity-smallgaps-evidence/`.

## Byte-inertia (OFF) and the flip's movers (ON)

| row | OFF (head) | ON (all three switches) |
|---|---|---|
| identity block | every value row = W0 (generated set OK; reference ALL MATCH after the regeneration) (`evidence/w0/identity-head-off.txt`) | **identical to OFF on every row**, the six producer `--check`s included (`identity-head-on.txt`) |
| tapeRunner | 611, `75a3c41f…`, 0 non-pass | 611, `75a3c41f…`, 0 non-pass |
| bounded vitest (95 files) | **2,400 / 2,400**, md5 `6061be942735f595257e6e536296f472`; every W0 row present but the 6 rewritten L74ARRIVAL rows (they pinned the probe's mid-freeze samples) | env-ON: 0 unexpected red; the defaults pin skips by its `skipIf`; 2 reds named below |
| a real default flip (all three `true`, scratch worktree) | — | **6 rows**: `contactFidelity.test.js` "the shipped defaults"; the three "ships OFF" rows; **`fallRockButton.test.js` "a walk over the button drops the rock into the corridor and seals it"** (it pins the stall at the press — the mid-room witness refutes it; re-pin `ys[pressTick] === ys[pressTick − 1]` to the game's step); `fidelityL74Arrival`'s 589 row (since fixed: it now pins the release OFF) |

## What the brief got wrong (measured)

1. *"on the location tape's first frame `freezeObjects` = TRUE … the player held ~175 frames — yet the TAPE TICKS read
   … no stall, because `Bot.as:3201` counts every `freezeObjects` frame as DEAD"* — right; but *"the press frame's own
   0.8 px move (`up` held from t0) completes; the freeze sits between t1's move and t2's"* is not how the frames fall:
   the press frame IS frozen (the `Button` updates before the Player), and the 0.8 px is the RELEASE frame's step,
   taken on the last dead frame (the rock updates before the Player). Same observations, different frame — and it is
   why the fix is "take the release step in the frozen tick", not "the press frame moves".
2. *"its p4f witnesses read 0 px ON with the model FROZEN at t1"* — they read 0 px because the probe's first poll sat
   inside the freeze. The instrument, not the game, froze at t1.
3. *"a new switch if the OFF arm must change"* — it must: the mid-room path has the same late step (L29, witnessed), so
   the change is its own switch, independent of `arrivalButtonArm`.
4. *"list every `producer:walker` sweep row that moves"* — the baseline sweep (38343649914) has none: all 843 rows are
   `producer: solver`. The movers are solver legs.
5. *"Step 62 … back toward ~350 t"* — 239 t with the lapse ON (249 OFF).
6. *"The attacker is not named by the wasm botStatus"* — true; it was named by geometry and the model: the chain's west
   arm on its reaching update, reproduced at 0 px over the whole 450-tick plan.

## Residue

1. **The spinning axe's player arm** (STOP above): step 163's ON plan, t357, unmodelled in the live run.
2. **The rope's `dropRock`** takes no release step (exact only from a dead stop; a rope pulled mid-walk would part).
3. **A press on the frozen arrival tick** (what `arrivalButtonArm` decides) is source-argued, not witnessed.
4. **Enemy release steps on a button freeze**: Mobiles also step on the release frame; unobservable on the witnesses
   (L74's lavarunners at rest, L29 has none).
5. **The probe's camera map** still takes its first sample per tick (unmeasured past a dead span).
6. Step 163's t124 crossing (LAPSECOST) and the 589 capture's sampling (the JS arc).

## Rows to BANK

- `contactFidelity.js`: `buttonFallReleaseStep: false`, `waypointSlide: false`, `lavaChainPlayerHit: false`.
- `fidelityL74Arrival.test.js` 13 rows; `fidelityWaypointSlide.test.js` 9; `fidelityLavaChainPlayer.test.js` 5.
- Witnesses: `l74arrival-624-on-plan` (332), `l74arrival-door-l73` (131) re-recorded; `smallgaps-l29-button-walk` (61),
  `smallgaps-l45-62-slide` (250), `smallgaps-l45-62-slide-lapse` (240), `smallgaps-l75-633-chain` (450).
- Bounded AFTER OFF: 95 files, 2,400, md5 `6061be942735f595257e6e536296f472`; tapeRunner 611 `75a3c41f…`.
- Surface GREEN 288 · constants PASS 5,851 · entities 558 · profile 138 · roster 277 · reference ALL 7 + 5 MATCH.
- CI (`JavaScript Unit Tests`) at `3b25cb7`: success — vitest unfiltered 20,278 passed / 0 failed, slow battery 253/253.
  At this report's own head: in the session's final message.
