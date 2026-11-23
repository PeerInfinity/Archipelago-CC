# Cloud report: `seedling-fidelity-p4hfix` — the two gaps the p4h game witnesses found

One slice of the Seedling model-fidelity arc (planner `seedling-fidelity-planning-23`). ⚖ GO: Robert, 2026-11-23 ("Fix slice first (Recommended)", plus the launch GO).

- **Start:** `b03a12492bf79512fd69c60d3e42991e721be85f` (the p4h port tip `723e3c4476` plus the evidence commit). There was no re-merge or rebase. The wasm gitlink and the `vendor/seedling` pin were not touched.
- **Harness branch:** `claude/p4h-model-fidelity-gaps-4w88kb`. The local branch is `seedling-fidelity-p4hfix`.
- **Commits:**
  - `cd5e33e8`: the two model fixes;
  - `347bd26b`: `fidelityP4hWitness.test.js` and the constants census;
  - `fae51eda`: a cite correction and the solver surface's line moves. **This is the last code head.**
  - This report.
- **Verdict: PASS on both gaps, behind an INTERIM gate (read this first).** Both causes are **generic model defects**: the AS3 lines are the same on p4g, and the p4h tapes are simply the first to reach them. The license is "the `bossdraws` arm only, p4g byte-identical", so both fixes are gated on `bossDraws`. **Lifting the gates was measured.** With both gates removed, the p4g acceptance md5 is unchanged and the p4g gate battery is green (1485/1485). Lifting them is Robert's call (see Hand-overs).

## Gap 1: the "whirlpool pull" was the Swim channel across a death rebuild

**The brief's suspect was wrong.** No whirlpool is involved. At each divergence the beast is `under`: the room has just been REBUILT by a death (the third hit, `hits_max` 3), and the player is swimming. The divergences are 15, 24, 15 and 16 ticks after the rebuild (rebuilds at t391, t946, t1012). The game's extra 0.25 px a tick is the swim stroke boost: `moveSpeed = moveSpeeds[state] + 0.25 * int(Music.soundPosition("Swim") < 0.1)` (`Player.as:548`). It arrives one tick earlier on the game.

- **AS3:**
  - `Bot.as:3089-3094`: `if (pinSoundClock) Music.pinStep();` runs "on EVERY frame including dead and frozen ones", above the armed check. `Music.as:563` is the step itself.
  - `Player.die()` (`Player.as:1487-1491`) sets `dying` and calls `restartLevel()`. `dying` skips only the player's own `super.update()`.
- **The model's wrong line:** `levelRun.js`, the death tick's `let next = pendingDeath ? state : stepV2(…)`. The model steps the Swim channel inside `stepV2` (`playerPhysicsV2.js:1421`). A death that is pending before the player's step (a hit death, or a whirlpool drown) skipped `stepV2`, so the frame's `pinStep` was dropped. The death reboot then carried `state.swim` one frame behind. The door path already says why `next` matters ("one frame behind the game"); the death path never got that.
- **The fix:** on that tick, step the channel once without moving the player: `{ ...state, swim: stepChannel({ ...state.swim }) }`. It is gated on `bossDraws` (INTERIM).
- **Evidence:** all 12 `tb-recordings` match the model every sampled tick, asked as p4h. This includes the 4 that diverged: `tb-hitless-pit` (t970), `tb-solve-s2` and `tb-policy-s2` (t406), and `whirlpool-drown-s15` (t1028).

## Gap 2: the Owl room's exit was the RockLock the death arm opens

The death rocks are not the blocker: `RockFall` has `type = ""` and `solids = []` (`RockFall.as:43,49-56`). The blocker is `rocklock@112,16 {tset 0, tag 1}` (box x 112..128, y 16..32). The model's player is held at y 34.566, just under its bottom edge.

- **AS3** (the p4h patch applied to `ccdf189776`):
  - The death arm `endAnim` "dead" (`FinalBoss.as:220-231`) adds 5 rocks, then calls `Button.activateAll(null, 0, true)` (`:224`; `:218` at p4g), then sets both flags.
  - `Button.activateAll` (`Puzzlements/Button.as:50-61`) sets `activate = true` on every `Activators` whose `t` is 0.
  - `RockLock.update` (`Puzzlements/RockLock.as:56-67`) then runs `alpha -= 0.01`. The test comes right after the decrement, so with `Image.alpha`'s clamp the lock turns `type = ""` on its **100th** update.
  - Update order: `Game.as:2355` adds `rocklock` after `finalboss` (`:2284`), and `addUpdate` prepends. So the lock updates before the boss, and its first fade step is the frame after the arm.
- **The model's wrong line:** the death arm in `levelRun.stepOwlNow` wrote the flags but published nothing to the room. `activators.js` says RockLock "is NOT here … it opens on an ITEM". That is true of a Button press, but not of this `activateAll`. So the wall stood for the rest of the visit. `applyEarnedClears` only removes it at the next build.
- **The fix:**
  - `activators.rockLockFadeStep` (new; the transcription of `:56-67`).
  - `levelRun.armRockLocksForGroup(0)` in the death arm, between the rocks and the flags.
  - `stepArmedRockLocksNow()` at the top of `stepOwlNow`, above the boss.
  - The fade's row lives in the room's activator state. That map is already in the `visit` digest, so no p4g digest moves. `openActivatorIds` reports the row, so every `liveSolidOpts` reader sees the wall go.
  - One line in `levelWorld.liveRectOf` drops a `rocklock` whose `rocklock@x,y` id is open.
  - The turn-off's own `setPersistence(1, false)` is the flag the arm already wrote, so it books nothing new.
  - Gated on `bossDraws` (INTERIM).
- **Evidence:**
  - `det-owl-sword-A` and `det-owl-spear-A` reach L113 at (80, 136) on the game's arrival tick. The 80-tick exit window from `owl-exit-p4h.json` agrees every tick. Both have 0 hits and `112:0`+`112:1`.
  - The lock opens at t2130 (Sword; tags at t2030) and t2117 (Spear; tags at t2017). The game's player passes y 32 at t2207 / t2180. So the 100-update open tick is read from the source; no recording pins it more tightly than "open by then".
  - `r6-owl-control` and `r6-owl-kill` end exactly at the game's last stream tick, with its hits and flags.

## The rows: `fidelityP4hWitness.test.js` (fast tier, 17 rows)

- The rows read the evidence in place (`CC/docs/cloud-reports/seedling-fidelity-p4h-witness-evidence/`); `fidelityAxe.test.js` already reads from `CC/docs`. Neither the one-spelling law nor the docs census refused that location.
- The model is asked as p4h through `capabilities` (`createRunForStaging(…, {capabilities})`, `createLevelRun({capabilities})`). There is no `setModelBuildDefault`.
- The rows:
  - the build row;
  - one row per TB recording: player, level, hits, beast anim, every tentacle, and the generator, on every sampled tick;
  - two A-plan rows;
  - two r6-owl rows.

### Mutants (predicted, then run by copy + restore; the tree was clean after each)

| mutant | predicted | red |
|---|---|---|
| W1: the death tick's Swim step removed | the 4 TB rows that diverged, and nothing else | `tb-hitless-pit`, `tb-policy-s2`, `tb-solve-s2`, `whirlpool-drown-s15` |
| W2: `armRockLocksForGroup(0)` removed | both A-plan rows, and nothing else | `det-owl-sword-A`, `det-owl-spear-A` |

## p4g byte-inertia

- `git diff --name-only b03a1249 HEAD | grep -aE 'fixtures/|golden|tapes/'` is **empty**.
- The `batch-seedling-acceptance` md5 is `391322d681b7aa0229d94b3f6906d024` in all four cases:
  - at the base;
  - at the head;
  - at the head asked as p4h (the evidence's `p4h-preload.mjs`, with its import made absolute);
  - at the head with both gates LIFTED (measurement only, restored).
- The port's committed p4h plans (`fixtures/p4h-tb-plans/*`, `fixtures/p4h-owl-plans/*`) still give their stated results: the `fidelityP4hPort` rows are green.

## The port's p4h reds, re-measured

The setup was the port's: an uncommitted vitest setup calling `setModelBuildDefault(p4h)`, run over the 24 gate files at the base and at the head.

- **31 red at both, and the same 31 with the same first assertion messages.** That is the port's 28, plus 3 `fidelityP4hPort` rows that assert the default build itself, so they go red by construction under the swap:
  - `fidelityTentacleBeast`: 17;
  - `fidelityResidue`: 6;
  - `seedlingSoundCues`: 3;
  - `fidelityOwlSuit`: 2;
  - `fidelityP4hPort`: 3.
- **None of the 28 changes.** They compare p4g recordings, oracles and goldens, or stagings chosen on the p4g schedule. Their p4h counterparts are the evidence recordings, which are now green in the new rows. The re-record list in the port's report stands unchanged, and it is still Robert's OK.

## Gates

- **Bounded vitest BEFORE** (the base, in a scratch worktree, 24 files): 1468/1468.
- **Bounded vitest AFTER** (the same 24 files plus the new file): **1485/1485 green on p4g**.
- The first AFTER run had 1 red: the constants census mutant (b), from the new literals, which the brief predicted. Fixed by `--write`, then `--profile-rows`; `--check` PASS.
- **Checks at the head:**
  - `ci-producer-checks.mjs --jobs=3`: 99 run, 0 red, 1 skipped;
  - `check-procgen-docs.mjs`: ALL CHECKS PASSED;
  - `generate-procgen-reference.mjs --check`: 7 modules and 5 regions match;
  - the constants census `--check`: PASS;
  - the solver surface `--check`: GREEN, 374 rows. It had said DIFFERS on line numbers only; it was rewritten with `--write` in `fae51eda`.
- **CI:** the `JavaScript Unit Tests` push run 45112867189 at `fae51eda` was QUEUED when this report was committed; read it with `node scripts/procgen/ci-vitest-summary.mjs fae51edaf457af05e1e4215560962976112f3325`. A follow-up commit records the result when it lands.
- **For the planner (I cannot dispatch, 403):** `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/p4h-model-fidelity-gaps-4w88kb -f train_only=true` at `fae51eda`. The slice touches `levelRun` and `levelWorld`, so the train tier's pins should be quoted.

## What the brief got wrong (measured)

- **Gap 1 is not a whirlpool.** No whirlpool exists at any of the 4 divergences: the beast is `under`, right after a death rebuild. The cause is the Swim mixer's dropped frame on the death tick.
- **Gap 2 is not the death rocks.** They collide with nothing. The blocker is the RockLock that `Button.activateAll` opens.
- **"Model changes on the `bossdraws` arm ONLY" and "the cause" do not coincide.** Both defects are p4g's too. The gate is a license artifact, not a model of the build.
- **The cite.** The patched `FinalBoss.as` has `Button.activateAll` at `:224` (the death rocks are at `:222`). The port's D1.1 numbering is right; my first commit wrote `:225`, and `fae51eda` corrects it.
- **The AS3 is reachable.** `p4h-as3` is still not fetchable. But `ccdf189776` plus `ev/patches/deterministic-boss-draws.patch` (on `origin/claude/rules-deterministic-boss-draws-jb2pf9`, at `CC/docs/cloud-reports/rules-deterministic-boss-draws-evidence/patches/`, not `ev/patches/`) applies cleanly, and that is what I cited.

## Hand-overs

- **Robert / the planner: lift the two interim gates.** In `levelRun.js`, the gates are `bossDraws && state.swim` (the death tick) and the two `if (bossDraws)` lines (`armRockLocksForGroup`, `stepArmedRockLocksNow`). The lift was measured as inert on every committed p4g gate (above). It changes p4g only where nothing is witnessed: a death while the Swim channel is open, and a walk through L112's exit after a kill.
- **Census classification.** `ROCK_LOCK_FADE` (0.01) and the new fade's literals were auto-classified `structural`. A gameplay row (`rule`) would be more honest, and the census owner may want to re-classify them.
- **Hammer.** No change to `solverBot.js`, `tentacleBeastPolicy.js`, the ladder or the arms. The solver sees the open lock through `liveSolidOpts` on p4h, which matters once there is an Owl executor (step 234).

## Residue

- **A stray remote branch.** My first push named `seedling-fidelity-p4hfix` on the remote (at `cd5e33e8`, the same commit as the harness branch's first). The proxy refuses the delete (`remote end hung up`), so it needs removing by hand.
- **A ruling-52 slip.** One mis-built command (an empty file list) started an unfiltered `vitest run` in the scratch base worktree. I stopped it after a few minutes; no strays were left and no result from it is quoted anywhere.
- **The RockLock's exact open tick is unwitnessed:** it was read from the source, as above.
- **Not measured:** a p4g game witness of either lifted path.
