<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, isOverdue } from '#lib/format.ts';
	import { selection } from '#lib/selection.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Loan = (typeof data.loans)[number];

	const DAY = 24 * 3600 * 1000;
	const sections = $derived.by(() => {
		const now = Date.now();
		const overdue: Loan[] = [];
		const soon: Loan[] = [];
		const later: Loan[] = [];
		for (const loan of data.loans) {
			const due = loan.dueAt ? new Date(loan.dueAt).getTime() : null;
			if (due !== null && due < now) overdue.push(loan);
			else if (due !== null && due < now + 7 * DAY) soon.push(loan);
			else later.push(loan);
		}
		return [
			{ key: 'overdue', title: m.loans_overdue(), loans: overdue, tone: 'bg-red-50 text-red-800' },
			{ key: 'soon', title: m.loans_due_soon(), loans: soon, tone: 'bg-amber-50 text-amber-800' },
			{ key: 'later', title: m.loans_later(), loans: later, tone: 'bg-stone-100 text-stone-700' }
		].filter((section) => section.loans.length);
	});

	// Group a section's loans by borrower, so a reminder can be sent to one person for all items.
	function byBorrower(loans: Loan[]) {
		const groups = new Map<string, Loan[]>();
		for (const loan of loans)
			groups.set(loan.borrower, [...(groups.get(loan.borrower) ?? []), loan]);
		return [...groups.entries()];
	}

	function reminderLink(phone: string, borrower: string, loans: Loan[]) {
		const lines = loans.map(
			(loan) =>
				`- ${loan.item.name} (${loan.item.code})${loan.dueAt ? ` · ${formatDate(loan.dueAt)}` : ''}`
		);
		const text = m.loans_reminder_text({ name: borrower.split(' ')[0] }) + '\n' + lines.join('\n');
		return `sms:${phone.replace(/\s+/g, '')}?&body=${encodeURIComponent(text)}`;
	}
</script>

<svelte:head><title>{m.loans_title()}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="flex-1">{data.mineOnly ? m.loans_mine() : m.loans_title()}</h1>
	{#if data.keeper}
		<a class="btn" href={data.mineOnly ? '/loans' : '/loans?mine'}>
			{data.mineOnly ? m.loans_all() : m.loans_mine()}
		</a>
	{/if}
</div>

{#each sections as section (section.key)}
	<section class="mb-6">
		<h2 class="mb-2 inline-block rounded-lg px-2 py-1 {section.tone}">
			{section.title} ({section.loans.length})
		</h2>
		<div class="flex flex-col gap-3">
			{#each byBorrower(section.loans) as [borrower, loans] (borrower)}
				<div class="card overflow-hidden">
					<header class="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2">
						<span class="font-semibold">{borrower}</span>
						{#if loans[0].phone}
							<a class="link text-sm" href="tel:{loans[0].phone}">{loans[0].phone}</a>
							{#if data.keeper && section.key !== 'later'}
								<a class="btn ml-auto py-1" href={reminderLink(loans[0].phone, borrower, loans)}>
									{m.loans_send_reminder()}
								</a>
							{/if}
						{/if}
						<button
							type="button"
							class="btn py-1 {loans[0].phone && data.keeper && section.key !== 'later'
								? ''
								: 'ml-auto'}"
							onclick={() => selection.add(...loans.map((loan) => loan.item.id))}
						>
							{m.selection_add_all()}
						</button>
					</header>
					<ul class="divide-y divide-stone-100">
						{#each loans as loan (loan.id)}
							<li class="flex items-center gap-3 px-4 py-2">
								<div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
									{#if loan.item.photoId}
										<img
											src="/photos/{loan.item.photoId}"
											alt=""
											class="h-full w-full object-cover"
										/>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<a href="/items/{loan.item.id}" class="block truncate font-medium"
										>{loan.item.name}</a
									>
									<div class="text-xs text-stone-500">
										<span class="font-mono">{loan.item.code}</span>
										{#if loan.item.size}· {loan.item.size}{/if}
										· {m.loan_since()}
										{formatDate(loan.checkedOutAt)}
										{#if loan.reason}· {loan.reason}{/if}
									</div>
								</div>
								{#if loan.dueAt}
									<span
										class="text-sm {isOverdue(loan.dueAt)
											? 'font-semibold text-red-700'
											: 'text-stone-600'}"
									>
										{formatDate(loan.dueAt)}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>
{:else}
	<p class="card p-8 text-center text-stone-500">{m.loans_empty()}</p>
{/each}
