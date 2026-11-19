FEWER-HITS evidence (seedling-hammer-fewer-hits). Base f43e2de82a (TRAIN 166, HIT_AWARE_ANSWER ON).
w0/       step 1, base: page rows (probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
          --page=seedling_bot_ap_p4g --page-legs=1 --keys=…) for 302 x6 (rows-302-r0..r5) and 128/161/838/841/845/848
          (rows-oth); their captured solve requests (cap/*.jsonl.gz, --capture-requests); and node phase probes
          (tools/phase.mjs: the same request with k idle ticks appended): phase-302-r5-i1 (the hit continuation),
          phase-302-r1-i1 (a hitless one), phase-128/161 (k 0..16), fm-128/161 (k=0 under SEEDLING_FADE_MOVE=1).
Acceptance md5 at base: 391322d681b7aa0229d94b3f6906d024.
