# Seedling fidelity CROSSROOM: cross-room ButtonRoom writes, both directions

| | |
|---|---|
| Session | `seedling-fidelity-crossroom` (wave 12, model coverage; planner `seedling-fidelity-planning-6`) |
| Start SHA | `dd6ae2e3797b6ee0a6372318d9cae5116515f25e` (= the brief's base) |
| Harness branch | `claude/seedling-crossroom-button-writes-vcrtls` |
| Code head | `0e169fc` (CI JSUT run 38155884167: **success**, unfiltered 19,722 passed / 0 failed, slow battery 253 / 0) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (survey; leg 368 needs the JS arc's wiring) · D4 PASS** |
| Flags | **none.** Nothing committed moves: the identity block, the six producers, tapeRunner and every tape are unchanged, and the bounded set is green. |

## The one thing to know first

**Step 76 never reached the solver.** The survey's goal mapper (`survey-seedling-route.mjs`, the
`goals = step.goals.map(…)` before `twoPassSolve`) turned every goal that was not `reach-exit`, `reach-pit` or
`encounter` into `collect-placement`. So the `clear-tag` goal refused on its own shape (*"collect-placement needs
placement {x, y}"*), not with `'wrong-level'` as the brief expected. With the goal passed through as it is, and a
cross-room presser arm in `execClearTag`, step 76 SOLVES in 480 t. The other direction was a banking bug: a write
into a level that nothing reads is now reported, not banked. That makes step 59 SOLVED (371 t) and sweep leg 366
done.

## W0 (before any edit; the BEFORE numbers come from a pristine worktree at `dd6ae2e`)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9631 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` (server rooted there) | maze `57e07d21…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `afdc6d1a…` (= the bank), guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `006b0639…`/`7d4cb820…`/`49e23d85…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`, generated set OK; reference "4 DIFFER" (this container's uninitialised substrate submodules, the same at base and head). File md5 `946ef8e63d7cf239ea5601dda5a6c58e`. Log: `…-evidence/w0-identity-dd6ae2e.txt` |
| six producers | the block's loop | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` (r9-campaign = the bank), **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, rows `(fullName, status)` sorted, `name\tstatus\n` joined, md5 | **605**, md5 **`c439305baee8f78f5ce5f54fe6b5239d`**, 0 non-pass |
| surface / constants | the two `--check`s, in the base worktree | GREEN 265 rows / PASS 5,623 literals |
| entities / profile | not run: both drive a browser and read nothing this slice moves (no AS3, wasm or game-model change: one ledger branch, one solver arm, one survey mapper) | — |
| roster | `fixtures/tapes/index.json` | unchanged (no tape added; the witness is an embedded oracle, not a roster tape) |
| bounded vitest BEFORE | **55 files**: the brief's list (36 files, incl. `contactFidelityHook`, `fidelityDarkTrap2`, `boxLockCommit`), the two census tests, `fidelityWand`, `surveyRoute`, plus every `grep -a` hit for what I touch (`execClearTag`, `clear-tag`, `roomWrites`, `pendingEarnedClears`, `applyEarnedClears`, `bankedClears`, `clearedForBuild`, `LEDGER_KIND_NAMES`, `roomwrite`, `crossRoomWrites`, `assertGoal`, `clearTagGoal`, `survey-seedling-route`, `buttonroom@144,288`, `buttonroom@32,48`, the orphan text): + `seedlingVanillaArmMap director fallRock fidelityClearTag fidelityF6 fidelityF7 fidelityProximity hammerFightFallback levelRun levelWorld r5Totem solverEncounter seedlingPlaythroughObstacleEvents surveyFamily surveyShards` | **55 files / 2,063 tests, all green** |

## D1: the measurement (PASS)

**On the game** (p4f, headless logic-only, `probe-seedling-cross-room-button.mjs --host=http://localhost:9630 --only=38`, ALL CHECKS PASSED; `…-evidence/d1-cross-room-button-probe.txt`):

| button | game's `persistence_cleared` after the press | target on the vanilla map |
|---|---|---|
| L38 `buttonroom@144,288` {room 37, tset 4, flip 1, tag 5} | `{37,4}`, `{38,5}` | `fallrock@288,32` (arm: built FALLEN with the flag) |
| L38 `buttonroom@32,48` {room 39, tset 8, flip 1, tag 4} | `{39,8}`, `{38,4}` | `wandlock@144,592` (gone with the flag) |

**Who reads tag 4 in L37** (`tagOf` over the level record): vanilla `['fallrock@288,32']`; delivered
(`patchedMapDocument`, the `l37-fallrock-removed` patch) **`[]`**. L39's tag 8 is `['wandlock@144,592']` on both.

**The four rows at the base** (local; `…-evidence/survey-rows-base-vs-head.json`, `sweep-legs-local.json`):

| row | base `dd6ae2e` (local) | what it is |
|---|---|---|
| survey 59 (L38@144,288 → `teleporter@144,304`) | REFUSED *"level 37: the tape clears tag(s) 4, which no entity in this level reads"* | the arrival presses `@144,288`, the run banks `{37,4}`, and L37's build refuses the orphan |
| survey 76 (`clear-tag {39,8}` + reach-exit) | REFUSED *"goals[0]: collect-placement needs placement {x, y}"* | **the survey's mapper**, not the executor |
| leg 366 (`level_38__r0c9 <- in_L37_288_0 -> exit:out_teleporter_144_304`) | `failed`: the solver declined, same orphan text | the same root |
| leg 368 (`… -> location:L39 flag 8: wandlock@144,592 cleared`) | `unresolved`: the page's `EVENT_GOAL_REFUSAL` (*"which the solver does not execute yet"*) | never reaches the solver |

The CI survey 38107331670 ran at `6c1e426a89`, before the L37 patch. There step 59's text was the fallrock **arm**
refusal (*"…"fallrock" at (288,32) — response "arm"…"*). The orphan text appears only at the base, after the patch,
as the brief says.

## D2: the ledger (PASS), `5482388`

`levelRun.js`, all inside the earned-clear path:

- **The `roomwrite` arm.** A cross-level `false` write (`w.level !== null`) into a level whose RECORD has no entity
  carrying the tag (`levelCarriesTag`) is pushed to `unreadRoomWrites` as `{level, tag, by, from, t, staged: false}`,
  and its `roomWrites` row is marked `unread: true`. It is **not** banked into `pendingEarnedClears` and not cashed.
  `earnedClears` keeps the row, because the game's readout holds it (D1).
- **`clearedForBuild`.** A STAGED clear with no carrier whose writer is a map-placed `flip = 1` `buttonroom` with
  exactly that `room`/`tset` (`crossRoomWritersOnto`, a lazy index over the levels) is filtered out of the build and
  reported with `staged: true`. This covers the live table a later solve declares after the press. A clear with no
  such writer still hits the build's throw.
- **`LEDGER_KIND_NAMES` 34 → 35** (`unreadRoomWrites`, query = getter). It is witnessed by a delivered-set staging row
  in `levelRun.test.js`'s fold block.
- A level with a carrier keeps the old path byte for byte. Every vanilla target has one (L37's fallrock, L39's
  wandlock, L63's and L62's lightpoles), so no committed tape can see the change.

**Witness/mutants** (`fidelityCrossRoom.test.js`, predicted in its docblock, copy + edit + run + restore, tree
`cmp`-identical after):

| mutant | predicted | measured |
|---|---|---|
| m1 `unreadWrite` always false | the delivered press row reds | ✓ that row only |
| m2 `clearedForBuild`'s filter removed | the STAGED row reds | ✓ |
| m3 provenance answers every slot | the "no writer is still an error" row reds | ✓ + the STAGED row (its `by` names the writer); docblock amended |

## D3: the cross-room presser (PASS on the survey), `b6308dd`

- **`solverBot.execClearTag`.** When `goal.presser.level === run.level` and the flag is in another level, the new
  `execCrossRoomPress` arm runs:
  - It checks that the presser is a live presser of this level and that it writes exactly this clear
    (`room`/`t`/`flip`). Otherwise it refuses with `reason: 'cross-room-presser'`; `obstacle.kind` stays
    `'clear-tag'`.
  - A boot-pressed presser is met (`arm: 'boot-pressed'`).
  - It resolves the registered verb (`proximity-hazard:buttonroom` → `hold`).
  - When the resolver finds no reachable stance, it walks to the presser's centre with `walkTo`. That is the same
    frontier loop a `reach-exit` gets, with the presser added to the segment's live `exemptions`. Then it resolves
    again or finishes on the press.
  - It finishes on `earnedClears` / `clearTagLanded` like every clear-tag. The arm is `cross-room-press`.
  - `assertGoal` admits the optional `presser {level, class, x, y}`.
  - Without a presser, the old `wrong-level` refusal is unchanged.
- **The survey.** `clear-tag` goals are passed through as they are, and `clearTagGoal` adds `presser` from the rules
  location (`presserOfEvent`, by `event_id`). Step 76 is the only `clear-tag` step of `--through=end --route=full`.
- **Measured:** step 76 SOLVED 480 t, 1 pass, 0 hits. The frontier ran `hold buttonroom@144,128`, then `pulse` (via
  `button@80,192`), then `chest`, then the walk onto `buttonroom@32,48`, then reach-exit `teleporter@144,0`. The
  replay ends in L39 with earned `{37,4} {38,5} {38,0} {38,3} {39,8} {38,4}`.

| mutant | predicted | measured |
|---|---|---|
| m4 the cross-room branch removed | the SOLVES row reds (`wrong-level`) | ✓ + the wrong-presser row (answered `wrong-level` first); docblock amended |
| m5 the first cut's `contactsOverride` snapshot | SOLVES reds: `hold` refuses "ALREADY OPEN" on `buttonroom@144,128` | ✓ |

## D4: witnesses and census (PASS), `34799cd`

**Game witnesses at 0 px.** I ran `SEEDLING_PORT=9630 node scripts/procgen/probe-seedling-cleartag.mjs --set=crossroom --record=…` (new `--set`,
witnesses in `fidelityCrossRoom.js`, embedded as `fixtures/crossroom-oracle.json`; `…-evidence/d4-cleartag-crossroom-probe.txt`).

| arm | ticks | game vs model | flag on the game |
|---|---|---|---|
| `L37-4-from-L38-solve` | 12 | **0 px**, 13 obs, transitions equal | `{37,4}` held |
| `L37-4-from-L38-cut-1` / `cut-2` | 1 / 2 | 0 px | held / held ⚠ (the model: not yet / held) |
| `L39-8-from-L38-solve` | 422 | **0 px**, 423 obs, transitions equal | `{39,8}` held |
| `L39-8-from-L38-cut-411` / `cut-412` | 411 / 412 | 0 px | not yet / held (= the model's T + 1) |

There is one probe FAIL, and it is a real finding, pinned by name in the test rather than fixed (residue 1). Booted
ON `buttonroom@144,288`, the game's arrival-frame update presses it, so `{37,4}` is held after **one** tick. The
model's activators first step a tick later (row t1, flag after two). The streams are 0 px either way. L38 is the same
room on both maps, and neither solve enters L37, so the vanilla p4f page is a valid witness.

**The D2 walk into L37 on the delivered set** has game evidence only from the production page: the local sweep at the
head, leg 366 `done`, `divergence: null`, end (37, 296, 24) equal to the game's. The bare p4f page builds the vanilla
L37, which has the fallen fallrock.

**Census: the rows this slice moves (by step/leg, local).** Base is `dd6ae2e`; head is this branch.

| row | CI 38107331670 | base (local) | head (local) |
|---|---|---|---|
| survey 58 (L37) | SOLVED | SOLVED 316 | SOLVED 316 |
| **survey 59 (L38)** | REFUSED (arm text, pre-patch) | REFUSED (orphan) | **SOLVED 371** |
| survey 60 (L37) | SOLVED | SOLVED 332 | SOLVED 332 |
| survey 75 (L37) | SOLVED | SOLVED 314 | SOLVED 314 |
| **survey 76 (L38)** | REFUSED (goal shape) | REFUSED (goal shape) | **SOLVED 480** |
| survey 77 / 123 / 138 (L39) | REFUSED `rope@96,384` | same | same; they boot with `{39,8}` STAGED by the survey's route credits (`stagedFlags`), a contract I did not change |
| **leg 366** | (sweep-4: refused) | failed (orphan) | **done**, 4 t, no divergence |
| leg 358 (L37 ← L38's door) | — | — | done (control) |
| leg 368 | unserved rank 1 (26 blocks) | unresolved (page refusal) | unresolved until the JS arc wires the goal (below) |

**CI dispatches for the planner** (branch `claude/seedling-crossroom-button-writes-vcrtls`):

1. `seedling-survey.yml`: `through=end`, `route=full`, `only=58,59,60,75,76,77,123,138`, `base_run=38107331670`.
   Expected: 59 and 76 SOLVED, and the rest as in the table.
2. `seedling-divergence-sweep.yml`: `mode=inv`, `producer=solver`, `page_legs=1`, `ids=358,366,368`, or by key:
   `keys=level_38__r0c9 <- in_L37_288_0 -> exit:out_teleporter_144_304|level_38__r0c9 <- in_L37_288_0 -> location:L39 flag 8: wandlock@144,592 cleared`.
   `contact_fidelity` stays empty. Expected: 366 done; 368 unresolved until the JS arc's wiring lands.
3. `seedling-probe.yml`: `probes=probe-seedling-cleartag.mjs`, `args=--set=crossroom`. Expected: 23 PASS, 1 FAIL
   (`L37-4-from-L38-cut-1`, residue 1). Then `probes=probe-seedling-cross-room-button.mjs`, `args=--only=38`.
   Expected: ALL CHECKS PASSED.

## For the JS arc: what to wire, and what moved

- **No signature or contract moved.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and
  `createRunForStaging` are untouched, and no staging field was added.
- **New OPTIONAL goal field:** `clear-tag`'s `presser: {level, class, x, y}`, the rules event's `action.presser`.
- **New refusal reason:** `obstacle.reason: 'cross-room-presser'`, under the existing `obstacle.kind: 'clear-tag'`.
- **New ledger kind:** `run.ledger('unreadRoomWrites')`, with rows `{level, tag, by, from, t, staged}`. The
  `roomWrites` row gains `unread: true` only for such a write.
- **To serve leg 368:** map the event location to
  `{kind: 'clear-tag', tag: {level, tag}, at: {x: obstacle.x, y: obstacle.y}, obstacle: '<class>@x,y', presser: action.presser}`
  wherever `EVENT_GOAL_REFUSAL` answers today (`seedlingPlaybackController.resolveSeedlingAtlasGoal` →
  `jsRuntimeSolver.solverGoalFor`). `runtimeEventsOf` already carries `action`. The refusal's text, *"which the
  solver does not execute yet"*, is stale for every event now that the executor exists. Rewording it is the JS arc's
  job (its pins: `seedlingVanillaArmMap.test.js`).
- **Nothing to wire for D2.** A worker solve whose declared live table holds `{37,4}` (after the arrival press) now
  builds L37 and reports the write as `staged`.

## Handed to the hammer arc

Nothing. No owned function was touched.

## Deltas (`dd6ae2e..0e169fc`, plus docs `3f4bc85` and this report)

- `levelRun.js`: the unread-write ledger (D2).
- `solverBot.js`: `execCrossRoomPress` and the `assertGoal` field (D3).
- `survey-seedling-route.mjs`: the mapper passes `clear-tag` through, plus `presserOfEvent` (D3).
- `fidelityCrossRoom.js` and `.test.js` (new), `fixtures/crossroom-oracle.json` (new).
- `fidelityClearTag.js`: `clearTagArms(…, witnesses)` (default unchanged); `clearTagSolve`'s record is the one with
  `arm`. The four existing witnesses' records are byte-identical (diffed).
- `probe-seedling-cleartag.mjs`: `--set=cleartag|crossroom`.
- `levelRun.test.js`: ledger count 35 and the witness row.
- Census `--write`: surface 265 rows (the count is unchanged; the folded ledger list and the `run:*`/`world:pressers` site counts moved); constants 5,623 → 5,632 literals. Generated: `instruments.js`, `docsIndex.js`,
  the README index region, architecture's counts.
- Docs: `seedling-bot-log.md` entry, `seedling-bot.md` line.

## What the brief got wrong (measured)

1. *"`solverBot.execClearTag` refuses `'wrong-level'`"* for step 76. The executor was never reached: the survey's
   mapper rewrote the goal into a malformed `collect-placement`. A direct `solveSegment` call does refuse
   `wrong-level` (pinned).
2. *"This unblocks L39 steps 77/123/138's staging honestly (they currently boot with it staged)."* They do boot with
   `{39,8}` staged (`stagedFlags`), but all three refuse on `rope@96,384` (VERB-MISSING), before and after. A real
   `{39,8}` does not move them, and the survey stages by route credit, not by a previous step's ledger. That is a
   contract I left as it is.
3. Survey CI 38107331670's step-59 refusal is the fallrock ARM text, because it ran before the L37 patch. The orphan
   text is only at the base. (The brief's own caveat covers it, but it reads as if CI showed the orphan.)
4. Leg ids 366 and 368 matched sweep-4's in my re-derived list (843 legs).

## Residue

1. **The boot press is one update early in the game** (`{37,4}` held after 1 tick, model t1). It is
   `activators.bootPress`'s arrival-frame offset, here for a press by the player standing on a button at boot. That
   docblock says "a press by the player cannot tell", and this one can. A `room == -1` button booted on would start
   its group's fade one update early in the game. No committed tape boots on one, as far as I checked, but that was
   not swept. It is an activators fix with its own movers, so I did not take it.
2. Leg 368 needs the JS arc's goal mapping (above).
3. Steps 77/123/138: `rope@96,384` has no strategy row (VERB-MISSING). That is not this region.
4. There is no embedded game witness of the walk INTO the delivered L37, because the bare p4f page is vanilla. The
   production-page sweep row is the evidence.
5. `check-procgen-help.mjs` shows 26 FAILs and `generate-procgen-reference --check` shows 4 DIFFER, identically at the
   base. They are this container's (uninitialised substrate submodules), not the slice's.

## Byte-inertia

- **Identity block AFTER** (`…-evidence/after-identity.txt`, at the code head, port 9630): every row is identical to
  W0, including all six producers (exit 0). The reference row read "6 DIFFER" only because my generated files were
  still pending while it ran; regenerated, it is the base's 4.
- **tapeRunner pairs:** 605, `c439305baee8f78f5ce5f54fe6b5239d`, equal to W0.
- **Committed tapes, traces, expectations:** none moved. No flag was needed.
- **Bounded vitest AFTER at `3f4bc85`:** **56 files / 2,081 tests, all green** (2,063 + 17 in `fidelityCrossRoom` + 1
  `levelRun` witness row).
- **CI:** JSUT 38155884167 at `0e169fc` is green (19,722 / 0; slow 253 / 0). The final head's run is named in the
  closing message.

## Rows to BANK

- `LEDGER_KIND_NAMES`: 35 (`unreadRoomWrites`).
- Solver surface: 265 rows (GREEN). Constants census: 5,632 literals (PASS, 0 drift).
- tapeRunner pairs: 605 / `c439305baee8f78f5ce5f54fe6b5239d` (base = head).
- Identity, producers, ENEMY `afdc6d1a`, r9-campaign `712f0ead`: unchanged from the bank.
- Survey (pending CI dispatch 1): 59 SOLVED 371 t, 76 SOLVED 480 t. Sweep (pending dispatch 2): leg 366 done.
- Witness: `fixtures/crossroom-oracle.json` (6 arms, 0 px; one pinned arrival-frame residue).
