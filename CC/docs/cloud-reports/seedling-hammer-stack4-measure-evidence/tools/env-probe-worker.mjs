// MEASUREMENT-ONLY: a module worker that loads the REAL solve worker module first (so its import graph, the env shim
// first, evaluates exactly as on the page), then reports what solverBot's switches read in this worker.
import '/frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js';
import * as sb from '/frontend/modules/seedlingDemo/solverBot.js';
import { SOLVER_ENV_APPLIED } from '/frontend/modules/seedlingDemo/solverEnvShim.js';
self.postMessage({ applied: SOLVER_ENV_APPLIED, env: globalThis.process?.env ?? null,
  LATCHED_HOLD_MOVE: sb.LATCHED_HOLD_MOVE.enabled, PRESS_KILL_START_WAIT: sb.PRESS_KILL_START_WAIT.enabled,
  PRESS_KILL_REFUGE_BOMBS: sb.PRESS_KILL_REFUGE_BOMBS.enabled, DASH_STAND_SIGHT: sb.DASH_STAND_SIGHT.enabled });
