import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildApworld,
  normaliseGameName,
  worldGeneratorBaseUrl,
} from './apworldBuild.js';
import {
  MANIFEST_PATH,
  REPO_ROOT,
  manifestText,
  trackedPackageFiles,
} from '../../../scripts/build/world-generator-files.mjs';

describe('worldGeneratorBaseUrl', () => {
  it('finds the package beside frontend/ when the repo root is served', () => {
    expect(worldGeneratorBaseUrl('http://localhost:8000/frontend/index.html'))
      .toBe('http://localhost:8000/world_generator/');
    expect(worldGeneratorBaseUrl('http://localhost:8123/frontend/?bundled=true'))
      .toBe('http://localhost:8123/world_generator/');
  });

  it('finds the staged copy inside the site on Pages', () => {
    expect(worldGeneratorBaseUrl('https://peerinfinity.github.io/Archipelago-CC/'))
      .toBe('https://peerinfinity.github.io/Archipelago-CC/world_generator/');
    expect(worldGeneratorBaseUrl('https://peerinfinity.github.io/Archipelago-CC/index.html?mode=x'))
      .toBe('https://peerinfinity.github.io/Archipelago-CC/world_generator/');
  });
});

describe('normaliseGameName', () => {
  it('treats blank as "keep the document\'s name"', () => {
    expect(normaliseGameName('')).toBe(null);
    expect(normaliseGameName('   ')).toBe(null);
    expect(normaliseGameName(undefined)).toBe(null);
    expect(normaliseGameName('  My Game ')).toBe('My Game');
  });
});

describe('worldGeneratorFiles.json', () => {
  it('is the tracked world_generator tree (regenerate: node scripts/build/world-generator-files.mjs --write)', () => {
    const committed = fs.readFileSync(path.join(REPO_ROOT, MANIFEST_PATH), 'utf8');
    expect(committed).toBe(manifestText(trackedPackageFiles()));
  });

  it('carries the module build_apworld lives in', () => {
    expect(trackedPackageFiles()).toContain('apworld.py');
  });
});

/** A worker double that answers the protocol the way apworldBuildWorker does. */
function fakeWorker(answer) {
  const listeners = { message: new Set(), error: new Set() };
  const worker = {
    posted: [],
    addEventListener: (type, fn) => listeners[type].add(fn),
    removeEventListener: (type, fn) => listeners[type].delete(fn),
    postMessage(msg) {
      worker.posted.push(msg);
      queueMicrotask(() => {
        for (const reply of answer(msg)) {
          for (const fn of [...listeners.message]) fn({ data: reply });
        }
      });
    },
    listenerCount: () => listeners.message.size + listeners.error.size,
  };
  return worker;
}

describe('buildApworld (the page side of the worker protocol)', () => {
  it('posts the document and resolves with the bytes and the name AP needs', async () => {
    const worker = fakeWorker(msg => [
      { type: 'progress', id: msg.id, stage: 'generating' },
      { type: 'result', id: msg.id + 1000, ok: false, error: 'someone else\'s job' },
      {
        type: 'result', id: msg.id, ok: true, fileName: 'g_x.apworld', gameName: 'G X',
        gameDirectory: 'g_x', bytes: new Uint8Array([80, 75, 3, 4]).buffer, ms: 5,
      },
    ]);
    const stages = [];
    const built = await buildApworld({ game_name: 'G' }, {
      gameName: ' G X ', playerId: 2, onProgress: s => stages.push(s),
      worker, packageBaseUrl: 'http://h/world_generator/',
    });
    expect(built.fileName).toBe('g_x.apworld');
    expect(Array.from(built.bytes)).toEqual([80, 75, 3, 4]);
    expect(stages).toEqual(['generating']);
    const sent = worker.posted[0];
    expect(JSON.parse(sent.rulesText)).toEqual({ game_name: 'G' });
    expect(sent.gameName).toBe('G X');
    expect(sent.playerId).toBe('2');
    expect(sent.packageBaseUrl).toBe('http://h/world_generator/');
    expect(worker.listenerCount()).toBe(0);
  });

  it('rejects with the generator\'s error line', async () => {
    const worker = fakeWorker(msg => [
      { type: 'result', id: msg.id, ok: false, error: 'KeyError: \'regions\'' },
    ]);
    await expect(buildApworld({}, { worker, packageBaseUrl: 'http://h/world_generator/' }))
      .rejects.toThrow("KeyError: 'regions'");
    expect(worker.listenerCount()).toBe(0);
  });
});
