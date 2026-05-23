import { fail, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';

// Generic shape for the parsed-form-data → server-write → response cycle that
// every form action in this codebase follows. The handler runs only after the
// zod schema has parsed FormData; field-level errors are returned as a
// 400-shaped `ActionFailure` that SvelteKit's `form` enhancement renders
// inline. Auth/role checks happen inside the handler via requireUser /
// requireRole — keeping them in the body (not the wrapper) lets actions
// choose between "anyone signed in" and "admin only" without separate helpers.

export type ActionFailure = { ok: false; issues: Record<string, string[]>; message?: string };
export type ActionSuccess<T> = { ok: true; data: T };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function withAction<TSchema extends z.ZodTypeAny, TResult>(
	schema: TSchema,
	handler: (input: z.infer<TSchema>, event: RequestEvent) => Promise<ActionResult<TResult>>
) {
	return async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const raw: Record<string, FormDataEntryValue> = {};
		for (const [k, v] of formData.entries()) raw[k] = v;

		const parsed = schema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, {
				ok: false,
				issues: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
			});
		}

		const result = await handler(parsed.data, event);
		if (!result.ok) return fail(400, result);
		return result;
	};
}
