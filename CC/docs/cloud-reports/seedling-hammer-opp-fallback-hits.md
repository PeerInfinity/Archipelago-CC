# Seedling hammer-phase OPP-FALLBACK-HITS — `OPP_PRESS_FALLBACK` must not adopt a redo that takes hits

Slice `seedling-hammer-opp-fallback-hits` (Opus, cloud). Planner: `seedling-hammer-phase-planning-6` / `-7`. ⚖ User
approval of 2026-11-12 (the hammer replan): *"… OPP fallback keeps hit redo …"*. Landing needs the user's SHA-bound
OK through the planner. No planner follow-up arrived during the session, so I followed this brief alone. Evidence is in
[`seedling-hammer-opp-fallback-hits-evidence/`](seedling-hammer-opp-fallback-hits-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | `a3a5b8182e` (`origin/main`, "train: content-r4 0f817667ad", train 101) |
| branch | `claude/seedling-opp-fallback-hits-90x3ss` |
| commits | `c566b3445b` (switch) · `779e305ff5` (rows + surface regen) · `77307b1b2e` (evidence) · this report |
| head | the commit that adds this report (see `git log`) |

## 2. The answer

**Switch:** `OPP_FALLBACK_HITS` (`oppFallbackHits.js`), **OFF**. `SEEDLING_OPP_FALLBACK_HITS=1` turns it on, and
`withOppFallbackHits(enabled, fn)` does the same for a row. It is read in the solve **worker** thread; no main-thread
decision reads it.

**The defect is real, and the census finds no leg where it matters:**
- **Leg 871:** the defect reproduces as the brief describes. OFF, the fallback adopts an 826-tick redo that the model
  bills 2 contact hits on (`bob@736,752` at t666 and t737), and the segment refuses later, at work 885. ON, the redo
  is refused by name and undone. The original `HAMMER_SAFETY` refusal stands, so the verdict is unchanged (refused)
  and the refusal comes at work 255 instead of 885.
- **Hitless redos are unchanged:** leg 377 at clock 5323 has 2 fallback asks, both hitless redos. The plan is
  byte-identical OFF and ON (sha `63901cbdc728`).
- **The seed-1 sweep census:** **0 legs adopt any `OPP_PRESS_FALLBACK` redo, hit-bearing or not.** That covers 987
  captured page requests over 918 leg keys at the page's budgets, the 84 refused ones re-solved uncapped, and the 28
  captured requests under `fixtures/` uncapped. **No leg's solve carried such hits**, so there is no headline leg.

**The one thing to know first:** the fallback fires only off the shipped path. The two witnesses are 871 under the
hammerClearTagChain train row's set with `withL40Flip(false)` and OPP forced on, and 377 at a moved arrival clock. At
the page's own requests it never fires. So this switch is a guard with no measured mover in the sweep: on 871 it turns
a slow refusal (885 work) into an early one (255) and stops a hit-bearing prefix being adopted. It changes no solve.

## 3. The reproduction (measured)

Leg by key: `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`.
That is sweep id **878** at the base (`seedling-divergence-legs.mjs --carry-route-flags`). The captured request is
`fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz`, solved as the train row solves it: dashless,
uncapped, `withL40Flip(false)` + {CLEARTAG_CHAIN, STANCE_BURN, OPPORTUNISTIC_STRIKE, CHASER_STAGED_HUNT,
PRESS_ESCAPE_EXACT, `forecastShieldBump`}.

| Measurement | Value | Evidence |
|---|---|---|
| The solve at the base (OFF) | refused, **work 885**; `-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED …`; refusal keys 826 (prefix 0) | `leg871-off.txt` |
| The fallback's instrument (OFF) | `OPP_PRESS_FALLBACK_COUNTS {asked 1, solved 1, refused 0}`: one redo, adopted | same |
| The census audit of that redo (OFF + instrument) | `{t: 0, ticks: 826, bodies: [spinner@880,848], hits: [{t 666, chaser, bob@736,752}, {t 737, chaser, bob@736,752}]}`. The run is otherwise identical (work 885) | `leg871-census.txt` |
| The same hits, by independent replay of the refusal's 826 keys on a fresh run | `[[666,"chaser","bob@736,752"],[737,"chaser","bob@736,752"]]` | DYING-BODY-WAIT's `leg871-repro-off.txt`, re-run here (`tools/leg871-ofh.mjs` reads them off the ledger) |

**Which check bills the hits:** the model's contact test (`levelRun`'s `playerHits` ledger, `source: 'chaser'`), on
the redo's own run. **Why the redo's acceptance did not see them:**
- `execKillByPressOppFallback` adopts the redo on one test: the kill completed. That means either a returned record or
  the lock tail's `PendingDeclaration`.
- The press kill's executor (`execKillByPressOnce`, ~800 lines) never reads `playerHits`. Its no-hit rule is the
  forecast's: `safeStep` against the bodies' rects and hammer lines, and the danger map.
- So a contact hit the forecast did not price is billed on the run and adopted with it. Nothing downstream audits a
  segment's ledger either: the hit-ledger guards in `solverBot.js` belong to particular verbs (staging walks, turret
  kills, departure waits), not to the press kill.
- It is not that hits are counted on a different run. The audit reads the redo's own run.

## 4. Design, change, OFF identity

- **`oppFallbackHits.js` (new):**
  - the switch `{enabled, census}`, `OPP_FALLBACK_HITS_DEFAULT = false`, `withOppFallbackHits`;
  - the instrument `OPP_FALLBACK_HITS_COUNTS {audited, hitless, hit, refused, rows}`;
  - `playerHitsSince(run, clock)` (hits with `t > clock`);
  - `auditOppFallbackRedo(row, hits)` (records, and returns "refuse" only when ON and there is a hit);
  - `oppFallbackHitsSentence`.

  `census` is an instrument flag, never read from env and default false. It makes the OFF path audit and record while
  still adopting: this is the census's one-pass reading.
- **`solverBot.js`, all inside `execKillByPressOppFallback` plus one new function.** Nothing renamed or reformatted.
  - `clock0 = fresh.ticksCompleted` is read after the rewind.
  - On both adoption paths (a returned record, and the `PendingDeclaration` / `undeclaredKillLock` throw):
    `if (oppFallbackHitsAudits()) oppFallbackRedoAudit(…)`, placed before the adoption's count and note.
  - In the catch: `if (e2?.oppFallbackHitsRefused) throw e2;`, so a refusal already undone is not undone twice.
  - The new `oppFallbackRedoAudit` reads the hits off `fresh`. If `HAMMER_FIGHT_FALLBACK` is on, an inner rewind may
    have adopted a different run, so it reads them off `ctx.rewind.replay(perTick.length)` instead (that switch is OFF
    by default).
  - ON, any hit means `undo()` (the run, keys, equips, takes and dash count go back to the refusal's) and the
    **original** refusal `e` is thrown with its code and words unchanged, plus one sentence. The row is marked
    `verdict: refused, retryRefused: 'OPP_FALLBACK_HITS', hits`, and `OPP_PRESS_FALLBACK_COUNTS.refused` is bumped.
- **`solverEnvChannel.js`:** `SEEDLING_OPP_FALLBACK_HITS` added to `SOLVER_ENV_NAMES`.
- **Generated:** `seedling-solver-surface.json` regenerated (+1 module, sites 199 → 200). `--check` GREEN, 372 rows.
  `generate-procgen-reference.mjs` and `generate-docs-index.mjs` regenerated with no diff.
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives
  `391322d681b7aa0229d94b3f6906d024` at the **base** (a worktree at `a3a5b8182e`) and at the **head**. It equals the
  brief's fe98f37f22 value. OFF, the only new statements executed are one `fresh.ticksCompleted` read and the
  `oppFallbackHitsAudits()` test.
- **Rejected design:** re-planning instead of refusing. The redo is already the plain press kill, the defaults' kill.
  Re-planning would need a third kill policy, and 871 shows that refusing keeps the verdict. I took the smallest
  change.

## 5. Rows and bounded vitest runs

| File | Rows | Result |
|---|---|---|
| `hammerOppFallbackHits.test.js` (fast) | the switch (OFF, env name, wrapper restores); audit only ON or under the census instrument; `playerHitsSince` `t > clock`; the instrument's counts and the ON-only refusal; the sentence; the source shape (both adoption paths guarded, audit before the count, no double undo) | **6 / 6** |
| `hammerOppFallbackHits.train.test.js` (train) | **871 OFF**: refused, work 885, 826 refusal keys, `{asked 1, solved 1}`, audit row `hits` t666/t737 bob@736,752, not refused · **871 ON**: refused, work 255, message = the `HAMMER_SAFETY` "no step out" refusal + `` `OPP_FALLBACK_HITS` `` + "2 player hit(s) on the redo (t666 chaser:bob@736,752, t737 chaser:bob@736,752)", `{asked 1, solved 0, refused 1}`, error row `retryRefused: OPP_FALLBACK_HITS` · **377 @5323, flip ON**: OFF = ON digest, `OPP_PRESS_FALLBACK` counts equal, ON audited = adopted, 0 hits, 0 refused | **3 / 3**, 162 s (`vitest-train-oppFallbackHits.txt`) |
| `hammerOppPressFallback.train.test.js` (existing, regression) | unchanged | **4 / 4**, 150 s |
| fast set: `hammerOppFallbackHits`, `hammerOppPressFallback`, `solverEnvChannel`, `seedlingSolverSurface` | | **57 / 57** in 4 files (`vitest-fast.txt`); `entityBlocks.test.js` also ran green (72 / 72 with surface + fast) |

No unfiltered vitest ran here (⚖ 52). Per the CLAUDE.md train ruling, a packet touching solverBot quotes a
**dispatched** train-tier run at its tip. I could not dispatch it from here; the planner owes
`gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f train_only=true`.

## 6. Page play / game witness

None. The change is OFF, and no shipped page request reaches the code it guards (§ 7). A page witness would need the
train row's off-default set, which the page's channel can carry (`?seedlingSolverEnv=SEEDLING_OPP_FALLBACK_HITS=1;…`),
but it would only re-show 871's refusal.

## 7. Census

**Seed-1 divergence-sweep legs this change can move: none measured.**

| Arm | Requests | `OPP_PRESS_FALLBACK` asks | adopted redos | with hits | Evidence |
|---|---|---|---|---|---|
| Sweep run `43135173250` (capture=true, full sweep at `b0e9d52ac4` = train 96 + drill flip), every captured request replayed in node at this base, request budgets, shipped defaults | **987** (918 leg keys); 903 solve / 84 refuse; 985 / 987 agree with the page's own `ok` | **0** | 0 | 0 | `census-sweep-capped.tsv` |
| The 84 refused requests re-solved **uncapped** (budget removed, 300 s cap, none hit it; longest 182 s) | 84: 17 solve, 67 refuse | **0** | 0 | 0 | `census-sweep-refused-uncapped.tsv` |
| Every captured request under `fixtures/*/` uncapped, shipped defaults (871's included: it **solves**, 52.5 s) | 28 | **0** | 0 | 0 | `census-fixtures-uncapped.tsv` |
| 871 under the train row's set (`withL40Flip(false)`) | 1 | 1 | 1 | **1** (2 hits) | § 3 |
| 377 at clock 5323 (flip ON = the defaults, arrival clock moved) | 1 | 2 | 2 | 0 | `leg377-5323-off-on.txt` |

- **Why the fallback never fires on the page's requests.** It is asked only when an OPP press kill refuses with a
  `FIGHT_FALLBACK_CODES` code inside a segment that can rewind. At the page's arrivals the OPP press kills either
  succeed or are never chosen. The measured asks need a moved arrival clock (377) or a pre-flip switch set with OPP
  forced on (871).
- **The census sweep is train 96, not train 101.** Its keys predate R-A5: 871's leg reads
  `… ~> level_40__r23c29 -> …` (id 876 there), against `… ~> level_40__r26c13 -> …` (id 878) at the base. The
  requests were replayed at the base, so the solver measured is the base's; only the arrival states are train 96's.
  Two of 987 answers differ from the page's.
- **The vanilla route survey was not run.** It is hours of CPU (`seedling-survey.yml`, 12 shards), and it has no
  `env` input, so it cannot carry the switch or read the instrument. To cover it, push a `seedling-survey/opp-fallback-hits`
  ref with `OPP_FALLBACK_HITS.enabled` defaulting to true, then
  `gh workflow run seedling-survey.yml -R PeerInfinity/Archipelago-CC --ref seedling-survey/opp-fallback-hits -f route=both -f shards=12`
  against a main control at the same base, and diff the per-step verdicts. Given 0 asks over 1,099 requests, I expect
  no movement.

## 8. What the brief got wrong (measured)

1. **Nothing in the premise.** The redo is recorded `{verdict: solved, ticks: 826, how: opp-plain}` and its keys bill
   t666 and t737 (§ 3). One correction to its framing: the redo is not "accepted on its segment verdict". It is
   adopted *before* any segment verdict, on "the kill completed" alone, and the press kill never reads the hit ledger.
2. **"If the census finds a leg whose SOLVE carried those hits, that leg's ON verdict is the headline":** there is no
   such leg. No sweep request asks the fallback at all (§ 7).
3. **Leg ids:** 871 is **878** at the base (the brief's key is the base's), and **876** under the census sweep's
   pre-R-A5 key. Leg 377 (the fixture's name) is `level_40__r0c53 <- in_L42_240_336 -> location:L40 flag 1:
   wandlock@176,80 cleared`.

## 9. Residue and hand-overs

1. **Land or drop (the planner's call).** `OPP_FALLBACK_HITS` is OFF, byte-identical, and local (one new module, one
   new solverBot function, 4 guarded lines at the call site, one env name). It has a real witness (871) and a
   hitless control (377). Its only measured effect is earlier refusal on an off-default set. A flip ON would be safe
   by the census: 0 asks on the shipped path, so nothing can move there.
2. **To fidelity / the hammer arc (not measured here): why the plain press kill walks into chaser contact hits.**
   `bob@736,752`'s hits at t666 and t737 land inside a kill whose per-tick gate (`safeStep`) passed every tick. Either
   the press kill's step is blind to chaser contact, or the chaser forecast misses there. I did not measure which, or
   whether OPP's discarded first branch (t0–t724) took hits of its own. Replay:
   `tools/leg871-ofh.mjs census`, then the ledger rows (t666, t737).
3. **Train-shard cost row** for `hammerOppFallbackHits.train.test.js` (162 s locally, 4 cores). I left it out because
   parallel slices edit `scripts/test/train-shard-costs.json`. Without the row it runs on the lightest shard, with a
   warning.
4. **A dispatched train-tier run at the tip** (§ 5), for the planner.
5. **Evidence tools** (`tools/*.mjs`) use absolute paths into the session's checkout (`/home/user/Archipelago-CC`) and
   write nothing tracked. `census.mjs` takes `UNCAPPED=1` and `ONLY_REQ=<id>:<i>`; mode `on` sets the switch instead
   of the census flag.
