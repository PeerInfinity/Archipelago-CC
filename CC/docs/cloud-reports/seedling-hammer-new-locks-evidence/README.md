# Evidence — seedling hammer-phase NEW-LOCKS

The report is `../seedling-hammer-new-locks.md`. Everything here is measurement output or a scratch tool; nothing decides.

- `w0/` — the five legs at the defaults: the legs (`legs-five.jsonl`), the page sweep (`page-sweep-d0.*`), the captured
  requests (`requests-d0.jsonl.gz`), 223's node replay, the lock census (`census-locks.txt`).
- `m/` — the page sweeps with the switches on (`page-sweep-ab.txt`: the env channel; `page-sweep-flip*.txt`: the scratch
  copy with the defaults flipped; `page-sweep-flip4.jsonl` and `requests-flip4.jsonl.gz`: the final one), and the
  fixtures' cut = uncut table (`fixture-cut.txt`).
- `i/` — the mutants (`mutants.txt`).
- `radius/` — the 71 leg ids, the page sweep at the defaults (`page-sweep-off.txt`), the four-arm node comparison
  (`radius-off-new-rew-all.jsonl.gz`, `summary.txt`), L53-KILLLOCK's fixtures under the line stance, L112's leg on the
  flipped copy.
- `d/` — the gates: the bounded file lists and results (defaults and ON), the train files, the producer checks, the
  surface and constants censuses, the acceptance md5, the reference check, the JSUT summary.
- `tools/` — `chain.mjs`, `fix-solve.mjs`, `radius.mjs`, `rows.mjs`, `world.mjs`, `census-locks.mjs`,
  `cut-fixture.mjs`, `mutants.py`.
