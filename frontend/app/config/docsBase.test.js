import { describe, expect, it } from 'vitest';
import { DOCS_LINK_TARGETS, docsBase, localDocsBase } from './docsBase.js';

// The two strings the client console's Overview link used before the lift, verbatim.
const STABLE_OVERVIEW = 'https://github.com/PeerInfinity/Archipelago/blob/JSONExport/docs/json/user/overview.md';
const CC_OVERVIEW = 'https://github.com/PeerInfinity/Archipelago-CC/blob/main/docs/json/user/overview.md';

describe('docsBase', () => {
    it('reproduces the console Overview link for the stable build', () => {
        expect(docsBase('/Archipelago/frontend/') + 'docs/json/user/overview.md').toBe(STABLE_OVERVIEW);
    });

    it('reproduces the console Overview link everywhere else', () => {
        expect(docsBase('/frontend/') + 'docs/json/user/overview.md').toBe(CC_OVERVIEW);
        expect(docsBase('/Archipelago-CC/frontend/') + 'docs/json/user/overview.md').toBe(CC_OVERVIEW);
    });

    it('the local base is the repo root one level above the app page', () => {
        expect(localDocsBase('http://localhost:8000/frontend/index.html?mode=x')).toBe('http://localhost:8000/');
        expect(localDocsBase('http://localhost:8000/frontend/')).toBe('http://localhost:8000/');
    });

    it('names both link targets', () => {
        expect(Object.values(DOCS_LINK_TARGETS)).toEqual(['github', 'local']);
    });
});
