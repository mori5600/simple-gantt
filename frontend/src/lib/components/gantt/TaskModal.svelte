<script lang="ts">
	import type { Task, User } from '$lib/tasksRepo';

	type ModalMode = 'create' | 'edit';

	let {
		open,
		mode,
		title,
		note,
		startDate,
		endDate,
		progress,
		users,
		tasks,
		currentTaskId,
		assigneeIds,
		predecessorTaskId,
		error,
		isSubmitting,
		onClose,
		onSubmit,
		onTitleChange,
		onNoteChange,
		onStartDateChange,
		onEndDateChange,
		onProgressChange,
		onToggleAssignee,
		onPredecessorChange
	} = $props<{
		open: boolean;
		mode: ModalMode;
		title: string;
		note: string;
		startDate: string;
		endDate: string;
		progress: number;
		users: readonly User[];
		tasks: readonly Task[];
		currentTaskId: string | null;
		assigneeIds: string[];
		predecessorTaskId: string;
		error: string;
		isSubmitting: boolean;
		onClose: () => void;
		onSubmit: (event: SubmitEvent) => void;
		onTitleChange: (value: string) => void;
		onNoteChange: (value: string) => void;
		onStartDateChange: (value: string) => void;
		onEndDateChange: (value: string) => void;
		onProgressChange: (value: number) => void;
		onToggleAssignee: (userId: string) => void;
		onPredecessorChange: (taskId: string) => void;
	}>();

	const selectedUsers = $derived.by(() =>
		users.filter((user: User) => assigneeIds.includes(user.id))
	);
	const availablePredecessors = $derived.by(() =>
		tasks.filter((task: Task) => task.id !== currentTaskId)
	);
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
			class="w-full max-w-md rounded-xl border border-slate-300 bg-white p-4 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="task-modal-title"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 id="task-modal-title" class="text-base font-semibold">
					{mode === 'create' ? 'タスク追加' : 'タスク編集'}
				</h2>
				<button
					type="button"
					class="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100"
					onclick={onClose}
					aria-label="close"
				>
					×
				</button>
			</div>

			<form class="grid gap-3" onsubmit={onSubmit}>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>title</span>
					<input
						type="text"
						name="taskTitle"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={title}
						oninput={(event) => onTitleChange((event.currentTarget as HTMLInputElement).value)}
						required
					/>
				</label>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>note</span>
					<textarea
						name="taskNote"
						class="min-h-24 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={note}
						oninput={(event) => onNoteChange((event.currentTarget as HTMLTextAreaElement).value)}
						placeholder="メモを入力"
					></textarea>
				</label>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>startDate</span>
					<input
						type="date"
						name="taskStartDate"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={startDate}
						oninput={(event) => onStartDateChange((event.currentTarget as HTMLInputElement).value)}
						required
					/>
				</label>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>endDate</span>
					<input
						type="date"
						name="taskEndDate"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={endDate}
						oninput={(event) => onEndDateChange((event.currentTarget as HTMLInputElement).value)}
						required
					/>
				</label>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>progress (0..100)</span>
					<input
						type="number"
						name="taskProgress"
						min="0"
						max="100"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={progress}
						oninput={(event) =>
							onProgressChange(Number((event.currentTarget as HTMLInputElement).value))}
						required
					/>
				</label>
				<label class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>predecessor</span>
					<select
						name="taskPredecessorTaskId"
						class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
						value={predecessorTaskId}
						onchange={(event) =>
							onPredecessorChange((event.currentTarget as HTMLSelectElement).value)}
					>
						<option value="">なし</option>
						{#each availablePredecessors as task (task.id)}
							<option value={task.id}>
								{task.title} (end: {task.endDate}, {task.progress}%)
							</option>
						{/each}
					</select>
				</label>

				<div class="grid gap-1 text-sm font-semibold text-slate-700">
					<span>assignees ({assigneeIds.length})</span>
					<div
						class="flex min-h-8 flex-wrap gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1"
					>
						{#if selectedUsers.length === 0}
							<span class="text-xs font-normal text-slate-500">未割り当て</span>
						{:else}
							{#each selectedUsers as user (user.id)}
								<span
									class="max-w-[96px] truncate rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-800"
								>
									{user.name}
								</span>
							{/each}
						{/if}
					</div>
					<div class="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
						{#each users as user (user.id)}
							<label class="flex items-center gap-2 text-sm font-normal text-slate-700">
								<input
									type="checkbox"
									name="taskAssigneeIds"
									value={user.id}
									class="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
									checked={assigneeIds.includes(user.id)}
									onchange={() => onToggleAssignee(user.id)}
								/>
								<span>{user.name}</span>
							</label>
						{/each}
					</div>
				</div>

				{#if error}
					<p class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
				{/if}

				<div class="mt-1 flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
						onclick={onClose}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
