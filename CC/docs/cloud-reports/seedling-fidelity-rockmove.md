# Seedling fidelity ROCKMOVE: remove, move or leave the trigger-sealed rocks (cloud report, measure only)

**Slice:** `seedling-fidelity-rockmove`, an Opus measure-only slice in the cloud for the Seedling fidelity arc (planner
`seedling-fidelity-planning-9`). No tracked behaviour changed. Every patch below lives in a scratch map copy, in a
throwaway worktree (since removed) or in `seedling-fidelity-rockmove-evidence/`.

⚖ **The question** (the user, 2026-10-15 and 2026-10-18): should we remove the rocks and other blockers, or move them
one tile off the edge so that they stop blocking the entrance? The user added, mid-slice (2026-10-18): *"For some of the
obstacles, just moving them might leave a gap that the player could get through without the required item. We might
need to add more obstacles to plug these gaps."* That is measured below as a **gap check** on every move, with a plug
search where a gap appears.

| | |
|---|---|
| Start SHA | **`e0561c1c7c`** (= `origin/main` at fetch) |
| Harness branch | **`claude/seedling-fallrock-move-60umr3`**. Every push went here; nothing went to `main` |
| Commits | D1 `b2253b5` · D2 `b85463a` · D3+D4 `58fc5d8` · D3 solver legs `920b67e` · this report (the head) |
| Dev server | `serve-nocache.py 9690` (`SEEDLING_PORT=9690`), p4f headless logic-only, under the box lock |
| Verdicts | **D1 PASS · D2 PASS · D3 PASS · D4 PASS · D5 PASS (recommendation below, nothing applied)** |

## The one thing to know first

**None of the falling rocks is an obstacle event in the rules. The rules price every `fallrock` and `fallrocklarge` as
OPEN** (`AP_1` `provenance.overlay_rows`: `{"tag": "fallrock", "kind": "open", "cite": "Scenery/FallRock.as (parked at
y = -16, type \"\")"}`). Of the rules' 23 events, none names a rock. So wherever a rock really seals a door after its
trigger, the rules are already wrong in the same way L37 was. **Removing the rock makes the game match the rules, and
the rules do not change at all**: a scratch regeneration moves only `provenance.set_patches`.

Two rooms that seal like L37 are **missing from the client's list**:
- **L74**: the L73 arrival lands *on* `button@288,128`, which drops the rock onto the only door back to L73.
- **L29**: the button drops a rock into the one-tile neck between the L22 half and the L31/boss-key half.

The client's L43 rocks, by contrast, are **inert in our AP delivery**. The wand that drops them becomes an `apitem`
there, and on the game no rock falls.

---

## D1: the census (PASS)

**Instrument:** `evidence/census.mjs` (pure node, on the DELIVERED rooms = `patchedMapDocument`). Output:
`census.txt` / `census.json`, ASCII maps `ascii-L29/39/43/74.txt`.

**Classes swept by code:**
- entities that become Solid on a tag or a trigger, from the AS3 `type = "Solid"` assignments (`grep -a` over
  `vendor/seedling/src`);
- the propagators that publish a tset (`Button.activateAll`, `ButtonRoom` with `room == -1`, `RopeStart`, the `Wand`'s
  `doBossActions`, `FinalBoss` t0);
- cross-level writers (`ButtonRoom` with `room = N`).

**What it found:** `fallrock` ×8, `fallrocklarge` ×2, `moonrock`, `moonrockpile`.
- Excluded with reasons: `Lock.returnToNormal` (activation-held locks, CLEARTAG's classes), `Crusher` (always Solid,
  moves), the bridge tile 29 (opens; does not seal).
- **No cross-level writer targets any remaining rock tag.** The only `ButtonRoom` into a rock was L38 → `{37,4}`, which
  is already removed. So no removal hits the L37-style "a clear which no entity in this level reads" on a cross-level
  write. (It does hit the same refusal on a *staged* clear: D2, L43 alcove.)

**Flood method:** a tile flood (the planner's own `plannerObstacleAt`) from every arrival into the level. That is the
door landings plus the sweep's pit arrivals (`sweep-legs-rock-levels.json`). It is run with the rock PARKED (= removed)
and FALLEN (a static `rock` stand-in on its tile).

| level | entity (tset / tag) | writer (trigger) | what it seals when it falls | rules today | survey steps | sweep legs |
|---|---|---|---|---|---|---|
| L74 `Dungeon7/3` | `fallrock@288,144` t0 / tag 2, **on `teleporter@288,144`→L73** | `button@288,128` t0, which is the L73 arrival tile | the L74→L73 door, permanently, from every arrival | `level_74 <-> level_73` **True_** | 150 (L75→L75: never touches it) | 630 631 632 (arrival presses it), 634 (crosses it); 633 635 untouched |
| L39 `Dungeon4/1` | `fallrock@144,624` t6 / tag 10, **on `teleporter@144,624`→L38** | `rope@96,384` t6, the rope that blocks the 1-wide shaft. The sword cuts it; it also publishes to `pulser@64,96` | the L39→L38 door. The rope must be cut to use the shaft, so top→L38 is never possible | `r2c11 → L38` with flag 8; no `r0c9 → r2c11` exit, so the rules already know the shaft is up-only | 77, 107 (L38 → up, the game's direction) | 375 (the L38 landing to its own door: no rope cut); 373 374 untouched |
| L43 `Dungeon4/Boss` | `fallrock@176,384` t0 / tag 3 (the stairs neck) | `wand@144,224` pickup (`Wand.as:58-68`) | `stairsup@176,464`→L40 from the whole room | `level_43__r13c7 → L40` True_ | 113 (exits via the L37 teleporter; consistent) | 419–444 (to the stairs / the wand) |
| L43 | `fallrock@96,336` t0 / tag 2 | the wand | the **left alcove**: the pit arrivals from L40 at (64..80, 320..368). A fall into it after the wand is a trap | `r13c7` (one region) | — | 421 422 429–432 437–444 |
| L43 | `fallrock@192,336` t0 / tag 1 | the wand | the **right alcove**: the pit arrivals at (208..224, 320..336) | `r13c7` | — | 425–428 433–436 |
| L29 `Dungeon3/8` | `fallrock@112,112` t0 / tag 0 (the 1-tile neck (7,7)) | `button@112,128` t0 (the neck tile, 8 px of its 16) | the L22 half from the L31-stairs + boss-key half, **both ways** | `level_29__r2c2` (one region, True_ both ways) | 48 (L22→key→L31; the solver's lane at x≈126 **misses** the button) | 311 312 313 314 315 (310 316 do not cross) |
| L28 `Dungeon3/7` | `fallrock@112,240` t1 / tag 1 | `rope@160,64` t1 | nothing. It lands on its own `button@112,240` (t0, which has no responder); flood −1 tile, 0 doors | (open) | — | 304–309: no door lost |
| L32 `Dungeon3/11` | `fallrocklarge@64,128` bossrock + thirdboss | self (the player above it) | the arena's `stairsdown@72,136`: the BobBoss encounter | `level_32 → L30` True_ / Fire | 51 | 348–351 |
| L82 `Dungeon7/Boss` | `fallrocklarge@128,224` bossrock | self | the arena | Dark Suit gate | 161, 182 | 656 657 |
| L0 / L2 | `moonrock` / `moonrockpile` | `Shield` → beam / `{2,0}` | — | already removed (`moonrock-removed`) | — | — |
| L37 | `fallrock@288,32` tag 4 | L38 `buttonroom@144,288` | — | already removed (`l37-fallrock-removed`); left as is | — | — |

**Every survey step crosses its room in the game's own one-way direction** (`survey-seedling-route --through=end`,
213 steps: 48 L29 up, 77/107 L39 up, 113 L43 out by L37, 150 L74 L75↔L75). No step depends on a seal being open. The
seals matter to AP logic (the rules say "open") and to the off-route sweep legs.

## D2: both options per blocker, on the game (PASS)

**Instrument:** `evidence/witness.mjs`, in the shape of `probe-seedling-l37-fallrock.mjs`.
- Each arm is `vanillaRecordSet(EMBED, <scratch map>)`, i.e. the delivery's own `SEEDLING_SET_PATCHES` plus the arm's
  ops (`remove` / `move` / `add` / `apitem`).
- Each arm runs on a FRESH p4f page (`botLoadLevels` → `botLoadTape` → `botStart` → `botDrain`).
- The model replays the same tape on the arm's mounted records.
- Fixtures: `evidence/witness/<spec>-<arm>.json` (the full drained stream, `botStatus.persistence_cleared`, the model
  row); summaries in `<spec>-summary.json`; specs in `evidence/specs/`.

**All 27 arms: model == game** (same transitions, same final tick and position), except the two by-name refusals noted.

| room | tape | arm | game | |
|---|---|---|---|---|
| **L74** | `l74-round-trip`: boot L73 (64,16), up into L74, then down | vanilla | arrival t7 lands on the button, `{74,2}` written; stuck at y 141 over the door | sealed |
| | | **remove** | back in L73 at **t40** | open both ways |
| | | **remove + button** | back in L73 at t40 | open |
| | | move → (288,128), one tile up: **the only interior neighbour** | the rock **lands on the player** (the game writes y = 125); the door is still sealed. Model: REFUSED by name (*"landed on the player at tick 9 … a snap here is a stance nobody derived"*) | no viable move: the button + door are a 2-tile pocket at the end of a 1-wide corridor, and every corridor tile seals the room instead |
| **L39** | `l39-rope-return`: `r5-shaft` to t226 (the rope cut at ~t185), then down | vanilla | `{39,9}` + `{39,10}` written; stuck at y 621 over the door | sealed |
| | | **remove** | L38 at **t423** | open |
| | | move → (144,608), one tile up = the L38 arrival tile | stuck at y 605 | still seals: the shaft is 1 wide, so no viable move |
| **L43** | `l43-wand-stairs`: wand pickup (all totem parts), dialogue dismissed, walk to the stairs | vanilla `Wand` | all three rocks fall (`{43,1,2,3}`); stuck at y 381 above the neck | stairs sealed |
| | | remove ×3 | L40 at t528 | open |
| | | move ×3 → (128,336) (160,336) (160,368), two tiles in | the rocks still fall (`{43,1,2,3}`); L40 at t520; no rock lands on the player (frozen at the wand, row 14) | open; the fall kept |
| | | **`apitem`** (as `rewriteRecordSet` writes it) | **no rock falls** (only `{43,0}`, the item); L40 at t528 | **the AP delivery: inert** |
| **L43** alcove | `l43-alcove-after-wand`: boot (64,336) = a pit landing, rocks staged fallen, walk east | vanilla | trapped, x ≤ 94 | the pit landing is a trap |
| | | remove ×3 | across the room to x 237 | open. Model: REFUSED by name (*"clears tag(s) 1, 2, 3, which no entity in this level reads"*) |
| | | move ×3 | out of the alcove (x 125.5) | open |
| **L29** | `l29-key-return` (= committed `prox-l29-key-return`, x ≈ 126) | vanilla / remove / move | all three return to L22 at t596, **`{29,0}` never written** | the solver's lane misses the 8-px button |
| | `l29-press`: up the neck centre (x 120) | vanilla | `{29,0}` written; **stuck south of the rock** (y 130) | the rock lands in front |
| | | remove / remove + button / move → (128,112) | past the neck (y 109) | open |
| | `l29-press-north`: down the neck, then back up | vanilla | down passes; the return up stops at y 130 | sealed both ways once pressed |
| | | remove / move → (128,112) | the return reaches y 66 | open |
| **L0 `{0,4}`** (D4) | `l0-4-plug`: open side, no Sword, toward L1's door | vanilla | blocked (98,114) | gated |
| | | move → (80,128) | **reaches L1 at t71 with no Sword** | **the gap the user predicted** |
| | | move + plug `rock@96,112` | blocked (98,130) | gated again |

**Per-row answers:**
- **Does it still fall or appear on its trigger?** Yes, for every move (written tags above). For a remove there is
  nothing to fall.
- **Is the doorway free both ways?** Yes for remove; for move only where noted (L29, L43 two-tile moves).
- **Does a moved rock land on an arrival tile, a stance, a pushable's path or a pit?**
  - L74: yes, the arrival tile (witnessed).
  - L39: yes, the L38 arrival tile.
  - L43: the one-tile moves land on the alcove mouth's only neighbour or the neck's (they still seal, per the census);
    the two-tile moves land on open floor.
  - L29 (128,112): open floor.
- **Does any room become uncompletable, or any check unreachable?** Nothing becomes uncompletable. All four "remove"
  rooms are strictly more open. Their checks (L29 boss key, L39 totem part, L43 wand, L74 darkshield) stay reachable on
  every arm.

## D3: impact (PASS)

**Rules.** Measured by regenerating `AP_1` in a throwaway worktree at `e0561c1c7c` with scratch rows (diffs in
`evidence/rules-remove.diff`, `rules-move.diff`, `scratch-setpatches.diff`):
- REMOVE ×6 (L29, L39, L43 ×3, L74), and MOVE (L29 + L43 ×3) + REMOVE (L39, L74): the only diff is the
  `provenance.set_patches` list.
- No region, exit, event or location logic moves, because the rocks were never events. The rules already say "open".
- The AP_1 md5 moves (`e8ba2736…` → `d3dc36af…` for remove ×6), so `fixtures/campaign-frontier.json` needs a re-pin.

**The model.**
- **The model reads the patched position whenever it is handed the delivered set's records:** every witness arm's
  replay on `levelSourceFromAtlas(mountedRecordsOf(set))`, moves included, matched the game.
- **The brief's expected NO is only half right.** The route survey (`survey-seedling-route.mjs:242`) and the rules
  generator already read `patchedMapDocument`, so new table rows reach them automatically. Only `levelSource.loadAtlas()`
  (the committed tapes) stays on the built-in map. So no committed tape moves.
- `CONTACT_FIDELITY.fallRockPostFall` is ON at this base (`contactFidelity.js:342`). That is why the model builds the
  staged-fallen rocks the game builds.

**⛔ The model gap REMOVE opens: the orphan button.**
- With the rock gone, the button's group has no responder. The solver's ladder then picks `hold` on it and throws a
  plain `Error` (not a `SolverRefusal`): *"button@112,128 presses group t=0, which NO responder in level 29 answers …
  Holding it would open nothing and arm nothing."*
- `evidence/solver-legs.mjs` (live solver, delivered map plus the arm's ops):

| leg | vanilla | remove | **remove + button** | move (128,112) |
|---|---|---|---|---|
| 311 L29 L22 → stairs (up the neck) | SOLVED 325 t | **THREW** (orphan button) | SOLVED 194 t | SOLVED 325 t |
| 313 L29 L31 → L22 (down the neck) | SOLVED 295 t | **THREW** | SOLVED 185 t | SOLVED 295 t |
| 631 L74 L73 arrival → L73 door | THREW (*"a sword press at tick 0 … on a FROZEN tick (a button-dropped fallrock)"*) | SOLVED 4 t | SOLVED 4 t | — |
| 634 L74 L75 → L73 door | REFUSED (skirting the button: lavarunner ladder exhausted) | **THREW** | SOLVED 447 t | — |
| 630 L74 L73 arrival → L75 | REFUSED (lavarunner, pre-existing) | same | same | — |

So **remove the button with the rock** in L29 and L74. The button does nothing else in either room (L29's `t0` and
L74's `t0` have no other responder), and the game witnesses show `remove + button` open in both rooms.

**The route survey, scratch patch ON vs OFF** (`--through=end --only=48,77,107,113,150`; `evidence/survey/`):

| step | OFF | REMOVE (rock only) | MOVE (L29 + L43) + REMOVE (L39, L74) |
|---|---|---|---|
| 48 L29 | SOLVED 379 t | **REFUSED**: the orphan button (`hold: button@112,128 …`) | SOLVED 379 t (identical) |
| 77, 107 L39 | REFUSED `solid:rope` no strategy row (pre-existing) | same | (not re-run; L39 is a remove either way) |
| 113 L43 | REFUSED: the L37 teleporter stands on a pit tile (pre-existing) | same | same |
| 150 L74 | SOLVED 321 t | SOLVED 321 t | (not re-run; L74 is a remove either way) |

`remove + button` was not run through the survey (the worktree was gone by then). Its step-48 segment is the 311 row
above (SOLVED). That survey run is the planner's dispatch below.

**The client's `Dungeon6_Boss` edit** (our **L69**, which the rules list as `never_enter_levels: [69]`):
- **Dropping `tag="0"` from `lightbosscontroller` is a no-op under our loader.** `Game.as:2282` passes `o.@tag`, and a
  missing attribute is `int("") = 0` (stated in-repo at `levelWorld.js:3233`). The controller keeps tag 0 either way:
  `check()` → `endState()` (the exit teleporter) iff `{69,0}` is cleared.
- **`watcher` tag 1 → 0** couples the room's `text=""` Watcher (`Watcher.as:46,64,129-131`) to the boss's flag:
  - its `update` runs only while `{69,0}` holds;
  - its `doneTalking` would write `{69,0}`, which is the controller's "boss done" flag.
  A plausible purpose is to make the boss's completion (or a skip of it) readable or writable through the Watcher. That
  matches an AP location keyed on `{69,0}`, but nothing in our checkout confirms it.
- **What it would take:** a p4f witness in L69 with each variant. Does talking to the Watcher write `{69,0}`? Does
  re-entry then skip the fight? That runs in a level our rules never enter, so it is outside this question.

## D4: CLEARTAG's verdict, re-read (PASS)

**Re-running its tool at this base.** `measure-seedling-cleartag-patch.mjs` **does not run here** (two drifts, both
measured):
- the events added since CLEARTAG (the boss locks, the L39/L62/L63 press events, L114's talk) form groups with no gated
  landing, and `patchCensus` dereferences `g.gated[0]` (TypeError);
- the solver now has a wand executor that throws a plain `Error` on L12 (`assertWandShotSolidsBound`,
  `puncher@416,256`) where the tool rethrows non-`SolverRefusal`s.

A scratch copy (`evidence/cleartag-patch-rerun.mjs`) skips those groups by name and records throws. It adds the user's
gap check: with the flag HELD, the doors every OPEN-side landing reaches, base vs patched. Output:
`cleartag-patch-rerun.txt` / `.json`.

| event | CLEARTAG (`0f952e9a9e`) | at `e0561c1c7c` | gap (open side, flag held) |
|---|---|---|---|
| `{0,1}` | gates; pocket SOLVES 21 t `break` | the same | none |
| `{0,4}` | **loses the gate** | the same: still gates false | **YES: every open-side landing (L2, L12, L13, L86, L94 ×2) reaches L1's door.** Plug search (`plug-l0-4.mjs`): **one static `rock@96,112`** restores the gate (pocket 2 tiles, L1's door only; cleared → 109 tiles, 6 doors), and the pocket still breaks out in 20 t `break`. Game-witnessed (`l0-4-plug`) |
| `{12,7}`+`{12,12}` | REFUSES (`kill` binds nothing; keylock loop) | `{12,7}` now **THREW** (the new wand executor, puncher), `{12,12}` REFUSES `unresolved` | none |
| `{24,0}` | gates; SOLVES 54 t `burn` | the same | none |
| `{71,2}` | REFUSES (the touch stance loops) | REFUSES `STANCE_REENTRY` (the same verdict) | none |
| `{112,1}` | `no-verb` | `no-verb` | none |
| `{113,0}` | `no-verb` | REFUSES `unresolved` (`approach`: "the save holds 0 …"); a `finaldoor` row now exists | none |

**Which of CLEARTAG's reasons carry over to the trigger-sealed rocks:**
1. **"Buys nothing on either on-route event": carries.** Every survey step already crosses its rock room in the game's
   direction (D1). What remove buys is off-route: AP logic that is already "open", and the sweep legs 631, 634 (L74),
   311–315 (L29), the L39 r2c11→L38 return, and L43's pit alcoves (vanilla `Wand` only).
2. **"Loses `{0,4}`'s gate (the rock under its door)": carries in its geometric form.** A rock in a one-wide neck has
   no move that frees the door without sealing the same neck: L74, L39, and L43's one-tile moves (witnessed). For item
   gates the user's gap shows up exactly here, and a one-tile plug repairs `{0,4}`.
3. **"Regresses `{71,2}` (the pocket touch loops)": does not carry.** A fallrock needs no verb. Its analogue is
   REMOVE's orphan-button throw (D3), which removing the button fixes.
4. **"A delivered-set / model-map divergence plus a rules regeneration": half carries.** The regeneration is
   provenance-only here (no event vanishes: there were none). The survey and the rules generator already read the
   patched map, so the divergence is the committed tapes' built-in map alone, and no tape moves.

**CLEARTAG's own verdict stands:** the executor, not the move. `{0,4}`'s move is now repairable with a plug. It still
buys nothing, since the executor already SOLVES `{0,4}` from 5 of 6 open-side arrivals.

## D5: the recommendation (STOP here; the user rules)

| blocker | recommend | the measured reason | costs | owner |
|---|---|---|---|---|
| **L74** `fallrock@288,144` (tag 2) **+ `button@288,128`** | **REMOVE both** | The rock seals the only L74→L73 door, triggered by the L73 arrival tile itself, while the rules say True_. No viable move (the one-tile move lands on the player, witnessed). Removing the rock alone leaves an orphan button the solver throws on (leg 634) | 2 `remove` rows (no new op); rules: provenance only; set id + pins (below) | rules arc: rows + regen + oracle re-records. Fidelity: none needed (model == game on every arm) |
| **L39** `fallrock@144,624` (tag 10) | **REMOVE** | It seals the L39→L38 door on the rope cut that the shaft requires. The rules' `r2c11 → L38` (flag 8) is wrong after the cut. No viable move (1-wide shaft, witnessed). The rope stays: it is the shaft's gate and still drives `pulser@64,96` | 1 `remove` row | rules arc. Fidelity: none (survey 77/107 refuse on the rope's missing strategy row, pre-existing and unchanged) |
| **L29** `fallrock@112,112` (tag 0) **+ `button@112,128`** | **REMOVE both** (alternative: MOVE the rock to (128,112)) | A press from either side severs the L22 half from the L31/boss-key half both ways; the rules have one region. Remove + button: open on the game, and the solver SOLVES 311/313 faster. MOVE (128,112) also opens it on the game and keeps step 48 at 379 t, but it needs a new `move` op (9 lines, scratch-measured) and keeps the ~197-tick freeze on a press. Not in the client's list | 2 `remove` rows (or 1 `move` row + the op) | rules arc |
| **L43** `fallrock@176,384` / `@96,336` / `@192,336` (tags 3/2/1) | **LEAVE** (if the user prefers parity with the client: remove all three; one-tile moves do not work, two-tile moves do) | **Inert in our AP delivery:** the wand becomes an `apitem`, and on the game no rock falls (witnessed). They only fall with a vanilla `Wand` (an unjoined ledger row), where they seal the stairs and turn L40's pit landings into traps | none (or 3 rows; and the model then refuses staged clears of `{43,1..3}` by name) | — |
| L28 `fallrock@112,240` | LEAVE | seals nothing (lands on its own responderless button) | — | — |
| L32 / L82 `fallrocklarge` (boss arenas) | LEAVE | encounter arenas, priced by their encounter rules | — | — |
| L37 rock, the moonrock | LEAVE AS IS | already removed (`l37-fallrock-removed`, `moonrock-removed`) | — | — |
| CLEARTAG's item gates (`{0,1}` … `{113,0}`) | **LEAVE** (the executor) | CLEARTAG's verdict holds at this base. `{0,4}`'s move needs a plug (`rock@96,112`, an `add` op), and the executor already solves it | — | — |

**The shared cost of the recommended bundle** (L74 ×2 + L39 + L29 ×2 = 5 `remove` rows, no new op):
- **The delivered set id moves** from `seedling-vanilla-record-eb8cc643`. It is pinned by:
  - `seedlingSetPatches.test.js:184` (the table) and `:195` (the id);
  - `fidelityMoonrock.test.js:49`;
  - `fixtures/moonrock-oracle.json` and `fixtures/descent-oracle.json`, re-recorded **on the game with `--record`**,
    never by hand.
- **AP_1 regenerates** (provenance only) and **`fixtures/campaign-frontier.json`** re-pins its md5.
- The rules arc writes the rows' `why` text and the L37-style header paragraph. The fidelity arc owns the model
  witnesses; none are needed for the bundle (model == game on every recommended arm). It would need an orphan-button rule
  only if a rock is removed without its button.

## CI dispatches for the planner (a cloud session gets 403 on `workflow_dispatch`)

Run each on **`main`** (the control) and on the **rules arc's branch carrying the rows** (the treatment):
1. **`seedling-divergence-sweep.yml`**
   - inputs: `mode=inv`, `page=seedling_bot_ap_p4f`, `producer=solver`, `page_legs=1`,
     `ids=310,311,312,313,314,315,316,373,374,375,630,631,632,633,634,635,419,420,421,425`;
   - checks: L74's 631/634 go from impossible to crossed, and nothing else moves. Leg ids are this base's; pass `keys`
     instead if they have shifted.
2. **`seedling-survey.yml`**: `through=end`, `only=48,77,107,113,150`. Step 48 should stay SOLVED (it REFUSED with the
   rock-only remove). 150 should be unchanged.
3. **`seedling-probe.yml`**: `probes=probe-seedling-l37-fallrock.mjs,probe-seedling-moonrock.mjs,probe-seedling-descent.mjs`.
   The two oracles re-record locally with `--record` on the treatment branch. The probe's L37 DELIVERED arm must stay
   PASS (the new rows touch other levels).
4. The vitest suite at the treatment SHA, read from CI (⚖ 52): `node scripts/procgen/ci-vitest-summary.mjs <sha>`.

## What the brief got wrong (measured)

1. **"L43's three rocks and the tag-10 rope rock stay. The rules model them as OBSTACLE EVENTS."** No: no event names
   any rock, and every `fallrock`/`fallrocklarge` is an `overlay_rows` `open` row. The FallRock `arm` refusal is never
   reached, because no arrival lands inside an armed rock.
2. **"A REMOVED one may hit the same refusal if another level writes its tag."** No remaining rock has a cross-level
   writer (D1). The refusal does appear on a *staged* clear (the L43 alcove arm), and REMOVE opens a different model gap
   (the orphan button, D3).
3. **"D3 … expected to be NO."** It is NO only for `loadAtlas()`. The survey and the rules generator read
   `patchedMapDocument`, and the model replays the delivered records' moved rocks exactly.
4. **The client's five rocks are not the whole set.** L74 (the twin of L37) and L29 seal the same way. Of the client's
   five, L43's three are inert in our AP delivery.
5. **"Dungeon4_1 (Dungeon 4 room 1)"** is our **L39** (`Dungeon4/1.oel`); `Dungeon6_Boss` is **L69**.
6. **`CC/docs/cloud-reports/seedling-fidelity-darktrapq.md` does not exist.** The precedent is `seedling-fidelity-darktrap2.md`.
7. **"Reuse its tool"**: CLEARTAG's tool crashes at this base (D4: two drifts). A scratch copy was needed.
8. `levelWorld.js:3048`'s comment says `CONTACT_FIDELITY.fallRockPostFall` is "OFF by default". It is ON at this base
   (`contactFidelity.js:342`).

## Residue (named, not fixed)

- The solver throws a plain `Error` (not a `SolverRefusal`) on an orphan button's `hold`. It would matter for any
  future remove-without-button.
- The L74 vanilla leg 631 THREW on a sword press during the fallrock freeze, and legs 630/634 refuse on L74's lavarunner.
  Both are pre-existing.
- `measure-seedling-cleartag-patch.mjs` needs the two fixes in `evidence/cleartag-patch-rerun.mjs` to run at main.
- The L69 Watcher/controller edit is unexplained beyond the AS3 reading (D3).

## Byte-inertia

No tracked file outside `CC/docs/cloud-reports/` changed: no `seedlingSetPatches.js`, rules, worlds, presets, AS3,
wasm, gitlinks or `fixtures/`. The regenerations ran in a throwaway detached worktree, now removed. No `pytest`, no
unfiltered vitest, no `standing-values --write`. The dev server (PID 554) is stopped by PID at the end.
