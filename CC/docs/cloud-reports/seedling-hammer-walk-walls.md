# Cloud report: `seedling-hammer-walk-walls` — why the whole-game walk stops where the sweeps solve (MEASUREMENT ONLY)

Planner: `seedling-hammer-phase-planning-5`. Ruling: the user, 2026-11-11 (planning-4's replan): *"Walk BK2 measure
(Recommended)"* and *"L53 to L54 exit"*. Nothing was fixed. No solver, driver, model, fidelity, rules, AS3, wasm or gitlink
file was changed.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `1b4281a99412c7a4e33b05193e1a6ab94575ab84` (origin/main, "train: sdc-slot-playerid") |
| NEW-LOCKS | **not on main.** `origin/hammer-harvest-new-locks` @ `1e96711dfd` merged into the branch (clean) → `bae7c5fa8b`, so the four switches exist for the L53 arm |
| Instrument | the re-measure's MEASUREMENT-ONLY walk knobs `a5560fc8` cherry-picked cleanly (→ `8fc6dd3c`), then this slice's request capture (`d2a6b6e0`). Neither is for landing |
| Head | this report's commit (the last on the branch); evidence commits `0e514f17` and `b652de2c` before it |
| Branch | `claude/seedling-walk-walls-measure-vta5wz` (the harness's designated branch) |
| Environment | bootstrap `--seedling` READY; node v22.23.4; 4 cores; dev server :8000 (`serve-nocache.py`, started and stopped here) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-walk-walls-evidence/` (`l40/`, `l53/`, `tools/`, `walk-solve-summaries.jsonl`, `walk-probe-run.txt`) |
| Scope messages | none arrived from the planner |

## 2. The answer first

**The one thing to know first: the L40 wall is not a budget wall. The walk never opens L40's south door (flag 12,
`wandlock@480,560`), and without that door Boss Key 2 refuses at ANY budget.** The sweep leg solves because the leg list's
DOOR-CARRY (`--carry-route-flags`) stages flag 12 for it. The walk does not: it breaks an event first only when an AP rule
names it, and no rule on the way to BK2 names flag 12.

| wall | why the walk refuses where the sweep solves | smallest next step |
|---|---|---|
| **L40 Boss Key 2** (entry 19) | The walk's request differs from the sweep leg's in **one field that matters: `staging.persistence` has no `{level 40, tag 12}`**. Same arrival (488,904), same 15 live bodies, same goal. Its clock (33630 vs 5216), `canSwim`, seals, totem part and rng seed differ too, and none of them matters. Unbounded, the walk's own request **refuses** (11,578 units: "applied 4 strategies … `hold(wandlock@480,560)` … the corridor still does not plan"). The same request **plus** `40:12` **solves at 1,382 units, 4,491 ticks, hitless**, which is the sweep's number exactly. The sweep's request **minus** `40:12` refuses with the walk's text (40,719 units unbounded). The "640 → 2560 budget stop" was the deadline cutting a search that had no answer | **A staging (route-order) fix in the walk, not an efficiency fix:** before BK2 the walk should clear flag 12, the event the AP route collects at 6.1 and BK2's room reads. That is the user's 2026-11-05 ruling's second half ("solve in visit after that works"), and it is the playback bot's (`playbackBotUI` break steps), not the solver's. Flag 12's own legs (876/877) solve on the page (BK2-APPROACH-ORDER, cut mid-play at its leg budget) |
| **L53 → L54 exit** (entry 24) | Not a staging gap: the walk's request refuses at the defaults at any budget (unbounded 5,713 units: `puncher@136,96` never leaves; at the page's 2,560 the jellyfish dwell hit, verbatim the live text). It is a **hammer kill-class** wall | **A switch flip:** `KILLLOCK_CHASER_REWIND` (already on main, OFF) solves it alone (768 ticks, 1,201 units dashless; 1,770 at the page's 2,560 request). With `KILLLOCK_LINE_STANCE` (NEW-LOCKS) it costs 715 units, 707 ticks. All four switches: solved inside 2,560 (841 units). Model-hitless; the page play is not yet measured |

The JS arm's stall at (589.98,594.13) is the JS runtime's plain-walk FALLBACK after the same solver refusal. That walker
cannot push blocks or open locks. From the captured L40 atlas, tile (36,37) is beside `pushableblockfire@576,576`,
`pushableblock@576,560` and `pulser@592,576`, the enclosure around the BK2 `apitem@656,528` (tile (41,33)). So the stall is
a symptom of the same refusal, not a second wall. ⚠ This is inferred from the atlas: no JS-arm run was captured.

## 3. L40 Boss Key 2: the capture and the replays

**Capture.** One whole-game walk, seed 1, wasm, the re-measure's harness and knobs (`TEST_AUTO_START_TIMEOUT_MS=10800000`,
`TEST_TIMEOUT=11000000`, `TEST_MEASURE_STEP_TIMEOUT_MS=10800000`, `TEST_MEASURE_BOT_STALL_MS=300000`) plus the skip probe
(`TEST_MEASURE_SKIP_REFUSALS=10`), so one run reached both walls. Capture: `TEST_MEASURE_CAPTURE_SOLVES='(-40|-53|L40-|L53-)'`.
The run went `PASSED 2689.6s` (the ratchet; not victory), `bot-plays` 2676.9 s, and stopped at the re-measure's places:
skip 1 = entry 19 BK2 (t=1868 s), skip 2 = entry 24 BK3 via the L53→L54 exit (t=2503 s), then L91 → L89 (`walk-probe-run.txt`).
The walk made 112+ solves (`walk-solve-summaries.jsonl`). BK2's are:

| id | name | budget / attempt | live result |
|---|---|---|---|
| 90 | `wasm-location-40` | 640, retry 0 | refusal at 644: `shouldStop` at the `walk` site, apitem (656,528) contact corridor |
| 91 | `wasm-location-40` | 2560, retry 1 (640 → 2560) | refusal at 2,562, the same text. The re-measure's stop |

Requests 90 and 91 differ only in `budgetWork` (`diff-requests.mjs`). Both are cut to level 40 at `l40/walk-req9{0,1}-*.json.gz`.

**Replays** (L40-CENSUS's `chain.mjs`, every pass on one work clock with the deadline lifted to 40,960, and
`replay-seedling-solve-request.mjs` at the request's own budget):

| arm | result | work units (dashless / full) | plan |
|---|---|---|---|
| walk 91 at the page budget (2,560), `replay-seedling-solve-request` | **refusal, 2,562**: dashless 2,561 (deadline `crusher-fork`), full 1 (`walk`), as on the page | 2,561 / 1 | — |
| walk 90, budget lifted | **REFUSED, 11,578** | 6,404 / 5,174 | "contact -> shove stance (pushableblockfire@576,576): applied 4 strategies for one goal [shove(pushableblockfire@576,576), weigh(wandlock@448,432), burn(burnabletree@872,784), hold(wandlock@480,560)] and the corridor still does not plan" |
| walk 90 **+ persistence `40:12`**, budget lifted | **SOLVED, 1,382**, hitless (model fresh run: 0 hits, 0 deaths) | 1,381 / 1 | 4,491 ticks. Volley approach anchor 32, rank 5, 70 forks: the BK2-APPROACH-ORDER numbers exactly |
| sweep leg 873 (the committed fixture `leg873-l39-l40-bk2-request.json.gz`) **minus** `40:12`, budget lifted | **REFUSED, 40,719** | 34,697 / 6,022 | the walk's refusal text, verbatim |

Units by site (`chain.mjs`'s attribution) are in `l40/chain-arms.jsonl`.

**Staging diff, walk 90 vs sweep 873** (`l40/diff-walk90-vs-sweep873.txt`):

| field | walk (90) | sweep (873) | matters? |
|---|---|---|---|
| arrival (`boot`, live player x/y/facing) | (480,896), live (488,904), dir 3 | same | — |
| live bodies (15) and their positions / state | 15 | identical, no body differs | — |
| goal | `collect-placement` (656,528) | same | — |
| **`staging.persistence`, level 40** | **none** (65 rows, none in L40) | **`{40,12}`** = "L40 flag 12: wandlock@480,560 cleared" | **YES: the whole difference** (± arms above) |
| `seam.time` | 33630 | 5216 | no (the walk's own clock solves once flag 12 is added) |
| `seam.items.canSwim` | true | false | no |
| `save.seal_parts` / `totem_parts` | 0–9 / [0] | 0–6 / [] | no |
| `rng.seed` | 2132250561 | 1510219060 | no |
| `budgetWork` | 640 (91: 2560) | 2560 | no |
| source records | all 116 levels | L40 only | no (L40's record is equal) |

**Why the walk has no flag 12.** In the AP rules, `level_40__r23c29 -> level_40__r32c36` needs only Sword + Fire, BK2 is
`True_`, and "L40 flag 12" is a `True_` event in `level_40__r48c54`. The walk's break-first step
(`playbackBotUI._takeBreakStep`, "breaking X first (flag:…)") fires only for an event an AP rule on the route needs: it did so
for `wandlock@144,592 (flag:L39:8)` at 6.7. Nothing names flag 12, so the walk goes from L39 straight to BK2. The AP route
itself collects flag 12 at sphere 6.1 (sphere-log row 37) and BK2 at 6.8. DOOR-CARRY measured this as "the route's
COLLECTION order", and stages it in the sweep only (test-harness staging).

## 4. The L53 → L54 exit: the capture and the four-switch arm

| id | name | budget / attempt | live result |
|---|---|---|---|
| 111 | `wasm-exit-53` | 640 | refusal at 643, `shouldStop` at `walk`, reach-exit (144,240)->L54 corridor |
| 112 | `wasm-exit-53` | 2560, retry 1 | refusal at 2,562: "kill -> chaser kill (jellyfish@152,168) by press: the dwell was HIT at dwell tick 145 (run tick 374; source chaser jellyfish@144,192; 14 guard step(s) so far)" |

Staging of 112: boot (48,144) in level 53, live player (56,152), seam.time 40623, no L52–L55 persistence (flag 2,
`lock@144,208`, is still shut: it is the kill-lock this leg must open). Live bodies: `jellyfish@144,192` (152,200),
`puncher@136,96` (144,104), `jellyfish@184,160` (192,168), `jellyfish@152,168` (160,176). Cut to L53+L54 at
`l53/walk-req11{1,2}-*.json.gz`.

| arm (request 112) | budget lifted (`chain.mjs`) | at the page's 2,560 (`replay-seedling-solve-request`) |
|---|---|---|
| defaults | **REFUSED, 5,713** (2,368 / 3,345): "chaser kill (puncher@136,96) by press: puncher@136,96 is still in the world after the whole 166-tick bound (0 guard step(s)); it stands at (115.9,119.4)" | **refusal, 2,562**: the live text verbatim (the jellyfish dwell HIT) |
| `KILLLOCK_CHASER_REWIND` only | **SOLVED** 768 t, 1,202 u, hitless | **SOLVED**, 1,770 u (dashless 1,201 → 768 t; full refused in its window) |
| `KILLLOCK_CLEAR_WRITE` only | REFUSED 5,713 (= defaults) | — |
| `KILLLOCK_LINE_STANCE` only | REFUSED 5,713 (= defaults) | — |
| `ROCKLOCK_KILL` only | REFUSED 5,713 (= defaults) | — |
| REWIND + CLEAR_WRITE | SOLVED 768 t, 1,202 u | — |
| REWIND + ROCKLOCK_KILL | SOLVED 768 t, 1,202 u | — |
| **REWIND + LINE_STANCE** | **SOLVED 707 t, 715 u** | — |
| **all four** (the brief's spec) | **SOLVED 707 t, 715 u**, hitless | **SOLVED, 841 u** (dashless 707 t / 714 u; full 608 t / 127 u with sword-dash, the plan used) |

"Hitless" here is `chain.mjs`'s fresh model run (`gm: hits [], deaths 0`), not the page. **Class: hammer (kill).** At the
defaults the kill has no stance that clears the puncher or survives the jellyfish dwell. The rewind does, which is a
solver strategy, not a model gap. Fidelity's earlier note (the puncher never leaves (144,104)) is consistent with the
defaults' unbounded refusal and does not block the switched arm. Only a page play can show whether the model's hitless
plan is hitless in the game.

## 5. Tooling added, and its OFF identity row

| file | what | OFF |
|---|---|---|
| `scripts/procgen/seedlingWalkSolveCapture.js` (new) | page-side: patches each Flash-panel solve service's `start` once (`_solveServices()`: the JS page's and the wasm engines'), posts the request unchanged, captures the requests whose `name` matches a regex in the sweep's `--capture-requests` row shape, plus one summary line per solve | imported only by the guarded block below |
| `test_json/e2e/app.spec.js` (+13) | `TEST_MEASURE_CAPTURE_SOLVES=<regex>` + `TEST_MEASURE_CAPTURE_OUT=<jsonl>`: `exposeFunction` + `addInitScript` | **both unset → nothing is exposed or injected** (the block is inside `if (… && …)`). No shipped module is touched (`git show d2a6b6e0 --stat`: these 2 files + the evidence tool) |
| `…-evidence/tools/diff-requests.mjs`, `cut-request.mjs` | the staging diff and the fixture-sized cut | evidence only |

Not run: a separate OFF walk to show byte identity (the instrument is outside every shipped module, and the re-measure's
arms ran this harness without the block). ⚠ The cherry-picked `a5560fc8` touches two tutorial content files, as in both
re-measures. It is not for landing.

## 6. Recommended next slices

1. **WALK-ROUTE-EVENTS (playback bot, not hammer): the walk clears the events the AP route collected before a goal, which
   the goal's room reads.** Evidence: §3. The walk's request + flag 12 solves BK2 at 1,382 / 4,491 t hitless, inside the
   2,560 retry. The rule already exists as the sweep's `routeCarry` (collection order ∩ the room's reads; DOOR-CARRY matched
   it on 930/930 legs). The walk would run it as a break step (`_takeBreakStep`, "breaking wandlock@480,560 first
   (flag:L40:12)"), walking to the `L40 flag 12` location before BK2. Measure first: flag 12 ← L39 (legs 876/877) to the end
   on the page with a longer leg budget. BK2-APPROACH-ORDER saw them "solved, cut mid-play". ⚖ This is the user's "solve in
   visit after that works", for the planner to word.
2. **Flip `KILLLOCK_CHASER_REWIND` (with `KILLLOCK_LINE_STANCE` from NEW-LOCKS) for the L53 → L54 exit.** Evidence: §4.
   REWIND alone solves the walk's own request inside 2,560 (1,770 u). With LINE_STANCE it costs 715 u (still over 640, so it needs the held retry).
   Before flipping: one page play of request 112 (the divergence harness or the walk with `?seedlingSolverEnv=`) to see the
   hitless model plan in the game, and the NEW-LOCKS harvest A/B for the radius.
3. After 1 and 2, one whole-game walk to find the third wall. The skip probe again reached `level_91 -> level_89__r1c10`
   (the L91 drill), as in the re-measure.

## 7. What the brief got wrong (measured)

- *"find why it needs more than 2,560 when the sweep leg needed 1,382 (arrival, live bodies, flags or clock)"*: it does
  not need more units. With its staging it has **no** answer at any budget (11,578 units, refused). The budget stop and the
  `shouldStop` deadline were the deadline cutting a doomed search. Of the brief's candidates, it is the **flags**: one
  persistence row. Arrival and live bodies are identical, and the clock does not matter.
- *"The budget accounting is the same"*: true, measured. The page-budget replay of 91 reproduces the live 2,562 refusal.
- *"NEW-LOCKS' kill-lock switches"*: the switch that answers L53 → L54 is **`KILLLOCK_CHASER_REWIND`, which is already on
  main** (OFF). NEW-LOCKS' own three alone change nothing here. `LINE_STANCE` only makes it cheaper, on top of the rewind.
- *"re-capture [the sweep leg] on the same base"*: not done as a page run. I used the committed fixture of the same key
  (leg 873, BK2-APPROACH-ORDER's capture; leg 874 on this head's list). Its numbers are reproduced on this base by the
  walk's own request + flag 12 (1,382 u / 4,491 t / anchor 32 / rank 5 / 70 forks), so the solver path is the same here.
- *"the JS arm's walk stall … from the same capture"*: the capture run was wasm. The JS stall is inferred from the atlas
  (§2), not captured.

## 8. Residue

- Branch commits: the cherry-picked instrument, the capture, two evidence commits, this report. Nothing to land as-is.
- The full uncut capture (`cap-probe.jsonl`, all 116 atlas records per request) stayed in the session scratchpad and is
  not committed. The committed cuts replay unchanged.
- The `npm test` run recorded `treeMoved: true` (the run started with the capture uncommitted on top of `8fc6dd3c`, the "1 tracked change"; I committed it
  as `d2a6b6e0`, then evidence as `0e514f17`, while it ran). No code changed between the launch and those commits.
- No preset, `preset_files.json`, `output/` or test-results file was left in the tree. The dev server started here
  (PID 849) was stopped.

Not run: pytest, unfiltered vitest, `standing-values --write` (none were needed; no shipped code changed).
