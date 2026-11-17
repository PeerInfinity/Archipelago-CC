# seedling-fidelity-wallflyerbodies — the wallflyers as a census entity family (wave 43)

Session `seedling-fidelity-wallflyerbodies`, planner `seedling-fidelity-planning-20`.
⚖ GO: Robert 2026-11-14, *"wallFlyerBodies slice (Recommended)"*: census only, a new entity family, no behaviour
change, no contactFidelity key, no flip.

| | |
|---|---|
| Start SHA | `80650ed1b66f0b7d0cf4dcd5732aad24b348be48` (= origin/main, train 105; 135 contactFidelity keys, **125 default-ON**, measured) |
| Code head | `abad461a`: `e9a77075` (D1, the whole slice) + `abad461a` (D1b, the generated docs index CI caught) |
| Head | this report's commit (a doc-only commit on top of `abad461a`) |
| Harness branch | `claude/seedling-wallflyer-census-family-wn2qvq` |
| Verdict | **PASS**: the family landed byte-inert, and hammer's arm switched onto it is byte-identical (measured on its branch, scratch only) |

⚠ **A stray branch.** I pushed `e9a77075` once to `origin/seedling-fidelity-wallflyerbodies` (the brief's local
branch name) before pushing to the harness branch. It holds the same commit and nothing else, and nothing consumes it.
Delete it at harvest; I did not delete it myself because that is a remote action.

---

## D1.1 — what hammer's arm reads off `run.wallFlyers`

Branch `origin/claude/seedling-wallflyer-drill-kill-c623c0` @ `18160277`. Its `solverBot.js` reads `run.wallFlyers`
at **three** sites, and all three read `.bodies`. **No site reads `.events`.**

| Site (hammer's `solverBot.js`) | Read | Fields | Which bodies it needs |
|---|---|---|---|
| l.24644 `liveWallFlyer(r, id)` | `r.wallFlyers?.bodies … .find(id)` then `!removed && !destroy && !dieAnim` | `id`, `x`, `y`, `vx`, `vy`, `hits`, `hitsTimer`, `removed`, `destroy`, `dieAnim` | live ones (it filters them itself) |
| l.24753 `playWallFlyerKill` (did the press land?) | `f.wallFlyers?.bodies … .find(id)` after the press tick | `hits`, `dieAnim`, `destroy`, `removed` | **dying ones too**: a kill counts as landed by `after.dieAnim \|\| after.destroy \|\| after.removed` |
| l.24763 `gone()` (the removal wait) | `f.wallFlyers?.bodies … .find(id)`, then `!b \|\| b.removed` | `removed` | **dying ones too**: it waits through "die" and the fade until the body is removed |

The other `wallFlyers` readers on that branch are tests, the skin (`seedlingRoomBodySkin.js`), `watchArt.js` and
probes/planners under `scripts/procgen/`. None is a solver-family file, and none changes.

## The family's definition

`levelRun.js` (cites at `e9a77075`):

- `ENTITY_FAMILY_NAMES` l.483: `'wallFlyerBodies'`, the last row.
- `wallFlyerBodiesNow` l.18207, after `drillBodiesNow`. `ENTITY_FAMILIES` l.18246 (last row). Getter
  `get wallFlyerBodies()` l.19210, after `get drillBodies()`. `get wallFlyers()` is unchanged.

```js
const wallFlyerBodiesNow = () => (noclip ? [] : [...wallFlyerStateFor(level).values()].filter((w) => !w.removed)
    .map((w) => ({ id: w.id, x: w.x, y: w.y, vx: w.vx, vy: w.vy, hits: w.hits, hitsTimer: w.hitsTimer,
        dieAnim: w.dieAnim && { ...w.dieAnim }, destroy: w.destroy, removed: w.removed })));
```

The row is the hand-over's field list exactly: `{id, x, y, vx, vy, hits, hitsTimer, dieAnim, destroy, removed}`.
It is `[]` under noclip, as the `wallFlyers` getter is.

**Membership: the bodies still in the world.** This is not the brief's "live, not dying"; see *What the brief got
wrong* §1. Every definition below comes from `wallFlyer.js`'s own fields:

- **Removed** (the body leaves the family): `removed` is set only when `Mobile.death`'s fade ends,
  `if (w.destroy) { w.alpha -= alphaFade; if (w.alpha <= 0) w.removed = true; }` (`wallFlyer.js:291-293`). This is the
  game's `FP.world.remove`.
- **Dying** (the body stays, and its fields say so): the "die" anim is on (`dieAnim !== null`, set by `hitWallFlyer`'s
  kill at `wallFlyer.js:358-361`), and then `destroy` is set, either by the anim's `endAnim`
  (`stepWallFlyerGraphic`, `wallFlyer.js:330-335`) or by water, lava or a pit (`wallFlyer.js:260-273`).
- **Live** = `!destroy && dieAnim === null`. This is `stepWallFlyer`'s own tail gate
  (`if (w.destroy || w.dieAnim !== null) return`, `wallFlyer.js:308`) and `hitWallFlyer`'s (`:347`). A caller tells
  live from dying by those two fields, as `liveWallFlyer` already does.
- `removed` therefore reads `false` on every row. It is kept so a reader written against the getter's bodies reads
  the same field, as hammer's `after.removed` does.

## The digest-read proof

`wallFlyerStateFor` (l.4251) **does** create state on first read: it does `wallFlyerStates.set(n, byId)` directly,
not through `keptUnlessReading`. `drillStateFor` (l.4283), behind `drillBodiesNow`, does the same, and so does the
existing `get wallFlyers()` read. The guard treats this as follows:

- `wallFlyerStates` is not in `stateDigestParts`' `visit` part. It is a `DIGEST_EXEMPT` row in
  `levelRunStateDigest.test.js` (`UNREAD`: no escape member reaches it). So storing it on a read moves no part.
- Because the builder never consults `readingDepth`, the `reading(() => …)` wrapper would be a **no-op** here. I did
  not add it; `drillBodiesNow` has none either.
- `levelRunDigestRead.test.js` enumerates every getter, so it read `wallFlyerBodies` the day it landed (green). But
  its `LEVELS` hold **no wallflyer room** (L22, L25 and L27 are absent), so it only ever read the family as an empty
  room. **I added a row** that covers those rooms: on L22, L25 and L27, on a fresh boot before and after one tick, it
  reads the getter alone, `run.entities('wallFlyerBodies')` alone, and `wallFlyers` alone. It asserts the room holds
  bodies and that no part of `stateDigest` moves. Green (3 rows).
- `stateDigest` / `stateDigestParts` are untouched.

## Every pin moved (old → new)

| File : row | Old | New |
|---|---|---|
| `levelRun.js` `ENTITY_FAMILY_NAMES` | 35 names, ending `'drillBodies'` | 36, `+ 'wallFlyerBodies'` (end) |
| `levelRun.js` `ENTITY_FAMILIES` | 35 keys | `+ wallFlyerBodies: wallFlyerBodiesNow` (end) |
| `levelRun.js` getters | — | `+ get wallFlyerBodies()` |
| `levelRun.test.js:2706` "the name list is the dispatch table" | `… 'drillBodies',` | `… 'drillBodies', 'wallFlyerBodies',` |
| `levelRun.test.js:2865` (new witness) | — | L22 `wallflyer-kill`, built with this file's `createLevelRun`. At every tick: query = getter (`compareEveryTick`), and the family = the getter's unremoved bodies, field for field. `wallflyer@64,80` is **live** from t0, **dying** from 66 (the `killed` event is 65; see *What the brief got wrong* §5), and **gone** from 90 (= the `removed` event). It is still in `wallFlyers.bodies` with `removed: true`, and not in the family |
| `levelRun.test.js` "every family was witnessed" | green over 35 | green over 36 (the new row witnesses it) |
| `entityBlocks.js` `FAMILY_BLOCKS` | ends `drillBodies` | `+ wallFlyerBodies` (end): `blocks ['wall-launch','contact','hp']` (the `wallflyer` class's own, `entityBlocks.js:125`), `solverReads []`, `strategies []` |
| `seedling-solver-surface.md` § Which blocks the solver models, family table | ends `drillBodies` | `+ \| wallFlyerBodies \| wall-launch, contact, hp \| — \|` (pinned by `entityBlocks.test.js` D4). The Modelled / Only avoided / Not modelled lists **do not move**: `modellingFamilies` skips a family with no `solverReads` |
| `levelRunStateDigest.test.js` `DIGEST_EXEMPT.wallFlyerStates` (a reason string, not a key) | `read via advance, corridorBodyForecast, wallFlyers` | `read via advance, corridorBodyForecast, entities, wallFlyerBodies, wallFlyers` (still `UNREAD`: neither is one of the eight escape members) |
| `levelRunDigestRead.test.js` (new describe) | — | the L22/L25/L27 rows above |
| `scripts/procgen/seedling-solver-surface.json` | `folded.entities` 35; `run` properties 251, getter 218 | 36; 252 / 219; and the `line` of every `levelRun.js` row below l.483 shifts by +20. `--write` rewrote it; `--check`: **GREEN: 372 rows match a fresh census**, bytes equal |

Pins that read the list dynamically and needed **no edit**: `entityBlocks.test.js` (`one row per
ENTITY_FAMILY_NAMES entry`), `seedlingSolverSurface.test.js`, `hammerFightFallback.test.js`'s `fingerprint`
(`ENTITY_FAMILY_NAMES.map(run.entities)`), and `scripts/procgen/rewindExactnessHook.js`'s `fingerprint`. Its consumer
`check-seedling-rewind-exactness.mjs` compares live against rewound fingerprints at runtime, with no committed
fingerprint pin; both sides now carry the new family. `seedling-solver-surface-dynamic.json` did not move.

## Byte-inertia

- `git diff --name-only 80650ed1 HEAD | grep -aE 'fixtures/|golden|tapes/'` → **empty**.
- `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`: base **`391322d681b7aa0229d94b3f6906d024`**,
  head **`391322d681b7aa0229d94b3f6906d024`**. Equal, and equal to the planner's standing value.
- `node scripts/procgen/ci-producer-checks.mjs --jobs=3` at the code head: **99 run, 0 red, 1 skipped, 0 known-red**.
  The skip is `plan-seedling-r7-ends-meet`, the checker's own skip: it needs the wasm submodule, a browser and a
  server, and it runs in CI's `browser-gates`. (The brief said "six"; the script runs its whole roster.)
- `node scripts/procgen/check-procgen-docs.mjs`: **ALL CHECKS PASSED** at `e9a77075` (and see the CI red below:
  `generate-procgen-reference.mjs --check` was not run until CI caught it; it matches at `abad461a`).
- **Behaviour census.** Family consumers that change behaviour: **0**. No solver-family file reads
  `entities('wallFlyerBodies')` (the surface table's `families` column has no `wallFlyerBodies` key). The only new
  readers are tests, `hammerFightFallback`'s fingerprint and the rewind hook's fingerprint. Both are read-only
  instruments, and the read stores only a `DIGEST_EXEMPT` map the tick builds identically anyway (the D2 rule; the
  DIGESTREAD "read every tick walks a tape as one never read" row is green).

## Gates (bounded, `--maxWorkers=3`, ⚖ 52)

The same 89 files at base and at head: the brief's named set (`levelRun`, `levelRunDigestRead`,
`levelRunStateDigest`, `entityBlocks`, `hammerFightFallback`, `wallFlyer`, `fidelityWallFlyer`, `contactFidelity`
(+`Hook`), `r8Acceptance`, `tapeEnvelope`, `tapeIndexManifest`, `solverDeadline`, `decisionTrace`,
`fidelityCorridorBody`, `seedlingRoomBodySkin`, `seedlingSolverSurface`, `seedlingConstantsCensus`), plus every
non-train test file `git grep -alI "wallFlyers\|ENTITY_FAMILY_NAMES\|entities("` finds. No `fidelityTerrain*` test
file exists. The train-tier hits (`*.train.test.js`) are CI's.

| | Files | Tests |
|---|---|---|
| base `80650ed1` | 89 passed | 1941 passed |
| head `e9a77075` | 89 passed | **1945** passed (+1 witness row, +3 digest-read rows) |

CI, `JavaScript Unit Tests` push run **43632388086 at `e9a77075`** (`ci-vitest-summary.mjs`): the suite was
**27309 passed, 1 failed**, and the slow battery 437/437. **The red was mine:**
`procgenDocs/generated.test.js > --check exits 0`. The `wallFlyerBodies` row I added to `seedling-solver-surface.md`
moved the GENERATED docs index (`frontend/modules/procgenDocs/generated/docsIndex.js` counts, and
`docs/json/developer/procgen/README.md` § `GENERATED:procgen-docs-index`: 544,074 → 544,083 words). The local
`check-procgen-docs.mjs` does not cover that region, so it stayed green. Fixed in **`abad461a`**
(`generate-procgen-reference.mjs`, no `--check`; `--check` now reads *ALL 7 GENERATED MODULES AND 5 MARKDOWN
REGIONS MATCH THE CODE*), with `generated` + `docsRender` + `docLinks` green locally (116). The push run at the
final head is for the planner to read: `node scripts/procgen/ci-vitest-summary.mjs <this report's commit>`.
The runners were heavily queued: the run at `e9a77075` took about 70 minutes to start all four jobs.
⚠ **Lesson:** a hand-edited procgen doc is an input to `generate-procgen-reference.mjs`. Run its `--check`
alongside `check-procgen-docs.mjs`.

⚠ I cannot dispatch CI (403). **For the planner:**
`gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-wallflyer-census-family-wn2qvq -f train_only=true`.
**No sweep is named**: the change is census-only, and no leg or survey step can move (0 behaviour-changing consumers,
above).

## The mutant

**Prediction:** drop `.filter((w) => !w.removed)` and a removed body stays in the family. Only the L22 witness row
reds, at its per-tick "family = the getter's unremoved bodies" assertion, from t90; its "every family witnessed"
follow-on reds with it. Nothing else reads the family, so nothing else reds.

**Measured** (copy, mutate, run `levelRun` + `levelRunDigestRead` + `entityBlocks` + `hammerFightFallback`, restore;
the tree is clean after): 2 failed, 191 passed. The two reds:
`L22's rest kill … wallFlyerBodies` (`expected [ …(4) ] to deeply equal [ …(3) ]`: four bodies against the three
unremoved) and `every family was witnessed NON-TRIVIALLY` (`[ 'wallFlyerBodies' ]`). This is exactly the prediction.

## Hammer's hand-over

**The diff** (one `sed` over its `solverBot.js`; it touches three lines, the three sites above):

```sh
sed -i "s/\b\([rf]\)\.wallFlyers?\.bodies ?? \[\]/\1.entities('wallFlyerBodies') ?? []/g" frontend/modules/seedlingDemo/solverBot.js
```

```diff
-    const w = (r.wallFlyers?.bodies ?? []).find((b) => b.id === id);
+    const w = (r.entities('wallFlyerBodies') ?? []).find((b) => b.id === id);
-        const after = (f.wallFlyers?.bodies ?? []).find((b) => b.id === id);
+        const after = (f.entities('wallFlyerBodies') ?? []).find((b) => b.id === id);
-        const b = (f.wallFlyers?.bodies ?? []).find((x) => x.id === id);
+        const b = (f.entities('wallFlyerBodies') ?? []).find((x) => x.id === id);
```

**Is it byte-identical for the arm?** Yes, measured. In a scratch worktree of hammer's `18160277`
(`levelRun.js` is byte-equal between that commit and my base, so `e9a77075`'s `levelRun.js` diff applies clean), I
solved hammer's L27 witness (`l27-from-l28-boot.json`, both arms ON). I fingerprinted the result as md5 over the
per-tick keys, the equips, `BODY_FAMILY_KILL_COUNTS` and the replayed run's `stateDigest()`:

| Variant | md5 | ticks | kills |
|---|---|---|---|
| A: hammer as is | `8f2d36a76f9096e15083d1868e1c2ad1` | 203 | `wallflyer@192,48`, 1 fork |
| B: + the family (reads unswitched) | `8f2d36a76f9096e15083d1868e1c2ad1` | 203 | same |
| C: + the family + the diff above | `8f2d36a76f9096e15083d1868e1c2ad1` | 203 | same |

Under C, hammer's own `hammerWallFlyerDrillKill.test.js` is **6/6** and its train tier
`hammerWallFlyerDrillKill.train.test.js` is **4/4**: L22 two flyers struck, 539 t, no hit; L88 the drill, 354 t.
This was reported only; hammer's branch was not edited, and the scratch worktree is removed.

**Why it is exact, not just equal on these legs.** The only difference the reader can see is that a removed body is
now absent rather than present with `removed: true`.

- `gone()`: `!b || b.removed` gives the same answer either way.
- `liveWallFlyer`: filters `removed` itself.
- `after`: it could differ only if a body that was live at the top of the fight tick (`!destroy`, no `dieAnim`) were
  removed by the end of that same tick. `removed` is set only inside `if (w.destroy)` after a 0.1 fade from alpha
  (`wallFlyer.js:291-293`). The one same-tick `destroy` before that line is water or lava (`:261-263`). A live body's
  alpha is below 1 only on the pit descent, which stays inside its pit cell, so it never reads water or lava. So no
  live body is removed within one step.

**What hammer's slice then owes** (measured in the scratch tree after the diff): `census-seedling-solver-surface
--check` reds 4. They are `run:wallFlyers` RETIRED (nothing in the family reaches it any more, which is the point),
the `run:entities` table drift (`wallFlyerBodies: {solverBot.js: 1}`), and the folded list plus bytes (that half is
already this slice's table). `--write` clears them. Then `entityBlocks.js`'s `wallFlyerBodies.solverReads` becomes
`['solverBot']`, and so does the doc table's "Read by". The doc's **Modelled** paragraph gains
`wall-launch (wallFlyerBodies)` and adds `wallFlyerBodies` to `contact` and `hp`; **Not modelled** loses
`wall-launch`. Both are pinned by `entityBlocks.test.js` D2/D4.

## What the brief got wrong (measured)

1. **"live, not dying"** contradicts the arm it serves. Hammer's `gone()` waits through the dying span until the body
   is removed, and its landed check counts a dying body as a hit. A family without dying bodies would end the
   removal wait on the killing tick, so the arm would replay fewer keys: a behaviour change. The hand-over's own field
   list also carries `dieAnim`, `destroy` and `removed`, all of which would be constant on live-only rows. So the
   family is **the bodies still in the world**, with dying bodies flagged by their own fields. The brief's witness
   ("appears, then disappears once dying/removed") is held at *removed*, and the dying span is asserted present.
2. **"use the `reading(() => …)` wrapper"**: it would do nothing. `wallFlyerStateFor` stores directly, not through
   `keptUnlessReading`, so `readingDepth` is never consulted. The map is `DIGEST_EXEMPT`, which is why the read is
   digest-inert (proved by the new rows), exactly as `drillBodiesNow` and `get wallFlyers()` already are.
3. **Line numbers.** `drillBodiesNow` / `ENTITY_FAMILIES` are at l.18188 / l.18193 (brief: ≈18129–18170), the
   `wallFlyers` getter is at l.19199 (≈19140), and `wallFlyerStateFor` is at l.4251 (≈4249). `ENTITY_FAMILY_NAMES` is
   at l.442, as stated.
4. **Pins.** `rewindExactnessHook.js` and `hammerFightFallback.test.js` iterate `ENTITY_FAMILY_NAMES`, so nothing
   there is listed by hand and nothing to edit. No `fidelityTerrain*` test file exists. The producer battery is 99
   checks, not 6.
5. **A fencepost, not a bug.** The `killed` event is stamped t65, but the body first reads `dieAnim` at t66. This is
   the press fencepost `fidelityWallFlyer.test.js` already measures on the game ("the die anim's first update is the
   tick AFTER the blow"). The witness asserts `killed + 1`.

## Residue

- **The census's fork blind spot.** Of hammer's three reads, the census sees **one site** (`liveWallFlyer`'s `r`
  parameter). The two `f.…` reads on the fork inside `playWallFlyerKill` are not traced as a run, before the switch
  (the `run:wallFlyers` row: `sites: 1`) and after it (`wallFlyerBodies: {solverBot.js: 1}`). The switch still
  retires `run:wallFlyers`, but a fork-held run is a pre-existing census gap for any family.
- `DIGEST_EXEMPT.drillStates`'s reason (`read via advance, corridorBodyForecast, drills`) omits `entities` /
  `drillBodies`, which have read it since fidelity DRILL. It is still `UNREAD` (neither is an escape member). This is
  not my row, so I left it.
- An orphan docblock (`⛓ R2-swim D1: the wallflyers — this room's bodies and the events …`) sits above
  `get drillBodies()` rather than `get wallFlyers()`. It predates this slice and I left it.
- The `wallFlyerBodies` `FAMILY_BLOCKS` row declares the class's blocks with no reader, so it models nothing until
  hammer's switch (above).
