<script lang="ts">
	import { getLocale, locales, setLocale } from '#lib/paraglide/runtime.js';

	const names: Record<string, string> = { fr: 'Français', en: 'English' };
</script>

<select
	class="input w-auto py-1"
	value={getLocale()}
	onchange={(event) => setLocale(event.currentTarget.value as (typeof locales)[number])}
	aria-label="Language"
>
	{#each locales as locale (locale)}
		<option value={locale}>{names[locale] ?? locale}</option>
	{/each}
</select>
