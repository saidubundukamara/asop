// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { AuthSession } from '$lib/server/auth';

type SessionUser = NonNullable<AuthSession>['user'];
type SessionData = NonNullable<AuthSession>['session'];

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: SessionUser | null;
			session: SessionData | null;
		}
		interface PageData {
			user?: SessionUser | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
