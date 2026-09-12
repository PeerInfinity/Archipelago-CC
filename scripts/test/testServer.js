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
