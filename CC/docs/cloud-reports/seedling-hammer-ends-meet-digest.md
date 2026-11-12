# seedling-hammer-ends-meet-digest — why `plan-seedling-r7-ends-meet --check`'s digest flips

Slice `seedling-hammer-ends-meet-digest` (planner `seedling-hammer-phase-planning-6`; ⚖ user 2026-11-12, item *"Fix ends-meet digest"*). Cloud, Opus.

## 1. SHAs

- Start: `fe98f37f2207594e648cefb90f007a16e453c0eb` (origin/main, "train: content-r3 5c5714d585")
- Fix commit: `1559abd34c`; head is this report's commit (on top of `1559abd34c`)
- Branch: `claude/seedling-ends-meet-digest-4lh4rw`

## 2. The answer

- **Cause:** the only byte that differs between two `--check` runs on an unchanged tree is the drive line's **dead-frame count**: `drove r7-ends-meet-1: 62 observations, 37 dead` vs `… 38 dead`. On the game, `botStatus.dead_frames` reads 37 or 38 depending on where `botStart` lands against the page's boot. The latched `latch.dead_frames` agrees with it, `latch.tick` is 61 every run, and every tape passes byte-identity every run. The count tracks page phase (wall clock), not the tape.
- **Fix:** the drive line now comes from a new pure helper, `scripts/procgen/driveProgressLine.js`. Under `--check` it prints only the label and the observation count. On the record path it still prints dead frames and seconds as progress. This is the precedent R9 slice 9b set for the duration on the same line.
- **Switch:** none. Only printed output changes: no solver, model or plan code moved and no tape bytes changed. Acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at both base and head.
- **Result:** 10 × `--check` before gave 9 × `4b4cacff…` and 1 × `f1675cfc…`. 10 × `--check` after gave 10 × `70298f2ccbd9783750d806eea9a7837d`, all exit 0.
- **The one thing to know first:** the banked value `67bd57b2…` (standing-values, `ciSourced`) was already stale before this slice (CI read `4b4c…`/`f167…` against it as `MOVED`). After this lands, the row has to be re-banked to the new value, which should be `70298f2c…` if CI's output matches this box's. I could not quote that from CI: run 43269231249 for `1559abd34c` was still queued when I wrote this. Re-banking needs `standing-values --write`, which this slice may not run, so it is handed over (§9).

## 3. The reproduction (measured)

Dev server `scripts/serve-nocache.py 8000`, p4g build staged by `session_bootstrap.sh --seedling`, Node 22.23.4, base `fe98f37f22`.
Digest = `node scripts/procgen/plan-seedling-r7-ends-meet.mjs --check 2>&1 | grep -v '^# box lock:' | md5sum`, which is the identity template's `b | m`.

| run | 1 | 2–10 |
|---|---|---|
| md5 | `f1675cfc089acf3f36fc79c9dc8b1bba` | `4b4cacffb3d668b6120f2ec7eaf260a3` |
| exit | 0 | 0 |
| wall | 6–7 s | 6–7 s |

These are the same two values the brief names, from train 98's js-land run and the HK D2 records. `diff run1 run2`, with the box-lock line dropped (PID and head; the `b` filter already removes it), leaves exactly one line: `38 dead` vs `37 dead`. Evidence: `seedling-hammer-ends-meet-digest-evidence/before-*.txt`, `before-10x.txt`.

**Which input carries it.** The probe (`evidence/probe-dead.mjs`) drives `r7-ends-meet-1` exactly as `latchOf` does and reads the count three ways: `botStatus.dead_frames` at `finished`, the seam's `latch.dead_frames`, and `botStatus` again 1 s later. Each probe ran 8 page loads:

| readiness poll before `botStart` | dead frames (status = latch = later) | `latch.tick` |
|---|---|---|
| 100 ms | 38 × 8 | 61 × 8 |
| 500 ms (the producer's `waitFor`) | 37 × 4, 38 × 4 | 61 × 8 |

The per-poll trace shows the difference is set in the first freeze span after `botStart`: the count plateaus at 17 or 18 there and then rises by 20 to 37 or 38. `game_time` at finish (4902–4916) also varies with the page. The other three candidate readings are ruled out: the count is the same at `finished`, at the latch and 1 s later, so post-finish frames, a race in reading it and a drain-time effect do not explain it. Every other hashed field (tape bytes, the 46 calm-arrival signature rows, the observation count) was identical in all runs.

So the digest's input was a game readout of page phase. Iteration order, `Math.random`, the port, float printing and the tapes were all ruled out by the diff, which shows only that field.

**Was the digest meant to cover it?** No. The producer's claim is the three tapes' bytes plus the calm-arrival latch. `dead_frames` reaches neither. `Bot.as` says of the field that *"nothing asserts the field"*, and the seam signature does not include it. Making it deterministic would mean changing where `botStart` lands in the game's boot (`Bot.as`, AS3, off-limits here) or the producer's start cadence (a change to how tapes are produced, for a field nothing consumes). So it is excluded from the `--check` path rather than made deterministic. The game-side 37/38 is handed over (§9).

## 4. Design and change; OFF identity

- `scripts/procgen/driveProgressLine.js` (new, about 40 lines): `driveProgressLine({label, observations, deadFrames, ms, check})`. With `check` true it returns `    drove <label>: <n> observations`; otherwise it appends `, <dead> dead, <s>s`.
- `scripts/procgen/plan-seedling-r7-ends-meet.mjs`: one import and one call site. The inline template that printed `${status.dead_frames} dead` on both paths is replaced.
- **Step 3 (does `--check` fail on drift?)** It already does, for the thing it owns. `--check` exits `failures === 0 ? 0 : 1`, where a failure is any tape that is not byte-identical to what it derives today, or a latch that is not a calm arrival. The *digest* comparison against a recorded value already exists one level up: `ci-summary` gives the row `MOVED` against the bank and exits 1 at run level, which is how `4b4c`/`f167` against `67bd57b2` showed up. Putting a recorded md5 inside the producer would be circular, because the md5 covers the producer's own PASS lines. I added none.
- The output has no solver switch, so there is no ON/OFF split. **Acceptance md5:** base `fe98f37f22` is `391322d681b7aa0229d94b3f6906d024` (the brief's value), and head (`1559abd34c` code) is `391322d681b7aa0229d94b3f6906d024`, measured with `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`, 42 s.
- Regenerators, all byte-inert (no diff): `census-seedling-solver-surface.mjs --write` (372 rows), `generate-procgen-reference.mjs`, `generate-docs-index.mjs`. `check-procgen-help.mjs` passed (547 instruments, `--doors=all`) and `check-procgen-docs.mjs` passed. No docs under `docs/json/developer/procgen/` were edited, so no link-census pins are owed.

## 5. Rows and bounded vitest

- `scripts/procgen/driveProgressLine.test.js` has 4 rows:
  1. Two drives that differ only in page phase print identical `--check` bytes. The witness is the measured pair: 62 observations, dead 37 vs 38, different milliseconds.
  2. `--check` still prints what the tape determines: label and observation count, and a different observation count still changes the line.
  3. The record path keeps the readouts.
  4. The producer prints its drive line through the helper and has no inline `${status.dead_frames}` left.
- `npx vitest run scripts/procgen/driveProgressLine.test.js` gave 4/4.
- **Mutation:** with `if (check) return \`${head}, ${deadFrames} dead\`;` (the cause put back), the same run gave **2 failed / 2 passed** (rows 1 and 2 red). The file was restored afterwards.
- Neighbour pins that name this producer: `npx vitest run scripts/procgen/walkMoves.test.js scripts/procgen/producerSegments.test.js scripts/procgen/ciGatePlan.test.js` gave 3 files, **126/126**.
- **10 × `--check` after the fix:** all `70298f2ccbd9783750d806eea9a7837d`, exit 0 (`evidence/after-10x.txt`, `after-run1.txt`).

## 6. Page play / game witness

There was no whole-game walk (not asked for). The game witness is the probe in §3: 16 page loads of `r7-ends-meet-1` on p4g headless, readings in `evidence/probe-dead-{100,500}ms.jsonl`.

## 7. Divergence-sweep census

**No seed-1 divergence-sweep leg can move.** The change touches no file the solver, the fidelity model or the sweep imports. It changes one `console.log` in a producer and adds a module that only that producer and its test import. The acceptance md5 is unchanged (§4). The producer's tapes (`r7-ends-meet-full`, `-1`, `-2`) passed byte-identity on all 20 runs, before and after.

**Producer census (list, not fixed)**, from `rg -a` over the 103 template producers plus `derive-*` for page-timing readouts printed on the `--check` path:

| producer | line | what it prints under `--check` | digest consumer today |
|---|---|---|---|
| `solve-seedling-r9-campaign.mjs` | 308 | `${got.status.dead_frames} dead` (the same template this slice fixed) | none banked; `@ci-box`, so the box answers it via `standing-values --write --key=…`, which would md5 it and inherit the same flip |
| `solve-seedling-r8-d2-chain.mjs` | 278 | the same | the same (`@ci-box`, not banked) |
| `plan-seedling-l40button-witness.mjs` | 164 | `…, ${Math.round((Date.now() - t0) / 1000)} s` inside a PASS detail, wall-clock seconds (about 7 s, so it rounds across a boundary) | not banked; `Producer --checks` (`ci-producer-checks.mjs`) gates on exit code only |
| `derive-seedling-tick0.mjs` | 305 | `… dead, …s` on a cache-miss drive, unconditional | not a template producer; only on a cold cache |

All four could adopt `driveProgressLine` (the first two directly). That is a one-line change each, but out of scope here.

## 8. What the brief got wrong (measured)

- *"plan-seedling-r7-ends-meet --check prints a digest"*: the producer prints no digest. The digest is the identity row's `md5` of its whole `2>&1` output (`… | b | m`, `standingValues` producer template; CI arm via `runRow`). The fix still belongs to the producer, because the printed text is its own.
- The listed suspects (iteration order, Date, Math.random, port, float rounding, async race, cache) were not the cause. The cause was a game readout of page phase, the dead-frame count, printed on a digested line.
- *"exits 0 either way"* is correct, and it is the right behaviour: the tapes did not drift. The drift alarm for the digest is `ci-summary`'s `MOVED`, which already fired.

## 9. Residue and hand-overs

1. **Re-bank** `producer: plan-seedling-r7-ends-meet --check` once CI publishes the line at a head containing `1559abd34c` (planner or box; `standing-values --write` is off-limits here). The local prediction is `70298f2ccbd9783750d806eea9a7837d`. The bank's `67bd57b2…` was stale before this slice. `identity-block.sh:63`'s comment still quotes `75cf816a…` from `@70f14a502`, which is historical and was left alone.
2. **Game-side (AS3 / `Bot.as` owner, hand-over):** under `pins: ["sound","dead_frames"]`, `r7-ends-meet-1`'s `dead_frames` is 37 or 38 depending on `botStart`'s phase against the page boot. The first freeze span plateaus at 17 or 18 (16 page loads, §3). It reaches no tape or seam row today. If anything ever asserts `dead_frames` as an exact count (the `Bot.as` "WAITING FRAME" comment says that count "becomes uniform"), this is a counter-witness. The row to reproduce it is `evidence/probe-dead.mjs 8 500 500`.
3. **Census siblings (§7):** `solve-seedling-r9-campaign:308`, `solve-seedling-r8-d2-chain:278`, `plan-seedling-l40button-witness:164`, `derive-seedling-tick0:305`, all unfixed.
4. CI run 43269231249 (`1559abd34c`) was still queued at writing. Quote it with `node scripts/procgen/ci-summary.mjs 1559abd34c --gate="producer: plan-seedling-r7-ends-meet --check" --wait`.
5. The dev server I started on :8000 (PID 726) is left running for the container's life. No other paths were created outside this report's evidence directory and the two new `scripts/procgen/` files.
