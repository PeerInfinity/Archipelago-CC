# Seedling hammer-phase HK: three red producers, re-pinned or named

Slice `seedling-hammer-hk` (Opus, cloud). Planner: `seedling-hammer-phase-planning`.

- **Start SHA:** `5c4b07628a` (`origin/main`; `4b25b5895c` is an ancestor).
- **Branch:** `claude/seedling-hammer-hk-ogfmr7`. The harness assigned this name; the brief said `seedling-hammer-hk`.
- **Head:** the commit that adds this report. The commits before it are D1 `d1fc44ec4a`, D2 `fc172c46dc` and D3 `0978fa73cd`.
- **Evidence:** `CC/docs/cloud-reports/seedling-hammer-hk-evidence/` (`w0/`, `d1/`, `d2/`, `d3-vitest-bounded.txt`).

**Outcome: all three `--check`s are green at the head.** They are also byte-identical with each of DB's three dash
switches ON.

| producer | why it was red | fix | state at head |
|---|---|---|---|
| `plan-seedling-r9-l0-sword-dash` (2 tapes) | fidelity DASHFLIP `99fd021509` shortened the derived tail by 1 tick | **(a)** re-derived, re-recorded on p4f | green |
| `plan-seedling-r9-l6-sword-dash-hit` | the same commit, the same tail | **(a)** re-derived, re-recorded on p4f, `--mobiles` probe green | green |
| `plan-seedling-r7-ends-meet` | the page URL was a hardcoded `:8000` and no server was on it (environment, not code) | the producer reads `SEEDLING_PORT`; no fixture moves | green |

## W0, at `5c4b07628a`

Setup:
- `session_bootstrap.sh --seedling` printed READY.
- Six submodules showed `-` after READY and were initialised: bulletml-dodge, cavernous-ii, journey-to-ascension,
  omsi-loops, swfRecompilerPanel/browser and textAdventureEngine.
- Node v22.22.0.
- Server: `serve-nocache.py 9591` (PID 899) as `SEEDLING_PORT`. A second server on :8000 (PID 1056) was needed for
  the r7 measurement; it was killed by PID during D1 and is not running.

Defaults:
- Every switch is at its committed default. Nothing was set except `SEEDLING_PORT` where stated.
- DB's three dash switches are OFF.
- `DASH_WINDOW_ROSTER_WIDE` is `true` (DASHFLIP).

The full outputs are in `evidence/w0/`. Verbatim summaries:

```
r9-l0-sword-dash --check        exit 1
  FAIL: ⛓ the committed tape is what this script produces today — ⛔ DRIFT — re-run without --check
  FAIL: ⛓ the committed r9-l0-sword-dash-rest is what this script produces today — ⛔ DRIFT — re-run without --check
  2 CHECK(S) FAILED        (every other row PASS: 10 + 8)
r9-l6-sword-dash-hit --check    exit 1
  FAIL: ⛓ the committed tape is what this script produces today — ⛔ DRIFT — re-run without --check
  1 CHECK(S) FAILED        (11 other rows PASS)
r7-ends-meet --check            exit 1   (no server on :8000)
  PASS: r7-ends-meet-full is byte-identical to what this planner derives — 1668 bytes
  PASS: r7-ends-meet-1 is byte-identical to what this planner derives — 1422 bytes
  page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8000/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4f/game.html
      at latchOf (scripts/procgen/plan-seedling-r7-ends-meet.mjs:233:20)
r7-ends-meet --check            exit 0   (server on :8000)
  4 PASS … CHECK CLEAN — the committed chain is what the game produces today
```

What the drift is: re-running each sword-dash producer without `--check` changes **only `tick_count`**, by −1, in all
three tapes:
- `r9-l0-sword-dash`: 37 → 36, and the `right` hold's `to` follows;
- `r9-l0-sword-dash-rest`: 28 → 27;
- `r9-l6-sword-dash-hit`: 22 → 21.

No other input, and no description or note, moves.

## D1: why each one is red

### The two sword-dash producers: bisected to fidelity DASHFLIP

Both bisects were run in a scratch worktree with `git bisect run evidence/d1/bisect-run.sh <producer>`. The script
exits 0 when the check is green, 1 on DRIFT and 125 otherwise.
- Range: good `55eea9ac39` (the 2026-10-04 `hold: false` fix: "their --check is byte-identical again"; both measured
  green there) to bad `5c4b07628a`.
- Both logs are in `evidence/d1/bisect-*.log` and end the same way:

```
# first bad commit: [99fd021509cb8c7683ec76c7a8ea362af1066be9] seedling fidelity DASHFLIP D1: the game's dash window ON (DASH_WINDOW_ROSTER_WIDE = true)
```

**What changed: a default flip in the model.** The producers themselves did not change.
- The flip is in `combatVerbs.js`: `DASH_WINDOW_ROSTER_WIDE = false → true`, so `SLASH_ANIM_TICKS` switches from
  `SLASH_ANIM_TICKS_LEGACY` (dash 5) to `SLASH_ANIM_TICKS_GAME` (dash 4: `slashnarrow` wraps one update sooner, which
  the game witnessed). The user licensed it on 2026-10-05: *"Yes: flip + re-record"*.
- Each producer derives its tape's TAIL from that constant:
  - r9-l0: `TAIL = ceil(SLASH_DASH_FORCE / 0.25) + SLASH_ANIM_TICKS[SLASH_ANIM_DASH]`, so 8 + 5 → 8 + 4.
  - r9-l6: `TAIL = DASH_DISPLACEMENT.ticks + SLASH_ANIM_TICKS[SLASH_ANIM_DASH] + SLASH_HIT_TICKS`, so the total is −1.
- Every press, the schedule (`DASH_CHAIN.at` = 2, 8, 14; swallowed 4; discriminator 20) and every behavioural row
  pass under the flip. Only the padding after the last press is one tick shorter.
- DASHFLIP's re-pin list named "five of the six producers' `--check`s"; these two producers were not on it.

None of the expected movers is involved: the lapse flip `7a20beb2fd`, RE / DD, §5.82's seam offset, wave-16
`waypointSlide` and the `hold: false` fix. The bisect range starts after the `hold: false` fix, and the first bad commit
is the flip.

### `r7-ends-meet`: no red commit. The throw comes from the box, not the model or the solver

- `latchOf`'s throw is `page.goto` refusing the connection. Line 83 spelled
  `http://localhost:8000/…`, and nothing honoured `SEEDLING_PORT`.
- At DB's census base `dab1994e58`, in a scratch worktree with the p4f build linked, the outcome depends only on whether
  a server is listening on :8000:
  - **with** a server on :8000: CHECK CLEAN, exit 0;
  - **without** one: the identical `latchOf (…:233:20)` ERR_CONNECTION_REFUSED, exit 1.

  Both outputs are in `evidence/d1/`.
- So it is neither the solver's nor fidelity's model (`levelRun.js`, `levelWorld.js`, the latch publishers). Nothing goes
  to fidelity planning-8. There was nothing to bisect: the producer was green at both ends of the range whenever a
  server listened on :8000.

## D2: the fixes

### `r9-l0-sword-dash` and `r9-l6-sword-dash-hit`: (a) RE-DERIVE

Why (a) and not (b):
- Fidelity's precedent pins the moved switch OFF when the producer witnesses a PRE-flip behaviour. These producers do
  not. Their claims (the impulse, the decay, the swallow, the non-refresh, the re-arm, the dash rect, one hit) all hold
  under the flip; their behavioural rows were green at the base.
- What moved is a derived tail length: padding meant to outlive "the animation". Under the game's four ticks the
  shorter tail still outlives it, and is more honest.
- Each new tape is a strict **prefix** of the old one, so pinning `SLASH_ANIM_TICKS_LEGACY` inside the producers would
  keep a wrong constant only to preserve one tick of padding.

Proof on the game:
1. **Control.** `check-seedling-bot-differential --only=<the three>`, headless on p4f, against the committed tapes and
   expectations: ALL CHECKS PASSED.
2. **Re-record.** `--record --only=<the three>`, headless on p4f, with the re-derived tapes. Every new expectation is the
   old one **minus its last tick**: `ticks` 38 → 37, 29 → 28 and 23 → 22, `new == old[:len(new)]` for all three,
   and `transitions` unchanged.
3. **Re-compare.** The differential's default mode on the new pair passes. All three `--check`s print `all checks green`.
4. **The body.** The dash-rect enemy-side probe `probe-seedling-r9-dash-rect-mobiles.mjs` (trap 564: the expectation
   is the player's) is Windows-only (`/mnt/c/Windows/py.exe`). I ran a scratch copy that drives the same replay driver on
   its own `--headless` channel (`HEADLESS_WEBGPU_ARGS`), on **both** the old and the new tape. Both are green, 8 of 8 rows
   (`evidence/d2/dash-rect-mobiles.*.txt`):
   - the game registered a hit;
   - exactly one body was damaged;
   - **hits `[1]`**;
   - the body survived 1 of 3;
   - the i-frame was armed;
   - the body was thrown east;
   - the player took 0 hits.

   The sampled readings differ by about a tick of phase, because `--mobiles` samples rather than streams. The probe
   asserts shape, not per-tick values, and the shape is equal.

**The re-record is a ⚖ 40 checkpoint event.** Here is exactly what moves (before → after md5):

| file | before | after | change |
|---|---|---|---|
| `tapes/r9-l0-sword-dash.json` | `55e5a80f` | `e8171c0a` | `tick_count` 37 → 36; `right` `to` 37 → 36 |
| `tapes/r9-l0-sword-dash-rest.json` | `95cfedf4` | `2b9ab790` | `tick_count` 28 → 27 |
| `tapes/r9-l6-sword-dash-hit.json` | `68f7eddf` | `18c9ddad` | `tick_count` 22 → 21 |
| `expectations/r9-l0-sword-dash.json` | `bf4eeb17` | `b4238f56` | last tick dropped (38 → 37) |
| `expectations/r9-l0-sword-dash-rest.json` | `9654ff58` | `8fb9a814` | last tick dropped (29 → 28) |
| `expectations/r9-l6-sword-dash-hit.json` | `66860fc1` | `5d321fea` | last tick dropped (23 → 22) |

The producers' code changes only in comments: each TAIL docblock now names the flip and the re-derive. The headers' Run
lines still name `--win --record`. This re-record went through the headless channel, because the cloud box has no
Windows Chrome.

### `r7-ends-meet`: a producer fix, the port

`PAGE_URL` now reads `process.env.SEEDLING_PORT || '8000'`, spelled as in `derive-seedling-tick0.mjs`, with a docblock
saying why. No fixture moves.
- With `SEEDLING_PORT=9591`: CHECK CLEAN.
- Mutant (no server on the port): the original throw, as at the base.

This fits none of (a), (b) or (c): it is a producer defect that has nothing to do with the model.

### With DB's dash switches ON

Each switch was run alone (`SEEDLING_DASH_LEG_PRECHECK=1`, `SEEDLING_DASH_NO_SWING_PREFIX=1`,
`SEEDLING_DASH_KEEP_PARTIAL=1`) on all three producers. Outputs are in `evidence/d2/on/`.

| producer | OFF | precheck | no `[0]` | keep |
|---|---|---|---|---|
| r9-l0-sword-dash | green `1a469afa` | green `1a469afa` | green `1a469afa` | green `1a469afa` |
| r9-l6-sword-dash-hit | green `bf86d080` | green `bf86d080` | green `bf86d080` | green `bf86d080` |
| r7-ends-meet | green `f1675cfc` | green `4b4cacff`* | green `f1675cfc` | green `f1675cfc` |

\* The only differing line is `drove r7-ends-meet-1: 62 observations, 38 dead` versus `37 dead`. `dead_frames` is
the page's wall-clock counter: three re-runs under the pre-check read 38, 38 and 37, and two OFF runs read 38 and 38. It
is noise, not the switch.

**Nothing moves ON.** Why each producer is blind to the switches:
- The sword-dash producers are hand-scheduled. They never ask `planSwordDash`, so none of the solver switches is on
  their path.
- `r7-ends-meet` replays a hand-planned chain and SKIPs every solver-authored chain.
- None of the three reaches js-6's `dashOnlyWindow`. It lives only in `flashPanel/*` (the page and worker), and no
  producer imports it.

**For the flip:** these three add no re-record and no red. They do not need to be in the flip's re-pin list.

## D3: records

Records:
- `seedling-bot-log.md`: `### Seedling hammer-phase HK — three red producers`.
- `generate-procgen-reference.mjs`, then `--check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH. Moved: the
  README word count and `procgenDocs/generated/docsIndex.js`.
- `generate-docs-index.mjs`: wrote the same bytes (no change).
- Surface census `--check`: GREEN, 308 rows. Constants census `--check`: PASS, 6000 literals, 0 drift.

Bounded vitest (`evidence/d3-vitest-bounded.txt`): **16 files, 1414 tests, all green.** The files:
- the readers found by `rg -a` for the producer and fixture names: `director`, `iceTurret`, `levelRun`, `r7Acceptance`,
  `r8Acceptance`, `solverBot`, `boxLock`, `ciSummary`, `producerSegments`, `rerecordCampaign`, `walkMoves`;
- `tapeRunner`, `procgenDocs/generated`, `procgenDocs/docLinks`, `quickLaunch/generated`;
- `lintGateLabels`. No test label was touched.

**For the planner to dispatch** (cloud CI returns 403):
- `seedling-full-tier.yml` on `claude/seedling-hammer-hk-ogfmr7`, with `tier=mechanic` (the three tapes' category),
  `shards=10` and an empty `page` (the differential's p4f default). This gives the CI-channel replay of the re-recorded
  pair.
- Optionally, a local `--win` replay of the three tapes, so the real-GPU channel agrees with the headless recording.
- The unfiltered vitest number comes from CI at the pushed SHA (⚖ 52):
  `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`.

## What the brief got wrong (measured)

1. **"`r7-ends-meet`: throws in `latchOf` before any check."** Two checks PASS before the throw. The throw is
   `ERR_CONNECTION_REFUSED` on the producer's hardcoded `:8000`, so it comes from the box, not the model or the solver.
   It is green at DB's own base `dab1994e58` whenever :8000 is served. DB's census box evidently served a different port.
2. **The expected movers.** None of the five is the cause. Both sword-dash reds are fidelity DASHFLIP `99fd021509`
   (2026-10-05), which the list did not name.
3. **"A bisect-to-a-flip that the producer predates is usually (b)."** Not here. The flip moved derived padding, not
   a witnessed pre-flip behaviour, and the game agrees with the shorter tapes as exact prefixes. So the fix is (a).
4. **The branch name.** The brief said `seedling-hammer-hk`; the session's assigned branch is
   `claude/seedling-hammer-hk-ogfmr7`.

## Residue

1. **The other nine base reds are fidelity's,** as the brief scopes: axe-witness, bobsoldier2, f1-l5-open-lock,
   l30keylock, ladder2-witness, pushblock-witness, stance-witness, u10-puncher-dwell (DRIFT) and l40button-witness
   (throws).
   - ⚠ Before treating `l40button-witness`'s throw as a model defect, check it for the same hardcoded-port cause.
   - `rg -a -L SEEDLING_PORT` over the browser-driving `plan-seedling-*` files lists which producers still spell
     `:8000` inline. Not measured here, as out of region.
2. **The dash-rect mobiles probe is still Windows-only.** It hardcodes `py.exe` and `:8000`. This slice proved its claims
   with a scratch headless copy, not a committed change. Giving it a `--headless` default (as SWIM U13 did for
   `derive-seedling-tick0`) would make it runnable in the cloud and on CI.
3. **The recording channel.** The new expectations were recorded headless on p4f. The originals were `--win`
   recordings. The full-tier dispatch above (headless CI) and an optional `--win` replay close that gap.
4. **Tree hygiene.**
   - The scratch worktree `/home/user/hk-bisect` was removed by name (`git worktree remove`, then `prune`), after its
     `node_modules` and `seedling_bot_ap_p4f` links were removed.
   - Both servers were killed by PID: :8000 (PID 1056) and :9591 (PID 899).
   - The scratch copies are in the session scratchpad, not the tree.
   - The repository was unshallowed (`git fetch --unshallow`) for the bisect.
