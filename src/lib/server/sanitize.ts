import DOMPurify from 'isomorphic-dompurify';

// Allowlist sanitizer for tiptap-serialized rich-text HTML before persistence.
//
// The editor itself is not a security boundary — anyone can POST whatever HTML
// they want straight to the form action. Every write that touches a rich-text
// field MUST round-trip through `sanitizeRichText()` before hitting the DB.
//
// Phase 3 uses this for Task.description and TaskTemplate.defaultDescription.
// Phase 4 will reuse it for Report long-text field values.

const ALLOWED_TAGS = [
	'p',
	'br',
	'strong',
	'em',
	'u',
	's',
	'ol',
	'ul',
	'li',
	'a',
	'h2',
	'h3',
	'blockquote'
];

// `href` for links. `target`/`rel` so tiptap's Link extension can mark external
// links with rel="noopener noreferrer" target="_blank" (its default config).
const ALLOWED_ATTR = ['href', 'target', 'rel'];

export const RICH_TEXT_MAX_LENGTH = 20_000;

export function sanitizeRichText(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR
	});
}

// Pair sanitize-then-cap into one helper so action handlers don't reinvent it.
// Returns { ok: true, html } if the sanitized output fits the cap, otherwise
// returns { ok: false } so the caller can flatten that into a zod-shaped issue.
export type SanitizeResult =
	| { ok: true; html: string }
	| { ok: false; reason: 'too_long'; length: number };

export function sanitizeRichTextCapped(html: string): SanitizeResult {
	const clean = sanitizeRichText(html);
	if (clean.length > RICH_TEXT_MAX_LENGTH) {
		return { ok: false, reason: 'too_long', length: clean.length };
	}
	return { ok: true, html: clean };
}
