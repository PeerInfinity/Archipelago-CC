# Content sets — LAB-BIOME: the maze lab stops reading a sidecar's region biome as its palette

Slice LAB-BIOME (Opus), worktree `Archipelago-CC-wt-lab-biome`, branch `lab-biome`, base `origin/main` `817d620e30`.
Code commit `27a735d84a`. Pre-existing defect; Robert chose to fix it on 2026-11-24.

## 1. The cause

`frontend/modules/mazeRoom/mazeLab.js` `loadPayload` (`:1807` at base) did
`const palette = paletteFor(payload?.biome ?? biome)` on the document it was handed. A preset link
(`mazeLabView.js` `bootPresetRoom`, `:1998`, `loadPayload(link.sidecar)`) and the LOAD box (`:2031`, a pasted
document) both hand it the **sidecar envelope** `{substrate, render_hint, grid_cell, playable_payload, biome,
grow_telemetry}`. On a pipeline sidecar, `biome` is the **region biome** `{id: 'classic'}`
(`mazeRoomBiomeLibrary` / `mazeRegionBiomes`), not a lab palette name. `paletteFor` (`mazeLab.js:150`) looked it up
in `MAZE_BIOMES = {'maze-v1': …}` and refused: *"mazeLab: biome {"id":"classic"} is not one of [maze-v1]"*. This is
the collision the note above `MAZE_BIOMES` (`:132–145`) predicted.

**Both paths** reach it: the preset/region link and a pasted sidecar in the LOAD box. `?gen=` does not, because it
reads a lab payload, whose `biome` IS a palette name.

Reproduced on this tree's server (`:8130`) before the fix: `?source=edit&preset=meta_trial&region=region_2_3` →
`fatal` with the sentence above.

## 2. When `biome` started being recorded

`794d343444` (2026-05-04), *"mazeRoom: thread biome through generateRegionCore and into sidecars"*
(`mazeRoomEngine.js`, `procgenPipelineEngine.js`). That is long before GEN-1, which is why `meta_trial` (and much
more) hits it. **Measured reach** at the base: **1052** maze sidecars that carry a room and a `biome`, in **34**
committed preset folders (every one `{id: 'classic'}`; no non-maze sidecar records a biome). Every one of them was
refused by the lab's link and LOAD before this slice; every one loads after it.

## 3. The fix, and why that shape

`loadPayload` now decides by **shape**, as `levelOfPayload` already does:

- an **envelope** (`playable_payload` present) is a sidecar, and its `biome` is the REGION biome. It never reaches
  `paletteFor`. The palette is the caller's default (`maze-v1`), and the region biome is carried on the state as
  `regionBiome` (the key is absent for every other document, so those states are unchanged);
- **anything else** (a lab payload, a bare level) is unchanged: its `biome` IS the palette, and an unknown name
  still refuses by name. `?biome=pre-sword` still refuses (`mazeLab.test.js:137`), and a lab payload carrying
  `{id:'classic'}` as its biome still refuses (pinned).

**Why ignored, not carried into drawing:** the lab draws a loaded room from its `tiles`, which are already concrete
(`mazeRoomRender.drawWorld`). Nothing in the lab (`mazeLab.js`, `mazeLabView.js`, `mazeLabPreset.js`) draws walls by
the region biome. So a `scattered` room already draws as what it is, and there is no base (`classic`) lookup to add.
A save of a sidecar-loaded room writes `biome: "maze-v1"` (the palette) and loads back as a fixed point.

Files: `frontend/modules/mazeRoom/mazeLab.js` (`isSidecarEnvelope`, `loadPayload`). Not in the engine closure.

## 4. watchGenerate's verdict: not reachable

`seedlingDemo/watchGenerate.js:187` `paletteFor` has the same refusal, but no sidecar reaches it. The Seedling page
takes its `biome` only from a lab payload (`?gen=` or a host's `procgenLab:load`, `watchViewer.js:6144`). No
`preset_sidecars` / `playable_payload` path exists in `watchViewer.js` / `watchGenerate.js`, and the census found
**0** non-maze sidecars that record a biome. Left unchanged.

## 5. Proof

| What | Result |
|---|---|
| Failing pin first | `mazeConvertedLoad.test.js` § *lab biome*: **3 red** against the base `mazeLab.js`, green after |
| The pin's census | every committed maze sidecar with a room and a biome, read off the disk (no count pinned, so a new preset like `tile_kinds_demo` widens it rather than breaking it): none refused, palette `maze-v1` |
| `meta_trial` `region_2_3` in the lab | opens by link at `maze-v1`, 8×6 |
| Another pipeline room | `meta_trial` `region_1_3` opens too (and the census covers all 1052) |
| `check-maze-lab` | ALL CHECKS PASSED, including the new claim **LAB BIOME** (both `meta_trial` biome rooms by link, regions read off the rules) |
| Screenshot | `CC/docs/cloud-reports/content-sets-lab-biome-shots/3b-link-biome-meta_trial-region_2_3.png` (and `…region_1_3.png`) |
| `tile_kinds_demo` scattered room | not yet: GEN-2 has not landed. Its sidecars have the same shape, so the census pin covers them on arrival |

## 6. Gates

| Instrument | Result |
|---|---|
| `--print-engine-closure` | `engineMd5 74ae60f575531492ed9eaec1839e1fe3`, 42 files, unchanged; closure ∩ diff = ∅ |
| Committed presets / rules moved | none |
| `check-maze-lab` | ALL CHECKS PASSED |
| `check-procgen-docs` | ALL CHECKS PASSED |
| `generate-procgen-reference --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| Bounded vitest (`mazeConvertedLoad.test.js`, `mazeLab.test.js`) | 145 passed |
| Gitlinks changed | 0 |

## 7. CI at the tip

Appended below once measured.
