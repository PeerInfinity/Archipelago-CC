import { describe, it, expect } from 'vitest';

import { helpersToPython, pythonToHelpers } from './helperScript.js';
import { PACKAGES_FOR, convertInPyodide } from './helperScriptCore.js';

/** A worker double that answers the protocol the way helperScriptWorker does. */
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
    fail(message) {
      for (const fn of [...listeners.error]) fn({ message });
    },
    listenerCount: () => listeners.message.size + listeners.error.size,
  };
  return worker;
}

const urls = { exporterBaseUrl: 'http://h/exporter/', worldGeneratorBaseUrl: 'http://h/world_generator/' };

describe('pythonToHelpers (the page side of the worker protocol)', () => {
  it('posts the source and resolves with script_api\'s result', async () => {
    const helpers = { h: { type: 'item_check', item: 'A' } };
    const worker = fakeWorker(msg => [
      { type: 'progress', id: msg.id, stage: 'converting' },
      { type: 'result', id: msg.id + 1000, ok: false, error: 'someone else\'s job' },
      { type: 'result', id: msg.id, ok: true, result: { helpers, warnings: ['w'], errors: [] }, ms: 7 },
    ]);
    const stages = [];
    const out = await pythonToHelpers('def h(state, player): ...', { worker, onProgress: s => stages.push(s), ...urls });
    expect(out).toEqual({ helpers, warnings: ['w'], errors: [], ms: 7 });
    expect(stages).toEqual(['converting']);
    const sent = worker.posted[0];
    expect(sent).toMatchObject({ type: 'convert', op: 'toHelpers', payload: { source: 'def h(state, player): ...' }, ...urls });
    expect(worker.listenerCount()).toBe(0);
  });

  it('rejects with Python\'s error line, and on a worker that failed to load', async () => {
    const worker = fakeWorker(msg => [{ type: 'result', id: msg.id, ok: false, error: 'ImportError: x' }]);
    await expect(pythonToHelpers('', { worker, ...urls })).rejects.toThrow('ImportError: x');
    expect(worker.listenerCount()).toBe(0);

    const dead = fakeWorker(() => []);
    const pending = pythonToHelpers('', { worker: dead, ...urls });
    dead.fail('worker script 404');
    await expect(pending).rejects.toThrow('worker script 404');
    expect(dead.listenerCount()).toBe(0);
  });
});

describe('helpersToPython', () => {
  it('posts the helpers, the rules document and the slot as a string', async () => {
    const worker = fakeWorker(msg => [
      { type: 'result', id: msg.id, ok: true, result: { code: 'def h(state, player):\n    return True\n', warnings: [], errors: [] }, ms: 3 },
    ]);
    const out = await helpersToPython({ h: { type: 'constant', value: true } }, { rules: { game_name: 'G' }, playerId: 2, worker, ...urls });
    expect(out.code).toContain('def h(state, player)');
    expect(worker.posted[0]).toMatchObject({
      op: 'toPython',
      payload: { helpers: { h: { type: 'constant', value: true } }, rules: { game_name: 'G' }, playerId: '2' },
    });
  });
});

describe('convertInPyodide', () => {
  function fakePy(reply) {
    const globals = new Map();
    return {
      globals: { set: (k, v) => globals.set(k, v), delete: k => globals.delete(k), size: () => globals.size },
      seen: null,
      runPython(code) {
        this.seen = { code, op: globals.get('_helper_script_op'), payload: JSON.parse(globals.get('_helper_script_payload')) };
        if (reply instanceof Error) throw reply;
        return JSON.stringify(reply);
      },
    };
  }

  it('hands Python the op and payload and parses the JSON it returns', () => {
    const py = fakePy({ helpers: {}, warnings: [], errors: [] });
    expect(convertInPyodide(py, 'toHelpers', { source: 'x' })).toEqual({ helpers: {}, warnings: [], errors: [] });
    expect(py.seen.op).toBe('toHelpers');
    expect(py.seen.payload).toEqual({ source: 'x' });
    expect(py.seen.code).toContain('from exporter import script_api');
    expect(py.globals.size()).toBe(0);
  });

  it('clears its globals even when Python throws, and refuses an unknown op', () => {
    const py = fakePy(new Error('boom'));
    expect(() => convertInPyodide(py, 'toPython', {})).toThrow('boom');
    expect(py.globals.size()).toBe(0);
    expect(() => convertInPyodide(py, 'toYaml', {})).toThrow('unknown helper-script operation');
  });

  it('loads world_generator only for Python generation', () => {
    expect(PACKAGES_FOR.toHelpers).toEqual(['exporter']);
    expect(PACKAGES_FOR.toPython).toEqual(['exporter', 'world_generator']);
  });
});
