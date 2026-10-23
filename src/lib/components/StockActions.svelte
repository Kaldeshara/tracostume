<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { CONDITIONS, conditionLabel, toDateInput } from '#lib/format.ts';

	type Props = {
		itemIds: string[];
		boxes: { id: string; code: string; label: string; shelf: string | null }[];
		users: { id: string; firstName: string; lastName: string }[];
		/** Pre-selected box for storing/returning. */
		defaultBoxId?: string | null;
		/** Whether some of the items are currently lent (changes the wording). */
		someOut?: boolean;
		/** Whether all items are currently lent (hides check-out). */
		allOut?: boolean;
		form?: { done?: string; count?: number; error?: string; codes?: string[] } | null;
		/** Called after a successful action, e.g. to clear the selection. */
		ondone?: (action: string) => void;
	};

	let {
		itemIds,
		boxes,
		users,
		defaultBoxId = null,
		someOut = false,
		allOut = false,
		form = null,
		ondone
	}: Props = $props();

	let open = $state<'place' | 'checkout' | 'condition' | null>(null);
	let borrowerUserId = $state('');
	let submitting = $state(false);

	// Default due date: two weeks from today.
	const defaultDue = toDateInput(new Date(Date.now() + 14 * 24 * 3600 * 1000));

	const submit = () => {
		submitting = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			await update();
			submitting = false;
			if (result.type === 'success') {
				const action = String(result.data?.done ?? '');
				open = null;
				ondone?.(action);
			}
		};
	};

	const doneMessages: Record<string, (args: { count: number }) => string> = {
		place: m.stock_done_place,
		checkout: m.stock_done_checkout,
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
		<button
			type="button"
			class="btn {open === 'place' ? 'btn-primary' : ''}"
			onclick={() => (open = open === 'place' ? null : 'place')}
		>
			{someOut ? m.stock_return() : m.stock_place()}
		</button>
		{#if !allOut}
			<button
				type="button"
				class="btn {open === 'checkout' ? 'btn-primary' : ''}"
				onclick={() => (open = open === 'checkout' ? null : 'checkout')}
			>
				{m.stock_checkout()}
			</button>
		{/if}
		<button
			type="button"
			class="btn {open === 'condition' ? 'btn-primary' : ''}"
			onclick={() => (open = open === 'condition' ? null : 'condition')}
		>
			{m.stock_condition()}
		</button>
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
			<button class="btn btn-primary" disabled={submitting}>
				{someOut ? m.stock_return() : m.stock_place()}
			</button>
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
	{:else if open === 'condition'}
		<form
			method="POST"
			action="?/condition"
			use:enhance={submit}
			class="card flex flex-col gap-3 p-4"
		>
			{@render ids()}
			<select class="input" name="condition" required>
				{#each CONDITIONS as condition (condition)}
					<option value={condition}>{conditionLabel(condition)}</option>
				{/each}
			</select>
			<input class="input" name="note" placeholder={m.field_note_optional()} />
			<button class="btn btn-primary" disabled={submitting}>{m.action_save()}</button>
		</form>
	{/if}
</div>
