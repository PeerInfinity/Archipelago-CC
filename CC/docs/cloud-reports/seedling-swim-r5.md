# Seedling swim R5: the close-out — the mid-room stack overflow · botReset held keys · kill-lock timing · the Green Key credit · the dead-frame probe's R6 terms

**Slice:** `seedling-swim-r5`, the swim arc's last slice, an Opus build slice run in the cloud (plan §18.30). ⚖ The user ruled it on 2026-10-02: *"One cleanup slice, then close."* I did not edit any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `solveSegment`'s prefix admission, the solver worker), any AS3, the wasm or a gitlink. The JS arc's modules are imported read-only by one test.

| | |
|---|---|
| Started from | `origin/main` @ `4d37988970` (descends from `64fd18a951`) |
| Head | this report's commit, on top of ``bfa2c15`` |
| Harness branch | `claude/seedling-swim-r5-cleanup-0mc1ci` (the harness pins it, not `seedling-swim-r5`) |
| Commits | D1 `944835d` · D4 `693118d` · D5 `67ddd06` · D6 ``bfa2c15`` (records, the D3 data file) · this report |
| Dev server | `scripts/serve-nocache.py 8990` (`SEEDLING_PORT=8990`, build `seedling_bot_ap_p4e`, headless logic-only) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every row reproduced at `4d37988`: the identity block (log md5 `25bb24ae…`, equal to R4's head), the six `--check`s, the reference, tapeRunner 449/449, surface 191, constants 4,931, profile 138, entities 518, and 14 files / 1,208 vitest tests. |
| D1 | **PASS** | The cycle is `walkTo` → `climbLadder` (BAIT rung) → `walkTo` on the same body, stance and tick. It is now refused by name (`BAIT_REENTRY`) and the ladder goes on to KILL. The W = 0..240 sweep read 4 overflows before and 0 after; the other 237 rows are byte-identical. Mutant: both witness rows red with the stack overflow. |
| D2 | **CLOSED (measured: none)** | No swim tool calls `botReset`; every one boots a fresh page or frame per tape. The adjacent risk is a LONE `keyup` at a window boundary in `watchWasm` and the director's driver. It is unmeasured and in the residue list. |
| D3 | **STOP, on a bigger finding** | On `r8-solve-5`'s staging the game opens L5's lock before the model's KILL tick (it crosses at t424 against the model's t429). The cause is that L5's bodies leave the model at t54 on the committed tape (worst \|Δ\| 23 px). The kill-vs-removal question cannot be asked in a room whose kill the model gets wrong. No model change; the refuted witness is not committed. |
| D4 | **PASS** | A key's flip is its own placement witness. `r9-campaign` earns `bosskey1@L29`: over the GAME's full-tier latches it reads 6 earned = 6 declared, and every other chain reads what it read before. Mutant reds 2 rows plus the game-latch chain row. |
| D5 | **PASS (with one residual drift)** | One budget (`deadFrameBand.deadFrameBudget`) for the gate and the probe. The probe now reads ADMITS 196/196, CATCHES 196/196 on both signs, 0 missed (it was 188/196 and 1 missed). The gate's terms are byte-identical on 196/196. The probe still exits 1 on `FADE_STATS`' drift, which is the coordinator's to re-derive. |
| D6 | **PASS** | The identity log is byte-identical to W0 (md5 `25bb24ae…`, an empty `diff`), and so are the six `--check`s. tapeRunner 449/449, every row identical. Surface GREEN 191, constants PASS 4,937, profile 138, entities 518. Bounded vitest AFTER: 15 files / 1,217 green. |

**The one thing to know first.** D3 found that the committed L5 segment's BODIES are not the game's. `r8-solve-5` (and through it `r9-campaign`'s first window) declares `{5,0}@427`, "model-sourced" from an arrow kill at t326. The game's bobs diverge from the model's at t54. By t200 the game has one bob left, at 3 hits and with no anim, while the model still has `bob@48,80` alive at 1 hit. And the game's lock opens by about t422, not t427. Every gate is green because the player waits at (56.15, 56.40) until long after the lock opens, so the player stream cannot see any of this. It is a model defect in L5's arrow knockback (the first divergent hit lands on the same tick with a different velocity) plus a declared tick the game never checked. It belongs in the queue ahead of any kill-lock timing work.

## W0 (at `4d37988`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=8990 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…` · acceptance `e417212b…` · c3 `fce3ad42…` · c6 `8e59dec8…` · c4 `b11d9564…` · ENEMY `a20bcbe8…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Log md5 **`25bb24aebf94d378049573e53007928f`** (= R4's head value, so R4's c3/c6 movers are banked here) |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` | **449/449**, per-row names and statuses saved for the AFTER diff |
| surface / constants / profile / entities | `census-seedling-solver-surface --check` · `census-seedling-constants --check` · `witness-seedling-profile --check [--full]` · `witness-seedling-entities --check` | GREEN 191 / PASS 4,931 literals / 138 keys (both tiers) / 518 number leaves |
| tape index / roster | `fixtures/tapes/index.json` | 196 tapes |
| bounded vitest BEFORE | solverBot, botDriverV2, dangerMap, tapeRunner, levelRun, chasers, enemyDamage, playthroughAcceptance, deadFrameBand, jsRuntimeSolver (read-only use), r7Acceptance, seedlingSolverSurface, seedlingConstantsCensus, lintGateLabels | **14 files / 1,208**, exit 0 |

## D1: the mid-room solver stack overflow (`944835d`)

**Reproduced** with a throwaway probe (the test's `midRoom` helper, L6 `in_L5_48_112` → `out_stairsup_224_32`, then `setSolverWalk(true)`): W = 69 SOLVES; **W = 70 declines with "Maximum call stack size exceeded"**; W = 71 declines by name (the sandtrap danger).

**The stack** (`solveFromLive` called directly at W = 70, `Error.stackTraceLimit = 400`): 400 frames, all but the top seven of them the pair

```
at climbLadder (solverBot.js:10610)   // the BAIT rung's walkTo(goal, bait.stance)
at walkTo (solverBot.js:11182)        // probeCorridor hit → climbLadder(...)
```

**The cycle.** The corridor's danger hit climbs the ladder: AVOID refuses, TIME refuses (the aim is 53 px away, beyond `MOVER_RANGE`), and BAIT picks `bob@96,16` with stance (104,56). The walk to that stance is an ordinary `walkTo`, so its corridor is probed too, hits, and climbs again. With no tick spent and nothing moved, the inner climb derives the same body, the same stance and the same tick, so it is the outer call verbatim. This was the brief's first suspect: a refusal ladder that re-enters itself on the same state.

**The fix** (the missing progress check, not a depth limit). The rung keys a bait walk in flight by `body@stance#tick` in `baitingBodies`, the same shape as L16's `pullingRopes` (try/finally). A re-entry with the same key becomes the bait rung's refusal *"bob@96,16: the walk to its bait stance (104,56) is itself a corridor that needs bob@96,16 baited — the ladder re-entered the same bait at tick 71 with nothing spent between, so a second bait would be the first one again (BAIT_REENTRY)"*. The ladder then goes on to KILL, which refuses here, so the climb ends in the named exhaustion: *"… -> bait (bob@96,16) stance: the combat ladder is EXHAUSTED …"*. The key includes the tick, so a re-entry after the walk made progress is unaffected.

**Witness** (`r5SwimCloseout.test.js`, D1):

- through `solveSegment({prefix})` (S0) on the JS runtime's own staging and keys, replayed with `replayTape` (JS-arc modules imported read-only): it throws a `SolverRefusal`-shaped error, not a `RangeError`, naming the exhausted ladder and `BAIT_REENTRY`;
- on the page: one decline whose status line is the exhausted ladder, not the stack. The page keeps the refusal's first line; the climb with `BAIT_REENTRY` is the row above.

**Mutant** (predicted first: both D1 rows red with the stack overflow): the guard disabled (`false && …`). **Measured exactly that**: `expected RangeError: Maximum call stack size exceeded … not to be an instance of RangeError` and `'Maximum call stack size exceeded' not to match`. Restored md5-identical (`c0e3edc5…`).

**Parity.** The W = 0..240 sweep, each W run until the first solve or decline:

| | SOLVED | DECLINE | STACK |
|---|---|---|---|
| before | 227 | 10 | **4** (W 41, 70, 142, 214) |
| after | 227 | 14 | **0** |

The other 237 rows are byte-identical (`diff` of the two logs minus the four W). The identity block and the six `--check`s: see D6. `jsRuntimeSolver.test.js` is 14/14 at head (its W = 71 decline row is untouched).

## D2: the WASM `botReset` held-key residue in the swim tools — closed, none

The JS arc's fix is `c5cdb04` (`seedlingWasmPlayback.js:164-174`: `keysHeldAtReset` ∩ the previous tick's input, then a keydown+keyup pair). `81006f821b`, the commit the brief cites, is its docs commit.

| tool | resets? | citation |
|---|---|---|
| `watchWasm` | **no `botReset`** | Each ship gets a fresh frame (`freshFrame`, `watchWasm.js:1796-1809`, teardown `:1204-1207`). Windows run `botLoadTape` (`:1561`) and `botStart` (`:1566`), each after a poll to `finished` (`:1581-1583`). |
| director (`run-seedling-director.mjs` → `seedling-bot-replay-win.py --tapes`) | **no** | `botReset` appears only in a comment (`.py:378`). Windows run `botLoadTape` (`:557`) and `botStart` (`:586`) after the previous window's `finished` (`:708`). |
| the differential's per-tape boots | **no** | A fresh page per tape (`replay`, `check-seedling-bot-differential.mjs:2115-2145`). `--win` drives a single `--tape` (`:957-960`). |
| the campaign producer's latch drives | **no** | `rerecord-seedling-campaign.mjs:1095-1104` and `solve-seedling-r9-campaign.mjs:260-279` (`latchOf`) each drive a single `--tape` on a fresh page. |
| `derive-seedling-tick0` | **no** | A single `--tape` per run (`derive-seedling-tick0.mjs:245, 273-282`). |

`botReset` is called only by the fixed engine (`flashPanel/seedlingWasmPlayback.js:172`) and three probes (`probe-seedling-wasm-playback.mjs:312`, `probe-seedling-wasm-host-tape.mjs:279/542`, `probe-seedling-r5-mobiles.mjs:209`). **The item closes.** The adjacent risk is unmeasured: between two windows, `watchWasm` (`releaseKeysInFrame`, `:1773-1785`) and the director's driver (`.py:502-530`) release a key a window ends holding with a LONE `keyup`, which is the shape W3 measured as dropped. The driver's own comment (`.py:414-421`) says such a key stays held at window end, while the differential's press/release totals (`:1749-1752`) say the final tick's release is latched. Which one holds is the open question (residue).

## D3: press/arrow kill-lock timing — STOP

**Census.** Over every committed tape (the model run, `chaserKillLockOpens` with `nil: false`), only L5's `bob@48,80` opens a kill lock through a KILL: an **arrow** kill in `r7-act2-5` (t245, declared 737), `r7-act2-full` (t1067, declared 1559) and `r8-solve-5` (t326, declared 427 = 326 + 101). No press kill opens a lock in any committed tape. An arrow kill goes through the same `stageChaserKill` a press does.

**The model's own fenceposts** on `r8-solve-5`: the kill (die anim starts) is t326, `destroy` is t350, and the removal is t361. The two readings therefore predict the clear at 427 (the kill, today's ledger) or 462 (the removal, R2's reading).

**The witness** (`r5-arrow-killlock`; the producer and data are in `seedling-swim-r5-l5-killlock.json`, and the tape is not committed). It replays `r8-solve-5`'s staging and keys to t328, then its own walk from t462 (the same parked spot, (56.15, 56.40)), then `down`. The model holds the player on the lock at y 108.55 for t422–427 and crosses to L6 on **t429**. The first cut (walk from t430, keys to t340) reached the lock only at about t466, after both predictions, so it could not tell them apart. It was re-aimed.

**The game** (`check-seedling-bot-differential.mjs --record --only=r5-arrow-killlock`, recorded twice with identical results): **refuted at t423**. The game puts the player at y 109.65 (through), the model at 108.55 (held). The game crosses on **t424**. `gameVisibleTape` withholds the timed row, so the game opened the lock from its own count. A `Lock` turns off 101 steps after `totalEnemies()` reaches zero (`Lock.as:64-97`), so the game's count was zero by about t322. That is **before the model's kill tick**, which neither reading predicts.

**Why: L5's bodies are not the game's.** `probe-seedling-u9-shield-mobiles.mjs --tape=r8-solve-5 --class=Bob`, on the COMMITTED tape: the clock calibrates (shift [0]), 336 comparisons, worst |Δ| **23.06 px**.

- t54: `bob@16,64`'s first arrow hit lands on the same tick in both, with a different knockback: game v (−2.69, 2.31), model (−0.49, 3.70).
- From t58 the hits land on different bodies.
- At t200 the game holds one bob (hits 3, no anim) against the model's `bob@48,80` alive at hits 1.

The player stream never sees any of this. The player waits at (56.15, 56.40) until about t462, and every committed L5 tape reaches the lock long after it opens.

**Verdict.** The question the brief asked cannot be asked in L5: the model's kill tick there is not the game's. No ledger change was made. Moving the ledger to the removal would put the model further from the game (462 against a game opening by about 422). The refuted witness is not committed (the recorder's own rule: *"a fixture whose model is wrong is either a permanent red or a silenced one"*). What this leaves for the queue:

1. L5's arrow knockback on a Bob (the first divergence, t54);
2. `r8-solve-5`'s `{5,0}@427` and `r9-campaign`'s `{5,0}` evidence row (`removedAt: 326`, `source: 'model'`) are model values the game contradicts. The replay is unaffected, because the declaration is what it rides and the player arrives late;
3. the kill-vs-removal question, re-asked in a room whose kills the model reproduces (body probe first).

## D4: the Green Key ledger credit (`693118d`)

**The rule** (`r7Acceptance.goalEarnedWitness` → `GOAL_PLACEMENT_WITNESS`). A row is earned when its collectible goes NOT-HELD → HELD between a segment's boot and its latch. For the kinds marked `true`, the level must also gain a clear. Every vanilla `bosskey` has tag −1, and `BossKey.removed()` writes a clear only when `tag >= 0`. So a key row could be credited only by an unrelated clear in its window (L19's ShieldBoss clears {19,0}/{19,1}).

**The change.** `key: false`, with the reason written beside it:

- during play, `BossKey.removed()` (`Pickups/BossKey.as:66`) is the only writer of `hasKey[kt] = true`. `Bot.as:1720-1726` is the v6 `save` block's boot staging, before tick 0; `Main.as:282-290` is the save's load;
- each `keyType` has exactly ONE vanilla placement (atlas: 0 in L19, 1 in L29, 2 in L40, 3 in L55, 4 in L67), and that is the row's level.

A declared key still cannot be earned, because it never flips. L19's witness sentence is unchanged: it still names its clears. `r9-campaign.earns` gains `bosskey1@L29`.

**The differential's reading**, on the game's own latches (the R4 harvest's full tier, run `37043915877`, `tier-merged`, 196 payloads with `seam`), through `chainGoalFindings`:

| chain | before | after |
|---|---|---|
| `r9-campaign` | 5 earned = 5 declared | **6 earned = 6 declared** (`bosskey1@L29` from `r9-solve-29`) |
| every other chain (14) | — | identical (`r8-d2`, a staged chain, still REPORTS `bosskey0@L19`, as before) |

The boot-to-boot census over the committed tapes agrees: the only key flips in any chain are `r9-solve-19` (key 0, with its clears) and `r9-solve-29` (key 1, no clear).

**Mutant** (predicted first: the two D4 rows red, and the game-latch chain row red): `key: true`. **Measured exactly that**: 2 red / 9, and `r9-campaign` reads *"DECLARED but not earned: bosskey1@L29"*. Restored.

## D5: the dead-frame probe's R6 terms (`67ddd06`)

**BEFORE**, at `4d37988` over the full tier's payloads: 196 tapes / 582 loads, **ADMITS 188/196**, CATCHES spurious 195/196 (`r6-seed-control` missed) and missed 196/196. The 8 rejected:

- `r3-bobboss-death`, `r3-drown`, `r3-lava`, `r3-pit-death`: each residue 40 over 1 load, which is a death's second load;
- `r6-contact-pair-heart`, `r6-contact-pair-live`: 38;
- `r6-seed-control`: 169, a ceremony started and not completed;
- `r6-seed-credits`: 40, a same-level reboot.

**The change.** `deadFrameBand.deadFrameBudget({tape, expected, transitions, exempt})` holds the terms. The differential and the probe both call it; neither carries a copy. The differential's message is unchanged. Its now-unused `CEREMONY_DEAD_FRAMES` import is gone.

**AFTER:** 196 tapes / 589 loads, **ADMITS 196/196, CATCHES 196/196 on both signs, 0 missed**.

**Parity.**

- The differential's old inline arithmetic against the function, every term, on all 196 tapes: 196 same / 0 diff.
- A live `--only=r6-seed-control,r3-drown` run: ALL CHECKS PASSED, with the same dead-frame lines.

**Mutant** (predicted first: the source-scan row red, and the probe back to 188/196): HEAD~1's probe copied in. **Measured exactly that.** Restored md5-identical (`d523df52…`).

**Residual.** The probe still exits 1 on `FADE_STATS` drift: the module was fitted on 79 tapes / 557 loads (mean 19.1275, σ 0.4117), and the tier measures 196 / 589 (mean 19.26, σ 0.61). Re-deriving it moves the gate's band, so it is left for the coordinator. The verdict line now names the drift, where it used to read *"FAIL: 0 admit failure(s), 0 missed injection(s)"*.

## D6: records

| Row | Command | Result |
|---|---|---|
| identity block AFTER | `SEEDLING_PORT=8990 bash scripts/procgen/identity-block.sh .` at `67ddd06` (D1+D4+D5 committed, clean tree) | **byte-identical to W0**: `diff w0/identity.log after/identity.log` is empty, md5 `25bb24aebf94d378049573e53007928f` both. That covers every row (c3/c6 included) and the reference |
| six `--check`s | the block's loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, exit 0, **identical** (D1's guard fires only where the old code overflowed; no producer reached it) |
| tapeRunner | `--reporter=json`, per-row diff against W0 | **449/449; the 449 (name, status) pairs are identical** (no witness added) |
| `seedling-bot-log.md` | `### Seedling substrate R5-swim — the close-out (2026-10-02)` | after R4's entry, with four trap candidates |
| trap candidates | the log entry | the self-re-entering refusal rung; the measuring copy of a gate's arithmetic; a placement witness a whole KIND can never produce; a model-sourced declaration whose bodies the game never checked |
| tape index / roster pins | `generate-tape-index` | **196, unmoved**. The D3 witness is refuted and not committed, so no pin, `seedlingAtlasDoorCensus` or `rosterCategories` row moves |
| refusal words | `grep -a` | no refusal was removed (D1 adds `BAIT_REENTRY`; D4 changes a placement ruling, not a refusal) |
| reference | `generate-procgen-reference.mjs`, then `--check`; `check-procgen-docs.mjs` | regenerated (the docs index: `README.md`, `docsIndex.js`) → **ALL 7 + 5 MATCH**; instruments 317, 0 findings; **ALL CHECKS PASSED** |
| surface | `--write` then `--check` | 191 rows, **GREEN 191** (no new run member) |
| constants | `--profile-rows` → `--write` → `--check` | **PASS, 4,937** (the 6 new literals are `deadFrameBudget`'s; 30 moved rows are line shifts) |
| profile / entities | `--check` (both tiers) | 138 / 518, PASS |
| bounded vitest AFTER | the W0 set plus `r5SwimCloseout` | **15 files / 1,217 green**. The first AFTER run read 1 red, `seedlingConstantsCensus` mutant (b), because the census saw `deadFrameBudget`'s 6 literals before `--write`. After the write that file and its siblings re-ran green (11 files / 563, with `procgenDocs`) |
| D3 data | `CC/docs/cloud-reports/seedling-swim-r5-l5-killlock.json` | the refuted witness tape, the game and model streams at the lock, the trimmed body probe |

## Surface, constants, profile and entity deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 191 | **GREEN 191** | none (`--write` rewrote the same 191 rows) |
| constants | PASS 4,931 | **PASS 4,937** | +6 `deadFrameBand.deadFrameBudget` literals (structural, the band's class); 30 moved rows (line shifts in `r7Acceptance.js` from the D4 docblock) |
| profile | 138 | **138**, both tiers | no new key |
| entities | 518 | **518** | no new record |
| tape index / tapeRunner | 196 / 449 | **196 / 449** | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** | the docs index regenerated over the log entry |
| bounded vitest | 14 / 1,208 | **15 / 1,217** | + `r5SwimCloseout` (9) |

## What the brief got wrong (measured)

1. **D5: "4 admit failures and 1 missed injection on the four `r6-*` tapes."** Measured **8** admit failures: the four `r6-*` tapes plus R3's four death tapes (`r3-bobboss-death`, `r3-drown`, `r3-lava`, `r3-pit-death`), one death load each. The probe also had a third failure cause it never named: the `FADE_STATS` drift.
2. **D3: "by R2's reading, the scratch layer's computed clear for a kill is early."** On the only kill lock a committed tape opens by a kill, the game opened by about t422, EARLIER than the model's kill-tick clear (427). The premise that the model knows the kill tick fails in L5: the bodies diverge at t54.
3. **D3: "a press kill in a kill-lock room (L5's `bob@48,80` room …)."** No committed tape press-kills there. The three kill-lock kills are arrows (through the same `stageChaserKill`).
4. **D4: "the key appears in `save.keys`."** The latch field is `save.hasKey`, a boolean array. `save.keys` is the tape's boot-block index list, which a declaration CAN set. The witness is the flip between the two.
5. **D2: "main `81006f821b`" as the JS arc's fix.** That commit is docs only. The code is `c5cdb04`.
6. **D1** was as stated (69 SOLVES, 70 overflows, 71 declines by name). The overflow also fires at W 41, 142 and 214.
7. **"`gh run download <id> -n tier-merged`".** The cloud `gh` token is invalid here. The artifact came through the GitHub MCP's `download_workflow_run_artifact`.
8. **My own predictions.**
   - The first D3 witness could not discriminate: it reached the lock after both predicted openings. I re-aimed it.
   - A third cut (walk from t210) went off the lock line. It was discarded.
   - The first D1 page assertion expected `BAIT_REENTRY` in the page's status, but the page keeps only the refusal's first line.
   - Every mutant landed as predicted.

## The arc's remaining-residue list

Still-refused arms, with the refusal text (trimmed) and the slice that measured it. Paths are under `frontend/modules/seedlingDemo/`. Rows 6–10's suit refusals are one shared throw (`playerDamage.js:313`, *"playerHit: \`hasDarkSuit\` retaliates INTO the attacker when the call passes \`e\` … and this source has not declared which it is (\`byEnemy\`). Refused by name rather than guessed…"*), raised by each contact site that calls `applyPlayerHit` without `retaliate`.

| # | arm | refusal (trimmed) | site | slice |
|---|---|---|---|---|
| 1 | **L5's bodies (NEW, D3)** | none. The model's arrow knockback and kill order diverge from t54, silently, and `r8-solve-5`'s `{5,0}@427` is contradicted by the game (opening by about t422) | `levelRun.js` arrow-hit path; `playthroughWalk.js` campaign `{5,0}` row | **swim R5 D3** |
| 2 | Turret damage | *"⚠ NOT `IceTurret`, AND NOT ITS TWIN. A plain `Turret` has no `death()` override, so its kill DOES remove the body…"*; thrown as *"createEnemyDamage: "${as3}" is \`refused\` — …"*; a press reaching it: *"…whose \`genericHit\` arm this rung REFUSES…"* | `enemyDamage.js:413-418`, `:799`; `levelRun.js:5089` | U15 (residue) |
| 3 | WallFlyer: a suit kill | *"the dark suit's retaliation KILLS ${id} … \`WallFlyer.startDeath\` plays "die"; its die anim, its fade and its place in \`totalEnemies()\` are not staged…"* | `levelRun.js:9475` | R2 D1 |
| 4 | WallFlyer: a ceremony beside a flyer in flight, in its i-frame or dying | *"a ${what} ceremony began … beside ${w.id}, which is IN FLIGHT / inside its i-frame or dying…"* | `levelRun.js:9515` | R2 D1 |
| 5 | WallFlyer: sword, arrow, wand, fire | `WallFlyer: { policy: 'refused', why: 'the Bob cost; off every R5 route' }` | `enemyDamage.js:388` | R5 (rung), kept by R2 |
| 6 | WallFlyer: `runFire`'s block sweep in L22/L25 | `wedgeVisible: false` → *"…is NOT MODELLED — no stepper, no per-visit position…"* | `spinner.js:841-848`; `botDriverV2.js:3817` | R2 D1 |
| 7 | The dark suit into STATIC bodies | the shared suit throw (`source: 'enemy'`), measured on L36 `sandtrap@80,80` t733 | `levelRun.js:9064` | R1 D1 |
| 8 | BobBoss | the suit: the shared throw (`source: 'bobBoss'`); a press: *"boss damage — the encounter SCRIPT owns it (\`bobBoss.js\`)…"*; re-entering L32 after the Fire is unwitnessed (no throw) | `levelRun.js:11906`; `enemyDamage.js:324` | R1 D1; R3 residue |
| 9 | ShieldBoss | the stab under the suit: the shared throw; *"a ${what} ceremony began … while the ShieldBoss … is still in the world…"* | `levelRun.js:7766`, `:8848` | R1 D1; R6 |
| 10 | Owl body under the suit; totem body | the shared throw (`owlBody`, `bossBody`); `BossTotem: refused — "R6 — hitsMax 5 and onlyHitBy = "Wand"…"` | `levelRun.js:8162`, `:16048`; `enemyDamage.js:419` | R1 D1; R6 |
| 11 | The Owl's split premise | *"${what} needs \`rng: { split: true }\`. With the split off, \`Rng.cos()\` IS \`Math.random()\`…"* | `finalBossRng.js:489` | R4 D1 |
| 12 | An Owl stream for a run that walks in | *"the Owl's draw stream would open in level ${n} after a boot in level ${boot.level}…"* | `levelRun.js:1548` | R4 D1 |
| 13 | Pulled bodies | *"…holds N Pull(s) AND pushable blocks or spinners — \`Pull.update\` moves every overlapping "Solid" and "Enemy" too…"*; *"${c.id} overlaps ${on.id} … the body arm is not transcribed"*; *"…pushed the player INTO a solid…"* | `levelRun.js:6979`, `:6990`, `:7005` | U12 D1 (R4 D4 found no reachable case) |
| 14 | The shake band | *"whether ${who} is on screen at tick … depends on where inside \`Game.shake\`'s jiggle the camera landed…"* (body, forecast, spit) | `levelRun.js:3818`, `:6505`, `:7340` | R6; R2 D2; U15 (spit) |
| 15 | The post-landing rebound | *"${what}: every key set … lands the player box on a body's 7x7 rect … There is no step out."* | `solverBot.js:6607` | U1/U3/U4b; U6; R4 D5 |
| 16 | `combat.js`'s stale `turret` row | a volume row (*"⛔ THE BODY IS NOT THE THREAT…"*), left byte-identical because the ENEMY census reads it | `combat.js:310-320` | U15 |
| 17 | An IceTurret corpse sliding into a chaser | *"the IceTurret corpse ${t.id} slides into the chaser ${c.id} … not transcribed (R4-swim D2)"* | `levelRun.js:10111` | R4 D2 |
| 18 | Two teleporters on one tick | *"${n} teleporters fired on the same tick … depends on FlashPunk's update order…"* | `playerPhysicsV2.js:1141` | R2 (kept) |
| 19 | A punch the dark suit kills | *"…KILLS ${c.id} through its PUNCH … \`setSprite("stand")\` replaces the "die" anim…"* | `levelRun.js:9233` | R1 D2 |
| 20 | A spit no DODGE stall clears | *"no stall of 1..${maxTicks} tick(s) at any walk-offset … clears the corridor…"*; the per-segment cap 12 | `solverBot.js:10407`, `:10389` | U15 D2 |
| 21 | Bait or kill at a static census body | *"${body.id} is a STATIC census body (\`speed 0\` …) — … That is a KILL question…"*; *"…is not a body this run steps…"* | `solverBot.js:10587`, `:9085` | R9 12b; U2 |
| 22 | A sword swing through stone | *"…\`collideLine("Solid", …)\` finds … \`Player.slash\`'s line-of-sight gate REFUSES that hit"* | `levelRun.js:8535`, `:8723` | U1, U8 |
| 23 | Spinner hammer reach with damage on | *"…is inside ${sp.id}'s HAMMER REACH … on a tape that does NOT declare \`noDamage\`"* | `levelRun.js:8439` | R1 |
| 24 | A BobBossNPC dialogue during a pickup | *"a BobBossNPC dialogue and a pickup ceremony are both up … Refused rather than approximated."* | `levelRun.js:11932` | pre-swim |
| 25 | A lone `keyup` at a window boundary (D2, unmeasured) | none; `watchWasm.releaseKeysInFrame`, the driver's release loop | `watchWasm.js:1773-1785`; `seedling-bot-replay-win.py:502-530` | swim R5 D2 |
| 26 | `FADE_STATS` re-derivation (D5) | the probe's *"⛔ FADE_STATS DOES NOT MATCH THESE OBSERVATIONS…"* | `probe-seedling-deadframe-band.mjs`; `deadFrameBand.js:72` | swim R5 D5 |
| 27 | The JS continuation's equips hand-over | none (`?tapes=r9-campaign` never equips the Fire at window 30) | `tapeRunner` resume path (JS arc S0) | U15 |
| 28 | Unwitnessed R3 arms | none (written from the AS3): the rebuilt rock pushing a player, an enemy hit during the spiral, a teleporter during the spiral; a preview refuses a lava death | `levelRun.js` (R3) | R3 |
| 29 | The U3/U4b cells and corridor; U6b's four REFUSED-UNVERIFIED boundaries; the gen room's water wall | as named in those reports | — | U3, U4b, U6b, S1/T2 |
| 30 | ⚖ The shake → cosmetic-RNG change | the user's (AS3 + wasm + gitlink, ASK FIRST), re-recording the 2 Owl tapes and 2 oracles | — | R4 D0 |
| 31 | `crossSwapStatics.js:473`'s stale `Music.as` cite | none | `crossSwapStatics.js:473` | R4 |

## Byte-inertia

| Artifact | W0 (`4d37988`) | head |
|---|---|---|
| identity log (every row: maze, acceptance, c3, c6, c4, ENEMY, guard, AREA, killgate ×3, level pre/post, generated set, the six `--check`s, the reference) | md5 `25bb24aebf94d378049573e53007928f` | **identical** (empty `diff`), measured at `67ddd06` |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, exit 0 | **identical**, exit 0 |
| tapeRunner | 449 (name, status) pairs | **identical** |
| D1 sweep (L6, W 0..240) | 227 / 10 / 4 overflow | 227 / 14 / 0; the 237 non-overflow rows byte-identical |
| differential's dead-frame terms | the inline arithmetic | `deadFrameBudget`: 196/196 identical on the full tier |
| `fixtures/**` | — | **untouched** (no tape, expectation or index change; `campaign-frontier.json` untouched) |

Untouched or not run: AS3, wasm, gitlinks, any committed tape or expectation, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, the unfiltered vitest. The JS arc's files (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `solveSegment`'s prefix admission, the solver worker) are untouched too; `r5SwimCloseout` imports `jsRuntimeCore`, `jsRuntimeSolver.replayTape` and `seedlingReturnSpawns` read-only.

**Scratch instruments** (session scratchpad, not committed):
- `zz_r5probe.mjs` (the W sweep), `zz_r5stack.mjs` (the stack capture);
- `d4earn.mjs`, `d4game.mjs` (the chain earned sets, boot-to-boot and over the game's latches);
- `d3census.mjs`, `d3look.mjs`, `d3wit.mjs`, `d3rm.mjs`, `d3y.mjs`, `mkd3.mjs`, and the witness producer `plan-seedling-swim-r5-closeout.mjs` (CUT 328 / WALK_FROM 462 / HOLD 120);
- the D5 parity script;
- the tier's 196 payloads (run `37043915877`);
- every log.
