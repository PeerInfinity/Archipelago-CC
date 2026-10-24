# Seedling fidelity SEARCHGAPS — L41's crusher bait (`crusherBaitPressGoal`, OFF) and L67's forced-hit proof cost (`forcedHitWitnessFirst`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-searchgaps` (planner `seedling-fidelity-planning-11`, wave 28) |
| Start SHA | `d3346cf784` (= main `d3346cf784`; the harness branch already stood there) |
| Code head | `efb0be4a` (D-B `039fe2d8`, D-A `0fe4f6d5` + its FAMILY_BLOCKS fix `efb0be4a`); records head `bdc706bb`; this report's final text is the last commit |
| Harness branch | `claude/seedling-fidelity-searchgaps-sjna6n` (nothing pushed elsewhere) |
| Port | 9727 (the dev server on this tree); 9728 for the ON-arm probe battery (a scratch worktree, both literals flipped) |
| Verdicts | **W0 PASS · D-A PASS behind `crusherBaitPressGoal` (OFF) — one p4g witness at 0 px; the room's NEXT wall is FIREPUSH's · D-B PASS behind `forcedHitWitnessFirst` (OFF) — the honest fix was NOT a budget · Movers: STOP for a licence (listed below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-searchgaps-evidence/` |

## The one thing to know first

**Neither refusal said what was wrong.** Leg 871's *"… (the round trip) … exhausted"* was not about the round trip: the
ordering search FOUND R5's W,S,E (the crusher parked on the cover's button, the start cell kept) and threw it away because
the part is behind a wandlock whose button only the fire block can hold — the goal was one mechanism short. And by then the
player had already died: the frontier's `break` of the shield rocks swung from inside the lane they shield. Leg 908's
*"ran out of 640, then 2560 work units"* was not a budget either: unbudgeted, both passes REFUSE (an armed arrow lane), and
99.6 % of the units went to a forced-hit proof that could only ever end "a search that gave up is not a proof". Both are
fixed behind OFF keys. With both keys ON, **no survey verdict and no sweep end moves**. What moves is refusal text: L41 now
gets through the bait and refuses at the wandlock (FIREPUSH's region), and 908, 76 and five survey rows answer with the
room's own refusal instead of a deadline or a give-up.

## W0 (PASS) — `evidence/identity-w0.txt`, `censuses-w0.txt`, `rows-before.txt`, `tape-runner-pairs.txt`, `w0-measurements.txt`

| row | command | result |
|---|---|---|
| base | `git checkout` at `d3346cf784`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0, server PID kept (port 9727) |
| identity block | `SEEDLING_PORT=9727 bash scripts/procgen/identity-block.sh .` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK — **= TIMEDPASS's W0 on every row** |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER — the known box artifact (no `bulletml-dodge` checkout) |
| surface / constants / entities / profile | each `--check` | GREEN **345** · PASS **6,908** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** |
| tapeRunner pairs | sorted `status\tfullName` | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 88 files (`vitest-files-before.txt`: the brief's list — `apReportBosses` has no test file of that name, so the four files that import it — and every test naming `crusherBait`, `searchBaitOrdering`, `choreographyFor`, `BAIT_CHOREOGRAPHIES`, `proveForcedHit`, `FORCED_HITS`, `forcedHit.js`, `CONTACT_FIDELITY_KEYS`, `execBait`, `frontierExecutor`, `refineStrategy`, `crusherSightDanger`, `CRUSHER_BAIT`, `fidelityRope`, `undashed`) | **2,344 tests, 0 red** |

**Both legs reproduced locally** (`probe-seedling-divergence-sweep.mjs --mode=inv --page=seedling_bot_ap_p4g --page-legs=1
--keys=<871|908> --capture-requests`, legs re-derived at the base: ids 871 and 908 unchanged): the same two refusals as
re-sweep 40015230731 (seam 5279 / 5434). Every measurement below is on those captured requests replayed in node.

## D-A — L41's crusher bait (PASS behind `crusherBaitPressGoal`, OFF) — `0fe4f6d5`, `efb0be4a`

### W0: the three questions the brief asked

- **Is the round trip the game's, or the search's?** It is the search's (R5 slice 17's proposer), and here it is
  **satisfied**: the 102 states, laid out by configuration (`w0-measurements.txt`), include `crusher@240,64` at (256,240) —
  ON `button@248,232` — with the start cell in a 368-node component. The term that fails is the AIM: `totempart@240,144` is
  behind `wandlock@240,96` (group 1, `button@176,176` — only `pushableblockfire@112,144` can hold it), and the block is
  behind `cover@112,128` (group 0, `button@248,232` — only the crusher can hold it; `r5Totem.L41_PART3`). No set of crusher
  parks opens the aim by itself.
- **Is the pessimistic escape reading too pessimistic?** Not here: it finds R5's own three chains, W (256,80)→(64,80),
  S →(64,240), E →(256,240).
- **A working ordering on p4g?** Witnessed (below), after two more walls the refusal had hidden:
  1. **The player was already dead.** The run the search was asked on had `playerDeaths = [{t:147, source:'crusher', hits:
     1000, respawn:(24,168)}]`: the frontier's `break` of `breakablerock@224,80` swings from tile (13,5), inside the west lane
     the two rocks shield (every swing stance is in it), and the crusher charged the moment the rocks went. The solve went on
     from the respawn.
  2. **A dash breaks the shield too.** With the bait taking the rocks (below), the walk to chain 1's stance planned sword
     dashes, whose swing broke the rocks mid-walk: the crusher was charging at t127, before the bait.

### The change (all behind the key; OFF is byte-identical)

- `crusherBait.searchBaitOrdering`: a **PRESS goal** — when no ordering reaches the aim, the shortest one (BFS order) whose
  parks newly hold down a presser of a group that is shut now, with the round trip kept (`pressGoalFor`; result fields
  `goal: 'press'`, `holds`). The aim goal still wins wherever it exists.
- `crusherBait.crusherShieldOf`: a standing `breakablerock` inside a resting crusher's detection lane (`detectionRects`,
  transcribed) is its SHIELD. `solverBot.refineStrategy` resolves such a rock as **`bait`** (not `break`), and
  `resolveBaitStrategy` searches with the shield hypothetically gone (`resolved.shield`, an optional field).
- `solverBot.execBait`, chain 1 with a shield: the swing (face the nearest shield rock, press, idle until every shield rock
  is gone) is RECORDED on a fork and driven as the head of chain 1's `approach`, so `runBait`'s two checks hold — the
  crusher rests when the approach begins and charges when it ends. The walk to that stance is **undashed** (the frontier's
  stance walk, `undashed: true` only for a shielded bait).
- `BAIT_CHOREOGRAPHIES_L41`: R5's three L41 chains (`L41_PART3.baits`, recorded on the game as `r5-l41-part3`), held field
  for field to their source by the test; `choreographyFor` reads them only while the key is ON.
- `entityBlocks.FAMILY_BLOCKS` (+ the surface doc's table): `crusherBait` now reads `openActivators` and `brokenRocks`;
  the solver surface census re-written (`--write`, then `--check` GREEN 345).

**What the solver plans ON (step 94's staging and the leg's request alike):** undashed walk to (216,88) → the swing (rocks
gone t8 after a face + press) → chain 1 W (the escape R5 searched survives from there; on the model, from any 0–14 idle
ticks) → walk + align + chain 2 S → walk + align + chain 3 E: the crusher on `button@248,232`, `cover@112,128` open, 0
contacts, 0 hits, bait done at t1257. **Then the room refuses at the wandlock**: `weigh` rejects the fire block (*"it is a
`fire` pushable — it moves on a PRESS, not on a lean, and `runShove` is the lean"*), the frontier falls back to `hold` on
`button@176,176`, and the walk to the part stalls against the Lock that re-closes when the player steps off. **That is
FIREPUSH's region** (the `shove` for a `pushableblockfire`) and, for the hold, WANDHOLD's: handed over, not touched.

### The game witness (PASS) — `crusherpress-l41-bait`, p4g, headless logic-only, `probe-seedling-crusher-press.mjs --record`

The solver's plan with the key ON (`fidelityCrusherPress.crusherPressTape`: `fidelityRope.ropeStaging` re-pointed at the
L41 arrival (16,160) with sword, shield, fire, torch, swim), cut at t1257 where the frontier turns to the wandlock, then a
DISCRIMINATOR walk into the crusher's vacated constructor cell (15,5) — a Solid on any game whose crusher stayed home (the
crusher's position is in no game readout: a `Crusher` is an `Activators`, not a `Mobile`) — and a 60-tick tail.
**1,575 sampled ticks at 0 px (player x, y, level, hits), the game's player never hit**; the model ends with the crusher at
(256,240), parked, 0 contacts, the cover open. Recorded in `fixtures/crusherpress-witness/`. The test checks that the
recording replays at 0 px, that the solver still plans the recorded tape, and that the stream DISCRIMINATES: the same tape
without the swing's press leaves the model > 8 px from the game's last sample.

### Mutants (predicted first; copy + edit + run + restore — `evidence/mutants.txt`)

| mutant | predicted | measured |
|---|---|---|
| a1 the press goal never fires | 3 red | **4 red** — the 3 + the library-rows row (it takes its chains from the press search: a cascade I did not predict) |
| a2 the shield arm of `refineStrategy` dropped | 2 red | 2 red, as predicted |
| a3 the stance walk's `undashed` dropped | 2 red | 2 red, as predicted |
| a4 `choreographyFor` never reads the L41 rows | 3 red | 3 red, as predicted |

## D-B — L67's work units (PASS behind `forcedHitWitnessFirst`, OFF) — `039fe2d8`

### W0: where the work goes (`w0-measurements.txt`)

Each pass `solveFromTape`'d with a counting `shouldStop` that never trips: **dashless 5,348 units (7.5 s), 5,328 of them at
`crusher-fork`; full 4,027, 3,996 there — and both REFUSE**: *"the combat ladder is EXHAUSTED … arrowLane:arrowtrap@48,48
(an ARMED trap's lane) …"*. Every `crusher-fork` ask is ONE caller: `replayOntoFork`'s stop (every 32 replayed ticks) inside
`forcedHit.proveForcedHit`, rung 6 of `climbLadderUnder`, asked from (182.4,119.9), 135 px from the danger — the whole
depth-2 level (36 + 1,296 forks of a 134-tick replay), then *"depth 3 needs 46656 fork(s) … a search that gave up is not a
proof"*. Budgeted (640, held retry 2,560): the dashless pass spends it all at `crusher-fork`, the full pass gets 1 unit and
trips at `walk`. **So the honest fix is not a budget**: the room's answer is a refusal, and the work hid it.
(`SEEDLING_ARROW_LANE_CROSSING=1`, not this slice's key, still refuses: the crossing's fork drive stalls at waypoint 5.)

### The change

`forcedHit.hitlessWitness`, asked before the breadth-first tree: the alphabet's pure-movement sets (the nine direction sets
with no press), each held for `depthMax` ticks on a fork. The proof holds only when no hitless prefix of length `depthMax`
survives, and a hit prefix stays hit — so one hitless witness decides `proven: false` exactly as the tree would (a hitless
input that leaves the room is the tree's crossing verdict). A witness that is hit, dies, or is refused by the model says
nothing; the tree then runs as before (its node count includes the witness forks). Deadlines are unchanged; `shouldStop`,
the worker budget and `solveSegment` are not touched.

**Measured on leg 908's request (`replay-seedling-solve-request.mjs`):** OFF 642 / 2,562 units, ending on the deadline at
`crusher-fork`/`walk`; **ON 58 units (dashless 24, full 34), both requests, ending on the room's own refusal**. The
unbudgeted dashless pass: 5,348 → 24 units, 8.5 s → 0.2 s.

### Mutants

| mutant | predicted | measured |
|---|---|---|
| b1 the witness never returns a verdict | 3 red | **2 red** — the row "proven exactly as OFF" stays green: the witness forks are still counted (OFF + 9), so that row cannot see this mutant. My prediction was wrong |
| b2 the witness ignores hits | 2 red | 2 red, as predicted |

## The movers (both keys ON) — before → after, and the dispatches to confirm

**Route survey, full (local, `survey-seedling-route.mjs --through=end --route=full`, odd/even step shards, both env keys
`=0` vs `=1`; `evidence/survey-full-{off,on}.txt`):** 239 rows, **SOLVED 186 / REFUSED 53 in both — 0 verdict movers, 0 tick
movers**; 6 refusal-text movers, compared by (level, goals, boot):

| step | room | OFF → ON |
|---|---|---|
| 94 | L41 Totem Part 240,144 | the bait's *"ordering search found nothing … (the round trip)"* → the walk to the part stalls at `wandlock@240,96` (after the shield swing and the three chains) |
| 116 | L88 → L12 | forced-hit clause: *"depth 2 needs 1296 fork(s) … a search that gave up"* → *"the hitless input [· · ·] survives 3 tick(s) … (the witness, 1 fork(s), before the tree)"*; the rest of the text identical |
| 140 | L67 Boss Key 4 | the same clause (1,332 → 1 fork step) |
| 176 | L75 → L74 | the same clause |
| 221 | L103 → L104 | the same clause |
| 227 | L107 → L108 | the same clause |

**Keyed sweep (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g
--page-legs=1`; arm A = the 54 defaults, `evidence/sweep-arm-A.txt`; arm B = A + both keys, `sweep-arm-B.txt`; the page
read both arms back on its `CONTACT:` line):** the 10 crusher-room + L67 legs (`leg-keys-crusher-l67.txt`) ×2 per arm, and the
13 other legs whose re-sweep answer touched the forced-hit rung (`leg-keys-all.txt` minus those) ×1 per arm —
**0 end movers** (`sweep-summary.txt`, `sweep-*.jsonl`):

| leg | A1 / A2 | B1 / B2 | what moves |
|---|---|---|---|
| 406, 407, 408, 591, 783, 786 | done | done | nothing |
| 784 (L107 → L108) | failed | failed | nothing (its refusal names the crusher's lane; no forced-hit clause) |
| 785 (L107 → L102) | failed | failed | nothing — **still the work-unit deadline, at `walk`**: a different cost from 908's (residue) |
| **871** (L41 part) | failed | failed | the bait refusal → the wandlock walk refusal |
| **908** (L67 key) | failed | failed | *"ran out of 640, then 2560 work units on its held retry"* → the room's arrow-lane refusal (no held retry) |
| **76** (L6 → L5) | failed ×1 | failed ×1 | *"ran out of 640, then 2560 work units on its held retry"* → the room's sandtrap refusal — the same shape as 908, found by the sweep |
| 85, 551, 552, 554, 555, 571, 572, 573, 575, 703, 717, 718 | failed ×1 | failed ×1 | the forced-hit clause only |

**Probes standard, ON (local; the scratch worktree with both literals flipped, served on 9728, every probe `--host=` it):
11/11 ALL CHECKS PASSED, 0 FAIL** (`evidence/probe-battery-standard-on.txt`): logical-links B,R (25), vanilla-map (23),
**arrival-composites (95)**, midroom-replan D (10), restart-route W,J (18), restart-warp W,J (28), adopt (51), obstacle-events
W,J (22), generated-playback (35), loop-restart (30), seal-delivery A (6). (A first attempt pointed at port 8000 measured
nothing — every probe refused the connection; it is not counted.)

**Bounded vitest, ON (the same worktree, 90 files):** 2,355 tests, **12 red = what a flip owes** (`evidence/rows-on.txt`):
1. `contactFidelity.test.js > the shipped defaults` — the defaults table.
2. `fidelityCrusherPress.test.js > the switch ships OFF`, `fidelityForcedHitWitness.test.js > the switch ships OFF` — their own pins.
3. `fidelityForcedHitWitness.test.js > OFF: … the whole depth-2 tree` and `> … proven exactly as OFF` — they stage OFF by the default.
4. `fidelityForcedHit.test.js` ×5 — **proof-accounting pins only**: `nodes` 1,332 → 1,341 and 36 → 45 (the nine witness
   forks), and the depth-1 row ends on the witness's verdict (no `open`). **Leg 622's plan is unchanged ON**: SOLVED in the
   same 4 ticks by `forced-hit`, the same lavarunner hit billed — only its `proof.nodes` reads 1,341.
5. `entityBlocks.test.js` ×2 — **fixed since** (`efb0be4a`; it was red AFTER too, so it is not a flip debt).
No committed tape, no producer `--check`, no identity row moves ON or OFF (the producers never read either key; the identity
block at head: `evidence/identity-after.txt`).

**Please run, on this branch** (arm A = `formatContactFidelity(CONTACT_FIDELITY_DEFAULTS)` at the head = the 54 keys of
`evidence/sweep-arm-A.txt`; arm B = A + `crusherBaitPressGoal,forcedHitWitnessFirst` = `sweep-arm-B.txt`):
1. **Survey full**: `seedling-survey.yml through=end route=full`, `contact_fidelity=` arm A and arm B. Compare by (level,
   goal, boot) against each other and against **39496129402**. Expected: the 6 text movers above, 0 verdict movers.
2. **Keyed sweep ×2**: `seedling-divergence-sweep.yml keys=<the 23 keys of evidence/leg-keys-all.txt, '|'-joined>
   capture_requests=true`, arm A and arm B, each twice. Expected: as the table above.
3. **Probes**: `seedling-probe.yml battery=standard` takes no `contact_fidelity`, so key ON needs a scratch branch with both
   literals flipped; and `probes=probe-seedling-crusher-press.mjs` on this branch (it plans with the key ON itself).

## What the JS arc must wire, and what moved for it

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched. New
  OPTIONAL fields: on a `bait` resolution, `goal`/`holds` (a press goal) and `shield` — present only while
  `crusherBaitPressGoal` is ON; on a proof row, `witness: true`/`hitless` when the witness decided it.
- **No JS-arc pin moves OFF.** ON, `jsRuntimeForcedHit`/`seedlingWasmPlayback` were not in my bounded set; they read
  `forcedHits` rows — the `proof.nodes` count is the field a pin could see (+9).
- **Nothing for the walker** (`botDriverV2.drive`/`chooseHeld` unchanged): no `producer:walker` row can move.
- The sweep's `contact_fidelity=` input reaches both keys generically (the page's `seedlingContact<Key>` settings).

## Handed over

- **FIREPUSH** (the `shove` for a `pushableblockfire`): L41 with `crusherBaitPressGoal` ON reaches the room's block with the
  cover open (`button@248,232` held by the parked crusher), and `weigh` refuses `pushableblockfire@112,144` as a lean. R5's
  six pushes are `r5Totem.L41_PART3.pushes` (the first from the cover's cell (7,8)); the part's chamber then needs
  `button@176,176` held for the Lock's 101 ticks (`L41_PART3.lockTicks`). Until that lands, the frontier's fallback `hold`
  walks off its button (WANDHOLD's hold region).
- **Nothing for the hammer arc**; nothing touches the escape, `stateDigest` or `planWaypoints`, and no per-visit run map
  was added (`fidelityCrusherPress`'s maps are per call).

## What the brief got wrong (measured)

- *"the searched space is exhausted … the round trip"* read as "the round trip is the wall": it is not; the round trip is
  kept, the aim is one mechanism short, and the player had died before the search was asked.
- *"the solver ran out of 640, then 2560 work units"* read as a cost to cut: the room refuses with infinite budget; the
  work was a proof that could only give up. Leg 76 (L6) is the same shape and was not in the brief.
- `apReportBosses` in the bounded list names a module, not a test file (I ran the four files that import it).
- The probes of `battery=standard` take `--host=`, not `SEEDLING_PORT`.

## Residue

- L41 past the bait: FIREPUSH's (above).
- Leg 785 (L107 from L108): the work-unit deadline at `walk`, not at the forced-hit proof — a different cost, not measured
  here (the next profile is the same recipe: a counting `shouldStop` on its captured request).
- The bare `break` that walks into a crusher's charge (key OFF): the solve continues from the respawn without refusing on
  the death. Under the key the shielded case is resolved as a bait; a death mid-plan in general is not refused by name.
- The witness only disproves; the 13 forced-hit legs still refuse on their own rooms (arrow lanes, sandtraps, spinners,
  beam towers, crusher lanes).

## Byte-inertia

Both keys OFF: `searchBaitOrdering`, `choreographyFor`, `refineStrategy`, `resolveBaitStrategy`, `execBait`, the stance
walk and `proveForcedHit` run exactly the BEFORE code (each new arm is `CONTACT_FIDELITY.<key> &&`-guarded; the only
unconditional edits are a `const liveOpts` hoisted out of one call and the refusal's `target`, which equals `obstacle.id`
when there is no shield). Evidence: the OFF survey arm, sweep arm A, tapeRunner pairs **635 `88fc7df4…` AFTER and ON**,
the identity block at head, and the bounded vitest AFTER.

## Rows to BANK

- Identity at head (`efb0be4a` code) = W0 on every md5 row, six `--check`s exit 0 (`evidence/identity-after.txt`); the
  reference back to the base's 4 box-artifact differences after the docs index was regenerated (`bdc706bb`).
- tapeRunner pairs 635 `88fc7df4dd05d11dfd84ebbea675cc8e` (W0 = AFTER = ON); roster 289; surface GREEN 345 (re-written);
  constants PASS 6,908; entities 566; profile 138.
- Bounded vitest AFTER: 90 files, **2,361 tests, 0 red** (`evidence/rows-after.txt`; the first AFTER run found the two
  `entityBlocks` rows, fixed in `efb0be4a`).
- Game witness `crusherpress-l41-bait` (p4g, 1,575 ticks, 0 px, never hit); instrument `probe-seedling-crusher-press.mjs`
  (box lock; `boxLock.test.js` roster row added); tests `fidelityCrusherPress.test.js`, `fidelityForcedHitWitness.test.js`.
- **CI `JavaScript Unit Tests` at `bdc706bb` (run 40055398244): success — vitest 22,441 passed, 0 failed; slow 267 passed.**
  (At `2f36f246`, run 40045973330, the only reds were the two `entityBlocks` rows that `efb0be4a` fixes; the report commit
  after `bdc706bb` changes this file only.)
