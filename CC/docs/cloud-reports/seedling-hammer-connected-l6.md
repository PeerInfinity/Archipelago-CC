# Seedling hammer-phase: CONNECTED-L6 — why the connected bot's L6 exit refuses

Slice `seedling-hammer-connected-l6` (LOCAL, Opus, measure first). Evidence: `seedling-hammer-connected-l6-evidence/`
beside this file.

## 1. Commits

- Start SHA: `fe98f37f22` (origin/main, `train: content-r3 5c5714d585`): the acceptance-md5 baseline the brief names.
- Branch: `hammer-connected-l6`. Head: the commit that carries this report (step commits `949918fd38` capture + diff,
  `f4a5d6f81c` replays).
- **No code change.** Nothing under `frontend/` or `scripts/` is touched, so the acceptance md5 has nothing to compare
  (it was not re-run).

## 2. The answer

**The differing field is `staging.seam.items.hasSword`: false in the connected slot-2 room, true offline. The cause is
the room's item placement, not the connection.** In room `s2` (upstream 0.6.9, seed 2, Questy = slot 1, Sprout =
slot 2), the multiworld fill put **Questy's** Sword in "Level 010 - Sword". Questy's pre-sends give Sprout only 2
Seals and Progressive Swim. So Sprout reaches L6 with no weapon. The offline control is the solo seed-1 doc, where L10
holds Sprout's own Sword.

The missing sword changes the ROUTE before it changes the solve. With a sword, the bot leaves L11 north through
`level_3__r8c6 → level_3__r0c4`, which needs `Progressive Sword` or `Ghost Spear`, and never asks for the westbound L6
crossing. Without one, the path finder walks back L11 → L10 → … → L6 → L5 toward level_86. That westbound L6 request
is the one the solver cannot answer weaponless. Its bait rung picks stance (136,40), which lies past the danger at
(162,40) from the arrival at (216,40), so walking to it re-enters the same bait: `BAIT_REENTRY`. The chaser arm
refuses because the run holds no sword. Everything else refuses too.

**Owner: hammer** (classification (b) below), with a logic question for the rules owner. The connected path stages
the request faithfully. The rules make this crossing `True_`, so the state is legitimate.

## 3. Reproduction

- Room: `~/CC/ap-upstream-seedling/out/s2/AP_01043188731678011336.archipelago`. MultiServer on port 38452 with
  `SKIP_REQUIREMENTS_UPDATE=1` (the venv lacks `cryptography`, so upstream's requirement prompt dies on EOF). The
  third run added `--disable_save` after deleting the `.apsave` the first two runs wrote. Dev server: the worktree on
  :8130.
- Probe: the evidence's `probe.mjs` + `steps_full.mjs`, retargeted to this worktree, plus
  `probe/steps_cap.mjs`. That step wraps the JS runtime's worker service `rt.playback.solveService.start` and captures
  every L6 request with `seedlingSolveRequestCodec.captureRequest`.
- **Three connected runs, not two (the brief bounded it at one or two):**
  1. No capture: the hook looked for `rt.solveService`, which does not exist (it is `rt.playback.solveService`).
     It reproduced the refusal: 2/48, stalled at (182.43, 24.23), the same text as the evidence.
  2. Invalid: the room still held run 1's checks, so the bot took L0 → L86 directly, never L6, and then stalled at L15.
  3. Clean room, capture on: **reproduced**. 2/48, the same stall and the same refusal, five westbound L6 requests
     (#25 cancelled, #26–#29 refused at 560–569 work units).
- Offline control (no server): the seed-1 doc + sphere log, 10 min of play, 26/48. It made 94 requests: two at L6,
  both eastbound (#9 cancelled, #10 solved at 15 units), and **no westbound L6 request**.
- `runs-summary.json` lists every run's request sequence (level, position, goal).

## 4. Request diff (`captures/diff.txt`)

| Field | Offline seed 1, L6 east (#10) | Connected s2, L6 east (#8) | Connected s2, L6 **west** (#26) |
|---|---|---|---|
| `staging.seam.items.hasSword` | false | false | **false** |
| `staging.seam.items.canSwim` | false | true (Questy's Progressive Swim) | true |
| `staging.save.seal_parts` | [] | [0,1] (Questy's two Seals) | [0,1,2] (+ L11 Chest) |
| `staging.boot` / `live` position | (32,16) / (40,24) | (32,16) / (40,24) | (208,32) / (216,40) |
| `solverGoal` | exit (224,32) → L7 | exit (224,32) → L7 | exit (32,0) → L5 |
| `staging.persistence` | L5 tag 0 | L5 tag 0 | L5 tag 0, L8 tag 0 |
| `live` digest (bodies: bob@96,16 …) | — | identical to #10 | same bodies, west side |
| clock `seam.time`, budget (640/85), equips, grants, despawn, passes | equal | equal | equal |
| `source.records` | lost in capture | lost in capture | lost in capture |

The eastbound pair is the only like-for-like route point. It differs only in fields set by Questy's items, which
arrive through server item receipt. Neither field is read by the bob crossing. The westbound state has no offline
twin: with the sword in hand, the offline bot never asks it. `hasSword: false` at #26 is therefore the field that
matters, and section 5 shows it decides the answer.

`source.records` came back `{}` in every capture. The records Map lives in the JS runtime iframe's realm, and
`captureRequest` ran in the parent page, so its `instanceof Map` tag missed it. The replays substitute the vanilla
patched atlas (`patchedMapDocument(loadAtlas())`); L5 and L6 hold no AP location in this room. The substitution is
validated by the byte-identical replay below. (A codec fix for cross-realm Maps is a js/sweep-tooling note, not done
here.)

## 5. Node replays (`replays/`)

These run `solveAnytime` exactly as `jsRuntimeSolveWorker` does, each in a fresh node process.

| Request #26, variant | Answer | Work |
|---|---|---|
| as captured | refusal, **message byte-identical to the page's** | 560 |
| `budgetWork` 2560 | the same refusal | 560 (the ladder exhausts; the budget is not what ends it) |
| `hasSword: true` | **solves**: verbs [walk], 0 hits, 0 deaths, arrives in L5 | 103 |
| `TIME_RUNG.maxExpansions` 400k (temporary edit, reverted), budget 640 | refusal (time rung: the solve deadline after 156k expansions) | 643 |
| the same 400k, no work limit | refusal (time rung: `maxExpansions=400000` exhausted) | — (249 s) |
| #8 (eastbound), as captured | solves: [bait, walk], 284 ticks, 0 hits, into L7 | 16 (= the page's answer) |

The refusal follows the request, not the page. Flipping only the sword turns it into a hitless 103-unit walk. No
weaponless westbound plan was found at ten times the time rung's bound.

## 6. Classification and change

**(b): a legitimate state the solver cannot solve, which makes it a hammer gap.** It is not (a): the connected path
builds exactly the state the game is in (no sword, Questy's items received, the right checks). The rung is **bait**.
`deriveBaitStance` chooses a stance on the far side of the danger from a westbound arrival, so the bait walk re-enters
its own bait (`BAIT_REENTRY`). Kill is closed (no sword). Avoid, detour, time and forced-hit find nothing. Eastbound,
the same room baits bob from the near side and walks through hitless (#8, #10). The comment at `solverBot.js` bait
rung (SWIM R5 D1) records this room eastbound as the case that introduced BAIT_REENTRY.

**A ruling is needed before any build.** The rules say `level_6 -> level_5__r1c5: True_` (no weapon). Under ⚖ NO-HIT
logic, that is right only if a weaponless, hitless westbound crossing exists. If it does, the hammer owes it: a
near-side bait stance for a far-side arrival. If it does not, the rule owes a weapon, like L3's
`r8c6 → r0c4` (Sword or Ghost Spear), and the owner is rules/logic. The 400k time-rung probe found no plan, which
leans toward the second reading but does not prove it.

**No change built.** The stance choice is in `deriveBaitStance`, shared by every bait in the game, so it is not a
cheap switch. The brief allows a build only where it is cheap.

## 7. L92 and L16 notes

- **L16 double break step: the older OBSTACLE-EVENTS break step, not WALK-ROUTE-EVENTS.** The message
  *"breaking rope@32,16 first (flag:L16:0) — the route to level_17 needs it"* is `playbackBotUI._takeBreakStep`, fed
  by `eventPathFinder` (goal-first BREAK steps). `routeEvents.js` (WALK-ROUTE-EVENTS) is OFF on main and was not on
  this path. Measured from the evidence's connected slot-1 run (c2, `run_full_A_slot1`): the rope event's location
  *"L16 flag 0: rope@32,16 cleared"* is in the snapshot's `checkedLocations`, but its event item is **not** in
  `inventory`. In the offline control, both are present. `onSnapshotUpdated` sees the location checked and re-plans.
  `held()` (inventory ∪ credited) still lacks the event, so the path finder picks the same break step again. With the
  event already checked, nothing advances, and **that is where slot 1 ends at 6/48**, so this is not a one-off.
  Suspect, not verified: in connected mode `seedlingRegionGlue._eventCollect → collectEvent` marks the location but
  never adds the local event item to inventory, because items arrive only via `ReceivedItems` and an event item has no
  id. **Owner: js** (client/stateManager connected event collection; report only, not edited). server-data should
  know, since it is the connected inventory.
- **L92** (the evidence's `run_full_B_slot1`, 16/48, not reproduced here: my runs never got that far):
  `level_92__r4c2 -> level_91` refuses with *"bait (jellyfish@120,64): the dwell's condition (… has left the world —
  the room's own kill region removed it) is ALREADY TRUE before a tick is spent"*. The bait rung chooses a body that
  is already gone. This is a hammer gap with nothing connection-specific in it. **Owner: hammer.** It wants a capture
  of its own (an offline leg reaching L92 at sphere 3.13 would do).

## 8. What the brief got wrong (measured)

- *"Offline solves"*: the offline control is a different game. It is solo seed 1, where L10 is Sprout's Sword. The
  connected slot-2 room (`s2`) gave that Sword to Questy. Offline never asks the refused request (§3). The comparison
  was across placements, not across connection paths.
- *"Slot 2 … DETERMINISTIC"*: confirmed, but it is not a slot-2 or connected property. Any run of the s2 placement
  without a weapon reaches the same request, and the node replay of it is deterministic.
- *"L16 … (once)"*: it is the terminal stall of connected slot 1 (6/48), from a missing event item (§7). It belongs
  on the server-data/js list, not under "lower priority".
- The brief's run tally ("6, 2, 2, 16") and the stall point (182.43, 24.23) reproduce exactly.

## 9. Residue and hand-overs

- **Hammer (planner):** the westbound L6 bait, plus the ruling question in §6. The L92 dead-body bait.
- **Rules/logic:** if the ruling says no weaponless hitless crossing exists, `level_6 -> level_5__r1c5` (and its
  reverse, if it has the same shape) needs a weapon.
- **js / server-data:** connected event items never reach inventory, so the L16 break step repeats and slot 1 stalls
  at 6/48 (§7).
- **Sweep tooling (js):** `captureRequest` loses cross-realm Maps and Sets when it runs in the parent page. Capture
  inside the runtime frame, or tag by `Object.prototype.toString`.
- **Process deviations:**
  1. Three connected runs instead of two (§3).
  2. The two temporary `TIME_RUNG` edits to `solverBot.js` (measurement only, each reverted at once, tree clean
     after) were made while the offline control page was being served from this worktree. A solve worker re-created
     in those windows could have run the edited bound. That control's only load-bearing output is its request
     *fields*, which the page builds and the solver does not touch. Its answers (#10 solved at 15 units, with no time
     rung) are not used.
  3. Upstream MultiServer needed `SKIP_REQUIREMENTS_UPDATE=1`.
- All servers I started are stopped. The `s2` room directory is back to its three original files.
