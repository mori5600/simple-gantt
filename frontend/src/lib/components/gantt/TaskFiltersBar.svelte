<script lang="ts">
	import type { TaskCompletionFilter } from '$lib/features/gantt/types';
	import type { User } from '$lib/tasksRepo';

	let {
		users,
		query,
		assignee,
		status,
		rangeStart,
		rangeEnd,
		total,
		matched,
		hasActive,
		onQueryChange,
		onAssigneeChange,
		onStatusChange,
		onRangeStartChange,
		onRangeEndChange,
		onReset
	} = $props<{
		users: readonly User[];
		query: string;
		assignee: string;
		status: TaskCompletionFilter;
		rangeStart: string;
		rangeEnd: string;
		total: number;
		matched: number;
		hasActive: boolean;
		onQueryChange: (value: string) => void;
		onAssigneeChange: (value: string) => void;
		onStatusChange: (value: TaskCompletionFilter) => void;
		onRangeStartChange: (value: string) => void;
		onRangeEndChange: (value: string) => void;
		onReset: () => void;
	}>();

	const summaryText = $derived(total === 0 ? '0 tasks' : `${matched} / ${total} tasks`);
</script>

<section class="border-b border-slate-300 bg-white">
	<div class="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
		<label class="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-slate-600">
			<span class="tracking-wide text-slate-500 uppercase">Search</span>
			<div class="relative">
				<input
					type="search"
					name="taskFilterQuery"
					class="search-input w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
					placeholder="title を検索"
					value={query}
					oninput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
				/>
				{#if query.trim().length > 0}
					<button
						type="button"
						class="absolute inset-y-0 right-2 my-auto h-6 w-6 rounded-md text-slate-500 transition hover:bg-slate-100"
						aria-label="検索条件をクリア"
						onclick={() => onQueryChange('')}
					>
						×
					</button>
				{/if}
			</div>
		</label>

		<label class="grid gap-1 text-xs font-semibold text-slate-600">
			<span class="tracking-wide text-slate-500 uppercase">Assignee</span>
			<select
				name="taskFilterAssignee"
				class="min-w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
				value={assignee}
				onchange={(event) => onAssigneeChange((event.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">全て</option>
				<option value="__unassigned__">未割り当て</option>
				{#each users as user (user.id)}
					<option value={user.id}>{user.name}</option>
				{/each}
			</select>
		</label>

		<label class="grid gap-1 text-xs font-semibold text-slate-600">
			<span class="tracking-wide text-slate-500 uppercase">Status</span>
			<select
				name="taskFilterStatus"
				class="min-w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
				value={status}
				onchange={(event) =>
					onStatusChange((event.currentTarget as HTMLSelectElement).value as TaskCompletionFilter)}
			>
				<option value="all">全て</option>
				<option value="incomplete">未完了</option>
				<option value="complete">完了</option>
			</select>
		</label>

		<label class="grid gap-1 text-xs font-semibold text-slate-600">
			<span class="tracking-wide text-slate-500 uppercase">From</span>
			<input
				type="date"
				name="taskFilterRangeStart"
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
				value={rangeStart}
				oninput={(event) => onRangeStartChange((event.currentTarget as HTMLInputElement).value)}
			/>
		</label>

		<label class="grid gap-1 text-xs font-semibold text-slate-600">
			<span class="tracking-wide text-slate-500 uppercase">To</span>
			<input
				type="date"
				name="taskFilterRangeEnd"
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
				value={rangeEnd}
				oninput={(event) => onRangeEndChange((event.currentTarget as HTMLInputElement).value)}
			/>
		</label>

		<div class="flex items-center gap-2 sm:pb-[2px]">
			<button
				type="button"
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
				onclick={onReset}
				disabled={!hasActive}
			>
				リセット
			</button>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3 px-3 pb-2 text-xs text-slate-500">
		<span>{summaryText}</span>
		<span class="hidden sm:inline">フィルタ条件は自動保存されます</span>
	</div>
</section>

<style>
	.search-input::-webkit-search-decoration,
	.search-input::-webkit-search-cancel-button,
	.search-input::-webkit-search-results-button,
	.search-input::-webkit-search-results-decoration {
		appearance: none;
	}

	.search-input::-ms-clear,
	.search-input::-ms-reveal {
		display: none;
		width: 0;
		height: 0;
	}
</style>
