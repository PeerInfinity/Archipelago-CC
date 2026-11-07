# Seedling fidelity R5RETIRE — retire `probe-seedling-r5-press-axes`

Planner `seedling-fidelity-planning-18`, wave 37b. ⚖ The user 2026-11-02 (*"Retire it in W37 (Recommended)"*), GO 2026-11-04.

| | |
|---|---|
| Start SHA | `26ed405d3f` (= `origin/main`, 110 ON of 122) |
| Head | see the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-r5-retire-cwo9hc` |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-r5retire-evidence/` |

| D | Verdict |
|---|---|
| W0 census | DONE |
| D1 fold | **PASS** — `r5-spinner --check` re-emits `r5-press-delay-control` byte-identical; 16/16 claims; mutants 3/3 as predicted |
| D2 retire | **PASS** — probe deleted, references fixed, reference regenerated, docs gate green |
| `r5-press-delay` producer | **STOP (no action needed, nothing deleted or re-recorded)** — it is a ROOT with no producer, and it had none before this slice either |

## W0 — census at `26ed405d3f`

**The instrument today.** `node scripts/procgen/probe-seedling-r5-press-axes.mjs` exits **1** at the drive: *"legs[0] level
39 target 4 fire: fired at (200.10…,72.68…) and the declared blocks ended at [pushableblockfire@208,80->12,5] rather than
[pushableblockfire@208,80->12,6]."* It has no `--check` flag (only `--write` / `--write-probes`), and `ci-producer-checks`
only globs `plan-seedling-*.mjs` and `regenerate-*-tapes.mjs`, so no gate ever ran it. The refusal is the model being
right: the spinner wedge is what the game did on the undelayed arm.

**The four committed tapes** (`fixtures/tapes/` + `fixtures/expectations/`):

| tape | producer at base | after this slice | consumers (outside `cloud-reports/`) |
|---|---|---|---|
| `r5-press-glide` | `r5-spinner --check`: `same`, 3144 B | unchanged | r5Shaft (`SPINNER_WEDGE`), moverSolids.test, r8Acceptance(.test), watchOverlays.test, pressKillCost.test, fidelityFireMove.test, botDriverV2 (comment), dead-frame-observations, profile/entity witnesses, `check-seedling-editor-world.mjs`, tape index |
| `r5-press-repeat` | `r5-spinner --check`: `same`, 3446 B | unchanged | same family |
| `r5-press-delay-control` | **none** (press-axes could not re-emit it) | **`r5-spinner --check`: `same`, 2553 B** | r5Acceptance `PRESS_PAIR`, r5Shaft `committedPair`, moverSolids.test, tape index |
| `r5-press-delay` | **none** | **none: ROOT** (held canonical; every reconstruction inverts to it) | r5-spinner's input, r5Acceptance `PRESS_PAIR`, r5Shaft, moverSolids.test, tape index |

Roster pins (`tapeEnvelope`, `observationTolerance`, `tapeIndexManifest`, `dialogueAutoAdvance`) key on the tapes, not the
instrument: none moves, since no tape is added, removed or changed.

**What press-axes asserted, and where each one goes:**

| assertion | status |
|---|---|
| §0 the blocker deduction (`PRESS_AXES.stuck` → box bottom 79.34 → edge y=80, column 12 → cell (12,5)) | printed only, no check → **folded into r5-spinner as a check** |
| the drive itself (`synthesizeLegs` authors the press tape) | **dead**: the model refuses press 5 now, correctly |
| "exactly two presses" OF THE DRIVE | dead with the drive; **folded** as "the committed root has 2 `primary` spans, the control 0, other spans the same" |
| the press arm enters (13,5) and (12,5); the control enters neither (on the undelayed arm) | **folded**, re-aimed at the committed pair (`r5-press-delay` / `-control`); the GAME side is already `r5Acceptance.pressPairFindings` |
| the glide arm's model rests at y≈93 | **dead (refuted)**: the model now wedges the block, y 83.83122648907042 = the game's (r5-spinner already checks this to the double) |
| emits `r5-press-delay` / `-control` (`--write`) | delay-control → **folded**; delay → ROOT, no producer |
| emits `r5-press-axes`, `-axes-control` (`--write-probes`) | never committed; `SPINNER_WEDGE.withdrawn` names `r5-press-axes` as not reconstructible (r5-spinner already says so) |

## D1 — the fold (commit `40a0ba3a`)

`probe-seedling-r5-spinner.mjs` §1b:
- **`r5-press-delay-control`** is derived from the committed root: `{...delay, name, inputs: delay.inputs.filter(key !==
  'primary'), description}`, with the description string copied verbatim from the retired probe.
- ⚠ **Measured: the two committed delay tapes are NOT in `serializeTape`'s spelling.** The v5 `dead_frames` re-pin wrote
  `"pins": ["dead_frames"]` on ONE line (41 committed tapes carry it); `serializeTape` gives three lines, +8 bytes.
  `plan-seedling-pushblock-witness.mjs:229` already handles this with the same regex; r5-spinner's `pinsOneLine` uses it
  too. glide/repeat are in canonical spelling, so they are emitted unchanged.
- `r5-press-delay` is checked as canonical in the re-pin spelling (it round-trips to its own bytes).
- New checks: the pair is one field apart; the model's press arm enters (13,5) and (12,5) and the control neither; the
  `PRESS_AXES` blocker deduction.

`--check`: `same r5-press-glide: 3144 bytes` · `same r5-press-repeat: 3446 bytes` · `same r5-press-delay-control: 2553
bytes` · `16/16 claims PASS`, rc 0. `--write` → `git status` shows no tape change.

**Mutants** (predicted first, made by copy + restore; `mutant-m{1,2,3}.txt`):

| mutant | predicted | observed |
|---|---|---|
| M1 one word of the control description changed | DIFFERS delay-control, same size, rc 1 | `DIFFERS … 2553 vs 2553`, rc 1 |
| M2 drop `pinsOneLine` from the output | DIFFERS by 8 bytes | `2553 vs 2561`, rc 1 |
| M3 control keeps the presses | "one field apart" ✗, "control enters neither" ✗, DIFFERS | exactly those two ✗ + `2553 vs 2695`, rc 1 |

## D2 — the retirement (commit `e2561751`)

- Deleted `scripts/procgen/probe-seedling-r5-press-axes.mjs`.
- `check-procgen-help.baseline.json`: its row removed, by hand (a trivial row: `inheritedOutput: [], helpResidue: null`);
  `checkProcgenHelp.test.js` / `procgenHelpBaseline.test.js` green.
- `generate-procgen-reference.mjs` regenerated: `instruments.js` (524 → 523 files, probe- 190 → 189, withFlags 444 → 443),
  the `architecture.md` instruments region, then `docsIndex.js` + `README.md` word counts after the log entry. `--check`:
  *ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE*.
- `r5Shaft.js`: two docblock pointers to the instrument now say it is retired and point to r5-spinner (comments only). The
  TAPE name `r5-press-axes` stays in `SPINNER_WEDGE.probes` / `.withdrawn` / r5-spinner's output: it records a withdrawn tape,
  not the instrument.
- `seedling-bot-log.md`: the old slice-12 paragraph notes the retirement; new entry *Seedling fidelity R5RETIRE*.
- Nothing else referenced it: no imports, no boxLock list, no CI workflow, no probe battery (`grep -arl` over the tree).

## Gates (at the D2 tree)

| gate | result |
|---|---|
| `check-procgen-docs.mjs` | ALL CHECKS PASSED, rc 0 (`check-procgen-docs-after.txt`) |
| `generate-procgen-reference.mjs --check` | 7 modules + 5 regions match |
| `ci-producer-checks.mjs --jobs=3` | `97 run · 0 red · 1 skipped · 0 known-red`, rc 0 (`producers-after.txt`) |
| bounded vitest, fast (100 files: the footer's standing set + every `grep -a` hit for `r5-press`/`r5Shaft`/`r5Acceptance`/`r5-spinner`/`probe-seedling-r5` + help/baseline/argvHelp + surface/constants + procgenDocs/docLinks/docsRender; `bounded-files.txt`) | BEFORE (base worktree): 99/100 files, 1 red = `procgenDocs/generated.test.js` registry/capabilities DIFFER — a **worktree artifact** (the base worktree symlinks the submodules and lacks the primary's untracked substrate sites; the primary's `--check` matches). AFTER (primary): **100/100 files, 2682/2682** |
| slow `fidelityL32ArenaPrefix.slow.test.js` | 5/5 |
| train `fidelityL40Bk2.train.test.js` (the only `.train.` file in the set) | 1/1 |
| r5-spinner `--check` | 16/16, 3 × `same` |
| identity block + six `--check`s | W0 `identity-w0.txt`, AFTER `identity-after.txt` — see *Byte-inertia* |
| acceptance batch md5 | `abb206c88de25e7ba1874510d493ce85` (= main's) |
| CI `JavaScript Unit Tests` at `e2561751` (the last code head; the report commit changes only `CC/docs/`) | run `41958408252`: shards 1–3 + slow all success; suite **25511 passed / 0 failed**, slow 372/0 |

## Survey / sweep movers

**None, by construction**: no model, solver, walker or rules file changes (the only `frontend/` source edit is two comments
in `r5Shaft.js`). The identity block and the acceptance md5 are unchanged. **No CI dispatch is needed to confirm movers.**

## Byte-inertia

No committed tape, expectation or producer `--check` digest moves. Identity block W0 vs AFTER: **IDENTICAL** (whole-file
md5 `74a5b6f7dc14e33d6f2a36c84eb52a27` both; maze `57e07d21…`, acceptance `abb206c8…`, the six r8/r9 `--check`s `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` ·
`6cd35fe1` · `be9c19c8`, all exit 0).

## The JS arc / hammer arc

Nothing to wire, nothing handed over. No JS-arc pin moves; no hammer pin moves.

## What the brief got wrong (measured)

1. *"the glide/repeat probes moved to `probe-seedling-r5-spinner.mjs` already … which committed tape does r5-spinner
   produce"* — right for glide/repeat. But **neither instrument produced the delay pair**: press-axes' drive is dead, so
   `r5-press-delay-control` had no working producer before this slice, and `r5-press-delay` has none at all.
2. *"fixtures/expectations/ r5-press-{…}.json COMMITTED"* — right, but expectations are not emitted by either probe
   (they come from the differential recorder); nothing to fold there.
3. *"ci-producer-checks"* as a gate on this fold — it runs, but **it does not enrol `probe-*` producers**, so neither the
   retired probe nor r5-spinner's `--check` is gated on CI. The fold's `--check` is a by-hand gate.
4. *"its MODEL drive has failed since ccd83951f8 … press 5's premise is gone"* — the drive fails, yes; read as the model
   being RIGHT (the game wedges the undelayed press too; the delayed arm is the byte-exact one), not as a lost premise.

## Residue / rows to BANK

- `r5-press-delay` — ROOT fixture with no producer (a byte-exact game recording). Consumers listed above. It is NOT
  deleted and NOT re-recorded; if the planner wants it producible, the only honest route is a re-record (needs the user's
  licence) — I do not recommend one: it is held canonical and every derived arm inverts to it.
- Planner call: enrol `probe-seedling-r5-spinner --check` in a CI producer gate (today it runs nowhere on CI).
- Trap candidates: (1) a `probe-*` producer is outside `ci-producer-checks`' globs and can rot silently; (2) 41 committed
  tapes carry the re-pin's one-line `pins` spelling, so a producer that re-emits one through `serializeTape` alone differs
  by 8 bytes.
- BANK: r5-spinner `--check` 16/16 with three `same` rows; instruments 523.
