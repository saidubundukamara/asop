import { describe, it, expect } from 'vitest';
import { sanitizeRichText, sanitizeRichTextCapped, RICH_TEXT_MAX_LENGTH } from './sanitize';

describe('sanitizeRichText — allowlist', () => {
	it('strips <script> tags', () => {
		const dirty = '<p>hi</p><script>alert(1)</script>';
		expect(sanitizeRichText(dirty)).toBe('<p>hi</p>');
	});

	it('strips inline event handlers', () => {
		const dirty = '<p onclick="steal()">click me</p>';
		const clean = sanitizeRichText(dirty);
		expect(clean).not.toContain('onclick');
	});

	it('strips disallowed tags like <img> and <iframe>', () => {
		expect(sanitizeRichText('<p>hi</p><img src="x">')).toBe('<p>hi</p>');
		expect(sanitizeRichText('<iframe src="https://evil"></iframe>')).toBe('');
	});

	it('preserves the full allowlist of formatting tags', () => {
		const html = '<p><strong>bold</strong> and <em>italic</em></p>';
		expect(sanitizeRichText(html)).toBe(html);
	});

	it('preserves lists', () => {
		const html = '<ul><li>one</li><li>two</li></ul>';
		expect(sanitizeRichText(html)).toBe(html);
	});

	it('preserves anchor href, target, rel', () => {
		const html = '<p><a href="https://example.com" target="_blank" rel="noopener">link</a></p>';
		expect(sanitizeRichText(html)).toBe(html);
	});

	it('strips javascript: URLs', () => {
		const dirty = '<p><a href="javascript:alert(1)">click</a></p>';
		const clean = sanitizeRichText(dirty);
		expect(clean).not.toContain('javascript:');
	});
});

describe('sanitizeRichTextCapped — length enforcement', () => {
	it('accepts content within the cap', () => {
		const result = sanitizeRichTextCapped('<p>short and sweet</p>');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.html).toBe('<p>short and sweet</p>');
	});

	it('rejects content over the cap with a too_long reason', () => {
		const huge = '<p>' + 'a'.repeat(RICH_TEXT_MAX_LENGTH + 100) + '</p>';
		const result = sanitizeRichTextCapped(huge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe('too_long');
			expect(result.length).toBeGreaterThan(RICH_TEXT_MAX_LENGTH);
		}
	});
});
