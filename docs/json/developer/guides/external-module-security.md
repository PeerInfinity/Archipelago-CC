# External Module Security

This guide covers the trust model and security hardening for the **external
module** feature — loading third-party web content into the app through the
`iframePanel` (embedded `<iframe>`) and `windowPanel` (separate browser window)
panels, bridged to the app by the `iframeAdapter` / `windowAdapter`.

It is the developer-facing summary of the design in
[`CC/docs/plans/completed/external-iframe-modules.md`](../../../../CC/docs/plans/completed/external-iframe-modules.md).

## Trust model

The feature is for **cooperating modules the user has chosen to trust**:

- The user only loads modules they would trust enough to run directly. The
  feature is **not** designed to safely run arbitrary hostile content.
- A loaded module must implement the adapter protocol (the `AdapterClient`
  handshake) to interact with the app — non-cooperating pages are out of scope.
- The iframe `sandbox` attribute is therefore **defense-in-depth / accident
  containment**, not a malice boundary. It limits the blast radius of bugs
  (stray top-navigation, popups, etc.), not deliberate attacks.

## Sandbox policy (iframe variant)

`iframePanel` applies a `sandbox` attribute to every loaded module iframe. The
value comes from the `iframePanel.defaultSandbox` module setting, default:

```
allow-scripts allow-same-origin allow-forms
```

- `allow-scripts` is required — the module cannot run otherwise.
- `allow-same-origin` is required because the module loads its own **ES module
  graph**. `<script type="module">` and its `import`s are fetched in CORS mode;
  an opaque-origin (sandboxed-without-`allow-same-origin`) document cannot fetch
  its own module graph. Verified: dropping `allow-same-origin` fails with
  *"Module source URI is not allowed in this document"*.
- The browser's *"An iframe which has both allow-scripts and allow-same-origin
  ... can escape its sandboxing"* console warning is **unavoidable** with this
  flag combination and is **accepted** under the trust model.
- Extra tokens (`allow-popups`, `allow-modals`, `allow-downloads`) are added per
  deployment by changing the setting, only if a specific module needs them.

A hard sandbox (`allow-scripts` only, no `allow-same-origin`) was considered and
**rejected** — it would require packaging every module as a classic IIFE bundle
and routing all persistence through the host adapter. See the plan doc's
*Alternatives Considered* section.

### Window variant cannot be sandboxed

The separate-window path (`windowPanel`) **cannot** be sandboxed. `window.open()`
has no `sandbox`-equivalent feature, and the only isolation tokens
(`noopener` / `noreferrer`) — like a `same-origin` COOP header — sever
`window.opener` in both directions, which breaks the `windowAdapter` handshake
(the host loses the window reference it needs; the module loses the
`window.opener` transport). A same-origin popup therefore has full host access
via `window.opener`. The `windowPanel.defaultWindowFeatures` setting is window
*geometry* only — not a security control. Prefer the iframe variant for
anything less than fully trusted.

## Origin validation

`iframeAdapterCore` / `windowAdapterCore` track an **expected origin** per
connection, derived from the resolved load URL by the host panel:

- **Inbound:** incoming `postMessage` events are validated — `event.origin` must
  match the expected origin, or the message is dropped with a logged warning.
  (Internal synthetic relays carry no origin and skip the check.)
- **Outbound:** the adapter targets `postMessage` at the expected origin instead
  of `'*'`.
- **`hostOrigin` param:** the host panel passes its own origin to the module via
  a `hostOrigin` URL parameter. `AdapterClient` uses it as the `targetOrigin`
  for messages back to the host — necessary because a cross-origin module's
  `window.location.origin` is its *own* origin, not the host's, and a mismatched
  `targetOrigin` makes the browser silently drop the message.

## URL-entry hardening

- **`?iframe=` / `?useWindow=` are dev-host only.** These URL parameters are a
  local-testing affordance, honored only when the app is served from
  `localhost`, `127.0.0.1`, or `[::1]`. On any other host they are ignored with
  a logged warning — fail-safe for every production host without per-host
  config. The `iframeAutoLoad` mode *setting* is deployment config and is not
  gated.
- **Custom-URL risk warning.** Custom free-text URL entry in the Iframe/Window
  Manager stays enabled, but loading a URL that is not a known page
  (`knownIframePages` / `knownWindowPages`) is gated behind an acknowledged
  warning modal. The warning shows on every custom-URL load unless the user
  ticks "Don't show this warning again" (persisted to `localStorage`).

## Cross-origin remote loading

A module URL may be a relative path (same-origin) or an absolute URL to a remote
module. Two remote cases:

- **Same-origin remote** — a different path on the app's own origin. All project
  pages for one GitHub account share a single origin, so a PeerInfinity-hosted
  module on GitHub Pages is *same-origin* to the host: no CORS concerns, but also
  no browser-enforced isolation from the host.
- **True cross-origin remote** — a different domain (another account's
  `*.github.io`, or a custom domain). Browser-isolated from the host. The module
  still loads its own ES module graph fine (it is same-origin to *itself*, given
  `allow-same-origin`), and the adapter handshake works cross-origin thanks to
  the `hostOrigin` param.

### Registering an external-URL module

Add an entry with an absolute `url` to `knownIframePages.js` or
`knownWindowPages.js`:

```js
{
  name: "Example Remote",
  url: "https://example.github.io/my-module/index-iframe.html",
  description: "An external module",
  shortName: "exampleremote"
}
```

A registered entry loads without the custom-URL warning. Ad-hoc URLs typed into
the manager panel are treated as custom and warn first.

## Key files

| Concern | File |
|---------|------|
| Iframe sandbox application | `frontend/modules/iframePanel/iframePanelUI.js` |
| Window features (geometry) | `frontend/modules/windowPanel/windowPanelUI.js` |
| Inbound/outbound origin validation | `frontend/modules/iframeAdapter/iframeAdapterCore.js`, `frontend/modules/windowAdapter/windowAdapterCore.js` |
| `hostOrigin` handling | `frontend/modules/shared/adapterClient.js` |
| Dev-host gating | `frontend/app/initialization/index.js` (`isDevHost`) |
| Custom-URL warning modal | `frontend/modules/shared/customUrlWarning.js` |
| Known-page registry | `frontend/app/config/knownIframePages.js`, `knownWindowPages.js` |

## See Also

- [URL Parameters](../reference/url-parameters.md) — `iframe`, `useWindow`, `hostOrigin`
- Plan: [`CC/docs/plans/completed/external-iframe-modules.md`](../../../../CC/docs/plans/completed/external-iframe-modules.md)
