import { describe, it, expect } from 'vitest';

import { selectIndexFile } from './presetUI.js';

describe('selectIndexFile', () => {
    it('defaults to the dev index on a localhost host', () => {
        const result = selectIndexFile({ hostname: 'localhost', search: '' });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('selects the live index on a github.io host', () => {
        const result = selectIndexFile({
            hostname: 'username.github.io',
            search: '',
        });
        expect(result.path).toBe('./presets/preset_files.live.json');
        expect(result.isLive).toBe(true);
    });

    it('also matches custom github.io subdomains', () => {
        const result = selectIndexFile({
            hostname: 'project.user.github.io',
            search: '',
        });
        expect(result.isLive).toBe(true);
    });

    it('treats file:// (empty hostname) as dev', () => {
        const result = selectIndexFile({ hostname: '', search: '' });
        expect(result.isLive).toBe(false);
        expect(result.path).toBe('./presets/preset_files.json');
    });

    it('?index=live forces live regardless of host', () => {
        const result = selectIndexFile({
            hostname: 'localhost',
            search: '?index=live',
        });
        expect(result.path).toBe('./presets/preset_files.live.json');
        expect(result.isLive).toBe(true);
    });

    it('?index=dev forces dev regardless of host', () => {
        const result = selectIndexFile({
            hostname: 'username.github.io',
            search: '?index=dev',
        });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('ignores other ?index= values and falls through to host-based selection', () => {
        const result = selectIndexFile({
            hostname: 'localhost',
            search: '?index=garbage',
        });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('ignores unrelated URL params', () => {
        const result = selectIndexFile({
            hostname: 'localhost',
            search: '?nocache=1&theme=dark',
        });
        expect(result.path).toBe('./presets/preset_files.json');
        expect(result.isLive).toBe(false);
    });

    it('handles undefined inputs without throwing', () => {
        expect(() => selectIndexFile()).not.toThrow();
        expect(() => selectIndexFile({})).not.toThrow();
        const r = selectIndexFile();
        expect(r.path).toBe('./presets/preset_files.json');
    });
});
