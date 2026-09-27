// The armed edge: a multi-line import of the module's own index.js (the form a
// line regex misses — the guard must parse the statement).
import {
  moduleInfo,
} from './index.js';

export const FIXTURE_ID = 'cyclic';

export function describeFixture() {
  return moduleInfo.name;
}
