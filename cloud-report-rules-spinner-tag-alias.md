# Cloud report — `rules-spinner-tag-alias`: does a tag −1 persistence write alias another level's flag?

Base: `origin/main` = `39e8a29f7fe8f9ebca9a17c3fa2d98d4123f09a4`. Branch `claude/rules-spinner-tag-alias-1c0rmr`.
Evidence: `CC/docs/cloud-reports/rules-spinner-tag-alias-evidence/` (tools + outputs). REPORT only: no rule, preset,
model, or runtime change.

## Answer table

| # | Question | Verdict | Decided by |
|---|---|---|---|
| Q1 | Does a tag −1 write on level N land in another level's slot? | **GAME YES: `{N−1, 29}`** | `Main.as:222` `levelPersistence[i*30+j]`, no bounds check; `Game.as:1902-1904` |
| Q1w | L18 Spinner deaths, on the wasm game | **GAME YES**: table gains `{17,29}`; live report is `18\|-1` | `w1-l18-spinner-press.json` (see §3) |
| Q2 | Which map entities can make such a write? | **5 placements, 2 classes**: L18 `spinner`×2 → `{17,29}`; L92 `spinner`×1 + `breakablerock`×2 → `{91,29}` | `census.md`; `Spinner.as:47-64`, `BreakableRock.as:68-72` |
| Q2b | Does any alias slot hold a REAL rules event? | **NO** (0 of 40 events; the highest event tag is 12, the highest map tag is 24; `{17,29}`, `{91,29}` are owned by nothing) | `census.md` |
| Q2c | Runtime-spawned −1 writers (old Fire / DarkSword)? | **NO on this build**: `BobBoss.as:194`, `FallRockLarge.as:125` pass `Fire.BOSS_DROP_TAG`; `Witch.as:53` passes `DarkSword.WITCH_TAG` | source |
| Q3 | Does the JS model write the same slot? | **YES, it agrees on the table**: `spinnerWrites` = `{17,29}` ×2 (t 2198, 3278), `liveClears` = `[{17,29}]` | `js-l18-spinner-press.json` |
| Q3b | Do the two runtimes REPORT it the same way live? | **NO, a harmless divergence**: wasm `pendingCheck` = `1\|18\|-1\|0`, `2\|18\|-1\|0`; the JS page's `reportClears` posts `\|17\|29\|0` (once) | `Game.as:1906-1907` vs `jsRuntimeCore.js:255-270, 1051-1060` |
| Q4 | Logic risk today (an event set/unset by an unrelated action)? | **NO**: harmless on every census row | §4 |
| Q4b | Latent risk? | **YES, two latent paths** (none live): an event or allocated tag at slot 29 of L17/L91 | §5 |

## 1. The mechanism (source)

- `Game.setPersistence(tag, o, _l=-1)` → `Main.levelPersistenceSet(_l >= 0 ? _l : Main.level, tag, o)`
  (`vendor/seedling/src/Game.as:1902-1904`), and `levelPersistenceSet(i, j, t)` is
  `SAVE_FILE.data.levelPersistence[i*Game.tagsPerLevel + j] = t` (`Main.as:222`, `tagsPerLevel = 30`, `Game.as:525`).
  With `j = −1` the index is `30N − 1 = (N−1)*30 + 29`: **the previous level's LAST slot.** No clamp, no error.
- The same call's check report is `pendingCheck = seq|<_l or Main.level>|<tag>|<o>` (`Game.as:1906-1907`): it
  names the CALL's address `{N, −1}`, not the slot actually written.
- Every class whose `check()` guards `tag >= 0` and whose write site does not is a writer of the alias. On this
  build, among map placements that actually carry a −1:
  - `Spinner.removed()` writes `setPersistence(tag,false)` under `doActions`, and `check()`'s `tag >= 0` guard
    never clears `doActions` for a −1 (`Enemies/Spinner.as:47-64`). **Writes.**
  - `BreakableRock.endAnim()` writes unconditionally (`Puzzlements/BreakableRock.as:68-72`). **Writes.**
  - `Karlore` (L48) is an `NPC`; `NPC.as:122` READS under `tag >= 0` and neither class writes. **No write.**
  - `Teleporter` (227 placements resolving −1, `Game.as:2387`): `removeSelf()` writes (`Teleporter.as:79-82`) but
    nothing in the source calls `Teleporter.removeSelf`; its read is guarded (`:86`). **No write.**
  - `bosskey`/`totempart`/`seed` (absent `@tag` → `optionalTag` −1, `Game.as:1894-1900`): writes guarded by
    `if (tag >= 0)` (`BossKey.as:68`, `BossTotemPart.as:51`, `Seed.as:109`). **No write.**
- Runtime spawns: the old vanilla −1 Fire / DarkSword pair is gone on this build (Q2c row). Seeds spawned by the
  Watcher (`Watcher.as:73,102`) default to −1 and are guarded. Teleporters spawned by bosses/Moonrock never write.
- Overflow the other way (tag ≥ 30 → next level's slots): no map entity carries one (max 24); computed tags
  (`FinalBoss.as:222` `tag+1` with tag 0; `ButtonRoom` `tset ≤ 8`; `Yeti.as:48` literal 1; `Moonrock.as:135`
  literal 0 in `moonrock_target`) are all in band.

## 2. Census (`tools/census.py` → `census.md`)

| level | entity | alias slot | writes? | slot owned in target level | rules event on slot |
|---|---|---|---|---|---|
| L18 | `spinner@48,96` | {17,29} | YES | none (L17 uses tag 0 only) | none |
| L18 | `spinner@112,48` | {17,29} | YES | none | none |
| L92 | `spinner@224,64` | {91,29} | YES | none (L91 uses no tag) | none |
| L92 | `breakablerock@176,48` | {91,29} | YES | none | none |
| L92 | `breakablerock@256,112` | {91,29} | YES | none | none |
| L48 | `karlore@112,272` | {47,29} | no | none | none |
| 100 levels | `teleporter` ×227 | {N−1,29} | no | 0 | 0 |
| — | `bosskey`×5, `totempart`×5, `seed`×1 | {N−1,29} | no | 0 | 0 |

Rules events: 40 `L<n> flag <t>: …` names in `AP_1_rules.json`, highest tag 12. Highest non-negative map tag: 24.
**No census row's alias slot is owned by an entity or named by an event.** So the "one more aliasing case that lands on
a REAL rules event" (brief §3) does not exist; L92 was not driven (UNWITNESSED, and nothing would read the result).

## 3. Witness on the wasm game — **GAME YES**

`node CC/docs/cloud-reports/rules-spinner-tag-alias-evidence/tools/alias-witness.mjs` (tape
`frontend/modules/seedlingDemo/fixtures/tapes/r8-l18-spinner-press.json`, build `seedling_bot_ap_p4g`, `game.html`,
bridge configured to monitor `Game.pendingCheck` from `games/seedling.json`). Output `w1-l18-spinner-press.json`:

| read | value |
|---|---|
| `persistence_cleared` after `botStart` (before any input) | `[]` |
| `pendingCheck` reports (bridge `stateLog`, rAF sample tick) | `1\|18\|-1\|0` @ tick 2197 · `2\|18\|-1\|0` @ tick 3277 · `3\|18\|0\|0` @ tick 3278 |
| `persistence_cleared` at `finished` | `[{17,29}, {18,0}]` |

So the two Spinner deaths both write `{17,29}` (one slot, written twice), and the game REPORTS each as `{18,−1}`.
`{18,0}` is L18's own `lock@144,112` (tset −1, a kill lock) opening after the second death — the rules event
`L18 flag 0: lock@144,112 cleared`, set legitimately by the action its rule prices; it is not the alias.

JS model on the same tape (`tools/js-model-writes.mjs` → `js-l18-spinner-press.json`): `spinnerWrites` =
`spinner@48,96` t 2198 and `spinner@112,48` t 3278, each `flag {17,29}, outOfBand: true`; `liveClears` = `[{17,29}]`.
The model's TABLE matches the game's; the model already registers Spinner in `outOfBandLedger.OUT_OF_BAND_WRITERS`
(witness `r8-l18-spinner-press`). (Ticks are one apart because the probe's sample lands on the next frame.)

## 4. Per-case verdict

| case | game | JS model / JS page | event collector (`seedlingEventCollector.js`) | verdict |
|---|---|---|---|---|
| L18 spinner ×2 → {17,29} | writes {17,29}; reports `18\|-1` | table {17,29}; page reports `17\|29` | live: `_eventAt(18,−1)` / `_eventAt(17,29)` → none; load/reconcile read {17,29} → none | **harmless** + a **model divergence** in the live report string only |
| L92 spinner + 2 rocks → {91,29} | (source) same shape | `outOfBandFlagFor` → {91,29} (BreakableRock is a registered member) | none | **harmless** (UNWITNESSED on the game; nothing reads it) |
| L48 karlore, teleporters, bosskey/totempart/seed | no write | no write | — | **harmless** |

No rules event is set or unset by an unrelated action; the bot's model reads no slot 29 (no event, no entity there).

## 5. Latent risks and the GENERAL fixes (sketch only; no change made)

1. **An event or an allocated tag at an alias target.** If slot 29 of level N ever becomes a REAL address (a rules
   event minted at `{N,29}`, or `placementTagId` in `procgenSeedling.js:846-860` handing out 29 — it is
   lowest-free under 30 and does not know about aliases) while level N+1 holds a −1 writer, a kill/break in N+1 would
   CLEAR that address: an event collected by an unrelated action, or an apitem at `{N,29}` despawned by `check()`
   before it is taken (an unreachable location). Today both are far away (L17 uses tag 0, L91 none).
   *Fix (derived, no literals):* compute the alias set once from the map + `OUT_OF_BAND_WRITERS`:
   `aliasTargets = {outOfBandFlagForWriter({as3, level, tag}) for every placement whose class is a writer and whose
   resolved tag < 0}`; (a) the tag allocator takes it as `reserved` for that level; (b) the rules producer
   (`seedlingObstacleEvents.js`) refuses, or names in its census, any event whose `{level, tag}` is in it. Owner:
   **rules producer** (b) and the **allocator** in `procgenSeedling` (a). A unit pin on the derived set
   (today exactly `{17:29, 91:29}`) keeps it honest.
2. **Live report address differs by runtime.** The game reports a −1 write at the CALL's address (`N|-1`, as it
   reports `ButtonRoom`'s cross-room write at the call's `room`); the JS page reports the SLOT (`N-1|29`). With an event
   on the slot, wasm would collect it only via the reconcile re-read (`onReconcile`, which reads the table) and the JS
   page live. Harmless now. *Fix:* `jsRuntimeCore.reportClears` posts the call's address for an `outOfBand` write
   (it has `from`/`level` on the ledger row) so the two strings match; the table stays the slot. Owner: **JS runtime**.
3. **Absent `@tag` on a map writer (source-only, UNWITNESSED).** `Game.as` passes `o.@tag` to every writer
   constructor; an absent attribute coerces `""` → **0**, not −1 (the reason `Teleporter`'s loader special-cases
   `""` and `optionalTag` exists), whereas the JS `tagOf` reads a missing attribute as −1. Every writer placement in
   the vanilla atlas carries an explicit tag, so nothing diverges today; a generated/edited room that omits one would
   (model: alias `{N−1,29}`; game: slot `{N,0}`). Owner: **fidelity** (`tagOf`), checked against `Game.as:2281-2387`.

## Provenance

- The brief's "L26 clear witness (work head 37b3ad596f)": 37b3ad596f is a docs regen; its parent 3faff3a1 is the
  encounter-latch probe, whose comment (`scripts/procgen/probe-seedling-encounter-latch.mjs:390`) records the
  Spinner `{level-1, 29}` alias; the older records are `docs/json/developer/procgen/seedling-bot-log.md` (Fire →
  {31,29}; "A −1 write is a LEDGER ENTRY, never a PERMISSION") and `frontend/modules/seedlingDemo/outOfBandLedger.js`.
- Setup: `session_bootstrap.sh --seedling` READY; minimal-spoilers; no submodule pointer moved; the dev server on 8000
  was started by this session. No vitest run (no test file touched).
