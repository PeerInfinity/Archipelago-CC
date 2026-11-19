FEWER-HITS evidence (seedling-hammer-fewer-hits). Base f43e2de82a (TRAIN 166, HIT_AWARE_ANSWER ON).
w0/       step 1, base: page rows (probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
          --page=seedling_bot_ap_p4g --page-legs=1 --keys=…) for 302 x6 (rows-302-r0..r5) and 128/161/838/841/845/848
          (rows-oth); their captured solve requests (cap/*.jsonl.gz, --capture-requests); and node phase probes
          (tools/phase.mjs: the same request with k idle ticks appended): phase-302-r5-i1 (the hit continuation),
          phase-302-r1-i1 (a hitless one), phase-128/161 (k 0..16), fm-128/161 (k=0 under SEEDLING_FADE_MOVE=1).
Acceptance md5 at base: 391322d681b7aa0229d94b3f6906d024.
game/     step 4, tip, page ON (--solver-env=SEEDLING_HIT_AVOID_PASS=1): 302 x6 (rows-302-on-1..6), the SOLVER_ENV line.
census/   step 5: node census of every leg (tools/census-leg.mjs, both switches ON; 3 parallel, 240 s cap):
          census-on.jsonl.gz, summary.txt (tools/census-summary.py); legs.jsonl.gz (seedling-divergence-legs.mjs at base,
          922 legs, ids are list positions); sphere-items.jsonl (HIT-TIEBREAK's, by key); phase-836/839/843/846.jsonl
          (tools/phase-leg.mjs, k 0..30 idle ticks, no budget: 1 hit at every k); pit7-hit-rows.jsonl (the hit row).
w0/rows-pit7.jsonl, w0/cap/cap-pit7.jsonl.gz: the four L16 out_pit_7 legs on the page at base.
vitest-bounded*.txt: the bounded vitest file list and log.
