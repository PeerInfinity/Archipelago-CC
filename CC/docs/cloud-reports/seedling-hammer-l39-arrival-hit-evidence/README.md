# seedling-hammer-l39-arrival-hit evidence

Measurement only (nothing here is imported by the app). The input is re-measure-11's `S1.stop-requests-18-32-37.jsonl.gz`
and `L1.stop-requests-18-32-37.jsonl.gz` (`claude/seedling-whole-game-wasm-remeasure-bypmjt` @98bcc6259b), read into a
scratch dir and not committed. The one request the rows use is committed as
`frontend/modules/seedlingDemo/fixtures/hit-plan-retry/S1-18-11.request.json.gz`.

- `tools/`:
  - `page.mjs`: a request through the page's expiry branch (`SEAM_SHIFT=<n>` moves `staging.seam.time`);
  - `passes.mjs`: one `solveAnytime`'s pass rows;
  - `witness.mjs`: the p4g game witness (CHASER-STAND's `reqwitness.mjs` through `pageLadder`);
  - `mainthread.mjs`: the page main thread's read of the switch.
- `band/`:
  - `fine-45-seams.md`: OFF vs ON over seams 29970–30014, with its raw files;
  - `coarse-off-raw.txt`: step 5 around 29994 (S1) and 30052 (L1).
- `six/`: SIX and SIX + HPR at the 7 hit seams.
- `game/`: the ON and OFF witnesses' logs.
- `sweep/`: the single leg `level_39__r0c9 <- in_L40_480_912 -> location:Level 039 - Totem Part 72,40`, OFF and ON (page).
- `survey/`: the OFF and ON surveys (`--through=end`, gzipped) and their per-step summary.
- `acceptance-md5.txt`: the acceptance md5 at the base and after each commit.
