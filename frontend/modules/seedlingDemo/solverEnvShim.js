/**
 * seedlingDemo/solverEnvShim — the SOLVE WORKER's first import (⛓⛓ SEEDLING HAMMER-PHASE CPWIT; measurement only).
 *
 * Reads `solverEnvChannel.SOLVER_ENV_PARAM` off the worker's own URL (`self.location`, which the page's solve service
 * built with `solveWorkerUrl`) and installs it as `process.env` BEFORE any solver module is evaluated: it is the
 * worker's first static import and imports nothing but the channel's pure table, so ES module evaluation order runs it
 * first. No param → nothing is installed (no `process` is made; byte-identical). A bad spec installs NOTHING and is
 * kept as `SOLVER_ENV_ERROR`: the worker then refuses every solve naming it.
 */
import { installSolverEnv, SOLVER_ENV_PARAM } from './solverEnvChannel.js';

let applied = null;
let error = null;
try {
    applied = installSolverEnv(new URLSearchParams(globalThis.self?.location?.search ?? '').get(SOLVER_ENV_PARAM));
} catch (e) {
    error = e.message;
}

/** The canonical spec this worker installed, or null (the defaults). */
export const SOLVER_ENV_APPLIED = applied;
/** Why the worker's spec was refused (named), or null. */
export const SOLVER_ENV_ERROR = error;
