# seedling-fidelity-producers — the red `plan-seedling-*.mjs --check` producers, attributed and pinned

Planner `seedling-fidelity-planning-8`, wave 18, housekeeping. **No model, solver or `CONTACT_FIDELITY` change.**

| | |
|---|---|
| Start SHA | `d1fbfeffc2` (= main at brief time: wave 17 harvested OFF) |
| Head | see the final chat line (the commit carrying this report) |
| Harness branch | `claude/seedling-check-producers-roug5p` (the brief's `seedling-fidelity-producers` name is the harness's branch here) |
| Box | 4 cores, Node 22.22.0; `SEEDLING_PORT=9688` plus a second server on **:8000** for `r7-ends-meet` |

**Outcome: D1 PASS, D2 PASS (every red attributed, all class (a)), D3 PASS (9 producers pinned, byte-inert),
D4 PASS (proposal, not wired). Final gate: 59/61 GREEN, the two reds are the hammer arc's (unchanged).**

The one thing to know first: **every red was a flip whose re-pin list missed the producer**, and every moved tape
is a ROSTER GAME WITNESS. A `--write` would have re-recorded unwitnessed plans over game witnesses and moved the roster
beyond the producer's own output, so I did not `--write`: each producer now pins the flipped switch(es) OFF as a named
INTERIM — exactly what each flip already did to the matching vitest rows ("game-witnessed under the pre-flip …").

## W0

- `git status` clean at `d1fbfeffc2`; `session_bootstrap.sh --seedling` → `READY`.
- Bounded vitest BEFORE (base worktree) — the 10 files that import a touched producer plus contactFidelity,
  fidelityKillLock, fidelityLadder2, fidelityF1, spearPush, r8Acceptance, tapeEnvelope, tapeIndexManifest
  (18 files): **609/609**, 87 s. AFTER (head): **609/609**, 107 s.
- Two gates are red at the BASE on this box and are not this slice's (each measured at the base AND at my edits,
  same rows): `check-procgen-help.mjs` → 26 IMPORT-door rows (u10 among them: a top-level script, unchanged by the
  pin); `check-procgen-reference.mjs` → `registry.js DIFFERS` (the substrate registry regenerates 1,546 lines shorter
  here; a box/submodule effect). The part my edits could move, `generated/instruments.js`, regenerates
  byte-identical (the producers' header docblocks are untouched).
- Identity block / tapeRunner pairs / surface / constants / roster: not re-run — the diff touches only nine
  `scripts/procgen/plan-seedling-*.mjs` entry points (no module the solver, the runner or any vitest imports changes
  behaviour; exports untouched) and no committed tape or fixture. Byte-inertia is by construction and by the
  per-producer `--check` (each compares its committed tapes byte for byte).

## D1 — the census (PASS)

61 producers carry `--check` (`grep -al -- --check scripts/procgen/plan-seedling-*.mjs`), run 4 at a time.
Full table with wall times and the first differing row:
`seedling-fidelity-producers-evidence/census-base-d1fbfeffc2.tsv` (runner `run1.sh` beside it).

| verdict at `d1fbfeffc2` | producers |
|---|---|
| GREEN (49) | everything not below |
| RED, DRIFT (ours, 8) | axe-witness, bobsoldier2, f1-l5-open-lock, l30keylock, ladder2-witness, pushblock-witness, stance-witness, u10-puncher-dwell |
| THROWS (ours, 1) | l40button-witness — `SolverRefusal` in `lobberHoldRefusal` (l41-part0's hold inside `bombpusher@112,128`'s 256 px reach) |
| RED (hammer's, 2) | r9-l0-sword-dash, r9-l6-sword-dash-hit — "the committed tape is what this script produces today" |
| env | r7-ends-meet — THROWS `page.goto ERR_CONNECTION_REFUSED` on a :9688-only box (`PAGE_URL` hardcodes `localhost:8000`); with a server on :8000 → GREEN, 14 s |

First differing rows (ours): every DRIFT row is "the committed `<tape>` is what this script produces today"; in
addition bobsoldier2 fails "both switches OFF: the staging REFUSES on the kill arm's dwell" and the chaser-arm kill row,
f1-l5-open-lock fails "the open-lock arrival DECLINES … — it solved" and the one-body row, u10 fails the refused
control's "FORECAST refuses the stance BY THE PUNCH at a named tick" and "the MODEL … is PUNCHED at exactly that tick".

Wall times (4-way contention): sum 1,729 s; long poles hammer-bw-bombstand 775 s, l40button-witness 248 s (its green
runs: 462 s at `abe57895`, 551–635 s here under load), hammer-sf-strikefloor 263 s, hammer-g1-ghostkill 176 s,
l12keyline-witness 60 s; 56 producers under 25 s.

## D2 — attribution (PASS: 9 of 9, all class (a))

Method: a worktree per producer at its last `--write` commit (each verified GREEN there first), `git bisect run` on
the producer's `--check`, then the REVERSE at the base: the named switch alone turned back OFF (env) must make the
producer green. Where it did, that flip is the whole drift.

| producer | last `--write` (green) | first bad | class | the flip | reverse at base |
|---|---|---|---|---|---|
| stance-witness | `09bdcb15` | `41b0bc6389` | (a) | wave-16: `waypointSlide` ON (⚖ 2026-10-14) | `SEEDLING_WAYPOINT_SLIDE=0` → green |
| axe-witness | `3ee21865` | `41b0bc6389` | (a) | same | `SEEDLING_WAYPOINT_SLIDE=0` → green (CEREMONY_SHOVE / BUTTON_FALL_RELEASE_STEP / LAVA_CHAIN_PLAYER_HIT =0 each stay red) |
| bobsoldier2 | `eee40239` | `19aaa5cce4` | (a) | lapse flip: `strikeIframeLapse` ON ("Flip after DD lands") | `SEEDLING_STRIKE_IFRAME_LAPSE=0` → green |
| l30keylock | `0f5a4a8e` | `19aaa5cce4` | (a) | same | → green |
| pushblock-witness | `4af8a4f7` | `19aaa5cce4` | (a) | same | → green |
| u10-puncher-dwell | `98bc2325` | `19aaa5cce4` | (a) | same | → green |
| f1-l5-open-lock | `9f67c269` | `a60db8638c` | (a) | wave-12: `baitForecast` ON (⚖ 2026-10-11) | `SEEDLING_BAIT_FORECAST=0` → green (STANCE_ROCKS=0, AXE_DODGE_ASK_PER_PREVIEW=0 stay red) |
| ladder2-witness | `bf527413` | `d9f182f71d` | (a) | wave-8 harvest: KILLLOCK `jellyfishLive` ON (⚖ 2026-10-06) | `SEEDLING_KILLLOCK_BODIES` without `jellyfishLive` → green |
| l40button-witness | `abe57895` | `3e6f048cd3` (the throw) + `19aaa5cce4` | (a) ×2 | wave-13: `bombPusherLive` ON (⚖ 2026-10-11) and the lapse flip | defaults minus `bombPusherLive` → no throw but l41 DRIFT + l42 `BotDriverV2Error`; minus both → green (635 s) |

Notes:
- Every one of these flips pinned the producer's own VITEST rows OFF for this reason (fidelityStance's chest /
  keylock-open rows `waypointSlide: false`; fidelityBobSoldier2 / fidelityL30KeyLock / spearPush's L65 row
  `strikeIframeLapse: false`; fidelityF1 kept the decline as the `baitForecast: false` control; fidelityL40Button's
  solve rows `bombPusherLive: false`) and missed the producer, which no CI job runs.
- **ladder2's bisect trap.** The plain exit-code bisect named `00162ef0` (BOBSOLDIER D1+D2) — wrongly: that commit and
  the next six on the first-parent chain CRASH (`r8Acceptance.js` `SyntaxError: Unexpected token '*'`, a comment
  opener lost in a union, fixed by the wave-8 harvest). A fingerprint walk of the derived tape along the first parent
  (`bf527413` 9b8fd795 = committed → 7 × CRASH → `d9f182f71d` fbb79dcc, moved) and the KILLLOCK reverse settle it.
  Bisect on the DRIFT row with a crash read as skip, never on the exit code alone.
- Not (b): no producer caught an unintended regression. Not (c): no throw is a stale contract (l40button's throw is
  the ON model's own named refusal; the BotDriverV2Error is the lapse moving the plan).

## D3 — the fix (PASS: 9 commits, one per producer)

Each producer wraps its `main()` in the pin (`withContactFidelity` / `withKillLockBodies`, the switch restored after);
u10 is a top-level script and pins `CONTACT_FIDELITY` for its process before anything is staged. Each pin carries a
`⚖ PINNED … OFF — an INTERIM` docblock naming the flip, why, and "⛔ RETIRE THIS PIN with a re-record ON … the user's
licence". After: every one `--check` GREEN. Mutants (pin set `true`, by copy + restore, predicted = the base's rows):
stance 4 FAIL, u10 4 FAIL, f1 3 FAIL, ladder2 1 FAIL, l40button with the lapse alone ON → the l41 DRIFT and the l42
`BotDriverV2Error` (550 s) — each exactly the base's red.

| commit | producer | pinned OFF |
|---|---|---|
| `ced0e0d1` | stance-witness | waypointSlide |
| `cb671806` | axe-witness | waypointSlide |
| `18a3a062` | bobsoldier2 | strikeIframeLapse |
| `cbd050a3` | l30keylock | strikeIframeLapse |
| `43fc31c0` | pushblock-witness | strikeIframeLapse |
| `301bc9e7` | u10-puncher-dwell | strikeIframeLapse |
| `6e328b3d` | f1-l5-open-lock | baitForecast |
| `10792929` | ladder2-witness | KILLLOCK jellyfishLive |
| `905cc80f` | l40button-witness | bombPusherLive + strikeIframeLapse |

### ⛔ STOP: the licence question (the re-record ON is NOT done)

A `--write` under today's defaults moves these committed roster tapes (tick counts committed → ON), and with them the
roster rows that name them (`index.json`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`,
`r8Acceptance` exposure, `seedling-entity-witnesses.json`, u10's profile witnesses / dead-frame observations,
bobsoldier2-torch's `pickup-removal-witness.json`) — and none of the ON plans is recorded on the game:

| producer | tape | ticks committed → ON | ON `--write` exit |
|---|---|---|---|
| stance-witness | stance-l46-chest / l48-chest / l48-keylock-open / l48-keylock-south | 1044→868, 540→449, 454→231, 369→322 | 0 |
| axe-witness | axe-l48-reach-l49 | 368→330 | 0 |
| bobsoldier2 | bobsoldier2-l30-dash-stance / -torch | 145→168, 460→395 | **1** (its OFF-refusal and chaser-arm rows fail ON) |
| l30keylock | l30keylock-pit224 / -pit240 | 347→320, 360→341 | 0 |
| pushblock-witness | pushblock-l65-reach-l68 | 347→345 | 0 |
| u10-puncher-dwell | u10-puncher-dwell / -refused | 200→200 (keys move), 34→50 | **1** (the refused control loses its punch tick) |
| f1-l5-open-lock | f1-l5-open-lock-bait | 437→90 | **1** (ON the arrival detours instead of declining) |
| ladder2-witness | ladder2-l104-beam | 278→261 | 0 |
| l40button-witness | l40button-l41-part0 / l42-part0 | — | THROWS (the lobber refusal) |

Retiring a pin = re-derive ON, record on the game (p4f, 0 px), re-pin those roster rows; for bobsoldier2 / u10 / f1 /
l40button the producer's own assertions also change meaning (they are the OFF control's witnesses), so those are
modelling questions, not re-records. That is the user's call; nothing here moved.

## D4 — a guard (PASS: proposed, not wired)

`seedling-fidelity-producers-evidence/seedling-producer-checks.draft.yml` — a manual `workflow_dispatch` (input `only`),
the set ENUMERATED at run time (`grep -l -- --check`), four shards:

| shard | content | wall (measured here) |
|---|---|---|
| bombstand | hammer-bw-bombstand | ~13 min |
| l40button | l40button-witness | ~4–9 min |
| browser | r7-ends-meet (wasm submodule, Chromium, a server on :8000) | ~15 s + setup |
| rest | the other 58, 2 at a time | ~720 s CPU → ~6–8 min |

Wall ≈ 15 min. The summary prints producer / verdict / wall / first FAIL row. Optional: drop r7's hardcoded port for
`SEEDLING_PORT` (the hammer arc's file; not touched).

## Final gate (the full `--check` set at the head)

At `905cc80f` (the last code commit; the records after it touch no producer), 3 at a time, a server on :8000:
**59 GREEN, 2 RED** — `r9-l0-sword-dash` and `r9-l6-sword-dash-hit` (the hammer arc's; same row as at the base).
Every one of our nine is GREEN; `l40button-witness` 514 s, `hammer-bw-bombstand` 850 s, `r7-ends-meet` 12.5 s; sum
2,132 s. Table: `seedling-fidelity-producers-evidence/census-head-905cc80f.tsv`. The l40button bisect on the throw
text (from `abe57895`) confirms `3e6f048cd3` as the throw's first bad commit.

## Survey / sweep rows this moves

**None.** No model, solver, walker or switch default changed; only producer entry points. No survey or sweep
dispatch is owed for this slice. The one dispatch worth running is the D4 workflow once adopted
(`seedling-producer-checks.yml`, ref = the harvest tip) as the flip gate's `--check` row.

## JS arc

No pin of theirs moves; nothing to wire.

## Handed to the hammer arc (read-only here, no edits)

- `r9-l0-sword-dash`, `r9-l6-sword-dash-hit`: RED at the base and at the head. No contact or KILLLOCK switch clears
  them (`STRIKE_IFRAME_LAPSE=0`, `WAYPOINT_SLIDE=0`, `CEREMONY_SHOVE=0`, `KILLLOCK_BODIES=none`,
  `CONTACT_FIDELITY=none` all stay red). Today's drift: each derived tape is ONE TICK SHORTER (`r9-l0-sword-dash` 37→36
  and its `-rest` 28→27; `r9-l6-sword-dash-hit` 22→21). The first drift is older: bisect from the tapes' last write
  `bd0cfc1d` (2026-08-26) names `4cf5c3cd` (tape v12 `hold`, 2026-09-27), where the derived tape gained a `"hold":
  false` field; the bytes moved again after it (the derived md5 at `4cf5c3cd` ≠ at the base).
- `r7-ends-meet`: GREEN — but only with a server on :8000; `PAGE_URL` ignores `SEEDLING_PORT`.
- `plan-seedling-hammer-bw-bombstand`: GREEN, its lapse-OFF INTERIM left as is.

## Deltas / what the brief got wrong (measured)

- "Nine RED" is right for ours, but `r7-ends-meet` is not red: it is a port assumption (green with :8000).
- ladder2 has been red since **2026-10-06** (wave-8 KILLLOCK), not a recent move; its range is unbisectable by exit code.
- The wave-12 flip commit (`a60db8638c`) says *"None moves a committed tape, producer --check or identity row"* —
  `f1-l5-open-lock --check` did move.
- The brief's D3(a) remedy ("re-record with `--write`") does not fit here: every moved tape is a roster game witness,
  so the `--write` is a licence question; the in-scope fix with the meaning unchanged is the switch pin.
- l40button is two flips, not one.

## Residue

- The help gate (26 import-door rows) and the reference check (`registry.js`) are red at the base on this box; not
  attributed here.
- Nine INTERIM pins to retire (above), each with a game re-record or a modelling decision.

## Byte-inertia

`git diff d1fbfeffc2..HEAD --stat`: nine `scripts/procgen/plan-seedling-*.mjs`, the bot-log entry, this report and its
evidence directory. No tape, fixture, module, test, workflow or gitlink changed.

## CI (`JavaScript Unit Tests`)

- At `174427ef` (run 38956633847): 20,558 / 3 failed — `docsRender` ×2 and `generated.test.js`, all the docs index
  not regenerated after the bot-log entry (headings 1094 → 1095). Base `d1fbfeffc2` (run 38939519530): 20,561 / 0.
- Fixed in the next commit: `generate-procgen-reference.mjs`, keeping ONLY `docsIndex.js` and the README's
  docs-index region (the registry / capabilities churn it also writes on this box is the box's; CI regenerates those
  byte-identical). `docsRender.test.js` green locally. The verdict at the final head is in the final chat line.

## Rows to BANK

- `--check` census at `d1fbfeffc2`: 49 GREEN / 9 ours red / 2 hammer red / r7 env (the TSV).
- `--check` at the head: 59 GREEN / 2 hammer red (r9-l0-sword-dash, r9-l6-sword-dash-hit), at `905cc80f`.
- Bounded vitest (18 files): 609/609 before and after.
- Trap candidate: **a `plan-seedling-*` producer is outside every CI job, so a flip's re-pin list misses it** (9 of 9
  here); and **bisect a producer on its DRIFT row, not its exit code** (ladder2's 7 crash commits).
