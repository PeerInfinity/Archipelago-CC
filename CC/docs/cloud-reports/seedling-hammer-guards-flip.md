# Seedling HAMMER-PHASE GF — the press-kill guards flipped ON

Slice `seedling-hammer-guards-flip` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User, 2026-10-23:
*"Yes, please go ahead with that plan"*: flip both press-kill guards ON first, then `STRIKE_ETA_FLOOR` in its own
slice. Evidence is in [`seedling-hammer-guards-flip-evidence/`](seedling-hammer-guards-flip-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | `45e27e95e8` (`origin/main` at the fetch) |
| branch | `claude/seedling-hammer-guards-flip-c9xrij`. This is the session's designated branch, not the brief's `seedling-hammer-guards-flip`. Nothing went to `main` |
| W0 merge | `9a09934e`: GS (`origin/claude/seedling-hammer-guards-sweep-50gb88`) and SF3 (`origin/claude/strike-eta-floor-remeasure-fb3k63`), as one octopus merge. Only `CC/docs/cloud-reports/**` changed (97 files) |
| F1 + F2 | `acba4137` (one commit) |
| head | the commit that adds this report (see `git log`) |
| box | 4 cores, node v22.22.0 |

## 2. W0: the OFF baseline (at `9a09934e`)

- **Bounded vitest** (the brief's 12 files, by path, `--maxWorkers=3`, ⚖ 52; `vitest-files.txt`): **274 / 274**
  (`vitest-off.txt`).
- **`ci-producer-checks.mjs --jobs=4`**: **93 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, browser-only by
  design) (`prod-off.txt`).

## 3. F1: the flip, and every reader

`frontend/modules/seedlingDemo/pressKillGuards.js`:

| | before | after |
|---|---|---|
| `PRESS_KILL_SHAKE_GUARD.enabled` | `…SEEDLING_PRESS_KILL_SHAKE_GUARD === '1'` | `… !== '0'` |
| `PRESS_KILL_SHAKE_GUARD_DEFAULT` | `false` | `true` |
| `PRESS_KILL_REBOOT_GUARD.enabled` | `…SEEDLING_PRESS_KILL_REBOOT_GUARD === '1'` | `… !== '0'` |
| `PRESS_KILL_REBOOT_GUARD_DEFAULT` | `false` | `true` |

This is `STRING_PULL_FAST`'s flipped shape, so the page's worker (no `globalThis.process`) reads ON. Measured in node:
the defaults print `true true true true`, and with both env vars `=0` they print `false false true true`. The docblock
now says ON, with the ruling, its date, GS's numbers and the opt-outs.

**Readers** (`rg -a` over the tree, excluding the cloud reports), and what was done with each:
- `solverBot.js:195`, the import comment *"(…, OFF)"* → *"(…, ON since GF)"*. This is a comment only; no logic was
  edited. The two `.enabled` reads (HO1's catch and HO2's ledger check) are unchanged.
- `docs/json/developer/procgen/seedling-bot.md` § *The press kill's two guards*: **OFF → ON**, the opt-outs, and the
  movers paragraph. The old *"ON moves no … producer `--check`"* was wrong (GS § 4), so it now names the two
  producers and how GF kept them.
- `hammerPressKillGuards.test.js`: the docblock, `OPTED` (now `=== '0'`) and the "ship" row (§ 4).
- `seedling-solver-surface.json` lists the file only (`"pressKillGuards.js"`). The census is unmoved (§ 5).
- `seedling-bot-log.md`'s LB entry is history and stays. GF's entry is new (§ 5).
- `plan-seedling-hammer-dd-walkkill.mjs` and `-bw-bombstand.mjs`, `pressKillCost*`, `hammerRefugeCut`,
  `hammerPressBombs` and `hammerPressKillDoneOnWalk` match only `withPressKill…` prefixes of *other* switches
  (`withPressKillDoneOnWalk`, `withPressKillBombs`, `withPressKillCost`). They are not readers.
- No `entityBlocks` or procgen-constants reader exists. `census-seedling-constants` is green.

## 4. F2: what moved, before → after

The reboot guard refuses the press kill at the first death inside it. Both moved witnesses are ghost-sword press kills
from staging A that **cross the chaser's death and then land the kill**. That kill is what each witness is about. The
game played the walk, and its rows of the killed spinner are committed beside the tape. ON, the kill never lands. So
each witness's premise is OFF-specific. In every case I chose to **pin OFF** and **add an ON sibling**. No tape or
fixture byte changed (`git diff --stat -- frontend/modules/seedlingDemo/fixtures` is empty).

| item | before | after | choice, and why |
|---|---|---|---|
| `hammerGhostKillRung.test.js` › *ON: the rung asks the press kill, and the solve's executed prefix IS the witness* | guards unpinned (OFF by default), `perTick.length` 2195 = witness | pinned **guards OFF** (`solveA(true, false)`: `withPressKillShakeGuard(false, …)` ∘ `withPressKillRebootGuard(false, …)`), still **2195**, key for key | **pin OFF.** The row asserts the solve *is* the game-witnessed walk, with landings at t2114 and t2182 after the death at t1216. ON cannot reproduce it, so pinning 1216 here would erase the claim |
| new sibling: *ON, with the press-kill guards at their shipped ON: the kill is refused at the death (t1216) …* | — | guards ON: message names `PRESS_KILL_REBOOT_GUARD`; `perTick.length` **1216**; prefix = witness keys `[0, 1216)` | **re-pin ON.** Measured 1216 (= GS / LB) in 113.5 s. It also proves the ON solve is the witness up to the death, so the two answers part only at the guard |
| `hammerStrikeEtaFloor.test.js` › *ON: the solve's executed prefix IS the witness* | floor ON, guards unpinned, 1629 = witness | `solveOn(false)`: floor ON, **guards OFF**, still **1629** | **pin OFF**, for the same reason: the kill lands at t1616, after the death at t778 |
| new sibling: *ON, with the press-kill guards at their shipped ON: … (t778) …* | — | floor ON, guards ON: `PRESS_KILL_REBOOT_GUARD` refusal, **778**, prefix = witness `[0, 778)` | **re-pin ON.** Measured 778 (= GS / LB) in 40.8 s |
| `hammerPressKillGuards.test.js` › *ship OFF* | `enabled` and `_DEFAULT` all `false`; skipped under `=1` | › *ship ON (the user's flip, hammer-phase GF, 2026-10-23)*: all `true`; skipped under `=0` | flips with the defaults |
| `plan-seedling-hammer-g1-ghostkill.mjs` | `ghostKillSolve` unpinned; ON would be red (GS: *"killed at tundefined"*) | `ghostKillSolve` runs inside `guardsOff(…)`; header § *THE PRESS-KILL GUARDS ARE PINNED OFF HERE*; `--check` **byte-identical**, rc 0 (125.7 s) | **(i) pin OFF.** Its witness is the kill. ⛔ Re-recording ON would rewrite a game-witnessed tape against the model alone |
| `plan-seedling-hammer-sf-strikefloor.mjs` | `strikeFloorSolve` unpinned; ON red (*"ON's press kill moved"*) | both its solves (floor OFF / ON) inside `guardsOff(…)`; `--check` **byte-identical**, rc 0 (149.2 s) | **(i) pin OFF.** Its witness compares the two floors' kills, and those kills exist only with the guards OFF |
| generated: `docs/json/developer/procgen/README.md`, `frontend/modules/procgenDocs/generated/docsIndex.js` | — | re-run by `generate-procgen-reference.mjs` (word counts) | mechanical |

Under the flip both producers' tapes stay what they were. Their `--check` re-ran ON and with `=0`, and was green and
byte-identical both times, so there was nothing to `--write`.

## 5. F3: the gates

| gate | result |
|---|---|
| bounded vitest ON (same 12 files; `vitest-on.txt`) | **276 / 276** = 274 + the two ON siblings. No other `rg -a` hit names either switch (§ 3), so the set did not grow |
| `ci-producer-checks.mjs --jobs=4` ON (`prod-on.txt`) | **93 run, 0 red**, 1 skipped |
| the same, `SEEDLING_PRESS_KILL_SHAKE_GUARD=0 SEEDLING_PRESS_KILL_REBOOT_GUARD=0` (`prod-ctl0.txt`) | **93 run, 0 red**, 1 skipped |
| `census-seedling-solver-surface.mjs --check` | GREEN, 343 rows (nothing to `--write`) |
| `census-seedling-constants.mjs --check` | PASS (0 new + 0 vanished) |
| `generate-procgen-reference.mjs` → `check-procgen-reference.mjs` | 0 findings → ALL CHECKS PASSED |
| `scripts/quicklaunch/generate-docs-index.mjs --check` | OK (191 docs) |
| **JSUT** at `acba4137`, run **39978468252** (`ci-summary.mjs`) | suite **22,244 passed / 0 failed / 0 skipped**; slow battery **264 / 264** |
| the same run's gates (`ci-summary.mjs --run=39978468252 --gates`) | **every row exit 0**. Summary: *"45 same, 9 MOVED, 1 shallow, 6 not-banked, 0 MISSING"*, but only **4** rows print `MOVED` (that mismatch is the tool's, not explained here). None of the 4 is the flip's (below) |
| `seedling-bot-log.md` | `### Seedling hammer-phase GF — the press-kill guards flipped ON` |

**The four printed MOVED rows, attributed:**
- `producer: plan-seedling-r7-attribution --check`: the same md5 MOVED in the W0 run (39974808316, docs only, guards
  OFF), so it predates this slice.
- `producer: plan-seedling-r7-ends-meet --check`: exit 0, which is its byte-identity oracle. It drives the wasm game
  along a hand-authored walk and imports no solver module (`playthroughWalk.js`, `r7Acceptance.js`, `tapeFormat.js`),
  so the press kill is unreachable from it. The md5 moved on its stdout.
- `gate: seedling-editor-refusal` 20 → 21 rows and `gate: seedling-wasm-ship` 263 → 415 rows: these are row-count
  growth against an older bank, all green. Neither gate reads `pressKillGuards.js`.
- ⚠ There is **no CI OFF control** at the start SHA. Main's runs there (39887407926) and at `b9eb82d5` skipped their
  gate jobs (*"Same SHA already green?"*), and the W0 run's gates are partial (34 MISSING). So these four are
  attributed by reading, not by an A/B.

The report commit re-runs the docs index (this report and the log entry move its word counts). JSUT re-runs on that
push; the planner reads it there.

## 6. What the brief got wrong (measured)

1. **"re-record with each producer's own `--write`"**: neither producer has `--write`. Both **write by default**, and
   `--check` is the dry run (their headers: *"node … # write the tape"* / *"… --check # exit 1 on drift"*). Also, with
   the solves pinned OFF there was nothing to re-record: both tapes are byte-identical.
2. **"`ci-producer-checks` … 0 red"** after a flip implied the producers would be re-recorded. Re-recording them ON
   would have rewritten **game-witnessed** tapes from the model, which the brief itself forbids. Pin-OFF (choice (i))
   was the only honest option for both, not just for g1.
3. **The witness rows' premise** is OFF-specific for **both** rows, not only possibly so. Re-pinning either row to
   1216 / 778 in place would turn *"the executed prefix IS the witness"* into a claim about a prefix. So each row
   stays OFF, and the ON number lives in a sibling.
4. **The branch name**: the session's designated branch is `claude/seedling-hammer-guards-flip-c9xrij`, not
   `seedling-hammer-guards-flip`.
5. **The bootstrap again left six submodules uninitialised** after `READY` (as in GS item 6 and LB item 7). I
   initialised them; no gitlink moved. It also leaves `requirements.txt` and `worlds/zillion/requirements.txt`
   modified in the tree. I did not stage either.

## 7. Residue and hand-overs

**For the `STRIKE_ETA_FLOOR` flip slice (runs on top of this):**
1. **SF3's whole re-record table was measured with the guards OFF**, so it is the OFF-guards table. Re-measure it at
   this head before re-pinning anything. Any row whose solve crosses a death inside a press kill now refuses there.
   One example is `hammerPressKillGuards`'s HO2 rows, which SF3 saw move 1202 → 788 under the floor. They pin the
   reboot guard explicitly, but the floor still moves the death tick.
2. **`hammerStrikeEtaFloor`'s two witness rows pass `withStrikeEtaFloor(true, …)` explicitly**, so a default flip does
   not move them. The witness row is pinned guards-OFF, and its ON sibling pins guards-ON (778).
3. **`plan-seedling-hammer-sf-strikefloor.mjs` asserts *"the switch ships OFF"*** (`STRIKE_ETA_FLOOR.enabled ===
   false`). That check is the floor flip's to turn. Its solves are now inside `guardsOff(…)`, so the guards are not a
   variable there.
4. `hammerGhostKillRung`'s rows do not pin the floor. Under a floor flip, the guards-OFF witness row (2195) would see
   SF's floor. SF measured that this staging's kill moves under the floor (t2114 → t1616, the SF witness's own description), so expect that row to
   move. **Pin it to the floor OFF**, because its witness is G1's OFF-floor walk. Don't re-pin it.

**General:**

5. The CI A/B of the guards (GS residue 1) is still undispatched. The scratch branch `seedling-hammer-guards-sweep-on`
   is untouched by me; the planner deletes it.
6. The shake guard still has no route evidence (GS § 5). It ships ON on LB's HO1 fixture alone, where it turns a crash
   into a wait.
7. The gates bank is behind for four rows (§ 5). Re-banking them is the planner's call, not this slice's.
8. Tree hygiene: no stash, no force-push, nothing pushed to `main`; no `pytest`, no unfiltered local vitest, no
   `standing-values --write`; no AS3, wasm, gitlink or rules edit. `STRIKE_ETA_FLOOR` stays OFF.
