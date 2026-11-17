p4g page sweep (probe-seedling-divergence-sweep --mode=inv --producer=solver --page=seedling_bot_ap_p4g --page-legs=1) at
the step-2 code, rows cut to the fields the report reads:
game-hit.jsonl    --solver-env=SEEDLING_HIT_AWARE_ANSWER=1                     keys 160, 308
game-fmhit.jsonl  --solver-env=SEEDLING_FADE_MOVE=1;SEEDLING_HIT_AWARE_ANSWER=1 key 160
game-fm.jsonl     --solver-env=SEEDLING_FADE_MOVE=1                             key 160 (the control)
gameHits = the page's roomHits (the game's own hits counter, sampled per tick); gameEnd/modelEnd = the game's end vs the plan's expected end.
