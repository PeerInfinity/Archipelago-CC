# AN-OMSI-3 — in-app rows for the omsi town (as-built)

Session `actionnodes-omsi2` (Opus; the AN-OMSI-2 session, continued), 2026-11-25, for planner
`concept-library-content-planning-5`. Branch `an-omsi3`, based on `origin/an-omsi2` `775449f1b3` (AN-OMSI-2, which
has its land OK and is queued as train 214). Code commits `1cb8bd2369` and `a909998e38` (the fix in § 6); this report is the commit after them.

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
  with no refusal, is counted once, sends its check (which holds Combat Training at seed 3) and shows the check mark.
- The pool is then read once the check's item has landed: price paid + the node's mana result + the item's boost from
  the preset's `boosts` table (100 − 13 + 0 + 10 = 97). See § 6.
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

**Repeat rate at the first tip `3c7dc4f968`** (`test-substrates-repeat.yml`, `an-omsi-bot-plays-to-goal` ×8): run
`45540468665`, **8/8 passed**.

The run ids at the final tip, the headroom there, and the ×8 rates (the bot row, and the town row after § 6) are in
the planner's report back and in memory. A commit cannot quote its own runs.

## 6. A defect my first CI run found (fixed)

**What happened.** TT `45540462287` at `3c7dc4f968`: the fast batch (unbundled) failed on `an-omsi-town-load-and-act`,
on the condition *the pool paid the node's authored price*: expected 87, got 97. The bundled boot, the local solo runs
and the local fast batch had passed.

**The cause.** It was a race in the row, not the runtime. Wander's check holds Combat Training. A received item adds
its starting-mana boost (+10) to the pool at once (A4), but it arrives through the state worker, asynchronously. The
local runs read the pool before the item landed (87); CI read it after (97).

The example's `an-load-and-act-once` never met this: it performs a non-check node.

**The fix** (`a909998e38`). The row waits for the check to be sent, then polls for the pool to equal price paid +
result + the item's boost (read from `action_nodes[p].boosts[<item>].mana`). It logs the sum. Solo ×3 locally:
PASSED, `pool: 100 - 13 (price) + 0 (result) + 10 (Combat Training) = 97; now 97`.

The town row also gets a ×8 repeat dispatch (§ 5), beside the bot row's.

## Next

The omsi town is closed with these rows. Once AN-OMSI-2 lands, merge its landed main into `an-omsi3` once, at the end.
