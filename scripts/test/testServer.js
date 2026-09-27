/**
 * The dev server the browser tests drive — ONE source of truth.
 *
 * Every Playwright entry point (playwright.config.js, the specs under
 * test_json/e2e/, the health check) reads the server's address from here, so
 * a run can be pointed at another server with `TEST_PORT` (or `npm test --
 * --port=NNNN`). The use case is a git WORKTREE: it serves itself on its own
 * port, and `npm test` run inside it must drive THAT tree — until this module
 * existed, port 8000 was spelled in five files and a worktree run silently
 * tested whatever the primary tree's server happened to serve.
 *
 * The host stays `localhost` on purpose: the frontend's bundled-vs-live mode
 * is keyed on the hostname (a non-localhost host loads the stale bundle.js).
 *
 * The Python drivers under scripts/test/ read the same variable through
 * scripts/lib/test_utils.py (`test_port()`), so one `TEST_PORT` in the
 * environment reaches both halves.
 */

export const DEFAULT_TEST_PORT = 8000;

/**
 * Read the port from an environment (default: process.env). Unset or empty
 * means the default; anything that is not an integer port is refused by name,
 * because a mistyped port must not quietly fall back to a server that belongs
 * to somebody else.
 */
export function resolveTestPort(env = process.env) {
  const raw = env.TEST_PORT;
  if (raw === undefined || raw === '') return DEFAULT_TEST_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`TEST_PORT must be an integer in 1..65535, got ${JSON.stringify(raw)}`);
  }
  return port;
}

export const TEST_PORT = resolveTestPort();
export const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
export const TEST_FRONTEND_URL = `${TEST_BASE_URL}/frontend/`;
/** The command that serves the repo root on TEST_PORT (what the remedies print). */
export const SERVER_COMMAND = `python -m http.server ${TEST_PORT}`;

/**
 * The frontend FLAVOUR a run drives. `unbundled` (the default) loads the ES
 * modules straight from the tree; `bundled` loads `frontend/dist/bundle.js`
 * through `?bundled=true` — the flavour a deployed site serves first
 * (frontend/index.html). They boot in a different order (bundled pre-imports
 * every module and test case), which is exactly why a run must say which one
 * it measured: trap 1426's overlapped rows existed only in the bundled one.
 * Set by `npm test -- --bundled` through `TEST_BUNDLED=1`.
 */
export const TEST_FLAVOURS = Object.freeze(['unbundled', 'bundled']);

export function resolveTestFlavour(env = process.env) {
  const raw = env.TEST_BUNDLED;
  if (raw === undefined || raw === '' || raw === '0') return 'unbundled';
  if (raw === '1') return 'bundled';
  throw new Error(`TEST_BUNDLED must be 1 or 0 (or unset), got ${JSON.stringify(raw)}`);
}

export const TEST_FLAVOUR = resolveTestFlavour();

/** The page-URL parameter that selects a flavour (frontend/index.html reads it). */
export function flavourUrlParam(flavour) {
  if (!TEST_FLAVOURS.includes(flavour)) {
    throw new Error(`unknown flavour ${JSON.stringify(flavour)} — one of ${TEST_FLAVOURS.join(', ')}`);
  }
  return flavour === 'bundled' ? '&bundled=true' : '';
}
