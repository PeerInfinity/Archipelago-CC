import { afterEach, describe, expect, it, vi } from 'vitest';
import { isQuotaExceededError, localStorageUsage, onStorageWriteFailure, reportStorageWriteFailure } from './storageQuota.js';

function storageOf(entries) {
    const keys = Object.keys(entries);
    return { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => entries[k] ?? null };
}
const quotaError = (props) => Object.assign(new Error('full'), props);

describe('isQuotaExceededError', () => {
    it('recognises the names and legacy codes browsers use', () => {
        expect(isQuotaExceededError(quotaError({ name: 'QuotaExceededError' }))).toBe(true);
        expect(isQuotaExceededError(quotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }))).toBe(true);
        expect(isQuotaExceededError(quotaError({ code: 22 }))).toBe(true);
        expect(isQuotaExceededError(quotaError({ code: 1014 }))).toBe(true);
    });
    it('is false for other errors and for nothing', () => {
        expect(isQuotaExceededError(new TypeError('x'))).toBe(false);
        expect(isQuotaExceededError(quotaError({ name: 'SecurityError', code: 18 }))).toBe(false);
        expect(isQuotaExceededError(null)).toBe(false);
    });
});

describe('localStorageUsage', () => {
    it('counts key + value chars, sorted largest first', () => {
        const u = localStorageUsage(storageOf({ a: 'xx', big: 'y'.repeat(10), c: '' }), 2);
        expect(u.keys).toBe(3);
        expect(u.chars).toBe(3 + 13 + 1);
        expect(u.top).toEqual([{ key: 'big', chars: 13 }, { key: 'a', chars: 3 }]);
    });
    it('never throws on an unavailable storage', () => {
        expect(localStorageUsage(undefined).keys).toBe(0);
    });
});

describe('reportStorageWriteFailure', () => {
    const offs = [];
    afterEach(() => { offs.splice(0).forEach((off) => off()); delete globalThis.localStorage; vi.restoreAllMocks(); });

    it('a quota error → one notice per listener, naming the key, its size and the largest keys', () => {
        globalThis.localStorage = storageOf({ hog: 'z'.repeat(100), small: 'a' });
        const seen = [];
        offs.push(onStorageWriteFailure((n) => seen.push(n)));
        const notice = reportStorageWriteFailure({ key: 'k', value: 'v'.repeat(9), error: quotaError({ name: 'QuotaExceededError' }), owner: 'Test' });
        expect(seen).toEqual([notice]);
        expect(notice.attemptedChars).toBe(10);
        expect(notice.usedChars).toBe(103 + 6);
        expect(notice.top[0].key).toBe('hog');
        expect(notice.message).toContain('"k" needed 10 chars');
        expect(notice.message).toContain('hog (103)');
    });

    it('any other error → null, and no listener is called', () => {
        const seen = [];
        offs.push(onStorageWriteFailure((n) => seen.push(n)));
        expect(reportStorageWriteFailure({ key: 'k', value: 'v', error: new TypeError('x') })).toBe(null);
        expect(seen).toEqual([]);
    });

    it('no listener → console.warn carries the message', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        reportStorageWriteFailure({ key: 'k', chars: 5, error: quotaError({ code: 22 }) });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('"k" needed 5 chars'));
    });

    it('a listener that throws does not stop the others', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const seen = [];
        offs.push(onStorageWriteFailure(() => { throw new Error('boom'); }));
        offs.push(onStorageWriteFailure((n) => seen.push(n.key)));
        reportStorageWriteFailure({ key: 'k', chars: 1, error: quotaError({ name: 'QuotaExceededError' }) });
        expect(seen).toEqual(['k']);
    });
});
