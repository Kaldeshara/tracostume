<script lang="ts">
	import type { ItemCondition } from '../../generated/prisma/enums';
	import { conditionLabel } from '#lib/format.ts';

	let { condition }: { condition: ItemCondition } = $props();

	const colors: Record<ItemCondition, string> = {
		GOOD: 'bg-emerald-100 text-emerald-800',
		TO_WASH: 'bg-sky-100 text-sky-800',
		TO_REPAIR: 'bg-amber-100 text-amber-800',
		IN_REPAIR: 'bg-amber-100 text-amber-800',
		DAMAGED: 'bg-orange-100 text-orange-800',
		LOST: 'bg-red-100 text-red-800',
		RETIRED: 'bg-stone-200 text-stone-700'
	};
</script>

<span class="chip {colors[condition]}">{conditionLabel(condition)}</span>
