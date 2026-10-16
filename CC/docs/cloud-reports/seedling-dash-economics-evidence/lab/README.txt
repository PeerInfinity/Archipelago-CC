The DS lab — scratch only, never committed as code (the brief's boundary). These are evidence:
  lab.diff        the instrument + every shape switch, against main af12970374's solverBot.js / jsRuntimeSolver.js.
                  With no switch set (globalThis.__DSX empty) the lab's answers equal main's (D1: 868/870 equal to the
                  page; base0 rerun equal to the first window-0 run on all 617).
  ds-run.mjs      one captured request, one window, one process (replay-seedling-solve-request.mjs's replayOnce + the
                  instrument); --dsx='{json}' sets the shape switches
  ds-batch.mjs    every captured request, fresh process each, --jobs N, resumable
  ds-analyze.py   D1 table   ·   ds-d2.py  D2 classes   ·   ds-d3.py  the shape table   ·   defaults.mjs  W0's defaults
Shape switches (lab names):
  prefixLens [2,3,4]   drop the swing-only prefix [0] from `all`'s four
  legPre K             skip a corridor whose UNDASHED walk has a leg longer than PREVIEW_AGREEMENT_BOUND + K
  stride k             step k start ticks (not 1) after a start where nothing certified
  tail R               stop the scan when fewer than R walk ticks remain after the start
  cap N / capKeep      a per-corridor preview cap (dropping / keeping the accepted windows)
  dashWindow W         the window counts ONLY the dash scan's own asks and trips only `sword-dash`; the rest of the
                       full pass runs on the budget
  keepOnDeadline       a `sword-dash` trip keeps the windows already accepted (today: the schedule is dropped)
  legGate              (built, not run in the battery: legPre dominated it)
  firstCert            (a) cheap first: the whole chain first, stop at the first certified prefix
To re-run: copy frontend/ + scripts/ to a scratch dir, `git apply lab.diff` there, rename *.txt back.
