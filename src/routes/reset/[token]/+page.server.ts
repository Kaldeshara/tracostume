import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { completePasswordReset, createSession, findPasswordReset } from '#lib/server/auth.ts';

export const load: PageServerLoad = async ({ params }) => {
	const reset = await findPasswordReset(params.token);
	if (!reset) error(404, 'Not found');
	return { firstName: reset.user.firstName };
};

export const actions: Actions = {
	default: async ({ params, request, cookies }) => {
		const reset = await findPasswordReset(params.token);
		if (!reset) error(404, 'Not found');
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (password.length < 8 || password.length > 200) return fail(400, { short: true });
		if (password !== String(form.get('confirm') ?? '')) return fail(400, { mismatch: true });

		await completePasswordReset(reset.user.id, password);
		await createSession(cookies, reset.user.id);
		redirect(303, '/');
	}
};
