# Cloud report: `seedling-hammer-tb-weapons` — the TentacleBeast verb per weapon (Spear policy; the Wand arm handed over)

## 1. SHAs

`ev/` below = `CC/docs/cloud-reports/seedling-hammer-tb-weapons-evidence/` (its `README.md` lists every file).

- Start: `ba367618590c5cc9b9c7c0e6e603c6c9879e2332` (main after TRAIN 193). Branch `claude/seedling-tb-weapons-a925zx`.
- Head: the commit carrying this report (its parent is `f79d1a61`).
- Commits: step 1 `90bb64b7` (measurement + harness), steps 2–3 `b9f07d7c` (code + rows), steps 4–6 ``f79d1a61``
  (witness evidence + the regenerated surface census), this report.
- Planner follow-ups: none arrived; nothing outside the brief was done.

## 2. The answer first

**Switch `SEEDLING_TB_WEAPON_ARMS` (`tbWeaponArms.TB_WEAPON_ARMS`, OFF; `withTbWeaponArms(enabled, fn)`). ON, a run with
no sword and the Ghost Spear fights the Tentacled Beast with a Spear row read from the press model, and every L57
arrival goes to SOLVED with 0 hits, `57:0`, into L58 — in the game too:**

| arrival (leg keys) | Spear, p4h model (A) | **Spear, GAME p4h** (2 seeds) | Spear, shipped-RNG model | Spear, GAME p4g |
|---|---|---|---|---|
| pit (96,160) — `level_57 <- in_pit_L56_6_10 -> …` (473/474) | 2612 t, 0 hits, same keys on 2 seeds | **SOLVED ×2, 0 hits, `57:0`, L58** | 1936 t (seed 418414780); seed 7 no death-free variant | **SOLVED, 0 hits, `57:0`, L58** (1937 obs, 0 px divergence) |
| door (96,64) — `level_57 <- in_L58_48_112 -> …` (475/476) | 2659 t, 0 hits, same keys | **SOLVED ×2, 0 hits, `57:0`, L58** | 2073 t / 1346 t (2 seeds) | **SOLVED ×2, 0 hits, `57:0`, L58** (0 divergence) |
| s2 staging (96,160, seed 2) | 2612 t, 0 hits, same keys | **SOLVED ×2, 0 hits, `57:0`, L58** | 5289 t (seed 2); seed 7 no death-free variant | **SOLVED, 0 hits, `57:0`, L58** (5290 obs, 0 divergence) |

On p4h the game and the p4h model (the rules' option-A hunks in an untracked copy) agree on **every tick** of all six tapes (2660 / 2613 / 2613 observations, no divergence), and the two seeds' game streams are **identical** per arrival (md5 `56693ae4ab…` door, `250928a75c…` pit and s2 — the pit and s2 plans are one tape from (96,160)). The Sword is untouched: its ON plans equal OFF byte for byte.

**The one thing to know first: the brief's premise is wrong.** The "Spear tool gap" (the press cadence 8 falling inside
an 11-tick window that `levelRun` refuses) was never the Spear: the rules harness equipped slot 0 for a non-sword arm,
and in the pit/door stagings' bag (`hasFire: true`) slot 0 is the **Fire** — "the cadence is 11" is
`FIRE_PRESS_CADENCE`. The Spear's own cadence is `SPEAR_ANIM_TICKS` = 5, and the Sword-tuned policy pressed with the
Spear's real slot raises no refusal at all (pit 1 hit, door and s2 hitless, shipped RNG). What the Spear lacked was a
reach-aware policy; what the resolver lacked was a reason to admit it.

**The Wand has no arm, by name, and it is two hand-overs deep:** (i) the model's wand shot never meets a tentacle
(`levelRun.wandShotBlockerAt` has no tentacle arm — fidelity's file), and (ii) by source a plain wand shot does
`damage` **0.5** (`WandShot.as:29`) against a tentacle's `hitsMax` 1, and a tentacle sits only once (37 updates) before it
swipes and sinks (`Tentacle.animEnd`), so a Wand kill is **two landed shots 30–37 updates apart on the same sitting
tentacle** (`hitsTimerMax` 30). The rules report's "a `WandShot` kills a sitting tentacle like any `Enemy.hit`
(`hitsMax` 1)" is wrong on the count. ON, a Wand-only bag refuses with both facts' first half named.

## 3. The reproduction (measured at the base, node model, shipped RNG)

Harness: `ev/tools/tb-arms.mjs` (the rules tool plus one fix: the arm's own slot; `TB_RULES_EQUIP=1` restores slot 0).
Each row: the committed L57 staging, `clear-tag {57,0}` + the mouth, `tentacleBeastFight` + `tentacleHitlessFirst`.

| staging | Sword | Spear | Wand |
|---|---|---|---|
| base, as shipped (`ev/logs/base.json`) | pit 1389 t / door 977 t / s2 1850 t, 0 hits, L58 | refused: *"a tentacle dies to one sword hit while it sits; this run holds no sword"* | the same refusal |
| base + a TEMPORARY resolver edit (reverted), rules' slot 0 (`base-unguarded.json`) | — | pit: *"levelRun: a fire press at tick 161 lands inside the window the press at tick 153 opened … The cadence is 11."*; door: the same at 85/77; s2: 4025 t, 0 hits (its bag has no Fire, so slot 0 IS the Spear) | pit/door: the same FIRE refusal (slot 0 = Fire); s2: all 5 variants "mouth not open after 6000 ticks" |
| the same edit, the arm's OWN slot (`base-unguarded-rightslot.json`) | — | pit 5749 t, **1 hit** (rule `fewest-hits`, 0/5 hitless); door 1746 t, 0 hits (1/5); s2 4025 t, 0 hits (1/5); presses ledger: `spear` only | pit: 3 variants die (spent 3140/4491/3062), 2 never open the mouth; door: 4 die, 1 never opens; s2: all 5 never open (the shots fly through) |

So the rules' tool-gap rows reproduce exactly — and they are the Fire's. The Spear reaches the model's tentacle arm
(`levelRun.tentacleSlashNow`, `gameSpear`, `spearDamage` 2) and kills; the Sword-tuned policy is merely bad at it.

## 4. Design and change; OFF identity

- **`tbWeaponArms.js` (new)** — the switch, `withTbWeaponArms`, counters, and the WEAPON ROW: `tentacleWeaponRow(geometry)`
  over `spearArm.spearStrikeGeometry()` (SPEAR-ARM's row, read from the press model: `spearHitRect`, `pressRectTouches`,
  the reach gate `Infinity` under `spearGameTest`, `period` = `SPEAR_ANIM_TICKS`). `extent` is MEASURED off the rect
  (`rect(0, 0, up)`'s height = `SPEAR_LENGTH` 32), never typed. `tentacleWeaponArm(inventory, slots)`: OFF null; a sword
  null (today's policy); a Spear `{weapon, slot, row}`; a Wand-only bag `{refusal}` naming the model gap; neither
  `{refusal: "… holds neither"}`. No level, coordinate or body is named.
- **`tentacleBeastPolicy.js`** — `createTentacleBeastPolicy(params, weapon = null)`: no row = the sword's memory, field for
  field (a row test pins the keys). With a row: `canPress` uses `row.period` (not the sword's literal 7), the strike test
  is `row.lands`, and the strike spots are the sword's two pushed out by `extent − REACH` plus a thrust from above, each
  kept only if `row.lands` holds from it. No env read in the policy.
- **`solverBot.js`** (one import, the resolver, the executor; no reformatting) — the resolver asks `tentacleWeaponArm` for a
  bladeless run and carries `{weapon, slot, row}`; its OFF refusal text is unchanged word for word. The executor, for a
  row: refuses without forks or `tentacleHitlessFirst`; equips the arm's slot before the first fork (`ctx.equip`, so the
  forks replay it) and restores the prior slot after; passes the row to every play; and **refuses a plan whose best
  variant takes a hit** (the `fewest-hits` rule stays the sword's alone). Main-thread: none — the switch is read in the
  solve worker's closure (`solverEnvChannel.SOLVER_ENV_NAMES` += `SEEDLING_TB_WEAPON_ARMS`); no mapper reads it.
- **OFF identity:** acceptance md5 `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` =
  `391322d681b7aa0229d94b3f6906d024` at the base AND at the head. The nine base rows (3 stagings × 3 arms) re-run OFF at
  the head: per-tick keys and refusal texts byte-identical (`ev/logs/base.json` vs the OFF re-run). ON, the Sword rows
  are byte-identical to OFF too (pit `e949236c6b`, door `ee8fe7ff2d`, s2 `1972996a3b`, md5 of the keys).

## 5. Rows and bounded vitest

`frontend/modules/seedlingDemo/tbWeaponArms.test.js` (new, 12 rows): the switch ships OFF; the Spear row's extent =
`SPEAR_LENGTH`, period = `SPEAR_ANIM_TICKS`, lands from below up to the rect's length and not past it; the arm table
(OFF null for every bag; a sword null; the Spear on its own slot, not slot 0 where the Fire sits; the Wand refusal names
`wandShotBlockerAt`); the policy's no-row memory keys; a Spear row strikes from 24 px below (where the sword does not)
and not again inside its cadence; and the solver on the committed stagings (shipped-RNG model): OFF the sword-only
refusal word for word, ON door 2073 t and pit 1936 t with 0 hits/0 deaths/`57:0`/L58/`presses` = `spear`, the Wand
refusal, a sword run unchanged (977 t).

Bounded runs: `npx vitest run frontend/modules/seedlingDemo/tbWeaponArms.test.js
frontend/modules/seedlingDemo/solverEnvChannel.test.js frontend/modules/seedlingDemo/fidelityTentacleBeast.test.js` —
**3 files, 60 passed** (12 + 11 + 37). No unfiltered vitest, no pytest.

The p4h witness tapes are NOT bounded-tier rows yet: replaying them needs the deterministic TB model, which is P2's port
(the scratch copy here is untracked). They are committed as evidence (`ev/tapes/A/`) for the planner to turn into rows
on P2.

## 6. Game witness

Build `seedling_bot_ap_p4h` from `seedling-wasm` branch `p4h-main` @`a335206` (checked out LOCALLY in
`frontend/modules/flashPanel/wasm`; the gitlink was never staged), and `seedling_bot_ap_p4g` (the default) for the
shipped-RNG replay. One fresh headless logic-only page per tape (`ev/tools/judge.mjs`, the rules/owl-executor judge, its
model replay re-pointed at the tape's own staging with the TB fight on, plus a game-stream md5). Tapes are the solver's
plans folded with their equips (`ev/tools/tb-arms.mjs --tapes=`).

| tape (`ev/tapes/…`) | build | finished | end | hits | `57:0` | game vs model | game-stream md5 | wall |
|---|---|---|---|---|---|---|---|---|
| `A/tb-hitless-pit-spear-s418414780` | p4h | yes | L58 (64,104) | 0 | yes | 2613/2613, no divergence | `250928a75c` | 91 s |
| `A/tb-hitless-pit-spear-s7` | p4h | yes | L58 (64,104) | 0 | yes | 2613/2613, none | `250928a75c` | 92 s |
| `A/tb-hitless-door-spear-s418414780` | p4h | yes | L58 (64,104) | 0 | yes | 2660/2660, none | `56693ae4ab` | 92 s |
| `A/tb-hitless-door-spear-s7` | p4h | yes | L58 (64,104) | 0 | yes | 2660/2660, none | `56693ae4ab` | 93 s |
| `A/tb-hitless-s2-spear-s2` | p4h | yes | L58 (64,104) | 0 | yes | 2613/2613, none | `250928a75c` | 91 s |
| `A/tb-hitless-s2-spear-s7` | p4h | yes | L58 (64,104) | 0 | yes | 2613/2613, none | `250928a75c` | 91 s |
| `A/tb-hitless-door-sword-s418414780` / `-s7` (control, round 1) | p4h | yes ×2 | L58 (64,104) | 0 | yes | (round-1 judge: no faithful model column) | — | 42 / 41 s |
| `shipped/tb-hitless-pit-spear-s418414780` | p4g | yes | L58 (64,104) | 0 | yes | 1937/1937, none | `0210955f9d` | 68 s |
| `shipped/tb-hitless-door-spear-s418414780` | p4g | yes | L58 (64,104) | 0 | yes | 2074/2074, none | `b044001750` | 73 s |
| `shipped/tb-hitless-door-spear-s7` | p4g | yes | L58 (64,104) | 0 | yes | 1347/1347, none | `4709622afb` | 48 s |
| `shipped/tb-hitless-s2-spear-s2` | p4g | yes | L58 (64,104) | 0 | yes | 5290/5290, none | `b9268755e5` | 181 s |
| `A/tb-hitless-pit-spear-s418414780` (p4h plan) | p4g | ran out | **L57** | 0 read | **no** | the tracked model dies (3 tentacle hits) | — | 91 s |
| `A/tb-hitless-door-spear-s418414780` (p4h plan) | p4g | ran out | **L57** | **2** | **no** | diverges t264 | — | 94 s |
| `A/tb-hitless-s2-spear-s2` (p4h plan) | p4g | ran out | **L57** | 0 read | **no** | diverges t405 | — | 91 s |

The p4h plans do not survive the shipped draws (expected: the tentacles are placed elsewhere), and the shipped-RNG plans
do on p4g, so each build needs its own plan; under p4h one plan serves every entry. "0 read" on the p4g failures is
the judge's `botStatus.hits` at the tape's end; the model replay of the same tape dies (pit) with no position
divergence, so a death's reset of that counter is the likely reading — unverified, and it does not change the verdict
(no `57:0`, still in L57).
**Each p4h Spear tape was played twice** (round 1, `logs/judge-p4h-A-round1.json`, and round 2): 12/12 plays SOLVED,
0 hits, `57:0`, L58. Each judge row: one fresh page; `logs/judge-p4h-A.json`, `logs/judge-p4g-shipped.json`, `logs/judge-p4g-A.json`.

## 7. Census

- **Seed-1 divergence-sweep legs that reach the TB verb** (`seedling-divergence-legs.mjs` at the head, 915 legs): the
  four L57 legs `level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48`, `level_57 <- in_pit_L56_6_10 ->
  location:Level 057 - Tentacled Beast`, `level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48` and
  `level_57 <- in_L58_48_112 -> location:Level 057 - Tentacled Beast` (ids 473–476 today). All four are at sphere 6.12,
  whose route inventory holds **Progressive Sword** and neither the Ghost Spear nor the Wand. ON, `tentacleWeaponArm`
  returns null for a sword bag before anything else is read, so these legs take today's path: measured on their own
  arrivals (the pit and door stagings are those legs' (96,160) and (96,64)), the Sword's per-tick keys are byte-identical
  ON vs OFF. **No seed-1 leg moves.** The L58 legs from the mouth (`level_58__r4c1 <- in_tentacle_beast_mouth_L57_56_96
  -> …` and the three `~>` link legs) start after the fight and never ask the verb.
- ⚠ The BARE pass (`seedling-divergence-bare.mjs`, no inventory) would see a reworded refusal ON on those four legs
  (*"… holds neither"* instead of *"… holds no sword"*); OFF it is unchanged. Not run (it needs a browser sweep's dump).
- **Survey steps:** the committed campaign projection (`fixtures/campaign-frontier.json`) ends at step 30 (L32, sphere
  4.2); no committed survey step reaches L57. The route reaches L57 at sphere 6.12 with the Sword, so a survey step there
  would take the sword path. The survey cache is not committed and was not regenerated (no full walk).
- The surface census (`census-seedling-solver-surface.mjs --write`) gains `tbWeaponArms.js` and +3 `solverBot.js` read
  sites (`inventorySlots` +1, `primary` +2); `--check` green. `generate-procgen-reference.mjs` and
  `generate-docs-index.mjs`: no change, `--check` green. No docs under `docs/json/developer/procgen/` were edited.

## 8. What the brief got wrong (measured)

1. **"Its press cadence (8) falls inside the Spear's fire window (11), which `levelRun` refuses by name."** The refused
   window is the FIRE's (`FIRE_PRESS_CADENCE` = 11): the rules harness pressed slot 0, which is the Fire in the pit/door
   bags. The Spear's cadence is `SPEAR_ANIM_TICKS` = 5 and a Spear press raises no such refusal (§3). The scratch
   `DET_TB_PRESSGAP` → 11 hunk fixed nothing for the Spear, which is why "with the cadence at 11 the pit and door still
   find NO death-free Spear variant": those runs still pressed the Fire, which a tentacle ignores (`hitByFire` false).
2. **"The Wand arm of the L57 rule is unwitnessed" because "there is no Wand arm".** True, but the arm cannot be built in
   the solver alone: the model's shot passes through tentacles, and a plain-wand kill takes two shots (damage 0.5) inside
   one 37-update sit. The rules report's "one `Enemy.hit` kills (`hitsMax` 1)" is wrong for the Wand.
3. "s2 solves (4025 t shipped RNG)" was a real Spear row (the s2 bag holds no Fire, so slot 0 is the Spear) — the one
   rules Spear row that measured what it named.

## 9. Residue and hand-overs

- **Fidelity (hand-over, `levelRun.js`):** the wand shot's `"Enemy"` arm on a tentacle — `wandShotBlockerAt` should
  return `{kind: 'enemy', tentacle: true}` for a live tentacle's box (`tentacleRect`; sitting or not: `checkEntity` dies on
  any Enemy, and only `Enemy.hit` decides), and `applyWandShotToBoss` should route it to `hitTentacle(t, {d: 0.5, t:
  'Wand'})` (which already takes a fractional `d`). Rows: `ev/logs/base-unguarded-rightslot.json` (the Wand never opens
  the mouth: shots fly through). Witness needed on p4g/p4h before a policy rides on it.
- **Solver, after that:** a Wand row is a TWO-SHOT verb (first shot within the first 7 updates of a sit, second ≥ 30
  updates later; each shot fires at `wandEnd`, `WAND_PRESS_CADENCE` 8 after the press, and dies on the first Enemy in its
  path, so another tentacle in the lane absorbs it). Not built: no fork could check it today.
- **P2 (planner):** the six p4h Spear tapes (`ev/tapes/A/`) and the Sword controls become bounded rows once the
  deterministic TB model is on main; the scratch model used here is `ev/tools/sync-det.sh` (the rules' model hunks only).
- **Shipped-RNG robustness:** under the shipped RNG the Spear policy finds no death-free variant on seed 7 at the pit and
  s2 stagings (drownings and swipe deaths: `ev/logs/shipped-on.json`). Under p4h the draws are fixed, so this matters only
  while p4g is the default; it rides P2 by design.
- Thin margin: under A only 1 of 5 variants is hitless for the Spear on each arrival (Sword: 3–4 of 5).
- Untracked, removed at the end: `frontend/modules/seedlingDemoDet/` (the scratch model), the local wasm checkout
  (`git -C frontend/modules/flashPanel/wasm checkout 9968c7dd`), the dev server I started (killed by PID).
