import { describe, it, expect } from 'vitest';
import { weekBoundsUTC } from './summary';

// FR-DASH-3 trend deltas use ISO weeks (Monday → Sunday) in UTC. Wrong
// boundaries here would silently misreport "completed this week" — easy to
// miss in QA, hence the explicit edge-case coverage.

function iso(d: Date): string {
	return d.toISOString();
}

describe('weekBoundsUTC', () => {
	it('mid-week (Wed) snaps back to Monday 00:00 UTC', () => {
		const now = new Date('2026-05-20T15:30:00Z'); // Wed
		const { thisWeekStart, thisWeekEnd, prevWeekStart, prevWeekEnd } = weekBoundsUTC(now);
		expect(iso(thisWeekStart)).toBe('2026-05-18T00:00:00.000Z'); // Mon
		expect(iso(thisWeekEnd)).toBe('2026-05-25T00:00:00.000Z'); // next Mon
		expect(iso(prevWeekStart)).toBe('2026-05-11T00:00:00.000Z');
		expect(iso(prevWeekEnd)).toBe('2026-05-18T00:00:00.000Z');
	});

	it('Monday 00:00 UTC is its own week start', () => {
		const now = new Date('2026-05-18T00:00:00Z');
		const { thisWeekStart } = weekBoundsUTC(now);
		expect(iso(thisWeekStart)).toBe('2026-05-18T00:00:00.000Z');
	});

	it('Sunday 23:59 still resolves to the same week', () => {
		const now = new Date('2026-05-24T23:59:59Z'); // Sun
		const { thisWeekStart, thisWeekEnd } = weekBoundsUTC(now);
		expect(iso(thisWeekStart)).toBe('2026-05-18T00:00:00.000Z');
		expect(iso(thisWeekEnd)).toBe('2026-05-25T00:00:00.000Z');
	});

	it('Sunday before midnight UTC and Monday after midnight UTC are different weeks', () => {
		const sunday = weekBoundsUTC(new Date('2026-05-24T23:59:59Z'));
		const monday = weekBoundsUTC(new Date('2026-05-25T00:00:00Z'));
		expect(sunday.thisWeekEnd).toEqual(monday.thisWeekStart);
	});

	it('prevWeekEnd equals thisWeekStart (no gap, no overlap)', () => {
		const { thisWeekStart, prevWeekEnd } = weekBoundsUTC(new Date('2026-03-04T12:00:00Z'));
		expect(prevWeekEnd).toEqual(thisWeekStart);
	});
});
