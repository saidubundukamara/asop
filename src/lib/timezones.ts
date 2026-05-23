// Curated IANA time-zone list used by the profile page. A full list (Intl
// supports 400+ zones) is overwhelming for a 15-person org; we ship a focused
// subset and expand on request. UTC stays first as the documented default.

export const TIMEZONES = [
	'UTC',
	'Africa/Abidjan',
	'Africa/Accra',
	'Africa/Addis_Ababa',
	'Africa/Cairo',
	'Africa/Casablanca',
	'Africa/Dar_es_Salaam',
	'Africa/Johannesburg',
	'Africa/Kampala',
	'Africa/Kinshasa',
	'Africa/Lagos',
	'Africa/Nairobi',
	'Africa/Tunis',
	'Europe/London',
	'Europe/Paris',
	'Europe/Berlin',
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles'
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export function isTimezone(value: string): value is Timezone {
	return (TIMEZONES as readonly string[]).includes(value);
}
