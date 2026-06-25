/**
 * Unit tests for the build-stamp helper (app/buildInfo.js).
 *
 * In plain node (this test env) the __BUILD_TIME__ / __BUILD_COMMIT__ globals
 * are undeclared — the same situation as unbundled local dev. The bundled case
 * is simulated by setting the globals before a fresh dynamic import.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

describe('buildInfo — unbundled (no globals defined)', () => {
  it('getBuildInfo reports not-bundled with null time/commit', async () => {
    const { getBuildInfo } = await import('./buildInfo.js');
    const info = getBuildInfo();
    expect(info.bundled).toBe(false);
    expect(info.time).toBeNull();
    expect(info.commit).toBeNull();
    expect(info.loadedAt).toBeInstanceOf(Date);
  });

  it('formatBuildInfo shows the unbundled-dev load time', async () => {
    const { formatBuildInfo } = await import('./buildInfo.js');
    expect(formatBuildInfo()).toMatch(/^unbundled dev — loaded \d{2}:\d{2}:\d{2}$/);
  });
});

describe('buildInfo — bundled (globals defined, simulating esbuild define)', () => {
  afterEach(() => {
    delete globalThis.__BUILD_TIME__;
    delete globalThis.__BUILD_COMMIT__;
    vi.resetModules();
  });

  it('formats build time + commit + bundled', async () => {
    globalThis.__BUILD_TIME__ = '2026-06-24T19:25:11.000Z';
    globalThis.__BUILD_COMMIT__ = 'a1b2c3d';
    vi.resetModules(); // force the module's top-level consts to re-evaluate
    const { getBuildInfo, formatBuildInfo } = await import('./buildInfo.js');

    const info = getBuildInfo();
    expect(info.bundled).toBe(true);
    expect(info.time).toBe('2026-06-24T19:25:11.000Z');
    expect(info.commit).toBe('a1b2c3d');

    expect(formatBuildInfo()).toBe('build 2026-06-24T19:25:11.000Z · a1b2c3d · bundled');
  });

  it('omits the commit when it is unknown', async () => {
    globalThis.__BUILD_TIME__ = '2026-06-24T19:25:11.000Z';
    globalThis.__BUILD_COMMIT__ = 'unknown';
    vi.resetModules();
    const { formatBuildInfo } = await import('./buildInfo.js');
    expect(formatBuildInfo()).toBe('build 2026-06-24T19:25:11.000Z · bundled');
  });
});
