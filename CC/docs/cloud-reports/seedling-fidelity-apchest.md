# seedling-fidelity-apchest: the p4h `Pickups/APChest` in the JS model (planning-24, wave 58)

**Verdict: PASS, with one named STOP case (below).** On a build declaring `apchest`, the model now builds an
`<apitem kind="chest">` as a Solid AP chest. The chest opens only from the line under it, gives no SealPiece, and its
open is the AP take. **I recorded the game witness myself on the p4h page** (headless logic-only). It reports ALL
CHECKS PASSED, with 0 px on every plan. The slot clear lands on the model's open tick at L25 and L11, bracketed by
TAKE/BEFORE. p4g stays byte-identical.

| | |
|---|---|
| Start (base) | `1f10d57c658c9fe940f227cb849a45f781490258` (`fidelity-base/apchest-port`) |
| Code head (last code commit) | `ed288444c52945ddfbf4fd462d92888dee4b242c` (the model commit `5453e9b553`, the probe + evidence `32ddef3f`, then the CI fix `ed288444`) |
| Harness branch | `claude/apchest-model-port-r8suva` (local branch `seedling-fidelity-apchest`) |
| Keys / ON / `SOLVER_ENV_NAMES` | base **145 / 126 / 236**, head **145 / 126 / 236** (no new key; env list read from `solverEnvChannel.js`) |

## D1: the map

### APChest against Chest (Seedling `p4h-as3` @169247c4c4; every cite VERIFIED from `git show`, none unverified)

| Frame / effect | `Pickups/APChest.as` | `Chest.as` | Same? |
|---|---|---|---|
| Built from | `<apitem kind="chest">`, `Game.as:2333-2337` (`String(o.@kind) == "chest"`) | `<chest>`, `Game.as:2384` | different element |
| Ctor: half-tile, `type="Solid"`, `setHitbox(16,16,8,8)`, layer | `:55-59` | `:30-34` | same |
| Field-initialiser RNG | **none** (no `coins` field) | `:22` `Math.floor(Rng.cos()*4+8)`, one draw per construction | **differs** |
| `checkBySeal()` (ctor and update) | **none** | `:38`, `:50-60`, `:64` | **differs** |
| `check()`: `tag>=0 && !checkPersistence(tag)` → remove | `:63-70` | `:41-48` | same |
| Gate + line: `!collide("Solid",x,y) && collideLine("Player", x-oX+2, y-oY+h+1, x-oX+w-4, …)` | `:74-78` | `:65-69` | same (right inset `2*m`) |
| `open()` latch `frame==0` → `frame=1`, `openTimer=60`, `type=""` | `:84-89` | `:75-80` | same |
| Sound | `Music.playSound("Chest", 0)`, `:86`: index given, so `Music.as:734-735` takes the no-draw arm | `playSound("Chest")`, `:77`: `Music.as:728-732` draws one `Rng.cos()` | **differs** (0 vs 1 draw) |
| SealPiece + seal-index `Math.random()` loop | **none** | `:81`, `:87-91` | **differs** |
| `setPersistence(tag,false)` on the open frame | `:92`, commented as the check report `Game.pendingCheck` | `:92` | same write |
| Fade: `openTimer--`, `alpha=min(t/20,1)`, remove at 0 | `:96-107` | `:96-107` | same |
| Cover resets on it | `Cover.as:58` `c is Chest \|\| c is APChest` | same line | same |
| **Update order vs Cover** | added at `Game.as:2335`, **before** `cover` (`:2367`) | added at `:2384`, **after** `cover` | **differs** (see STOP) |

**What the AP side sees.** `Game.setPersistence` writes `Game.pendingCheck = "<seq>|<level>|<tag>|0"`
(`Game.as:604-628`: "the check report … written by `setPersistence`"). A clear (`false`) is the AP location check.
APChest makes that write on the open frame (`:90-92`), so the check is the same one `APItem.removed()` reports
(`APItem.as:127-133`). The bot's `persistence_cleared` readout is how the probe sees it.

**RNG, measured from source.** APChest draws **0** at construction and **0** on open. Chest draws 1 at construction,
then 1 `Rng.cos()` in `playSound` on open, then the seal loop (`16/(16-k)` expected `Math.random()` calls). The model
counts these and never steps them (`chest.js` `AP_CHEST.drawsAtConstruction` and `drawsOnOpen`, both `false`).

### The model's path today (base)

- **p4g and p4h alike, before this slice:** `levelWorld`'s `e.type === 'apitem'` arm puts the element in
  `world.apItems` (an 8×8 `apItem` box, no solid, `apitem: 'despawn'`). Solver: `resolveCollectStrategy` → `apitem`.
  The take: `solverBot.apItemTakenOnTick` → `run.takeApItem` → `apItemFlags` + `pendingEarnedClears`. Re-entry:
  `check()` through `'despawn'`. `capabilities` reached `levelRun` (`declaresBossDraws`) but not `buildLevelWorld`.
- So on p4h the model played a delivered chest as p4g's overlap pickup.

### The change (smallest)

- `levelWorld.apChestAsChest(e, apChests)` reads `kind === 'chest'` as the **`chest` row**
  (`{type:'chest', x, y, attrs:{tag}, apChest:{id}}`). `levelWorld.apChestRecord(record, capabilities)` applies that
  conversion when `declaresApChest(resolveModelCapabilities(capabilities))` holds. It returns the **same object** when
  nothing converts, which is every p4g record. The element then gets the chest's solid (`chestId`), its `chests` row
  (plus `apChest: true, apItemId: 'apitem@x,y'`), its `'despawn'` persistence and its proximity volume.
  `buildLevelWorld`'s signature is unchanged, so the build stays a function of its record. That is the JS arc's
  `jsRuntimeLiveDelivery` census; the first cut added a `capabilities` option, and CI caught it.
- `levelRun`: `worldFor` builds `apChestRecord(recordFor(n), capabilities)`. `chestStateFor` marks an APChest's state.
  `stepChestsNow`, on an AP chest's `chestopen`: banks the AP take (`apItemFlags` by `apItemId`, `t` = the open
  tick, `pendingEarnedClears`). It does NOT push `chestOpens` (whose length is `sealSlotsEarned`) and spawns NO
  SealPiece. `openChestIdsNow`'s CHESTSEAL arm skips an AP chest.
- `chest.js`: `AP_CHEST` (constants + cites). `stepChests` skips `checkBySeal` for an AP chest. Everything else is
  the vanilla rule, reused rather than forked.
- No contactFidelity key, no flip, no default change, no change to any existing key's branch.

**Executor / solver (HAMMER's files, read only).** On p4h a `collect-placement` at a delivered chest now resolves
to strategy **`chest`** (`world.chests`), not `apitem`. Measured:
- **L25 from the survey's north-east approach:** `STANCE_REENTRY` (the vanilla refusal). That is correct: the rules
  price that route `Has(L25 event)`, reached from below via L28.
- **From below (L25, L11), the open itself is right, but the verb then refuses:** `chest@96,96 opened at tick 1 but
  its SealPiece was never collected in 400 ticks`. This is the hand-over below.

### STOP (named, not modelled): the Cover/APChest same-frame order

`World.addUpdate` prepends, so the update order is reverse add order. A vanilla `Chest` (`:2384`) updates
**before** its `Cover` (`:2367`) and sees the cover Solid on the cover's opening frame. `levelRun` documents and
models that ("the chest opens on the tick AFTER the cover does"). An `APChest` (`:2335`) is added **before**
`cover`, so it updates **after** the Cover and sees the cover's opening frame at once. On the game it should open
**one tick earlier** than the vanilla order, when the player is already in the band as the cover completes.

The obstacle: the model steps covers in `stepActivators` at the END of the tick, after the player. The chest step
reads the previous tick's activator state. The cover state "after this frame's Cover update, before the Player"
is a state the model does not hold at the chest step. The model therefore keeps the vanilla order for this one case.
Row: `L38 (model-only button) … (named STOP)` pins the model's tick 12 (cover open at 11). The only delivered chest
under a cover is L38's. The rules rule that cover OPEN, and the only way to hit the case is to stand in the band
while the fade completes. No witness was recorded: the case needs a room that is not on the delivered set
(`l38-cover-button` is `modelOnly`).

## D2: the rows (`fidelityApChest.test.js`, fast tier, 28 rows)

- **Gate:** p4h declares `apchest`; p4g and the manifest default do not. Only `kind="chest"` on an `apchest` build
  converts, and every other input comes back as the same object. The delivered set writes `kind: chest` on L11/L25/L38.
  `AP_CHEST` constants are checked.
- **p4g:** on L11/L25/L38 the element is an apitem, with no chest and no chest solid. `apChestRecord` returns the
  same record object with `P4G_CAPABILITIES` or with no build named. Every plan replays the same rows named or not, and the side walk passes through
  the cell.
- **p4h:**
  - On L11/L25/L38: a chest row, the vanilla rect and the vanilla stance band.
  - Solid before open: the side walk stops at the east face and the walk from above stops at the top face.
  - The L25 survey tape (p4g takes on tick 48) takes nothing.
  - The open frame from the line below at **L25 and L11**: tick 6, the AP take on tick 6, and the passage on the same
    frame (the player box enters the cell that tick). No SealPiece, no `sealCollections`, no `chestOpens`.
  - Vanilla L11 under the same keys also opens on tick 6 and spawns its SealPiece.
  - **L38: no open while its Cover is shut.**
  - A save holding all 16 seals keeps the AP chest Solid and removes the vanilla one.
- **Fade / persistence:**
  - The fade's 60th update counted from the open frame removes the chest. `hasAllSealParts` never removes it.
  - The take is banked (`bankedClears` ∋ {25,0}), and a re-entry with tag 0 cleared builds no chest, no solid and no
    apitem (`check()`).
  - `setModelBuildDefault(P4H)` reaches a run that names no build.
- Staged chests: **L25** (the chest L25APITEM's survey refused on vanilla) and **L11**, plus L38 for the cover.

**Mutants** (copy → break → run → restore; each predicted RED and observed RED):

| Mutant | Rows that went red |
|---|---|
| M1 capability ignored (`apChestRecord` always converts; re-run at `ed288444`) | 5: the three p4g record rows, the p4g plan replay, the `setModelBuildDefault` restore |
| M2 `kind` ignored (re-run at `ed288444`) | 1: the gate row (a plain apitem converted) |
| M3 `checkBySeal` kept for an AP chest | 1: the fade row (`hasAllSealParts` removed it) |
| M4 the open goes the vanilla way (SealPiece, `chestOpens`) | 4: the L25/L11 open rows, the L38 cover-button row, the default row |
| M5 CHESTSEAL opens an AP chest | 1: the all-seals save row |
| M6 take tick off by one | 3: the L25/L11 open rows, the L38 cover-button row |

## D3: measurement

- **p4g byte-inertia:**
  - `git diff --name-only 1f10d57c65 HEAD | grep -aE 'fixtures/|golden|tapes/'` is **EMPTY** (rc 1). The evidence
    tapes live under `…-evidence/walks/`.
  - `batch-seedling-acceptance.mjs | md5sum` is `391322d681b7aa0229d94b3f6906d024` at base and at head.
  - All six `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check` report all checks
    green.
  - `ci-producer-checks.mjs --jobs=3`: 99 run, 0 red, 1 skipped.
- **Bounded vitest (the brief's list + every file `grep -a -l` finds for the named symbols):**
  - Before: 35 files / 1469 tests, green.
  - After (`ed288444`): 39 / 1598, green. That is this file's 28 plus the three files CI showed red at `32ddef3f`
    (below).
  - ⚠ My local list missed `jsRuntimeLiveDelivery.test.js`, `boxLock.test.js` and `procgenDocs/generated.test.js`.
    None of them imports the grepped symbols, so CI found them.
  - **p4h movers: none.** `fidelityP4hPort`, `fidelityP4hWitness` and `p4hBeside` are unchanged and green, and so are
    `fidelityL25ApItem`, `chest`, `sealCeremony`, `levelRun`, `levelWorld`, `solverBot` and `r8Acceptance`.
- **Census `--check`s:**
  - Constants: green after `--write` (line moves only), re-run at `ed288444`. `--profile-rows` checked: no row
    changed.
  - Solver surface: `--write`, 374 rows; only line numbers and `files 86→87` (`apChestRoster.js` joins the closure)
    changed; then GREEN.
- `check-procgen-docs.mjs`, `generate-procgen-reference.mjs --check` and `check-procgen-help.mjs` (the new probe
  answers `--help`): all pass.
- **CI** (`JavaScript Unit Tests`, push runs on the harness branch):
  - **`32ddef3f`: RED**, run 45317304701. Suite 29801 passed / 4 failed; slow battery 438 passed. All four were this
    slice's:
    1. `jsRuntimeLiveDelivery` › the build-time readers census: `buildLevelWorld` had gained a `capabilities` input.
    2. `boxLock.test.js` › "takes conditionally …": the new probe was not in the guarded-takers list.
    3. and 4. `procgenDocs/generated.test.js` (two rows): the instruments index was not regenerated for the new probe
       (my local `--check` ran while the probe was still untracked).
    The same index was the procgen-reference row of the headless and browser gate jobs.
  - Fixed in `ed288444`: the record mapping, the list row added at the END, and the regenerated index.
  - **`ed288444`:** **GREEN**, run 45320168548. Suite 29805 passed / 0 failed; slow battery 438 passed. (The headless and browser gate jobs of that run were not read here.)

### Witness: recorded here, on the p4h page

```
python3 scripts/serve-nocache.py 9798 &
SEEDLING_PAGE=seedling_bot_ap_p4h SEEDLING_PORT=9798 node scripts/procgen/probe-seedling-apchest.mjs \
  --out=CC/docs/cloud-reports/seedling-fidelity-apchest-evidence/p4h-probe.json
```

- Inputs: `fidelityApChest.AP_CHEST_PLANS` (tapes in `…-evidence/walks/`, each on the L25 survey tape's own header).
  The delivered set is `seedling-ap-record-93f13131`.
- Predicted trace (model, p4h):
  - `l25-below`: open **6**, passage **6**, fade end **65**.
  - `l11-below`: open **6**, passage **6**, fade end **65**.
  - `l25-side`, `l25-above` and `l38-covered`: no open.
  - `l38-cover-button` (model only): cover 11, chest 12.
  - Full rows are in `apchest-plans.json`.
- Recorded result: **ALL CHECKS PASSED** (`p4h-probe.log`, `p4h-probe.json`):
  - Every plan: game stream = model stream, **0 px** (21/21/41/21/31 observations).
  - `l25-below` and `l11-below` TAKE (cut 6, hold) clears; BEFORE (cut 5) does not.
  - Side, above and covered: the slot stays set.
  - The L25 survey tape on p4h takes nothing, at 0 px over 109 observations.
  - Fade end and passage tick are not separately observable in the drained stream. The passage shows as the 0-px
    position stream through the chest's cell from tick 6.

## Census

- **Which chests.** All 16 ledger chests (`apChestRows`) become AP chests on p4h, each with a clear stance under the
  line: L11, L12, L15, L17, L25, L36, L38, L40, L46, L48, L63, L71, L80, L86, L90 and L98.
- L40's three non-chest apitems stay overlap pickups.
- L38's is the only chest with a Solid (its Cover) on it.
- **What a p4h survey would answer.** Not run: `survey-seedling-route.mjs` takes no capabilities (the JS arc's sweep
  producer). From the solver rows above, a p4h survey refuses at **step 34 (L22 → L25)**. That refusal is
  STANCE_REENTRY, which is correct: the rules price that entry by the L25 event, reached from L28. Every
  from-below chest then refuses on the SealPiece wait until hammer's hand-over lands. On p4g the survey is unchanged
  (this slice's p4g is byte-inert).

## What the brief got wrong (measured)

- "`Chest.as:22` … `Rng.cos()`": correct, but vanilla open also draws one `Rng.cos()` inside `playSound("Chest")`
  (`Music.as:728-732`). APChest avoids it by naming index 0. It is not only the field initialiser.
- The open/gate cites are right, but the line's right inset is `width - 2*m` (4 px), not "inset 2 each side"
  (APChest's own docblock says "2 px each side"; the arithmetic says 2 left, 4 right). The model already transcribes
  it as 4.
- The brief did not name the Cover update-order difference (`Game.as:2335` vs `:2384`). It is the STOP above.

## Hand-overs

- **HAMMER (`seedling-hammer-phase-planning-14`), `solverBot.js`:**
  1. The `chest` executor on a `world.chests` row with `apChest: true` must finish at the open (`run.openChests` ∋
     id, or the `earnedClears` row `by: apItemId`) and must not wait for a SealPiece. Today it refuses after a
     correct open ("SealPiece was never collected in 400 ticks"; repro: `l25-below`/`l11-below` boot moved 16 px
     south, goal `collect-placement` at the chest, p4h caps).
  2. The `chestsSealRemoved` arm (`solverBot.js` ~36275) must not treat an AP chest as removed.
  3. `resolveCollectStrategy`'s rejection text names `Chest.open()` spawning the thing to collect, which is not true
     of an AP chest.
- **JS arc:** none required. No `jsRuntime*`/`flashPanel` caller passes `capabilities`, so the JS runtime still
  sees p4g (as ruled through P2). A p4h survey needs a `--capabilities` door in the survey (yours).
- **Planner:** dispatch `unittests_frontend.yml -f train_only=true` at `ed288444` (I cannot dispatch, 403).

## Residue

- The STOP case above (same-frame Cover → APChest).
- The stray ref `seedling-fidelity-apchest` on origin: I pushed it by mistake before the harness branch. It is the
  same SHA as the model commit, and the proxy refused its deletion (`send-pack: unexpected disconnect`). Delete it at
  harvest.
- A vanilla chest's clear does not appear in `earnedClears` (only `chestOpens`/`bankedClears`). An AP chest's take
  does, through the `apItemFlags` loop, as `takeApItem`'s does. This is pre-existing, and I left it alone.
