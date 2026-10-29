# Seedling fidelity SECUSE — make `secondaryUse` flippable (wave 35, planner `seedling-fidelity-planning-16`)

**Start** main `9dadbdfc4b` (102 default-ON of 113) · **harness branch** `claude/seedling-fidelity-wave-35-6m435j` ·
**head**: the commit that adds this report (the previous code head is `secuse: boxLock roster …`). Evidence:
`seedling-fidelity-secuse-evidence/`.

| D | verdict | the one line |
|---|---|---|
| W0 | **MEASURED, on the game** | An X+C tick with both slots on the Sword (a fresh game's default) is a slash plus a same-frame slash-dash. At leg 622 it crosses L73→L74 **hitless**, where X, C and nothing all take the t2 hit. |
| D1 | **STOP** (the brief's own rule) | X+C CAN escape the hit, so an alphabet without it is not a sound proof. ON, the proof dying at node 4 on the refused X+C entry is the honest verdict. The cure is js's C4 arm (hand-over below). |
| D2 | **PASS, measured; no change** | Across js-12's four full sweeps, 0 proofs end on a model refusal OFF and 1 ON (L73's X+C). A state refusal ends a proof correctly. The ice-blast FROZEN press is a latent false-open on 0 legs. |
| D3 | **NOT flip-ready** (list below) | With `SEEDLING_SECONDARY_USE=1`: 17 rows in 7 files are red. Every one is leg 622's forced-hit chain, plus the defaults pin. Producers 97/0 red. The six `--check`s are md5-equal. |

⚠ **The one thing to know first:** FORCEDHIT's leg-622 proof (*"every input over 36 held sets is hit by t2"*) is
**false on the game**. It holds OFF only because the model reads C as nothing. The game's own answer at that arrival is
`up` + X+C on t0, a hitless crossing. The 7 forcedHit rows that go red ON are red because the flag makes the model admit
it cannot answer that input, not because the proof broke.

## W0 — the base, the refusal and the game's answer

| row | command | result |
|---|---|---|
| base | `git checkout -B … 9dadbdfc4b`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0, server :9764 |
| identity block | `SEEDLING_PORT=9764 identity-block.sh .` at head (my change adds no model code) → `identity-head.txt` | every row **equal** to L12DOORS' published base block (maze `57e07d21` … post-sword `fb1a59e5`); six `--check`s battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8`, all exit 0; reference 4 DIFFER (the known box artifact: this container's uninitialised `bulletml-dodge` drops noiz2sa from registry/capabilities) |
| the 7 reds | `SEEDLING_SECONDARY_USE=1 npx vitest run fidelityForcedHit.test.js` | **7 of 14 red**, each `proven: false, nodes: 4`; OFF 14/14 — js-12's measurement reproduced |
| the fork | leg 622's staging (`leash-l73-622-up-lavarunner`) | `primary` 0, `secondary` 0, slots `[0,1,2,3]`, weapon `sword` — **both keys use the Sword** |

**What `forcedHit.js` reads as "open"** (`proveForcedHit` ~219-233): ANY throw from `f.advance(keys)` ends the proof with
`proven: false, unmodelled: <keys>`. That covers C4's X+C, either `FROZEN_TICK_PRESS`, `IGNEOUS_UNMODELLED` and every
press-time `levelRun` refusal, and also a throw that does not depend on the input (D2). `hitlessWitness` skips a refused
candidate instead (its candidates hold no press, so only a state refusal reaches it).

**The AS3** (`Player.as:1561-1568`, `:1575-1614`, the setters `:779-870`): `useItem(Main.primary)` then
`useItem(Main.secondary)`, both inside `input()`, before `moveX/moveY`. Each verb's setter needs the others off
(`!slashing && !firing && !wanding && !spearing`, except Fire⇄Wand under `hasFireWand`). So for two DIFFERENT verbs the
first one's flag refuses the second, and the tick is the first verb's. **Two Sword-family calls (items 0/4) are not
excluded.** The first sets `slashTimer = slashTimerMax`, then the second finds `slashTimer > 0 && _s && !slashDashed` and
runs `knockback(2, (x − v.x, y − v.y))`: the dash, on the press's own frame. `Main.secondary` starts at slot 0, the same as
`Main.primary`.

**The game witness** (p4g headless, new instrument `probe-seedling-secondary-use.mjs`, committed fixture
`fixtures/secondary-use-witness/secuse-l73-622-xc.json`, arms file `evidence/arms-l73.json`): leg 622 with `up` held
t0..t6, and on t0:

| arm | t1 (x, y, vy) | t2 hits | t3 hits | crossing |
|---|---|---|---|---|
| nothing / X / C | (72, 23.2, −0.8) | **1** | 1 | L74 at t4 |
| **X+C** (both Sword) | (72, **21.2**, **−2.8**) | **0** | 0 | L74 at t4, **hitless** |
| C, secondary = Fire | = nothing | 1 | 1 | L74 at t4 |
| X+C, secondary = Fire | = X, sample for sample | 1 | 1 | L74 at t4 |

**Answer, measured:** yes. Under the game's rules an X+C tick reaches a state that neither X alone nor C alone reaches on
that tick, whenever both slots resolve to a Sword-family item, and at leg 622 that state escapes the forced hit. For
distinct verbs (measured: Sword + Fire) the tick is X.

`fidelitySecondaryUse.test.js` (12 rows, green in both arms) pins the witness. It also pins:
- the model OFF reproducing nothing/X/C and both Fire arms at 0 px;
- the model OFF reading the sword X+C arm as X (billing the hit the game does not);
- the model ON reproducing C (and C-on-Fire up to the door);
- both X+C arms refused ON;
- the proof's OFF "proven" and its ON node-4 open.

## D1 — STOP

The brief: *"if W0 shows X+C CAN escape, STOP with that measurement instead (the alternative is modelling X+C in
`levelRun`, which is js's C4 arm — a hand-over)."* It does, so `forcedHit.js` is unchanged.
- **A partial reduction was considered and not built.** Dropping X+C only when the two slots hold different verbs would be
  sound by the setter argument above, measured for Sword + Fire. But a fresh game's slots are the same (0, 0), the only
  measured mover is that case, and the reduction would add an inventory-dependent alphabet that the C4 model makes
  unnecessary.
- **⛓ HAND-OVER to the JS arc (C4, `levelRun.js` ~22755).** Model `xPressed && cPressed` as `useItem(primary)` then
  `useItem(secondary)` through the setters' exclusions:
  - a second Sword-family call while `slashTimer > 0 && !slashDashed` is the same-frame dash (`knockback(2, …)`, before
    the move);
  - a different verb is refused by the first verb's flag;
  - Fire⇄Wand under `hasFireWand` both run.

  Acceptance: `fidelitySecondaryUse.test.js`' row *"ON (C4, today): both X+C arms are refused by name"* flips to "the
  game's at every sample" for `XC` and `XC-fire`.
- **⛓ FOLLOW-UP in my region, once C4 lands.** The proof will then find `[up+primary+secondary]` hitless and end
  `proven: false`, and today the forced-hit rung REFUSES on that. L73 is restored only if the rung plays a hitless leaf
  that crosses: a 0-hit crossing, admitted as the tree's crossing verdict already reads it (`proveForcedHit`'s *"a hitless
  input that leaves the room: it is a crossing"*, depth ≥ 4 here, beyond `depthMax` 3). This needs the C4 model to be
  stepped, so it is queued, not built.
- **The 7 red rows are expected under the flag**, and stay red until C4 plus that follow-up. FORCEDHIT's leg-622 rows pin
  a proof the game refutes. At the flip they want re-pinning to the game's hitless crossing, not to the OFF numbers.

## D2 — the other refusals, measured (no change)

| refusal | class | one measured example | proof-open right? |
|---|---|---|---|
| C4 X+C | input | leg 622 ON: node 4, `unmodelled: primary+secondary` | **yes**: the game's answer differs and escapes (W0) |
| `FROZEN_TICK_PRESS`, sword window pending into a button-drop freeze | **state** | housekeep's L74 staging (`arrivalStaging({level:74,x:288,y:128})`, sweep leg 631's shape): the solver's t0 press, then EVERY input (`·`, `primary`, `down`, `down+primary`) refused; `proveForcedHit` open at **node 1**, `unmodelled: ·` | **yes**: the model cannot step the state at all |
| `FROZEN_TICK_PRESS`, ice-blast `frozenTimer` press | input | **0 legs**: no proof in js-12's four full sweeps ends on it (`d2-sweep-refusal-census.txt`) | latent false-open: the game LOSES the press, which equals the press-free twin. Not changed (no proof dies on it) |
| press-time refusals (`the X press reaches …`, `IGNEOUS_UNMODELLED`, `the tape holds …`) | input or state | 0 legs, OFF and ON | yes (the game's answer is unknown to the model) |

Census (`d2-sweep-refusal-census.txt`, js-12's sweeps): OFF 40770736276 / 40771324380 have 28 "not proven" each, all the
witness's *"hitless input survives"*, and 0 model refusals. ON 40770739656 / 40771334408 add exactly L73's X+C.

**Residue found (not this slice's): a fire window rides a door.** ON, C on the Fire slot at t0 of leg 622: the model
carries `fireWindows` across the L73→L74 teleport. Its t5 hit tick then lands on L74's arrival-button freeze and is
refused (`FROZEN_TICK_PRESS`, *"a fire window's hit tick 5 falls on a FROZEN tick"*). On the game the next world's Player
has no window, and it walks on. The same happens OFF with Fire on the PRIMARY slot. It is pinned as a residue row in
`fidelitySecondaryUse.test.js`; route it to whoever owns `fireWindows`.

## D3 — flip readiness with `SEEDLING_SECONDARY_USE=1` (do NOT flip)

**Bounded set** (`vitest-files.txt`: LIGHTPOLE's 102 paths, plus every test that `grep -a`s `FORCED_HIT_ALPHABET`,
`forcedHit`, `secondaryUse`, `SECONDARY_KEY`, `SEEDLING_SECONDARY_USE`, `helpFrame`, plus mine = 111 files; the two
`.slow` ones by `vitest.slow.config.js`):

| arm | result |
|---|---|
| defaults (OFF), loaded box | 4 red in 3 files. Solo: `seedlingWasmPlayback` and `dangerMap` are **green** (89 s / 65 s timeouts under the concurrent identity block and help gate). `boxLock` "takes conditionally" was **mine**: the roster did not name the new box-taking instrument, so it is now added (26/26). The other boxLock row passed solo. |
| ON | **18 red in 8 files** at the time; after my two fixes (my test's switch restore, the boxLock roster) **17 red in 7 files**, listed below |
| slow, OFF / ON | 6/6 / 6/6 |

The ON reds, with attribution:
- **`fidelityForcedHit`, 7 rows** (the brief's 7): leg 622's proof is now open at node 4. **Expected** (D1).
- **`fidelityStagedHits`, 4 rows** (leg 622 with staged damage 0/1/2, and *"at hitsMax − 1 every leaf is a death"*): the
  same proof, leg 622. **Expected**.
- **`fidelityLeash`, 1 row** (*"every two-tick prefix (the 8 directions + none, the sword, the secondary) takes a hit by
  t2"*): the same claim, which the game refutes (W0). **Expected**, and it needs a re-pin at a flip.
- **`fidelityUnbilledGate`, 1 row** (*"ON: a BILLED forced hit is not unbilled — leg 622 still solves (the control)"*):
  its control is leg 622's forced-hit solve. **Expected** (a stub/control that assumed the OFF default).
- **`jsRuntimeForcedHit`, 2 rows** (page + worker, leg 622's `forcedHits`/`damage`): leg 622 again. **Expected**. These are
  JS-arc pins that move at a flip.
- **`contactFidelity`, 1 row** (*"the shipped defaults: all three ON"*): the live switches no longer equal the pinned
  defaults under the env. That is the ordinary re-pin at a flip.
- **`boxLock`, 1 row**: fixed (mine, above).
- **The 2 `helpFrame` rows** (js §5.162 finding 2) are **not red** in this run. `gameClock.test.js` is the only test file
  naming `helpFrame` and it is green ON. I could not reproduce them at this base: **the brief's count is unmatched (measured)**.

**Other gates ON:** `ci-producer-checks.mjs --jobs=3` gives **97 run, 0 red** (OFF the same). The six `--check`s ON are md5
**equal** to OFF (`six-checks-on.txt`). No committed tape presses C (the roster is unchanged), so the flag cannot move a
producer digest.

**Readiness verdict:** every red is leg 622's forced-hit chain or the defaults pin. Flipping today would trade L73's
billed crossing (a hit the game shows is avoidable) for a refusal. Flip after C4 plus the forced-hit hitless-leaf
follow-up, and re-pin the 15 leg-622 rows to the game's hitless crossing.

## Movers (survey / sweep) — no model code moved

My commits add a witness, a test, an instrument, a roster row and docs. `levelRun.js`, `forcedHit.js` and
`contactFidelity.js` are byte-identical to the base, so js-12's A/B stands at my head unchanged:
- survey: 0 of 240 steps move;
- sweep: ONE real mover, `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` (OFF done by a 4-tick
  `forced-hit`, ON failed at node 4);
- `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest` fails in both arms.

**Expected after this slice: L73 is NOT restored** (D1 STOPPED). For the planner, re-confirming is optional because nothing
moved. If C4 plus the follow-up land, the dispatches are:
- `seedling-survey.yml` ×2 per arm on a throwaway arm branch, with `SEEDLING_SECONDARY_USE: '1'` in the ON arm's env
  (`--through=end --route=full`);
- `seedling-divergence-sweep.yml` ×2 per arm, `contact_fidelity` = the 102 default-ON keys `|` `secondaryUse` (ON) and the
  102 alone (OFF), full legs; then keyed with `keys='level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0'`,
  `capture_requests=true`;
- `seedling-probe.yml battery=standard` at the arm.

Expected then: L73 done ON with 0 hits.

## Hand-overs, deltas, what the brief got wrong

- **JS arc:** C4 (above), plus the 2 `jsRuntimeForcedHit` rows that move at a flip. No new staging/result field and no
  `SolverRefusal` kind.
- **Hammer arc:** nothing.
- **Fire-window owner:** the door residue (D2).
- **The brief got wrong (measured):**
  1. *"OFF, C is inert and the tie order puts the C-free twin first"*: true of the model, but it makes the OFF proof
     **unsound**. The game's C is not inert.
  2. The 2 `helpFrame` reds did not reproduce at `9dadbdfc4b`.
  3. *"Expected: L73 restored (done ON)"*: not by an alphabet fix. W0 forbids that fix.
- **Residue:**
  - the ice-blast FROZEN press is a latent false-open (0 legs);
  - the fire window across a door;
  - the reference's 4 box-artifact DIFFERs (environment).
- **Byte-inertia:** identity block at head = the base block (every md5). No `levelRun.js` / `forcedHit.js` /
  `contactFidelity.js` byte moved. The OFF bounded set is green bar load timeouts.
- **Records:**
  - `seedling-bot-log.md` entry (with trap candidates);
  - instruments reference regenerated (+1 instrument, docs index);
  - `boxLock` roster +1;
  - help gate ALL PASS (505, `help-gate.txt`);
  - roster unchanged (no tape).

## Rows to BANK

- `fidelitySecondaryUse.test.js` 12/12 in both arms.
- The game witness `secuse-l73-622-xc`: XC t1 vy −2.8, hits all 0, L74 at t4.
- Identity block at head = the base block.
- `ci-producer-checks` 97/0 red, OFF and ON.
- ON bounded: 17 reds, all attributed above.
