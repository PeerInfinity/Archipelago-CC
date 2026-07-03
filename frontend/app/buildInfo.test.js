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

  it('formatBuildInfo with a source stamp shows sources + loaded', async () => {
    const { formatBuildInfo } = await import('./buildInfo.js');
    const mtime = new Date(2026, 6, 3, 9, 14, 2); // local time
    expect(formatBuildInfo({ mtime }))
      .toMatch(/^unbundled dev — sources 2026-07-03 09:14:02 · loaded \d{2}:\d{2}:\d{2}$/);
    // malformed stamps fall back to load-time-only
    expect(formatBuildInfo({ mtime: new Date('garbage') }))
      .toMatch(/^unbundled dev — loaded /);
    expect(formatBuildInfo(null)).toMatch(/^unbundled dev — loaded /);
  });

  it('fetchSourceStamp parses the dev-server answer and caches the promise', async () => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mtime: '2026-07-03T09:14:02+0000', file: 'frontend/x.js' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSourceStamp } = await import('./buildInfo.js');
    const stamp = await fetchSourceStamp();
    expect(stamp.mtime).toBeInstanceOf(Date);
    expect(stamp.mtime.toISOString()).toBe('2026-07-03T09:14:02.000Z');
    expect(stamp.file).toBe('frontend/x.js');
    await fetchSourceStamp(); // cached — no second request
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('fetchSourceStamp resolves null on 404 and on network failure', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    let mod = await import('./buildInfo.js');
    expect(await mod.fetchSourceStamp()).toBeNull();

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('refused')));
    mod = await import('./buildInfo.js');
    expect(await mod.fetchSourceStamp()).toBeNull();
    vi.unstubAllGlobals();
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

  it('fetchSourceStamp is a no-op in bundled mode (the build time IS the stamp)', async () => {
    globalThis.__BUILD_TIME__ = '2026-06-24T19:25:11.000Z';
    globalThis.__BUILD_COMMIT__ = 'a1b2c3d';
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSourceStamp } = await import('./buildInfo.js');
    expect(await fetchSourceStamp()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
