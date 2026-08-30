/**
 * seedlingDemo/watchLifetime — ⛓ THE SEEDLING SPELLING OF
 * `procgenCore/pageLifetime.js`, which is where the implementation lives since
 * CONSTRUCTIVE-MODE slice 3.
 *
 * ⛔ Nothing in it was ever a Seedling fact — it is an AbortController, a
 * guarded loop body and a bounded history of retired arms — and `mazeRoom/
 * lab.html` needs exactly the same thing for exactly the same reason (arms
 * switching in place, with a teardown the reload used to do for free). The
 * alternative was `mazeRoom/` importing `seedlingDemo/`; see the moved file's
 * docblock for why that direction is the one this arc keeps refusing.
 *
 * ⚠ THIS FILE IS A RE-EXPORT AND NOT A COPY. Every Seedling caller — the page,
 * `watchViewer.js`, the switch browser row, `watchLifetime.test.js` — keeps its
 * import path and its names, including `WatchLifetimeError`. `watchViewer.js`'s
 * structural check (that every `addEventListener` goes through a lifetime) is
 * asserted over `watchViewer.js`'s own source and is unaffected by where the
 * lifetime is defined.
 */

export {
    PageLifetimeError,
    WatchLifetimeError,
    createLifetime,
    createLifetimeHolder,
} from '../procgenCore/pageLifetime.js';
