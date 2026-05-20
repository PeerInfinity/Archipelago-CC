# External Iframe/Window Module Loading — Plan

**Date:** 2026-05-20
**Status:** Partial — Phases 1–4 complete (2026-05-20)

## Overview

This plan covers two related goals for the external-module feature (`iframePanel`
and the parallel `windowPanel`):

1. **Security hardening** of the existing iframe/window loading path.
2. **Cross-origin remote loading** — loading modules from external URLs (e.g.
   GitHub Pages), not just the same-origin `./modules/...` pages registered today.

Both the iframe variant (`iframePanel` / `iframeAdapter` / `knownIframePages`)
and the window variant (`windowPanel` / `windowAdapter` / `knownWindowPages`)
are in scope — they are parallel implementations with the same gaps.

## Trust Model

The feature is for **cooperating modules the user has chosen to trust**:

- The user only loads modules they would trust enough to run directly. The
  feature is not designed to safely run arbitrary hostile content.
- Loaded modules must implement the `iframeAdapter` protocol (the `adapterClient`
  handshake) — non-cooperating pages are out of scope.
- The `sandbox` attribute is therefore **defense-in-depth / accident
  containment**, not a malice boundary. It limits the blast radius of bugs
  (stray top-navigation, popups, etc.), not deliberate attacks.

Custom free-text URL entry stays enabled but is gated behind a risk warning;
the `?iframe=` URL parameter is restricted to local development hosts (see
*Phase 3: URL-entry hardening*).

## Current State

### What exists

- **`iframePanel`** (`iframePanelUI.js:226`) — creates the iframe element with
  **no `sandbox` attribute**. The code comment ("not needed since iframe
  content is trusted and same-origin") is outdated — custom URLs already allow
  non-same-origin content.
- **`iframePanel/index.js:49`** — registers a `defaultSandbox` setting
  (default `'allow-scripts allow-same-origin allow-forms'`) that the UI no
  longer applies. Vestigial.
- **`iframeManagerPanel`** — management UI; free-text URL input, `allowCustomUrls:
  true` by default.
- **`knownIframePages`** — 3 entries (Iframe Base, A-Mazing-Idle, JTA), all
  same-origin `./modules/...` paths today.
- **`?iframe=<shortname-or-URL>`** — `initialization/index.js:591` resolves a URL
  parameter via `resolveIframeUrl` and auto-loads it.
- **`iframeAdapterCore`** — host-side `postMessage` handler. No `event.origin`
  validation; inbound messages are accepted on `iframeId` match alone.
- **`windowPanel` / `windowAdapter` / `knownWindowPages`** — full parallel
  implementation with the same shape and the same gaps.

### Gaps

- External iframes get no `sandbox` attribute at all.
- The `defaultSandbox` setting is dead config.
- No inbound `event.origin` validation in `iframeAdapterCore` / `windowAdapterCore`.
- Outbound `postMessage` origin handling is not audited for cross-origin targets.
- "Trusted and same-origin" comments are factually wrong post-custom-URLs.

## Key Constraints

### ESM loading and opaque origins

A `sandbox` without `allow-same-origin` gives the document an **opaque origin**.
ES module scripts (`<script type="module">` and their `import`s) are fetched in
CORS mode, and an opaque-origin document cannot CORS-fetch its own module graph
without CORS headers. Verified 2026-05-20 on the substrate iframe: dropping
`allow-same-origin` fails with *"Module source URI is not allowed in this
document"*.

**Consequence:** any module that loads an ES module graph needs
`allow-scripts allow-same-origin`. The browser's "can escape its sandboxing"
warning for that combination is unavoidable and is accepted under the trust
model.

### GitHub Pages same-origin reality

All project pages for one GitHub account share a single origin —
`https://peerinfinity.github.io/Archipelago-CC/` and
`https://peerinfinity.github.io/archipelago-textadventure-engine/` are the
**same origin**, different paths. So loading PeerInfinity-hosted remote modules
from GitHub Pages is *same-origin* loading: no CORS concerns, but also no
browser-enforced isolation from the host.

**True cross-origin** means a different domain (another user's `*.github.io`, or
a custom domain). Only that case gets browser origin-isolation from the host —
and such a module still needs `allow-same-origin` to load its own ESM graph
(same-origin to *itself*), which is safe because it cannot reach the host's DOM.

### postMessage across origins

The `adapterClient` handshake is `postMessage`-based and works across origins.
Outbound sends should use an explicit `targetOrigin` (not `'*'`) once the
loaded origin is known; inbound handlers should validate `event.origin`.

## Design

### Sandbox policy

- Apply `sandbox` to all external module iframes/windows. Recommended value:
  the existing `defaultSandbox` default (`'allow-scripts allow-same-origin
  allow-forms'`) — **wire up the existing setting** rather than removing it, so
  the policy stays configurable per deployment.
- `allow-same-origin` is required (ESM loading). `allow-scripts` is required.
  Additional tokens (`allow-popups`, `allow-modals`, `allow-downloads`) are
  added only if a specific module needs them; the configurable setting covers
  this.
- Accept the "can escape sandboxing" warning for same-origin modules — it is
  inherent to the required flag combination and benign under the trust model.

### Origin validation

- Track the **expected origin** per loaded iframe/window (derived from the
  resolved URL).
- `iframeAdapterCore` / `windowAdapterCore`: validate inbound `event.origin`
  against the expected origin; ignore mismatches.
- Outbound `postMessage`: use the expected origin as `targetOrigin` instead of
  `'*'` once known.
- This is low-stakes for same-origin modules but is real defense-in-depth for
  true cross-origin modules and cheap to add.

### Cross-origin remote loading

- `resolveIframeUrl` already passes through absolute URLs, so loading an
  external URL "works" mechanically today. The plan's job is to make the
  *adapter handshake* reliable cross-origin and document the path.
- Distinguish the two cases explicitly in code and docs:
  - **Same-origin remote** (PeerInfinity GitHub Pages, different path) — common
    case; no CORS issues.
  - **True cross-origin remote** (different domain) — needs origin validation
    and explicit `targetOrigin`; the module's own ESM loads fine (same-origin
    to itself) given `allow-same-origin`.
- Define how an external module is registered: an entry in `knownIframePages` /
  `knownWindowPages` with an absolute URL, or loaded ad hoc via custom URL /
  `?iframe=`.

## Alternatives Considered

### Hard sandboxing via non-ES-module packaging — rejected

A `sandbox` without `allow-same-origin` would give real isolation from the host
(a buggy module could not reach the host's DOM, cookies, or storage) and would
remove the "can escape its sandboxing" browser warning entirely. The blocker is
that ES module scripts are CORS-fetched, and an opaque-origin document cannot
load its own module graph (see *Key Constraints — ESM loading and opaque
origins*).

That blocker is technically avoidable: classic (non-module) scripts are fetched
no-cors, so an opaque-origin iframe *can* load one. Packaging each module's
whole graph as a single classic IIFE script (`esbuild --format=iife`) would let
the iframe run as `sandbox="allow-scripts"` only — a hard sandbox with genuine
host isolation.

This was considered and **rejected**. Given the trust model — loaded modules are
user-vetted, so the sandbox is accident containment, not a malice boundary — the
costs outweigh the benefit:

1. **Packaging contract.** Every external module would have to ship as an IIFE
   bundle: no `import.meta`, no dynamic `import()`, no module workers. This
   constrains how every module is authored and built, project-wide.
2. **No direct storage.** An opaque-origin iframe cannot use `localStorage` or
   IndexedDB at all (SecurityError). Any module that persists state directly
   would have to route persistence through the host adapter — an architectural
   change to every storage-using module, not just a build change.
3. **Weaker origin validation.** A hard-sandboxed iframe posts messages as
   origin `"null"`, which undercuts the Phase 2 inbound-origin validation.

**Decision (2026-05-20):** keep ES modules and the soft-sandbox approach
(`allow-scripts allow-same-origin`). The hard-sandbox isolation is not worth a
project-wide packaging contract plus a persistence-routing rewrite, given that
loaded modules are already trusted by the user. The residual "escape
sandboxing" warning is accepted (see *Design — Sandbox policy*).

## Implementation Plan

### Phase 1: Sandbox hardening — ✅ complete (2026-05-20)

- [x] Wire up the `defaultSandbox` setting in `iframePanelUI.js` (apply it to
      the created iframe element). Read via
      `settingsManager.getSetting('moduleSettings.iframePanel.defaultSandbox', …)`
      in the constructor, seeded with a `DEFAULT_SANDBOX` fallback, applied as
      the `sandbox` attribute in `loadIframe`.
- [x] Window variant: confirmed the separate-window path **cannot be
      sandboxed**. `window.open()` has no `sandbox`-equivalent feature; the
      only isolation tokens (`noopener`/`noreferrer`) sever `window.opener` in
      both directions, which breaks the windowAdapter handshake — the host
      loses the returned window ref it needs for `postMessage`/close-polling/
      `.close()`, and `adapterClient` (window mode) loses the `window.opener`
      transport it posts back on. COOP would also sever the relationship and
      is host-wide, not per-window. Decision (confirmed with user 2026-05-20):
      document the limitation in code + this plan, and wire up the
      previously-dead `defaultWindowFeatures` setting (parallel cleanup to
      `defaultSandbox`) — explicitly window *geometry*, not a security control.
      Origin validation (Phase 2) is the only hardening the window variant gets.
- [x] Replace the outdated "trusted and same-origin" comments with an accurate
      note referencing the trust model.

### Phase 2: Origin validation — ✅ complete (2026-05-20)

- [x] Track expected origin per connection in `iframeAdapterCore`. Added an
      `expectedOrigins` Map plus a public `setExpectedOrigin(iframeId, origin)`;
      `iframePanelUI.loadIframe` derives the origin from the resolved URL via
      `new URL(url, location.href).origin` and registers it before setting
      `iframe.src`. Cleared in `unregisterIframe`.
- [x] Validate inbound `event.origin`; drop mismatches with a logged warning.
      `handlePostMessage` compares `event.origin` against the expected origin.
      Synthetic relay events from `iframePanelUI` (`{ source, data }`, no
      `origin`) skip the check — they are already trusted (the panel matched
      `event.source` to its own iframe). Fail-open when no expected origin is
      known (malformed URL).
- [x] Use explicit `targetOrigin` for outbound `postMessage`. Added
      `_targetOrigin(iframeId)` (expected origin, or `'*'` fallback); threaded
      it through all 11 `safePostMessage` call sites.
- [x] Mirror all of the above in `windowAdapterCore` / `windowPanelUI`
      (keyed on `windowId`, derived in `openWindow`).

> **Phase 4 note found during implementation:** `adapterClient.js`
> `sendToParent` posts back to the host with `window.location.origin` as the
> `targetOrigin` — the *module's own* origin, correct only for same-origin
> modules. ✅ Fixed in Phase 4 via the `hostOrigin` URL param.

### Phase 3: URL-entry hardening — ✅ complete (2026-05-20)

- [x] Add a dev-host allowlist (`localhost`, `127.0.0.1`, `[::1]`, `::1`).
      `app/initialization/index.js` gains an `isDevHost()` check; the
      `?iframe=` / `?useWindow=` URL parameters are nulled (with a logged
      warning) on any non-dev host. The `iframeAutoLoad` mode setting is a
      deployment-controlled config and is deliberately **not** gated — only
      the URL parameters are.
- [x] Keep custom in-app URL entry enabled, but gate non-known URLs behind an
      acknowledged risk warning. New shared modal
      `modules/shared/customUrlWarning.js` (`confirmCustomUrlLoad`): shown on
      every custom-URL load, with a "Don't show this warning again" checkbox
      that persists suppression to `localStorage`
      (`externalModule.customUrlWarning.suppressed`). "Known" is decided by
      new `isKnownIframePage` / `isKnownWindowPage` helpers (shortname or
      exact known-URL match).
- [x] Apply the same dev-host gating (one shared `?iframe=`/`?useWindow=`
      gate) and risk warning to the window variant (`windowManagerPanel`
      `handleOpenClick`, now async like `iframeManagerPanel.handleLoadClick`).

### Phase 4: Cross-origin / external-URL remote loading — ✅ complete (2026-05-20)

- [x] Audit the `adapterClient` ↔ `iframeAdapterCore` handshake for cross-origin
      correctness. **Found one real bug:** `adapterClient.sendToParent` posted
      with `window.location.origin` as `targetOrigin` — the *module's own*
      origin. For a cross-origin module that does not equal the host's origin,
      so the browser silently drops the message (no exception — the existing
      `catch`/`'*'` fallback never fired). **Fix:** the host panels append a
      `hostOrigin` URL param; `adapterClient` reads it (`detectContext`) and
      targets outbound `postMessage` at it. As a fallback for loads without
      the param, the client also learns the host origin from the first inbound
      message. The `?iframeId=` param, READY messages and snapshot request are
      otherwise cross-origin-correct as-is (`window.parent` is a valid
      cross-origin postMessage target; query params survive).
- [x] Test loading a module from a genuine external URL end-to-end. Verified
      with a Playwright script: app served at `http://localhost:8000`, module
      loaded from `http://127.0.0.1:8000` — a genuine different origin on the
      same dev server. The cross-origin `iframe-base` module completed the
      adapter handshake (reached `connected`). A negative test (baseline
      `adapterClient.js` stashed back in) confirmed the fix is necessary — the
      cross-origin handshake fails without it while same-origin still works.
      The one-off script was not kept (a permanent CI test would need a
      second-origin server; out of scope).
- [x] Document how to register an external-URL module — added a how-to comment
      block to `knownIframePages.js` / `knownWindowPages.js` (absolute `url`
      entry; same-origin-remote vs true-cross-origin-remote distinction).

### Phase 5: Cleanup and documentation

- [ ] Remove any remaining vestigial sandbox config once the real setting is
      wired up.
- [ ] Document the trust model and sandbox policy in module/developer docs.

## Open Questions / Accepted Risks

- **Custom-URL warning frequency.** ✅ Resolved (2026-05-20). The warning is
  shown on *every* custom-URL load, but the modal carries a "Don't show this
  warning again" checkbox that persists suppression to `localStorage`.
- **Window-variant sandboxing.** ✅ Resolved (2026-05-20). The separate-window
  path cannot be sandboxed at all — `noopener`/`noreferrer`/COOP all break the
  windowAdapter handshake (see Phase 1). Documented as a known limitation;
  origin validation (Phase 2) is the only hardening windows receive.
- **Extra sandbox tokens.** Whether cooperating modules need `allow-popups` /
  `allow-modals` / `allow-downloads` is per-module and TBD; the configurable
  setting accommodates it.

## References

- `frontend/modules/iframePanel/iframePanelUI.js` — iframe creation
- `frontend/modules/iframePanel/index.js` — `defaultSandbox` setting
- `frontend/modules/iframeAdapter/iframeAdapterCore.js` — host-side adapter
- `frontend/app/config/knownIframePages.js` — `resolveIframeUrl`, known pages
- `frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperPanel.js`
  — substrate iframe sandbox (verified `allow-same-origin` requirement)
- `CC/docs/plans/a-mazing-idle-iframe-integration.md` — prior iframe-integration plan
