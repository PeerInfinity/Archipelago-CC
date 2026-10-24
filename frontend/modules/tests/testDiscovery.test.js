/**
 * testDiscovery records the test files it failed to import (slice C6): a file
 * that throws on import registers no rows, so the roster simply lacks them —
 * the list is the only trace, and testLogic publishes it with the results.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let discovery;

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  discovery = await import('./testDiscovery.js');
});

describe('test-file import failures', () => {
  it('starts empty', () => {
    expect(discovery.getImportFailures()).toEqual([]);
  });

  it('registerTestFile records the failing file and its error, and still rethrows', async () => {
    await expect(discovery.registerTestFile('./testCases/noSuchTests.js')).rejects.toThrow();
    const failures = discovery.getImportFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].file).toBe('./testCases/noSuchTests.js');
    expect(failures[0].error).toMatch(/^\w*Error: /);
  });

  it('returns a copy, and forceRediscovery clears the list', async () => {
    await expect(discovery.registerTestFile('./testCases/noSuchTests.js')).rejects.toThrow();
    discovery.getImportFailures()[0].file = 'mutated';
    expect(discovery.getImportFailures()[0].file).toBe('./testCases/noSuchTests.js');
    discovery.forceRediscovery();
    expect(discovery.getImportFailures()).toEqual([]);
  });
});
