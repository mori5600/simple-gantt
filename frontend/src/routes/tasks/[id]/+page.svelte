<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toggleAssignee, toCreateTaskInput, validateTaskForm } from '$lib/features/gantt/state';
	import type { TaskFormInput } from '$lib/features/gantt/state';
	import { tasksRepo, type Task, type TaskHistoryEntry, type User } from '$lib/tasksRepo';

	const EMPTY_TASK_FORM: TaskFormInput = {
		title: '',
		note: '',
		startDate: '',
		endDate: '',
		progress: 0,
		assigneeIds: [],
		predecessorTaskId: ''
	};

	const taskId = $derived(page.params.id ?? '');
	const projectId = $derived(page.url.searchParams.get('projectId')?.trim() ?? '');

	let isLoading = $state(true);
	let isSubmitting = $state(false);
	let error = $state('');
	let success = $state('');
	let users = $state<User[]>([]);
	let tasks = $state<Task[]>([]);
	let historyEntries = $state<TaskHistoryEntry[]>([]);
	let sourceUpdatedAt = $state('');
	let taskTitle = $state('');
	let taskForm = $state<TaskFormInput>({ ...EMPTY_TASK_FORM });

	const selectedUsers = $derived.by(() =>
		users.filter((user) => taskForm.assigneeIds.includes(user.id))
	);
	const availablePredecessors = $derived.by(() => tasks.filter((task) => task.id !== taskId));

	onMount(() => {
		void loadEditData();
	});

	async function loadEditData(): Promise<void> {
		const currentProjectId = projectId;
		const currentTaskId = taskId;
		if (!currentProjectId) {
			error = 'projectId クエリは必須です。';
			isLoading = false;
			return;
		}
		if (!currentTaskId) {
			error = 'taskId が不正です。';
			isLoading = false;
			return;
		}

		isLoading = true;
		error = '';
		success = '';

		try {
			const [loadedTasks, loadedUsers, loadedHistory] = await Promise.all([
				tasksRepo.list(currentProjectId),
				tasksRepo.listUsers(),
				tasksRepo.listTaskHistory(currentProjectId, currentTaskId)
			]);
			const task = loadedTasks.find((row) => row.id === currentTaskId);
			if (!task) {
				error = `task not found: ${currentTaskId}`;
				return;
			}

			tasks = loadedTasks;
			users = loadedUsers;
			historyEntries = loadedHistory;
			taskTitle = task.title;
			sourceUpdatedAt = task.updatedAt;
			taskForm = {
				title: task.title,
				note: task.note,
				startDate: task.startDate,
				endDate: task.endDate,
				progress: task.progress,
				assigneeIds: [...task.assigneeIds],
				predecessorTaskId: task.predecessorTaskId ?? ''
			};
		} catch (loadError) {
			error =
				loadError instanceof Error ? loadError.message : '編集データの読み込みに失敗しました。';
		} finally {
			isLoading = false;
		}
	}

	function toggleFormAssignee(userId: string): void {
		taskForm.assigneeIds = toggleAssignee(taskForm.assigneeIds, userId);
	}

	async function submitEdit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const currentProjectId = projectId;
		const currentTaskId = taskId;
		if (!currentProjectId || !currentTaskId) {
			error = '編集対象の識別子が不足しています。';
			return;
		}

		const progress = Number(taskForm.progress);
		const validationError = validateTaskForm({
			title: taskForm.title,
			note: taskForm.note,
			startDate: taskForm.startDate,
			endDate: taskForm.endDate,
			progress,
			assigneeIds: taskForm.assigneeIds,
			predecessorTaskId: taskForm.predecessorTaskId
		});
		if (validationError) {
			error = validationError;
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';

		try {
			const createInput = toCreateTaskInput({
				title: taskForm.title,
				note: taskForm.note,
				startDate: taskForm.startDate,
				endDate: taskForm.endDate,
				progress,
				assigneeIds: taskForm.assigneeIds,
				predecessorTaskId: taskForm.predecessorTaskId
			});

			const updated = await tasksRepo.update(currentProjectId, currentTaskId, {
				...createInput,
				updatedAt: sourceUpdatedAt
			});

			const [reloadedTasks, reloadedHistory] = await Promise.all([
				tasksRepo.list(currentProjectId),
				tasksRepo.listTaskHistory(currentProjectId, currentTaskId)
			]);
			const latestTask = reloadedTasks.find((task) => task.id === currentTaskId) ?? updated;

			tasks = reloadedTasks;
			historyEntries = reloadedHistory;
			taskTitle = latestTask.title;
			sourceUpdatedAt = latestTask.updatedAt;
			taskForm = {
				title: latestTask.title,
				note: latestTask.note,
				startDate: latestTask.startDate,
				endDate: latestTask.endDate,
				progress: latestTask.progress,
				assigneeIds: [...latestTask.assigneeIds],
				predecessorTaskId: latestTask.predecessorTaskId ?? ''
			};
			success = 'タスクを更新しました。';
		} catch (updateError) {
			error = updateError instanceof Error ? updateError.message : 'タスク更新に失敗しました。';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-800">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
		<header class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-slate-900">タスク編集</h1>
				<p class="text-sm text-slate-600">{taskTitle || taskId}</p>
			</div>
			<a
				href={resolve('/')}
				class="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
			>
				ガントへ戻る
			</a>
		</header>

		{#if isLoading}
			<section class="rounded-2xl border border-slate-300 bg-white px-4 py-6 shadow-sm">
				<p class="text-sm text-slate-500">読み込み中...</p>
			</section>
		{:else}
			<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
				<section class="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
					<form class="grid gap-3" onsubmit={submitEdit}>
						<label class="grid gap-1 text-sm font-semibold text-slate-700">
							<span>title</span>
							<input
								type="text"
								name="taskTitle"
								class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
								value={taskForm.title}
								oninput={(event) =>
									(taskForm.title = (event.currentTarget as HTMLInputElement).value)}
								required
							/>
						</label>
						<label class="grid gap-1 text-sm font-semibold text-slate-700">
							<span>note</span>
							<textarea
								name="taskNote"
								class="min-h-24 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
								value={taskForm.note}
								oninput={(event) =>
									(taskForm.note = (event.currentTarget as HTMLTextAreaElement).value)}
								placeholder="メモを入力"
							></textarea>
						</label>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="grid gap-1 text-sm font-semibold text-slate-700">
								<span>startDate</span>
								<input
									type="date"
									name="taskStartDate"
									class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
									value={taskForm.startDate}
									oninput={(event) =>
										(taskForm.startDate = (event.currentTarget as HTMLInputElement).value)}
									required
								/>
							</label>
							<label class="grid gap-1 text-sm font-semibold text-slate-700">
								<span>endDate</span>
								<input
									type="date"
									name="taskEndDate"
									class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
									value={taskForm.endDate}
									oninput={(event) =>
										(taskForm.endDate = (event.currentTarget as HTMLInputElement).value)}
									required
								/>
							</label>
						</div>

						<label class="grid gap-1 text-sm font-semibold text-slate-700">
							<span>progress (0..100)</span>
							<input
								type="number"
								name="taskProgress"
								min="0"
								max="100"
								class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
								value={taskForm.progress}
								oninput={(event) =>
									(taskForm.progress = Number((event.currentTarget as HTMLInputElement).value))}
								required
							/>
						</label>

						<label class="grid gap-1 text-sm font-semibold text-slate-700">
							<span>predecessor</span>
							<select
								name="taskPredecessorTaskId"
								class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ring-sky-500/40 transition outline-none focus:ring-2"
								value={taskForm.predecessorTaskId}
								onchange={(event) =>
									(taskForm.predecessorTaskId = (event.currentTarget as HTMLSelectElement).value)}
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
							<span>assignees ({taskForm.assigneeIds.length})</span>
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
							<div
								class="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
							>
								{#each users as user (user.id)}
									<label class="flex items-center gap-2 text-sm font-normal text-slate-700">
										<input
											type="checkbox"
											name="taskAssigneeIds"
											value={user.id}
											class="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
											checked={taskForm.assigneeIds.includes(user.id)}
											onchange={() => toggleFormAssignee(user.id)}
										/>
										<span>{user.name}</span>
									</label>
								{/each}
							</div>
						</div>

						{#if error}
							<p class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
						{/if}
						{#if success}
							<p class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>
						{/if}

						<div class="mt-1 flex justify-end">
							<button
								type="submit"
								class="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
								disabled={isSubmitting}
							>
								{isSubmitting ? '保存中...' : '保存'}
							</button>
						</div>
					</form>
				</section>

				<section class="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
					<h2 class="text-base font-semibold text-slate-900">変更履歴</h2>
					{#if historyEntries.length === 0}
						<p class="mt-2 text-sm text-slate-500">履歴はありません。</p>
					{:else}
						<ul class="mt-2 grid max-h-[70vh] gap-2 overflow-auto pr-1">
							{#each historyEntries as entry (entry.id)}
								<li class="rounded-lg border border-slate-200 bg-white px-3 py-2">
									<div class="flex items-center justify-between gap-2">
										<span class="text-sm font-semibold text-slate-800">{entry.action}</span>
										<time class="text-xs text-slate-500">{entry.createdAt}</time>
									</div>
									{#if entry.changedFields.length > 0}
										<p class="mt-1 text-xs text-slate-500">
											fields: {entry.changedFields.join(', ')}
										</p>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>
