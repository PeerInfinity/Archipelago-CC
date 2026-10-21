import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  PACKAGE_ROOT,
  loadPackage,
  pythonErrorSummary,
  sitePackageBaseUrl,
} from './pyodideRuntime.js';

describe('sitePackageBaseUrl', () => {
  it('finds a package beside frontend/ when the repo root is served', () => {
    expect(sitePackageBaseUrl('exporter', 'http://localhost:8000/frontend/index.html'))
      .toBe('http://localhost:8000/exporter/');
    expect(sitePackageBaseUrl('world_generator', 'http://localhost:8123/frontend/?bundled=true'))
      .toBe('http://localhost:8123/world_generator/');
  });

  it('finds the staged copy inside the site on Pages', () => {
    expect(sitePackageBaseUrl('exporter', 'https://peerinfinity.github.io/Archipelago-CC/'))
      .toBe('https://peerinfinity.github.io/Archipelago-CC/exporter/');
    expect(sitePackageBaseUrl('exporter', 'https://peerinfinity.github.io/Archipelago-CC/index.html?mode=x'))
      .toBe('https://peerinfinity.github.io/Archipelago-CC/exporter/');
  });
});

describe('pythonErrorSummary', () => {
  it('keeps the last line of a traceback', () => {
    const err = new Error('Traceback (most recent call last):\n  File "<exec>", line 1\nValueError: nope\n');
    expect(pythonErrorSummary(err)).toBe('ValueError: nope');
    expect(pythonErrorSummary('plain')).toBe('plain');
  });
});

describe('loadPackage', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakePy() {
    return {
      written: {},
      ran: [],
      FS: {
        mkdirTree() {},
        writeFile(p, data) { this.owner.written[p] = new TextDecoder().decode(data); },
      },
      runPython(code) { this.ran.push(code); },
    };
  }

  function stubFetch(filesByUrl) {
    const fetchMock = vi.fn(async (url) => {
      const body = filesByUrl[String(url)];
      if (body === undefined) return { ok: false, status: 404 };
      return {
        ok: true,
        json: async () => JSON.parse(body),
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('writes every listed file under PACKAGE_ROOT/<package>/, once per base', async () => {
    const manifestUrl = 'http://h/frontend/modules/x/pkgFiles.json';
    const base = 'http://h/pkg/';
    const fetchMock = stubFetch({
      [manifestUrl]: JSON.stringify({ package: 'pkg', files: ['__init__.py', 'sub/mod.py'] }),
      'http://h/pkg/__init__.py': '',
      'http://h/pkg/sub/mod.py': 'X = 1\n',
    });
    const py = fakePy();
    py.FS.owner = py;
    const stages = [];

    await loadPackage(py, { manifestUrl, packageBaseUrl: base, stage: 'loading-pkg' }, s => stages.push(s));
    expect(py.written[`${PACKAGE_ROOT}/pkg/sub/mod.py`]).toBe('X = 1\n');
    expect(py.ran[0]).toContain(`m == "pkg" or m.startswith("pkg.")`);
    expect(stages).toEqual(['loading-pkg']);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Same manifest, same base: no fetch at all, no stage.
    await loadPackage(py, { manifestUrl, packageBaseUrl: base }, s => stages.push(s));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(stages).toEqual(['loading-pkg']);
  });

  it('reloads from a different base and drops the stale modules', async () => {
    const manifestUrl = 'http://h/frontend/modules/y/pkgFiles.json';
    stubFetch({
      [manifestUrl]: JSON.stringify({ package: 'other', files: ['a.py'] }),
      'http://h/one/a.py': 'A = 1\n',
      'http://h/two/a.py': 'A = 2\n',
    });
    const py = fakePy();
    py.FS.owner = py;
    await loadPackage(py, { manifestUrl, packageBaseUrl: 'http://h/one/' });
    await loadPackage(py, { manifestUrl, packageBaseUrl: 'http://h/two/' });
    expect(py.written[`${PACKAGE_ROOT}/other/a.py`]).toBe('A = 2\n');
    expect(py.ran).toHaveLength(2);
  });

  it('names the URL that failed', async () => {
    const manifestUrl = 'http://h/frontend/modules/z/pkgFiles.json';
    stubFetch({ [manifestUrl]: JSON.stringify({ package: 'z', files: ['missing.py'] }) });
    const py = fakePy();
    py.FS.owner = py;
    await expect(loadPackage(py, { manifestUrl, packageBaseUrl: 'http://h/z/' }))
      .rejects.toThrow('http://h/z/missing.py: HTTP 404');
  });
});
