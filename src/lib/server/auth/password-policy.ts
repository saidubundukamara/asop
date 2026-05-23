// FR-AUTH-2: password must be min 10 chars, at least one number,
// and not in the common-password list.
//
// Length is enforced by Better Auth's `emailAndPassword.minPasswordLength`.
// Common-password check is enforced by the `haveIBeenPwned` plugin (k-anonymity
// against the HIBP database — no plaintext leaves the server).
// This module covers the remaining rule: at least one digit.

export type PasswordPolicyIssue = 'too-short' | 'no-digit';

export function checkPasswordPolicy(password: string): PasswordPolicyIssue[] {
	const issues: PasswordPolicyIssue[] = [];
	if (password.length < 10) issues.push('too-short');
	if (!/\d/.test(password)) issues.push('no-digit');
	return issues;
}

export function passwordPolicyMessage(issue: PasswordPolicyIssue): string {
	switch (issue) {
		case 'too-short':
			return 'Password must be at least 10 characters.';
		case 'no-digit':
			return 'Password must include at least one number.';
	}
}
