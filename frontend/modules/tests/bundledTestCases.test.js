/**
 * The bundled boot imports the same test cases as the unbundled one — see
 * scripts/build/bundledTestCases.js for why there are two lists and what a
 * drift cost (14 files missing, measured 2026-09-26).
 */
import { describe, expect, it } from 'vitest';
import { bundledTestCaseDrift, bundledTestCaseImports } from '../../../scripts/build/bundledTestCases.js';

describe('bundled test cases', () => {
  it('init-bundled.js imports exactly TEST_CASE_FILES — none missing, none extra', () => {
    expect(bundledTestCaseDrift()).toEqual({ missing: [], extra: [] });
  });

  it('the parser reads the import form init-bundled.js uses, and nothing else', () => {
    const src = [
      "import './modules/tests/testCases/aTests.js';",
      "import './modules/tests/testCases/bTests.js'",
      "// import './modules/tests/testCases/commented.js';",
      "import modulesModule from './modules/modules/index.js';",
    ].join('\n');
    expect(bundledTestCaseImports(src)).toEqual(['testCases/aTests.js', 'testCases/bTests.js']);
  });
});
