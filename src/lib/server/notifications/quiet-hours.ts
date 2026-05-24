// Returns true when `now` (converted to `timeZone`) falls within the quiet
// window [start, end). If end < start the window crosses midnight (e.g. 22–07).
// Null/undefined start or end = no quiet hours configured → always false.
export function isInQuietHours(
	now: Date,
	timeZone: string,
	start: number | null | undefined,
	end: number | null | undefined
): boolean {
	if (start == null || end == null) return false;

	// Extract the local hour using Intl — works for any IANA timezone.
	const localHour = parseInt(
		new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone })
			.format(now)
			.replace('24', '0'), // some impls emit "24" for midnight
		10
	);

	if (start <= end) {
		// Normal window: e.g. 09–17
		return localHour >= start && localHour < end;
	} else {
		// Midnight-crossing window: e.g. 22–07
		return localHour >= start || localHour < end;
	}
}
