# `procgenLabPanel` — the frontend hosts the substrate lab pages

A Golden Layout panel that mounts ONE procgen substrate's **standalone lab
page** in an iframe and talks to it over the existing `iframeAdapter` bridge.

| substrate | the page it hosts | standalone URL |
|---|---|---|
| `maze` | `frontend/modules/mazeRoom/lab.html` | `…/frontend/modules/mazeRoom/lab.html?seed=3&count=4&run=1` |
| `seedling` | `frontend/modules/seedlingDemo/watch.html` | `…/frontend/modules/seedlingDemo/watch.html?source=generate&seed=3` |

⛔ **This module owns no page.** Both lab pages are complete standalone
documents that work with no host at all, and they stay that way: the in-page
bridge (`mazeRoom/mazeLabBridge.js`, `seedlingDemo/watchBridge.js`) is
**dynamically imported, and only when `?iframeId=` is in the URL** — a
standalone load never fetches it. That is measured, not asserted:
`scripts/procgen/check-procgen-lab-hosting.mjs` claim 9 watches the network.

⚖ Constructive-mode arc, slice 4 —
`NewDocs/plans/seedling-constructive-mode-kickoff.md` §3.5, ruling 6 (*"the
iframe is the way to keep the layout consistent between the two modes"*).
Layout consistency between hosted and standalone is free here because it is
**the same document**.

## The vocabulary lives in ONE file

`frontend/modules/procgenCore/labProtocol.js` — event names, payload shapes as
frozen field lists, and one `assert*` validator per event. Imported by both
bridges AND by this panel, so there is no second spelling of any field.

| direction | event | payload |
|---|---|---|
| host → page | `procgenLab:load` | `{substrate, iframeId, payload}` |
| host → page | `procgenLab:navigate` | `{substrate, iframeId, search}` |
| host → page | `procgenLab:requestState` | `{substrate, iframeId}` |
| page → host | `procgenLab:ready` | `{substrate, iframeId, url}` |
| page → host | `procgenLab:stateChanged` | `{substrate, iframeId, url, source, seed, step, identity, certified, edits, directives}` |
| page → host | `procgenLab:levelChanged` | `{substrate, iframeId, payload}` |
| page → host | `procgenLab:selectTile` | `{substrate, iframeId, tx, ty}` |
| page → host | `procgenLab:openInApworldEditor` | `{substrate, iframeId, rules, source}` |

They are ordinary eventBus events carried over the adapter's existing
`SUBSCRIBE_EVENT_BUS`/`PUBLISH_EVENT_BUS` — ⛔ **no new `MessageTypes`**, so
`shared/communicationProtocol.js` (and the `shared` submodule) is untouched.

**Every payload carries `{substrate, iframeId}`.** Two panels can be open at
once and they share one bus: the adapter forwards a host publish to EVERY
subscribed iframe, and an iframe publish reaches EVERY host subscriber. The
`iframeId` is the address; `labProtocol.addressedTo` is the one routing
predicate.

**The eighth name is the only one that asks the app to DO something** (APWorld
editor hub, H4c). The other seven are a host driving a page and a page reporting
what it shows; `procgenLab:openInApworldEditor` carries the document the page
itself compiled and asks for the APWorld Editor to be opened on it. It is a
lab-protocol name rather than a direct publish because a lab page has no app
`eventBus` at all — `apworldEditor:loadRules` exists only on the host side of the
iframe boundary, and this vocabulary is the one transport across it. The panel
FORWARDS it (`apworldEditor:loadRules`, then `ui:activatePanel`) and does not
interpret it; `source` is the PAGE's own word for where the document came from,
and the hub files the session under it. Both are registered publishers of this
module — the bus drops an unregistered publisher with a warn line and no throw.

⚠ `certified` is `true` / `false` / **`null`**. `null` is *"nobody has asked"*
and `false` is *"the oracle said no"* — different facts, kept apart end to end
(the panel prints `CERTIFIED` / `UNCERTIFIED` / `CERTIFIED?`).

## The resend, and why it is not optional

`eventBus` has no replay, and `publish` returns early when an event has no
subscribers at all. A `load` sent before the frame's bridge has subscribed
reaches nobody and leaves no trace. So the panel **queues** a `load`/`navigate`
issued while disconnected and flushes it on `iframe:appReady` (and on
`procgenLab:ready`, which also covers a frame that reloaded). The queue is
one-deep per verb and the last send wins; `navigate` flushes before `load`.

This is `architecture_init_event_races`' mechanism 2 (re-publish on ready) —
not a third catch-up.

## The panel's v1 UI

A status line (`connected · <the page's own identity line> · CERTIFIED? ·
N edit(s)`), an **open standalone** link — the frame's *current* URL minus
`iframeId`/`hostOrigin`, read off the last `stateChanged` rather than off the
initial `src` — and a payload textarea with **SEND** (`load`) and **TAKE** (the
last `levelChanged`).

## The ROOM-EDITOR DOOR (editor integration, W3)

`labRoomEditor.js` beside this file is the host half of the **room-editor
contract** (`NewDocs/plans/editor-integration.md` §3.2, §9): a substrate whose
registry entry declares `roomEditor: {kind: 'lab', page, arm}` gets an
`Edit ▸`-shaped door with **no second editor written**, because the door is the
lab page this panel already hosts. Three moves, and **not one new
`procgenLab:` name or field**:

1. a SET document in over `load` — each page sniffs it through the ONE
   classifier it already has, so it lands on that page's SET arm;
2. ONE room over `navigate` with the page's own `?source=<arm>&room=<n>`;
3. the folded document back out over `levelChanged`, whose payload is a
   `procgenCore/labRoomEnvelope` (`{kind:'set-record', substrate, room, record}`)
   for as long as a SET arm holds a session. `onSave` fires on that envelope's
   `room` going *n* → `null` — the CLOSE as a **transition**, never a count of
   edits, because a close that folds a no-op room session moves no count at all.

⛔ **`ui:activatePanel` CANNOT REACH ONE OF TWO LAB PANELS.** It matches on
`componentType` and both instances are `procgenLabPanel`, so it can only ever
raise the first — measured, and recorded in `check-procgen-lab-hosting.mjs`.
Hence two things here: `ProcgenLabPanelUI.raise()` goes through Golden Layout's
own API on the item CONTAINING *this* instance's root (with the event kept as a
fallback), and `labRoomEditor` holds an INSTANCE registry the panel writes
itself into per MOUNT and drops in `destroy()` — a remount that kept the old
entry would hand a caller an iframe that is already `about:blank`.

⚠ It is not cosmetic: Golden Layout hides a non-active stack member with
`display: none`, and `getBoundingClientRect()` on a hidden element is all
zeros — an unraised lab is a canvas the page itself refuses to map a click onto.

`levelChanged` therefore has TWO consumers now: this panel's TAKE box, and
`labRoomEditor`'s wait for the room transition.

## Registering it (the three places)

1. `frontend/module-configs/modules.json` — `moduleDefinitions` **and**
   `loadPriority`.
2. `frontend/layout-configs/layout_presets.json` — two entries in the default
   preset's stack, each with `"componentState": {"substrate": "maze"|"seedling"}`.
3. `frontend/app/core/moduleMetadata.js` — the mobile/fallback `{title, icon,
   name, column}`.

Plus `frontend/init-bundled.js` (`__BUNDLED_MODULES__` + the static import) —
a module enabled in `modules.json` but missing there gets dynamically imported
in bundled mode and duplicates every singleton
(`reference_bundled_modules_registration`).

## Gates

```bash
npx vitest run frontend/modules/procgenLabPanel frontend/modules/procgenCore/labProtocol.test.js \
                frontend/modules/procgenCore/labRoomEnvelope.test.js
node scripts/procgen/check-procgen-lab-hosting.mjs      # boots the frontend, both frames
```

The vitest rows gate registration, addressing, validation, the status
sentence, "open standalone" and the resend, against a minimal DOM stand-in.
They do **not** gate that an iframe loads, that the adapter forwards anything,
or that a page reconstructs a level — the browser row is the instrument for
those.
