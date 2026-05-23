// Entry point for `@better-auth/cli generate`. The CLI evaluates this file via
// jiti, which cannot resolve SvelteKit's $app/* virtual modules — so it can't
// load auth.ts directly. This shim exports an equivalent betterAuth() instance
// without the SvelteKit-coupled plugins (which contribute no schema anyway).
import { betterAuth } from 'better-auth';
import { baseAuthConfig } from './auth-config';

export const auth = betterAuth(baseAuthConfig);
