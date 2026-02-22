<script lang="ts">
	import type { TaskHistoryEntry } from '$lib/tasksRepo';

	let { open, taskTitle, entries, isLoading, error, onClose } = $props<{
		open: boolean;
		taskTitle: string;
		entries: readonly TaskHistoryEntry[];
		isLoading: boolean;
		error: string;
		onClose: () => void;
	}>();
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				onClose();
			}
		}}
	>
		<div
			class="w-full max-w-2xl rounded-xl border border-slate-300 bg-white p-4 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="task-history-title"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="min-w-0">
					<h2 id="task-history-title" class="text-base font-semibold text-slate-900">
						タスク変更履歴
					</h2>
					{#if taskTitle.length > 0}
						<p class="truncate text-xs text-slate-500">{taskTitle}</p>
					{/if}
				</div>
				<button
					type="button"
					class="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100"
					onclick={onClose}
					aria-label="close-history"
				>
					×
				</button>
			</div>

			{#if isLoading}
				<p class="text-sm text-slate-500">読み込み中...</p>
			{:else if error}
				<p class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
			{:else if entries.length === 0}
				<p class="text-sm text-slate-500">履歴はありません。</p>
			{:else}
				<ul class="grid max-h-[60vh] gap-2 overflow-auto pr-1">
					{#each entries as entry (entry.id)}
						<li class="rounded-lg border border-slate-200 bg-white px-3 py-2">
							<div class="flex items-center justify-between gap-2">
								<span class="text-sm font-semibold text-slate-800">{entry.action}</span>
								<time class="text-xs text-slate-500">{entry.createdAt}</time>
							</div>
							{#if entry.changedFields.length > 0}
								<p class="mt-1 text-xs text-slate-500">fields: {entry.changedFields.join(', ')}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}
