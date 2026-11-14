<script lang="ts" module>
	export type Action = 'place' | 'checkout' | 'collect' | 'condition';
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ItemCondition, UserRole } from '../../generated/prisma/enums';
	import { m } from '#lib/paraglide/messages.js';
	import { CONDITIONS, conditionLabel, toDateInput } from '#lib/format.ts';
	import {
		canCheckOut,
		canCollect,
		canManageStock,
		canSetCondition,
		isRepairer
	} from '#lib/roles.ts';

	type Person = { id: string; firstName: string; lastName: string };
	type Props = {
		itemIds: string[];
		boxes: { id: string; code: string; label: string; shelf: string | null }[];
		users: Person[];
		/** Choreographers who can be named as the contact of a loan. */
		contacts?: Person[];
		/** Role of the current user: decides which actions are offered. */
		role: UserRole;
		/** Pre-selected box for storing/returning. */
		defaultBoxId?: string | null;
		/** Whether some of the items are currently lent (changes the wording). */
		someOut?: boolean;
		/** Whether all items are currently lent (hides check-out). */
		allOut?: boolean;
		/** Whether some lent items are still with their dancer (can be collected). */
		someUncollected?: boolean;
		form?: { done?: string; count?: number; error?: string; codes?: string[] } | null;
		/** Called after a successful action, e.g. to clear the selection. */
		ondone?: (action: string) => void;
		/**
		 * When set, an action that cannot reach the server (no connection) is handed over here
		 * instead of failing, to be sent later (offline scanner).
		 */
		onoffline?: (action: Action, form: FormData) => void;
	};

	let {
		itemIds,
		boxes,
		users,
		contacts = [],
		role,
		defaultBoxId = null,
		someOut = false,
		allOut = false,
		someUncollected = false,
		form = null,
		ondone,
		onoffline
	}: Props = $props();
	let open = $state<Action | null>(null);
	let borrowerUserId = $state('');
	let submitting = $state(false);

	// States a repairer may set; keepers may set any.
	const REPAIRER_CONDITIONS: ItemCondition[] = [
		'GOOD',
		'TO_WASH',
		'TO_REPAIR',
		'IN_REPAIR',
		'DAMAGED'
	];
	const conditions = $derived(isRepairer(role) ? REPAIRER_CONDITIONS : CONDITIONS);

	const actions = $derived(
		(
			[
				['place', canManageStock(role)],
				['checkout', canCheckOut(role) && !allOut],
				['collect', canCollect(role) && someUncollected],
				['condition', canSetCondition(role)]
			] as [Action, boolean][]
		)
			.filter(([, allowed]) => allowed)
			.map(([action]) => action)
	);

	// Default due date: two weeks from today.
	const defaultDue = toDateInput(new Date(Date.now() + 14 * 24 * 3600 * 1000));

	function keepForLater(action: Action, formData: FormData) {
		onoffline?.(action, formData);
		submitting = false;
		open = null;
	}

	const submit = ({
		formData,
		action,
		cancel
	}: {
		formData: FormData;
		action: URL;
		cancel: () => void;
	}) => {
		const name = action.search.replace('?/', '') as Action;
		if (onoffline && !navigator.onLine) {
			cancel();
			keepForLater(name, formData);
			return;
		}
		submitting = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown>; error?: unknown };
			update: () => Promise<void>;
		}) => {
			// The phone believed it was online but the request never reached the server.
			if (onoffline && result.type === 'error' && result.error instanceof TypeError) {
				keepForLater(name, formData);
				return;
			}
			await update();
			submitting = false;
			if (result.type === 'success') {
				const action = String(result.data?.done ?? '');
				open = null;
				ondone?.(action);
			}
		};
	};

	const labels: Record<Action, () => string> = {
		place: () => (someOut ? m.stock_return() : m.stock_place()),
		checkout: m.stock_checkout,
		collect: m.stock_collect,
		condition: m.stock_condition
	};
	const doneMessages: Record<string, (args: { count: number }) => string> = {
		place: m.stock_done_place,
		checkout: m.stock_done_checkout,
		collect: m.stock_done_collect,
		condition: m.stock_done_condition
	};
</script>

{#snippet ids()}
	{#each itemIds as id (id)}<input type="hidden" name="itemId" value={id} />{/each}
{/snippet}

<div class="flex flex-col gap-2">
	{#if form?.done && doneMessages[form.done]}
		<p class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
			{doneMessages[form.done]({ count: form.count ?? 0 })}
		</p>
	{:else if form?.error === 'ITEMS_ALREADY_OUT'}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
			{m.stock_error_already_out({ codes: (form.codes ?? []).join(', ') })}
		</p>
	{:else if form?.error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{m.form_invalid()}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		{#each actions as action (action)}
			<button
				type="button"
				class="btn {open === action ? 'btn-primary' : ''}"
				onclick={() => (open = open === action ? null : action)}
			>
				{labels[action]()}
			</button>
		{/each}
	</div>

	{#if open === 'place'}
		<form method="POST" action="?/place" use:enhance={submit} class="card flex flex-col gap-3 p-4">
			{@render ids()}
			<div>
				<label class="label" for="place-box">{m.field_box()}</label>
				<select class="input" id="place-box" name="boxId" required value={defaultBoxId ?? ''}>
					<option value="" disabled>{m.stock_choose_box()}</option>
					{#each boxes as box (box.id)}
						<option value={box.id}>
							{box.code} · {box.label}{box.shelf ? ` (${box.shelf})` : ''}
						</option>
					{/each}
				</select>
			</div>
			<input class="input" name="note" placeholder={m.field_note_optional()} />
			<button class="btn btn-primary" disabled={submitting}>{labels.place()}</button>
		</form>
	{:else if open === 'checkout'}
		<form
			method="POST"
			action="?/checkout"
			use:enhance={submit}
			class="card flex flex-col gap-3 p-4"
		>
			{@render ids()}
			<div>
				<label class="label" for="borrower">{m.field_borrower()}</label>
				<select class="input" id="borrower" name="borrowerUserId" bind:value={borrowerUserId}>
					<option value="">{m.stock_borrower_other()}</option>
					{#each users as user (user.id)}
						<option value={user.id}>{user.firstName} {user.lastName}</option>
					{/each}
				</select>
			</div>
			{#if !borrowerUserId}
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<input class="input" name="borrowerName" required placeholder={m.field_borrower_name()} />
					<input
						class="input"
						name="borrowerPhone"
						type="tel"
						placeholder={m.field_phone_optional()}
					/>
				</div>
			{/if}
			{#if role !== 'CHOREOGRAPHER' && contacts.length}
				<div>
					<label class="label" for="contact">{m.field_contact()}</label>
					<select class="input" id="contact" name="contactUserId">
						<option value="">{m.contact_none()}</option>
						{#each contacts as contact (contact.id)}
							<option value={contact.id}>{contact.firstName} {contact.lastName}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-stone-500">{m.field_contact_hint()}</p>
				</div>
			{/if}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<div>
					<label class="label" for="dueAt">{m.field_due_at()}</label>
					<input class="input" id="dueAt" name="dueAt" type="date" value={defaultDue} />
				</div>
				<div>
					<label class="label" for="reason">{m.field_reason()}</label>
					<input
						class="input"
						id="reason"
						name="reason"
						placeholder={m.field_reason_placeholder()}
					/>
				</div>
			</div>
			<button class="btn btn-primary" disabled={submitting}>{m.stock_checkout()}</button>
		</form>
	{:else if open === 'collect'}
		<form
			method="POST"
			action="?/collect"
			use:enhance={submit}
			class="card flex flex-col gap-3 p-4"
		>
			{@render ids()}
			<p class="text-sm text-stone-600">{m.stock_collect_help()}</p>
			<input class="input" name="note" placeholder={m.field_note_optional()} />
			<button class="btn btn-primary" disabled={submitting}>{m.stock_collect()}</button>
		</form>
	{:else if open === 'condition'}
		<form
			method="POST"
			action="?/condition"
			use:enhance={submit}
			class="card flex flex-col gap-3 p-4"
		>
			{@render ids()}
			<select class="input" name="condition" required>
				{#each conditions as condition (condition)}
					<option value={condition}>{conditionLabel(condition)}</option>
				{/each}
			</select>
			<input class="input" name="note" placeholder={m.field_note_optional()} />
			<button class="btn btn-primary" disabled={submitting}>{m.action_save()}</button>
		</form>
	{/if}
</div>
