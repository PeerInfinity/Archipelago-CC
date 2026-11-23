#!/usr/bin/env node
/**
 * check-seedling-lab-library — DOCUMENT LIBRARY B3: the Seedling lab saves into the document library by itself.
 * "Save points make versions; reload opens clean." (⚖ Robert Q1 "Save points", Q2 "Draft, marked won't play".)
 *
 * ── WHY A STANDALONE CHECK AND NOT AN IN-APP ROW ──────────────────────
 * The claims need a RELOAD (a fresh lab restores nothing), TWO tabs on one library (they fork and never overwrite),
 * a tab whose page goes HIDDEN, and the real hosted door-A press inside the procgen lab panel. The in-app runner
 * cannot reload the page it runs in; Playwright can do all four.
 *
 * ── ISOLATION (js-22 L1) ──────────────────────────────────────────────
 * Every part uses its OWN database, `archipelago-cc-document-library-test-lab-<run>-<part>`, through the page's
 * `?libraryDb=` seam. Each is asserted ABSENT at its start and deleted at the end (`onblocked` recorded), and the
 * end asserts none is still listed. The default `archipelago-cc-document-library` is never named here; a page under
 * automation without the seam writes a per-page-load `…-auto-<tab>` name instead (`watchLibraryCore.libraryDbNameOf`).
 *
 * ── THE PARTS ─────────────────────────────────────────────────────────
 *   0  a STANDALONE boot fetches no library module and creates no database (the writer is a dynamic import).
 *   1  HOSTED (the app's Seedling lab panel): vanilla 116 → an edit → a DRAFT; room CLOSE → v1; REPORT → v2; the
 *      BUNDLE → v3; the hand-over (door A) → v4. Each version's set fingerprint = the bundle's `level-set` member
 *      and the handed rules' `level_set.content_hash`; the rules and atlas members are the handed ones. After an
 *      edit: REPORT → v5, BUNDLE → v6, the new fingerprint is the new bundle's.
 *   2  RELOAD (the whole app): the lab opens CLEAN (no set held, no writer loaded); "Recent sets" lists the lineage
 *      at v6; Open → the same set, byte-equal to v6 (the page's own SET download of it); the next save continues
 *      that lineage with parent = v6.
 *   3  WON'T PLAY: two rooms given one name → REPORT saves a DRAFT marked won't-play, and no version.
 *   4  STORAGE FULL: a refused commit (`QuotaExceededError`) → "NOT saved — storage full" + the storage banner;
 *      the session and Download still work; the next save lands.
 *   5  TWO TABS on one version fork: v1 → tab A saves v2, tab B saves v3, both with parent v1, both kept.
 *   6  CLEARED: the lineage deleted behind the tab (the Storage panel's Clear) → the next save mints a new set and
 *      says "saved as a new set: the old one was cleared".
 *   7  HIDE (js-22 L4): an edit, the page hidden inside the debounce window, a reload → "Recent sets" has a draft
 *      with that edit. (Measured and NOT pinned, by ruling: closing the tab inside the window loses that draft.)
 *
 * Prereqs: none (it serves the repo root itself unless --host= is given).
 * Run: node scripts/procgen/check-seedling-lab-library.mjs [--host=http://localhost:8000]
 */
import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeServer, serveRepoRoot } from './serveRepoRoot.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../..');

async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-lab-library.mjs', kind: 'browser' });

    const { readBundle } = await import(join(REPO, 'frontend/modules/presets/documentBundle.js'));
    const { loadJSZipNode } = await import(join(REPO, 'scripts/procgen/loadJSZipNode.mjs'));
    const { levelSetContentHash } = await import(join(REPO, 'frontend/modules/procgenCore/levelSetReference.js'));
    const { computeContentHash, stableStringify } = await import(join(REPO, 'frontend/modules/procgenCore/contentIdentity.js'));
    const { DEFAULT_LIBRARY_DB_NAME, NO_ID_KEY } = await import(join(REPO, 'frontend/modules/procgenCore/documentLibrary.js'));

    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const host = arg('host', '');
    const server = host ? null : await serveRepoRoot();
    const base = host || `http://127.0.0.1:${server.address().port}`;
    const WATCH = `${base}/frontend/modules/seedlingDemo/watch.html`;

    const RUN = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const dbOf = (part) => `${DEFAULT_LIBRARY_DB_NAME}-test-lab-${RUN}-${part}`;
    const DBS = Object.freeze({
        hosted: dbOf('hosted'), wontPlay: dbOf('wontplay'), full: dbOf('full'), fork: dbOf('fork'),
        cleared: dbOf('cleared'), hide: dbOf('hide'),
    });

    let failed = 0;
    const json = (v) => JSON.stringify(v);
    const check = (ok, what, detail) => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed++;
    };

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    const errors = [];
    const watchErrors = (page, tag) => {
        page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
    };

    /* ── helpers (each takes a Page or a Frame) ─────────────────────── */
    const until = (target, fn, arg0, why, timeout = 180000) => target.waitForFunction(fn, arg0, { timeout })
        .catch((e) => { throw new Error(`STUCK waiting for ${why}: ${e.message.split('\n')[0]}`); });
    const dbListed = (target, name) => target.evaluate(async (n) => (await indexedDB.databases()).some((d) => d.name === n), name);
    const editReady = (target) => until(target, () => window.__editorEdit && window.__editorEdit.status !== 'loading', null, 'the EDIT arm');
    const loadVanilla = async (target) => {
        await target.evaluate(() => document.getElementById('editLoadVanilla').click());
        await until(target, () => window.__editorEdit?.set?.rooms === 116, null, 'the vanilla 116 to be held');
    };
    const saves = (target) => target.evaluate(() => window.__labLibrary?.saves?.length ?? 0);
    const press = async (target, id) => {
        const n = await saves(target);
        await target.evaluate((i) => document.getElementById(i).click(), id);
        await until(target, (k) => (window.__labLibrary?.saves?.length ?? 0) > k, n, `a library save after #${id}`);
        return target.evaluate(() => window.__labLibrary.saves.at(-1));
    };
    const edit = async (target) => {
        const n = await saves(target);
        await target.evaluate(() => document.getElementById('editSetAddRoom').click());
        await until(target, (k) => (window.__labLibrary?.saves?.length ?? 0) > k, n, 'the debounced draft after an edit', 30000);
        return target.evaluate(() => window.__labLibrary.saves.at(-1));
    };
    const statusOf = (target) => target.evaluate(() => document.getElementById('editLibraryStatus')?.textContent ?? '');
    const setOf = (s) => s?.members?.find((m) => m.role === 'set') ?? null;
    const roleHash = (s, role) => s?.members?.find((m) => m.role === role)?.content_hash ?? null;
    /** The library read in the page's own realm, by its own modules. */
    const libRead = (target, db, what) => target.evaluate(async ([name, w]) => {
        const L = await import(new URL('../procgenCore/documentLibrary.js', document.baseURI.replace(/[^/]*$/, '')).href);
        const I = await import(new URL('../procgenCore/documentLibraryIdb.js', document.baseURI.replace(/[^/]*$/, '')).href);
        const be = I.createIdbBackend({ dbName: name });
        const lib = L.createDocumentLibrary({ backend: be });
        try {
            if (w.kind === 'entries') return await lib.entriesOf(w.lineageId);
            if (w.kind === 'lineages') return await lib.lineages();
            if (w.kind === 'delete') return await lib.deleteLineage(w.lineageId);
            if (w.kind === 'get') return await lib.get(w.ref);
            return null;
        } finally { await be.close(); }
    }, [db, what]);
    const pressBundle = async (target) => {
        const n = await saves(target);
        const presses = await target.evaluate(() => window.__editorSetBundlePresses ?? 0);
        await target.evaluate(() => document.getElementById('editDownloadBundle').click());
        await until(target, (p) => (window.__editorSetBundlePresses ?? 0) > p && Array.isArray(window.__editorSetBundleKinds), presses, 'the bundle');
        await until(target, (k) => (window.__labLibrary?.saves?.length ?? 0) > k, n, 'a library save after the bundle');
        const bytes = await target.evaluate(() => Array.from(window.__editorSetBundleOut));
        const bundle = await readBundle(Uint8Array.from(bytes), { jszip: loadJSZipNode() });
        return { save: await target.evaluate(() => window.__labLibrary.saves.at(-1)), bundle };
    };
    const memberOf = (bundle, kind) => bundle.members.find((m) => m.kind === kind)?.doc ?? null;

    const finish = async () => {
        /* ── the per-run databases: deleted, and none still listed ── */
        for (const p of context.pages()) await p.close();
        const sweeper = await context.newPage();
        await sweeper.goto(`${WATCH}?source=edit&level=4`, { waitUntil: 'domcontentloaded' });
        const swept = await sweeper.evaluate(async (names) => {
            const out = {};
            for (const n of names) {
                out[n] = await new Promise((res) => {
                    let blocked = false;
                    const r = indexedDB.deleteDatabase(n);
                    r.onblocked = () => { blocked = true; };
                    r.onsuccess = () => res(blocked ? 'deleted-after-blocked' : 'deleted');
                    r.onerror = () => res(`error ${r.error?.name}`);
                });
            }
            const left = (await indexedDB.databases()).map((d) => d.name).filter((n) => names.includes(n));
            return { out, left };
        }, Object.values(DBS));
        console.log(`cleanup: ${json(swept.out)}`);
        check(swept.left.length === 0, 'cleanup: every per-run database is deleted and no longer listed', json(swept.left));
        check(errors.length === 0, 'no page errors in any page or frame', errors.slice(0, 3).join(' | '));
        await browser.close();
        if (server) await closeServer(server);
        console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
        process.exit(failed === 0 ? 0 : 1);
    };

    try {
        /* ══ 0 — a standalone boot fetches nothing new and creates nothing ══ */
        {
            const page = await context.newPage();
            watchErrors(page, 'standalone');
            const requested = [];
            page.on('request', (r) => requested.push(r.url()));
            await page.goto(`${WATCH}?source=edit&level=4&libraryDb=${DBS.hide}`, { waitUntil: 'domcontentloaded' });
            await editReady(page);
            await loadVanilla(page);
            const lib = requested.filter((u) => /watchLibrary|documentLibrary|storageQuota|quotaNotice/.test(u));
            check(lib.length === 0, '0 — a standalone boot and a LOAD fetch NO library module (the writer is imported at the first save)',
                `${requested.length} requests, library ones: ${json(lib)}`);
            const state = await page.evaluate(() => ({ readout: typeof window.__labLibrary, status: document.getElementById('editLibraryStatus')?.textContent }));
            check(state.readout === 'undefined' && state.status === '', '0 — …and no writer is running, and the status line is empty', json(state));
            for (const n of Object.values(DBS)) {
                check(!(await dbListed(page, n)), `0 — the per-run database is ABSENT at the start (${n.slice(-12)})`);
            }
            await page.close();
        }

        /* ══ 1 — HOSTED: the save points, door A included ══ */
        const app = await context.newPage();
        watchErrors(app, 'host');
        const bootApp = async () => {
            await app.goto(`${base}/frontend/index.html`, { waitUntil: 'domcontentloaded' });
            let seed = null;
            for (const deadline = Date.now() + 120000; Date.now() < deadline && !seed;) {
                seed = await app.evaluate(() => document.querySelector('.procgen-lab-root[data-substrate="seedling"]')?.dataset.iframeId ?? null)
                    .catch(() => null);
                if (!seed) await app.waitForTimeout(250);
            }
            if (!seed) throw new Error('STUCK: the Seedling lab panel never mounted');
            await until(app, () => Boolean(window.eventBus?.publish), null, 'the app bus');
            return seed;
        };
        /** ⛓ The frame gets the per-run database through the panel's own `procgenLab:navigate` (its address is kept). */
        const navigateTo = async (seed, db) => {
            for (const deadline = Date.now() + 120000; Date.now() < deadline;) {
                const frame = app.frames().find((f) => f.url().includes('watch.html'));
                if (frame) {
                    await app.evaluate(([id, d]) => window.eventBus.publish('procgenLab:navigate',
                        { substrate: 'seedling', iframeId: id, search: `source=edit&level=4&libraryDb=${d}` }, 'procgenLabPanel'), [seed, db]);
                    const ok = await frame.waitForFunction((d) => window.location.search.includes(`libraryDb=${d}`)
                        && window.__editorEdit && window.__editorEdit.status !== 'loading', db, { timeout: 15000 }).then(() => true).catch(() => false);
                    if (ok) return frame;
                }
                await app.waitForTimeout(500);
            }
            throw new Error('STUCK: the Seedling frame never took the navigate');
        };
        const raise = (seed) => app.evaluate((id) => {
            const gl = window.goldenLayoutInstance;
            const item = (gl?.getAllContentItems() ?? []).find((it) => it.isComponent
                && it.element?.querySelector?.(`.procgen-lab-root[data-iframe-id="${id}"]`));
            if (item?.parent?.isStack) item.parent.setActiveComponentItem(item);
        }, seed);

        let seed = await bootApp();
        await raise(seed);
        let frame = await navigateTo(seed, DBS.hosted);
        check(await frame.evaluate(() => typeof window.__labLibrary === 'undefined'), '1 — the hosted lab, navigated to its per-run database, has no writer yet');
        await loadVanilla(frame);

        const draft = await edit(frame);
        check(draft.status === 'saved' && draft.draft === true && draft.seq === null && draft.why === 'op',
            '1 — an EDIT (ADD ROOM) saves the tab\'s rolling DRAFT, not a version', json({ status: draft.status, draft: draft.draft, seq: draft.seq }));
        check(await statusOf(frame) === 'Draft saved', '1 — …and the status line says "Draft saved"', await statusOf(frame));
        check(await frame.evaluate(() => window.__labLibrary.transport) === 'worker', '1 — the saves run in the library WORKER (L3)');

        await frame.evaluate(() => {
            const sel = document.getElementById('editSetRoom');
            sel.value = '0';
            document.getElementById('editSetOpen').click();
        });
        await until(frame, () => !document.getElementById('editRoomClose').disabled, null, 'room 0 to open');
        const v1 = await press(frame, 'editRoomClose');
        const v2 = await press(frame, 'editSetReport');
        const b3 = await pressBundle(frame);
        const v3 = b3.save;
        await until(frame, () => { const b = document.getElementById('editOpenApworldEditor'); return b && !b.hidden && !b.disabled; },
            null, 'the hand-over button (hosted)');
        const v4 = await press(frame, 'editOpenApworldEditor');
        const handed = await frame.evaluate(() => window.__editorSetApworldOut);
        const vs = [v1, v2, v3, v4];
        check(vs.map((v) => [v.seq, v.savedBecause, v.draft]).every(([s, b, d], i) => s === i + 1 && d === false
            && b === ['room-close', 'report', 'download', 'handover'][i]),
        '1 — room CLOSE → v1, REPORT → v2, BUNDLE → v3, the HAND-OVER (door A) → v4, each a numbered version with its save point',
        json(vs.map((v) => [v.why, v.savedBecause, v.seq])));
        check(new Set(vs.map((v) => v.lineage_id)).size === 1 && v1.lineage_id === draft.lineage_id,
            '1 — …one lineage, minted at the session\'s first save (the draft)', v1.lineage_id);
        check(v1.parent === null && v2.parent === v1.entry_id && v3.parent === v2.entry_id && v4.parent === v3.entry_id,
            '1 — …each version\'s parent is the one before it', json(vs.map((v) => v.parent)));
        check(await statusOf(frame) === `Saved: version 4 of ${v4.label}`, '1 — the status says "Saved: version 4 of <label>"', await statusOf(frame));
        const bundleSet = memberOf(b3.bundle, 'level-set');
        const h3 = levelSetContentHash(bundleSet);
        check(vs.every((v) => setOf(v)?.content_hash === h3 && setOf(v)?.doc_id === bundleSet.set_id),
            '1 — EVERY version\'s set fingerprint = the BUNDLE\'s level-set member (no edit between them)',
            `${bundleSet.set_id} @ ${h3} vs ${json(vs.map((v) => setOf(v)?.content_hash))}`);
        check(roleHash(v3, 'overlay') === computeContentHash(memberOf(b3.bundle, 'overlay'), { idKey: 'overlay_id' })
            && roleHash(v3, 'rules') === computeContentHash(memberOf(b3.bundle, 'rules'), { idKey: NO_ID_KEY })
            && roleHash(v3, 'atlas') === computeContentHash(memberOf(b3.bundle, 'region-atlas'), { idKey: 'atlas_id' }),
        '1 — v3 holds the bundle\'s FOUR members: overlay, rules and atlas fingerprints equal the zip\'s',
        json(v3.members));
        const handedRef = Object.values(handed?.region_atlas ?? {}).map((r) => r.level_set);
        check(json(handedRef) === json([{ set_id: setOf(v4).doc_id, content_hash: setOf(v4).content_hash }])
            && roleHash(v4, 'rules') === computeContentHash(handed, { idKey: NO_ID_KEY }),
        '1 — v4\'s set is the one the HANDED rules name, and its rules member IS the handed rules',
        `${json(handedRef)} · rules ${roleHash(v4, 'rules')}`);

        await edit(frame);
        const v5 = await press(frame, 'editSetReport');
        const b6 = await pressBundle(frame);
        const v6 = b6.save;
        const h6 = levelSetContentHash(memberOf(b6.bundle, 'level-set'));
        check(v5.seq === 5 && v6.seq === 6 && h6 !== h3 && setOf(v5).content_hash === h6 && setOf(v6).content_hash === h6,
            '1 — AFTER an edit: REPORT → v5 and BUNDLE → v6 carry the NEW fingerprint, the new bundle\'s (never the stale one)',
            `${h3} → ${h6}; v5 ${setOf(v5).content_hash}, v6 ${setOf(v6).content_hash}`);

        /* ══ 2 — RELOAD: clean; Recent sets; Open = v6 byte-equal; the lineage continues ══ */
        seed = await bootApp();
        await raise(seed);
        frame = await navigateTo(seed, DBS.hosted);
        const clean = await frame.evaluate(() => ({ set: window.__editorEdit?.set ?? null, writer: typeof window.__labLibrary }));
        check(clean.set === null && clean.writer === 'undefined', '2 — after a RELOAD the lab opens CLEAN: no set held, nothing restored', json(clean));
        await frame.evaluate(() => document.getElementById('editLoadRecent').click());
        await until(frame, () => Array.isArray(window.__labLibrary?.recent), null, 'Recent sets to list');
        const recent = await frame.evaluate(() => window.__labLibrary.recent);
        check(recent.length === 1 && recent[0].lineage_id === v6.lineage_id && recent[0].newest?.seq === 6 && recent[0].versions === 6,
            '2 — "Recent sets" lists the lineage, newest version 6', json(recent.map((r) => [r.label, r.versions, r.newest])));
        await frame.evaluate((e) => document.querySelector(`#editRecentList button[data-entry="${e}"]`).click(), v6.entry_id);
        await until(frame, () => window.__labLibrary?.opened, null, 'Open');
        const opened = await frame.evaluate(() => window.__labLibrary.opened);
        check(opened.entry_id === v6.entry_id && opened.content_hash === h6 && !opened.refused,
            '2 — Open reads v6 BY FINGERPRINT and loads it through the LOAD door', json(opened));
        const v7 = await press(frame, 'editDownloadSet');
        const reDownloaded = await frame.evaluate(() => window.__editorSetOut);
        const stored = await libRead(frame, DBS.hosted, { kind: 'get', ref: { idKey: 'set_id', docId: setOf(v6).doc_id, contentHash: h6 } });
        check(stored.status === 'held' && stableStringify(reDownloaded) === stableStringify(stored.doc) && reDownloaded.set_id === setOf(v6).doc_id,
            '2 — …byte-equal: the page\'s own SET download of the opened set IS the stored v6', `${reDownloaded.set_id} · ${stored.status}`);
        check(v7.seq === 7 && v7.lineage_id === v6.lineage_id && v7.parent === v6.entry_id && v7.savedBecause === 'download',
            '2 — the next save point continues THAT lineage: v7, parent v6', json([v7.seq, v7.parent]));
        await app.close();

        /* ══ 3 — WON'T PLAY ══ */
        {
            const page = await context.newPage();
            watchErrors(page, 'wontplay');
            await page.goto(`${WATCH}?source=edit&level=4&libraryDb=${DBS.wontPlay}`, { waitUntil: 'domcontentloaded' });
            await editReady(page);
            await loadVanilla(page);
            const n = await saves(page);
            const pick = (room) => page.evaluate((r) => {
                const sel = document.getElementById('editSetRoom');
                sel.value = String(r);
                sel.dispatchEvent(new Event('change'));
                return document.getElementById('editSetRoomField_name')?.value ?? null;
            }, room);
            const name0 = await pick(0);
            await pick(1);
            // room 0's own name, read off room 0's form, written into room 1's
            await page.evaluate((nm) => {
                const input = document.getElementById('editSetRoomField_name');
                input.value = nm;
                input.dispatchEvent(new Event('change'));
            }, name0);
            await until(page, (k) => (window.__labLibrary?.saves?.length ?? 0) > k, n, 'the draft after the rename', 30000);
            const r = await press(page, 'editSetReport');
            const lin = await libRead(page, DBS.wontPlay, { kind: 'entries', lineageId: r.lineage_id });
            const versions = (lin.entries ?? []).filter((e) => !e.draft);
            check(r.draft === true && r.seq === null && typeof r.wontPlay === 'string' && /does not validate/.test(r.wontPlay)
                && versions.length === 0,
            '3 — an INVALID set (two rooms, one name) at REPORT saves a DRAFT marked won\'t-play, and NO version',
            `${r.wontPlay?.slice(0, 120)} · versions ${versions.length}`);
            check((await statusOf(page)).startsWith('Draft saved (won\'t play: '), '3 — …and the status says it is a won\'t-play draft', (await statusOf(page)).slice(0, 80));
            await page.close();
        }

        /* ══ 4 — STORAGE FULL ══ */
        {
            const page = await context.newPage();
            watchErrors(page, 'full');
            await page.goto(`${WATCH}?source=edit&level=4&libraryDb=${DBS.full}`, { waitUntil: 'domcontentloaded' });
            await editReady(page);
            await loadVanilla(page);
            const ok1 = await press(page, 'editSetReport');
            await page.evaluate(() => { window.__labLibraryFailNext = 'QuotaExceededError'; });
            const held = await page.evaluate(() => window.__editorEdit.set.set_id);
            const r = await press(page, 'editSetReport');
            const banner = await page.evaluate(() => document.getElementById('storage-quota-notice')?.textContent ?? null);
            check(r.status === 'failed' && r.quota === true && await statusOf(page) === 'NOT saved — storage full',
                '4 — a refused commit (QuotaExceededError) → "NOT saved — storage full"', `${r.why} · ${await statusOf(page)}`);
            check(typeof banner === 'string' && /storage for this site is full/i.test(banner) && /Open Storage panel/.test(banner),
                '4 — …and the STORAGE BANNER shows (the app\'s, in the lab\'s document)', banner?.slice(0, 100));
            await page.evaluate(() => { window.__editorSetOut = null; });
            const next = await press(page, 'editDownloadSet');
            const after = await page.evaluate(() => ({ held: window.__editorEdit.set.set_id, out: window.__editorSetOut?.set_id ?? null }));
            check(after.held === held && typeof after.out === 'string', '4 — …the session is untouched and Download still works', json(after));
            check(next.status === 'saved' && next.seq === ok1.seq + 1, '4 — …and the next save point saves (the download\'s, v2)', json([next.status, next.seq]));
            await page.close();
        }

        /* ══ 5 — TWO TABS FORK ══ */
        {
            const a = await context.newPage();
            const b = await context.newPage();
            watchErrors(a, 'tab-a');
            watchErrors(b, 'tab-b');
            for (const p of [a, b]) {
                await p.goto(`${WATCH}?source=edit&level=4&libraryDb=${DBS.fork}`, { waitUntil: 'domcontentloaded' });
                await editReady(p);
            }
            await loadVanilla(a);
            const v1f = await press(a, 'editSetReport');
            await b.evaluate(() => document.getElementById('editLoadRecent').click());
            await until(b, () => Array.isArray(window.__labLibrary?.recent) && window.__labLibrary.recent.length === 1, null, 'tab B\'s Recent sets');
            await b.evaluate((e) => document.querySelector(`#editRecentList button[data-entry="${e}"]`).click(), v1f.entry_id);
            await until(b, () => window.__labLibrary?.opened?.entry_id, null, 'tab B to open v1');
            await edit(a);
            const v2a = await press(a, 'editSetReport');
            await b.evaluate(() => { const s = document.getElementById('editSetRoom'); s.value = '2'; s.dispatchEvent(new Event('change')); });
            await edit(b);
            const v3b = await press(b, 'editSetReport');
            const all = await libRead(a, DBS.fork, { kind: 'entries', lineageId: v1f.lineage_id });
            const kept = (all.entries ?? []).filter((e) => !e.draft).map((e) => [e.seq, e.parent, e.source.tab_id]);
            const tabs = await Promise.all([a, b].map((p) => p.evaluate(() => window.__labLibrary.tabId)));
            check(v2a.seq === 2 && v3b.seq === 3 && v2a.parent === v1f.entry_id && v3b.parent === v1f.entry_id
                && v2a.lineage_id === v1f.lineage_id && v3b.lineage_id === v1f.lineage_id && tabs[0] !== tabs[1]
                && kept.length === 3 && setOf(v2a).content_hash !== setOf(v3b).content_hash,
            '5 — TWO TABS on v1 FORK: A saves v2, B saves v3, both parent v1, all three kept, nothing overwritten',
            json(kept));
            await a.close();
            await b.close();
        }

        /* ══ 6 — CLEARED → a new set ══ */
        {
            const page = await context.newPage();
            watchErrors(page, 'cleared');
            await page.goto(`${WATCH}?source=edit&level=4&libraryDb=${DBS.cleared}`, { waitUntil: 'domcontentloaded' });
            await editReady(page);
            await loadVanilla(page);
            const v1c = await press(page, 'editSetReport');
            const del = await libRead(page, DBS.cleared, { kind: 'delete', lineageId: v1c.lineage_id });
            const again = await press(page, 'editSetReport');
            check(del.status === 'deleted' && again.status === 'saved' && again.reminted === true && again.seq === 1
                && again.lineage_id !== v1c.lineage_id
                && await statusOf(page) === `Saved: version 1 of ${again.label} — saved as a new set: the old one was cleared`,
            '6 — the lineage CLEARED behind the tab → the next save mints a new set, once, and says so', await statusOf(page));
            const lins = await libRead(page, DBS.cleared, { kind: 'lineages' });
            check(lins.lineages?.length === 1, '6 — …and exactly one lineage exists afterwards (no loop)', json(lins.lineages?.length));
            await page.close();
        }

        /* ══ 7 — HIDE inside the debounce window (L4) ══ */
        {
            const page = await context.newPage();
            watchErrors(page, 'hide');
            await page.goto(`${WATCH}?source=edit&level=4&libraryDb=${DBS.hide}`, { waitUntil: 'domcontentloaded' });
            await editReady(page);
            await loadVanilla(page);
            await press(page, 'editSetReport');
            const n = await saves(page);
            await page.evaluate(() => {
                document.getElementById('editSetAddRoom').click();
                Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            });
            const flushedAt = await page.evaluate((k) => (window.__labLibrary?.saves?.length ?? 0) > k ? 'already' : 'pending', n);
            await until(page, (k) => (window.__labLibrary?.saves?.length ?? 0) > k, n, 'the flushed draft', 30000);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await editReady(page);
            await page.evaluate(() => document.getElementById('editLoadRecent').click());
            await until(page, () => Array.isArray(window.__labLibrary?.recent), null, 'Recent sets after the reload');
            const recent = await page.evaluate(() => window.__labLibrary.recent);
            const d = recent[0]?.drafts?.[0];
            if (d) {
                await page.evaluate((e) => document.querySelector(`#editRecentList button[data-entry="${e}"]`).click(), d.entry_id);
                await until(page, () => window.__labLibrary?.opened, null, 'Open the draft');
            }
            const rooms = await page.evaluate(() => window.__editorEdit?.set?.rooms ?? null);
            check(Boolean(d) && rooms === 117, '7 — an EDIT, the page HIDDEN inside the debounce window, a RELOAD → the draft has that edit (117 rooms)',
                `flush ${flushedAt} at the hide; drafts ${json(recent[0]?.drafts?.length)}; opened ${rooms} room(s)`);
            await page.close();
        }
    } catch (e) {
        check(false, 'the check ran to its end', e.message);
    }
    await finish();
}

if (isEntryPoint(import.meta.url)) await main();
