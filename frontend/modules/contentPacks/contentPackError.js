/**
 * contentPacks/contentPackError — the refusal every pack reader throws (`contentPacks.js` re-exports it). Its own
 * file so `provenance.js` and `contentPacks.js` can both throw it without importing each other.
 */
export class ContentPackError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ContentPackError';
    }
}
