LOOKAHEAD evidence (seedling-hammer-lookahead). Base ba367618590c5cc9b9c7c0e6e603c6c9879e2332 (TRAIN 193).
Acceptance md5 at base (= head, no source changed): 391322d681b7aa0229d94b3f6906d024.
legs.jsonl.gz       seedling-divergence-legs.mjs at the base (the 4 legs are ids 829/832/836/839 here).
sphere-items.jsonl  HIT-TIEBREAK's per-sphere items/slots (by KEY), copied from seedling-hammer-fewer-hits-evidence/census.
tools/pit-landing.mjs  one leg solved in node (inv staging, vanilla atlas map, ANYTIME_PASSES, page budget); --siblings=1 every
                    sibling exit into the same target level; --idle=N idle ticks past the plan; --cont=1 next-room continuations.
step1/siblings-idle300.jsonl  the 4 legs x the 7 pit tiles, idle 300 past the plan (landing, hit rows by level).
step1/siblings-cont.jsonl     the cross-room continuation attempt (refused by design, Q5).
step1/l17-arrivals.jsonl      the 14 fresh L17 arrival legs (7 pit landings x stairs/chest): all hitless.
step1/multi-tile-cross-level-legs.txt  empty: no multi-tile cross-level exit leg at seed 1.
step1/sibling-exit-legs.txt   the 160 legs whose exit has AP-equivalent siblings (id, group size, key).
census/  tools/census-run.sh (LEGS=<gunzipped legs.jsonl>) over census/keys.txt -> census.jsonl; tools/census-summary.py -> summary.txt.
