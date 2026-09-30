/**
 * The page's `?profile=` bootstrap (`profileBoot.js`, engine-prep R1). The
 * file is a classic script; imported here it runs its pure half only (no
 * `document.currentScript`), which it publishes on
 * `globalThis.__seedlingProfileBoot`. The page half (the synchronous fetch
 * and `#status`) is measured in the browser, not here.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const GLOBAL = '__SEEDLING_PROFILE__';
const DEFAULT_MD5 = 'be8b983bc252c0ac33effa9ede59bc6e';
const ROOT = new URL('https://example.test/repo/');
let boot;

beforeAll(async () => {
    await import('./profileBoot.js');
    boot = globalThis.__seedlingProfileBoot;
});

/** A synchronous `get` stub that serves `text` (or a status) and records the URLs it was asked for. */
function stubGet(text, status = 200) {
    const calls = [];
    return { calls, get: (url) => { calls.push(url); return { status, text }; } };
}

/** Load the profile and one model module in a FRESH registry, with whatever global is installed. */
async function loadModel() {
    vi.resetModules();
    const [p, phys] = await Promise.all([import('./seedlingProfile.js'), import('./playerPhysicsV1.js')]);
    return { p, phys };
}

describe('profileBoot — the page\'s ?profile=', () => {
    afterEach(() => { delete globalThis[GLOBAL]; });

    it('imported outside a page, it installs nothing and publishes its pure half', () => {
        expect(Object.keys(boot).sort()).toEqual(['announce', 'installProfile', 'profileParam', 'profileUrl']);
        expect(GLOBAL in globalThis).toBe(false);
    });

    it('no ?profile=: no fetch, the global untouched, the compiled-in default', async () => {
        const { get, calls } = stubGet('{}');
        expect(boot.installProfile('?tape=x.json', { root: ROOT, get })).toBeNull();
        expect(boot.installProfile('?profile=', { root: ROOT, get })).toBeNull();
        expect(calls).toEqual([]);
        expect(GLOBAL in globalThis).toBe(false);
        const { p, phys } = await loadModel();
        expect(p.PROFILE_SOURCE).toBe('compiled-in default');
        expect(p.profileMd5()).toBe(DEFAULT_MD5);
        expect(phys.WALK_SPEED).toBe(0.8);
    });

    it('?profile=<path>: fetched repo-relative, installed as TEXT before the model evaluates, announced', async () => {
        const text = '{"id": "walk-plus", "walkSpeed": 0.9}\n';
        const { get, calls } = stubGet(text);
        expect(boot.installProfile('?tape=x.json&profile=/profiles/walk.json', { root: ROOT, get }))
            .toEqual({ path: '/profiles/walk.json', url: 'https://example.test/repo/profiles/walk.json' });
        expect(calls).toEqual(['https://example.test/repo/profiles/walk.json']);
        expect(globalThis[GLOBAL]).toBe(text);
        const { p, phys } = await loadModel();
        expect(phys.WALK_SPEED).toBe(0.9); // the model module copied the override at ITS load
        expect(p.PROFILE_SOURCE).toBe('override:walk-plus');
        const lines = boot.announce({ path: '/profiles/walk.json' }, p);
        expect(lines[0]).toBe(`[profile] profile: override:walk-plus (id walk-plus, md5 ${p.profileMd5()})`);
        expect(lines).toContain('[profile] set walkSpeed=0.9');
    });

    it('a refused override fails the model\'s import (the page shows it in #status, naming the path)', async () => {
        boot.installProfile('?profile=bad.json', { root: ROOT, get: stubGet('{"walkSped": 0.9}').get });
        vi.resetModules();
        await expect(import('./seedlingProfile.js')).rejects.toThrow(/unknown key "walkSped"/);
    });

    it('a fetch that fails names the path and the URL it tried, and installs nothing', () => {
        expect(() => boot.installProfile('?profile=missing.json', { root: ROOT, get: stubGet('', 404).get }))
            .toThrow('?profile=missing.json: cannot fetch https://example.test/repo/missing.json (HTTP 404)');
        expect(() => boot.installProfile('?profile=x.json', { root: ROOT, get: () => { throw new Error('offline'); } }))
            .toThrow('?profile=x.json: cannot fetch https://example.test/repo/x.json (offline)');
        expect(GLOBAL in globalThis).toBe(false);
    });

    it('a profile that loaded WITHOUT the override is refused as TOO LATE, not announced under its name', async () => {
        const { p } = await loadModel(); // evaluated with no global
        expect(() => boot.announce({ path: 'late.json' }, p)).toThrow(/^\?profile=late\.json: installed TOO LATE/);
    });
});
