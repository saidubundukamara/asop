import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Better Auth ships a single Web-standard `Request → Response` handler that
// dispatches to /sign-in/email, /sign-up/email, /forget-password, etc.
const handler: RequestHandler = ({ request }) => auth.handler(request);

export const GET = handler;
export const POST = handler;
