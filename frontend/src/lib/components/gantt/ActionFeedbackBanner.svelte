<script lang="ts">
	let { actionError, actionSuccess } = $props<{
		actionError: string;
		actionSuccess: string;
	}>();
</script>

{#if actionError}
	<div class="border-y border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
		{actionError}
	</div>
{/if}
{#if actionSuccess}
	<div class="border-y border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
		{actionSuccess}
	</div>
{/if}
