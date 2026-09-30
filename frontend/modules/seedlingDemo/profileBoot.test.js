/**
 * The page's `?profile=` bootstrap (`profileBoot.js`, engine-prep R1). Each
 * row loads the bootstrap in a FRESH module registry, so the profile it
 * imports evaluates for the first time inside the row, as it does on a page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const GLOBAL = '__SEEDLING_PROFILE__';
const DEFAULT_MD5 = 'be8b983bc252c0ac33effa9ede59bc6e';
/** The entry the rows boot: a real model module, so the profile it reads is the one installed. */
const ENTRY = new URL('./playerPhysicsV1.js', import.meta.url).href;
const ROOT = new URL('https://example.test/repo/');

/** A fetch stub that serves `body` (or a status) and records the URLs it was asked for. */
function stubFetch(body, status = 200) {
    const calls = [];
    const fetch = async (url) => {
        calls.push(url);
        return { ok: status === 200, status, text: async () => body };
    };
    return { fetch, calls };
}

async function freshBoot() {
    vi.resetModules();
    return import('./profileBoot.js');
}

describe('profileBoot — the page\'s ?profile=', () => {
    afterEach(() => { delete globalThis[GLOBAL]; });

    it('no ?profile=: the entry alone — no fetch, the global untouched, the compiled-in default', async () => {
        const { bootWithProfile } = await freshBoot();
        const { fetch, calls } = stubFetch('{}');
        const log = [];
        const entry = await bootWithProfile(ENTRY, { search: '?tape=x.json', fetch, log: (l) => log.push(l), root: ROOT });
        expect(calls).toEqual([]);
        expect(log).toEqual([]);
        expect(GLOBAL in globalThis).toBe(false);
        expect(entry.WALK_SPEED).toBe(0.8);
        const p = await import('./seedlingProfile.js');
        expect(p.PROFILE_SOURCE).toBe('compiled-in default');
        expect(p.profileMd5()).toBe(DEFAULT_MD5);
    });

    it('?profile=<path>: fetched repo-relative, installed BEFORE the entry evaluates, announced', async () => {
        const { bootWithProfile } = await freshBoot();
        const { fetch, calls } = stubFetch('{"id": "walk-plus", "walkSpeed": 0.9}\n');
        const log = [];
        const entry = await bootWithProfile(ENTRY, {
            search: '?tape=x.json&profile=/profiles/walk.json', fetch, log: (l) => log.push(l), root: ROOT,
        });
        expect(calls).toEqual(['https://example.test/repo/profiles/walk.json']);
        expect(entry.WALK_SPEED).toBe(0.9); // the entry copied the override at ITS load
        const p = await import('./seedlingProfile.js');
        expect(p.PROFILE_SOURCE).toBe('override:walk-plus');
        expect(log[0]).toBe(`[profile] profile: override:walk-plus (id walk-plus, md5 ${p.profileMd5()})`);
        expect(log).toContain('[profile] set walkSpeed=0.9');
    });

    it('a refused override fails the boot, naming the ?profile= path', async () => {
        const { bootWithProfile } = await freshBoot();
        const { fetch } = stubFetch('{"walkSped": 0.9}');
        await expect(bootWithProfile(ENTRY, { search: '?profile=bad.json', fetch, log: () => {}, root: ROOT }))
            .rejects.toThrow(/^\?profile=bad\.json: profile override: unknown key "walkSped"/);
    });

    it('a fetch that fails names the URL it tried', async () => {
        const { bootWithProfile } = await freshBoot();
        const { fetch } = stubFetch('', 404);
        await expect(bootWithProfile(ENTRY, { search: '?profile=missing.json', fetch, log: () => {}, root: ROOT }))
            .rejects.toThrow('?profile=missing.json: cannot fetch https://example.test/repo/missing.json (HTTP 404)');
    });

    it('a profile that had already evaluated is refused as TOO LATE, not run under the override\'s name', async () => {
        const { bootWithProfile } = await freshBoot();
        await import('./seedlingProfile.js'); // evaluated with no global
        const { fetch } = stubFetch('{"walkSpeed": 0.9}');
        await expect(bootWithProfile(ENTRY, { search: '?profile=late.json', fetch, log: () => {}, root: ROOT }))
            .rejects.toThrow(/^\?profile=late\.json: installed TOO LATE/);
    });
});
