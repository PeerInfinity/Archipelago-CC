# seedling-hammer-376-bomb — evidence

Leg 376 = `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`.

**The request.** Every node measurement here replays ONE captured request: the one in fidelity KNOCKBACK376's committed
witness `frontend/modules/seedlingDemo/fixtures/rockgone-witness/rockgone-leg376-play.json.gz` (on
`origin/claude/seedling-fidelity-wave-37c-0ppd4u`; captured by the page at seam 5271; Maps/Sets tagged for
`restoreRequest`; the level source is the committed atlas). A seam is staged with
`replay-seedling-solve-request.mjs`'s `atSeamTime`. The leg's answer is a function of `seam mod 45` (the hammer phase):
seams 5243 and 5333 are both phase 23 and answer byte-identically (`w0/main-s5243-*.row` = `w0/main-s5333-*.row`).

Get the fixture into the scratch dir first:

```
git show origin/claude/seedling-fidelity-wave-37c-0ppd4u:frontend/modules/seedlingDemo/fixtures/rockgone-witness/rockgone-leg376-play.json.gz > $SCRATCH/leg376-play.json.gz
```

## tools (scratch instruments; nothing here is loaded by the app)

| file | what |
|---|---|
| `tools/s376.mjs` | `--seam=N [--cap=W] [--counts=1]`: `solveAnytime` at that seam (cap = the work budget; default the request's 640), the plan replayed on a FRESH run (hits). `--counts` prints `BOMB_PHASE_WAIT_COUNTS` |
| `tools/census.sh` | `census.sh <outdir> <cap>`: s376 over seams 5243..5287 (all 45 hammer phases), 3 at a time |
| `tools/chain376.mjs` | L40-CENSUS's `chain.mjs` on this fixture: every work unit stamped with its site and solver frame, every trace row with the unit it landed at |
| `tools/rows376.mjs`, `tools/rowsfull.mjs` | the dashless pass's trace rows (saw / strategy / path) |
| `tools/keys376.mjs` | the dashless pass's driven keys, replayed tick by tick with the bombs in flight |
| `tools/escape.mjs` | from rest, the displacement after k ticks of one held direction (the run's own preview stepper) |
| `tools/show.sh` | a row file → its head, the refusal's first lines, the bomb arm's kept/refused rows |

## w0 (main `6473024aa8`, defaults)

| file | what |
|---|---|
| `w0/phase-census-main-640.tsv` | seam, phase, SOLVED/REFUSED, work, ticks, hits, the refusal class — all 45 phases at the page's 640 |
| `w0/main-s5243-c2560.row`, `w0/main-s5333-c2560.row` | the held retry's 2560: still the deadline (`crusher-fork`) |
| `w0/main-s5243-c40960.row`, `w0/main-s5333-c40960.row` | uncapped: REFUSED BY NAME at 8450 units (dashless 2975, full 5475) on `bombpusher@112,128#17` at the goal |
| `w0/chain-5333-units.txt` | where the 8450 go: sites, frames, and the rung rows by unit |
| `w0/keys-5333-t1385-1430.txt` | the walk to (200,136), the break's press at t1411 and its 20-tick stand, bomb #13 in flight (launched t1400, lands t1432) |

## m — the designs (45-phase censuses)

| file | what |
|---|---|
| `m/phase-census-final-on-640.tsv`, `m/phase-census-final-off-640-at-head.tsv` | the shipped design (D) ON, and OFF at the head (= `w0/phase-census-main-640.tsv`) |
| `m/plan-digests-final-off-vs-on.txt` | per phase: OFF / ON verdict, plan digest, hits, work, the arm's asked / kept / refused |
| `m/phase-census-design-b-on-2560.tsv` | design B (the arrival tail as every walk's stand): 6 phases lost |
| `m/phase-census-design-c-on-640.tsv`, `-on-2560.tsv`, `m/plan-digests-design-c-off-vs-on.tsv` | design C (the 45-phase superset that the ON producer battery refuted) |
| `m/design-*.row` | single solves along the way (phase 23 / phase 36, designs A′–C) |

## i — mutants

`i/mutants-final.txt` (M1′–M6′ on the shipped code, `tools/mutants.sh`); `i/mutants.txt` (the first cut's M1–M5).

## d — gates

`d/identity-head.txt`, `d/wasm-ship-tail.txt`, `d/producers-off.txt`, `d/producers-on.txt`, `d/slow-local.txt`,
`d/train-local.txt`.
