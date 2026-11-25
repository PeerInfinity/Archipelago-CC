# AN-OMSI-3 — in-app rows for the omsi town (as-built)

Session `actionnodes-omsi2` (Opus; the AN-OMSI-2 session, continued), 2026-11-25, for planner
`concept-library-content-planning-5`. Branch `an-omsi3`, based on `origin/an-omsi2` `775449f1b3` (AN-OMSI-2, which
has its land OK and is queued as train 214). Code commit `1cb8bd2369`; this report is the commit after it.

**Robert's license** (2026-11-25, just before 03:05:35Z): "Both, in parallel" (AN-OMSI-3 and the AN-TIME design).

## 1. The rows and their batches

Both rows live in `frontend/modules/tests/testCases/actionNodesTests.js` and are enrolled in
`playwright_tests_config-substrates.json`, each placed after its category's existing rows.

**`an-omsi-town-load-and-act`**: category "ActionNodes", batch `fast`, 3–6 s.
- It loads `action_nodes_omsi_town/AP_3`. The runtime holds the town (`graphId` `omsi-first-town`), with one node per
  preset node, and there is a card per node (20 of 20).
- Each forward neighbour of the start (Wander, Smash Pots, Fight Monsters, Heal The Sick, Small Dungeon, Haggle, Buy
  Supplies) shows its `N mana`, `0/limit` and every `needs` entry as the payload states it. That includes Buy
  Supplies' **Gold 6** (Q5) and the Combat 2 / Magic 2 pair (Q3).
- The goal's supplier is blocked at load with its unmet line. The supplier is found as the node whose result the goal
  requires, so the row does not name Buy Supplies.
- One performance: the first free check node next to the start (Wander) is played through the Loops queue. It runs
  with no refusal, is counted once, pays its authored price, sends its check (which holds Combat Training at seed 3)
  and shows the check mark.
- Every number is read from the preset; none is typed in the row.

**`an-omsi-bot-plays-to-goal`**: category "Playback Bot", batch `playback-bot`, 21–24 s.
- The example's `an-bot-plays-to-goal` body is factored into `botPlaysPresetToGoal(tc, {path, logName, loops,
  finishMs})`. The example row calls it unchanged.
- The town row adds the EXACT pin: the in-app loop count = the pure planner's = the headless live path's =
  `OMSI_TOWN_BOT_LOOPS` (**7**, XP scale 1).
- That constant is the one typed number. Its comment points at the headless pin in
  `actionNodesTownScale.slow.test.js`, which is the same 7.
- Measured in-app: `finished — 7 loops`; "pure planner: goal in 7 loop(s); headless live: 7; in-app (Instant): 7"; it
  replans mid-loop and names the Q1 attempt.

**Mutation.** With `OMSI_TOWN_BOT_LOOPS = 6`, the row goes red: `the pure planner's loop count is the pinned 6:
expected 6, got 7`. The constant was then restored.

**Pins (the in-app-tests memory).**
- Each row sets its own state: it loads its preset, uses `freshQueue()` (Instant, no auto-restart, a reset loop), and
  restores in `finally` with Loop mode off.
- pure == live is asserted exactly as the example does.

**Roster** (enabled rows in the substrates config, base → tip): ActionNodes 13 → 14, Playback Bot 10 → 11; total
461 → 463. No other row moved.

## 2. Local runs (port 8131, own server, stopped after)

- Each row solo: PASSED.
- `--batch=fast`: **137/137** passed in roster order; the town row is 119th, 6.0 s.
- `--batch=playback-bot`: **19/19**; the town bot is 17th, 23.7 s.
- Local spans: fast 452.6 s (75 %, past the 70 % warn), playback-bot 365.1 s (61 %).
  - ⚠ The local fast WARN is the box, not the row. The load average was about 3.3 from other sessions, and the row is
    6.0 s of the span: without it the span is 446.6 s, still 74 %.
  - The budget is graded on CI, where the base measured 54 % (§ 3).

## 3. Headroom before → after (CI)

| Batch | Base `775449f1b3` (TT 45533463543) | Tip |
|---|---|---|
| fast (unbundled) | 324.9 s, 54 % | see § 5 |
| fast (bundled) | 339.4 s, 57 % | see § 5 |
| playback-bot | 208.0 s, 35 % | see § 5 |

## 4. Gates (local)

- Both ActionNodes presets are byte-identical (`action-nodes-compile.mjs --check`). No preset is in the diff.
- Gitlinks 0. Closure ∩ diff = ∅ (`a3565f4e6866438e`).
- Bounded vitest: `frontend/modules/tests`, `scripts/test`, `procgenDocs/`, `quickLaunch/`,
  `tutorials/tutorials.test.js` and `actionNodes/`. 46 files: 1,160 passed, and the one red was `generated.test.js`
  before the regeneration; `procgenDocs/` is 497/497 after it.
- `generate-procgen-reference.mjs --check`: match, after regenerating the docs index (the docs line moved its word
  count).
- `check-procgen-docs.mjs`: all passed.
- `action-nodes.md` names both rows. It has no new link or heading, so the link census stays at 453.

## 5. CI at the tip, and the repeat rate

The run ids, the headroom at the tip and the `test-substrates-repeat.yml` ×8 rate for `an-omsi-bot-plays-to-goal`
are in the planner's report back and in memory. A commit cannot quote its own runs.

## Next

The omsi town is closed with these rows. Once AN-OMSI-2 lands, merge its landed main into `an-omsi3` once, at the end.
