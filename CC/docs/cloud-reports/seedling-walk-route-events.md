# Cloud report: `seedling-walk-route-events` — the whole-game walk clears the route's events a goal's room reads

Planner: `seedling-hammer-phase-planning-5`. Ruling: the user, 2026-11-11, *"Slice it, hammer briefs it (Recommended)"*.
I did not touch the solver, any `seedlingDemo/` file, fidelity, `levelRun.js`, `dangerMap.js`, the rules, AS3, wasm,
gitlinks or `flashPanel/*`. The change is in `frontend/modules/playbackBot/` and the docs. It needed no new export.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `737a451f5038f6dfe2f322b26457de0b5fb0aee9` (origin/main, "train: ci-nightly-manual-batches 226df67190") |
| Branch | `claude/seedling-walk-route-events-em0zt3` (pushed) |
| Commits | `872075d0` the feature (code, rows, docs). `0f443a6b` evidence. This report is the last commit. |
| Scratch witness branch | local `scratch/seedling-walk-route-events-witness` @ `32582890`, **not pushed**: the brief allows pushes to the designated branch only. It is the feature + the cherry-picked MEASUREMENT-ONLY instruments `8fc6dd3c` → `f7c58db6` and `d2a6b6e0` → `d07d4ccb` (both clean) + one scratch knob commit. The knob is committed as a patch: `…-evidence/scratch-knob.patch` (`TEST_MEASURE_ROUTE_EVENTS=1` sets the opt-in in localStorage; it also adds route-event lines to the `[MEASURE]` sampler). None of these three is in the landing branch |
| Environment | bootstrap `--seedling` READY; node v22.23.4; 4 cores; dev server :8000 (`serve-nocache.py`, started here as PID 994, stopped by PID) |
| Evidence | `CC/docs/cloud-reports/seedling-walk-route-events-evidence/` |
| Planner messages | none arrived |

## 2. The answer first

**With the new step on, the whole-game walk (seed 1, wasm) passes L40 Boss Key 2.** It walks to `wandlock@480,560`
(flag 12) first: the status read "breaking wandlock@480,560 first (flag:L40:12) — the route to "Level 040 - Boss Key 2"
(19/48) (the AP route cleared it first and that room reads it)". The game collects the flag. Then the walk plays BK2's
4,491-tick plan, the number WALK-WALLS predicted for the walk's request + flag 12. BK2 was checked between t=1815 s and
t=1830 s.

**The walk stops next at entry 24, the L53 → L54 exit** ("Level 055 - Boss Key 3"): the jellyfish kill-dwell refusal,
verbatim WALK-WALLS §4, at t=2113 s (it was t=2503 s before). Past that, the skip probe meets **L91 → L89** (the drill,
"the combat ladder is EXHAUSTED"), as before. Every later skip is that wall or a "no path" that follows from it.

**The one thing to know first:** the step is **OFF by default** (`playbackBot_routeEvents`, the panel's **Clear the
route's events first**). The whole-game tutorial walk does not turn it on. The witness turned it on with a scratch knob,
so today's ratchet walk still stops at BK2. Whether the tutorial (or the bot's default) turns it on is the planner's
call. Every committed preset that the step changes is a Seedling one (§4).

## 3. The flag-12 page play (measure first)

Leg list: `seedling-divergence-legs.mjs --carry-route-flags` at the start SHA. Flag 12's legs, by key:

- **876** `level_40__r48c54 <- in_L39_144_0 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` (from L39)
- **877** `level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` (from L43)

Run: `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=480000 --keys=<both>`, local, wasm.
Rows (trimmed): `…-evidence/flag12-legs.jsonl`.

| leg | end | flag 12 | room hits | solve (640 → 2560 retry) | played ticks | wall |
|---|---|---|---|---|---|---|
| 876 (L39) | **done** | set + collected | **0** (3,567 samples) | 640 refused (`shouldStop` at `walk`, clear-tag burn-stance corridor); 2560: dashless 1,228 t / 903 u, full 1,203 t / 986 u (deadline `sword-dash`) | 1,100 of 1,203 (interrupted by an item delivery, seal part 7) + a continuation of 84 (solved at 640) | 101.7 s |
| 877 (L43) | **done** | set + collected | **0** | 640 refused (same text); 2560: dashless 1,205 t / 904 u, full 1,106 t / 982 u | 1,019 of 1,106 (item delivery) + 87 (continuation) | 94.5 s |

Both legs play to the end hitless and collect the flag. Each needs the held 640 → 2560 retry. The cut that
BK2-APPROACH-ORDER saw ("solved, cut mid-play") was the harness's 90 s leg budget: both legs need about 100 s.

## 4. Design and the preset census

**Where the reads come from (page, generic).** The new module is `frontend/modules/playbackBot/routeEvents.js` (pure, no
game names). It is the page-side twin of the sweep's `routeCarry` / `levelReads`:

- **Route order:** the sphere log's own collection order (`routeCollectionRows`: the first row naming each location; the
  bot's `getSphereData`). It keeps every game-state event collected on a row strictly before the goal's row, never the
  goal itself (`routeEventsBefore`).
- **Room reads:** the goal's SCOPE reads its own events, plus another scope's event named by an exit or location rule of
  one of its regions, except a door's far side (an exit rule naming an event of the exit's own target scope).
  `scopeReads` is `levelReads` with "level" made opaque.
- **Scope source:** the slot's own exports, which are the same two fields `routeCarry` reads: the event's `obstacle.level`
  (`gameStateEventsOf`) and the region's `preset_sidecars[p][region].playable_payload.level`. A slot that exports neither
  gets no step. There are no Seedling constants and no new export.

**How the bot uses it** (`playbackBotUI`, all behind `this._routeEvents`):

- Before a queue head, `_routeEventFor` returns the first route event the walk does not hold. Held means the snapshot's
  inventory has it, it is checked, or one of the bot's own hops credited it.
- In the event's region, the bot reuses **`_takeBreakStep`**: it walks to the event location, and the collected flag
  re-plans through the existing `_pendingBreak` / `onSnapshotUpdated` path. Elsewhere, it takes the first move of
  `_planRoute` to the event's region: an exit, a Restart, or a break that route itself needs.
- The bot gives an event up for that head, by name in its log (`getRouteEventState().skipped`), when its rule does not
  hold, when there is no route to it, or when the walk to it is refused (`walkFailed` or a synchronous refusal). The step
  is optional, so a refused walk to an event **re-plans instead of stopping the run** (`_giveUpRouteEventWalk`).

**Opt-in: OFF by default.** It changes the walk on three committed presets (below), so it ships behind a persisted bot
option in the style of `walkOrder` / `mazeCollect`: an LS key, `setRouteEvents()` / `getRouteEvents()`, a panel checkbox
and a storage declaration. OFF, no new code path runs.

**Cross-check against the sweep** (`…-evidence/census-table.txt`): over the 202 location legs of
`seedling_playthrough/AP_1`, the sweep's `carriedFlags` ⊆ ours on every leg. The two are equal on 199. The other 3 carry
less in the sweep only because their arrival already stages the flag (`withRouteCarry` drops those).

**Census** (`…-evidence/census.mjs`, `census-goals.txt`). Only four committed presets export game-state events, all of
them Seedling:

| preset | goals | goals that gain a step | distinct events | BK2 |
|---|---|---|---|---|
| `seedling_playthrough/AP_14089154938208861744` (the walk's) | 48 | 11 | 19 | `flag:L40:12` |
| `seedling_playthrough/AP_1` (sphere log from the forward simulator) | 48 | 11 | 19 | `flag:L40:12` |
| `seedling_er/AP_1` | 48 | 8 | 16 | `flag:L40:12` |
| `seedling_playthrough_maze/AP_1` | 48 | 6 | 15 | — |

On the walk's preset, the goals are: L30 Torchpickup (30:0, 30:2), L12 Chest (12:4, 12:5, 12:10, 12:3), L39 Totem 72,40
(39:8), **L40 BK2 (40:12)**, L40 Chest and L40 Totem 160,640 (40:12), L40 Totem 64,144 (40:12, 40:1, 40:7, 40:8), L12
Witch (seven L12 flags), L68 Health (68:0), L63 Chest (63:1, 63:6, 63:7) and L112 Owl (112:1). This is an upper bound:
events the walk already holds are not walked.

## 5. Rows and bounded vitest runs

There are 7 rows in `playbackBotUI.test.js` (`PlaybackBotUI — route events …`), on a generic two-scope fixture (`north` /
`south`, string scopes):

- `scopeReads` (own scope + a named other-scope event; not a door's far side; no scope → none)
- `routeEventsBefore` / `routeEventsPlan` (order, before-the-goal, not the goal, no scope export → empty)
- OFF (the default) walks straight to the goal
- ON: route → break → collected → re-plan; the gated event is given up by name; other-scope and late events are never walked
- held (inventory / credited) events are never walked
- a refused walk gives the event up and walks to the goal; a refused walk to anything else still stops by name
- persistence, `reset`, and a non-boolean is OFF

Runs (bounded, from the repo root):

- `npx vitest run frontend/modules/playbackBot/` → **184 passed** (4 files)
- `npx vitest run frontend/modules/storagePanel/` → **20 passed** (the new key is declared)
- `node scripts/procgen/check-procgen-docs.mjs` → ALL CHECKS PASSED

Mutants, each red on `playbackBotUI.test.js` and then restored:

| mutant | rows red |
|---|---|
| opt-in ignored | 1 |
| held test dropped | 2 |
| `_giveUpRouteEventWalk` never handles | 1 |
| route-order filter dropped | 4 |
| far-side exception dropped | 1 |

The suite number comes from CI at the pushed SHA (ruling 52). I did not run it locally.

## 6. The witness walk

One whole-game walk, seed 1, wasm, on the scratch branch:

```
TEST_MEASURE_ROUTE_EVENTS=1 TEST_AUTO_START_TIMEOUT_MS=10800000 TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000 TEST_MEASURE_BOT_STALL_MS=300000 TEST_MEASURE_SKIP_REFUSALS=12 npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game
```

The run went `[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 2238.2s` (the ratchet's verdict, not a full
playthrough). `bot-plays` took 2,227 s, against 2,677 s in WALK-WALLS. The tree was frozen at `32582890` and did not move.

**Route-event steps taken** (`[MEASURE skip 1] routeEvents=`). All of them were collected by the game, and none was given
up before the first skip:

| goal | event | how |
|---|---|---|
| L30 Torchpickup (4.7) | `flag:L30:0` bosslock@64,32, then `flag:L30:2` bosslock@224,208 | route, break; break |
| L12 Chest (5.4) | `flag:L12:4` bosslock@416,240 | route, break |
| L39 Totem 72,40 (6.7) | `flag:L39:8` wandlock@144,592 | route, break |
| **L40 Boss Key 2 (6.8)** | **`flag:L40:12` wandlock@480,560** | route, break (t≈1410–1530 s) |

Before, `flag:L39:8` was walked by the rule-named break step. The route-event step now reaches it first: the same event,
in the same order. I cannot tell from the evidence which of L30:0 / L12:4 / L30:2 the old walk broke by a rule-named step
or by a crossing. WALK-WALLS kept no per-step log. Every one of them was collected and the walk went on.

**BK2.** The first plan played to its end ("playing tick 4104/4491" at t=1800 s). One continuation then refused at
2,560 (`wasm-continue-location-40`, the `walk` deadline, the apitem contact corridor). The engine's own fallback, a
forced re-arrival, re-solved, and BK2 was checked (cursor 18 → 20 by t=1830 s).

**Stops** (`…-evidence/witness-probe-lines.txt`):

| skip | t | entry | wall |
|---|---|---|---|
| 1 | 2113 s | 24/48 "Level 055 - Boss Key 3" | **L53 → L54 exit**: "chaser kill (jellyfish@152,168) by press: the dwell was HIT at dwell tick 145 …" after 640 → 2560. The solver kill wall WALK-WALLS §4 measured; `KILLLOCK_CHASER_REWIND` is its candidate |
| 2–12 | 2219–2236 s | 25–35 | **L91 → L89** drill ("the combat ladder is EXHAUSTED", `enemy:drill@64,80`), and "no path from level_91 …" for the entries behind it |

After the skips, the end-of-run state shows four events given up because "its rule does not hold": L12 Witch's flags 11,
12 and 7, and L68 Health's flag 0. They are consequences of the skipped entries' missing items. The walk was parked in
L91 at that point.

## 7. What the brief got wrong (measured)

- *"Flag 12's own legs from L39 (legs 876/877)"*: only **876** comes from L39. **877** arrives from L43
  (`in_L43_176_464`, arrival (320,592)). Both solve and play hitless.
- *"Does the play reach flag 12, hitless?"*: yes, both legs. They need about 100 s of leg budget, not the full 480 s. The
  earlier "cut mid-play" was the 90 s default.
- *"Use the divergence harness … (`npm test` drives it)"*: the sweep is `node scripts/procgen/probe-seedling-divergence-sweep.mjs`
  against a dev server, not `npm test`. The whole-game walk is the `npm test` one.
- *"Opt-in or default … if it changes any other world's walk"*: no non-Seedling preset exports game-state events, so
  the step can change only Seedling walks. It does change three committed Seedling presets' walks (§4), so I kept it OFF.

## 8. Residue

- The landing branch holds the feature, the evidence and this report. It is for js-18's train.
- The scratch branch `scratch/seedling-walk-route-events-witness` is local only and is not for landing. Its knob is
  committed as a patch in the evidence folder.
- Left in the session scratchpad and not committed: the full witness log (`witness.log`), the full leg list
  (`legs.jsonl`) and the untrimmed flag-12 rows.
- The dev server I started (PID 994) was stopped by its PID. The `npm test` run wrote only gitignored results; the tree
  is clean apart from this branch's commits.
- Not run: pytest, unfiltered vitest, `standing-values --write`. Nothing was pushed to `main`, nothing was force-pushed,
  and I used no `git stash`.
