# Storage Panel

The Storage panel lists every key this site keeps in your browser's local storage. For each key it shows which part of the app owns it, what kind of data it is and how big it is. It lets you clear what you no longer need. It sits next to the JSON panel.

Browsers give each site a fixed amount of local storage: about **5,242,880 characters** (keys plus values) in Chrome and Edge. When that is full, saving fails. The app then shows a banner across the top of the page. The banner names what could not be saved and offers to open this panel.

## The header

**"N keys · X of 5,242,880 chars (Y %)"** — how many keys there are, and how much of the quota they use. **Refresh** reads the storage again. Other panels keep saving while this one is open, so press it to see their latest sizes.

⚠ **The quota belongs to the site address, not to the app.** `localhost:8000`, `localhost:8130` and the published site each have their own storage and their own quota. The panel shows the storage of the address you opened it on.

## The sections

Each section lists its keys grouped by the part of the app that owns them. The largest keys come first. Every row shows the key, what it is, its size in characters and its share of the quota.

| Section | What is in it | Section button |
|---|---|---|
| **Unknown — no owner declared** | Keys no part of the app says it writes. Most are left by older versions of the app. Some are written by pages outside the app, or by a game the app does not know (for example Cavernous, when opened as a standalone page). The app as it is now does not read any of them. | **Clear all unknown keys** |
| **Your data** | Things you made: game saves (Idle Loops, Journey to Ascension, Seedling), your saved queues, your pipeline presets, captured regions, JtA loadouts. | none — clear these one row at a time; each row has a **Download** button to keep a copy first |
| **Settings and panel state** | Your saved settings for each mode, the last active mode, and each panel's remembered view (filters, folded sections, parameters). Clearing one returns it to its default. | **Clear all state** |
| **Caches** | Results the app can compute again, such as JtA balance patches (one per seed). | **Clear all caches** |

The Unknown section comes first because that is where space usually goes missing. When this panel was built, about 90 % of one user's storage was held by old Path Analyzer results that no current code reads.

## Clearing

- **Clear** on a row removes that one key.
- A section's button removes every key in that section.
- **Clear all saved modes** (in *Settings and panel state*, under JSON) removes every mode's saved settings and the last active mode. The next plain address then opens the `default` mode from its shipped files. This is wider than the JSON panel's **Reset Default Mode**, which clears only the `default` mode.

Every clear asks first, saying how many keys and how many characters it will remove. A clear cannot be undone.

## Lab sets (the document library)

The sets you make in the Procgen Lab are kept in a separate browser database, `archipelago-cc-document-library`, not in local storage. The panel shows it under **Your data**, in the *Procgen Lab* group. If nothing has been saved yet, the line says so, and the panel does not create the database.

- **The status line** shows two different sizes:
  - **bytes of saved documents** is the library's own stored text;
  - **this site's whole browser storage (estimate)** is the browser's own figure for everything this site stores, including other databases and caches.

  It also says whether the browser has made the storage persistent (**granted**) or may remove it when space runs low (**best-effort**).
- **One row per set**, showing its name, how many numbered versions and drafts it has, and its size.
- **Clear** on a row removes that set, with all its versions and drafts. It asks first. A set that something is using, such as a running game or a loaded world in this tab or in any other open tab, is **not** cleared: the row says what is using it and in which tab.
- **Clear leftover drafts** removes every draft that nothing is using. A draft is the rolling copy an open lab tab keeps while you edit. A tab closed without saving leaves its draft behind. It asks first.
- **Drafts older than 7 days are cleared by themselves** each time the panel draws (opening it, or **Refresh**), unless something is using them. The panel says how many it cleared. Numbered versions are never cleared because of their age.

The page keeps whatever it has already loaded. If you clear the current mode's saved settings, this page still has them in memory, and the next setting you change is saved again. The removal takes effect when you reload.

## When the banner appears

The banner says *"Browser storage for this site is full … saving '&lt;key&gt;' needed N chars and was NOT saved. The largest keys: …"*.
1. Press **Open Storage panel**.
2. Look at **Unknown** first, then at the largest rows.
3. Clear what you do not need, then repeat what failed (for example, change the setting again).

**Dismiss** hides the banner until the next save that does not fit.

## For developers: declaring keys

The panel has no list of keys of its own. Each module declares the keys it writes in its `moduleInfo.storage`. A module that wraps a game also declares the game's keys.

```js
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';
export const moduleInfo = {
  // …
  storage: [
    { key: 'mazeRoom_params', kind: STORAGE_KINDS.state, label: 'Maze Room parameters' },
    { prefix: 'jtaBalance_patches_v1_', kind: STORAGE_KINDS.cache, label: 'Balance cost patches, one per seed' },
    { pattern: '/shrumsave$', kind: STORAGE_KINDS.user, label: 'Seedling save (Ruffle)' },
  ],
};
```

- Write one entry per line (a test reads them from the source).
- Use exactly one of `key`, `prefix`, `pattern` or `idb` in each entry. `idb` names an IndexedDB database, for example `{ idb: 'archipelago-cc-document-library', kind: STORAGE_KINDS.user, label: '…' }`. It is declared once, by the module that owns it (the document library is declared by `procgenLabPanel` for every writer).
- A family may add `clearAll` (the text of a button that clears the whole family) and `clearsWith` (extra keys that button also removes).

`frontend/modules/storagePanel/storageDeclarationPins.test.js` fails on a malformed entry, a key declared twice, or a declared key that no source file writes. A key a module writes but does not declare shows up under **Unknown**.

`storageCensus.test.js` also holds the IndexedDB names both ways. It fails when a source opens a database that is neither declared nor on its short allow-list (each allow-list entry has a reason), and when a declared database is opened nowhere.

A write that can fail should catch the error and call `reportStorageWriteFailure({ key, value, error, owner })` from `app/core/storageQuota.js`. That is what raises the banner. A document-library save that answers `{status: 'failed', why}` calls `reportLibraryWriteFailure({ why, bytes, owner, database })` instead. It raises the same banner for a full quota, and returns `null` for any other failure, which the caller reports itself.

## Appendix: the same table from the console

To list the largest keys without opening the panel, paste this into the browser's developer console on the app's own tab. It only reads:

```js
(()=>{const Q=5242880,r=Object.keys(localStorage).map(k=>({key:k,chars:k.length+localStorage.getItem(k).length})).sort((a,b)=>b.chars-a.chars),t=r.reduce((s,x)=>s+x.chars,0);r.forEach(x=>x.pctOfQuota=(100*x.chars/Q).toFixed(1)+'%');console.table(r.slice(0,30));console.log(`${location.origin}: ${r.length} keys, ${t} of ${Q} chars used (${(100*t/Q).toFixed(1)}%)`);})()
```
