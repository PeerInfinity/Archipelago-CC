/**
 * Stands in for `seedlingDemo/levelRun.js` under the probe: re-exports the
 * real module whole, and shadows `createLevelRun` with a version whose
 * result is wrapped by the recorder. The real function runs unchanged.
 */
import * as real from '../../../frontend/modules/seedlingDemo/levelRun.js';

export * from '../../../frontend/modules/seedlingDemo/levelRun.js';

export function createLevelRun(...args) {
    return globalThis.__seedlingSurfaceProbe.wrapRun(real.createLevelRun(...args));
}
