/**
 * stateManagerProxyWorkerError.test — the ONE line a reader sees when the
 * state-manager worker dies.
 *
 * ⛓ `Worker.onerror` handed `log('error', '[stateManagerProxy] Worker global
 * error:', errorDetails)` — the message, the file and the line all inside the
 * OBJECT. Every console collapses objects by default, so the visible line named
 * neither what went wrong nor where, and a worker that failed to import a module
 * read identically to one that threw at runtime.
 *
 * ⛔ THE FORMATTER IS WHAT IS GATED, not the event plumbing: the handler lives
 * inside a class constructor around a real `Worker`, which no node test can
 * reach, and the thing that decays is the FORMAT.
 */

import { describe, expect, it } from 'vitest';

import { describeWorkerError } from './stateManagerProxy.js';

describe('describeWorkerError', () => {
  it('puts the message and its site in one line', () => {
    expect(describeWorkerError({
      message: 'Cannot find module ./missing.js', filename: 'http://x/w.js', lineno: 12,
    })).toBe('Cannot find module ./missing.js @ http://x/w.js:12');
  });

  it('⚠ a cross-origin worker error carries NO message and NO filename — and says so', () => {
    // Measured behaviour of the browser, not a hypothetical: the fields arrive
    // empty, and `undefined:0` would be a line that looks like data.
    expect(describeWorkerError({ message: '', filename: '', lineno: 0 }))
      .toBe('no message (a cross-origin worker error carries none) @ an unknown file');
    expect(describeWorkerError()).toMatch(/^no message .* @ an unknown file$/);
  });

  it('a filename with no line number still names the file', () => {
    expect(describeWorkerError({ message: 'boom', filename: 'w.js' })).toBe('boom @ w.js:0');
  });
});
