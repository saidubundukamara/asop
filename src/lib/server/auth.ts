import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { baseAuthConfig } from './auth-config';

// sveltekitCookies must be the last plugin in the array so it can wrap the
// response with Set-Cookie headers when actions call auth.api.signInEmail and
// similar from a form action.
export const auth = betterAuth({
	...baseAuthConfig,
	plugins: [...baseAuthConfig.plugins, sveltekitCookies(getRequestEvent)]
});

export type Auth = typeof auth;
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
