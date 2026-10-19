# Seedling fidelity APBOSSES — the R4 boss reports, mirrored in the JS model (`apReportBosses`, OFF)

**Verdict: W0 PASS · D1 PASS · D2 PASS (OFF, byte-inert) · D3 PASS (unit tests; tapes named, no wasm) · D4 PASS
(movers measured; the flip is R7's) — one gap STOPPED and handed over: the host's grant of a reported item.**

| | |
|---|---|
| Session | `seedling-fidelity-apbosses` (planner `seedling-fidelity-planning-9`, wasm rebuild R2, item R4) |
| Start SHA | `76a4dacb7f` (= main 76a4dacb7f; the harness branch already sat there) |
| Harness branch | `claude/seedling-boss-report-locations-wv1rt2` |
| Commits | W0 + D2 `18ab1aa6` · the door/census fix + the OFF/ON batteries `8b3f6355` · records + this report `dab66eb3` · the constants classification (the head) |
| AS3 read | PeerInfinity/Seedling `r4-boss-report` @ `0eda15f785` against the pin `f8d9bc1` (`git -C vendor/seedling diff f8d9bc1 0eda15f785`; 5 files, +39 −18). The `vendor/seedling` gitlink was NOT moved |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-apbosses-evidence/` (`w0/`, `after/`, `d4on/`, `d2/`, `survey/`, `tools/`, `d1-build-cleared.txt`) |

**The one thing to know first.** With the switch ON, every leg that leaves L32 by the burned pit, having NOT already
held Fire, is refused by name (`precondition`). This covers survey step 51, the campaign's `r9-solve-32` and four of
the five tape movers. That is the AS3 working as written: `Fire.removed()` grants nothing, and the HOST grants the item.
But the model has no channel for a host grant that lands mid-visit (`grants` fire only on a level's entry). The flip
therefore needs that channel, with its latency measured on the R7 build (§ Hand-overs, H1). Everything else ON is the
AS3 line by line.

## W0 — the base (PASS)

The battery is `evidence/tools/battery.sh` (BOMBBLAST's, re-pointed), run on the untouched base on port 9696. My WIP
was moved aside by copy and restored afterwards, never stashed.

| row | result |
|---|---|
| bootstrap | `session_bootstrap.sh --seedling` → `READY`, Node v22.22.0; server `serve-nocache.py 9696` |
| censuses | surface GREEN **314** · constants **6,041** PASS · entities PASS **566** · profile PASS **138** · roster **282** (`w0/censuses-w0.txt`) |
| tapeRunner pairs | **621 `fceca579b35f6daf2f15c90c0c70ba0e`**, 0 non-pass |
| bounded vitest BEFORE | **86 files / 2,614 green** (`w0/vitest-files-w0.txt`, `w0/vitest-w0.txt`): the brief's set, plus every test file that `grep -a`s a contract I touch (`seedlingEncounterBinding`, `apPlacementRewriter`, `burnableTree`, `levelRun`, `placedTalk`, `r5Chain`, `r5Feather`, `r7Acceptance`, `solverEncounter`, `surveyGrants`, `levelWorld`, `solverBot`, `bobBoss`, `dialogue`, `fidelityEncounters`, `fidelityEncounters2`, the four boss-fight files) |
| identity block | md5 **`738b7ab5921f1df5df66a0277c81df5d`** (`w0/identity-w0.txt`; = BOMBBLAST's base): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set **OK** |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 |
| reference | 4 generated regions differ at the base (environmental, as BOMBBLAST and MOVINGWAIT saw) |

## D1 — the audit (PASS)

AS3 at the pin is `f8d9bc1`; the R4 branch is `0eda15f785` (`git -C vendor/seedling diff f8d9bc1 0eda15f785`: 5 files,
+39 −18). Both atlases (`seedling.json`, the vanilla map; `seedling-playthrough.json`, the delivered set's source) carry
the same entities in all nine rooms (`d1-tags` below), so the model's behaviour is the same on both: the delivered
set differs only in WHICH item the AP placement puts at each location, and that binding is the rules arc's
(`apPlacementRewriter.js` ~:255 reads `hasFire` / `hasDarkSword` as the encounter rows' CHECK; read, not edited).

Placed tags (measured, `atlasLevelSource`): L32 `fallrocklarge@64,128:1 burnabletree@64,0:0 watcher@8,48:2`; L12 tags
0, 2–12 (no tag 1); L112 `finalboss:0 rocklock:1`; L19 `shieldboss:0`; L57 `tentaclebeast:0`; L43 `bosstotem:5`; L69
`lightbosscontroller:0`; L82 `lavaboss:0`. **No placed entity carries {32,3}, {32,4} or {12,1}.**

| row | the model today (OFF) — writes / grants / revisit | AS3 @f8d9bc1 | AS3 @0eda15f785 |
|---|---|---|---|
| **Times** (32,3) | Writes NOTHING (the slot does not exist). The final form's death spawns the Fire at (80,80) (`bobBossFight.js:227`, `{fire: true}`). Grants nothing. Revisit: the rock is FALLEN (`bobRocksFallen` / {32,1} staged) and its first frame re-adds the boss **unless `hasFire`** (`levelRun` `spawnOnFirstFrame`, `inventory.hasFire`), always writing `playerPosition` (72,104). A staged {32,3} THROWS at the build (orphan) | `BobBoss.as:39-43,97-101,121-122` the three `hasFire` guards; `:194` `add(new Fire(…, -1))`; `FallRockLarge.as:116-119` boss + `playerPosition` | `BobBoss.as:31` KILLED_TAG 3, guards deleted; `:192` `setPersistence(3, false)`; `FallRockLarge.as:118-122` boss + `playerPosition` only while {32,3} holds |
| **Fire** (32,4) | Collect → `applyItem('fire')` (hasFire) at `removed()`; a `fire-removed` ledger row naming **{31,29}** (out of band, REPORTED, never applied: `outOfBandFlagForWriter({as3:'Fire', tag:-1})`). Revisit: nothing (no boss with hasFire, no Fire) | `BobBoss.as:194` tag −1; `Fire.as:42-48` `hasFire = true; setPersistence(tag, false)` | `Fire.as:21` BOSS_DROP_TAG 4; `:49-55` `setPersistence(tag)` only; `BobBoss.as:193-194` and `FallRockLarge.as:123-126` spawn it while {32,4} holds |
| **Dark Sword** (12,1) | `witchGrants`: `hasWand && !hasDarkSword` → a `DarkSword` at the feet; collect → `applyItem('darksword')`; a `darksword-removed` row naming **{11,29}** behind an out-of-band read (`writesWhen: ifFlagAlreadySet`, REPORTED, never applied). Revisit: nothing once hasDarkSword | `Witch.as:48-52` `!Main.hasDarkSword`, `new DarkSword(…)` (tag −1); `DarkSword.as:42-50` `hasDarkSword = true; if (checkPersistence(-1)) setPersistence(-1)` | `Witch.as:50-53` `checkPersistence(WITCH_TAG)`, `new DarkSword(…, 1)`; `DarkSword.as:22, 49-58` no grant, `if (checkPersistence(1)) setPersistence(1)` |
| **Owl** (112,0) | `finalBossFight` steps the fight; endAnim "dead" banks **both** {112,0} and {112,1} into `pendingEarnedClears` + `finalBossFlags` (`levelRun.js` `tagsWritten`, one frame). Revisit with {112,0} cleared: **THROWS** at the build (`finalboss` has no `PERSISTENCE_RESPONSE`) | `FinalBoss.as:71` check → remove; `:219-222` both clears | unchanged (the rules arc's lost-report defect is host-side; the model mirrors both writes) |
| **Shieldspire** (19,0) | `startDeath` inside the killing hit: `shieldBossFlags` + `pendingEarnedClears`. Revisit: builds, the boss DESPAWNS (`PERSISTENCE_RESPONSE.shieldboss: 'despawn'`) | `ShieldBoss.as:58` check, `:66` clear | unchanged |
| **Tentacled Beast** (57,0) | No fight is modelled (a `pixelmask` Solid). No write. Revisit with {57,0}: **THROWS** (no response row). Survey step 94 is NO-EDGE | `TentacleBeast.as:52` built DEAD (not removed); `:99-102` clear | unchanged |
| **Totem of Lacste** (43,5) | `bossTotemFight` steps the kill; the white-out writes `bossFlags` (an `earnedClears` row) but **not** `pendingEarnedClears`, so a same-run re-entry would rebuild the boss. Revisit with {43,5} staged: **THROWS** (no response row) | `BossTotem.as:460` check → remove; `:478` clear | unchanged |
| **Lights** (69,0) | Not modelled (`notSolid`). No write. Revisit with {69,0}: **THROWS** (no response row) | `LightBossController.as:50` acts only while held; `:106` clear | unchanged |
| **King of Fire** (82,0) | Not modelled (a `LavaBoss` Solid, refused by name). No write. Revisit with {82,0}: builds, despawned (`lavaboss: 'despawn'`). Steps 161/182 REFUSED | `LavaBoss.as:62` check; `:135-137` clear | unchanged |

The build matrix is `evidence/d1-build-cleared.txt` (each row's slot handed to `buildLevelWorld`, OFF and ON).

## D2 — `apReportBosses` (PASS: OFF, byte-inert)

**The switch.** `CONTACT_FIDELITY.apReportBosses`, **OFF**. It is appended last to the key order and to the
`contactFidelity.test.js` defaults pin. `SEEDLING_AP_REPORT_BOSSES=0|1` sets it for a node measurement. For CI, the
sweep's `contact_fidelity` input names it.

**The model** (`apReportBosses.js`, new). Pure functions, each docblock citing `0eda15f785` file:line:
- `fallRockLargeSpawn` (`FallRockLarge.as:116-127`): the boss and `playerPosition` while {32,3} holds, else the Fire
  while {32,4} holds, else nothing.
- `bobBossFinalDeath` (`BobBoss.as:188-197`): write {32,3}, then the Fire only while {32,4} holds.
- `witchGrantsReport` (`Witch.as:46-55`): `hasWand && checkPersistence(1)`.
- `reportPickupRemoved` (`Fire.as:49-55`, `DarkSword.as:49-58`): no item; Fire clears {32,4} always, DarkSword clears
  {12,1} only while it holds.
- `reportSlotsReadBy`: the arena rock reads {3, 4}, the Witch reads {1}.
- `AP_REPORT_ROWS`: the nine (level, tag) → upstream id rows.

**Wired, every site behind the switch** (OFF runs the old line verbatim):
- `levelRun.js`:
  - `apReportSlotHeldNow` reads `clearedByLevel` and `pendingEarnedClears`, and throws on a non-R4 slot.
    `apReportWrite` banks an in-band write into `pendingEarnedClears` and the new `apReportFlags` ledger, which feeds
    `earnedClears`.
  - The Witch's close reads the slot and puts the tag on the sword. Both ceremonies take `item: null`. Both
    `removed()`s write in band, with no tag −1.
  - The final death writes {32,3} and then gates the drop. The rock's two spawn arms (fallen-at-build and landing)
    take the three-way.
  - The run exposes `apReportSlotHeld(level, tag)`.
- `levelWorld.js`: before the orphan guard, the R4 slots a room's runtime entities read are marked used.
- `solverBot.js`:
  - Bob's executor reads `killedAtEntry` and `dropHeld` off the run. The fight runs until {32,3} is reported and, while
    {32,4} holds, until the Fire is down.
  - The drop is "collected with no item". Verification is on the slots and the ledger rows.
  - The burn refuses by name when Fire is not held. The sentence reads *"…this run holds none."*, which
    `progressKind` classifies `precondition`. No new refusal kind, no `other`.
  - The Witch's `already` is the slot, and the sword held no longer matters.
  - `encounterExecutorFor` resolves the executor by the ROOM (arena → Bob, a speaking Witch → the Witch), and falls
    back to `ENCOUNTER_EXECUTORS[drop.item]`. OFF it is that lookup alone.
- `solverView.js`: the door re-exports the five slot constants. `seedling-solver-surface.json` classifies them and
  `run.apReportSlotHeld` (`seedling`, `constant` / `live-state`).

**The state is an INPUT** (⚖ *"a way to know which state it's in"*). No spawn or verdict reads an inventory under ON.
`hasFire` and `hasDarkSword` are read in exactly two places: `Witch.update`'s text, which the AS3 leaves unchanged, and
the burn's precondition, which is the item the burn really needs.

**The six other bosses (as they are).** Their AS3 is unchanged and the switch does not touch them. See D1 for which
of them the model writes and which it cannot rebuild.

**Byte-inertia, measured** (`after/`, OFF, at `18ab1aa6`, i.e. the full D2 change):

| row | W0 | AFTER (OFF) |
|---|---|---|
| identity block | `738b7ab5…` | **`738b7ab5…` (equal, all six `--check`s equal and exit 0)** |
| tapeRunner pairs | 621 `fceca579` | **621 `fceca579`** |
| bounded vitest | 86 / 2,614 | **87 / 2,636** (the new file adds 1 / 22) |
| surface census | GREEN 314 | RED: the door rule (`solverBot.js` imported `apReportBosses.js` directly) + new rows → fixed in `8b3f6355` (import through `solverView.js`, `--write`, classified): **GREEN 320** |
| constants census | 6,041 | stale region → `--write`: **6,078 PASS**. ⚠ `--check` PASSES with new literals unclassified; the gate that catches them is `seedlingConstantsCensus.test.js` › *zero unclassified rows*, red on CI at `dab66eb3` (1 of 21,277). Fixed in the final commit: seven reviewed rows in `seedling-constants-fields.csv`, `--profile-rows`, `--write` → the test 24/24 |
| entities / profile / roster | 566 / 138 / 282 | equal |

The bounded set was re-run at the final code, OFF: **87 / 2,636 green** (`after/vitest-final.txt`).

## D3 — no game witness possible; the unit tests and the tapes to record after R7 (PASS)

The AS3 is in no wasm until R7. No wasm was built. Instead:

**Unit tests, both arms** (`fidelityApBosses.test.js`, 22 rows, green at the default and as named under ON below):
- The module: the nine rows and their upstream ids; `fallRockLargeSpawn`'s three-way; `bobBossFinalDeath`; the
  Witch's guard; both `removed()`s (no item, the slot); the slots each room's runtime entities read.
- The build: OFF, a staged {32,3} / {32,4} / {12,1} is an orphan THROW; ON it builds (other slots stay orphans).
- The run's state reader: `run.apReportSlotHeld` reads the staging, and throws by name on a non-R4 slot.
- Revisits, persistence in: {32,1}+{32,3} cleared → the rock's first frame adds the FIRE (tag 4), no boss,
  `playerPosition` NOT written; {32,1}+{32,3}+{32,4} cleared → nothing.
- Bob ON: fresh with Fire from the server → the fight anyway (7 landings), `boss-killed` {32,3}, `fire-removed` {32,4}
  (in band), no {31,29}, no item on the `collected` row, burn, pit to L30. Fresh WITHOUT Fire → both reports, then the
  burn is refused by name (`progressKind` → `precondition`). Killed at entry with the drop held → no fight, the Fire,
  {32,4}. Both reported → `already`, the pit. Any AP item at L32 resolves to Bob's executor by the ROOM (OFF: refused
  by the drop's name).
- Witch ON: slot held → the sword is added and collected, {12,1} in band, NO `hasDarkSword`; the sword already from
  the server → she still adds it; slot cleared → `already`, 0 ticks; no wand → refused, citing the R4 guard.

**Mutants (predicted first, copy + restore; `evidence/d2/mutants.txt`).**
| mutant | predicted | measured |
|---|---|---|
| M1 `witchGrantsReport` ignores the slot | the `:50` unit row fails; the solver rows pass (the executor reads the slot before talking) | exactly that: 1 red |
| M2 the final death writes no {32,3} | both fresh Bob rows fail (the fight never ends on the report) | exactly that: 2 red |
| M3 the build reads no R4 slot | 7 rows: build ON, both revisits, killed-at-entry, both-reported, the room executor, Witch slot-cleared | **8**: those 7 + the slot-reader row, which also stages {32,3}. A prediction miss, not a test gap |

**The witness tapes to record after R7** (p4f, headless, the R7 wasm; the model ON must reproduce each at 0 px). Each
stages the slots through the tape's `persistence` block (what the game's `persistence_cleared` reads at the boot):

| tape (name to record) | boot / staging | the room's state | what it must show |
|---|---|---|---|
| `apb-l32-fresh-fire-held` | `swim-u5-bobboss-encounter`'s staging + `hasFire` | {32,3} {32,4} held, Fire from the server | the boss IS added (no `hasFire` removal); seven landings; at the final death `persistence_cleared` gains {32,3} on the death frame and the Fire appears at (80,80) the next; collecting it clears {32,4}; `hasFire` unchanged (already true); NO {31,29}; the burn, the pit |
| `apb-l32-fresh-no-fire` | `swim-u5-bobboss-encounter`'s staging, unchanged | {32,3} {32,4} held, no Fire | as above, but after the collect `hasFire` stays FALSE (the host grants it, and the probe has no host): the tape ends in the room after the Fire's ceremony + 30 idle ticks (no burn); the readout shows {32,3} {32,4} cleared and `hasFire` false |
| `apb-l32-killed-drop-held` | boot L32 at the L30 door, `persistence` {32,1} {32,3} | rock fallen; the drop unreported | the rock's first frame adds the FIRE, no boss, no BobBossNPC; the respawn point is NOT rewritten (a death here reboots at the ctor's args — optional: die once to read it); collect → {32,4} |
| `apb-l32-both-reported` | `enc-l32-fire-return`'s staging + {32,3} {32,4} | nothing to spawn | no boss, no Fire; the snap, the burned pit, the fall to L30 — the R7 replacement for `enc-l32-fire-return` |
| `apb-l12-witch-slot-held` | `enc-l12-witch`'s staging | {12,1} held, wand, no dark sword | the talk, the sword at the feet, its ceremony; {12,1} cleared on the removal frame; `hasDarkSword` FALSE; NO {11,29} |
| `apb-l12-witch-server-sword` | `enc-l12-witch`'s staging + `hasDarkSword` | {12,1} held, the sword already held | textExtra1 is spoken (`Witch.update` is unchanged) AND the sword is still added and collected; {12,1} cleared |
| `apb-l12-witch-reported` | `enc-l12-witch`'s staging + `persistence` {12,1} | reported | the dialogue closes and nothing is added |

The six other bosses need no new tape for R4 (their AS3 is unchanged); the existing `r6-owl-kill`, `r6-totem-kill`
and the ShieldBoss rows stay as they are.

## D4 — the movers, switch ON (PASS: measured; the flip pairs with R7)

Everything below is the battery run under `SEEDLING_AP_REPORT_BOSSES=1` (`d4on/`), the survey subset run OFF and ON
locally (`survey/`), and the CI baselines (survey **39153361080**, sweep **39153416627**), fetched with `gh run download`.

**The identity block ON** (`d4on/identity-on.txt`, md5 `e46c67bf…`). Every value row and five producers are equal.
`solve-seedling-r9-campaign --check` moves: `092bbedb…` exit 1 against `3d41b9fb…`. Its `r9-solve-32` window refuses
on the burn (`d4on/r9-campaign-check-on.txt`). The windows before it (L13 → L30's arrival at L32) all PASS.

**tapeRunner ON**: 621, **10 non-pass**, which is five tapes × the two faces (`d4on/taperunner-on-movers.txt`):

| tape | why it moves ON | on the R7 wasm |
|---|---|---|
| `swim-u5-bobboss-encounter` | the Fire's collect grants nothing → the tape's equip of slot 1 at t840 finds one slot | re-record: the GAME also grants nothing without a host (H1) |
| `r9-solve-32` | the same, t840 | the same |
| `enc-l32-fallen-door` | the same, t839 | the same |
| `enc-l32-live-arrival` | the same, t833 | the same |
| `enc-l32-fire-return` | Fire held, {32,3} unstaged → the boss IS added (Q2), and the tape's t1 press lands on a BobBossNPC frame | replace with `apb-l32-both-reported` (D3) |

`r5-bobboss-fire`, `r5-bobboss-arm`, `r3-bobboss-death` and `enc-l12-witch` do not move: their recordings end, or stop
reading, before the changed line. ⚠ `enc-l12-witch`'s stream is unchanged ON even though `hasDarkSword` is no longer
granted. The recorded observation does not read it inside the tape's window, so it is not evidence for the Witch arm.
`apb-l12-witch-*` are.

**Bounded vitest ON**: **24 red in 8 files** (`d4on/vitest-on.txt`). All of them are expected movers of a default
flip:

| file | rows | what they pin |
|---|---|---|
| `fidelityEncounters.test.js` | 8 | the vanilla executors (fresh/fallen/respawn/Fire-held/mid-fight Bob, the Witch's `hasDarkSword` and `already`) |
| `fidelityEncounters2.test.js` | 4 | `hasFire` / `hasDarkSword` landing frames and the Witch's close + 1 |
| `fidelityApBosses.test.js` | 4 | its own OFF rows (the default pin, the OFF orphan throws, the OFF executor refusal) |
| `solverEncounter.test.js` | 3 | the Fire registry row, the vanilla solve, `r5-bobboss-fire`'s both-writes ledger |
| `dialogueAutoAdvance.test.js` | 2 | the sword-collecting differential |
| `contactFidelity.test.js` | 1 | the shipped-defaults pin |
| `observationTolerance.test.js` | 1 | "exact mode agrees on all 282 committed recordings" (the five tapes above) |
| `seedlingEncounterBinding.test.js` (flashPanel) | 1 | `4 · PERSISTENCE` — a live L32 arrival after a death, solved through to the burn |

**The survey, OFF vs ON** (`survey/off.txt`, `survey/on.txt`; 20 steps: every L12, L19, L31, L32, L43, L57, L82,
L112 step of the CI route, by (level, goal, boot)):

| step | room / goal | OFF (= CI 39153361080) | ON |
|---|---|---|---|
| **51** | L32 encounter → Fire, then the pit | SOLVED 1056 t | **REFUSED** (`precondition`): *"the arena's exit (burnabletree@64,0) burns only with Fire … this run holds none."* |
| 130 | L12 Witch → Progressive Sword | SOLVED 601 t | SOLVED 601 t (the step does not hold the sword, so both arms agree) |
| the other 18 | 28 39 (L19), 30 32 43 57 74 80 115 144 165 175 (L12), 49 (L31), 94 (L57), 113 (L43), 161 182 (L82), 208 (L112) | as CI | **identical** |

**The sweep legs that should move on R7** (by KEY from the baseline 39153416627; I cannot run the sweep):
- The Witch legs, `location:Level 012 - Witch`: ids 109, 119, 129, 139, 149, 159 and 169 at the baseline, arrivals
  from L0/L33/L35/L36/L88/L95. Every one holds `hasDarkSword: true`. OFF they are `already` (done at t0); ON (and on
  the R7 game) the slot holds, so she adds the sword and the leg talks.
- The L32 legs holding Fire: 349 and 350 (`level_32 <- in_L30_224_160 -> exit:out_pit_14_5 / _15_5`) and 351
  (`location:Level 032 - Bob Boss`). OFF there is no boss; ON the boss fights (Q2).
- Leg 348 (`-> exit:out_stairsdown_72_136`, no Fire) is unchanged up to the kill.

**What moves on the NEW wasm with the switch still OFF** (the rules arc's warning, made exact). These are the same
rows, from the other side:
- The five tapes above stop matching the game: the game grants nothing and fights Bob with Fire held.
- `enc-l12-witch` moves at the readout. The game's {12,1} is cleared and {11,29} is not.
- Survey step 51 diverges from the game (OFF "solves" a burn the game cannot make without the host's grant).
- The sweep legs above go the same way.

So the flip and the R7 re-record must land in one merge.

**The CI dispatches for the planner** (I get 403 on `workflow_dispatch`):
1. The sweep A/B on this branch, no code edit. Run `seedling-divergence-sweep.yml` twice on
   `claude/seedling-boss-report-locations-wv1rt2` with `keys=` the twelve legs above (or no `keys` for the whole
   sweep):
   - A: `contact_fidelity=` unset (the defaults).
   - B: `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,apReportBosses`
     (= the defaults + `apReportBosses`).

   ⚠ On TODAY's wasm, B is a model-vs-old-game A/B: the Witch and L32 legs SHOULD diverge in B. The meaningful A/B is
   on the R7 build, where A should diverge and B should not.
2. The survey: `seedling-survey.yml` has no `contact_fidelity` input. Push a scratch branch that flips the default to
   `true` in `contactFidelity.js`, then run `seedling-survey.yml -f through=end -f route=full` on it, and on this
   branch for A. Expected: step 51 SOLVED → REFUSED (`precondition`), every other step identical (measured locally on
   the 20 steps that could move).

## Hand-overs

- **H1 — the host's grant of a reported item, mid-visit** (JS arc, with the rules arc's R4b). Under ON,
  `Fire.removed()` / `DarkSword.removed()` grant nothing and the host grants the item. The model's only grant channel
  is `grants` (by level, at entry), so it cannot express "Fire arrives N frames after {32,4} is reported". This one
  gap is behind all four L32 burn movers, survey step 51 and `r9-solve-32`.
  - What to measure on R7: in a p4f run with the host binding live, the frame `hasFire` turns true relative to the
    {32,4} write.
  - Then wire it as an OPTIONAL staging field, e.g. `reportGrants: [{level, tag, items, afterTicks}]`, applied from
    `apReportWrite`'s frame. I did not build it: its only content would be a latency nobody has measured, and the
    brief says the solver may not plan on the kill granting the item.
  - Until then the refusal is by name and classed `precondition`.
- **H2 — four boss rooms cannot be rebuilt after their kill** (fidelity, the next coverage wave). `finalboss`,
  `tentaclebeast`, `bosstotem` and `lightbosscontroller` have no `PERSISTENCE_RESPONSE` row, so a build handed their
  cleared slot THROWS (`d1-build-cleared.txt`). With R4 every one of those slots is a location a server can stage.
  The AS3 is three different responses, not one:
  - despawn: `FinalBoss.as:71`, `BossTotem.as:460`;
  - built DEAD and still present: `TentacleBeast.as:52-57`;
  - nothing spawned: `LightBossController.as:50` acts only while the slot holds.

  Also, the totem's kill reaches `bossFlags` (an `earnedClears` row) but not `pendingEarnedClears`, so a same-run
  re-entry of L43 would rebuild the boss (`levelRun.js` ~:9466).
- **H3 — the encounter rows' CHECK** (rules arc R4b). `apPlacementRewriter.js` ~:255 binds the L32 and L12 encounter
  rows to `hasFire` / `hasDarkSword`; under R4 the check is the slot. `r7Acceptance.js:1402, 1407` carry the same
  `flag: 'hasFire' / 'hasDarkSword'`. Read, not edited.
- **H4 — the JS arc's pins that move at the flip, and what it must wire:**
  - The 24 bounded rows and the five tapes in D4.
  - `observationTolerance`'s "282 recordings" row.
  - `seedlingEncounterBinding`'s `4 · PERSISTENCE` row.
  - `jsRuntimeSolver.js:510` builds the encounter goal from `goal.encounter.drop.item`. Under ON the executor resolves
    by room, so an AP item that is not Fire or a Progressive Sword at L32/L12 now solves instead of refusing; the
    sweep's location legs inherit that.
  - Nothing new to wire for the switch itself: the sweep's `contact_fidelity` carries it.
- **Nothing for the hammer arc.** No edit touches its region. The escape reads nothing new: the arena's Fire tag rides
  on `bobArena` (digested in `player`), the writes land in `pendingEarnedClears` (digested in `persist`), and the
  switch in `CONTACT_FIDELITY` (digested in `globals`). The two pieces of state outside the digest are `apReportFlags`
  (a ledger feeding only `earnedClears`) and the Witch sword's `tag`. `witchSword` was already undigested before this
  slice; named, not changed.

## What the brief got wrong (measured)

- *"the vanilla tag −1 Fire/dark sword used to clear L31:29 / L11:29 … Check whether the model reproduces that −1
  write today"*: the model REPORTS both as ledger rows (`fire-removed` {31,29}; `darksword-removed` {11,29}, behind
  an out-of-band read, `writesWhen: ifFlagAlreadySet`). It never APPLIES either to a build. ON reports neither.
- *"The six other bosses … already clear their OEL @tag on the kill"*: true of the AS3, but the MODEL clears only
  three of them. Owl and Shieldspire bank their slots. The totem ledgers its slot without banking it. Tentacled Beast,
  Lights and King of Fire have no modelled kill, so nothing is written. Four of the six rooms cannot be rebuilt
  after the kill at all (H2).
- *"solverBot ~:1348 and ~:2412: the Progressive Sword derivation from the Witch"*: there is no derivation there.
  `:1348` is `execWitchEncounter`'s docblock and `:2412` is the `ENCOUNTER_EXECUTORS` row keyed on the AP item name.
  The derivation is that lookup, and it is what ON replaces with the room.
- *"`dialogue.js` ~:572–581"*: that is `PLACED_NPC_TALK.witch`'s row. Its `why` still quotes the vanilla guard. It is
  a description, not a decision, and was left unchanged.
- Not stated: `playerPosition` (the arena's reboot point) is written only on the boss arm now. Under ON a death in a
  fallen arena with the boss reported reboots at the level's own arrival, not at (72,104).

## Residue

- The R7 witnesses (D3's seven tapes) and the flip itself. Neither is possible before the wasm exists.
- H1 (the host grant) blocks the L32 exit under ON for any route that does not already hold Fire.
- The Owl's lost report is the rules arc's (host-side). The model writes both clears, as the AS3 does.
- `dialogue.js`'s Witch `why` and `bobBoss.js`'s `FIRE` / `BOB_BOSS_LEDGER` still describe the vanilla AS3. They are
  the OFF arm's documentation; the ON arm's lives in `apReportBosses.js`.

## Records

- `seedling-bot-log.md`: the APBOSSES entry, with two trap candidates (the orphan guard meets a runtime reader;
  `playerPosition` rode on the spawn arm).
- No tape, no tape-index row and no roster pin is added or moved, so the roster stays 282.
- Surface census GREEN 320, constants 6,078 PASS, both `--write`/`--check`. The seven reviewed constants rows
  (`seedling-constants-fields.csv`) are in the head commit.
- CI `JavaScript Unit Tests`: at `dab66eb3` (run 39319904325), 21,276 / 21,277, with the 1 red the constants
  classification above, and the slow battery 254 / 254. The head's run is quoted in the final chat message.
- Trap candidate (third): `census-seedling-constants --check` is GREEN on a new UNCLASSIFIED literal. The gate is the
  vitest row, so a slice that runs only the CLI `--check` ships a red CI.
- The reference: regenerated for my doc edits only; the 4 environmental regions are as at the base.
- Bounded vitest AFTER, at the final code, OFF: **87 files / 2,636 green** (`after/vitest-final.txt`).

## Rows to BANK (ON = the flip's expected state, for R7)

| row | OFF (this branch) | ON |
|---|---|---|
| identity block | `738b7ab5921f1df5df66a0277c81df5d` | `e46c67bf7f03687a9b9129f4c3d6bbd8` (only `r9-campaign` moves) |
| tapeRunner pairs | 621 `fceca579b35f6daf2f15c90c0c70ba0e` 0 non-pass | 621 `c486d26990b64e59d8afe60c2217c70a` 10 non-pass (5 tapes × 2) |
| survey (20 local steps) | as CI | step 51 SOLVED 1056 → REFUSED (precondition); 19 identical |
| `fidelityApBosses.test.js` | 22 green | 18 green, 4 red (its OFF rows) |
