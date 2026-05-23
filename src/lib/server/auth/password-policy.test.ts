import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy, passwordPolicyMessage } from './password-policy';

describe('checkPasswordPolicy', () => {
	it('returns no issues for a compliant password', () => {
		expect(checkPasswordPolicy('correct-horse-1')).toEqual([]);
	});

	it('flags passwords shorter than 10 characters', () => {
		expect(checkPasswordPolicy('shrt1')).toContain('too-short');
	});

	it('flags passwords without a digit', () => {
		expect(checkPasswordPolicy('correct-horse-battery')).toContain('no-digit');
	});

	it('returns both issues for a short letter-only password', () => {
		expect(checkPasswordPolicy('abc')).toEqual(['too-short', 'no-digit']);
	});

	it('treats unicode digits as digits', () => {
		// /\d/ in JS only matches ASCII 0-9 by default — Arabic-Indic digit "٥"
		// should NOT satisfy the rule, since users typing Latin keyboards expect
		// "1234567890" to count and other scripts may be unintentional.
		expect(checkPasswordPolicy('correct-horse-٥')).toContain('no-digit');
	});
});

describe('passwordPolicyMessage', () => {
	it('returns a user-facing string per issue', () => {
		expect(passwordPolicyMessage('too-short')).toMatch(/10 characters/);
		expect(passwordPolicyMessage('no-digit')).toMatch(/number/);
	});
});
