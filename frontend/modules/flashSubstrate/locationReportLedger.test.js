import { describe, it, expect } from 'vitest';
import { createLocationReportLedger, LOCATION_REPORT_SETTLE_MS } from './locationReportLedger.js';

function ledgerWithClock() {
    const clock = { t: 1000 };
    const ledger = createLocationReportLedger({ now: () => clock.t });
    return { ledger, clock };
}

describe('locationReportLedger — an ACCEPTED check is never dispatched twice', () => {
    it('dispatches the first report, suppresses repeats in flight, and never resends once the host has it', () => {
        const { ledger, clock } = ledgerWithClock();
        ledger.reset([]);
        expect(ledger.shouldDispatch('R__clear', new Set())).toBe(true);
        expect(ledger.stateOf('R__clear')).toBe('inFlight');
        // a game re-firing every frame while the host processes the first
        expect(ledger.shouldDispatch('R__clear', new Set())).toBe(false);

        ledger.noteHostChecked(new Set(['R__clear']));
        expect(ledger.stateOf('R__clear')).toBe('accepted');
        clock.t += 10 * LOCATION_REPORT_SETTLE_MS;
        expect(ledger.shouldDispatch('R__clear', new Set(['R__clear']))).toBe(false);
        // even a stale snapshot that lacks it does not re-arm an accepted name
        expect(ledger.shouldDispatch('R__clear', new Set())).toBe(false);
        ledger.noteRefused('R__clear');
        expect(ledger.shouldDispatch('R__clear', new Set())).toBe(false);
    });

    it('a name the host already had checked at load is accepted from the start', () => {
        const { ledger } = ledgerWithClock();
        ledger.reset(['R__clear']);
        expect(ledger.shouldDispatch('R__clear', [])).toBe(false);
    });

    it('a name the host has at report time is accepted without a dispatch', () => {
        const { ledger } = ledgerWithClock();
        ledger.reset([]);
        expect(ledger.shouldDispatch('R__clear', ['R__clear'])).toBe(false);
        expect(ledger.stateOf('R__clear')).toBe('accepted');
    });

    it('a repeat within the settle window is suppressed even with no word from the host', () => {
        const { ledger, clock } = ledgerWithClock();
        ledger.reset([]);
        expect(ledger.shouldDispatch('R__clear', [])).toBe(true);
        clock.t += LOCATION_REPORT_SETTLE_MS - 1;
        expect(ledger.shouldDispatch('R__clear', [])).toBe(false);
    });
});

describe('locationReportLedger — a REFUSED check can be sent again on the same visit', () => {
    it('the gate\'s refusal re-arms it at once', () => {
        const { ledger } = ledgerWithClock();
        ledger.reset([]);
        expect(ledger.shouldDispatch('R__clear', [])).toBe(true);
        ledger.noteRefused('R__clear');
        expect(ledger.stateOf('R__clear')).toBe('armed');
        expect(ledger.shouldDispatch('R__clear', [])).toBe(true);
    });

    it('with no explicit refusal, a report after the settle window that the host still lacks is sent again', () => {
        const { ledger, clock } = ledgerWithClock();
        ledger.reset([]);
        expect(ledger.shouldDispatch('R__clear', [])).toBe(true);
        ledger.noteHostChecked(new Set(['other']));
        clock.t += LOCATION_REPORT_SETTLE_MS;
        expect(ledger.shouldDispatch('R__clear', new Set())).toBe(true);
    });

    it('a refusal of one name does not re-arm another', () => {
        const { ledger } = ledgerWithClock();
        ledger.reset([]);
        ledger.shouldDispatch('A', []);
        ledger.shouldDispatch('B', []);
        ledger.noteRefused('A');
        expect(ledger.stateOf('A')).toBe('armed');
        expect(ledger.stateOf('B')).toBe('inFlight');
    });

    it('a new region (reset) forgets in-flight names', () => {
        const { ledger } = ledgerWithClock();
        ledger.reset([]);
        ledger.shouldDispatch('A', []);
        ledger.reset([]);
        expect(ledger.stateOf('A')).toBe('armed');
    });
});
